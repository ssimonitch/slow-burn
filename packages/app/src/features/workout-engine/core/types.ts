import type { PoseWorkerEvent } from '@/workers';

export type WorkoutEngineMode = 'IDLE' | 'PRACTICE' | 'PAUSED' | 'COMPLETE';

export interface WorkoutSetState {
  readonly index: number;
  readonly exercise: 'squat';
  readonly targetType: 'reps' | 'time';
  readonly goalValue: number;
  readonly actualReps: number;
  readonly startedAt: number;
}

export interface WorkoutSetAggregate {
  readonly index: number;
  readonly exercise: 'squat';
  readonly targetType: 'reps' | 'time';
  readonly goalValue: number;
  readonly actualReps: number;
  readonly durationSec: number;
}

export interface WorkoutEngineState {
  readonly mode: WorkoutEngineMode;
  readonly sessionId: string | null;
  readonly startedAt?: number;
  readonly endedAt?: number;
  readonly totalReps: number;
  readonly currentSet?: WorkoutSetState;
  readonly completedSets: WorkoutSetAggregate[];
  readonly lastEventTs?: number;
}

export type EngineCommand =
  | {
      type: 'START_WORKOUT';
      sessionId?: string;
      workoutType: 'practice';
      startedAt: number;
    }
  | {
      type: 'START_SET';
      set: Omit<WorkoutSetState, 'actualReps'>;
    }
  | { type: 'END_SET'; ts: number }
  | { type: 'PAUSE'; ts: number }
  | { type: 'RESUME'; ts: number }
  | { type: 'STOP'; ts: number; reason?: 'user' | 'pose-lost' | 'error' }
  | { type: 'RESET' };

export type EngineExternalSignal = { type: 'POSE_EVENT'; event: PoseWorkerEvent } | { type: 'TIMER_TICK'; ts: number };

export type EngineEvent =
  | { type: 'WORKOUT_STARTED'; sessionId: string; ts: number }
  | { type: 'SET_STARTED'; setIndex: number; exercise: 'squat'; ts: number }
  | {
      type: 'REP_TICK';
      repCount: number;
      totalReps: number;
      setIndex: number;
      ts: number;
    }
  | {
      type: 'SET_COMPLETE';
      setIndex: number;
      actualReps: number;
      durationSec: number;
      ts: number;
    }
  | {
      type: 'WORKOUT_COMPLETE';
      totalReps: number;
      durationSec: number;
      ts: number;
    }
  | {
      type: 'WORKOUT_STOPPED';
      reason: 'user' | 'pose-lost' | 'error';
      ts: number;
    };

export interface EngineReducerResult {
  readonly state: WorkoutEngineState;
  readonly events: EngineEvent[];
}
