import Phaser from 'phaser';
import { DPR, FONT_FAMILY, COLOR_STRINGS, COLORS, GAME_WIDTH } from '../config';
import { runtimeConfig } from '../RuntimeConfig';

type Difficulty = 'short' | 'medium' | 'long' | 'hard' | 'silly';

interface DifficultyOption {
  label: string;
  hint: string;
  min: number;
  max: number;
}

const DIFFICULTY_OPTIONS: Record<Difficulty, DifficultyOption> = {
  short:  { label: 'Short',  hint: 'cat, dog, sun',       min: 1, max: 2 },
  medium: { label: 'Medium', hint: 'jump, ship, look',    min: 2, max: 4 },
  long:   { label: 'Long',   hint: 'brave, ocean, dream', min: 3, max: 5 },
  hard:   { label: 'Hard',   hint: 'rocket, thunder',     min: 7, max: 9 },
  silly:  { label: 'Silly',  hint: 'poop, fart, bonk',    min: 6, max: 6 },
};

const SESSION_MIN = 4;
const SESSION_MAX = 24;
const SESSION_STEP = 2;

export class MainMenuScene extends Phaser.Scene {
  private selectedDifficulty: Difficulty = 'short';
  private sessionLength = 8;
  private showWordEnabled = true;

  // UI references for redrawing
  private difficultyButtons: {
    key: Difficulty;
    bg: Phaser.GameObjects.Graphics;
    label: Phaser.GameObjects.Text;
    hint: Phaser.GameObjects.Text;
    zone: Phaser.GameObjects.Zone;
  }[] = [];
  private sessionLabel!: Phaser.GameObjects.Text;
  private sessionBarGraphics!: Phaser.GameObjects.Graphics;
  private checkboxGfx!: Phaser.GameObjects.Graphics;
  private checkmarkText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create(): void {
    // Reset UI references (scene instance is reused by Phaser)
    this.difficultyButtons = [];

    this.cameras.main.setZoom(DPR).setOrigin(0, 0);

    // Title
    this.add
      .text(GAME_WIDTH / 2, 120, 'Sola\'s Spell Smash', {
        fontFamily: FONT_FAMILY,
        fontSize: '72px',
        color: COLOR_STRINGS.primary,
        resolution: DPR,
      })
      .setOrigin(0.5);

    // Subtitle
    this.add
      .text(GAME_WIDTH / 2, 180, 'Spell words. Smash buildings.', {
        fontFamily: FONT_FAMILY,
        fontSize: '28px',
        color: COLOR_STRINGS.neutral,
        resolution: DPR,
      })
      .setOrigin(0.5);

    // --- Difficulty section ---
    this.add
      .text(GAME_WIDTH / 2, 255, 'Word Difficulty', {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        color: COLOR_STRINGS.neutral,
        resolution: DPR,
      })
      .setOrigin(0.5);

    this.createDifficultyButtons();

    // --- Session length section ---
    this.sessionLabel = this.add
      .text(GAME_WIDTH / 2, 435, `Buildings: ${this.sessionLength}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        color: COLOR_STRINGS.neutral,
        resolution: DPR,
      })
      .setOrigin(0.5);

    this.createSessionStepper();

    // --- Show Word toggle ---
    this.createShowWordToggle();

    // --- Play button ---
    this.createPlayButton();

    // Apply defaults to runtimeConfig
    this.applySettings();
  }

  private createDifficultyButtons(): void {
    const btnWidth = 150;
    const btnHeight = 44;
    const btnGap = 20;

    // Row 1: Short, Medium, Long
    const row1: Difficulty[] = ['short', 'medium', 'long'];
    const row1Y = 290;
    const row1HintY = 322;
    const row1Total = row1.length * btnWidth + (row1.length - 1) * btnGap;
    const row1Start = GAME_WIDTH / 2 - row1Total / 2 + btnWidth / 2;

    // Row 2: Hard, Silly
    const row2: Difficulty[] = ['hard', 'silly'];
    const row2Y = 362;
    const row2HintY = 394;
    const row2Total = row2.length * btnWidth + (row2.length - 1) * btnGap;
    const row2Start = GAME_WIDTH / 2 - row2Total / 2 + btnWidth / 2;

    // Build position list for both rows
    const buttons: { key: Difficulty; cx: number; by: number; hy: number }[] = [];
    row1.forEach((key, i) => buttons.push({ key, cx: row1Start + i * (btnWidth + btnGap), by: row1Y, hy: row1HintY }));
    row2.forEach((key, i) => buttons.push({ key, cx: row2Start + i * (btnWidth + btnGap), by: row2Y, hy: row2HintY }));

    for (const pos of buttons) {
      const opt = DIFFICULTY_OPTIONS[pos.key];

      const bg = this.add.graphics();
      const label = this.add
        .text(pos.cx, pos.by, opt.label, {
          fontFamily: FONT_FAMILY,
          fontSize: '22px',
          color: COLOR_STRINGS.white,
          resolution: DPR,
        })
        .setOrigin(0.5);

      const hint = this.add
        .text(pos.cx, pos.hy, opt.hint, {
          fontFamily: FONT_FAMILY,
          fontSize: '14px',
          color: COLOR_STRINGS.neutral,
          resolution: DPR,
        })
        .setOrigin(0.5);

      const zone = this.add
        .zone(pos.cx, pos.by, btnWidth, btnHeight)
        .setInteractive({ useHandCursor: true });

      const key = pos.key;
      zone.on('pointerdown', () => {
        this.selectedDifficulty = key;
        this.refreshDifficultyButtons();
        this.applySettings();
      });

      this.difficultyButtons.push({ key, bg, label, hint, zone });
    }

    this.refreshDifficultyButtons();
  }

  private refreshDifficultyButtons(): void {
    const btnWidth = 150;
    const btnHeight = 44;

    for (const btn of this.difficultyButtons) {
      const isSelected = btn.key === this.selectedDifficulty;
      const cx = btn.zone.x;
      const cy = btn.zone.y;

      btn.bg.clear();
      if (isSelected) {
        btn.bg.fillStyle(COLORS.secondary, 1);
        btn.bg.fillRoundedRect(
          cx - btnWidth / 2, cy - btnHeight / 2,
          btnWidth, btnHeight, 10
        );
        btn.label.setColor(COLOR_STRINGS.white);
      } else {
        btn.bg.lineStyle(2, COLORS.neutral, 0.5);
        btn.bg.strokeRoundedRect(
          cx - btnWidth / 2, cy - btnHeight / 2,
          btnWidth, btnHeight, 10
        );
        btn.label.setColor(COLOR_STRINGS.neutral);
      }
    }
  }

  private createSessionStepper(): void {
    const centerX = GAME_WIDTH / 2;
    const stepperY = 475;
    const arrowSize = 40;

    // Left arrow (◀)
    const leftBg = this.add.graphics();
    leftBg.fillStyle(COLORS.neutral, 0.8);
    leftBg.fillRoundedRect(centerX - 120 - arrowSize / 2, stepperY - arrowSize / 2, arrowSize, arrowSize, 8);

    this.add
      .text(centerX - 120, stepperY, '◀', {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        color: COLOR_STRINGS.white,
        resolution: DPR,
      })
      .setOrigin(0.5);

    const leftZone = this.add
      .zone(centerX - 120, stepperY, arrowSize, arrowSize)
      .setInteractive({ useHandCursor: true });

    leftZone.on('pointerdown', () => {
      this.sessionLength = Math.max(SESSION_MIN, this.sessionLength - SESSION_STEP);
      this.refreshSessionDisplay();
      this.applySettings();
    });

    // Right arrow (▶)
    const rightBg = this.add.graphics();
    rightBg.fillStyle(COLORS.neutral, 0.8);
    rightBg.fillRoundedRect(centerX + 120 - arrowSize / 2, stepperY - arrowSize / 2, arrowSize, arrowSize, 8);

    this.add
      .text(centerX + 120, stepperY, '▶', {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        color: COLOR_STRINGS.white,
        resolution: DPR,
      })
      .setOrigin(0.5);

    const rightZone = this.add
      .zone(centerX + 120, stepperY, arrowSize, arrowSize)
      .setInteractive({ useHandCursor: true });

    rightZone.on('pointerdown', () => {
      this.sessionLength = Math.min(SESSION_MAX, this.sessionLength + SESSION_STEP);
      this.refreshSessionDisplay();
      this.applySettings();
    });

    // Visual bar
    this.sessionBarGraphics = this.add.graphics();
    this.refreshSessionDisplay();
  }

  private refreshSessionDisplay(): void {
    this.sessionLabel.setText(`Buildings: ${this.sessionLength}`);

    // Draw visual bar
    const barX = GAME_WIDTH / 2 - 80;
    const barY = 500;
    const barWidth = 160;
    const barHeight = 10;
    const totalSteps = (SESSION_MAX - SESSION_MIN) / SESSION_STEP;
    const currentStep = (this.sessionLength - SESSION_MIN) / SESSION_STEP;
    const fillWidth = (currentStep / totalSteps) * barWidth;

    this.sessionBarGraphics.clear();
    // Background track
    this.sessionBarGraphics.fillStyle(COLORS.neutral, 0.2);
    this.sessionBarGraphics.fillRoundedRect(barX, barY, barWidth, barHeight, 4);
    // Filled portion
    if (fillWidth > 0) {
      this.sessionBarGraphics.fillStyle(COLORS.secondary, 1);
      this.sessionBarGraphics.fillRoundedRect(barX, barY, fillWidth, barHeight, 4);
    }
  }

  private createShowWordToggle(): void {
    const centerX = GAME_WIDTH / 2;
    const toggleY = 535;
    const boxSize = 28;
    const boxX = centerX - 60;

    this.checkboxGfx = this.add.graphics();
    this.checkmarkText = this.add
      .text(boxX, toggleY, '✓', {
        fontFamily: FONT_FAMILY,
        fontSize: '20px',
        color: COLOR_STRINGS.white,
        resolution: DPR,
      })
      .setOrigin(0.5);

    this.add
      .text(boxX + 24, toggleY, 'Show Word', {
        fontFamily: FONT_FAMILY,
        fontSize: '20px',
        color: COLOR_STRINGS.neutral,
        resolution: DPR,
      })
      .setOrigin(0, 0.5);

    const zone = this.add
      .zone(centerX, toggleY, 180, boxSize + 8)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerdown', () => {
      this.showWordEnabled = !this.showWordEnabled;
      this.refreshShowWordToggle();
      this.applySettings();
    });

    this.refreshShowWordToggle();
  }

  private refreshShowWordToggle(): void {
    const centerX = GAME_WIDTH / 2;
    const toggleY = 535;
    const boxSize = 28;
    const boxX = centerX - 60;

    this.checkboxGfx.clear();
    if (this.showWordEnabled) {
      this.checkboxGfx.fillStyle(COLORS.secondary, 1);
      this.checkboxGfx.fillRoundedRect(
        boxX - boxSize / 2, toggleY - boxSize / 2,
        boxSize, boxSize, 6
      );
      this.checkmarkText.setVisible(true);
    } else {
      this.checkboxGfx.lineStyle(2, COLORS.neutral, 0.5);
      this.checkboxGfx.strokeRoundedRect(
        boxX - boxSize / 2, toggleY - boxSize / 2,
        boxSize, boxSize, 6
      );
      this.checkmarkText.setVisible(false);
    }
  }

  private createPlayButton(): void {
    const buttonWidth = 220;
    const buttonHeight = 70;
    const buttonX = GAME_WIDTH / 2;
    const buttonY = 605;

    const buttonBg = this.add.graphics();
    buttonBg.fillStyle(COLORS.secondary, 1);
    buttonBg.fillRoundedRect(
      buttonX - buttonWidth / 2,
      buttonY - buttonHeight / 2,
      buttonWidth,
      buttonHeight,
      16
    );

    this.add
      .text(buttonX, buttonY, 'PLAY', {
        fontFamily: FONT_FAMILY,
        fontSize: '36px',
        color: COLOR_STRINGS.white,
        resolution: DPR,
      })
      .setOrigin(0.5);

    const hitZone = this.add
      .zone(buttonX, buttonY, buttonWidth, buttonHeight)
      .setInteractive({ useHandCursor: true });

    hitZone.on('pointerover', () => {
      buttonBg.clear();
      buttonBg.fillStyle(0x52b0a5, 1);
      buttonBg.fillRoundedRect(
        buttonX - buttonWidth / 2,
        buttonY - buttonHeight / 2,
        buttonWidth,
        buttonHeight,
        16
      );
    });

    hitZone.on('pointerout', () => {
      buttonBg.clear();
      buttonBg.fillStyle(COLORS.secondary, 1);
      buttonBg.fillRoundedRect(
        buttonX - buttonWidth / 2,
        buttonY - buttonHeight / 2,
        buttonWidth,
        buttonHeight,
        16
      );
    });

    hitZone.on('pointerdown', () => {
      this.scene.start('GameScene');
    });
  }

  private applySettings(): void {
    const opt = DIFFICULTY_OPTIONS[this.selectedDifficulty];
    runtimeConfig.difficultyMin = opt.min;
    runtimeConfig.difficultyMax = opt.max;
    runtimeConfig.sessionLength = this.sessionLength;
    runtimeConfig.showWord = this.showWordEnabled;
    runtimeConfig.isSillyMode = this.selectedDifficulty === 'silly';
  }
}
