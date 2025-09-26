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
});
