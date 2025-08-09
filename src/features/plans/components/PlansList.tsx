/**
 * PlansList Component
 *
 * Sprint 3 Task 4: List view with cards and simple pagination
 * Features:
 * - Displays workout plans in a responsive grid
 * - Simple previous/next pagination (no infinite scroll)
 * - Loading states with skeleton cards
 * - Empty state for users with no plans
 * - Mobile-first responsive design
 */

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { PlanCard, PlanCardSkeleton } from '@/features/plans/components/PlanCard';
import { $api, type components } from '@/lib/api';

// Use the generated OpenAPI types
type Plan = components['schemas']['PlanResponseModel'];

// Default pagination values
const DEFAULT_LIMIT = 20;

interface PlansListProps {
  /**
   * Callback when user clicks edit on a plan
   */
  onEditPlan?: (plan: Plan) => void;
  /**
   * Callback when user confirms deletion of a plan
   */
  onDeletePlan?: (plan: Plan) => void;
  /**
   * ID of plan currently being deleted (for loading state)
   */
  deletingPlanId?: string;
  /**
   * Number of items per page (default: 20)
   */
  itemsPerPage?: number;
}

/**
 * Displays a paginated list of workout plans
 * Uses simple previous/next pagination as per Sprint 3 requirements
 */
export function PlansList({ onEditPlan, onDeletePlan, deletingPlanId, itemsPerPage = DEFAULT_LIMIT }: PlansListProps) {
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch plans with pagination using OpenAPI hooks
  const {
    data,
    error,
    isPending: isLoading,
  } = $api.useQuery('get', '/api/v1/plans/', {
    params: {
      query: {
        limit: itemsPerPage,
        offset: (currentPage - 1) * itemsPerPage,
      },
    },
  });

  // Calculate pagination info using backend format
  const totalPages = data ? Math.ceil(data.total / itemsPerPage) : 0;
  const hasNextPage = currentPage < totalPages;
  const hasPreviousPage = currentPage > 1;
  const startItem = data ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endItem = data ? Math.min(currentPage * itemsPerPage, data.total) : 0;

  // Handle pagination
  const goToNextPage = () => {
    if (hasNextPage) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const goToPreviousPage = () => {
    if (hasPreviousPage) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  // Loading state - show skeleton cards
  if (isLoading) {
    return <PlansListSkeleton count={Math.min(itemsPerPage, 6)} />;
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
        <div className="mx-auto max-w-[420px] space-y-2">
          <h3 className="text-lg font-semibold">Failed to load plans</h3>
          <p className="text-muted-foreground text-sm">
            There was an error loading your workout plans. Please try refreshing the page.
          </p>
          <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">
            Refresh Page
          </Button>
        </div>
      </div>
    );
  }

  // Empty state - no plans created yet
  if (!data?.items || data.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
        <div className="mx-auto max-w-[420px] space-y-2">
          <h3 className="text-lg font-semibold">No workout plans yet</h3>
          <p className="text-muted-foreground text-sm">
            Get started by creating your first workout plan. You can customize it with your preferred training style and
            difficulty level.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Plans grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            onEdit={onEditPlan}
            onDelete={onDeletePlan}
            isDeleting={deletingPlanId === plan.id}
          />
        ))}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          {/* Results info */}
          <p className="text-muted-foreground text-sm">
            Showing {startItem}-{endItem} of {data.total} plans
          </p>

          {/* Pagination buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousPage}
              disabled={!hasPreviousPage}
              className="h-9 px-3"
            >
              Previous
            </Button>

            {/* Page indicator */}
            <div className="flex items-center gap-1 px-3">
              <span className="text-sm font-medium">
                Page {currentPage} of {totalPages}
              </span>
            </div>

            <Button variant="outline" size="sm" onClick={goToNextPage} disabled={!hasNextPage} className="h-9 px-3">
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Empty state component for when user has no plans
 * Can be used separately if needed
 */
export function PlansEmptyState({ onCreateClick }: { onCreateClick?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
      <div className="mx-auto max-w-[420px] space-y-4">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">No workout plans yet</h3>
          <p className="text-muted-foreground text-sm">
            Get started by creating your first workout plan. You can customize it with your preferred training style and
            difficulty level.
          </p>
        </div>
        {onCreateClick && (
          <Button onClick={onCreateClick} className="mt-4">
            Create Your First Plan
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Loading state component showing skeleton cards
 * Can be used separately if needed
 */
export function PlansListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        // eslint-disable-next-line react-x/no-array-index-key
        <PlanCardSkeleton key={`list-skeleton-${index}`} />
      ))}
    </div>
  );
}
