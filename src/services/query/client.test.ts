/**
 * Unit Tests for TanStack Query Configuration
 *
 * These tests verify the React Query client configuration, including:
 * - Default retry logic based on error types (auth, client, server, network)
 * - Retry delay calculation with exponential backoff
 * - Cache time configurations optimized per data type
 * - Mutation retry policies for different error scenarios
 * - Query invalidation and refetch behavior
 *
 * Note: These tests focus on the business logic of the query configuration,
 * not the React hooks that use the query client (those are UI concerns).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockApiError } from '@/test/factories/api';

import { HTTP_STATUS } from '../api/config';
import { ApiClientError } from '../api/errors';
import { queryClient, queryConfig } from './client';

describe('Query Client Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  describe('default query retry logic', () => {
    const queryOptions = queryClient.getDefaultOptions().queries!;
    const retryFunction = queryOptions.retry as (failureCount: number, error: unknown) => boolean;

    it('should not retry on auth errors (401)', () => {
      const authError = new ApiClientError('Unauthorized', HTTP_STATUS.UNAUTHORIZED, '/protected');

      const shouldRetry = retryFunction(1, authError);

      expect(shouldRetry).toBe(false);
    });

    it('should not retry on client errors except 429', () => {
      const clientErrors = [
        new ApiClientError('Bad Request', HTTP_STATUS.BAD_REQUEST, '/api'),
        new ApiClientError('Forbidden', HTTP_STATUS.FORBIDDEN, '/api'),
        new ApiClientError('Not Found', HTTP_STATUS.NOT_FOUND, '/api'),
        new ApiClientError('Conflict', HTTP_STATUS.CONFLICT, '/api'),
        new ApiClientError('Unprocessable Entity', HTTP_STATUS.UNPROCESSABLE_ENTITY, '/api'),
      ];

      clientErrors.forEach((error) => {
        const shouldRetry = retryFunction(1, error);
        expect(shouldRetry).toBe(false);
      });
    });

    it('should retry on 429 rate limit errors', () => {
      const rateLimitError = new ApiClientError('Too Many Requests', HTTP_STATUS.TOO_MANY_REQUESTS, '/api');

      const shouldRetryFirst = retryFunction(0, rateLimitError);
      const shouldRetrySecond = retryFunction(1, rateLimitError);
      const shouldRetryThird = retryFunction(2, rateLimitError);
      const shouldRetryFourth = retryFunction(3, rateLimitError);

      expect(shouldRetryFirst).toBe(true);
      expect(shouldRetrySecond).toBe(true);
      expect(shouldRetryThird).toBe(true);
      expect(shouldRetryFourth).toBe(false); // After 3 attempts (failureCount >= 3)
    });

    it('should retry server errors up to 3 times', () => {
      const serverError = new ApiClientError('Internal Server Error', HTTP_STATUS.INTERNAL_SERVER_ERROR, '/api');

      const shouldRetryFirst = retryFunction(0, serverError);
      const shouldRetrySecond = retryFunction(1, serverError);
      const shouldRetryThird = retryFunction(2, serverError);
      const shouldRetryFourth = retryFunction(3, serverError);

      expect(shouldRetryFirst).toBe(true);
      expect(shouldRetrySecond).toBe(true);
      expect(shouldRetryThird).toBe(true);
      expect(shouldRetryFourth).toBe(false);
    });

    it('should retry network errors up to 3 times', () => {
      const networkError = new ApiClientError('Network Error', 0, '/api');

      const shouldRetryFirst = retryFunction(0, networkError);
      const shouldRetrySecond = retryFunction(1, networkError);
      const shouldRetryThird = retryFunction(2, networkError);
      const shouldRetryFourth = retryFunction(3, networkError);

      expect(shouldRetryFirst).toBe(true);
      expect(shouldRetrySecond).toBe(true);
      expect(shouldRetryThird).toBe(true);
      expect(shouldRetryFourth).toBe(false);
    });

    it('should retry non-ApiClientError errors up to 3 times', () => {
      const genericError = new Error('Something went wrong');

      const shouldRetryFirst = retryFunction(0, genericError);
      const shouldRetrySecond = retryFunction(1, genericError);
      const shouldRetryThird = retryFunction(2, genericError);
      const shouldRetryFourth = retryFunction(3, genericError);

      expect(shouldRetryFirst).toBe(true);
      expect(shouldRetrySecond).toBe(true);
      expect(shouldRetryThird).toBe(true);
      expect(shouldRetryFourth).toBe(false);
    });
  });

  describe('retry delay calculation', () => {
    const queryOptions = queryClient.getDefaultOptions().queries!;
    const retryDelayFunction = queryOptions.retryDelay as (attemptIndex: number) => number;

    it('should use exponential backoff with maximum cap', () => {
      const delays = [
        retryDelayFunction(0), // First retry (attempt 0)
        retryDelayFunction(1), // Second retry (attempt 1)
        retryDelayFunction(2), // Third retry (attempt 2)
        retryDelayFunction(10), // Should be capped at 30 seconds
      ];

      expect(delays[0]).toBe(1000); // 1000 * 2^0 = 1000ms
      expect(delays[1]).toBe(2000); // 1000 * 2^1 = 2000ms
      expect(delays[2]).toBe(4000); // 1000 * 2^2 = 4000ms
      expect(delays[3]).toBe(30000); // Capped at 30 seconds
    });

    it('should handle edge case of negative attempt index', () => {
      const delay = retryDelayFunction(-1);
      expect(delay).toBe(500); // 1000 * 2^(-1) = 500ms
    });
  });

  describe('mutation retry logic', () => {
    const mutationOptions = queryClient.getDefaultOptions().mutations!;
    const retryFunction = mutationOptions.retry as (failureCount: number, error: unknown) => boolean;

    it('should never retry mutations on client errors', () => {
      const clientError = new ApiClientError('Bad Request', HTTP_STATUS.BAD_REQUEST, '/api');

      const shouldRetry = retryFunction(0, clientError);

      expect(shouldRetry).toBe(false);
    });

    it('should never retry mutations on auth errors', () => {
      const authError = new ApiClientError('Unauthorized', HTTP_STATUS.UNAUTHORIZED, '/api');

      const shouldRetry = retryFunction(0, authError);

      expect(shouldRetry).toBe(false);
    });

    it('should retry mutations once for server errors', () => {
      const serverError = new ApiClientError('Internal Server Error', HTTP_STATUS.INTERNAL_SERVER_ERROR, '/api');

      const shouldRetryFirst = retryFunction(0, serverError);
      const shouldRetrySecond = retryFunction(1, serverError);

      expect(shouldRetryFirst).toBe(true);
      expect(shouldRetrySecond).toBe(false);
    });

    it('should retry mutations once for network errors', () => {
      const networkError = new ApiClientError('Network Error', 0, '/api');

      const shouldRetryFirst = retryFunction(0, networkError);
      const shouldRetrySecond = retryFunction(1, networkError);

      expect(shouldRetryFirst).toBe(true);
      expect(shouldRetrySecond).toBe(false);
    });
  });

  describe('cache configuration per data type', () => {
    it('should have short cache times for user data (auth state changes)', () => {
      expect(queryConfig.user.staleTime).toBe(1 * 60 * 1000); // 1 minute
      expect(queryConfig.user.gcTime).toBe(5 * 60 * 1000); // 5 minutes

      // User data should be fresher than other data types
      expect(queryConfig.user.staleTime).toBeLessThan(queryConfig.exercises.staleTime);
      expect(queryConfig.user.staleTime).toBeLessThan(queryConfig.plans.staleTime);
    });

    it('should have medium cache times for workout plans', () => {
      expect(queryConfig.plans.staleTime).toBe(3 * 60 * 1000); // 3 minutes
      expect(queryConfig.plans.gcTime).toBe(10 * 60 * 1000); // 10 minutes

      // Plans should be cached longer than user data but shorter than exercises
      expect(queryConfig.plans.staleTime).toBeGreaterThan(queryConfig.user.staleTime);
      expect(queryConfig.plans.staleTime).toBeLessThan(queryConfig.exercises.staleTime);
    });

    it('should have medium cache times for workout history', () => {
      expect(queryConfig.workouts.staleTime).toBe(3 * 60 * 1000); // 3 minutes
      expect(queryConfig.workouts.gcTime).toBe(15 * 60 * 1000); // 15 minutes

      // Workout history should have similar caching to plans
      expect(queryConfig.workouts.staleTime).toBe(queryConfig.plans.staleTime);
      expect(queryConfig.workouts.gcTime).toBeGreaterThan(queryConfig.plans.gcTime);
    });

    it('should have long cache times for exercises (mostly static)', () => {
      expect(queryConfig.exercises.staleTime).toBe(10 * 60 * 1000); // 10 minutes
      expect(queryConfig.exercises.gcTime).toBe(30 * 60 * 1000); // 30 minutes

      // Exercises should be cached the longest (except chat which is never cached)
      expect(queryConfig.exercises.staleTime).toBeGreaterThan(queryConfig.user.staleTime);
      expect(queryConfig.exercises.staleTime).toBeGreaterThan(queryConfig.plans.staleTime);
      expect(queryConfig.exercises.gcTime).toBeGreaterThan(queryConfig.plans.gcTime);
    });

    it('should never cache chat data (each interaction is unique)', () => {
      expect(queryConfig.chat.staleTime).toBe(0);
      expect(queryConfig.chat.gcTime).toBe(0);

      // Chat should never be considered fresh and never be cached
      expect(queryConfig.chat.staleTime).toBeLessThan(queryConfig.user.staleTime);
    });

    it('should have medium cache times for statistics', () => {
      expect(queryConfig.stats.staleTime).toBe(5 * 60 * 1000); // 5 minutes
      expect(queryConfig.stats.gcTime).toBe(20 * 60 * 1000); // 20 minutes

      // Stats should balance freshness with performance
      expect(queryConfig.stats.staleTime).toBeGreaterThan(queryConfig.user.staleTime);
      expect(queryConfig.stats.staleTime).toBeLessThan(queryConfig.exercises.staleTime);
    });
  });

  describe('default query behavior', () => {
    const queryOptions = queryClient.getDefaultOptions().queries!;

    it('should have appropriate default stale time', () => {
      expect(queryOptions.staleTime).toBe(5 * 60 * 1000); // 5 minutes
    });

    it('should have appropriate garbage collection time', () => {
      expect(queryOptions.gcTime).toBe(10 * 60 * 1000); // 10 minutes
    });

    it('should refetch on window focus by default', () => {
      expect(queryOptions.refetchOnWindowFocus).toBe(true);
    });

    it('should always refetch on reconnect', () => {
      expect(queryOptions.refetchOnReconnect).toBe('always');
    });
  });

  describe('configuration consistency', () => {
    it('should have garbage collection time greater than or equal to stale time for all data types', () => {
      Object.entries(queryConfig).forEach(([, config]) => {
        expect(config.gcTime).toBeGreaterThanOrEqual(config.staleTime);
      });
    });

    it('should have reasonable time values (not negative, not too large)', () => {
      Object.entries(queryConfig).forEach(([, config]) => {
        expect(config.staleTime).toBeGreaterThanOrEqual(0);
        expect(config.gcTime).toBeGreaterThanOrEqual(0);

        // Should not exceed 1 hour for any single cache setting
        expect(config.staleTime).toBeLessThanOrEqual(60 * 60 * 1000);
        expect(config.gcTime).toBeLessThanOrEqual(60 * 60 * 1000);
      });
    });

    it('should be a readonly configuration', () => {
      // TypeScript should enforce this, but let's verify the structure
      expect(typeof queryConfig).toBe('object');
      expect(queryConfig).not.toBe(null);

      // Verify all expected data types are present
      const expectedDataTypes = ['user', 'plans', 'workouts', 'exercises', 'chat', 'stats'] as const;
      expectedDataTypes.forEach((dataType) => {
        expect(queryConfig).toHaveProperty(dataType);
        expect(queryConfig[dataType]).toHaveProperty('staleTime');
        expect(queryConfig[dataType]).toHaveProperty('gcTime');
      });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle retry function with null error', () => {
      const queryOptions = queryClient.getDefaultOptions().queries!;
      const retryFunction = queryOptions.retry as (failureCount: number, error: unknown) => boolean;

      // Should not crash with null error
      const shouldRetry = retryFunction(1, null);
      expect(typeof shouldRetry).toBe('boolean');
    });

    it('should handle retry function with undefined error', () => {
      const queryOptions = queryClient.getDefaultOptions().queries!;
      const retryFunction = queryOptions.retry as (failureCount: number, error: unknown) => boolean;

      // Should not crash with undefined error
      const shouldRetry = retryFunction(1, undefined);
      expect(typeof shouldRetry).toBe('boolean');
    });

    it('should handle mutation retry function with non-ApiClientError', () => {
      const mutationOptions = queryClient.getDefaultOptions().mutations!;
      const retryFunction = mutationOptions.retry as (failureCount: number, error: unknown) => boolean;

      const genericError = new Error('Generic error');
      const shouldRetry = retryFunction(0, genericError);
      expect(shouldRetry).toBe(true); // Should retry once for non-client errors
    });

    it('should handle large attempt indices in retry delay', () => {
      const queryOptions = queryClient.getDefaultOptions().queries!;
      const retryDelayFunction = queryOptions.retryDelay as (attemptIndex: number) => number;

      const largeAttempt = retryDelayFunction(100);
      expect(largeAttempt).toBe(30000); // Should be capped at 30 seconds
    });
  });

  describe('business logic validation', () => {
    it('should implement smart retry strategy for different error categories', () => {
      const queryOptions = queryClient.getDefaultOptions().queries!;
      const retryFunction = queryOptions.retry as (failureCount: number, error: unknown) => boolean;

      // Auth errors: Never retry (user needs to re-authenticate)
      expect(retryFunction(1, createMockApiError('Unauthorized', 401))).toBe(false);

      // Validation errors: Never retry (data is invalid)
      expect(retryFunction(1, createMockApiError('Invalid data', 422))).toBe(false);

      // Rate limiting: Should retry (temporary limitation)
      expect(retryFunction(1, createMockApiError('Rate limited', 429))).toBe(true);

      // Server errors: Should retry (might be temporary)
      expect(retryFunction(1, createMockApiError('Server error', 500))).toBe(true);

      // Network errors: Should retry (connection might recover)
      expect(retryFunction(1, createMockApiError('Network error', 0))).toBe(true);
    });

    it('should balance performance and data freshness requirements', () => {
      // Critical auth data should be fresh
      expect(queryConfig.user.staleTime).toBe(60 * 1000); // 1 minute

      // Static exercise data can be cached longer
      expect(queryConfig.exercises.staleTime).toBe(600 * 1000); // 10 minutes

      // Chat should never be cached (each conversation is unique)
      expect(queryConfig.chat.staleTime).toBe(0);
      expect(queryConfig.chat.gcTime).toBe(0);
    });
  });
});
