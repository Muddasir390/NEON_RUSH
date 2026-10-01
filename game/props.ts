import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  BUS_HALF_LENGTH,
  RAMP_LENGTH,
  TRAIN_LENGTH,
  TRAIN_TOP,
  TUNNEL_LENGTH,
} from './constants';
import {
  Assets,
  BUILDING_VARIANTS,
  BUS_VARIANTS,
  TRIM_COLORS,
} from './assets3d';

/**
 * Geometry builders. Every prop is baked into as few meshes as possible
 * (colours live in vertex colours) because each extra draw call costs real
 * JavaScript time in expo-gl.
 */
type V3 = [number, number, number];
const v = (a: V3) => new THREE.Vector3(...a);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)];

function paint(g: THREE.BufferGeometry, color: string) {
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

function place(
  g: THREE.BufferGeometry,
  pos: V3,
  rot: V3 = [0, 0, 0],
  scale: V3 = [1, 1, 1],
) {
  g.applyMatrix4(
    new THREE.Matrix4().compose(
      v(pos),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
      v(scale),
    ),
  );
  return g;
}

export const box = (pos: V3, size: V3, color: string, rot: V3 = [0, 0, 0]) =>
  paint(place(new THREE.BoxGeometry(1, 1, 1), pos, rot, size), color);

const cyl = (
  pos: V3,
  rt: number,
  rb: number,
  h: number,
  seg: number,
  color: string,
  rot: V3 = [0, 0, 0],
) => paint(place(new THREE.CylinderGeometry(rt, rb, h, seg), pos, rot), color);

const cone = (pos: V3, r: number, h: number, seg: number, color: string) =>
  paint(place(new THREE.ConeGeometry(r, h, seg), pos), color);

const merge = (list: THREE.BufferGeometry[]) => mergeGeometries(list, false);

function mesh(geo: THREE.BufferGeometry | null, mat: THREE.Material) {
  const m = new THREE.Mesh(geo ?? undefined, mat);
  m.frustumCulled = false;
  return m;
}

// ---------------------------------------------------------------- obstacles

function barrier(A: Assets) {
  const lit = merge([
    box([-0.85, 0.2, 0], [0.14, 0.4, 0.45], '#2b2b4a'),
    box([0.85, 0.2, 0], [0.14, 0.4, 0.45], '#2b2b4a'),
    box([0, 0.62, 0], [2.0, 0.5, 0.16], '#ff7a1a'),
    ...[-0.7, 0, 0.7].map(x =>
      box([x, 0.62, 0.09], [0.2, 0.55, 0.02], '#ffffff', [0, 0, 0.6]),
    ),
  ]);
  const unlit = merge([
    box([-0.85, 0.93, 0], [0.16, 0.12, 0.16], '#ff3b30'),
    box([0.85, 0.93, 0], [0.16, 0.12, 0.16], '#ff3b30'),
  ]);
  const g = new THREE.Group();
  g.add(mesh(lit, A.vcLit), mesh(unlit, A.vcUnlit));
  return g;
}

function gantry(A: Assets) {
  const lit = merge([
    box([-1.05, 0.8, 0], [0.18, 1.6, 0.3], '#333355'),
    box([1.05, 0.8, 0], [0.18, 1.6, 0.3], '#333355'),
    box([0, 1.2, 0], [2.2, 0.5, 0.3], '#ff2d95'),
  ]);
  const unlit = merge([box([0, 1.2, 0.16], [1.9, 0.3, 0.02], '#ffe45e')]);
  const g = new THREE.Group();
  g.add(mesh(lit, A.vcLit), mesh(unlit, A.vcUnlit));
  return g;
}

function bus(A: Assets, variant: number) {
  const c = BUS_VARIANTS[variant];
  const L = BUS_HALF_LENGTH * 2;
  const front = BUS_HALF_LENGTH + 0.02;
  const wheels: THREE.BufferGeometry[] = [];
  [-1, 1].forEach(sx =>
    [2.3, -2.3].forEach(z =>
      wheels.push(
        cyl([sx * 1.02, 0.45, z], 0.45, 0.45, 0.3, 14, '#0a0a12', [
          0,
          0,
          Math.PI / 2,
        ]),
      ),
    ),
  );
  const lit = merge([
    box([0, 0.6, 0], [2.14, 0.5, L - 0.1], '#1a1a2e'),
    box([0, 1.93, 0], [2.1, 2.15, L], c.body),
    box([0, 1.25, 0], [2.13, 0.26, L + 0.02], c.stripe),
    box([0, 3.03, 0], [2.0, 0.08, L - 0.2], c.cap),
    box([0, 1.05, front], [0.75, 0.32, 0.04], '#111122'),
    box([0, 0.72, front - 0.02], [2.16, 0.22, 0.14], '#1a1a2e'),
    box([0, 3.2, -0.6], [1.2, 0.3, 2.2], '#8a8fa8'),
    ...wheels,
  ]);
  const unlit = merge([
    box([0, 2.35, 0], [2.13, 0.8, L - 1.2], '#173a6b'),
    box([0, 2.3, front], [1.85, 1.05, 0.04], '#0f2a55'),
    box([0, 2.93, front], [1.2, 0.2, 0.04], '#ffa726'),
    box([-0.7, 1.05, front], [0.32, 0.2, 0.05], '#fff7b0'),
    box([0.7, 1.05, front], [0.32, 0.2, 0.05], '#fff7b0'),
  ]);
  const g = new THREE.Group();
  g.add(mesh(lit, A.vcLit), mesh(unlit, A.vcUnlit));
  return g;
}

/** Right-angled wedge (a ramp): high edge at z=0, low edge at z=len. */
function wedge(width: number, len: number, height: number, color: string) {
  const h = width / 2;
  const v = [
    -h,
    0,
    0,
    h,
    0,
    0,
    -h,
    height,
    0,
    h,
    height,
    0,
    -h,
    0,
    len,
    h,
    0,
    len,
  ];
  const idx = [2, 3, 5, 2, 5, 4, 2, 0, 4, 3, 1, 5, 0, 1, 3, 0, 3, 2];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  g.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute(new Float32Array((v.length / 3) * 2), 2),
  );
  g.computeVertexNormals();
  return paint(g, color);
}

