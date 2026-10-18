import type { LevelObject, ObjectContext, ObjectDef } from '../contracts';
import { groundedAt, strProp } from './props';

export type PotionKind = 'small' | 'large' | 'poison';

export class Potion implements LevelObject {
  readonly id: string;
  readonly type = 'potion';
  readonly tx: number;
  readonly ty: number;
  readonly kind: PotionKind;
  consumed = false;

  constructor(def: ObjectDef) {
    ({ id: this.id, tx: this.tx, ty: this.ty } = def);
    const k = strProp(def, 'kind', 'small');
    this.kind = k === 'large' || k === 'poison' ? k : 'small';
  }

  update(ctx: ObjectContext): void {
    if (this.consumed) return;
    const drinker = groundedAt(ctx, this.tx, this.ty).find((b) => b.crouching && b.heal && b.addMaxHp);
    if (!drinker) return;

    this.consumed = true;
    if (this.kind === 'small') drinker.heal?.(1);
    else if (this.kind === 'large') drinker.addMaxHp?.(1);
    // Poison hurts but never kills.
    else if (drinker.hp > 1) drinker.applyDamage({ target: drinker.id, amount: 1, source: 'poison' });
    ctx.bus.emit('potion:collected', { id: this.id, kind: this.kind });
  }

  serialize(): Record<string, unknown> {
    return { consumed: this.consumed };
  }
}
