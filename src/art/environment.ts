import { SCALE } from './prince';

/** RGBA pixels for one environment sprite, at device resolution (SCALE device px per world px). */
export interface Img {
  readonly w: number;
  readonly h: number;
  readonly data: Uint8ClampedArray;
}

const S = SCALE;
export const TILE_PX = 32 * S;
export const FLOOR_H = 12 * S; // 8px slab plus a 4px soft shadow beneath it

const clamp = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));
const mul = (c: number, f: number): number => (clamp(((c >> 16) & 255) * f) << 16) | (clamp(((c >> 8) & 255) * f) << 8) | clamp((c & 255) * f);
const mix = (a: number, b: number, t: number): number =>
  (clamp(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t) << 16) |
  (clamp(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t) << 8) |
  clamp((a & 255) * (1 - t) + (b & 255) * t);

/** Deterministic hash noise in [0, 1): the same tile always gets the same stones. */
function hash(x: number, y: number, s: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

class Canvas {
  readonly data: Uint8ClampedArray;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  px(x: number, y: number, color: number, a = 255): void {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const o = (y * this.w + x) * 4;
    const d = this.data;
    if (a >= 255 || d[o + 3] === 0) {
      d[o] = (color >> 16) & 255;
      d[o + 1] = (color >> 8) & 255;
      d[o + 2] = color & 255;
      d[o + 3] = a;
      return;
    }
    const t = a / 255;
    d[o] = d[o]! * (1 - t) + ((color >> 16) & 255) * t;
    d[o + 1] = d[o + 1]! * (1 - t) + ((color >> 8) & 255) * t;
    d[o + 2] = d[o + 2]! * (1 - t) + (color & 255) * t;
    d[o + 3] = Math.max(d[o + 3]!, a);
  }

  get(x: number, y: number): number {
    const o = (y * this.w + x) * 4;
    return (this.data[o]! << 16) | (this.data[o + 1]! << 8) | this.data[o + 2]!;
  }

  tint(x: number, y: number, f: number): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    if (this.data[(y * this.w + x) * 4 + 3] === 0) return;
    this.px(x, y, mul(this.get(x, y), f));
  }

  rect(x: number, y: number, w: number, h: number, color: number, a = 255): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, color, a);
  }

  img(): Img {
    return { w: this.w, h: this.h, data: this.data };
  }
}

interface Bricks {
  bw: number;
  bh: number;
  mortar: number;
  base: number;
  mortarColor: number;
  hi: number;
  lo: number;
  seed: number;
  /** Strength of per-brick tone variation. */
  tone?: number;
  /** Strength of large soft stains across the wall. */
  stain?: number;
}

/** Running-bond masonry: bevelled bricks, per-brick tone, speckle and stains. */
function bricks(c: Canvas, x0: number, y0: number, w: number, h: number, st: Bricks, shift = 0): void {
  const tone = st.tone ?? 0.24;
  const stain = st.stain ?? 0.14;
  for (let y = 0; y < h; y++) {
    const row = Math.floor(y / st.bh);
    const ly = y - row * st.bh;
    const off = (row % 2) * (st.bw / 2) + shift;
    for (let x = 0; x < w; x++) {
      const gx = x + off;
      const col = Math.floor(gx / st.bw);
      const lx = gx - col * st.bw;
      let color: number;
      if (lx < st.mortar || ly < st.mortar) {
        color = mul(st.mortarColor, 0.85 + 0.3 * hash(x, y, st.seed + 3));
      } else {
        const n = hash(col, row, st.seed);
        const f = 1 - tone / 2 + tone * n + (hash(x, y, st.seed + 1) - 0.5) * 0.1;
        color = mul(st.base, f * (1 - stain / 2 + stain * hash(x >> 3, (y0 + y) >> 3, st.seed + 7)));
        if (ly === st.mortar) color = mix(color, st.hi, 0.6);
        else if (lx === st.mortar) color = mix(color, st.hi, 0.3);
        else if (ly === st.bh - 1) color = mix(color, st.lo, 0.55);
        else if (lx === st.bw - 1) color = mix(color, st.lo, 0.35);
      }
      c.px(x0 + x, y0 + y, color);
    }
  }
}

