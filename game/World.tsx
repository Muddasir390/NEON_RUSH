import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import {
  Action,
  BUS_HALF_LENGTH,
  COIN_POOL,
  DESPAWN_Z,
  GRAVITY,
  JUMP_VELOCITY,
  LANES,
  MAX_SPEED,
  OBSTACLE_POOL,
  ObstacleKind,
  PARTICLE_POOL,
  PLAYER_HEIGHT,
  PLAYER_ROLL_HEIGHT,
  ROLL_TIME,
  SPAWN_Z,
  START_SPEED,
  RAMP_LENGTH,
  TRAIN_LENGTH,
  TRAIN_TOP,
  TUNNEL_LENGTH,
} from './constants';
import { Assets, BUS_VARIANTS, createAssets } from './assets3d';
import { STRIP_LENGTH, buildProps, buildStrip, buildTunnel } from './props';
import { Rig, createRig, loadModel } from './modelLoader';
import { CharacterDef, Role } from './characters';
import { ZONES, ZONE_COLORS, ZONE_LENGTH } from './palettes';
import { buzz, duckMusic, sfx } from './audio';

export type PowerFx = {
  hover: number;
  sneakers: number;
  magnet: number;
  shield: number;
  jet: number;
  x2: number;
};
export type Stats = {
  score: number;
  coins: number;
  /** Remaining fraction (0..1) of each active power-up. */
  fx?: PowerFx;
  combo?: number;
  comboFill?: number;
  distance?: number;
};
export type EventKind = 'coin' | 'jump' | 'near' | 'power';
export type Quality = 'auto' | 'low' | 'high';
export type Upgrades = { duration: number; magnet: number; coinvalue: number };

type PowerKind = 'magnet' | 'shield' | 'jet' | 'x2' | 'sneakers' | 'box';
const POWER_KINDS: PowerKind[] = [
  'magnet',
  'shield',
  'jet',
  'x2',
  'sneakers',
  'box',
];
const POWER_POOL = 4;
const SPEED_LINES = 14;
const BASE_TIME = { magnet: 8, jet: 5, x2: 10, sneakers: 12 };

type Props = {
  playing: boolean;
  runId: number;
  character: CharacterDef;
  onRigReady: (id: string) => void;
  inputRef: React.MutableRefObject<((a: Action) => void) | null>;
  onStats: (s: Stats) => void;
  onGameOver: (s: Stats) => void;
  onZone: (name: string) => void;
  paused: boolean;
  upgrades: Upgrades;
  headStart: boolean;
  hoverboard: boolean;
  reviveId: number;
  onEvent: (kind: EventKind) => void;
  onPopup: (text: string) => void;
  /** GPU couldn't keep up ('down') or has lots of headroom ('up'). */
  onPerf: (dir: 'down' | 'up') => void;
};

type Obstacle = {
  active: boolean;
  kind: ObstacleKind;
  lane: number;
  z: number;
  variant: number;
  extra: number;
  minD: number;
  near: boolean;
};
type Coin = {
  active: boolean;
  lane: number;
  x: number;
  y: number;
  z: number;
};
type PowerItem = { active: boolean; kind: PowerKind; lane: number; z: number };
type Particle = {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
};

/** Fractions of the screen resolution the 3D scene can render at (adaptive). */
const RENDER_SCALES = [0.55, 0.7, 0.85, 1];
const MENU_CAM = {
  pos: new THREE.Vector3(0, 1.7, 6.9),
  look: new THREE.Vector3(0, 0.15, 0),
};
const RUN_CAM = {
  pos: new THREE.Vector3(0, 4.8, 8.4),
  look: new THREE.Vector3(0, 1.3, -9),
};
const INTRO_TIME = 0.95;
const LAUNCH_TIME = 1.5;
const tmpPos = new THREE.Vector3();
const tmpLook = new THREE.Vector3();
const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const smooth = (x: number) => x * x * (3 - 2 * x);
const tmpColor = new THREE.Color();

