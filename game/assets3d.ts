import * as THREE from 'three';
import { COLORS } from './constants';
import { makeWindowTexture } from './textures';

/**
 * The "Subway Surfers" curved horizon: bend everything downward with distance
 * from the camera (in view space). Hides pop-in and gives the road depth.
 */
export const CURVE = { value: 0.0004 };
function bend<T extends THREE.Material>(m: T): T {
  m.onBeforeCompile = shader => {
    shader.uniforms.uCurve = CURVE;
    shader.vertexShader =
      'uniform float uCurve;\n' +
      shader.vertexShader.replace(
        '#include <project_vertex>',
        '#include <project_vertex>\n  mvPosition.y -= uCurve * mvPosition.z * mvPosition.z;\n  gl_Position = projectionMatrix * mvPosition;',
      );
  };
  m.customProgramCacheKey = () => 'bend';
  return m;
}

const std = (color: string, emissive = '#000000', ei = 0) =>
  new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(emissive),
    emissiveIntensity: ei,
    roughness: 0.55,
    metalness: 0.2,
  });
const basic = (color: string, extra: THREE.MeshBasicMaterialParameters = {}) =>
  new THREE.MeshBasicMaterial({ color, ...extra });

export const BUS_VARIANTS = [
  { body: '#ffb400', stripe: '#ff2d95', cap: '#ffe08a' },
  { body: '#e8363a', stripe: '#ffffff', cap: '#ff8a8d' },
  { body: '#1fb6ff', stripe: '#ffd23f', cap: '#9fe0ff' },
];

/** [depth from the road, height, frontage] of each building type. */
export const BUILDING_VARIANTS: [number, number, number][] = [
  [5, 14, 7],
  [6, 24, 8],
  [4.5, 10, 6],
  [6, 32, 8],
  [5, 18, 7],
];

export const TRIM_COLORS = [
  '#ff2d95',
  '#20e3ff',
  '#a259ff',
  '#ffd23f',
  '#39ff88',
];

