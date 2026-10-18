import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../src/contracts';

describe('EventBus', () => {
  it('delivers payloads and supports unsubscribe', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    const off = bus.on('guard:died', fn);
    bus.emit('guard:died', { id: 'g1' });
    off();
    bus.emit('guard:died', { id: 'g2' });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith({ id: 'g1' });
  });
});
