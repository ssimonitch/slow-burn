import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import type { AppEventKey, AppEventListener } from '@/services/event-bus';
import type { EventBus } from '@/services/event-bus/eventBus';

import { initializePoseAdapter } from './poseAdapter';

class MockBus implements EventBus {
  listeners = new Map<AppEventKey, Set<AppEventListener<AppEventKey>>>();

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

describe('pose adapter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits REP_COMPLETE for FAKE_REP and stops stream on teardown', () => {
    const bus = new MockBus();
    const events: string[] = [];

    bus.subscribe('pose:event', (event) => {
      events.push(event.type);
    });

    const dispose = initializePoseAdapter(bus);

    bus.emit('pose:command', { type: 'FAKE_REP' });
    expect(events).toEqual(['REP_COMPLETE']);

    bus.emit('pose:command', { type: 'FAKE_STREAM_START', intervalMs: 500 });

    vi.advanceTimersByTime(1200);
    expect(events.filter((type) => type === 'REP_COMPLETE').length).toBeGreaterThanOrEqual(3);

    dispose();
    const lengthAfterDispose = events.length;

    vi.advanceTimersByTime(2000);
    expect(events.length).toBe(lengthAfterDispose);
  });

  it('stops stream when FAKE_STREAM_STOP is emitted', () => {
    const bus = new MockBus();
    let repCount = 0;

    bus.subscribe('pose:event', () => {
      repCount += 1;
    });

    initializePoseAdapter(bus);

    bus.emit('pose:command', { type: 'FAKE_STREAM_START', intervalMs: 200 });
    vi.advanceTimersByTime(600);
    expect(repCount).toBeGreaterThan(0);

    bus.emit('pose:command', { type: 'FAKE_STREAM_STOP' });
    const countAfterStop = repCount;

    vi.advanceTimersByTime(600);
    expect(repCount).toBe(countAfterStop);
  });
});
