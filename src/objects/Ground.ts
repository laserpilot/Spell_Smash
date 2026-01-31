import Phaser from 'phaser';
import { GAME_WIDTH, COLORS, LAYOUT } from '../config';
import { CollisionCategory } from '../types';

export class Ground {
  private body: MatterJS.BodyType;
  private visual: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    const groundThickness = 40;
    const groundCenterY = LAYOUT.groundY + groundThickness / 2;

    this.visual = scene.add.rectangle(
      GAME_WIDTH / 2,
      groundCenterY,
      GAME_WIDTH,
      groundThickness,
      COLORS.neutral
    );

    this.body = scene.matter.add.rectangle(
      GAME_WIDTH / 2,
      groundCenterY,
      GAME_WIDTH,
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
