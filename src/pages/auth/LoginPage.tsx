import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { AuthLayout, LoginForm } from '@/features/auth';
import { safeDecodeUrl } from '@/lib/security';
import { useIsAuthenticated } from '@/stores/auth.store';

/**
 * Login page that combines the AuthLayout with the LoginForm
 * Handles authentication flow and redirects after successful login
 *
 * Security features:
 * - Validates and sanitizes redirect URLs to prevent open redirect attacks
 * - Safely decodes URL parameters to prevent XSS attacks
 * - Preserves safe redirect destinations across auth flows
 */
export const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAuthenticated = useIsAuthenticated();

  // Securely get redirect destination from URL params
  // This prevents open redirect and XSS attacks by validating the URL
  const from = searchParams.get('from');
  const redirectTo = safeDecodeUrl(from, '/dashboard');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      // The redirectTo URL has already been validated and is safe
      void navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, redirectTo, navigate]);

  const handleSuccess = () => {
    // Navigation will happen via useEffect when isAuthenticated changes
    // This ensures consistent behavior with the auth state
  };

  const handleSignUpClick = () => {
    // Preserve the redirect destination when navigating to signup
    // Pass the encoded parameter as-is to maintain security validation
    const signupUrl = from ? `/signup?from=${from}` : '/signup';
    void navigate(signupUrl);
  };

  const handleForgotPasswordClick = () => {
    // Forgot password functionality coming soon
    // TODO: Implement forgot password page and navigation
  };

  return (
    <AuthLayout>
      <LoginForm
        onSuccess={handleSuccess}
        onSignUpClick={handleSignUpClick}
        onForgotPasswordClick={handleForgotPasswordClick}
      />
    </AuthLayout>
  );
};
