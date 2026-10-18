import Phaser from 'phaser';
import { RENDER_SCALE } from '../config';
import { formatTime, timerVisible } from '../save';
import type { Simulation } from '../sim';
import { SCREEN_TILES_H, SCREEN_TILES_W } from '../world';
import type { GameScene } from './GameScene';
import { audio } from '../audio';
import { Menu, pixelText, type MenuItem } from './menu';

const MESSAGE_MS = 2600;
const STRIP_Y = 170;
const MAX_HP_ICONS = 10;

/** HUD and menus, running in parallel with GameScene (spec 07). It only reads the game; GameScene owns the rules. */
export class UIScene extends Phaser.Scene {
  private gfx!: Phaser.GameObjects.Graphics;
  private strip!: Phaser.GameObjects.Text;
  private title!: Phaser.GameObjects.Text;
  private sub!: Phaser.GameObjects.Text;
  private menu!: Menu;
  private bound?: Simulation;
  private message = '';
  private messageUntil = 0;
  private shownPhase = '';
  private victoryPlayed = false;
  private keepIndex = false;

  constructor() {
    super('UIScene');
  }

  create(): void {
    this.cameras.main.setZoom(RENDER_SCALE).centerOn(160, 100);
    this.gfx = this.add.graphics().setDepth(10);
    this.strip = pixelText(this, 160, STRIP_Y + 4, 8, '#e8d8a8', true).setDepth(11);
    this.title = pixelText(this, 160, 40, 16, '#e8c860', true).setDepth(21);
    this.sub = pixelText(this, 160, 62, 7, '#b0b0c8', true).setDepth(21);
    this.menu = new Menu(this, 160, 84);
    this.bound = undefined;
    this.shownPhase = '';
    this.input.keyboard?.on('keydown-M', () => audio().toggleMute());
    // A clickable speaker icon in the HUD corner.
    this.add.zone(306, 177, 16, 12).setInteractive({ useHandCursor: true }).on('pointerdown', () => audio().toggleMute());
    const onPad = (e: GamepadEvent): void => this.say(e.type === 'gamepadconnected' ? 'Gamepad connected.' : 'Gamepad disconnected.');
    window.addEventListener('gamepadconnected', onPad);
    window.addEventListener('gamepaddisconnected', onPad);
    this.events.once('shutdown', () => {
      window.removeEventListener('gamepadconnected', onPad);
      window.removeEventListener('gamepaddisconnected', onPad);
    });
  }

  private gameScene(): GameScene {
    return this.scene.get('GameScene') as GameScene;
  }

  private say(text: string): void {
    this.message = text;
    this.messageUntil = this.time.now + MESSAGE_MS;
  }

  /** GameScene builds a new Simulation on every restart, so the event hooks follow it. */
  private bind(sim: Simulation): void {
    this.bound = sim;
    this.message = '';
    const kinds = { small: 'You feel better.', large: 'Your life force grows!', poison: 'Poison! That hurt.' } as const;
    sim.bus.on('potion:collected', ({ kind }) => this.say(kinds[kind as keyof typeof kinds] ?? 'You drink the potion.'));
    sim.bus.on('checkpoint:reached', () => this.say('Checkpoint - progress saved.'));
    sim.bus.on('gate:opened', () => this.say('A gate rumbles open.'));
    sim.bus.on('shadow:appeared', () => this.say('Your reflection steps out of the mirror!'));
    sim.bus.on('shadow:merged', () => this.say('You and your shadow are one.'));

    const sfx = audio();
    sim.bus.on('sfx:play', ({ key }) => sfx.play(key));
    sim.bus.on('potion:collected', () => sfx.play('potion'));
    sim.bus.on('checkpoint:reached', () => sfx.play('checkpoint'));
    sim.bus.on('gate:opened', () => sfx.play('gate'));
    sim.bus.on('trap:triggered', ({ type }) => sfx.play(type === 'spikes' ? 'spike' : type === 'chomper' ? 'chomper' : 'crumble'));
    sim.bus.on('player:damaged', () => sfx.play('hurt'));
    sim.bus.on('player:died', () => sfx.play('death'));
    sim.bus.on('shadow:appeared', () => sfx.play('shadow'));
  }

  private updateMusic(gs: GameScene, fighting: boolean): void {
    const a = audio();
    if (gs.phase === 'won') {
      if (a.currentSong !== 'victory' && !this.victoryPlayed) {
        this.victoryPlayed = true;
        a.playMusic('victory');
      }
      return;
    }
    this.victoryPlayed = false;
    if (gs.phase === 'dead' || gs.phase === 'timeup') a.stopMusic();
    else a.playMusic(fighting ? 'fight' : 'dungeon');
  }

  private volumeItems(): MenuItem[] {
    const a = audio();
    const step = (ch: 'master' | 'music' | 'sfx', label: string): MenuItem => ({
      label: `${label}: ${Math.round(a.volumes[ch] * 100)}%`,
      action: () => {
        a.setVolume(ch, a.volumes[ch] >= 0.99 ? 0 : a.volumes[ch] + 0.2);
        this.shownPhase = '';
        this.keepIndex = true;
      },
    });
    return [
      {
        label: `Sound: ${a.muted ? 'OFF' : 'ON'}`,
        action: () => {
          a.toggleMute();
          this.shownPhase = '';
          this.keepIndex = true;
        },
      },
      step('master', 'Volume'),
      step('music', 'Music'),
      step('sfx', 'Effects'),
    ];
  }

