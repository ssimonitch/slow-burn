import { AuthLayout, ResetPasswordForm } from '@/features/auth';

/**
 * Reset password page that combines the AuthLayout with the ResetPasswordForm
 * Handles the password reset completion flow after user clicks the email link
 *
 * Security features:
 * - Validates reset token from URL hash
 * - Handles expired or invalid tokens gracefully
 * - Redirects to login after successful password reset
 */
export const ResetPasswordPage = () => {
  return (
    <AuthLayout>
      <ResetPasswordForm />
    </AuthLayout>
  );
};
