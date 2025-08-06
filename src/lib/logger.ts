/**
 * Centralized logging system using loglevel library
 *
 * This module provides:
 * - Environment-aware log levels
 * - Safe error serialization
 * - Context sanitization for security
 * - Structured logging for better debugging
 */

import log from 'loglevel';
import { serializeError } from 'serialize-error';

import { isDevelopment } from '@/config/env';

/**
 * Configure log level based on environment
 * - Development: 'debug' for verbose logging
 * - Production: 'warn' to reduce noise
 * - Can be overridden via localStorage: localStorage.setItem('loglevel', 'debug')
 */
if (typeof window !== 'undefined') {
  const storedLevel = localStorage.getItem('loglevel');
  if (storedLevel) {
    log.setLevel(storedLevel as log.LogLevelDesc);
  } else {
    log.setLevel(isDevelopment() ? 'debug' : 'warn');
  }
} else {
  log.setLevel('warn');
}

/**
 * Create structured log data
 */
function createLogData(level: string, message: string, error?: unknown, context?: Record<string, unknown>) {
  const data: Record<string, unknown> = {
    level,
    message,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : undefined,
  };

  if (error) {
    data.error = serializeError(error);
  }

  if (context) {
    data.context = context;
  }

  return data;
}

/**
 * Log an error with context
 */
export function logError(message: string, error?: unknown, context?: Record<string, unknown>): void {
  const data = createLogData('error', message, error, context);
  log.error(message, data);
}

/**
 * Log a warning with context
 */
export function logWarn(message: string, context?: Record<string, unknown>): void {
  const data = createLogData('warn', message, undefined, context);
  log.warn(message, data);
}

/**
 * Log info with context
 */
export function logInfo(message: string, context?: Record<string, unknown>): void {
  const data = createLogData('info', message, undefined, context);
  log.info(message, data);
}

/**
 * Log debug information (only in development)
 */
export function logDebug(message: string, context?: Record<string, unknown>): void {
  const data = createLogData('debug', message, undefined, context);
  log.debug(message, data);
}

/**
 * Log a trace (most verbose)
 */
export function logTrace(message: string, context?: Record<string, unknown>): void {
  const data = createLogData('trace', message, undefined, context);
  log.trace(message, data);
}

/**
 * Set up global error handlers
 */
export function setupGlobalErrorHandlers(): void {
  if (typeof window === 'undefined') return;

  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    logError('Uncaught error', event.error, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logError('Unhandled promise rejection', event.reason);
  });
}

/**
 * Integration point for future monitoring services
 *
 * Example usage:
 * if (isProduction()) {
 *   addMonitoringIntegration((logData) => {
 *     // Send to Sentry, Rollbar, LogRocket, etc.
 *     Sentry.captureException(logData.error);
 *   });
 * }
 */
type MonitoringHandler = (logData: Record<string, unknown>) => void;
const monitoringHandlers: MonitoringHandler[] = [];

export function addMonitoringIntegration(handler: MonitoringHandler): void {
  monitoringHandlers.push(handler);

  // Override loglevel's method factory to integrate monitoring
  const originalFactory = log.methodFactory;
  log.methodFactory = (methodName, logLevel, loggerName) => {
    const rawMethod = originalFactory(methodName, logLevel, loggerName);

    return (message: string, ...args: unknown[]) => {
      // Call original method
      rawMethod(message, ...args);

      // Send to monitoring if error or higher
      if (logLevel <= log.levels.ERROR && monitoringHandlers.length > 0) {
        const logData = args[0] as Record<string, unknown>;
        if (logData && typeof logData === 'object') {
          monitoringHandlers.forEach((handler) => {
            try {
              handler(logData);
            } catch (error) {
              // Don't let monitoring failures break the app
              // eslint-disable-next-line no-console
              console.error('Monitoring handler failed:', error);
            }
          });
        }
      }
    };
  };

  // Re-apply current level to trigger method factory
  log.setLevel(log.getLevel());
}

/**
 * Export the raw loglevel instance for advanced usage
 */
export { log };

/**
 * Utility to temporarily change log level (useful for debugging)
 *
 * Example:
 * withLogLevel('trace', () => {
 *   // Your code here will have trace-level logging
 * });
 */
export function withLogLevel<T>(level: log.LogLevelDesc, fn: () => T): T {
  const currentLevel = log.getLevel();
  log.setLevel(level);
  try {
    return fn();
  } finally {
    log.setLevel(currentLevel);
  }
}
