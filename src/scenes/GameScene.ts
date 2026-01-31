import Phaser from 'phaser';
import {
  FONT_FAMILY,
  COLOR_STRINGS,
  COLORS,
  GAME_WIDTH,
  GAME_HEIGHT,
  LAYOUT,
  PHYSICS,
} from '../config';
import { GamePhase } from '../types';
import { Ground } from '../objects/Ground';
import { Building } from '../objects/Building';
import { WordProjectile } from '../objects/WordProjectile';
import { WordManager } from '../managers/WordManager';
import { InputManager } from '../managers/InputManager';
import { GameStateManager } from '../managers/GameStateManager';
import { AudioManager } from '../managers/AudioManager';

export class GameScene extends Phaser.Scene {
  private ground!: Ground;
  private building!: Building;
  private wordManager!: WordManager;
  private inputManager!: InputManager;
  private gameState!: GameStateManager;
  private audioManager!: AudioManager;
  private activeProjectile: WordProjectile | null = null;
  private oldProjectiles: WordProjectile[] = [];

  private wordDisplayText!: Phaser.GameObjects.Text;
  private wordDisplayBg!: Phaser.GameObjects.Graphics;
  private feedbackText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private buildingLabel!: Phaser.GameObjects.Text;
  private streakLabel!: Phaser.GameObjects.Text;
  private streakCountText!: Phaser.GameObjects.Text;
  private hearAgainBtn!: Phaser.GameObjects.Container;
  private restartBtn!: Phaser.GameObjects.Container;
  private currentWord = '';
  private impactHandled = false;
  private wrongAttempts = 0;
  private usedBackspace = false;
  private missTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Reset state
    this.activeProjectile = null;
    this.oldProjectiles = [];
    this.impactHandled = false;
    this.wrongAttempts = 0;
    this.usedBackspace = false;
    this.missTimer = null;

    // Managers
    this.gameState = new GameStateManager();
    this.wordManager = new WordManager();
    this.inputManager = new InputManager(this);
    this.inputManager.onSubmit = this.handleSubmit.bind(this);
    this.inputManager.onBackspace = () => {
      this.usedBackspace = true;
    };
    this.audioManager = new AudioManager();

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

