import type { Session, User } from '@supabase/supabase-js';
import { act, renderHook } from '@testing-library/react';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthError, AuthErrorCode, authService } from '@/services/auth/auth.service';
import { createMockSession, createMockUser } from '@/test/factories/auth';

import { _resetAuthStateForTesting, useAuthStore } from './auth.store';

// Mock the auth service
vi.mock('@/services/auth/auth.service', () => ({
  authService: {
    getSession: vi.fn(),
    getCurrentUser: vi.fn(),
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn(),
  },
  AuthError: class AuthError extends Error {
    code: string;
    originalError?: unknown;
    constructor(message: string, code: string, originalError?: unknown) {
      super(message);
      this.code = code;
      this.originalError = originalError;
    }
  },
  AuthErrorCode: {
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    NETWORK_ERROR: 'NETWORK_ERROR',
    UNKNOWN: 'UNKNOWN',
  },
}));

describe('Auth Store', () => {
  const mockUser = createMockUser();
  const mockSession = createMockSession();

  beforeEach(() => {
    // Reset module-level auth state
    _resetAuthStateForTesting();

    // Reset store state
    useAuthStore.setState({
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
    });

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize with existing session', async () => {
      (authService.getSession as Mock).mockResolvedValue(mockSession);
      (authService.getCurrentUser as Mock).mockResolvedValue(mockUser);
      (authService.onAuthStateChange as Mock).mockReturnValue(() => undefined);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.initialize();
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.session).toEqual(mockSession);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.initialized).toBe(true);
      expect(result.current.loading.init).toBe(false);
    });

    it('should initialize without session', async () => {
      (authService.getSession as Mock).mockResolvedValue(null);
      (authService.getCurrentUser as Mock).mockResolvedValue(null);
      (authService.onAuthStateChange as Mock).mockReturnValue(() => undefined);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.initialize();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.initialized).toBe(true);
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Init failed');
      (authService.getSession as Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.initialize();
      });

      expect(result.current.initialized).toBe(true);
      expect(result.current.error).toBeInstanceOf(AuthError);
      expect(result.current.error?.code).toBe(AuthErrorCode.UNKNOWN);
    });

    it('should prevent multiple initializations', async () => {
      (authService.getSession as Mock).mockResolvedValue(mockSession);
      (authService.getCurrentUser as Mock).mockResolvedValue(mockUser);
      (authService.onAuthStateChange as Mock).mockReturnValue(() => undefined);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.initialize();
      });

      const getSessionCalls = (authService.getSession as Mock).mock.calls.length;

      await act(async () => {
        await result.current.initialize();
      });

      // Should not call getSession again
      expect((authService.getSession as Mock).mock.calls.length).toBe(getSessionCalls);
    });
  });

  describe('signIn', () => {
    it('should sign in successfully', async () => {
      const credentials = { email: 'test@example.com', password: 'password123' };
      (authService.signIn as Mock).mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.signIn(credentials);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.session).toEqual(mockSession);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.loading.signIn).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle sign in errors', async () => {
      const credentials = { email: 'test@example.com', password: 'wrong' };
      const error = new AuthError('Invalid credentials', AuthErrorCode.INVALID_CREDENTIALS);
      (authService.signIn as Mock).mockResolvedValue({
        data: null,
        error,
      });

      const { result } = renderHook(() => useAuthStore());

      // The error is thrown and also stored in state
      try {
        await act(async () => {
          await result.current.signIn(credentials);
        });
      } catch (e) {
        expect(e).toEqual(error);
      }

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toEqual(error);
      expect(result.current.loading.signIn).toBe(false);
    });

    it('should set loading state during sign in', async () => {
      const credentials = { email: 'test@example.com', password: 'password123' };
      let resolveSignIn: (value: { data: { user: User; session: Session }; error: null }) => void;
      const signInPromise = new Promise<{ data: { user: User; session: Session }; error: null }>((resolve) => {
        resolveSignIn = resolve;
      });
      (authService.signIn as Mock).mockReturnValue(signInPromise);

      const { result } = renderHook(() => useAuthStore());

      act(() => {
        void result.current.signIn(credentials);
      });

      expect(result.current.loading.signIn).toBe(true);

      await act(async () => {
        resolveSignIn!({
          data: { user: mockUser, session: mockSession },
          error: null,
        });
        await signInPromise;
      });

      expect(result.current.loading.signIn).toBe(false);
    });
  });

  describe('signUp', () => {
    it('should sign up successfully with session', async () => {
      const credentials = {
        email: 'new@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      };
      (authService.signUp as Mock).mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.signUp(credentials);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.session).toEqual(mockSession);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.loading.signUp).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should sign up successfully without session (email confirmation required)', async () => {
      const credentials = {
        email: 'new@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      };
      (authService.signUp as Mock).mockResolvedValue({
        data: { user: mockUser, session: null },
        error: null,
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.signUp(credentials);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.session).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.loading.signUp).toBe(false);
    });
  });

  describe('signOut', () => {
    it('should sign out successfully', async () => {
      // Set initial authenticated state
      useAuthStore.setState({
        user: mockUser,
        session: mockSession,
        isAuthenticated: true,
      });

      (authService.signOut as Mock).mockResolvedValue({
        data: undefined,
        error: null,
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.signOut();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.loading.signOut).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('auth state changes', () => {
    it('should handle SIGNED_IN event', async () => {
      let authStateCallback: (event: string, session: Session | null) => void;
      (authService.onAuthStateChange as Mock).mockImplementation(
        (callback: (event: string, session: Session | null) => void) => {
          authStateCallback = callback;
          return () => undefined;
        },
      );
      (authService.getSession as Mock).mockResolvedValue(null);
      (authService.getCurrentUser as Mock).mockResolvedValue(null);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.initialize();
      });

      act(() => {
        authStateCallback!('SIGNED_IN', mockSession);
      });

      expect(result.current.session).toEqual(mockSession);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should handle SIGNED_OUT event', async () => {
      let authStateCallback: (event: string, session: Session | null) => void;
      (authService.onAuthStateChange as Mock).mockImplementation(
        (callback: (event: string, session: Session | null) => void) => {
          authStateCallback = callback;
          return () => undefined;
        },
      );
      (authService.getSession as Mock).mockResolvedValue(mockSession);
      (authService.getCurrentUser as Mock).mockResolvedValue(mockUser);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.initialize();
      });

      act(() => {
        authStateCallback!('SIGNED_OUT', null);
      });

      expect(result.current.session).toBeNull();
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('utility functions', () => {
    it('should clear error', () => {
      const error = new AuthError('Test error', AuthErrorCode.UNKNOWN);
      useAuthStore.setState({ error });

      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('cleanup', () => {
    it('should cleanup auth listener when called', async () => {
      const mockUnsubscribe = vi.fn();
      (authService.onAuthStateChange as Mock).mockReturnValue(mockUnsubscribe);
      (authService.getSession as Mock).mockResolvedValue(mockSession);
      (authService.getCurrentUser as Mock).mockResolvedValue(mockUser);

      const { result } = renderHook(() => useAuthStore());

      // Initialize first to set up the listener
      await act(async () => {
        await result.current.initialize();
      });

      // Call cleanup
      act(() => {
        result.current.cleanup();
      });

      // Verify unsubscribe was called
      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should handle cleanup when no listener exists', () => {
      const { result } = renderHook(() => useAuthStore());

      // Call cleanup without initializing
      act(() => {
        result.current.cleanup();
      });

      // Should not throw - cleanup should be safe to call multiple times
      expect(() => result.current.cleanup()).not.toThrow();
    });

    it('should not call unsubscribe multiple times', async () => {
      const mockUnsubscribe = vi.fn();
      (authService.onAuthStateChange as Mock).mockReturnValue(mockUnsubscribe);
      (authService.getSession as Mock).mockResolvedValue(mockSession);
      (authService.getCurrentUser as Mock).mockResolvedValue(mockUser);

      const { result } = renderHook(() => useAuthStore());

      // Initialize and cleanup
      await act(async () => {
        await result.current.initialize();
      });

      act(() => {
        result.current.cleanup();
      });

      // Call cleanup again
      act(() => {
        result.current.cleanup();
      });

      // Unsubscribe should only be called once
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });
  });
});
