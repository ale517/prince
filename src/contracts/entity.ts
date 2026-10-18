import type { Facing } from './world';

export interface Entity {
  id: string;
  tx: number;
  ty: number;
  facing: Facing;
  update(dtTick: number): void;
}

export type DamageSource = 'sword' | 'fall' | 'spikes' | 'chomper';

export interface DamageEvent {
  target: string;
  amount: number;
  source: DamageSource;
}

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  shift: boolean;
  action: boolean;
  pause: boolean;
}

export const EMPTY_INPUT: Readonly<InputState> = {
  left: false,
  right: false,
  up: false,
  down: false,
  shift: false,
  action: false,
  pause: false,
};
