/**
 * Tiny persistent save file (best score, lifetime coins, last runner).
 * Every call is wrapped so a storage problem can never crash the game.
 */
import type { Mission } from './progress';

export type SaveData = {
  best: number;
  coins: number;
  hero: string;
  unlocked: string[];
  upgrades: { duration: number; magnet: number; coinvalue: number };
  missions: Mission[];
  missionDay: string;
  daily: { last: string; streak: number };
  settings: {
    sound: boolean;
    music: boolean;
    haptics: boolean;
    quality: 'auto' | 'low' | 'high';
  };
  tutorialDone: boolean;
  headstarts: number;
  hoverboards: number;
  totals: {
    coins: number;
    distance: number;
    runs: number;
    near: number;
    powers: number;
    jumps: number;
  };
  ach: string[];
};

export const DEFAULTS: SaveData = {
  best: 0,
  coins: 0,
  hero: 'jake',
  unlocked: ['jake'],
  upgrades: { duration: 0, magnet: 0, coinvalue: 0 },
  missions: [],
  missionDay: '',
  daily: { last: '', streak: 0 },
  settings: { sound: true, music: true, haptics: true, quality: 'auto' },
  tutorialDone: false,
  headstarts: 0,
  hoverboards: 0,
  totals: { coins: 0, distance: 0, runs: 0, near: 0, powers: 0, jumps: 0 },
  ach: [],
};

function fs() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('expo-file-system/legacy');
}

function uri(): string {
  return `${fs().documentDirectory}neon-rush-save.json`;
}

export async function loadSave(): Promise<SaveData> {
  try {
    const raw = await fs().readAsStringAsync(uri());
    const d = JSON.parse(raw);
    return {
      ...DEFAULTS,
      ...d,
      upgrades: { ...DEFAULTS.upgrades, ...d.upgrades },
      settings: { ...DEFAULTS.settings, ...d.settings },
      daily: { ...DEFAULTS.daily, ...d.daily },
      totals: { ...DEFAULTS.totals, ...d.totals },
      ach: d.ach ?? [],
      unlocked: Array.from(new Set(['jake', ...(d.unlocked ?? [])])),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** Debounced write. */
export function saveData(data: SaveData) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    fs()
      .writeAsStringAsync(uri(), JSON.stringify(data))
      .catch(() => {});
  }, 300);
}
