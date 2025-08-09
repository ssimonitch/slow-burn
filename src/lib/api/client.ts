/**
 * OpenAPI Client Infrastructure
 *
 * This file provides the complete OpenAPI client setup with:
 * - Type-safe API calls using openapi-fetch
 * - Authentication middleware for JWT token injection
 * - Error handling middleware with user-friendly error reporting
 * - Retry logic with exponential backoff
 * - Network error handling and offline support
 */

import type { Middleware } from 'openapi-fetch';
import createClient from 'openapi-fetch';
import { toast } from 'sonner';

import { logError, logWarn } from '@/lib/logger';
import { API_BASE_URL } from '@/services/api/config';
import { authService } from '@/services/auth/auth.service';
import { useAuthStore } from '@/stores/auth.store';
import type { paths } from '@/types/api.types.gen';

/**
 * Extended options type for middleware to include retry count
 */
interface MiddlewareOptions extends Record<string, unknown> {
  method?: string;
  __retryCount?: number;
}

/**
 * API Error types for consistent error handling
 */
export interface ApiError {
  detail?: string | ValidationError[];
  message?: string;
  code?: string;
}

export interface ValidationError {
  loc: (string | number)[];
  msg: string;
  type: string;
}

export class ApiClientError extends Error {
  status: number;
  data: ApiError;

  constructor(message: string, status: number, data: ApiError) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.data = data;
  }

  isAuthError(): boolean {
    return this.status === 401;
  }

  isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  isServerError(): boolean {
    return this.status >= 500;
  }

  isValidationError(): boolean {
    return this.status === 422;
  }
}

/**
 * Authentication Middleware
 *
 * Automatically injects JWT tokens into all requests and handles token refresh
 */
