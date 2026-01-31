import Phaser from 'phaser';
import { FONT_FAMILY, COLOR_STRINGS, COLORS, LAYOUT, GAME_WIDTH } from '../config';

export class InputManager {
  private scene: Phaser.Scene;
  private currentText = '';
  private displayText: Phaser.GameObjects.Text;
  private inputBg: Phaser.GameObjects.Graphics;
  private cursorBlink: Phaser.Time.TimerEvent;
  private cursorVisible = true;
  private enabled = false;

  public onSubmit: ((text: string) => void) | null = null;
  public onBackspace: (() => void) | null = null;
  public onKeyTyped: ((key: string, index: number) => void) | null = null;
  public onKeyDeleted: ((index: number) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Background for input area
    const inputWidth = 400;
    const inputHeight = 56;
    this.inputBg = scene.add.graphics().setDepth(9);
    this.inputBg.fillStyle(0xffffff, 0.9);
    this.inputBg.fillRoundedRect(
      LAYOUT.inputX - 8,
      LAYOUT.inputY - inputHeight / 2 - 4,
      inputWidth,
      inputHeight,
      12
    );
    this.inputBg.lineStyle(2, COLORS.neutral, 0.4);
    this.inputBg.strokeRoundedRect(
      LAYOUT.inputX - 8,
      LAYOUT.inputY - inputHeight / 2 - 4,
      inputWidth,
      inputHeight,
      12
    );

    this.displayText = scene.add
      .text(LAYOUT.inputX + 8, LAYOUT.inputY, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '36px',
        color: COLOR_STRINGS.primary,
      })
      .setOrigin(0, 0.5)
      .setDepth(10);

    scene.input.keyboard!.on('keydown', this.handleKeyDown, this);

    this.cursorBlink = scene.time.addEvent({
      delay: 500,
      callback: () => {
        this.cursorVisible = !this.cursorVisible;
        this.updateDisplay();
      },
      loop: true,
    });
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.enabled) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (this.currentText.length > 0 && this.onSubmit) {
        this.onSubmit(this.currentText);
      }
    } else if (event.key === 'Backspace') {
      if (this.currentText.length > 0) {
        const removedIndex = this.currentText.length - 1;
        this.currentText = this.currentText.slice(0, -1);
        this.updateDisplay();
        if (this.onBackspace) this.onBackspace();
        if (this.onKeyDeleted) this.onKeyDeleted(removedIndex);
      }
    } else if (event.key.length === 1 && /^[a-zA-Z]$/.test(event.key)) {
      const key = event.key.toLowerCase();
      this.currentText += key;
      this.updateDisplay();
      if (this.onKeyTyped) this.onKeyTyped(key, this.currentText.length - 1);
    }
  }

  private updateDisplay(): void {
    const cursor = this.enabled && this.cursorVisible ? '|' : '';
    this.displayText.setText(this.currentText + cursor);
  }

  enable(): void {
    this.enabled = true;
    this.updateDisplay();
  }

  disable(): void {
    this.enabled = false;
    this.updateDisplay();
  }

  clear(): void {
    this.currentText = '';
    this.updateDisplay();
  }

  getTypedText(): string {
    return this.currentText;
  }

  destroy(): void {
    this.scene.input.keyboard!.off('keydown', this.handleKeyDown, this);
    this.cursorBlink.destroy();
    this.displayText.destroy();
    this.inputBg.destroy();
  }
}
