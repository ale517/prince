import { describe, expect, it } from 'vitest';
import { SONGS, midiRatio, songSteps, stepSeconds } from '../src/audio/songs';

describe('songs', () => {
  it('midiRatio doubles per octave', () => {
    expect(midiRatio(12)).toBeCloseTo(2);
    expect(midiRatio(0)).toBe(1);
  });

  it.each(Object.entries(SONGS))('%s has sane timing and notes', (_name, song) => {
    expect(stepSeconds(song)).toBeGreaterThan(0.05);
    expect(songSteps(song)).toBeGreaterThan(0);
    for (const v of song.voices) {
      expect(v.length).toBeGreaterThan(0);
      expect(v.notes.some((n) => n !== null)).toBe(true);
      // Looping voices must divide the loop length or they drift out of phase.
      if (song.loop) expect(songSteps(song) % v.notes.length).toBe(0);
    }
  });
});
