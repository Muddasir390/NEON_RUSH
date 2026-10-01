import * as THREE from 'three';

export type Zone = {
  name: string;
  sky: string;
  fog: string;
  sun: string;
  edge: string;
  dash: string;
  ambient: string;
};

export const ZONES: Zone[] = [
  {
    name: 'NEON CITY',
    sky: '#1a0533',
    fog: '#2a0a4a',
    sun: '#ff5e9c',
    edge: '#ff2d95',
    dash: '#20e3ff',
    ambient: '#b9a0ff',
  },
  {
    name: 'SUNSET STRIP',
    sky: '#3b0d2e',
    fog: '#7d2a45',
    sun: '#ffb347',
    edge: '#ff7a1a',
    dash: '#ffd23f',
    ambient: '#ffc9a0',
  },
  {
    name: 'MIDNIGHT BAY',
    sky: '#031a2e',
    fog: '#06304a',
    sun: '#7af0ff',
    edge: '#20e3ff',
    dash: '#39ff88',
    ambient: '#8fd8ff',
  },
  {
    name: 'TOXIC DUSK',
    sky: '#0d1f12',
    fog: '#1c4a2a',
    sun: '#b6ff3d',
    edge: '#b6ff3d',
    dash: '#ff2d95',
    ambient: '#b8ffc0',
  },
];

/** Distance (metres) spent in each zone before the next one starts blending in. */
export const ZONE_LENGTH = 400;

const c = (hex: string) => new THREE.Color(hex);
export const ZONE_COLORS = ZONES.map(z => ({
  sky: c(z.sky),
  fog: c(z.fog),
  sun: c(z.sun),
  edge: c(z.edge),
  dash: c(z.dash),
  ambient: c(z.ambient),
}));
