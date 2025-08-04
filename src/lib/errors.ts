import { isDevelopment } from '@/config/env';

/**
 * Error categories for better classification and handling
 */
export const ErrorCategory = {
  AUTH: 'AUTH',
  NETWORK: 'NETWORK',
  VALIDATION: 'VALIDATION',
  PWA: 'PWA',
  SECURITY: 'SECURITY',
  STORAGE: 'STORAGE',
  UNKNOWN: 'UNKNOWN',
} as const;

export type ErrorCategoryType = (typeof ErrorCategory)[keyof typeof ErrorCategory];

/**
 * Error severity levels for prioritization
 */
export const ErrorSeverity = {
  INFO: 'INFO',
  WARN: 'WARN',
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;

export type ErrorSeverityType = (typeof ErrorSeverity)[keyof typeof ErrorSeverity];

/**
 * Enhanced error class with additional context for debugging and reporting
 */
export class AppError extends Error {
  readonly category: ErrorCategoryType;
  readonly severity: ErrorSeverityType;
  readonly timestamp: Date;
  readonly userAgent: string;
  readonly url: string;
  readonly originalError?: unknown;
  readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    category: ErrorCategoryType = ErrorCategory.UNKNOWN,
    severity: ErrorSeverityType = ErrorSeverity.MEDIUM,
    originalError?: unknown,
    context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    this.category = category;
    this.severity = severity;
    this.timestamp = new Date();
    this.userAgent = navigator.userAgent;
    this.url = window.location.href;
    this.originalError = originalError;
    this.context = context;
  }

  /**
   * Serialize error for logging/reporting
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      category: this.category,
      severity: this.severity,
      timestamp: this.timestamp.toISOString(),
      userAgent: this.userAgent,
      url: this.url,
      stack: this.stack,
      context: this.context,
      originalError:
        this.originalError instanceof Error
          ? {
              name: this.originalError.name,
              message: this.originalError.message,
              stack: this.originalError.stack,
            }
          : this.originalError,
    };
  }
}

/**
 * Error reporting interface for future extensibility (Sentry, etc.)
 */
interface ErrorReporter {
  report(error: AppError): void;
}

/**
 * Console-based error reporter for development and as fallback
 */
class ConsoleErrorReporter implements ErrorReporter {
  report(error: AppError): void {
    const errorData = error.toJSON();

    // Use appropriate console method based on severity
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        console.error('🚨 CRITICAL ERROR:', errorData);
        break;
      case ErrorSeverity.HIGH:
        console.error('❌ HIGH SEVERITY ERROR:', errorData);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn('⚠️ MEDIUM SEVERITY ERROR:', errorData);
        break;
      case ErrorSeverity.LOW:
        console.info('ℹ️ LOW SEVERITY ERROR:', errorData);
        break;
      default:
        console.error('❓ UNKNOWN SEVERITY ERROR:', errorData);
    }

    // In development, also show a table for better readability
    if (isDevelopment()) {
      console.table({
        Category: error.category,
        Severity: error.severity,
        Message: error.message,
        Timestamp: error.timestamp.toLocaleString(),
        URL: error.url,
      });
    }
  }
}

/**
 * Global error reporting system
 */
class ErrorReportingSystem {
  private reporters: ErrorReporter[] = [];
  private isInitialized = false;

  /**
   * Initialize the error reporting system
   */
  init(): void {
    if (this.isInitialized) return;

    // Always include console reporter
    this.reporters.push(new ConsoleErrorReporter());

    // Future: Add Sentry or other external reporters here
    // if (window.Sentry) {
    //   this.reporters.push(new SentryErrorReporter());
    // }

    this.isInitialized = true;
  }

  /**
   * Report an error to all configured reporters
   */
  report(error: AppError): void {
    if (!this.isInitialized) {
      this.init();
    }

    this.reporters.forEach((reporter) => {
      try {
        reporter.report(error);
      } catch (reportingError) {
        // Fallback to console if reporter fails
        console.error('Error reporter failed:', reportingError);
        console.error('Original error:', error.toJSON());
      }
    });
  }

  /**
   * Add a custom error reporter
   */
  addReporter(reporter: ErrorReporter): void {
    this.reporters.push(reporter);
  }

  /**
   * Create and report an error in one call
   */
  reportError(
    message: string,
    category: ErrorCategoryType = ErrorCategory.UNKNOWN,
    severity: ErrorSeverityType = ErrorSeverity.MEDIUM,
    originalError?: unknown,
    context?: Record<string, unknown>,
  ): AppError {
    const error = new AppError(message, category, severity, originalError, context);
    this.report(error);
    return error;
  }

  /**
   * Create and report an info message
   */
  reportInfo(
    message: string,
    category: ErrorCategoryType = ErrorCategory.UNKNOWN,
    originalError?: unknown,
    context?: Record<string, unknown>,
  ): void {
    this.reportError(message, category, ErrorSeverity.INFO, originalError, context);
  }

  /**
   * Create and report a warning message
   */
  reportWarning(
    message: string,
    category: ErrorCategoryType = ErrorCategory.UNKNOWN,
    originalError?: unknown,
    context?: Record<string, unknown>,
  ): void {
    this.reportError(message, category, ErrorSeverity.WARN, originalError, context);
  }
}

/**
 * Global singleton instance of the error reporting system
 */
export const errorReporter = new ErrorReportingSystem();

/**
 * Utility function to handle and report authentication errors
 */
export function handleAuthError(
  originalError: unknown,
  operation: string,
  context?: Record<string, unknown>,
): AppError {
  const message = `Authentication operation '${operation}' failed`;
  return errorReporter.reportError(message, ErrorCategory.AUTH, ErrorSeverity.HIGH, originalError, {
    operation,
    ...context,
  });
}

/**
 * Utility function to handle and report network errors
 */
export function handleNetworkError(
  originalError: unknown,
  endpoint?: string,
  context?: Record<string, unknown>,
): AppError {
  const message = endpoint ? `Network request to '${endpoint}' failed` : 'Network request failed';

  return errorReporter.reportError(message, ErrorCategory.NETWORK, ErrorSeverity.MEDIUM, originalError, {
    endpoint,
    ...context,
  });
}

/**
 * Initialize error reporting on app startup
 */
export function initErrorReporting(): void {
  errorReporter.init();

  // Set up global error handlers
  window.addEventListener('error', (event) => {
    errorReporter.reportError(
      `Uncaught error: ${event.message}`,
      ErrorCategory.UNKNOWN,
      ErrorSeverity.HIGH,
      event.error,
      {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    );
  });

  window.addEventListener('unhandledrejection', (event) => {
    errorReporter.reportError(
      `Unhandled promise rejection: ${event.reason}`,
      ErrorCategory.UNKNOWN,
      ErrorSeverity.HIGH,
      event.reason,
    );
  });
}
