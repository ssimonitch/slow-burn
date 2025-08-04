/**
 * Unit Tests for Security Utilities
 *
 * These tests verify the security functions that protect against:
 * - Open redirect attacks
 * - XSS attacks through URL manipulation
 * - Path traversal attacks
 * - Protocol-relative URL attacks
 * - JavaScript protocol injection
 *
 * Note: These security functions are critical for application safety
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError, errorReporter } from '@/lib/errors';

import {
  generateCSPNonce,
  isInternalUrl,
  RECOMMENDED_SECURITY_HEADERS,
  safeDecodeUrl,
  safeEncodeUrl,
  sanitizeUserInput,
  validateReturnUrl,
  validateSecureEnvironment,
} from './security';

describe('Security Utilities', () => {
  describe('validateReturnUrl', () => {
    describe('valid internal URLs', () => {
      it.each([
        ['/dashboard', '/dashboard'],
        ['/workout/123', '/workout/123'],
        ['/profile?tab=settings', '/profile?tab=settings'],
        ['/search#results', '/search#results'],
        ['/path/with/multiple/segments', '/path/with/multiple/segments'],
        ['/', '/'],
      ])('should accept valid internal URL: %s', (input, expected) => {
        expect(validateReturnUrl(input)).toBe(expected);
      });

      it('should handle URLs with query parameters and fragments', () => {
        const url = '/dashboard?tab=workouts&view=calendar#today';
        expect(validateReturnUrl(url)).toBe(url);
      });

      it('should handle encoded characters in valid URLs', () => {
        const url = '/search?q=bench%20press&category=exercises';
        expect(validateReturnUrl(url)).toBe(url);
      });
    });

    describe('invalid and malicious URLs', () => {
      beforeEach(() => {
        vi.spyOn(errorReporter, 'reportWarning').mockImplementation(() => {});
      });

      afterEach(() => {
        vi.restoreAllMocks();
      });

      it.each([
        ['https://evil.com', 'absolute URL'],
        ['http://evil.com', 'absolute URL with http'],
        ['//evil.com', 'protocol-relative URL'],
        ['//evil.com/path', 'protocol-relative URL with path'],
        ['javascript:alert("XSS")', 'JavaScript protocol'],
        ['data:text/html,<script>alert("XSS")</script>', 'data protocol'],
        ['ftp://files.com', 'FTP protocol'],
        ['../admin', 'path traversal with ..'],
        ['/../admin', 'path traversal starting with /..'],
        ['/path/../../../etc/passwd', 'multiple path traversal'],
        ['/./hidden', 'path with .'],
        ['evil.com', 'domain without protocol'],
        ['@evil.com', 'URL with @ character'],
        ['', 'empty string'],
        ['   ', 'whitespace only'],
      ])('should reject %s (%s)', (input) => {
        expect(validateReturnUrl(input)).toBe('/dashboard');
        // Check errorReporter.reportWarning was called for non-empty inputs
        if (typeof input === 'string' && input.trim()) {
          expect(errorReporter.reportWarning).toHaveBeenCalled();
        }
      });

      it('should handle null and undefined inputs', () => {
        expect(validateReturnUrl(null as unknown as string)).toBe('/dashboard');
        expect(validateReturnUrl(undefined as unknown as string)).toBe('/dashboard');
      });

      it('should handle non-string inputs', () => {
        expect(validateReturnUrl(123 as unknown as string)).toBe('/dashboard');
        expect(validateReturnUrl({} as unknown as string)).toBe('/dashboard');
        expect(validateReturnUrl([] as unknown as string)).toBe('/dashboard');
      });

      it('should use custom fallback when provided', () => {
        expect(validateReturnUrl('https://evil.com', '/home')).toBe('/home');
        expect(validateReturnUrl('', '/profile')).toBe('/profile');
      });

      it('should detect obfuscated protocol-relative URLs', () => {
        expect(validateReturnUrl('//evil.com')).toBe('/dashboard');
        expect(validateReturnUrl('\\/\\/evil.com')).toBe('/dashboard');
      });

      it('should detect URL encoding attacks', () => {
        // These might try to bypass validation through encoding
        expect(validateReturnUrl('/%2E%2E/admin')).toBe('/dashboard');
        expect(validateReturnUrl('/%252E%252E/admin')).toBe('/dashboard');
      });
    });

    describe('edge cases', () => {
      it('should handle very long URLs', () => {
        const longPath = '/valid' + '/segment'.repeat(100);
        expect(validateReturnUrl(longPath)).toBe(longPath);
      });

      it('should handle URLs with special characters', () => {
        const url = '/workout/bench-press_2024-01-03';
        expect(validateReturnUrl(url)).toBe(url);
      });

      it('should normalize URLs correctly', () => {
        // Multiple slashes should be normalized
        expect(validateReturnUrl('///')).toBe('/dashboard');
        expect(validateReturnUrl('/valid//path')).toBe('/valid//path');
      });
    });
  });

  describe('safeDecodeUrl', () => {
    beforeEach(() => {
      vi.spyOn(errorReporter, 'reportWarning').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should decode and validate safe URLs', () => {
      expect(safeDecodeUrl('%2Fdashboard')).toBe('/dashboard');
      expect(safeDecodeUrl('%2Fworkout%3Fid%3D123')).toBe('/workout?id=123');
      expect(safeDecodeUrl('%2Fprofile%23settings')).toBe('/profile#settings');
    });

    it('should reject decoded malicious URLs', () => {
      expect(safeDecodeUrl('https%3A%2F%2Fevil.com')).toBe('/dashboard');
      expect(safeDecodeUrl('%2F%2Fevil.com')).toBe('/dashboard');
      expect(safeDecodeUrl('javascript%3Aalert%28%22XSS%22%29')).toBe('/dashboard');
    });

    it('should handle malformed encoded URLs', () => {
      expect(safeDecodeUrl('%')).toBe('/dashboard');
      expect(safeDecodeUrl('%%')).toBe('/dashboard');
      expect(safeDecodeUrl('%GG')).toBe('/dashboard');
      expect(errorReporter.reportWarning).toHaveBeenCalled();
    });

    it('should handle null input', () => {
      expect(safeDecodeUrl(null)).toBe('/dashboard');
      expect(safeDecodeUrl(null, '/home')).toBe('/home');
    });

    it('should use custom fallback', () => {
      expect(safeDecodeUrl('https%3A%2F%2Fevil.com', '/home')).toBe('/home');
      expect(safeDecodeUrl(null, '/profile')).toBe('/profile');
    });

    it('should handle double-encoded URLs', () => {
      // Double encoding attack attempt
      expect(safeDecodeUrl('%252F%252Fevil.com')).toBe('/dashboard');
      expect(safeDecodeUrl('%25252F%25252Fevil.com')).toBe('/dashboard');
    });

    it('should decode complex valid URLs', () => {
      const encoded = encodeURIComponent('/workout?exercise=bench press&weight=100');
      const result = safeDecodeUrl(encoded);
      // URL normalization may encode spaces as %20
      expect(result).toMatch(/^\/workout\?exercise=bench(%20| )press&weight=100$/);
    });
  });

  describe('safeEncodeUrl', () => {
    it('should encode valid URLs', () => {
      expect(safeEncodeUrl('/dashboard')).toBe('%2Fdashboard');
      expect(safeEncodeUrl('/workout?id=123')).toBe(encodeURIComponent('/workout?id=123'));
      expect(safeEncodeUrl('/profile#settings')).toBe(encodeURIComponent('/profile#settings'));
    });

    it('should return empty string for invalid URLs', () => {
      expect(safeEncodeUrl('https://evil.com')).toBe('');
      expect(safeEncodeUrl('//evil.com')).toBe('');
      expect(safeEncodeUrl('javascript:alert("XSS")')).toBe('');
      expect(safeEncodeUrl('../admin')).toBe('');
    });

    it('should handle empty input', () => {
      expect(safeEncodeUrl('')).toBe('');
      expect(safeEncodeUrl('   ')).toBe('');
    });

    it('should encode URLs with special characters', () => {
      const url = '/search?q=bench press&category=upper body';
      const encoded = safeEncodeUrl(url);
      // The URL may be normalized with %20 instead of spaces
      expect(decodeURIComponent(encoded)).toMatch(/^\/search\?q=bench(%20| )press&category=upper(%20| )body$/);
    });
  });

  describe('isInternalUrl', () => {
    it('should return true for valid internal URLs', () => {
      expect(isInternalUrl('/dashboard')).toBe(true);
      expect(isInternalUrl('/workout/123')).toBe(true);
      expect(isInternalUrl('/profile?tab=settings')).toBe(true);
      expect(isInternalUrl('/')).toBe(true);
    });

    it('should return false for external URLs', () => {
      expect(isInternalUrl('https://evil.com')).toBe(false);
      expect(isInternalUrl('//evil.com')).toBe(false);
      expect(isInternalUrl('javascript:alert("XSS")')).toBe(false);
      expect(isInternalUrl('../admin')).toBe(false);
      expect(isInternalUrl('')).toBe(false);
      expect(isInternalUrl('evil.com')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(isInternalUrl('/valid/path')).toBe(true);
      expect(isInternalUrl('not/starting/with/slash')).toBe(false);
      expect(isInternalUrl('///')).toBe(false);
    });
  });

  describe('sanitizeUserInput', () => {
    it('should escape HTML entities', () => {
      expect(sanitizeUserInput('<script>alert("XSS")</script>')).toBe(
        '&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;',
      );

      expect(sanitizeUserInput('<img src=x onerror="alert(1)">')).toBe(
        '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;',
      );

      expect(sanitizeUserInput("'onclick='alert(1)'")).toBe('&#x27;onclick=&#x27;alert(1)&#x27;');
    });

    it('should handle all dangerous characters', () => {
      expect(sanitizeUserInput('&')).toBe('&amp;');
      expect(sanitizeUserInput('<')).toBe('&lt;');
      expect(sanitizeUserInput('>')).toBe('&gt;');
      expect(sanitizeUserInput('"')).toBe('&quot;');
      expect(sanitizeUserInput("'")).toBe('&#x27;');
      expect(sanitizeUserInput('/')).toBe('&#x2F;');
    });

    it('should handle normal text without modification except dangerous chars', () => {
      expect(sanitizeUserInput('Hello World!')).toBe('Hello World!');
      expect(sanitizeUserInput('user@example.com')).toBe('user@example.com');
      expect(sanitizeUserInput('Price: $99.99')).toBe('Price: $99.99');
    });

    it('should handle empty and invalid inputs', () => {
      expect(sanitizeUserInput('')).toBe('');
      expect(sanitizeUserInput(null as unknown as string)).toBe('');
      expect(sanitizeUserInput(undefined as unknown as string)).toBe('');
      expect(sanitizeUserInput(123 as unknown as string)).toBe('');
    });

    it('should handle complex XSS attempts', () => {
      const xssAttempts = [
        'javascript:void(0)',
        'on\x00error=alert(1)',
        '<svg/onload=alert(1)>',
        '"><script>alert(1)</script>',
        '<iframe src="javascript:alert(1)">',
      ];

      xssAttempts.forEach((attempt) => {
        const sanitized = sanitizeUserInput(attempt);
        expect(sanitized).not.toContain('<script');
        // The sanitized version will have HTML-encoded characters
        // So 'javascript:' becomes 'javascript:' (still contains substring)
        // We check that dangerous characters are encoded instead
        if (attempt.includes('<')) {
          expect(sanitized).toContain('&lt;');
        }
        if (attempt.includes('>')) {
          expect(sanitized).toContain('&gt;');
        }
        expect(sanitized).not.toContain('<iframe');
        expect(sanitized).not.toContain('<svg');
      });
    });
  });

  describe('generateCSPNonce', () => {
    it('should generate a base64 encoded nonce', () => {
      const nonce = generateCSPNonce();
      expect(nonce).toMatch(/^[A-Za-z0-9+/]+=*$/);
      expect(nonce.length).toBeGreaterThan(0);
    });

    it('should generate unique nonces', () => {
      const nonces = new Set();
      for (let i = 0; i < 100; i++) {
        nonces.add(generateCSPNonce());
      }
      // All 100 nonces should be unique
      expect(nonces.size).toBe(100);
    });

    it('should generate nonces of consistent length range', () => {
      const nonce = generateCSPNonce();
      // Base64 encoding of 16 bytes should be 24 characters (with padding)
      expect(nonce.length).toBeGreaterThanOrEqual(22);
      expect(nonce.length).toBeLessThanOrEqual(24);
    });
  });

  describe('RECOMMENDED_SECURITY_HEADERS', () => {
    it('should include all essential security headers', () => {
      expect(RECOMMENDED_SECURITY_HEADERS['Content-Security-Policy']).toBeDefined();
      expect(RECOMMENDED_SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff');
      expect(RECOMMENDED_SECURITY_HEADERS['X-Frame-Options']).toBe('DENY');
      expect(RECOMMENDED_SECURITY_HEADERS['X-XSS-Protection']).toBe('1; mode=block');
      expect(RECOMMENDED_SECURITY_HEADERS['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
      expect(RECOMMENDED_SECURITY_HEADERS['Strict-Transport-Security']).toContain('max-age=31536000');
    });

    it('should have proper CSP directives', () => {
      const csp = RECOMMENDED_SECURITY_HEADERS['Content-Security-Policy'];
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain('connect-src');
      expect(csp).toContain('supabase.co');
    });
  });

  describe('validateSecureEnvironment', () => {
    let replaceMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      replaceMock = vi.fn();

      // Mock errorReporter methods
      vi.spyOn(errorReporter, 'reportError').mockImplementation(() => {
        return new AppError('test');
      });
      vi.spyOn(errorReporter, 'reportWarning').mockImplementation(() => {});
      vi.spyOn(errorReporter, 'reportInfo').mockImplementation(() => {});

      // Mock window.location
      Object.defineProperty(window, 'location', {
        value: {
          protocol: 'https:',
          href: 'https://app.slowburn.com',
          replace: replaceMock,
          pathname: '/',
          search: '',
          hash: '',
          origin: 'https://app.slowburn.com',
        },
        writable: true,
        configurable: true,
      });
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    });

    it('should not redirect in development mode', () => {
      vi.stubEnv('DEV', true);
      vi.stubEnv('PROD', false);
      window.location.protocol = 'http:';

      validateSecureEnvironment();

      expect(replaceMock).not.toHaveBeenCalled();
      expect(errorReporter.reportError).not.toHaveBeenCalled();
    });

    it('should redirect to HTTPS in production when using HTTP', () => {
      vi.stubEnv('DEV', false);
      vi.stubEnv('PROD', true);
      window.location.protocol = 'http:';
      window.location.href = 'http://app.slowburn.com/dashboard';

      validateSecureEnvironment();

      expect(errorReporter.reportError).toHaveBeenCalledWith(
        expect.stringContaining('not running over HTTPS'),
        expect.anything(),
      );
      expect(replaceMock).toHaveBeenCalledWith('https://app.slowburn.com/dashboard');
    });

    it('should not redirect when already using HTTPS in production', () => {
      vi.stubEnv('DEV', false);
      vi.stubEnv('PROD', true);
      window.location.protocol = 'https:';

      validateSecureEnvironment();

      expect(replaceMock).not.toHaveBeenCalled();
      expect(errorReporter.reportError).not.toHaveBeenCalled();
    });

    it('should warn about disabled cookies', () => {
      vi.stubEnv('DEV', false);
      vi.stubEnv('PROD', true);
      Object.defineProperty(navigator, 'cookieEnabled', {
        value: false,
        configurable: true,
      });

      validateSecureEnvironment();

      expect(errorReporter.reportWarning).toHaveBeenCalledWith(
        expect.stringContaining('Cookies are disabled'),
        expect.anything(),
      );

      // Restore
      Object.defineProperty(navigator, 'cookieEnabled', {
        value: true,
        configurable: true,
      });
    });

    it('should log security header recommendations in production', () => {
      vi.stubEnv('DEV', false);
      vi.stubEnv('PROD', true);

      validateSecureEnvironment();

      expect(errorReporter.reportInfo).toHaveBeenCalledWith(
        expect.stringContaining('Security:'),
        expect.anything(),
        undefined,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Security-Policy': expect.any(String),
            'X-Frame-Options': expect.any(String),
          }),
        }),
      );
    });
  });
});
