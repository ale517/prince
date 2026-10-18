/** Palette-indexed pixel canvas with just the drawing primitives the sprite generator needs. */
export class PixelBuffer {
  readonly data: Uint8Array;
  /** Pixels that fell outside the canvas; tests assert this stays 0 so sprites never get cut off. */
  clipped = 0;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint8Array(w * h);
  }

  set(x: number, y: number, c: number): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) {
      this.clipped++;
      return;
    }
    this.data[iy * this.w + ix] = c;
  }

  disc(cx: number, cy: number, r: number, c: number): void {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) this.set(x, y, c);
      }
    }
  }

  /** Thick line made of overlapping discs, sampled every half pixel. */
  line(x0: number, y0: number, x1: number, y1: number, thickness: number, c: number): void {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, thickness / 2, c);
    }
  }

  /** Adds a 1px outline around everything drawn so far. */
  outline(c: number): void {
    const add: number[] = [];
    for (let y = -1; y <= this.h; y++) {
      for (let x = -1; x <= this.w; x++) {
        if (this.at(x, y) !== 0) continue;
        if (this.at(x + 1, y) || this.at(x - 1, y) || this.at(x, y + 1) || this.at(x, y - 1)) add.push(x, y);
      }
    }
    for (let i = 0; i < add.length; i += 2) this.set(add[i]!, add[i + 1]!, c);
  }

  private at(x: number, y: number): number {
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.data[y * this.w + x]!;
  }

  /** Horizontal runs of one color; far cheaper to draw than one rect per pixel. */
  runs(): Run[] {
    const out: Run[] = [];
    for (let y = 0; y < this.h; y++) {
      let x = 0;
      while (x < this.w) {
        const c = this.data[y * this.w + x]!;
        if (c === 0) {
          x++;
          continue;
        }
        let len = 1;
        while (x + len < this.w && this.data[y * this.w + x + len] === c) len++;
        out.push({ x, y, len, c });
        x += len;
      }
    }
    return out;
  }
}

export interface Run {
  x: number;
  y: number;
  len: number;
  /** Palette index. */
  c: number;
}
