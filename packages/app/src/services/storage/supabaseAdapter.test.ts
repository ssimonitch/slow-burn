import { describe, expect, it, vi } from 'vitest';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { EngineEvent } from '@/features/workout-engine/core';
import type { AppEventKey, AppEventListener } from '@/services/event-bus';
import type { EventBus } from '@/services/event-bus/eventBus';

import type { Database } from '@/services/supabase/types';

import { initializeSupabaseStorageAdapter } from './supabaseAdapter';

type WorkoutSessionsInsert = Database['public']['Tables']['workout_sessions']['Insert'];
type WorkoutSetsInsert = Database['public']['Tables']['workout_sets']['Insert'];

type SupabaseClientMock = SupabaseClient<Database>;

type UpsertCall<Row> = {
  data: Row;
  options?: unknown;
};

class MockEventBus implements EventBus {
  private listeners = new Map<AppEventKey, Set<AppEventListener<AppEventKey>>>();

  emit<K extends AppEventKey>(key: K, payload: Parameters<AppEventListener<K>>[0]) {
    this.listeners.get(key)?.forEach((listener) => listener(payload));
  }

  subscribe<K extends AppEventKey>(key: K, listener: AppEventListener<K>) {
    const set = this.listeners.get(key) ?? new Set();
    set.add(listener as AppEventListener<AppEventKey>);
    this.listeners.set(key, set);

    return () => {
      set.delete(listener as AppEventListener<AppEventKey>);
      if (set.size === 0) {
        this.listeners.delete(key);
      }
    };
  }
}

function createSupabaseClientMock() {
  const sessionUpserts: UpsertCall<WorkoutSessionsInsert>[] = [];
  const setUpserts: UpsertCall<WorkoutSetsInsert>[] = [];

  const client = {
    from(table: 'workout_sessions' | 'workout_sets') {
      if (table === 'workout_sessions') {
        return {
          upsert(values: WorkoutSessionsInsert, options?: unknown) {
            sessionUpserts.push({ data: values, options });
            return Promise.resolve({ data: null, error: null }) as unknown;
          },
        };
      }

      return {
        upsert(values: WorkoutSetsInsert, options?: unknown) {
          setUpserts.push({ data: values, options });
          return Promise.resolve({ data: null, error: null }) as unknown;
        },
      };
    },
  } as unknown as SupabaseClientMock;

  return {
    client,
    tables: {
      workoutSessions: sessionUpserts,
      workoutSets: setUpserts,
    },
  };
}

function emitEvent(bus: EventBus, event: EngineEvent) {
  bus.emit('engine:event', event);
}

async function flushPromises(times = 2) {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }

  await new Promise((resolve) => setTimeout(resolve, 0));
}

const noopLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
};

describe('initializeSupabaseStorageAdapter', () => {
  it('persists workout sets and finalizes sessions from engine events', async () => {
    const bus = new MockEventBus();
    const supabase = createSupabaseClientMock();

    initializeSupabaseStorageAdapter(bus, {
      client: supabase.client,
      logger: noopLogger,
    });

    emitEvent(bus, {
      type: 'WORKOUT_STARTED',
      sessionId: 'session-123',
      workoutType: 'practice',
      startedAt: 1_000,
      ts: 1_000,
    });

    emitEvent(bus, {
      type: 'SET_STARTED',
      sessionId: 'session-123',
      setIndex: 0,
      exercise: 'squat',
      targetType: 'reps',
      goalValue: 5,
      startedAt: 1_100,
      ts: 1_100,
    });

    emitEvent(bus, {
      type: 'SET_COMPLETE',
      sessionId: 'session-123',
      setIndex: 0,
      exercise: 'squat',
      targetType: 'reps',
      goalValue: 5,
      actualReps: 5,
      durationSec: 25,
      ts: 1_600,
    });

    emitEvent(bus, {
      type: 'WORKOUT_STOPPED',
      sessionId: 'session-123',
      totalReps: 5,
      durationSec: 60,
      reason: 'user',
      ts: 1_900,
    });

    await flushPromises(4);

    expect(supabase.tables.workoutSets).toHaveLength(1);
    expect(supabase.tables.workoutSets[0]?.data).toMatchObject({
      session_id: 'session-123',
      set_index: 0,
      exercise: 'squat',
      target_type: 'reps',
      goal_value: 5,
      actual_reps: 5,
      duration_sec: 25,
    });

    expect(supabase.tables.workoutSessions).toHaveLength(2);
    const [, finalizeCall] = supabase.tables.workoutSessions;
    expect(finalizeCall?.data).toMatchObject({
      id: 'session-123',
      ended_at: new Date(1_900).toISOString(),
      total_reps: 5,
      duration_sec: 60,
    });
  });

  it('handles set completion events that arrive before the start event', async () => {
    const bus = new MockEventBus();
    const supabase = createSupabaseClientMock();

    initializeSupabaseStorageAdapter(bus, {
      client: supabase.client,
      logger: noopLogger,
    });

    emitEvent(bus, {
      type: 'SET_COMPLETE',
      sessionId: 'session-out-of-order',
      setIndex: 0,
      exercise: 'squat',
      targetType: 'reps',
      goalValue: 3,
      actualReps: 3,
      durationSec: 12,
      ts: 5_150,
    });

    emitEvent(bus, {
      type: 'WORKOUT_STARTED',
      sessionId: 'session-out-of-order',
      workoutType: 'practice',
      startedAt: 5_100,
      ts: 5_100,
    });

    emitEvent(bus, {
      type: 'WORKOUT_STOPPED',
      sessionId: 'session-out-of-order',
      totalReps: 3,
      durationSec: 30,
      reason: 'user',
      ts: 5_300,
    });

    await flushPromises(4);

    expect(supabase.tables.workoutSets[0]?.data.session_id).toBe('session-out-of-order');
    const finalizeCall = supabase.tables.workoutSessions.at(-1)?.data as Record<string, unknown>;
    expect(finalizeCall).toMatchObject({
      id: 'session-out-of-order',
      total_reps: 3,
      duration_sec: 30,
    });
  });
});
