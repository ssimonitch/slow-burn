import { z } from 'zod';

export const workoutModeSchema = z.enum(['circuit', 'practice']);

export const exerciseSchema = z.enum([
  'squat',
  'burpee',
  'mountain_climber',
  'high_knees',
  'push_up',
  'side_plank_dip',
  'seated_knee_tuck',
  'up_down_plank',
  'russian_twist',
]);

export const eventSourceSchema = z.enum(['ui', 'timer', 'worker', 'engine']);

export const eventTypeSchema = z.enum([
  'WORKOUT_START',
  'PAUSE',
  'RESUME',
  'STOP',
  'COUNTDOWN_TICK',
  'SET_STARTED',
  'INTERVAL_TICK',
  'SET_COMPLETE',
  'WORKOUT_COMPLETE',
  'REP_COMPLETE',
  'POSE_LOST',
  'POSE_REGAINED',
  'HEARTBEAT',
  'ENGINE_ERROR',
]);

export const targetTypeSchema = z.enum(['time', 'reps']);

export const setCompleteReasonSchema = z.enum(['time', 'goal', 'user_stop', 'error']);

export const stopReasonSchema = z.enum(['user', 'error']);

const baseEventSchema = z.object({
  type: eventTypeSchema,
  ts: z.number().min(0),
  seq: z.number().int().min(0),
  source: eventSourceSchema,
});

export const workoutStartEventSchema = baseEventSchema.extend({
  type: z.literal('WORKOUT_START'),
  source: z.literal('ui'),
  mode: workoutModeSchema,
  workoutId: z.enum(['circuit-1', 'circuit-2']).optional(),
  exercise: exerciseSchema.optional(),
});

export const pauseEventSchema = baseEventSchema.extend({
  type: z.literal('PAUSE'),
  source: z.literal('ui'),
});

export const resumeEventSchema = baseEventSchema.extend({
  type: z.literal('RESUME'),
  source: z.literal('ui'),
});

export const stopEventSchema = baseEventSchema.extend({
  type: z.literal('STOP'),
  source: z.literal('ui'),
  reason: stopReasonSchema,
});

export const countdownTickEventSchema = baseEventSchema.extend({
  type: z.literal('COUNTDOWN_TICK'),
  source: z.literal('timer'),
  seconds_left: z.union([z.literal(3), z.literal(2), z.literal(1)]),
});

export const setStartedEventSchema = baseEventSchema.extend({
  type: z.literal('SET_STARTED'),
  source: z.literal('engine'),
  mode: workoutModeSchema,
  exercise: exerciseSchema,
  target_type: targetTypeSchema,
  goal_value: z.number().int().min(0).nullable(),
  max_duration_sec: z.number().int().min(0).optional(),
  slot_index: z.number().int().min(1).max(7).optional(),
  round: z.number().int().min(1).optional(),
});

export const intervalTickEventSchema = baseEventSchema.extend({
  type: z.literal('INTERVAL_TICK'),
  source: z.literal('timer'),
  seconds_elapsed: z.number().int().min(0),
  seconds_left: z.number().int().min(0),
});

export const setCompleteEventSchema = baseEventSchema.extend({
  type: z.literal('SET_COMPLETE'),
  source: z.literal('engine'),
  mode: workoutModeSchema,
  exercise: exerciseSchema,
  target_type: targetTypeSchema,
  actual_reps: z.number().int().min(0),
  duration_sec: z.number().int().min(0),
  reason: setCompleteReasonSchema,
});

export const workoutCompleteEventSchema = baseEventSchema.extend({
  type: z.literal('WORKOUT_COMPLETE'),
  source: z.literal('engine'),
  total_reps: z.number().int().min(0),
  duration_sec: z.number().int().min(0),
  sets: z
    .array(
      z.object({
        exercise: exerciseSchema,
        target_type: targetTypeSchema,
        actual_reps: z.number().int().min(0),
        duration_sec: z.number().int().min(0),
      }),
    )
    .min(1),
});

export const repCompleteEventSchema = baseEventSchema.extend({
  type: z.literal('REP_COMPLETE'),
  source: z.literal('worker'),
  exercise: z.literal('squat'),
  confidence: z.number().min(0).max(1),
});

export const poseLostEventSchema = baseEventSchema.extend({
  type: z.literal('POSE_LOST'),
  source: z.literal('worker'),
});

export const poseRegainedEventSchema = baseEventSchema.extend({
  type: z.literal('POSE_REGAINED'),
  source: z.literal('worker'),
});

export const heartbeatEventSchema = baseEventSchema.extend({
  type: z.literal('HEARTBEAT'),
  source: z.literal('worker'),
  fps: z.number().min(0).optional(),
  backend: z.enum(['webgpu', 'webgl', 'wasm']).optional(),
});

export const engineErrorEventSchema = baseEventSchema.extend({
  type: z.literal('ENGINE_ERROR'),
  source: z.literal('engine'),
  code: z.enum(['dispatch_failed', 'worker_restart_failed', 'event_overflow']),
  message: z.string().optional(),
});

export const domainEventSchema = z.union([
  workoutStartEventSchema,
  pauseEventSchema,
  resumeEventSchema,
  stopEventSchema,
  countdownTickEventSchema,
  setStartedEventSchema,
  intervalTickEventSchema,
  setCompleteEventSchema,
  workoutCompleteEventSchema,
  repCompleteEventSchema,
  poseLostEventSchema,
  poseRegainedEventSchema,
  heartbeatEventSchema,
  engineErrorEventSchema,
]);

export type DomainEvent = z.infer<typeof domainEventSchema>;
export type WorkoutStartEvent = z.infer<typeof workoutStartEventSchema>;
export type SetStartedEvent = z.infer<typeof setStartedEventSchema>;
export type SetCompleteEvent = z.infer<typeof setCompleteEventSchema>;
