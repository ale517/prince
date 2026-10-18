import type { GuardDef } from '../contracts';

export interface AiSkill {
  /** Chance to answer an incoming strike with a parry. */
  parry: number;
  /** Chance to strike when in range at a decision point. */
  strike: number;
  /** Ticks between decisions; lower is a faster, more alert fighter. */
  reaction: number;
  /** Chance to close the distance instead of waiting. */
  advance: number;
}

export const AI_TABLE: Record<GuardDef['skill'], AiSkill> = {
  1: { parry: 0.2, strike: 0.25, reaction: 6, advance: 0.3 },
  2: { parry: 0.32, strike: 0.32, reaction: 5, advance: 0.4 },
  3: { parry: 0.45, strike: 0.4, reaction: 4, advance: 0.5 },
  4: { parry: 0.6, strike: 0.5, reaction: 3, advance: 0.65 },
  5: { parry: 0.75, strike: 0.6, reaction: 2, advance: 0.8 },
};
