import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { UI, glow } from './theme';

const HINTS = [
  { arrow: '←  →', text: 'SWIPE SIDEWAYS TO CHANGE LANE' },
  { arrow: '↑', text: 'SWIPE UP TO JUMP' },
  { arrow: '↓', text: 'SWIPE DOWN TO ROLL' },
];

/** Cycles through the swipe hints for the first few seconds of the first run. */
export default function Tutorial() {
  const v = useRef(new Animated.Value(0)).current;
  const [i, setI] = React.useState(0);
  useEffect(() => {
    const id = setInterval(() => setI(n => (n + 1) % HINTS.length), 1500);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    v.setValue(0);
    Animated.timing(v, {
      toValue: 1,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [i, v]);
  const h = HINTS[i];
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View
        style={{
          opacity: v,
          transform: [
            {
              scale: v.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1],
              }),
            },
          ],
        }}
      >
        <Text style={[styles.arrow, glow(UI.cyan, 20)]}>{h.arrow}</Text>
        <Text style={styles.text}>{h.text}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 200,
  },
  arrow: {
    color: '#fff',
    fontSize: 72,
    fontWeight: '900',
    textAlign: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 3,
    textAlign: 'center',
    marginTop: 6,
  },
});
