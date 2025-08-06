import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Check, Loader2, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { AuthErrorCode, type SignUpCredentials } from '@/services/auth/auth.service';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Validation schema for signup form
 */
const signupSchema = z
  .object({
    email: z.string().min(1, 'Email is required').email('Invalid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/\d/, 'Password must contain at least one number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    agreeToTerms: z.boolean().refine((val) => val === true, {
      message: 'You must agree to the terms of service',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type SignupFormValues = z.infer<typeof signupSchema>;

interface SignupFormProps {
  onSuccess?: () => void;
  onSignInClick?: () => void;
}

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
 * Sign-up form component with validation, password strength indicator, and error handling
 * Integrates with the auth store for user registration
 */
export const SignupForm: React.FC<SignupFormProps> = ({ onSuccess, onSignInClick }) => {
  const { signUp, loading, error: authError, clearError } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      agreeToTerms: false,
    },
  });

  const password = form.watch('password');
  const passwordStrength = useMemo(() => calculatePasswordStrength(password || ''), [password]);
  const passwordStrengthInfo = useMemo(() => getPasswordStrengthInfo(passwordStrength), [passwordStrength]);

  const handleSubmit = async (values: SignupFormValues) => {
    setIsSubmitting(true);
    clearError();

    try {
      const credentials: SignUpCredentials = {
        email: values.email,
        password: values.password,
        confirmPassword: values.confirmPassword,
      };

      await signUp(credentials);
      onSuccess?.();
    } catch {
      // Error is already set in the store by signUp
      // No need to handle here as the error is displayed via authError from store
    } finally {
      setIsSubmitting(false);
    }
  };

  // Map auth error codes to user-friendly messages
  const getErrorMessage = () => {
    if (!authError) return null;

    switch (authError.code) {
      case AuthErrorCode.INVALID_EMAIL:
        return 'Please enter a valid email address.';
      case AuthErrorCode.WEAK_PASSWORD:
        return 'Password does not meet the requirements.';
      case AuthErrorCode.NETWORK_ERROR:
      case AuthErrorCode.OFFLINE:
        return 'No internet connection. Please check your network and try again.';
      case AuthErrorCode.RATE_LIMITED:
        return 'Too many sign-up attempts. Please wait a few minutes and try again.';
      default:
        return authError.message || 'An error occurred during sign up. Please try again.';
    }
  };

  const errorMessage = getErrorMessage();
  const isLoading = isSubmitting || loading.signUp;

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
        <CardDescription>Enter your information to get started with Slow Burn</CardDescription>
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
                      placeholder="Create a strong password"
                      autoComplete="new-password"
                      disabled={isLoading}
                      className="h-11"
                      aria-label="Password"
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
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder="Re-enter your password"
                      autoComplete="new-password"
                      disabled={isLoading}
                      className="h-11"
                      aria-label="Confirm password"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="agreeToTerms"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-y-0 space-x-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isLoading}
                      aria-label="Agree to terms"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-sm font-normal">
                      I agree to the{' '}
                      <button type="button" className="text-primary font-medium hover:underline">
                        Terms of Service
                      </button>{' '}
                      and{' '}
                      <button type="button" className="text-primary font-medium hover:underline">
                        Privacy Policy
                      </button>
                    </FormLabel>
                    <FormMessage />
                  </div>
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
                  Creating account...
                </>
              ) : (
                'Create account'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter>
        <div className="text-muted-foreground w-full text-center text-sm">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSignInClick}
            disabled={isLoading}
            className="text-primary font-medium hover:underline disabled:opacity-50"
          >
            Sign in
          </button>
        </div>
      </CardFooter>
    </Card>
  );
};
