export const DPR = window.devicePixelRatio || 1;
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
  gravity: { x: 0, y: 0.5 },
  wordDensity: 0.008,
  blockDensity: 0.004,
  blockFriction: 0.5,
  restitution: 0.4,
  launchVelocity: { x: 12, y: -14 },
  constraintStiffness: 0.9,
  missTimeoutMs: 3000,
} as const;

export const LAYOUT = {
  groundY: 660,
  buildingX: 880,
  wordDisplayX: 300,
  wordDisplayY: 280,
  launchOriginX: 180,
  launchOriginY: 550,
  launchPadWidth: 320,
  launchPadHeight: 60,
  inputX: 60,
  inputY: 620,
  buildingHeightThreshold: 50,
  pedestalHeight: 80,
} as const;

export const LETTER = {
  width: 40,
  height: 50,
  fontSize: 32,
  gap: 2,
} as const;

export const BLOCK = {
  width: 50,
  height: 25,
} as const;
