import Phaser from 'phaser';
import { DPR, GAME_WIDTH, GAME_HEIGHT, COLORS, PHYSICS } from './config';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { GameScene } from './scenes/GameScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: COLORS.background,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    zoom: DPR,
  },
  render: {
    antialias: true,
  },
  physics: {
    default: 'matter',
    matter: {
      gravity: PHYSICS.gravity,
      debug: false,
    },
  },
  scene: [BootScene, MainMenuScene, GameScene],
};

new Phaser.Game(config);
