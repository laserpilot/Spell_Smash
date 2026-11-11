import Phaser from 'phaser';
import { DPR, FONT_FAMILY, COLOR_STRINGS, COLORS, LAYOUT } from '../config';
import { runtimeConfig } from '../RuntimeConfig';
import { drawBeveledPanel } from '../art/draw';

export class InputManager {
  private scene: Phaser.Scene;
  private currentText = '';
  private displayText: Phaser.GameObjects.Text;
  private inputShadow: Phaser.GameObjects.Graphics;
  private inputBg: Phaser.GameObjects.Graphics;
  private cursorBlink: Phaser.Time.TimerEvent;
  private cursorVisible = true;
  private enabled = false;
  private hiddenInput: HTMLInputElement;

  public onSubmit: ((text: string) => void) | null = null;
  public onBackspace: (() => void) | null = null;
  public onKeyTyped: ((key: string, index: number) => void) | null = null;
  public onKeyDeleted: ((index: number) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Background for input area
    const inputWidth = 400;
    const inputHeight = 56;
    const ix = runtimeConfig.inputX;
    const iy = runtimeConfig.inputY;

    // Input shadow
    this.inputShadow = scene.add.graphics().setDepth(8).setScrollFactor(0);
    this.inputShadow.fillStyle(0x000000, 0.1);
    this.inputShadow.fillRoundedRect(
      ix - 8 + 3,
      iy - inputHeight / 2 - 4 + 4,
      inputWidth,
      inputHeight,
      12
    );

    this.inputBg = scene.add.graphics().setDepth(9).setScrollFactor(0);
    drawBeveledPanel(
      this.inputBg,
      ix - 8,
      iy - inputHeight / 2 - 4,
      inputWidth,
      inputHeight,
      0xffffff,
      0.9,
      12,
      COLORS.neutral
    );

    this.displayText = scene.add
      .text(ix + 8, iy, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '36px',
        color: COLOR_STRINGS.primary,
        resolution: DPR,
      })
      .setOrigin(0, 0.5)
      .setDepth(10)
      .setScrollFactor(0);

    // Hidden HTML input — triggers mobile soft keyboard when focused
    this.hiddenInput = document.createElement('input');
    this.hiddenInput.type = 'text';
    this.hiddenInput.autocomplete = 'off';
    this.hiddenInput.autocapitalize = 'none';
    this.hiddenInput.setAttribute('autocorrect', 'off');
    this.hiddenInput.setAttribute('enterkeyhint', 'go');
    this.hiddenInput.spellcheck = false;
    Object.assign(this.hiddenInput.style, {
      position: 'fixed',
      left: '0',
      bottom: '0',
      width: '100%',
      height: '48px',
      opacity: '0',
      zIndex: '-1',
      fontSize: '16px',  // ≥16px prevents iOS auto-zoom on focus
      border: 'none',
      outline: 'none',
      background: 'transparent',
      color: 'transparent',
      caretColor: 'transparent',
      padding: '0',
    });
    document.body.appendChild(this.hiddenInput);

    // Native input events (primary handler — works on both mobile and desktop)
    this.hiddenInput.addEventListener('input', this.handleNativeInput);
    this.hiddenInput.addEventListener('keydown', this.handleNativeKeydown);

    // Phaser keyboard fallback (desktop, when hidden input doesn't have focus)
    scene.input.keyboard!.on('keydown', this.handleKeyDown, this);

    // Re-focus hidden input on any canvas tap (triggers mobile keyboard)
    scene.input.on('pointerdown', () => {
      if (this.enabled) {
        this.hiddenInput.focus({ preventScroll: true });
      }
    });

    this.cursorBlink = scene.time.addEvent({
      delay: 500,
      callback: () => {
        this.cursorVisible = !this.cursorVisible;
        this.updateDisplay();
      },
      loop: true,
    });
  }

  /** Handles text changes from the hidden HTML input (mobile + desktop). */
  private handleNativeInput = (): void => {
    if (!this.enabled) return;

    const filtered = this.hiddenInput.value.toLowerCase().replace(/[^a-z]/g, '');

    if (filtered.length > this.currentText.length) {
      for (let i = this.currentText.length; i < filtered.length; i++) {
        const key = filtered[i];
        this.currentText += key;
        this.updateDisplay();
        if (this.onKeyTyped) this.onKeyTyped(key, this.currentText.length - 1);
      }
    } else if (filtered.length < this.currentText.length) {
      while (this.currentText.length > filtered.length) {
        const removedIndex = this.currentText.length - 1;
        this.currentText = this.currentText.slice(0, -1);
        this.updateDisplay();
        if (this.onBackspace) this.onBackspace();
        if (this.onKeyDeleted) this.onKeyDeleted(removedIndex);
      }
    }

    // Keep hidden input in sync (strip non-alpha chars)
    this.hiddenInput.value = this.currentText;
  };

  /** Handles Enter / Space submit from the hidden HTML input. */
  private handleNativeKeydown = (event: KeyboardEvent): void => {
    if (!this.enabled) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (this.currentText.length > 0 && this.onSubmit) {
        this.onSubmit(this.currentText);
      }
    }
  };

  /** Phaser keyboard fallback — only fires when hidden input is NOT focused. */
  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.enabled) return;
    if (document.activeElement === this.hiddenInput) return;

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
    this.hiddenInput.value = this.currentText;
    this.hiddenInput.focus({ preventScroll: true });
    this.updateDisplay();
  }

  disable(): void {
    this.enabled = false;
    this.hiddenInput.blur();
    this.updateDisplay();
  }

  clear(): void {
    this.currentText = '';
    this.hiddenInput.value = '';
    this.updateDisplay();
  }

  /** Display objects that belong to the fixed on-screen HUD. */
  getHudObjects(): Phaser.GameObjects.GameObject[] {
    return [this.inputShadow, this.inputBg, this.displayText];
  }

  getTypedText(): string {
    return this.currentText;
  }

  destroy(): void {
    this.scene.input.keyboard!.off('keydown', this.handleKeyDown, this);
    this.hiddenInput.removeEventListener('input', this.handleNativeInput);
    this.hiddenInput.removeEventListener('keydown', this.handleNativeKeydown);
    if (this.hiddenInput.parentNode) {
      this.hiddenInput.parentNode.removeChild(this.hiddenInput);
    }
    this.cursorBlink.destroy();
    this.displayText.destroy();
    this.inputShadow.destroy();
    this.inputBg.destroy();
  }
}
