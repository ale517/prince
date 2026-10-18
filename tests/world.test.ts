import { describe, expect, it } from 'vitest';
import { ArrayTileGrid, createWorldQuery, fallDamage } from '../src/world';

function gridWith(rows: string[]): ArrayTileGrid {
  const g = new ArrayTileGrid(rows[0]!.length, rows.length);
  const map: Record<string, 'floor' | 'wall' | 'gate' | 'empty'> = { '=': 'floor', '#': 'wall', G: 'gate', '.': 'empty' };
  rows.forEach((row, y) => [...row].forEach((c, x) => g.set(x, y, { type: map[c] ?? 'empty', state: 0 })));
  return g;
}

describe('ArrayTileGrid', () => {
  it('treats out-of-bounds as empty air', () => {
    const g = new ArrayTileGrid(2, 2, 'floor');
    expect(g.get(-1, 0).type).toBe('empty');
    expect(g.get(5, 5).type).toBe('empty');
  });

  it('rejects out-of-bounds writes', () => {
    expect(() => new ArrayTileGrid(2, 2).set(2, 0, { type: 'floor', state: 0 })).toThrow(RangeError);
  });
});

describe('WorldQuery', () => {
  const q = createWorldQuery(gridWith(['....', '.=..', '....', '====']));

  it('groundAt reflects solid tiles', () => {
    expect(q.groundAt(1, 1)).toBe(true);
    expect(q.groundAt(0, 1)).toBe(false);
  });

  it('rowsToGround counts rows until floor', () => {
    expect(q.rowsToGround(0, 0)).toBe(3);
    expect(q.rowsToGround(1, 0)).toBe(1);
    expect(q.rowsToGround(1, 3)).toBe(0);
  });

  it('blockedAt handles walls and closed gates', () => {
    const g = gridWith(['.#G.']);
    const w = createWorldQuery(g);
    expect(w.blockedAt(0, 0, 1)).toBe(true);
    expect(w.blockedAt(1, 0, 1)).toBe(true);
    g.set(2, 0, { type: 'gate', state: 1 });
    expect(w.blockedAt(1, 0, 1)).toBe(false);
    expect(w.blockedAt(3, 0, -1)).toBe(false);
  });

  it('ledgeAbove detects a grabbable ledge with headroom', () => {
    const w = createWorldQuery(gridWith(['.=..', '....', '=...']));
    expect(w.ledgeAbove(0, 1, 1)).toBe(true);
    expect(w.ledgeAbove(2, 1, 1)).toBe(false);
  });
});

describe('fallDamage', () => {
  it('follows the spec table', () => {
    expect([0, 1, 2, 3].map(fallDamage)).toEqual([0, 0, 1, 2]);
    expect(fallDamage(4)).toBe(Infinity);
  });
});
