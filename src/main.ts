import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';

// Base resolution 320x200 scaled by an integer factor keeps pixel art crisp (spec 08).
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 320,
  height: 200,
  pixelArt: true,
  backgroundColor: '#101018',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [GameScene],
});
