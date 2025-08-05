/**
 * React Query hooks for user profile
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { userApi } from '@/services/api/endpoints/user';
import { queryConfig } from '@/services/query/client';
import { queryKeys } from '@/services/query/keys';
import { useAuthStore } from '@/stores';

/**
 * Hook to fetch current user profile
 */
export function useUserProfile() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.user.profile(),
    queryFn: () => userApi.getProfile(),
    enabled: isAuthenticated,
    ...queryConfig.user,
  });
}

/**
 * Hook to prefetch user profile
 */
export function usePrefetchUserProfile() {
  const queryClient = useQueryClient();

  return () => {
    return queryClient.prefetchQuery({
      queryKey: queryKeys.user.profile(),
      queryFn: () => userApi.getProfile(),
      ...queryConfig.user,
    });
  };
}

/**
 * Hook to invalidate user queries
 */
export function useInvalidateUser() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.user.all });
  };
}
