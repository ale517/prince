import type { DamageEvent } from './entity';
import type { EventBus } from './events';
import type { TileGrid, WorldQuery } from './world';

/** Object kinds implemented so far; torch and mirror are added by later modules. */
export type ObjectType = 'spikes' | 'loose' | 'gate' | 'plate' | 'chomper' | 'potion' | 'exit' | 'checkpoint';

export type PropValue = number | string | boolean | string[];

export interface ObjectDef {
  id: string;
  type: ObjectType;
  tx: number;
  ty: number;
  props?: Record<string, PropValue>;
}

/** Anything a trap can affect: the player now, guards later. */
export interface Body {
  readonly id: string;
  readonly tx: number;
  readonly ty: number;
  readonly hp: number;
  /** Standing on a surface, as opposed to jumping, hanging or falling. */
  readonly grounded: boolean;
  /** Holding down while grounded; used to pick up potions. */
  readonly crouching: boolean;
  applyDamage(e: DamageEvent): void;
  heal?(n: number): void;
  addMaxHp?(n: number): void;
}

export interface ObjectContext {
  readonly tick: number;
  readonly grid: TileGrid;
  readonly world: WorldQuery;
  readonly bus: EventBus;
  readonly bodies: readonly Body[];
  get(id: string): LevelObject | undefined;
  objectAt(tx: number, ty: number, type: ObjectType): LevelObject | undefined;
}

export interface LevelObject {
  readonly id: string;
  readonly type: ObjectType;
  readonly tx: number;
  readonly ty: number;
  update(ctx: ObjectContext): void;
  /** Called every tick by a pressed plate that links to this object. */
  activate?(): void;
  /** Permanently presses a plate (e.g. rubble from a loose floor landing on it). */
  poke?(): void;
  serialize(): Record<string, unknown>;
  /** Re-applies a state previously returned by serialize(), on a freshly built object. */
  restore?(state: Record<string, unknown>): void;
}
