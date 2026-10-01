import { createAudioPlayer, AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

/**
 * Sound + haptics. Every call is guarded: audio problems must never crash or
 * stall the game. Effects use a small pool of players per sound so rapid
 * repeats (coins) can overlap.
 */
const SOURCES = {
  coin: require('./assets/sfx/coin.wav'),
  jump: require('./assets/sfx/jump.wav'),
  roll: require('./assets/sfx/roll.wav'),
  lane: require('./assets/sfx/lane.wav'),
  near: require('./assets/sfx/near.wav'),
  crash: require('./assets/sfx/crash.wav'),
  power: require('./assets/sfx/power.wav'),
  shield: require('./assets/sfx/shield.wav'),
  click: require('./assets/sfx/click.wav'),
  unlock: require('./assets/sfx/unlock.wav'),
  revive: require('./assets/sfx/revive.wav'),
  go: require('./assets/sfx/go.wav'),
};
const MUSIC = require('./assets/sfx/music.wav');

export type Sfx = keyof typeof SOURCES;
const POOL: Partial<Record<Sfx, number>> = { coin: 3, lane: 2, jump: 2 };
const VOLUME: Partial<Record<Sfx, number>> = {
  coin: 0.7,
  lane: 0.35,
  roll: 0.6,
};

const players: Partial<Record<Sfx, AudioPlayer[]>> = {};
const cursor: Partial<Record<Sfx, number>> = {};
let music: AudioPlayer | null = null;
let ready = false;

export const settings = { sound: true, music: true, haptics: true };

function safe(fn: () => void) {
  try {
    fn();
  } catch {
    // audio is optional
  }
}

/** Create all players once (call after the first frame so startup isn't blocked). */
export function initAudio() {
  if (ready) return;
  ready = true;
  safe(() => {
    (Object.keys(SOURCES) as Sfx[]).forEach(k => {
      players[k] = Array.from({ length: POOL[k] ?? 1 }, () => {
        const p = createAudioPlayer(SOURCES[k]);
        p.volume = VOLUME[k] ?? 1;
        return p;
      });
    });
    music = createAudioPlayer(MUSIC);
    music.loop = true;
    music.volume = 0.35;
  });
}

export function sfx(name: Sfx) {
  if (!settings.sound) return;
  safe(() => {
    const list = players[name];
    if (!list) return;
    const i = ((cursor[name] ?? -1) + 1) % list.length;
    cursor[name] = i;
    const p = list[i];
    p.seekTo(0);
    p.play();
  });
}

export function startMusic() {
  if (!settings.music) return;
  safe(() => music?.play());
}
export function stopMusic() {
  safe(() => music?.pause());
}
export function duckMusic(low: boolean) {
  safe(() => {
    if (music) music.volume = low ? 0.12 : 0.35;
  });
}

type Kind = 'light' | 'medium' | 'heavy' | 'success';
export function buzz(kind: Kind) {
  if (!settings.haptics) return;
  safe(() => {
    if (kind === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(
        kind === 'light'
          ? Haptics.ImpactFeedbackStyle.Light
          : kind === 'medium'
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Heavy,
      );
    }
  });
}
