import { EMPTY_INPUT } from '../contracts';
import type { Body, Combatant, DamageEvent, EventBus, Facing, FightAction, InputState, WorldQuery } from '../contracts';
import * as F from '../combat/constants';
import { TILE_SIZE, fallDamage } from '../world';
import * as C from './constants';

export type PlayerState =
  | 'idle'
  | 'startRun'
  | 'run'
  | 'stopRun'
  | 'turn'
  | 'step'
  | 'jumpStanding'
  | 'jumpRunning'
  | 'jumpUp'
  | 'hang'
  | 'climbUp'
  | 'fall'
  | 'land'
  | 'crouch'
  | 'drawSword'
  | 'sheathe'
  | 'ready'
  | 'advance'
  | 'retreat'
  | 'strike'
  | 'parry'
  | 'hurt'
  | 'dead';

const GROUNDED: ReadonlySet<PlayerState> = new Set([
  'idle', 'startRun', 'run', 'stopRun', 'turn', 'step', 'land', 'crouch',
  'drawSword', 'sheathe', 'ready', 'advance', 'retreat', 'strike', 'parry', 'hurt',
]);

const FIGHT_ACTION: Partial<Record<PlayerState, FightAction>> = {
  ready: 'ready',
  drawSword: 'ready',
  advance: 'advance',
  retreat: 'retreat',
  strike: 'strike',
  parry: 'parry',
  hurt: 'hurt',
};

export interface PlayerStart {
  tx: number;
  ty: number;
  facing: Facing;
}

export class Player implements Combatant, Body {
  readonly id = 'player';
  readonly team: 'player' | 'enemy' = 'player';
  /** Horizontal position in px (centre of the character). */
  x: number;
  ty: number;
  facing: Facing;
  hp = C.DEFAULT_MAX_HP;
  maxHp = C.DEFAULT_MAX_HP;
  hasSword = false;
  state: PlayerState = 'idle';
  /** Ticks spent in the current state. */
  frame = 0;
  input: InputState = { ...EMPTY_INPUT };

  private fallRows = 0;
  private fallTick = 0;
  private landTicks = C.LAND_TICKS;
  private hangTarget: { tx: number; ty: number } | null = null;
  private hurtTicks = F.HURT_TICKS;
  strikeConnected = false;

  constructor(
    private readonly world: WorldQuery,
    private readonly gridHeight: number,
    start: PlayerStart,
    private readonly bus?: EventBus,
  ) {
    this.x = start.tx * TILE_SIZE + TILE_SIZE / 2;
    this.ty = start.ty;
    this.facing = start.facing;
  }

  get tx(): number {
    return Math.floor(this.x / TILE_SIZE);
  }

  get grounded(): boolean {
    return GROUNDED.has(this.state);
  }

  get crouching(): boolean {
    return this.state === 'crouch';
  }

  get fightAction(): FightAction {
    return FIGHT_ACTION[this.state] ?? 'none';
  }

  get fightFrame(): number {
    return this.frame;
  }

  pushBack(px: number): void {
    if (this.grounded) this.moveX(px);
  }

  stagger(ticks: number): void {
    if (this.state === 'dead' || !this.grounded) return;
    this.hurtTicks = ticks;
    this.setState('hurt');
  }

  /** Length of the current landing recovery, for the landing animation. */
  get landDuration(): number {
    return this.landTicks;
  }

  /** 0..1 progress through the current row of a fall, so the renderer can smooth the 32px drops. */
  get fallPhase(): number {
    return this.state === 'fall' ? this.fallTick / C.FALL_TICKS_PER_ROW : 0;
  }

  applyDamage(e: DamageEvent): void {
    if (this.state === 'dead') return;
    this.hp = Math.max(0, this.hp - e.amount);
    this.bus?.emit('player:damaged', e);
    if (this.hp === 0) {
      this.setState('dead');
      this.bus?.emit('player:died', { source: e.source });
    }
  }

  heal(n: number): void {
    this.hp = Math.min(this.maxHp, this.hp + n);
    this.bus?.emit('player:healed', { amount: n });
  }

