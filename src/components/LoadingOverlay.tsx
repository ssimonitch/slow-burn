/**
 * Loading overlay component for full-screen loading states
 *
 * This component provides a semi-transparent overlay with a loading spinner
 * that covers the entire screen or a container. It's useful for operations
 * that navigate away from the current page or require blocking user interaction.
 */

import { Loader2 } from 'lucide-react';
import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface LoadingOverlayProps {
  /**
   * Whether the overlay is visible
   */
  isLoading: boolean;
  /**
   * Message to display below the spinner
   */
  message?: string;
  /**
   * Description text below the message
   */
  description?: string;
  /**
   * Whether to cover the full screen (fixed) or just the parent container (absolute)
   * @default 'fixed'
   */
  position?: 'fixed' | 'absolute';
  /**
   * Background opacity (0-100)
   * @default 50
   */
  opacity?: number;
  /**
   * Custom spinner size in pixels
   * @default 48
   */
  spinnerSize?: number;
  /**
   * Custom className for the overlay container
   */
  className?: string;
  /**
   * Children to render (will be covered by the overlay when loading)
   */
  children?: ReactNode;
}

/**
 * LoadingOverlay component
 *
 * Usage:
 * ```tsx
 * // Full-screen overlay
 * <LoadingOverlay isLoading={isSubmitting} message="Creating your account..." />
 *
 * // Container overlay
 * <div className="relative">
 *   <LoadingOverlay isLoading={isLoading} position="absolute" />
 *   <YourContent />
 * </div>
 * ```
 */
export function LoadingOverlay({
  isLoading,
  message,
  description,
  position = 'fixed',
  opacity = 50,
  spinnerSize = 48,
  className,
  children,
}: LoadingOverlayProps) {
  if (!isLoading && !children) {
    return null;
  }

  return (
    <>
      {children}
      {isLoading && (
        <div
          className={cn(
            'inset-0 z-50 flex items-center justify-center',
            position === 'fixed' ? 'fixed' : 'absolute',
            className,
          )}
          style={{
            backgroundColor: `rgba(0, 0, 0, ${opacity / 100})`,
          }}
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label={message ?? 'Loading'}
        >
          <div className="flex flex-col items-center space-y-4">
            <Loader2
              className="text-primary animate-spin"
              style={{
                width: `${spinnerSize}px`,
                height: `${spinnerSize}px`,
              }}
              aria-hidden="true"
            />
            {message && (
              <div className="text-center">
                <p className="text-lg font-medium text-white">{message}</p>
                {description && <p className="mt-1 text-sm text-gray-300">{description}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Inline loading component for smaller loading states
 * This is a simpler version for inline use within forms or sections
 */
interface InlineLoadingProps {
  /**
   * Loading message
   */
  message?: string;
  /**
   * Size of the spinner
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Additional className
   */
  className?: string;
}

const spinnerSizes = {
  sm: 16,
  md: 20,
  lg: 24,
} as const;

export function InlineLoading({ message = 'Loading...', size = 'md', className }: InlineLoadingProps) {
  const spinnerSize = spinnerSizes[size];

  return (
    <div className={cn('flex items-center justify-center space-x-2', className)} role="status" aria-live="polite">
      <Loader2
        className="text-muted-foreground animate-spin"
        style={{
          width: `${spinnerSize}px`,
          height: `${spinnerSize}px`,
        }}
        aria-hidden="true"
      />
      <span className="text-muted-foreground text-sm">{message}</span>
    </div>
  );
}
