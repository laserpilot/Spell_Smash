import Phaser from 'phaser';
import { WebFontFile } from '../WebFontFile';
import { FONT_FAMILY, COLOR_STRINGS, GAME_WIDTH, GAME_HEIGHT } from '../config';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Loading...', {
        fontSize: '24px',
        color: COLOR_STRINGS.primary,
      })
      .setOrigin(0.5);

    this.load.addFile(new WebFontFile(this.load, FONT_FAMILY));
  }

  create(): void {
    this.scene.start('MainMenuScene');
  }
}
