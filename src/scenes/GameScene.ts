import Phaser from 'phaser';
import { KeyboardInput } from '../input';
import { TEST_LEVEL, parseAscii } from '../level';
import { TICK_RATE } from '../player';
import { Simulation } from '../sim';
import { SCREEN_TILES_H, SCREEN_TILES_W, TILE_SIZE } from '../world';

const TICK_MS = 1000 / TICK_RATE;
const VIEW_Y = 20; // leaves room above the 3-row screen for the HUD later
const COLORS = {
  floor: 0x8a7a5a,
  wall: 0x4a4a5a,
  other: 0xaa5555,
  player: 0xe8d8a8,
  dead: 0x884444,
};

export class GameScene extends Phaser.Scene {
  private sim!: Simulation;
  private keys!: KeyboardInput;
  private gfx!: Phaser.GameObjects.Graphics;
  private debug!: Phaser.GameObjects.Text;
  private acc = 0;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.sim = new Simulation(parseAscii(TEST_LEVEL));
    this.keys = new KeyboardInput(this);
    this.gfx = this.add.graphics();
    this.debug = this.add.text(4, 150, '', { fontSize: '8px', color: '#9a9ab0' });
    this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.R).on('down', () => this.scene.restart());
  }

  update(_time: number, delta: number): void {
    this.keys.sample();
    // Fixed timestep: render every frame, advance the simulation at TICK_RATE.
    this.acc = Math.min(this.acc + delta, TICK_MS * 5);
    while (this.acc >= TICK_MS) {
      this.acc -= TICK_MS;
      this.sim.step(this.keys.poll());
    }
    this.draw();
  }

  private draw(): void {
    const { grid, player } = this.sim;
    const sx = Math.floor(player.tx / SCREEN_TILES_W);
    const sy = Math.floor(player.ty / SCREEN_TILES_H);
    const ox = sx * SCREEN_TILES_W;
    const oy = sy * SCREEN_TILES_H;

    this.gfx.clear();
    for (let ty = 0; ty < SCREEN_TILES_H; ty++) {
      for (let tx = 0; tx < SCREEN_TILES_W; tx++) {
        const t = grid.get(ox + tx, oy + ty);
        if (t.type === 'empty') continue;
        const x = tx * TILE_SIZE;
        const y = VIEW_Y + ty * TILE_SIZE;
        if (t.type === 'wall' || t.type === 'pillar') {
          this.gfx.fillStyle(COLORS.wall).fillRect(x, y, TILE_SIZE, TILE_SIZE);
        } else {
          // Floor is a slab at the bottom of its cell; characters stand on top of it.
          this.gfx.fillStyle(t.type === 'floor' ? COLORS.floor : COLORS.other).fillRect(x, y + 24, TILE_SIZE, 8);
        }
      }
    }

    const px = player.x - ox * TILE_SIZE;
    const feet = VIEW_Y + (player.ty - oy) * TILE_SIZE + 24;
    const h = player.state === 'crouch' ? 18 : 30;
    this.gfx.fillStyle(player.state === 'dead' ? COLORS.dead : COLORS.player).fillRect(px - 6, feet - h, 12, h);
    // Nose pixel shows facing direction.
    this.gfx.fillStyle(0x202030).fillRect(px + (player.facing === 1 ? 2 : -6), feet - h + 4, 4, 3);

    this.debug.setText(
      `${player.state}  tile ${player.tx},${player.ty}  hp ${player.hp}/${player.maxHp}  tick ${this.sim.tick}\n` +
        'Arrows/WASD move  Shift step  Up jump  Down crouch/drop  R restart',
    );
  }
}
