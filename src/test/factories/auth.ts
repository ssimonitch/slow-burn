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

import type { AuthError, SignInCredentials, SignUpCredentials } from '@/services/auth/auth.service';

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

/**
 * Auth store state interface (must match the actual store)
 */
interface AuthState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  loading: {
    init: boolean;
    signIn: boolean;
    signUp: boolean;
    signOut: boolean;
  };
  error: AuthError | null;
  initialized: boolean;
}

/**
 * Auth store actions interface (must match the actual store)
 */
interface AuthActions {
  initialize: () => Promise<void>;
  signIn: (credentials: SignInCredentials) => Promise<void>;
  signUp: (credentials: SignUpCredentials) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  cleanup: () => void;
  _setSession: (session: Session | null) => void;
  _setUser: (user: User | null) => void;
  _setError: (error: AuthError | null) => void;
  _setLoading: (operation: keyof AuthState['loading'], isLoading: boolean) => void;
}

/**
 * Combined auth store type
 */
export type AuthStore = AuthState & AuthActions;

/**
 * Creates a mock AuthState object with sensible defaults
 * @param overrides - Partial AuthState object to override default values
 * @returns Fully typed AuthState object
 */
export function createMockAuthState(overrides: Partial<AuthState> = {}): AuthState {
  return {
    user: overrides.user ?? null,
    session: overrides.session ?? null,
    isAuthenticated: overrides.isAuthenticated ?? false,
    loading: overrides.loading ?? {
      init: false,
      signIn: false,
      signUp: false,
      signOut: false,
    },
    error: overrides.error ?? null,
    initialized: overrides.initialized ?? true,
  };
}

/**
 * Creates a complete mock AuthStore with both state and actions
 * @param stateOverrides - Partial AuthState to override default state values
 * @param actionOverrides - Partial AuthActions to override default actions
 * @returns Fully typed AuthStore object
 */
export function createMockAuthStore(
  stateOverrides: Partial<AuthState> = {},
  actionOverrides: Partial<AuthActions> = {},
): AuthStore {
  const mockState = createMockAuthState(stateOverrides);

  const defaultActions: AuthActions = {
    initialize: async () => {},
    signIn: async () => {},
    signUp: async () => {},
    signOut: async () => {},
    clearError: () => {},
    cleanup: () => {},
    _setSession: () => {},
    _setUser: () => {},
    _setError: () => {},
    _setLoading: () => {},
  };

  return {
    ...mockState,
    ...defaultActions,
    ...actionOverrides,
  };
}

/**
 * Creates a partial auth store for use with selector-based testing
 * This is useful when testing components that use selectors to access only
 * specific parts of the store.
 *
 * @param overrides - Any partial store properties to include
 * @returns Partial AuthStore that satisfies selector requirements
 */
export function createPartialAuthStore(overrides: Partial<AuthStore> = {}): AuthStore {
  return createMockAuthStore({}, overrides);
}
