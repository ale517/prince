import type { Facing, Tile, TileGrid, TileType, WorldQuery } from '../contracts';
import { FALL_DAMAGE_BY_ROWS, LETHAL_FALL_ROWS } from './constants';

const SOLID_FLOOR: ReadonlySet<TileType> = new Set(['floor', 'loose', 'spikes', 'plate', 'chomper', 'exit', 'gate']);
const BLOCKS_HORIZONTAL: ReadonlySet<TileType> = new Set(['wall', 'pillar']);

const EMPTY_TILE: Tile = { type: 'empty', state: 0 };

export class ArrayTileGrid implements TileGrid {
  private readonly tiles: Tile[];

  constructor(
    readonly width: number,
    readonly height: number,
    fill: TileType = 'empty',
  ) {
    this.tiles = Array.from({ length: width * height }, () => ({ type: fill, state: 0 }));
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  /** Out-of-bounds reads are empty air, so entities can never stand outside the map. */
  get(x: number, y: number): Tile {
    return this.inBounds(x, y) ? this.tiles[y * this.width + x]! : EMPTY_TILE;
  }

  set(x: number, y: number, tile: Tile): void {
    if (!this.inBounds(x, y)) throw new RangeError(`tile (${x},${y}) out of bounds`);
    this.tiles[y * this.width + x] = tile;
  }
}

export function createWorldQuery(grid: TileGrid): WorldQuery {
  const isGround = (tx: number, ty: number): boolean => {
    const tile = grid.get(tx, ty);
    // An open or opening gate is still walkable; a loose floor that has fallen becomes 'empty'.
    return SOLID_FLOOR.has(tile.type);
  };

  return {
    groundAt: isGround,

    blockedAt(tx: number, ty: number, dir: Facing): boolean {
      const next = grid.get(tx + dir, ty);
      if (BLOCKS_HORIZONTAL.has(next.type)) return true;
      // Gate state: 0 = closed, 1 = fully open (spec 05).
      return next.type === 'gate' && next.state < 1;
    },

    ledgeAbove(tx: number, ty: number, dir: Facing): boolean {
      // Ledge to grab: floor one row up and ahead, with headroom above the player's tile.
      return isGround(tx + dir, ty - 1) && !isGround(tx, ty - 1) && !BLOCKS_HORIZONTAL.has(grid.get(tx, ty - 1).type);
    },

    rowsToGround(tx: number, ty: number): number {
      for (let rows = 0; ty + rows < grid.height; rows++) {
        if (isGround(tx, ty + rows)) return rows;
      }
      return Infinity;
    },
  };
}

/** Damage for a fall of `rows`; Infinity means lethal. */
export function fallDamage(rows: number): number {
  if (rows >= LETHAL_FALL_ROWS) return Infinity;
  return FALL_DAMAGE_BY_ROWS[Math.max(0, rows)] ?? 0;
}
