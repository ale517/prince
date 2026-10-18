import type { Body, ObjectContext, ObjectDef, PropValue } from '../contracts';

export function numProp(def: ObjectDef, key: string, fallback: number): number {
  const v: PropValue | undefined = def.props?.[key];
  return typeof v === 'number' ? v : fallback;
}

export function strProp(def: ObjectDef, key: string, fallback: string): string {
  const v: PropValue | undefined = def.props?.[key];
  return typeof v === 'string' ? v : fallback;
}

export function listProp(def: ObjectDef, key: string): string[] {
  const v: PropValue | undefined = def.props?.[key];
  return Array.isArray(v) ? v : [];
}

/** Copies saved fields onto an object, ignoring unknown keys and values of the wrong type. */
export function restoreFields(target: object, state: Record<string, unknown>, keys: readonly string[]): void {
  const t = target as Record<string, unknown>;
  for (const k of keys) {
    if (typeof state[k] === typeof t[k]) t[k] = state[k];
  }
}

/** Bodies standing on the given tile; airborne bodies pass over traps. */
export function groundedAt(ctx: ObjectContext, tx: number, ty: number): Body[] {
  return ctx.bodies.filter((b) => b.grounded && b.tx === tx && b.ty === ty);
}
