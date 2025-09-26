import type { SupabaseClient } from '@supabase/supabase-js';

import type { EngineEvent } from '@/features/workout-engine/core';
import type { EventBus } from '@/services/event-bus/eventBus';
import { getSupabaseClient } from '@/services/supabase';
import type { Database } from '@/services/supabase/types';

type DatabaseClient = SupabaseClient<Database>;
type WorkoutSessionsInsert = Database['public']['Tables']['workout_sessions']['Insert'];
type WorkoutSetsInsert = Database['public']['Tables']['workout_sets']['Insert'];

type WorkoutStartedEvent = Extract<EngineEvent, { type: 'WORKOUT_STARTED' }>;
type RepTickEvent = Extract<EngineEvent, { type: 'REP_TICK' }>;
type SetCompleteEvent = Extract<EngineEvent, { type: 'SET_COMPLETE' }>;
type WorkoutStoppedEvent = Extract<EngineEvent, { type: 'WORKOUT_STOPPED' }>;
type WorkoutCompleteEvent = Extract<EngineEvent, { type: 'WORKOUT_COMPLETE' }>;

type WorkoutType = WorkoutStartedEvent['workoutType'];

type SessionFinalEvent = WorkoutStoppedEvent | WorkoutCompleteEvent;

interface SessionContext {
  readonly workoutType: WorkoutType;
  readonly startedAt: number;
  totalReps: number;
}

interface StorageAdapterOptions {
  client?: DatabaseClient;
  logger?: Pick<typeof console, 'error' | 'warn' | 'info'>;
}

