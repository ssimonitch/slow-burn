import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Check, CheckCircle, Loader2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { AuthErrorCode, authService } from '@/services/auth.service';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Validation schema for reset password form
 */
const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/\d/, 'Password must contain at least one number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

/**
 * Password strength requirements
 */
interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const passwordRequirements: PasswordRequirement[] = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'One number', test: (p) => /\d/.test(p) },
];

/**
 * Calculate password strength (0-4)
 */
const calculatePasswordStrength = (password: string): number => {
  return passwordRequirements.filter((req) => req.test(password)).length;
};

/**
 * Get password strength label and color
 */
const getPasswordStrengthInfo = (strength: number): { label: string; color: string } => {
  switch (strength) {
    case 0:
    case 1:
      return { label: 'Weak', color: 'bg-red-500' };
    case 2:
      return { label: 'Fair', color: 'bg-orange-500' };
    case 3:
      return { label: 'Good', color: 'bg-yellow-500' };
    case 4:
      return { label: 'Strong', color: 'bg-green-500' };
    default:
      return { label: '', color: '' };
  }
};

/**
 * Validate JWT token format
 */
const isValidJwtFormat = (token: string): boolean => {
  // JWT should have 3 parts separated by dots
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  // Each part should be base64url encoded (alphanumeric, dash, underscore)
  const base64UrlRegex = /^[A-Za-z0-9_-]+$/;
  return parts.every((part) => part.length > 0 && base64UrlRegex.test(part));
};

/**
 * Extract access token from URL hash fragment
 * Supabase returns the token in the format: #access_token=xxx&type=recovery&...
 */
const extractTokenFromHash = (): string | null => {
  const hash = window.location.hash;
  if (!hash) return null;

  const params = new URLSearchParams(hash.substring(1));
  const accessToken = params.get('access_token');
  const type = params.get('type');

  // Verify this is a recovery token with valid JWT format
  if (accessToken && type === 'recovery' && isValidJwtFormat(accessToken)) {
    return accessToken;
  }

  return null;
};

/**
 * Reset password form component with token validation and password strength indicator
 * Handles the password reset flow after user clicks the email link
 */
