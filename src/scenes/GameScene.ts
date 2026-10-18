import Phaser from 'phaser';
import { GUARD_PALETTE, ORIGIN_X, ORIGIN_Y, PALETTE, SCALE, SPRITE_W, princeFrame } from '../art';
import type { PrinceFrame } from '../art';
import type { Guard } from '../combat';
import type { Tile } from '../contracts';
import { KeyboardInput } from '../input';
import { DUEL_LEVEL, HAZARD_LEVEL, HAZARD_OBJECTS, TEST_LEVEL, duelGuards, parseAscii } from '../level';
import { RENDER_SCALE } from '../config';
import { Potion, SpikePhase } from '../objects';
import { TICK_RATE } from '../player';
import type { PlayerState } from '../player';
import { Simulation } from '../sim';
import { SCREEN_TILES_H, SCREEN_TILES_W, TILE_SIZE } from '../world';

const TICK_MS = 1000 / TICK_RATE;
const VIEW_Y = 20; // leaves room above the 3-row screen for the HUD later
const SLAB_Y = 24; // floor slab offset inside a tile; characters stand on top of it
const COLORS = {
  floor: 0x8a7a5a,
  wall: 0x4a4a5a,
  spike: 0xc8c8d8,
  gate: 0x6a8a9a,
  blade: 0xd05050,
  plateUp: 0x7a6a4a,
  plateDown: 0x5a8a5a,
  exitShut: 0x553322,
  exitOpen: 0xe8c860,
  player: 0xe8d8a8,
  dead: 0x884444,
  potion: { small: 0xd04050, large: 0xe05080, poison: 0x50c050 },
};

/** Picks which of the shared sprite poses a guard should wear. */
function guardSprite(g: Guard): { state: PlayerState; dx: number } {
  if (g.state === 'dead') return { state: 'dead', dx: 0 };
  if (g.state === 'fall') return { state: 'fall', dx: 0 };
  if (g.fightAction !== 'none' && g.fightAction !== 'ready') return { state: g.fightAction, dx: 0 };
  return { state: g.state === 'idle' ? 'idle' : 'ready', dx: 0 };
}

function startLevel(): Simulation {
  // ?level=move loads the plain movement arena, ?level=duel[&skill=1..5] a sword fight; hazards are the default.
  const q = new URLSearchParams(window.location.search);
  const level = q.get('level');
  if (level === 'duel') {
    const skill = Math.min(5, Math.max(1, Number(q.get('skill')) || 1)) as 1 | 2 | 3 | 4 | 5;
    return new Simulation(parseAscii(DUEL_LEVEL, [], { hasSword: true, guards: duelGuards(skill) }), Number(q.get('seed')) || 1);
  }
  return new Simulation(level === 'move' ? parseAscii(TEST_LEVEL) : parseAscii(HAZARD_LEVEL, HAZARD_OBJECTS));
}

export class GameScene extends Phaser.Scene {
  private sim!: Simulation;
  private keys!: KeyboardInput;
  private gfx!: Phaser.GameObjects.Graphics;
  private debug!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private acc = 0;
  private completed = false;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.sim = startLevel();
    this.completed = false;
    this.sim.bus.on('level:completed', () => (this.completed = true));
    this.keys = new KeyboardInput(this);
    this.gfx = this.add.graphics();
    // Zoom around the top-left corner so world coordinates still start at (0,0).
    this.cameras.main.setZoom(RENDER_SCALE).centerOn(160, 100);
    // Text is rendered at full resolution and scaled back down, otherwise the zoom would blur it.
    this.debug = this.add.text(4, 150, '', { fontSize: `${8 * RENDER_SCALE}px`, color: '#9a9ab0' }).setScale(1 / RENDER_SCALE);
    this.banner = this.add
      .text(160, 8, '', { fontSize: `${10 * RENDER_SCALE}px`, color: '#e8d8a8' })
      .setOrigin(0.5, 0)
      .setScale(1 / RENDER_SCALE);
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

