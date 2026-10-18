import type { GuardDef, MirrorDef, ObjectDef } from '../contracts';

/**
 * The prototype level (spec 06): six screens wide, two storeys tall. All play happens on the
 * upper floor (row 2); the lower floor is only a safety net. The route, left to right:
 *   1 start room  2 spikes, a ledge with a large potion over a loose tile, plate + gate
 *   3 two chompers  4 guard 1  5 mirror room  6 loose-tile plate, guard 2, exit.
 */
const W = 60;

const blank = (ch: string): string[] => Array.from({ length: W }, (_, x) => (x === 0 || x === W - 1 ? '#' : ch));

function build(): string[] {
  const top = blank('.');
  const ledge = blank('.');
  const main = blank('=');
  const mid = blank('.');
  const low = blank('.');
  const floor = blank('=');
  const set = (row: string[], x: number, ch: string): void => {
    row[x] = ch;
  };

  set(main, 1, '@');
  set(main, 12, 'S');
  set(main, 16, '_');
  set(main, 19, 'G');
  set(main, 23, 'C');
  set(main, 27, 'C');
  set(main, 45, 'S');
  set(main, 52, '_');
  set(main, 58, 'E');
  // Ledge over the plate; its last tile is loose, so greed is punished with a one-row drop.
  for (let x = 14; x <= 17; x++) set(ledge, x, '=');
  set(ledge, 17, 'L');
  // Ledge whose loose tile drops onto the exit plate.
  for (let x = 50; x <= 53; x++) set(ledge, x, '=');
  set(ledge, 52, 'L');

  return [top, ledge, main, mid, low, floor].map((r) => r.join(''));
}

export const PROTOTYPE_LEVEL: readonly string[] = build();

export const PROTOTYPE_OBJECTS: readonly ObjectDef[] = [
  { id: 'plate1', type: 'plate', tx: 16, ty: 2, props: { links: ['gate1'] } },
  { id: 'gate1', type: 'gate', tx: 19, ty: 2, props: { holdTicks: 150 } },
  { id: 'plate2', type: 'plate', tx: 52, ty: 2, props: { links: ['exit1'] } },
  { id: 'exit1', type: 'exit', tx: 58, ty: 2 },
  { id: 'pot-small1', type: 'potion', tx: 7, ty: 2, props: { kind: 'small' } },
  { id: 'pot-large', type: 'potion', tx: 15, ty: 1, props: { kind: 'large' } },
  { id: 'pot-small2', type: 'potion', tx: 30, ty: 2, props: { kind: 'small' } },
  { id: 'cp1', type: 'checkpoint', tx: 21, ty: 2 },
  { id: 'cp2', type: 'checkpoint', tx: 31, ty: 2 },
  { id: 'cp3', type: 'checkpoint', tx: 47, ty: 2 },
];

export const PROTOTYPE_GUARDS: readonly GuardDef[] = [
  { id: 'g1', tx: 36, ty: 2, facing: -1, hp: 3, skill: 1 },
  { id: 'g2', tx: 55, ty: 2, facing: -1, hp: 3, skill: 3 },
];

/** The mirror at tx 41 spawns the reflection at tx 44, on the same screen. */
export const PROTOTYPE_MIRROR: MirrorDef = { tx: 41, ty: 2, shadowTx: 44 };
