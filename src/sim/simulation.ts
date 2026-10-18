import { EventBus } from '../contracts';
import type { InputState, LevelObject, ObjectContext, ObjectType, TileGrid, WorldQuery } from '../contracts';
import type { ParsedLevel } from '../level';
import { createObject } from '../objects';
import { Player } from '../player';
import { createWorldQuery } from '../world';

/** Deterministic fixed-tick simulation: same inputs in => same state out (spec 01). */
export class Simulation {
  readonly bus = new EventBus();
  readonly grid: TileGrid;
  readonly world: WorldQuery;
  readonly player: Player;
  /** Sorted by id so update order never depends on level file order (spec 05). */
  readonly objects: LevelObject[];
  tick = 0;

  private readonly byId = new Map<string, LevelObject>();

  constructor(level: ParsedLevel) {
    this.grid = level.grid;
    this.world = createWorldQuery(level.grid);
    this.player = new Player(this.world, level.grid.height, level.start, this.bus);
    this.objects = level.objects.map(createObject).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    for (const o of this.objects) this.byId.set(o.id, o);
  }

  step(input: InputState): void {
    this.player.input = input;
    this.player.update(1);
    const ctx: ObjectContext = {
      tick: this.tick,
      grid: this.grid,
      world: this.world,
      bus: this.bus,
      bodies: [this.player],
      get: (id) => this.byId.get(id),
      objectAt: (tx, ty, type: ObjectType) => this.objects.find((o) => o.type === type && o.tx === tx && o.ty === ty),
    };
    for (const o of this.objects) o.update(ctx);
    this.tick++;
  }
}
