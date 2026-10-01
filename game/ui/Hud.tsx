import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PowerFx } from '../World';
import { CoinIcon, PauseIcon } from './kit';
import { UI, glow } from './theme';

export type Ticker = { label: string; progress: number; target: number } | null;

type Props = {
  score: number;
  coins: number;
  best: number;
  distance: number;
  heroShort: string;
  accent: string;
  zone: string;
  banner: string;
  popup: string;
  fx?: PowerFx;
  combo?: number;
  comboFill?: number;
  ticker: Ticker;
  onPause: () => void;
};

const CHIPS: { key: keyof PowerFx; code: string; color: string }[] = [
  { key: 'shield', code: 'SH', color: '#3ba7ff' },
  { key: 'hover', code: 'HB', color: '#20e3ff' },
  { key: 'magnet', code: 'MG', color: '#ff3b6b' },
  { key: 'jet', code: 'JT', color: '#ffb020' },
  { key: 'x2', code: 'x2', color: '#7dff6a' },
  { key: 'sneakers', code: 'UP', color: '#a259ff' },
];

const tierOf = (c: number) => (c >= 20 ? 3 : c >= 10 ? 2 : 1);

export default function Hud({
  score,
  coins,
  best,
  distance,
  heroShort,
  accent,
  zone,
  banner,
  popup,
  fx,
  combo = 0,
  comboFill = 0,
  ticker,
  onPause,
}: Props) {
  const insets = useSafeAreaInsets();
  const newBest = best > 0 && score > best;
  const toBest = best > 0 ? Math.min(1, score / best) : 0;

  // popups / banners
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!banner && !popup) return;
    pop.setValue(0);
    Animated.timing(pop, {
      toValue: 1,
      duration: 380,
      easing: Easing.out(Easing.back(2)),
      useNativeDriver: true,
    }).start();
  }, [banner, popup, pop]);
  const popStyle = {
    opacity: pop,
    transform: [
      { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
    ],
  };

  // coin counter "bump" whenever it changes
  const bump = useRef(new Animated.Value(1)).current;
  const lastCoins = useRef(coins);
  useEffect(() => {
    if (coins > lastCoins.current) {
      bump.setValue(1.28);
      Animated.spring(bump, {
        toValue: 1,
        speed: 30,
        bounciness: 10,
        useNativeDriver: true,
      }).start();
    }
    lastCoins.current = coins;
  }, [coins, bump]);

  const active = CHIPS.filter(c => (fx?.[c.key] ?? 0) > 0);

  return (
    <>
      <View
        style={[styles.row, { top: insets.top + 8 }]}
        pointerEvents="box-none"
      >
        {/* runner + score */}
        <View
          style={[styles.card, { borderColor: accent }]}
          pointerEvents="none"
        >
          <View
            style={[
              styles.avatar,
              { borderColor: accent, backgroundColor: accent },
            ]}
          >
            <Text style={styles.avatarText}>{heroShort}</Text>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.scoreText}>{score}</Text>
            <View style={styles.bestTrack}>
              <View
                style={[
                  styles.bestFill,
                  {
                    width: `${(newBest ? 1 : toBest) * 100}%`,
                    backgroundColor: newBest ? UI.gold : accent,
                  },
                ]}
              />
            </View>
            <Text style={[styles.sub, newBest && { color: UI.gold }]}>
              {newBest ? 'NEW BEST!' : `${Math.floor(distance)} m`}
            </Text>
          </View>
        </View>

        {/* coins + pause */}
        <View style={styles.right}>
          <Animated.View
            style={[styles.coins, { transform: [{ scale: bump }] }]}
            pointerEvents="none"
          >
            <CoinIcon size={20} />
            <Text style={styles.coinText}>{coins}</Text>
          </Animated.View>
          <Pressable style={styles.pause} onPress={onPause} hitSlop={10}>
            <PauseIcon />
          </Pressable>
        </View>
      </View>

      {/* combo meter */}
      {combo >= 5 && (
        <View
          style={[styles.combo, { top: insets.top + 96 }]}
          pointerEvents="none"
        >
          <Text style={styles.comboText}>
            COMBO <Text style={{ color: UI.gold }}>{combo}</Text>
            {'  '}
            <Text style={styles.comboTier}>x{tierOf(combo)}</Text>
          </Text>
          <View style={styles.comboTrack}>
            <View
              style={[styles.comboFill, { width: `${comboFill * 100}%` }]}
            />
          </View>
        </View>
      )}

      {/* active power-ups: round icons with a countdown bar */}
      <View
        style={[styles.chips, { top: insets.top + (combo >= 5 ? 138 : 96) }]}
        pointerEvents="none"
      >
        {active.map(c => {
          const v = Math.min(1, fx?.[c.key] ?? 0);
          return (
            <View key={c.key} style={styles.chipWrap}>
              <View style={[styles.chip, { borderColor: c.color }]}>
                <Text style={[styles.chipText, { color: c.color }]}>
                  {c.code}
                </Text>
              </View>
              {c.key !== 'shield' && c.key !== 'hover' && (
                <View style={styles.chipTrack}>
                  <View
                    style={[
                      styles.chipFill,
                      { backgroundColor: c.color, width: `${v * 100}%` },
                    ]}
                  />
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* mission ticker */}
      {ticker && (
        <View
          style={[styles.ticker, { bottom: insets.bottom + 14 }]}
          pointerEvents="none"
        >
          <Text style={styles.tickerText} numberOfLines={1}>
            {ticker.label}
          </Text>
          <View style={styles.tickerTrack}>
            <View
              style={[
                styles.tickerFill,
                {
                  width: `${
                    Math.min(1, ticker.progress / ticker.target) * 100
                  }%`,
                },
              ]}
            />
          </View>
        </View>
      )}

      {banner !== '' && (
        <Animated.View
          style={[styles.banner, { top: insets.top + 190 }, popStyle]}
          pointerEvents="none"
        >
          <Text style={[styles.bannerText, glow(UI.gold, 20)]}>{banner}</Text>
        </Animated.View>
      )}
      {popup !== '' && banner === '' && (
        <Animated.View
          style={[styles.banner, { top: insets.top + 230 }, popStyle]}
          pointerEvents="none"
        >
          <Text style={[styles.popText, glow(UI.cyan, 14)]}>{popup}</Text>
        </Animated.View>
      )}
      {zone !== '' && banner === '' && popup === '' && (
        <View
          style={[styles.banner, { top: insets.top + 230 }]}
          pointerEvents="none"
        >
          <Text style={[styles.zoneText, glow(UI.gold, 16)]}>{zone}</Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 150,
    backgroundColor: UI.glass,
    borderWidth: 2,
    borderRadius: 22,
    padding: 8,
    paddingRight: 16,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: UI.dark, fontSize: 13, fontWeight: '900' },
  cardBody: { marginLeft: 10 },
  scoreText: { color: '#fff', fontSize: 26, fontWeight: '900', lineHeight: 28 },
  bestTrack: {
    height: 4,
    borderRadius: 2,
    marginTop: 3,
    backgroundColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
  },
  bestFill: { height: 4, borderRadius: 2 },
  sub: {
    color: UI.sub,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 3,
  },
  right: { flexDirection: 'row', alignItems: 'center' },
  coins: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: UI.glass,
    borderColor: UI.line,
    borderWidth: 1,
    borderRadius: 22,
    height: 42,
    paddingHorizontal: 14,
  },
  coinText: { color: UI.gold, fontSize: 20, fontWeight: '900', marginLeft: 8 },
  pause: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginLeft: 10,
    backgroundColor: UI.glass,
    borderColor: UI.line,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  combo: { position: 'absolute', left: 14, width: 150 },
  comboText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
  },
  comboTier: { color: UI.pink },
  comboTrack: {
    height: 5,
    borderRadius: 3,
    marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
  },
  comboFill: { height: 5, borderRadius: 3, backgroundColor: UI.gold },
  chips: { position: 'absolute', left: 14, flexDirection: 'row' },
  chipWrap: { alignItems: 'center', marginRight: 8 },
  chip: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    backgroundColor: UI.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 12, fontWeight: '900' },
  chipTrack: {
    width: 32,
    height: 4,
    borderRadius: 2,
    marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
  },
  chipFill: { height: 4, borderRadius: 2 },
  ticker: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    opacity: 0.85,
  },
  tickerText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  tickerTrack: {
    width: 180,
    height: 4,
    borderRadius: 2,
    marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
  },
  tickerFill: { height: 4, borderRadius: 2, backgroundColor: UI.pink },
  banner: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bannerText: {
    color: UI.gold,
    fontSize: 64,
    fontWeight: '900',
    letterSpacing: 8,
  },
  popText: { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: 4 },
  zoneText: {
    color: UI.gold,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 6,
  },
});
