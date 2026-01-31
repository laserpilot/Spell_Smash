import Phaser from 'phaser';
import {
  FONT_FAMILY,
  COLOR_STRINGS,
  COLORS,
  GAME_WIDTH,
  GAME_HEIGHT,
  LAYOUT,
} from '../config';
import { GamePhase } from '../types';
import { Ground } from '../objects/Ground';
import { Building } from '../objects/Building';
import { WordProjectile } from '../objects/WordProjectile';
import { WordManager } from '../managers/WordManager';
import { InputManager } from '../managers/InputManager';
import { GameStateManager } from '../managers/GameStateManager';

export class GameScene extends Phaser.Scene {
  private ground!: Ground;
  private building!: Building;
  private wordManager!: WordManager;
  private inputManager!: InputManager;
  private gameState!: GameStateManager;
  private activeProjectile: WordProjectile | null = null;
  private oldProjectiles: WordProjectile[] = [];

  private wordDisplayText!: Phaser.GameObjects.Text;
  private wordDisplayBg!: Phaser.GameObjects.Graphics;
  private feedbackText!: Phaser.GameObjects.Text;
  private buildingLabel!: Phaser.GameObjects.Text;
  private currentWord = '';
  private impactHandled = false;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Reset state for replays
    this.activeProjectile = null;
    this.oldProjectiles = [];
    this.impactHandled = false;

    // Managers
    this.gameState = new GameStateManager();
    this.wordManager = new WordManager();
    this.inputManager = new InputManager(this);
    this.inputManager.onSubmit = this.handleSubmit.bind(this);

    // Ground
    this.ground = new Ground(this);

    // Word display background
    this.wordDisplayBg = this.add.graphics().setDepth(8);
    this.wordDisplayBg.fillStyle(0xffffff, 0.7);
    this.wordDisplayBg.fillRoundedRect(
      LAYOUT.wordDisplayX - 130,
      LAYOUT.wordDisplayY - 45,
      260,
      90,
      16
    );

