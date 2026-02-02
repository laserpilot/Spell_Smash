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
  private wordDisplayShadow!: Phaser.GameObjects.Graphics;
  private launchPadShadow!: Phaser.GameObjects.Graphics;
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
  private streakGlow: Phaser.GameObjects.Graphics | null = null;
  private streakGlowTween: Phaser.Tweens.Tween | null = null;
  private thresholdLineGfx!: Phaser.GameObjects.Graphics;
  private percentText!: Phaser.GameObjects.Text;
  private originalBuildingHeight = 0;
  private hasHadImpact = false;
  private thresholdCrossed = false;
  private wordCarriedOver = false;
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
    this.cameras.main.setZoom(DPR).setOrigin(0, 0);

    // Reset state
    this.activeProjectile = null;
    this.oldProjectiles = [];
    this.impactHandled = false;
    this.hasHadImpact = false;
    this.thresholdCrossed = false;
    this.wordCarriedOver = false;
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

    // Layered gradient background
    this.drawGradientBackground();

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

    // Launch pad shadow + visual
    this.launchPadShadow = this.add.graphics().setDepth(2);
    this.launchPadGfx = this.add.graphics().setDepth(3);
    this.drawLaunchPad();

    // Angle sweep indicator (drawn each frame in update)
    this.sweepGfx = this.add.graphics().setDepth(3).setScrollFactor(0);

    // Word display shadow
    this.wordDisplayShadow = this.add.graphics().setDepth(7);
    this.wordDisplayShadow.fillStyle(0x000000, 0.12);
    this.wordDisplayShadow.fillRoundedRect(
      LAYOUT.wordDisplayX - 130 + 3,
      LAYOUT.wordDisplayY - 45 + 4,
      260,
      90,
      16
    );

    // Word display background
    this.wordDisplayBg = this.add.graphics().setDepth(8);
    this.drawBeveledPanel(
      this.wordDisplayBg,
      LAYOUT.wordDisplayX - 130,
      LAYOUT.wordDisplayY - 45,
      260,
      90,
      0xffffff,
      0.7,
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
      .text(GAME_WIDTH - 10, 30, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        color: COLOR_STRINGS.neutral,
        resolution: DPR,
      })
      .setOrigin(1, 0.5)
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
    this.launchPadShadow.setScrollFactor(0);
    this.launchPadGfx.setScrollFactor(0);
    this.wordDisplayShadow.setScrollFactor(0);
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
    this.launchPadShadow.clear();
    const padW = LAYOUT.launchPadWidth;
    const padH = LAYOUT.launchPadHeight;
    const padX = this.getLaunchPadLeft();
    const padY = LAYOUT.launchOriginY - padH / 2 + 10; // slightly below letter center

    // Shadow
    this.launchPadShadow.fillStyle(0x000000, 0.1);
    this.launchPadShadow.fillRoundedRect(padX + 3, padY + 4, padW, padH, 12);

    // Shallow bowl / platform shape with bevel + outline
    this.drawBeveledPanel(
      this.launchPadGfx,
      padX,
      padY,
      padW,
      padH,
      COLORS.neutral,
      0.12,
      12
    );
  }

  private drawGradientBackground(): void {
    const gfx = this.add.graphics().setDepth(-2);
    const bands = 24;
    const bandH = Math.ceil(GAME_HEIGHT / bands);
    const topR = (COLORS.gradientTop >> 16) & 0xff;
    const topG = (COLORS.gradientTop >> 8) & 0xff;
    const topB = COLORS.gradientTop & 0xff;
    const botR = (COLORS.gradientBottom >> 16) & 0xff;
    const botG = (COLORS.gradientBottom >> 8) & 0xff;
    const botB = COLORS.gradientBottom & 0xff;

    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const r = Math.round(topR + (botR - topR) * t);
      const g = Math.round(topG + (botG - topG) * t);
      const b = Math.round(topB + (botB - topB) * t);
      const color = (r << 16) | (g << 8) | b;
      gfx.fillStyle(color, 1);
      gfx.fillRect(0, i * bandH, GAME_WIDTH, bandH + 1);
    }

    // Soft abstract shapes for depth
    const shapes = this.add.graphics().setDepth(-1).setScrollFactor(0.1);
    shapes.fillStyle(COLORS.secondary, 0.06);
    shapes.fillEllipse(200, 500, 300, 200);
    shapes.fillStyle(COLORS.support, 0.05);
    shapes.fillEllipse(900, 200, 250, 180);
    shapes.fillStyle(COLORS.primary, 0.04);
    shapes.fillEllipse(600, 650, 350, 150);
  }

  private tintColor(color: number, factor: number): number {
    const r = Phaser.Math.Clamp(Math.round(((color >> 16) & 0xff) * factor), 0, 255);
    const g = Phaser.Math.Clamp(Math.round(((color >> 8) & 0xff) * factor), 0, 255);
    const b = Phaser.Math.Clamp(Math.round((color & 0xff) * factor), 0, 255);
    return (r << 16) | (g << 8) | b;
  }

  private drawBeveledPanel(
    gfx: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    baseColor: number,
    baseAlpha: number,
    radius: number
  ): void {
    const lighter = this.tintColor(baseColor, 1.15);
    const darker = this.tintColor(baseColor, 0.85);
    const outline = this.tintColor(baseColor, 0.7);
    const bevelH = Math.max(4, Math.round(height * 0.22));

    gfx.fillStyle(baseColor, baseAlpha);
    gfx.fillRoundedRect(x, y, width, height, radius);

    gfx.fillStyle(lighter, baseAlpha * 0.9);
    gfx.fillRoundedRect(x, y, width, bevelH, radius);

    gfx.fillStyle(darker, baseAlpha * 0.9);
    gfx.fillRoundedRect(x, y + height - bevelH, width, bevelH, radius);

    gfx.lineStyle(2, outline, 0.35);
    gfx.strokeRoundedRect(x + 1, y + 1, width - 2, height - 2, radius);
  }

  private getLaunchPadLeft(): number {
    return runtimeConfig.inputX - 8;
  }

  private getLaunchOriginX(): number {
    return this.getLaunchPadLeft() + LAYOUT.launchPadWidth / 2;
  }

  private drawSweepIndicator(): void {
    this.sweepGfx.clear();
    const ox = this.getLaunchOriginX();
    const oy = LAYOUT.launchOriginY;
    const lineLen = 240;

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

  /** Threshold height from ground: pedestal is indestructible, so 40% applies only to blocks. */
  private getThresholdHeight(totalHeight?: number): number {
    const h = totalHeight ?? this.originalBuildingHeight;
    const blockOnly = h - LAYOUT.pedestalHeight;
    return LAYOUT.pedestalHeight + blockOnly * 0.4;
  }

  private drawThresholdLine(height?: number, centerX?: number): void {
    const cx = centerX ?? LAYOUT.buildingX;
    const thresholdHeight = this.getThresholdHeight(height);
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
    const burstY = LAYOUT.groundY - this.getThresholdHeight();

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
    const thresholdH = this.getThresholdHeight();
    const aboveThreshold = this.originalBuildingHeight - thresholdH;
    const knocked = this.originalBuildingHeight - currentHeight;
    const percent = Math.min(100, Math.max(0, Math.round((knocked / aboveThreshold) * 100)));
    this.percentText.setText(`${percent}%`);
    const lineY = LAYOUT.groundY - thresholdH;
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
    const width = 120;
    const height = 32;
    const btnX = runtimeConfig.inputX - 8 + width / 2;
    const btnY = runtimeConfig.inputY + 56 / 2 + 10 + height / 2;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.1);
    shadow.fillRoundedRect(-width / 2 + 3, -height / 2 + 4, width, height, 8);

    const bg = this.add.graphics();
    this.drawBeveledPanel(
      bg,
      -width / 2,
      -height / 2,
      width,
      height,
      COLORS.neutral,
      0.15,
      8
    );

    const label = this.add
      .text(0, 0, 'Hear Again', {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        color: COLOR_STRINGS.neutral,
        resolution: DPR,
      })
      .setOrigin(0.5);

    const container = this.add
      .container(btnX, btnY, [shadow, bg, label])
      .setDepth(10)
      .setSize(width, height)
      .setInteractive({ useHandCursor: true });

    container.on('pointerover', () => {
      this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 100 });
    });
    container.on('pointerout', () => {
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 100 });
    });
    container.on('pointerdown', () => {
      this.tweens.add({ targets: container, scaleX: 0.95, scaleY: 0.95, duration: 50 });
      this.handleHearAgain();
    });
    container.on('pointerup', () => {
      this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 50 });
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
    this.drawBeveledPanel(
      bg,
      -width / 2,
      -height / 2,
      width,
      height,
      COLORS.support,
      0.2,
      8
    );

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

    if (runtimeConfig.showWord) {
      this.wordDisplayText.setText(this.currentWord);
      this.wordDisplayText.setVisible(true);
      this.wordDisplayText.setAlpha(1);
      this.wordDisplayText.setScale(0);
      this.wordDisplayBg.setVisible(true);
      this.wordDisplayBg.setAlpha(1);
      this.wordDisplayShadow.setVisible(true);
      this.wordDisplayShadow.setAlpha(1);
      this.hintText.setVisible(false);

      this.tweens.add({
        targets: this.wordDisplayText,
        scaleX: 1,
        scaleY: 1,
        duration: 400,
        ease: 'Back.easeOut',
      });

      this.time.delayedCall(800, () => {
        if (this.gameState.phase === GamePhase.WaitingForInput) {
          this.tweens.add({
            targets: [this.wordDisplayText, this.wordDisplayBg, this.wordDisplayShadow],
            alpha: 0,
            duration: 400,
            ease: 'Quad.easeOut',
            onComplete: () => {
              this.wordDisplayText.setVisible(false);
              this.wordDisplayBg.setVisible(false);
              this.wordDisplayShadow.setVisible(false);
              if (this.wrongAttempts > 0) {
                this.hintText.setVisible(true);
              }
            },
          });
        }
      });
    }
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
      this.getLaunchOriginX(),
      LAYOUT.launchOriginY
    );
    this.launchPadGfx.setVisible(true);
    this.launchPadShadow.setVisible(true);

    // Show word (if enabled) and speak it
    this.hearAgainBtn.setVisible(false);
    this.inputManager.disable();
    this.inputManager.clear();

    if (runtimeConfig.showWord) {
      this.wordDisplayText.setText(this.currentWord);
      this.wordDisplayText.setVisible(true);
      this.wordDisplayText.setAlpha(1);
      this.wordDisplayText.setScale(0);
      this.wordDisplayBg.setVisible(true);
      this.wordDisplayBg.setAlpha(1);
      this.wordDisplayShadow.setVisible(true);
      this.wordDisplayShadow.setAlpha(1);

      this.tweens.add({
        targets: this.wordDisplayText,
        scaleX: 1,
        scaleY: 1,
        duration: 400,
        ease: 'Back.easeOut',
      });
    }

    this.audioManager.speakWord(this.currentWord);

    this.time.delayedCall(2000, () => {
      if (this.gameState.phase !== GamePhase.ShowingWord) return;

      if (runtimeConfig.showWord) {
        this.tweens.add({
          targets: [this.wordDisplayText, this.wordDisplayBg, this.wordDisplayShadow],
          alpha: 0,
          duration: 500,
          ease: 'Quad.easeOut',
          onComplete: () => {
            this.wordDisplayText.setVisible(false);
            this.wordDisplayBg.setVisible(false);
            this.wordDisplayShadow.setVisible(false);
          },
        });
      }

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
      this.launchPadShadow.setVisible(false);

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
      this.gameState.recordWrongAttempt();
      this.sfx.error();
      this.feedbackText.setText('Try again!');
      this.inputManager.clear();

      // Clear letters from the pad (they tumble off)
      if (this.activeProjectile) {
        this.activeProjectile.clear();
        // Create a fresh projectile for the retry
        this.activeProjectile = new WordProjectile(
          this,
          this.getLaunchOriginX(),
          LAYOUT.launchOriginY
        );
      }

      if (this.wrongAttempts >= 1) {
        this.hintText.setText(this.currentWord[0]);
        this.hintText.setVisible(true);
        this.wordDisplayBg.setVisible(true);
        this.wordDisplayShadow.setVisible(true);
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

      // Create streak glow if it doesn't exist
      if (!this.streakGlow) {
        this.streakGlow = this.add.graphics()
          .setDepth(this.streakCountText.depth - 1)
          .setScrollFactor(0);
        this.drawStreakGlow();

        this.streakGlowTween = this.tweens.add({
          targets: this.streakGlow,
          alpha: { from: 0.2, to: 0.5 },
          scaleX: { from: 0.9, to: 1.15 },
          scaleY: { from: 0.9, to: 1.15 },
          duration: 800,
          yoyo: true,
          repeat: -1,
        });
      }
    } else {
      this.streakCountText.setColor(COLOR_STRINGS.secondary);

      // Remove streak glow
      if (this.streakGlow) {
        if (this.streakGlowTween) {
          this.streakGlowTween.stop();
          this.streakGlowTween = null;
        }
        this.tweens.add({
          targets: this.streakGlow,
          alpha: 0,
          duration: 300,
          onComplete: () => {
            if (this.streakGlow) {
              this.streakGlow.destroy();
              this.streakGlow = null;
            }
          },
        });
      }
    }
  }

  private drawStreakGlow(): void {
    if (!this.streakGlow) return;
    this.streakGlow.clear();

    // Position glow behind streak count text
    const cx = this.streakCountText.x + this.streakCountText.width / 2;
    const cy = this.streakCountText.y;

    // Concentric circles for radial glow effect
    const rings = [
      { radius: 35, alpha: 0.08 },
      { radius: 25, alpha: 0.12 },
      { radius: 16, alpha: 0.18 },
      { radius: 8, alpha: 0.25 },
    ];

    for (const ring of rings) {
      this.streakGlow.fillStyle(0xffd700, ring.alpha);
      this.streakGlow.fillCircle(cx, cy, ring.radius);
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
    if (this.building) {
      this.building.releaseBlocks();
    }
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

    // Apply outward force to nearby building blocks for satisfying physics response.
    // Supplements the physical collision (letters persist for 150ms before becoming Rubble).
    const blastRadius = 200;
    const blastForce = isSuper ? 0.10 : isOnFire ? 0.07 : 0.05;
    const MatterBody = (Phaser.Physics.Matter as any).Matter.Body;
    const allBodies = this.matter.world.getAllBodies();
    for (const body of allBodies) {
      if (body.label !== 'building_block') continue;
      const dx = body.position.x - impactX;
      const dy = body.position.y - impactY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > blastRadius || dist < 1) continue;
      const falloff = 1 - dist / blastRadius;
      const fx = (dx / dist) * blastForce * falloff;
      const fy = (dy / dist) * blastForce * falloff;
      MatterBody.applyForce(body, body.position, { x: fx, y: fy });
    }

    this.gameState.recordWordComplete();

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

    // Win when remaining height drops below threshold (pedestal + 40% of block height)
    const threshold = this.getThresholdHeight();
    if (this.building.getCurrentHeight() < threshold) {
      this.thresholdCrossed = true;
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
      .text(LAYOUT.buildingX + 180, LAYOUT.groundY - 230, phrase, {
        fontFamily: FONT_FAMILY,
        fontSize: '44px',
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
    this.cameras.main.zoomTo(DPR * 1.05, 200, 'Sine.easeInOut', false, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
      if (progress === 1) {
        this.cameras.main.zoomTo(DPR, 300, 'Sine.easeInOut');
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

        if (this.wordCarriedOver) {
          this.wordCarriedOver = false;
          // Same word — go straight to WaitingForInput with fresh projectile
          this.gameState.phase = GamePhase.WaitingForInput;
          this.activeProjectile = new WordProjectile(
            this,
            this.getLaunchOriginX(),
            LAYOUT.launchOriginY
          );
          this.launchPadGfx.setVisible(true);
          this.launchPadShadow.setVisible(true);
          this.wordDisplayText.setVisible(false);
          this.wordDisplayBg.setVisible(false);
          this.wordDisplayShadow.setVisible(false);
          this.hearAgainBtn.setVisible(true);
          this.feedbackText.setText('');
          this.hintText.setVisible(false);
          this.inputManager.enable();
          // Re-speak word as reminder after the visual interruption
          this.audioManager.speakWord(this.currentWord);
        } else {
          this.presentNextWord();
        }
      },
    });
  }

  private handleGameComplete(): void {
    this.gameState.phase = GamePhase.GameComplete;
    this.inputManager.disable();
    this.hearAgainBtn.setVisible(false);
    this.launchPadGfx.setVisible(false);
    this.launchPadShadow.setVisible(false);
    this.sweepGfx.clear();
    this.wordDisplayText.setVisible(false);
    this.wordDisplayBg.setVisible(false);
    if (this.wordDisplayShadow) this.wordDisplayShadow.setVisible(false);
    this.feedbackText.setVisible(false);
    this.hintText.setVisible(false);

    // Panel dimensions
    const panelW = 500;
    const panelH = 420;
    const panelX = GAME_WIDTH / 2 - panelW / 2;
    const panelY = GAME_HEIGHT / 2 - panelH / 2;

    // Container to hold everything (for bounce-in animation)
    const statsContainer = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2)
      .setDepth(25)
      .setScrollFactor(0)
      .setScale(0);

    // Panel shadow
    const panelShadow = this.add.graphics();
    panelShadow.fillStyle(0x000000, 0.12);
    panelShadow.fillRoundedRect(-panelW / 2 + 4, -panelH / 2 + 5, panelW, panelH, 20);
    statsContainer.add(panelShadow);

    // Panel background
    const panelBg = this.add.graphics();
    panelBg.fillStyle(0xffffff, 0.95);
    panelBg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 20);
    panelBg.lineStyle(2, COLORS.secondary, 0.4);
    panelBg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 20);
    statsContainer.add(panelBg);

    // Title
    const title = this.add.text(0, -panelH / 2 + 50, 'Great Job!', {
      fontFamily: FONT_FAMILY,
      fontSize: '48px',
      color: COLOR_STRINGS.primary,
      resolution: DPR,
    }).setOrigin(0.5);
    statsContainer.add(title);

    // Divider line
    const divider = this.add.graphics();
    divider.lineStyle(2, COLORS.neutral, 0.2);
    divider.beginPath();
    divider.moveTo(-panelW / 2 + 40, -panelH / 2 + 90);
    divider.lineTo(panelW / 2 - 40, -panelH / 2 + 90);
    divider.strokePath();
    statsContainer.add(divider);

    // Stats rows
    const statsData = [
      { label: 'Words Spelled', value: String(this.gameState.wordsCompleted) },
      { label: 'Perfect Words', value: String(this.gameState.perfectWords) },
      { label: 'Best Streak', value: String(this.gameState.bestStreak) },
      { label: 'Accuracy', value: `${this.gameState.getAccuracyPercent()}%` },
    ];

    const startY = -panelH / 2 + 120;
    const rowH = 50;
    for (let i = 0; i < statsData.length; i++) {
      const rowLabel = this.add.text(-panelW / 2 + 60, startY + i * rowH, statsData[i].label, {
        fontFamily: FONT_FAMILY,
        fontSize: '28px',
        color: COLOR_STRINGS.neutral,
        resolution: DPR,
      }).setOrigin(0, 0.5);
      statsContainer.add(rowLabel);

      const rowValue = this.add.text(panelW / 2 - 60, startY + i * rowH, statsData[i].value, {
        fontFamily: FONT_FAMILY,
        fontSize: '28px',
        color: COLOR_STRINGS.primary,
        resolution: DPR,
      }).setOrigin(1, 0.5);
      statsContainer.add(rowValue);
    }

    // Play Again button
    const btnW = 220;
    const btnH = 60;
    const btnY = panelH / 2 - 60;

    const btnShadow = this.add.graphics();
    btnShadow.fillStyle(0x000000, 0.1);
    btnShadow.fillRoundedRect(-btnW / 2 + 3, btnY - btnH / 2 + 4, btnW, btnH, 14);
    statsContainer.add(btnShadow);

    const btnBg = this.add.graphics();
    btnBg.fillStyle(COLORS.secondary, 1);
    btnBg.fillRoundedRect(-btnW / 2, btnY - btnH / 2, btnW, btnH, 14);
    statsContainer.add(btnBg);

    const btnLabel = this.add.text(0, btnY, 'Play Again', {
      fontFamily: FONT_FAMILY,
      fontSize: '32px',
      color: COLOR_STRINGS.white,
      resolution: DPR,
    }).setOrigin(0.5);
    statsContainer.add(btnLabel);

    // Button hit zone
    const btnZone = this.add.zone(0, btnY, btnW, btnH)
      .setInteractive({ useHandCursor: true });
    statsContainer.add(btnZone);

    btnZone.on('pointerover', () => {
      btnBg.clear();
      btnBg.fillStyle(0x52b0a5, 1);
      btnBg.fillRoundedRect(-btnW / 2, btnY - btnH / 2, btnW, btnH, 14);
    });
    btnZone.on('pointerout', () => {
      btnBg.clear();
      btnBg.fillStyle(COLORS.secondary, 1);
      btnBg.fillRoundedRect(-btnW / 2, btnY - btnH / 2, btnW, btnH, 14);
    });
    btnZone.on('pointerdown', () => {
      this.cleanupAll();
      this.scene.start('MainMenuScene');
    });

    // Bounce-in animation
    this.tweens.add({
      targets: statsContainer,
      scaleX: 1,
      scaleY: 1,
      duration: 600,
      ease: 'Back.easeOut',
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
    this.inputManager.destroy();
    this.audioManager.cancel();
    this.sfx.destroy();
    if (this.debugPanel) {
      this.debugPanel.destroy();
    }
  }

  update(): void {
    // Angle sweep — keep oscillating during input phases so value stays current
    const sweepPhase =
      this.gameState.phase === GamePhase.ShowingWord ||
      this.gameState.phase === GamePhase.WaitingForInput;
    if (sweepPhase) {
      this.sweepAngle = 15 + 10 * Math.sin(this.time.now * 0.0025);
      runtimeConfig.launchAngle = this.sweepAngle;
    }
    // Only draw the indicator when the player has typed at least one letter
    const showSweep =
      this.gameState.phase === GamePhase.WaitingForInput &&
      this.inputManager.getTypedText().length > 0;
    if (showSweep) {
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
        const threshold = this.getThresholdHeight();
        if (this.building.getCurrentHeight() < threshold) {
          this.thresholdCrossed = true;
          this.playThresholdFireworks();
          // Trigger win if blocks toppled after the 2.5s impact check already ran
          if (
            this.gameState.phase !== GamePhase.LevelComplete &&
            this.gameState.phase !== GamePhase.TransitionToNext
          ) {
            // If a word is active, carry it over to the next building
            this.wordCarriedOver =
              this.gameState.phase === GamePhase.ShowingWord ||
              this.gameState.phase === GamePhase.WaitingForInput;

            this.inputManager.disable();
            this.inputManager.clear();
            // Projectile letters are world-space bodies — destroy before scroll
            if (this.activeProjectile) {
              this.activeProjectile.destroy();
              this.activeProjectile = null;
            }
            this.handleBuildingDestroyed();
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
