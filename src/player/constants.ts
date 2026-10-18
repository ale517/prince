import type { Facing } from '../contracts';

// All values are tunable (spec 02). Distances in px, durations in 12 Hz logic ticks.
export const TICK_RATE = 12;

export const START_RUN_TICKS = 3;
export const START_RUN_SPEED = 4;
export const RUN_SPEED = 8;
export const STOP_RUN_TICKS = 2;
export const STOP_RUN_SPEED = 4;
export const TURN_TICKS = 2;

export const STEP_TICKS = 4;
export const STEP_PX_PER_TICK = 2;

export const STANDING_JUMP_TICKS = 12;
export const STANDING_JUMP_PX = 32;
export const RUNNING_JUMP_TICKS = 14;
export const RUNNING_JUMP_PX = 96;
export const JUMP_UP_TICKS = 10;
export const CLIMB_UP_TICKS = 12;

export const FALL_TICKS_PER_ROW = 3;
export const LAND_TICKS = 4;
export const HURT_LAND_TICKS = 8;

export const DEFAULT_MAX_HP = 3;
export const MAX_HP_CAP = 10;

/** Px moved this tick when spreading `total` px over `ticks`, so the sum is exact. */
export function spreadPx(total: number, ticks: number, frame: number): number {
  return Math.round((total * (frame + 1)) / ticks) - Math.round((total * frame) / ticks);
}

export function sign(n: number): Facing | 0 {
  return n > 0 ? 1 : n < 0 ? -1 : 0;
}
