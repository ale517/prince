import Phaser from 'phaser';
import { RENDER_SCALE, WORLD_H, WORLD_W } from './config';
import { GameScene } from './scenes/GameScene';

// Sprites carry sub-pixel detail, so pixel-perfect scaling is still done by the browser (spec 08).
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: WORLD_W * RENDER_SCALE,
  height: WORLD_H * RENDER_SCALE,
  pixelArt: true,
  backgroundColor: '#101018',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [GameScene],
});
