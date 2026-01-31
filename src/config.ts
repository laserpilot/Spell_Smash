export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const COLORS = {
  background: 0xeaf4ff,
  primary: 0x2b3a67, // Navy
  secondary: 0x64c4b8, // Mint
  support: 0xd8836c, // Clay
  neutral: 0x556070, // Slate
  white: 0xffffff,
} as const;

export const COLOR_STRINGS = {
  background: '#EAF4FF',
  primary: '#2B3A67',
  secondary: '#64C4B8',
  support: '#D8836C',
  neutral: '#556070',
  white: '#FFFFFF',
} as const;

export const FONT_FAMILY = 'Fredoka';

export const PHYSICS = {
  gravity: { x: 0, y: 1 },
  wordDensity: 0.008,
  blockDensity: 0.01,
  blockFriction: 0.6,
  restitution: 0.3,
  launchVelocity: { x: 15, y: -2 },
  constraintStiffness: 0.9,
} as const;

export const LAYOUT = {
  groundY: 660,
  buildingX: 900,
  wordDisplayX: 300,
  wordDisplayY: 280,
  launchOriginX: 200,
  launchOriginY: 500,
  inputX: 60,
  inputY: 620,
  buildingHeightThreshold: 40,
} as const;

export const LETTER = {
  width: 40,
  height: 50,
  fontSize: 32,
  gap: 2,
} as const;

export const BLOCK = {
  width: 70,
  height: 35,
} as const;