/** Subway train you can climb onto: long body, roof plate and a ramp in front. */
function train(A: Assets, variant: number) {
  const c = BUS_VARIANTS[variant];
  const L = TRAIN_LENGTH;
  const front = L / 2 + 0.02;
  const H = TRAIN_TOP - 0.5;
  const lit = merge([
    box([0, 0.5 + H / 2, 0], [2.1, H, L], '#9aa3c7'),
    box([0, 0.62, 0], [2.14, 0.3, L], '#1a1a2e'),
    box([0, 1.5, 0], [2.14, 0.3, L + 0.02], c.body),
    box([0, TRAIN_TOP + 0.03, 0], [2.0, 0.08, L - 0.2], c.cap),
    ...[-1, 1].map(sx =>
      box([sx * 0.9, TRAIN_TOP + 0.2, 0], [0.08, 0.3, L - 0.2], c.stripe),
    ),
  ]);
  const winZ: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const z = -L / 2 + 1.4 + i * 2.2;
    winZ.push(box([0, 2.5, z], [2.13, 0.8, 1.5], '#173a6b'));
  }
  const unlit = merge([
    ...winZ,
    box([0, 2.4, front], [1.7, 0.9, 0.04], '#0f2a55'),
    box([-0.7, 1.0, front], [0.3, 0.2, 0.05], '#fff7b0'),
    box([0.7, 1.0, front], [0.3, 0.2, 0.05], '#fff7b0'),
    box([0, TRAIN_TOP + 0.02, 0], [0.9, 0.05, L - 0.6], '#ffe45e'),
  ]);
  const ramp = merge([
    place(wedge(2.0, RAMP_LENGTH, TRAIN_TOP, '#6b6f8f'), [0, 0, front]),
    ...[0.2, 0.4, 0.6, 0.8].map(t =>
      box(
        [0, TRAIN_TOP * (1 - t) + 0.02, front + RAMP_LENGTH * t],
        [1.6, 0.05, 0.25],
        '#ffe45e',
        [0.4, 0, 0],
      ),
    ),
  ]);
  const g = new THREE.Group();
  g.add(mesh(lit, A.vcLit), mesh(unlit, A.vcUnlit), mesh(ramp, A.vcLitDS));
  return g;
}

/** A long covered stretch of road: walls, roof and glowing ribs. */
export function buildTunnel(A: Assets): THREE.Group {
  const L = TUNNEL_LENGTH;
  const shell = merge([
    box([-4.9, 3.6, 0], [0.7, 7.2, L], '#241547'),
    box([4.9, 3.6, 0], [0.7, 7.2, L], '#241547'),
    box([0, 7.3, 0], [10.5, 0.7, L], '#1b1040'),
  ]);
  const glow: THREE.BufferGeometry[] = [];
  for (let z = -L / 2 + 3; z < L / 2; z += 6) {
    const col = Math.round((z + L / 2) / 6) % 2 ? '#20e3ff' : '#ff2d95';
    glow.push(box([-4.5, 3.6, z], [0.12, 6.4, 0.25], col));
    glow.push(box([4.5, 3.6, z], [0.12, 6.4, 0.25], col));
    glow.push(box([0, 6.9, z], [9.0, 0.12, 0.25], col));
  }
  glow.push(box([-4.5, 1.2, 0], [0.1, 0.12, L], '#ffe45e'));
  glow.push(box([4.5, 1.2, 0], [0.1, 0.12, L], '#ffe45e'));
  glow.push(box([-2.8, 6.85, 0], [0.12, 0.08, L], '#ffffff'));
  glow.push(box([2.8, 6.85, 0], [0.12, 0.08, L], '#ffffff'));
  const g = new THREE.Group();
  g.add(mesh(shell, A.vcLitDS), mesh(merge(glow), A.vcUnlitDS));
  g.visible = false;
  return g;
}

