module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // three.js ships `static {}` class blocks
  plugins: ['@babel/plugin-transform-class-static-block'],
};
