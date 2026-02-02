export type BuildingPattern = 'stack' | 'pyramid' | 'tower' | 'offset' | 'bridge' | 'castle';

export interface BuildingConfig {
  totalBlocks: number;
  columns: number;
  blockWidth: number;
  blockHeight: number;
  x: number;
  groundY: number;
  pattern: BuildingPattern;
  pedestalHeight: number;
}

export enum GamePhase {
  ShowingWord = 'SHOWING_WORD',
  WaitingForInput = 'WAITING_FOR_INPUT',
  Launching = 'LAUNCHING',
  WatchingImpact = 'WATCHING_IMPACT',
  LevelComplete = 'LEVEL_COMPLETE',
  TransitionToNext = 'TRANSITION_TO_NEXT',
  GameComplete = 'GAME_COMPLETE',
}

export enum CollisionCategory {
  Default = 0x0001,
  WordLetter = 0x0002,
  BuildingBlock = 0x0004,
  Ground = 0x0008,
  Rubble = 0x0010,
}
