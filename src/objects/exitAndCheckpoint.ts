import type { LevelObject, ObjectContext, ObjectDef } from '../contracts';
import { groundedAt } from './props';

export class ExitDoor implements LevelObject {
  readonly id: string;
  readonly type = 'exit';
  readonly tx: number;
  readonly ty: number;
  private open = false;
  private completed = false;

  constructor(def: ObjectDef) {
    ({ id: this.id, tx: this.tx, ty: this.ty } = def);
  }

  activate(): void {
    this.open = true;
  }

  update(ctx: ObjectContext): void {
    ctx.grid.get(this.tx, this.ty).state = this.open ? 1 : 0;
    if (!this.open || this.completed) return;
    if (groundedAt(ctx, this.tx, this.ty).some((b) => b.id === 'player')) {
      this.completed = true;
      ctx.bus.emit('level:completed', {});
    }
  }

  serialize(): Record<string, unknown> {
    return { open: this.open, completed: this.completed };
  }
}

export class Checkpoint implements LevelObject {
  readonly id: string;
  readonly type = 'checkpoint';
  readonly tx: number;
  readonly ty: number;
  private reached = false;

  constructor(def: ObjectDef) {
    ({ id: this.id, tx: this.tx, ty: this.ty } = def);
  }

  update(ctx: ObjectContext): void {
    if (this.reached) return;
    if (groundedAt(ctx, this.tx, this.ty).some((b) => b.id === 'player')) {
      this.reached = true;
      ctx.bus.emit('checkpoint:reached', { id: this.id });
    }
  }

  serialize(): Record<string, unknown> {
    return { reached: this.reached };
  }
}
