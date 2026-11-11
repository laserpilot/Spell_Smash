import Phaser from 'phaser';
import { DPR, FONT_FAMILY, COLOR_STRINGS, COLORS, GAME_WIDTH, LAYOUT } from '../config';
import { runtimeConfig, WordMode } from '../RuntimeConfig';
import { THIS_WEEK } from '../words/weekly';
import { Scenery } from '../art/Scenery';
import { drawBeveledPanel, shade } from '../art/draw';
import { getTheme } from '../art/palette';
import { blockTexture, roofTexture } from '../art/textures';

type Difficulty = 'short' | 'medium' | 'long' | 'hard' | 'silly' | 'suffixes' | 'weekly';

interface DifficultyOption {
  label: string;
  hint: string;
  min: number;
  max: number;
  mode?: WordMode;
}

const DIFFICULTY_OPTIONS: Record<Difficulty, DifficultyOption> = {
  short:  { label: 'Short',  hint: 'cat, dog, sun',       min: 1, max: 2 },
  medium: { label: 'Medium', hint: 'jump, ship, look',    min: 2, max: 4 },
  long:   { label: 'Long',   hint: 'brave, ocean, dream', min: 3, max: 5 },
  hard:   { label: 'Hard',   hint: 'rocket, thunder',     min: 7, max: 9 },
  silly:  { label: 'Silly',  hint: 'poop, fart, bonk',    min: 6, max: 6 },
  // Fill-in-the-blank sentence modes
  suffixes: { label: 'Suffixes', hint: 'hopping, cried', min: 1, max: 1, mode: 'suffixes' },
  weekly: {
    label: 'This Week',
    hint: THIS_WEEK.words.slice(0, 2).map((w) => w.word).join(', '),
    min: 1,
    max: 1,
    mode: 'weekly',
  },
};

interface Toggle {
  x: number;
  y: number;
  box: Phaser.GameObjects.Graphics;
  check: Phaser.GameObjects.Text;
  label: Phaser.GameObjects.Text;
}

const BUTTON_W = 124;
const BUTTON_H = 44;
const BUTTON_GAP = 12;

const SESSION_MIN = 4;
const SESSION_MAX = 24;
const SESSION_STEP = 2;

