import Phaser from 'phaser';
import { BuildingConfig, BuildingPattern, GamePhase } from '../types';
import { LAYOUT } from '../config';
import { runtimeConfig } from '../RuntimeConfig';

interface BuildingLevel {
  totalBlocks: number;
  columns: number;
  patternPool: BuildingPattern[];
}

// 8 buildings of increasing difficulty
const BUILDING_LEVELS: BuildingLevel[] = [
  { totalBlocks: 10, columns: 3, patternPool: ['stack'] },
  { totalBlocks: 15, columns: 3, patternPool: ['stack'] },
  { totalBlocks: 20, columns: 4, patternPool: ['stack', 'pyramid'] },
  { totalBlocks: 28, columns: 4, patternPool: ['pyramid', 'tower'] },
  { totalBlocks: 35, columns: 5, patternPool: ['pyramid', 'tower'] },
  { totalBlocks: 42, columns: 5, patternPool: ['tower', 'offset'] },
  { totalBlocks: 50, columns: 6, patternPool: ['offset', 'pyramid'] },
  { totalBlocks: 60, columns: 6, patternPool: ['stack', 'pyramid', 'tower', 'offset'] },
];

export class GameStateManager {
  public currentBuildingIndex = 0;
  public wordsCompleted = 0;
  public streak = 0;
  public phase: GamePhase = GamePhase.ShowingWord;

  getBuildingConfig(): BuildingConfig {
    const levelIndex = Math.min(
      this.currentBuildingIndex,
      BUILDING_LEVELS.length - 1
    );
    const level = BUILDING_LEVELS[levelIndex];
    const pattern =
      level.patternPool[
        Phaser.Math.Between(0, level.patternPool.length - 1)
      ];

    return {
      totalBlocks: runtimeConfig.buildingBlockCount > 0
        ? runtimeConfig.buildingBlockCount
        : level.totalBlocks,
      columns: level.columns,
      blockWidth: runtimeConfig.blockWidth,
      blockHeight: runtimeConfig.blockHeight,
      x: LAYOUT.buildingX,
      groundY: LAYOUT.groundY,
      pattern,
    };
  }

  advanceBuilding(): void {
    this.currentBuildingIndex++;
  }

  hasMoreBuildings(): boolean {
    return this.currentBuildingIndex < BUILDING_LEVELS.length;
  }

  incrementStreak(): void {
    this.streak++;
  }

  resetStreak(): void {
    this.streak = 0;
  }

  reset(): void {
    this.currentBuildingIndex = 0;
    this.wordsCompleted = 0;
    this.streak = 0;
    this.phase = GamePhase.ShowingWord;
  }
}