/** A thin jagged crack running downward. */
function crack(c: Canvas, x: number, y: number, len: number, seed: number, color: number): void {
  for (let i = 0; i < len; i++) {
    c.px(x, y + i, color);
    const n = hash(i, seed, 2);
    if (n < 0.3) x--;
    else if (n > 0.7) x++;
  }
}

/** A solid block with a lit top-left and shaded bottom-right edge. */
function block(c: Canvas, x: number, y: number, w: number, h: number, base: number, hi: number, lo: number, seed: number): void {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      let col = mul(base, 0.92 + 0.16 * hash(x + i, y + j, seed));
      if (j === 0) col = mix(col, hi, 0.7);
      else if (i === 0) col = mix(col, hi, 0.35);
      else if (j === h - 1) col = mix(col, lo, 0.65);
      else if (i === w - 1) col = mix(col, lo, 0.4);
      c.px(x + i, y + j, col);
    }
  }
}

const BACK: Bricks = { bw: 16 * S, bh: 8 * S, mortar: 2, base: 0x34384f, mortarColor: 0x161722, hi: 0x4a4f6c, lo: 0x1e2030, seed: 11, tone: 0.2, stain: 0.2 };
const WALL: Bricks = { bw: 16 * S, bh: 8 * S, mortar: 2, base: 0x6b6f8c, mortarColor: 0x2a2b3a, hi: 0xa4a9c8, lo: 0x3a3c52, seed: 23, tone: 0.28, stain: 0.18 };
const FLOOR: Bricks = { bw: 16 * S, bh: 8 * S, mortar: 2, base: 0xa38c5e, mortarColor: 0x4a3c26, hi: 0xd2bc88, lo: 0x5e4e32, seed: 37, tone: 0.22, stain: 0.1 };

export function backWall(variant: number): Img {
  const c = new Canvas(TILE_PX, TILE_PX);
  bricks(c, 0, 0, TILE_PX, TILE_PX, { ...BACK, seed: BACK.seed + variant * 5 }, variant * 12);
  return c.img();
}

export function wall(variant: number): Img {
  const c = new Canvas(TILE_PX, TILE_PX);
  bricks(c, 0, 0, TILE_PX, TILE_PX, { ...WALL, seed: WALL.seed + variant * 5 }, variant * 12);
  // A few weathering cracks and a darker inner edge so neighbouring blocks read as one mass.
  crack(c, 14 + variant * 18, 4 + variant * 7, 22, variant + 40, mul(WALL.mortarColor, 1.1));
  if (variant % 2 === 0) crack(c, 70 - variant * 6, 50, 16, variant + 60, mul(WALL.mortarColor, 1.1));
  return c.img();
}

/** The floor slab seen edge-on: lit top lip, brick face, then a soft shadow cast on the wall below. */
export function floor(variant: number, loose = false): Img {
  const c = new Canvas(TILE_PX, FLOOR_H);
  const face = loose ? { ...FLOOR, base: 0xb09868, mortarColor: 0x3a2e1c, seed: 51 } : { ...FLOOR, seed: FLOOR.seed + variant * 5 };
  bricks(c, 0, 0, TILE_PX, 8 * S, { ...face, bh: 8 * S }, variant * 20);
  for (let x = 0; x < TILE_PX; x++) {
    const n = hash(x, 0, 5);
    c.px(x, 0, mix(0xf0dfae, 0xd6c18a, n));
    c.px(x, 1, mix(0xd8c590, 0xbca874, n));
    c.px(x, 2, mix(0xb09a68, 0x9c8658, n));
    for (let y = 8 * S - 4; y < 8 * S; y++) c.tint(x, y, y === 8 * S - 1 ? 0.55 : 0.78);
  }
  if (loose) {
    crack(c, 20, 4, 18, 70, 0x2a1e10);
    crack(c, 58, 3, 20, 71, 0x2a1e10);
    crack(c, 80, 6, 14, 72, 0x2a1e10);
  } else if (variant % 2 === 1) {
    crack(c, 30 + variant * 9, 5, 12, variant + 80, mul(face.mortarColor, 1.2));
  }
  for (let y = 8 * S; y < FLOOR_H; y++) {
    const t = (y - 8 * S) / (4 * S);
    const a = Math.round(130 * (1 - t) ** 2);
    for (let x = 0; x < TILE_PX; x++) c.px(x, y, 0x000000, a);
  }
  return c.img();
}

