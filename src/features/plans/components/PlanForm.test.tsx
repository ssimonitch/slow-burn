/**
 * Unit Tests for PlanForm Component
 *
 * These tests verify the minimal plan form functionality, including:
 * - Rendering all 4 fields correctly
 * - Form validation
 * - Submit handling for both create and edit modes
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { components } from '@/lib/api';

import { DIFFICULTY_LEVELS, TRAINING_STYLES } from '../schemas/plan.schema';
import { PlanForm } from './PlanForm';

// Use the generated OpenAPI types
type Plan = components['schemas']['PlanResponseModel'];

describe('PlanForm', () => {
  const mockPlan: Plan = {
    id: '123',
    name: 'Test Plan',
    description: 'Test description',
    training_style: TRAINING_STYLES.POWERLIFTING,
    difficulty_level: DIFFICULTY_LEVELS.INTERMEDIATE,
    duration_weeks: null,
    days_per_week: null,
    goal: null,
    is_public: false,
    metadata: {},
    created_at: '2025-01-01T00:00:00Z',
  };

  const mockOnSubmit = vi.fn().mockResolvedValue(mockPlan);
  const mockOnSuccess = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render all 4 form fields', () => {
      render(<PlanForm onSubmit={mockOnSubmit} onSuccess={mockOnSuccess} />);

      expect(screen.getByLabelText('Plan name')).toBeInTheDocument();
      expect(screen.getByLabelText('Training style')).toBeInTheDocument();
      expect(screen.getByLabelText('Difficulty level')).toBeInTheDocument();
      expect(screen.getByLabelText('Plan description')).toBeInTheDocument();
    });

    it('should show create title when no plan provided', () => {
      render(<PlanForm onSubmit={mockOnSubmit} onSuccess={mockOnSuccess} />);

      expect(screen.getByText('Create New Workout Plan')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create Plan' })).toBeInTheDocument();
    });

    it('should show edit title when plan provided', () => {
      render(<PlanForm plan={mockPlan} onSubmit={mockOnSubmit} onSuccess={mockOnSuccess} />);

      expect(screen.getByText('Edit Workout Plan')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Update Plan' })).toBeInTheDocument();
    });
  });

  describe('form submission', () => {
    it('should submit form with valid data', async () => {
      const user = userEvent.setup();

      render(<PlanForm onSubmit={mockOnSubmit} onSuccess={mockOnSuccess} />);

      // Fill in required fields
      await user.type(screen.getByLabelText('Plan name'), 'My New Plan');

      // Select training style
      await user.click(screen.getByLabelText('Training style'));
      await user.click(screen.getByRole('option', { name: 'Powerlifting' }));

      // Submit form
      await user.click(screen.getByRole('button', { name: 'Create Plan' }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'My New Plan',
            training_style: TRAINING_STYLES.POWERLIFTING,
          }),
        );
        expect(mockOnSuccess).toHaveBeenCalledWith(mockPlan);
      });
    });

    it('should include optional fields when provided', async () => {
      const user = userEvent.setup();

      render(<PlanForm onSubmit={mockOnSubmit} onSuccess={mockOnSuccess} />);

      // Fill all fields
      await user.type(screen.getByLabelText('Plan name'), 'Complete Plan');
      await user.type(screen.getByLabelText('Plan description'), 'This is a description');

      // Select training style
      await user.click(screen.getByLabelText('Training style'));
      await user.click(screen.getByRole('option', { name: 'Bodybuilding' }));

      // Select difficulty
      await user.click(screen.getByLabelText('Difficulty level'));
      await user.click(screen.getByRole('option', { name: 'Advanced' }));

      // Submit form
      await user.click(screen.getByRole('button', { name: 'Create Plan' }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Complete Plan',
            training_style: TRAINING_STYLES.BODYBUILDING,
            description: 'This is a description',
            difficulty_level: DIFFICULTY_LEVELS.ADVANCED,
          }),
        );
      });
    });
  });

  describe('validation', () => {
    it('should show validation error for empty name', async () => {
      const user = userEvent.setup();

      render(<PlanForm onSubmit={mockOnSubmit} onSuccess={mockOnSuccess} />);

      // Try to submit without filling required fields
      await user.click(screen.getByRole('button', { name: 'Create Plan' }));

      await waitFor(() => {
        expect(screen.getByText('Plan name is required')).toBeInTheDocument();
        expect(mockOnSubmit).not.toHaveBeenCalled();
      });
    });
  });

  describe('cancel functionality', () => {
    it('should call onCancel when cancel button clicked', async () => {
      const user = userEvent.setup();

      render(<PlanForm onSubmit={mockOnSubmit} onSuccess={mockOnSuccess} onCancel={mockOnCancel} />);

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });
});
