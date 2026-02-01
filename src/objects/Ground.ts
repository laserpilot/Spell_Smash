import Phaser from 'phaser';
import { GAME_WIDTH, COLORS, LAYOUT } from '../config';
import { CollisionCategory } from '../types';

export class Ground {
  private body: MatterJS.BodyType;
  private visual: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    const groundThickness = 40;
    const groundCenterY = LAYOUT.groundY + groundThickness / 2;

    // Visual stays fixed on screen (solid color, looks the same everywhere)
    this.visual = scene.add
      .rectangle(
        GAME_WIDTH / 2,
        groundCenterY,
        GAME_WIDTH,
        groundThickness,
        COLORS.neutral
      )
      .setScrollFactor(0);

    // Physics body wider to cover during camera scroll transitions
    this.body = scene.matter.add.rectangle(
      GAME_WIDTH,
      groundCenterY,
      GAME_WIDTH * 2,
      groundThickness,
      {
        isStatic: true,
        label: 'ground',
        collisionFilter: {
          category: CollisionCategory.Ground,
          mask:
            CollisionCategory.Default |
            CollisionCategory.WordLetter |
            CollisionCategory.BuildingBlock |
            CollisionCategory.Rubble,
        },
      }
    );
  }

  destroy(scene: Phaser.Scene): void {
    scene.matter.world.remove(this.body);
    this.visual.destroy();
  }
}
