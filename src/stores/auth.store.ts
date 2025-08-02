import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';

import {
  AuthError,
  AuthErrorCode,
  authService,
  type SignInCredentials,
  type SignUpCredentials,
} from '@/services/auth.service';

/**
 * Auth store state interface
 */
interface AuthState {
  // Core auth state
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;

  // Loading states for different operations
  loading: {
    init: boolean;
    signIn: boolean;
    signUp: boolean;
    signOut: boolean;
  };

  // Error state
  error: AuthError | null;

  // Track if the store has been initialized
  initialized: boolean;

  // Store the unsubscribe function for auth state listener cleanup
  _unsubscribe: (() => void) | null;
}

/**
 * Auth store actions interface
 */
interface AuthActions {
  // Initialize the store and set up auth listeners
  initialize: () => Promise<void>;

  // Auth operations
  signIn: (credentials: SignInCredentials) => Promise<void>;
  signUp: (credentials: SignUpCredentials) => Promise<void>;
  signOut: () => Promise<void>;

  // State management
  clearError: () => void;

  // Cleanup auth listeners
  cleanup: () => void;

  // Internal actions (not typically called directly from components)
  _setSession: (session: Session | null) => void;
  _setUser: (user: User | null) => void;
  _setError: (error: AuthError | null) => void;
  _setLoading: (operation: keyof AuthState['loading'], isLoading: boolean) => void;
}

/**
 * Combined auth store type
 */
type AuthStore = AuthState & AuthActions;

/**
 * Initial state factory
 */
const getInitialState = (): AuthState => ({
  user: null,
  session: null,
  isAuthenticated: false,
  loading: {
    init: false,
    signIn: false,
    signUp: false,
    signOut: false,
  },
  error: null,
  initialized: false,
  _unsubscribe: null,
});

/**
 * Auth store implementation with Zustand
 *
 * Features:
 * - Automatic sync with Supabase auth state
 * - Loading states for all operations
 * - Error handling with typed errors
 * - DevTools support in development
 * - Computed isAuthenticated property
 */
export const useAuthStore = create<AuthStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // Initial state
      ...getInitialState(),

      // Initialize store and set up auth listeners
      initialize: async () => {
        const state = get();

        // Prevent multiple initializations
        if (state.initialized || state.loading.init) {
          return;
        }

        set({ loading: { ...state.loading, init: true } });

        try {
          // Get initial session
          const [session, user] = await Promise.all([authService.getSession(), authService.getCurrentUser()]);

          set({
            session,
            user,
            isAuthenticated: !!session && !!user,
            initialized: true,
            loading: { ...state.loading, init: false },
          });

          // Subscribe to auth state changes
          const unsubscribe = authService.onAuthStateChange((event, session) => {
            switch (event) {
              case 'SIGNED_IN':
              case 'TOKEN_REFRESHED':
                set({
                  session,
                  user: session?.user ?? null,
                  isAuthenticated: true,
                  error: null,
                });
                break;

              case 'SIGNED_OUT':
                set({
                  session: null,
                  user: null,
                  isAuthenticated: false,
                  error: null,
                });
                break;

              case 'USER_UPDATED':
                set({
                  user: session?.user ?? null,
                });
                break;

              case 'PASSWORD_RECOVERY':
                // Handle password recovery flow if needed
                break;

              default:
                // Handle other events as needed
                break;
            }
          });

          // Store the unsubscribe function in the store's state for cleanup
          // This allows components or the app to clean up the listener when needed
          set({ _unsubscribe: unsubscribe });
        } catch (error) {
          set({
            initialized: true,
            loading: { ...state.loading, init: false },
            error: new AuthError('Failed to initialize authentication', AuthErrorCode.UNKNOWN, error),
          });
        }
      },

      // Sign in action
      signIn: async (credentials: SignInCredentials) => {
        const state = get();

        set({
          loading: { ...state.loading, signIn: true },
          error: null,
        });

        const { data, error } = await authService.signIn(credentials);

        if (error) {
          set({
            loading: { ...state.loading, signIn: false },
            error,
          });
          throw error; // Re-throw for component-level handling if needed
        }

        if (data) {
          set({
            user: data.user,
            session: data.session,
            isAuthenticated: true,
            loading: { ...state.loading, signIn: false },
            error: null,
          });
        }
      },

      // Sign up action
      signUp: async (credentials: SignUpCredentials) => {
        const state = get();

        set({
          loading: { ...state.loading, signUp: true },
          error: null,
        });

        const { data, error } = await authService.signUp(credentials);

        if (error) {
          set({
            loading: { ...state.loading, signUp: false },
            error,
          });
          throw error; // Re-throw for component-level handling if needed
        }

        if (data) {
          set({
            user: data.user,
            session: data.session,
            isAuthenticated: !!data.session, // Might be null if email confirmation is required
            loading: { ...state.loading, signUp: false },
            error: null,
          });
        }
      },

      // Sign out action
      signOut: async () => {
        const state = get();

        set({
          loading: { ...state.loading, signOut: true },
          error: null,
        });

        const { error } = await authService.signOut();

        if (error) {
          set({
            loading: { ...state.loading, signOut: false },
            error,
          });
          throw error; // Re-throw for component-level handling if needed
        }

        set({
          user: null,
          session: null,
          isAuthenticated: false,
          loading: { ...state.loading, signOut: false },
          error: null,
        });
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },

      // Cleanup auth listeners
      cleanup: () => {
        const state = get();
        if (state._unsubscribe) {
          state._unsubscribe();
          set({ _unsubscribe: null });
        }
      },

      // Internal actions
      _setSession: (session: Session | null) => {
        set({
          session,
          isAuthenticated: !!session,
        });
      },

      _setUser: (user: User | null) => {
        set({ user });
      },

      _setError: (error: AuthError | null) => {
        set({ error });
      },

      _setLoading: (operation: keyof AuthState['loading'], isLoading: boolean) => {
        const state = get();
        set({
          loading: {
            ...state.loading,
            [operation]: isLoading,
          },
        });
      },
    })),
    {
      name: 'auth-store', // DevTools name
      serialize: {
        // Don't persist sensitive data
        options: {
          session: false,
          user: false,
        },
      },
    },
  ),
);

/**
 * Selector hooks for specific parts of the auth state
 * These help with performance by only re-rendering when specific values change
 */
export const useUser = () => useAuthStore((state) => state.user);
export const useSession = () => useAuthStore((state) => state.session);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useAuthLoading = () => useAuthStore((state) => state.loading);
export const useAuthError = () => useAuthStore((state) => state.error);
export const useAuthInitialized = () => useAuthStore((state) => state.initialized);

/**
 * Hook to initialize auth store on app mount
 * This should be called once at the app root level
 */
export const useAuthInit = () => {
  const initialize = useAuthStore((state) => state.initialize);
  const cleanup = useAuthStore((state) => state.cleanup);
  const initialized = useAuthStore((state) => state.initialized);

  // Initialize on mount
  if (!initialized) {
    void initialize();
  }

  return { initialized, cleanup };
};
