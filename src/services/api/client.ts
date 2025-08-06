/**
 * Core API client with auth integration and error handling
 */

import queryString from 'query-string';

import { isDevelopment } from '@/config/env';
import { authService } from '@/services/auth/auth.service';

import { API_URL, CONTENT_TYPES, DEFAULT_TIMEOUT, HTTP_STATUS } from './config';
import { ApiClientError, handleApiError } from './errors';
import type { ApiResponse, RequestOptions } from './types';

const MIN_TIMEOUT = 1000; // 1 second minimum
const MAX_TIMEOUT = 120000; // 2 minutes maximum

/**
 * Create headers for API requests
 */
async function createHeaders(options?: RequestOptions): Promise<Headers> {
  const headers = new Headers();

  // Set content type
  if (!options?.body || typeof options.body === 'string') {
    headers.set('Content-Type', CONTENT_TYPES.JSON);
  }

  // Add auth token unless explicitly skipped
  if (!options?.skipAuth) {
    const token = await authService.getAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  // Merge with custom headers
  if (options?.headers) {
    const customHeaders = new Headers(options.headers);
    customHeaders.forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return headers;
}

/**
 * Validate timeout value to prevent DoS attacks
 */
function validateTimeout(timeout?: number): number {
  if (timeout === undefined) {
    return DEFAULT_TIMEOUT;
  }

  // Ensure timeout is within safe bounds
  if (timeout < MIN_TIMEOUT) {
    // Log warning in development only, silently fix in production
    if (isDevelopment()) {
      // eslint-disable-next-line no-console
      console.warn(`Timeout ${timeout}ms is below minimum ${MIN_TIMEOUT}ms, using minimum`);
    }
    return MIN_TIMEOUT;
  }

  if (timeout > MAX_TIMEOUT) {
    // Log warning in development only, silently fix in production
    if (isDevelopment()) {
      // eslint-disable-next-line no-console
      console.warn(`Timeout ${timeout}ms exceeds maximum ${MAX_TIMEOUT}ms, using maximum`);
    }
    return MAX_TIMEOUT;
  }

  return timeout;
}

/**
 * Create a fetch request with timeout
 */
function fetchWithTimeout(url: string, options: RequestInit, timeout: number = DEFAULT_TIMEOUT): Promise<Response> {
  // Validate timeout to prevent DoS
  const validatedTimeout = validateTimeout(timeout);

  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error(`Request timeout after ${validatedTimeout}ms`));
    }, validatedTimeout);

    fetch(url, { ...options, signal: controller.signal })
      .then((response) => {
        clearTimeout(timeoutId);
        resolve(response);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error instanceof Error ? error : new Error(String(error)));
      });
  });
}

/**
 * Basic runtime validation for API responses
 */
function validateResponse(data: unknown, endpoint: string): void {
  // Ensure response is not null/undefined for non-204 responses
  if (data === null || data === undefined) {
    throw new ApiClientError('Received null or undefined response', 0, endpoint);
  }

  // Check for common error response patterns that might have slipped through
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;

    // Check for error fields that indicate a problem
    if ('error' in obj && obj.error) {
      throw new ApiClientError(typeof obj.error === 'string' ? obj.error : 'Server returned an error', 0, endpoint);
    }

    // Check for success:false pattern
    if ('success' in obj && obj.success === false) {
      throw new ApiClientError((obj.message as string) || 'Operation failed', 0, endpoint);
    }
  }
}

/**
 * Process API response
 */
async function processResponse<T>(response: Response, endpoint: string): Promise<T> {
  // Handle no content responses
  if (response.status === HTTP_STATUS.NO_CONTENT) {
    return {} as T;
  }

  // Try to parse JSON response
  let data: unknown;
  const contentType = response.headers.get('content-type');

  if (contentType?.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      // If JSON parsing fails, throw a generic error
      throw new ApiClientError('Invalid response format', response.status, endpoint);
    }
  } else {
    // Non-JSON response
    data = await response.text();
  }

  // Handle error responses
  if (!response.ok) {
    const apiResponse = data as ApiResponse;
    throw new ApiClientError(
      apiResponse.error?.message ?? response.statusText,
      response.status,
      endpoint,
      apiResponse.error?.code,
      apiResponse.error?.field,
      apiResponse.error?.detail,
    );
  }

  // Validate the response structure
  validateResponse(data, endpoint);

  // Return the data directly (backend doesn't wrap in { data: ... })
  return data as T;
}

/**
 * Core API client class
 */
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Make an API request
   */
  async request<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      // Create headers with auth
      const headers = await createHeaders(options);

      const urlObject = new URL(url);
      const currentOrigin = window.location.origin;
      const isSameOrigin = urlObject.origin === currentOrigin;

      // Prepare request options
      const requestOptions: RequestInit = {
        ...options,
        headers,
        // Only include credentials for same-origin requests to prevent CSRF
        credentials: isSameOrigin ? 'same-origin' : 'omit',
      };

      // Make the request with timeout
      const response = await fetchWithTimeout(url, requestOptions, options?.timeout);

      // Process response
      return await processResponse<T>(response, endpoint);
    } catch (error) {
      // Handle and throw API error
      throw handleApiError(error, endpoint);
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, params?: Record<string, unknown>, options?: RequestOptions): Promise<T> {
    let queryStringPart = '';

    if (params) {
      // Filter out undefined and null values
      const cleanParams: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          // Convert dates to ISO strings
          if (value instanceof Date) {
            cleanParams[key] = value.toISOString();
          } else {
            cleanParams[key] = value;
          }
        }
      }

      // Use query-string for proper serialization
      if (Object.keys(cleanParams).length > 0) {
        queryStringPart = `?${queryString.stringify(cleanParams, {
          arrayFormat: 'bracket', // Use array[0]=value&array[1]=value format
          skipNull: true,
          skipEmptyString: true,
          encode: true, // Properly encode special characters
        })}`;
      }
    }

    return this.request<T>(`${endpoint}${queryStringPart}`, {
      ...options,
      method: 'GET',
    });
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'DELETE',
    });
  }
}

/**
 * Singleton API client instance
 */
export const apiClient = new ApiClient();

/**
 * Export type for dependency injection in tests
 */
export type { ApiClient };
