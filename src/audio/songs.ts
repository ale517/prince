/** Original chiptune tracks as plain data, so the sequencer can be tested without a sound card. */

export type Wave = 'square' | 'triangle' | 'sawtooth' | 'sine';

export interface Voice {
  wave: Wave;
  gain: number;
  /** One entry per step: semitones above `root`, or null for a rest. */
  notes: (number | null)[];
  /** Note length in steps. */
  length: number;
}

export interface Song {
  /** Root frequency in Hz. */
  root: number;
  bpm: number;
  /** Steps per beat (4 = sixteenth notes). */
  stepsPerBeat: number;
  loop: boolean;
  voices: Voice[];
}

const _ = null;

// A minor, Phrygian colour: A, Bb, C, D, E, F, G. Two chord bars repeated: Am - Bb - Am - G.
const BASS: (number | null)[] = [
  0, _, _, _, 0, _, 7, _, 0, _, _, _, 0, _, 7, _,
  1, _, _, _, 1, _, 8, _, 1, _, _, _, 1, _, 8, _,
  0, _, _, _, 0, _, 7, _, 0, _, _, _, 0, _, 7, _,
  -2, _, _, _, -2, _, 5, _, -2, _, _, _, -2, _, 5, _,
];

const ARP: (number | null)[] = [
  12, _, 15, _, 19, _, 15, _, 12, _, 15, _, 19, _, 24, _,
  13, _, 17, _, 20, _, 17, _, 13, _, 17, _, 20, _, 25, _,
  12, _, 15, _, 19, _, 15, _, 12, _, 15, _, 19, _, 24, _,
  10, _, 14, _, 17, _, 14, _, 10, _, 14, _, 17, _, 22, _,
];

const LEAD: (number | null)[] = [
  _, _, _, _, _, _, _, _, 24, _, _, 22, _, _, 19, _,
  _, _, _, _, _, _, _, _, 25, _, _, 24, _, _, 20, _,
  _, _, _, _, _, _, _, _, 24, _, _, 27, _, _, 24, _,
  22, _, _, _, 19, _, _, _, 17, _, _, _, 19, _, _, _,
];

export const DUNGEON: Song = {
  root: 110,
  bpm: 84,
  stepsPerBeat: 4,
  loop: true,
  voices: [
    { wave: 'triangle', gain: 0.32, notes: BASS, length: 3 },
    { wave: 'square', gain: 0.05, notes: ARP, length: 1 },
    { wave: 'sine', gain: 0.16, notes: LEAD, length: 5 },
  ],
};

// Faster and harder while a guard is awake.
const FIGHT_BASS: (number | null)[] = [
  0, _, 0, _, 0, _, 1, _, 0, _, 0, _, 7, _, 6, _,
  0, _, 0, _, 0, _, 1, _, 0, _, 0, _, 7, _, 12, _,
];
const FIGHT_LEAD: (number | null)[] = [
  24, _, _, 24, 25, _, _, 24, 22, _, _, 24, 19, _, _, _,
  24, _, _, 24, 25, _, _, 27, 28, _, _, 27, 25, _, 24, _,
];

export const FIGHT: Song = {
  root: 110,
  bpm: 132,
  stepsPerBeat: 4,
  loop: true,
  voices: [
    { wave: 'sawtooth', gain: 0.1, notes: FIGHT_BASS, length: 1 },
    { wave: 'square', gain: 0.06, notes: FIGHT_LEAD, length: 2 },
  ],
};

export const VICTORY: Song = {
  root: 220,
  bpm: 120,
  stepsPerBeat: 2,
  loop: false,
  voices: [
    { wave: 'square', gain: 0.08, notes: [0, 4, 7, 12, _, 7, 12, 16, _, _, _, _], length: 2 },
    { wave: 'triangle', gain: 0.22, notes: [-12, _, _, -5, _, _, 0, _, _, _, _, _], length: 3 },
  ],
};

export const SONGS = { dungeon: DUNGEON, fight: FIGHT, victory: VICTORY } as const;
export type SongKey = keyof typeof SONGS;

export const midiRatio = (semitones: number): number => 2 ** (semitones / 12);

/** Seconds per step. */
export const stepSeconds = (s: Song): number => 60 / s.bpm / s.stepsPerBeat;

/** Total steps before the song loops or ends. */
export const songSteps = (s: Song): number => Math.max(...s.voices.map((v) => v.notes.length));
