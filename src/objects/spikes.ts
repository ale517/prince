import type { LevelObject, ObjectContext, ObjectDef } from '../contracts';
import { SPIKE_EXTEND_TICKS, SPIKE_UP_TICKS, LETHAL } from './constants';
import { groundedAt, restoreFields } from './props';

/** Tile.state values, also read by the renderer. */
export const SpikePhase = { Hidden: 0, Extending: 1, Up: 2, Retracting: 3 } as const;

export class Spikes implements LevelObject {
  readonly id: string;
  readonly type = 'spikes';
  readonly tx: number;
  readonly ty: number;
  private phase: number = SpikePhase.Hidden;
  private timer = 0;

  constructor(def: ObjectDef) {
    ({ id: this.id, tx: this.tx, ty: this.ty } = def);
  }

  update(ctx: ObjectContext): void {
    switch (this.phase) {
      case SpikePhase.Hidden:
        // Anyone on the same row within one tile sets the trap off.
        if (ctx.bodies.some((b) => b.ty === this.ty && Math.abs(b.tx - this.tx) <= 1)) {
          this.phase = SpikePhase.Extending;
          this.timer = 0;
          ctx.bus.emit('trap:triggered', { id: this.id, type: 'spikes' });
        }
        break;
      case SpikePhase.Extending:
        if (++this.timer >= SPIKE_EXTEND_TICKS) this.next(SpikePhase.Up);
        break;
      case SpikePhase.Up:
        if (++this.timer >= SPIKE_UP_TICKS) this.next(SpikePhase.Retracting);
        break;
      case SpikePhase.Retracting:
        if (++this.timer >= SPIKE_EXTEND_TICKS) this.next(SpikePhase.Hidden);
        break;
    }
    ctx.grid.get(this.tx, this.ty).state = this.phase;

    if (this.phase === SpikePhase.Extending || this.phase === SpikePhase.Up) {
      for (const b of groundedAt(ctx, this.tx, this.ty)) {
        b.applyDamage({ target: b.id, amount: LETHAL, source: 'spikes' });
      }
    }
  }

  private next(phase: number): void {
    this.phase = phase;
    this.timer = 0;
  }

  serialize(): Record<string, unknown> {
    return { phase: this.phase, timer: this.timer };
  }

  restore(state: Record<string, unknown>): void {
    restoreFields(this, state, ['phase', 'timer']);
  }
}