const authMiddleware: Middleware = {
  async onRequest({ request }) {
    const token = await authService.getAccessToken();
    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`);
    }
    return request;
  },

  async onResponse({ response, request }) {
    // Handle 401 unauthorized responses
    if (response.status === 401) {
      try {
        // Attempt to refresh the session
        const refreshResult = await authService.refreshSession();

        if (refreshResult.data) {
          // Session refreshed successfully, clone and retry the original request
          const newToken = await authService.getAccessToken();
          if (newToken) {
            const clonedRequest = request.clone();
            clonedRequest.headers.set('Authorization', `Bearer ${newToken}`);

            // Return undefined to signal retry with the new request
            return fetch(clonedRequest);
          }
        }

        // Session refresh failed, perform auth recovery
        try {
          const { signOut } = useAuthStore.getState();
          await signOut();
        } catch {
          // ignore sign out errors
        }
        // Redirect to login to prompt re-authentication
        if (typeof window !== 'undefined' && window.location) {
          window.location.assign('/login');
        }

        throw new ApiClientError('Session expired', 401, { message: 'Authentication failed', code: 'SESSION_EXPIRED' });
      } catch (error) {
        // Report auth error for monitoring
        logError(
          'Authentication failed - session could not be refreshed',
          error instanceof Error ? error : new Error(String(error)),
          { status: 401, category: 'AUTH' },
        );

        // Attempt recovery even on unexpected errors
        try {
          const { signOut } = useAuthStore.getState();
          await signOut();
        } catch {
          // ignore
        }
        if (typeof window !== 'undefined' && window.location) {
          window.location.assign('/login');
        }

        throw new ApiClientError('Authentication failed', 401, { message: 'Session expired', code: 'AUTH_FAILED' });
      }
    }

    return response;
  },
};

/**
 * Error Handling Middleware
 *
 * Provides comprehensive error handling with user feedback and error reporting
 */
const errorMiddleware: Middleware = {
  async onResponse({ response, options }) {
    if (!response.ok && response.status >= 400) {
      const error = await parseApiError(response);

      // Report to error tracking system
      if (response.status >= 500) {
        logError('API Error', new Error(`${response.status}: ${error.message ?? response.statusText}`), {
          url: response.url,
          status: response.status,
          method: (options as MiddlewareOptions)?.method ?? 'unknown',
          data: error,
          category: 'NETWORK',
        });
      } else {
        logWarn('API Client Error', {
          url: response.url,
          status: response.status,
          method: (options as MiddlewareOptions)?.method ?? 'unknown',
          data: error,
          category: 'NETWORK',
        });
      }

      // User-friendly error handling
      if (response.status >= 500) {
        toast.error('Something went wrong on our end. Please try again later.');
      } else if (response.status === 422) {
        handleValidationErrors(error);
      } else if (response.status === 429) {
        toast.error('Too many requests. Please wait a moment and try again.');
      } else if (response.status === 404) {
        toast.error('The requested resource was not found.');
      } else if (response.status === 403) {
        toast.error('You do not have permission to perform this action.');
      }
    }

    return response;
  },
};

/**
 * Retry Middleware
 *
 * Implements exponential backoff retry strategy for network and server errors
 */
const retryMiddleware: Middleware = {
  async onResponse({ response, options }) {
    const middlewareOptions = options as MiddlewareOptions;
    const retryCount = middlewareOptions.__retryCount ?? 0;

    // Retry conditions:
    // - Network errors (status 0)
    // - Server errors (5xx)
    // - Rate limiting (429) - special case
    const shouldRetry = (response.status >= 500 || response.status === 0 || response.status === 429) && retryCount < 3;

    if (shouldRetry) {
      // Calculate exponential backoff delay
      let delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s

      // Add jitter to prevent thundering herd
      delay += Math.random() * 1000;

      // Special handling for rate limiting - longer delay
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        if (retryAfter) {
          delay = parseInt(retryAfter, 10) * 1000; // Convert to ms
        } else {
          delay = Math.pow(2, retryCount + 2) * 1000; // Longer backoff for rate limits
        }
      }

      // Wait for the delay
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Clone and retry the request by returning undefined
      // which signals openapi-fetch to retry
      middlewareOptions.__retryCount = retryCount + 1;

      // Return undefined to signal a retry
      return undefined;
    }

    return response;
  },
};

/**
 * Offline Handling Middleware
 *
 * Provides basic offline detection and user feedback
 */
const offlineMiddleware: Middleware = {
  onRequest({ request }) {
    if (!navigator.onLine) {
      toast.error('You appear to be offline. Please check your connection.');
      throw new ApiClientError('Network unavailable', 0, { message: 'No internet connection', code: 'OFFLINE' });
    }
    return request;
  },
};

/**
 * Create the base OpenAPI client with type safety
 */
export const apiClient = createClient<paths>({
  baseUrl: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Apply all middleware in the correct order
 * Order matters: offline check → auth → retry → error handling
 */
apiClient.use(offlineMiddleware);
apiClient.use(authMiddleware);
apiClient.use(retryMiddleware);
apiClient.use(errorMiddleware);

/**
 * Helper function to parse API error responses
 */
async function parseApiError(response: Response): Promise<ApiError> {
  try {
    const contentType = response.headers.get('Content-Type');

    if (contentType?.includes('application/json')) {
      const data = (await response.json()) as ApiError;
      return data;
    }

    // Non-JSON response, use status text
    return {
      message: response.statusText || 'Unknown error',
      code: response.status.toString(),
    };
  } catch {
    // Failed to parse response
    return {
      message: response.statusText || 'Unknown error',
      code: response.status.toString(),
    };
  }
}

/**
 * Handle validation errors with user-friendly messages
 */
function handleValidationErrors(error: ApiError): void {
  if (Array.isArray(error.detail)) {
    // Show the first few validation errors to avoid overwhelming the user
    error.detail.slice(0, 3).forEach((validationError) => {
      const field = validationError.loc.slice(1).join('.'); // Remove 'body' prefix
      const message = validationError.msg;

      // Create user-friendly field names
      const friendlyField = field
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .toLowerCase()
        .replace(/^./, (str) => str.toUpperCase());

      toast.error(`${friendlyField}: ${message}`);
    });

    // If there are more errors, show a summary
    if (error.detail.length > 3) {
      toast.error(`And ${error.detail.length - 3} more validation errors.`);
    }
  } else if (error.message) {
    toast.error(error.message);
  } else {
    toast.error('Please check your input and try again.');
  }
}

/**
 * Export the configured client for use throughout the application
 */
export default apiClient;
