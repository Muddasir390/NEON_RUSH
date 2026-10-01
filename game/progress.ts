/** Missions, daily rewards, upgrades, prices. Pure data + helpers. */
export type MissionType =
  | 'coins'
  | 'distance'
  | 'jumps'
  | 'near'
  | 'powers'
  | 'score';

export type Mission = {
  id: string;
  type: MissionType;
  target: number;
  reward: number;
  progress: number;
  claimed: boolean;
};

export const MISSION_LABEL: Record<MissionType, (n: number) => string> = {
  coins: n => `Collect ${n} coins`,
  distance: n => `Run ${n} metres`,
  jumps: n => `Jump ${n} times`,
  near: n => `Make ${n} close calls`,
  powers: n => `Grab ${n} power-ups`,
  score: n => `Score ${n} in one run`,
};

const POOL: { type: MissionType; targets: number[] }[] = [
  { type: 'coins', targets: [60, 120, 200] },
  { type: 'distance', targets: [800, 1500, 2500] },
  { type: 'jumps', targets: [15, 30, 50] },
  { type: 'near', targets: [5, 10, 18] },
  { type: 'powers', targets: [3, 6, 10] },
  { type: 'score', targets: [600, 1200, 2000] },
];

export const todayKey = () => new Date().toISOString().slice(0, 10);

export function newMissions(): Mission[] {
  const picks = [...POOL].sort(() => Math.random() - 0.5).slice(0, 3);
  return picks.map((p, i) => {
    const target = p.targets[Math.min(i, 2)];
    return {
      id: `${p.type}-${Date.now()}-${i}`,
      type: p.type,
      target,
      reward: 40 + i * 35 + Math.round(target / 20),
      progress: 0,
      claimed: false,
    };
  });
}

export const DAILY_REWARDS = [50, 75, 100, 150, 200, 300, 500];

/** Upgrade tracks: each level costs more and lasts / reaches further. */
export const UPGRADES = [
  {
    key: 'duration' as const,
    name: 'POWER-UP TIME',
    desc: '+20% duration per level',
    max: 5,
    cost: (lvl: number) => 150 * (lvl + 1),
  },
  {
    key: 'magnet' as const,
    name: 'MAGNET REACH',
    desc: '+15% pickup range per level',
    max: 5,
    cost: (lvl: number) => 120 * (lvl + 1),
  },
  {
    key: 'coinvalue' as const,
    name: 'COIN VALUE',
    desc: '+10% score per coin per level',
    max: 5,
    cost: (lvl: number) => 200 * (lvl + 1),
  },
];
export type UpgradeKey = (typeof UPGRADES)[number]['key'];

export const HEADSTART_COST = 80;
export const HOVERBOARD_COST = 120;
export const REVIVE_COST = (revivesThisRun: number) =>
  40 * (revivesThisRun + 1);

/** Lifetime achievements. `test` gets lifetime totals plus the best single run. */
export type AchStats = {
  coins: number;
  distance: number;
  runs: number;
  near: number;
  powers: number;
  jumps: number;
  bestScore: number;
  unlocked: number;
};
export const ACHIEVEMENTS: {
  id: string;
  name: string;
  desc: string;
  reward: number;
  test: (s: AchStats) => boolean;
}[] = [
  {
    id: 'first',
    name: 'FIRST STEPS',
    desc: 'Play your first run',
    reward: 30,
    test: s => s.runs >= 1,
  },
  {
    id: 'runs10',
    name: 'REGULAR',
    desc: 'Play 10 runs',
    reward: 80,
    test: s => s.runs >= 10,
  },
  {
    id: 'coins500',
    name: 'COIN COLLECTOR',
    desc: 'Collect 500 coins in total',
    reward: 100,
    test: s => s.coins >= 500,
  },
  {
    id: 'coins3000',
    name: 'RICH RUNNER',
    desc: 'Collect 3,000 coins in total',
    reward: 300,
    test: s => s.coins >= 3000,
  },
  {
    id: 'dist5k',
    name: 'MARATHON',
    desc: 'Run 5,000 metres in total',
    reward: 120,
    test: s => s.distance >= 5000,
  },
  {
    id: 'score2k',
    name: 'HIGH SCORER',
    desc: 'Score 2,000 in one run',
    reward: 150,
    test: s => s.bestScore >= 2000,
  },
  {
    id: 'score6k',
    name: 'LEGEND',
    desc: 'Score 6,000 in one run',
    reward: 400,
    test: s => s.bestScore >= 6000,
  },
  {
    id: 'near50',
    name: 'DAREDEVIL',
    desc: 'Make 50 close calls',
    reward: 150,
    test: s => s.near >= 50,
  },
  {
    id: 'power30',
    name: 'POWERED UP',
    desc: 'Grab 30 power-ups',
    reward: 120,
    test: s => s.powers >= 30,
  },
  {
    id: 'jump200',
    name: 'HIGH FLYER',
    desc: 'Jump 200 times',
    reward: 100,
    test: s => s.jumps >= 200,
  },
  {
    id: 'squad',
    name: 'FULL SQUAD',
    desc: 'Unlock 3 runners',
    reward: 250,
    test: s => s.unlocked >= 3,
  },
];
