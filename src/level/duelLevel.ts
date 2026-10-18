import type { GuardDef } from '../contracts';

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
