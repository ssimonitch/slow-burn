import type { AuthChangeEvent, AuthError as SupabaseAuthError, Session, User } from '@supabase/supabase-js';
import { z } from 'zod';

import { onAuthStateChange as supabaseOnAuthStateChange, supabase } from '@/lib/supabase';

/**
 * Custom error class for auth-related errors with additional context
 */
export class AuthError extends Error {
  code: AuthErrorCode;
  originalError?: unknown;

  constructor(message: string, code: AuthErrorCode, originalError?: unknown) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.originalError = originalError;
  }
}

/**
 * Auth error codes for consistent error handling across the app
 */
export const AuthErrorCode = {
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  OFFLINE: 'OFFLINE',

  // Auth errors
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_NOT_CONFIRMED: 'EMAIL_NOT_CONFIRMED',
  USER_NOT_FOUND: 'USER_NOT_FOUND',

  // Validation errors
  INVALID_EMAIL: 'INVALID_EMAIL',
  WEAK_PASSWORD: 'WEAK_PASSWORD',

  // Session errors
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  NO_SESSION: 'NO_SESSION',

  // Server errors
  SERVER_ERROR: 'SERVER_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',

  // Unknown
  UNKNOWN: 'UNKNOWN',
} as const;

export type AuthErrorCode = (typeof AuthErrorCode)[keyof typeof AuthErrorCode];

/**
 * Maps Supabase auth errors to our custom error codes
 */
function mapSupabaseError(error: SupabaseAuthError): AuthErrorCode {
  const message = error.message.toLowerCase();

  if (message.includes('network')) return AuthErrorCode.NETWORK_ERROR;
  if (message.includes('invalid login credentials')) return AuthErrorCode.INVALID_CREDENTIALS;
  if (message.includes('email not confirmed')) return AuthErrorCode.EMAIL_NOT_CONFIRMED;
  if (message.includes('user not found')) return AuthErrorCode.USER_NOT_FOUND;
  if (message.includes('rate limit')) return AuthErrorCode.RATE_LIMITED;
  if (message.includes('session')) return AuthErrorCode.SESSION_EXPIRED;

  return AuthErrorCode.UNKNOWN;
}

/**
 * Validation schemas for auth operations
 */
const authSchemas = {
  email: z.email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  signUp: z
    .object({
      email: z.email('Invalid email address'),
      password: z.string().min(8, 'Password must be at least 8 characters'),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "Passwords don't match",
      path: ['confirmPassword'],
    }),
};

/**
 * Types for auth operations
 */
export interface SignUpCredentials {
  email: string;
  password: string;
  confirmPassword: string;
}

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface AuthResponse<T = unknown> {
  data: T | null;
  error: AuthError | null;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
}

/**
 * Auth service class encapsulating all authentication operations
 */
