import { PixelBuffer } from './pixelBuffer';
import type { Run } from './pixelBuffer';
import { normalizeFrame, spriteFor } from './princePose';
import type { Pose, V } from './princePose';
import type { PlayerState } from '../player';

/** Canvas size and the point inside it that is "on the ground under the feet". */
export const SPRITE_W = 48;
export const SPRITE_H = 64;
export const ORIGIN_X = 24;
export const ORIGIN_Y = 60;

export const C = {
  outline: 1,
  skin: 2,
  skinShade: 3,
  tunic: 4,
  tunicShade: 5,
  sash: 6,
  shoe: 7,
  hair: 8,
  gem: 9,
  pants: 10,
  pantsShade: 11,
} as const;

/** Original placeholder palette (not taken from the 1989 game). */
export const PALETTE: Record<number, number> = {
  [C.outline]: 0x1a1420,
  [C.skin]: 0xe3a76f,
  [C.skinShade]: 0xb97b4d,
  [C.tunic]: 0xf4f0e2,
  [C.tunicShade]: 0xc6bfa9,
  [C.sash]: 0xc0392b,
  [C.shoe]: 0x6b4430,
  [C.hair]: 0x2b1b16,
  [C.gem]: 0xf5c542,
  [C.pants]: 0xe6e2d2,
  [C.pantsShade]: 0xaaa58f,
};

const THIGH = 7.5;
const SHIN = 7.5;
const UPPER_ARM = 5.5;
const FORE_ARM = 5.5;

/** Two-bone IK: returns the middle joint, and the end point clamped to what the limb can reach. */
export function solveLimb(root: V, target: V, l1: number, l2: number, bend: V): { joint: V; end: V } {
  const dx = target[0] - root[0];
  const dy = target[1] - root[1];
  const d = Math.hypot(dx, dy) || 0.0001;
  const reach = Math.min(l1 + l2 - 0.01, Math.max(Math.abs(l1 - l2) + 0.01, d));
  const ux = dx / d;
  const uy = dy / d;
  const a = (l1 * l1 - l2 * l2 + reach * reach) / (2 * reach);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  let nx = -uy;
  let ny = ux;
  if (nx * bend[0] + ny * bend[1] < 0) {
    nx = -nx;
    ny = -ny;
  }
  return {
    joint: [root[0] + ux * a + nx * h, root[1] + uy * a + ny * h],
    end: [root[0] + ux * reach, root[1] + uy * reach],
  };
}

const toPx = (p: V): V => [ORIGIN_X + p[0], ORIGIN_Y - p[1]];
const LEG_BEND: V = [1, 0.2];
const ARM_BEND: V = [-1, -0.6];

export interface Raster {
  runs: Run[];
  clipped: number;
}

export function rasterize(pose: Pose): Raster {
  const pb = new PixelBuffer(SPRITE_W, SPRITE_H);
  const hip = toPx(pose.hip);
  const chest = toPx(pose.chest);
  const head = toPx(pose.head);
  const shoulder: V = [chest[0], chest[1] + 1.5];

  const leg = (foot: V, upper: number, lower: number): void => {
    const f = toPx(foot);
    const { joint: rawJoint, end } = solveLimb(hip, [f[0], f[1] - 1.5], THIGH, SHIN, [LEG_BEND[0], -LEG_BEND[1]]);
    const joint: V = [rawJoint[0], Math.min(rawJoint[1], ORIGIN_Y - 2)]; // knees never sink into the floor
    pb.line(hip[0], hip[1], joint[0], joint[1], 3.6, upper);
    pb.line(joint[0], joint[1], end[0], end[1], 3, lower);
    // Shoe: a short toe pointing forward.
    pb.line(f[0] - 1, f[1] - 0.8, f[0] + 3, f[1] - 0.8, 2.2, C.shoe);
  };

  const arm = (hand: V, sleeve: number, skin: number): void => {
    const h = toPx(hand);
    const { joint: rawJoint, end } = solveLimb(shoulder, h, UPPER_ARM, FORE_ARM, [ARM_BEND[0], -ARM_BEND[1]]);
    const joint: V = [rawJoint[0], Math.min(rawJoint[1], ORIGIN_Y - 2)];
    pb.line(shoulder[0], shoulder[1], joint[0], joint[1], 2.8, sleeve);
    pb.line(joint[0], joint[1], end[0], end[1], 2.2, skin);
    pb.disc(end[0], end[1], 1.3, skin);
  };

  // Back to front so the near limbs overlap the far ones.
  arm(pose.handB, C.tunicShade, C.skinShade);
  leg(pose.footB, C.pantsShade, C.pantsShade);

  // Tunic: torso, a shaded back edge, a short skirt and the sash.
  pb.line(hip[0], hip[1], chest[0], chest[1], 6.5, C.tunic);
  pb.line(hip[0] - 2.5, hip[1], chest[0] - 2.5, chest[1], 1.6, C.tunicShade);
  pb.disc(hip[0], hip[1] + 1, 3.9, C.tunic);
  const waist: V = [hip[0] + (chest[0] - hip[0]) * 0.18, hip[1] + (chest[1] - hip[1]) * 0.18];
  pb.line(waist[0] - 3.2, waist[1], waist[0] + 3.2, waist[1], 2.4, C.sash);

  leg(pose.footF, C.pants, C.pants);

  // Neck, hair, face, turban.
  pb.line(chest[0], chest[1], head[0], head[1] + 1, 2.4, C.skin);
  pb.disc(head[0] - 3, head[1] + 0.5, 1.8, C.hair);
  pb.disc(head[0], head[1], 3.3, C.skin);
  pb.set(head[0] + 4, head[1] + 0.5, C.skin); // nose
  pb.set(head[0] + 2, head[1] - 0.6, C.outline); // eye
  pb.disc(head[0] - 0.3, head[1] - 2.4, 3.8, C.tunic);
  pb.line(head[0] - 3.4, head[1] - 0.9, head[0] + 3.4, head[1] - 0.9, 1.4, C.sash);
  pb.set(head[0] + 2.4, head[1] - 1.1, C.gem);

  arm(pose.handF, C.tunic, C.skin);

  pb.outline(C.outline);
  return { runs: pb.runs(), clipped: pb.clipped };
}

export interface PrinceFrame {
  runs: Run[];
  dx: number;
  dy: number;
  mirror: boolean;
}

const cache = new Map<string, Raster>();

/** Rasterized sprite for the player's current animation frame; cached per distinct pose. */
export function princeFrame(state: PlayerState, frame: number, landTicks: number, fallPhase = 0): PrinceFrame {
  const s = spriteFor(state, frame, landTicks, fallPhase);
  // Land depends on the raw frame, so it must be keyed raw; every other state is already folded.
  const key = `${state}:${state === 'land' ? `${frame}/${landTicks}` : normalizeFrame(state, frame)}`;
  let r = cache.get(key);
  if (!r) {
    r = rasterize(s.pose);
    cache.set(key, r);
  }
  return { runs: r.runs, dx: s.dx, dy: s.dy, mirror: s.mirror };
}
