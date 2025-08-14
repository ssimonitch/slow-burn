/**
 * TanStack Query client configuration
 */

import { QueryClient } from '@tanstack/react-query';

import { ApiClientError } from '@/lib/api/client';

/**
 * Default query client configuration
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: how long data is considered fresh
      staleTime: 5 * 60 * 1000, // 5 minutes

      // Cache time: how long inactive data stays in cache
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)

      // Retry configuration
      retry: (failureCount, error) => {
        // Don't retry on auth errors
        if (error instanceof ApiClientError && error.isAuthError()) {
          return false;
        }

        // Don't retry on client errors (except 429)
        if (error instanceof ApiClientError && error.isClientError() && error.status !== 429) {
          return false;
        }

        // Retry up to 3 times for other errors
        return failureCount < 3;
      },

      // Retry delay
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Refetch on window focus (good for keeping data fresh)
      refetchOnWindowFocus: true,

      // Don't refetch on reconnect by default (can be overridden per query)
      refetchOnReconnect: 'always',
    },

    mutations: {
      // Retry configuration for mutations
      retry: (failureCount, error) => {
        // Never retry mutations on client errors
        if (error instanceof ApiClientError && error.isClientError()) {
          return false;
        }

        // Retry once for server/network errors
        return failureCount < 1;
      },
    },
  },
});

/**
 * Optimized cache strategy per data type
 *
 * Why different cache times matter:
 * - User profiles change frequently (1 min cache prevents stale auth state)
 * - Exercises rarely change (10 min cache reduces unnecessary API calls)
 * - Plans are user-specific but stable (3 min balances freshness and performance)
 * - Chat should never be cached (each conversation is unique)
 */
export const queryConfig = {
  // User profile queries - SHORT cache (auth state changes)
  user: {
    staleTime: 1 * 60 * 1000, // 1 minute - auth state must be fresh
    gcTime: 5 * 60 * 1000, // 5 minutes garbage collection
  },

  // Plans queries - MEDIUM cache (user-specific, moderate changes)
  plans: {
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  },

  // Workout history - MEDIUM cache (appends new data but past doesn't change)
  workouts: {
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  },

  // Exercises queries - LONG cache (rarely change, can be cached longer)
  exercises: {
    staleTime: 10 * 60 * 1000, // 10 minutes - exercises are mostly static
    gcTime: 30 * 60 * 1000, // 30 minutes
  },

  // Chat/AI queries - NO cache (each interaction is unique)
  chat: {
    staleTime: 0, // Never consider fresh
    gcTime: 0, // Never cache
  },

  // Statistics/Analytics - MEDIUM cache (computed periodically)
  stats: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 20 * 60 * 1000, // 20 minutes
  },
} as const;
