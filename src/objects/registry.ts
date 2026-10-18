import type { LevelObject, ObjectDef } from '../contracts';
import { Chomper } from './chomper';
import { Checkpoint, ExitDoor } from './exitAndCheckpoint';
import { Gate } from './gate';
import { LooseFloor } from './looseFloor';
import { Potion } from './potion';
import { PressurePlate } from './pressurePlate';
import { Spikes } from './spikes';

const FACTORIES: Record<ObjectDef['type'], (def: ObjectDef) => LevelObject> = {
  spikes: (d) => new Spikes(d),
  loose: (d) => new LooseFloor(d),
  gate: (d) => new Gate(d),
  plate: (d) => new PressurePlate(d),
  chomper: (d) => new Chomper(d),
  potion: (d) => new Potion(d),
  exit: (d) => new ExitDoor(d),
  checkpoint: (d) => new Checkpoint(d),
};

export function createObject(def: ObjectDef): LevelObject {
  const make = FACTORIES[def.type];
  if (!make) throw new Error(`unknown object type '${def.type}' (id ${def.id})`);
  return make(def);
}
