/**
 * Test helpers for Supabase integration tests
 *
 * These utilities help with:
 * - Creating unique test users
 * - Cleaning up test data
 * - Managing test sessions
 * - Configuring test environments
 */

import type { Session, User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

// Test user configuration
export const TEST_USER_CONFIG = {
  emailDomain: '@slowburn-test.local',
  defaultPassword: 'TestPassword123!',
  userPrefix: 'test_',
} as const;

/**
 * Generate a unique test email
 */
export function generateTestEmail(identifier: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 7);
  return `${TEST_USER_CONFIG.userPrefix}${identifier}_${timestamp}_${random}${TEST_USER_CONFIG.emailDomain}`;
}

/**
 * Test user data interface
 */
export interface TestUser {
  email: string;
  password: string;
  user?: User;
  session?: Session;
}

/**
 * Create a test user with unique email
 */
export async function createTestUser(identifier: string): Promise<TestUser> {
  const email = generateTestEmail(identifier);
  const password = TEST_USER_CONFIG.defaultPassword;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // For local testing, you might want to disable email confirmation
      // This depends on your Supabase project settings
      data: {
        test_user: true,
        created_at: new Date().toISOString(),
      },
    },
  });

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`);
  }

  return {
    email,
    password,
    user: data.user ?? undefined,
    session: data.session ?? undefined,
  };
}

/**
 * Sign in a test user
 */
export async function signInTestUser(email: string, password: string): Promise<TestUser> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(`Failed to sign in test user: ${error.message}`);
  }

  return {
    email,
    password,
    user: data.user ?? undefined,
    session: data.session ?? undefined,
  };
}

/**
 * Clean up a test user
 * Note: Full deletion requires service role key. For now, we just sign out.
 */
export async function cleanupTestUser(email: string): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user?.email === email) {
      await supabase.auth.signOut();
    }

    // In a real test environment with service role key, you would:
    // await supabase.auth.admin.deleteUser(userId);
  } catch (error) {
    console.warn(`Failed to cleanup test user ${email}:`, error);
  }
}

/**
 * Wait for a condition to be true
 * Useful for waiting for async operations in tests
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: {
    timeout?: number;
    interval?: number;
    message?: string;
  } = {},
): Promise<void> {
  const { timeout = 5000, interval = 100, message = 'Condition not met' } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for condition: ${message}`);
}

/**
 * Mock offline state for testing
 */
export function mockOfflineState(): () => void {
  const originalOnline = navigator.onLine;

  Object.defineProperty(navigator, 'onLine', {
    value: false,
    configurable: true,
  });

  // Return cleanup function
  return () => {
    Object.defineProperty(navigator, 'onLine', {
      value: originalOnline,
      configurable: true,
    });
  };
}

/**
 * Test environment checker
 */
export function isIntegrationTestEnvironment(): boolean {
  return process.env.VITE_TEST_INTEGRATION === 'true';
}

/**
 * Skip integration tests if not in proper environment
 */
export function skipIfNotIntegration(): boolean {
  const skip = !isIntegrationTestEnvironment();

  if (skip) {
    console.log('⚠️  Skipping integration test. Set VITE_TEST_INTEGRATION=true to run.');
  }

  return skip;
}
