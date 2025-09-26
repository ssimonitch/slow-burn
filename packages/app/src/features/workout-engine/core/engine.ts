import type { PoseWorkerRepCompleteEvent, PoseWorkerEvent } from '@/workers';

import type {
  EngineCommand,
  EngineEvent,
  EngineExternalSignal,
  EngineReducerResult,
  WorkoutEngineState,
  WorkoutSetAggregate,
  WorkoutSetState,
} from './types';

function createBaseState(): WorkoutEngineState {
  return {
    mode: 'IDLE',
    sessionId: null,
    startedAt: undefined,
    endedAt: undefined,
    totalReps: 0,
    currentSet: undefined,
    completedSets: [],
    lastEventTs: undefined,
  };
}

export function createInitialWorkoutEngineState(): WorkoutEngineState {
  return createBaseState();
}

export function reduceWorkoutEngine(
  state: WorkoutEngineState,
  message: { kind: 'command'; payload: EngineCommand } | { kind: 'signal'; payload: EngineExternalSignal },
): EngineReducerResult {
  if (message.kind === 'command') {
    return reduceCommand(state, message.payload);
  }

  return reduceExternal(state, message.payload);
}

function reduceCommand(state: WorkoutEngineState, command: EngineCommand): EngineReducerResult {
  switch (command.type) {
    case 'START_WORKOUT': {
      const sessionId = command.sessionId ?? crypto.randomUUID();
      const startedAt = command.startedAt;
      const event: EngineEvent = {
        type: 'WORKOUT_STARTED',
        sessionId,
        workoutType: command.workoutType,
        startedAt,
        ts: startedAt,
      };

      return {
        state: {
          ...createBaseState(),
          mode: 'PRACTICE',
          sessionId,
          startedAt,
          lastEventTs: startedAt,
        },
        events: [event],
      };
    }

    case 'START_SET': {
      if (!state.sessionId) {
        return { state, events: [] };
      }

      const setState: WorkoutSetState = {
        ...command.set,
        actualReps: 0,
      };

      const event: EngineEvent = {
        type: 'SET_STARTED',
        sessionId: state.sessionId,
        setIndex: setState.index,
        exercise: setState.exercise,
        targetType: setState.targetType,
        goalValue: setState.goalValue,
        startedAt: setState.startedAt,
        ts: setState.startedAt,
      };

      return {
        state: {
          ...state,
          mode: state.mode === 'PAUSED' ? 'PAUSED' : 'PRACTICE',
          currentSet: setState,
          lastEventTs: setState.startedAt,
        },
        events: [event],
      };
    }

    case 'PAUSE': {
      if (state.mode !== 'PRACTICE') {
        return { state, events: [] };
      }

      return {
        state: {
          ...state,
          mode: 'PAUSED',
          lastEventTs: command.ts,
        },
        events: [],
      };
    }

    case 'RESUME': {
      if (state.mode !== 'PAUSED') {
        return { state, events: [] };
      }

      return {
        state: {
          ...state,
          mode: 'PRACTICE',
          lastEventTs: command.ts,
        },
        events: [],
      };
    }

    case 'END_SET': {
      if (!state.sessionId || !state.currentSet) {
        return { state, events: [] };
      }

      const ts = command.ts;
      const currentSet = state.currentSet;

      const completeEvent = createSetCompleteEvent(state.sessionId, currentSet, currentSet.actualReps, ts);

      const completedSets = [...state.completedSets, toAggregate(currentSet, currentSet.actualReps, ts)];

      return {
        state: {
          ...state,
          currentSet: undefined,
          completedSets,
          lastEventTs: ts,
        },
        events: [completeEvent],
      };
    }

    case 'STOP': {
      if (state.mode === 'IDLE') {
        return { state, events: [] };
      }

      if (!state.sessionId) {
        return { state, events: [] };
      }

      const events: EngineEvent[] = [];

      if (state.currentSet && state.currentSet.actualReps > 0) {
        events.push(createSetCompleteEvent(state.sessionId, state.currentSet, state.currentSet.actualReps, command.ts));
      }

      const durationSec = state.startedAt != null ? calculateDurationSeconds(state.startedAt, command.ts) : 0;

      events.push({
        type: 'WORKOUT_STOPPED',
        sessionId: state.sessionId,
        totalReps: state.totalReps,
        durationSec,
        reason: command.reason ?? 'user',
        ts: command.ts,
      });

      const completedSets =
        state.currentSet && state.currentSet.actualReps > 0
          ? [...state.completedSets, toAggregate(state.currentSet, state.currentSet.actualReps, command.ts)]
          : state.completedSets;

      return {
        state: {
          ...state,
          mode: 'IDLE',
          endedAt: command.ts,
          currentSet: undefined,
          completedSets,
          lastEventTs: command.ts,
        },
        events,
      };
    }

    case 'RESET': {
      return { state: createBaseState(), events: [] };
    }

    default:
      return { state, events: [] };
  }
}

