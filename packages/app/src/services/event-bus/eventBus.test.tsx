import type { PropsWithChildren } from 'react';
import { act, render, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EventBusProvider, type EventBus, useEventBus, useEventSubscription } from './eventBus';
import type { EngineCommand, EngineEvent } from '@/features/workout-engine/core';

describe('EventBus', () => {
  it('notifies listeners when events are emitted', () => {
    const listener = vi.fn();

    const { result } = renderHook(() => useEventBus(), {
      wrapper: ({ children }: PropsWithChildren) => <EventBusProvider>{children}</EventBusProvider>,
    });

    const payload: EngineCommand = {
      type: 'START_WORKOUT',
      workoutType: 'practice',
      startedAt: 0,
    };

    const unsubscribe = result.current.subscribe('engine:command', listener);

    act(() => {
      result.current.emit('engine:command', payload);
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(payload);

    unsubscribe();
  });

  it('does not notify listeners after unsubscribe', () => {
    const listener = vi.fn();

    const { result } = renderHook(() => useEventBus(), {
      wrapper: ({ children }: PropsWithChildren) => <EventBusProvider>{children}</EventBusProvider>,
    });

    const unsubscribe = result.current.subscribe('engine:event', listener);

    act(() => {
      const startedAt = Date.now();
      const event: EngineEvent = {
        type: 'WORKOUT_STARTED',
        sessionId: 'session-1',
        workoutType: 'practice',
        startedAt,
        ts: startedAt,
      };
      result.current.emit('engine:event', event);
    });

    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();

    act(() => {
      const stoppedTs = Date.now();
      const event: EngineEvent = {
        type: 'WORKOUT_STOPPED',
        sessionId: 'session-1',
        totalReps: 0,
        durationSec: 0,
        reason: 'user',
        ts: stoppedTs,
      };
      result.current.emit('engine:event', event);
    });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('useEventSubscription wires and tears down listeners', () => {
    const listener = vi.fn();
    let eventBus: EventBus | null = null;

    function BusHandle({ children }: PropsWithChildren) {
      eventBus = useEventBus();
      return <>{children}</>;
    }

    function Subscriber() {
      useEventSubscription('engine:event', listener);
      return null;
    }

    const { unmount } = render(
      <EventBusProvider>
        <BusHandle>
          <Subscriber />
        </BusHandle>
      </EventBusProvider>,
    );

    expect(eventBus).not.toBeNull();

    act(() => {
      const stoppedTs = Date.now();
      const event: EngineEvent = {
        type: 'WORKOUT_STOPPED',
        sessionId: 'session-1',
        totalReps: 0,
        durationSec: 0,
        reason: 'user',
        ts: stoppedTs,
      };
      eventBus?.emit('engine:event', event);
    });

    expect(listener).toHaveBeenCalledTimes(1);

    unmount();

    act(() => {
      const stoppedTs = Date.now();
      const event: EngineEvent = {
        type: 'WORKOUT_STOPPED',
        sessionId: 'session-1',
        totalReps: 0,
        durationSec: 0,
        reason: 'user',
        ts: stoppedTs,
      };
      eventBus?.emit('engine:event', event);
    });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('continues dispatching to other listeners when one throws an error', () => {
    const listener1 = vi.fn(() => {
      throw new Error('Listener 1 error');
    });
    const listener2 = vi.fn();
    const listener3 = vi.fn();

    const { result } = renderHook(() => useEventBus(), {
      wrapper: ({ children }: PropsWithChildren) => <EventBusProvider>{children}</EventBusProvider>,
    });

    // Subscribe three listeners
    result.current.subscribe('engine:command', listener1);
    result.current.subscribe('engine:command', listener2);
    result.current.subscribe('engine:command', listener3);

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const payload: EngineCommand = {
      type: 'START_WORKOUT',
      workoutType: 'practice',
      startedAt: 0,
    };

    act(() => {
      result.current.emit('engine:command', payload);
    });

    // All listeners should have been called despite the error
    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
    expect(listener3).toHaveBeenCalledTimes(1);

    // Error should have been logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[EventBus] Error in listener'),
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });

  it('tracks sequence numbers for debugging', () => {
    const { result } = renderHook(() => useEventBus(), {
      wrapper: ({ children }: PropsWithChildren) => <EventBusProvider>{children}</EventBusProvider>,
    });

    const initialSeq = result.current.getSequence();
    expect(initialSeq).toBe(0);

    act(() => {
      result.current.emit('engine:command', {
        type: 'START_WORKOUT',
        workoutType: 'practice',
        startedAt: 0,
      });
    });

    expect(result.current.getSequence()).toBe(1);

    act(() => {
      result.current.emit('engine:command', {
        type: 'PAUSE',
        ts: 100,
      });
    });

    expect(result.current.getSequence()).toBe(2);
  });

  it('increments sequence even when no listeners exist', () => {
    const { result } = renderHook(() => useEventBus(), {
      wrapper: ({ children }: PropsWithChildren) => <EventBusProvider>{children}</EventBusProvider>,
    });

    expect(result.current.getSequence()).toBe(0);

    act(() => {
      result.current.emit('engine:command', {
        type: 'START_WORKOUT',
        workoutType: 'practice',
        startedAt: 0,
      });
    });

    expect(result.current.getSequence()).toBe(1);
  });
});
