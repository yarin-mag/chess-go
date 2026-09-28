import type { Color } from '@/core/types';

/**
 * Chess clock based on timestamps rather than counting ticks, so it never drifts.
 * Callers pass `now` (ms) explicitly, which keeps the class pure and easy to test.
 */
export class Clock {
  private base: Record<Color, number>;
  private active: Color | null = null;
  private _activeSince: number | null = null;

  /** When the currently-active side's turn started, or null before the clock's first `start()`. */
  get activeSince(): number | null {
    return this._activeSince;
  }

  /** initialMs === 0 means untimed. */
  constructor(
    private readonly initialMs: number,
    private readonly incrementMs: number,
  ) {
    this.base = { w: initialMs, b: initialMs };
  }

  get untimed(): boolean {
    return this.initialMs === 0;
  }

  remaining(color: Color, now: number): number {
    if (this.untimed) return 0;
    // active and _activeSince are always set together (both start out null, both set in start()).
    const elapsed = this.active === color ? now - this._activeSince! : 0;
    return Math.max(0, this.base[color] - elapsed);
  }

  start(color: Color, now: number): void {
    this.active = color;
    this._activeSince = now;
  }

  /** Ends the active side's turn (adding increment) and starts the other side's. */
  press(nextColor: Color, now: number): void {
    if (this.active) {
      this.base[this.active] = this.remaining(this.active, now) + this.incrementMs;
    }
    this.start(nextColor, now);
  }

  stop(now: number): void {
    if (this.active) this.base[this.active] = this.remaining(this.active, now);
    this.active = null;
  }

  flagged(now: number): Color | null {
    if (this.untimed || !this.active) return null;
    return this.remaining(this.active, now) === 0 ? this.active : null;
  }
}
