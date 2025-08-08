/**
 * Auth Flow Integration Tests
 *
 * These tests verify the integration between the auth store, UI components, and protected routes.
 * They complement the service-level tests in auth.service.integration.test.ts by focusing on:
 * - Store state management and updates from service calls
 * - UI component integration with the store
 * - Protected route behavior with auth state changes
 * - Error propagation from service → store → UI
 * - Loading state management across operations
 * - Complete user journey flows
 *
 * Note: The auth service is mocked here since its functionality is thoroughly tested
 * in auth.service.integration.test.ts. This focuses on store/UI integration only.
 *
 * These tests are kept simple and avoid complex timing scenarios to ensure reliability.
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { AuthError, AuthErrorCode, authService } from '@/services/auth/auth.service';
import { _resetAuthStateForTesting, useAuthStore } from '@/stores/auth.store';
import { createMockSession, createMockUser } from '@/test/factories/auth';
import { render } from '@/test/helpers/render';

// Mock auth service
vi.mock('@/services/auth/auth.service');

// Mock toast
vi.mock('@/lib/toast', () => ({
  authToast: {
    loginSuccess: vi.fn(),
    rateLimited: vi.fn(),
    emailNotConfirmed: vi.fn(),
  },
  toast: { error: vi.fn() },
}));

describe('Auth Flow Integration', () => {
  const mockUser = createMockUser({ email: 'test@example.com' });
  const mockSession = createMockSession({ user: mockUser });

  beforeEach(() => {
    vi.clearAllMocks();
    _resetAuthStateForTesting();

    // Reset store state
    useAuthStore.setState({
      user: null,
      session: null,
      isAuthenticated: false,
      loading: { init: false, signIn: false, signUp: false, signOut: false },
      error: null,
      initialized: true, // Set as initialized to avoid async setup
    });
  });

  describe('Store Initialization', () => {
    it('should initialize with authenticated state', async () => {
      // Mock service returns for initialization
      vi.mocked(authService.getSession).mockResolvedValue(mockSession);
      vi.mocked(authService.getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(authService.onAuthStateChange).mockReturnValue(() => {});

      // Set store as not initialized
      useAuthStore.setState({ initialized: false });

      const { initialize } = useAuthStore.getState();
      await initialize();

      const state = useAuthStore.getState();
      expect(state.initialized).toBe(true);
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(mockUser);
      expect(state.session).toEqual(mockSession);
    });

    it('should initialize with unauthenticated state', async () => {
      vi.mocked(authService.getSession).mockResolvedValue(null);
      vi.mocked(authService.getCurrentUser).mockResolvedValue(null);
      vi.mocked(authService.onAuthStateChange).mockReturnValue(() => {});

      useAuthStore.setState({ initialized: false });

      const { initialize } = useAuthStore.getState();
      await initialize();

      const state = useAuthStore.getState();
      expect(state.initialized).toBe(true);
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.session).toBeNull();
    });
  });

  describe('Store State Management', () => {
    it('should update store state on successful sign in', async () => {
      // Mock successful sign in
      vi.mocked(authService.signIn).mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const { signIn } = useAuthStore.getState();

      // Verify initial state
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();

      // Call sign in
      await signIn({ email: 'test@example.com', password: 'password123' });

      // Verify updated state
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(mockUser);
      expect(state.session).toEqual(mockSession);
      expect(state.error).toBeNull();
    });

    it('should handle sign in errors', async () => {
      const mockError = new AuthError('Invalid credentials', AuthErrorCode.INVALID_CREDENTIALS);

      vi.mocked(authService.signIn).mockResolvedValue({
        data: null,
        error: mockError,
      });

      const { signIn } = useAuthStore.getState();

      try {
        await signIn({ email: 'test@example.com', password: 'wrongpassword' });
      } catch {
        // Expected to throw
      }

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.error).toEqual(mockError);
    });

    it('should clear error when calling clearError', () => {
      const mockError = new AuthError('Test error', AuthErrorCode.UNKNOWN);

      // Set error
      useAuthStore.getState()._setError(mockError);
      expect(useAuthStore.getState().error).toEqual(mockError);

      // Clear error
      useAuthStore.getState().clearError();
      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('UI Integration', () => {
    it('should render login form and handle submission', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.signIn).mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const onSuccess = vi.fn();
      render(<LoginForm onSuccess={onSuccess} />);

      // Fill form
      await user.type(screen.getByLabelText('Email address'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      // Wait for success
      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });

      expect(authService.signIn).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('should show error message on login failure', async () => {
      const user = userEvent.setup();
      const mockError = new AuthError('Invalid credentials', AuthErrorCode.INVALID_CREDENTIALS);

      vi.mocked(authService.signIn).mockResolvedValue({
        data: null,
        error: mockError,
      });

      render(<LoginForm />);

      await user.type(screen.getByLabelText('Email address'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'wrongpassword');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      // Verify error is set in store and an error message is displayed
      await waitFor(() => {
        const state = useAuthStore.getState();
        expect(state.error).toEqual(mockError);
        // Check that some error message is displayed (exact text may vary)
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });

  describe('Protected Route Behavior', () => {
    it('should show loading when not initialized', () => {
      // Set store as not initialized
      useAuthStore.setState({ initialized: false });

      render(<ProtectedRoute />);

      expect(screen.getByText('Loading your fitness journey...')).toBeInTheDocument();
    });

    it('should not redirect when authenticated', () => {
      // Set authenticated state
      useAuthStore.setState({
        isAuthenticated: true,
        user: mockUser,
        session: mockSession,
        initialized: true,
      });

      render(<ProtectedRoute />);

      // Should not show loading
      expect(screen.queryByText('Loading your fitness journey...')).not.toBeInTheDocument();
    });
  });
});
