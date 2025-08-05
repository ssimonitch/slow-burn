/**
 * Core API types and interfaces
 *
 * This file contains API-specific types for request/response handling.
 * Domain models are imported from the generated database types.
 */

/**
 * API response wrapper for consistent backend communication
 */
export interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
  error?: ApiError;
}

/**
 * API error structure from backend
 */
export interface ApiError {
  message: string;
  code?: string;
  field?: string;
  detail?: unknown;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Common query parameters
 */
export interface QueryParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

/**
 * Request configuration options
 */
export interface RequestOptions extends RequestInit {
  /**
   * Skip auth token attachment
   */
  skipAuth?: boolean;
  /**
   * Custom timeout in milliseconds
   */
  timeout?: number;
  /**
   * Retry configuration
   */
  retry?: {
    count: number;
    delay: number;
  };
}

/**
 * HTTP methods
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * API endpoint configuration
 */
export interface EndpointConfig {
  path: string;
  method: HttpMethod;
  requiresAuth?: boolean;
}
