/**
 * API error handling utilities
 *
 * This module handles API-specific error scenarios and integrates
 * with the centralized logging system for error tracking.
 */

import { ApiError } from '@/lib/errors';
import { logError, logWarn } from '@/lib/logger';

import { HTTP_STATUS } from './config';

/**
 * Handle API errors and log them
 *
 * This function:
 * 1. Converts various error types to ApiError
 * 2. Logs the error with appropriate context
 * 3. Returns the error for upstream handling
 */
export function handleApiError(error: unknown, endpoint?: string, context?: Record<string, unknown>): ApiError {
  // Already an ApiError
  if (error instanceof ApiError) {
    logApiError(error, context);
    return error;
  }

  // Network/fetch errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    const apiError = new ApiError('Network request failed', 0, endpoint);
    logApiError(apiError, context);
    return apiError;
  }

  // Generic errors
  const message = error instanceof Error ? error.message : 'Unknown error occurred';
  const apiError = new ApiError(message, 0, endpoint);
  logApiError(apiError, context);
  return apiError;
}

/**
 * Log API error with appropriate severity
 * The centralized logger handles any necessary sanitization
 */
function logApiError(error: ApiError, context?: Record<string, unknown>): void {
  const errorContext = {
    status: error.status,
    endpoint: error.endpoint,
    code: error.code,
    field: error.field,
    ...context,
  };

  // Determine log level based on error type
  if (error.isNetworkError()) {
    logError('Network error occurred', error, errorContext);
  } else if (error.isAuthError()) {
    logWarn('Authentication error', errorContext);
  } else if (error.status === HTTP_STATUS.TOO_MANY_REQUESTS) {
    logWarn('Rate limit exceeded', errorContext);
  } else if (error.isServerError()) {
    logError('Server error', error, errorContext);
  } else if (error.isClientError()) {
    logWarn('Client error', errorContext);
  } else {
    logError('API error', error, errorContext);
  }
}
