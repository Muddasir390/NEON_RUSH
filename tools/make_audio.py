#!/usr/bin/env python3
"""Synthesises all game audio (pure Python, no dependencies) into game/assets/sfx/*.wav"""
import math, random, struct, wave

SR = 22050
OUT = 'game/assets/sfx/'
random.seed(7)


def save(name, samples, peak=0.9):
    m = max(1e-9, max(abs(x) for x in samples))
    g = peak / m if m > peak else 1.0
    with wave.open(OUT + name + '.wav', 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, x * g)) * 32767)) for x in samples))


def env(i, n, a=0.005, r=0.6):
    t = i / n
    return min(1, i / (SR * a)) * (1 - t) ** (r * 4)


def tone(freq, dur, shape='sine', vol=1.0, slide=0.0, a=0.004, r=0.5):
    n = int(SR * dur); out = []; ph = 0.0
    for i in range(n):
        f = freq * (1 + slide * i / n)
        ph += 2 * math.pi * f / SR
        s = math.sin(ph) if shape == 'sine' else (1 if math.sin(ph) > 0 else -1) if shape == 'square' else (2 * ((ph / (2 * math.pi)) % 1) - 1)
        out.append(s * vol * env(i, n, a, r))
    return out


def noise(dur, vol=1.0, r=0.6, lp=0.3):
    n = int(SR * dur); out = []; y = 0.0
    for i in range(n):
        y += (random.uniform(-1, 1) - y) * lp
        out.append(y * vol * env(i, n, 0.002, r))
    return out


def mix(*tracks):
    n = max(len(t) for t in tracks); out = [0.0] * n
    for t in tracks:
        for i, x in enumerate(t): out[i] += x
    return out


def seq(parts):
    out = []
    for p in parts: out += p
    return out


def delay(t, s):
    return [0.0] * int(SR * s) + t


# ---------------- effects
save('coin', mix(tone(988, 0.07, 'square', 0.5), delay(tone(1319, 0.18, 'square', 0.5), 0.07)))
save('jump', tone(260, 0.22, 'square', 0.5, slide=1.4, r=0.35))
save('roll', mix(noise(0.22, 0.7, 0.4, 0.25), tone(180, 0.2, 'sine', 0.4, slide=-0.5)))
save('lane', noise(0.09, 0.55, 0.5, 0.18))
save('near', seq([tone(600, 0.06, 'square', 0.4), tone(900, 0.06, 'square', 0.4), tone(1400, 0.12, 'square', 0.4)]))
save('crash', mix(noise(0.6, 1.0, 0.5, 0.12), tone(110, 0.5, 'saw', 0.7, slide=-0.7), tone(70, 0.6, 'sine', 0.9, slide=-0.4)))
save('power', seq([tone(f, 0.08, 'square', 0.45) for f in (523, 659, 784, 1047)] + [tone(1319, 0.25, 'square', 0.45)]))
save('shield', mix(tone(440, 0.3, 'sine', 0.6, slide=1.0), tone(880, 0.3, 'sine', 0.3, slide=0.5), noise(0.15, 0.4)))
save('click', tone(700, 0.05, 'square', 0.35, r=0.3))
save('unlock', seq([tone(f, 0.11, 'saw', 0.4) for f in (392, 494, 587, 784)] + [tone(1047, 0.35, 'saw', 0.4)]))
save('revive', seq([tone(f, 0.09, 'sine', 0.6) for f in (330, 440, 554, 659, 880)]))
save('go', mix(tone(880, 0.3, 'square', 0.4), tone(1320, 0.3, 'square', 0.25)))

# ---------------- music: 8 bars @ 124 bpm, Am - F - C - G
BPM = 124; beat = 60 / BPM; bar = beat * 4
chords = [(57, [57, 60, 64]), (53, [53, 57, 60]), (48, [48, 52, 55]), (55, [55, 59, 62])]
mf = lambda m: 440 * 2 ** ((m - 69) / 12)
total = int(SR * bar * 8)
mus = [0.0] * total


def add(buf, start, samples):
    s = int(SR * start)
    for i, x in enumerate(samples):
        if s + i < len(buf): buf[s + i] += x


for b in range(8):
    root, triad = chords[b % 4]
    t0 = b * bar
    for k in range(16):  # 16th-note bass
        add(mus, t0 + k * beat / 4, tone(mf(root - 12), beat / 4 * 0.9, 'saw', 0.32 if k % 4 else 0.42, r=0.5))
    for k in range(8):  # 8th arpeggio
        add(mus, t0 + k * beat / 2, tone(mf(triad[k % 3] + 12), beat / 2 * 0.85, 'square', 0.13, r=0.45))
    for k in range(4):  # kick + off-beat hat
        kick = tone(120, 0.18, 'sine', 0.85, slide=-0.75, r=0.3)
        add(mus, t0 + k * beat, kick)
        add(mus, t0 + k * beat + beat / 2, noise(0.05, 0.28, 0.5, 0.6))
    if b % 2 == 1:  # lead riff
        for k, n in enumerate([0, 7, 12, 7]):
            add(mus, t0 + bar / 2 + k * beat / 2, tone(mf(root + 12 + n), beat / 2 * 0.9, 'saw', 0.17, r=0.35))
save('music', mus, peak=0.8)
print('audio written')
