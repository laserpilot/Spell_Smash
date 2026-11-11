import Phaser from 'phaser';
import { WebFontFile } from '../WebFontFile';
import { DPR, FONT_FAMILY, COLOR_STRINGS, GAME_WIDTH, GAME_HEIGHT } from '../config';
import { createSharedTextures } from '../art/textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    this.cameras.main.setZoom(DPR).setOrigin(0, 0);

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
    createSharedTextures(this);

    this.scene.start('MainMenuScene');
  }
}
