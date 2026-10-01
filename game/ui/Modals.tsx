import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DAILY_REWARDS,
  ACHIEVEMENTS,
  AchStats,
  HEADSTART_COST,
  HOVERBOARD_COST,
  MISSION_LABEL,
  Mission,
  UPGRADES,
  UpgradeKey,
} from '../progress';
import type { SaveData } from '../save';
import { CoinIcon, PressScale } from './kit';
import { UI, glow } from './theme';

function Sheet({
  title,
  accent = UI.cyan,
  coins,
  onClose,
  children,
}: {
  title: string;
  accent?: string;
  coins?: number;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(v, {
      toValue: 1,
      speed: 14,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  }, [v]);
  return (
    <View style={styles.scrim}>
      <Animated.View
        style={[
          styles.sheet,
          {
            borderColor: accent,
            paddingTop: 18,
            paddingBottom: insets.bottom + 16,
            transform: [
              {
                translateY: v.interpolate({
                  inputRange: [0, 1],
                  outputRange: [500, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.head}>
          <Text style={[styles.title, glow(accent, 14)]}>{title}</Text>
          {coins !== undefined && (
            <View style={styles.wallet}>
              <CoinIcon size={18} />
              <Text style={styles.walletText}>{coins}</Text>
            </View>
          )}
          <Pressable style={styles.close} onPress={onClose} hitSlop={10}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>
        {children}
      </Animated.View>
    </View>
  );
}

export function StoreModal({
  coins,
  upgrades,
  headstarts,
  hoverboards,
  onBuy,
  onBuyHead,
  onBuyBoard,
  onClose,
}: {
  coins: number;
  upgrades: SaveData['upgrades'];
  headstarts: number;
  hoverboards: number;
  onBuy: (key: UpgradeKey) => void;
  onBuyHead: () => void;
  onBuyBoard: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet title="SHOP" coins={coins} onClose={onClose}>
      <ScrollView>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>HEAD START · OWNED {headstarts}</Text>
            <Text style={styles.rowSub}>
              Begin your next run flying above everything for 4 seconds
            </Text>
          </View>
          <PressScale
            disabled={coins < HEADSTART_COST}
            onPress={onBuyHead}
            style={[styles.buy, coins < HEADSTART_COST && { opacity: 0.4 }]}
          >
            <View style={styles.buyRow}>
              <CoinIcon size={16} />
              <Text style={styles.buyText}>{HEADSTART_COST}</Text>
            </View>
          </PressScale>
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>
              HOVERBOARD · OWNED {hoverboards}
            </Text>
            <Text style={styles.rowSub}>
              Survives one crash. Used at the start of a run
            </Text>
          </View>
          <PressScale
            disabled={coins < HOVERBOARD_COST}
            onPress={onBuyBoard}
            style={[styles.buy, coins < HOVERBOARD_COST && { opacity: 0.4 }]}
          >
            <View style={styles.buyRow}>
              <CoinIcon size={16} />
              <Text style={styles.buyText}>{HOVERBOARD_COST}</Text>
            </View>
          </PressScale>
        </View>
        {UPGRADES.map(u => {
          const lvl = upgrades[u.key];
          const maxed = lvl >= u.max;
          const cost = u.cost(lvl);
          const can = !maxed && coins >= cost;
          return (
            <View key={u.key} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{u.name}</Text>
                <Text style={styles.rowSub}>{u.desc}</Text>
                <View style={styles.pips}>
                  {Array.from({ length: u.max }).map((_, i) => (
                    <View
                      key={i}
                      style={[styles.pip, i < lvl && styles.pipOn]}
                    />
                  ))}
                </View>
              </View>
              <PressScale
                disabled={!can}
                onPress={() => onBuy(u.key)}
                style={[styles.buy, !can && { opacity: 0.4 }]}
              >
                {maxed ? (
                  <Text style={styles.buyText}>MAX</Text>
                ) : (
                  <View style={styles.buyRow}>
                    <CoinIcon size={16} />
                    <Text style={styles.buyText}>{cost}</Text>
                  </View>
                )}
              </PressScale>
            </View>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}

export function MissionsModal({
  missions,
  coins,
  onClaim,
  onClose,
}: {
  missions: Mission[];
  coins: number;
  onClaim: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Sheet title="MISSIONS" accent={UI.pink} coins={coins} onClose={onClose}>
      <Text style={styles.hint}>New missions every day</Text>
      {missions.map(m => {
        const done = m.progress >= m.target;
        const pct = Math.min(1, m.progress / m.target);
        return (
          <View key={m.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>
                {MISSION_LABEL[m.type](m.target)}
              </Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${pct * 100}%` }]} />
              </View>
              <Text style={styles.rowSub}>
                {Math.min(m.progress, m.target)} / {m.target}
              </Text>
            </View>
            <PressScale
              disabled={!done || m.claimed}
              onPress={() => onClaim(m.id)}
              style={[styles.buy, (!done || m.claimed) && { opacity: 0.4 }]}
            >
              {m.claimed ? (
                <Text style={styles.buyText}>DONE</Text>
              ) : (
                <View style={styles.buyRow}>
                  <CoinIcon size={16} />
                  <Text style={styles.buyText}>+{m.reward}</Text>
                </View>
              )}
            </PressScale>
          </View>
        );
      })}
    </Sheet>
  );
}

export function SettingsModal({
  settings,
  onChange,
  onClose,
}: {
  settings: SaveData['settings'];
  onChange: (next: SaveData['settings']) => void;
  onClose: () => void;
}) {
  const toggle = (k: 'sound' | 'music' | 'haptics') => (
    <Switch
      value={settings[k]}
      onValueChange={val => onChange({ ...settings, [k]: val })}
      trackColor={{ false: '#3a2a5a', true: UI.cyan }}
      thumbColor="#fff"
    />
  );
  const quality: SaveData['settings']['quality'][] = ['low', 'auto', 'high'];
  return (
    <Sheet title="SETTINGS" onClose={onClose}>
      <View style={styles.setRow}>
        <Text style={styles.rowTitle}>SOUND EFFECTS</Text>
        {toggle('sound')}
      </View>
      <View style={styles.setRow}>
        <Text style={styles.rowTitle}>MUSIC</Text>
        {toggle('music')}
      </View>
      <View style={styles.setRow}>
        <Text style={styles.rowTitle}>VIBRATION</Text>
        {toggle('haptics')}
      </View>
      <Text style={[styles.rowTitle, { marginTop: 10 }]}>GRAPHICS</Text>
      <View style={styles.seg}>
        {quality.map(q => (
          <Pressable
            key={q}
            style={[styles.segItem, settings.quality === q && styles.segOn]}
            onPress={() => onChange({ ...settings, quality: q })}
          >
            <Text
              style={[
                styles.segText,
                settings.quality === q && { color: UI.dark },
              ]}
            >
              {q.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>
        AUTO adjusts sharpness to keep the game smooth. Use LOW on slow phones.
      </Text>
    </Sheet>
  );
}

export function DailyModal({
  streak,
  onClaim,
}: {
  streak: number; // day index this claim will be (0-based)
  onClaim: () => void;
}) {
  return (
    <View style={styles.scrim}>
      <View style={[styles.dailyCard, { borderColor: UI.gold }]}>
        <Text style={[styles.dailyTitle, glow(UI.gold, 16)]}>DAILY REWARD</Text>
        <View style={styles.days}>
          {DAILY_REWARDS.map((r, i) => (
            <View
              key={i}
              style={[
                styles.day,
                i === streak && styles.dayNow,
                i < streak && { opacity: 0.45 },
              ]}
            >
              <Text style={styles.dayNum}>DAY {i + 1}</Text>
              <CoinIcon size={16} />
              <Text style={styles.dayAmt}>{r}</Text>
            </View>
          ))}
        </View>
        <PressScale
          block
          onPress={onClaim}
          style={[
            styles.claim,
            { backgroundColor: UI.gold, shadowColor: UI.gold },
          ]}
        >
          <Text style={styles.claimText}>CLAIM +{DAILY_REWARDS[streak]}</Text>
        </PressScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rowDone: { backgroundColor: 'rgba(255,210,63,0.10)' },
  badge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 12,
    backgroundColor: UI.glassLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: UI.sub, fontSize: 16, fontWeight: '900' },
  reward: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: UI.glassLight,
    borderRadius: 14,
    paddingHorizontal: 10,
    height: 28,
  },
  rewardText: {
    color: UI.gold,
    fontSize: 13,
    fontWeight: '900',
    marginLeft: 5,
  },
  dailyTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 4,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(8,2,22,0.72)',
  },
  sheet: {
    backgroundColor: 'rgba(16,6,40,0.98)',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderTopWidth: 2,
    paddingHorizontal: 20,
    maxHeight: '78%',
  },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  title: {
    flex: 1,
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 4,
  },
  wallet: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: UI.glassLight,
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 32,
    marginRight: 10,
  },
  walletText: {
    color: UI.gold,
    fontSize: 16,
    fontWeight: '900',
    marginLeft: 6,
  },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: UI.glassLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  hint: { color: UI.sub, fontSize: 12, marginTop: 6, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  rowTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  rowSub: { color: UI.sub, fontSize: 12, marginTop: 2 },
  pips: { flexDirection: 'row', marginTop: 8 },
  pip: {
    width: 26,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  pipOn: { backgroundColor: UI.cyan },
  track: {
    height: 8,
    borderRadius: 4,
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  fill: { height: 8, borderRadius: 4, backgroundColor: UI.pink },
  buy: {
    minWidth: 92,
    height: 42,
    borderRadius: 21,
    marginLeft: 12,
    backgroundColor: UI.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyRow: { flexDirection: 'row', alignItems: 'center' },
  buyText: {
    color: UI.dark,
    fontSize: 15,
    fontWeight: '900',
    marginLeft: 6,
    letterSpacing: 1,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: UI.line,
  },
  seg: {
    flexDirection: 'row',
    backgroundColor: UI.glassLight,
    borderRadius: 16,
    padding: 4,
    marginTop: 8,
  },
  segItem: {
    flex: 1,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segOn: { backgroundColor: UI.cyan },
  segText: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 2 },
  dailyCard: {
    alignSelf: 'center',
    marginBottom: '38%',
    width: '92%',
    backgroundColor: 'rgba(16,6,40,0.98)',
    borderRadius: 28,
    borderWidth: 2,
    padding: 20,
    alignItems: 'center',
  },
  days: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginVertical: 16,
  },
  day: {
    width: 74,
    margin: 4,
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: UI.glassLight,
  },
  dayNow: {
    backgroundColor: 'rgba(255,210,63,0.25)',
    borderWidth: 2,
    borderColor: UI.gold,
  },
  dayNum: {
    color: UI.sub,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  dayAmt: { color: UI.gold, fontSize: 14, fontWeight: '900', marginTop: 2 },
  claim: {
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.7,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  claimText: {
    color: UI.dark,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 3,
  },
});

export function GoalsModal({
  done,
  stats,
  coins,
  onClose,
}: {
  done: string[];
  stats: AchStats;
  coins: number;
  onClose: () => void;
}) {
  return (
    <Sheet title="GOALS" accent={UI.gold} coins={coins} onClose={onClose}>
      <Text style={styles.hint}>
        {done.length} / {ACHIEVEMENTS.length} completed · rewards are paid
        automatically
      </Text>
      <ScrollView>
        {ACHIEVEMENTS.map(a => {
          const ok = done.includes(a.id) || a.test(stats);
          return (
            <View key={a.id} style={[styles.row, ok && styles.rowDone]}>
              <View style={[styles.badge, ok && { backgroundColor: UI.gold }]}>
                <Text style={[styles.badgeText, ok && { color: UI.dark }]}>
                  {ok ? '✓' : '·'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{a.name}</Text>
                <Text style={styles.rowSub}>{a.desc}</Text>
              </View>
              <View style={styles.reward}>
                <CoinIcon size={14} />
                <Text style={styles.rewardText}>{a.reward}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}
