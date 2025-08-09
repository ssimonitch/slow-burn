/**
 * Unit Tests for PlansList Component
 *
 * These tests verify the plans list functionality, including:
 * - Display of paginated plan list
 * - Loading states with skeleton cards
 * - Empty state when no plans exist
 * - Error handling for failed requests
 * - Pagination controls and navigation
 * - Integration with PlanCard interactions
 *
 * Note: Testing key user flows and states, not exhaustive edge cases
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Import the mock after the mock definition
import { $api } from '@/lib/api';
import { createBackendPaginatedResponse, createMockApiError } from '@/test/factories/api';
import { createMockPlan, createMockPlans } from '@/test/factories/plans';
import { queryTestHelpers } from '@/test/helpers/react-query';

import { PlansEmptyState, PlansList, PlansListSkeleton } from './PlansList';

// Mock the $api client
vi.mock('@/lib/api', () => ({
  $api: {
    useQuery: vi.fn(),
    useMutation: vi.fn(),
  },
}));

describe('PlansList', () => {
  const mockOnEditPlan = vi.fn();
  const mockOnDeletePlan = vi.fn();
  const mockApiUseQuery = vi.mocked($api.useQuery);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('should show skeleton cards while loading', () => {
      mockApiUseQuery.mockReturnValue(queryTestHelpers.loading());

      const { container } = render(<PlansList onEditPlan={mockOnEditPlan} onDeletePlan={mockOnDeletePlan} />);

      // Should show multiple skeleton cards
      const cardElements = container.querySelectorAll('[data-slot="card"]');
      expect(cardElements.length).toBeGreaterThan(1);
    });
  });

  describe('error state', () => {
    it('should show error message when loading fails', () => {
      const error = createMockApiError('Failed to load plans', 500);
      mockApiUseQuery.mockReturnValue(queryTestHelpers.error(error));

      render(<PlansList onEditPlan={mockOnEditPlan} onDeletePlan={mockOnDeletePlan} />);

      expect(screen.getByText('Failed to load plans')).toBeInTheDocument();
      expect(screen.getByText(/There was an error loading your workout plans/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Refresh Page' })).toBeInTheDocument();
    });

    it('should refresh page when refresh button clicked', async () => {
      const user = userEvent.setup();
      const mockReload = vi.fn();
      // Mock window.location.reload
      Object.defineProperty(window, 'location', {
        value: { reload: mockReload },
        writable: true,
      });

      const error = createMockApiError('Network error', 500);
      mockApiUseQuery.mockReturnValue(queryTestHelpers.error(error));

      render(<PlansList onEditPlan={mockOnEditPlan} onDeletePlan={mockOnDeletePlan} />);

      await user.click(screen.getByRole('button', { name: 'Refresh Page' }));

      expect(mockReload).toHaveBeenCalled();
    });
  });

  describe('empty state', () => {
    it('should show empty state when no plans exist', () => {
      const emptyBackendResponse = createBackendPaginatedResponse([], { page: 1, per_page: 10, total: 0 });
      mockApiUseQuery.mockReturnValue(queryTestHelpers.success(emptyBackendResponse));

      render(<PlansList onEditPlan={mockOnEditPlan} onDeletePlan={mockOnDeletePlan} />);

      expect(screen.getByText('No workout plans yet')).toBeInTheDocument();
      expect(screen.getByText(/Get started by creating your first workout plan/)).toBeInTheDocument();
    });
  });

  describe('plans display', () => {
    it('should display list of plans', () => {
      const plans = createMockPlans(5);
      const backendResponse = createBackendPaginatedResponse(plans, { page: 1, per_page: 10, total: 5 });
      mockApiUseQuery.mockReturnValue(queryTestHelpers.success(backendResponse));

      render(<PlansList onEditPlan={mockOnEditPlan} onDeletePlan={mockOnDeletePlan} />);

      // Should display all plans from the mock data
      plans.forEach((plan) => {
        expect(screen.getByText(plan.name)).toBeInTheDocument();
      });
    });

    it('should pass correct props to PlanCard', () => {
      const plans = [createMockPlan({ id: 'test-plan-1', name: 'Test Plan 1' })];
      const backendResponse = createBackendPaginatedResponse(plans, { page: 1, per_page: 10, total: 1 });
      mockApiUseQuery.mockReturnValue(queryTestHelpers.success(backendResponse));

      render(<PlansList onEditPlan={mockOnEditPlan} onDeletePlan={mockOnDeletePlan} deletingPlanId="test-plan-1" />);

      expect(screen.getByText('Test Plan 1')).toBeInTheDocument();
      // The plan card should be in deleting state (buttons disabled)
      expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
    });
  });

  describe('pagination', () => {
    it('should show pagination when multiple pages exist', () => {
      // Create backend format response with pagination
      const plans = createMockPlans(10); // 10 plans on current page
      const backendResponse = createBackendPaginatedResponse(plans, {
        page: 1,
        per_page: 10,
        total: 25, // 25 total plans = 3 pages
      });

      mockApiUseQuery.mockReturnValue(queryTestHelpers.success(backendResponse));

      render(<PlansList onEditPlan={mockOnEditPlan} onDeletePlan={mockOnDeletePlan} itemsPerPage={10} />);

      // The component should show pagination with 25 total plans
      expect(screen.getByText('Showing 1-10 of 25 plans')).toBeInTheDocument();
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    });

    it('should not show pagination for single page', () => {
      const plans = createMockPlans(5);
      const backendResponse = createBackendPaginatedResponse(plans, { page: 1, per_page: 10, total: 5 });
      mockApiUseQuery.mockReturnValue(queryTestHelpers.success(backendResponse));

      render(<PlansList onEditPlan={mockOnEditPlan} onDeletePlan={mockOnDeletePlan} />);

      expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    });

    it('should handle next page navigation', async () => {
      const user = userEvent.setup();

      // Start with page 1 - backend format
      const page1Plans = createMockPlans(10);
      const page1Response = createBackendPaginatedResponse(page1Plans, {
        page: 1,
        per_page: 10,
        total: 25,
      });

      mockApiUseQuery.mockReturnValueOnce(queryTestHelpers.success(page1Response));

      const { rerender } = render(
        <PlansList onEditPlan={mockOnEditPlan} onDeletePlan={mockOnDeletePlan} itemsPerPage={10} />,
      );

      await user.click(screen.getByRole('button', { name: 'Next' }));

      // Simulate API call returning page 2 data
      const page2Plans = createMockPlans(10);
      const page2Response = createBackendPaginatedResponse(page2Plans, {
        page: 2,
        per_page: 10,
        total: 25,
      });

      mockApiUseQuery.mockReturnValue(queryTestHelpers.success(page2Response));

      rerender(<PlansList onEditPlan={mockOnEditPlan} onDeletePlan={mockOnDeletePlan} itemsPerPage={10} />);

      expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    });
  });

  describe('user interactions', () => {
    it('should call onEditPlan when plan edit is triggered', async () => {
      const user = userEvent.setup();
      const plan = createMockPlan({ name: 'Test Plan' });
      const backendResponse = createBackendPaginatedResponse([plan], { page: 1, per_page: 10, total: 1 });

      mockApiUseQuery.mockReturnValue(queryTestHelpers.success(backendResponse));

      render(<PlansList onEditPlan={mockOnEditPlan} onDeletePlan={mockOnDeletePlan} />);

      await user.click(screen.getByRole('button', { name: 'Edit' }));

      expect(mockOnEditPlan).toHaveBeenCalledWith(plan);
    });

    it('should call onDeletePlan when plan delete is triggered', async () => {
      const user = userEvent.setup();
      const plan = createMockPlan({ name: 'Test Plan' });
      const backendResponse = createBackendPaginatedResponse([plan], { page: 1, per_page: 10, total: 1 });

      mockApiUseQuery.mockReturnValue(queryTestHelpers.success(backendResponse));

      render(<PlansList onEditPlan={mockOnEditPlan} onDeletePlan={mockOnDeletePlan} />);

      // Click delete button
      await user.click(screen.getByRole('button', { name: 'Delete' }));
      // Confirm deletion
      await user.click(screen.getByRole('button', { name: 'Confirm Delete' }));

      expect(mockOnDeletePlan).toHaveBeenCalledWith(plan);
    });
  });
});

describe('PlansEmptyState', () => {
  it('should render empty state message', () => {
    render(<PlansEmptyState />);

    expect(screen.getByText('No workout plans yet')).toBeInTheDocument();
    expect(screen.getByText(/Get started by creating your first workout plan/)).toBeInTheDocument();
  });

  it('should call onCreateClick when create button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnCreateClick = vi.fn();

    render(<PlansEmptyState onCreateClick={mockOnCreateClick} />);

    await user.click(screen.getByRole('button', { name: 'Create Your First Plan' }));

    expect(mockOnCreateClick).toHaveBeenCalled();
  });

  it('should not show create button when onCreateClick not provided', () => {
    render(<PlansEmptyState />);

    expect(screen.queryByRole('button', { name: 'Create Your First Plan' })).not.toBeInTheDocument();
  });
});

describe('PlansListSkeleton', () => {
  it('should render default number of skeleton cards', () => {
    const { container } = render(<PlansListSkeleton />);

    // Count card containers rather than all skeleton elements
    const cardElements = container.querySelectorAll('[data-slot="card"]');
    expect(cardElements).toHaveLength(6);
  });

  it('should render custom number of skeleton cards', () => {
    const { container } = render(<PlansListSkeleton count={3} />);

    const cardElements = container.querySelectorAll('[data-slot="card"]');
    expect(cardElements).toHaveLength(3);
  });
});