export function plate(pressed: boolean): Img {
  const h = (pressed ? 2 : 4) * S;
  const c = new Canvas(20 * S, h);
  block(c, 0, 0, 20 * S, h, 0xa8793a, 0xe8c27a, 0x5a3c18, 91);
  c.rect(4, 2, 20 * S - 8, 1, 0x6a4a20, 120);
  return c.img();
}

/** A fluted column with a capital and plinth, set against the back wall. */
export function pillar(): Img {
  const c = new Canvas(TILE_PX, TILE_PX);
  bricks(c, 0, 0, TILE_PX, TILE_PX, BACK);
  const x0 = 30;
  const w = 36;
  for (let y = 12; y < TILE_PX; y++) {
    for (let i = 0; i < w; i++) {
      const t = i / (w - 1);
      const light = 0.42 + 0.85 * Math.max(0, 1 - ((t - 0.33) / 0.67) ** 2);
      let col = mul(0x8d90ac, light * (0.94 + 0.12 * hash(x0 + i, y, 3)));
      if (i % 9 === 0) col = mul(col, 0.82); // flutes
      c.px(x0 + i, y, col);
    }
  }
  block(c, 18, 0, 60, 8, 0x9a9db8, 0xd0d4ec, 0x4a4c64, 5);
  block(c, 24, 8, 48, 6, 0x8a8da8, 0xb8bcd8, 0x44465c, 6);
  block(c, 22, 76, 52, 8, 0x8a8da8, 0xb8bcd8, 0x44465c, 7);
  block(c, 16, 84, 64, 12, 0x9a9db8, 0xd0d4ec, 0x4a4c64, 8);
  return c.img();
}

/** Is (x, y) inside an arch-topped window of size w x h, inset by m px? */
function inArch(x: number, y: number, w: number, h: number, m: number): boolean {
  const r = w / 2 - m;
  const cy = w / 2;
  if (y < m || y >= h - m) return false;
  if (y < cy) return Math.hypot(x + 0.5 - w / 2, y + 0.5 - cy) <= r;
  return x >= m && x < w - m;
}

/** An ornate gilt-framed mirror. Active glass glows when the reflection has stepped out. */
export function mirror(active: boolean): Img {
  const w = 26 * S;
  const h = 36 * S;
  const c = new Canvas(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inArch(x, y, w, h, 0)) continue;
      let col: number;
      if (!inArch(x, y, w, h, 2)) {
        col = 0x120c06;
      } else if (!inArch(x, y, w, h, 11)) {
        const lit = 0.62 + 0.55 * (1 - x / w) + 0.1 * (1 - y / h);
        col = mul(0xb8893c, lit * (0.92 + 0.16 * hash(x, y, 9)));
        if (inArch(x, y, w, h, 6) && !inArch(x, y, w, h, 8)) col = 0xeccb74;
        if (hash(x >> 2, y >> 2, 4) > 0.93 && inArch(x, y, w, h, 3)) col = mul(col, 0.8); // tarnish
      } else if (!inArch(x, y, w, h, 13)) {
        col = 0x4a3010;
      } else {
        const v = Math.pow(y / h, 0.8);
        col = active ? mix(0xf6ffff, 0x6fd8ff, v) : mix(0xcfeaf4, 0x5b8fa8, v);
        const s = (x + y * 0.7) % 46;
        if (s < 6) col = mix(col, 0xffffff, active ? 0.65 : 0.45);
        else if (s >= 12 && s < 15) col = mix(col, 0xffffff, active ? 0.35 : 0.22);
        col = mul(col, 0.97 + 0.06 * hash(x, y, 2));
        if (!inArch(x, y, w, h, 18)) col = mul(col, 0.84);
        if (active && hash(x, y, 6) > 0.996) col = 0xffffff;
      }
      const gem = Math.hypot(x - w / 2, y - 7 * S * 0.34 - 2);
      if (gem < 4.6) col = gem < 1.6 ? 0xffd0c8 : mix(0xc0302a, 0x701410, gem / 4.6);
      c.px(x, y, col);
    }
  }
  return c.img();
}

