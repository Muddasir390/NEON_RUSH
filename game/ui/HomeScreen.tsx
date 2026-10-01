import React, { useEffect, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CHARACTERS } from '../characters';
import { Chevron, CoinIcon, PlayIcon, PressScale, Pulse, SlideIn } from './kit';
import { UI, glow } from './theme';

const CARD = 84;
const GAP = 10;

const PERKS: { label: string; key: 'agility' | 'jump' | 'magnet' | 'score' }[] =
  [
    { label: 'AGILITY', key: 'agility' },
    { label: 'JUMP', key: 'jump' },
    { label: 'MAGNET', key: 'magnet' },
    { label: 'SCORE', key: 'score' },
  ];
/** Map a 0.7..1.4 multiplier onto 1..5 filled segments. */
const level = (v: number) =>
  Math.max(1, Math.min(5, Math.ceil(((v - 0.6) / 0.8) * 5)));

type MenuKey = 'store' | 'missions' | 'settings' | 'goals';

type Props = {
  index: number;
  loading: boolean;
  best: number;
  coins: number;
  onStep: (dir: number) => void;
  onSelect: (i: number) => void;
  onPlay: () => void;
  unlocked: string[];
  onUnlock: () => void;
  onOpen: (m: MenuKey) => void;
  alerts: Partial<Record<MenuKey, boolean>>;
};

function Segments({ value, color }: { value: number; color: string }) {
  const n = level(value);
  return (
    <View style={styles.segs}>
      {[1, 2, 3, 4, 5].map(i => (
        <View
          key={i}
          style={[
            styles.seg,
            i <= n && { backgroundColor: color, shadowColor: color },
          ]}
        />
      ))}
    </View>
  );
}

