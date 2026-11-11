/** Color sets for buildings. Each new building uses the next theme. */
export interface BuildingTheme {
  /** Wall block colors, cycled diagonally across the building. */
  blocks: number[];
  /** Roof (triangle) color. */
  roof: number;
}

export const BUILDING_THEMES: BuildingTheme[] = [
  { blocks: [0x64c4b8, 0xe08a6e, 0x34467e], roof: 0xd8645a }, // mint / clay / navy
  { blocks: [0xf4a259, 0xf6d36b, 0x5b8e7d], roof: 0xbc4b51 }, // sunny
  { blocks: [0x7aa6d8, 0xf2f0e6, 0x3d5a80], roof: 0xee6c4d }, // harbor
  { blocks: [0xc779a4, 0xf2b5a0, 0x6d597a], roof: 0x4f3b5a }, // berry
  { blocks: [0x8fc47c, 0xe9c46a, 0x2a7f72], roof: 0xd1603d }, // garden
  { blocks: [0xe76f51, 0xf4c095, 0x5c4d7d], roof: 0x2b3a67 }, // sunset
];

export function getTheme(index: number): BuildingTheme {
  return BUILDING_THEMES[((index % BUILDING_THEMES.length) + BUILDING_THEMES.length) % BUILDING_THEMES.length];
}

/** Window glass colors. */
export const GLASS = {
  lit: 0xfff1b8,
  dark: 0xcfe3f2,
  frame: 0xffffff,
} as const;

/** Scenery colors. */
export const SCENE = {
  skyTop: 0x8fcbf0,
  skyMid: 0xc9e7fa,
  skyHorizon: 0xfff0d9,
  sun: 0xfff3b0,
  sunGlow: 0xffe08a,
  skyline: 0xb7cbe6,
  skylineWindow: 0xd3e1f2,
  hillsFar: 0xb4dba8,
  hillsNear: 0x93cc85,
  treeTrunk: 0x8a6a4f,
  treeLeaf: 0x6fb565,
  grass: 0x7cc46b,
  grassDark: 0x5ea552,
  soil: 0xc59a6a,
  soilDark: 0xa27a50,
  pebble: 0xe0c49b,
  stone: 0xc9c2b6,
  stoneLight: 0xe2ddd3,
  stoneDark: 0xa29a8d,
  wood: 0xc98b55,
  woodDark: 0x8d5a35,
  woodLight: 0xe0a970,
} as const;
