import Phaser from 'phaser';
import { GAME_WIDTH, LAYOUT } from '../config';
import { CollisionCategory } from '../types';

/** Static floor collider. The visible ground is drawn by Scenery. */
export class Ground {
  private body: MatterJS.BodyType;

  constructor(scene: Phaser.Scene) {
    const groundThickness = 40;
    const groundCenterY = LAYOUT.groundY + groundThickness / 2;

    // Wider than the screen to cover camera scroll transitions
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
  }
}
