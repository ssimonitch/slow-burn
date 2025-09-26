import { describe, expect, it } from 'vitest';

import type { PoseWorkerRepCompleteEvent, PoseWorkerPoseLostEvent } from '@/workers';

import { createInitialWorkoutEngineState, reduceWorkoutEngine } from './engine';
import type { EngineCommand, WorkoutEngineState } from './types';

function runCommand(state: WorkoutEngineState, command: EngineCommand) {
  const result = reduceWorkoutEngine(state, {
    kind: 'command',
    payload: command,
  });
  return result;
}

describe('workout engine reducer', () => {
  it('starts a workout session', () => {
    const state = createInitialWorkoutEngineState();

    const command: EngineCommand = {
      type: 'START_WORKOUT',
      workoutType: 'practice',
      startedAt: 1000,
    };

    const { state: nextState, events } = runCommand(state, command);

    expect(nextState.mode).toBe('PRACTICE');
    expect(nextState.sessionId).not.toBeNull();
    expect(nextState.startedAt).toBe(1000);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'WORKOUT_STARTED',
      workoutType: 'practice',
      startedAt: 1000,
      ts: 1000,
    });
    expect(typeof events[0].sessionId).toBe('string');
  });

  it('initialises a set when START_SET is received', () => {
    const state = createInitialWorkoutEngineState();
    const { state: workoutStarted } = runCommand(state, {
      type: 'START_WORKOUT',
      workoutType: 'practice',
      startedAt: 1000,
    });

    const { state: nextState, events } = runCommand(workoutStarted, {
      type: 'START_SET',
      set: {
        index: 0,
        exercise: 'squat',
        targetType: 'reps',
        goalValue: 5,
        startedAt: 1200,
      },
    });

    expect(nextState.currentSet?.index).toBe(0);
    expect(nextState.currentSet?.actualReps).toBe(0);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'SET_STARTED',
      sessionId: nextState.sessionId,
      setIndex: 0,
      targetType: 'reps',
      goalValue: 5,
      startedAt: 1200,
      ts: 1200,
    });
  });

  it('ignores START_SET when no workout has begun', () => {
    const state = createInitialWorkoutEngineState();

    const result = runCommand(state, {
      type: 'START_SET',
      set: {
        index: 0,
        exercise: 'squat',
        targetType: 'reps',
        goalValue: 3,
        startedAt: 100,
      },
    });

    expect(result.state).toEqual(state);
    expect(result.events).toHaveLength(0);
  });

  it('increments reps and completes the set when goal reached', () => {
    const state = createInitialWorkoutEngineState();
    const { state: started } = runCommand(state, {
      type: 'START_WORKOUT',
      workoutType: 'practice',
      startedAt: 0,
    });

    const { state: withSet } = runCommand(started, {
      type: 'START_SET',
      set: {
        index: 0,
        exercise: 'squat',
        targetType: 'reps',
        goalValue: 2,
        startedAt: 100,
      },
    });

    const repEvent: PoseWorkerRepCompleteEvent = {
      type: 'REP_COMPLETE',
      exercise: 'squat',
      confidence: 1,
      ts: 200,
    };

    const repResult = reduceWorkoutEngine(withSet, {
      kind: 'signal',
      payload: { type: 'POSE_EVENT', event: repEvent },
    });

    expect(repResult.state.totalReps).toBe(1);
    expect(repResult.state.currentSet?.actualReps).toBe(1);
    expect(repResult.events[0]).toMatchObject({
      type: 'REP_TICK',
      sessionId: repResult.state.sessionId,
      repCount: 1,
      totalReps: 1,
    });

    const secondRepEvent: PoseWorkerRepCompleteEvent = {
      type: 'REP_COMPLETE',
      exercise: 'squat',
      confidence: 1,
      ts: 400,
    };

    const completionResult = reduceWorkoutEngine(repResult.state, {
      kind: 'signal',
      payload: { type: 'POSE_EVENT', event: secondRepEvent },
    });

    expect(completionResult.state.mode).toBe('PRACTICE');
    expect(completionResult.state.currentSet).toBeUndefined();
    expect(completionResult.state.completedSets).toHaveLength(1);
    expect(completionResult.events.map((event) => event.type)).toContain('SET_COMPLETE');
    expect(completionResult.events.some((event) => event.type === 'WORKOUT_COMPLETE')).toBe(false);
  });

  it('stops a session and emits WORKOUT_STOPPED', () => {
    const state = createInitialWorkoutEngineState();
    const { state: started } = runCommand(state, {
      type: 'START_WORKOUT',
      workoutType: 'practice',
      startedAt: 0,
    });

    const stopResult = runCommand(started, {
      type: 'STOP',
      ts: 500,
      reason: 'user',
    });

    expect(stopResult.state.mode).toBe('IDLE');
    expect(stopResult.state.endedAt).toBe(500);
    expect(stopResult.events).toEqual([
      {
        type: 'WORKOUT_STOPPED',
        sessionId: stopResult.state.sessionId,
        totalReps: 0,
        durationSec: 1,
        reason: 'user',
        ts: 500,
      },
    ]);
  });

  it('tracks pause and resume transitions', () => {
    const state = createInitialWorkoutEngineState();
    const { state: started } = runCommand(state, {
      type: 'START_WORKOUT',
      workoutType: 'practice',
      startedAt: 0,
    });

    const paused = runCommand(started, { type: 'PAUSE', ts: 200 });
    expect(paused.state.mode).toBe('PAUSED');
    expect(paused.state.lastEventTs).toBe(200);

    const resumed = runCommand(paused.state, { type: 'RESUME', ts: 400 });
    expect(resumed.state.mode).toBe('PRACTICE');
    expect(resumed.state.lastEventTs).toBe(400);
  });

  it('does not append empty aggregates when stopping without reps', () => {
    const state = createInitialWorkoutEngineState();
    const { state: started } = runCommand(state, {
      type: 'START_WORKOUT',
      workoutType: 'practice',
      startedAt: 0,
    });

    const { state: withSet } = runCommand(started, {
      type: 'START_SET',
      set: {
        index: 0,
        exercise: 'squat',
        targetType: 'reps',
        goalValue: 3,
        startedAt: 100,
      },
    });

    const stopped = runCommand(withSet, {
      type: 'STOP',
      ts: 200,
      reason: 'user',
    });

    expect(stopped.state.completedSets).toHaveLength(0);
  });

  it('records a partial set when END_SET is issued', () => {
    const state = createInitialWorkoutEngineState();
    const { state: started } = runCommand(state, {
      type: 'START_WORKOUT',
      workoutType: 'practice',
      startedAt: 0,
    });

    const { state: withSet } = runCommand(started, {
      type: 'START_SET',
      set: {
        index: 0,
        exercise: 'squat',
        targetType: 'reps',
        goalValue: 5,
        startedAt: 100,
      },
    });

    const withRep = reduceWorkoutEngine(withSet, {
      kind: 'signal',
      payload: {
        type: 'POSE_EVENT',
        event: {
          type: 'REP_COMPLETE',
          exercise: 'squat',
          confidence: 1,
          ts: 150,
        },
      },
    });

    const afterEnd = runCommand(withRep.state, {
      type: 'END_SET',
      ts: 200,
    });

    expect(afterEnd.state.currentSet).toBeUndefined();
    expect(afterEnd.state.completedSets).toHaveLength(1);
    expect(afterEnd.events.map((event) => event.type)).toEqual(['SET_COMPLETE']);
  });

  it('adds set completion event when stopping mid-set with reps', () => {
    const state = createInitialWorkoutEngineState();
    const { state: started } = runCommand(state, {
      type: 'START_WORKOUT',
      workoutType: 'practice',
      startedAt: 0,
    });

    const { state: withSet } = runCommand(started, {
      type: 'START_SET',
      set: {
        index: 0,
        exercise: 'squat',
        targetType: 'reps',
        goalValue: 5,
        startedAt: 100,
      },
    });

    const withRep = reduceWorkoutEngine(withSet, {
      kind: 'signal',
      payload: {
        type: 'POSE_EVENT',
        event: {
          type: 'REP_COMPLETE',
          exercise: 'squat',
          confidence: 1,
          ts: 150,
        },
      },
    });

    const stopped = runCommand(withRep.state, {
      type: 'STOP',
      ts: 200,
      reason: 'user',
    });

    expect(stopped.events.map((event) => event.type)).toEqual(['SET_COMPLETE', 'WORKOUT_STOPPED']);
    expect(stopped.state.completedSets).toHaveLength(1);
  });

  it('ignores non-rep pose events for now', () => {
    const state = createInitialWorkoutEngineState();
    const { state: started } = runCommand(state, {
      type: 'START_WORKOUT',
      workoutType: 'practice',
      startedAt: 0,
    });

    const poseLost: PoseWorkerPoseLostEvent = { type: 'POSE_LOST', ts: 100 };

    const signal = reduceWorkoutEngine(started, {
      kind: 'signal',
      payload: {
        type: 'POSE_EVENT',
        event: poseLost,
      },
    });

    expect(signal.state).toEqual(started);
    expect(signal.events).toHaveLength(0);
  });
});
