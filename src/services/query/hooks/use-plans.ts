/**
 * React Query hooks for workout plans
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  CreatePlanData,
  PlanQueryParams,
  PlanWithExercises,
  UpdatePlanData,
} from '@/services/api/endpoints/plans';
import { plansApi } from '@/services/api/endpoints/plans';
import { queryConfig } from '@/services/query/client';
import { queryKeys } from '@/services/query/keys';
import type { Plans } from '@/types/api.types.gen';

// Type alias for cleaner code
type Plan = Plans;

/**
 * Hook to fetch paginated list of plans
 */
export function usePlans(params?: PlanQueryParams) {
  return useQuery({
    queryKey: [...queryKeys.plans.lists(), { params }] as const,
    queryFn: () => plansApi.list(params),
    ...queryConfig.plans,
  });
}

/**
 * Hook to fetch a single plan by ID
 */
export function usePlan(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.plans.detail(id!),
    queryFn: () => plansApi.get(id!),
    enabled: !!id,
    ...queryConfig.plans,
  });
}

/**
 * Hook to create a new plan
 */
export function useCreatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePlanData) => plansApi.create(data),
    onSuccess: (newPlan) => {
      // Invalidate plans list to include new plan
      void queryClient.invalidateQueries({ queryKey: queryKeys.plans.lists() });

      // Optionally set the new plan in cache
      queryClient.setQueryData(queryKeys.plans.detail(newPlan.id), newPlan);
    },
  });
}

/**
 * Hook to update a plan
 */
export function useUpdatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePlanData }) => plansApi.update(id, data),
    onSuccess: (updatedPlan, { id }) => {
      // Invalidate plans list
      void queryClient.invalidateQueries({ queryKey: queryKeys.plans.lists() });

      // Update the specific plan in cache
      queryClient.setQueryData(queryKeys.plans.detail(updatedPlan.id), updatedPlan);

      // Also invalidate the old version if different ID
      if (id !== updatedPlan.id) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.plans.detail(id) });
      }
    },
  });
}

/**
 * Hook to delete a plan
 */
export function useDeletePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => plansApi.delete(id),
    onSuccess: (_, id) => {
      // Invalidate plans list
      void queryClient.invalidateQueries({ queryKey: queryKeys.plans.lists() });

      // Remove the plan from cache
      void queryClient.removeQueries({ queryKey: queryKeys.plans.detail(id) });
    },
  });
}

/**
 * Hook to prefetch a plan
 */
export function usePrefetchPlan() {
  const queryClient = useQueryClient();

  return (id: string) => {
    return queryClient.prefetchQuery({
      queryKey: queryKeys.plans.detail(id),
      queryFn: () => plansApi.get(id),
      ...queryConfig.plans,
    });
  };
}

/**
 * Hook to get plans from cache
 */
export function usePlansCache() {
  const queryClient = useQueryClient();

  return {
    /**
     * Get a plan from cache by ID
     */
    getPlan: (id: string): PlanWithExercises | undefined => {
      return queryClient.getQueryData(queryKeys.plans.detail(id));
    },

    /**
     * Set a plan in cache
     */
    setPlan: (plan: Plan | PlanWithExercises) => {
      queryClient.setQueryData(queryKeys.plans.detail(plan.id), plan);
    },

    /**
     * Invalidate all plans queries
     */
    invalidateAll: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.plans.all });
    },
  };
}