export const ResetPasswordForm = () => {
  const navigate = useNavigate();
  const { initialize } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [lastSubmitTime, setLastSubmitTime] = useState<number | null>(null);

  // Rate limiting: 5 second cooldown between submissions
  const SUBMIT_COOLDOWN = 5000; // 5 seconds

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const password = form.watch('password');
  const passwordStrength = useMemo(() => calculatePasswordStrength(password || ''), [password]);
  const passwordStrengthInfo = useMemo(() => getPasswordStrengthInfo(passwordStrength), [passwordStrength]);

  // Handle success redirect with cleanup
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        void navigate('/login');
      }, 3000);

      // Cleanup timeout on unmount
      return () => clearTimeout(timer);
    }
  }, [success, navigate]);

  // Check for token on mount
  useEffect(() => {
    const validateToken = () => {
      setIsValidatingToken(true);
      const token = extractTokenFromHash();

      if (!token) {
        setHasToken(false);
        setError('Invalid or expired reset link. Please request a new password reset.');
        setIsValidatingToken(false);
        return;
      }

      // Token format validation passed, Supabase will do final validation
      setHasToken(true);
      setIsValidatingToken(false);

      // Re-initialize auth state to pick up the recovery session
      void initialize();
    };

    validateToken();
  }, [initialize]);

  const handleSubmit = async (values: ResetPasswordFormValues) => {
    // Check rate limiting
    if (lastSubmitTime && Date.now() - lastSubmitTime < SUBMIT_COOLDOWN) {
      const remainingTime = Math.ceil((SUBMIT_COOLDOWN - (Date.now() - lastSubmitTime)) / 1000);
      setError(`Please wait ${remainingTime} seconds before trying again.`);
      return;
    }

    if (!hasToken) {
      setError('Invalid or expired reset link. Please request a new password reset.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setLastSubmitTime(Date.now());

    try {
      // Update the password using the recovery session
      const { error: updateError } = await authService.updatePassword(values.password);

      if (updateError) {
        // Sanitize error messages to prevent information leakage
        if (updateError.code === AuthErrorCode.SESSION_EXPIRED || updateError.code === AuthErrorCode.NO_SESSION) {
          setError('Your reset link has expired. Please request a new password reset.');
        } else if (updateError.code === AuthErrorCode.WEAK_PASSWORD) {
          setError('Password does not meet the security requirements.');
        } else if (updateError.code === AuthErrorCode.NETWORK_ERROR || updateError.code === AuthErrorCode.OFFLINE) {
          setError('Unable to connect. Please check your internet connection.');
        } else if (updateError.code === AuthErrorCode.RATE_LIMITED) {
          setError('Too many attempts. Please wait before trying again.');
        } else {
          // Security: Generic error message for unknown errors
          setError('Unable to reset password. Please try again or request a new reset link.');
        }
        setIsSubmitting(false);
        return;
      }

      // Success! Show success message and redirect
      setSuccess(true);
    } catch {
      // Security: Never expose internal errors
      setError('Unable to reset password. Please try again.');
      setIsSubmitting(false);
    }
  };

  // Loading state while validating token
  if (isValidatingToken) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
          <p className="text-muted-foreground mt-4 text-sm">Validating reset link...</p>
        </CardContent>
      </Card>
    );
  }

  // Success state
  if (success) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CheckCircle className="h-12 w-12 text-green-500" />
          <h3 className="mt-4 text-lg font-semibold">Password Reset Successful!</h3>
          <p className="text-muted-foreground mt-2 text-center text-sm">
            Your password has been updated successfully. Redirecting to login...
          </p>
        </CardContent>
      </Card>
    );
  }

  // Invalid/expired token state
  if (!hasToken && !isValidatingToken) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Invalid Reset Link</CardTitle>
          <CardDescription>This password reset link is invalid or has expired</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-destructive/50 bg-destructive/10 text-destructive flex items-center gap-2 rounded-md border p-3 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button asChild className="h-11 w-full text-base" size="lg">
            <Link to="/forgot-password">Request New Reset Link</Link>
          </Button>
        </CardContent>
        <CardFooter>
          <div className="text-muted-foreground w-full text-center text-sm">
            Remember your password?{' '}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Back to login
            </Link>
          </div>
        </CardFooter>
      </Card>
    );
  }

  // Main form
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Reset Your Password</CardTitle>
        <CardDescription>Enter your new password below</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit(handleSubmit)(e);
            }}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder="Create a strong password"
                      autoComplete="new-password"
                      disabled={isSubmitting}
                      className="h-11"
                      aria-label="New password"
                      onFocus={() => setShowPasswordRequirements(true)}
                      onBlur={() => setShowPasswordRequirements(false)}
                    />
                  </FormControl>
                  <FormMessage />

                  {/* Password strength indicator */}
                  {password && (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-1 gap-1">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <div
                              // eslint-disable-next-line react-x/no-array-index-key
                              key={i}
                              className={`h-1 flex-1 rounded-full transition-colors ${
                                i < passwordStrength ? passwordStrengthInfo.color : 'bg-muted'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs font-medium">{passwordStrengthInfo.label}</span>
                      </div>

                      {/* Password requirements checklist */}
                      {showPasswordRequirements && (
                        <div className="bg-muted/30 space-y-1 rounded-md border p-2">
                          {passwordRequirements.map((req) => (
                            <div key={req.label} className="flex items-center gap-2 text-xs">
                              {req.test(password) ? (
                                <Check className="h-3 w-3 text-green-500" />
                              ) : (
                                <X className="text-muted-foreground h-3 w-3" />
                              )}
                              <span
                                className={
                                  req.test(password) ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'
                                }
                              >
                                {req.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm New Password</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder="Re-enter your password"
                      autoComplete="new-password"
                      disabled={isSubmitting}
                      className="h-11"
                      aria-label="Confirm new password"
                    />
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
                  Resetting password...
                </>
              ) : (
                'Reset Password'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter>
        <div className="text-muted-foreground w-full text-center text-sm">
          Remember your password?{' '}
          <Link
            to="/login"
            className="text-primary font-medium hover:underline"
            tabIndex={isSubmitting ? -1 : 0}
            aria-disabled={isSubmitting}
            style={isSubmitting ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
          >
            Back to login
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
};
