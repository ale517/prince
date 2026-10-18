import { describe, expect, it } from 'vitest';
import { EventBus } from '../src/contracts';
import { EMPTY_INPUT } from '../src/contracts';
import { HAZARD_LEVEL, HAZARD_OBJECTS, parseAscii } from '../src/level';
import { GameTimer, SAVE_KEY, clearSave, formatTime, isSaveData, loadSave, timerVisible, writeSave } from '../src/save';
import type { KeyValueStore, SaveData } from '../src/save';
import { Simulation } from '../src/sim';
import { TILE_SIZE } from '../src/world';

class MemoryStore implements KeyValueStore {
  data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
  removeItem(k: string): void {
    this.data.delete(k);
  }
}

const hazard = (): Simulation => new Simulation(parseAscii(HAZARD_LEVEL, HAZARD_OBJECTS));

describe('timer', () => {
  it('counts down once per second of ticks and emits events', () => {
    const bus = new EventBus();
    const seen: number[] = [];
    bus.on('timer:tick', (e) => seen.push(e.remaining));
    const t = new GameTimer(12, bus, 3);
    for (let i = 0; i < 24; i++) t.tick();
    expect(t.remaining).toBe(1);
    expect(seen).toEqual([2, 1]);
  });

  it('expires exactly once and stays at zero', () => {
    const bus = new EventBus();
    let expired = 0;
    bus.on('timer:expired', () => expired++);
    const t = new GameTimer(2, bus, 1);
    for (let i = 0; i < 10; i++) t.tick();
    expect(t.remaining).toBe(0);
    expect(t.isExpired).toBe(true);
    expect(expired).toBe(1);
  });

  it('is paused when the simulation is not stepped', () => {
    const sim = hazard();
    for (let i = 0; i < 24; i++) sim.step({ ...EMPTY_INPUT });
    const before = sim.timer.remaining;
    // No steps (pause menu): nothing changes.
    expect(sim.timer.remaining).toBe(before);
    expect(before).toBe(3600 - 2);
  });

  it('formats time and decides when to show it', () => {
    expect(formatTime(3599)).toBe('59:59');
    expect(formatTime(65)).toBe('01:05');
    // The first 30 s of each elapsed minute are remaining % 60 in 30..59.
    expect(timerVisible(3595)).toBe(true);
    expect(timerVisible(3600 - 40)).toBe(false);
    expect(timerVisible(599)).toBe(true);
    expect(timerVisible(1200 + 10)).toBe(false);
  });
});

describe('save', () => {
  it('round-trips through storage', () => {
    const store = new MemoryStore();
    const sim = hazard();
    for (let i = 0; i < 30; i++) sim.step({ ...EMPTY_INPUT });
    const data = sim.snapshot('hazard', 'cp1');
    expect(writeSave(store, data)).toBe(true);
    expect(loadSave(store)).toEqual(data);
    clearSave(store);
    expect(loadSave(store)).toBeUndefined();
  });

  it('ignores corrupt, mismatched-version and missing saves', () => {
    const store = new MemoryStore();
    expect(loadSave(store)).toBeUndefined();
    store.setItem(SAVE_KEY, '{not json');
    expect(loadSave(store)).toBeUndefined();
    const good = hazard().snapshot('hazard', null);
    store.setItem(SAVE_KEY, JSON.stringify({ ...good, version: 2 }));
    expect(loadSave(store)).toBeUndefined();
    store.setItem(SAVE_KEY, JSON.stringify({ ...good, hp: 'lots' }));
    expect(loadSave(store)).toBeUndefined();
    expect(isSaveData(null)).toBe(false);
    expect(loadSave(undefined)).toBeUndefined();
  });

  it('survives blocked storage', () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    expect(loadSave(broken)).toBeUndefined();
    expect(writeSave(broken, hazard().snapshot('hazard', null))).toBe(false);
    expect(() => clearSave(broken)).not.toThrow();
  });

  it('restores the prince, time and object states onto a fresh simulation', () => {
    const a = hazard();
    const events: string[] = [];
    a.bus.on('checkpoint:reached', (e) => events.push(e.id));
    a.player.x = 11 * TILE_SIZE + 16;
    for (let i = 0; i < 40; i++) a.step({ ...EMPTY_INPUT });
    expect(events).toEqual(['cp1']);
    a.player.hp = 2;
    a.player.maxHp = 4;
    const data: SaveData = a.snapshot('hazard', 'cp1');
    data.timeRemaining = 1234;

    const b = hazard();
    b.restore(JSON.parse(JSON.stringify(data)) as SaveData);
    expect(b.player.tx).toBe(11);
    expect(b.player.hp).toBe(2);
    expect(b.player.maxHp).toBe(4);
    expect(b.timer.remaining).toBe(1234);
    // The checkpoint remembers it was reached, so it does not fire again.
    const again: string[] = [];
    b.bus.on('checkpoint:reached', (e) => again.push(e.id));
    for (let i = 0; i < 20; i++) b.step({ ...EMPTY_INPUT });
    expect(again).toEqual([]);
  });

  it('restores a crumbled floor as a hole', () => {
    const a = hazard();
    const loose = a.objects.find((o) => o.type === 'loose')!;
    const data = a.snapshot('hazard', null);
    data.objectStates[loose.id] = { shaking: true, timer: 99, fallen: true };
    const b = hazard();
    b.restore(data);
    expect(b.grid.get(loose.tx, loose.ty).type).toBe('empty');
  });
});
