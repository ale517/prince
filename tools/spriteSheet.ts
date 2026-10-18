import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { GUARD_PALETTE, PALETTE, SCALE, princeFrame } from '../src/art';

// Debug contact sheet: renders sample frames to a PNG so the art can be reviewed without a browser.
// Usage: npx tsx tools/spriteSheet.ts out.png
const frames: [string, number][] = [['idle', 0], ['run', 1], ['run', 3], ['jumpRunning', 6], ['hang', 1], ['crouch', 1], ['ready', 0], ['strike', 4], ['parry', 2], ['dead', 3]];
const cols = 5;
const cellW = 56 * SCALE;
const cellH = 56 * SCALE;
const zoom = 2;
const W = cols * cellW * zoom;
const H = Math.ceil(frames.length / cols) * cellH * zoom;
const px = new Uint8Array(W * H * 3).fill(0x20);

frames.forEach(([s, f], i) => {
  const fr = princeFrame(s as never, f, 4, 0);
  const pal = i % 2 ? GUARD_PALETTE : PALETTE;
  const ox = (i % cols) * cellW - 4 * SCALE;
  const oy = Math.floor(i / cols) * cellH - 8 * SCALE;
  for (const r of fr.runs) {
    const c = pal[r.c]!;
    for (let k = 0; k < r.len; k++) {
      for (let zy = 0; zy < zoom; zy++) {
        for (let zx = 0; zx < zoom; zx++) {
          const x = (ox + r.x + k) * zoom + zx;
          const y = (oy + r.y) * zoom + zy;
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const o = (y * W + x) * 3;
          px[o] = (c >> 16) & 255;
          px[o + 1] = (c >> 8) & 255;
          px[o + 2] = c & 255;
        }
      }
    }
  }
});

const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 3 + 1)] = 0;
  Buffer.from(px.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1);
}
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (b: Buffer): number => {
  let c = 0xffffffff;
  for (const v of b) c = crcTable[(c ^ v) & 255]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Buffer): Buffer => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 2;
writeFileSync(process.argv[2]!, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
