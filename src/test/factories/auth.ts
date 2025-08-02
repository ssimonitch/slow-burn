/**
 * Shared test helpers for authentication-related tests
 *
 * These utilities help create properly typed mock objects for:
 * - Supabase User objects
 * - Supabase Session objects
 * - Supabase AuthError objects
 *
 * Used across both unit and integration tests to maintain consistency
 * and avoid code duplication.
 */

import type { AuthError as SupabaseAuthError, Session, User } from '@supabase/supabase-js';

/**
 * Creates a mock Supabase User object with sensible defaults
 * @param overrides - Partial User object to override default values
 * @returns Fully typed User object
 */
export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: overrides.id ?? 'test-user-id',
    app_metadata: overrides.app_metadata ?? {},
    user_metadata: overrides.user_metadata ?? {},
    aud: overrides.aud ?? 'authenticated',
    created_at: overrides.created_at ?? '2024-01-01T00:00:00Z',
    email: overrides.email ?? 'test@example.com',
    ...overrides,
  };
}

/**
 * Creates a mock Supabase Session object with sensible defaults
 * @param overrides - Partial Session object to override default values
 * @returns Fully typed Session object
 */
export function createMockSession(overrides: Partial<Session> = {}): Session {
  // Allow overriding the user within the session
  const mockUser = overrides.user ?? createMockUser();

  return {
    access_token: overrides.access_token ?? 'test-access-token',
    refresh_token: overrides.refresh_token ?? 'test-refresh-token',
    expires_in: overrides.expires_in ?? 3600,
    token_type: overrides.token_type ?? 'bearer',
    user: mockUser,
    ...overrides,
  };
}

/**
 * Creates a mock Supabase AuthError object
 * @param overrides - Partial SupabaseAuthError object to override default values
 * @returns Properly typed SupabaseAuthError object
 */
export function createMockSupabaseError(overrides: Partial<SupabaseAuthError> = {}): SupabaseAuthError {
  return {
    message: overrides.message ?? 'Authentication error',
    name: overrides.name ?? 'AuthApiError',
    ...overrides,
  } as SupabaseAuthError;
}
