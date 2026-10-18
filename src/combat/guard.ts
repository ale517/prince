import type { Body, Combatant, DamageEvent, EventBus, Facing, FightAction, GuardDef, WorldQuery } from '../contracts';
import { TILE_SIZE, fallDamage } from '../world';
import { AI_TABLE } from './aiTable';
import * as K from './constants';
import type { Rng } from './rng';

export type GuardState = 'idle' | 'alert' | 'approach' | 'fight' | 'retreat' | 'fall' | 'dead';

const ACTION_TICKS: Partial<Record<FightAction, number>> = {
  strike: K.STRIKE_TICKS,
  parry: K.PARRY_TICKS,
  advance: K.SHUFFLE_TICKS,
  retreat: K.SHUFFLE_TICKS,
};
const FALL_TICKS_PER_ROW = 3;

export class Guard implements Combatant, Body {
  readonly team = 'enemy';
  readonly id: string;
  x: number;
  ty: number;
  facing: Facing;
  hp: number;
  state: GuardState = 'idle';
  fightAction: FightAction = 'none';
  fightFrame = 0;
  strikeConnected = false;
  /** Ticks spent in the current AI state. */
  frame = 0;

  private readonly skill;
  private readonly patrol;
  private cooldown = 0;
  private hurtTicks = 0;
  private fallTick = 0;
  private fallRows = 0;
  private patrolDir: Facing;

  constructor(
    def: GuardDef,
    private readonly world: WorldQuery,
    private readonly gridHeight: number,
    private readonly rng: Rng,
    private readonly target: Combatant,
    private readonly bus?: EventBus,
  ) {
    this.id = def.id;
    this.x = def.tx * TILE_SIZE + TILE_SIZE / 2;
    this.ty = def.ty;
    this.facing = def.facing;
    this.hp = def.hp;
    this.skill = AI_TABLE[def.skill];
    this.patrol = def.patrol;
    this.patrolDir = def.facing;
  }

  get tx(): number {
    return Math.floor(this.x / TILE_SIZE);
  }
  get grounded(): boolean {
    return this.state !== 'fall' && this.state !== 'dead';
  }
  get crouching(): boolean {
    return false;
  }

  applyDamage(e: DamageEvent): void {
    if (this.state === 'dead') return;
    this.hp = Math.max(0, this.hp - e.amount);
    if (this.hp > 0) return;
    this.state = 'dead';
    this.fightAction = 'none';
    this.bus?.emit('guard:died', { id: this.id });
  }

  pushBack(px: number): void {
    if (this.state !== 'dead') this.moveX(px, false);
  }

  stagger(ticks: number): void {
    if (this.state === 'dead' || this.state === 'fall') return;
    this.hurtTicks = ticks;
    this.setAction('hurt');
    // A wounded guard backs off for one shuffle before re-engaging.
    if (this.state === 'fight') this.state = 'retreat';
  }

  update(_dtTick: number = 1): void {
    if (this.state === 'dead') return;
    this.frame++;
    if (this.state === 'fall') return this.fall();
    if (!this.world.groundAt(this.tx, this.ty)) return this.startFall();
    if (this.progressAction()) return;

    const dist = Math.abs(this.target.x - this.x);
    const sameRow = this.target.ty === this.ty && this.target.hp > 0;
    switch (this.state) {
      case 'idle':
        return this.idle(dist, sameRow);
      case 'alert':
        if (!sameRow) return this.enter('idle');
        this.faceTarget();
        if (this.frame >= this.skill.reaction) this.enter('approach');
        return;
      case 'approach':
        if (!sameRow) return this.enter('idle');
        this.faceTarget();
        if (dist <= K.ENGAGE_PX) return this.enter('fight');
        this.moveX(K.GUARD_WALK_PX * this.facing, true);
        return;
      case 'retreat':
        this.setAction('retreat');
        this.enter('fight');
        return;
      case 'fight':
        if (!sameRow || dist > K.SIGHT_TILES * TILE_SIZE) return this.enter(sameRow ? 'approach' : 'idle');
        this.faceTarget();
        this.fight(dist);
        return;
    }
  }

  private enter(s: GuardState): void {
    this.state = s;
    this.frame = 0;
    this.cooldown = 0;
    if (s === 'idle' || s === 'alert' || s === 'approach') this.fightAction = 'none';
    else if (s === 'fight' && this.fightAction === 'none') this.fightAction = 'ready';
  }

