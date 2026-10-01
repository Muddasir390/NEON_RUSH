/**
 * @format
 */

import { AppRegistry, LogBox } from 'react-native';
import { name as appName } from './app.json';

// Known, harmless dev warnings from three.js / expo-gl. They fire while the app
// modules load, so this must run before App is required. Hiding them also keeps
// the dev-only warning bar from covering the game's buttons.
LogBox.ignoreLogs([
  'THREE.Clock',
  'THREE.WebGLRenderer: WEBGL_lose_context',
  'process.env.EXPO_OS',
  'EXGL: gl.pixelStorei()',
]);

const App = require('./App').default;

AppRegistry.registerComponent(appName, () => App);
