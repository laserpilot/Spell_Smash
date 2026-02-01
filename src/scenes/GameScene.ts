import Phaser from 'phaser';
import {
  DPR,
  FONT_FAMILY,
  COLOR_STRINGS,
  COLORS,
  GAME_WIDTH,
  GAME_HEIGHT,
  LAYOUT,
  PHYSICS,
} from '../config';
import { GamePhase } from '../types';
import { runtimeConfig } from '../RuntimeConfig';
import { Ground } from '../objects/Ground';
import { Building } from '../objects/Building';
import { WordProjectile } from '../objects/WordProjectile';
import { WordManager } from '../managers/WordManager';
import { InputManager } from '../managers/InputManager';
import { GameStateManager } from '../managers/GameStateManager';
import { AudioManager } from '../managers/AudioManager';
import { DebugPanel } from '../debug/DebugPanel';
import { SfxManager } from '../managers/SfxManager';

export class GameScene extends Phaser.Scene {
  private ground!: Ground;
  private building!: Building;
  private wordManager!: WordManager;
  private inputManager!: InputManager;
  private gameState!: GameStateManager;
  private audioManager!: AudioManager;
  private activeProjectile: WordProjectile | null = null;
  private oldProjectiles: WordProjectile[] = [];
  private oldBuilding: Building | null = null;

  private wordDisplayText!: Phaser.GameObjects.Text;
  private wordDisplayBg!: Phaser.GameObjects.Graphics;
  private feedbackText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private buildingLabel!: Phaser.GameObjects.Text;
  private streakLabel!: Phaser.GameObjects.Text;
  private streakCountText!: Phaser.GameObjects.Text;
  private hearAgainBtn!: Phaser.GameObjects.Container;
  private restartBtn!: Phaser.GameObjects.Container;
  private launchPadGfx!: Phaser.GameObjects.Graphics;
  private impactEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private trailEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private confettiEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private debugPanel!: DebugPanel;
  private clouds: Phaser.GameObjects.Ellipse[] = [];
  private thresholdLineGfx!: Phaser.GameObjects.Graphics;
  private percentText!: Phaser.GameObjects.Text;
  private originalBuildingHeight = 0;
  private hasHadImpact = false;
  private thresholdCrossed = false;
  private currentWord = '';
  private impactHandled = false;
  private wrongAttempts = 0;
  private usedBackspace = false;
  private missTimer: Phaser.Time.TimerEvent | null = null;
  private sweepGfx!: Phaser.GameObjects.Graphics;
  private sweepAngle = 20;
  private sfx!: SfxManager;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Reset state
    this.activeProjectile = null;
    this.oldProjectiles = [];
    this.impactHandled = false;
    this.hasHadImpact = false;
    this.thresholdCrossed = false;
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
    this.inputManager.onKeyTyped = (key: string, index: number) => {
      this.handleKeyTyped(key, index);
    };
    this.inputManager.onKeyDeleted = (_index: number) => {
      this.handleKeyDeleted();
    };
    this.audioManager = new AudioManager();
    this.sfx = new SfxManager();

    // Background clouds
    this.clouds = [];
    for (let i = 0; i < 5; i++) {
      const cx = Phaser.Math.Between(100, GAME_WIDTH - 100);
      const cy = Phaser.Math.Between(60, 220);
      const cloud = this.add
        .ellipse(
          cx,
          cy,
          Phaser.Math.Between(80, 160),
          Phaser.Math.Between(30, 50),
          0xffffff,
          0.6
        )
        .setDepth(0)
        .setScrollFactor(0.3);
      this.clouds.push(cloud);
    }

    // Ground
    this.ground = new Ground(this);

    // Launch pad visual
    this.launchPadGfx = this.add.graphics().setDepth(3);
    this.drawLaunchPad();

