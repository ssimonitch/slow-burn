/**
 * Unit Tests for API Error Handling
 *
 * These tests verify the API error handling utilities, including:
 * - Error classification methods (isAuthError, isNetworkError, etc.)
 * - User-friendly error message generation
 * - Error transformation from various sources to ApiError instances
 * - Error logging integration with appropriate severity levels
 * - Proper handling of different error scenarios (network, auth, server, client)
 *
 * Note: These tests focus on the business logic of error processing and classification,
 * not the UI presentation of errors which is handled by components.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/errors';
import { logError, logWarn } from '@/lib/logger';
import { createMockApiError, createNetworkError } from '@/test/factories/api';

import { HTTP_STATUS } from './config';
import { handleApiError } from './errors';

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

describe('API Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleApiError function', () => {
    it('should return existing ApiError instances unchanged', () => {
      const originalError = createMockApiError('Test error', HTTP_STATUS.BAD_REQUEST, '/test');

      const result = handleApiError(originalError, '/test');

      expect(result).toBe(originalError);
      expect(logWarn).toHaveBeenCalledWith(
        'Client error',
        expect.objectContaining({
          status: HTTP_STATUS.BAD_REQUEST,
          endpoint: '/test',
        }),
      );
    });

    it('should convert network errors to ApiError with status 0', () => {
      const networkError = createNetworkError('Failed to fetch');

      const result = handleApiError(networkError, '/test');

      expect(result).toBeInstanceOf(ApiError);
      expect(result.status).toBe(0);
      expect(result.endpoint).toBe('/test');
      expect(result.message).toBe('Network request failed');
      expect(logError).toHaveBeenCalledWith(
        'Network error occurred',
        result,
        expect.objectContaining({
          endpoint: '/test',
        }),
      );
    });

    it('should detect TypeError with fetch message as network error', () => {
      const fetchError = new TypeError('NetworkError: fetch failed');

      const result = handleApiError(fetchError, '/api/users');

      expect(result.message).toBe('Network request failed');
      expect(result.isNetworkError()).toBe(true);
    });

    it('should convert generic errors to ApiError', () => {
      const genericError = new Error('Something unexpected happened');

      const result = handleApiError(genericError, '/test');

      expect(result).toBeInstanceOf(ApiError);
      expect(result.message).toBe('Something unexpected happened');
      expect(result.status).toBe(0);
      expect(result.endpoint).toBe('/test');
    });

    it('should handle non-Error objects', () => {
      const stringError = 'String error message';

      const result = handleApiError(stringError, '/test');

      expect(result).toBeInstanceOf(ApiError);
      // The error handling converts non-Error objects to "Unknown error occurred"
      expect(result.message).toBe('Unknown error occurred');
      expect(result.status).toBe(0);

      // Since status is 0, it should be logged as a network error
      expect(logError).toHaveBeenCalledWith(
        'Network error occurred',
        result,
        expect.objectContaining({
          endpoint: '/test',
        }),
      );
    });

    it('should handle null/undefined errors', () => {
      const result = handleApiError(null, '/test');

      expect(result).toBeInstanceOf(ApiError);
      expect(result.message).toBe('Unknown error occurred');
    });

    it('should include additional context in error logs', () => {
      const error = createMockApiError('Test error', HTTP_STATUS.INTERNAL_SERVER_ERROR);
      const context = { userId: 'test-123', action: 'fetch-profile' };

      handleApiError(error, '/users/me', context);

      expect(logError).toHaveBeenCalledWith(
        'Server error',
        error,
        expect.objectContaining({
          status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
          userId: 'test-123',
          action: 'fetch-profile',
        }),
      );
    });
  });

  describe('error classification and logging', () => {
    it('should log auth errors as warnings', () => {
      const authError = createMockApiError('Unauthorized', HTTP_STATUS.UNAUTHORIZED, '/protected');

      handleApiError(authError);

      expect(logWarn).toHaveBeenCalledWith(
        'Authentication error',
        expect.objectContaining({
          status: HTTP_STATUS.UNAUTHORIZED,
        }),
      );
    });

    it('should log rate limit errors as warnings', () => {
      const rateLimitError = createMockApiError('Too many requests', HTTP_STATUS.TOO_MANY_REQUESTS, '/api');

      handleApiError(rateLimitError);

      expect(logWarn).toHaveBeenCalledWith(
        'Rate limit exceeded',
        expect.objectContaining({
          status: HTTP_STATUS.TOO_MANY_REQUESTS,
        }),
      );
    });

    it('should log server errors with high severity', () => {
      const serverError = createMockApiError('Internal error', HTTP_STATUS.INTERNAL_SERVER_ERROR, '/api');

      handleApiError(serverError);

      expect(logError).toHaveBeenCalledWith(
        'Server error',
        serverError,
        expect.objectContaining({
          status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        }),
      );
    });

    it('should log client errors as warnings', () => {
      const clientError = createMockApiError('Bad request', HTTP_STATUS.BAD_REQUEST, '/api');

      handleApiError(clientError);

      expect(logWarn).toHaveBeenCalledWith(
        'Client error',
        expect.objectContaining({
          status: HTTP_STATUS.BAD_REQUEST,
        }),
      );
    });

    it('should log unknown errors with error severity', () => {
      // Use a status that doesn't match any specific error category (not 0, not 4xx, not 5xx, not 401, not 429)
      // Status 600 is >= 500 so it's a server error, let's use 300
      const unknownError = createMockApiError('Unknown', 300, '/api');

      handleApiError(unknownError);

      expect(logError).toHaveBeenCalledWith(
        'API error',
        unknownError,
        expect.objectContaining({
          status: 300,
        }),
      );
    });
  });

  describe('ApiError class methods', () => {
    describe('isAuthError', () => {
      it('should return true for 401 status', () => {
        const error = createMockApiError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
        expect(error.isAuthError()).toBe(true);
      });

      it('should return false for non-401 status', () => {
        const error = createMockApiError('Bad request', HTTP_STATUS.BAD_REQUEST);
        expect(error.isAuthError()).toBe(false);
      });
    });

    describe('isNetworkError', () => {
      it('should return true for status 0', () => {
        const error = createMockApiError('Network error', 0);
        expect(error.isNetworkError()).toBe(true);
      });

      it('should return true when navigator.onLine is false', () => {
        Object.defineProperty(navigator, 'onLine', {
          writable: true,
          value: false,
        });

        const error = createMockApiError('Some error', HTTP_STATUS.BAD_REQUEST);
        expect(error.isNetworkError()).toBe(true);

        // Reset
        Object.defineProperty(navigator, 'onLine', {
          writable: true,
          value: true,
        });
      });

      it('should return false for normal status with online connection', () => {
        const error = createMockApiError('Server error', HTTP_STATUS.INTERNAL_SERVER_ERROR);
        expect(error.isNetworkError()).toBe(false);
      });
    });

    describe('isClientError', () => {
      it('should return true for 4xx status codes', () => {
        const badRequest = createMockApiError('Bad request', HTTP_STATUS.BAD_REQUEST);
        const notFound = createMockApiError('Not found', HTTP_STATUS.NOT_FOUND);
        const unprocessable = createMockApiError('Validation error', HTTP_STATUS.UNPROCESSABLE_ENTITY);

        expect(badRequest.isClientError()).toBe(true);
        expect(notFound.isClientError()).toBe(true);
        expect(unprocessable.isClientError()).toBe(true);
      });

      it('should return false for non-4xx status codes', () => {
        const success = createMockApiError('Success', HTTP_STATUS.OK);
        const serverError = createMockApiError('Server error', HTTP_STATUS.INTERNAL_SERVER_ERROR);
        const networkError = createMockApiError('Network error', 0);

        expect(success.isClientError()).toBe(false);
        expect(serverError.isClientError()).toBe(false);
        expect(networkError.isClientError()).toBe(false);
      });
    });

    describe('isServerError', () => {
      it('should return true for 5xx status codes', () => {
        const internalError = createMockApiError('Internal error', HTTP_STATUS.INTERNAL_SERVER_ERROR);
        const serviceError = createMockApiError('Service error', HTTP_STATUS.SERVICE_UNAVAILABLE);

        expect(internalError.isServerError()).toBe(true);
        expect(serviceError.isServerError()).toBe(true);
      });

      it('should return false for non-5xx status codes', () => {
        const clientError = createMockApiError('Bad request', HTTP_STATUS.BAD_REQUEST);
        const networkError = createMockApiError('Network error', 0);

        expect(clientError.isServerError()).toBe(false);
        expect(networkError.isServerError()).toBe(false);
      });
    });

    describe('getUserMessage', () => {
      it('should return network message for network errors', () => {
        const networkError = createMockApiError('Fetch failed', 0);
        expect(networkError.getUserMessage()).toBe(
          'Unable to connect to the server. Please check your internet connection.',
        );
      });

      it('should return auth message for auth errors', () => {
        const authError = createMockApiError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
        expect(authError.getUserMessage()).toBe('Your session has expired. Please sign in again.');
      });

      it('should return rate limit message for 429 errors', () => {
        const rateLimitError = createMockApiError('Too many requests', HTTP_STATUS.TOO_MANY_REQUESTS);
        expect(rateLimitError.getUserMessage()).toBe('Too many requests. Please try again in a few moments.');
      });

      it('should return server error message for server errors', () => {
        const serverError = createMockApiError('Internal error', HTTP_STATUS.INTERNAL_SERVER_ERROR);
        expect(serverError.getUserMessage()).toBe('Something went wrong on our end. Please try again later.');
      });

      it('should return original message for other errors', () => {
        const validationError = createMockApiError('Email is required', HTTP_STATUS.BAD_REQUEST);
        expect(validationError.getUserMessage()).toBe('Email is required');
      });

      it('should return fallback message for empty message', () => {
        const emptyError = createMockApiError('', HTTP_STATUS.BAD_REQUEST);
        expect(emptyError.getUserMessage()).toBe('An unexpected error occurred');
      });
    });
  });

  describe('error context logging', () => {
    it('should include all error properties in log context', () => {
      const error = createMockApiError(
        'Validation failed',
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        '/users',
        'INVALID_EMAIL',
        'email',
        { pattern: 'email' },
      );

      handleApiError(error);

      expect(logWarn).toHaveBeenCalledWith(
        'Client error',
        expect.objectContaining({
          status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
          endpoint: '/users',
          code: 'INVALID_EMAIL',
          field: 'email',
        }),
      );
    });

    it('should merge provided context with error context', () => {
      const error = createMockApiError('Server error', HTTP_STATUS.INTERNAL_SERVER_ERROR, '/api');
      const additionalContext = {
        requestId: 'req-123',
        timestamp: new Date().toISOString(),
        userId: 'user-456',
      };

      handleApiError(error, '/api', additionalContext);

      expect(logError).toHaveBeenCalledWith(
        'Server error',
        error,
        expect.objectContaining({
          status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
          endpoint: '/api',
          requestId: 'req-123',
          timestamp: expect.any(String),
          userId: 'user-456',
        }),
      );
    });

    it('should handle missing error properties gracefully', () => {
      const minimalError = new ApiError('Basic error', HTTP_STATUS.BAD_REQUEST);

      handleApiError(minimalError);

      expect(logWarn).toHaveBeenCalledWith(
        'Client error',
        expect.objectContaining({
          status: HTTP_STATUS.BAD_REQUEST,
          endpoint: undefined,
          code: undefined,
          field: undefined,
        }),
      );
    });
  });

  describe('edge cases', () => {
    it('should handle errors with circular references in detail', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing edge case with circular reference
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;

      const error = createMockApiError('Error', HTTP_STATUS.BAD_REQUEST, '/api', 'TEST', 'field', circularObj);

      // Should not throw when logging
      expect(() => handleApiError(error)).not.toThrow();
    });

    it('should handle errors without endpoint', () => {
      const error = createMockApiError('Error without endpoint', HTTP_STATUS.BAD_REQUEST);

      const result = handleApiError(error);

      expect(result.endpoint).toBeUndefined();
      expect(logWarn).toHaveBeenCalledWith(
        'Client error',
        expect.objectContaining({
          endpoint: undefined,
        }),
      );
    });

    it('should handle extremely long error messages', () => {
      const longMessage = 'Error: ' + 'x'.repeat(10000);
      const error = createMockApiError(longMessage, HTTP_STATUS.BAD_REQUEST);

      const result = handleApiError(error);

      expect(result.message).toBe(longMessage);
      // Logger should handle truncation if needed
    });
  });
});
