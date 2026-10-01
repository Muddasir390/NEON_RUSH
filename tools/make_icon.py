#!/usr/bin/env python3
"""Draws the Neon Rush app icon and writes every Android + iOS size."""
import math
from PIL import Image, ImageDraw, ImageFilter

S = 2048  # supersampled canvas


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def make():
    img = Image.new('RGB', (S, S))
    px = img.load()
    top, bot = (26, 5, 51), (92, 18, 110)
    for y in range(S):
        c = lerp(top, bot, (y / S) ** 1.2)
        for x in range(S):
            px[x, y] = c
    d = ImageDraw.Draw(img, 'RGBA')

    # sun with stripes
    cx, cy, r = S // 2, int(S * 0.44), int(S * 0.30)
    sun = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sun)
    for i in range(r):
        t = i / r
        col = lerp((255, 214, 90), (255, 45, 149), t)
        sd.ellipse([cx - r + i, cy - r + i // 1, cx + r - i, cy + r - i], fill=None)
    grad = Image.new('RGB', (S, S))
    gp = grad.load()
    for y in range(cy - r, cy + r):
        col = lerp((255, 214, 90), (255, 45, 149), (y - (cy - r)) / (2 * r))
        for x in range(S):
            gp[x, y] = col
    mask = Image.new('L', (S, S), 0)
    md = ImageDraw.Draw(mask)
    md.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    for k in range(6):  # scan-line cut-outs on the lower half
        y0 = cy + int(r * (0.05 + k * 0.16))
        md.rectangle([0, y0, S, y0 + int(r * (0.02 + k * 0.012))], fill=0)
    glow = mask.filter(ImageFilter.GaussianBlur(70))
    img.paste((255, 60, 160), mask=glow.point(lambda v: int(v * 0.55)))
    img.paste(grad, mask=mask)
    d = ImageDraw.Draw(img, 'RGBA')

    # road in perspective
    hor = int(S * 0.60)
    road = [(S * 0.47, hor), (S * 0.53, hor), (S * 1.05, S), (-S * 0.05, S)]
    d.polygon(road, fill=(10, 4, 26, 255))
    d.line([(S * 0.47, hor), (-S * 0.05, S)], fill=(255, 45, 149, 255), width=26)
    d.line([(S * 0.53, hor), (S * 1.05, S)], fill=(255, 45, 149, 255), width=26)
    for f in (0.36, 0.5, 0.64):  # lane dashes converge on the horizon
        for k in range(5):
            t0, t1 = 0.12 + k * 0.18, 0.12 + k * 0.18 + 0.09
            def pt(t):
                xb = S * (f - 0.5) * 2.2 + S * 0.5
                return (S * 0.5 + (xb - S * 0.5) * t, hor + (S - hor) * t)
            a, b = pt(t0), pt(t1)
            d.line([a, b], fill=(32, 227, 255, 255), width=int(8 + 30 * t0))
    # horizon glow
    glowl = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(glowl).rectangle([0, hor - 12, S, hor + 12], fill=(255, 45, 149, 200))
    img.paste(glowl.filter(ImageFilter.GaussianBlur(24)), mask=glowl.filter(ImageFilter.GaussianBlur(24)))

    # runner silhouette on the road
    d = ImageDraw.Draw(img, 'RGBA')
    px_, base = S * 0.5, S * 0.93
    col = (32, 227, 255, 255)
    head = (px_ + 20, base - 560)
    d.ellipse([head[0] - 62, head[1] - 62, head[0] + 62, head[1] + 62], fill=col)
    w = 46
    d.line([(px_, base - 490), (px_ - 10, base - 290)], fill=col, width=96)           # torso
    d.line([(px_ - 10, base - 290), (px_ - 130, base - 130), (px_ - 150, base)], fill=col, width=w + 10, joint='curve')  # back leg
    d.line([(px_ - 10, base - 290), (px_ + 120, base - 190), (px_ + 110, base - 60)], fill=col, width=w + 10, joint='curve')  # front leg
    d.line([(px_ + 10, base - 450), (px_ + 150, base - 360), (px_ + 190, base - 440)], fill=col, width=w, joint='curve')  # arm
    d.line([(px_ - 10, base - 450), (px_ - 150, base - 380), (px_ - 200, base - 300)], fill=col, width=w, joint='curve')  # arm
    return img


def rounded(img, size, radius_frac):
    im = img.resize((size, size), Image.LANCZOS).convert('RGBA')
    m = Image.new('L', (size * 4, size * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size * 4 - 1, size * 4 - 1], radius=int(size * 4 * radius_frac), fill=255)
    im.putalpha(m.resize((size, size), Image.LANCZOS))
    return im


def circle(img, size):
    im = img.resize((size, size), Image.LANCZOS).convert('RGBA')
    m = Image.new('L', (size * 4, size * 4), 0)
    ImageDraw.Draw(m).ellipse([0, 0, size * 4 - 1, size * 4 - 1], fill=255)
    im.putalpha(m.resize((size, size), Image.LANCZOS))
    return im


base = make()
sizes = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
for k, px in sizes.items():
    d = f'android/app/src/main/res/mipmap-{k}'
    rounded(base, px, 0.18).save(f'{d}/ic_launcher.png')
    circle(base, px).save(f'{d}/ic_launcher_round.png')

ios = 'ios/MyGame/Images.xcassets/AppIcon.appiconset'
ios_sizes = {
    'icon-40.png': 40, 'icon-58.png': 58, 'icon-60.png': 60, 'icon-80.png': 80,
    'icon-87.png': 87, 'icon-120.png': 120, 'icon-180.png': 180, 'icon-1024.png': 1024,
}
for name, px in ios_sizes.items():
    base.resize((px, px), Image.LANCZOS).convert('RGB').save(f'{ios}/{name}')  # iOS rounds it itself
pass
print('icons written')
