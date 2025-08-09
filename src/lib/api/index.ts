/**
 * OpenAPI Client API Exports
 *
 * This is the main entry point for the OpenAPI client infrastructure.
 * It exports all the essential components needed throughout the application.
 */

// Core client and React Query integration
// Import types for re-export
import type { paths } from '@/types/api.types.gen';

export { default as apiClient } from './client';
export { $api, default as $apiHooks } from './hooks';

// Error types
export type { ApiError, ValidationError } from './client';
export { ApiClientError } from './client';

// Query utilities
export { queryKeys, queryPresets, useApiCache } from './hooks';

// Types from the generated OpenAPI schema
export type { components, operations, paths } from '@/types/api.types.gen';

// Re-export common types for convenience with type aliases
export type PlansListResponse = paths['/api/v1/plans/']['get']['responses']['200']['content']['application/json'];
export type CreatePlanRequest = paths['/api/v1/plans/']['post']['requestBody']['content']['application/json'];
export type PlanResponse = paths['/api/v1/plans/{plan_id}']['get']['responses']['200']['content']['application/json'];
export type UserProfile = paths['/api/v1/auth/me']['get']['responses']['200']['content']['application/json'];

/**
 * Common response types for convenience
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
}

/**
 * Common request types
 */
export interface ListParams {
  page?: number;
  per_page?: number;
  limit?: number;
  offset?: number;
}

export type SearchParams = ListParams & {
  q?: string;
  query?: string;
};

/**
 * Utility types for working with OpenAPI paths
 * These are kept simple to avoid complex TypeScript inference issues
 */
export type ApiResponseType = {
  [K in keyof paths]: {
    [M in keyof paths[K]]: paths[K][M] extends { responses: { '200': { content: { 'application/json': unknown } } } }
      ? paths[K][M]['responses']['200']['content']['application/json']
      : never;
  };
};

export type ApiRequestBodyType = {
  [K in keyof paths]: {
    [M in keyof paths[K]]: paths[K][M] extends { requestBody: { content: { 'application/json': unknown } } }
      ? paths[K][M]['requestBody']['content']['application/json']
      : never;
  };
};
