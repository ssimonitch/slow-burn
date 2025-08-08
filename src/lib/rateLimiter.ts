/**
 * Rate limiter utility for preventing spam of user notifications
 *
 * This utility helps prevent overwhelming users with repeated notifications
 * by enforcing a cooldown period between similar notifications.
 */

/**
 * Rate limiter class for controlling notification frequency
 */
export class RateLimiter {
  private lastShown = new Map<string, number>();
  private readonly cooldownMs: number;

  /**
   * Create a new rate limiter
   *
   * @param cooldownMs - Minimum time in milliseconds between notifications (default: 30 seconds)
   */
  constructor(cooldownMs = 30000) {
    this.cooldownMs = cooldownMs;
  }

  /**
   * Check if a notification can be shown
   *
   * @param key - Unique identifier for the notification type
   * @returns True if the notification can be shown, false if still in cooldown
   */
  canShow(key: string): boolean {
    const now = Date.now();
    const lastTime = this.lastShown.get(key) ?? 0;

    if (now - lastTime > this.cooldownMs) {
      this.lastShown.set(key, now);
      return true;
    }
    return false;
  }

  /**
   * Reset the cooldown for a specific notification type
   *
   * @param key - Unique identifier for the notification type
   */
  reset(key: string): void {
    this.lastShown.delete(key);
  }

  /**
   * Reset all cooldowns
   */
  resetAll(): void {
    this.lastShown.clear();
  }

  /**
   * Get the remaining cooldown time for a notification type
   *
   * @param key - Unique identifier for the notification type
   * @returns Remaining time in milliseconds, or 0 if no cooldown
   */
  getRemainingCooldown(key: string): number {
    const lastTime = this.lastShown.get(key);
    if (!lastTime) return 0;

    const elapsed = Date.now() - lastTime;
    const remaining = this.cooldownMs - elapsed;
    return Math.max(0, remaining);
  }

  /**
   * Check if a notification is currently in cooldown
   *
   * @param key - Unique identifier for the notification type
   * @returns True if in cooldown period, false otherwise
   */
  isInCooldown(key: string): boolean {
    return this.getRemainingCooldown(key) > 0;
  }
}

/**
 * Create a singleton rate limiter for a specific feature
 *
 * @param cooldownMs - Cooldown period in milliseconds
 * @returns Rate limiter instance
 */
export function createRateLimiter(cooldownMs?: number): RateLimiter {
  return new RateLimiter(cooldownMs);
}
