/**
 * Integration Tests for AuthService
 *
 * These tests verify actual authentication flows against a real Supabase instance.
 * They test the complete authentication lifecycle including:
 * - Real sign-up and sign-in flows
 * - JWT token generation and validation
 * - Session management and refresh
 * - Error handling with actual Supabase responses
 *
 * Requirements:
 * - Local Supabase instance running (via Docker)
 * - Test environment variables configured
 *
 * Run these tests with: pnpm test:integration
 */

import type { Session } from '@supabase/supabase-js';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { supabase } from '@/lib/supabase';

import { AuthErrorCode, authService } from './auth.service';

// Test configuration
const TEST_USER_PREFIX = 'test_' + Date.now() + '_';
const TEST_EMAIL_DOMAIN = '@slowburn-test.local';

// Helper to generate unique test emails
function generateTestEmail(suffix: string): string {
  return `${TEST_USER_PREFIX}${suffix}${TEST_EMAIL_DOMAIN}`;
}

// Helper to clean up test users
async function cleanupTestUser(email: string): Promise<void> {
  try {
    // Admin deletion would require service role key
    // For now, we'll just sign out if signed in
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user?.email === email) {
      await supabase.auth.signOut();
    }
  } catch (error) {
    console.warn('Failed to cleanup test user:', error);
  }
}

