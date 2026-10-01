import * as THREE from 'three';

const LIT = [
  [255, 217, 138],
  [255, 217, 138],
  [127, 255, 255],
  [255, 122, 217],
  [190, 150, 255],
];

/**
 * A tile of 4 x 8 windows (4x4 texels each), some lit at random. Used as both
 * colour and emissive map so lit windows glow. Repeat is set per building size.
 */
export function makeWindowTexture(repeatX: number, repeatY: number) {
  const W = 16;
  const H = 32;
  const data = new Uint8Array(W * H * 4);
  for (let wy = 0; wy < 8; wy++) {
    for (let wx = 0; wx < 4; wx++) {
      const on = Math.random() < 0.5;
      const c = LIT[Math.floor(Math.random() * LIT.length)];
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          const i = ((wy * 4 + y) * W + wx * 4 + x) * 4;
          const window = x < 3 && y < 3;
          const [r, g, b] = window && on ? c : [12, 8, 30];
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = 255;
        }
      }
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
