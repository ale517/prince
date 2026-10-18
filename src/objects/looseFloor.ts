import type { LevelObject, ObjectContext, ObjectDef } from '../contracts';
import { LOOSE_FALL_DAMAGE, LOOSE_SHAKE_TICKS } from './constants';
import { groundedAt, restoreFields } from './props';

export class LooseFloor implements LevelObject {
  readonly id: string;
  readonly type = 'loose';
  readonly tx: number;
  readonly ty: number;
  private shaking = false;
  private timer = 0;
  private fallen = false;

  constructor(def: ObjectDef) {
    ({ id: this.id, tx: this.tx, ty: this.ty } = def);
  }

  update(ctx: ObjectContext): void {
    if (this.fallen) return;
    const tile = ctx.grid.get(this.tx, this.ty);

    if (!this.shaking && groundedAt(ctx, this.tx, this.ty).length > 0) {
      this.shaking = true;
      ctx.bus.emit('trap:triggered', { id: this.id, type: 'loose' });
    }
    if (!this.shaking) return;

    tile.state = 1;
    if (++this.timer < LOOSE_SHAKE_TICKS) return;
    this.crumble(ctx);
  }

  private crumble(ctx: ObjectContext): void {
    this.fallen = true;
    ctx.grid.set(this.tx, this.ty, { type: 'empty', state: 0 });

    const rows = ctx.world.rowsToGround(this.tx, this.ty + 1);
    if (!Number.isFinite(rows)) return;
    const landing = this.ty + 1 + rows;
    for (const b of ctx.bodies) {
      if (b.tx === this.tx && b.ty > this.ty && b.ty <= landing) {
        b.applyDamage({ target: b.id, amount: LOOSE_FALL_DAMAGE, source: 'loose' });
      }
    }
    // Rubble keeps a pressure plate down for good.
    ctx.objectAt(this.tx, landing, 'plate')?.poke?.();
  }

  serialize(): Record<string, unknown> {
    return { shaking: this.shaking, timer: this.timer, fallen: this.fallen };
  }

  restore(state: Record<string, unknown>): void {
    restoreFields(this, state, ['shaking', 'timer', 'fallen']);
  }
}
