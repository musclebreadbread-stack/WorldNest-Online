/** Minimum gap between two chat messages from the same client. */
export const CHAT_RATE_LIMIT_MS = 500;

export type Clock = () => number;

/**
 * Token-free rate limiter: one action per interval.
 *
 * Client-side only — a determined client can bypass it — so its job is to stop
 * an enthusiastic Enter key from flooding the channel, not to enforce policy.
 * The clock is injectable so the timing rules can be unit-tested.
 */
export class RateLimiter {
  private intervalMs: number;
  private now: Clock;
  private lastAt = Number.NEGATIVE_INFINITY;

  constructor(intervalMs: number = CHAT_RATE_LIMIT_MS, now: Clock = Date.now) {
    this.intervalMs = intervalMs;
    this.now = now;
  }

  /** Whether an action is allowed right now, without consuming it. */
  canConsume(): boolean {
    return this.now() - this.lastAt >= this.intervalMs;
  }

  /** Consume the allowance, returning `false` when the caller is too early. */
  tryConsume(): boolean {
    if (!this.canConsume()) return false;

    this.lastAt = this.now();
    return true;
  }
}
