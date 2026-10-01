import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { UI, glow } from './theme';

const MIN_MS = 2600; // always show the intro at least this long
const MAX_MS = 9000; // never trap the player if loading stalls

/**
 * Animated intro shown while the game loads: a neon sun rises over the horizon,
 * light streaks sweep past, the logo slams in, and a bar fills up. When the
 * game is ready it fades out to reveal the menu.
 */
export default function Splash({
  ready,
  onDone,
}: {
  ready: boolean;
  onDone: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const sun = useRef(new Animated.Value(0)).current;
  const logo = useRef(new Animated.Value(0)).current;
  const sub = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const minDone = useRef(false);
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    Animated.timing(bar, {
      toValue: 1,
      duration: 250,
      useNativeDriver: false,
    }).start(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: 550,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(onDone);
    });
  };

  useEffect(() => {
    Animated.timing(sun, {
      toValue: 1,
      duration: 1500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    Animated.sequence([
      Animated.delay(450),
      Animated.spring(logo, {
        toValue: 1,
        speed: 7,
        bounciness: 12,
        useNativeDriver: true,
      }),
    ]).start();
    Animated.sequence([
      Animated.delay(1200),
      Animated.timing(sub, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
    Animated.timing(bar, {
      toValue: 0.88,
      duration: MIN_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    ).start();
    Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 1300,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
    const t1 = setTimeout(() => {
      minDone.current = true;
    }, MIN_MS);
    const t2 = setTimeout(finish, MAX_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // leave as soon as the game is ready and the minimum time has passed
  useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => {
      if (minDone.current) {
        clearInterval(id);
        finish();
      }
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const sunSize = width * 0.78;
  const sunY = sun.interpolate({
    inputRange: [0, 1],
    outputRange: [sunSize * 0.9, 0],
  });
  const nudge = logo.interpolate({
    inputRange: [0, 1],
    outputRange: [width, 0],
  });
  const nudgeRev = logo.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, 0],
  });
  const glowScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });
  const barW = bar.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });
  const STREAKS = [0.18, 0.34, 0.5, 0.66, 0.82];

  return (
    <Animated.View style={[styles.root, { opacity: fade }]}>
      {/* sun rising behind the horizon */}
      <Animated.View
        style={[
          styles.sun,
          {
            width: sunSize,
            height: sunSize,
            borderRadius: sunSize / 2,
            top: height * 0.3,
            left: (width - sunSize) / 2,
            transform: [{ translateY: sunY }, { scale: glowScale }],
          },
        ]}
      >
        {[0.58, 0.68, 0.78, 0.88].map((t, i) => (
          <View
            key={i}
            style={[styles.cut, { top: sunSize * t, height: 4 + i * 3 }]}
          />
        ))}
      </Animated.View>

      {/* horizon + road */}
      <View style={[styles.ground, { top: height * 0.3 + sunSize * 0.62 }]} />
      <View style={[styles.horizon, { top: height * 0.3 + sunSize * 0.62 }]} />

      {/* light streaks sweeping toward the viewer */}
      {STREAKS.map((p, i) => {
        const ty = sweep.interpolate({
          inputRange: [0, 1],
          outputRange: [0, height * 0.28],
        });
        const opacity = sweep.interpolate({
          inputRange: [0, 0.15, 1],
          outputRange: [0, 0.9, 0],
        });
        return (
          <Animated.View
            key={i}
            style={[
              styles.streak,
              {
                left: width * p,
                top: height * 0.3 + sunSize * 0.62 + 6,
                opacity,
                transform: [
                  { translateY: ty },
                  {
                    scaleY: sweep.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 2.2],
                    }),
                  },
                  { rotate: `${(p - 0.5) * 0.9}rad` },
                ],
              },
            ]}
          />
        );
      })}

      {/* logo */}
      <View style={[styles.logoBox, { top: height * 0.07 }]}>
        <Animated.Text
          style={[
            styles.neon,
            glow(UI.cyan, 22),
            { transform: [{ translateX: nudgeRev }] },
          ]}
        >
          NEON
        </Animated.Text>
        <Animated.Text
          style={[
            styles.rush,
            glow(UI.pink, 22),
            { transform: [{ translateX: nudge }] },
          ]}
        >
          RUSH
        </Animated.Text>
        <Animated.Text style={[styles.tag, { opacity: sub }]}>
          ENDLESS 3D RUNNER
        </Animated.Text>
      </View>

      {/* loading bar */}
      <View style={styles.footer}>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width: barW }]} />
        </View>
        <Animated.Text style={[styles.loading, { opacity: sub }]}>
          {ready ? 'READY' : 'LOADING'}
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0d0221',
    overflow: 'hidden',
  },
  sun: {
    position: 'absolute',
    backgroundColor: '#ff5e9c',
    shadowColor: '#ff2d95',
    shadowOpacity: 1,
    shadowRadius: 60,
    shadowOffset: { width: 0, height: 0 },
    elevation: 20,
    overflow: 'hidden',
  },
  cut: { position: 'absolute', left: 0, right: 0, backgroundColor: '#0d0221' },
  ground: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0d0221',
  },
  horizon: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: UI.pink,
    shadowColor: UI.pink,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  streak: {
    position: 'absolute',
    width: 3,
    height: 70,
    borderRadius: 2,
    backgroundColor: UI.cyan,
  },
  logoBox: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  neon: {
    color: UI.cyan,
    fontSize: 68,
    fontWeight: '900',
    letterSpacing: 10,
    lineHeight: 72,
  },
  rush: {
    color: UI.pink,
    fontSize: 68,
    fontWeight: '900',
    letterSpacing: 10,
    lineHeight: 72,
  },
  tag: {
    color: UI.sub,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 7,
    marginTop: 10,
  },
  footer: {
    position: 'absolute',
    left: 40,
    right: 40,
    bottom: 70,
    alignItems: 'center',
  },
  track: {
    alignSelf: 'stretch',
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: UI.cyan,
    shadowColor: UI.cyan,
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  loading: {
    color: UI.sub,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 6,
    marginTop: 12,
  },
});