  addMaxHp(n: number): void {
    this.maxHp = Math.min(C.MAX_HP_CAP, this.maxHp + n);
    this.hp = this.maxHp;
  }

  /** Puts a freshly created player back where a checkpoint recorded him. */
  restoreState(s: { x: number; ty: number; facing: Facing; hp: number; maxHp: number; hasSword: boolean }): void {
    this.x = s.x;
    this.ty = s.ty;
    this.facing = s.facing;
    this.maxHp = s.maxHp;
    this.hp = Math.max(1, Math.min(s.hp, s.maxHp));
    this.hasSword = s.hasSword;
    this.setState('idle');
  }

  update(_dtTick: number = 1): void {
    if (this.state === 'dead') return;
    if (GROUNDED.has(this.state) && !this.world.groundAt(this.tx, this.ty)) {
      this.startFall();
      return;
    }
    const before = this.state;
    this.run(before);
    // A state change resets `frame` to 0 inside setState, so only count ticks that stayed put.
    if (this.state === before) this.frame++;
  }

  private dirInput(): Facing | 0 {
    const { left, right } = this.input;
    return right && !left ? 1 : left && !right ? -1 : 0;
  }

  private setState(s: PlayerState): void {
    this.state = s;
    this.frame = 0;
    this.strikeConnected = false;
  }

  /** Moves 1px at a time so walls stop the player exactly at the tile edge. */
  private moveX(px: number): boolean {
    const dir = px >= 0 ? 1 : -1;
    for (let i = 0; i < Math.abs(px); i++) {
      const next = this.x + dir;
      const cur = Math.floor(this.x / TILE_SIZE);
      if (Math.floor(next / TILE_SIZE) !== cur && this.world.blockedAt(cur, this.ty, dir)) return false;
      this.x = next;
    }
    return true;
  }