function reduceExternal(state: WorkoutEngineState, signal: EngineExternalSignal): EngineReducerResult {
  switch (signal.type) {
    case 'POSE_EVENT': {
      return reducePoseEvent(state, signal.event);
    }
    case 'TIMER_TICK': {
      return { state: { ...state, lastEventTs: signal.ts }, events: [] };
    }
    default:
      return { state, events: [] };
  }
}

function reducePoseEvent(state: WorkoutEngineState, event: PoseWorkerEvent): EngineReducerResult {
  if (event.type !== 'REP_COMPLETE') {
    return { state, events: [] };
  }

  if (state.mode !== 'PRACTICE' || !state.currentSet) {
    return { state, events: [] };
  }

  return handleRepComplete(state, event);
}

function handleRepComplete(state: WorkoutEngineState, event: PoseWorkerRepCompleteEvent): EngineReducerResult {
  const currentSet = state.currentSet;
  if (!currentSet) {
    return { state, events: [] };
  }

  const repCount = currentSet.actualReps + 1;
  const totalReps = state.totalReps + 1;
  const timestamp = event.ts;

  const nextSet: WorkoutSetState = {
    ...currentSet,
    actualReps: repCount,
  };

  const sessionId = state.sessionId;
  if (!sessionId) {
    return { state, events: [] };
  }

  const events: EngineEvent[] = [
    {
      type: 'REP_TICK',
      sessionId,
      repCount,
      totalReps,
      setIndex: currentSet.index,
      ts: timestamp,
    },
  ];

  let nextState: WorkoutEngineState = {
    ...state,
    totalReps,
    currentSet: nextSet,
    lastEventTs: timestamp,
  };

  if (currentSet.targetType === 'reps' && repCount >= currentSet.goalValue) {
    events.push(createSetCompleteEvent(sessionId, currentSet, repCount, timestamp));

    const completedSet = toAggregate(currentSet, repCount, timestamp);
    const completedSets = [...state.completedSets, completedSet];

    nextState = {
      ...nextState,
      currentSet: undefined,
      completedSets,
    };
  }

  return {
    state: nextState,
    events,
  };
}

function createSetCompleteEvent(sessionId: string, set: WorkoutSetState, actualReps: number, ts: number): EngineEvent {
  return {
    type: 'SET_COMPLETE',
    sessionId,
    setIndex: set.index,
    exercise: set.exercise,
    targetType: set.targetType,
    goalValue: set.goalValue,
    actualReps,
    durationSec: calculateDurationSeconds(set.startedAt, ts),
    ts,
  };
}

function toAggregate(set: WorkoutSetState, actualReps: number, ts: number): WorkoutSetAggregate {
  return {
    index: set.index,
    exercise: set.exercise,
    targetType: set.targetType,
    goalValue: set.goalValue,
    actualReps,
    durationSec: calculateDurationSeconds(set.startedAt, ts),
  };
}

function calculateDurationSeconds(start: number, end: number): number {
  return Math.max(0, Math.round((end - start) / 1000));
}
