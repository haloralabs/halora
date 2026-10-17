/**
 * Fixed-window in-memory rate limiter keyed by client and route group.
 *
 * Suitable for a single API instance (the pilot deployment). A multi-instance deployment needs a
 * shared store such as Redis behind the same interface.
 */
export class RateLimiter {
  private windows = new Map<string, { count: number; resetAt: number }>();
  private lastSweep = 0;

  constructor(
    private readonly limit: number,
    private readonly windowMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  /** Returns remaining requests, or a retry delay in seconds if the limit is exceeded. */
  hit(key: string): { allowed: true; remaining: number } | { allowed: false; retryAfter: number } {
    const t = this.now();
    this.sweep(t);
    let w = this.windows.get(key);
    if (!w || w.resetAt <= t) {
      w = { count: 0, resetAt: t + this.windowMs };
      this.windows.set(key, w);
    }
    w.count++;
    if (w.count > this.limit) {
      return { allowed: false, retryAfter: Math.max(1, Math.ceil((w.resetAt - t) / 1000)) };
    }
    return { allowed: true, remaining: this.limit - w.count };
  }

  private sweep(t: number) {
    if (t - this.lastSweep < this.windowMs) return;
    this.lastSweep = t;
    for (const [k, w] of this.windows) if (w.resetAt <= t) this.windows.delete(k);
  }
}