export default function HomeScreen({
  index,
  loading,
  best,
  coins,
  onStep,
  onSelect,
  onPlay,
  unlocked,
  onUnlock,
  onOpen,
  alerts,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scroll = useRef<ScrollView>(null);
  const hero = CHARACTERS[index];
  const locked = !unlocked.includes(hero.id);
  const canBuy = coins >= hero.price;

  useEffect(() => {
    const x = index * (CARD + GAP) - (width - 40 - CARD) / 2;
    scroll.current?.scrollTo({ x: Math.max(0, x), animated: true });
  }, [index, width]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* wallet + best */}
      <View
        style={[styles.top, { paddingTop: insets.top + 10 }]}
        pointerEvents="none"
      >
        <View style={styles.pill}>
          <CoinIcon size={20} />
          <Text style={styles.pillText}>{coins}</Text>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillLabel}>BEST</Text>
          <Text style={styles.pillText}>{best}</Text>
        </View>
      </View>

      {/* menu buttons */}
      <View style={[styles.menu, { top: insets.top + 58 }]}>
        {(
          [
            ['missions', 'MISSIONS'],
            ['goals', 'GOALS'],
            ['store', 'SHOP'],
            ['settings', 'SETTINGS'],
          ] as const
        ).map(([key, label]) => (
          <PressScale
            key={key}
            onPress={() => onOpen(key)}
            style={styles.menuBtn}
          >
            <Text style={styles.menuText}>{label}</Text>
            {alerts[key] && <View style={styles.dot} />}
          </PressScale>
        ))}
      </View>

      {/* logo */}
      <View
        style={[styles.logoWrap, { top: insets.top + 100 }]}
        pointerEvents="none"
      >
        <Text style={styles.logo}>
          NEON <Text style={styles.logoAlt}>RUSH</Text>
        </Text>
        <Text style={styles.logoSub}>CHOOSE YOUR RUNNER</Text>
      </View>

      {/* browse arrows */}
      <Pressable
        style={[styles.arrow, styles.arrowL]}
        onPress={() => onStep(-1)}
      >
        <Chevron dir="left" />
      </Pressable>
      <Pressable
        style={[styles.arrow, styles.arrowR]}
        onPress={() => onStep(1)}
      >
        <Chevron dir="right" />
      </Pressable>

      {/* bottom sheet */}
      <View
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + 14, borderTopColor: hero.accent },
        ]}
      >
        <SlideIn trigger={hero.id}>
          <View style={styles.headRow}>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.name,
                  { color: hero.accent },
                  glow(hero.accent, 18),
                ]}
              >
                {hero.name}
              </Text>
              <Text style={styles.tag}>
                {loading ? 'Loading…' : hero.tagline}
              </Text>
            </View>
            <View style={[styles.role, { borderColor: hero.accent }]}>
              <Text style={[styles.roleText, { color: hero.accent }]}>
                {hero.role}
              </Text>
            </View>
          </View>

          <View style={[styles.passive, { borderColor: hero.accent }]}>
            <Text style={[styles.star, { color: hero.accent }]}>★</Text>
            <Text style={styles.passiveText}>{hero.passive}</Text>
          </View>

          <View style={styles.grid}>
            {PERKS.map(p => (
              <View key={p.key} style={styles.gridItem}>
                <View style={styles.gridHead}>
                  <Text style={styles.statLabel}>{p.label}</Text>
                  <Text style={styles.statVal}>
                    {Math.round(hero.perks[p.key] * 100)}%
                  </Text>
                </View>
                <Segments value={hero.perks[p.key]} color={hero.accent} />
              </View>
            ))}
          </View>
        </SlideIn>

        <ScrollView
          ref={scroll}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.cards}
          contentContainerStyle={styles.cardsContent}
        >
          {CHARACTERS.map((c, i) => {
            const on = i === index;
            const owned = unlocked.includes(c.id);
            return (
              <PressScale
                key={c.id}
                onPress={() => onSelect(i)}
                style={[
                  styles.card,
                  { borderColor: on ? c.accent : UI.line },
                  on && {
                    backgroundColor: 'rgba(255,255,255,0.10)',
                    shadowColor: c.accent,
                    shadowOpacity: 0.9,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: 8,
                  },
                ]}
              >
                <View
                  style={[
                    styles.avatar,
                    { borderColor: c.accent },
                    on && owned && { backgroundColor: c.accent },
                    !owned && styles.avatarLocked,
                  ]}
                >
                  <Text
                    style={[
                      styles.avatarText,
                      on && owned && { color: UI.dark },
                    ]}
                  >
                    {owned ? c.short : '🔒'}
                  </Text>
                </View>
                <Text
                  style={[styles.cardName, on && { color: '#fff' }]}
                  numberOfLines={1}
                >
                  {c.name}
                </Text>
                {owned ? (
                  <Text style={styles.owned}>{on ? 'SELECTED' : 'OWNED'}</Text>
                ) : (
                  <View style={styles.price}>
                    <CoinIcon size={12} />
                    <Text style={styles.priceNum}>{c.price}</Text>
                  </View>
                )}
              </PressScale>
            );
          })}
        </ScrollView>

        <Pulse>
          <PressScale
            block
            disabled={loading || (locked && !canBuy)}
            onPress={locked ? onUnlock : onPlay}
            style={[
              styles.play,
              { backgroundColor: hero.accent, shadowColor: hero.accent },
              (loading || (locked && !canBuy)) && { opacity: 0.5 },
            ]}
          >
            {loading ? (
              <Text style={styles.playText}>LOADING</Text>
            ) : locked ? (
              <View style={styles.row}>
                <Text style={styles.playText}>
                  {canBuy ? 'UNLOCK' : `NEED ${hero.price - coins} MORE`}
                </Text>
                {canBuy && <CoinIcon size={22} />}
                {canBuy && (
                  <Text style={[styles.playText, styles.priceText]}>
                    {hero.price}
                  </Text>
                )}
              </View>
            ) : (
              <View style={styles.row}>
                <Text style={styles.playText}>PLAY</Text>
                <PlayIcon />
              </View>
            )}
          </PressScale>
        </Pulse>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: UI.glass,
    borderColor: UI.line,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    height: 40,
  },
  pillLabel: {
    color: UI.sub,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginRight: 8,
  },
  pillText: { color: '#fff', fontSize: 18, fontWeight: '900', marginLeft: 8 },
  menu: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  menuBtn: {
    backgroundColor: UI.glass,
    borderColor: UI.line,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    height: 32,
    marginHorizontal: 3,
    justifyContent: 'center',
  },
  menuText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  dot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: UI.pink,
    borderWidth: 2,
    borderColor: '#120326',
  },
  logoWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  logo: {
    color: UI.cyan,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 6,
    ...glow(UI.cyan, 18),
  },
  logoAlt: { color: UI.pink, ...glow(UI.pink, 18) },
  logoSub: {
    color: UI.sub,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 6,
    marginTop: 2,
  },
  arrow: {
    position: 'absolute',
    top: '28%',
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: UI.glass,
    borderColor: UI.line,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowL: { left: 12 },
  arrowR: { right: 12 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 14,
    paddingHorizontal: 20,
    backgroundColor: UI.glass,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderTopWidth: 2,
  },
  headRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 32, fontWeight: '900', letterSpacing: 5 },
  tag: { color: '#dccbff', fontSize: 13, marginTop: 1 },
  role: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  roleText: { fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  passive: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 10,
  },
  star: { fontSize: 14, marginRight: 8 },
  passiveText: { flex: 1, color: '#fff', fontSize: 12, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  gridItem: { width: '50%', paddingRight: 12, paddingVertical: 4 },
  gridHead: { flexDirection: 'row', justifyContent: 'space-between' },
  statLabel: {
    color: UI.sub,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  statVal: { color: '#fff', fontSize: 10, fontWeight: '900' },
  segs: { flexDirection: 'row', marginTop: 4 },
  seg: {
    flex: 1,
    height: 7,
    borderRadius: 3,
    marginRight: 4,
    backgroundColor: 'rgba(255,255,255,0.14)',
    shadowOpacity: 0.9,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  cards: { flexGrow: 0, marginVertical: 12, marginHorizontal: -20 },
  cardsContent: { paddingHorizontal: 20, paddingVertical: 6 },
  card: {
    width: CARD,
    marginRight: GAP,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLocked: { opacity: 0.55, backgroundColor: 'rgba(0,0,0,0.35)' },
  avatarText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  cardName: {
    color: UI.sub,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 5,
  },
  owned: {
    color: UI.sub,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginTop: 3,
  },
  price: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,210,63,0.14)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginTop: 3,
  },
  priceNum: { color: UI.gold, fontSize: 10, fontWeight: '900', marginLeft: 4 },
  play: {
    height: 62,
    borderRadius: 31,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.9,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  playText: {
    color: UI.dark,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 5,
    marginRight: 7,
  },
  priceText: { marginLeft: 8, marginRight: 0 },
});