    // Word display text
    this.wordDisplayText = this.add
      .text(LAYOUT.wordDisplayX, LAYOUT.wordDisplayY, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '56px',
        color: COLOR_STRINGS.primary,
      })
      .setOrigin(0.5)
      .setDepth(10);

    // Feedback text
    this.feedbackText = this.add
      .text(LAYOUT.wordDisplayX, LAYOUT.wordDisplayY + 70, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '24px',
        color: COLOR_STRINGS.support,
      })
      .setOrigin(0.5)
      .setDepth(10);

    // Building counter
    this.buildingLabel = this.add
      .text(GAME_WIDTH - 120, 30, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        color: COLOR_STRINGS.neutral,
      })
      .setOrigin(0.5)
      .setDepth(10);

    // Collision detection
    this.matter.world.on(
      'collisionstart',
      (event: { pairs: { bodyA: MatterJS.BodyType; bodyB: MatterJS.BodyType }[] }) => {
        this.onCollision(event);
      }
    );

    // Start first building
    this.startNewBuilding();
  }

  private startNewBuilding(): void {
    if (this.building) {
      this.building.destroy();
    }
    this.cleanupProjectiles();

    const config = this.gameState.getBuildingConfig();
    this.building = new Building(this, config);

    this.buildingLabel.setText(
      `Building ${this.gameState.currentBuildingIndex + 1}`
    );

    this.presentNextWord();
  }

  private presentNextWord(): void {
    this.gameState.phase = GamePhase.ShowingWord;
    this.currentWord = this.wordManager.getNextWord();
    this.feedbackText.setText('');
    this.impactHandled = false;

    // Show word for 2 seconds
    this.wordDisplayText.setText(this.currentWord);
    this.wordDisplayText.setVisible(true);
    this.wordDisplayBg.setVisible(true);
    this.inputManager.disable();
    this.inputManager.clear();

    this.time.delayedCall(2000, () => {
      this.wordDisplayText.setVisible(false);
      this.wordDisplayBg.setVisible(false);
      this.gameState.phase = GamePhase.WaitingForInput;
      this.inputManager.enable();
    });
  }

  private handleSubmit(typedText: string): void {
    if (this.gameState.phase !== GamePhase.WaitingForInput) return;

    if (typedText.toLowerCase() === this.currentWord.toLowerCase()) {
      // Correct
      this.inputManager.disable();
      this.inputManager.clear();
      this.feedbackText.setText('');
      this.launchWord(typedText);
    } else {
      // Wrong
      this.feedbackText.setText('Try again!');
      this.inputManager.clear();

      // Fade out feedback
      this.time.delayedCall(1200, () => {
        if (this.feedbackText.text === 'Try again!') {
          this.feedbackText.setText('');
        }
      });
    }
  }

  private launchWord(word: string): void {
    this.gameState.phase = GamePhase.Launching;

    this.activeProjectile = new WordProjectile(
      this,
      word,
      LAYOUT.launchOriginX,
      LAYOUT.launchOriginY
    );

    // Brief pause to see the assembled word, then launch
    this.time.delayedCall(400, () => {
      if (this.activeProjectile) {
        this.activeProjectile.launch();
        this.gameState.phase = GamePhase.WatchingImpact;
      }
    });
  }

  private onCollision(event: {
    pairs: { bodyA: MatterJS.BodyType; bodyB: MatterJS.BodyType }[];
  }): void {
    if (this.gameState.phase !== GamePhase.WatchingImpact) return;
    if (this.impactHandled) return;

    for (const pair of event.pairs) {
      const { bodyA, bodyB } = pair;
      const isLetterA = bodyA.label === 'word_letter';
      const isLetterB = bodyB.label === 'word_letter';
      const isBlockA = bodyA.label === 'building_block';
      const isBlockB = bodyB.label === 'building_block';

      if ((isLetterA && isBlockB) || (isLetterB && isBlockA)) {
        this.impactHandled = true;
        this.handleImpact();
        return;
      }
    }
  }

  private handleImpact(): void {
    if (this.activeProjectile) {
      this.activeProjectile.shatter();
      // Move to old projectiles for later cleanup
      this.oldProjectiles.push(this.activeProjectile);
      this.activeProjectile = null;
    }

    this.gameState.wordsCompleted++;

    // Wait for physics to settle, then check building height
    this.time.delayedCall(1500, () => {
      this.checkBuildingStatus();
    });
  }

  private checkBuildingStatus(): void {
    if (this.building.isDestroyed(LAYOUT.buildingHeightThreshold)) {
      this.handleLevelComplete();
    } else {
      this.presentNextWord();
    }
  }

  private handleLevelComplete(): void {
    this.gameState.phase = GamePhase.LevelComplete;

    const completeText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, 'Level Complete!', {
        fontFamily: FONT_FAMILY,
        fontSize: '64px',
        color: COLOR_STRINGS.secondary,
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.time.delayedCall(2000, () => {
      completeText.destroy();
      this.gameState.advanceBuilding();

      if (this.gameState.hasMoreBuildings()) {
        this.startNewBuilding();
      } else {
        this.handleGameComplete();
      }
    });
  }

  private handleGameComplete(): void {
    const winText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'You Win!', {
        fontFamily: FONT_FAMILY,
        fontSize: '72px',
        color: COLOR_STRINGS.primary,
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.time.delayedCall(3000, () => {
      winText.destroy();
      this.cleanupAll();
      this.scene.start('MainMenuScene');
    });
  }

  private cleanupProjectiles(): void {
    if (this.activeProjectile) {
      this.activeProjectile.destroy();
      this.activeProjectile = null;
    }
    for (const proj of this.oldProjectiles) {
      proj.destroy();
    }
    this.oldProjectiles = [];
  }

  private cleanupAll(): void {
    this.cleanupProjectiles();
    if (this.building) {
      this.building.destroy();
    }
  }

  private removeOffScreenBodies(): void {
    // Clean up old projectiles that have fallen off screen
    this.oldProjectiles = this.oldProjectiles.filter((proj) => {
      // We can't easily check individual bodies from outside,
      // so we keep them until building transition
      return true;
    });
  }

  update(): void {
    if (this.building) {
      this.building.update();
    }
    if (this.activeProjectile) {
      this.activeProjectile.update();
    }
    for (const proj of this.oldProjectiles) {
      proj.update();
    }
  }
}