export class MainMenuScene extends Phaser.Scene {
  private selectedDifficulty: Difficulty = 'short';
  private sessionLength = 8;
  private showWordEnabled = true;
  private toughEnabled = true;

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
  private showWordToggle!: Toggle;
  private toughToggle!: Toggle;
  private scenery!: Scenery;

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create(): void {
    // Reset UI references (scene instance is reused by Phaser)
    this.difficultyButtons = [];

    this.cameras.main.setZoom(DPR).setOrigin(0, 0);

    this.scenery = new Scenery(this);
    this.createToyTower(150, 0, 7);
    this.createToyTower(1130, 1, 9);

    // Card behind the settings
    const card = this.add.graphics();
    card.fillStyle(0x000000, 0.08);
    card.fillRoundedRect(364, 234, 560, 330, 24);
    card.fillStyle(0xffffff, 0.86);
    card.fillRoundedRect(360, 228, 560, 330, 24);

    // Title
    this.add
      .text(GAME_WIDTH / 2, 118, 'Sola\'s Spell Smash', {
        fontFamily: FONT_FAMILY,
        fontSize: '76px',
        color: COLOR_STRINGS.primary,
        stroke: '#FFFFFF',
        strokeThickness: 10,
        shadow: { offsetX: 0, offsetY: 5, color: 'rgba(43,58,103,0.25)', blur: 0, fill: false, stroke: true },
        resolution: DPR,
      })
      .setOrigin(0.5);

    // Subtitle
    this.add
      .text(GAME_WIDTH / 2, 182, 'Spell words. Smash buildings.', {
        fontFamily: FONT_FAMILY,
        fontSize: '28px',
        color: COLOR_STRINGS.primary,
        stroke: '#FFFFFF',
        strokeThickness: 6,
        resolution: DPR,
      })
      .setOrigin(0.5);

    // --- Difficulty section ---
    this.add
      .text(GAME_WIDTH / 2, 255, 'Words', {
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
    this.createToggles();

    // --- Play button ---
    this.createPlayButton();

    // Apply defaults to runtimeConfig
    this.applySettings();
  }

  private createDifficultyButtons(): void {
    // Row 1: see-and-hear word lists. Row 2: silly words and sentence modes.
    const rows: { keys: Difficulty[]; y: number }[] = [
      { keys: ['short', 'medium', 'long', 'hard'], y: 290 },
      { keys: ['silly', 'suffixes', 'weekly'], y: 362 },
    ];

    const buttons: { key: Difficulty; cx: number; by: number; hy: number }[] = [];
    for (const row of rows) {
      const total = row.keys.length * BUTTON_W + (row.keys.length - 1) * BUTTON_GAP;
      const start = GAME_WIDTH / 2 - total / 2 + BUTTON_W / 2;
      row.keys.forEach((key, i) =>
        buttons.push({ key, cx: start + i * (BUTTON_W + BUTTON_GAP), by: row.y, hy: row.y + 32 })
      );
    }

    for (const pos of buttons) {
      const opt = DIFFICULTY_OPTIONS[pos.key];

      const bg = this.add.graphics();
      const label = this.add
        .text(pos.cx, pos.by, opt.label, {
          fontFamily: FONT_FAMILY,
          fontSize: '21px',
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
        .zone(pos.cx, pos.by, BUTTON_W, BUTTON_H)
        .setInteractive({ useHandCursor: true });

      const key = pos.key;
      zone.on('pointerdown', () => {
        this.selectedDifficulty = key;
        this.refreshDifficultyButtons();
        this.refreshToggles();
        this.applySettings();
      });

      this.difficultyButtons.push({ key, bg, label, hint, zone });
    }

    this.refreshDifficultyButtons();
  }

  private refreshDifficultyButtons(): void {
    const btnWidth = BUTTON_W;
    const btnHeight = BUTTON_H;

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

  /** "Show Word" and "Tough Buildings" checkboxes, side by side. */
  private createToggles(): void {
    const y = 535;
    this.showWordToggle = this.createToggle(GAME_WIDTH / 2 - 190, y, 'Show Word', () => {
      this.showWordEnabled = !this.showWordEnabled;
    });
    this.toughToggle = this.createToggle(GAME_WIDTH / 2 + 30, y, 'Tough Buildings', () => {
      this.toughEnabled = !this.toughEnabled;
    });
    this.refreshToggles();
  }

  private createToggle(x: number, y: number, text: string, onToggle: () => void): Toggle {
    const box = this.add.graphics();
    const check = this.add
      .text(x, y, '✓', {
        fontFamily: FONT_FAMILY,
        fontSize: '20px',
        color: COLOR_STRINGS.white,
        resolution: DPR,
      })
      .setOrigin(0.5);
    const label = this.add
      .text(x + 24, y, text, {
        fontFamily: FONT_FAMILY,
        fontSize: '20px',
        color: COLOR_STRINGS.neutral,
        resolution: DPR,
      })
      .setOrigin(0, 0.5);

    const width = label.width + 44;
    this.add
      .zone(x - 18 + width / 2, y, width, 36)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        onToggle();
        this.refreshToggles();
        this.applySettings();
      });

    return { x, y, box, check, label };
  }

  private refreshToggles(): void {
    // Sentence modes never flash the word, so Show Word doesn't apply there
    const showWordApplies = !DIFFICULTY_OPTIONS[this.selectedDifficulty].mode;
    this.drawToggle(this.showWordToggle, this.showWordEnabled, showWordApplies);
    this.drawToggle(this.toughToggle, this.toughEnabled, true);
  }

  private drawToggle(t: Toggle, on: boolean, enabled: boolean): void {
    const size = 28;
    t.box.clear();
    if (on) {
      t.box.fillStyle(COLORS.secondary, 1);
      t.box.fillRoundedRect(t.x - size / 2, t.y - size / 2, size, size, 6);
    } else {
      t.box.lineStyle(2, COLORS.neutral, 0.5);
      t.box.strokeRoundedRect(t.x - size / 2, t.y - size / 2, size, size, 6);
    }
    t.check.setVisible(on);
    for (const obj of [t.box, t.check, t.label]) obj.setAlpha(enabled ? 1 : 0.35);
  }

  private createPlayButton(): void {
    const w = 220;
    const h = 70;
    const x = GAME_WIDTH / 2;
    const y = 610;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.15);
    shadow.fillRoundedRect(x - w / 2 + 3, y - h / 2 + 6, w, h, 18);

    const bg = this.add.graphics();
    const draw = (color: number) => {
      bg.clear();
      drawBeveledPanel(bg, x - w / 2, y - h / 2, w, h, color, 1, 18);
    };
    draw(COLORS.secondary);

    this.add
      .text(x, y, 'PLAY', {
        fontFamily: FONT_FAMILY,
        fontSize: '38px',
        color: COLOR_STRINGS.white,
        shadow: { offsetX: 0, offsetY: 2, color: 'rgba(0,0,0,0.2)', blur: 0, fill: true },
        resolution: DPR,
      })
      .setOrigin(0.5);

    const hitZone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    hitZone.on('pointerover', () => draw(shade(COLORS.secondary, 0.9)));
    hitZone.on('pointerout', () => draw(COLORS.secondary));
    hitZone.on('pointerdown', () => this.scene.start('GameScene'));
  }

  /** Decorative stack of building blocks standing on the ground. */
  private createToyTower(cx: number, themeIndex: number, rows: number): void {
    const theme = getTheme(themeIndex);
    const bw = 44;
    const bh = 26;
    const groundY = LAYOUT.groundY;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < 2; col++) {
        const color = theme.blocks[(row + col) % theme.blocks.length];
        const variant = (row * 3 + col) % 3 === 0 ? 'lit' : 'dark';
        this.add
          .image(cx + (col - 0.5) * bw, groundY - bh / 2 - row * bh, blockTexture(this, bw - 2, bh - 2, color, variant))
          .setDisplaySize(bw - 2, bh - 2);
      }
    }
    this.add
      .image(cx, groundY - rows * bh - bh / 2, roofTexture(this, bw * 2 - 2, bh + 6, theme.roof))
      .setDisplaySize(bw * 2 - 2, bh + 6)
      .setOrigin(0.5, 0.6);
  }

  update(_time: number, delta: number): void {
    this.scenery.update(delta);
  }

  private applySettings(): void {
    const opt = DIFFICULTY_OPTIONS[this.selectedDifficulty];
    runtimeConfig.difficultyMin = opt.min;
    runtimeConfig.difficultyMax = opt.max;
    runtimeConfig.sessionLength = this.sessionLength;
    runtimeConfig.showWord = this.showWordEnabled;
    runtimeConfig.toughBuildings = this.toughEnabled;
    runtimeConfig.isSillyMode = this.selectedDifficulty === 'silly';
    runtimeConfig.wordMode = opt.mode ?? 'classic';
  }
}
