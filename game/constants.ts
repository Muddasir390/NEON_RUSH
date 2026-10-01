export const LANES = [-2.4, 0, 2.4];
export const GRAVITY = 30;
export const JUMP_VELOCITY = 10.5;
export const ROLL_TIME = 0.7;
export const PLAYER_HEIGHT = 1.7;
export const PLAYER_ROLL_HEIGHT = 0.7;

export const START_SPEED = 15;
export const MAX_SPEED = 32;
export const SPAWN_Z = -105;
export const DESPAWN_Z = 8;

export const OBSTACLE_POOL = 18;
export const COIN_POOL = 96;
export const BUILDINGS_PER_SIDE = 12;
export const STRIPES = 16;
export const LAMPS_PER_SIDE = 7;
export const TREES_PER_SIDE = 9;
export const PARTICLE_POOL = 48;
export const BUS_HALF_LENGTH = 3.5;

export const TRAIN_LENGTH = 14;
export const RAMP_LENGTH = 8;
export const TRAIN_TOP = 3.4;
export const TUNNEL_LENGTH = 72;

export type ObstacleKind = 'low' | 'high' | 'bus' | 'train';
export type Action = 'left' | 'right' | 'jump' | 'roll';

export const COLORS = {
  sky: '#1a0533',
  fog: '#2a0a4a',
  road: '#15102b',
  neonPink: '#ff2d95',
  neonCyan: '#20e3ff',
  neonYellow: '#ffd23f',
  neonOrange: '#ff7a1a',
  neonGreen: '#39ff88',
};
