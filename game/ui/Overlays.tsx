import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { CharacterDef } from '../characters';
import { CoinIcon, PressScale } from './kit';
import { UI, glow } from './theme';

function Card({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent: string;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(v, {
      toValue: 1,
      speed: 12,
      bounciness: 9,
      useNativeDriver: true,
    }).start();
  }, [v]);
  return (
    <Animated.View
      style={[
        styles.card,
        {
          borderColor: accent,
          opacity: v,
          transform: [
            {
              scale: v.interpolate({
                inputRange: [0, 1],
                outputRange: [0.85, 1],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

function Button({
  label,
  onPress,
  color,
  ghost,
}: {
  label: string;
  onPress: () => void;
  color: string;
  ghost?: boolean;
}) {
  return (
    <PressScale
      block
      onPress={onPress}
      style={[
        styles.btn,
        ghost
          ? { borderColor: UI.line, borderWidth: 1.5 }
          : { backgroundColor: color, shadowColor: color },
      ]}
    >
      <Text style={[styles.btnText, ghost && { color: '#fff' }]}>{label}</Text>
    </PressScale>
  );
}

export function PauseMenu({
  hero,
  onResume,
  onRestart,
  onQuit,
}: {
  hero: CharacterDef;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}) {
  return (
    <View style={styles.scrim}>
      <Card accent={hero.accent}>
        <Text style={[styles.title, { color: '#fff' }, glow(hero.accent, 16)]}>
          PAUSED
        </Text>
        <Button label="RESUME" color={hero.accent} onPress={onResume} />
        <Button label="RESTART" color={hero.accent} ghost onPress={onRestart} />
        <Button
          label="QUIT TO MENU"
          color={hero.accent}
          ghost
          onPress={onQuit}
        />
      </Card>
    </View>
  );
}

export function GameOver({
  hero,
  score,
  coins,
  best,
  isNewBest,
  totalCoins,
  distance,
  onAgain,
  onMenu,
  reviveCost,
  canRevive,
  onRevive,
}: {
  hero: CharacterDef;
  score: number;
  coins: number;
  best: number;
  isNewBest: boolean;
  totalCoins: number;
  distance: number;
  onAgain: () => void;
  onMenu: () => void;
  /** Coins a revive costs; 0 hides the button. */
  reviveCost: number;
  canRevive: boolean;
  onRevive: () => void;
}) {
  // count the score up for a bit of drama
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => {
      const k = Math.min(1, (Date.now() - t0) / 900);
      setShown(Math.round(score * (1 - Math.pow(1 - k, 3))));
      if (k >= 1) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [score]);

  return (
    <View style={styles.scrim}>
      <Card accent={hero.accent}>
        <Text style={[styles.title, { color: UI.pink }, glow(UI.pink, 18)]}>
          CRASHED!
        </Text>
        <View style={[styles.heroChip, { borderColor: hero.accent }]}>
          <View style={[styles.heroDot, { backgroundColor: hero.accent }]}>
            <Text style={styles.heroDotText}>{hero.short}</Text>
          </View>
          <Text style={styles.runner}>{hero.name}</Text>
        </View>
        <Text style={styles.scoreLabel}>SCORE</Text>
        <Text style={styles.big}>{shown}</Text>
        {isNewBest ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>NEW BEST!</Text>
          </View>
        ) : (
          <Text style={styles.small}>BEST {best}</Text>
        )}
        <View style={styles.tiles}>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>DISTANCE</Text>
            <Text style={styles.tileValue}>{Math.floor(distance)} m</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>COINS</Text>
            <View style={styles.tileRow}>
              <CoinIcon size={16} />
              <Text style={[styles.tileValue, { color: UI.gold }]}>
                +{coins}
              </Text>
            </View>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>WALLET</Text>
            <Text style={[styles.tileValue, { color: UI.gold }]}>
              {totalCoins}
            </Text>
          </View>
        </View>
        {reviveCost > 0 && (
          <PressScale
            block
            disabled={!canRevive}
            onPress={onRevive}
            style={[
              styles.btn,
              styles.reviveBtn,
              !canRevive && { opacity: 0.4 },
            ]}
          >
            <Text style={[styles.btnText, { marginRight: 10 }]}>REVIVE</Text>
            <CoinIcon size={20} />
            <Text style={[styles.btnText, { paddingLeft: 6 }]}>
              {reviveCost}
            </Text>
          </PressScale>
        )}
        <Button
          label="PLAY AGAIN"
          color={hero.accent}
          ghost={reviveCost > 0}
          onPress={onAgain}
        />
        <Button
          label="CHANGE RUNNER"
          color={hero.accent}
          ghost
          onPress={onMenu}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 20,
    paddingRight: 14,
    paddingLeft: 4,
    height: 34,
    marginBottom: 4,
  },
  heroDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  heroDotText: { color: UI.dark, fontSize: 9, fontWeight: '900' },
  scoreLabel: {
    color: UI.sub,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 4,
  },
  tiles: { flexDirection: 'row', alignSelf: 'stretch', marginVertical: 14 },
  tile: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingVertical: 8,
    marginHorizontal: 3,
  },
  tileLabel: {
    color: UI.sub,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
  },
  tileRow: { flexDirection: 'row', alignItems: 'center' },
  tileValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 3,
    marginLeft: 4,
  },
  reviveBtn: {
    backgroundColor: UI.gold,
    shadowColor: UI.gold,
    flexDirection: 'row',
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,2,22,0.6)',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    backgroundColor: 'rgba(16,6,40,0.94)',
    borderRadius: 28,
    borderWidth: 2,
    paddingHorizontal: 24,
    paddingVertical: 26,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 6,
    paddingLeft: 6,
    marginBottom: 6,
  },
  runner: { color: UI.sub, fontSize: 13, fontWeight: '800', letterSpacing: 5 },
  big: { color: '#fff', fontSize: 78, fontWeight: '900', marginVertical: 2 },
  small: { color: UI.sub, fontSize: 13, fontWeight: '800', letterSpacing: 3 },
  badge: {
    backgroundColor: UI.gold,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  badgeText: {
    color: UI.dark,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 3,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 18,
  },
  stat: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18 },
  statNum: { color: UI.gold, fontSize: 22, fontWeight: '900', marginLeft: 8 },
  divider: { width: 1.5, height: 26, backgroundColor: UI.line },
  btn: {
    alignSelf: 'stretch',
    height: 54,
    borderRadius: 27,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.7,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  btnText: {
    color: UI.dark,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 3,
    paddingLeft: 3,
    textAlign: 'center',
  },
});
