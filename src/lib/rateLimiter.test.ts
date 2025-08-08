/**
 * Unit tests for the rate limiter utility
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRateLimiter, RateLimiter } from './rateLimiter';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create with default cooldown of 30 seconds', () => {
      const limiter = new RateLimiter();
      expect(limiter).toBeDefined();
    });

    it('should create with custom cooldown', () => {
      const limiter = new RateLimiter(60000);
      expect(limiter).toBeDefined();
    });
  });

  describe('canShow', () => {
    it('should allow first notification immediately', () => {
      const limiter = new RateLimiter(30000);
      expect(limiter.canShow('test')).toBe(true);
    });

    it('should block second notification within cooldown', () => {
      const limiter = new RateLimiter(30000);
      expect(limiter.canShow('test')).toBe(true);
      expect(limiter.canShow('test')).toBe(false);
    });

    it('should allow notification after cooldown expires', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
      const limiter = new RateLimiter(30000);

      expect(limiter.canShow('test')).toBe(true);
      expect(limiter.canShow('test')).toBe(false);

      // Advance time by 31 seconds
      vi.advanceTimersByTime(31000);

      expect(limiter.canShow('test')).toBe(true);
      vi.useRealTimers();
    });

    it('should track different keys independently', () => {
      const limiter = new RateLimiter(30000);

      expect(limiter.canShow('key1')).toBe(true);
      expect(limiter.canShow('key2')).toBe(true);
      expect(limiter.canShow('key1')).toBe(false);
      expect(limiter.canShow('key2')).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset cooldown for a specific key', () => {
      const limiter = new RateLimiter(30000);

      expect(limiter.canShow('test')).toBe(true);
      expect(limiter.canShow('test')).toBe(false);

      limiter.reset('test');
      expect(limiter.canShow('test')).toBe(true);
    });

    it('should not affect other keys when resetting', () => {
      const limiter = new RateLimiter(30000);

      limiter.canShow('key1');
      limiter.canShow('key2');

      limiter.reset('key1');

      expect(limiter.canShow('key1')).toBe(true);
      expect(limiter.canShow('key2')).toBe(false);
    });
  });

  describe('resetAll', () => {
    it('should reset all cooldowns', () => {
      const limiter = new RateLimiter(30000);

      limiter.canShow('key1');
      limiter.canShow('key2');
      limiter.canShow('key3');

      expect(limiter.canShow('key1')).toBe(false);
      expect(limiter.canShow('key2')).toBe(false);
      expect(limiter.canShow('key3')).toBe(false);

      limiter.resetAll();

      expect(limiter.canShow('key1')).toBe(true);
      expect(limiter.canShow('key2')).toBe(true);
      expect(limiter.canShow('key3')).toBe(true);
    });
  });

  describe('getRemainingCooldown', () => {
    it('should return 0 for unused key', () => {
      const limiter = new RateLimiter(30000);
      expect(limiter.getRemainingCooldown('test')).toBe(0);
    });

    it('should return remaining cooldown time', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
      const limiter = new RateLimiter(30000);

      limiter.canShow('test');

      // Immediately after showing
      expect(limiter.getRemainingCooldown('test')).toBe(30000);

      // After 10 seconds
      vi.advanceTimersByTime(10000);
      expect(limiter.getRemainingCooldown('test')).toBe(20000);

      // After 31 seconds (cooldown expired)
      vi.advanceTimersByTime(21000);
      expect(limiter.getRemainingCooldown('test')).toBe(0);

      vi.useRealTimers();
    });
  });

  describe('isInCooldown', () => {
    it('should return false for unused key', () => {
      const limiter = new RateLimiter(30000);
      expect(limiter.isInCooldown('test')).toBe(false);
    });

    it('should return true during cooldown period', () => {
      const limiter = new RateLimiter(30000);
      limiter.canShow('test');
      expect(limiter.isInCooldown('test')).toBe(true);
    });

    it('should return false after cooldown expires', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
      const limiter = new RateLimiter(30000);

      limiter.canShow('test');
      expect(limiter.isInCooldown('test')).toBe(true);

      vi.advanceTimersByTime(31000);
      expect(limiter.isInCooldown('test')).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('createRateLimiter', () => {
    it('should create a rate limiter with default cooldown', () => {
      const limiter = createRateLimiter();
      expect(limiter).toBeInstanceOf(RateLimiter);
      expect(limiter.canShow('test')).toBe(true);
    });

    it('should create a rate limiter with custom cooldown', () => {
      const limiter = createRateLimiter(60000);
      expect(limiter).toBeInstanceOf(RateLimiter);
      expect(limiter.canShow('test')).toBe(true);
    });
  });
});
