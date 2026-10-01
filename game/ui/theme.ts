export const UI = {
  glass: 'rgba(14,5,36,0.78)',
  glassLight: 'rgba(255,255,255,0.10)',
  line: 'rgba(255,255,255,0.14)',
  text: '#ffffff',
  sub: '#b9a8e8',
  gold: '#ffd23f',
  pink: '#ff2d95',
  cyan: '#20e3ff',
  dark: '#120326',
};

export const glow = (color: string, radius = 14) => ({
  textShadowColor: color,
  textShadowRadius: radius,
  textShadowOffset: { width: 0, height: 0 },
});