    // Hint text (ghosted first letter)
    this.hintText = this.add
      .text(LAYOUT.wordDisplayX, LAYOUT.wordDisplayY, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '56px',
        color: COLOR_STRINGS.neutral,
      })
      .setOrigin(0.5)
      .setAlpha(0.3)
      .setDepth(9);

    // Building counter
    this.buildingLabel = this.add
      .text(GAME_WIDTH - 120, 30, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        color: COLOR_STRINGS.neutral,
      })
      .setOrigin(0.5)
      .setDepth(10);

    // Streak counter
    this.streakLabel = this.add
      .text(30, 30, 'Streak', {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        color: COLOR_STRINGS.neutral,
      })
      .setOrigin(0, 0.5)
      .setDepth(10);

    this.streakCountText = this.add
      .text(30, 55, '0', {
        fontFamily: FONT_FAMILY,
        fontSize: '32px',
        color: COLOR_STRINGS.secondary,
      })
      .setOrigin(0, 0.5)
      .setDepth(10);

    // Hear Again button
    this.hearAgainBtn = this.createHearAgainButton();

    // Restart button (top-right corner)
    this.restartBtn = this.createRestartButton();

    // Collision detection
    this.matter.world.on(
      'collisionstart',
      (event: {
        pairs: { bodyA: MatterJS.BodyType; bodyB: MatterJS.BodyType }[];
      }) => {
        this.onCollision(event);
      }
    );

    // Start first building
    this.startNewBuilding();
  }

  private createHearAgainButton(): Phaser.GameObjects.Container {
    const btnX = LAYOUT.wordDisplayX;
    const btnY = LAYOUT.wordDisplayY + 120;
    const width = 180;
    const height = 44;

    const bg = this.add.graphics();
    bg.fillStyle(COLORS.neutral, 0.15);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 10);
    bg.lineStyle(1, COLORS.neutral, 0.3);
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 10);

    const label = this.add
      .text(0, 0, 'Hear Again', {
        fontFamily: FONT_FAMILY,
        fontSize: '20px',
        color: COLOR_STRINGS.neutral,
      })
      .setOrigin(0.5);

    const container = this.add
      .container(btnX, btnY, [bg, label])
      .setDepth(10)
      .setSize(width, height)
      .setInteractive({ useHandCursor: true });

    container.on('pointerdown', () => {
      this.handleHearAgain();
    });

    container.setVisible(false);
    return container;
  }

  private createRestartButton(): Phaser.GameObjects.Container {
    const btnX = GAME_WIDTH - 60;
    const btnY = 70;
    const width = 100;
    const height = 36;

    const bg = this.add.graphics();
    bg.fillStyle(COLORS.support, 0.2);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 8);
    bg.lineStyle(1, COLORS.support, 0.4);
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 8);

    const label = this.add
      .text(0, 0, 'Restart', {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        color: COLOR_STRINGS.support,
      })
      .setOrigin(0.5);

    const container = this.add
      .container(btnX, btnY, [bg, label])
      .setDepth(10)
      .setSize(width, height)
      .setInteractive({ useHandCursor: true });

    container.on('pointerdown', () => {
      this.cleanupAll();
      this.scene.restart();
    });

    return container;
  }

  private handleHearAgain(): void {
    if (this.gameState.phase !== GamePhase.WaitingForInput) return;

    this.audioManager.speakWord(this.currentWord);

    this.wordDisplayText.setText(this.currentWord);
    this.wordDisplayText.setVisible(true);
    this.wordDisplayBg.setVisible(true);
    this.hintText.setVisible(false);

    this.time.delayedCall(800, () => {
      if (this.gameState.phase === GamePhase.WaitingForInput) {
        this.wordDisplayText.setVisible(false);
        this.wordDisplayBg.setVisible(false);
        if (this.wrongAttempts > 0) {
          this.hintText.setVisible(true);
        }
      }
    });
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
    const difficulty = this.wordManager.getDifficultyForBuilding(
      this.gameState.currentBuildingIndex
    );
    this.currentWord = this.wordManager.getNextWord(difficulty);
    this.feedbackText.setText('');
    this.hintText.setVisible(false);
    this.hintText.setText('');
    this.impactHandled = false;
    this.wrongAttempts = 0;
    this.usedBackspace = false;

    // Show word and speak it
    this.wordDisplayText.setText(this.currentWord);
    this.wordDisplayText.setVisible(true);
    this.wordDisplayBg.setVisible(true);
    this.hearAgainBtn.setVisible(false);
    this.inputManager.disable();
    this.inputManager.clear();

    this.audioManager.speakWord(this.currentWord);

    this.time.delayedCall(2000, () => {
      this.wordDisplayText.setVisible(false);
      this.wordDisplayBg.setVisible(false);
      this.gameState.phase = GamePhase.WaitingForInput;
      this.inputManager.enable();
      this.hearAgainBtn.setVisible(true);
    });
  }

  private handleSubmit(typedText: string): void {
    if (this.gameState.phase !== GamePhase.WaitingForInput) return;

    if (typedText.toLowerCase() === this.currentWord.toLowerCase()) {
      if (!this.usedBackspace && this.wrongAttempts === 0) {
        this.gameState.incrementStreak();
      } else {
        this.gameState.resetStreak();
      }
      this.updateStreakDisplay();

      this.inputManager.disable();
      this.inputManager.clear();
      this.feedbackText.setText('');
      this.hintText.setVisible(false);
      this.hearAgainBtn.setVisible(false);
      this.launchWord(typedText);
    } else {
      this.wrongAttempts++;
      this.feedbackText.setText('Try again!');
      this.inputManager.clear();

      if (this.wrongAttempts >= 1) {
        this.hintText.setText(this.currentWord[0]);
        this.hintText.setVisible(true);
        this.wordDisplayBg.setVisible(true);
      }

      this.time.delayedCall(1200, () => {
        if (this.feedbackText.text === 'Try again!') {
          this.feedbackText.setText('');
        }
      });
    }
  }

  private updateStreakDisplay(): void {
    this.streakCountText.setText(String(this.gameState.streak));

    if (this.gameState.streak >= 3) {
      this.streakCountText.setColor('#FFD700');
      this.tweens.add({
        targets: this.streakCountText,
        scaleX: 1.3,
        scaleY: 1.3,
        duration: 150,
        yoyo: true,
      });
    } else {
      this.streakCountText.setColor(COLOR_STRINGS.secondary);
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

    this.time.delayedCall(400, () => {
      if (this.activeProjectile) {
        this.activeProjectile.launch();
        this.gameState.phase = GamePhase.WatchingImpact;

        // Miss timeout — if no collision detected, advance anyway
        this.missTimer = this.time.delayedCall(
          PHYSICS.missTimeoutMs,
          () => {
            if (
              this.gameState.phase === GamePhase.WatchingImpact &&
              !this.impactHandled
            ) {
              this.handleMiss();
            }
          }
        );
      }
    });
  }

  private handleMiss(): void {
    // Word missed the building — clean up and move on
    if (this.activeProjectile) {
      this.oldProjectiles.push(this.activeProjectile);
      this.activeProjectile = null;
    }
    this.presentNextWord();
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
        // Cancel miss timer since we hit the building
        if (this.missTimer) {
          this.missTimer.destroy();
          this.missTimer = null;
        }
        this.handleImpact();
        return;
      }
    }
  }

  private handleImpact(): void {
    if (this.activeProjectile) {
      this.activeProjectile.shatter();
      this.oldProjectiles.push(this.activeProjectile);
      this.activeProjectile = null;
    }

    this.gameState.wordsCompleted++;

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
        this.transitionToNextBuilding();
      } else {
        this.handleGameComplete();
      }
    });
  }

  private transitionToNextBuilding(): void {
    this.gameState.phase = GamePhase.TransitionToNext;

    this.cameras.main.fade(400, 234, 244, 255);

    this.time.delayedCall(400, () => {
      this.cleanupProjectiles();
      if (this.building) {
        this.building.destroy();
      }

      const config = this.gameState.getBuildingConfig();
      this.building = new Building(this, config);
      this.buildingLabel.setText(
        `Building ${this.gameState.currentBuildingIndex + 1}`
      );

      this.cameras.main.fadeIn(400, 234, 244, 255);

      this.time.delayedCall(500, () => {
        this.presentNextWord();
      });
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

    const statsText = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 70,
        `Words spelled: ${this.gameState.wordsCompleted}`,
        {
          fontFamily: FONT_FAMILY,
          fontSize: '28px',
          color: COLOR_STRINGS.neutral,
        }
      )
      .setOrigin(0.5)
      .setDepth(20);

    this.time.delayedCall(4000, () => {
      winText.destroy();
      statsText.destroy();
      this.cleanupAll();
      this.scene.start('MainMenuScene');
    });
  }

  private cleanupProjectiles(): void {
    if (this.missTimer) {
      this.missTimer.destroy();
      this.missTimer = null;
    }
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
    this.audioManager.cancel();
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
