import { PixelBuffer } from './pixelBuffer';
import type { Run } from './pixelBuffer';
import { normalizeFrame, spriteFor } from './princePose';
import type { Pose, V } from './princePose';
import type { PlayerState } from '../player';

/** Device pixels per logical pixel: sprites carry 3x the detail of the 320x200 world grid. */
export const SCALE = 3;
/** Canvas size and the point inside it that is "on the ground under the feet", in logical px. */
export const SPRITE_W = 64;
export const SPRITE_H = 64;
export const ORIGIN_X = 32;
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
  blade: 12,
  hilt: 13,
  skinLight: 14,
  tunicLight: 15,
  sashShade: 16,
  eyeWhite: 17,
  bladeShade: 18,
  shoeLight: 19,
  gemLight: 20,
  hiltShade: 21,
} as const;

/** Original placeholder palette (not taken from the 1989 game). */
export const PALETTE: Record<number, number> = {
  [C.outline]: 0x1a1420,
  [C.skin]: 0xe3a76f,
  [C.skinShade]: 0xb97b4d,
  [C.skinLight]: 0xf2c392,
  [C.tunic]: 0xece7d6,
  [C.tunicShade]: 0xbdb59e,
  [C.tunicLight]: 0xfffcf0,
  [C.sash]: 0xc0392b,
  [C.sashShade]: 0x8a2a20,
  [C.shoe]: 0x6b4430,
  [C.shoeLight]: 0x94603f,
  [C.hair]: 0x2b1b16,
  [C.gem]: 0x3aa0e8,
  [C.gemLight]: 0xc8ecff,
  [C.pants]: 0xe2ddc9,
  [C.pantsShade]: 0xa8a28b,
  [C.blade]: 0xdde3ee,
  [C.bladeShade]: 0x8e98ad,
  [C.hilt]: 0xf5c542,
  [C.hiltShade]: 0xb88a22,
  [C.eyeWhite]: 0xffffff,
};

