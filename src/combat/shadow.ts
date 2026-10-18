import { EMPTY_INPUT } from '../contracts';
import type { DamageEvent, InputState, WorldQuery } from '../contracts';
import { Player } from '../player';
import { TILE_SIZE } from '../world';

/** Ticks the reflection lags behind the prince. */
export const SHADOW_DELAY = 6;
/** Distance in px at which an unarmed prince touching the shadow merges with it. */
export const MERGE_RANGE_PX = 12;

/**
 * The prince's reflection. It is a full player body driven by the prince's own inputs from
 * SHADOW_DELAY ticks ago with left/right swapped, so it mirrors his movement. It shares his
 * HP: a sword blow that lands on the shadow wounds the prince instead.
 */
export class Shadow extends Player {
  readonly team = 'enemy' as const;
  private readonly history: InputState[] = [];

  constructor(
    world: WorldQuery,
    gridHeight: number,
    tx: number,
    ty: number,
    private readonly owner: Player,
  ) {
    super(world, gridHeight, { tx, ty, facing: (owner.facing * -1) as 1 | -1 });
    this.hp = owner.hp;
    this.hasSword = owner.hasSword;
    this.x = tx * TILE_SIZE + TILE_SIZE / 2;
  }

  /** Records the prince's input this tick and plays back the one from SHADOW_DELAY ticks ago. */
  follow(current: InputState): void {
    this.history.push({ ...current });
    const delayed = this.history.length > SHADOW_DELAY ? this.history.shift()! : EMPTY_INPUT;
    this.input = { ...delayed, left: delayed.right, right: delayed.left };
    this.hasSword = this.owner.hasSword;
    this.hp = this.owner.hp;
  }

  override applyDamage(e: DamageEvent): void {
    // Only blades hurt through the mirror; falls and traps do not pass to the prince.
    if (e.source === 'sword') this.owner.applyDamage({ ...e, target: this.owner.id });
  }

  /** True when the prince has put his sword away and walked into his reflection. */
  canMerge(): boolean {
    const o = this.owner;
    return o.hp > 0 && o.fightAction === 'none' && o.ty === this.ty && Math.abs(o.x - this.x) <= MERGE_RANGE_PX;
  }
}
