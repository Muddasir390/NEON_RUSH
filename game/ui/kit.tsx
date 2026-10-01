import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { UI } from './theme';

/** Pressable that squishes when touched. */
export function PressScale({
  onPress,
  disabled,
  block,
  style,
  children,
}: {
  onPress?: () => void;
  disabled?: boolean;
  /** Stretch to the full width of the parent. */
  block?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const v = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      style={block ? kit.block : undefined}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() =>
        Animated.spring(v, {
          toValue: 0.93,
          speed: 50,
          bounciness: 0,
          useNativeDriver: true,
        }).start()
      }
      onPressOut={() =>
        Animated.spring(v, {
          toValue: 1,
          speed: 20,
          bounciness: 10,
          useNativeDriver: true,
        }).start()
      }
    >
      <Animated.View style={[style, { transform: [{ scale: v }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

/** Slowly pulsing wrapper, used to draw the eye to the main button. */
export function Pulse({ children }: { children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  return (
    <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
  );
}

/** Fades + slides its children in whenever `trigger` changes. */
export function SlideIn({
  trigger,
  style,
  children,
}: {
  trigger: unknown;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    v.setValue(0);
    Animated.timing(v, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [trigger, v]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v,
          transform: [
            {
              translateY: v.interpolate({
                inputRange: [0, 1],
                outputRange: [14, 0],
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

export function StatBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number; // 0..1
  color: string;
}) {
  const v = useRef(new Animated.Value(value)).current;
  useEffect(() => {
    Animated.spring(v, {
      toValue: value,
      speed: 14,
      bounciness: 6,
      useNativeDriver: false,
    }).start();
  }, [value, v]);
  return (
    <View style={kit.statRow}>
      <Text style={kit.statLabel}>{label}</Text>
      <View style={kit.statTrack}>
        <Animated.View
          style={[
            kit.statFill,
            {
              backgroundColor: color,
              shadowColor: color,
              width: v.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
}

export function CoinIcon({ size = 20 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: UI.gold,
        borderWidth: size * 0.12,
        borderColor: '#ff9f1a',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: size * 0.42,
          height: size * 0.42,
          borderRadius: size * 0.21,
          borderWidth: size * 0.09,
          borderColor: '#ffb020',
        }}
      />
    </View>
  );
}

export function PauseIcon({ color = '#fff' }: { color?: string }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      <View style={[kit.pauseBar, { backgroundColor: color }]} />
      <View style={[kit.pauseBar, { backgroundColor: color, marginLeft: 5 }]} />
    </View>
  );
}

export function Chevron({
  dir,
  color = '#fff',
}: {
  dir: 'left' | 'right';
  color?: string;
}) {
  return (
    <View
      style={{
        width: 16,
        height: 16,
        borderColor: color,
        borderTopWidth: 4,
        borderRightWidth: 4,
        borderRadius: 2,
        transform: [
          { rotate: dir === 'right' ? '45deg' : '225deg' },
          { translateX: dir === 'right' ? -3 : 3 },
        ],
      }}
    />
  );
}

export function PlayIcon({
  color = UI.dark,
  size = 18,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: 0,
        height: 0,
        borderTopWidth: size / 1.6,
        borderBottomWidth: size / 1.6,
        borderLeftWidth: size,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        borderLeftColor: color,
      }}
    />
  );
}

const kit = StyleSheet.create({
  block: { alignSelf: 'stretch' },
  statRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  statLabel: {
    width: 78,
    color: UI.sub,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  statTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  statFill: {
    height: 8,
    borderRadius: 4,
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  pauseBar: { width: 5, height: 18, borderRadius: 2 },
});
