import type { Facing, GuardDef, MirrorDef, ObjectDef, ObjectType, TileGrid, TileType } from '../contracts';
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

/** Tile characters that also spawn a behaviour object. */
const TILE_OBJECTS: Partial<Record<TileType, ObjectType>> = {
  loose: 'loose',
  spikes: 'spikes',
  gate: 'gate',
  plate: 'plate',
  chomper: 'chomper',
  exit: 'exit',
};

export interface ParsedLevel {
  grid: TileGrid;
  start: { tx: number; ty: number; facing: Facing };
  objects: ObjectDef[];
  guards: GuardDef[];
  /** The prince begins with a sword (the prototype finds it at the start). */
  hasSword: boolean;
  mirror?: MirrorDef;
}

export interface LevelExtras {
  guards?: readonly GuardDef[];
  hasSword?: boolean;
  mirror?: MirrorDef;
}

/**
 * Parses an ASCII map; '@' marks the start position and is treated as floor.
 * `extra` adds free-standing objects (potions, checkpoints) and can override the
 * auto-generated object of a tile (same type and position) to set ids and props.
 */
export function parseAscii(rows: readonly string[], extra: readonly ObjectDef[] = [], more: LevelExtras = {}): ParsedLevel {
  const width = rows[0]?.length ?? 0;
  const grid = new ArrayTileGrid(width, rows.length);
  const objects: ObjectDef[] = [];
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
      const objType = TILE_OBJECTS[type];
      if (objType) objects.push({ id: `${objType}@${x},${y}`, type: objType, tx: x, ty: y });
    });
  });
  if (!start) throw new Error("level has no start marker '@'");

  for (const def of extra) {
    const i = objects.findIndex((o) => o.type === def.type && o.tx === def.tx && o.ty === def.ty);
    if (i >= 0) objects[i] = def;
    else objects.push(def);
  }
  const ids = new Set<string>();
  for (const o of objects) {
    if (ids.has(o.id)) throw new Error(`duplicate object id '${o.id}'`);
    ids.add(o.id);
  }
  return { grid, start, objects, guards: [...(more.guards ?? [])], hasSword: more.hasSword ?? false, mirror: more.mirror };
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
