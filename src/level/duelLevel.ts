import type { GuardDef, MirrorDef } from '../contracts';

/** A corridor with a mirror at tx 2; the reflection steps out at tx 8, on the same screen. Sheathe (Down) and walk into it to merge. */
export const MIRROR_LEVEL: readonly string[] = [
  '#....................#',
  '#....................#',
  '#@==================.#',
  '#....................#',
  '#....................#',
  '#====================#',
];

export const MIRROR: MirrorDef = { tx: 2, ty: 2, shadowTx: 8 };

/** Flat sword-fighting arena: one guard on a single long floor, plus a ledge edge to test pushback. */
export const DUEL_LEVEL: readonly string[] = [
  '#....................#',
  '#....................#',
  '#@==================.#',
  '#....................#',
  '#....................#',
  '#====================#',
];

export function duelGuards(skill: GuardDef['skill']): GuardDef[] {
  return [{ id: 'guard1', tx: 8, ty: 2, facing: -1, hp: 3, skill }];
}
