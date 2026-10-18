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

/** Bodies standing on the given tile; airborne bodies pass over traps. */
export function groundedAt(ctx: ObjectContext, tx: number, ty: number): Body[] {
  return ctx.bodies.filter((b) => b.grounded && b.tx === tx && b.ty === ty);
}
