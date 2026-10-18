import Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create(): void {
    this.add.text(8, 8, 'Persian Prince - prototype', { fontSize: '12px', color: '#e8d8a8' });
  }
}
