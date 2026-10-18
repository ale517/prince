import {
  DUEL_LEVEL,
  HAZARD_LEVEL,
  HAZARD_OBJECTS,
  MIRROR,
  MIRROR_LEVEL,
  PROTOTYPE_GUARDS,
  PROTOTYPE_LEVEL,
  PROTOTYPE_MIRROR,
  PROTOTYPE_OBJECTS,
  TEST_LEVEL,
  duelGuards,
  parseAscii,
} from '../level';
import { Simulation } from '../sim';

export const LEVEL_IDS = ['prototype', 'hazard', 'move', 'duel', 'mirror'] as const;
export type LevelId = (typeof LEVEL_IDS)[number];

export function isLevelId(v: string | null | undefined): v is LevelId {
  return (LEVEL_IDS as readonly string[]).includes(v ?? '');
}

/** Builds a level by id; `params` carries the optional ?skill= and ?seed= of the duel arena. */
export function buildSim(id: LevelId, params: URLSearchParams = new URLSearchParams()): Simulation {
  switch (id) {
    case 'prototype':
      return new Simulation(
        parseAscii(PROTOTYPE_LEVEL, PROTOTYPE_OBJECTS, { hasSword: true, guards: PROTOTYPE_GUARDS, mirror: PROTOTYPE_MIRROR }),
        Number(params.get('seed')) || 1,
      );
    case 'mirror':
      return new Simulation(parseAscii(MIRROR_LEVEL, [], { hasSword: true, mirror: MIRROR }));
    case 'duel': {
      const skill = Math.min(5, Math.max(1, Number(params.get('skill')) || 1)) as 1 | 2 | 3 | 4 | 5;
      return new Simulation(parseAscii(DUEL_LEVEL, [], { hasSword: true, guards: duelGuards(skill) }), Number(params.get('seed')) || 1);
    }
    case 'move':
      return new Simulation(parseAscii(TEST_LEVEL));
    default:
      return new Simulation(parseAscii(HAZARD_LEVEL, HAZARD_OBJECTS));
  }
}
