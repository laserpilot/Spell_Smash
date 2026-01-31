import Phaser from 'phaser';
import {
  FONT_FAMILY,
  COLOR_STRINGS,
  PHYSICS,
  LETTER,
  COLORS,
} from '../config';
import { CollisionCategory } from '../types';

// Phaser's matter.add.gameObject() mixes physics methods onto the game object.
// TypeScript doesn't know about these, so we define the shape we use.
type MatterRect = Phaser.GameObjects.Rectangle & {
  setStatic(isStatic: boolean): MatterRect;
  setVelocity(x: number, y: number): MatterRect;
  applyForce(force: Phaser.Math.Vector2): MatterRect;
  body: MatterJS.BodyType;
};

interface LetterBody {
  rect: MatterRect;
  text: Phaser.GameObjects.Text;
}

export class WordProjectile {
  private scene: Phaser.Scene;
  private word: string;
  private letters: LetterBody[] = [];
  private constraints: MatterJS.ConstraintType[] = [];
  private launched = false;
  private shattered = false;

  constructor(scene: Phaser.Scene, word: string, x: number, y: number) {
    this.scene = scene;
    this.word = word;
    this.create(x, y);
  }

  private create(startX: number, startY: number): void {
    const chars = this.word.split('');
    const totalWidth = chars.length * (LETTER.width + LETTER.gap) - LETTER.gap;
    const offsetX = startX - totalWidth / 2 + LETTER.width / 2;

    chars.forEach((char, i) => {
      const x = offsetX + i * (LETTER.width + LETTER.gap);
      const y = startY;

      // Create visual rectangle, then wrap it with Matter physics
      const rawRect = this.scene.add
        .rectangle(x, y, LETTER.width, LETTER.height, COLORS.primary)
        .setDepth(4);

      const rect = this.scene.matter.add.gameObject(rawRect, {
        density: PHYSICS.wordDensity,
        friction: 0.5,
        restitution: 0.2,
        label: 'word_letter',
        isStatic: true,
        collisionFilter: {
          category: CollisionCategory.WordLetter,
          mask: CollisionCategory.BuildingBlock | CollisionCategory.Ground,
        },
      }) as MatterRect;

      const text = this.scene.add
        .text(x, y, char.toUpperCase(), {
          fontFamily: FONT_FAMILY,
          fontSize: `${LETTER.fontSize}px`,
          color: COLOR_STRINGS.white,
          align: 'center',
        })
        .setOrigin(0.5)
        .setDepth(5);

      this.letters.push({ rect, text });
    });

    // Connect adjacent letters with constraints
    for (let i = 0; i < this.letters.length - 1; i++) {
      const constraint = this.scene.matter.add.constraint(
        this.letters[i].rect.body as any,
        this.letters[i + 1].rect.body as any,
        LETTER.width + LETTER.gap,
        PHYSICS.constraintStiffness
      );
      this.constraints.push(constraint);
    }
  }

  launch(): void {
    if (this.launched) return;
    this.launched = true;

    for (const letter of this.letters) {
      letter.rect.setStatic(false);
      letter.rect.setVelocity(PHYSICS.launchVelocity.x, PHYSICS.launchVelocity.y);
    }
  }

  shatter(): void {
    if (this.shattered) return;
    this.shattered = true;

    // Remove all constraints — letters fly free
    for (const constraint of this.constraints) {
      this.scene.matter.world.removeConstraint(constraint);
    }
    this.constraints = [];

    // Apply scatter forces and reclassify as rubble
    for (const letter of this.letters) {
      letter.rect.applyForce(
        new Phaser.Math.Vector2(
          Phaser.Math.FloatBetween(-0.02, 0.02),
          Phaser.Math.FloatBetween(-0.03, 0)
        )
      );
      letter.rect.body.collisionFilter.category = CollisionCategory.Rubble;
    }
  }

  update(): void {
    // Phaser Matter game objects auto-sync the rect visual to the body.
    // We only need to sync the overlaid text.
    for (const letter of this.letters) {
      letter.text.setPosition(letter.rect.x, letter.rect.y);
      letter.text.setRotation(letter.rect.rotation);
    }
  }

  destroy(): void {
    for (const constraint of this.constraints) {
      this.scene.matter.world.removeConstraint(constraint);
    }
    for (const letter of this.letters) {
      this.scene.matter.world.remove(letter.rect.body);
      letter.rect.destroy();
      letter.text.destroy();
    }
    this.letters = [];
    this.constraints = [];
  }
}
