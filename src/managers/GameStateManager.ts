import { BuildingConfig, GamePhase } from '../types';
import { BLOCK, LAYOUT } from '../config';

export class GameStateManager {
  public currentBuildingIndex = 0;
  public wordsCompleted = 0;
  public phase: GamePhase = GamePhase.ShowingWord;

  private buildingConfigs: BuildingConfig[] = [
    {
      totalBlocks: 3,
      columns: 1,
      blockWidth: BLOCK.width,
      blockHeight: BLOCK.height,
      x: LAYOUT.buildingX,
      groundY: LAYOUT.groundY,
    },
    {
      totalBlocks: 6,
      columns: 2,
      blockWidth: BLOCK.width,
      blockHeight: BLOCK.height,
      x: LAYOUT.buildingX,
      groundY: LAYOUT.groundY,
    },
    {
      totalBlocks: 9,
      columns: 3,
      blockWidth: BLOCK.width,
      blockHeight: BLOCK.height,
      x: LAYOUT.buildingX,
      groundY: LAYOUT.groundY,
    },
  ];

  getBuildingConfig(): BuildingConfig {
    const index = Math.min(
      this.currentBuildingIndex,
      this.buildingConfigs.length - 1
    );
    return this.buildingConfigs[index];
  }

  advanceBuilding(): void {
    this.currentBuildingIndex++;
  }

  hasMoreBuildings(): boolean {
    return this.currentBuildingIndex < this.buildingConfigs.length;
  }

  reset(): void {
    this.currentBuildingIndex = 0;
    this.wordsCompleted = 0;
    this.phase = GamePhase.ShowingWord;
  }
}
