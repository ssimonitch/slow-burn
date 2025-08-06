import { logError, logInfo, logWarn } from '@/lib/logger';

/**
 * Security utilities for the Slow Burn application
 *
 * Provides essential security functions for URL validation, input sanitization,
 * and protection against common web vulnerabilities like open redirects and XSS.
 */

/**
 * Validates and sanitizes a redirect URL to prevent open redirect attacks.
 *
 * This function ensures that redirect URLs are safe by:
 * 1. Only allowing relative URLs that start with '/'
 * 2. Rejecting protocol-relative URLs (//example.com)
 * 3. Rejecting absolute URLs to external domains
 * 4. Preventing path traversal attacks
 * 5. Providing a safe fallback when validation fails
 *
 * @param url - The URL to validate (can be relative or absolute)
 * @param fallback - The safe fallback URL if validation fails (defaults to '/dashboard')
 * @returns A safe, encoded URL string suitable for redirects
 *
 * @example
 * ```typescript
 * validateReturnUrl('/dashboard') // Returns: '/dashboard'
 * validateReturnUrl('https://evil.com') // Returns: '/dashboard' (rejected)
 * validateReturnUrl('//evil.com') // Returns: '/dashboard' (rejected)
 * validateReturnUrl('../admin') // Returns: '/dashboard' (path traversal rejected)
 * ```
 */
export function validateReturnUrl(url: string, fallback = '/dashboard'): string {
  // Handle null, undefined, or empty strings
  if (!url || typeof url !== 'string') {
    return fallback;
  }

  // Trim whitespace
  const trimmedUrl = url.trim();

  // Reject empty strings after trimming
  if (!trimmedUrl) {
    return fallback;
  }

  try {
    // Check for protocol-relative URLs (//example.com)
    if (trimmedUrl.startsWith('//')) {
      logWarn('Security: Rejected protocol-relative URL redirect attempt', {
        url: trimmedUrl,
        type: 'protocol-relative',
      });
      return fallback;
    }

    // Check for absolute URLs with protocols
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmedUrl)) {
      // This matches any URL with a protocol (http:, https:, javascript:, data:, etc.)
      logWarn('Security: Rejected absolute URL redirect attempt', {
        url: trimmedUrl,
        type: 'absolute-url',
      });
      return fallback;
    }

    // Check for URLs that don't start with '/' or contain special characters
    // that could be interpreted as absolute URLs
    if (!trimmedUrl.startsWith('/') || trimmedUrl.includes('@')) {
      logWarn('Security: Rejected non-root-relative URL redirect attempt', {
        url: trimmedUrl,
        type: 'non-root-relative',
      });
      return fallback;
    }

    // Create a URL object to normalize and validate the path
    // Using window.location.origin as base to validate the path structure
    const baseUrl = window.location.origin;
    const fullUrl = new URL(trimmedUrl, baseUrl);

    // Ensure the URL is on the same origin
    if (fullUrl.origin !== baseUrl) {
      logWarn('Security: Rejected cross-origin redirect attempt', {
        url: trimmedUrl,
        requestOrigin: fullUrl.origin,
        currentOrigin: baseUrl,
      });
      return fallback;
    }

    // Check for path traversal attempts in the original URL
    // We must check the original string before URL normalization
    // because URL constructor normalizes ../ and ./ paths
    // Also check for encoded periods (%2E) and double-encoded (%252E)
    if (
      trimmedUrl.includes('..') ||
      trimmedUrl.includes('/.') ||
      trimmedUrl.includes('%2E') ||
      trimmedUrl.includes('%2e') ||
      trimmedUrl.includes('%252E') ||
      trimmedUrl.includes('%252e')
    ) {
      logWarn('Security: Rejected path traversal attempt', { url: trimmedUrl });
      return fallback;
    }

    // Reconstruct the safe relative URL (pathname + search + hash)
    const safeUrl = fullUrl.pathname + fullUrl.search + fullUrl.hash;

    // Final validation: ensure it starts with '/'
    if (!safeUrl.startsWith('/')) {
      logWarn('Security: Invalid normalized URL', { url: safeUrl });
      return fallback;
    }

    return safeUrl;
  } catch (error) {
    // If URL parsing fails, it's likely malformed
    logWarn('Security: Failed to parse redirect URL', { url: trimmedUrl, error });
    return fallback;
  }
}