class AuthService {
  /**
   * Sign up a new user
   */
  async signUp(credentials: SignUpCredentials): Promise<AuthResponse<{ user: User; session: Session | null }>> {
    try {
      // Validate input
      const validated = authSchemas.signUp.parse(credentials);

      // Check network status
      if (!navigator.onLine) {
        throw new AuthError('No internet connection. Please check your network and try again.', AuthErrorCode.OFFLINE);
      }

      // Attempt sign up
      const { data, error } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          // Email confirmation required for production
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
          data: {
            // Additional user metadata can be added here
            signup_source: 'web_app',
          },
        },
      });

      if (error) {
        throw new AuthError(error.message, mapSupabaseError(error), error);
      }

      if (!data.user) {
        throw new AuthError('Sign up failed. Please try again.', AuthErrorCode.UNKNOWN);
      }

      return { data: { user: data.user, session: data.session }, error: null };
    } catch (error) {
      if (error instanceof AuthError) {
        return { data: null, error };
      }

      if (error instanceof z.ZodError) {
        const firstError = error.issues[0];
        let errorCode: AuthErrorCode = AuthErrorCode.WEAK_PASSWORD;

        // Determine error code based on field path
        if (firstError.path.includes('email')) {
          errorCode = AuthErrorCode.INVALID_EMAIL;
        } else if (firstError.path.includes('password') || firstError.path.includes('confirmPassword')) {
          errorCode = AuthErrorCode.WEAK_PASSWORD;
        }

        return {
          data: null,
          error: new AuthError(firstError.message, errorCode, error),
        };
      }

      return {
        data: null,
        error: new AuthError('An unexpected error occurred', AuthErrorCode.UNKNOWN, error),
      };
    }
  }

  /**
   * Sign in an existing user
   */
  async signIn(credentials: SignInCredentials): Promise<AuthResponse<{ user: User; session: Session }>> {
    try {
      // Validate input
      const validated = {
        email: authSchemas.email.parse(credentials.email),
        password: authSchemas.password.parse(credentials.password),
      };

      // Check network status
      if (!navigator.onLine) {
        throw new AuthError('No internet connection. Please check your network and try again.', AuthErrorCode.OFFLINE);
      }

      // Attempt sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (error) {
        throw new AuthError(error.message, mapSupabaseError(error), error);
      }

      if (!data.user || !data.session) {
        throw new AuthError('Sign in failed. Please try again.', AuthErrorCode.UNKNOWN);
      }

      return { data: { user: data.user, session: data.session }, error: null };
    } catch (error) {
      if (error instanceof AuthError) {
        return { data: null, error };
      }

      if (error instanceof z.ZodError) {
        return {
          data: null,
          error: new AuthError('Invalid email or password format', AuthErrorCode.INVALID_CREDENTIALS, error),
        };
      }

      return {
        data: null,
        error: new AuthError('An unexpected error occurred', AuthErrorCode.UNKNOWN, error),
      };
    }
  }

  /**
   * Sign out the current user
   */
  async signOut(): Promise<AuthResponse<void>> {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw new AuthError(error.message, AuthErrorCode.UNKNOWN, error);
      }

      return { data: undefined, error: null };
    } catch (error) {
      if (error instanceof AuthError) {
        return { data: null, error };
      }

      return {
        data: null,
        error: new AuthError('Failed to sign out', AuthErrorCode.UNKNOWN, error),
      };
    }
  }

  /**
   * Send password reset email
   */
  async resetPassword(email: string): Promise<AuthResponse<void>> {
    try {
      // Validate email
      const validatedEmail = authSchemas.email.parse(email);

      // Check network status
      if (!navigator.onLine) {
        throw new AuthError('No internet connection. Please check your network and try again.', AuthErrorCode.OFFLINE);
      }

      const { error } = await supabase.auth.resetPasswordForEmail(validatedEmail, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        throw new AuthError(error.message, mapSupabaseError(error), error);
      }

      return { data: undefined, error: null };
    } catch (error) {
      if (error instanceof AuthError) {
        return { data: null, error };
      }

      if (error instanceof z.ZodError) {
        return {
          data: null,
          error: new AuthError('Invalid email address', AuthErrorCode.INVALID_EMAIL, error),
        };
      }

      return {
        data: null,
        error: new AuthError('Failed to send reset email', AuthErrorCode.UNKNOWN, error),
      };
    }
  }

  /**
   * Update user password (requires current session)
   */
  async updatePassword(newPassword: string): Promise<AuthResponse<User>> {
    try {
      // Validate password
      const validatedPassword = authSchemas.password.parse(newPassword);

      const { data, error } = await supabase.auth.updateUser({
        password: validatedPassword,
      });

      if (error) {
        throw new AuthError(error.message, mapSupabaseError(error), error);
      }

      if (!data.user) {
        throw new AuthError('Failed to update password', AuthErrorCode.UNKNOWN);
      }

      return { data: data.user, error: null };
    } catch (error) {
      if (error instanceof AuthError) {
        return { data: null, error };
      }

      if (error instanceof z.ZodError) {
        return {
          data: null,
          error: new AuthError('Password does not meet requirements', AuthErrorCode.WEAK_PASSWORD, error),
        };
      }

      return {
        data: null,
        error: new AuthError('Failed to update password', AuthErrorCode.UNKNOWN, error),
      };
    }
  }

  /**
   * Get current session
   */
  async getSession(): Promise<Session | null> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session;
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  }

  /**
   * Refresh the current session
   */
  async refreshSession(): Promise<AuthResponse<Session>> {
    try {
      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        throw new AuthError(error.message, mapSupabaseError(error), error);
      }

      if (!data.session) {
        throw new AuthError('No session to refresh', AuthErrorCode.NO_SESSION);
      }

      return { data: data.session, error: null };
    } catch (error) {
      if (error instanceof AuthError) {
        return { data: null, error };
      }

      return {
        data: null,
        error: new AuthError('Failed to refresh session', AuthErrorCode.UNKNOWN, error),
      };
    }
  }

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void): () => void {
    return supabaseOnAuthStateChange(callback);
  }

  /**
   * Get the current access token for API requests
   */
  async getAccessToken(): Promise<string | null> {
    const session = await this.getSession();
    return session?.access_token ?? null;
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession();
    return !!session;
  }
}

/**
 * Singleton instance of the auth service
 */
export const authService = new AuthService();

/**
 * Re-export types from Supabase for convenience
 */
export type { Session, User } from '@supabase/supabase-js';