/** Guards reuse the prince's sprites with a darker palette swap. */
export const GUARD_PALETTE: Record<number, number> = {
  ...PALETTE,
  [C.tunic]: 0x9a3535,
  [C.tunicShade]: 0x6a2222,
  [C.tunicLight]: 0xc45050,
  [C.pants]: 0x3f4468,
  [C.pantsShade]: 0x2a2d44,
  [C.sash]: 0xe0b040,
  [C.sashShade]: 0xa07a20,
  [C.skin]: 0xc98a58,
  [C.skinShade]: 0x9a6339,
  [C.skinLight]: 0xdea474,
  [C.gem]: 0xd04040,
  [C.gemLight]: 0xffb0b0,
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
const lerp = (a: V, b: V, t: number): V => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

export interface Raster {
  runs: Run[];
  clipped: number;
}

export function rasterize(pose: Pose): Raster {
  const pb = new PixelBuffer(SPRITE_W, SPRITE_H, SCALE);
  const hip = toPx(pose.hip);
  const chest = toPx(pose.chest);
  const head = toPx(pose.head);
  const shoulder: V = [chest[0], chest[1] + 1.5];

  /** A limb segment lit from the front-top: the shade colour shows as a crescent underneath. */
  const seg = (a: V, b: V, w: number, base: number, shade: number): void => {
    pb.line(a[0], a[1], b[0], b[1], w, shade);
    pb.line(a[0] + 0.3, a[1] - 0.3, b[0] + 0.3, b[1] - 0.3, Math.max(0.5, w - 0.7), base);
  };

  const leg = (foot: V, base: number, shade: number, front: boolean): void => {
    const f = toPx(foot);
    const { joint: rawJoint, end } = solveLimb(hip, [f[0], f[1] - 1.5], THIGH, SHIN, [LEG_BEND[0], -LEG_BEND[1]]);
    const joint: V = [rawJoint[0], Math.min(rawJoint[1], ORIGIN_Y - 2)]; // knees never sink into the floor
    // Baggy trousers: wide thigh, tapering shin, gathered at the ankle.
    seg(hip, joint, 4.8, base, shade);
    seg(joint, end, 3.4, base, shade);
    const ankle = lerp(joint, end, 0.82);
    pb.disc(ankle[0], ankle[1], 1.9, shade);
    pb.disc(ankle[0] + 0.2, ankle[1] - 0.2, 1.5, front ? C.pantsShade : shade);
    // Shoe with a curled toe.
    pb.line(f[0] - 1.4, f[1] - 0.9, f[0] + 3, f[1] - 0.9, 2.4, C.shoe);
    pb.disc(f[0] + 3.6, f[1] - 1.9, 0.9, C.shoe);
    pb.line(f[0] - 0.8, f[1] - 1.6, f[0] + 2.6, f[1] - 1.7, 0.4, C.shoeLight);
  };

  const arm = (hand: V, sleeve: number, sleeveShade: number, skin: number, skinShade: number): void => {
    const h = toPx(hand);
    const { joint: rawJoint, end } = solveLimb(shoulder, h, UPPER_ARM, FORE_ARM, [ARM_BEND[0], -ARM_BEND[1]]);
    const joint: V = [rawJoint[0], Math.min(rawJoint[1], ORIGIN_Y - 2)];
    seg(shoulder, joint, 3.6, sleeve, sleeveShade); // puffy sleeve
    seg(joint, end, 2.2, skin, skinShade);
    const wrist = lerp(joint, end, 0.7);
    pb.disc(wrist[0], wrist[1], 1.35, C.hilt); // gold bracelet
    pb.disc(wrist[0] + 0.25, wrist[1] - 0.25, 0.9, C.hiltShade);
    pb.disc(end[0], end[1], 1.5, skin);
    pb.disc(end[0] + 0.3, end[1] - 0.3, 1.0, C.skinLight);
  };

  // Back to front so the near limbs overlap the far ones.
  arm(pose.handB, C.tunicShade, C.tunicShade, C.skinShade, C.skinShade);
  leg(pose.footB, C.pantsShade, C.pantsShade, false);

  // Tunic: a shaded torso with a lit front, an open collar, and a skirt over the hips.
  pb.line(hip[0], hip[1], chest[0], chest[1], 6.8, C.tunicShade);
  pb.line(hip[0] + 0.5, hip[1] - 0.2, chest[0] + 0.5, chest[1] - 0.2, 5.6, C.tunic);
  pb.line(hip[0] + 2.1, hip[1] - 0.5, chest[0] + 2.1, chest[1] - 0.5, 1.2, C.tunicLight);
  pb.disc(hip[0], hip[1] + 1.2, 4.3, C.tunicShade);
  pb.disc(hip[0] + 0.4, hip[1] + 0.9, 3.9, C.tunic);
  pb.disc(chest[0] + 1.4, chest[1] - 2.7, 1.1, C.skinShade); // collar opening
  pb.disc(chest[0] + 1.6, chest[1] - 2.9, 0.8, C.skin);

  // Sash with a knot and two tails.
  const waist: V = lerp(hip, chest, 0.2);
  pb.line(waist[0] - 3.6, waist[1] + 0.2, waist[0] + 3.6, waist[1] - 0.2, 2.6, C.sashShade);
  pb.line(waist[0] - 3.5, waist[1], waist[0] + 3.5, waist[1] - 0.4, 1.8, C.sash);
  pb.disc(waist[0] - 3.2, waist[1] + 0.4, 1.3, C.sash);
  pb.line(waist[0] - 3.2, waist[1] + 0.8, waist[0] - 4.6, waist[1] + 4.2, 1.0, C.sash);
  pb.line(waist[0] - 3.0, waist[1] + 0.8, waist[0] - 2.4, waist[1] + 4.6, 1.0, C.sashShade);

  leg(pose.footF, C.pants, C.pantsShade, true);

  // Neck and hair.
  pb.line(chest[0], chest[1], head[0], head[1] + 1, 2.6, C.skinShade);
  pb.disc(head[0] - 3.1, head[1] + 0.8, 2.0, C.hair);
  pb.disc(head[0] - 3.6, head[1] + 2.2, 1.3, C.hair);

  // Face: shaded jaw under a lit cheek, ear, nose, brow, eye, moustache.
  pb.disc(head[0], head[1], 3.4, C.skinShade);
  pb.disc(head[0] + 0.35, head[1] - 0.3, 3.0, C.skin);
  pb.disc(head[0] + 1.2, head[1] - 0.9, 1.3, C.skinLight);
  pb.disc(head[0] - 1.1, head[1] + 0.3, 0.8, C.skinShade); // ear
  pb.disc(head[0] + 3.5, head[1] + 0.5, 0.95, C.skin); // nose
  pb.set(head[0] + 4.0, head[1] + 0.8, C.skinShade);
  pb.line(head[0] + 1.3, head[1] - 0.9, head[0] + 3.2, head[1] - 0.6, 0.45, C.hair); // brow
  pb.set(head[0] + 2.0, head[1] + 0.1, C.eyeWhite);
  pb.set(head[0] + 2.35, head[1] + 0.1, C.outline); // pupil
  pb.line(head[0] + 1.6, head[1] + 1.8, head[0] + 3.5, head[1] + 1.5, 0.5, C.hair); // moustache
  pb.set(head[0] + 2.6, head[1] + 2.5, C.skinShade); // mouth

  // Turban: layered wraps, a red band, a jewel, and a cloth tail down the back.
  pb.line(head[0] - 3.6, head[1] - 3.6, head[0] - 5.6, head[1] - 0.2, 1.7, C.tunicShade);
  pb.disc(head[0] - 0.4, head[1] - 4.3, 4.3, C.tunicShade);
  pb.disc(head[0] - 0.1, head[1] - 4.6, 3.9, C.tunic);
  pb.line(head[0] - 3.3, head[1] - 5.2, head[0] + 2.4, head[1] - 7.0, 0.45, C.tunicShade);
  pb.line(head[0] - 3.7, head[1] - 3.9, head[0] + 3.2, head[1] - 5.6, 0.45, C.tunicShade);
  pb.line(head[0] - 1.6, head[1] - 7.3, head[0] + 1.8, head[1] - 7.5, 0.6, C.tunicLight);
  pb.line(head[0] - 3.6, head[1] - 1.9, head[0] + 3.6, head[1] - 2.0, 1.5, C.sashShade);
  pb.line(head[0] - 3.6, head[1] - 2.2, head[0] + 3.6, head[1] - 2.3, 1.1, C.sash);
  pb.disc(head[0] + 2.0, head[1] - 2.3, 0.85, C.gem);
  pb.set(head[0] + 1.8, head[1] - 2.6, C.gemLight);

  arm(pose.handF, C.tunic, C.tunicShade, C.skin, C.skinShade);

  if (pose.sword) {
    const h = toPx(pose.handF);
    const tip = toPx(pose.sword);
    const ang = Math.atan2(tip[1] - h[1], tip[0] - h[0]);
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    const along = (d: number): V => [h[0] + ux * d, h[1] + uy * d];
    const len = Math.hypot(tip[0] - h[0], tip[1] - h[1]);
    // Grip and pommel behind the fist, then crossguard, blade with a fuller, and a tapered point.
    const pommel = along(-2.2);
    pb.line(h[0], h[1], pommel[0], pommel[1], 1.0, C.shoe);
    pb.disc(pommel[0], pommel[1], 0.8, C.hilt);
    const g = along(1.8);
    pb.line(g[0] - uy * 2.6, g[1] + ux * 2.6, g[0] + uy * 2.6, g[1] - ux * 2.6, 1.0, C.hiltShade);
    pb.line(g[0] - uy * 2.5, g[1] + ux * 2.5 - 0.2, g[0] + uy * 2.5, g[1] - ux * 2.5 - 0.2, 0.6, C.hilt);
    const shoulderPt = along(len * 0.8);
    pb.line(g[0] + ux, g[1] + uy, shoulderPt[0], shoulderPt[1], 1.4, C.bladeShade);
    pb.line(g[0] + ux, g[1] + uy - 0.25, shoulderPt[0], shoulderPt[1] - 0.25, 0.8, C.blade);
    pb.line(shoulderPt[0], shoulderPt[1], tip[0], tip[1], 0.8, C.blade);
    pb.set(tip[0], tip[1], C.tunicLight);
  }
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
