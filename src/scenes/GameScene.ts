import Phaser from 'phaser';
import { GUARD_PALETTE, ORIGIN_X, ORIGIN_Y, PALETTE, SCALE, SPRITE_W, buildEnvironment, hasTorch, princeFrame, variantAt } from '../art';
import type { Img, PrinceFrame } from '../art';
import type { Guard } from '../combat';
import type { Tile } from '../contracts';
import { KeyboardInput } from '../input';
import { DUEL_LEVEL, HAZARD_LEVEL, HAZARD_OBJECTS, MIRROR, MIRROR_LEVEL, TEST_LEVEL, duelGuards, parseAscii } from '../level';
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
  potion: { small: 0xd04050, large: 0xe05080, poison: 0x50c050 },
};

/** Picks which of the shared sprite poses a guard should wear. */
function guardSprite(g: Guard): { state: PlayerState; dx: number } {
  if (g.state === 'dead') return { state: 'dead', dx: 0 };
  if (g.state === 'fall') return { state: 'fall', dx: 0 };
  if (g.fightAction !== 'none' && g.fightAction !== 'ready') return { state: g.fightAction, dx: 0 };
  return { state: g.state === 'idle' ? 'idle' : 'ready', dx: 0 };
}

/** The reflection is drawn as a dark, cold silhouette of the prince's own palette. */
const SHADOW_PALETTE: Record<number, number> = Object.fromEntries(
  Object.entries(PALETTE).map(([k, c]) => {
    const l = (((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11) / 255;
    return [Number(k), (Math.round(20 + l * 40) << 16) | (Math.round(20 + l * 45) << 8) | Math.round(50 + l * 80)];
  }),
);

function startLevel(): Simulation {
  // ?level=move loads the plain movement arena, ?level=duel[&skill=1..5] a sword fight, ?level=mirror the shadow; hazards are the default.
  const q = new URLSearchParams(window.location.search);
  const level = q.get('level');
  if (level === 'mirror') return new Simulation(parseAscii(MIRROR_LEVEL, [], { hasSword: true, mirror: MIRROR }));
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
  private pool: Phaser.GameObjects.Image[] = [];
  private poolUsed = 0;

  constructor() {
    super('GameScene');
  }

  /** Uploads the procedural environment art once as nearest-filtered textures. */
  private buildTextures(): void {
    if (this.textures.exists('env:back0')) return;
    const env = buildEnvironment();
    const add = (key: string, img: Img): void => {
      const tex = this.textures.createCanvas(`env:${key}`, img.w, img.h);
      if (!tex) return;
      tex.getContext().putImageData(new ImageData(new Uint8ClampedArray(img.data), img.w, img.h), 0, 0);
      tex.refresh();
      tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    };
    env.back.forEach((im, i) => add(`back${i}`, im));
    env.wall.forEach((im, i) => add(`wall${i}`, im));
    env.floor.forEach((im, i) => add(`floor${i}`, im));
    add('loose', env.loose);
    add('plateUp', env.plateUp);
    add('plateDown', env.plateDown);
    add('pillar', env.pillar);
    add('mirror', env.mirror);
    add('mirrorActive', env.mirrorActive);
    add('exitShut', env.exitShut);
    add('exitOpen', env.exitOpen);
    add('torch', env.torch);
  }

  /** Places a pooled image; depth orders layers (back wall < tiles < props < the graphics layer). */
  private put(key: string, x: number, y: number, depth: number): void {
    let img = this.pool[this.poolUsed];
    if (!img) {
      img = this.add.image(0, 0, `env:${key}`).setOrigin(0, 0).setScale(1 / SCALE);
      this.pool.push(img);
    }
    this.poolUsed++;
    img.setTexture(`env:${key}`).setPosition(x, y).setDepth(depth).setVisible(true);
  }

  create(): void {
    this.sim = startLevel();
    this.completed = false;
    this.pool = [];
    this.buildTextures();
    this.sim.bus.on('level:completed', () => (this.completed = true));
    this.keys = new KeyboardInput(this);
    this.gfx = this.add.graphics().setDepth(0);
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

  private drawTile(t: Tile, x: number, y: number, wx: number, wy: number): void {
    const g = this.gfx;
    const v = variantAt(wx, wy);
    const floorImg = (key = `floor${v}`, dx = 0): void => this.put(key, x + dx, y + SLAB_Y, -2);

    if (t.type === 'wall') return this.put(`wall${v}`, x, y, -2);
    if (t.type === 'pillar') return this.put('pillar', x, y, -2);
    this.put(`back${v}`, x, y, -3);
    if (t.type === 'empty' && hasTorch(wx, wy)) {
      this.put('torch', x + 13, y + 4, -1);
      this.drawFlame(x + 16, y + 6, wx);
    }

    switch (t.type) {
      case 'loose': {
        // Shake sideways by a pixel while crumbling.
        const dx = t.state === 1 ? (this.sim.tick % 2 === 0 ? -1 : 1) : 0;
        floorImg('loose', dx);
        break;
      }
      case 'spikes': {
        floorImg();
        const h = t.state === SpikePhase.Up ? 14 : t.state === SpikePhase.Hidden ? 0 : 7;
        g.fillStyle(0x2a2a34).fillRect(x + 2, y + SLAB_Y - 1, 28, 1);
        for (let i = 0; i < 4 && h > 0; i++) {
          const bx = x + 2 + i * 7;
          g.fillStyle(0x7a7a8c).fillTriangle(bx, y + SLAB_Y - 1, bx + 3.5, y + SLAB_Y - 1 - h, bx + 7, y + SLAB_Y - 1);
          g.fillStyle(0xdcdcec).fillTriangle(bx, y + SLAB_Y - 1, bx + 3.5, y + SLAB_Y - 1 - h, bx + 3.5, y + SLAB_Y - 1);
        }
        break;
      }
      case 'gate': {
        floorImg();
        // Gate state is openness (0 closed .. 1 open); the portcullis lifts as it opens.
        const h = Math.round((1 - t.state) * SLAB_Y);
        g.fillStyle(0x23232e).fillRect(x + 8, y, 16, 3); // the housing the gate retracts into
        if (h > 0) {
          const top = y + SLAB_Y - h;
          for (let i = 0; i < 4; i++) {
            g.fillStyle(0x2a3a44).fillRect(x + 9 + i * 4, top, 2, h);
            g.fillStyle(0x8aa8b8).fillRect(x + 9 + i * 4, top, 1, h);
          }
          g.fillStyle(0x3a5060).fillRect(x + 8, top, 16, 2).fillRect(x + 8, top + Math.floor(h / 2), 16, 2);
          g.fillStyle(0xb0c8d4).fillRect(x + 8, top, 16, 1);
        }
        break;
      }
      case 'plate':
        floorImg();
        this.put(t.state ? 'plateDown' : 'plateUp', x + 6, y + SLAB_Y - (t.state ? 2 : 4), -1);
        break;
      case 'chomper': {
        floorImg();
        // 0 open, 1 closing/opening, 2 closed
        const h = t.state === 2 ? 24 : t.state === 1 ? 12 : 4;
        for (const bx of [x + 4, x + 22]) {
          g.fillStyle(0x6a1c1c).fillRect(bx, y + SLAB_Y - h, 6, h);
          g.fillStyle(0xd05050).fillRect(bx, y + SLAB_Y - h, 4, h);
          g.fillStyle(0xf09090).fillRect(bx, y + SLAB_Y - h, 1, h);
          g.fillStyle(0xe8e8f0);
          for (let ty = y + SLAB_Y - h + 2; ty < y + SLAB_Y - 2; ty += 4) {
            g.fillTriangle(bx + (bx < x + 10 ? 6 : 0), ty, bx + (bx < x + 10 ? 9 : -3), ty + 2, bx + (bx < x + 10 ? 6 : 0), ty + 4);
          }
        }
        if (t.state === 2) g.fillStyle(0x4a1414).fillRect(x + 4, y + SLAB_Y - 24, 24, 4).fillStyle(0xd05050).fillRect(x + 4, y + SLAB_Y - 24, 24, 2);
        break;
      }
      case 'exit':
        floorImg();
        this.put(t.state ? 'exitOpen' : 'exitShut', x + 3, y - 2, -1);
        break;
      case 'floor':
        floorImg();
        break;
      default:
        break;
    }
  }

  /** A flickering torch flame with a faint warm glow; purely visual, so it uses the render clock. */
  private drawFlame(x: number, y: number, seed: number): void {
    const g = this.gfx;
    const f = Math.sin(this.time.now / 90 + seed * 1.7) * 0.5 + Math.sin(this.time.now / 47 + seed) * 0.5;
    for (let r = 6; r >= 1; r--) g.fillStyle(0xff9a30, 0.022).fillCircle(x, y, 4 + r * 4.2 + f * 0.8);
    const h = 7 + f * 1.5;
    g.fillStyle(0xe05a1c).fillTriangle(x - 3, y + 3, x + 3, y + 3, x + f, y - h);
    g.fillStyle(0xffa83c).fillTriangle(x - 2, y + 3, x + 2, y + 3, x + f * 0.6, y - h * 0.72);
    g.fillStyle(0xfff2a8).fillTriangle(x - 1, y + 3, x + 1, y + 3, x + f * 0.3, y - h * 0.4);
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
    this.poolUsed = 0;
    for (let ty = 0; ty < SCREEN_TILES_H; ty++) {
      for (let tx = 0; tx < SCREEN_TILES_W; tx++) {
        const t = grid.get(ox + tx, oy + ty);
        this.drawTile(t, tx * TILE_SIZE, VIEW_Y + ty * TILE_SIZE, ox + tx, oy + ty);
      }
    }

    for (const o of this.sim.objects) {
      if (!(o instanceof Potion) || o.consumed) continue;
      if (o.tx < ox || o.tx >= ox + SCREEN_TILES_W || o.ty < oy || o.ty >= oy + SCREEN_TILES_H) continue;
      const x = (o.tx - ox) * TILE_SIZE + 16;
      const y = VIEW_Y + (o.ty - oy) * TILE_SIZE + SLAB_Y;
      const c = COLORS.potion[o.kind];
      this.gfx.fillStyle(0x1c1c28).fillRect(x - 4, y - 9, 8, 9).fillRect(x - 2, y - 12, 4, 4);
      this.gfx.fillStyle(0x9ab8c8).fillRect(x - 3, y - 8, 6, 7);
      this.gfx.fillStyle(c).fillRect(x - 3, y - 6, 6, 5);
      this.gfx.fillStyle(0xffffff, 0.7).fillRect(x - 2, y - 7, 1, 5);
      this.gfx.fillStyle(0x8a5a30).fillRect(x - 1, y - 13, 2, 2);
    }

    const mir = this.sim.mirror;
    if (mir && mir.tx >= ox && mir.tx < ox + SCREEN_TILES_W) {
      const mx = (mir.tx - ox) * TILE_SIZE + 3;
      const my = VIEW_Y + (mir.ty - oy) * TILE_SIZE + SLAB_Y - 36;
      const lit = this.sim.shadow !== undefined;
      if (lit) this.gfx.fillStyle(0x70d8ff, 0.1).fillCircle(mx + 13, my + 18, 30).fillStyle(0x70d8ff, 0.1).fillCircle(mx + 13, my + 18, 20);
      this.put(lit ? 'mirrorActive' : 'mirror', mx, my, -1);
    }
    // Hide pooled images that this frame did not need.
    for (let i = this.poolUsed; i < this.pool.length; i++) this.pool[i]!.setVisible(false);
    const px = player.x - ox * TILE_SIZE;
    const feet = VIEW_Y + (player.ty - oy) * TILE_SIZE + SLAB_Y;
    for (const g of this.sim.guards) {
      if (g.tx < ox || g.tx >= ox + SCREEN_TILES_W || g.ty < oy || g.ty >= oy + SCREEN_TILES_H) continue;
      const gs = guardSprite(g);
      this.drawFighter(princeFrame(gs.state, g.frame, 4, 0, 'guard'), g.x - ox * TILE_SIZE, VIEW_Y + (g.ty - oy) * TILE_SIZE + SLAB_Y, g.facing, GUARD_PALETTE, gs.dx);
    }
    const sh = this.sim.shadow;
    if (sh && sh.tx >= ox && sh.tx < ox + SCREEN_TILES_W) {
      const ss = princeFrame(sh.state, sh.frame, sh.landDuration, sh.fallPhase);
      this.drawFighter(ss, sh.x - ox * TILE_SIZE, VIEW_Y + (sh.ty - oy) * TILE_SIZE + SLAB_Y, sh.facing, SHADOW_PALETTE);
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
