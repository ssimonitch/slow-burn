/**
 * API configuration constants
 */

import { appConfig } from '@/config/env';

/**
 * API base URL configuration
 * Defaults to localhost:8000 for development if not specified
 */
export const API_BASE_URL = appConfig.apiBaseUrl ?? 'http://localhost:8000';

/**
 * API version prefix
 */
export const API_VERSION = '/api/v1';

/**
 * Full API URL with version
 */
export const API_URL = `${API_BASE_URL}${API_VERSION}`;

/**
 * Default request timeout in milliseconds
 */
export const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * Default pagination limits
 */
export const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

/**
 * HTTP status codes for consistent error handling
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Content types
 */
export const CONTENT_TYPES = {
  JSON: 'application/json',
  FORM_DATA: 'multipart/form-data',
} as const;
