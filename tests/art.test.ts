import { describe, expect, it } from 'vitest';
import { ORIGIN_X, ORIGIN_Y, SPRITE_H, SPRITE_W, princeFrame, rasterize, solveLimb } from '../src/art';
import { spriteFor, STAND } from '../src/art/princePose';
import type { PlayerState } from '../src/player';

const STATES: PlayerState[] = [
  'idle', 'startRun', 'run', 'stopRun', 'turn', 'step', 'jumpStanding', 'jumpRunning',
  'jumpUp', 'hang', 'climbUp', 'fall', 'land', 'crouch', 'dead',
];

describe('solveLimb', () => {
  it('keeps both bones at their length when the target is reachable', () => {
    const { joint, end } = solveLimb([0, 0], [6, 4], 7, 7, [1, 0]);
    expect(Math.hypot(joint[0], joint[1])).toBeCloseTo(7, 5);
    expect(Math.hypot(end[0] - joint[0], end[1] - joint[1])).toBeCloseTo(7, 5);
  });

  it('clamps unreachable targets to full extension', () => {
    const { end } = solveLimb([0, 0], [40, 0], 5, 5, [0, 1]);
    expect(end[0]).toBeLessThanOrEqual(10);
    expect(end[0]).toBeGreaterThan(9.9);
  });

  it('bends toward the requested side', () => {
    expect(solveLimb([0, 0], [0, 10], 7, 7, [1, 0]).joint[0]).toBeGreaterThan(0);
    expect(solveLimb([0, 0], [0, 10], 7, 7, [-1, 0]).joint[0]).toBeLessThan(0);
  });
});

describe('prince sprites', () => {
  it('every state and frame fits inside the canvas and draws something', () => {
    for (const state of STATES) {
      for (let frame = 0; frame < 16; frame++) {
        for (const landTicks of [4, 8]) {
          const r = rasterize(spriteFor(state, frame, landTicks, 0.5).pose);
          expect(r.clipped, `${state} frame ${frame}`).toBe(0);
          expect(r.runs.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('standing pose keeps the feet on the ground line and the head above the hip', () => {
    const r = rasterize(STAND);
    const lowest = Math.max(...r.runs.map((run) => run.y));
    // Outline sits one pixel below the shoes.
    expect(lowest).toBeLessThanOrEqual(ORIGIN_Y + 1);
    expect(lowest).toBeGreaterThanOrEqual(ORIGIN_Y - 1);
    const highest = Math.min(...r.runs.map((run) => run.y));
    expect(ORIGIN_Y - highest).toBeGreaterThan(28);
    expect(ORIGIN_Y - highest).toBeLessThan(40);
  });

  it('is horizontally centred on the origin so mirroring is symmetric', () => {
    const r = rasterize(STAND);
    const xs = r.runs.flatMap((run) => [run.x, run.x + run.len - 1]);
    expect(Math.min(...xs)).toBeGreaterThan(ORIGIN_X - 14);
    expect(Math.max(...xs)).toBeLessThan(ORIGIN_X + 14);
    expect(SPRITE_W).toBeGreaterThan(ORIGIN_X);
    expect(SPRITE_H).toBeGreaterThan(ORIGIN_Y);
  });

  it('run cycle alternates feet over its four frames', () => {
    const feet = [0, 1, 2, 3].map((f) => spriteFor('run', f, 4).pose.footF[0]);
    expect(new Set(feet.map((x) => Math.round(x))).size).toBeGreaterThan(2);
  });

  it('climbing moves the body up a full tile and a full tile forward by the last frame', () => {
    const last = spriteFor('climbUp', 11, 4);
    expect([last.dx, last.dy]).toEqual([32, 32]);
    expect(spriteFor('climbUp', 0, 4).dy).toBeLessThan(5);
  });

  it('mirrors only the second half of a turn', () => {
    expect(spriteFor('turn', 0, 4).mirror).toBe(false);
    expect(spriteFor('turn', 1, 4).mirror).toBe(true);
  });

  it('falling lowers the sprite smoothly within a row', () => {
    expect(spriteFor('fall', 0, 4, 0).dy).toBeCloseTo(0, 5);
    expect(spriteFor('fall', 0, 4, 2 / 3).dy).toBeCloseTo(-21.33, 1);
  });

  it('caches frames and folds cyclic animations', () => {
    expect(princeFrame('run', 1, 4).runs).toBe(princeFrame('run', 5, 4).runs);
    expect(princeFrame('idle', 0, 4).runs).toBe(princeFrame('idle', 12, 4).runs);
    expect(princeFrame('idle', 0, 4).runs).not.toBe(princeFrame('idle', 6, 4).runs);
  });
});
