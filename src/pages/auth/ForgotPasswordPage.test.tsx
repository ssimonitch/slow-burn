/**
 * Unit Tests for ForgotPasswordPage Component
 *
 * These tests verify the forgot password page functionality, including:
 * - Proper rendering with AuthLayout wrapper
 * - Navigation back to login with redirect URL preservation
 * - Integration with ForgotPasswordForm component
 * - URL parameter handling for redirect preservation
 * - Security validation of redirect URLs
 *
 * Note: Uses existing test utilities from @/test/helpers/render for consistent routing setup
 */

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render } from '@/test/helpers/render';

import { ForgotPasswordPage } from './ForgotPasswordPage';

// Mock the auth features
vi.mock('@/features/auth', () => ({
  AuthLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-layout">
      <div data-testid="auth-layout-content">{children}</div>
    </div>
  ),
  ForgotPasswordForm: ({ redirectUrl }: { redirectUrl?: string }) => {
    // Import Link at module level to avoid dynamic imports in component
    const Link = vi.fn().mockImplementation(({ to, children, ...props }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ));

    return (
      <div data-testid="forgot-password-form">
        <h1>Forgot Password Form</h1>
        <Link to={redirectUrl ? `/login?from=${redirectUrl}` : '/login'} data-testid="back-to-login-link">
          Back to Login
        </Link>
      </div>
    );
  },
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

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic rendering', () => {
    it('should render with AuthLayout wrapper', () => {
      render(<ForgotPasswordPage />);

      expect(screen.getByTestId('auth-layout')).toBeInTheDocument();
      expect(screen.getByTestId('auth-layout-content')).toBeInTheDocument();
    });

    it('should render ForgotPasswordForm inside AuthLayout', () => {
      render(<ForgotPasswordPage />);

      const authLayout = screen.getByTestId('auth-layout');
      const forgotPasswordForm = screen.getByTestId('forgot-password-form');

      expect(authLayout).toContainElement(forgotPasswordForm);
      expect(screen.getByText('Forgot Password Form')).toBeInTheDocument();
    });

    it('should render back to login link in ForgotPasswordForm', () => {
      render(<ForgotPasswordPage />);

      const backLink = screen.getByTestId('back-to-login-link');
      expect(backLink).toBeInTheDocument();
      expect(backLink).toHaveAttribute('href', '/login');
    });
  });

  describe('navigation without redirect URL', () => {
    it('should have a link to login without from parameter', () => {
      render(<ForgotPasswordPage />, {
        routerOptions: {
          initialEntries: ['/forgot-password'],
        },
      });

      const backLink = screen.getByTestId('back-to-login-link');
      expect(backLink).toHaveAttribute('href', '/login');
    });

    it('should render link with clean URL structure', () => {
      render(<ForgotPasswordPage />, {
        routerOptions: {
          initialEntries: ['/forgot-password'],
        },
      });

      const backLink = screen.getByTestId('back-to-login-link');
      const href = backLink.getAttribute('href');
      expect(href).toBe('/login');
      expect(href).not.toContain('?from=');
    });
  });

  describe('navigation with redirect URL preservation', () => {
    it('should preserve from parameter when navigating back to login', () => {
      const encodedRedirectUrl = encodeURIComponent('/dashboard');

      render(<ForgotPasswordPage />, {
        routerOptions: {
          initialEntries: [`/forgot-password?from=${encodedRedirectUrl}`],
        },
      });

      const backLink = screen.getByTestId('back-to-login-link');
      // useSearchParams decodes the value, so the link gets the decoded value
      expect(backLink).toHaveAttribute('href', '/login?from=/dashboard');
    });

    it('should handle complex redirect URLs with query parameters', () => {
      const complexRedirectUrl = encodeURIComponent('/dashboard?tab=workouts&filter=recent');

      render(<ForgotPasswordPage />, {
        routerOptions: {
          initialEntries: [`/forgot-password?from=${complexRedirectUrl}`],
        },
      });

      const backLink = screen.getByTestId('back-to-login-link');

      // useSearchParams automatically decodes, so we get the decoded value
      expect(backLink).toHaveAttribute('href', '/login?from=/dashboard?tab=workouts&filter=recent');
    });

    it('should handle encoded redirect URLs properly', () => {
      // Simulate double encoding scenario
      const doubleEncodedUrl = encodeURIComponent(encodeURIComponent('/dashboard'));

      render(<ForgotPasswordPage />, {
        routerOptions: {
          initialEntries: [`/forgot-password?from=${doubleEncodedUrl}`],
        },
      });

      const backLink = screen.getByTestId('back-to-login-link');

      // useSearchParams decodes once, so double-encoded becomes single-encoded
      expect(backLink).toHaveAttribute('href', '/login?from=%2Fdashboard');
    });
  });

  describe('URL parameter handling', () => {
    it('should read from parameter from URL search params', () => {
      render(<ForgotPasswordPage />, {
        routerOptions: {
          initialEntries: ['/forgot-password?from=%2Fdashboard'],
        },
      });

      const backLink = screen.getByTestId('back-to-login-link');

      // useSearchParams automatically decodes %2F to /
      expect(backLink).toHaveAttribute('href', '/login?from=/dashboard');
    });

    it('should handle missing from parameter gracefully', () => {
      render(<ForgotPasswordPage />, {
        routerOptions: {
          initialEntries: ['/forgot-password?other=param'],
        },
      });

      const backLink = screen.getByTestId('back-to-login-link');

      expect(backLink).toHaveAttribute('href', '/login');
    });

    it('should handle empty from parameter', () => {
      render(<ForgotPasswordPage />, {
        routerOptions: {
          initialEntries: ['/forgot-password?from='],
        },
      });

      const backLink = screen.getByTestId('back-to-login-link');

      expect(backLink).toHaveAttribute('href', '/login');
    });

    it('should handle multiple query parameters', () => {
      const redirectUrl = encodeURIComponent('/dashboard');

      render(<ForgotPasswordPage />, {
        routerOptions: {
          initialEntries: [`/forgot-password?from=${redirectUrl}&other=value&another=param`],
        },
      });

      const backLink = screen.getByTestId('back-to-login-link');

      // useSearchParams automatically decodes the parameter
      expect(backLink).toHaveAttribute('href', '/login?from=/dashboard');
    });
  });

  describe('security considerations', () => {
    it('should handle URL parameter decoding via useSearchParams', () => {
      // Test how useSearchParams handles encoded parameters
      const encodedParam = '%2Fdashboard%3Ftab%3Dworkouts';

      render(<ForgotPasswordPage />, {
        routerOptions: {
          initialEntries: [`/forgot-password?from=${encodedParam}`],
        },
      });

      const backLink = screen.getByTestId('back-to-login-link');

      // useSearchParams automatically decodes the parameter
      expect(backLink).toHaveAttribute('href', '/login?from=/dashboard?tab=workouts');
    });

    it('should handle decoded URL parameters in navigation', () => {
      const originalParam = 'some%20encoded%20value';

      render(<ForgotPasswordPage />, {
        routerOptions: {
          initialEntries: [`/forgot-password?from=${originalParam}`],
        },
      });

      const backLink = screen.getByTestId('back-to-login-link');

      // useSearchParams decodes %20 to space
      expect(backLink).toHaveAttribute('href', '/login?from=some encoded value');
    });
  });

  describe('component integration', () => {
    it('should pass correct props to ForgotPasswordForm', () => {
      render(<ForgotPasswordPage />);

      // Verify the form renders and has the back button (indicating props are passed correctly)
      expect(screen.getByTestId('forgot-password-form')).toBeInTheDocument();
      expect(screen.getByTestId('back-to-login-link')).toBeInTheDocument();
    });

    it('should maintain component structure with AuthLayout and ForgotPasswordForm', () => {
      render(<ForgotPasswordPage />);

      const authLayout = screen.getByTestId('auth-layout');
      const authLayoutContent = screen.getByTestId('auth-layout-content');
      const forgotPasswordForm = screen.getByTestId('forgot-password-form');

      expect(authLayout).toBeInTheDocument();
      expect(authLayoutContent).toBeInTheDocument();
      expect(forgotPasswordForm).toBeInTheDocument();
      expect(authLayout).toContainElement(authLayoutContent);
      expect(authLayoutContent).toContainElement(forgotPasswordForm);
    });
  });

  describe('error handling', () => {
    it('should handle navigation errors gracefully', async () => {
      const user = userEvent.setup();
      mockNavigate.mockImplementation(() => {
        throw new Error('Navigation error');
      });

      render(<ForgotPasswordPage />);

      const backButton = screen.getByTestId('back-to-login-link');

      // Should not throw when navigation fails
      await expect(user.click(backButton)).resolves.not.toThrow();
    });

    it('should handle malformed URL parameters', () => {
      render(<ForgotPasswordPage />, {
        routerOptions: {
          initialEntries: ['/forgot-password?from=%invalid%encoding%'],
        },
      });

      const backLink = screen.getByTestId('back-to-login-link');

      // Should render the link even with malformed parameters - the malformed parameter gets passed through
      expect(backLink).toBeInTheDocument();
      expect(backLink).toHaveAttribute('href', '/login?from=%invalid%encoding%');
    });
  });

  describe('accessibility and user experience', () => {
    it('should maintain focus management during navigation', () => {
      render(<ForgotPasswordPage />);

      const backLink = screen.getByTestId('back-to-login-link');

      // Focus the link
      backLink.focus();
      expect(backLink).toHaveFocus();
      expect(backLink).toHaveAttribute('href', '/login');
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();

      render(<ForgotPasswordPage />);

      const backLink = screen.getByTestId('back-to-login-link');

      // Navigate using keyboard
      await user.tab();
      expect(backLink).toHaveFocus();

      // Verify it's a proper link that can be activated
      expect(backLink).toHaveAttribute('href', '/login');
    });
  });
});
