import { describe, expect, it } from 'vitest';
import { EMPTY_INPUT } from '../src/contracts';
import type { InputState } from '../src/contracts';
import { TEST_LEVEL, parseAscii } from '../src/level';
import { Simulation } from '../src/sim';

const inp = (p: Partial<InputState>): InputState => ({ ...EMPTY_INPUT, ...p });

function run(sim: Simulation, input: InputState, ticks: number): void {
  for (let i = 0; i < ticks; i++) sim.step(input);
}

const newSim = (rows: readonly string[] = TEST_LEVEL) => new Simulation(parseAscii(rows));

describe('player movement', () => {
  it('starts idle on the floor', () => {
    const sim = newSim();
    run(sim, EMPTY_INPUT, 3);
    expect(sim.player.state).toBe('idle');
    expect([sim.player.tx, sim.player.ty]).toEqual([1, 2]);
  });

  it('runs right and is stopped by a wall at the tile edge', () => {
    const sim = newSim(['#@=====#', '########']);
    run(sim, inp({ right: true }), 30);
    expect(sim.player.tx).toBe(6);
    expect(sim.player.x).toBeLessThan(7 * 32);
  });

  it('careful step never walks off an edge', () => {
    const sim = newSim(['@==...', '......']);
    run(sim, inp({ right: true, shift: true }), 80);
    expect(sim.player.state).not.toBe('fall');
    expect(sim.player.tx).toBe(2);
  });

  it('running off an edge falls and survives a 1-row drop unhurt', () => {
    const sim = newSim(['@=...', '..===', '=====']);
    run(sim, inp({ right: true }), 12);
    run(sim, EMPTY_INPUT, 20);
    expect(sim.player.ty).toBe(1);
    expect(sim.player.hp).toBe(3);
  });

  it('a running jump clears a 2-tile gap', () => {
    const sim = newSim();
    // Run to the lip of the gap (tile 9), then jump.
    while (sim.player.tx < 9) sim.step(inp({ right: true }));
    run(sim, inp({ right: true, up: true }), 1);
    run(sim, EMPTY_INPUT, 30);
    expect(sim.player.ty).toBe(2);
    expect(sim.player.tx).toBeGreaterThanOrEqual(12);
    expect(sim.player.hp).toBe(3);
  });

  it('jump up grabs a ledge and climbs onto it', () => {
    const sim = newSim();
    while (sim.player.tx < 4) sim.step(inp({ right: true, shift: true }));
    run(sim, EMPTY_INPUT, 6);
    run(sim, inp({ up: true }), 1);
    run(sim, EMPTY_INPUT, 12);
    expect(sim.player.state).toBe('hang');
    run(sim, inp({ up: true }), 1);
    run(sim, EMPTY_INPUT, 14);
    expect([sim.player.tx, sim.player.ty]).toEqual([5, 1]);
    expect(sim.player.state).toBe('idle');
  });

  it('a 3-row fall deals 2 damage', () => {
    const sim = newSim(['@..', '...', '...', '===']);
    sim.player.x = 1 * 32 + 16;
    run(sim, EMPTY_INPUT, 30);
    expect(sim.player.hp).toBe(1);
    expect(sim.player.state).not.toBe('dead');
  });

  it('a 4+ row fall is lethal and emits player:died', () => {
    const sim = newSim(['@..', '...', '...', '...', '===']);
    sim.player.x = 1 * 32 + 16;
    let died = false;
    sim.bus.on('player:died', () => (died = true));
    run(sim, EMPTY_INPUT, 40);
    expect(sim.player.state).toBe('dead');
    expect(died).toBe(true);
  });
});

describe('determinism', () => {
  it('identical input recordings give identical end states', () => {
    const script = [...Array(10).fill(inp({ right: true })), inp({ right: true, up: true }), ...Array(30).fill(EMPTY_INPUT)];
    const a = newSim();
    const b = newSim();
    script.forEach((i) => {
      a.step(i);
      b.step(i);
    });
    expect([a.player.x, a.player.ty, a.player.state, a.player.hp]).toEqual([b.player.x, b.player.ty, b.player.state, b.player.hp]);
  });
});
