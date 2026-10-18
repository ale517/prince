import type { DamageEvent } from './entity';

/** Typed event map for the shared event bus (spec 01). */
export interface GameEvents {
  'player:damaged': DamageEvent;
  'player:died': { source: DamageEvent['source'] };
  'player:healed': { amount: number };
  'guard:died': { id: string };
  'trap:triggered': { id: string; type: string };
  'gate:opened': { id: string };
  'potion:collected': { id: string; kind: string };
  'checkpoint:reached': { id: string };
  // Remaining time is owned by the timer in the UI module, so it is not duplicated here.
  'level:completed': Record<string, never>;
  'timer:tick': { remaining: number };
  'timer:expired': Record<string, never>;
  'sfx:play': { key: string };
}

export type EventName = keyof GameEvents;

type Handler<K extends EventName> = (payload: GameEvents[K]) => void;

export class EventBus {
  private handlers: { [K in EventName]?: Handler<K>[] } = {};

  on<K extends EventName>(name: K, fn: Handler<K>): () => void {
    const list = (this.handlers[name] ??= []) as Handler<K>[];
    list.push(fn);
    return () => {
      const i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    };
  }

  emit<K extends EventName>(name: K, payload: GameEvents[K]): void {
    const list = this.handlers[name] as Handler<K>[] | undefined;
    list?.slice().forEach((fn) => fn(payload));
  }
}
