import { describe, expect, it } from 'vitest';
import { FightSystem, HIT_FROM, HIT_TO, PARRY_FROM, PUSHBACK_PX, createRng } from '../src/combat';
import { EMPTY_INPUT } from '../src/contracts';
import type { Combatant, DamageEvent, Facing, FightAction, InputState } from '../src/contracts';
import { DUEL_LEVEL, duelGuards, parseAscii } from '../src/level';
import { Player } from '../src/player';
import { Simulation } from '../src/sim';
import { createWorldQuery } from '../src/world';

class Dummy implements Combatant {
  readonly ty = 2;
  hp = 3;
  fightAction: FightAction = 'ready';
  fightFrame = 0;
  strikeConnected = false;
  pushed = 0;
  staggered = 0;
  constructor(
    readonly id: string,
    readonly team: 'player' | 'enemy',
    public x: number,
    readonly facing: Facing,
  ) {}
  get tx(): number {
    return Math.floor(this.x / 32);
  }
  update(): void {}
  applyDamage(e: DamageEvent): void {
    this.hp -= e.amount;
  }
  pushBack(px: number): void {
    this.pushed += px;
  }
  stagger(ticks: number): void {
    this.staggered = ticks;
  }
}

const strikeAt = (d: Dummy, frame: number): void => {
  d.fightAction = 'strike';
  d.fightFrame = frame;
};

describe('FightSystem', () => {
  it('only hits inside the strike hit window', () => {
    for (let f = 0; f <= 6; f++) {
      const a = new Dummy('a', 'player', 48, 1);
      const b = new Dummy('b', 'enemy', 80, -1);
      strikeAt(a, f);
      new FightSystem().update([a, b]);
      expect(b.hp, `frame ${f}`).toBe(f >= HIT_FROM && f <= HIT_TO ? 2 : 3);
    }
  });

  it('hits once per strike and pushes the target back half a tile', () => {
    const a = new Dummy('a', 'player', 48, 1);
    const b = new Dummy('b', 'enemy', 80, -1);
    const fs = new FightSystem();
    strikeAt(a, HIT_FROM);
    fs.update([a, b]);
    a.fightFrame = HIT_FROM + 1;
    fs.update([a, b]);
    expect(b.hp).toBe(2);
    expect(b.pushed).toBe(PUSHBACK_PX);
    expect(b.staggered).toBeGreaterThan(0);
  });

  it('misses targets behind, on another row, or out of reach', () => {
    const behind = new Dummy('b', 'enemy', 16, -1);
    const far = new Dummy('c', 'enemy', 48 + 41, -1);
    const a = new Dummy('a', 'player', 48, 1);
    strikeAt(a, HIT_FROM);
    new FightSystem().update([a, behind, far]);
    expect([behind.hp, far.hp]).toEqual([3, 3]);
  });

  it('a parry blocks the hit and staggers the attacker (riposte window)', () => {
    const a = new Dummy('a', 'player', 48, 1);
    const b = new Dummy('b', 'enemy', 80, -1);
    strikeAt(a, HIT_FROM);
    b.fightAction = 'parry';
    b.fightFrame = PARRY_FROM;
    new FightSystem().update([a, b]);
    expect(b.hp).toBe(3);
    expect(a.staggered).toBeGreaterThan(0);
    expect(a.pushed).toBe(-PUSHBACK_PX);
  });

  it('a parry that has not started or has ended does not block', () => {
    const a = new Dummy('a', 'player', 48, 1);
    const b = new Dummy('b', 'enemy', 80, -1);
    strikeAt(a, HIT_FROM);
    b.fightAction = 'parry';
    b.fightFrame = 0;
    new FightSystem().update([a, b]);
    expect(b.hp).toBe(2);
  });
});

describe('pushback', () => {
  it('pushing the player off an edge makes them fall', () => {
    const level = parseAscii(['#@=...', '......', '######']);
    const world = createWorldQuery(level.grid);
    const p = new Player(world, level.grid.height, level.start, undefined);
    p.pushBack(PUSHBACK_PX * 3);
    p.update(1);
    expect(p.state).toBe('fall');
  });
});

describe('player sword states', () => {
  const press = (p: Partial<InputState>): InputState => ({ ...EMPTY_INPUT, ...p });

  it('draws, strikes, parries and sheathes', () => {
    const sim = new Simulation(parseAscii(DUEL_LEVEL, [], { hasSword: true }));
    const p = sim.player;
    sim.step(press({ action: true }));
    expect(p.state).toBe('drawSword');
    for (let i = 0; i < 3; i++) sim.step(EMPTY_INPUT);
    expect(p.state).toBe('ready');
    sim.step(press({ action: true }));
    expect(p.state).toBe('strike');
    for (let i = 0; i < 6; i++) sim.step(EMPTY_INPUT);
    expect(p.state).toBe('ready');
    sim.step(press({ up: true }));
    expect(p.state).toBe('parry');
    for (let i = 0; i < 5; i++) sim.step(EMPTY_INPUT);
    sim.step(press({ down: true }));
    expect(p.state).toBe('sheathe');
  });

  it('cannot draw without a sword', () => {
    const sim = new Simulation(parseAscii(DUEL_LEVEL));
    sim.step(press({ action: true }));
    expect(sim.player.state).toBe('idle');
  });
});

describe('guard AI', () => {
  function fightLog(seed: number): string {
    const sim = new Simulation(parseAscii(DUEL_LEVEL, [], { hasSword: true, guards: duelGuards(3) }), seed);
    const log: string[] = [];
    for (let t = 0; t < 240; t++) {
      // Scripted player: draw, then strike every 10 ticks.
      sim.step(t === 0 || t % 10 === 5 ? { ...EMPTY_INPUT, action: true } : EMPTY_INPUT);
      const g = sim.guards[0]!;
      log.push(`${g.state}/${g.fightAction}/${g.x}/${g.hp}/${sim.player.hp}`);
    }
    return log.join('|');
  }

  it('is reproducible for a given seed', () => {
    expect(fightLog(7)).toBe(fightLog(7));
  });

  it('notices the player, approaches and fights', () => {
    const sim = new Simulation(parseAscii(DUEL_LEVEL, [], { hasSword: true, guards: duelGuards(3) }), 3);
    const g = sim.guards[0]!;
    const seen = new Set<string>();
    for (let t = 0; t < 120; t++) {
      sim.step(EMPTY_INPUT);
      seen.add(g.state);
    }
    expect(seen.has('alert')).toBe(true);
    expect(seen.has('approach')).toBe(true);
    expect(seen.has('fight')).toBe(true);
  });

  it('a guard that cannot see the player stays idle', () => {
    const level = parseAscii(['#@=#===.', '#......#', '########'], [], {
      guards: [{ id: 'g', tx: 5, ty: 0, facing: -1, hp: 3, skill: 5 }],
    });
    const sim = new Simulation(level);
    for (let t = 0; t < 60; t++) sim.step(EMPTY_INPUT);
    expect(sim.guards[0]!.state).toBe('idle');
  });

  it('dying emits guard:died and removes the guard from the bodies', () => {
    const sim = new Simulation(parseAscii(DUEL_LEVEL, [], { guards: duelGuards(1) }));
    const died: string[] = [];
    sim.bus.on('guard:died', (e) => died.push(e.id));
    sim.guards[0]!.applyDamage({ target: 'guard1', amount: 9, source: 'sword' });
    expect(died).toEqual(['guard1']);
    expect(sim.guards[0]!.state).toBe('dead');
  });

  it('rng is deterministic', () => {
    const a = createRng(5);
    const b = createRng(5);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