export function initializeSupabaseStorageAdapter(bus: EventBus, options: StorageAdapterOptions = {}) {
  const client = options.client ?? getSupabaseClient();
  const logger = options.logger ?? console;
  const isDev = typeof import.meta !== 'undefined' ? Boolean(import.meta.env?.DEV) : false;

  const emitDebug = (message: string) => {
    if (!isDev) {
      return;
    }

    bus.emit('debug:log', {
      message: `storage: ${message}`,
      ts: performance.now(),
      source: 'storage-adapter',
    });
  };

  const sessions = new Map<string, SessionContext>();
  const sessionUpserts = new Map<string, Promise<void>>();
  const pendingSetEvents = new Map<string, SetCompleteEvent[]>();

  const handleEvent = (event: EngineEvent) => {
    switch (event.type) {
      case 'WORKOUT_STARTED': {
        sessions.set(event.sessionId, {
          workoutType: event.workoutType,
          startedAt: event.startedAt,
          totalReps: 0,
        });
        emitDebug(`session started (${event.sessionId})`);
        const startPromise = persistSessionStart(event)
          .then(async () => {
            const pending = pendingSetEvents.get(event.sessionId);
            if (pending && pending.length > 0) {
              emitDebug(`flushing ${pending.length} queued set(s) for ${event.sessionId}`);
              pendingSetEvents.delete(event.sessionId);
              for (const pendingEvent of pending) {
                await persistSet(pendingEvent, { skipQueue: true });
              }
            }
          })
          .catch((error) => {
            logger.error?.('Failed to upsert workout session start', error);
            emitDebug(`session start upsert failed: ${String((error as { message?: string })?.message ?? error)}`);
            throw error;
          });
        sessionUpserts.set(event.sessionId, startPromise);
        break;
      }
      case 'SET_STARTED':
        ensureSessionRecord(event.sessionId);
        break;
      case 'REP_TICK':
        updateTotalReps(event);
        break;
      case 'SET_COMPLETE':
        ensureSessionRecord(event.sessionId);
        emitDebug(`set complete event received (set ${event.setIndex})`);
        void persistSet(event);
        break;
      case 'WORKOUT_COMPLETE':
        ensureSessionRecord(event.sessionId);
        emitDebug('workout complete event received');
        void finalizeSession(event);
        break;
      case 'WORKOUT_STOPPED':
        ensureSessionRecord(event.sessionId);
        emitDebug(`workout stopped event received (${event.reason})`);
        void finalizeSession(event);
        break;
      default:
        break;
    }
  };

  const unsubscribeEvent = bus.subscribe('engine:event', handleEvent);

  return () => {
    unsubscribeEvent();
    sessions.clear();
    sessionUpserts.clear();
  };

  function ensureSessionRecord(sessionId: string) {
    if (sessions.has(sessionId)) {
      return;
    }

    emitDebug(`ensureSessionRecord created placeholder for ${sessionId}`);
    sessions.set(sessionId, {
      workoutType: 'practice',
      startedAt: performance.now(),
      totalReps: 0,
    });
  }

  function updateTotalReps(event: RepTickEvent) {
    const session = sessions.get(event.sessionId);
    if (!session) {
      return;
    }

    session.totalReps = event.totalReps;
  }

  async function persistSessionStart(event: WorkoutStartedEvent) {
    const payload: WorkoutSessionsInsert = {
      id: event.sessionId,
      started_at: toIso(event.startedAt),
      workout_type: event.workoutType,
      total_reps: 0,
      duration_sec: 0,
    };

    emitDebug(`persisting session start ${payload.id}`);

    const { error } = await client.from('workout_sessions').upsert(payload, { onConflict: 'id' });

    if (error) {
      throw error;
    }

    emitDebug(`session start persisted ${payload.id}`);
  }

  async function persistSet(event: SetCompleteEvent, options: { skipQueue?: boolean } = {}) {
    const session = sessions.get(event.sessionId);
    if (!session) {
      emitDebug(`persistSet skipped: unknown session ${event.sessionId}`);
      return;
    }

    const startPromise = sessionUpserts.get(event.sessionId);
    if (!options.skipQueue && !startPromise) {
      const queue = pendingSetEvents.get(event.sessionId) ?? [];
      queue.push(event);
      pendingSetEvents.set(event.sessionId, queue);
      emitDebug(`queued set ${event.setIndex} until session start persists`);
      return;
    }

    if (startPromise && !options.skipQueue) {
      await startPromise.catch((error) => {
        logger.error?.('Session start upsert failed before set insert', error);
        emitDebug(
          `session upsert promise rejected before set insert: ${String((error as { message?: string })?.message ?? error)}`,
        );
      });
    }

    const payload: WorkoutSetsInsert = {
      session_id: event.sessionId,
      set_index: event.setIndex,
      exercise: event.exercise,
      target_type: event.targetType,
      goal_value: event.goalValue,
      actual_reps: event.actualReps,
      duration_sec: event.durationSec,
    };

    emitDebug(`persisting set ${event.setIndex} for session ${payload.session_id}`);

    const { error } = await client.from('workout_sets').upsert(payload, { onConflict: 'session_id,set_index' });

    if (error) {
      logger.error?.('Failed to upsert workout set', error);
      emitDebug(
        `set upsert failed (set ${event.setIndex}): ${String((error as { message?: string })?.message ?? error)}`,
      );
      return;
    }

    emitDebug(`set persisted (set ${event.setIndex})`);
  }

  async function finalizeSession(event: SessionFinalEvent) {
    const session = sessions.get(event.sessionId);
    if (!session) {
      emitDebug(`finalizeSession skipped: unknown session ${event.sessionId}`);
      return;
    }

    const startPromise = sessionUpserts.get(event.sessionId);
    if (startPromise) {
      await startPromise.catch((error) => {
        logger.error?.('Session start upsert failed before completion', error);
        emitDebug(
          `session upsert promise rejected before completion: ${String((error as { message?: string })?.message ?? error)}`,
        );
      });
    }

    session.totalReps = event.totalReps;

    const payload: WorkoutSessionsInsert = {
      id: event.sessionId,
      started_at: toIso(session.startedAt),
      ended_at: toIso(event.ts),
      workout_type: session.workoutType,
      total_reps: event.totalReps,
      duration_sec: event.durationSec,
    };

    emitDebug(`persisting session finalize ${payload.id} (total reps ${event.totalReps})`);

    const { error } = await client.from('workout_sessions').upsert(payload, { onConflict: 'id' });

    if (error) {
      logger.error?.('Failed to finalize workout session', error);
      emitDebug(`session finalize failed: ${String((error as { message?: string })?.message ?? error)}`);
      return;
    }

    emitDebug(`session finalize persisted ${payload.id}`);
    sessions.delete(event.sessionId);
    sessionUpserts.delete(event.sessionId);
    pendingSetEvents.delete(event.sessionId);
  }
}

function toIso(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

export default initializeSupabaseStorageAdapter;
