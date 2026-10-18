import { describe, expect, it } from 'vitest';
import { EMPTY_INPUT } from '../src/contracts';
import type { InputState, ObjectDef } from '../src/contracts';
import { HAZARD_LEVEL, HAZARD_OBJECTS, parseAscii } from '../src/level';
import { Simulation } from '../src/sim';
import { TILE_SIZE } from '../src/world';

const inp = (p: Partial<InputState>): InputState => ({ ...EMPTY_INPUT, ...p });
const run = (sim: Simulation, input: InputState, ticks: number): void => {
  for (let i = 0; i < ticks; i++) sim.step(input);
};
const make = (rows: string[], extra: ObjectDef[] = []) => new Simulation(parseAscii(rows, extra));
const placeAt = (sim: Simulation, tx: number): void => {
  sim.player.x = tx * TILE_SIZE + TILE_SIZE / 2;
};

describe('parseAscii objects', () => {
  it('creates objects for trap tiles and lets extras override them', () => {
    const lvl = parseAscii(['@S_=#'], [{ id: 'p', type: 'plate', tx: 2, ty: 0, props: { links: ['x'] } }]);
    expect(lvl.objects.map((o) => o.id).sort()).toEqual(['p', 'spikes@1,0']);
  });

  it('rejects duplicate ids', () => {
    expect(() =>
      parseAscii(['@=#'], [
        { id: 'a', type: 'checkpoint', tx: 1, ty: 0 },
        { id: 'a', type: 'checkpoint', tx: 2, ty: 0 },
      ]),
    ).toThrow(/duplicate/);
  });
});

describe('spikes', () => {
  it('kill a player who walks onto them and emit damage from spikes', () => {
    const sim = make(['@==S==#', '#######']);
    const sources: string[] = [];
    sim.bus.on('player:damaged', (e) => sources.push(e.source));
    run(sim, inp({ right: true }), 20);
    expect(sim.player.state).toBe('dead');
    expect(sources).toEqual(['spikes']);
  });

  it('stay hidden when nobody is near', () => {
    const sim = make(['@=======S=#']);
    run(sim, EMPTY_INPUT, 30);
    expect(sim.grid.get(8, 0).state).toBe(0);
    expect(sim.player.hp).toBe(3);
  });

  it('can be jumped over with a running jump', () => {
    const sim = make(['@======S=====#', '##############']);
    while (sim.player.tx < 5) sim.step(inp({ right: true }));
    sim.step(inp({ right: true, up: true }));
    run(sim, EMPTY_INPUT, 30);
    expect(sim.player.hp).toBe(3);
    expect(sim.player.tx).toBeGreaterThan(7);
  });
});

describe('loose floor', () => {
  it('shakes then falls away after 8 ticks, hurting a player who falls with it', () => {
    const sim = make(['#@L=#', '#...#', '#...#', '#===#']);
    placeAt(sim, 2);
    run(sim, EMPTY_INPUT, 7);
    expect(sim.grid.get(2, 0).type).toBe('loose');
    expect(sim.grid.get(2, 0).state).toBe(1);
    run(sim, EMPTY_INPUT, 40);
    expect(sim.grid.get(2, 0).type).toBe('empty');
    expect(sim.player.hp).toBeLessThan(3);
  });

  it('does nothing until somebody stands on it', () => {
    const sim = make(['#@L=#', '#===#']);
    run(sim, EMPTY_INPUT, 30);
    expect(sim.grid.get(2, 0).type).toBe('loose');
  });
});

describe('pressure plate and gate', () => {
  const rows = ['#@=_=G===#', '##########'];
  const defs: ObjectDef[] = [
    { id: 'p', type: 'plate', tx: 3, ty: 0, props: { links: ['g'] } },
    { id: 'g', type: 'gate', tx: 5, ty: 0, props: { holdTicks: 5 } },
  ];

  it('a closed gate blocks the player', () => {
    const sim = make(rows, defs);
    run(sim, inp({ right: true }), 40);
    expect(sim.player.tx).toBe(4);
  });

  it('opens while the plate is pressed and closes slowly after release', () => {
    const sim = make(rows, defs);
    let opened = false;
    sim.bus.on('gate:opened', () => (opened = true));
    placeAt(sim, 3);
    run(sim, EMPTY_INPUT, 15);
    expect(opened).toBe(true);
    expect(sim.grid.get(5, 0).state).toBe(1);
    expect(sim.world.blockedAt(4, 0, 1)).toBe(false);

    placeAt(sim, 1);
    run(sim, EMPTY_INPUT, 10);
    expect(sim.grid.get(5, 0).state).toBeLessThan(1);
    run(sim, EMPTY_INPUT, 60);
    expect(sim.grid.get(5, 0).state).toBe(0);
    expect(sim.world.blockedAt(4, 0, 1)).toBe(true);
  });
});

