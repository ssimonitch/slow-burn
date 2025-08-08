/**
 * Simple error classes for type-safe error handling
 *
 * These classes extend the native Error class to provide:
 * - Type discrimination for different error types
 * - Additional context properties
 * - Clear error categorization
 *
 * Logging is handled separately via the logger module
 */

/**
 * API-related errors
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly endpoint?: string;
  public readonly code?: string;
  public readonly field?: string;
  public readonly detail?: unknown;

  constructor(message: string, status: number, endpoint?: string, code?: string, field?: string, detail?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.endpoint = endpoint;
    this.code = code;
    this.field = field;
    this.detail = detail;
  }

  /**
   * Check if error is due to authentication
   */
  isAuthError(): boolean {
    return this.status === 401;
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
    if (this.status === 429) {
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

// AuthError is now exported from @/services/auth/auth.service
// This avoids duplication and confusion

/**
 * Validation errors for form inputs and data
 */
export class ValidationError extends Error {
  public readonly field?: string;
  public readonly value?: unknown;
  public readonly rules?: string[];

  constructor(message: string, field?: string, value?: unknown, rules?: string[]) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
    this.rules = rules;
  }
}

/**
 * Storage-related errors (localStorage, IndexedDB, etc.)
 */
export class StorageError extends Error {
  public readonly storageType?: 'localStorage' | 'sessionStorage' | 'indexedDB' | 'cookie';
  public readonly operation?: 'read' | 'write' | 'delete' | 'clear';

  constructor(message: string, storageType?: StorageError['storageType'], operation?: StorageError['operation']) {
    super(message);
    this.name = 'StorageError';
    this.storageType = storageType;
    this.operation = operation;
  }
}

/**
 * PWA-related errors (service worker, offline, etc.)
 */
export class PWAError extends Error {
  public readonly type?: 'service-worker' | 'offline' | 'cache' | 'sync';

  constructor(message: string, type?: PWAError['type']) {
    super(message);
    this.name = 'PWAError';
    this.type = type;
  }
}

/**
 * Type guard to check if an error is one of our custom error types
 */
export function isAppError(error: unknown): error is ApiError | ValidationError | StorageError | PWAError {
  return (
    error instanceof ApiError ||
    error instanceof ValidationError ||
    error instanceof StorageError ||
    error instanceof PWAError
  );
}

/**
 * Type guard for specific error types
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

// Re-export isAuthError utility to work with AuthError from auth.service
export { isAuthError } from '@/services/auth/auth.service';

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function isStorageError(error: unknown): error is StorageError {
  return error instanceof StorageError;
}

export function isPWAError(error: unknown): error is PWAError {
  return error instanceof PWAError;
}

/**
 * Extract a user-friendly message from any error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.getUserMessage();
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'An unexpected error occurred';
}
