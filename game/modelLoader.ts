import './polyfills';
import * as THREE from 'three';
import {
  GLTF,
  GLTFLoader,
  GLTFParser,
} from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { base64ToBytes } from './base64';
import type { CharacterDef, ModelData, Role } from './characters';

/**
 * glTF plugin: React Native can't decode embedded PNG/JPEG for three.js, so
 * base-colour textures were pre-converted to raw RGBA (tools/prepare_model.py).
 */
class RawTextures {
  name = 'RAW_TEXTURES';
  constructor(
    private parser: GLTFParser,
    private textures: ModelData['textures'],
  ) {}

  loadTexture(index: number) {
    const raw = this.textures[String(index)];
    if (!raw) return null;
    const def = this.parser.json.textures[index];
    const sampler =
      def.sampler !== undefined ? this.parser.json.samplers?.[def.sampler] : {};
    const wrap = (w?: number) =>
      w === 33071
        ? THREE.ClampToEdgeWrapping
        : w === 33648
        ? THREE.MirroredRepeatWrapping
        : THREE.RepeatWrapping;
    const tex = new THREE.DataTexture(
      base64ToBytes(raw.data),
      raw.w,
      raw.h,
      THREE.RGBAFormat,
    );
    tex.flipY = false;
    tex.wrapS = wrap(sampler?.wrapS);
    tex.wrapT = wrap(sampler?.wrapT);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return Promise.resolve(tex);
  }
}

const cache = new Map<string, Promise<GLTF>>();

/** Parses a character's model once per model file. */
export function loadModel(def: CharacterDef): Promise<GLTF> {
  let p = cache.get(def.model);
  if (!p) {
    p = new Promise<GLTF>((resolve, reject) => {
      const data = def.data();
      const loader = new GLTFLoader();
      loader.register(parser => new RawTextures(parser, data.textures));
      loader.parse(
        base64ToBytes(data.glb).buffer as ArrayBuffer,
        '',
        resolve,
        reject,
      );
    });
    cache.set(def.model, p);
  }
  return p;
}

export type Rig = {
  def: CharacterDef;
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  /** Scale that makes the model `def.height` tall, and the y offset that puts its feet on 0. */
  baseScale: number;
  foot: number;
  hasJump: boolean;
  hasDeath: boolean;
  actionFor: (role: Role) => THREE.AnimationAction | undefined;
};

const rigs = new Map<string, Rig>();

/**
 * An independent, animated copy of a loaded model. Built once per runner and
 * reused afterwards, so browsing back and forth never allocates new GPU data.
 */
export function createRig(gltf: GLTF, def: CharacterDef): Rig {
  const cached = rigs.get(def.id);
  if (cached) {
    cached.mixer.stopAllAction();
    return cached;
  }
  const root = clone(gltf.scene);
  root.traverse(o => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isMesh) return;
    m.frustumCulled = false;
    const tintOne = (mat: THREE.Material) => {
      const c = mat.clone() as THREE.MeshStandardMaterial;
      const t = def.tint?.[mat.name];
      if (t) {
        c.color = new THREE.Color(t.color);
        if (t.emissive) {
          c.emissive = new THREE.Color(t.emissive);
          c.emissiveIntensity = t.intensity ?? 0.5;
        }
      } else if (c.map) {
        // textured models (soldier, fox...) get a little self-illumination so
        // their dark parts stay readable against the night road
        c.emissive = new THREE.Color('#ffffff');
        c.emissiveMap = c.map;
        c.emissiveIntensity = 0.28;
      } else if ('roughness' in c) {
        c.emissive = c.color.clone();
        c.emissiveIntensity = 0.12;
      }
      if ('roughness' in c) c.roughness = Math.min(c.roughness ?? 0.6, 0.6);
      return c;
    };
    m.material = Array.isArray(m.material)
      ? m.material.map(tintOne)
      : tintOne(m.material);
  });

  const mixer = new THREE.AnimationMixer(root);
  const actions: Record<string, THREE.AnimationAction> = {};
  gltf.animations.forEach(clip => {
    actions[clip.name] = mixer.clipAction(clip);
  });
  const first = gltf.animations[0]
    ? actions[gltf.animations[0].name]
    : undefined;
  const byName = (n?: string) => (n ? actions[n] : undefined);
  const run = byName(def.anims.run) ?? first;
  const idle = byName(def.anims.idle) ?? run;
  const jump = byName(def.anims.jump);
  const death = byName(def.anims.death);

  // Measure the posed (skinned) model, not the bind pose.
  run?.play();
  mixer.update(0);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root, true);
  run?.stop();
  const baseScale = def.height / (box.max.y - box.min.y);
  root.scale.setScalar(baseScale);
  root.position.y = -box.min.y * baseScale;

  const rig: Rig = {
    def,
    root,
    mixer,
    baseScale,
    foot: -box.min.y * baseScale,
    hasJump: !!jump,
    hasDeath: !!death,
    actionFor: (role: Role) =>
      role === 'run'
        ? run
        : role === 'idle'
        ? idle
        : role === 'jump'
        ? jump ?? run
        : death,
  };
  rigs.set(def.id, rig);
  return rig;
}
