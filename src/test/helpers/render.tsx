/**
 * Custom render utilities for testing React components with providers
 *
 * This helper provides a custom render function that wraps components
 * with necessary providers like ThemeProvider and MemoryRouter for testing.
 * It extends React Testing Library's render with our app-specific setup.
 */

import { render as rtlRender, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom';

import { ThemeProvider } from '@/features/theme/ThemeProvider';

interface CustomRenderOptions extends RenderOptions {
  /**
   * Router options for MemoryRouter
   * initialEntries: Array of initial history entries
   * initialIndex: Starting index in the history stack
   */
  routerOptions?: Pick<MemoryRouterProps, 'initialEntries' | 'initialIndex'>;
}

/**
 * Custom render function that wraps components with app providers
 *
 * Includes:
 * - ThemeProvider for theme context
 * - MemoryRouter for routing in tests
 *
 * @param ui - React element to render
 * @param options - Custom render options
 * @returns RTL render result
 */
export function render(ui: ReactElement, options: CustomRenderOptions = {}) {
  const { routerOptions = {}, ...renderOptions } = options;

  // Default router options
  const { initialEntries = ['/'], initialIndex = 0, ...restRouterOptions } = routerOptions;

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <ThemeProvider defaultTheme="light" storageKey="test-ui-theme">
        <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex} {...restRouterOptions}>
          {children}
        </MemoryRouter>
      </ThemeProvider>
    );
  }

  return rtlRender(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * Render component with specific route
 * Convenience function for testing components at specific routes
 *
 * @param ui - React element to render
 * @param route - Initial route path
 * @param options - Additional render options
 * @returns RTL render result
 */
export function renderWithRoute(
  ui: ReactElement,
  route: string,
  options: Omit<CustomRenderOptions, 'routerOptions'> = {},
) {
  return render(ui, {
    ...options,
    routerOptions: {
      initialEntries: [route],
      initialIndex: 0,
    },
  });
}