describe('AuthService Integration Tests', () => {
  // Skip these tests if not in integration test environment
  const skipIntegration = !process.env.VITE_TEST_INTEGRATION;

  beforeAll(() => {
    if (skipIntegration) {
      console.log('⚠️  Skipping integration tests. Set VITE_TEST_INTEGRATION=true to run.');
    }
  });

  describe.skipIf(skipIntegration)('Sign Up Flow', () => {
    const testEmail = generateTestEmail('signup');
    const testPassword = 'TestPassword123!';

    afterEach(async () => {
      await cleanupTestUser(testEmail);
    });

    it('should successfully sign up a new user', async () => {
      const result = await authService.signUp({
        email: testEmail,
        password: testPassword,
        confirmPassword: testPassword,
      });

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      expect(result.data?.user?.email).toBe(testEmail);

      // Note: In a real test environment, you might need to handle email confirmation
      // For local testing, you can disable email confirmations in Supabase settings
    });

    it('should prevent duplicate email signups', async () => {
      // First signup
      await authService.signUp({
        email: testEmail,
        password: testPassword,
        confirmPassword: testPassword,
      });

      // Attempt duplicate signup
      const result = await authService.signUp({
        email: testEmail,
        password: testPassword,
        confirmPassword: testPassword,
      });

      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
      // The exact error code depends on Supabase configuration
    });

    it('should enforce password requirements', async () => {
      const result = await authService.signUp({
        email: testEmail,
        password: 'weak',
        confirmPassword: 'weak',
      });

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe(AuthErrorCode.WEAK_PASSWORD);
    });
  });

  describe.skipIf(skipIntegration)('Sign In Flow', () => {
    const testEmail = generateTestEmail('signin');
    const testPassword = 'TestPassword123!';

    beforeAll(async () => {
      // Create a test user for sign-in tests
      await authService.signUp({
        email: testEmail,
        password: testPassword,
        confirmPassword: testPassword,
      });
    });

    afterAll(async () => {
      await cleanupTestUser(testEmail);
    });

    afterEach(async () => {
      // Sign out after each test to ensure clean state
      await authService.signOut();
    });

    it('should successfully sign in with valid credentials', async () => {
      const result = await authService.signIn({
        email: testEmail,
        password: testPassword,
      });

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      expect(result.data?.user.email).toBe(testEmail);
      expect(result.data?.session).toBeDefined();
      expect(result.data?.session.access_token).toBeDefined();
    });

    it('should fail sign in with wrong password', async () => {
      const result = await authService.signIn({
        email: testEmail,
        password: 'WrongPassword123!',
      });

      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe(AuthErrorCode.INVALID_CREDENTIALS);
    });

    it('should fail sign in with non-existent email', async () => {
      const result = await authService.signIn({
        email: generateTestEmail('nonexistent'),
        password: testPassword,
      });

      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe(AuthErrorCode.INVALID_CREDENTIALS);
    });
  });

  describe.skipIf(skipIntegration)('Session Management', () => {
    const testEmail = generateTestEmail('session');
    const testPassword = 'TestPassword123!';
    let testSession: Session | null = null;

    beforeAll(async () => {
      // Create and sign in a test user
      await authService.signUp({
        email: testEmail,
        password: testPassword,
        confirmPassword: testPassword,
      });

      const { data } = await authService.signIn({
        email: testEmail,
        password: testPassword,
      });
      testSession = data?.session ?? null;
    });

    afterAll(async () => {
      await cleanupTestUser(testEmail);
    });

    it('should retrieve current session', async () => {
      const session = await authService.getSession();

      expect(session).toBeDefined();
      expect(session?.access_token).toBe(testSession?.access_token);
    });

    it('should retrieve current user', async () => {
      const user = await authService.getCurrentUser();

      expect(user).toBeDefined();
      expect(user?.email).toBe(testEmail);
    });

    it('should provide access token for API calls', async () => {
      const token = await authService.getAccessToken();

      expect(token).toBeDefined();
      expect(token).toBe(testSession?.access_token);
    });

    it('should correctly report authentication status', async () => {
      const isAuth = await authService.isAuthenticated();

      expect(isAuth).toBe(true);
    });

    it('should handle sign out', async () => {
      const result = await authService.signOut();

      expect(result.error).toBeNull();

      // Verify session is cleared
      const session = await authService.getSession();
      expect(session).toBeNull();

      const isAuth = await authService.isAuthenticated();
      expect(isAuth).toBe(false);
    });
  });

  describe.skipIf(skipIntegration)('Password Reset Flow', () => {
    const testEmail = generateTestEmail('reset');
    const testPassword = 'TestPassword123!';

    beforeAll(async () => {
      // Create a test user
      await authService.signUp({
        email: testEmail,
        password: testPassword,
        confirmPassword: testPassword,
      });
    });

    afterAll(async () => {
      await cleanupTestUser(testEmail);
    });

    it('should send password reset email for existing user', async () => {
      const result = await authService.resetPassword(testEmail);

      expect(result.error).toBeNull();
      // Note: In a real test, you'd verify the email was sent
      // For integration testing, we just verify the API call succeeded
    });

    it('should handle password reset for non-existent email gracefully', async () => {
      const result = await authService.resetPassword(generateTestEmail('nonexistent'));

      // Supabase typically doesn't reveal if email exists for security
      // So this might still return success
      expect(result.error).toBeNull();
    });
  });

  describe.skipIf(skipIntegration)('Error Handling', () => {
    it('should handle network errors appropriately', async () => {
      // This test would require mocking network conditions
      // or using a test proxy to simulate network failures

      // For now, we'll test offline detection
      const originalOnline = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true,
      });

      const result = await authService.signIn({
        email: 'test@example.com',
        password: 'password',
      });

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe(AuthErrorCode.OFFLINE);

      // Restore original value
      Object.defineProperty(navigator, 'onLine', {
        value: originalOnline,
        configurable: true,
      });
    });
  });

  describe.skipIf(skipIntegration)('Auth State Changes', () => {
    const testEmail = generateTestEmail('state');
    const testPassword = 'TestPassword123!';

    beforeAll(async () => {
      await authService.signUp({
        email: testEmail,
        password: testPassword,
        confirmPassword: testPassword,
      });
    });

    afterAll(async () => {
      await cleanupTestUser(testEmail);
    });

    it('should notify on auth state changes', async () => {
      const stateChanges: { event: string; session: Session | null }[] = [];

      // Subscribe to auth state changes
      const unsubscribe = authService.onAuthStateChange((event, session) => {
        stateChanges.push({ event, session });
      });

      // Trigger sign in
      await authService.signIn({
        email: testEmail,
        password: testPassword,
      });

      // Trigger sign out
      await authService.signOut();

      // Clean up subscription
      unsubscribe();

      // Verify state changes were captured
      expect(stateChanges.length).toBeGreaterThan(0);
      expect(stateChanges.some((change) => change.event === 'SIGNED_IN')).toBe(true);
      expect(stateChanges.some((change) => change.event === 'SIGNED_OUT')).toBe(true);
    });
  });
});
