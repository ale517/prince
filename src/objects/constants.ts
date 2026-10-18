// Durations in 12 Hz logic ticks (spec 05). Tunable.
export const SPIKE_EXTEND_TICKS = 3;
export const SPIKE_UP_TICKS = 20;

export const LOOSE_SHAKE_TICKS = 8;
export const LOOSE_FALL_DAMAGE = 1;

export const GATE_OPEN_TICKS = 12;
export const GATE_CLOSE_TICKS = 40;
export const GATE_DEFAULT_HOLD_TICKS = 150;

export const CHOMPER_PERIOD = 30;
/** Blades are lethal from LETHAL_START to LETHAL_END inclusive; the ticks before it are the closing warning. */
export const CHOMPER_WARN_START = 18;
export const CHOMPER_LETHAL_START = 22;
export const CHOMPER_LETHAL_END = 26;

export const LETHAL = Infinity;
