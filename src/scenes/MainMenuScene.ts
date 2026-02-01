import Phaser from 'phaser';
import { FONT_FAMILY, COLOR_STRINGS, COLORS, GAME_WIDTH, GAME_HEIGHT } from '../config';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create(): void {
    // Title
    this.add
      .text(GAME_WIDTH / 2, 200, 'Sola\'s Spell Blaster', {
        fontFamily: FONT_FAMILY,
        fontSize: '72px',
        color: COLOR_STRINGS.primary,
      })
      .setOrigin(0.5);

    // Subtitle
    this.add
      .text(GAME_WIDTH / 2, 280, 'Spell words. Smash buildings.', {
        fontFamily: FONT_FAMILY,
        fontSize: '28px',
        color: COLOR_STRINGS.neutral,
      })
      .setOrigin(0.5);

    // Play button background
    const buttonWidth = 220;
    const buttonHeight = 70;
    const buttonX = GAME_WIDTH / 2;
    const buttonY = 420;

    const buttonBg = this.add.graphics();
    buttonBg.fillStyle(COLORS.secondary, 1);
    buttonBg.fillRoundedRect(
      buttonX - buttonWidth / 2,
      buttonY - buttonHeight / 2,
      buttonWidth,
      buttonHeight,
      16
    );

    const buttonText = this.add
      .text(buttonX, buttonY, 'PLAY', {
        fontFamily: FONT_FAMILY,
        fontSize: '36px',
        color: COLOR_STRINGS.white,
      })
      .setOrigin(0.5);

    // Make button interactive
    const hitArea = new Phaser.Geom.Rectangle(
      buttonX - buttonWidth / 2,
      buttonY - buttonHeight / 2,
      buttonWidth,
      buttonHeight
    );
    const hitZone = this.add
      .zone(buttonX, buttonY, buttonWidth, buttonHeight)
      .setInteractive({ useHandCursor: true });

    hitZone.on('pointerover', () => {
      buttonBg.clear();
      buttonBg.fillStyle(0x52b0a5, 1); // slightly darker mint
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
}
