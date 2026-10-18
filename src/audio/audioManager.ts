import { midiRatio, SONGS, songSteps, stepSeconds, type SongKey, type Wave } from './songs';

const VOLUME_KEY = 'pp.audio.v1';
const LOOKAHEAD_S = 0.25;
const TICK_MS = 60;

export interface Volumes {
  master: number;
  music: number;
  sfx: number;
}

interface Tone {
  wave: Wave;
  from: number;
  to?: number;
  dur: number;
  gain: number;
  delay?: number;
}

/** Sound effects are short synthesised blips, so no audio files are shipped. */
const SFX: Record<string, Tone[]> = {
  parry: [{ wave: 'square', from: 1600, to: 900, dur: 0.09, gain: 0.25 }, { wave: 'sawtooth', from: 2400, to: 1200, dur: 0.05, gain: 0.12 }],
  hit: [{ wave: 'sawtooth', from: 220, to: 70, dur: 0.16, gain: 0.3 }],
  hurt: [{ wave: 'square', from: 300, to: 110, dur: 0.22, gain: 0.25 }],
  death: [{ wave: 'sawtooth', from: 260, to: 40, dur: 0.9, gain: 0.3 }],
  potion: [{ wave: 'sine', from: 500, to: 900, dur: 0.12, gain: 0.25 }, { wave: 'sine', from: 700, to: 1200, dur: 0.14, gain: 0.25, delay: 0.1 }],
  checkpoint: [{ wave: 'triangle', from: 660, dur: 0.1, gain: 0.3 }, { wave: 'triangle', from: 880, dur: 0.18, gain: 0.3, delay: 0.1 }],
  gate: [{ wave: 'sawtooth', from: 90, to: 60, dur: 0.5, gain: 0.18 }],
  spike: [{ wave: 'square', from: 900, to: 300, dur: 0.07, gain: 0.2 }],
  chomper: [{ wave: 'sawtooth', from: 140, to: 50, dur: 0.18, gain: 0.3 }],
  crumble: [{ wave: 'sawtooth', from: 120, to: 40, dur: 0.35, gain: 0.25 }],
  shadow: [{ wave: 'sine', from: 180, to: 540, dur: 0.6, gain: 0.25 }],
};

function loadVolumes(storage?: Storage): Volumes {
  const fallback: Volumes = { master: 0.8, music: 0.6, sfx: 0.8 };
  try {
    const raw = storage?.getItem(VOLUME_KEY);
    if (!raw) return fallback;
    const v = JSON.parse(raw) as Partial<Volumes>;
    const ok = (n: unknown, d: number): number => (typeof n === 'number' && n >= 0 && n <= 1 ? n : d);
    return { master: ok(v.master, fallback.master), music: ok(v.music, fallback.music), sfx: ok(v.sfx, fallback.sfx) };
  } catch {
    return fallback;
  }
}

/** Web Audio synth: SFX plus a small look-ahead step sequencer for the music (spec 08). */
export class AudioManager {
  volumes: Volumes;
  muted = false;
  private ctx?: AudioContext;
  private master?: GainNode;
  private musicBus?: GainNode;
  private sfxBus?: GainNode;
  private timer?: number;
  private song?: SongKey;
  private nextStep = 0;
  private nextTime = 0;
  private pending?: SongKey;
  private readonly storage?: Storage;

  constructor(storage?: Storage) {
    this.storage = storage;
    this.volumes = loadVolumes(storage);
    // Browsers keep audio locked until the first gesture.
    const unlock = (): void => {
      this.ensure();
      void this.ctx?.resume();
      if (this.pending) this.playMusic(this.pending);
    };
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);
  }

  get currentSong(): SongKey | undefined {
    return this.song ?? this.pending;
  }

  private ensure(): AudioContext | undefined {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return undefined;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.applyVolumes();
    return this.ctx;
  }

  private applyVolumes(): void {
    if (!this.master || !this.musicBus || !this.sfxBus) return;
    this.master.gain.value = this.muted ? 0 : this.volumes.master;
    this.musicBus.gain.value = this.volumes.music;
    this.sfxBus.gain.value = this.volumes.sfx;
  }

  setVolume(channel: keyof Volumes, value: number): void {
    this.volumes[channel] = Math.min(1, Math.max(0, value));
    this.applyVolumes();
    try {
      this.storage?.setItem(VOLUME_KEY, JSON.stringify(this.volumes));
    } catch {
      // Private mode: volumes just don't persist.
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.applyVolumes();
    return this.muted;
  }

  play(key: string): void {
    const ctx = this.ctx;
    const tones = SFX[key];
    if (!ctx || !this.sfxBus || ctx.state !== 'running' || !tones) return;
    for (const t of tones) this.tone(this.sfxBus, t.wave, t.from, t.to, ctx.currentTime + (t.delay ?? 0), t.dur, t.gain);
  }

  playMusic(key: SongKey): void {
    if (this.song === key && this.timer !== undefined) return;
    const ctx = this.ensure();
    if (!ctx || ctx.state !== 'running') {
      this.pending = key;
      return;
    }
    this.pending = undefined;
    this.stopMusic();
    this.song = key;
    this.nextStep = 0;
    this.nextTime = ctx.currentTime + 0.05;
    this.timer = window.setInterval(() => this.pump(), TICK_MS);
    this.pump();
  }

  stopMusic(): void {
    if (this.timer !== undefined) window.clearInterval(this.timer);
    this.timer = undefined;
    this.song = undefined;
  }

  private pump(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus || !this.song) return;
    const song = SONGS[this.song];
    const total = songSteps(song);
    const dt = stepSeconds(song);
    while (this.nextTime < ctx.currentTime + LOOKAHEAD_S) {
      for (const v of song.voices) {
        const n = v.notes[this.nextStep % v.notes.length];
        if (n != null) {
          const f = song.root * midiRatio(n);
          this.tone(this.musicBus, v.wave, f, undefined, this.nextTime, v.length * dt, v.gain);
        }
      }
      this.nextStep++;
      this.nextTime += dt;
      if (this.nextStep >= total) {
        if (song.loop) this.nextStep = 0;
        else {
          this.stopMusic();
          return;
        }
      }
    }
  }

  private tone(bus: GainNode, wave: Wave, from: number, to: number | undefined, at: number, dur: number, gain: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(from, at);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, at + dur);
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(gain, at + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(env).connect(bus);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }
}

let shared: AudioManager | undefined;

/** One manager for the whole page, so music survives scene changes. */
export function audio(): AudioManager {
  if (!shared) {
    let storage: Storage | undefined;
    try {
      storage = window.localStorage;
    } catch {
      storage = undefined;
    }
    shared = new AudioManager(storage);
  }
  return shared;
}
