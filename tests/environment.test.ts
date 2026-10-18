import { describe, expect, it } from 'vitest';
import { FLOOR_H, TILE_PX, buildEnvironment, hasTorch, variantAt } from '../src/art';
import type { Img } from '../src/art';

const opaque = (im: Img): number => {
  let n = 0;
  for (let i = 3; i < im.data.length; i += 4) if (im.data[i]! > 0) n++;
  return n;
};

describe('environment art', () => {
  const env = buildEnvironment();

  it('builds every sprite with the right size and some pixels', () => {
    for (const im of [...env.back, ...env.wall, env.pillar]) {
      expect([im.w, im.h]).toEqual([TILE_PX, TILE_PX]);
      expect(opaque(im)).toBe(im.w * im.h);
    }
    for (const im of [...env.floor, env.loose]) {
      expect([im.w, im.h]).toEqual([TILE_PX, FLOOR_H]);
      expect(opaque(im)).toBe(im.w * im.h);
    }
    for (const im of [env.plateUp, env.plateDown, env.mirror, env.mirrorActive, env.exitShut, env.exitOpen, env.torch]) {
      expect(opaque(im)).toBeGreaterThan(0);
    }
  });

  it('is deterministic and gives the variants different stones', () => {
    const again = buildEnvironment();
    expect(Array.from(again.wall[1]!.data)).toEqual(Array.from(env.wall[1]!.data));
    expect(Array.from(env.wall[0]!.data)).not.toEqual(Array.from(env.wall[1]!.data));
  });

  it('keeps the mirror lit state visibly different and variants stable per tile', () => {
    expect(Array.from(env.mirror.data)).not.toEqual(Array.from(env.mirrorActive.data));
    expect(variantAt(3, 2)).toBe(variantAt(3, 2));
    expect(typeof hasTorch(3, 2)).toBe('boolean');
  });
});