  private setAction(a: FightAction): void {
    this.fightAction = a;
    this.fightFrame = 0;
    this.strikeConnected = false;
  }

  /** Advances a running action; returns true while the guard is still busy with it. */
  private progressAction(): boolean {
    const a = this.fightAction;
    if (a === 'none' || a === 'ready') return false;
    this.fightFrame++;
    if (a === 'advance') this.moveX(K.SHUFFLE_PX * this.facing, true);
    if (a === 'retreat') this.moveX(-K.SHUFFLE_PX * this.facing, true);
    const done = a === 'hurt' ? this.fightFrame >= this.hurtTicks : this.fightFrame >= (ACTION_TICKS[a] ?? 1);
    if (done) this.setAction('ready');
    return !done;
  }

  private idle(dist: number, sameRow: boolean): void {
    if (this.patrol) this.walkPatrol();
    if (!sameRow) return;
    const ahead = (this.target.x - this.x) * this.facing > 0;
    const sees = dist <= K.SIGHT_TILES * TILE_SIZE && (ahead || dist <= K.ALERT_BEHIND_PX) && this.clearLine();
    if (sees) this.enter('alert');
  }

  private walkPatrol(): void {
    const p = this.patrol!;
    if ((this.tx <= p.min && this.patrolDir === -1) || (this.tx >= p.max && this.patrolDir === 1)) {
      this.patrolDir = (this.patrolDir * -1) as Facing;
    }
    this.facing = this.patrolDir;
    this.moveX(K.GUARD_PATROL_PX * this.facing, true);
  }

  private fight(dist: number): void {
    if (this.cooldown > 0) {
      this.cooldown--;
      return;
    }
    this.cooldown = this.skill.reaction;
    const incoming = this.target.fightAction === 'strike' && this.target.fightFrame <= 2 && dist <= K.REACH_PX + 8;
    if (incoming && this.rng() < this.skill.parry) return this.setAction('parry');
    if (dist < K.TOO_CLOSE_PX) return this.setAction('retreat');
    if (dist > K.REACH_PX - 4) {
      if (this.rng() < this.skill.advance) this.setAction('advance');
      return;
    }
    if (this.rng() < this.skill.strike) return this.setAction('strike');
  }

  private faceTarget(): void {
    this.facing = this.target.x >= this.x ? 1 : -1;
  }

  /** No walls between the guard and the player. */
  private clearLine(): boolean {
    const dir: Facing = this.target.x >= this.x ? 1 : -1;
    const end = Math.floor(this.target.x / TILE_SIZE);
    for (let t = this.tx; t !== end; t += dir) if (this.world.blockedAt(t, this.ty, dir)) return false;
    return true;
  }

  /** Moves 1px at a time. Voluntary moves also refuse to leave the floor; pushbacks do not. */
  private moveX(px: number, careful: boolean): void {
    const dir = px >= 0 ? 1 : -1;
    for (let i = 0; i < Math.abs(px); i++) {
      const next = this.x + dir;
      const cur = Math.floor(this.x / TILE_SIZE);
      const nt = Math.floor(next / TILE_SIZE);
      if (nt !== cur) {
        if (this.world.blockedAt(cur, this.ty, dir)) return;
        if (careful && !this.world.groundAt(nt, this.ty)) return;
      }
      // Never walk through the player.
      if (careful && this.target.ty === this.ty && Math.abs(next - this.target.x) < K.TOO_CLOSE_PX - 4) return;
      this.x = next;
    }
  }

  private startFall(): void {
    this.state = 'fall';
    this.fightAction = 'none';
    this.fallTick = 0;
    this.fallRows = 0;
  }

  private fall(): void {
    if (++this.fallTick < FALL_TICKS_PER_ROW) return;
    this.fallTick = 0;
    this.ty++;
    this.fallRows++;
    if (this.ty >= this.gridHeight) return this.applyDamage({ target: this.id, amount: this.hp, source: 'fall' });
    if (!this.world.groundAt(this.tx, this.ty)) return;
    const dmg = fallDamage(this.fallRows);
    this.state = 'idle';
    this.frame = 0;
    if (dmg > 0) this.applyDamage({ target: this.id, amount: Number.isFinite(dmg) ? dmg : this.hp, source: 'fall' });
  }
}
