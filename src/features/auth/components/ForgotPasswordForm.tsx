import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ArrowLeft, CheckCircle, Loader2, Mail } from 'lucide-react';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { authToast, toast } from '@/lib/toast';
import { AuthErrorCode, authService } from '@/services/auth/auth.service';

/**
 * Validation schema for forgot password form
 */
const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

interface ForgotPasswordFormProps {
  redirectUrl?: string;
}

/**
 * Forgot password form component with validation and error handling
 * Allows users to request a password reset email
 */
export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({ redirectUrl }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string>('');
  const [lastRequestTime, setLastRequestTime] = useState<number | null>(null);

  // Rate limiting: 60 second cooldown between requests
  const RATE_LIMIT_COOLDOWN = 60000; // 60 seconds

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const handleSubmit = async (values: ForgotPasswordFormValues) => {
    // Check rate limiting
    if (lastRequestTime && Date.now() - lastRequestTime < RATE_LIMIT_COOLDOWN) {
      const remainingTime = Math.ceil((RATE_LIMIT_COOLDOWN - (Date.now() - lastRequestTime)) / 1000);
      setError(`Please wait ${remainingTime} seconds before requesting another reset.`);
      toast.warning('Too soon to request another reset', {
        description: `Please wait ${remainingTime} seconds before trying again.`,
      });
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Track request time for rate limiting
      setLastRequestTime(Date.now());

      const result = await authService.resetPassword(values.email);

      if (result.error) {
        // Sanitize error messages to prevent information leakage
        switch (result.error.code) {
          case AuthErrorCode.INVALID_EMAIL:
            setError('Please enter a valid email address.');
            break;
          case AuthErrorCode.NETWORK_ERROR:
          case AuthErrorCode.OFFLINE:
            setError('Unable to connect. Please check your internet connection.');
            break;
          case AuthErrorCode.RATE_LIMITED:
            setError('Too many attempts. Please wait before trying again.');
            break;
          case AuthErrorCode.USER_NOT_FOUND:
            // Security: Always show success to prevent email enumeration
            setIsSuccess(true);
            setSubmittedEmail(values.email);
            break;
          default:
            // Security: Show generic success for any other error to prevent info leakage
            setIsSuccess(true);
            setSubmittedEmail(values.email);
        }
      } else {
        // Success
        setIsSuccess(true);
        setSubmittedEmail(values.email);
        authToast.passwordResetEmailSent(values.email);
      }
    } catch {
      // Security: Never expose internal errors to users
      setError('Unable to process request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTryAgain = () => {
    setIsSuccess(false);
    setError(null);
    form.reset();
  };

  // Show success state
  if (isSuccess) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
            <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
          <CardDescription className="mt-2">
            We've sent a password reset link to <span className="font-medium">{submittedEmail}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-muted-foreground text-sm">
                Click the link in the email to reset your password. If you don't see it, check your spam folder.
              </p>
            </div>
            <p className="text-muted-foreground text-center text-sm">
              The link will expire in 1 hour for security reasons.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <Button asChild variant="default" className="h-11 w-full text-base" size="lg">
            <Link to={redirectUrl ? `/login?from=${redirectUrl}` : '/login'}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to login
            </Link>
          </Button>
          <button
            type="button"
            onClick={handleTryAgain}
            className="text-muted-foreground hover:text-primary text-sm transition-colors"
          >
            Didn't receive the email? Try again
          </button>
        </CardFooter>
      </Card>
    );
  }

  // Show form
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Reset your password</CardTitle>
        <CardDescription>Enter your email address and we'll send you a link to reset your password</CardDescription>
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
                    <div className="relative">
                      <Mail className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                      <Input
                        {...field}
                        type="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        disabled={isSubmitting}
                        className="h-11 pl-10"
                        aria-label="Email address"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {error && (
              <div
                className="border-destructive/50 bg-destructive/10 text-destructive flex items-center gap-2 rounded-md border p-3 text-sm"
                role="alert"
                aria-live="polite"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="h-11 w-full text-base" disabled={isSubmitting} size="lg">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending reset link...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send reset link
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter>
        <Link
          to={redirectUrl ? `/login?from=${redirectUrl}` : '/login'}
          className="text-muted-foreground hover:text-primary mx-auto flex items-center gap-2 text-sm transition-colors"
          tabIndex={isSubmitting ? -1 : 0}
          aria-disabled={isSubmitting}
          style={isSubmitting ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
        >
          <ArrowLeft className="h-3 w-3" />
          Back to login
        </Link>
      </CardFooter>
    </Card>
  );
};
