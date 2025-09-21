import { z } from "zod";

import {
  exerciseSchema,
  setCompleteReasonSchema,
  targetTypeSchema,
  workoutModeSchema,
} from "./events";

export const uuidSchema = z.string().uuid();

export const workoutSessionRowSchema = z.object({
  id: uuidSchema,
  started_at: z.string().datetime(),
  ended_at: z.string().datetime(),
  workout_type: workoutModeSchema,
  total_reps: z.number().int().min(0),
  duration_sec: z.number().int().min(0),
});

export const workoutSessionInsertSchema = workoutSessionRowSchema;

export const workoutSetRowSchema = z.object({
  id: uuidSchema,
  session_id: uuidSchema,
  exercise: exerciseSchema,
  target_type: targetTypeSchema,
  goal_value: z.number().int().min(0).nullable(),
  actual_reps: z.number().int().min(0),
  duration_sec: z.number().int().min(0),
  slot_index: z.number().int().min(1).max(7).nullable(),
  reason: setCompleteReasonSchema,
});

export const workoutSetInsertSchema = workoutSetRowSchema.omit({
  id: true,
});

export const companionStateRowSchema = z.object({
  id: z.number().int().min(1),
  affinity_xp: z.number().int().min(0),
  level: z.number().int().min(1),
  updated_at: z.string().datetime(),
});

export const companionStateUpdateSchema = companionStateRowSchema.pick({
  affinity_xp: true,
  level: true,
});

export type WorkoutSessionRow = z.infer<typeof workoutSessionRowSchema>;
export type WorkoutSessionInsert = z.infer<typeof workoutSessionInsertSchema>;
export type WorkoutSetRow = z.infer<typeof workoutSetRowSchema>;
export type WorkoutSetInsert = z.infer<typeof workoutSetInsertSchema>;
export type CompanionStateRow = z.infer<typeof companionStateRowSchema>;
export type CompanionStateUpdate = z.infer<typeof companionStateUpdateSchema>;
