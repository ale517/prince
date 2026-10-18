import { describe, expect, it } from 'vitest';
import { mapPad, type PadLike } from '../src/input/gamepadInput';

const pad = (pressed: number[] = [], axes: number[] = [0, 0]): PadLike => ({
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })),
  axes,
});

describe('mapPad', () => {
  it('maps the d-pad', () => {
    const s = mapPad(pad([12, 15]));
    expect(s.up && s.right).toBe(true);
    expect(s.left || s.down).toBe(false);
  });

  it('maps the left stick with a deadzone', () => {
    expect(mapPad(pad([], [0.2, -0.2]))).toMatchObject({ left: false, right: false, up: false, down: false });
    expect(mapPad(pad([], [-0.8, 0.9]))).toMatchObject({ left: true, down: true, right: false, up: false });
  });

  it('maps action, shift and pause', () => {
    expect(mapPad(pad([0])).action).toBe(true);
    expect(mapPad(pad([2])).action).toBe(true);
    expect(mapPad(pad([4])).shift).toBe(true);
    expect(mapPad(pad([7])).shift).toBe(true);
    expect(mapPad(pad([9])).pause).toBe(true);
  });

  it('is idle with nothing pressed', () => {
    expect(Object.values(mapPad(pad())).some(Boolean)).toBe(false);
  });
});
