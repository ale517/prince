import type { EventBus } from '../contracts';

export const TIMER_TOTAL_SECONDS = 3600;

/**
 * Countdown driven by simulation ticks, so it pauses whenever the simulation does and
 * replays identically (spec 07). Emits `timer:tick` each second and `timer:expired` once.
 */
export class GameTimer {
  private ticks = 0;
  private expired = false;

  constructor(
    private readonly ticksPerSecond: number,
    private readonly bus?: EventBus,
    public remaining = TIMER_TOTAL_SECONDS,
  ) {}

  get isExpired(): boolean {
    return this.expired;
  }

  tick(): void {
    if (this.expired) return;
    if (++this.ticks < this.ticksPerSecond) return;
    this.ticks = 0;
    this.remaining = Math.max(0, this.remaining - 1);
    this.bus?.emit('timer:tick', { remaining: this.remaining });
    if (this.remaining === 0) {
      this.expired = true;
      this.bus?.emit('timer:expired', {});
    }
  }

  /** Sets the time left (loading a save) and re-arms the expiry. */
  set(seconds: number): void {
    this.remaining = Math.max(0, Math.floor(seconds));
    this.ticks = 0;
    this.expired = this.remaining === 0;
  }
}

/** "MM:SS" for the message strip. */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Spec 07: always shown in the last 10 minutes, otherwise only in the first 30 s of each minute. */
export function timerVisible(seconds: number): boolean {
  return seconds <= 600 || seconds % 60 >= 30;
}
