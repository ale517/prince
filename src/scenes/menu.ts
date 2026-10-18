import Phaser from 'phaser';
import { RENDER_SCALE } from '../config';
import { PadEdges } from '../input';

export interface MenuItem {
  label: string;
  enabled?: boolean;
  action: () => void;
}

/** Text drawn at full resolution under the 3x camera, then scaled back down so it stays sharp. */
export function pixelText(scene: Phaser.Scene, x: number, y: number, size: number, color: string, centered = false): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, '', { fontFamily: 'monospace', fontSize: `${size * RENDER_SCALE}px`, color }).setScale(1 / RENDER_SCALE);
  if (centered) t.setOrigin(0.5, 0);
  return t;
}

/** A vertical keyboard menu: Up/Down (or W/S) move, Enter/Space choose. */
export class Menu {
  private index = 0;
  private items: MenuItem[] = [];
  private readonly rows: Phaser.GameObjects.Text[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
    private readonly size = 10,
    private readonly gap = 14,
  ) {
    const kb = scene.input.keyboard;
    const K = Phaser.Input.Keyboard.KeyCodes;
    for (const code of [K.UP, K.W]) kb?.addKey(code).on('down', () => this.move(-1));
    for (const code of [K.DOWN, K.S]) kb?.addKey(code).on('down', () => this.move(1));
    for (const code of [K.ENTER, K.SPACE]) kb?.addKey(code).on('down', () => this.choose());

    const pad = new PadEdges();
    const onUpdate = (): void => {
      const e = pad.next();
      if (e.up) this.move(-1);
      if (e.down) this.move(1);
      if (e.action) this.choose();
    };
    scene.events.on('update', onUpdate);
    scene.events.once('shutdown', () => scene.events.off('update', onUpdate));
  }

  get visible(): boolean {
    return this.items.length > 0;
  }

  set(items: MenuItem[]): void {
    this.items = items;
    this.index = Math.max(0, items.findIndex((i) => i.enabled !== false));
    this.rows.forEach((r) => r.destroy());
    this.rows.length = 0;
    items.forEach((_, i) => this.rows.push(pixelText(this.scene, this.x, this.y + i * this.gap, this.size, '#e8d8a8', true).setDepth(20)));
    this.refresh();
  }

  clear(): void {
    this.set([]);
  }

  private refresh(): void {
    this.items.forEach((item, i) => {
      const row = this.rows[i]!;
      const on = i === this.index;
      row.setText(on ? `> ${item.label} <` : item.label);
      row.setColor(item.enabled === false ? '#5a5a6a' : on ? '#ffe9a0' : '#a89a78');
    });
  }

  private move(d: number): void {
    if (!this.visible) return;
    for (let n = 0; n < this.items.length; n++) {
      this.index = (this.index + d + this.items.length) % this.items.length;
      if (this.items[this.index]!.enabled !== false) break;
    }
    this.refresh();
  }

  private choose(): void {
    const item = this.items[this.index];
    if (item && item.enabled !== false) item.action();
  }
}
