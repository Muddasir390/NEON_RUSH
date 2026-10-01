#!/usr/bin/env python3
"""
Direction-based animation retargeting between two humanoid glTF rigs.

usage: retarget_dir.py <target.glb> <source.glb> <out.glb> clip1,clip2,...

Rigs disagree about rest pose (T vs A), bone axes and root rotation, so copying
local rotations gives twisted or upside-down characters. Instead, for every
bone we take the *world direction* it points in the source animation (from the
bone to its main child) and rotate the target bone so it points the same way.
Twist about the bone axis is left at the target's rest orientation, which is
fine for a run cycle. Translations are dropped.
"""
import json, math, struct, sys

sys.path.insert(0, __file__.rsplit('/', 1)[0])
from retarget import add_accessor, accessor_floats, norm, qinv, qmul, read_glb, write_glb  # noqa: E402

# bone -> the child it points toward
CHAIN = {
    'Hips': 'Spine', 'Spine': 'Spine1', 'Spine1': 'Spine2', 'Spine2': 'Neck',
    'Neck': 'Head', 'Head': 'HeadTop_End',
}
for side in ('Left', 'Right'):
    CHAIN.update({
        f'{side}Shoulder': f'{side}Arm', f'{side}Arm': f'{side}ForeArm',
        f'{side}ForeArm': f'{side}Hand', f'{side}Hand': f'{side}HandMiddle1',
        f'{side}UpLeg': f'{side}Leg', f'{side}Leg': f'{side}Foot',
        f'{side}Foot': f'{side}ToeBase', f'{side}ToeBase': f'{side}Toe_End',
    })


# Canonical (Mixamo) name -> other names used by other rigs.
ALIASES = {
    'Spine1': ['Chest'], 'Spine2': ['UpperChest'],
    'ToeBase': ['Toes', 'LeftToes', 'RightToes'], 'Toe_End': ['Toes_end', 'ToeBase_end'],
    'HeadTop_End': ['Head_end', 'HeadTop'], 'HandMiddle1': ['HandIndex1', 'HandMiddle1'],
    'Neck': ['Neck1'],
}


def vnorm(v):
    n = math.sqrt(sum(x * x for x in v)) or 1.0
    return tuple(x / n for x in v)


def rotate(q, v):
    x, y, z, w = q
    # v' = q * v * q^-1
    ix = w * v[0] + y * v[2] - z * v[1]
    iy = w * v[1] + z * v[0] - x * v[2]
    iz = w * v[2] + x * v[1] - y * v[0]
    iw = -x * v[0] - y * v[1] - z * v[2]
    return (ix * w + iw * -x + iy * -z - iz * -y,
            iy * w + iw * -y + iz * -x - ix * -z,
            iz * w + iw * -z + ix * -y - iy * -x)


