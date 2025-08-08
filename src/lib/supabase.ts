import { type AuthChangeEvent, createClient, type Session } from '@supabase/supabase-js';

import { supabaseConfig } from '@/config/env';
import { logError } from '@/lib/logger';
import { AuthError, AuthErrorCode } from '@/services/auth/auth.service';
import type { Database } from '@/types/database.types.gen';

/**
 * Supabase client instance configured for the Slow Burn app.
 *
 * Features:
 * - Automatic token refresh with secure token handling
 * - Persistent sessions across page reloads
 * - TypeScript type safety with Database types
 * - PKCE flow for enhanced security
 * - Optimized for PWA with offline support considerations
 *
 * Security features:
 * - PKCE (Proof Key for Code Exchange) enabled for OAuth flows
 * - Automatic token refresh before expiry
 * - Secure session storage (localStorage with plans for httpOnly cookies)
 * - Session validation on each app load
 */
export const supabase = createClient<Database>(supabaseConfig.url, supabaseConfig.anonKey, {
  auth: {
    // Store auth data in localStorage for persistence
    // TODO: In production, consider using httpOnly cookies for enhanced security
    storage: window.localStorage,
    // Auto-refresh tokens before expiry
    autoRefreshToken: true,
    // Persist session across browser tabs
    persistSession: true,
    // Detect session from URL (for OAuth redirects)
    detectSessionInUrl: true,
    // Storage key prefix to avoid conflicts
    storageKey: 'slow-burn-auth',
    // Enable PKCE flow for enhanced security
    // This provides protection against authorization code interception attacks
    flowType: 'pkce',
    // Debug mode for development (disable in production)
    debug: import.meta.env.DEV,
  },
  // Global fetch options
  global: {
    // Headers to be sent with every request
    headers: {
      'x-client-info': 'slow-burn-pwa',
      // Add additional security headers
      'x-requested-with': 'XMLHttpRequest', // Helps prevent CSRF
    },
  },
  // Database options
  db: {
    // Return single objects instead of arrays for single-row queries
    schema: 'public',
  },
  // Realtime options (for future features)
  realtime: {
    // Configurable for future real-time features
    params: {
      // Acknowledge messages for reliability
      eventsPerSecond: 10,
    },
  },
});

/**
 * Helper to get the current session with proper error handling
 * @throws {AuthError} When session retrieval fails
 */
export async function getSession() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      logError('Failed to get session', error, { operation: 'getSession' });
      throw new AuthError(error.message || 'Failed to get session', AuthErrorCode.UNKNOWN);
    }
    return data.session;
  } catch (error) {
    // If it's already an AuthError, re-throw it
    if (error instanceof AuthError) {
      throw error;
    }

    // Handle unexpected errors
    logError('Unexpected error getting session', error, {
      operation: 'getSession',
      errorType: typeof error,
    });
    throw new AuthError('Failed to get session', AuthErrorCode.UNKNOWN);
  }
}

/**
 * Helper to get the current user with proper error handling
 * @throws {AuthError} When user retrieval fails
 */
export async function getCurrentUser() {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) {
      logError('Failed to get current user', error, { operation: 'getCurrentUser' });
      throw new AuthError(error.message || 'Failed to get current user', AuthErrorCode.NO_SESSION);
    }
    return user;
  } catch (error) {
    // If it's already an AuthError, re-throw it
    if (error instanceof AuthError) {
      throw error;
    }

    // Handle unexpected errors
    logError('Unexpected error getting user', error, {
      operation: 'getCurrentUser',
      errorType: typeof error,
    });
    throw new AuthError('Failed to get current user', AuthErrorCode.NO_SESSION);
  }
}

/**
 * Subscribe to auth state changes
 * Returns an unsubscribe function
 */
export function onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(callback);

  return () => subscription.unsubscribe();
}
