import type { Facing, TileGrid, TileType } from '../contracts';
import { ArrayTileGrid } from '../world';

const LEGEND: Record<string, TileType> = {
  '.': 'empty',
  '#': 'wall',
  '=': 'floor',
  P: 'pillar',
  L: 'loose',
  S: 'spikes',
  G: 'gate',
  _: 'plate',
  C: 'chomper',
  E: 'exit',
};

export interface ParsedLevel {
  grid: TileGrid;
  start: { tx: number; ty: number; facing: Facing };
}

/** Parses an ASCII map; '@' marks the start position and is treated as floor. */
export function parseAscii(rows: readonly string[]): ParsedLevel {
  const width = rows[0]?.length ?? 0;
  const grid = new ArrayTileGrid(width, rows.length);
  let start: ParsedLevel['start'] | undefined;
  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`row ${y} has width ${row.length}, expected ${width}`);
    [...row].forEach((ch, x) => {
      if (ch === '@') {
        start = { tx: x, ty: y, facing: 1 };
        grid.set(x, y, { type: 'floor', state: 0 });
        return;
      }
      const type = LEGEND[ch];
      if (!type) throw new Error(`unknown tile '${ch}' at (${x},${y})`);
      grid.set(x, y, { type, state: 0 });
    });
  });
  if (!start) throw new Error("level has no start marker '@'");
  return { grid, start };
}

/** Movement test arena: a 2-tile gap, a climbable ledge and a drop to the lower screen. */
export const TEST_LEVEL: readonly string[] = [
  '#..................#',
  '#....======........#',
  '#@========..=======#',
  '#..................#',
  '#..................#',
  '#==================#',
];
