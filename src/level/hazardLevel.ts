import type { ObjectDef } from '../contracts';

/**
 * Hazard demo (30x6 tiles, two screens tall): spikes, loose floors, a plate-operated gate,
 * a chomper, potions on a ledge, and an exit opened by a second plate.
 */
export const HAZARD_LEVEL: readonly string[] = [
  '#............................#',
  '#..................====......#',
  '#@===S==LL==_=G==C====_==E===#',
  '#............................#',
  '#............................#',
  '#============================#',
];

export const HAZARD_OBJECTS: readonly ObjectDef[] = [
  { id: 'plate1', type: 'plate', tx: 12, ty: 2, props: { links: ['gate1'] } },
  { id: 'gate1', type: 'gate', tx: 14, ty: 2, props: { holdTicks: 150 } },
  { id: 'plate2', type: 'plate', tx: 22, ty: 2, props: { links: ['exit1'] } },
  { id: 'exit1', type: 'exit', tx: 25, ty: 2 },
  { id: 'pot-small', type: 'potion', tx: 3, ty: 2, props: { kind: 'small' } },
  { id: 'pot-large', type: 'potion', tx: 20, ty: 1, props: { kind: 'large' } },
  { id: 'pot-poison', type: 'potion', tx: 22, ty: 1, props: { kind: 'poison' } },
  { id: 'cp1', type: 'checkpoint', tx: 11, ty: 2 },
];
