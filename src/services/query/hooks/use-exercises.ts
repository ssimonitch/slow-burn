/**
 * React Query hooks for exercises
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { ExerciseSearchParams, ExerciseWithRelations } from '@/services/api/endpoints/exercises';
import { exercisesApi } from '@/services/api/endpoints/exercises';
import { queryConfig } from '@/services/query/client';
import { queryKeys } from '@/services/query/keys';

/**
 * Hook to fetch paginated list of exercises
 */
export function useExercises(params?: ExerciseSearchParams) {
  return useQuery({
    queryKey: [...queryKeys.exercises.lists(), { params }] as const,
    queryFn: () => exercisesApi.list(params),
    ...queryConfig.exercises,
  });
}

/**
 * Hook to fetch a single exercise by ID
 */
export function useExercise(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.exercises.detail(id!),
    queryFn: () => exercisesApi.get(id!),
    enabled: !!id,
    ...queryConfig.exercises,
  });
}

/**
 * Hook to search exercises
 */
export function useExerciseSearch(
  query: string,
  params?: Omit<ExerciseSearchParams, 'query'>,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: [...queryKeys.exercises.search(query), params] as const,
    queryFn: () => exercisesApi.search(query, params),
    enabled: options?.enabled ?? query.length > 0,
    ...queryConfig.exercises,
  });
}

/**
 * Hook to prefetch an exercise
 */
export function usePrefetchExercise() {
  const queryClient = useQueryClient();

  return (id: string) => {
    return queryClient.prefetchQuery({
      queryKey: queryKeys.exercises.detail(id),
      queryFn: () => exercisesApi.get(id),
      ...queryConfig.exercises,
    });
  };
}

/**
 * Hook to get exercises from cache
 */
export function useExercisesCache() {
  const queryClient = useQueryClient();

  return {
    /**
     * Get an exercise from cache by ID
     */
    getExercise: (id: string): ExerciseWithRelations | undefined => {
      return queryClient.getQueryData(queryKeys.exercises.detail(id));
    },

    /**
     * Get all cached exercise lists
     */
    getCachedLists: () => {
      const cache = queryClient.getQueryCache();
      const exerciseQueries = cache.findAll({
        queryKey: queryKeys.exercises.lists(),
      });

      return exerciseQueries
        .map((query) => {
          if ('state' in query && query.state && typeof query.state === 'object' && 'data' in query.state) {
            return query.state.data;
          }
          return undefined;
        })
        .filter(Boolean);
    },

    /**
     * Invalidate all exercise queries
     */
    invalidateAll: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.exercises.all });
    },
  };
}

/**
 * Hook to get exercise options for dropdowns
 * Returns a simplified list suitable for select components
 */
export function useExerciseOptions(params?: ExerciseSearchParams) {
  const { data, ...query } = useExercises(params);

  const options =
    data?.data.map((exercise) => ({
      value: exercise.id,
      label: exercise.name,
      category: exercise.exercise_category ?? '',
      equipment: exercise.primary_equipment_id ?? '',
    })) ?? [];

  return {
    options,
    ...query,
  };
}
