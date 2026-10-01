import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import GameScreen from './game/GameScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <GameScreen />
    </SafeAreaProvider>
  );
}