    // Angle sweep indicator (drawn each frame in update)
    this.sweepGfx = this.add.graphics().setDepth(3).setScrollFactor(0);

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
        resolution: DPR,
      })
      .setOrigin(0.5)
      .setDepth(10);

    // Feedback text
    this.feedbackText = this.add
      .text(LAYOUT.wordDisplayX, LAYOUT.wordDisplayY + 70, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '24px',
        color: COLOR_STRINGS.support,
        resolution: DPR,
      })
      .setOrigin(0.5)
      .setDepth(10);

    // Hint text (ghosted first letter)
    this.hintText = this.add
      .text(LAYOUT.wordDisplayX, LAYOUT.wordDisplayY, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '56px',
        color: COLOR_STRINGS.neutral,
        resolution: DPR,
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
        resolution: DPR,
      })
      .setOrigin(0.5)
      .setDepth(10);

    // Streak counter
    this.streakLabel = this.add
      .text(30, 30, 'Streak', {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        color: COLOR_STRINGS.neutral,
        resolution: DPR,
      })
      .setOrigin(0, 0.5)
      .setDepth(10);

    this.streakCountText = this.add
      .text(30, 55, '0', {
        fontFamily: FONT_FAMILY,
        fontSize: '32px',
        color: COLOR_STRINGS.secondary,
        resolution: DPR,
      })
      .setOrigin(0, 0.5)
      .setDepth(10);

    // Hear Again button
    this.hearAgainBtn = this.createHearAgainButton();

    // Restart button (top-right corner)
    this.restartBtn = this.createRestartButton();

    // HUD elements: fixed to camera (don't scroll with the world)
    this.launchPadGfx.setScrollFactor(0);
    this.wordDisplayBg.setScrollFactor(0);
    this.wordDisplayText.setScrollFactor(0);
    this.feedbackText.setScrollFactor(0);
    this.hintText.setScrollFactor(0);
    this.buildingLabel.setScrollFactor(0);
    this.streakLabel.setScrollFactor(0);
    this.streakCountText.setScrollFactor(0);
    this.hearAgainBtn.setScrollFactor(0);
    this.restartBtn.setScrollFactor(0);

    // Particle emitters (inactive until triggered)
    this.impactEmitter = this.add.particles(0, 0, 'particle', {
      speed: { min: 50, max: 200 },
      angle: { min: 200, max: 340 },
      scale: { start: 1, end: 0 },
      lifespan: { min: 300, max: 600 },
      gravityY: 300,
      tint: [COLORS.neutral, COLORS.support, COLORS.secondary],
      emitting: false,
    });
    this.impactEmitter.setDepth(15);

    this.trailEmitter = this.add.particles(0, 0, 'particle', {
      speed: { min: 10, max: 40 },
      scale: { start: 0.5, end: 0 },
      lifespan: { min: 200, max: 400 },
      alpha: { start: 0.6, end: 0 },
      tint: COLORS.primary,
      emitting: false,
    });
    this.trailEmitter.setDepth(3);

    this.confettiEmitter = this.add.particles(0, 0, 'particle', {
      speed: { min: 100, max: 350 },
      angle: { min: 220, max: 320 },
      scale: { start: 1.5, end: 0 },
      lifespan: { min: 800, max: 1500 },
      gravityY: 200,
      tint: [0xff6b6b, 0xffd93d, 0x6bcb77, 0x4d96ff, COLORS.support],
      emitting: false,
    });
    this.confettiEmitter.setDepth(25);

    // Threshold line graphic (drawn when building is created)
    this.thresholdLineGfx = this.add.graphics().setDepth(2);

    // Destruction percentage text (near threshold line)
    this.percentText = this.add
      .text(0, 0, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        color: COLOR_STRINGS.support,
        resolution: DPR,
      })
      .setOrigin(0, 0.5)
      .setDepth(10);

    // Debug panel (toggle with backtick key)
    this.debugPanel = new DebugPanel(() => this.rebuildCurrentBuilding());

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

  private drawLaunchPad(): void {
    this.launchPadGfx.clear();
    const padW = LAYOUT.launchPadWidth;
    const padH = LAYOUT.launchPadHeight;
    const padX = LAYOUT.launchOriginX - padW / 2;
    const padY = LAYOUT.launchOriginY - padH / 2 + 10; // slightly below letter center

    // Shallow bowl / platform shape
    this.launchPadGfx.fillStyle(COLORS.neutral, 0.1);
    this.launchPadGfx.fillRoundedRect(padX, padY, padW, padH, 12);
    this.launchPadGfx.lineStyle(2, COLORS.neutral, 0.25);
    this.launchPadGfx.strokeRoundedRect(padX, padY, padW, padH, 12);
  }

  private drawSweepIndicator(): void {
    this.sweepGfx.clear();
    const ox = LAYOUT.launchOriginX;
    const oy = LAYOUT.launchOriginY;
    const lineLen = 120;

    // Faded arc showing full sweep range (5°–25°)
    this.sweepGfx.lineStyle(2, COLORS.neutral, 0.2);
    this.sweepGfx.beginPath();
    for (let deg = 5; deg <= 25; deg += 1) {
      const r = deg * (Math.PI / 180);
      const ax = ox + Math.cos(r) * lineLen;
      const ay = oy - Math.sin(r) * lineLen;
      if (deg === 5) {
        this.sweepGfx.moveTo(ax, ay);
      } else {
        this.sweepGfx.lineTo(ax, ay);
      }
    }
    this.sweepGfx.strokePath();

    // Current angle aim line
    const rad = this.sweepAngle * (Math.PI / 180);
    const endX = ox + Math.cos(rad) * lineLen;
    const endY = oy - Math.sin(rad) * lineLen;

    this.sweepGfx.lineStyle(3, COLORS.secondary, 0.7);
    this.sweepGfx.beginPath();
    this.sweepGfx.moveTo(ox, oy);
    this.sweepGfx.lineTo(endX, endY);
    this.sweepGfx.strokePath();

    // Dot at the end of the aim line
    this.sweepGfx.fillStyle(COLORS.secondary, 0.8);
    this.sweepGfx.fillCircle(endX, endY, 5);
  }

  private drawThresholdLine(height?: number, centerX?: number): void {
    const h = height ?? this.originalBuildingHeight;
    const cx = centerX ?? LAYOUT.buildingX;
    const thresholdHeight = h * 0.4;
    const lineY = LAYOUT.groundY - thresholdHeight;

    // Dashed red line across the building area
    this.thresholdLineGfx.lineStyle(2, 0xff4444, 0.5);
    const dashLen = 10;
    const gapLen = 8;
    const startX = cx - 200;
    const endX = cx + 200;

    this.thresholdLineGfx.beginPath();
    for (let x = startX; x < endX; x += dashLen + gapLen) {
      this.thresholdLineGfx.moveTo(x, lineY);
      this.thresholdLineGfx.lineTo(Math.min(x + dashLen, endX), lineY);
    }
    this.thresholdLineGfx.strokePath();
  }

  private playThresholdFireworks(): void {
    // 3 bursts across the building area
    const positions = [
      LAYOUT.buildingX - 100,
      LAYOUT.buildingX,
      LAYOUT.buildingX + 100,
    ];
    const burstY = LAYOUT.groundY - this.originalBuildingHeight * 0.4;

    for (let i = 0; i < positions.length; i++) {
      this.time.delayedCall(i * 150, () => {
        this.confettiEmitter.emitParticleAt(positions[i], burstY, 8);
      });
    }

    this.sfx.thresholdCross();

    // Brief white camera flash (30% opacity)
    this.cameras.main.flash(200, 255, 255, 200);

    // Pulse the threshold line
    this.tweens.add({
      targets: this.thresholdLineGfx,
      alpha: 0.2,
      duration: 150,
      yoyo: true,
      repeat: 2,
    });
  }

  private updateDestructionPercent(): void {
    if (!this.building || !this.hasHadImpact) return;
    const currentHeight = this.building.getCurrentHeight();
    // Progress toward win: 0% = full building, 100% = at or below threshold line
    const aboveThreshold = this.originalBuildingHeight * 0.6; // destroyable portion
    const knocked = this.originalBuildingHeight - currentHeight;
    const percent = Math.min(100, Math.max(0, Math.round((knocked / aboveThreshold) * 100)));
    this.percentText.setText(`${percent}%`);
    const lineY = LAYOUT.groundY - this.originalBuildingHeight * 0.4;
    this.percentText.setPosition(LAYOUT.buildingX + 160, lineY);
  }

  private rebuildCurrentBuilding(): void {
    if (this.building) {
      this.building.destroy();
    }
    const config = this.gameState.getBuildingConfig();
    this.building = new Building(this, config);
    this.originalBuildingHeight = this.building.getInitialHeight();
    this.thresholdLineGfx.clear();
    this.drawThresholdLine();
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
        resolution: DPR,
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
        resolution: DPR,
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
    this.originalBuildingHeight = this.building.getInitialHeight();
    this.hasHadImpact = false;
    this.thresholdCrossed = false;
    this.percentText.setText('');
    this.thresholdLineGfx.clear();
    this.drawThresholdLine();

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

    // Create empty projectile on the launch pad (letters added per-keystroke)
    if (this.activeProjectile) {
      this.activeProjectile.destroy();
    }
    this.activeProjectile = new WordProjectile(
      this,
      LAYOUT.launchOriginX,
      LAYOUT.launchOriginY
    );
    this.launchPadGfx.setVisible(true);

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

  private handleKeyTyped(key: string, index: number): void {
    if (this.gameState.phase !== GamePhase.WaitingForInput) return;
    if (!this.activeProjectile) return;

    this.sfx.typeLetter();
    this.activeProjectile.addLetter(key, index);
  }

  private handleKeyDeleted(): void {
    if (this.gameState.phase !== GamePhase.WaitingForInput) return;
    if (!this.activeProjectile) return;

    this.activeProjectile.removeLetter();
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
      this.launchPadGfx.setVisible(false);

      // Launch the projectile directly — letters are already on the pad
      this.gameState.phase = GamePhase.Launching;
      if (this.activeProjectile) {
        // Accuracy bonus: no backspace and no wrong attempts = on fire
        if (!this.usedBackspace && this.wrongAttempts === 0) {
          if (this.gameState.streak >= 3) {
            this.activeProjectile.setSuper();
          } else {
            this.activeProjectile.setOnFire();
          }
        }
        // Lock the sweep angle at the moment of submission
        runtimeConfig.launchAngle = this.sweepAngle;
        this.sfx.launch();
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
    } else {
      this.wrongAttempts++;
      this.sfx.error();
      this.feedbackText.setText('Try again!');
      this.inputManager.clear();

      // Clear letters from the pad (they tumble off)
      if (this.activeProjectile) {
        this.activeProjectile.clear();
        // Create a fresh projectile for the retry
        this.activeProjectile = new WordProjectile(
          this,
          LAYOUT.launchOriginX,
          LAYOUT.launchOriginY
        );
      }

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

  /** Push a projectile to oldProjectiles and auto-destroy it after 4 seconds. */
  private retireProjectile(proj: WordProjectile): void {
    this.oldProjectiles.push(proj);
    this.time.delayedCall(4000, () => {
      const idx = this.oldProjectiles.indexOf(proj);
      if (idx !== -1) {
        this.oldProjectiles.splice(idx, 1);
        proj.destroy();
      }
    });
  }

  private handleMiss(): void {
    // Word missed the building — clean up and move on
    if (this.activeProjectile) {
      this.retireProjectile(this.activeProjectile);
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
        // Use the block body position as impact point
        const block = isBlockA ? bodyA : bodyB;
        this.handleImpact(block.position.x, block.position.y);
        return;
      }
    }
  }

  private handleImpact(impactX: number, impactY: number): void {
    this.hasHadImpact = true;
    let isSuper = false;
    let isOnFire = false;

    if (this.activeProjectile) {
      isSuper = this.activeProjectile.isSuper;
      isOnFire = this.activeProjectile.isOnFire;
      this.activeProjectile.shatter();
      this.retireProjectile(this.activeProjectile);
      this.activeProjectile = null;
    }

    // Impact SFX
    if (isSuper || isOnFire) {
      this.sfx.impactBig();
    } else {
      this.sfx.impactSmall();
    }

    // Screen shake — stronger for powered-up projectiles
    if (isSuper) {
      this.cameras.main.shake(300, 0.015);
    } else if (isOnFire) {
      this.cameras.main.shake(200, 0.01);
    } else {
      this.cameras.main.shake(150, 0.005);
    }

    // Dust/debris particles at impact point
    const particleCount = isSuper ? 30 : isOnFire ? 20 : 12;
    this.impactEmitter.emitParticleAt(impactX, impactY, particleCount);

    this.gameState.wordsCompleted++;

    this.time.delayedCall(2500, () => {
      this.checkBuildingStatus();
    });
  }

  private checkBuildingStatus(): void {
    // If threshold was already crossed (by update() loop), skip — that handler will finish the job
    if (
      this.thresholdCrossed ||
      this.gameState.phase === GamePhase.LevelComplete ||
      this.gameState.phase === GamePhase.TransitionToNext
    )
      return;

    // Win when remaining height is below 40% of the original
    const threshold = this.originalBuildingHeight * 0.4;
    if (this.building.getCurrentHeight() < threshold) {
      this.handleBuildingDestroyed();
    } else {
      this.presentNextWord();
    }
  }

  private handleBuildingDestroyed(): void {
    // Guard against double invocation from checkBuildingStatus + update() threshold detection
    if (
      this.gameState.phase === GamePhase.LevelComplete ||
      this.gameState.phase === GamePhase.TransitionToNext
    )
      return;

    this.gameState.phase = GamePhase.LevelComplete;
    this.gameState.advanceBuilding();

    if (this.gameState.hasMoreBuildings()) {
      // Modest fanfare for intermediate buildings
      this.playDestructionFanfare();
      this.time.delayedCall(1200, () => {
        this.transitionToNextBuilding();
      });
    } else {
      // Full celebration for game completion
      this.handleLevelComplete();
    }
  }

  private playDestructionFanfare(): void {
    // Small confetti bursts at building area
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(i * 100, () => {
        const cx = LAYOUT.buildingX + Phaser.Math.Between(-80, 80);
        this.confettiEmitter.emitParticleAt(cx, LAYOUT.groundY - 100, 6);
      });
    }

    // Random encouraging text
    const phrases = ['Nice!', 'Onward!', 'Boom!', 'Yes!'];
    const phrase = phrases[Phaser.Math.Between(0, phrases.length - 1)];

    const fanfareText = this.add
      .text(LAYOUT.buildingX, LAYOUT.groundY - 150, phrase, {
        fontFamily: FONT_FAMILY,
        fontSize: '32px',
        color: COLOR_STRINGS.support,
        resolution: DPR,
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setScale(0);

    this.tweens.add({
      targets: fanfareText,
      scaleX: 1,
      scaleY: 1,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: fanfareText,
          alpha: 0,
          y: fanfareText.y - 30,
          duration: 500,
          delay: 300,
          onComplete: () => fanfareText.destroy(),
        });
      },
    });
  }

  private handleLevelComplete(): void {
    this.sfx.victory();
    // Full celebration for game completion
    // Confetti burst from multiple points
    for (let i = 0; i < 5; i++) {
      this.time.delayedCall(i * 100, () => {
        const cx = Phaser.Math.Between(200, GAME_WIDTH - 200);
        this.confettiEmitter.emitParticleAt(cx, GAME_HEIGHT * 0.3, 15);
      });
    }

    // Camera zoom pulse
    this.cameras.main.zoomTo(1.05, 200, 'Sine.easeInOut', false, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
      if (progress === 1) {
        this.cameras.main.zoomTo(1, 300, 'Sine.easeInOut');
      }
    });

    const completeText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, 'Level Complete!', {
        fontFamily: FONT_FAMILY,
        fontSize: '64px',
        color: COLOR_STRINGS.secondary,
        resolution: DPR,
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setScale(0);

    // Bounce-in animation for text
    this.tweens.add({
      targets: completeText,
      scaleX: 1,
      scaleY: 1,
      duration: 400,
      ease: 'Back.easeOut',
    });

    this.time.delayedCall(2000, () => {
      completeText.destroy();
      this.handleGameComplete();
    });
  }

  private transitionToNextBuilding(): void {
    this.gameState.phase = GamePhase.TransitionToNext;

    // Keep old building visible — it scrolls away
    this.oldBuilding = this.building;
    const oldHeight = this.originalBuildingHeight;

    // Clean up lingering projectile debris
    this.cleanupProjectiles();

    // Create new building one screen-width to the right
    const config = this.gameState.getBuildingConfig();
    config.x = LAYOUT.buildingX + GAME_WIDTH;
    this.building = new Building(this, config);
    this.originalBuildingHeight = this.building.getInitialHeight();
    this.hasHadImpact = false;
    this.thresholdCrossed = false;
    this.percentText.setText('');
    this.buildingLabel.setText(
      `Building ${this.gameState.currentBuildingIndex + 1}`
    );

    // Draw threshold lines for both buildings during the scroll
    this.thresholdLineGfx.clear();
    this.drawThresholdLine(oldHeight, LAYOUT.buildingX);
    this.drawThresholdLine(
      this.originalBuildingHeight,
      LAYOUT.buildingX + GAME_WIDTH
    );

    // Slide the camera right — world appears to slide left
    this.tweens.add({
      targets: this.cameras.main,
      scrollX: GAME_WIDTH,
      duration: 1000,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        // Destroy old building
        if (this.oldBuilding) {
          this.oldBuilding.destroy();
          this.oldBuilding = null;
        }

        // Shift new building blocks to standard world position
        this.building.offsetAllBlocks(-GAME_WIDTH);

        // Reset camera
        this.cameras.main.scrollX = 0;

        // Redraw threshold at standard position
        this.thresholdLineGfx.clear();
        this.drawThresholdLine();

        // Scatter clouds to new random positions
        for (const cloud of this.clouds) {
          cloud.x = Phaser.Math.Between(100, GAME_WIDTH - 100);
          cloud.y = Phaser.Math.Between(60, 220);
        }

        this.presentNextWord();
      },
    });
  }

  private handleGameComplete(): void {
    const winText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'You Win!', {
        fontFamily: FONT_FAMILY,
        fontSize: '72px',
        color: COLOR_STRINGS.primary,
        resolution: DPR,
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
          resolution: DPR,
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
    if (this.oldBuilding) {
      this.oldBuilding.destroy();
      this.oldBuilding = null;
    }
    if (this.building) {
      this.building.destroy();
    }
    this.audioManager.cancel();
    this.sfx.destroy();
    if (this.debugPanel) {
      this.debugPanel.destroy();
    }
  }

  update(): void {
    // Angle sweep indicator — oscillates 10°–30° during input phases
    const sweepActive =
      this.gameState.phase === GamePhase.ShowingWord ||
      this.gameState.phase === GamePhase.WaitingForInput;
    if (sweepActive) {
      this.sweepAngle = 15 + 10 * Math.sin(this.time.now * 0.0025);
      runtimeConfig.launchAngle = this.sweepAngle;
      this.drawSweepIndicator();
    } else {
      this.sweepGfx.clear();
    }

    if (this.oldBuilding) {
      this.oldBuilding.update();
    }
    if (this.building) {
      this.building.update();
      this.updateDestructionPercent();

      // Check if building just crossed below threshold
      if (this.hasHadImpact && !this.thresholdCrossed) {
        const threshold = this.originalBuildingHeight * 0.4;
        if (this.building.getCurrentHeight() < threshold) {
          this.thresholdCrossed = true;
          this.playThresholdFireworks();
          // Trigger win if blocks toppled after the 1.5s impact check already ran
          if (
            this.gameState.phase !== GamePhase.LevelComplete &&
            this.gameState.phase !== GamePhase.TransitionToNext
          ) {
            this.inputManager.disable();
            this.time.delayedCall(600, () => {
              // Cancel any in-progress word presentation
              this.wordDisplayText.setVisible(false);
              this.wordDisplayBg.setVisible(false);
              this.hearAgainBtn.setVisible(false);
              this.handleBuildingDestroyed();
            });
          }
        }
      }
    }
    if (this.activeProjectile) {
      this.activeProjectile.update();

      // Trail particles while letters are in flight
      if (this.gameState.phase === GamePhase.WatchingImpact) {
        // Set trail color based on projectile power
        if (this.activeProjectile.isSuper) {
          this.trailEmitter.setParticleTint(0xffd700);
        } else if (this.activeProjectile.isOnFire) {
          this.trailEmitter.setParticleTint(0xff8c00);
        } else {
          this.trailEmitter.setParticleTint(COLORS.primary);
        }

        const positions = this.activeProjectile.getLetterPositions();
        for (const pos of positions) {
          this.trailEmitter.emitParticleAt(pos.x, pos.y, 1);
        }
      }
    }
    for (const proj of this.oldProjectiles) {
      proj.update();
    }
  }
}
