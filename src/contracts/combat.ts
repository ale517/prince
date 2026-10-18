import type { DamageEvent, Entity } from './entity';
import type { Facing } from './world';

/** Level data for one guard (spec 04). */
export interface GuardDef {
  id: string;
  tx: number;
  ty: number;
  facing: Facing;
  hp: number;
  skill: 1 | 2 | 3 | 4 | 5;
  patrol?: { min: number; max: number };
}

/** What a fighter is doing right now, independent of how it animates. */
export type FightAction = 'none' | 'ready' | 'advance' | 'retreat' | 'strike' | 'parry' | 'hurt';

/** Anything that can trade sword blows; implemented by the player, guards and the shadow. */
export interface Combatant extends Entity {
  readonly team: 'player' | 'enemy';
  /** Horizontal position in px. */
  readonly x: number;
  readonly hp: number;
  readonly fightAction: FightAction;
  /** Ticks since the current action began (0 on the tick it starts). */
  readonly fightFrame: number;
  /** Set by the fight system so one strike hits at most once. */
  strikeConnected: boolean;
  applyDamage(e: DamageEvent): void;
  /** Pushes along the floor by signed px; walls stop it, edges do not. */
  pushBack(px: number): void;
  stagger(ticks: number): void;
}