  private run(s: PlayerState): void {
    const i = this.input;
    const dir = this.dirInput();
    switch (s) {
      case 'idle': {
        if (i.action && this.hasSword) return this.setState('drawSword');
        if (i.down) return this.setState('crouch');
        if (i.up) {
          if (dir) {
            this.facing = dir;
            return this.setState('jumpStanding');
          }
          return this.setState('jumpUp');
        }
        if (dir && dir !== this.facing) return this.setState('turn');
        if (dir) return this.setState(i.shift ? 'step' : 'startRun');
        return;
      }
      case 'turn':
        if (this.frame >= C.TURN_TICKS) {
          this.facing = (this.facing * -1) as Facing;
          this.setState('idle');
        }
        return;
      case 'step': {
        // Careful steps never walk off an edge: stop before leaving the floor.
        const nextTile = Math.floor((this.x + C.STEP_PX_PER_TICK * this.facing) / TILE_SIZE);
        if (this.frame >= C.STEP_TICKS || !this.world.groundAt(nextTile, this.ty)) return this.setState('idle');
        this.moveX(C.STEP_PX_PER_TICK * this.facing);
        return;
      }
      case 'startRun':
        this.moveX(C.START_RUN_SPEED * this.facing);
        if (this.frame + 1 >= C.START_RUN_TICKS) this.setState(dir === this.facing ? 'run' : 'stopRun');
        return;
      case 'run': {
        if (i.up) return this.setState('jumpRunning');
        if (dir !== this.facing) return this.setState('stopRun');
        if (!this.moveX(C.RUN_SPEED * this.facing)) return this.setState('stopRun');
        return;
      }
      case 'stopRun':
        this.moveX(C.STOP_RUN_SPEED * this.facing);
        if (this.frame + 1 >= C.STOP_RUN_TICKS) this.setState('idle');
        return;
      case 'jumpStanding':
        return this.jump(C.STANDING_JUMP_PX, C.STANDING_JUMP_TICKS);
      case 'jumpRunning':
        return this.jump(C.RUNNING_JUMP_PX, C.RUNNING_JUMP_TICKS);
      case 'jumpUp':
        if (this.frame + 1 < C.JUMP_UP_TICKS) return;
        if (this.world.ledgeAbove(this.tx, this.ty, this.facing)) {
          this.hangTarget = { tx: this.tx + this.facing, ty: this.ty - 1 };
          this.snapToTileCentre();
          return this.setState('hang');
        }
        return this.land(C.LAND_TICKS);
      case 'hang':
        if (i.up) return this.setState('climbUp');
        if (i.down) {
          this.hangTarget = null;
          return this.world.groundAt(this.tx, this.ty) ? this.land(C.LAND_TICKS) : this.startFall();
        }
        return;
      case 'climbUp':
        if (this.frame + 1 >= C.CLIMB_UP_TICKS && this.hangTarget) {
          this.x = this.hangTarget.tx * TILE_SIZE + TILE_SIZE / 2;
          this.ty = this.hangTarget.ty;
          this.hangTarget = null;
          this.setState('idle');
        }
        return;
      case 'fall':
        return this.fall();
      case 'land':
        if (this.frame + 1 >= this.landTicks) this.setState('idle');
        return;
      case 'crouch':
        if (!i.down) this.setState('idle');
        return;
      case 'dead':
        return;
      case 'drawSword':
        if (this.frame + 1 >= F.DRAW_TICKS) this.setState('ready');
        return;
      case 'sheathe':
        if (this.frame + 1 >= F.SHEATHE_TICKS) this.setState('idle');
        return;
      case 'ready': {
        if (i.down) return this.setState('sheathe');
        if (i.action) return this.setState('strike');
        if (i.up) return this.setState('parry');
        if (dir === this.facing) return this.setState('advance');
        if (dir) return this.setState('retreat');
        return;
      }
      case 'advance':
      case 'retreat': {
        // Same rule as careful steps: shuffling never leaves the floor.
        const way = s === 'advance' ? this.facing : (-this.facing as Facing);
        const nextTile = Math.floor((this.x + F.SHUFFLE_PX * way) / TILE_SIZE);
        if (this.world.groundAt(nextTile, this.ty)) this.moveX(F.SHUFFLE_PX * way);
        if (this.frame + 1 >= F.SHUFFLE_TICKS) this.setState('ready');
        return;
      }
      case 'strike':
        if (this.frame + 1 >= F.STRIKE_TICKS) this.setState('ready');
        return;
      case 'parry':
        if (this.frame + 1 >= F.PARRY_TICKS) this.setState('ready');
        return;
      case 'hurt':
        if (this.frame + 1 >= this.hurtTicks) this.setState('ready');
        return;
    }
  }

  private jump(totalPx: number, ticks: number): void {
    this.moveX(C.spreadPx(totalPx, ticks, this.frame) * this.facing);
    if (this.frame + 1 < ticks) return;
    if (this.world.groundAt(this.tx, this.ty)) return this.land(C.LAND_TICKS);
    // Holding shift at the end of a jump grabs a ledge directly ahead of the gap.
    if (this.input.shift && this.world.groundAt(this.tx + this.facing, this.ty)) {
      this.hangTarget = { tx: this.tx + this.facing, ty: this.ty };
      this.ty += 1;
      this.snapToTileCentre();
      return this.setState('hang');
    }
    this.startFall();
  }

  private snapToTileCentre(): void {
    this.x = this.tx * TILE_SIZE + TILE_SIZE / 2;
  }

  private land(ticks: number): void {
    this.landTicks = ticks;
    this.setState('land');
  }

  private startFall(): void {
    this.fallRows = 0;
    this.fallTick = 0;
    this.setState('fall');
  }

  private fall(): void {
    if (++this.fallTick < C.FALL_TICKS_PER_ROW) return;
    this.fallTick = 0;
    this.ty++;
    this.fallRows++;
    if (this.ty >= this.gridHeight) {
      this.applyDamage({ target: this.id, amount: this.hp, source: 'fall' });
      return;
    }
    if (!this.world.groundAt(this.tx, this.ty)) return;
    const dmg = fallDamage(this.fallRows);
    if (dmg > 0) this.applyDamage({ target: this.id, amount: Number.isFinite(dmg) ? dmg : this.hp, source: 'fall' });
    if (this.hp > 0) this.land(dmg > 0 ? C.HURT_LAND_TICKS : C.LAND_TICKS);
  }
}
