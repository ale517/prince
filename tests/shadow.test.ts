import { describe, expect, it } from 'vitest';
import { MERGE_RANGE_PX, SHADOW_DELAY } from '../src/combat';
import { EMPTY_INPUT } from '../src/contracts';
import type { InputState } from '../src/contracts';
import { MIRROR, MIRROR_LEVEL, parseAscii } from '../src/level';
import { Simulation } from '../src/sim';

const press = (p: Partial<InputState>): InputState => ({ ...EMPTY_INPUT, ...p });

function mirrorSim(): Simulation {
  return new Simulation(parseAscii(MIRROR_LEVEL, [], { hasSword: true, mirror: MIRROR }));
}

/** Walks the prince onto the mirror tile so the shadow appears. */
function summon(sim: Simulation): void {
  for (let i = 0; i < 200 && !sim.shadow; i++) sim.step(press({ right: true }));
}

describe('shadow', () => {
  it('does not exist until the prince reaches the mirror', () => {
    const sim = mirrorSim();
    expect(sim.shadow).toBeUndefined();
    summon(sim);
    expect(sim.shadow).toBeDefined();
    expect(sim.shadow!.facing).toBe(-sim.player.facing);
    expect(sim.shadow!.team).toBe('enemy');
  });

  it('replays the prince inputs late with left and right swapped', () => {
    const sim = mirrorSim();
    summon(sim);
    const s = sim.shadow!;
    for (let i = 0; i < SHADOW_DELAY; i++) sim.step(press({ right: true }));
    // Inputs recorded while summoning (right held) arrive mirrored as left.
    expect(s.input.left).toBe(true);
    expect(s.input.right).toBe(false);
  });

  it('shares hit points: a blow on the shadow wounds the prince', () => {
    const sim = mirrorSim();
    summon(sim);
    const hp = sim.player.hp;
    sim.shadow!.applyDamage({ target: 'shadow', amount: 1, source: 'sword' });
    expect(sim.player.hp).toBe(hp - 1);
    sim.shadow!.applyDamage({ target: 'shadow', amount: 1, source: 'fall' });
    expect(sim.player.hp).toBe(hp - 1);
  });

  it('merges when the unarmed prince touches it, healing and adding max HP', () => {
    const sim = mirrorSim();
    summon(sim);
    sim.player.hp = 1;
    const maxHp = sim.player.maxHp;
    const merged: number[] = [];
    sim.bus.on('shadow:merged', () => merged.push(sim.tick));
    // Both walk toward each other; the prince is not fighting, so contact merges.
    for (let i = 0; i < 400 && sim.shadow; i++) sim.step(press({ right: true }));
    expect(sim.shadow).toBeUndefined();
    expect(merged).toHaveLength(1);
    expect(sim.player.maxHp).toBe(maxHp + 1);
    expect(sim.player.hp).toBe(maxHp + 1);
    expect(MERGE_RANGE_PX).toBeGreaterThan(0);
  });
});
