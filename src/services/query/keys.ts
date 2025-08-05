/**
 * Query key factory for consistent and type-safe query keys
 *
 * This follows TanStack Query's recommended pattern for query keys
 * to ensure proper cache invalidation and type safety.
 */

/**
 * Base query keys for each feature
 */
export const queryKeys = {
  // User/Auth queries
  user: {
    all: ['user'] as const,
    profile: () => [...queryKeys.user.all, 'profile'] as const,
  },

  // Plans queries
  plans: {
    all: ['plans'] as const,
    lists: () => [...queryKeys.plans.all, 'list'] as const,
    list: (params?: Record<string, unknown>) => [...queryKeys.plans.lists(), params] as const,
    details: () => [...queryKeys.plans.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.plans.details(), id] as const,
  },

  // Exercises queries
  exercises: {
    all: ['exercises'] as const,
    lists: () => [...queryKeys.exercises.all, 'list'] as const,
    list: (params?: Record<string, unknown>) => [...queryKeys.exercises.lists(), params] as const,
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

  // Chat queries (not cached, but keys for consistency)
  chat: {
    all: ['chat'] as const,
    conversation: (id: string) => [...queryKeys.chat.all, 'conversation', id] as const,
  },
} as const;

/**
 * Type for all query keys
 */
export type QueryKeys = typeof queryKeys;

/**
 * Helper to invalidate all queries for a feature
 */
export function invalidateFeature(feature: keyof QueryKeys): readonly unknown[] {
  return queryKeys[feature].all;
}

/**
 * Helper to invalidate specific queries
 */
export const invalidateQueries = {
  // Invalidate all user data
  user: () => queryKeys.user.all,

  // Invalidate all plans
  plans: () => queryKeys.plans.all,

  // Invalidate specific plan
  plan: (id: string) => queryKeys.plans.detail(id),

  // Invalidate all exercises
  exercises: () => queryKeys.exercises.all,

  // Invalidate specific exercise
  exercise: (id: string) => queryKeys.exercises.detail(id),

  // Invalidate workout history
  workoutHistory: () => queryKeys.workouts.history(),
} as const;
