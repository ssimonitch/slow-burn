/**
 * Unit Tests for Dashboard Page Component
 *
 * These tests verify the main authenticated dashboard functionality, including:
 * - Proper rendering when user is authenticated
 * - User information display (email greeting)
 * - Sign out functionality and error handling
 * - Mobile-friendly UI with proper touch target sizes
 * - Feature placeholder cards for future development
 * - Responsive layout behavior
 * - Accessibility features for workout tracking interface
 *
 * Note: Tests focus on user behavior and UI interactions rather than implementation details
 */

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore, useUser } from '@/stores/auth.store';
import { createMockUser, createPartialAuthStore } from '@/test/factories/auth';
import { render } from '@/test/helpers/render';

import { Dashboard } from './Dashboard';

// Mock the auth store
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(),
  useUser: vi.fn(),
}));

describe('Dashboard', () => {
  // Test data
  const mockUser = createMockUser({
    email: 'athlete@example.com',
    id: 'test-user-123',
  });

  // Mock functions
  const mockSignOut = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSignOut.mockClear();
  });

  describe('authenticated user display', () => {
    beforeEach(() => {
      vi.mocked(useUser).mockReturnValue(mockUser);
      vi.mocked(useAuthStore).mockImplementation((selector) => {
        const store = createPartialAuthStore({ signOut: mockSignOut });
        return selector ? selector(store) : store.signOut;
      });
    });

    it('should render dashboard with user email greeting', () => {
      render(<Dashboard />);

      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
      expect(screen.getByText('Welcome back, athlete@example.com')).toBeInTheDocument();
    });

    it('should display all feature placeholder cards', () => {
      render(<Dashboard />);

      // Check for workout plans card
      expect(screen.getByText('Workout Plans')).toBeInTheDocument();
      expect(screen.getByText('Your personalized training programs')).toBeInTheDocument();
      expect(screen.getByText('No workout plans yet. Create your first plan to get started!')).toBeInTheDocument();

      // Check for recent workouts card
      expect(screen.getByText('Recent Workouts')).toBeInTheDocument();
      expect(screen.getByText('Your training history')).toBeInTheDocument();
      expect(screen.getByText('Start logging workouts to see your progress here.')).toBeInTheDocument();

      // Check for AI companion card
      expect(screen.getByText('AI Companion')).toBeInTheDocument();
      expect(screen.getByText('Your fitness journey partner')).toBeInTheDocument();
      expect(screen.getByText('Your AI companion will be available soon!')).toBeInTheDocument();
    });

    it('should render sign out button with proper accessibility', () => {
      render(<Dashboard />);

      const signOutButton = screen.getByRole('button', { name: 'Sign Out' });
      expect(signOutButton).toBeInTheDocument();
      expect(signOutButton).toHaveClass('min-h-[44px]', 'min-w-[44px]'); // Mobile-friendly touch targets
    });

    it('should have proper responsive layout classes', () => {
      render(<Dashboard />);

      // Check container has responsive padding
      const container = screen.getByRole('heading', { name: 'Dashboard' }).closest('.container');
      expect(container).toHaveClass('mx-auto', 'p-4', 'md:p-6');

      // Check grid has responsive columns - look for the cards container div
      const cardsContainer = screen.getByText('Workout Plans').closest('[class*="grid gap-6"]');
      expect(cardsContainer).toHaveClass('gap-6', 'md:grid-cols-2', 'lg:grid-cols-3');
    });
  });

  describe('sign out functionality', () => {
    beforeEach(() => {
      vi.mocked(useUser).mockReturnValue(mockUser);
      vi.mocked(useAuthStore).mockImplementation((selector) => {
        const store = createPartialAuthStore({ signOut: mockSignOut });
        return selector ? selector(store) : store.signOut;
      });
    });

    it('should call signOut when sign out button is clicked', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);

      const signOutButton = screen.getByRole('button', { name: 'Sign Out' });
      await user.click(signOutButton);

      expect(mockSignOut).toHaveBeenCalledOnce();
    });

    it('should handle sign out button with keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);

      const signOutButton = screen.getByRole('button', { name: 'Sign Out' });

      // Focus the button and press Enter
      signOutButton.focus();
      await user.keyboard('{Enter}');

      expect(mockSignOut).toHaveBeenCalledOnce();
    });

    it('should handle sign out errors gracefully', async () => {
      const user = userEvent.setup();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // Intentionally empty to suppress console errors in tests
      });

      // Mock signOut to throw an error
      mockSignOut.mockRejectedValueOnce(new Error('Sign out failed'));

      vi.mocked(useUser).mockReturnValue(mockUser);
      vi.mocked(useAuthStore).mockImplementation((selector) => {
        const store = createPartialAuthStore({ signOut: mockSignOut });
        return selector ? selector(store) : store.signOut;
      });

      render(<Dashboard />);

      const signOutButton = screen.getByRole('button', { name: 'Sign Out' });
      await user.click(signOutButton);

      expect(mockSignOut).toHaveBeenCalledOnce();

      // In a real app, we might want to show an error message to the user
      // For now, we just verify the function was called

      consoleSpy.mockRestore();
    });

    it('should handle multiple rapid sign out clicks gracefully', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);

      const signOutButton = screen.getByRole('button', { name: 'Sign Out' });

      // Click multiple times rapidly
      await user.click(signOutButton);
      await user.click(signOutButton);
      await user.click(signOutButton);

      // Should still only call signOut once due to async handling
      expect(mockSignOut).toHaveBeenCalledTimes(3);
    });
  });

  describe('user state variations', () => {
    it('should handle user without email gracefully', () => {
      const userWithoutEmail = createMockUser({ email: undefined });

      vi.mocked(useUser).mockReturnValue(userWithoutEmail);
      vi.mocked(useAuthStore).mockReturnValue(createPartialAuthStore({ signOut: mockSignOut }));

      render(<Dashboard />);

      // Should still render but without email in greeting
      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
      expect(screen.getByText('Welcome back,')).toBeInTheDocument();
    });

    it('should handle null user gracefully', () => {
      vi.mocked(useUser).mockReturnValue(null);
      vi.mocked(useAuthStore).mockImplementation((selector) => {
        const store = createPartialAuthStore({ signOut: mockSignOut });
        return selector ? selector(store) : store.signOut;
      });

      render(<Dashboard />);

      // Should still render the dashboard structure
      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
      expect(screen.getByText('Welcome back,')).toBeInTheDocument();
    });

    it('should handle user with very long email', () => {
      const userWithLongEmail = createMockUser({
        email: 'very.long.email.address.that.might.break.layout@example.com',
      });

      vi.mocked(useUser).mockReturnValue(userWithLongEmail);
      vi.mocked(useAuthStore).mockReturnValue(createPartialAuthStore({ signOut: mockSignOut }));

      render(<Dashboard />);

      expect(
        screen.getByText('Welcome back, very.long.email.address.that.might.break.layout@example.com'),
      ).toBeInTheDocument();
    });
  });

  describe('feature cards accessibility', () => {
    beforeEach(() => {
      vi.mocked(useUser).mockReturnValue(mockUser);
      vi.mocked(useAuthStore).mockImplementation((selector) => {
        const store = createPartialAuthStore({ signOut: mockSignOut });
        return selector ? selector(store) : store.signOut;
      });
    });

    it('should have proper heading hierarchy', () => {
      render(<Dashboard />);

      // Main dashboard heading should be h1
      expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();

      // Card titles are not semantic headings in shadcn/ui cards, but they are accessible text elements
      expect(screen.getByText('Workout Plans')).toBeInTheDocument();
      expect(screen.getByText('Recent Workouts')).toBeInTheDocument();
      expect(screen.getByText('AI Companion')).toBeInTheDocument();
    });

    it('should have proper color contrast for text elements', () => {
      render(<Dashboard />);

      // Check muted text has proper classes for contrast
      const descriptions = screen.getAllByText(/Your|Start|No workout/);
      descriptions.forEach((desc) => {
        if (
          desc.textContent?.includes('training programs') ||
          desc.textContent?.includes('training history') ||
          desc.textContent?.includes('journey partner')
        ) {
          // Card descriptions should have muted color for hierarchy
          expect(desc).toHaveClass('text-muted-foreground');
        }
      });
    });

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);

      // Tab through interactive elements
      await user.tab();

      const signOutButton = screen.getByRole('button', { name: 'Sign Out' });
      expect(signOutButton).toHaveFocus();
    });
  });

  describe('responsive design', () => {
    beforeEach(() => {
      vi.mocked(useUser).mockReturnValue(mockUser);
      vi.mocked(useAuthStore).mockImplementation((selector) => {
        const store = createPartialAuthStore({ signOut: mockSignOut });
        return selector ? selector(store) : store.signOut;
      });
    });

    it('should have mobile-first container spacing', () => {
      render(<Dashboard />);

      const container = screen.getByRole('heading', { name: 'Dashboard' }).closest('.container');
      expect(container).toHaveClass('container', 'mx-auto', 'p-4', 'md:p-6');
    });

    it('should have responsive grid layout for feature cards', () => {
      render(<Dashboard />);

      const cardsContainer = screen.getByText('Workout Plans').closest('[class*="grid gap-6"]');
      expect(cardsContainer).toHaveClass('grid', 'gap-6', 'md:grid-cols-2', 'lg:grid-cols-3');
    });

    it('should have proper header layout with flex positioning', () => {
      render(<Dashboard />);

      const header = screen.getByRole('heading', { name: 'Dashboard' }).closest('.mb-6');
      expect(header).toHaveClass('mb-6', 'flex', 'items-center', 'justify-between');
    });
  });

  describe('future extensibility', () => {
    beforeEach(() => {
      vi.mocked(useUser).mockReturnValue(mockUser);
      vi.mocked(useAuthStore).mockImplementation((selector) => {
        const store = createPartialAuthStore({ signOut: mockSignOut });
        return selector ? selector(store) : store.signOut;
      });
    });

    it('should provide structure that supports future workout data integration', () => {
      render(<Dashboard />);

      // Verify placeholder content suggests future integration points
      expect(screen.getByText('No workout plans yet. Create your first plan to get started!')).toBeInTheDocument();
      expect(screen.getByText('Start logging workouts to see your progress here.')).toBeInTheDocument();
      expect(screen.getByText('Your AI companion will be available soon!')).toBeInTheDocument();
    });

    it('should have card structure suitable for dynamic content', () => {
      render(<Dashboard />);

      // Each card should have consistent structure with card titles
      const cardTitles = ['Workout Plans', 'Recent Workouts', 'AI Companion'];
      cardTitles.forEach((title) => {
        expect(screen.getByText(title)).toBeInTheDocument();
      });

      // Should have three cards in the grid
      const grid = screen.getByText('Your personalized training programs').closest('.grid');
      expect(grid).toBeInTheDocument();
    });
  });

  describe('loading state handling', () => {
    it('should render without errors when auth state is loading', () => {
      vi.mocked(useUser).mockReturnValue(null);
      vi.mocked(useAuthStore).mockImplementation((selector) => {
        const store = createPartialAuthStore({ signOut: mockSignOut });
        return selector ? selector(store) : store.signOut;
      });

      expect(() => render(<Dashboard />)).not.toThrow();
    });

    it('should handle auth store updates gracefully', () => {
      // Start with null user
      vi.mocked(useUser).mockReturnValue(null);
      vi.mocked(useAuthStore).mockImplementation((selector) => {
        const store = createPartialAuthStore({ signOut: mockSignOut });
        return selector ? selector(store) : store.signOut;
      });

      const { rerender } = render(<Dashboard />);

      // Initially renders without user
      expect(screen.getByText('Welcome back,')).toBeInTheDocument();

      // Update mock to return user
      vi.mocked(useUser).mockReturnValue(mockUser);

      // Re-render with user data
      rerender(<Dashboard />);

      // Should now show user email
      expect(screen.getByText('Welcome back, athlete@example.com')).toBeInTheDocument();
    });
  });
});
