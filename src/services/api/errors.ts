import { ErrorCategory, errorReporter, ErrorSeverity, type ErrorSeverityType } from '@/lib/errors';

import { HTTP_STATUS } from './config';
import type { ApiError } from './types';

/**
 * API-specific error class
 */
export class ApiClientError extends Error {
  public status: number;
  public code?: string;
  public field?: string;
  public detail?: unknown;
  public endpoint?: string;

  constructor(message: string, status: number, endpoint?: string, apiError?: ApiError) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.endpoint = endpoint;

    if (apiError) {
      this.code = apiError.code;
      this.field = apiError.field;
      this.detail = apiError.detail;
    }
  }

  /**
   * Check if error is due to authentication
   */
  isAuthError(): boolean {
    return this.status === HTTP_STATUS.UNAUTHORIZED;
  }

  /**
   * Check if error is due to network issues
   */
  isNetworkError(): boolean {
    return this.status === 0 || !navigator.onLine;
  }

  /**
   * Check if error is a client error (4xx)
   */
  isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  /**
   * Check if error is a server error (5xx)
   */
  isServerError(): boolean {
    return this.status >= 500;
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    // Network errors
    if (this.isNetworkError()) {
      return 'Unable to connect to the server. Please check your internet connection.';
    }

    // Auth errors
    if (this.isAuthError()) {
      return 'Your session has expired. Please sign in again.';
    }

    // Rate limiting
    if (this.status === HTTP_STATUS.TOO_MANY_REQUESTS) {
      return 'Too many requests. Please try again in a few moments.';
    }

    // Server errors
    if (this.isServerError()) {
      return 'Something went wrong on our end. Please try again later.';
    }

    // Default to the error message
    return this.message || 'An unexpected error occurred';
  }
}

/**
 * Handle API errors and report them
 */
export function handleApiError(error: unknown, endpoint?: string, context?: Record<string, unknown>): ApiClientError {
  // Already an ApiClientError
  if (error instanceof ApiClientError) {
    reportApiError(error, context);
    return error;
  }

  // Network/fetch errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    const apiError = new ApiClientError('Network request failed', 0, endpoint);
    reportApiError(apiError, context);
    return apiError;
  }

  // Generic errors
  const message = error instanceof Error ? error.message : 'Unknown error occurred';
  const apiError = new ApiClientError(message, 0, endpoint);
  reportApiError(apiError, context);
  return apiError;
}

/**
 * SECURITY FIX: Sanitize sensitive data from error context
 *
 * Why this is critical:
 * - Error logs might be sent to third-party services (Sentry, LogRocket, etc.)
 * - Context objects might contain auth tokens, passwords, or PII
 * - Leaked tokens can be used to impersonate users
 *
 * This fix:
 * - Removes common sensitive fields from error context
 * - Redacts authorization headers and tokens
 * - Preserves useful debugging info while protecting user data
 */
function sanitizeErrorContext(context?: Record<string, unknown>): Record<string, unknown> {
  if (!context) return {};

  const sanitized: Record<string, unknown> = {};
  const sensitiveKeys = [
    'password',
    'token',
    'authorization',
    'auth',
    'secret',
    'apikey',
    'api_key',
    'access_token',
    'refresh_token',
    'session',
    'cookie',
    'credit_card',
    'ssn',
    'pin',
  ];

  for (const [key, value] of Object.entries(context)) {
    const lowerKey = key.toLowerCase();

    // Check if key contains sensitive words
    if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    // Recursively sanitize nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeErrorContext(value as Record<string, unknown>);
    } else if (typeof value === 'string') {
      // Check if value looks like a token (JWT or similar)
      if (value.startsWith('eyJ') || value.length > 100) {
        sanitized[key] = '[REDACTED_TOKEN]';
      } else {
        sanitized[key] = value;
      }
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Report API error to the error reporting system
 */
function reportApiError(error: ApiClientError, context?: Record<string, unknown>): void {
  const severity = getSeverityForStatus(error.status);
  const category = error.isAuthError() ? ErrorCategory.AUTH : ErrorCategory.NETWORK;

  // Sanitize context to remove sensitive data before reporting
  const sanitizedContext = sanitizeErrorContext({
    status: error.status,
    endpoint: error.endpoint,
    code: error.code,
    field: error.field,
    ...context,
  });

  errorReporter.reportError(error.getUserMessage(), category, severity, error, sanitizedContext);
}

/**
 * Get error severity based on HTTP status
 */
function getSeverityForStatus(status: number): ErrorSeverityType {
  if (status === 0) return ErrorSeverity.HIGH; // Network errors
  if (status === HTTP_STATUS.UNAUTHORIZED) return ErrorSeverity.MEDIUM;
  if (status === HTTP_STATUS.TOO_MANY_REQUESTS) return ErrorSeverity.LOW;
  if (status >= 500) return ErrorSeverity.HIGH;
  if (status >= 400) return ErrorSeverity.MEDIUM;
  return ErrorSeverity.LOW;
}
