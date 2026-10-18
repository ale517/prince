import type { PlayerState } from '../player';

/** Body-space point: x forward, y up, measured in px from the point on the ground below the feet. */
export type V = readonly [number, number];

export interface Pose {
  hip: V;
  chest: V;
  head: V;
  footF: V;
  footB: V;
  handF: V;
  handB: V;
  /** Blade tip when a sword is drawn; the blade runs from the front hand to here. */
  sword?: V;
}

const KEYS: (keyof Omit<Pose, 'sword'>)[] = ['hip', 'chest', 'head', 'footF', 'footB', 'handF', 'handB'];

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const out = {} as Pose;
  for (const k of KEYS) out[k] = [a[k][0] + (b[k][0] - a[k][0]) * t, a[k][1] + (b[k][1] - a[k][1]) * t];
  return out;
}

const add = (v: V, dx: number, dy: number): V => [v[0] + dx, v[1] + dy];

export const STAND: Pose = {
  hip: [0, 14],
  chest: [0.5, 23],
  head: [1.5, 28.5],
  footF: [3, 0],
  footB: [-3, 0],
  handF: [2, 13],
  handB: [-3, 13],
};

export const CROUCH: Pose = {
  hip: [-1, 9],
  chest: [3, 17],
  head: [6, 22],
  footF: [5, 0],
  footB: [-3, 0],
  handF: [8, 10],
  handB: [1, 8],
};

// Hanging from a ledge one row up: the edge is 16px ahead and 32px above the feet.
const HANG: Pose = {
  hip: [10, 17],
  chest: [11, 26],
  head: [12, 31.5],
  footF: [9, 4],
  footB: [7, 3],
  handF: [16, 33],
  handB: [14, 33],
};

const LYING: Pose = {
  hip: [0, 3],
  chest: [8, 3],
  head: [14, 3],
  footF: [-9, 1],
  footB: [-11, 2],
  handF: [11, 1],
  handB: [4, 1],
};

function runPose(p: number, amp: number, lean: number): Pose {
  const s = Math.sin(p * Math.PI * 2);
  const c = Math.cos(p * Math.PI * 2);
  const bob = 0.8 * Math.abs(c);
  return {
    hip: [lean * 0.4, 13.2 + bob],
    chest: [lean + 0.5, 22 + bob],
    head: [lean + 2.5, 27.5 + bob],
    // The foot lifts while it swings forward and is planted while it sweeps back.
    footF: [s * amp, Math.max(0, c) * amp * 0.5],
    footB: [-s * amp, Math.max(0, -c) * amp * 0.5],
    handF: [-s * amp * 0.75 + lean + 1, 16],
    handB: [s * amp * 0.75 + lean + 1, 16],
  };
}

function airPose(lift: number, running: boolean): Pose {
  const hip: V = [running ? 2 : 0, 14 + lift];
  const chest = add(hip, running ? 3 : 1, 9);
  return {
    hip,
    chest,
    head: add(chest, 1.5, 5.5),
    footF: [running ? 10 : 5, lift + (running ? 4 : 3)],
    footB: [running ? -9 : -3, lift + (running ? 1 : 3)],
    handF: add(chest, running ? 6 : 5, 5),
    handB: add(chest, running ? -5 : -3, 4),
  };
}

export interface Sprite {
  pose: Pose;
  /** Extra offset in px (forward, up) on top of the player's tile position. */
  dx: number;
  dy: number;
  /** True when the sprite should face against the player's facing (mid-turn). */
  mirror: boolean;
}

/**
 * Frames within cyclic or static states are folded so the sprite cache stays small.
 * Must match the folding assumed in `spriteFor`.
 */
export function normalizeFrame(state: PlayerState, frame: number): number {
  switch (state) {
    case 'idle':
      return Math.floor(frame / 6) % 2;
    case 'run':
      return frame % 4;
    case 'fall':
      return frame % 2;
    case 'crouch':
    case 'hang':
    case 'turn':
      return Math.min(frame, 1);
    case 'dead':
      return Math.min(frame, 3);
    default:
      return frame;
  }
}

