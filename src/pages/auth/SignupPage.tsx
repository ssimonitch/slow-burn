import { AuthLayout, SignupForm } from '@/features/auth';

/**
 * Sign-up page that combines the AuthLayout with the SignupForm
 * Note: Navigation handlers will be implemented when react-router-dom is added (Task 8)
 */
export const SignupPage = () => {
  const handleSuccess = () => {
    // Will navigate to the main app after successful signup
    // Could also navigate to an email confirmation page
    // TODO: Navigate to main app or email confirmation when routing is implemented
  };

  const handleSignInClick = () => {
    // Will navigate to login page
    // TODO: Navigate to /login when routing is implemented
  };

  return (
    <AuthLayout>
      <SignupForm onSuccess={handleSuccess} onSignInClick={handleSignInClick} />
    </AuthLayout>
  );
};