export type Props3D = {
  /** One slot: [barrier, gantry, bus variant 0..n] - show exactly one child. */
  makeSlot: () => THREE.Group;
  coinGeo: THREE.BufferGeometry;
};

export function buildProps(A: Assets): Props3D {
  const kinds = [
    barrier(A),
    gantry(A),
    ...BUS_VARIANTS.map((_, i) => bus(A, i)),
    ...BUS_VARIANTS.map((_, i) => train(A, i)),
  ];
  const coinGeo = merge([
    paint(
      place(
        new THREE.CylinderGeometry(0.42, 0.42, 0.12, 20),
        [0, 0, 0],
        [Math.PI / 2, 0, 0],
      ),
      '#ffc21a',
    ),
    paint(
      place(new THREE.TorusGeometry(0.26, 0.05, 6, 16), [0, 0, 0.07]),
      '#fff2a8',
    ),
  ]);
  return {
    coinGeo,
    makeSlot: () => {
      const slot = new THREE.Group();
      kinds.forEach(k => slot.add(k.clone()));
      slot.visible = false;
      return slot;
    },
  };
}

// ---------------------------------------------------------------- scenery

/** Length of one scrolling strip of city. Two strips leapfrog for an endless street. */
export const STRIP_LENGTH = 140;

/**
 * One static strip of buildings, signs, street lamps, trees and lane dashes,
 * merged into ~10 meshes. The game just scrolls two of them.
 */
export function buildStrip(A: Assets): THREE.Group {
  const strip = new THREE.Group();

  // buildings (merged per type so each keeps its own window texture)
  const perType: THREE.BufferGeometry[][] = BUILDING_VARIANTS.map(() => []);
  const signs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 14; i++) {
    [-1, 1].forEach(sd => {
      const t = Math.floor(Math.random() * BUILDING_VARIANTS.length);
      const b = A.buildings[t];
      const z = -i * 10 - 5;
      perType[t].push(b.geo.clone().translate(sd * (8.6 + b.bx / 2), 0, z));
      signs.push(
        box(
          [sd * 8.52, rand(3, b.h - 2), z + rand(-b.bz / 3, b.bz / 3)],
          [0.14, rand(1.5, 5), rand(0.25, 0.5)],
          pick(TRIM_COLORS),
        ),
      );
    });
  }
  perType.forEach((list, t) => {
    if (list.length) strip.add(mesh(merge(list), A.buildings[t].mat));
  });
  strip.add(mesh(merge(signs), A.vcUnlit));

  // street lamps
  const lampLit: THREE.BufferGeometry[] = [];
  const lampGlow: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    [-1, 1].forEach(sd => {
      const z = -i * 20 - 8;
      lampLit.push(cyl([sd * 4.9, 2.6, z], 0.07, 0.09, 5.2, 8, '#2a2a44'));
      lampLit.push(
        box([sd * 4.9 - sd * 0.55, 5.15, z], [1.1, 0.08, 0.08], '#2a2a44'),
      );
      lampGlow.push(
        box([sd * 4.9 - sd * 1.05, 5.08, z], [0.55, 0.1, 0.32], '#ffe9a8'),
      );
    });
  }
  strip.add(mesh(merge(lampLit), A.vcLit), mesh(merge(lampGlow), A.vcUnlit));

  // trees
  const trees: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 10; i++) {
    [-1, 1].forEach((sd, k) => {
      const z = -i * 14 - 3;
      const leaf = (i + k) % 2 ? '#2fe0a8' : '#ff70dc';
      trees.push(cyl([sd * 6.9, 0.7, z], 0.1, 0.16, 1.4, 6, '#3b2a4d'));
      trees.push(cone([sd * 6.9, 2.2, z], 0.95, 1.9, 7, leaf));
      trees.push(cone([sd * 6.9, 3.4, z], 0.68, 1.5, 7, leaf));
    });
  }
  strip.add(mesh(merge(trees), A.vcLit));

  // lane dashes (plain geometry, shares the zone-tinted stripe material)
  const dashes: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 20; i++) {
    [-1.2, 1.2].forEach(x => {
      dashes.push(
        place(
          new THREE.BoxGeometry(1, 1, 1),
          [x, 0.02, -i * 7 - 3.5],
          [0, 0, 0],
          [0.1, 0.03, 3],
        ),
      );
    });
  }
  strip.add(mesh(merge(dashes), A.stripe));

  return strip;
}
