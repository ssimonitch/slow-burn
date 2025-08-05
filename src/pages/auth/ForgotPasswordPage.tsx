import { useSearchParams } from 'react-router-dom';

import { AuthLayout, ForgotPasswordForm } from '@/features/auth';

/**
 * Forgot password page that combines the AuthLayout with the ForgotPasswordForm
 * Handles password reset request flow and navigation between auth pages
 *
 * Security features:
 * - Preserves redirect URLs when navigating between auth pages
 * - Safely encodes URL parameters to prevent injection attacks
 */
export const ForgotPasswordPage = () => {
  const [searchParams] = useSearchParams();

  // Preserve the redirect destination from URL params when navigating
  const from = searchParams.get('from');

  return (
    <AuthLayout>
      <ForgotPasswordForm redirectUrl={from ?? undefined} />
    </AuthLayout>
  );
};
