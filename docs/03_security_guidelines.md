# Security Guidelines and Best Practices

This document outlines the security measures, utilities, and best practices implemented in the Slow Burn frontend application. All developers must follow these guidelines to maintain the application's security posture.

## Core Security Principles

### 1. Defense in Depth
We implement multiple layers of security to protect against various attack vectors:
- Input validation at the UI layer
- URL sanitization for all navigation
- Secure authentication with Supabase
- Protected routes with authentication checks
- Error reporting without exposing sensitive data

### 2. Zero Trust for User Input
All user input is considered potentially malicious until validated and sanitized:
- Never trust URL parameters without validation
- Sanitize all user-generated content before display
- Validate all form inputs with Zod schemas
- Use type-safe parsing for query parameters

## Security Utilities Reference

The application includes comprehensive security utilities in `src/lib/security.ts`:

### URL Validation and Sanitization

#### `validateReturnUrl(url: string, fallback = '/dashboard'): string`
Validates and sanitizes redirect URLs to prevent open redirect attacks.

**Protection Against:**
- Absolute URLs to external domains
- Protocol-relative URLs (`//evil.com`)
- JavaScript protocol injection (`javascript:alert()`)
- Data URIs (`data:text/html,<script>`)
- Path traversal attacks (`../admin`)
- Encoded attack vectors

**Usage:**
```typescript
// In login redirect handling
const returnUrl = validateReturnUrl(searchParams.get('returnUrl'));
navigate(returnUrl); // Safe to navigate
```

**Test Coverage:** 17+ attack vectors tested

#### `safeDecodeUrl(encodedUrl: string | null, fallback = '/dashboard'): string`
Safely decodes URL components and validates them.

**Usage:**
```typescript
const decodedUrl = safeDecodeUrl(encodedParam);
// Automatically validates after decoding
```

#### `safeEncodeUrl(url: string): string`
Encodes URLs only after validation.

**Usage:**
```typescript
const encodedUrl = safeEncodeUrl('/dashboard?tab=workouts');
// Returns empty string if URL is unsafe
```

### Input Sanitization

#### `sanitizeUserInput(input: string): string`
Prevents XSS attacks by escaping HTML entities.

**Protection Against:**
- Script injection
- HTML injection
- Event handler injection
- Style injection

**Usage:**
```typescript
const safeContent = sanitizeUserInput(userInput);
// Safe to display in UI (though React already escapes by default)
```

### Utility Functions

#### `isInternalUrl(url: string): boolean`
Checks if a URL is safe for internal navigation.

**Usage:**
```typescript
if (isInternalUrl(url)) {
  navigate(url);
} else {
  console.warn('Attempted navigation to external URL');
}
```

#### `generateCSPNonce(): string`
Generates a nonce for Content Security Policy.

**Usage:**
```typescript
const nonce = generateCSPNonce();
// Use with inline scripts/styles when absolutely necessary
```

## Protected Routes Implementation

All authenticated routes use the `ProtectedRoute` component:

### Security Features
1. **Authentication Check**: Verifies user session before rendering
2. **Loading States**: Prevents information leakage during auth verification
3. **Secure Redirects**: Validates all return URLs before navigation
4. **Session Management**: Integrates with Zustand auth store

### Implementation Pattern
```typescript
// App.tsx routing configuration
<Route element={<ProtectedRoute />}>
  <Route path="/dashboard" element={<Dashboard />} />
  <Route path="/workouts" element={<Workouts />} />
  {/* All protected routes as children */}
</Route>
```

## Error Reporting Security

The error reporting system (`src/lib/errors.ts`) follows security best practices:

### Severity Levels
- **CRITICAL**: Security breaches, auth failures
- **HIGH**: Data integrity issues, API failures
- **MEDIUM**: Validation errors, network issues
- **LOW**: UI errors, non-critical issues
- **INFO**: Audit trail, user actions
- **WARN**: Deprecated features, performance issues

### Security Categories
```typescript
export const ErrorCategory = {
  AUTH: 'AUTH',        // Authentication/authorization errors
  SECURITY: 'SECURITY', // Security violations
  NETWORK: 'NETWORK',   // API communication errors
  VALIDATION: 'VALIDATION', // Input validation failures
  // ... other categories
};
```

### Safe Error Reporting
```typescript
// Never expose sensitive data in errors
errorReporter.reportWarning(
  'Security: Rejected redirect attempt', // Generic message
  ErrorCategory.SECURITY,
  error, // Original error for debugging (dev only)
  { url: sanitizedUrl } // Safe context data
);
```

## Authentication Security

### Supabase Integration
- PKCE flow enabled for enhanced security
- Secure token storage handled by Supabase
- Automatic token refresh
- Session validation on mount

### JWT Handling
- Never store JWTs in localStorage directly
- Use Supabase's secure session management
- Tokens attached to API calls via interceptors
- Automatic cleanup on logout

## Form Security

### Validation Requirements
All forms must use Zod schemas for validation:

```typescript
const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password too short'),
});
```

### Password Requirements
- Minimum 8 characters
- Mix of uppercase and lowercase
- At least one number
- Visual strength indicator
- No password in URL parameters

## Security Testing Requirements

### Mandatory Test Coverage
All security-critical code must have comprehensive test coverage:

1. **URL Validation Tests**: Test all known attack vectors
2. **Input Sanitization Tests**: XSS prevention verification
3. **Authentication Flow Tests**: Login, logout, session management
4. **Protected Route Tests**: Authorization checks
5. **Error Handling Tests**: No sensitive data leakage

### Security Test Pattern
```typescript
describe('Security: validateReturnUrl', () => {
  it.each([
    ['https://evil.com', '/dashboard'], // External URL
    ['//evil.com', '/dashboard'],       // Protocol-relative
    ['javascript:alert()', '/dashboard'], // JS injection
    // ... more attack vectors
  ])('should reject %s and return %s', (input, expected) => {
    expect(validateReturnUrl(input)).toBe(expected);
  });
});
```

## Production Security Headers

The application recommends these security headers (configured at server/CDN level):

```typescript
export const RECOMMENDED_SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; ...",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
};
```

## Security Checklist for New Features

Before implementing any new feature, ensure:

- [ ] All user inputs are validated with Zod schemas
- [ ] URL parameters are validated with `validateReturnUrl`
- [ ] User-generated content is sanitized with `sanitizeUserInput`
- [ ] Protected routes require authentication
- [ ] Error messages don't expose sensitive information
- [ ] Security tests cover edge cases and attack vectors
- [ ] No secrets or keys in client-side code
- [ ] API calls use proper authentication headers
- [ ] Form submissions prevent CSRF attacks
- [ ] Loading states prevent information leakage

## Incident Response

If a security vulnerability is discovered:

1. **Immediate Action**: Disable affected feature if critical
2. **Assessment**: Determine scope and impact
3. **Fix**: Implement security patch with tests
4. **Review**: Code review by multiple developers
5. **Test**: Comprehensive security testing
6. **Deploy**: Release fix with monitoring
7. **Document**: Update security guidelines

## Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [React Security Best Practices](https://react.dev/learn/security)
- [Supabase Security](https://supabase.com/docs/guides/platform/security)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

## Continuous Improvement

Security is an ongoing process. We continuously:
- Review and update security utilities
- Add new attack vector tests
- Monitor security advisories
- Update dependencies regularly
- Conduct security reviews
- Learn from security incidents

Remember: **Security is everyone's responsibility**. When in doubt, ask for a security review.