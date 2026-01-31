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
  setVelocity(x: number, y: number): MatterRect;
  applyForce(force: Phaser.Math.Vector2): MatterRect;
  body: MatterJS.BodyType;
};

interface LetterBody {
  rect: MatterRect;
  text: Phaser.GameObjects.Text;
  pin: MatterJS.ConstraintType;
  anchor: MatterJS.BodyType;
}

export class WordProjectile {
  private scene: Phaser.Scene;
  private letters: LetterBody[] = [];
  private linkConstraints: MatterJS.ConstraintType[] = [];
  private launched = false;
  private shattered = false;
  private originX: number;
  private originY: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.originX = x;
    this.originY = y;
  }

  /** Calculate the x position for a letter at the given index, assuming maxLen total letters. */
  private letterX(index: number, totalSoFar: number): number {
    const totalWidth = totalSoFar * (LETTER.width + LETTER.gap) - LETTER.gap;
    const offsetX = this.originX - totalWidth / 2 + LETTER.width / 2;
    return offsetX + index * (LETTER.width + LETTER.gap);
  }

  /** Add a single letter to the projectile on the launch pad. */
  addLetter(char: string, index: number): void {
    const totalLetters = index + 1;
    const x = this.letterX(index, totalLetters);
    // Start slightly above pad so it drops into place
    const dropY = this.originY - 50;
    const targetY = this.originY;

    // Create visual rectangle as a dynamic physics body from the start
    const rawRect = this.scene.add
      .rectangle(x, dropY, LETTER.width, LETTER.height, COLORS.primary)
      .setDepth(4);

    const rect = this.scene.matter.add.gameObject(rawRect, {
      density: PHYSICS.wordDensity,
      friction: 0.5,
      restitution: 0.2,
      label: 'word_letter',
      // DYNAMIC from creation — avoids the mass=Infinity bug with isStatic:true
      isStatic: false,
      collisionFilter: {
        category: CollisionCategory.WordLetter,
        mask: CollisionCategory.BuildingBlock | CollisionCategory.Ground,
      },
    }) as MatterRect;

    const text = this.scene.add
      .text(x, dropY, char.toUpperCase(), {
        fontFamily: FONT_FAMILY,
        fontSize: `${LETTER.fontSize}px`,
        color: COLOR_STRINGS.white,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(5);

    // Pin this letter to its target position on the pad.
    // Phaser's constraint API doesn't accept null bodyB, so we create
    // a tiny invisible static body as the anchor point.
    const anchor = this.scene.matter.add.rectangle(x, targetY, 1, 1, {
      isStatic: true,
      label: 'pin_anchor',
      collisionFilter: { category: 0x0000, mask: 0x0000 },
    });

    const pin = this.scene.matter.add.constraint(
      rect.body as any,
      anchor as any,
      0,
      0.15, // soft stiffness so letters settle with a slight bounce
    );

    this.letters.push({ rect, text, pin, anchor });

    // Link to previous letter with a distance constraint
    if (this.letters.length > 1) {
      const prev = this.letters[this.letters.length - 2];
      const link = this.scene.matter.add.constraint(
        prev.rect.body as any,
        rect.body as any,
        LETTER.width + LETTER.gap,
        PHYSICS.constraintStiffness
      );
      this.linkConstraints.push(link);
    }

    // Re-center existing letters when a new one is added
    this.repositionPins(totalLetters);
  }

  /** Remove the last letter from the projectile (backspace). */
  removeLetter(): void {
    if (this.letters.length === 0) return;

    const removed = this.letters.pop()!;

    // Remove link constraint to this letter
    if (this.linkConstraints.length >= this.letters.length && this.linkConstraints.length > 0) {
      const link = this.linkConstraints.pop()!;
      this.scene.matter.world.removeConstraint(link);
    }

    // Remove pin + anchor + physics + visuals
    this.scene.matter.world.removeConstraint(removed.pin);
    this.scene.matter.world.remove(removed.anchor);
    this.scene.matter.world.remove(removed.rect.body);
    removed.rect.destroy();
    removed.text.destroy();

    // Re-center remaining letters
    if (this.letters.length > 0) {
      this.repositionPins(this.letters.length);
    }
  }

  /** Reposition anchor bodies so letters stay centered on the pad. */
  private repositionPins(totalLetters: number): void {
    for (let i = 0; i < this.letters.length; i++) {
      const x = this.letterX(i, totalLetters);
      const anchor = this.letters[i].anchor as any;
      // Move the static anchor body to the new position
      anchor.position.x = x;
      anchor.position.y = this.originY;
      anchor.positionPrev.x = x;
      anchor.positionPrev.y = this.originY;
    }
  }

  /** Launch all letters toward the building. */
  launch(): void {
    if (this.launched || this.letters.length === 0) return;
    this.launched = true;

    // Remove all pin constraints and anchors — letters are free
    for (const letter of this.letters) {
      this.scene.matter.world.removeConstraint(letter.pin);
      this.scene.matter.world.remove(letter.anchor);
    }

    // Apply launch velocity — bodies are already dynamic with proper mass
    for (const letter of this.letters) {
      letter.rect.setVelocity(PHYSICS.launchVelocity.x, PHYSICS.launchVelocity.y);
    }
  }

  /** Clear all letters (wrong answer). */
  clear(): void {
    // Remove link constraints
    for (const link of this.linkConstraints) {
      this.scene.matter.world.removeConstraint(link);
    }
    this.linkConstraints = [];

    // Remove pins/anchors and drop letters (they'll fall off screen)
    for (const letter of this.letters) {
      this.scene.matter.world.removeConstraint(letter.pin);
      this.scene.matter.world.remove(letter.anchor);
      // Apply a small random sideways force for visual effect
      letter.rect.applyForce(
        new Phaser.Math.Vector2(
          Phaser.Math.FloatBetween(-0.01, 0.01),
          0.01
        )
      );
      // Reclassify so they don't hit the building
      letter.rect.body.collisionFilter.category = CollisionCategory.Rubble;
    }

    // Clean up after they fall off screen (delayed)
    const lettersToClean = [...this.letters];
    this.letters = [];
    this.scene.time.delayedCall(1500, () => {
      for (const letter of lettersToClean) {
        this.scene.matter.world.remove(letter.rect.body);
        letter.rect.destroy();
        letter.text.destroy();
      }
    });
  }

  shatter(): void {
    if (this.shattered) return;
    this.shattered = true;

    // Remove all link constraints — letters fly free
    for (const link of this.linkConstraints) {
      this.scene.matter.world.removeConstraint(link);
    }
    this.linkConstraints = [];

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
    // Sync overlaid text to physics body positions
    for (const letter of this.letters) {
      letter.text.setPosition(letter.rect.x, letter.rect.y);
      letter.text.setRotation(letter.rect.rotation);
    }
  }

  destroy(): void {
    for (const link of this.linkConstraints) {
      this.scene.matter.world.removeConstraint(link);
    }
    for (const letter of this.letters) {
      this.scene.matter.world.removeConstraint(letter.pin);
      this.scene.matter.world.remove(letter.anchor);
      this.scene.matter.world.remove(letter.rect.body);
      letter.rect.destroy();
      letter.text.destroy();
    }
    this.letters = [];
    this.linkConstraints = [];
  }
}
