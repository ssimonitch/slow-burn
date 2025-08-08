/**
 * Hook to access the theme context
 *
 * This hook provides access to the current theme and theme setter.
 * Must be used within a ThemeProvider.
 */

import { createContext, use } from 'react';

type Theme = 'dark' | 'light' | 'system';

interface ThemeProviderState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
};

export const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export const useThemeContext = () => {
  const context = use(ThemeProviderContext);

  if (context === undefined) throw new Error('useThemeContext must be used within a ThemeProvider');

  return context;
};
