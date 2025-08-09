/**
 * OpenAPI React Query Integration
 *
 * This file provides the React Query integration for the OpenAPI client.
 * It creates type-safe hooks for all API operations with automatic
 * caching, error handling, and optimistic updates.
 */

import { useQueryClient } from '@tanstack/react-query';
import createClient from 'openapi-react-query';

import { queryConfig } from '@/services/query/client';

import { apiClient } from './client';

/**
 * Create the React Query integrated client
 *
 * This provides type-safe hooks for all API endpoints defined in the OpenAPI schema.
 * Each endpoint gets generated hooks like useQuery, useMutation, etc.
 */
export const $api = createClient(apiClient);

/**
 * Query key factory for consistent cache management
 *
 * This provides a structured way to create query keys that work well
 * with React Query's cache management and invalidation.
 */
export const queryKeys = {
  // Auth/User queries
  auth: {
    all: ['auth'] as const,
    me: () => [...queryKeys.auth.all, 'me'] as const,
  },

  // Plans queries
  plans: {
    all: ['plans'] as const,
    lists: () => [...queryKeys.plans.all, 'list'] as const,
    list: (filters: Record<string, unknown> = {}) => [...queryKeys.plans.lists(), filters] as const,
    details: () => [...queryKeys.plans.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.plans.details(), id] as const,
  },

  // Exercises queries
  exercises: {
    all: ['exercises'] as const,
    lists: () => [...queryKeys.exercises.all, 'list'] as const,
    list: (filters: Record<string, unknown> = {}) => [...queryKeys.exercises.lists(), filters] as const,
    details: () => [...queryKeys.exercises.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.exercises.details(), id] as const,
    search: (query: string) => [...queryKeys.exercises.all, 'search', query] as const,
  },

  // Workouts queries
  workouts: {
    all: ['workouts'] as const,
    history: () => [...queryKeys.workouts.all, 'history'] as const,
    details: () => [...queryKeys.workouts.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.workouts.details(), id] as const,
  },

  // Chat queries (typically no caching)
  chat: {
    all: ['chat'] as const,
  },
} as const;

/**
 * Utility hook for common cache invalidation patterns
 *
 * This provides convenient methods for invalidating related queries
 * after mutations, following common patterns in the app.
 */
export function useApiCache() {
  const queryClient = useQueryClient();

  return {
    // Invalidate all queries for a specific domain
    invalidateAuth: () => queryClient.invalidateQueries({ queryKey: queryKeys.auth.all }),
    invalidatePlans: () => queryClient.invalidateQueries({ queryKey: queryKeys.plans.all }),
    invalidateExercises: () => queryClient.invalidateQueries({ queryKey: queryKeys.exercises.all }),
    invalidateWorkouts: () => queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all }),

    // Remove specific items from cache
    removePlan: (id: string) => queryClient.removeQueries({ queryKey: queryKeys.plans.detail(id) }),
    removeWorkout: (id: string) => queryClient.removeQueries({ queryKey: queryKeys.workouts.detail(id) }),

    // Update specific items in cache
    updatePlan: <T>(id: string, data: T) => {
      queryClient.setQueryData(queryKeys.plans.detail(id), data);
    },

    updateWorkout: <T>(id: string, data: T) => {
      queryClient.setQueryData(queryKeys.workouts.detail(id), data);
    },

    // Optimistically update list data
    optimisticPlanUpdate: <T>(newPlan: T & { id: string }) => {
      queryClient.setQueriesData({ queryKey: queryKeys.plans.lists() }, (old: unknown) => {
        if (!old) return old;

        // Handle different response formats (paginated vs simple list)
        if (
          typeof old === 'object' &&
          old !== null &&
          'items' in old &&
          Array.isArray((old as Record<string, unknown>).items)
        ) {
          // Backend paginated format
          const paginatedOld = old as { items: T[]; total?: number; [key: string]: unknown };
          return {
            ...paginatedOld,
            items: [newPlan, ...paginatedOld.items],
            total: (paginatedOld.total ?? 0) + 1,
          };
        } else if (Array.isArray(old)) {
          // Simple array format
          return [newPlan, ...(old as T[])];
        }

        return old;
      });

      // Also set the individual item cache
      queryClient.setQueryData(queryKeys.plans.detail(newPlan.id), newPlan);
    },

    // Get cached data without triggering a fetch
    getCachedPlan: (id: string) => queryClient.getQueryData(queryKeys.plans.detail(id)),
    getCachedPlans: (filters: Record<string, unknown> = {}) => queryClient.getQueryData(queryKeys.plans.list(filters)),
    getCachedUser: () => queryClient.getQueryData(queryKeys.auth.me()),
  };
}

/**
 * Configuration presets for different types of queries
 *
 * These provide sensible defaults for different data access patterns
 * based on how frequently the data changes.
 */
export const queryPresets = {
  // For frequently changing data (user profile, active sessions)
  volatile: {
    staleTime: queryConfig.user.staleTime,
    gcTime: queryConfig.user.gcTime,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  },

  // For moderately changing data (plans, workouts)
  standard: {
    staleTime: queryConfig.plans.staleTime,
    gcTime: queryConfig.plans.gcTime,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  },

  // For rarely changing data (exercises, static content)
  stable: {
    staleTime: queryConfig.exercises.staleTime,
    gcTime: queryConfig.exercises.gcTime,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  },

  // For data that should never be cached (chat, real-time data)
  realtime: {
    staleTime: queryConfig.chat.staleTime,
    gcTime: queryConfig.chat.gcTime,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  },
} as const;

/**
 * Export the openapi-react-query client for direct use in components
 */
export default $api;
