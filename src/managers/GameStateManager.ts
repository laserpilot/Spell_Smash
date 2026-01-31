import Phaser from 'phaser';
import { BuildingConfig, BuildingPattern, GamePhase } from '../types';
import { BLOCK, LAYOUT } from '../config';

interface BuildingLevel {
  totalBlocks: number;
  columns: number;
  patternPool: BuildingPattern[];
}

// 8 buildings of increasing difficulty
const BUILDING_LEVELS: BuildingLevel[] = [
  { totalBlocks: 3, columns: 1, patternPool: ['stack'] },
  { totalBlocks: 5, columns: 2, patternPool: ['stack'] },
  { totalBlocks: 8, columns: 3, patternPool: ['stack', 'pyramid'] },
  { totalBlocks: 10, columns: 3, patternPool: ['pyramid', 'tower'] },
  { totalBlocks: 12, columns: 3, patternPool: ['pyramid', 'tower'] },
  { totalBlocks: 14, columns: 4, patternPool: ['tower', 'offset'] },
  { totalBlocks: 16, columns: 4, patternPool: ['offset', 'pyramid'] },
  { totalBlocks: 20, columns: 5, patternPool: ['stack', 'pyramid', 'tower', 'offset'] },
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
      totalBlocks: level.totalBlocks,
      columns: level.columns,
      blockWidth: BLOCK.width,
      blockHeight: BLOCK.height,
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
