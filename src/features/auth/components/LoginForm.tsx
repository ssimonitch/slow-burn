import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Loader2 } from 'lucide-react';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { AuthErrorCode, type SignInCredentials } from '@/services/auth.service';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Validation schema for login form
 */
const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onSuccess?: () => void;
  redirectUrl?: string;
}

/**
 * Login form component with validation and error handling
 * Integrates with the auth store for authentication
 */
export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, redirectUrl }) => {
  const { signIn, loading, error: authError, clearError } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const handleSubmit = async (values: LoginFormValues) => {
    setIsSubmitting(true);
    clearError();

    try {
      const credentials: SignInCredentials = {
        email: values.email,
        password: values.password,
      };

      await signIn(credentials);
      onSuccess?.();
    } catch {
      // Error is already set in the store by signIn
      // No need to handle here as the error is displayed via authError from store
    } finally {
      setIsSubmitting(false);
    }
  };

  // Map auth error codes to user-friendly messages
  const getErrorMessage = () => {
    if (!authError) return null;

    switch (authError.code) {
      case AuthErrorCode.INVALID_CREDENTIALS:
        return 'Invalid email or password. Please try again.';
      case AuthErrorCode.NETWORK_ERROR:
      case AuthErrorCode.OFFLINE:
        return 'No internet connection. Please check your network and try again.';
      case AuthErrorCode.RATE_LIMITED:
        return 'Too many login attempts. Please wait a few minutes and try again.';
      case AuthErrorCode.EMAIL_NOT_CONFIRMED:
        return 'Please confirm your email address before logging in.';
      default:
        return authError.message || 'An error occurred during login. Please try again.';
    }
  };

  const errorMessage = getErrorMessage();
  const isLoading = isSubmitting || loading.signIn;

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
        <CardDescription>Enter your credentials to sign in to your account</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={(e) => void form.handleSubmit(handleSubmit)(e)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      disabled={isLoading}
                      className="h-11"
                      aria-label="Email address"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      disabled={isLoading}
                      className="h-11"
                      aria-label="Password"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {errorMessage && (
              <div
                className="border-destructive/50 bg-destructive/10 text-destructive flex items-center gap-2 rounded-md border p-3 text-sm"
                role="alert"
                aria-live="polite"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <Button type="submit" className="h-11 w-full text-base" disabled={isLoading} size="lg">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex flex-col space-y-2">
        <Link
          to={redirectUrl ? `/forgot-password?from=${redirectUrl}` : '/forgot-password'}
          className="text-muted-foreground hover:text-primary text-sm transition-colors"
          tabIndex={isLoading ? -1 : 0}
          aria-disabled={isLoading}
          style={isLoading ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
        >
          Forgot your password?
        </Link>
        <div className="text-muted-foreground text-sm">
          Don't have an account?{' '}
          <Link
            to={redirectUrl ? `/signup?from=${redirectUrl}` : '/signup'}
            className="text-primary font-medium hover:underline"
            tabIndex={isLoading ? -1 : 0}
            aria-disabled={isLoading}
            style={isLoading ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
          >
            Sign up
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
};