/** The level exit: a stone arch with either a banded wooden door or a lit stairwell. */
export function exitDoor(open: boolean): Img {
  const w = 26 * S;
  const h = 26 * S;
  const c = new Canvas(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inArch(x, y, w, h, 0)) continue;
      let col: number;
      if (!inArch(x, y, w, h, 2)) {
        col = 0x14121c;
      } else if (!inArch(x, y, w, h, 9)) {
        col = mul(0x77738a, 0.9 + 0.2 * hash(x, y, 12));
        if (!inArch(x, y, w, h, 4)) col = mix(col, 0xb4b0c8, 0.5);
        if ((x + (y >> 4) * 9) % 18 === 0) col = mul(col, 0.7); // block joints
      } else if (open) {
        const t = Math.pow(y / h, 1.4);
        col = mix(0x0c0a12, 0xf0d070, t);
        if (y > h * 0.55 && (y * 3) % 17 < 2) col = mul(col, 0.8); // steps
        if (!inArch(x, y, w, h, 12)) col = mul(col, 0.7);
      } else {
        const plank = Math.floor(x / 9);
        col = mul(0x4e3320, 0.8 + 0.4 * hash(plank, 0, 14));
        col = mul(col, 0.94 + 0.12 * hash(x, y >> 1, 15));
        if (x % 9 === 0) col = mul(col, 0.5);
        const band = (y > h * 0.3 && y < h * 0.3 + 5) || (y > h * 0.7 && y < h * 0.7 + 5);
        if (band) col = (x % 12 === 3 || x % 12 === 4) && (y & 1) === 0 ? 0x8a8a98 : 0x2a2a34;
        if (!inArch(x, y, w, h, 12)) col = mul(col, 0.65);
        if (Math.hypot(x - w * 0.7, y - h * 0.58) < 3.4) col = 0xc8a040;
      }
      c.px(x, y, col);
    }
  }
  return c.img();
}

/** A wall sconce without its flame (the flame is animated by the scene). */
export function torch(): Img {
  const c = new Canvas(6 * S, 16 * S);
  const cx = 3 * S;
  block(c, cx - 4, 4 * S + 4, 8, 4 * S, 0x6a6a7a, 0xb0b0c0, 0x2a2a34, 31); // cup
  block(c, cx - 2, 8 * S + 3, 4, 7 * S, 0x6a4424, 0xa87444, 0x2e1c0c, 32); // handle
  block(c, cx - 6, 14 * S, 12, 2 * S, 0x6a6a7a, 0xb0b0c0, 0x2a2a34, 33); // wall bracket
  return c.img();
}

export const FLOOR_VARIANTS = 4;

export interface Environment {
  back: Img[];
  wall: Img[];
  floor: Img[];
  loose: Img;
  plateUp: Img;
  plateDown: Img;
  pillar: Img;
  mirror: Img;
  mirrorActive: Img;
  exitShut: Img;
  exitOpen: Img;
  torch: Img;
}

export function buildEnvironment(): Environment {
  const range = (f: (v: number) => Img): Img[] => Array.from({ length: FLOOR_VARIANTS }, (_, v) => f(v));
  return {
    back: range(backWall),
    wall: range(wall),
    floor: range((v) => floor(v)),
    loose: floor(0, true),
    plateUp: plate(false),
    plateDown: plate(true),
    pillar: pillar(),
    mirror: mirror(false),
    mirrorActive: mirror(true),
    exitShut: exitDoor(false),
    exitOpen: exitDoor(true),
    torch: torch(),
  };
}

/** Which of the stone variants a tile uses; stable per tile so the level never shimmers. */
export function variantAt(tx: number, ty: number): number {
  return Math.floor(hash(tx, ty, 1) * FLOOR_VARIANTS);
}

/** Torches hang on a small share of the back wall, never on neighbouring tiles. */
export function hasTorch(tx: number, ty: number): boolean {
  return hash(tx, ty, 99) < 0.14 && hash(tx - 1, ty, 99) >= 0.14;
}