/**
 * Safely decodes a URL component and validates it.
 * Prevents XSS attacks through malicious URL encoding.
 *
 * @param encodedUrl - The encoded URL component to decode
 * @param fallback - The safe fallback if decoding fails
 * @returns A safely decoded and validated URL
 *
 * @example
 * ```typescript
 * safeDecodeUrl('%2Fdashboard') // Returns: '/dashboard'
 * safeDecodeUrl('%3Cscript%3E') // Returns: '/dashboard' (XSS attempt rejected)
 * ```
 */
export function safeDecodeUrl(encodedUrl: string | null, fallback = '/dashboard'): string {
  if (!encodedUrl) {
    return fallback;
  }

  try {
    const decoded = decodeURIComponent(encodedUrl);
    // Validate the decoded URL to ensure it's safe
    return validateReturnUrl(decoded, fallback);
  } catch (error) {
    // If decoding fails, the URL is malformed
    logWarn('Security: Failed to decode URL', { url: encodedUrl, error });
    return fallback;
  }
}

/**
 * Encodes a URL for safe inclusion in URL parameters.
 * Only encodes validated URLs to prevent encoding malicious content.
 *
 * @param url - The URL to encode
 * @returns The encoded URL or empty string if validation fails
 *
 * @example
 * ```typescript
 * safeEncodeUrl('/dashboard?tab=workouts') // Returns: '%2Fdashboard%3Ftab%3Dworkouts'
 * safeEncodeUrl('https://evil.com') // Returns: '' (rejected)
 * ```
 */
export function safeEncodeUrl(url: string): string {
  const validated = validateReturnUrl(url, '');
  return validated ? encodeURIComponent(validated) : '';
}

/**
 * Checks if a URL is safe for navigation within the application.
 * This is a convenience function that returns a boolean instead of a fallback.
 *
 * @param url - The URL to check
 * @returns True if the URL is safe for internal navigation, false otherwise
 *
 * @example
 * ```typescript
 * isInternalUrl('/dashboard') // Returns: true
 * isInternalUrl('https://example.com') // Returns: false
 * isInternalUrl('//evil.com') // Returns: false
 * ```
 */
export function isInternalUrl(url: string): boolean {
  // Use a unique fallback to detect if validation passed
  const uniqueFallback = '__VALIDATION_FAILED__';
  const result = validateReturnUrl(url, uniqueFallback);
  return result !== uniqueFallback;
}

/**
 * Sanitizes user input to prevent XSS attacks when displaying in the UI.
 * Note: React already escapes content by default, but this provides an extra layer
 * of protection for cases where dangerouslySetInnerHTML might be needed.
 *
 * @param input - The user input to sanitize
 * @returns Sanitized string safe for display
 *
 * @example
 * ```typescript
 * sanitizeUserInput('<script>alert("XSS")</script>')
 * // Returns: '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
 * ```
 */
export function sanitizeUserInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // HTML entity encoding for common XSS vectors
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Creates a Content Security Policy nonce for inline scripts/styles.
 * This should be used in conjunction with proper CSP headers.
 *
 * @returns A random nonce value for CSP
 */
export function generateCSPNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

/**
 * Security configuration recommendations for production deployment.
 * These headers should be set at the server/CDN level for maximum effectiveness.
 */
export const RECOMMENDED_SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self';",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
} as const;

/**
 * Validates that the current environment is secure for production.
 * Logs warnings if security requirements are not met.
 */
export function validateSecureEnvironment(): void {
  if (import.meta.env.PROD) {
    // Check for HTTPS
    if (window.location.protocol !== 'https:') {
      logError('Security Warning: Application is not running over HTTPS in production!');
      // In production, force redirect to HTTPS
      const httpsUrl = `https:${window.location.href.substring(window.location.protocol.length)}`;
      window.location.replace(httpsUrl);
    }

    // Check for secure cookies (this would need to be verified server-side)
    if (!navigator.cookieEnabled) {
      logWarn('Security Warning: Cookies are disabled. Authentication may not work properly.');
    }

    // Log security recommendations
    logInfo('Security: Ensure the following headers are set at the server level:', {
      headers: RECOMMENDED_SECURITY_HEADERS,
    });
  }
}
