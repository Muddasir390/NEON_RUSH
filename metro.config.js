const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/**
 * Metro configuration (Expo's config so expo-gl / R3F resolve correctly)
 * https://docs.expo.dev/guides/customizing-metro/
 */
const config = getDefaultConfig(__dirname);

// three's CommonJS build calls process.emitWarning (missing in RN), so
// always resolve the bare `three` import to the ES module build.
const upstreamResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'node_modules/three/build/three.module.js'),
    };
  }
  return (upstreamResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