  private drawTile(t: Tile, x: number, y: number): void {
    const g = this.gfx;
    const slab = (color: number, h = 8) => g.fillStyle(color).fillRect(x, y + SLAB_Y + (8 - h), TILE_SIZE, h);

    switch (t.type) {
      case 'wall':
      case 'pillar':
        g.fillStyle(COLORS.wall).fillRect(x, y, TILE_SIZE, TILE_SIZE);
        break;
      case 'loose': {
        // Shake sideways by a pixel while crumbling.
        const dx = t.state === 1 ? (this.sim.tick % 2 === 0 ? -1 : 1) : 0;
        g.fillStyle(COLORS.floor).fillRect(x + dx, y + SLAB_Y, TILE_SIZE, 8);
        g.fillStyle(0x5a4a30).fillRect(x + dx + 8, y + SLAB_Y + 3, 16, 1);
        break;
      }
      case 'spikes': {
        slab(COLORS.floor);
        const h = t.state === SpikePhase.Up ? 14 : t.state === SpikePhase.Hidden ? 0 : 7;
        for (let i = 0; i < 4 && h > 0; i++) {
          g.fillStyle(COLORS.spike).fillTriangle(x + i * 8, y + SLAB_Y, x + i * 8 + 4, y + SLAB_Y - h, x + i * 8 + 8, y + SLAB_Y);
        }
        break;
      }
      case 'gate': {
        slab(COLORS.floor);
        // Gate state is openness (0 closed .. 1 open); the portcullis lifts as it opens.
        const h = Math.round((1 - t.state) * SLAB_Y);
        if (h > 0) g.fillStyle(COLORS.gate).fillRect(x + 12, y + SLAB_Y - h, 8, h);
        break;
      }
      case 'plate':
        slab(COLORS.floor);
        g.fillStyle(t.state ? COLORS.plateDown : COLORS.plateUp).fillRect(x + 6, y + SLAB_Y - (t.state ? 0 : 2), 20, t.state ? 2 : 4);
        break;
      case 'chomper': {
        slab(COLORS.floor);
        // 0 open, 1 closing/opening, 2 closed
        const h = t.state === 2 ? 24 : t.state === 1 ? 12 : 4;
        g.fillStyle(COLORS.blade).fillRect(x + 4, y + SLAB_Y - h, 6, h).fillRect(x + 22, y + SLAB_Y - h, 6, h);
        if (t.state === 2) g.fillRect(x + 4, y + SLAB_Y - 24, 24, 4);
        break;
      }
      case 'exit':
        slab(COLORS.floor);
        g.fillStyle(t.state ? COLORS.exitOpen : COLORS.exitShut).fillRect(x + 6, y + 2, 20, SLAB_Y - 2);
        break;
      case 'floor':
        slab(COLORS.floor);
        break;
      default:
        break;
    }
  }

  private drawFighter(sprite: PrinceFrame, x: number, feet: number, facing: 1 | -1, palette: Record<number, number>, extraDx = 0): void {
    const flip = (facing === -1) !== sprite.mirror;
    // Runs are in device pixels (1/SCALE of a world px); positions snap to that grid so edges stay crisp.
    const snap = (v: number): number => Math.round(v * SCALE) / SCALE;
    const baseX = x + (sprite.dx + extraDx) * facing - ORIGIN_X;
    const baseY = feet + sprite.dy - ORIGIN_Y;
    const width = SPRITE_W * SCALE;
    for (const run of sprite.runs) {
      this.gfx.fillStyle(palette[run.c]!);
      const rx = flip ? width - run.x - run.len : run.x;
      this.gfx.fillRect(snap(baseX) + rx / SCALE, snap(baseY) + run.y / SCALE, run.len / SCALE, 1 / SCALE);
    }
  }

  private draw(): void {
    const { grid, player } = this.sim;
    const ox = Math.floor(player.tx / SCREEN_TILES_W) * SCREEN_TILES_W;
    const oy = Math.floor(player.ty / SCREEN_TILES_H) * SCREEN_TILES_H;

    this.gfx.clear();
    for (let ty = 0; ty < SCREEN_TILES_H; ty++) {
      for (let tx = 0; tx < SCREEN_TILES_W; tx++) {
        const t = grid.get(ox + tx, oy + ty);
        if (t.type !== 'empty') this.drawTile(t, tx * TILE_SIZE, VIEW_Y + ty * TILE_SIZE);
      }
    }

    for (const o of this.sim.objects) {
      if (!(o instanceof Potion) || o.consumed) continue;
      if (o.tx < ox || o.tx >= ox + SCREEN_TILES_W || o.ty < oy || o.ty >= oy + SCREEN_TILES_H) continue;
      const x = (o.tx - ox) * TILE_SIZE + 16;
      const y = VIEW_Y + (o.ty - oy) * TILE_SIZE + SLAB_Y;
      this.gfx.fillStyle(COLORS.potion[o.kind]).fillRect(x - 3, y - 8, 6, 8).fillRect(x - 1, y - 11, 2, 3);
    }

    const px = player.x - ox * TILE_SIZE;
    const feet = VIEW_Y + (player.ty - oy) * TILE_SIZE + SLAB_Y;
    for (const g of this.sim.guards) {
      if (g.tx < ox || g.tx >= ox + SCREEN_TILES_W || g.ty < oy || g.ty >= oy + SCREEN_TILES_H) continue;
      const gs = guardSprite(g);
      this.drawFighter(princeFrame(gs.state, g.frame, 4, 0), g.x - ox * TILE_SIZE, VIEW_Y + (g.ty - oy) * TILE_SIZE + SLAB_Y, g.facing, GUARD_PALETTE, gs.dx);
    }
    const sprite = princeFrame(player.state, player.frame, player.landDuration, player.fallPhase);
    this.drawFighter(sprite, px, feet + 0, player.facing, PALETTE);
    this.banner.setText(this.completed ? 'LEVEL COMPLETE - press R' : player.state === 'dead' ? 'YOU DIED - press R' : '');
    const g0 = this.sim.guards[0];
    this.debug.setText(
      `${player.state}  tile ${player.tx},${player.ty}  hp ${player.hp}/${player.maxHp}  tick ${this.sim.tick}` +
        (g0 ? `  guard ${g0.state}/${g0.fightAction} hp ${g0.hp}` : '') +
        '\nArrows/WASD move  Shift step  Up jump  Down crouch/drink  Space sword/strike  Up parry  R restart',
    );
  }
}