export function spriteFor(state: PlayerState, rawFrame: number, landTicks: number, fallPhase = 0): Sprite {
  const frame = normalizeFrame(state, rawFrame);
  const still = (pose: Pose, dx = 0, dy = 0, mirror = false): Sprite => ({ pose, dx, dy, mirror });

  switch (state) {
    case 'idle': {
      const b = frame * 0.7; // breathing
      return still({ ...STAND, chest: add(STAND.chest, 0, b), head: add(STAND.head, 0, b), handF: add(STAND.handF, 0, b), handB: add(STAND.handB, 0, b) });
    }
    case 'turn':
      return still(STAND, 0, 0, frame >= 1);
    case 'startRun':
      return still(runPose(frame / 4, 3 + Math.min(frame, 3) * 2.5, Math.min(frame, 3)));
    case 'run':
      return still(runPose(frame / 4, 8, 3));
    case 'stopRun':
      return still({
        hip: [-0.5, 12.5],
        chest: [-1.5, 21.5],
        head: [-0.5, 27],
        footF: [6, 0],
        footB: [-4, 0],
        handF: [3.5, 17.5],
        handB: [-6.5, 16.5],
      });
    case 'step':
      return still(runPose(frame / 8, 3.5, 0));
    case 'jumpStanding':
    case 'jumpRunning': {
      const running = state === 'jumpRunning';
      const ticks = running ? 14 : 12;
      const p = Math.min(1, (frame + 1) / ticks);
      const air = airPose((running ? 13 : 11) * Math.sin(Math.PI * p), running);
      // Bend the knees on take-off and again on touchdown.
      const crouchW = 0.8 * (Math.max(0, 1 - p / 0.2) + Math.max(0, (p - 0.8) / 0.2));
      return still(lerpPose(air, CROUCH, Math.min(1, crouchW)));
    }
    case 'jumpUp': {
      const p = Math.min(1, (frame + 1) / 10);
      const lift = 16 * Math.sin(Math.PI * 0.9 * p);
      const hip: V = [0, 14 + lift];
      const chest = add(hip, 0.5, 9);
      return still({
        hip,
        chest,
        head: add(chest, 1, 5.5),
        footF: [2, lift * 0.5 + 1],
        footB: [-2, lift * 0.5],
        handF: add(chest, 3, 10),
        handB: add(chest, -1, 10),
      });
    }
    case 'hang':
      return still(HANG);
    case 'climbUp': {
      const p = Math.min(1, (frame + 1) / 12);
      return still(lerpPose(HANG, CROUCH, p), 32 * p * p, 32 * p);
    }
    case 'fall': {
      const hip: V = [0, 14];
      const chest = add(hip, 0, 9);
      return still(
        {
          hip,
          chest,
          head: add(chest, 1, 5.5),
          footF: [3 + frame * 2, 4],
          footB: [-3 - frame * 2, 3],
          handF: add(chest, 4, 9),
          handB: add(chest, -3, 9 + frame),
        },
        0,
        // Spread the 32px row drops over the ticks of the row so falling looks continuous.
        -fallPhase * 32,
      );
    }
    case 'land': {
      const depth = landTicks > 0 ? 1 - rawFrame / landTicks : 0;
      const pose = lerpPose(STAND, CROUCH, 0.9 * Math.max(0, depth));
      return still({ ...pose, handF: add(pose.handF, 1, 2), handB: add(pose.handB, -1, 2) });
    }
    case 'crouch':
      return still(CROUCH);
    case 'dead':
      return still(lerpPose(STAND, LYING, Math.min(1, (frame + 1) / 3)));
    case 'drawSword': {
      const t = Math.min(1, (frame + 1) / 3);
      return still(withSword(lerpPose(STAND, FIGHT, t), [lerpN(4, 30, t), lerpN(2, 22, t)]));
    }
    case 'sheathe': {
      const t = Math.min(1, (frame + 1) / 3);
      return still(withSword(lerpPose(FIGHT, STAND, t), [lerpN(30, 4, t), lerpN(22, 2, t)]));
    }
    case 'ready':
      return still(withSword(FIGHT, FIGHT_TIP));
    case 'advance':
    case 'retreat': {
      const dir = state === 'advance' ? 1 : -1;
      const p = Math.min(frame, 3) / 3;
      const step = Math.sin(p * Math.PI);
      return still(
        withSword({ ...FIGHT, footF: add(FIGHT.footF, dir * step * 4, step * 3), footB: add(FIGHT.footB, dir * step * 2, 0) }, FIGHT_TIP),
      );
    }
    case 'strike': {
      // Wind up for frames 0-2, thrust through the hit window 3-5.
      const t = frame < 3 ? frame / 3 : 1;
      const reach = frame < 3 ? 0 : 1;
      const hand: V = [lerpN(10, 6, t) + reach * 8, 21];
      return still(
        withSword({ ...lerpPose(FIGHT, LUNGE, reach ? 1 : 0), handF: hand }, [hand[0] + 14 + reach * 2, 21 + (reach ? 0 : 4 * t)]),
      );
    }
    case 'parry':
      return still(withSword({ ...FIGHT, handF: [9, 23] }, [13, 41]));
    case 'hurt':
      return still(withSword(HURT, [16, 9]));
  }
}

const lerpN = (a: number, b: number, t: number): number => a + (b - a) * t;
const withSword = (p: Pose, tip: V): Pose => ({ ...p, sword: tip });

const FIGHT_TIP: V = [30, 22];
const FIGHT: Pose = {
  hip: [-1, 14],
  chest: [1, 22.5],
  head: [2.5, 28],
  footF: [8, 0],
  footB: [-6, 0],
  handF: [10, 19],
  handB: [-4, 14],
};
const LUNGE: Pose = {
  hip: [3, 12],
  chest: [6, 20.5],
  head: [7.5, 26],
  footF: [12, 0],
  footB: [-8, 0],
  handF: [14, 21],
  handB: [-6, 14],
};
const HURT: Pose = {
  hip: [-3, 14],
  chest: [-3, 22],
  head: [-3, 27],
  footF: [4, 0],
  footB: [-6, 0],
  handF: [6, 16],
  handB: [-8, 16],
};
