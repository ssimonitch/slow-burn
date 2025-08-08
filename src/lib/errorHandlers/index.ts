/**
 * Error handlers module
 *
 * Exports all error handlers and utilities for the unified ErrorBoundary
 */

import { authErrorHandler } from './authErrorHandler';
import { defaultErrorHandler } from './defaultErrorHandler';
import { networkErrorHandler } from './networkErrorHandler';

export { authErrorHandler } from './authErrorHandler';
export { defaultErrorHandler } from './defaultErrorHandler';
export { networkErrorHandler } from './networkErrorHandler';
export type { ErrorBoundaryConfig, ErrorHandler } from './types';

/**
 * Default error handlers in priority order
 */
export const defaultHandlers = [
  authErrorHandler, // Priority: 10
  networkErrorHandler, // Priority: 5
  defaultErrorHandler, // Priority: 0
];
