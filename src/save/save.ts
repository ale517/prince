export const SAVE_KEY = 'pp.save.v1';
export const SAVE_VERSION = 1;

/** Everything needed to resume at a checkpoint (spec 07). The prince resumes on the checkpoint's tile. */
export interface SaveData {
  version: 1;
  levelId: string;
  checkpointId: string | null;
  hp: number;
  maxHp: number;
  hasSword: boolean;
  timeRemaining: number;
  objectStates: Record<string, Record<string, unknown>>;
}

/** The slice of the Web Storage API the game uses, so tests can pass a fake. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function isSaveData(v: unknown): v is SaveData {
  if (typeof v !== 'object' || v === null) return false;
  const d = v as Record<string, unknown>;
  return (
    d.version === SAVE_VERSION &&
    typeof d.levelId === 'string' &&
    (d.checkpointId === null || typeof d.checkpointId === 'string') &&
    isNum(d.hp) &&
    isNum(d.maxHp) &&
    typeof d.hasSword === 'boolean' &&
    isNum(d.timeRemaining) &&
    typeof d.objectStates === 'object' &&
    d.objectStates !== null
  );
}

/** Returns the stored save, or undefined when absent, corrupt, from another version or storage is unavailable. */
export function loadSave(store: KeyValueStore | undefined): SaveData | undefined {
  try {
    const raw = store?.getItem(SAVE_KEY);
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    return isSaveData(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** Returns false instead of throwing when storage is full or blocked. */
export function writeSave(store: KeyValueStore | undefined, data: SaveData): boolean {
  try {
    store?.setItem(SAVE_KEY, JSON.stringify(data));
    return store !== undefined;
  } catch {
    return false;
  }
}

export function clearSave(store: KeyValueStore | undefined): void {
  try {
    store?.removeItem(SAVE_KEY);
  } catch {
    // Nothing useful to do if storage is blocked.
  }
}
