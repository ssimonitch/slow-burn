/**
 * Unit Tests for AuthService
 *
 * These tests verify the business logic in our auth service wrapper, including:
 * - Input validation using Zod schemas
 * - Error mapping from Supabase errors to our custom error codes
 * - Offline handling and network status checks
 * - Response normalization and type safety
 *
 * Note: These tests mock the Supabase client entirely. For integration testing
 * with real Supabase authentication, see auth.service.integration.test.ts
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { supabase } from '@/lib/supabase';
import { createMockSession, createMockSupabaseError, createMockUser } from '@/test/factories/auth';

import { AuthErrorCode, authService } from './auth.service';

// Mock the Supabase client
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      getSession: vi.fn(),
      getUser: vi.fn(),
      refreshSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
  },
  onAuthStateChange: vi.fn(),
}));

describe('AuthService Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });
  });

  describe('signUp', () => {
    it('should successfully sign up a new user with valid credentials', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession();

      vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const result = await authService.signUp({
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      });

      expect(result.error).toBeNull();
      expect(result.data?.user).toEqual(mockUser);
      expect(result.data?.session).toEqual(mockSession);
    });

    it('should validate email format and return error for invalid email', async () => {
      const result = await authService.signUp({
        email: 'invalid-email',
        password: 'password123',
        confirmPassword: 'password123',
      });

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe(AuthErrorCode.INVALID_EMAIL);
    });

    it('should validate password confirmation and return error for mismatch', async () => {
      const result = await authService.signUp({
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'different-password',
      });

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe(AuthErrorCode.WEAK_PASSWORD);
      expect(result.error?.message).toContain("Passwords don't match");
    });

    it('should detect offline status and return appropriate error', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false });

      const result = await authService.signUp({
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      });

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe(AuthErrorCode.OFFLINE);
    });
  });

  describe('signIn', () => {
    it('should successfully sign in a user', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession();

      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const result = await authService.signIn({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.error).toBeNull();
      expect(result.data?.user).toEqual(mockUser);
      expect(result.data?.session).toEqual(mockSession);
    });

    it('should map Supabase auth errors to custom error codes', async () => {
      const mockError = createMockSupabaseError({
        message: 'Invalid login credentials',
      });

      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
        data: { user: null, session: null },
        error: mockError,
      });

      const result = await authService.signIn({
        email: 'test@example.com',
        password: 'wrong-password',
      });

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe(AuthErrorCode.INVALID_CREDENTIALS);
    });
  });

  describe('signOut', () => {
    it('should successfully sign out a user', async () => {
      vi.mocked(supabase.auth.signOut).mockResolvedValueOnce({
        error: null,
      });

      const result = await authService.signOut();

      expect(result.error).toBeNull();
      expect(supabase.auth.signOut).toHaveBeenCalled();
    });
  });

  describe('getAccessToken', () => {
    it('should return access token from session', async () => {
      const mockSession = createMockSession();

      vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      const token = await authService.getAccessToken();

      expect(token).toBe('test-access-token');
    });

    it('should return null when no session', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });

      const token = await authService.getAccessToken();

      expect(token).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when session exists', async () => {
      const mockSession = createMockSession();

      vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      const isAuth = await authService.isAuthenticated();

      expect(isAuth).toBe(true);
    });

    it('should return false when no session', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });

      const isAuth = await authService.isAuthenticated();

      expect(isAuth).toBe(false);
    });
  });
});
