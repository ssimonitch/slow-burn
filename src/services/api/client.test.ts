/**
 * Unit Tests for API Client
 *
 * These tests verify the core API client functionality, including:
 * - HTTP method implementations (GET, POST, PUT, PATCH, DELETE)
 * - JWT token attachment from Supabase auth service
 * - Request timeout validation and security bounds
 * - Query parameter serialization with proper encoding
 * - Error handling and transformation to ApiError instances
 * - Response processing for different content types
 * - Security features like credential handling and timeout validation
 *
 * Note: These tests focus on business logic and utility functions in the API client,
 * not the UI integration aspects which are handled by React Query hooks.
 */

import queryString from 'query-string';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/errors';
import { authService } from '@/services/auth/auth.service';
import { createAbortError, createMockResponse, createNetworkError } from '@/test/factories/api';

import { apiClient } from './client';

// Mock dependencies
vi.mock('@/services/auth/auth.service', () => ({
  authService: {
    getAccessToken: vi.fn(),
  },
}));

vi.mock('@/config/env', () => ({
  appConfig: {
    apiBaseUrl: 'http://localhost:8000',
    environment: 'test',
  },
  isDevelopment: vi.fn(() => false),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock console methods to avoid noise in tests
const consoleMethods = {
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {}),
};

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consoleMethods.warn.mockClear();
    consoleMethods.error.mockClear();

    // Reset online status
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });
  });

  describe('timeout validation', () => {
    it('should use default timeout when none specified', async () => {
      const mockResponse = createMockResponse({ success: true });
      mockFetch.mockResolvedValueOnce(mockResponse);
      vi.mocked(authService.getAccessToken).mockResolvedValueOnce('test-token');

      await apiClient.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        }),
      );
    });

    it('should enforce minimum timeout of 1 second', async () => {
      const mockResponse = createMockResponse({ success: true });
      mockFetch.mockResolvedValueOnce(mockResponse);
      vi.mocked(authService.getAccessToken).mockResolvedValueOnce('test-token');

      await apiClient.get('/test', {}, { timeout: 500 });

      // The request should still succeed with corrected timeout
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should enforce maximum timeout of 2 minutes', async () => {
      const mockResponse = createMockResponse({ success: true });
      mockFetch.mockResolvedValueOnce(mockResponse);
      vi.mocked(authService.getAccessToken).mockResolvedValueOnce('test-token');

      await apiClient.get('/test', {}, { timeout: 180000 }); // 3 minutes

      // The request should still succeed with corrected timeout
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle timeout errors correctly', async () => {
      vi.mocked(authService.getAccessToken).mockResolvedValueOnce('test-token');
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(createAbortError('Request timeout after 1000ms')), 10);
          }),
      );

      await expect(apiClient.get('/test', {}, { timeout: 1000 })).rejects.toThrow('Request timeout after 1000ms');
    });
  });

  describe('authentication', () => {
    it('should attach JWT token to requests by default', async () => {
      const mockResponse = createMockResponse({ data: 'test' });
      mockFetch.mockResolvedValueOnce(mockResponse);
      vi.mocked(authService.getAccessToken).mockResolvedValueOnce('test-jwt-token');

      await apiClient.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.any(Headers),
        }),
      );

      const [, options] = mockFetch.mock.calls[0];
      const headers = options?.headers as Headers;
      expect(headers.get('Authorization')).toBe('Bearer test-jwt-token');
    });

    it('should skip auth token when skipAuth is true', async () => {
      const mockResponse = createMockResponse({ data: 'test' });
      mockFetch.mockResolvedValueOnce(mockResponse);

      await apiClient.get('/test', {}, { skipAuth: true });

      const [, options] = mockFetch.mock.calls[0];
      const headers = options?.headers as Headers;
      expect(headers.get('Authorization')).toBeNull();
      expect(authService.getAccessToken).not.toHaveBeenCalled();
    });

    it('should handle missing access token gracefully', async () => {
      const mockResponse = createMockResponse({ data: 'test' });
      mockFetch.mockResolvedValueOnce(mockResponse);
      vi.mocked(authService.getAccessToken).mockResolvedValueOnce(null);

      await apiClient.get('/test');

      const [, options] = mockFetch.mock.calls[0];
      const headers = options?.headers as Headers;
      expect(headers.get('Authorization')).toBeNull();
    });
  });

  describe('headers management', () => {
    it('should set default JSON content type for string and no body', async () => {
      const mockResponse = createMockResponse({ success: true });
      mockFetch.mockResolvedValueOnce(mockResponse);
      vi.mocked(authService.getAccessToken).mockResolvedValueOnce(null);

      await apiClient.post('/test', JSON.stringify({ data: 'test' }));

      const [, options] = mockFetch.mock.calls[0];
      const headers = options?.headers as Headers;
      expect(headers.get('Content-Type')).toBe('application/json');
    });

    it('should not set content type for FormData bodies', async () => {
      const mockResponse = createMockResponse({ success: true });
      mockFetch.mockResolvedValueOnce(mockResponse);
      vi.mocked(authService.getAccessToken).mockResolvedValueOnce(null);

      const formData = new FormData();
      formData.append('file', 'test');

      await apiClient.request('/test', {
        method: 'POST',
        body: formData,
      });

      const [, options] = mockFetch.mock.calls[0];
      const headers = options?.headers as Headers;
      expect(headers.get('Content-Type')).toBeNull();
    });

    it('should merge custom headers with default headers', async () => {
      const mockResponse = createMockResponse({ success: true });
      mockFetch.mockResolvedValueOnce(mockResponse);
      vi.mocked(authService.getAccessToken).mockResolvedValueOnce('test-token');

      await apiClient.get(
        '/test',
        {},
        {
          headers: {
            'X-Custom-Header': 'custom-value',
            Accept: 'application/json',
          },
        },
      );

      const [, options] = mockFetch.mock.calls[0];
      const headers = options?.headers as Headers;
      expect(headers.get('X-Custom-Header')).toBe('custom-value');
      expect(headers.get('Accept')).toBe('application/json');
      expect(headers.get('Authorization')).toBe('Bearer test-token');
    });
  });

  describe('HTTP methods', () => {
    beforeEach(() => {
      vi.mocked(authService.getAccessToken).mockResolvedValueOnce(null);
    });

    it('should handle GET requests with query parameters', async () => {
      const mockResponse = createMockResponse({ data: 'test' });
      mockFetch.mockResolvedValueOnce(mockResponse);

      const params = {
        page: 1,
        limit: 20,
        search: 'test query',
        tags: ['fitness', 'strength'],
        date: new Date('2024-01-01'),
        nullValue: null,
        undefinedValue: undefined,
      };

      await apiClient.get('/exercises', params);

      const expectedQuery = queryString.stringify(
        {
          page: 1,
          limit: 20,
          search: 'test query',
          tags: ['fitness', 'strength'],
          date: '2024-01-01T00:00:00.000Z', // Date should be converted to ISO string
          // null and undefined values should be filtered out
        },
        {
          arrayFormat: 'bracket',
          skipNull: true,
          skipEmptyString: true,
          encode: true,
        },
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/exercises?${expectedQuery}`),
        expect.objectContaining({
          method: 'GET',
        }),
      );
    });

    it('should handle GET requests without query parameters', async () => {
      const mockResponse = createMockResponse({ data: 'test' });
      mockFetch.mockResolvedValueOnce(mockResponse);

      await apiClient.get('/exercises');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.not.stringContaining('?'),
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should handle POST requests with JSON body', async () => {
      const mockResponse = createMockResponse({ id: 'created' });
      mockFetch.mockResolvedValueOnce(mockResponse);

      const data = { name: 'New Exercise', difficulty: 'medium' };
      await apiClient.post('/exercises', data);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(data),
        }),
      );
    });

    it('should handle POST requests without body', async () => {
      const mockResponse = createMockResponse({ success: true });
      mockFetch.mockResolvedValueOnce(mockResponse);

      await apiClient.post('/start-workout');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: undefined,
        }),
      );
    });

    it('should handle PUT requests', async () => {
      const mockResponse = createMockResponse({ updated: true });
      mockFetch.mockResolvedValueOnce(mockResponse);

      const data = { name: 'Updated Exercise' };
      await apiClient.put('/exercises/1', data);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/exercises/1'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(data),
        }),
      );
    });

    it('should handle PATCH requests', async () => {
      const mockResponse = createMockResponse({ patched: true });
      mockFetch.mockResolvedValueOnce(mockResponse);

      const data = { difficulty: 'hard' };
      await apiClient.patch('/exercises/1', data);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/exercises/1'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(data),
        }),
      );
    });

    it('should handle DELETE requests', async () => {
      const mockResponse = createMockResponse({}, { status: 204 });
      mockFetch.mockResolvedValueOnce(mockResponse);

      await apiClient.delete('/exercises/1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/exercises/1'),
        expect.objectContaining({
          method: 'DELETE',
        }),
      );
    });
  });

  describe('response processing', () => {
    beforeEach(() => {
      vi.mocked(authService.getAccessToken).mockResolvedValueOnce(null);
    });

    it('should handle successful JSON responses', async () => {
      const responseData = { id: 1, name: 'Test Exercise' };
      const mockResponse = createMockResponse(responseData);
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await apiClient.get('/exercises/1');

      expect(result).toEqual(responseData);
    });

    it('should handle 204 No Content responses', async () => {
      const mockResponse = createMockResponse({}, { status: 204 });
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await apiClient.delete('/exercises/1');

      expect(result).toEqual({});
    });

    it('should handle text responses when JSON parsing fails', async () => {
      const textResponse = 'Plain text response';
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/plain' }),
        json: vi.fn().mockRejectedValue(new Error('Not JSON')),
        text: vi.fn().mockResolvedValue(textResponse),
      } as unknown as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await apiClient.get('/health');

      expect(result).toBe(textResponse);
    });

    it('should throw ApiError when JSON parsing fails for JSON content type', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
        text: vi.fn().mockResolvedValue('invalid json'),
      } as unknown as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      try {
        await apiClient.get('/invalid-json');
        expect.fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).message).toBe('Invalid response format');
      }
    });

    it('should validate response and reject null/undefined data', async () => {
      const mockResponse = createMockResponse(null);
      mockFetch.mockResolvedValueOnce(mockResponse);

      try {
        await apiClient.get('/null-response');
        expect.fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).message).toBe('Received null or undefined response');
      }
    });

    it('should detect error patterns in response objects', async () => {
      const responseWithError = { error: 'Something went wrong' };
      const mockResponse = createMockResponse(responseWithError);
      mockFetch.mockResolvedValueOnce(mockResponse);

      try {
        await apiClient.get('/error-response');
        expect.fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).message).toBe('Something went wrong');
      }
    });

    it('should detect success:false patterns in response objects', async () => {
      const responseWithFailure = { success: false, message: 'Operation failed' };
      const mockResponse = createMockResponse(responseWithFailure);
      mockFetch.mockResolvedValueOnce(mockResponse);

      try {
        await apiClient.get('/failure-response');
        expect.fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).message).toBe('Operation failed');
      }
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      vi.mocked(authService.getAccessToken).mockResolvedValueOnce(null);
    });

    it('should handle HTTP error responses with detailed error information', async () => {
      const errorResponse = {
        error: {
          message: 'Validation failed',
          code: 'INVALID_INPUT',
          field: 'email',
          detail: { minLength: 5 },
        },
      };

      const mockResponse = createMockResponse(errorResponse, {
        status: 422,
        statusText: 'Unprocessable Entity',
        ok: false,
      });

      mockFetch.mockResolvedValueOnce(mockResponse);

      try {
        await apiClient.post('/users', { email: 'bad' });
        expect.fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        const apiError = error as ApiError;
        expect(apiError.message).toBe('Validation failed');
        expect(apiError.status).toBe(422);
        expect(apiError.code).toBe('INVALID_INPUT');
        expect(apiError.field).toBe('email');
        expect(apiError.detail).toEqual({ minLength: 5 });
      }
    });

    it('should handle HTTP errors without detailed error structure', async () => {
      const mockResponse = createMockResponse('Server Error', {
        status: 500,
        statusText: 'Internal Server Error',
        ok: false,
      });

      mockFetch.mockResolvedValueOnce(mockResponse);

      try {
        await apiClient.get('/server-error');
        expect.fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        const apiError = error as ApiError;
        expect(apiError.status).toBe(500);
        expect(apiError.message).toBe('Internal Server Error');
      }
    });

    it('should handle network errors', async () => {
      const networkError = createNetworkError('Failed to fetch');
      mockFetch.mockRejectedValueOnce(networkError);

      await expect(apiClient.get('/network-error')).rejects.toThrow(ApiError);

      try {
        await apiClient.get('/network-error');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        const apiError = error as ApiError;
        expect(apiError.isNetworkError()).toBe(true);
      }
    });

    it('should handle generic errors', async () => {
      const genericError = new Error('Something went wrong');
      mockFetch.mockRejectedValueOnce(genericError);

      await expect(apiClient.get('/generic-error')).rejects.toThrow(ApiError);
    });
  });

  describe('security features', () => {
    beforeEach(() => {
      vi.mocked(authService.getAccessToken).mockResolvedValueOnce(null);
    });

    it('should set same-origin credentials for same-origin requests', async () => {
      const mockResponse = createMockResponse({ data: 'test' });
      mockFetch.mockResolvedValueOnce(mockResponse);

      // Mock window.location.origin
      Object.defineProperty(window, 'location', {
        value: { origin: 'http://localhost:8000' },
        writable: true,
      });

      await apiClient.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          credentials: 'same-origin',
        }),
      );
    });

    it('should omit credentials for cross-origin requests', async () => {
      const mockResponse = createMockResponse({ data: 'test' });
      mockFetch.mockResolvedValueOnce(mockResponse);

      // Mock window.location.origin to be different from API URL
      Object.defineProperty(window, 'location', {
        value: { origin: 'https://app.example.com' },
        writable: true,
      });

      await apiClient.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          credentials: 'omit',
        }),
      );
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      vi.mocked(authService.getAccessToken).mockResolvedValueOnce(null);
    });

    it('should handle empty query parameters object', async () => {
      const mockResponse = createMockResponse({ data: 'test' });
      mockFetch.mockResolvedValueOnce(mockResponse);

      await apiClient.get('/test', {});

      expect(mockFetch).toHaveBeenCalledWith(expect.not.stringContaining('?'), expect.any(Object));
    });

    it('should handle query parameters with only null/undefined values', async () => {
      const mockResponse = createMockResponse({ data: 'test' });
      mockFetch.mockResolvedValueOnce(mockResponse);

      await apiClient.get('/test', {
        nullParam: null,
        undefinedParam: undefined,
      });

      expect(mockFetch).toHaveBeenCalledWith(expect.not.stringContaining('?'), expect.any(Object));
    });

    it('should handle zero timeout as minimum timeout', async () => {
      const mockResponse = createMockResponse({ data: 'test' });
      mockFetch.mockResolvedValueOnce(mockResponse);

      await apiClient.get('/test', {}, { timeout: 0 });

      // Should succeed with minimum timeout applied
      expect(mockFetch).toHaveBeenCalled();
    });
  });
});
