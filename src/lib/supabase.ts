import { type AuthChangeEvent, createClient, type Session } from '@supabase/supabase-js';

import { supabaseConfig } from '@/config/env';
import { AppError, handleAuthError } from '@/lib/errors';
import type { Database } from '@/types/database.types.gen';

/**
 * Supabase client instance configured for the Slow Burn app.
 *
 * Features:
 * - Automatic token refresh
 * - Persistent sessions across page reloads
 * - TypeScript type safety with Database types
 * - Optimized for PWA with offline support considerations
 */
export const supabase = createClient<Database>(supabaseConfig.url, supabaseConfig.anonKey, {
  auth: {
    // Store auth data in localStorage for persistence
    storage: window.localStorage,
    // Auto-refresh tokens before expiry
    autoRefreshToken: true,
    // Persist session across browser tabs
    persistSession: true,
    // Detect session from URL (for OAuth redirects)
    detectSessionInUrl: true,
    // Storage key prefix to avoid conflicts
    storageKey: 'slow-burn-auth',
  },
  // Global fetch options
  global: {
    // Headers to be sent with every request
    headers: {
      'x-client-info': 'slow-burn-pwa',
    },
  },
  // Realtime options (for future features)
});

/**
 * Helper to get the current session with proper error handling
 * @throws {AppError} When session retrieval fails
 */
export async function getSession() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw handleAuthError(error, 'getSession');
    }
    return data.session;
  } catch (error) {
    // If it's already an AppError, re-throw it
    if (error instanceof AppError) {
      throw error;
    }

    // Handle unexpected errors
    throw handleAuthError(error, 'getSession', {
      unexpected: true,
      errorType: typeof error,
    });
  }
}

/**
 * Helper to get the current user with proper error handling
 * @throws {AppError} When user retrieval fails
 */
export async function getCurrentUser() {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) {
      throw handleAuthError(error, 'getCurrentUser');
    }
    return user;
  } catch (error) {
    // If it's already an AppError, re-throw it
    if (error instanceof AppError) {
      throw error;
    }

    // Handle unexpected errors
    throw handleAuthError(error, 'getCurrentUser', {
      unexpected: true,
      errorType: typeof error,
    });
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
