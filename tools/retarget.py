#!/usr/bin/env python3
"""
Copy animation clips from one Mixamo-style skeleton onto another humanoid.

usage: retarget.py <target.glb> <source.glb> <out.glb> clip1,clip2,... [--direct]
  --direct: copy rotations unchanged (use between two Mixamo rigs)

Bones are matched by name (a leading "mixamorig:" is ignored). Rotations are
converted per bone from the source rest pose to the target rest pose, so a rig
with different bind angles (e.g. Ready Player Me) doesn't get bent joints.
Translations are dropped: the runner stays at its own hip height.
"""
import json, struct, sys


def read_glb(path):
    d = open(path, 'rb').read()
    jl = struct.unpack('<I', d[12:16])[0]
    j = json.loads(d[20:20 + jl])
    off = 20 + jl
    bl = struct.unpack('<I', d[off:off + 4])[0]
    return j, bytearray(d[off + 8:off + 8 + bl])


def write_glb(path, j, bin_):
    def pad(b, f):
        return b + f * ((4 - len(b) % 4) % 4)
    jb = pad(json.dumps(j, separators=(',', ':')).encode(), b' ')
    bb = pad(bytes(bin_), b'\0')
    total = 12 + 8 + len(jb) + 8 + len(bb)
    out = b'glTF' + struct.pack('<II', 2, total)
    out += struct.pack('<I', len(jb)) + b'JSON' + jb + struct.pack('<I', len(bb)) + b'BIN\0' + bb
    open(path, 'wb').write(out)


def norm(name):
    return (name or '').replace('mixamorig:', '').replace('mixamorig', '')


def qmul(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return (aw * bx + ax * bw + ay * bz - az * by,
            aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw,
            aw * bw - ax * bx - ay * by - az * bz)


def qinv(q):
    x, y, z, w = q
    n = x * x + y * y + z * z + w * w
    return (-x / n, -y / n, -z / n, w / n)


def accessor_floats(j, b, idx):
    a = j['accessors'][idx]
    bv = j['bufferViews'][a['bufferView']]
    n = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}[a['type']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    return list(struct.unpack('<%df' % (a['count'] * n), bytes(b[off:off + a['count'] * n * 4]))), n


def add_accessor(j, b, floats, typ, n, minmax=False):
    while len(b) % 4:
        b.append(0)
    start = len(b)
    b += struct.pack('<%df' % len(floats), *floats)
    j['bufferViews'].append({'buffer': 0, 'byteOffset': start, 'byteLength': len(floats) * 4})
    acc = {'bufferView': len(j['bufferViews']) - 1, 'componentType': 5126,
           'count': len(floats) // n, 'type': typ}
    if minmax:
        acc['min'] = [min(floats)]
        acc['max'] = [max(floats)]
    j['accessors'].append(acc)
    return len(j['accessors']) - 1


def main(target, source, out, clips, direct=False):
    tj, tb = read_glb(target)
    sj, sb = read_glb(source)
    t_index = {norm(n.get('name')): i for i, n in enumerate(tj['nodes'])}
    rest = lambda node: tuple(node.get('rotation', [0, 0, 0, 1]))
    tj.setdefault('animations', [])
    for clip in clips:
        anim = next(a for a in sj['animations'] if a.get('name') == clip)
        samplers, channels, cache = [], [], {}
        for ch in anim['channels']:
            if ch['target']['path'] != 'rotation':
                continue
            src_node = sj['nodes'][ch['target']['node']]
            name = norm(src_node.get('name'))
            if name not in t_index:
                continue
            sm = anim['samplers'][ch['sampler']]
            times, _ = accessor_floats(sj, sb, sm['input'])
            quats, _ = accessor_floats(sj, sb, sm['output'])
            r_src, r_tgt = rest(src_node), rest(tj['nodes'][t_index[name]])
            inv = qinv(r_src)
            if direct:  # Mixamo -> Mixamo: rotations are absolute, copy as-is
                r_tgt, inv = (0, 0, 0, 1), (0, 0, 0, 1)
            new = []
            for i in range(0, len(quats), 4):
                q = tuple(quats[i:i + 4])
                new += list(qmul(r_tgt, qmul(inv, q)))
            key = tuple(times)
            if key not in cache:
                cache[key] = add_accessor(tj, tb, times, 'SCALAR', 1, minmax=True)
            samplers.append({'input': cache[key], 'output': add_accessor(tj, tb, new, 'VEC4', 4),
                             'interpolation': 'LINEAR'})
            channels.append({'sampler': len(samplers) - 1,
                             'target': {'node': t_index[name], 'path': 'rotation'}})
        tj['animations'].append({'name': clip, 'samplers': samplers, 'channels': channels})
        print(clip, 'channels', len(channels))
    tj['buffers'] = [{'byteLength': len(tb)}]
    write_glb(out, tj, tb)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4].split(','), '--direct' in sys.argv)
