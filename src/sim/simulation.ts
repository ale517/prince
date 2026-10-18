import { EventBus } from '../contracts';
import type { InputState, TileGrid } from '../contracts';
import type { ParsedLevel } from '../level';
import { Player } from '../player';
import { createWorldQuery } from '../world';

/** Deterministic fixed-tick simulation: same inputs in => same state out (spec 01). */
export class Simulation {
  readonly bus = new EventBus();
  readonly grid: TileGrid;
  readonly player: Player;
  tick = 0;

  constructor(level: ParsedLevel) {
    this.grid = level.grid;
    this.player = new Player(createWorldQuery(level.grid), level.grid.height, level.start, this.bus);
  }

  step(input: InputState): void {
    this.player.input = input;
    this.player.update(1);
    this.tick++;
  }
}
