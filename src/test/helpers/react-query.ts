/**
 * Test helpers for React Query hooks and OpenAPI client
 *
 * These utilities create properly typed mock objects for:
 * - UseQueryResult with all required properties
 * - UseMutationResult with all required properties
 * - OpenAPI client ($api) mocking patterns
 * - Proper TypeScript support for different states
 *
 * Used to avoid incomplete mock objects that cause TypeScript errors.
 * Updated to support OpenAPI client patterns used throughout the application.
 */

import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { vi } from 'vitest';

/**
 * Creates a complete mock UseQueryResult for loading state
 * @param overrides - Optional overrides for specific properties
 * @returns Complete UseQueryResult in loading state
 */
export function createMockQueryLoading<TData = unknown, TError = Error>(
  overrides: Partial<UseQueryResult<TData, TError>> = {},
): UseQueryResult<TData, TError> {
  const baseResult = {
    data: undefined,
    error: null,
    isError: false,
    isLoading: true,
    isPending: true,
    isSuccess: false,
    isLoadingError: false,
    isRefetchError: false,
    isStale: true,
    status: 'pending' as const,
    fetchStatus: 'fetching' as const,
    isFetched: false,
    isFetchedAfterMount: false,
    isFetching: true,
    isInitialLoading: true,
    isPlaceholderData: false,
    isPaused: false,
    isRefetching: false,
    dataUpdatedAt: 0,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    errorUpdateCount: 0,
    isInvalidating: false,
    refetch: vi.fn(),
    remove: vi.fn(),
    ...overrides,
  };

  return baseResult as UseQueryResult<TData, TError>;
}

/**
 * Creates a complete mock UseQueryResult for success state
 * @param data - The data to return
 * @param overrides - Optional overrides for specific properties
 * @returns Complete UseQueryResult in success state
 */
export function createMockQuerySuccess<TData = unknown, TError = Error>(
  data: TData,
  overrides: Partial<UseQueryResult<TData, TError>> = {},
): UseQueryResult<TData, TError> {
  const baseResult = {
    data,
    error: null,
    isError: false,
    isLoading: false,
    isPending: false,
    isSuccess: true,
    isLoadingError: false,
    isRefetchError: false,
    isStale: false,
    status: 'success' as const,
    fetchStatus: 'idle' as const,
    isFetched: true,
    isFetchedAfterMount: true,
    isFetching: false,
    isInitialLoading: false,
    isPlaceholderData: false,
    isPaused: false,
    isRefetching: false,
    dataUpdatedAt: Date.now(),
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    errorUpdateCount: 0,
    isInvalidating: false,
    refetch: vi.fn(),
    remove: vi.fn(),
    ...overrides,
  };

  return baseResult as UseQueryResult<TData, TError>;
}

/**
 * Creates a complete mock UseQueryResult for error state
 * @param error - The error to return
 * @param overrides - Optional overrides for specific properties
 * @returns Complete UseQueryResult in error state
 */
export function createMockQueryError<TData = unknown, TError = Error>(
  error: TError,
  overrides: Partial<UseQueryResult<TData, TError>> = {},
): UseQueryResult<TData, TError> {
  const baseResult = {
    data: undefined,
    error,
    isError: true,
    isLoading: false,
    isPending: false,
    isSuccess: false,
    isLoadingError: true,
    isRefetchError: false,
    isStale: true,
    status: 'error' as const,
    fetchStatus: 'idle' as const,
    isFetched: true,
    isFetchedAfterMount: true,
    isFetching: false,
    isInitialLoading: false,
    isPlaceholderData: false,
    isPaused: false,
    isRefetching: false,
    dataUpdatedAt: 0,
    errorUpdatedAt: Date.now(),
    failureCount: 1,
    failureReason: error,
    errorUpdateCount: 1,
    isInvalidating: false,
    refetch: vi.fn(),
    remove: vi.fn(),
    ...overrides,
  };

  return baseResult as UseQueryResult<TData, TError>;
}

/**
 * Creates a complete mock UseMutationResult for idle state
 * @param overrides - Optional overrides for specific properties
 * @returns Complete UseMutationResult in idle state
 */
export function createMockMutationIdle<TData = unknown, TError = Error, TVariables = void, TContext = unknown>(
  overrides: Partial<UseMutationResult<TData, TError, TVariables, TContext>> = {},
): UseMutationResult<TData, TError, TVariables, TContext> {
  const baseResult = {
    data: undefined,
    error: null,
    variables: undefined,
    context: undefined,
    isError: false,
    isIdle: true,
    isPending: false,
    isPaused: false,
    isSuccess: false,
    status: 'idle' as const,
    failureCount: 0,
    failureReason: null,
    submittedAt: 0,
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  };

  return baseResult as UseMutationResult<TData, TError, TVariables, TContext>;
}

/**
 * Creates a complete mock UseMutationResult for pending state
 * @param overrides - Optional overrides for specific properties
 * @returns Complete UseMutationResult in pending state
 */
export function createMockMutationPending<TData = unknown, TError = Error, TVariables = void, TContext = unknown>(
  overrides: Partial<UseMutationResult<TData, TError, TVariables, TContext>> = {},
): UseMutationResult<TData, TError, TVariables, TContext> {
  const baseResult = {
    data: undefined,
    error: null,
    variables: undefined,
    context: undefined,
    isError: false,
    isIdle: false,
    isPending: true,
    isPaused: false,
    isSuccess: false,
    status: 'pending' as const,
    failureCount: 0,
    failureReason: null,
    submittedAt: Date.now(),
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  };

  return baseResult as UseMutationResult<TData, TError, TVariables, TContext>;
}