export function createAssets() {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.3, 14);
  wheelGeo.rotateZ(Math.PI / 2);

  // long ground pieces need many segments along z so they can bend smoothly
  const longBox = new THREE.BoxGeometry(1, 1, 1, 1, 1, 64);

  const assets = {
    box,
    longBox,
    wheelGeo,
    coinGeo: new THREE.CylinderGeometry(0.42, 0.42, 0.12, 20),
    coinGem: new THREE.TorusGeometry(0.26, 0.05, 6, 16),
    poleGeo: new THREE.CylinderGeometry(0.07, 0.09, 5.2, 8),
    trunkGeo: new THREE.CylinderGeometry(0.1, 0.16, 1.4, 6),
    coneBig: new THREE.ConeGeometry(0.95, 1.9, 7),
    coneSmall: new THREE.ConeGeometry(0.68, 1.5, 7),
    blob: new THREE.CircleGeometry(0.6, 20),
    platGeo: new THREE.CylinderGeometry(1.0, 1.1, 0.1, 40),
    ringGeo: new THREE.TorusGeometry(1.06, 0.04, 8, 56),
    platMat: std('#150a33', '#5a2bff', 0.6),
    ring: basic('#20e3ff'),

    // road + sky
    road: std(COLORS.road),
    ground: std('#0a0518'),
    sidewalk: std('#241547'),
    stripe: basic(COLORS.neonCyan),
    edge: basic(COLORS.neonPink),
    sunMat: basic('#ff5e9c', { fog: false }),
    sunGlow: basic('#ff5e9c', {
      fog: false,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    }),
    star: new THREE.PointsMaterial({
      color: '#ffffff',
      size: 0.9,
      sizeAttenuation: true,
      fog: false,
    }),
    blobMat: basic('#000000', {
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    }),

    // vertex-coloured materials for merged props (colours are baked per vertex)
    vcLit: new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.6,
      metalness: 0.15,
    }),
    vcUnlit: new THREE.MeshBasicMaterial({ vertexColors: true }),
    // double-sided variants: ramps and the tunnel are seen from inside/both sides
    vcLitDS: new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.6,
      metalness: 0.15,
      side: THREE.DoubleSide,
    }),
    vcUnlitDS: new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
    }),
    coinMat: new THREE.MeshBasicMaterial({ vertexColors: true }),

    // accent-coloured glow ring under the runner
    auraGeo: new THREE.RingGeometry(0.55, 0.85, 32),
    auraMat: new THREE.MeshBasicMaterial({
      color: '#20e3ff',
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    }),

    // hoverboard under the runner's feet
    boardGeo: new THREE.BoxGeometry(0.75, 0.09, 1.6),
    boardMat: new THREE.MeshBasicMaterial({ color: '#20e3ff' }),

    // power-ups, shield bubble, magnet ring, speed lines
    powerGeo: new THREE.OctahedronGeometry(0.55, 0),
    powerMats: {
      magnet: new THREE.MeshBasicMaterial({ color: '#ff3b6b' }),
      shield: new THREE.MeshBasicMaterial({ color: '#3ba7ff' }),
      jet: new THREE.MeshBasicMaterial({ color: '#ffb020' }),
      sneakers: new THREE.MeshBasicMaterial({ color: '#a259ff' }),
      box: new THREE.MeshBasicMaterial({ color: '#ffe45e' }),
      x2: new THREE.MeshBasicMaterial({ color: '#7dff6a' }),
    },
    bubbleGeo: new THREE.SphereGeometry(1.25, 18, 14),
    bubbleMat: new THREE.MeshBasicMaterial({
      color: '#3ba7ff',
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    }),
    magnetMat: new THREE.MeshBasicMaterial({
      color: '#ff3b6b',
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
    lineMat: new THREE.MeshBasicMaterial({
      color: '#bff6ff',
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    }),

    // collectibles
    coin: std('#ffcc00', '#ffaa00', 0.9),
    coinRim: std('#fff2a8', '#ffdd55', 1),

    // barrier (jump)
    barrier: std('#ff7a1a', '#ff5500', 0.5),
    barrierStripe: basic('#ffffff'),
    barrierLeg: std('#2b2b4a'),
    warnLight: basic('#ff3b30'),

    // gantry (roll)
    post: std('#333355'),
    beam: std('#ff2d95', '#ff0066', 0.7),
    gantrySign: basic('#ffe45e'),

    // bus
    busBody: BUS_VARIANTS.map(v => std(v.body, v.body, 0.12)),
    busStripe: BUS_VARIANTS.map(v => std(v.stripe, v.stripe, 0.4)),
    busCap: BUS_VARIANTS.map(v => std(v.cap)),
    busSkirt: std('#1a1a2e'),
    busGlass: new THREE.MeshStandardMaterial({
      color: '#0b1226',
      emissive: new THREE.Color('#1a4a7a'),
      emissiveIntensity: 0.5,
      roughness: 0.15,
      metalness: 0.8,
    }),
    busHead: basic('#fff7b0'),
    busSign: basic('#ffa726'),
    busGrill: std('#111122'),
    busWheel: std('#0a0a12'),
    busAc: std('#8a8fa8'),

    // street furniture
    pole: std('#2a2a44'),
    lamp: basic('#ffe9a8'),
    trunk: std('#3b2a4d'),
    leafTeal: std('#1fe0a0', '#0a9a6a', 0.45),
    leafPink: std('#ff6ad5', '#c01c8c', 0.45),

    // buildings: each type has its own window texture tiled to fit its size
    buildings: BUILDING_VARIANTS.map(([bx, h, bz]) => {
      const tex = makeWindowTexture(bz / 4.8, h / 12);
      const geo = new THREE.BoxGeometry(bx, h, bz);
      geo.translate(0, h / 2, 0);
      const mat = new THREE.MeshStandardMaterial({
        color: '#ffffff',
        map: tex,
        emissive: new THREE.Color('#ffffff'),
        emissiveMap: tex,
        emissiveIntensity: 0.95,
        roughness: 0.85,
      });
      return { geo, mat, bx, h, bz };
    }),
    trims: TRIM_COLORS.map(c => basic(c)),

    // particles
    sparkGold: basic('#ffd23f'),
    sparkHot: basic('#ff7a1a'),
    sparkPink: basic('#ff2d95'),
  };

  const NO_BEND = new Set(['sunMat', 'sunGlow', 'star']);
  Object.entries(assets).forEach(([key, v]) => {
    if (NO_BEND.has(key)) return;
    const list: unknown[] = Array.isArray(v) ? v : [v];
    list.forEach(item => {
      if (item instanceof THREE.Material) bend(item);
      else if (item && typeof item === 'object') {
        Object.values(item).forEach(x => {
          if (x instanceof THREE.Material) bend(x);
        });
      }
    });
  });
  return assets;
}

export type Assets = ReturnType<typeof createAssets>;
