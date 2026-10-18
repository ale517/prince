import type { LevelObject, ObjectContext, ObjectDef } from '../contracts';
import { GATE_CLOSE_TICKS, GATE_DEFAULT_HOLD_TICKS, GATE_OPEN_TICKS } from './constants';
import { numProp } from './props';

export class Gate implements LevelObject {
  readonly id: string;
  readonly type = 'gate';
  readonly tx: number;
  readonly ty: number;
  /** 0 = closed, 1 = fully open. Mirrored into tile.state, which the world uses to block movement. */
  private openness = 0;
  private hold = 0;
  private readonly holdTicks: number;

  constructor(def: ObjectDef) {
    ({ id: this.id, tx: this.tx, ty: this.ty } = def);
    this.holdTicks = numProp(def, 'holdTicks', GATE_DEFAULT_HOLD_TICKS);
  }

  activate(): void {
    this.hold = this.holdTicks;
  }

  update(ctx: ObjectContext): void {
    const was = this.openness;
    if (this.hold > 0) {
      this.hold--;
      this.openness = Math.min(1, this.openness + 1 / GATE_OPEN_TICKS);
    } else {
      this.openness = Math.max(0, this.openness - 1 / GATE_CLOSE_TICKS);
    }
    if (was < 1 && this.openness >= 1) ctx.bus.emit('gate:opened', { id: this.id });
    ctx.grid.get(this.tx, this.ty).state = this.openness;
  }

  serialize(): Record<string, unknown> {
    return { openness: this.openness, hold: this.hold };
  }
}
