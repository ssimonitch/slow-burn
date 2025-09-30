import { describe, expect, it } from 'vitest';

import type { AppEventKey, AppEventListener } from '@/services/event-bus';
import type { EventBus } from '@/services/event-bus/eventBus';
import type { EngineEvent } from '../core';
import { initializeWorkoutEngine } from './runtime';

class MockEventBus implements EventBus {
  private listeners = new Map<AppEventKey, Set<AppEventListener<AppEventKey>>>();
  private sequence = 0;

  emit<K extends AppEventKey>(key: K, payload: Parameters<AppEventListener<K>>[0]) {
    this.sequence += 1;
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

  getSequence() {
    return this.sequence;
  }
}

describe('initializeWorkoutEngine', () => {
  it('emits engine events in response to commands and pose signals', () => {
    const bus = new MockEventBus();
    const events: EngineEvent[] = [];

    bus.subscribe('engine:event', (event) => {
      events.push(event);
    });

    const teardown = initializeWorkoutEngine(bus);

    bus.emit('engine:command', {
      type: 'START_WORKOUT',
      workoutType: 'practice',
      startedAt: 0,
    });

    bus.emit('engine:command', {
      type: 'START_SET',
      set: {
        index: 0,
        exercise: 'squat',
        targetType: 'reps',
        goalValue: 1,
        startedAt: 100,
      },
    });

    bus.emit('pose:event', {
      type: 'REP_COMPLETE',
      exercise: 'squat',
      confidence: 1,
      ts: 200,
    });

    expect(events.some((event) => event.type === 'WORKOUT_STARTED')).toBe(true);
    expect(events.some((event) => event.type === 'SET_STARTED')).toBe(true);
    expect(events.some((event) => event.type === 'REP_TICK')).toBe(true);
    expect(events.some((event) => event.type === 'SET_COMPLETE')).toBe(true);
    expect(events.some((event) => event.type === 'WORKOUT_COMPLETE')).toBe(false);

    const lengthAfterFlow = events.length;

    teardown();

    bus.emit('engine:command', {
      type: 'START_WORKOUT',
      workoutType: 'practice',
      startedAt: 500,
    });

    expect(events.length).toBe(lengthAfterFlow);
  });
});
