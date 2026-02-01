import Phaser from 'phaser';
import { WebFontFile } from '../WebFontFile';
import { DPR, FONT_FAMILY, COLOR_STRINGS, GAME_WIDTH, GAME_HEIGHT } from '../config';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Loading...', {
        fontSize: '24px',
        color: COLOR_STRINGS.primary,
        resolution: DPR,
      })
      .setOrigin(0.5);

    this.load.addFile(new WebFontFile(this.load, FONT_FAMILY));
  }

  create(): void {
    // Generate a small particle texture for effects
    const gfx = this.add.graphics();
    gfx.fillStyle(0xffffff, 1);
    gfx.fillRect(0, 0, 6, 6);
    gfx.generateTexture('particle', 6, 6);
    gfx.destroy();

    this.scene.start('MainMenuScene');
  }
}
