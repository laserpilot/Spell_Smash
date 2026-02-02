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
  { totalBlocks: 20, columns: 4, patternPool: ['stack', 'wall'] },
  { totalBlocks: 28, columns: 4, patternPool: ['tower', 'bridge', 'wall', 'span'] },
  { totalBlocks: 35, columns: 5, patternPool: ['tower', 'bridge', 'span', 'arch'] },
  { totalBlocks: 42, columns: 5, patternPool: ['tower', 'offset', 'castle', 'overhang', 'arch'] },
  { totalBlocks: 50, columns: 6, patternPool: ['offset', 'castle', 'overhang', 'span'] },
  { totalBlocks: 60, columns: 6, patternPool: ['stack', 'tower', 'offset', 'bridge', 'span', 'arch', 'castle', 'overhang', 'wall'] },
];

export class GameStateManager {
  public currentBuildingIndex = 0;
  public wordsCompleted = 0;
  public streak = 0;
  public bestStreak = 0;
  public perfectWords = 0;
  public totalWrongAttempts = 0;
  public currentWordMistakes = 0;
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
      pedestalHeight: LAYOUT.pedestalHeight,
    };
  }

  advanceBuilding(): void {
    this.currentBuildingIndex++;
  }

  hasMoreBuildings(): boolean {
    return this.currentBuildingIndex < runtimeConfig.sessionLength;
  }

  incrementStreak(): void {
    this.streak++;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
  }

  resetStreak(): void {
    this.streak = 0;
  }

  recordWrongAttempt(): void {
    this.totalWrongAttempts++;
    this.currentWordMistakes++;
  }

  recordWordComplete(): void {
    this.wordsCompleted++;
    if (this.currentWordMistakes === 0) {
      this.perfectWords++;
    }
    this.currentWordMistakes = 0;
  }

  getAccuracyPercent(): number {
    if (this.wordsCompleted === 0) return 0;
    return Math.round((this.perfectWords / this.wordsCompleted) * 100);
  }

  reset(): void {
    this.currentBuildingIndex = 0;
    this.wordsCompleted = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.perfectWords = 0;
    this.totalWrongAttempts = 0;
    this.currentWordMistakes = 0;
    this.phase = GamePhase.ShowingWord;
  }
}