def swing(a, b):
    """Shortest rotation taking unit vector a to unit vector b."""
    d = sum(x * y for x, y in zip(a, b))
    if d < -0.999999:
        axis = vnorm((-a[1], a[0], 0)) if abs(a[2]) < 0.9 else vnorm((0, -a[2], a[1]))
        return (axis[0], axis[1], axis[2], 0.0)
    c = (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
    q = (c[0], c[1], c[2], 1 + d)
    n = math.sqrt(sum(x * x for x in q))
    return tuple(x / n for x in q)


def mat_mul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def trs(t, q, sc):
    x, y, z, w = q
    r = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
         [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
         [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]
    return [[r[0][0] * sc[0], r[0][1] * sc[1], r[0][2] * sc[2], t[0]],
            [r[1][0] * sc[0], r[1][1] * sc[1], r[1][2] * sc[2], t[1]],
            [r[2][0] * sc[0], r[2][1] * sc[1], r[2][2] * sc[2], t[2]],
            [0, 0, 0, 1]]


class Rig:
    def __init__(self, path):
        self.j, self.b = read_glb(path)
        nodes = self.j['nodes']
        self.parent = {}
        for i, n in enumerate(nodes):
            for c in n.get('children', []):
                self.parent[c] = i
        self.idx = {}
        for i, n in enumerate(nodes):
            if n.get('name'):
                self.idx.setdefault(norm(n['name']), i)
        self._pos = {}

    def find(self, canon):
        if not canon:
            return None
        for name in [canon] + ALIASES.get(canon, []):
            if name in self.idx:
                return self.idx[name]
        # left/right prefixed aliases, e.g. LeftToeBase -> LeftToes
        for side in ('Left', 'Right'):
            if canon.startswith(side):
                base = canon[len(side):]
                for alt in [base] + ALIASES.get(base, []):
                    if side + alt in self.idx:
                        return self.idx[side + alt]
        return None

    def rest_q(self, i):
        return tuple(self.j['nodes'][i].get('rotation', [0, 0, 0, 1]))

    def world(self, i, local):
        """World rotation of node i given a dict of local rotation overrides."""
        chain = []
        while i is not None:
            chain.append(i)
            i = self.parent.get(i)
        q = (0, 0, 0, 1)
        for n in reversed(chain):
            q = qmul(q, local.get(n, self.rest_q(n)))
        return q

    def rest_world(self, i):
        return self.world(i, {})

    def rest_pos(self, i):
        """World position of node i in the rest pose (scale included)."""
        if i not in self._pos:
            chain = []
            k = i
            while k is not None:
                chain.append(k)
                k = self.parent.get(k)
            m = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]
            for n in reversed(chain):
                nd = self.j['nodes'][n]
                m = mat_mul(m, trs(nd.get('translation', [0, 0, 0]),
                                   nd.get('rotation', [0, 0, 0, 1]),
                                   nd.get('scale', [1, 1, 1])))
            self._pos[i] = (m[0][3], m[1][3], m[2][3])
        return self._pos[i]

    def child_dir_local(self, canon):
        """Unit vector (in the bone's own rest frame) pointing at its chain child."""
        child = CHAIN.get(canon)
        if child is None:
            return None
        bi, ci = self.find(canon), self.find(child)
        if bi is None or ci is None:
            return None
        pb, pc = self.rest_pos(bi), self.rest_pos(ci)
        d = vnorm(tuple(c - b for b, c in zip(pb, pc)))
        return rotate(qinv(self.rest_world(bi)), d)


def yaw_between(src, tgt):
    """Rotation about Y that aligns the source rig's forward direction with the target's."""
    def forward(rig):
        f = rig.find('LeftFoot')
        if f is None:
            return (0, 0, 1)
        d = rig.child_dir_local('LeftFoot')
        v = rotate(rig.rest_world(f), d)
        return vnorm((v[0], 0, v[2])) if abs(v[0]) + abs(v[2]) > 1e-6 else (0, 0, 1)
    a, b = forward(src), forward(tgt)
    ang = math.atan2(b[0], b[2]) - math.atan2(a[0], a[2])
    if abs(ang) < 0.6:  # small differences are just foot splay, not a different facing
        ang = 0.0
    return (0, math.sin(ang / 2), 0, math.cos(ang / 2))


def main(target, source, out, clips):
    T, S = Rig(target), Rig(source)
    G = yaw_between(S, T)
    print('yaw fix (quat):', [round(x, 3) for x in G])
    order = []  # target bones in parent-before-child order
    seen = set()
    name_of = {}

    def visit(i):
        if i in seen:
            return
        p = T.parent.get(i)
        if p is not None:
            visit(p)
        seen.add(i)
        order.append(i)
    for canon in list(CHAIN) + list(CHAIN.values()):
        i = T.find(canon)
        if i is not None and i not in name_of:
            name_of[i] = canon
            visit(i)

    T.j.setdefault('animations', [])
    for clip in clips:
        anim = next(a for a in S.j['animations'] if a.get('name') == clip)
        chan = {}
        times = None
        for ch in anim['channels']:
            if ch['target']['path'] != 'rotation':
                continue
            sm = anim['samplers'][ch['sampler']]
            tt, _ = accessor_floats(S.j, S.b, sm['input'])
            qq, _ = accessor_floats(S.j, S.b, sm['output'])
            chan[ch['target']['node']] = [tuple(qq[i:i + 4]) for i in range(0, len(qq), 4)]
            times = times or tt
        n = len(times)
        tracks = {i: [] for i in order}
        for f in range(n):
            local = {node: qs[min(f, len(qs) - 1)] for node, qs in chan.items()}
            world = {}
            for i in order:
                name = name_of.get(i)
                di_t = T.child_dir_local(name)
                s_idx = S.find(name)
                di_s = S.child_dir_local(name)
                p = T.parent.get(i)
                p_world = world.get(p) if p in world else (T.rest_world(p) if p is not None else (0, 0, 0, 1))
                if di_t and di_s and s_idx is not None:
                    d_src = rotate(G, rotate(S.world(s_idx, local), di_s))
                    d_rest = rotate(T.rest_world(i), di_t)
                    w = qmul(swing(vnorm(d_rest), vnorm(d_src)), T.rest_world(i))
                else:
                    w = qmul(p_world, T.rest_q(i))
                world[i] = w
                tracks[i].append(qmul(qinv(p_world), w))
        t_acc = add_accessor(T.j, T.b, times, 'SCALAR', 1, minmax=True)
        samplers, channels = [], []
        for i, qs in tracks.items():
            flat = [c for q in qs for c in q]
            samplers.append({'input': t_acc, 'output': add_accessor(T.j, T.b, flat, 'VEC4', 4),
                             'interpolation': 'LINEAR'})
            channels.append({'sampler': len(samplers) - 1, 'target': {'node': i, 'path': 'rotation'}})
        T.j['animations'].append({'name': clip, 'samplers': samplers, 'channels': channels})
        print(clip, 'frames', n, 'bones', len(channels))
    T.j['buffers'] = [{'byteLength': len(T.b)}]
    write_glb(out, T.j, T.b)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4].split(','))
