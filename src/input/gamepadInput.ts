import type { InputState } from '../contracts';

const DEADZONE = 0.3;

/** The parts of a Gamepad we read, so the mapping can be tested without a browser. */
export interface PadLike {
  buttons: ReadonlyArray<{ pressed: boolean }>;
  axes: ReadonlyArray<number>;
}

export const blankInput = (): InputState => ({ left: false, right: false, up: false, down: false, shift: false, action: false, pause: false });

/** Standard-mapping gamepad to logical input (spec 08): d-pad or left stick, A/X action, LB/RT shift, Start pause. */
export function mapPad(pad: PadLike): InputState {
  const b = (i: number): boolean => pad.buttons[i]?.pressed ?? false;
  const x = pad.axes[0] ?? 0;
  const y = pad.axes[1] ?? 0;
  return {
    left: b(14) || x < -DEADZONE,
    right: b(15) || x > DEADZONE,
    up: b(12) || y < -DEADZONE,
    down: b(13) || y > DEADZONE,
    shift: b(4) || b(7),
    action: b(0) || b(2),
    pause: b(9),
  };
}

/** Reads the first connected pad each call. Returns all-false when none is plugged in. */
export function readPad(): InputState {
  const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) if (p?.connected) return mapPad(p);
  return blankInput();
}

/** Reports which logical buttons went down since the last call, for menus and pause. */
export class PadEdges {
  private prev = blankInput();

  next(): InputState {
    const now = readPad();
    const out = blankInput();
    for (const k of Object.keys(now) as (keyof InputState)[]) out[k] = now[k] && !this.prev[k];
    this.prev = now;
    return out;
  }
}