describe('chomper', () => {
  it('is lethal for exactly its closed window', () => {
    const sim = make(['@=C==#']);
    placeAt(sim, 4);
    let closed = 0;
    for (let i = 0; i < 30; i++) {
      sim.step(EMPTY_INPUT);
      if (sim.grid.get(2, 0).state === 2) closed++;
    }
    expect(closed).toBe(5);
    expect(sim.player.hp).toBe(3);
  });

  it('kills a player standing in the blades and respects phase offset', () => {
    const sim = make(['@=C==#']);
    placeAt(sim, 2);
    run(sim, EMPTY_INPUT, 30);
    expect(sim.player.state).toBe('dead');

    const shifted = make(['@=C==#'], [{ id: 'c', type: 'chomper', tx: 2, ty: 0, props: { phase: 10 } }]);
    // Phase 10 shifts the lethal window (22-26) to start at tick 12.
    run(shifted, EMPTY_INPUT, 13);
    expect(shifted.grid.get(2, 0).state).toBe(2);
  });
});

describe('potions', () => {
  const lvl = ['@=====#'];
  const potion = (kind: string): ObjectDef[] => [{ id: 'pot', type: 'potion', tx: 2, ty: 0, props: { kind } }];
  const drink = (sim: Simulation) => {
    placeAt(sim, 2);
    run(sim, inp({ down: true }), 3);
  };

  it('small potion heals one HP, once', () => {
    const sim = make(lvl, potion('small'));
    sim.player.hp = 1;
    drink(sim);
    expect(sim.player.hp).toBe(2);
    run(sim, EMPTY_INPUT, 5);
    drink(sim);
    expect(sim.player.hp).toBe(2);
  });

  it('large potion raises max HP and heals fully', () => {
    const sim = make(lvl, potion('large'));
    sim.player.hp = 1;
    drink(sim);
    expect([sim.player.hp, sim.player.maxHp]).toEqual([4, 4]);
  });

  it('poison hurts but never kills', () => {
    const sim = make(lvl, potion('poison'));
    sim.player.hp = 1;
    drink(sim);
    expect(sim.player.hp).toBe(1);
    const sim2 = make(lvl, potion('poison'));
    drink(sim2);
    expect(sim2.player.hp).toBe(2);
  });

  it('is not drunk by walking over it', () => {
    const sim = make(lvl, potion('small'));
    sim.player.hp = 1;
    run(sim, inp({ right: true }), 12);
    expect(sim.player.hp).toBe(1);
  });
});

describe('exit', () => {
  it('stays shut until a falling loose floor latches the plate, then completes the level', () => {
    const sim = make(['#@L=======E##', '#...........#', '#...........#', '#._..........'], [
      { id: 'p', type: 'plate', tx: 2, ty: 3, props: { links: ['x'] } },
      { id: 'x', type: 'exit', tx: 10, ty: 0 },
    ]);
    let completed = 0;
    sim.bus.on('level:completed', () => completed++);
    run(sim, inp({ right: true }), 60);
    expect(sim.grid.get(2, 3).state).toBe(1);
    expect(sim.player.ty).toBe(0);
    expect(completed).toBe(1);
  });

  it('does not complete while still shut', () => {
    const sim = make(['#@=======E##'], [{ id: 'x', type: 'exit', tx: 9, ty: 0 }]);
    let completed = 0;
    sim.bus.on('level:completed', () => completed++);
    run(sim, inp({ right: true }), 40);
    expect(completed).toBe(0);
  });
});

describe('hazard demo level', () => {
  it('parses, has unique object ids, and the player can start on it', () => {
    const lvl = parseAscii(HAZARD_LEVEL, HAZARD_OBJECTS);
    expect(lvl.grid.width).toBe(30);
    const sim = new Simulation(lvl);
    run(sim, EMPTY_INPUT, 5);
    expect(sim.player.state).toBe('idle');
  });
});