  update(): void {
    const gs = this.gameScene();
    if (!gs?.sim) return;
    if (this.bound !== gs.sim) this.bind(gs.sim);
    this.setPhase(gs);
    this.drawHud(gs);
  }

  private setPhase(gs: GameScene): void {
    if (this.shownPhase === gs.phase) return;
    this.shownPhase = gs.phase;
    const left = formatTime(gs.sim.timer.remaining);
    const quit = { label: 'Quit to menu', action: () => gs.quit() };
    const retry = { label: 'Retry from checkpoint', action: () => gs.retry() };
    this.sub.setText('');
    switch (gs.phase) {
      case 'paused':
        this.title.setText('PAUSED');
        this.sub.setText(`${left} remaining`);
        this.menu.set([{ label: 'Resume', action: () => gs.resume() }, { label: 'Restart from checkpoint', action: () => gs.retry() }, ...this.volumeItems(), quit], this.keepIndex);
        this.keepIndex = false;
        break;
      case 'dead':
        this.title.setText('YOU DIED');
        this.menu.set([retry, quit]);
        break;
      case 'timeup':
        this.title.setText('TIME IS UP');
        this.menu.set([retry, quit]);
        break;
      case 'won':
        this.title.setText('LEVEL COMPLETE');
        this.sub.setText(`Time remaining ${left}`);
        this.menu.set([{ label: 'Play again', action: () => gs.newGame() }, quit]);
        break;
      default:
        this.title.setText('');
        this.menu.clear();
    }
  }

  private drawHud(gs: GameScene): void {
    const g = this.gfx;
    const { player, guards, timer } = gs.sim;
    g.clear();
    if (gs.phase !== 'playing') g.fillStyle(0x000000, 0.62).fillRect(0, 0, 320, 200);

    // Bottom panel.
    g.fillStyle(0x0c0c14).fillRect(0, STRIP_Y, 320, 200 - STRIP_Y);
    g.fillStyle(0x3a3448).fillRect(0, STRIP_Y, 320, 1).fillStyle(0x1e1a28).fillRect(0, STRIP_Y + 1, 320, 1);

    this.speaker(g);

    for (let i = 0; i < Math.min(player.maxHp, MAX_HP_ICONS); i++) this.triangle(8 + i * 10, 192, i < player.hp, 0xd04050, 0xff9aa8);

    // Guard health appears only while one is awake on the prince's screen.
    const sx = Math.floor(player.tx / SCREEN_TILES_W) * SCREEN_TILES_W;
    const sy = Math.floor(player.ty / SCREEN_TILES_H) * SCREEN_TILES_H;
    const foe = guards.find(
      (e) => e.hp > 0 && e.state !== 'idle' && e.tx >= sx && e.tx < sx + SCREEN_TILES_W && e.ty >= sy && e.ty < sy + SCREEN_TILES_H,
    );
    if (foe) for (let i = 0; i < foe.hp; i++) this.triangle(312 - i * 10, 192, true, 0x4a5fa8, 0x9ab0ff);

    const now = this.time.now;
    this.updateMusic(gs, !!foe);
    if (now < this.messageUntil) this.strip.setText(this.message);
    else if (gs.phase === 'playing' && timerVisible(timer.remaining)) this.strip.setText(`${formatTime(timer.remaining)} remaining`);
    else this.strip.setText('');
  }

  /** Speaker icon; waves when sound is on, a red cross when muted. Clicking it (or pressing M) toggles. */
  private speaker(g: Phaser.GameObjects.Graphics): void {
    const x = 300;
    const y = 173;
    const muted = audio().muted;
    g.fillStyle(muted ? 0x8a8090 : 0xe8d8a8);
    g.fillRect(x, y + 3, 3, 4).fillTriangle(x + 3, y + 3, x + 3, y + 7, x + 8, y + 10).fillTriangle(x + 3, y + 3, x + 3, y + 7, x + 8, y);
    if (muted) {
      g.lineStyle(1, 0xe04050).lineBetween(x + 9, y + 2, x + 15, y + 8).lineBetween(x + 15, y + 2, x + 9, y + 8);
    } else {
      g.fillRect(x + 10, y + 3, 1, 4).fillRect(x + 12, y + 1, 1, 8);
    }
  }

  /** An upward-pointing life marker; filled when the point is still there. */
  private triangle(cx: number, bottom: number, filled: boolean, color: number, light: number): void {
    const g = this.gfx;
    const top = bottom - 8;
    g.fillStyle(0x000000).fillTriangle(cx - 5, bottom + 1, cx + 5, bottom + 1, cx, top - 1);
    if (filled) {
      g.fillStyle(color).fillTriangle(cx - 4, bottom, cx + 4, bottom, cx, top + 1);
      g.fillStyle(light).fillTriangle(cx - 1, bottom - 2, cx - 3, bottom - 1, cx - 1, top + 3);
    } else {
      g.fillStyle(0x2a2430).fillTriangle(cx - 4, bottom, cx + 4, bottom, cx, top + 1);
    }
  }
}
