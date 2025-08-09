/**
 * PlanCard Component
 *
 * Sprint 3 Task 4: Display individual workout plan in a card format
 * Features:
 * - Mobile-responsive design with large touch targets
 * - Shows essential plan information (name, difficulty, training style)
 * - Click to edit functionality
 * - Delete button with confirmation
 */

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { components } from '@/lib/api';

import { planHelpers } from '../utils/planHelpers';

// Use the generated OpenAPI type
type Plan = components['schemas']['PlanResponseModel'];

interface PlanCardProps {
  plan: Plan;
  onEdit?: (plan: Plan) => void;
  onDelete?: (plan: Plan) => void;
  isDeleting?: boolean;
}

/**
 * Displays a single workout plan in a card format
 * Optimized for mobile with large touch targets (min 44px height)
 */
export function PlanCard({ plan, onEdit, onDelete, isDeleting = false }: PlanCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleCardClick = () => {
    if (!showDeleteConfirm && onEdit) {
      onEdit(plan);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showDeleteConfirm) {
      onDelete?.(plan);
      setShowDeleteConfirm(false);
    } else {
      setShowDeleteConfirm(true);
    }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(false);
  };

  // Format date for display
  const createdDate = new Date(plan.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md active:scale-[0.98]"
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleCardClick();
        }
      }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1">
            <CardTitle className="line-clamp-2 text-lg font-semibold">{plan.name}</CardTitle>
            <CardDescription className="text-sm">Created {createdDate}</CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1 text-sm">
            <span className="text-muted-foreground font-medium">
              {planHelpers.getTrainingStyleLabel(plan.training_style)}
            </span>
            {plan.difficulty_level && (
              <span className="bg-secondary rounded-full px-2 py-0.5 text-xs font-medium">
                {planHelpers.getDifficultyLabel(plan.difficulty_level)}
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      {plan.description && (
        <CardContent className="pb-3">
          <p className="text-muted-foreground line-clamp-3 text-sm">{plan.description}</p>
        </CardContent>
      )}

      <CardFooter className="flex gap-2 pt-3">
        {!showDeleteConfirm ? (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-10 flex-1"
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(plan);
              }}
              disabled={isDeleting}
            >
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive hover:text-destructive-foreground h-10"
              onClick={handleDeleteClick}
              disabled={isDeleting}
            >
              Delete
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="destructive"
              size="sm"
              className="h-10 flex-1"
              onClick={handleDeleteClick}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Confirm Delete'}
            </Button>
            <Button variant="outline" size="sm" className="h-10" onClick={handleCancelDelete} disabled={isDeleting}>
              Cancel
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}

/**
 * Loading skeleton for PlanCard
 * Matches the layout of a real card for smooth loading transitions
 */
export function PlanCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex flex-col items-end gap-1">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="space-y-1">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </CardContent>
      <CardFooter className="flex gap-2 pt-3">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-20" />
      </CardFooter>
    </Card>
  );
}
