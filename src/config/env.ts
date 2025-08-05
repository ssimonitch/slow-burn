import { z } from 'zod';

/**
 * Environment variables schema for compile-time and runtime validation
 *
 * This schema ensures all required environment variables are present and valid
 * following Vite's naming convention (VITE_ prefix for client-side variables)
 */
const envSchema = z.object({
  // Supabase configuration (required)
  VITE_SUPABASE_URL: z
    .url('VITE_SUPABASE_URL must be a valid URL')
    .refine((url) => url.includes('supabase.co') || url.includes('localhost') || url.includes('127.0.0.1'), {
      message: 'VITE_SUPABASE_URL must be a valid Supabase URL',
    }),

  VITE_SUPABASE_ANON_KEY: z
    .string()
    .min(1, 'VITE_SUPABASE_ANON_KEY is required')
    .refine((key) => key.startsWith('eyJ'), {
      message: 'VITE_SUPABASE_ANON_KEY must be a valid JWT token',
    }),

  // Application environment (optional, defaults to 'development')
  VITE_APP_ENV: z.enum(['development', 'staging', 'production']).optional().default('development'),

  // API base URL (optional, defaults to localhost:8000 in development)
  VITE_API_BASE_URL: z
    .url('VITE_API_BASE_URL must be a valid URL')
    .optional()
    .default('http://localhost:8000')
    .refine(
      (url) => {
        // Requires HTTPS for production/staging environments
        const env = z
          .enum(['development', 'staging', 'production'])
          .optional()
          .default('development')
          .parse(import.meta.env.VITE_APP_ENV);
        const isProduction = env === 'production' || env === 'staging';
        const isHttps = url.startsWith('https://');
        const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');

        // In production/staging, require HTTPS unless it's localhost (for testing)
        if (isProduction && !isHttps && !isLocalhost) {
          return false;
        }
        return true;
      },
      {
        message: 'VITE_API_BASE_URL must use HTTPS in production/staging environments',
      },
    ),
});

/**
 * Custom error class for environment configuration errors
 */
export class EnvConfigError extends Error {
  public originalError?: unknown;

  constructor(message: string, originalError?: unknown) {
    super(message);
    this.name = 'EnvConfigError';
    this.originalError = originalError;
  }
}

/**
 * Validates and parses environment variables
 * @throws {EnvConfigError} When validation fails
 */
function validateEnv() {
  try {
    // Parse and validate environment variables
    const parsed = envSchema.parse(import.meta.env);
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n  ');

      throw new EnvConfigError(
        `Environment variable validation failed:\n  ${issues}\n\nPlease check your .env.local file and ensure all required variables are set.`,
        error,
      );
    }

    throw new EnvConfigError('Failed to load environment configuration', error);
  }
}

/**
 * Validated and typed environment configuration
 *
 * This object provides compile-time type safety and runtime validation
 * for all environment variables used in the application.
 */
export const env = validateEnv();

/**
 * Type for the validated environment configuration
 */
export type EnvConfig = typeof env;

/**
 * Utility function to check if we're in development mode
 */
export const isDevelopment = () => env.VITE_APP_ENV === 'development';

/**
 * Utility function to check if we're in production mode
 */
export const isProduction = () => env.VITE_APP_ENV === 'production';

/**
 * Utility function to check if we're in staging mode
 */
export const isStaging = () => env.VITE_APP_ENV === 'staging';

/**
 * Configuration object for Supabase client
 */
export const supabaseConfig = {
  url: env.VITE_SUPABASE_URL,
  anonKey: env.VITE_SUPABASE_ANON_KEY,
};

/**
 * Configuration object for application features
 */
export const appConfig = {
  environment: env.VITE_APP_ENV,
  apiBaseUrl: env.VITE_API_BASE_URL,
};