function Scene({
  playing,
  runId,
  character,
  onRigReady,
  inputRef,
  onStats,
  onGameOver,
  onZone,
  paused,
  upgrades,
  headStart,
  hoverboard,
  reviveId,
  onEvent,
  onPopup,
  onPerf,
}: Props) {
  const { camera, scene, gl } = useThree();
  const A: Assets = useMemo(() => createAssets(), []);
  const [rig, setRig] = useState<Rig | null>(null);
  const obstacleRefs = useRef<THREE.Group[]>([]);
  const coinRefs = useRef<THREE.Mesh[]>([]);
  const powerRefs = useRef<THREE.Mesh[]>([]);
  const lineRefs = useRef<THREE.Mesh[]>([]);
  const bubble = useRef<THREE.Mesh>(null!);
  const board = useRef<THREE.Mesh>(null!);
  const aura = useRef<THREE.Mesh>(null!);
  const rimLight = useRef<THREE.DirectionalLight>(null!);
  const magnetRing = useRef<THREE.Mesh>(null!);

  // merged scenery strips + pooled props (few draw calls; see props.ts)
  const world = useMemo(() => {
    const props = buildProps(A);
    const strips = [buildStrip(A), buildStrip(A)];
    strips[0].position.z = 15;
    strips[1].position.z = 15 - STRIP_LENGTH;
    const slots = Array.from({ length: OBSTACLE_POOL }, () => props.makeSlot());
    const coins = Array.from({ length: COIN_POOL }, () => {
      const m = new THREE.Mesh(props.coinGeo, A.coinMat);
      m.visible = false;
      m.frustumCulled = false;
      return m;
    });
    const powers = Array.from({ length: POWER_POOL }, () => {
      const m = new THREE.Mesh(A.powerGeo, A.powerMats.magnet);
      m.visible = false;
      m.frustumCulled = false;
      return m;
    });
    const lines = Array.from({ length: SPEED_LINES }, () => {
      const m = new THREE.Mesh(A.box, A.lineMat);
      m.scale.set(0.05, 0.05, 7);
      m.visible = false;
      m.frustumCulled = false;
      return m;
    });
    const tunnel = buildTunnel(A);
    return { strips, slots, coins, powers, lines, tunnel };
  }, [A]);
  obstacleRefs.current = world.slots;
  coinRefs.current = world.coins;
  powerRefs.current = world.powers;
  lineRefs.current = world.lines;
  const perks = character.perks;
  const prevPlaying = useRef(false);

  // ---- mutable game state (never triggers React renders)
  const g = useRef({
    lane: 1,
    x: 0,
    y: 0,
    vy: 0,
    roll: 0,
    speed: playing ? START_SPEED : 3,
    distance: 0,
    coins: 0,
    alive: true,
    spawnDist: 0,
    statsTimer: 0,
    time: 0,
    deadTime: 0,
    shake: 0,
    action: null as THREE.AnimationAction | null,
    role: '' as Role | '',
    pop: 0,
    center: 0.95,
    zone: -1,
    airborne: false,
    camT: 0,
    scoreAcc: 0,
    magnetT: 0,
    jetT: 0,
    sneakT: 0,
    hover: false,
    grounded: true,
    tunnelOn: false,
    tunnelZ: 0,
    tunnelIn: 380,
    ground: 0,
    x2T: 0,
    shield: false,
    invuln: 0,
    combo: 0,
    comboT: 0,
    rows: 0,
    jumps: 0,
    camX: 0,
    launch: 0,
    spin: 0,
    jumpBuf: 0,
    perkFps: 0,
    perkN: 0,
    perkUp: 0,
    perkCool: 3,
    obstacles: Array.from({ length: OBSTACLE_POOL }, () => ({
      active: false,
      kind: 'low',
      lane: 0,
      z: 0,
      variant: 0,
      extra: 0,
      minD: 99,
      near: false,
    })) as Obstacle[],
    powerList: Array.from({ length: POWER_POOL }, () => ({
      active: false,
      kind: 'magnet',
      lane: 0,
      z: 0,
    })) as PowerItem[],
    coinList: Array.from({ length: COIN_POOL }, () => ({
      active: false,
      lane: 0,
      x: 0,
      y: 1.15,
      z: 0,
    })) as Coin[],
    particles: Array.from({ length: PARTICLE_POOL }, () => ({
      active: false,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
    })) as Particle[],
  });

  // ---- scene object refs
  const rigRef = useRef<Rig | null>(null);
  const inner = useRef<THREE.Group>(null!);
  const platform = useRef<THREE.Group>(null!);
  const player = useRef<THREE.Group>(null!);
  const flip = useRef<THREE.Group>(null!);
  const blob = useRef<THREE.Mesh>(null!);
  const particleRefs = useRef<THREE.Mesh[]>([]);
  const sun = useRef<THREE.Group>(null!);
  const ambient = useRef<THREE.AmbientLight>(null!);

  const stars = useMemo(() => {
    const n = 220;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = rand(0.15, 1.2);
      const r = 165;
      pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
      pos[i * 3 + 1] = Math.sin(e) * r * 0.55 + 10;
      pos[i * 3 + 2] = -Math.abs(Math.sin(a) * Math.cos(e) * r) - 20;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return geo;
  }, []);

  // ---- load the chosen character (parsing is heavy, so let the UI paint first)
  useEffect(() => {
    let cancelled = false;
    setRig(null);
    rigRef.current = null;
    const timer = setTimeout(() => {
      loadModel(character)
        .then(gltf => {
          if (cancelled) return;
          const r = createRig(gltf, character);
          rigRef.current = r;
          setRig(r);
          onRigReady(character.id);
        })
        .catch(e => console.warn('character load failed', character.id, e));
    }, 60);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character]);

  const play = (role: Role, once = false) => {
    const r = rigRef.current;
    const s = g.current;
    if (!r) return;
    s.role = role;
    const next = r.actionFor(role);
    if (!next || s.action === next) return;
    next.reset();
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = once;
    next.paused = false;
    next.fadeIn(0.15).play();
    if (s.action) s.action.fadeOut(0.15);
    s.action = next;
  };

  // ---- (re)start: reset all game state in place so the canvas never remounts
  useEffect(() => {
    const st = g.current;
    st.lane = 1;
    st.x = 0;
    st.y = 0;
    st.vy = 0;
    st.roll = 0;
    st.speed = playing ? 0 : 3;
    st.distance = 0;
    st.coins = 0;
    st.alive = true;
    st.spawnDist = 0;
    st.statsTimer = 0;
    st.deadTime = 0;
    st.shake = 0;
    st.zone = -1;
    st.airborne = false;
    st.obstacles.forEach(o => {
      o.active = false;
    });
    st.coinList.forEach(c => {
      c.active = false;
    });
    st.particles.forEach(pt => {
      pt.active = false;
    });
    scene.background = new THREE.Color(ZONE_COLORS[0].sky);
    scene.fog = new THREE.Fog(ZONE_COLORS[0].fog.getHex(), 35, 100);
    (camera as THREE.PerspectiveCamera).fov = 62;
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    // menu -> run plays a camera sweep; a restart after a crash cuts straight in
    st.camT = playing && prevPlaying.current ? 1 : 0;
    st.launch = 0;
    st.jumpBuf = 0;
    st.scoreAcc = 0;
    st.magnetT = 0;
    st.jetT = 0;
    st.sneakT = 0;
    st.hover = false;
    st.grounded = true;
    st.tunnelOn = false;
    st.tunnelIn = 320 + Math.random() * 200;
    st.x2T = 0;
    st.shield = false;
    st.invuln = 0;
    st.combo = 0;
    st.comboT = 0;
    st.rows = 0;
    st.jumps = 0;
    st.powerList.forEach(pw => {
      pw.active = false;
    });
    if (playing) {
      const fx = character.startFx;
      const dm = 1 + 0.2 * upgrades.duration;
      if (fx?.shield) st.shield = true;
      if (fx?.magnet) st.magnetT = fx.magnet * dm;
      if (fx?.sneakers) st.sneakT = fx.sneakers * dm;
      if (fx?.x2) st.x2T = fx.x2 * dm;
      if (fx?.jet) {
        st.jetT = fx.jet;
        st.invuln = 1.4;
      }
      if (hoverboard) st.hover = true;
      if (headStart) {
        st.jetT = 4.5; // head start: begin the run flying
        st.invuln = 1.6;
        showHead.current = true;
      }
    }
    st.camX = 0;
    st.perkFps = 0;
    st.perkN = 0;
    st.perkUp = 0;
    st.perkCool = 3;
    prevPlaying.current = playing;
    const pose = st.camT >= 1 ? RUN_CAM : MENU_CAM;
    camera.position.copy(pose.pos);
    camera.lookAt(pose.look);
    st.action = null;
    st.role = '';
    st.pop = 0;
    if (rig) {
      st.center = rig.def.height * 0.5;
      rig.mixer.stopAllAction();
      play(playing && st.camT >= 1 ? 'run' : 'idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rig, playing, runId, scene, camera]);

  useEffect(() => {
    A.ring.color.set(character.accent);
    A.auraMat.color.set(character.accent);
    rimLight.current?.color.set(character.accent);
  }, [A, character]);

  // ---- revive: get back up, clear the road ahead, brief invulnerability
  const showHead = useRef(false);
  const lastRevive = useRef(reviveId);
  useEffect(() => {
    if (reviveId === lastRevive.current) return;
    lastRevive.current = reviveId;
    const st = g.current;
    st.alive = true;
    st.deadTime = 0;
    st.invuln = 2.6;
    st.launch = 0.3;
    st.jetT = 0;
    st.y = 0;
    st.vy = 0;
    st.roll = 0;
    st.combo = 0;
    st.obstacles.forEach(o => {
      if (o.z > -45) o.active = false;
    });
    st.action = null;
    st.role = '';
    if (rigRef.current) {
      rigRef.current.mixer.stopAllAction();
      play('run');
    }
    sfx('revive');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviveId]);

  // ---- input
  useEffect(() => {
    inputRef.current = (a: Action) => {
      const s = g.current;
      if (!s.alive || !playing) return;
      if (a === 'left' || a === 'right') {
        const next = Math.max(0, Math.min(2, s.lane + (a === 'left' ? -1 : 1)));
        if (next !== s.lane) {
          s.lane = next;
          sfx('lane');
          buzz('light');
        }
      }
      if (a === 'jump') {
        if (s.grounded) {
          s.vy = JUMP_VELOCITY * perks.jump * (s.sneakT > 0 ? 1.4 : 1);
          s.roll = 0;
          s.jumps += 1;
          onEvent('jump');
          sfx('jump');
        } else {
          s.jumpBuf = 0.2; // remembered until we land
        }
      }
      if (a === 'roll') {
        s.roll = ROLL_TIME;
        sfx('roll');
        if (!s.grounded) s.vy = -18; // slam down
      }
    };
    return () => {
      inputRef.current = null;
    };
  }, [inputRef, playing, perks.jump, onEvent]);

  /** The runner hit something. Returns true if a shield / hoverboard saved them. */
  const crash = (o: Obstacle, grp: THREE.Group) => {
    const s = g.current;
    if (s.hover || s.shield) {
      const board = s.hover;
      if (board) s.hover = false;
      else s.shield = false;
      s.invuln = 1.2;
      o.active = false;
      grp.visible = false;
      s.shake = 0.3;
      burst('pink', s.x, 1.2, 0, 14, 4);
      sfx('shield');
      buzz('heavy');
      onPopup(board ? 'HOVERBOARD SAVED YOU!' : 'SHIELD BROKEN');
      return true;
    }
    s.alive = false;
    s.deadTime = 0;
    s.shake = 0.5;
    burst('hot', s.x, 1, 0, 16, 5);
    burst('pink', s.x, 1, 0, 10, 4);
    sfx('crash');
    buzz('heavy');
    duckMusic(true);
    onGameOver({
      score: Math.floor(s.scoreAcc * perks.score),
      coins: s.coins,
      distance: s.distance,
    });
    return false;
  };

  const burst = (
    mat: 'gold' | 'hot' | 'pink',
    x: number,
    y: number,
    z: number,
    n: number,
    power: number,
  ) => {
    const list = g.current.particles;
    let made = 0;
    for (let i = 0; i < list.length && made < n; i++) {
      const p = list[i];
      if (p.active) continue;
      p.active = true;
      p.x = x;
      p.y = y;
      p.z = z;
      p.vx = rand(-1, 1) * power;
      p.vy = rand(0.3, 1.4) * power;
      p.vz = rand(-1, 1) * power;
      p.life = rand(0.35, 0.8);
      const m = particleRefs.current[i];
      m.material =
        mat === 'gold' ? A.sparkGold : mat === 'hot' ? A.sparkHot : A.sparkPink;
      made++;
    }
  };

  // ---- compile every shader up front (pooled objects are hidden until used)
  useEffect(() => {
    const t = setTimeout(() => {
      const objs = [
        ...obstacleRefs.current,
        ...coinRefs.current,
        ...particleRefs.current,
      ].filter(Boolean);
      const was = objs.map(o => o.visible);
      objs.forEach(o => {
        o.visible = true;
      });
      try {
        gl.compile(scene, camera);
      } catch (e) {
        console.warn('shader warm-up failed', e);
      }
      objs.forEach((o, i) => {
        o.visible = was[i];
      });
    }, 500);
    return () => clearTimeout(t);
  }, [gl, scene, camera]);

  const spawnRow = () => {
    const s = g.current;
    const safe = Math.floor(Math.random() * 3);
    const free = (list: { active: boolean }[]) => list.find(o => !o.active);
    for (let lane = 0; lane < 3; lane++) {
      if (lane === safe) continue;
      if (Math.random() < 0.6) {
        const o = free(s.obstacles) as Obstacle | undefined;
        if (!o) continue;
        const r = Math.random();
        o.kind =
          r < 0.22 ? 'low' : r < 0.42 ? 'high' : r < 0.6 ? 'bus' : 'train';
        o.variant = Math.floor(Math.random() * BUS_VARIANTS.length);
        o.lane = lane;
        o.z = SPAWN_Z;
        o.extra =
          o.kind === 'bus' && s.speed > 18 && Math.random() < 0.3 ? 9 : 0;
        if (o.kind === 'low' && Math.random() < 0.7) {
          // coins arc over the barrier: a jump is rewarded
          [1.7, 2.6, 1.7].forEach((y, i) => {
            const c = free(s.coinList) as Coin | undefined;
            if (!c) return;
            c.lane = lane;
            c.x = LANES[lane];
            c.y = y;
            c.z = SPAWN_Z + (i - 1) * 2.6;
            c.active = true;
          });
        }
        if (o.kind === 'train') {
          // a trail of coins along the roof rewards climbing up
          for (let i = 0; i < 7; i++) {
            const c = free(s.coinList) as Coin | undefined;
            if (!c) break;
            c.lane = lane;
            c.x = LANES[lane];
            c.y = TRAIN_TOP + 1.1;
            c.z = SPAWN_Z - TRAIN_LENGTH / 2 + 1.3 + i * 1.8;
            c.active = true;
          }
        }
        o.minD = 99;
        o.near = false;
        o.active = true;
      }
    }
    if (Math.random() < 0.8) {
      for (let i = 0; i < 5; i++) {
        const c = free(s.coinList) as Coin | undefined;
        if (!c) break;
        c.lane = safe;
        c.x = LANES[safe];
        c.y = 1.15;
        c.z = SPAWN_Z - i * 2.4;
        c.active = true;
      }
    }
  };

  const spawnPower = () => {
    const s = g.current;
    const pw = s.powerList.find(o => !o.active);
    if (!pw) return;
    pw.kind = POWER_KINDS[Math.floor(Math.random() * POWER_KINDS.length)];
    pw.lane = Math.floor(Math.random() * 3);
    pw.z = SPAWN_Z - 10;
    pw.active = true;
  };

  const coinShower = () => {
    const s = g.current;
    for (let row = 0; row < 7; row++) {
      for (let lane = 0; lane < 3; lane++) {
        const c = s.coinList.find(o => !o.active);
        if (!c) return;
        c.lane = lane;
        c.x = LANES[lane];
        c.y = 1.15;
        c.z = SPAWN_Z * 0.4 - row * 2.6;
        c.active = true;
      }
    }
  };

  const grant = (kind: PowerKind) => {
    const s = g.current;
    const dm = 1 + 0.2 * upgrades.duration;
    if (kind === 'shield') s.shield = true;
    else if (kind === 'magnet') s.magnetT = BASE_TIME.magnet * dm;
    else if (kind === 'x2') s.x2T = BASE_TIME.x2 * dm;
    else if (kind === 'sneakers') s.sneakT = BASE_TIME.sneakers * dm;
    else if (kind === 'box') coinShower();
    else {
      s.jetT = BASE_TIME.jet * dm;
      s.vy = 0;
    }
    sfx('power');
    buzz('medium');
    onEvent('power');
    onPopup(
      kind === 'shield'
        ? 'SHIELD!'
        : kind === 'magnet'
        ? 'MAGNET!'
        : kind === 'jet'
        ? 'JETPACK!'
        : kind === 'sneakers'
        ? 'SUPER SNEAKERS!'
        : kind === 'box'
        ? 'COIN SHOWER!'
        : 'SCORE x2!',
    );
  };

  useFrame((_, rawDt) => {
    // Back-pressure: expo-gl queues GL commands without limit. getError() blocks
    // until the GL thread has drained them, so a slow GPU can't make the queue
    // (and memory) grow until Android kills the app.
    (gl.getContext() as unknown as { getError(): number }).getError();

    if (paused) return;
    const dt = Math.min(rawDt, 0.05);
    const s = g.current;
    s.time += dt;

    // ---- adaptive resolution: watch the real frame rate
    if (rigRef.current) {
      s.perkCool -= rawDt;
      if (s.perkCool <= 0) {
        s.perkFps += rawDt;
        s.perkN += 1;
        if (s.perkFps >= 1.5) {
          const fps = s.perkN / s.perkFps;
          s.perkFps = 0;
          s.perkN = 0;
          if (fps < 40) {
            s.perkUp = 0;
            s.perkCool = 4;
            onPerf('down');
          } else if (fps > 56) {
            s.perkUp += 1.5;
            if (s.perkUp >= 9) {
              s.perkUp = 0;
              s.perkCool = 4;
              onPerf('up');
            }
          } else {
            s.perkUp = 0;
          }
        }
      }
    }

    // ---- run intro: camera sweep first, then the runner accelerates
    if (playing) {
      s.camT = Math.min(1, s.camT + dt / INTRO_TIME);
      if (s.camT > 0.35) s.launch = Math.min(1, s.launch + dt / LAUNCH_TIME);
    } else {
      s.camT = 0;
      s.launch = 0;
    }
    const camE = smooth(s.camT);
    const launchE = smooth(s.launch);

    // ---- speed & distance
    if (playing && s.alive) {
      const target = Math.min(MAX_SPEED, START_SPEED + s.distance / 60);
      s.speed = 3 + (target - 3) * launchE;
    } else if (!playing) {
      s.speed = 3;
    } else {
      s.speed = Math.max(0, s.speed - 60 * dt);
    }
    const dz = s.speed * dt;
    const mult = s.x2T > 0 ? 2 : 1;
    if (playing && s.alive) {
      s.distance += dz;
      s.scoreAcc += dz * mult;
    }
    // timers
    s.magnetT = Math.max(0, s.magnetT - dt);
    s.sneakT = Math.max(0, s.sneakT - dt);
    s.x2T = Math.max(0, s.x2T - dt);
    s.invuln = Math.max(0, s.invuln - dt);
    if (s.comboT > 0) {
      s.comboT -= dt;
      if (s.comboT <= 0) s.combo = 0;
    }
    if (s.jetT > 0) {
      s.jetT -= dt;
      if (s.jetT <= 0) {
        s.invuln = Math.max(s.invuln, 1.4); // grace after landing
        onPopup('LANDING');
      }
    }

    // ---- zone colours (city -> sunset -> bay, blended near each boundary)
    const zf = s.distance / ZONE_LENGTH;
    const zi = Math.floor(zf) % ZONES.length;
    const zn = (zi + 1) % ZONES.length;
    const blend = smooth(Math.min(1, Math.max(0, ((zf % 1) - 0.75) / 0.25)));
    const a = ZONE_COLORS[zi];
    const b = ZONE_COLORS[zn];
    (scene.background as THREE.Color).copy(a.sky).lerp(b.sky, blend);
    (scene.fog as THREE.Fog).color.copy(a.fog).lerp(b.fog, blend);
    A.sunMat.color.copy(a.sun).lerp(b.sun, blend);
    A.sunGlow.color.copy(A.sunMat.color);
    A.edge.color.copy(a.edge).lerp(b.edge, blend);
    A.stripe.color.copy(a.dash).lerp(b.dash, blend);
    if (ambient.current) {
      ambient.current.color.copy(
        tmpColor.copy(a.ambient).lerp(b.ambient, blend),
      );
    }
    if (playing && zi !== s.zone) {
      s.zone = zi;
      onZone(ZONES[zi].name);
    }

    // ---- what is under the runner? (road, a ramp, or a train roof)
    let ground = 0;
    for (const o of s.obstacles) {
      if (!o.active || o.kind !== 'train') continue;
      if (Math.abs(LANES[o.lane] - s.x) > 0.95) continue;
      const zF = o.z + TRAIN_LENGTH / 2;
      const zB = o.z - TRAIN_LENGTH / 2;
      let h = 0;
      if (zB <= 0 && zF >= 0) h = TRAIN_TOP;
      else if (zF < 0 && zF > -RAMP_LENGTH) {
        h = (TRAIN_TOP * (zF + RAMP_LENGTH)) / RAMP_LENGTH;
      }
      if (h > ground) ground = h;
    }
    s.ground = ground;

    // ---- player physics
    if (s.alive) {
      const tx = LANES[s.lane];
      s.x += (tx - s.x) * Math.min(1, 14 * perks.agility * dt);
      if (s.jetT > 0) {
        s.y += (4.3 + ground - s.y) * Math.min(1, 4 * dt); // fly
        s.vy = 0;
        s.grounded = false;
      } else {
        s.vy -= GRAVITY * dt;
        s.y += s.vy * dt;
        if (s.y <= ground + 0.02 && s.vy <= 0) {
          s.y = ground;
          s.vy = 0;
          s.grounded = true;
          if (s.jumpBuf > 0 && playing) {
            s.vy = JUMP_VELOCITY * perks.jump * (s.sneakT > 0 ? 1.4 : 1);
            s.jumpBuf = 0;
            s.grounded = false;
          }
        } else {
          s.grounded = false;
        }
      }
      s.jumpBuf = Math.max(0, s.jumpBuf - dt);
      if (s.roll > 0) s.roll -= dt;
    } else {
      s.deadTime += dt;
    }

    // ---- character animation state
    const r = rigRef.current;
    if (r) {
      if (!s.alive) {
        if (r.hasDeath) play('death', true);
        else if (s.action) s.action.paused = true;
      } else if (playing) {
        if (s.role === 'idle' && s.camT > 0.3) play('run');
        const airborne = !s.grounded && s.jetT <= 0;
        if (airborne && !s.airborne) play('jump', true);
        if (!airborne && s.airborne) play('run');
        s.airborne = airborne;
        const run = r.actionFor('run');
        if (run && s.role === 'run') {
          run.timeScale =
            r.def.runSpeed * (0.9 + (s.speed - START_SPEED) * 0.03);
        } else if (run && s.role === 'jump' && !r.hasJump) {
          run.timeScale = 0.3;
        }
      }
      // pop-in when a character is picked
      s.pop = Math.min(1, s.pop + dt * 3.5);
      const k = 1 + 1.7 * Math.pow(s.pop - 1, 3) + 0.7 * Math.pow(s.pop - 1, 2);
      r.root.scale.setScalar(r.baseScale * k);
      r.root.position.y = r.foot * k;
      if (!playing) s.spin = (r.def.facing + s.time * 0.9) % TAU;
      const heading = Math.PI + r.def.facing;
      let diff = (heading - s.spin) % TAU;
      if (diff > Math.PI) diff -= TAU;
      if (diff < -Math.PI) diff += TAU;
      r.root.rotation.y = s.spin + diff * camE;
      // lean into lane changes
      r.root.rotation.y += (LANES[s.lane] - s.x) * 0.1 * camE;
      r.mixer.update(dt);
    }

    // ---- player transform
    const p = player.current;
    if (p) {
      p.position.set(s.x, s.y, 0);
      p.rotation.z = (LANES[s.lane] - s.x) * 0.12;
      const f = flip.current;
      f.position.y = s.center;
      inner.current.position.y = -s.center;
      const rolling = s.alive && s.roll > 0;
      if (rolling) {
        f.scale.y = 0.6;
        f.rotation.x = -(1 - s.roll / ROLL_TIME) * Math.PI * 2;
      } else {
        f.scale.y = 1;
        f.rotation.x = 0;
        if (r && playing && s.alive && !s.grounded && !r.hasJump) {
          f.rotation.x = -0.3; // lean into the jump
        }
        if (r && playing && !s.alive && !r.hasDeath) {
          // no death animation: tip forward onto the road
          const t = Math.min(1, s.deadTime * 4);
          f.rotation.x = -1.45 * t;
          f.position.y = s.center - s.center * 0.6 * t;
        }
      }
    }
    if (platform.current) {
      const ps = 1 - Math.min(1, camE * 1.6);
      platform.current.visible = ps > 0.02;
      platform.current.scale.setScalar(Math.max(0.01, ps));
    }
    if (flip.current && r) {
      if (s.alive && s.jetT > 0) flip.current.rotation.x = -0.4;
      inner.current.visible = !(
        s.invuln > 0 &&
        s.jetT <= 0 &&
        Math.floor(s.time * 12) % 2 === 0
      );
    }
    if (aura.current) {
      // glowing ring under the runner: breathes while running, follows train roofs
      aura.current.visible = playing && s.alive;
      aura.current.position.set(s.x, s.ground + 0.05, 0);
      aura.current.scale.setScalar(
        (1 + Math.sin(s.time * 6) * 0.08) * (s.grounded ? 1 : 0.7),
      );
    }
    if (board.current) {
      board.current.visible = s.hover && s.alive;
      board.current.position.set(s.x, s.y + 0.08, 0);
      board.current.rotation.y = Math.sin(s.time * 3) * 0.1;
    }
    if (bubble.current) {
      bubble.current.visible = s.shield && s.alive;
      bubble.current.position.set(s.x, s.y + s.center, 0);
      bubble.current.scale.setScalar(1 + Math.sin(s.time * 6) * 0.04);
    }
    if (magnetRing.current) {
      const on = s.magnetT > 0 && s.alive;
      magnetRing.current.visible = on;
      magnetRing.current.position.set(s.x, s.y + 0.15, 0);
      magnetRing.current.scale.setScalar(1 + ((s.time * 1.6) % 1) * 1.6);
    }
    if (blob.current) {
      blob.current.position.x = s.x;
      blob.current.position.y = s.ground + 0.03;
      const sc = Math.max(0.35, 1 - (s.y - s.ground) * 0.35);
      blob.current.scale.set(sc, sc, sc);
    }

    // ---- camera: menu pose -> run pose (sweep), follows lane, FOV kick, shake
    const fov = playing ? 62 + (s.speed - START_SPEED) * 0.45 * launchE : 62;
    if (Math.abs((camera as THREE.PerspectiveCamera).fov - fov) > 0.05) {
      (camera as THREE.PerspectiveCamera).fov = fov;
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }
    s.shake = Math.max(0, s.shake - dt);
    const sh = s.shake * 0.5;
    s.camX += (s.x * 0.55 - s.camX) * Math.min(1, 6 * dt);
    tmpPos.lerpVectors(MENU_CAM.pos, RUN_CAM.pos, camE);
    tmpPos.x += s.camX * camE;
    tmpPos.y += (s.alive ? s.y * 0.25 : 0) * camE + (sh ? rand(-sh, sh) : 0);
    tmpLook.lerpVectors(MENU_CAM.look, RUN_CAM.look, camE);
    tmpLook.x += s.x * 0.3 * camE;
    camera.position.copy(tmpPos);
    camera.lookAt(tmpLook);

    // ---- scenery scroll (two strips leapfrog)
    world.strips.forEach(st => {
      st.position.z += dz;
      if (st.position.z - STRIP_LENGTH > 15) st.position.z -= 2 * STRIP_LENGTH;
    });
    if (sun.current) sun.current.position.x = Math.sin(s.time * 0.2) * 3;

    // ---- tunnel: a long covered stretch every so often
    const tn = world.tunnel;
    if (playing && s.alive && !s.tunnelOn && s.launch > 0.7) {
      s.tunnelIn -= dz;
      if (s.tunnelIn <= 0) {
        s.tunnelOn = true;
        s.tunnelZ = SPAWN_Z - TUNNEL_LENGTH / 2;
        s.tunnelIn = 380 + Math.random() * 300;
        onPopup('TUNNEL');
      }
    }
    if (s.tunnelOn) {
      s.tunnelZ += dz;
      tn.position.z = s.tunnelZ;
      tn.visible = true;
      if (s.tunnelZ - TUNNEL_LENGTH / 2 > 24) {
        s.tunnelOn = false;
        tn.visible = false;
      }
    } else if (tn.visible) {
      tn.visible = false;
    }

    // ---- spawning
    if (playing && s.alive && s.launch > 0.5) {
      s.spawnDist += dz;
      const gap = 22 - Math.min(6, (s.speed - START_SPEED) * 0.4);
      if (s.spawnDist >= gap) {
        s.spawnDist = 0;
        spawnRow();
        s.rows += 1;
        if (s.rows % 6 === 3 && Math.random() < 0.85) spawnPower();
      }
    }

    // ---- obstacles
    const standing = r ? r.def.height * 0.9 : PLAYER_HEIGHT;
    const playerTop = s.y + (s.roll > 0 ? PLAYER_ROLL_HEIGHT : standing);
    s.obstacles.forEach((o, i) => {
      const grp = obstacleRefs.current[i];
      if (!grp) return;
      if (!o.active) {
        grp.visible = false;
        return;
      }
      o.z += dz + o.extra * dt;
      if (
        o.z >
        DESPAWN_Z +
          (o.kind === 'train' ? TRAIN_LENGTH / 2 + 1 : BUS_HALF_LENGTH)
      ) {
        o.active = false;
        grp.visible = false;
        return;
      }
      grp.visible = true;
      grp.position.set(LANES[o.lane], 0, o.z);
      // children: [barrier, gantry, bus variant 0..n]
      const show =
        o.kind === 'low'
          ? 0
          : o.kind === 'high'
          ? 1
          : o.kind === 'bus'
          ? 2 + o.variant
          : 5 + o.variant;
      grp.children.forEach((c, ci) => {
        c.visible = ci === show;
      });
      // collision + close-call detection
      const reach = o.kind === 'bus' ? BUS_HALF_LENGTH + 0.4 : 0.7;
      const flying = s.jetT > 0;
      const safe = s.invuln > 0 || flying;
      if (o.kind === 'train') {
        const zF = o.z + TRAIN_LENGTH / 2;
        const zB = o.z - TRAIN_LENGTH / 2;
        let surf = 0;
        if (zB <= 0.3 && zF >= 0) surf = TRAIN_TOP;
        else if (zF < 0 && zF > -RAMP_LENGTH) {
          surf = (TRAIN_TOP * (zF + RAMP_LENGTH)) / RAMP_LENGTH;
        }
        const hit =
          surf > 0.5 &&
          Math.abs(LANES[o.lane] - s.x) < 0.95 &&
          s.y < surf - 0.5;
        if (hit && !safe && s.alive && playing) {
          if (crash(o, grp)) return;
        }
        return; // trains have no close-call logic
      }
      if (s.alive && playing && Math.abs(o.z) < reach) {
        const dx = Math.abs(LANES[o.lane] - s.x);
        o.minD = Math.min(o.minD, dx);
        if (dx < 0.95 && !safe) {
          const bottom = o.kind === 'high' ? 0.95 : 0;
          const top = o.kind === 'low' ? 0.85 : o.kind === 'high' ? 1.45 : 3.2;
          if (s.y < top && playerTop > bottom) {
            if (crash(o, grp)) return;
          }
        }
      }
      if (!o.near && o.z > reach) {
        o.near = true;
        if (s.alive && playing && !flying && o.minD >= 0.95 && o.minD < 1.7) {
          s.scoreAcc += 25 * mult;
          sfx('near');
          buzz('light');
          onEvent('near');
          onPopup('CLOSE CALL +25');
        }
      }
    });

    // ---- power-up pickups
    s.powerList.forEach((pw, i) => {
      const m = powerRefs.current[i];
      if (!m) return;
      if (!pw.active) {
        m.visible = false;
        return;
      }
      pw.z += dz;
      if (pw.z > DESPAWN_Z) {
        pw.active = false;
        m.visible = false;
        return;
      }
      m.visible = true;
      m.material = A.powerMats[pw.kind];
      m.position.set(
        LANES[pw.lane],
        1.3 + Math.sin(s.time * 4 + i) * 0.15,
        pw.z,
      );
      m.rotation.set(s.time * 1.5, s.time * 2.5, 0);
      if (
        s.alive &&
        playing &&
        Math.abs(pw.z) < 1.1 &&
        Math.abs(LANES[pw.lane] - s.x) < 1.2 &&
        (Math.abs(1.3 - (s.y + 1)) < 1.9 || s.jetT > 0)
      ) {
        pw.active = false;
        m.visible = false;
        burst('gold', LANES[pw.lane], 1.3, pw.z, 8, 3);
        grant(pw.kind);
      }
    });

    // ---- coins (magnet pulls them in, combos multiply their value)
    const reachMul = perks.magnet * (1 + 0.15 * upgrades.magnet);
    s.coinList.forEach((c, i) => {
      const m = coinRefs.current[i];
      if (!m) return;
      if (!c.active) {
        m.visible = false;
        return;
      }
      c.z += dz;
      if (c.z > DESPAWN_Z) {
        c.active = false;
        m.visible = false;
        return;
      }
      if (s.magnetT > 0 && s.alive && c.z > -16 && c.z < 3) {
        c.x += (s.x - c.x) * Math.min(1, 7 * dt);
        c.z += 6 * dt; // drift toward the runner
      }
      m.visible = true;
      m.position.set(c.x, c.y + Math.sin(s.time * 5 + i) * 0.08, c.z);
      m.rotation.y = s.time * 4;
      const near = s.magnetT > 0 ? 1.6 : 0.9 * reachMul;
      if (
        s.alive &&
        playing &&
        Math.abs(c.z) < near &&
        Math.abs(c.x - s.x) < near &&
        (Math.abs(c.y - (s.y + 1)) < 1.6 || s.jetT > 0 || s.magnetT > 0)
      ) {
        c.active = false;
        m.visible = false;
        s.coins += 1;
        s.combo += 1;
        s.comboT = 2.5;
        const tier = s.combo >= 20 ? 3 : s.combo >= 10 ? 2 : 1;
        s.scoreAcc += 10 * tier * mult * (1 + 0.1 * upgrades.coinvalue);
        if (s.combo === 10 || s.combo === 20) onPopup(`COMBO x${tier}!`);
        onEvent('coin');
        sfx('coin');
        burst('gold', c.x, 1.2, c.z, 6, 2.5);
      }
    });

    // ---- particles
    s.particles.forEach((pt, i) => {
      const m = particleRefs.current[i];
      if (!m) return;
      if (!pt.active) {
        m.visible = false;
        return;
      }
      pt.life -= dt;
      if (pt.life <= 0) {
        pt.active = false;
        m.visible = false;
        return;
      }
      pt.vy -= 9 * dt;
      pt.x += pt.vx * dt;
      pt.y = Math.max(0.05, pt.y + pt.vy * dt);
      pt.z += pt.vz * dt + dz;
      m.visible = true;
      m.position.set(pt.x, pt.y, pt.z);
      m.rotation.set(s.time * 6 + i, s.time * 5, 0);
      m.scale.setScalar(Math.min(1, pt.life * 3) * 0.16);
    });

    if (showHead.current && playing) {
      showHead.current = false;
      onPopup('HEAD START!');
    }

    // ---- speed lines
    const fast = playing && s.alive && s.speed > 21;
    lineRefs.current.forEach((m, i) => {
      if (!fast) {
        m.visible = false;
        return;
      }
      if (!m.visible || m.position.z > 6) {
        m.visible = true;
        m.position.set(
          (Math.random() < 0.5 ? -1 : 1) * rand(2.5, 7.5),
          rand(0.4, 6),
          rand(-60, -20),
        );
      }
      m.position.z += dz * 1.5 + 8 * dt;
      void i;
    });

    // ---- HUD stats (throttled)
    s.statsTimer += dt;
    if (playing && s.alive && s.statsTimer > 0.1) {
      s.statsTimer = 0;
      const dm = 1 + 0.2 * upgrades.duration;
      onStats({
        score: Math.floor(s.scoreAcc * perks.score),
        coins: s.coins,
        combo: s.combo,
        comboFill: s.combo > 0 ? Math.max(0, s.comboT) / 2.5 : 0,
        distance: s.distance,
        fx: {
          sneakers: s.sneakT / (BASE_TIME.sneakers * dm),
          magnet: s.magnetT / (BASE_TIME.magnet * dm),
          shield: s.shield ? 1 : 0,
          hover: s.hover ? 1 : 0,
          jet: Math.max(0, s.jetT) / (BASE_TIME.jet * dm),
          x2: s.x2T / (BASE_TIME.x2 * dm),
        },
      });
    }
  });

  const sides = [-1, 1];

  return (
    <>
      <ambientLight ref={ambient} intensity={1.0} color="#b9a0ff" />
      <directionalLight position={[4, 10, 6]} intensity={1.5} color="#ffe6f7" />
      {/* accent-coloured rim light from behind-left makes the runner's silhouette pop */}
      <directionalLight
        ref={rimLight}
        position={[-4, 5, -8]}
        intensity={0.8}
        color="#20e3ff"
      />
      <directionalLight position={[3, 2, 9]} intensity={0.35} color="#ffffff" />

      {/* sky */}
      <points geometry={stars} material={A.star} />
      <group ref={sun} position={[0, 20, -120]}>
        <mesh material={A.sunMat}>
          <sphereGeometry args={[15, 28, 28]} />
        </mesh>
        <mesh material={A.sunGlow}>
          <sphereGeometry args={[21, 24, 24]} />
        </mesh>
      </group>

      {/* ground, road, sidewalks */}
      <mesh
        position={[0, -0.16, -45]}
        geometry={A.longBox}
        material={A.ground}
        scale={[140, 0.1, 170]}
      />
      <mesh
        position={[0, -0.05, -45]}
        geometry={A.longBox}
        material={A.road}
        scale={[8.2, 0.1, 140]}
      />
      <mesh
        position={[-4.3, 0.02, -45]}
        geometry={A.longBox}
        material={A.edge}
        scale={[0.18, 0.12, 140]}
      />
      <mesh
        position={[4.3, 0.02, -45]}
        geometry={A.longBox}
        material={A.edge}
        scale={[0.18, 0.12, 140]}
      />
      {sides.map(sd => (
        <mesh
          key={`sw${sd}`}
          position={[sd * 6.4, 0.06, -45]}
          geometry={A.longBox}
          material={A.sidewalk}
          scale={[4.2, 0.24, 140]}
        />
      ))}
      {/* scrolling city strips: buildings, lamps, trees, lane dashes */}
      {world.strips.map((st, i) => (
        <primitive key={`strip${i}`} object={st} />
      ))}

      {/* hero platform (character select) */}
      <group ref={platform}>
        <mesh
          geometry={A.platGeo}
          material={A.platMat}
          position={[0, 0.02, 0]}
        />
        <mesh
          geometry={A.ringGeo}
          material={A.ring}
          position={[0, 0.07, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      </group>

      {/* player: animated character */}
      <group ref={player}>
        <mesh
          ref={blob}
          geometry={A.blob}
          material={A.blobMat}
          position={[0, 0.03, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        />
        <group ref={flip} position={[0, 0.95, 0]}>
          <group ref={inner} position={[0, -0.95, 0]}>
            {rig && <primitive object={rig.root} />}
          </group>
        </group>
      </group>

      {/* obstacles + coins (pooled, merged meshes) */}
      {world.slots.map((g, i) => (
        <primitive key={`o${i}`} object={g} />
      ))}
      {world.coins.map((m, i) => (
        <primitive key={`c${i}`} object={m} />
      ))}

      <primitive object={world.tunnel} />
      {world.powers.map((m, i) => (
        <primitive key={`pw${i}`} object={m} />
      ))}
      {world.lines.map((m, i) => (
        <primitive key={`ln${i}`} object={m} />
      ))}
      <mesh
        ref={bubble}
        visible={false}
        geometry={A.bubbleGeo}
        material={A.bubbleMat}
      />
      <mesh
        ref={aura}
        visible={false}
        geometry={A.auraGeo}
        material={A.auraMat}
        rotation={[-Math.PI / 2, 0, 0]}
      />
      <mesh
        ref={board}
        visible={false}
        geometry={A.boardGeo}
        material={A.boardMat}
      />
      <mesh
        ref={magnetRing}
        visible={false}
        geometry={A.ringGeo}
        material={A.magnetMat}
        rotation={[Math.PI / 2, 0, 0]}
      />

      {/* particles (pooled) */}
      {Array.from({ length: PARTICLE_POOL }).map((_, i) => (
        <mesh
          key={`p${i}`}
          visible={false}
          ref={r => {
            if (r) particleRefs.current[i] = r;
          }}
          geometry={A.box}
          material={A.sparkGold}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  canvas: { flex: 1 },
});

function World({
  quality,
  ...props
}: Omit<Props, 'onPerf'> & { quality: Quality }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [lo, hi] =
    quality === 'low' ? [0, 1] : quality === 'high' ? [2, 3] : [0, 3];
  const [scaleIdx, setScaleIdx] = useState(quality === 'low' ? 0 : 2);
  useEffect(() => {
    setScaleIdx(i => Math.max(lo, Math.min(hi, i)));
  }, [lo, hi]);
  const onPerf = useCallback(
    (dir: 'down' | 'up') => {
      setScaleIdx(i => Math.max(lo, Math.min(hi, i + (dir === 'up' ? 1 : -1))));
    },
    [lo, hi],
  );
  // Render the 3D scene at a lower resolution and stretch it to fill the
  // screen (cheaper for the GPU). The level adapts to the device's frame rate.
  const scale = RENDER_SCALES[scaleIdx];
  const w = size.w * scale;
  const h = size.h * scale;
  return (
    <View
      style={styles.fill}
      onLayout={e =>
        setSize({
          w: e.nativeEvent.layout.width,
          h: e.nativeEvent.layout.height,
        })
      }
    >
      {size.w > 0 && (
        <View
          style={{
            position: 'absolute',
            left: (size.w - w) / 2,
            top: (size.h - h) / 2,
            width: w,
            height: h,
            transform: [{ scale: 1 / scale }],
          }}
        >
          <Canvas
            style={styles.canvas}
            camera={{ fov: 62, near: 0.1, far: 220 }}
          >
            <Scene {...props} onPerf={onPerf} />
          </Canvas>
        </View>
      )}
    </View>
  );
}

// Props are all stable, so HUD updates (every 100 ms) never re-render the 3D tree.
export default React.memo(World);
