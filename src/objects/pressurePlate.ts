import type { LevelObject, ObjectContext, ObjectDef } from '../contracts';
import { groundedAt, listProp } from './props';

export class PressurePlate implements LevelObject {
  readonly id: string;
  readonly type = 'plate';
  readonly tx: number;
  readonly ty: number;
  private readonly links: string[];
  private latched = false;
  private wasPressed = false;

  constructor(def: ObjectDef) {
    ({ id: this.id, tx: this.tx, ty: this.ty } = def);
    this.links = listProp(def, 'links');
  }

  poke(): void {
    this.latched = true;
  }

  update(ctx: ObjectContext): void {
    const pressed = this.latched || groundedAt(ctx, this.tx, this.ty).length > 0;
    if (pressed && !this.wasPressed) ctx.bus.emit('trap:triggered', { id: this.id, type: 'plate' });
    this.wasPressed = pressed;
    ctx.grid.get(this.tx, this.ty).state = pressed ? 1 : 0;
    if (!pressed) return;
    for (const id of this.links) ctx.get(id)?.activate?.();
  }

  serialize(): Record<string, unknown> {
    return { latched: this.latched };
  }
}
