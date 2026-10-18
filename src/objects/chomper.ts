import type { LevelObject, ObjectContext, ObjectDef } from '../contracts';
import {
  CHOMPER_LETHAL_END,
  CHOMPER_LETHAL_START,
  CHOMPER_PERIOD,
  CHOMPER_WARN_START,
  LETHAL,
} from './constants';
import { groundedAt, numProp } from './props';

export class Chomper implements LevelObject {
  readonly id: string;
  readonly type = 'chomper';
  readonly tx: number;
  readonly ty: number;
  /** Offsets the cycle so neighbouring chompers are out of sync. */
  private readonly phase: number;

  constructor(def: ObjectDef) {
    ({ id: this.id, tx: this.tx, ty: this.ty } = def);
    this.phase = numProp(def, 'phase', 0);
  }

  update(ctx: ObjectContext): void {
    const t = (ctx.tick + this.phase) % CHOMPER_PERIOD;
    const lethal = t >= CHOMPER_LETHAL_START && t <= CHOMPER_LETHAL_END;
    // state: 0 open, 1 closing or opening (warning), 2 closed
    const tile = ctx.grid.get(this.tx, this.ty);
    tile.state = lethal ? 2 : t >= CHOMPER_WARN_START || t > CHOMPER_LETHAL_END ? 1 : 0;
    if (!lethal) return;
    for (const b of groundedAt(ctx, this.tx, this.ty)) {
      b.applyDamage({ target: b.id, amount: LETHAL, source: 'chomper' });
    }
  }

  serialize(): Record<string, unknown> {
    return {};
  }
}
