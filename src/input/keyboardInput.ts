import Phaser from 'phaser';
import type { InputState } from '../contracts';
import { readPad } from './gamepadInput';

const K = Phaser.Input.Keyboard.KeyCodes;

/**
 * Keyboard to logical input (spec 08). Logic runs at 12 Hz but the scene updates at 60 Hz,
 * so presses are latched between ticks; otherwise a quick tap could be missed.
 */
export class KeyboardInput {
  private readonly groups: Record<keyof InputState, Phaser.Input.Keyboard.Key[]>;
  private latch: InputState = KeyboardInput.blank();

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (!kb) throw new Error('keyboard plugin unavailable');
    const keys = (...codes: number[]) => codes.map((c) => kb.addKey(c));
    this.groups = {
      left: keys(K.LEFT, K.A),
      right: keys(K.RIGHT, K.D),
      up: keys(K.UP, K.W),
      down: keys(K.DOWN, K.S),
      shift: keys(K.SHIFT),
      action: keys(K.SPACE, K.Z),
      pause: keys(K.ESC, K.P),
    };
  }

  private static blank(): InputState {
    return { left: false, right: false, up: false, down: false, shift: false, action: false, pause: false };
  }

  /** Call every render frame. */
  sample(): void {
    const pad = readPad();
    for (const name of Object.keys(this.groups) as (keyof InputState)[]) {
      if (pad[name] || this.groups[name].some((k) => k.isDown)) this.latch[name] = true;
    }
  }

  /** Call once per logic tick; returns held-or-tapped keys and clears the latch. */
  poll(): InputState {
    this.sample();
    const out = this.latch;
    this.latch = KeyboardInput.blank();
    // Keys still held stay pressed for the next tick without needing a new sample.
    return out;
  }
}
