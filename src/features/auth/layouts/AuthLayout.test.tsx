/**
 * Unit Tests for AuthLayout Component
 *
 * These tests verify the AuthLayout component functionality, including:
 * - Content rendering and layout structure
 * - Responsive design behavior (desktop split-screen vs mobile single-column)
 * - Theme-aware styling adaptation
 * - Accessibility features and semantic HTML
 * - Branding and motivational messaging display
 *
 * Note: Tests focus on user-visible behavior rather than implementation details
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AuthLayout } from './AuthLayout';

/**
 * Helper function to create test children with consistent structure
 */
function createTestChild(content = 'Test Content') {
  return <div data-testid="auth-form">{content}</div>;
}

describe('AuthLayout', () => {
  describe('content rendering', () => {
    it('renders children correctly within form container', () => {
      render(<AuthLayout>{createTestChild()}</AuthLayout>);

      expect(screen.getByTestId('auth-form')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('renders complex child components', () => {
      const complexChild = (
        <form data-testid="login-form">
          <input aria-label="Email" type="email" />
          <input aria-label="Password" type="password" />
          <button type="submit">Sign In</button>
        </form>
      );

      render(<AuthLayout>{complexChild}</AuthLayout>);

      expect(screen.getByTestId('login-form')).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    });
  });

  describe('branding and messaging', () => {
    it('displays brand name in both desktop and mobile contexts', () => {
      render(<AuthLayout>{createTestChild()}</AuthLayout>);

      // Brand appears in desktop left panel and mobile header
      const brandElements = screen.getAllByText('Slow Burn');
      expect(brandElements).toHaveLength(2);
      brandElements.forEach((element) => {
        expect(element).toBeInTheDocument();
      });
    });

    it('displays flame icons with proper accessibility', () => {
      const { container } = render(<AuthLayout>{createTestChild()}</AuthLayout>);

      // Flame icons should be present in both desktop and mobile branding
      const flameIcons = container.querySelectorAll('svg[class*="lucide-flame"]');
      expect(flameIcons.length).toBeGreaterThanOrEqual(2);
    });

    it('displays complete motivational messaging', () => {
      render(<AuthLayout>{createTestChild()}</AuthLayout>);

      // Main motivational headline (desktop only)
      expect(screen.getByText(/Build strength/)).toBeInTheDocument();
      expect(screen.getByText(/Forge discipline/)).toBeInTheDocument();
      expect(screen.getByText(/Ignite your potential/)).toBeInTheDocument();

      // Tagline
      expect(
        screen.getByText(
          'Your AI fitness companion adapts to your journey, growing stronger alongside you with every workout.',
        ),
      ).toBeInTheDocument();

      // Mobile tagline
      expect(screen.getByText('Your AI Fitness Companion')).toBeInTheDocument();
    });

    it('displays all feature highlights with descriptions', () => {
      render(<AuthLayout>{createTestChild()}</AuthLayout>);

      // Feature titles
      expect(screen.getByText('Personalized Training')).toBeInTheDocument();
      expect(screen.getByText('Track Progress')).toBeInTheDocument();
      expect(screen.getByText('AI Companion')).toBeInTheDocument();

      // Feature descriptions
      expect(screen.getByText('Workout plans that evolve with your progress')).toBeInTheDocument();
      expect(screen.getByText('Comprehensive logging and analytics')).toBeInTheDocument();
      expect(screen.getByText('Build a relationship that motivates you')).toBeInTheDocument();
    });

    it('displays copyright information correctly', () => {
      render(<AuthLayout>{createTestChild()}</AuthLayout>);

      const currentYear = new Date().getFullYear();

      // Desktop footer
      expect(screen.getByText(`© ${currentYear} Slow Burn. Train with purpose.`)).toBeInTheDocument();

      // Mobile footer (simplified)
      expect(screen.getByText(`© ${currentYear} Slow Burn`)).toBeInTheDocument();
    });
  });

  describe('responsive layout behavior', () => {
    it('applies correct layout structure classes', () => {
      const { container } = render(<AuthLayout>{createTestChild()}</AuthLayout>);

      // Main container should be flex with full height
      const mainContainer = container.firstChild as HTMLElement;
      expect(mainContainer).toHaveClass('flex', 'min-h-screen');
    });

    it('applies responsive classes to desktop branding panel', () => {
      const { container } = render(<AuthLayout>{createTestChild()}</AuthLayout>);

      // Desktop branding panel should be hidden on mobile, visible on large screens
      const brandingPanel = container.querySelector('.bg-muted');
      expect(brandingPanel).toHaveClass('hidden', 'lg:flex');
    });

    it('applies responsive classes to mobile header', () => {
      const { container } = render(<AuthLayout>{createTestChild()}</AuthLayout>);

      // Mobile header should be visible on small screens, hidden on large
      const mobileHeaders = container.querySelectorAll('.lg\\:hidden ');
      expect(mobileHeaders.length).toBeGreaterThan(0);
    });

    it('applies responsive form container sizing', () => {
      const { container } = render(<AuthLayout>{createTestChild()}</AuthLayout>);

      // Form container should have responsive max-width classes
      const formContainer = container.querySelector('.max-w-sm');
      expect(formContainer).toHaveClass('max-w-sm', 'lg:max-w-md');
    });
  });

  describe('theme-aware styling', () => {
    it('uses theme-aware color classes for branding', () => {
      const { container } = render(<AuthLayout>{createTestChild()}</AuthLayout>);

      // Primary branding elements should use theme-aware classes
      const primaryElements = container.querySelectorAll('.bg-primary');
      expect(primaryElements.length).toBeGreaterThan(0);

      primaryElements.forEach((element) => {
        expect(element).toHaveClass('bg-primary');
      });
    });

    it('uses muted colors for secondary content', () => {
      const { container } = render(<AuthLayout>{createTestChild()}</AuthLayout>);

      // Muted background for desktop panel
      const mutedBackground = container.querySelector('.bg-muted');
      expect(mutedBackground).toHaveClass('bg-muted');

      // Muted text for descriptions
      const mutedText = container.querySelectorAll('.text-muted-foreground');
      expect(mutedText.length).toBeGreaterThan(0);
    });

    it('applies primary color accent to key messaging', () => {
      render(<AuthLayout>{createTestChild()}</AuthLayout>);

      // "Ignite your potential" should have primary color accent
      const accentText = screen.getByText('Ignite your potential.');
      expect(accentText).toHaveClass('text-primary');
    });
  });

  describe('accessibility', () => {
    it('provides semantic structure with proper heading hierarchy', () => {
      render(<AuthLayout>{createTestChild()}</AuthLayout>);

      // Main motivational heading
      const mainHeading = screen.getByRole('heading', { level: 1 });
      expect(mainHeading).toBeInTheDocument();
      expect(mainHeading).toHaveTextContent(/Build strength/);

      // Mobile brand heading
      const brandHeading = screen.getByRole('heading', { level: 2 });
      expect(brandHeading).toBeInTheDocument();
      expect(brandHeading).toHaveTextContent('Slow Burn');

      // Feature item headings
      const featureHeadings = screen.getAllByRole('heading', { level: 3 });
      expect(featureHeadings).toHaveLength(3);
      expect(featureHeadings[0]).toHaveTextContent('Personalized Training');
      expect(featureHeadings[1]).toHaveTextContent('Track Progress');
      expect(featureHeadings[2]).toHaveTextContent('AI Companion');
    });

    it('maintains proper content structure for screen readers', () => {
      const { container } = render(<AuthLayout>{createTestChild()}</AuthLayout>);

      // Find feature items specifically by looking for the feature container's children
      const featureContainer = container.querySelector('.space-y-4');
      expect(featureContainer).toBeInTheDocument();

      const featureItems = featureContainer?.querySelectorAll('.flex.gap-3') ?? [];
      expect(featureItems.length).toBe(3); // Three feature items

      // Each feature item should have icon and text content properly structured
      featureItems.forEach((item) => {
        const iconContainer = item.querySelector('.text-primary');
        const textContainer = item.querySelector('div:not(.text-primary)');
        expect(iconContainer).toBeInTheDocument();
        expect(textContainer).toBeInTheDocument();
      });
    });
  });

  describe('edge cases', () => {
    it('handles empty children gracefully', () => {
      render(<AuthLayout>{null}</AuthLayout>);

      // Layout structure should still be intact
      expect(screen.getAllByText('Slow Burn')).toHaveLength(2);
      expect(screen.getByText('Personalized Training')).toBeInTheDocument();
    });

    it('handles multiple child elements', () => {
      render(
        <AuthLayout>
          <div data-testid="form-1">Form 1</div>
          <div data-testid="form-2">Form 2</div>
        </AuthLayout>,
      );

      expect(screen.getByTestId('form-1')).toBeInTheDocument();
      expect(screen.getByTestId('form-2')).toBeInTheDocument();
    });

    it('maintains layout integrity with long content', () => {
      const longContent = 'This is a very long piece of content that might affect the layout. '.repeat(10).trim();

      render(<AuthLayout>{createTestChild(longContent)}</AuthLayout>);

      // All branding elements should still be present
      expect(screen.getAllByText('Slow Burn')).toHaveLength(2);
      expect(screen.getByText('Personalized Training')).toBeInTheDocument();

      // Use getByTestId to verify content is rendered and contains the long text
      const formContent = screen.getByTestId('auth-form');
      expect(formContent).toBeInTheDocument();
      expect(formContent.textContent).toContain('This is a very long piece of content');
      expect(formContent.textContent?.length).toBeGreaterThan(500); // Verify it's actually long
    });
  });
});
