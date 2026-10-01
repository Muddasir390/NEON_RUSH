#!/usr/bin/env python3
"""
Prepare a .glb character for the React Native game.

React Native has no image decoder that three.js can use, so this tool:
  * keeps only the animations you name,
  * keeps only base-colour textures, shrinks them and stores them as raw RGBA,
  * drops everything unused from the binary buffer,
and writes game/assets/models/<name>.ts (base64 GLB + raw textures).

usage: prepare_model.py <in.glb> <name> <tex_size> [anim1,anim2,...|ALL] [shift,h0,h1,deg | tint,hue,satMul,satAdd,tex/tex]
"""
import base64, io, json, struct, sys
from PIL import Image


def read_glb(path):
    d = open(path, 'rb').read()
    assert d[:4] == b'glTF'
    jl = struct.unpack('<I', d[12:16])[0]
    j = json.loads(d[20:20 + jl])
    off = 20 + jl
    bl = struct.unpack('<I', d[off:off + 4])[0]
    return j, d[off + 8:off + 8 + bl]


def hue_shift(im, pick, change):
    hsv = im.convert('RGB').convert('HSV')
    px = hsv.load()
    w, h = hsv.size
    for y in range(h):
        for x in range(w):
            hh, sat, val = px[x, y]
            deg = hh * 360 / 255
            if pick(deg, sat, val):
                nd, ns = change(deg, sat)
                px[x, y] = (int(nd % 360 * 255 / 360), int(ns), val)
    return Image.merge('RGBA', (*hsv.convert('RGB').split(), im.split()[3]))


def pad(b, fill):
    return b + fill * ((4 - len(b) % 4) % 4)


def prepare(src, name, tex_size, keep):
    j, bin_ = read_glb(src)

    # animations
    if keep != 'ALL':
        j['animations'] = [a for a in j.get('animations', []) if a.get('name') in keep]

    # facial morph targets are huge and unused in the game
    for mesh in j['meshes']:
        for prim in mesh['primitives']:
            prim.pop('targets', None)
        mesh.pop('weights', None)

    # materials: base colour only
    used_tex = set()
    for m in j['materials']:
        pbr = m.setdefault('pbrMetallicRoughness', {})
        pbr.pop('metallicRoughnessTexture', None)
        for k in ('normalTexture', 'occlusionTexture', 'emissiveTexture'):
            m.pop(k, None)
        m.pop('extensions', None)
        if 'baseColorTexture' in pbr:
            used_tex.add(pbr['baseColorTexture']['index'])
    j.pop('extensionsUsed', None)
    j.pop('extensionsRequired', None)

    # raw textures
    raw = {}
    for ti in sorted(used_tex):
        img = j['images'][j['textures'][ti]['source']]
        bv = j['bufferViews'][img['bufferView']]
        data = bin_[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
        im = Image.open(io.BytesIO(data)).convert('RGBA')
        size = min(tex_size, max(im.size)) if max(im.size) > 16 else 4  # keep flat-colour textures tiny
        im = im.resize((size, size), Image.LANCZOS)
        if RECOLOR and RECOLOR[0] == 'shift':  # hue-shift saturated pixels in [h0,h1] (whole model)
            _, h0, h1, shift = RECOLOR
            im = hue_shift(im, lambda deg, sat, val: h0 <= deg <= h1 and sat > 60 and val > 50,
                           lambda deg, sat: ((deg + shift) % 360, sat))
        elif RECOLOR and RECOLOR[0] == 'tint' and ti in RECOLOR[4]:  # colourise whole textures
            _, hue, smul, sadd, _ = RECOLOR
            im = hue_shift(im, lambda deg, sat, val: True,
                           lambda deg, sat: (hue, min(255, sat * smul + sadd)))
        raw[str(ti)] = {'w': size, 'h': size, 'data': base64.b64encode(im.tobytes()).decode()}
    for t in j.get('textures', []):
        t.pop('source', None)
    j.pop('images', None)

    # accessors still needed
    need = set()
    for mesh in j['meshes']:
        for p in mesh['primitives']:
            need.update(p['attributes'].values())
            if 'indices' in p:
                need.add(p['indices'])
            for t in p.get('targets', []):
                need.update(t.values())
    for s in j.get('skins', []):
        if 'inverseBindMatrices' in s:
            need.add(s['inverseBindMatrices'])
    for a in j.get('animations', []):
        for s in a['samplers']:
            need.update((s['input'], s['output']))

    need_bv = sorted({j['accessors'][a]['bufferView'] for a in need if 'bufferView' in j['accessors'][a]})
    new_bin = bytearray()
    remap = {}
    new_views = []
    for old in need_bv:
        bv = dict(j['bufferViews'][old])
        s = bv.get('byteOffset', 0)
        chunk = bin_[s:s + bv['byteLength']]
        new_bin += b'\0' * ((4 - len(new_bin) % 4) % 4)
        bv['byteOffset'] = len(new_bin)
        bv['buffer'] = 0
        new_bin += chunk
        remap[old] = len(new_views)
        new_views.append(bv)
    for i, a in enumerate(j['accessors']):
        if 'bufferView' in a:
            if i in need:
                a['bufferView'] = remap[a['bufferView']]
            else:
                del a['bufferView']
    j['bufferViews'] = new_views
    j['buffers'] = [{'byteLength': len(new_bin)}]

    jb = pad(json.dumps(j, separators=(',', ':')).encode(), b' ')
    bb = pad(bytes(new_bin), b'\0')
    total = 12 + 8 + len(jb) + 8 + len(bb)
    glb = b'glTF' + struct.pack('<II', 2, total)
    glb += struct.pack('<I', len(jb)) + b'JSON' + jb + struct.pack('<I', len(bb)) + b'BIN\0' + bb

    out = f'game/assets/models/{name}.ts'
    with open(out, 'w') as f:
        f.write('// Generated by tools/prepare_model.py - do not edit.\n')
        f.write('/* eslint-disable */\n')
        f.write('export default {\n  glb: "%s",\n  textures: %s,\n};\n' % (base64.b64encode(glb).decode(), json.dumps(raw)))
    print(name, 'glb', len(glb), 'textures', {k: v['w'] for k, v in raw.items()},
          'anims', [a.get('name') for a in j.get('animations', [])], '->', out)


RECOLOR = None

if __name__ == '__main__':
    src, name, size = sys.argv[1], sys.argv[2], int(sys.argv[3])
    keep = sys.argv[4] if len(sys.argv) > 4 else 'ALL'
    if len(sys.argv) > 5:
        a = sys.argv[5].split(',')
        if a[0] == 'shift':    # shift,h0,h1,degrees
            RECOLOR = ('shift', float(a[1]), float(a[2]), float(a[3]))
        elif a[0] == 'tint':   # tint,hue,satMul,satAdd,tex1/tex2/...
            RECOLOR = ('tint', float(a[1]), float(a[2]), float(a[3]), {int(t) for t in a[4].split('/')})
        else:                  # legacy: h0,h1,shift
            RECOLOR = ('shift',) + tuple(float(x) for x in a)
    prepare(src, name, size, 'ALL' if keep == 'ALL' else keep.split(','))
