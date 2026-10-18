import { EventBus } from '../contracts';
import type { Combatant, InputState, LevelObject, MirrorDef, ObjectContext, ObjectType, TileGrid, WorldQuery } from '../contracts';
import { FightSystem, Guard, Shadow, createRng } from '../combat';
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
  readonly guards: Guard[];
  /** The reflection, once the prince has stepped on the mirror and until he merges with it. */
  shadow?: Shadow;
  /** Sorted by id so update order never depends on level file order (spec 05). */
  readonly objects: LevelObject[];
  tick = 0;

  private readonly byId = new Map<string, LevelObject>();
  private readonly fights: FightSystem;
  private readonly mirrorDef?: MirrorDef;
  private mirrorUsed = false;

  /** Where the mirror hangs, for the renderer. */
  get mirror(): MirrorDef | undefined {
    return this.mirrorDef;
  }

  constructor(level: ParsedLevel, seed = 1) {
    this.mirrorDef = level.mirror;
    this.grid = level.grid;
    this.world = createWorldQuery(level.grid);
    this.player = new Player(this.world, level.grid.height, level.start, this.bus);
    this.player.hasSword = level.hasSword;
    // One RNG shared by all guards, consumed in id order, keeps fights reproducible.
    const rng = createRng(seed);
    this.guards = [...level.guards]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((d) => new Guard(d, this.world, level.grid.height, rng, this.player, this.bus));
    this.fights = new FightSystem(this.bus);
    this.objects = level.objects.map(createObject).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    for (const o of this.objects) this.byId.set(o.id, o);
  }

  step(input: InputState): void {
    this.player.input = input;
    this.player.update(1);
    for (const g of this.guards) g.update(1);
    this.updateShadow(input);
    const fighters: Combatant[] = [this.player, ...this.guards];
    if (this.shadow) fighters.push(this.shadow);
    this.fights.update(fighters);
    const ctx: ObjectContext = {
      tick: this.tick,
      grid: this.grid,
      world: this.world,
      bus: this.bus,
      bodies: [this.player, ...this.guards.filter((g) => g.state !== 'dead')],
      get: (id) => this.byId.get(id),
      objectAt: (tx, ty, type: ObjectType) => this.objects.find((o) => o.type === type && o.tx === tx && o.ty === ty),
    };
    for (const o of this.objects) o.update(ctx);
    this.tick++;
  }

  private updateShadow(input: InputState): void {
    const m = this.mirrorDef;
    if (!this.shadow && m && !this.mirrorUsed && this.player.tx === m.tx && this.player.ty === m.ty) {
      this.mirrorUsed = true;
      this.shadow = new Shadow(this.world, this.grid.height, m.shadowTx, m.ty, this.player);
      this.bus.emit('shadow:appeared', {});
    }
    const s = this.shadow;
    if (!s) return;
    s.follow(input);
    s.update(1);
    if (s.canMerge()) {
      // Merging restores the prince and leaves him a little stronger (spec 04).
      this.shadow = undefined;
      this.player.maxHp++;
      this.player.heal(this.player.maxHp);
      this.bus.emit('shadow:merged', {});
    }
  }
}