/**
 * Creates a complete mock UseMutationResult for success state
 * @param data - The data to return
 * @param overrides - Optional overrides for specific properties
 * @returns Complete UseMutationResult in success state
 */
export function createMockMutationSuccess<TData = unknown, TError = Error, TVariables = void, TContext = unknown>(
  data: TData,
  overrides: Partial<UseMutationResult<TData, TError, TVariables, TContext>> = {},
): UseMutationResult<TData, TError, TVariables, TContext> {
  const baseResult = {
    data,
    error: null,
    variables: undefined,
    context: undefined,
    isError: false,
    isIdle: false,
    isPending: false,
    isPaused: false,
    isSuccess: true,
    status: 'success' as const,
    failureCount: 0,
    failureReason: null,
    submittedAt: Date.now(),
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  };

  return baseResult as UseMutationResult<TData, TError, TVariables, TContext>;
}

/**
 * Creates a complete mock UseMutationResult for error state
 * @param error - The error to return
 * @param overrides - Optional overrides for specific properties
 * @returns Complete UseMutationResult in error state
 */
export function createMockMutationError<TData = unknown, TError = Error, TVariables = void, TContext = unknown>(
  error: TError,
  overrides: Partial<UseMutationResult<TData, TError, TVariables, TContext>> = {},
): UseMutationResult<TData, TError, TVariables, TContext> {
  const baseResult = {
    data: undefined,
    error,
    variables: undefined,
    context: undefined,
    isError: true,
    isIdle: false,
    isPending: false,
    isPaused: false,
    isSuccess: false,
    status: 'error' as const,
    failureCount: 1,
    failureReason: error,
    submittedAt: Date.now(),
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  };

  return baseResult as UseMutationResult<TData, TError, TVariables, TContext>;
}

/**
 * Common test scenarios for queries and mutations
 */
export const queryTestHelpers = {
  /**
   * Creates a loading query result
   */
  loading: createMockQueryLoading,

  /**
   * Creates a successful query result
   */
  success: createMockQuerySuccess,

  /**
   * Creates an error query result
   */
  error: createMockQueryError,
} as const;

export const mutationTestHelpers = {
  /**
   * Creates an idle mutation result
   */
  idle: createMockMutationIdle,

  /**
   * Creates a pending mutation result
   */
  pending: createMockMutationPending,

  /**
   * Creates a successful mutation result
   */
  success: createMockMutationSuccess,

  /**
   * Creates an error mutation result
   */
  error: createMockMutationError,
} as const;

/**
 * Helpers for mocking OpenAPI client ($api) patterns
 *
 * These utilities help mock the $api client used throughout the application.
 * The $api client provides useQuery and useMutation hooks for OpenAPI endpoints.
 */
export const apiClientTestHelpers = {
  /**
   * Creates a mock $api.useQuery result in different states
   */
  mockQuery: {
    loading: <TData = unknown, TError = Error>(overrides?: Partial<UseQueryResult<TData, TError>>) =>
      createMockQueryLoading<TData, TError>(overrides),

    success: <TData = unknown, TError = Error>(data: TData, overrides?: Partial<UseQueryResult<TData, TError>>) =>
      createMockQuerySuccess<TData, TError>(data, overrides),

    error: <TData = unknown, TError = Error>(error: TError, overrides?: Partial<UseQueryResult<TData, TError>>) =>
      createMockQueryError<TData, TError>(error, overrides),
  },

  /**
   * Creates a mock $api.useMutation result in different states
   */
  mockMutation: {
    idle: <TData = unknown, TError = Error, TVariables = void, TContext = unknown>(
      overrides?: Partial<UseMutationResult<TData, TError, TVariables, TContext>>,
    ) => createMockMutationIdle<TData, TError, TVariables, TContext>(overrides),

    pending: <TData = unknown, TError = Error, TVariables = void, TContext = unknown>(
      overrides?: Partial<UseMutationResult<TData, TError, TVariables, TContext>>,
    ) => createMockMutationPending<TData, TError, TVariables, TContext>(overrides),

    success: <TData = unknown, TError = Error, TVariables = void, TContext = unknown>(
      data: TData,
      overrides?: Partial<UseMutationResult<TData, TError, TVariables, TContext>>,
    ) => createMockMutationSuccess<TData, TError, TVariables, TContext>(data, overrides),

    error: <TData = unknown, TError = Error, TVariables = void, TContext = unknown>(
      error: TError,
      overrides?: Partial<UseMutationResult<TData, TError, TVariables, TContext>>,
    ) => createMockMutationError<TData, TError, TVariables, TContext>(error, overrides),
  },
} as const;

/**
 * Helper to mock the entire $api object structure
 *
 * Use this in tests that need to mock multiple $api methods:
 *
 * @example
 * ```typescript
 * vi.mock('@/lib/api', () => ({
 *   $api: createMock$Api({
 *     'GET /api/v1/plans/': {
 *       useQuery: vi.fn().mockReturnValue(apiClientTestHelpers.mockQuery.success(mockData))
 *     }
 *   })
 * }));
 * ```
 */
export function createMock$Api(
  overrides: Record<string, { useQuery?: ReturnType<typeof vi.fn>; useMutation?: ReturnType<typeof vi.fn> }> = {},
) {
  return {
    // Add default mock methods
    useQuery: vi.fn(),
    useMutation: vi.fn(),
    ...overrides,
  };
}
