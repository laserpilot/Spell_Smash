import Phaser from 'phaser';
import { DPR, GAME_WIDTH, GAME_HEIGHT, COLORS, PHYSICS } from './config';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { GameScene } from './scenes/GameScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: Math.round(GAME_WIDTH * DPR),
  height: Math.round(GAME_HEIGHT * DPR),
  parent: 'game-container',
  backgroundColor: COLORS.background,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
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

const game = new Phaser.Game(config);

game.events.once('ready', () => {
  const canvas = game.canvas;
  console.group('=== Sola Render Diagnostics ===');
  console.log('devicePixelRatio:', window.devicePixelRatio);
  console.log('Config size:', Math.round(GAME_WIDTH * DPR), '×', Math.round(GAME_HEIGHT * DPR), '(base:', GAME_WIDTH, '×', GAME_HEIGHT, '× DPR)');
  console.log('Camera zoom:', DPR);
  console.log('Canvas internal:', canvas.width, '×', canvas.height);
  console.log('Canvas CSS:', canvas.clientWidth, '×', canvas.clientHeight);
  console.log('Effective ratio (internal/CSS):', (canvas.width / canvas.clientWidth).toFixed(2), '×', (canvas.height / canvas.clientHeight).toFixed(2));
  console.log('Renderer type:', game.renderer.type === 1 ? 'Canvas2D' : 'WebGL');
  console.log('Renderer resolution:', (game.renderer as any).config?.resolution ?? 'N/A');
  console.groupEnd();
});
