/** Palette-indexed pixel canvas. Drawing coordinates are logical px; `scale` device pixels make up one of them. */
export class PixelBuffer {
  readonly data: Uint8Array;
  readonly w: number;
  readonly h: number;
  /** Pixels that fell outside the canvas; tests assert this stays 0 so sprites never get cut off. */
  clipped = 0;

  constructor(
    logicalW: number,
    logicalH: number,
    readonly scale = 1,
  ) {
    this.w = logicalW * scale;
    this.h = logicalH * scale;
    this.data = new Uint8Array(this.w * this.h);
  }

  /** One device pixel. */
  set(x: number, y: number, c: number): void {
    this.put(Math.round(x * this.scale), Math.round(y * this.scale), c);
  }

  private put(ix: number, iy: number, c: number): void {
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) {
      this.clipped++;
      return;
    }
    this.data[iy * this.w + ix] = c;
  }

  disc(cx: number, cy: number, r: number, c: number): void {
    const s = this.scale;
    const dx = cx * s;
    const dy = cy * s;
    const dr = r * s;
    for (let y = Math.floor(dy - dr); y <= Math.ceil(dy + dr); y++) {
      for (let x = Math.floor(dx - dr); x <= Math.ceil(dx + dr); x++) {
        if ((x + 0.5 - dx) ** 2 + (y + 0.5 - dy) ** 2 <= dr * dr) this.put(x, y, c);
      }
    }
  }

  /** Thick line made of overlapping discs, sampled every device pixel. */
  line(x0: number, y0: number, x1: number, y1: number, thickness: number, c: number): void {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * this.scale));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, thickness / 2, c);
    }
  }

  /** Adds a 1 device-pixel outline around everything drawn so far. */
  outline(c: number): void {
    const add: number[] = [];
    for (let y = -1; y <= this.h; y++) {
      for (let x = -1; x <= this.w; x++) {
        if (this.at(x, y) !== 0) continue;
        if (this.at(x + 1, y) || this.at(x - 1, y) || this.at(x, y + 1) || this.at(x, y - 1)) add.push(x, y);
      }
    }
    for (let i = 0; i < add.length; i += 2) this.put(add[i]!, add[i + 1]!, c);
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
