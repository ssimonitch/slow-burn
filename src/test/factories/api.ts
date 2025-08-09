/**
 * Test factories for API-related mock data
 *
 * These utilities help create properly typed mock objects for:
 * - API responses and errors
 * - Fetch API mocks
 * - Request/response data
 * - Backend paginated responses matching OpenAPI schema
 *
 * All factories work with backend format exclusively as the application now uses
 * the OpenAPI client directly without transformation layers. Types are imported
 * from @/lib/api for consistency with the OpenAPI schema.
 *
 * Used across API service tests to maintain consistency and avoid code duplication.
 */

import { vi } from 'vitest';

import { ApiError } from '@/lib/errors';

/**
 * Backend paginated response format (matches OpenAPI schema)
 * This is now the ONLY pagination format used throughout the application
 */
export interface BackendPaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
}

/**
 * Creates a mock Response object for testing fetch operations
 * @param data - Response data to return
 * @param options - Response configuration
 * @returns Mock Response object
 */
export function createMockResponse<T>(
  data: T,
  options: {
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
    ok?: boolean;
  } = {},
): Response {
  const {
    status = 200,
    statusText = 'OK',
    headers = { 'content-type': 'application/json' },
    ok = status >= 200 && status < 300,
  } = options;

  const mockHeaders = new Headers();
  Object.entries(headers).forEach(([key, value]) => {
    mockHeaders.set(key, value);
  });

  return {
    ok,
    status,
    statusText,
    headers: mockHeaders,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(typeof data === 'string' ? data : JSON.stringify(data)),
    blob: vi.fn(),
    arrayBuffer: vi.fn(),
    formData: vi.fn(),
    bytes: vi.fn(),
    body: null,
    bodyUsed: false,
    clone: vi.fn(),
    redirected: false,
    type: 'basic',
    url: 'https://api.example.com/test',
  } as unknown as Response;
}

/**
 * Creates a mock API response
 * @param data - Response data
 * @returns Response data directly (OpenAPI client returns data directly)
 */
export function createApiResponse<T>(data: T): T {
  return data;
}

/**
 * Creates a mock API error response
 * @param message - Error message
 * @param code - Error code
 * @param field - Field that caused the error
 * @param detail - Additional error details
 * @returns ApiError instance
 */
export function createApiErrorResponse(message: string, code?: string, field?: string, detail?: unknown): ApiError {
  return new ApiError(message, 500, undefined, code, field, detail);
}

/**
 * Creates a mock ApiError instance
 * @param message - Error message
 * @param status - HTTP status code
 * @param endpoint - API endpoint that failed
 * @param code - Error code
 * @param field - Field that caused the error
 * @param detail - Additional error details
 * @returns ApiError instance
 */
export function createMockApiError(
  message = 'Test error',
  status = 500,
  endpoint?: string,
  code?: string,
  field?: string,
  detail?: unknown,
): ApiError {
  return new ApiError(message, status, endpoint, code, field, detail);
}

/**
 * Creates a mock paginated response in backend format (OpenAPI schema)
 *
 * Use this factory when testing:
 * - OpenAPI client request/response handling
 * - Mock API responses that simulate backend responses
 * - Component tests that work with backend data format
 * - Network layer testing with realistic backend data
 *
 * Backend format: { items: T[], total: number, page: number, per_page: number }
 *
 * @param items - Array of items
 * @param options - Backend pagination options
 * @returns BackendPaginatedResponse matching OpenAPI schema
 */
export function createBackendPaginatedResponse<T>(
  items: T[],
  options: {
    page?: number;
    per_page?: number;
    total?: number;
  } = {},
): BackendPaginatedResponse<T> {
  const { page = 1, per_page = 20, total = items.length } = options;

  return {
    items,
    total,
    page,
    per_page,
  };
}

/**
 * Creates a network error (TypeError with fetch message)
 * @param message - Error message
 * @returns TypeError that simulates network failure
 */
export function createNetworkError(message = 'fetch failed'): TypeError {
  return new TypeError(`NetworkError: ${message}`);
}

/**
 * Creates an AbortError for timeout testing
 * @param message - Error message
 * @returns DOMException that simulates request abortion
 */
export function createAbortError(message = 'Request timeout'): DOMException {
  const error = new DOMException(message, 'AbortError');
  return error;
}

/**
 * Mock fetch implementation that can be configured for different test scenarios
 */
export class MockFetch {
  private responses: {
    url?: string | RegExp;
    method?: string;
    response: () => Promise<Response>;
  }[] = [];

  /**
   * Add a mock response for specific URL and method
   */
  mockResponse(
    response: Response | Error,
    options: {
      url?: string | RegExp;
      method?: string;
    } = {},
  ): void {
    this.responses.push({
      url: options.url,
      method: options.method,
      response: () => {
        if (response instanceof Error) {
          return Promise.reject(response);
        }
        return Promise.resolve(response);
      },
    });
  }

  /**
   * Implementation for vi.fn().mockImplementation()
   */
  implementation = async (url: string, options?: RequestInit): Promise<Response> => {
    const method = options?.method ?? 'GET';

    // Find matching response configuration
    const match = this.responses.find((config) => {
      const urlMatches =
        !config.url || (typeof config.url === 'string' ? url.includes(config.url) : config.url.test(url));
      const methodMatches = !config.method || config.method === method;
      return urlMatches && methodMatches;
    });

    if (match) {
      return match.response();
    }

    // Default: return 404 for unmatched requests
    return createMockResponse({ error: 'Not found' }, { status: 404, ok: false });
  };

  /**
   * Clear all configured responses
   */
  clear(): void {
    this.responses = [];
  }
}

/**
 * Helper to create a configured MockFetch instance
 */
export function createMockFetch(): MockFetch {
  return new MockFetch();
}

/**
 * Test data for common API scenarios
 */
export const apiTestData = {
  // Sample user profile data
  userProfile: {
    id: 'test-user-id',
    email: 'test@example.com',
    affinity_score: 50,
    preferences: {},
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },

  // Sample exercise data
  exercise: {
    id: 'exercise-1',
    name: 'Bench Press',
    instructions: 'Lie on bench and press weight up',
    muscle_groups: ['chest', 'triceps', 'shoulders'],
    equipment: 'barbell',
    difficulty_level: 'intermediate',
  },

  // Sample workout plan data
  workoutPlan: {
    id: 'plan-1',
    name: 'Push Day',
    description: 'Upper body push workout',
    exercises: ['exercise-1', 'exercise-2'],
    difficulty_level: 'intermediate',
    estimated_duration: 45,
  },

  // Sample workout session data
  workoutSession: {
    id: 'session-1',
    plan_id: 'plan-1',
    user_id: 'test-user-id',
    started_at: '2024-01-01T10:00:00Z',
    completed_at: '2024-01-01T10:45:00Z',
    notes: 'Great workout!',
    rating: 8,
  },

  // Common query parameters
  queryParams: {
    page: 1,
    limit: 20,
    sort: 'created_at',
    order: 'desc' as const,
  },
} as const;
