import { AuthLayout, LoginForm } from '@/features/auth';

/**
 * Login page that combines the AuthLayout with the LoginForm
 * Note: Navigation handlers will be implemented when react-router-dom is added (Task 8)
 */
export const LoginPage = () => {
  const handleSuccess = () => {
    // Will navigate to the main app after successful login
    // TODO: Navigate to main app when routing is implemented
  };

  const handleSignUpClick = () => {
    // Will navigate to signup page
    // TODO: Navigate to /signup when routing is implemented
  };

  const handleForgotPasswordClick = () => {
    // Will navigate to forgot password page
    // TODO: Navigate to /forgot-password when routing is implemented
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
