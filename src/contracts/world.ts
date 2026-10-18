export type TileType =
  | 'empty'
  | 'floor'
  | 'wall'
  | 'pillar'
  | 'loose'
  | 'spikes'
  | 'gate'
  | 'plate'
  | 'chomper'
  | 'exit'
  | 'torch';

export type Facing = 1 | -1;

export interface Tile {
  type: TileType;
  /** Module-specific mutable state (e.g. gate openness). */
  state: number;
  /** Id of a linked object, if any. */
  link?: string;
}

export interface TileGrid {
  readonly width: number;
  readonly height: number;
  inBounds(x: number, y: number): boolean;
  get(x: number, y: number): Tile;
  set(x: number, y: number, tile: Tile): void;
}

/** Tile queries used by entities; all lookups are deterministic (spec 02). */
export interface WorldQuery {
  groundAt(tx: number, ty: number): boolean;
  blockedAt(tx: number, ty: number, dir: Facing): boolean;
  ledgeAbove(tx: number, ty: number, dir: Facing): boolean;
  rowsToGround(tx: number, ty: number): number;
}
