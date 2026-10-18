import { describe, expect, it } from 'vitest';
import { EMPTY_INPUT } from '../src/contracts';
import { DUEL_LEVEL, duelGuards, parseAscii } from '../src/level';
import { Simulation } from '../src/sim';

describe('guards are solid', () => {
  it('a living guard stops the prince from running through him', () => {
    const sim = new Simulation(parseAscii(DUEL_LEVEL, [], { hasSword: true, guards: duelGuards(1) }));
    const guard = sim.guards[0]!;
    for (let i = 0; i < 300 && guard.hp > 0; i++) {
      sim.step({ ...EMPTY_INPUT, right: true });
      expect(sim.player.x).toBeLessThan(guard.x);
    }
  });
});
