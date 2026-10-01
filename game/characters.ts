export type Role = 'run' | 'idle' | 'jump' | 'death';

export type ModelData = {
  glb: string;
  textures: Record<string, { w: number; h: number; data: string }>;
};

export type Tint = { color: string; emissive?: string; intensity?: number };

export type CharacterDef = {
  id: string;
  /** Two-letter badge for the picker. */
  short: string;
  name: string;
  tagline: string;
  accent: string;
  /** Coins needed to unlock (0 = free). */
  price: number;
  /** Cache key: characters sharing a model share one parsed file. */
  model: string;
  /** Lazy so a model's data is only loaded when somebody picks it. */
  data: () => ModelData;
  /** Standing height in world units. */
  height: number;
  /** Extra Y rotation so the model faces +Z (toward the camera) by default. */
  facing: number;
  /** Animation clip names. Missing jump/death are faked in code. */
  anims: { run: string; idle: string; jump?: string; death?: string };
  runSpeed: number;
  /** material name -> tint */
  tint?: Record<string, Tint>;
  /** 0.6 .. 1.4 multipliers around the default gameplay values. */
  perks: { agility: number; jump: number; magnet: number; score: number };
  /** Short class label shown on the select screen. */
  role: string;
  /** One-line description of the passive ability. */
  passive: string;
  /** Applied automatically at the start of every run. */
  startFx?: {
    shield?: boolean;
    magnet?: number;
    sneakers?: number;
    x2?: number;
    jet?: number;
  };
};

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'jake',
    price: 0,
    role: 'SMOOTH',
    passive: 'Quick on his feet: lane changes are extra snappy.',
    short: 'JK',
    name: 'JAKE',
    tagline: 'Sharp suit, sharper moves',
    accent: '#ff9f1a',
    model: 'jake',
    data: () => require('./assets/models/jake').default,
    height: 1.85,
    facing: 0,
    anims: { run: 'run', idle: 'idle' },
    runSpeed: 1,
    perks: { agility: 1.2, jump: 1, magnet: 1, score: 1 },
  },
  {
    id: 'mia',
    price: 300,
    role: 'PARKOUR',
    passive: 'Starts every run with a shield and a 4s coin magnet.',
    startFx: { shield: true, magnet: 4 },
    short: 'MI',
    name: 'MIA',
    tagline: 'Fast, fearless city runner',
    accent: '#ff5cc8',
    model: 'mia',
    data: () => require('./assets/models/mia').default,
    height: 1.75,
    facing: 0,
    anims: { run: 'run', idle: 'idle' },
    runSpeed: 1.05,
    perks: { agility: 1.1, jump: 1.2, magnet: 1, score: 1.05 },
  },
  {
    id: 'vanguard',
    price: 800,
    role: 'TANK',
    passive: 'Starts every run with a shield.',
    startFx: { shield: true },
    short: 'VG',
    name: 'VANGUARD',
    tagline: 'Armoured operative',
    accent: '#7dff6a',
    model: 'soldier',
    data: () => require('./assets/models/soldier').default,
    height: 1.9,
    facing: Math.PI,
    anims: { run: 'Run', idle: 'Idle' },
    runSpeed: 1,
    perks: { agility: 0.85, jump: 0.95, magnet: 1.35, score: 1 },
  },
  {
    id: 'kai',
    price: 400,
    role: 'SKATER',
    passive: 'Starts every run with 6s of super jump.',
    startFx: { sneakers: 6 },
    short: 'KA',
    name: 'KAI',
    tagline: 'Skate park legend',
    accent: '#ff6b3d',
    model: 'kai',
    data: () => require('./assets/models/kai').default,
    height: 1.7,
    facing: 0,
    anims: { run: 'run', idle: 'idle' },
    runSpeed: 1.05,
    perks: { agility: 1.1, jump: 1.25, magnet: 0.95, score: 1 },
  },
  {
    id: 'nova',
    price: 700,
    role: 'REBEL',
    passive: 'Free 2.5s jetpack launch every run.',
    startFx: { jet: 2.5 },
    short: 'NV',
    name: 'NOVA',
    tagline: 'Punk attitude, zero brakes',
    accent: '#2ee6a6',
    model: 'nova',
    data: () => require('./assets/models/nova').default,
    height: 1.7,
    facing: 0,
    anims: { run: 'run', idle: 'idle' },
    runSpeed: 1.15,
    perks: { agility: 1.25, jump: 1.1, magnet: 0.9, score: 1.15 },
  },
  {
    id: 'ella',
    price: 900,
    role: 'COLLECTOR',
    passive: 'Starts every run with a 10s coin magnet.',
    startFx: { magnet: 10 },
    short: 'EL',
    name: 'ELLA',
    tagline: 'Smart, stylish, coin magnet',
    accent: '#ffd23f',
    model: 'ella',
    data: () => require('./assets/models/ella').default,
    height: 1.75,
    facing: 0,
    anims: { run: 'run', idle: 'idle' },
    runSpeed: 1.05,
    perks: { agility: 1.05, jump: 1, magnet: 1.4, score: 1.1 },
  },
  {
    id: 'sasha',
    price: 1200,
    role: 'SCORER',
    passive: 'Starts every run with 8s of score x2.',
    startFx: { x2: 8 },
    short: 'SA',
    name: 'SASHA',
    tagline: 'Boardroom boss, track-ready',
    accent: '#ff7ab8',
    model: 'sasha',
    data: () => require('./assets/models/sasha').default,
    height: 1.85,
    facing: 0,
    anims: { run: 'run', idle: 'idle' },
    runSpeed: 1,
    perks: { agility: 1, jump: 0.95, magnet: 0.95, score: 1.3 },
  },
  {
    id: 'finn',
    price: 1600,
    role: 'ALL-ROUNDER',
    passive: 'Starts every run with a shield and 5s of super jump.',
    startFx: { shield: true, sneakers: 5 },
    short: 'FI',
    name: 'FINN',
    tagline: 'Easy-going, hard to catch',
    accent: '#3b9bff',
    model: 'finn',
    data: () => require('./assets/models/finn').default,
    height: 1.75,
    facing: 0,
    anims: { run: 'run', idle: 'idle' },
    runSpeed: 1.05,
    perks: { agility: 1.1, jump: 1.1, magnet: 1.05, score: 1.05 },
  },
];
