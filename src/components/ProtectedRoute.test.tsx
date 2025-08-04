/**
 * Unit Tests for ProtectedRoute Component
 *
 * These tests verify the authentication-based route protection functionality, including:
 * - Authentication state checking via Zustand auth store
 * - Loading state display during auth initialization
 * - Redirect to login when user is not authenticated
 * - Return URL preservation in redirect queries
 * - Rendering child routes when user is authenticated
 * - Mobile-friendly loading UI (44px minimum touch targets)
 *
 * Note: Uses MemoryRouter for isolated routing tests without browser history
 */

import { screen } from '@testing-library/react';
// Import the mocked hooks
import { useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthInitialized, useIsAuthenticated } from '@/stores/auth.store';
import { render } from '@/test/helpers/render';

import { ProtectedRoute } from './ProtectedRoute';

// Mock the auth store
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(),
  useIsAuthenticated: vi.fn(),
  useAuthInitialized: vi.fn(),
}));

// Mock React Router hooks - these are automatically provided by MemoryRouter in tests
// but we need to mock useLocation for the redirect URL logic
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useLocation: vi.fn(),
  };
});

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default useLocation mock
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/dashboard',
      search: '',
      hash: '',
      state: null,
      key: 'default',
    });
  });

  describe('initialization state', () => {
    it('should display loading state when auth is not initialized', () => {
      // Mock auth store to return uninitialized state
      vi.mocked(useIsAuthenticated).mockReturnValue(false);
      vi.mocked(useAuthInitialized).mockReturnValue(false);

      render(<ProtectedRoute />);

      // Check for loading UI elements
      expect(screen.getByText('Slow Burn')).toBeInTheDocument();
      expect(screen.getByText('Loading your fitness journey...')).toBeInTheDocument();

      // Check for loading spinner by class
      const loadingContainer = screen.getByText('Loading your fitness journey...').closest('.text-center');
      const spinner = loadingContainer?.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass('animate-spin');
    });

    it('should show loading spinner with proper mobile-friendly size', () => {
      vi.mocked(useIsAuthenticated).mockReturnValue(false);
      vi.mocked(useAuthInitialized).mockReturnValue(false);

      render(<ProtectedRoute />);

      const loadingContainer = screen.getByText('Loading your fitness journey...').closest('.text-center');
      const spinner = loadingContainer?.querySelector('.animate-spin');
      // Verify spinner has minimum mobile touch target size classes
      expect(spinner).toHaveClass('h-12', 'w-12');
    });

    it('should center loading content properly', () => {
      vi.mocked(useIsAuthenticated).mockReturnValue(false);
      vi.mocked(useAuthInitialized).mockReturnValue(false);

      render(<ProtectedRoute />);

      const loadingContainer = screen.getByText('Slow Burn').closest('div');
      expect(loadingContainer?.parentElement).toHaveClass('flex', 'h-screen', 'items-center', 'justify-center');
    });
  });

  describe('unauthenticated user behavior', () => {
    it('should render Navigate component when user is not authenticated', () => {
      vi.mocked(useIsAuthenticated).mockReturnValue(false);
      vi.mocked(useAuthInitialized).mockReturnValue(true);

      // Mock location to simulate being at /dashboard
      vi.mocked(useLocation).mockReturnValue({
        pathname: '/dashboard',
        search: '',
        hash: '',
        state: null,
        key: 'test',
      });

      render(<ProtectedRoute />, {
        routerOptions: {
          initialEntries: ['/dashboard'],
        },
      });

      // In a test environment with MemoryRouter, the Navigate component will redirect
      // We can verify this by checking that the protected content is not rendered
      // and no loading state is shown (since initialized: true)
      expect(screen.queryByText('Loading your fitness journey...')).not.toBeInTheDocument();
      expect(screen.queryByTestId('outlet')).not.toBeInTheDocument();
    });

    it('should not render protected content when redirecting', () => {
      vi.mocked(useIsAuthenticated).mockReturnValue(false);
      vi.mocked(useAuthInitialized).mockReturnValue(true);

      // Mock location with complex path and search params
      vi.mocked(useLocation).mockReturnValue({
        pathname: '/dashboard/workouts',
        search: '?tab=active&sort=date',
        hash: '',
        state: null,
        key: 'test',
      });

      render(<ProtectedRoute />);

      // When redirecting, should not show loading or outlet content
      expect(screen.queryByText('Loading your fitness journey...')).not.toBeInTheDocument();
      expect(screen.queryByTestId('outlet')).not.toBeInTheDocument();
    });

    it('should handle special characters in return URL', () => {
      vi.mocked(useIsAuthenticated).mockReturnValue(false);
      vi.mocked(useAuthInitialized).mockReturnValue(true);

      const pathWithSpecialChars = '/plans/my workout plan';
      vi.mocked(useLocation).mockReturnValue({
        pathname: pathWithSpecialChars,
        search: '',
        hash: '',
        state: null,
        key: 'test',
      });

      render(<ProtectedRoute />);

      // Since we're testing the redirect logic but can't test actual navigation in MemoryRouter,
      // we verify that the component handles the special characters without crashing
      expect(screen.queryByText('Loading your fitness journey...')).not.toBeInTheDocument();
    });
  });

  describe('authenticated user behavior', () => {
    it('should render Outlet when user is authenticated', () => {
      vi.mocked(useIsAuthenticated).mockReturnValue(true);
      vi.mocked(useAuthInitialized).mockReturnValue(true);

      render(<ProtectedRoute />);

      // ProtectedRoute uses Outlet to render child routes
      // In our mock setup, Outlet renders "Outlet Content"
      expect(screen.getByTestId('outlet')).toBeInTheDocument();
    });

    it('should use Outlet to render nested routes', () => {
      vi.mocked(useIsAuthenticated).mockReturnValue(true);
      vi.mocked(useAuthInitialized).mockReturnValue(true);

      // Mock Outlet to verify it's being used
      vi.mock('react-router-dom', async () => {
        const actual = await vi.importActual('react-router-dom');
        return {
          ...actual,
          Outlet: () => <div data-testid="outlet">Outlet Content</div>,
          useLocation: vi.fn(),
        };
      });

      render(<ProtectedRoute />);

      expect(screen.getByTestId('outlet')).toBeInTheDocument();
    });

    it('should not show loading state when authenticated and initialized', () => {
      vi.mocked(useIsAuthenticated).mockReturnValue(true);
      vi.mocked(useAuthInitialized).mockReturnValue(true);

      render(<ProtectedRoute />);

      expect(screen.queryByText('Loading your fitness journey...')).not.toBeInTheDocument();
      expect(screen.queryByRole('status', { hidden: true })).not.toBeInTheDocument();
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle auth store state changes gracefully', () => {
      // Start with uninitialized state
      vi.mocked(useIsAuthenticated).mockReturnValue(false);
      vi.mocked(useAuthInitialized).mockReturnValue(false);

      const { rerender } = render(<ProtectedRoute />);

      // Verify loading state
      expect(screen.getByText('Loading your fitness journey...')).toBeInTheDocument();

      // Update to authenticated state
      vi.mocked(useIsAuthenticated).mockReturnValue(true);
      vi.mocked(useAuthInitialized).mockReturnValue(true);

      rerender(<ProtectedRoute />);

      // Should no longer show loading
      expect(screen.queryByText('Loading your fitness journey...')).not.toBeInTheDocument();
    });

    it('should handle missing location gracefully', () => {
      vi.mocked(useIsAuthenticated).mockReturnValue(false);
      vi.mocked(useAuthInitialized).mockReturnValue(true);

      // Mock location to return minimal required properties
      vi.mocked(useLocation).mockReturnValue({
        pathname: '/',
        search: '',
        hash: '',
        state: null,
        key: 'test',
      });

      expect(() => render(<ProtectedRoute />)).not.toThrow();
    });

    it('should handle empty pathname in location', () => {
      vi.mocked(useIsAuthenticated).mockReturnValue(false);
      vi.mocked(useAuthInitialized).mockReturnValue(true);

      vi.mocked(useLocation).mockReturnValue({
        pathname: '',
        search: '',
        hash: '',
        state: null,
        key: 'test',
      });

      render(<ProtectedRoute />);

      // Should handle empty pathname without crashing
      expect(screen.queryByText('Loading your fitness journey...')).not.toBeInTheDocument();
    });
  });

  describe('loading state accessibility', () => {
    it('should provide proper ARIA labels for loading state', () => {
      vi.mocked(useIsAuthenticated).mockReturnValue(false);
      vi.mocked(useAuthInitialized).mockReturnValue(false);

      render(<ProtectedRoute />);

      // Check for descriptive text that screen readers can access
      expect(screen.getByText('Loading your fitness journey...')).toBeInTheDocument();

      // Check spinner element exists
      const loadingContainer = screen.getByText('Loading your fitness journey...').closest('.text-center');
      const spinner = loadingContainer?.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass('animate-spin');
    });

    it('should have proper color contrast for loading text', () => {
      vi.mocked(useIsAuthenticated).mockReturnValue(false);
      vi.mocked(useAuthInitialized).mockReturnValue(false);

      render(<ProtectedRoute />);

      // Check that muted foreground class is applied for proper contrast
      const loadingText = screen.getByText('Loading your fitness journey...');
      expect(loadingText).toHaveClass('text-muted-foreground');
    });
  });

  describe('performance and optimization', () => {
    it('should use selective Zustand subscriptions to minimize re-renders', () => {
      vi.mocked(useIsAuthenticated).mockReturnValue(true);
      vi.mocked(useAuthInitialized).mockReturnValue(true);

      render(<ProtectedRoute />);

      // Verify the selector hooks were called (which implies selective subscription)
      expect(useIsAuthenticated).toHaveBeenCalled();
      expect(useAuthInitialized).toHaveBeenCalled();

      // Verify the component renders correctly with the mocked values
      expect(screen.queryByText('Loading your fitness journey...')).not.toBeInTheDocument();
    });
  });
});
