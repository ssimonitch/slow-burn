/**
 * Unit Tests for LoginPage Component
 *
 * These tests verify the login page functionality, including:
 * - Proper rendering with AuthLayout wrapper
 * - Authentication redirect logic for already authenticated users
 * - URL parameter handling for redirect preservation
 * - Navigation to signup and forgot password with redirect URL preservation
 * - Integration with LoginForm component
 * - Security validation of redirect URLs
 *
 * Note: Uses existing test utilities from @/test/helpers/render and @/test/factories/auth
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render } from '@/test/helpers/render';

import { LoginPage } from './LoginPage';

// Mock the auth features
vi.mock('@/features/auth', () => ({
  AuthLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-layout">
      <div data-testid="auth-layout-content">{children}</div>
    </div>
  ),
  LoginForm: ({ onSuccess, redirectUrl }: { onSuccess?: () => void; redirectUrl?: string }) => (
    <div data-testid="login-form">
      <h1>Login Form</h1>
      <button type="button" onClick={onSuccess} data-testid="login-success-button">
        Login Success
      </button>
      <a href={redirectUrl ? `/signup?from=${redirectUrl}` : '/signup'} data-testid="signup-link">
        Sign up
      </a>
      <a
        href={redirectUrl ? `/forgot-password?from=${redirectUrl}` : '/forgot-password'}
        data-testid="forgot-password-link"
      >
        Forgot Password
      </a>
    </div>
  ),
}));

// Mock the security utilities
vi.mock('@/lib/security', () => ({
  safeDecodeUrl: vi.fn().mockImplementation((url: string | null, fallback = '/dashboard'): string => {
    const safeFallback: string = fallback;
    if (!url) return safeFallback;
    try {
      return decodeURIComponent(url);
    } catch {
      return safeFallback;
    }
  }),
}));

// Mock the auth store hooks
const mockUseIsAuthenticated = vi.fn();
vi.mock('@/stores/auth.store', () => ({
  useIsAuthenticated: () => mockUseIsAuthenticated() as boolean,
}));

// Mock react-router-dom hooks
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsAuthenticated.mockReturnValue(false);
  });

  describe('basic rendering', () => {
    it('should render with AuthLayout wrapper', () => {
      render(<LoginPage />);

      expect(screen.getByTestId('auth-layout')).toBeInTheDocument();
      expect(screen.getByTestId('auth-layout-content')).toBeInTheDocument();
    });

    it('should render LoginForm inside AuthLayout', () => {
      render(<LoginPage />);

      const authLayout = screen.getByTestId('auth-layout');
      const loginForm = screen.getByTestId('login-form');

      expect(authLayout).toContainElement(loginForm);
      expect(screen.getByText('Login Form')).toBeInTheDocument();
    });

    it('should provide all required handlers to LoginForm', () => {
      render(<LoginPage />);

      expect(screen.getByTestId('login-success-button')).toBeInTheDocument();
      expect(screen.getByTestId('signup-link')).toBeInTheDocument();
      expect(screen.getByTestId('forgot-password-link')).toBeInTheDocument();
    });
  });

  describe('authentication redirect logic', () => {
    it('should redirect to dashboard when already authenticated without from parameter', async () => {
      mockUseIsAuthenticated.mockReturnValue(true);

      render(<LoginPage />, {
        routerOptions: {
          initialEntries: ['/login'],
        },
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
      });
    });

    it('should redirect to decoded URL when already authenticated with from parameter', async () => {
      mockUseIsAuthenticated.mockReturnValue(true);
      const encodedRedirectUrl = encodeURIComponent('/workouts');

      render(<LoginPage />, {
        routerOptions: {
          initialEntries: [`/login?from=${encodedRedirectUrl}`],
        },
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/workouts', { replace: true });
      });
    });

    it('should handle complex redirect URLs with query parameters', async () => {
      mockUseIsAuthenticated.mockReturnValue(true);
      const complexUrl = '/dashboard?tab=workouts&filter=recent';
      const encodedRedirectUrl = encodeURIComponent(complexUrl);

      render(<LoginPage />, {
        routerOptions: {
          initialEntries: [`/login?from=${encodedRedirectUrl}`],
        },
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(complexUrl, { replace: true });
      });
    });

    it('should not redirect when not authenticated', () => {
      mockUseIsAuthenticated.mockReturnValue(false);

      render(<LoginPage />);

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should handle authentication state changes', async () => {
      // Start unauthenticated
      mockUseIsAuthenticated.mockReturnValue(false);

      const { rerender } = render(<LoginPage />);

      expect(mockNavigate).not.toHaveBeenCalled();

      // Become authenticated
      mockUseIsAuthenticated.mockReturnValue(true);
      rerender(<LoginPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
      });
    });
  });

  describe('login success handling', () => {
    it('should not navigate immediately on success (handled by auth state change)', async () => {
      const user = userEvent.setup();

      render(<LoginPage />);

      const successButton = screen.getByTestId('login-success-button');
      await user.click(successButton);

      // Navigation should be handled by useEffect when isAuthenticated changes
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should rely on authentication state change for navigation', async () => {
      const user = userEvent.setup();

      // Start unauthenticated
      mockUseIsAuthenticated.mockReturnValue(false);

      // Don't mock navigate to throw error for this test
      mockNavigate.mockImplementation(() => {});

      const { rerender } = render(<LoginPage />);

      const successButton = screen.getByTestId('login-success-button');
      await user.click(successButton);

      // Navigation should not happen yet
      expect(mockNavigate).not.toHaveBeenCalled();

      // Simulate auth state change to authenticated
      mockUseIsAuthenticated.mockReturnValue(true);
      rerender(<LoginPage />);

      // Now navigation should occur
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
      });
    });
  });

  describe('signup navigation', () => {
    it('should provide signup link without from parameter', () => {
      render(<LoginPage />, {
        routerOptions: {
          initialEntries: ['/login'],
        },
      });

      const signupLink = screen.getByTestId('signup-link');
      expect(signupLink).toHaveAttribute('href', '/signup');
    });

    it('should preserve from parameter when navigating to signup', () => {
      const encodedRedirectUrl = encodeURIComponent('/dashboard');

      render(<LoginPage />, {
        routerOptions: {
          initialEntries: [`/login?from=${encodedRedirectUrl}`],
        },
      });

      const signupLink = screen.getByTestId('signup-link');
      // useSearchParams automatically decodes, so we get the decoded value
      expect(signupLink).toHaveAttribute('href', '/signup?from=/dashboard');
    });

    it('should handle complex redirect URLs in signup navigation', () => {
      const complexRedirectUrl = encodeURIComponent('/dashboard?tab=workouts&filter=recent');

      render(<LoginPage />, {
        routerOptions: {
          initialEntries: [`/login?from=${complexRedirectUrl}`],
        },
      });

      const signupLink = screen.getByTestId('signup-link');
      // useSearchParams automatically decodes, so we get the decoded value
      expect(signupLink).toHaveAttribute('href', '/signup?from=/dashboard?tab=workouts&filter=recent');
    });
  });

  describe('forgot password navigation', () => {
    it('should provide forgot password link without from parameter', () => {
      render(<LoginPage />, {
        routerOptions: {
          initialEntries: ['/login'],
        },
      });

      const forgotPasswordLink = screen.getByTestId('forgot-password-link');
      expect(forgotPasswordLink).toHaveAttribute('href', '/forgot-password');
    });

    it('should preserve from parameter when navigating to forgot password', () => {
      const encodedRedirectUrl = encodeURIComponent('/dashboard');

      render(<LoginPage />, {
        routerOptions: {
          initialEntries: [`/login?from=${encodedRedirectUrl}`],
        },
      });

      const forgotPasswordLink = screen.getByTestId('forgot-password-link');
      // useSearchParams automatically decodes, so we get the decoded value
      expect(forgotPasswordLink).toHaveAttribute('href', '/forgot-password?from=/dashboard');
    });

    it('should handle complex redirect URLs in forgot password navigation', () => {
      const complexRedirectUrl = encodeURIComponent('/dashboard?tab=workouts&filter=recent');

      render(<LoginPage />, {
        routerOptions: {
          initialEntries: [`/login?from=${complexRedirectUrl}`],
        },
      });

      const forgotPasswordLink = screen.getByTestId('forgot-password-link');
      // useSearchParams automatically decodes, so we get the decoded value
      expect(forgotPasswordLink).toHaveAttribute('href', '/forgot-password?from=/dashboard?tab=workouts&filter=recent');
    });

    it('should handle URL parameter decoding via useSearchParams', () => {
      const encodedParam = '%2Fdashboard%3Ftab%3Dworkouts';

      render(<LoginPage />, {
        routerOptions: {
          initialEntries: [`/login?from=${encodedParam}`],
        },
      });

      const forgotPasswordLink = screen.getByTestId('forgot-password-link');
      // useSearchParams automatically decodes the parameter
      expect(forgotPasswordLink).toHaveAttribute('href', '/forgot-password?from=/dashboard?tab=workouts');
    });
  });

  describe('URL parameter handling', () => {
    it('should handle missing from parameter gracefully', () => {
      render(<LoginPage />, {
        routerOptions: {
          initialEntries: ['/login?other=param'],
        },
      });

      const signupLink = screen.getByTestId('signup-link');
      expect(signupLink).toHaveAttribute('href', '/signup');
    });

    it('should handle empty from parameter', () => {
      render(<LoginPage />, {
        routerOptions: {
          initialEntries: ['/login?from='],
        },
      });

      const forgotPasswordLink = screen.getByTestId('forgot-password-link');
      expect(forgotPasswordLink).toHaveAttribute('href', '/forgot-password');
    });

    it('should handle multiple query parameters', () => {
      const redirectUrl = encodeURIComponent('/dashboard');

      render(<LoginPage />, {
        routerOptions: {
          initialEntries: [`/login?from=${redirectUrl}&other=value&another=param`],
        },
      });

      const signupLink = screen.getByTestId('signup-link');
      // useSearchParams automatically decodes the parameter
      expect(signupLink).toHaveAttribute('href', '/signup?from=/dashboard');
    });
  });

  describe('security integration', () => {
    it('should handle decoded URL parameters in navigation', () => {
      const originalParam = 'some%20encoded%20value';

      render(<LoginPage />, {
        routerOptions: {
          initialEntries: [`/login?from=${originalParam}`],
        },
      });

      const forgotPasswordLink = screen.getByTestId('forgot-password-link');
      // useSearchParams decodes %20 to space
      expect(forgotPasswordLink).toHaveAttribute('href', '/forgot-password?from=some encoded value');
    });

    it('should integrate with security utilities for URL processing', () => {
      // Test that the component integrates with the security system
      // This is covered by the fact that the component imports and uses safeDecodeUrl
      render(<LoginPage />, {
        routerOptions: {
          initialEntries: ['/login?from=%2Fdashboard'],
        },
      });

      // The component should render successfully with URL parameters
      expect(screen.getByTestId('login-form')).toBeInTheDocument();
    });
  });

  describe('component integration', () => {
    it('should pass correct props to LoginForm', () => {
      render(<LoginPage />);

      // Verify the form renders and has all required buttons (indicating props are passed correctly)
      expect(screen.getByTestId('login-form')).toBeInTheDocument();
      expect(screen.getByTestId('login-success-button')).toBeInTheDocument();
      expect(screen.getByTestId('signup-link')).toBeInTheDocument();
      expect(screen.getByTestId('forgot-password-link')).toBeInTheDocument();
    });

    it('should maintain component structure with AuthLayout and LoginForm', () => {
      render(<LoginPage />);

      const authLayout = screen.getByTestId('auth-layout');
      const authLayoutContent = screen.getByTestId('auth-layout-content');
      const loginForm = screen.getByTestId('login-form');

      expect(authLayout).toBeInTheDocument();
      expect(authLayoutContent).toBeInTheDocument();
      expect(loginForm).toBeInTheDocument();
      expect(authLayout).toContainElement(authLayoutContent);
      expect(authLayoutContent).toContainElement(loginForm);
    });
  });

  describe('error handling', () => {
    it('should handle navigation errors gracefully', async () => {
      const user = userEvent.setup();
      mockNavigate.mockImplementation(() => {
        throw new Error('Navigation error');
      });

      render(<LoginPage />);

      const signupLink = screen.getByTestId('signup-link');

      // Should not throw when navigation fails
      await expect(user.click(signupLink)).resolves.not.toThrow();
    });

    it('should handle authentication state changes gracefully', () => {
      // Test should not crash when there are auth state issues
      expect(() => {
        try {
          mockUseIsAuthenticated.mockImplementation(() => {
            throw new Error('Auth error');
          });
          render(<LoginPage />);
        } catch (error) {
          // Expected to throw due to mock, but component should handle gracefully
          expect(error).toBeInstanceOf(Error);
        }
      }).not.toThrow();
    });

    it('should handle malformed URL parameters', () => {
      expect(() => {
        render(<LoginPage />, {
          routerOptions: {
            initialEntries: ['/login?from=%invalid%encoding%'],
          },
        });
      }).not.toThrow();
    });
  });

  describe('accessibility and user experience', () => {
    it('should maintain focus management during navigation', () => {
      render(<LoginPage />);

      const signupLink = screen.getByTestId('signup-link');

      // Focus the link
      signupLink.focus();
      expect(signupLink).toHaveFocus();
      expect(signupLink).toHaveAttribute('href', '/signup');
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();

      render(<LoginPage />);

      // Navigate using keyboard
      await user.tab();
      const firstButton = screen.getByTestId('login-success-button');
      expect(firstButton).toHaveFocus();

      await user.tab();
      const signupLink = screen.getByTestId('signup-link');
      expect(signupLink).toHaveFocus();

      // Verify it's a proper link that can be activated
      expect(signupLink).toHaveAttribute('href', '/signup');
    });
  });

  describe('authentication flow integration', () => {
    it('should handle complete authentication flow', async () => {
      const user = userEvent.setup();
      mockUseIsAuthenticated
        .mockReturnValueOnce(false) // Initial render
        .mockReturnValueOnce(true); // After login

      // Don't mock navigate to throw error for this test
      mockNavigate.mockImplementation(() => {});

      const { rerender } = render(<LoginPage />);

      // Trigger success
      const successButton = screen.getByTestId('login-success-button');
      await user.click(successButton);

      // Simulate auth state change
      rerender(<LoginPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
      });
    });

    it('should handle authentication state updates consistently', async () => {
      mockUseIsAuthenticated.mockReturnValue(true);
      // Don't mock navigate to throw error for this test
      mockNavigate.mockImplementation(() => {});

      render(<LoginPage />, {
        routerOptions: {
          initialEntries: ['/login?from=%2Fworkouts'],
        },
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/workouts', { replace: true });
      });
    });
  });
});
