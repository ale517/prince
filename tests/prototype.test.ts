import { describe, expect, it } from 'vitest';
import { EMPTY_INPUT } from '../src/contracts';
import { PROTOTYPE_GUARDS, PROTOTYPE_LEVEL, PROTOTYPE_MIRROR, PROTOTYPE_OBJECTS, parseAscii } from '../src/level';
import { Simulation } from '../src/sim';

const parsed = () => parseAscii(PROTOTYPE_LEVEL, PROTOTYPE_OBJECTS, { hasSword: true, guards: PROTOTYPE_GUARDS, mirror: PROTOTYPE_MIRROR });

describe('prototype level', () => {
  const lvl = parsed();
  const standable = (tx: number, ty: number): boolean => !['empty', 'wall'].includes(lvl.grid.get(tx, ty).type);

  it('is six screens wide and two tall', () => {
    expect(lvl.grid.width).toBe(60);
    expect(lvl.grid.height).toBe(6);
  });

  it('starts, checkpoints, guards and the mirror stand on solid ground', () => {
    expect(standable(lvl.start.tx, lvl.start.ty)).toBe(true);
    for (const o of lvl.objects.filter((o) => o.type === 'checkpoint' || o.type === 'potion')) {
      if (o.ty === 1) continue;
      expect(standable(o.tx, o.ty), o.id).toBe(true);
    }
    for (const g of lvl.guards) expect(standable(g.tx, g.ty), g.id).toBe(true);
    expect(standable(PROTOTYPE_MIRROR.tx, PROTOTYPE_MIRROR.ty)).toBe(true);
    expect(standable(PROTOTYPE_MIRROR.shadowTx, PROTOTYPE_MIRROR.ty)).toBe(true);
  });

  it('keeps the mirror and its reflection on one screen', () => {
    expect(Math.floor(PROTOTYPE_MIRROR.tx / 10)).toBe(Math.floor(PROTOTYPE_MIRROR.shadowTx / 10));
  });

  it('links every plate to an existing object and has an exit', () => {
    const ids = new Set(lvl.objects.map((o) => o.id));
    for (const o of lvl.objects.filter((o) => o.type === 'plate')) {
      const links = (o.props?.links ?? []) as string[];
      expect(links.length, o.id).toBeGreaterThan(0);
      for (const l of links) expect(ids.has(l), `${o.id} -> ${l}`).toBe(true);
    }
    expect(lvl.objects.some((o) => o.type === 'exit')).toBe(true);
  });

  it('has at least two checkpoints', () => {
    expect(lvl.objects.filter((o) => o.type === 'checkpoint').length).toBeGreaterThanOrEqual(2);
  });

  it('lets the prince walk the start room without harm', () => {
    const sim = new Simulation(parsed());
    for (let i = 0; i < 40 && sim.player.tx < 11; i++) sim.step({ ...EMPTY_INPUT, right: true });
    expect(sim.player.tx).toBeGreaterThan(5);
    expect(sim.player.hp).toBe(sim.player.maxHp);
  });
});
