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
      const event: EngineEvent = {
        type: 'WORKOUT_STARTED',
        sessionId: 'session-1',
        ts: Date.now(),
      };
      result.current.emit('engine:event', event);
    });

    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();

    act(() => {
      const event: EngineEvent = {
        type: 'WORKOUT_STOPPED',
        reason: 'user',
        ts: Date.now(),
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
      const event: EngineEvent = {
        type: 'WORKOUT_STOPPED',
        reason: 'user',
        ts: Date.now(),
      };
      eventBus?.emit('engine:event', event);
    });

    expect(listener).toHaveBeenCalledTimes(1);

    unmount();

    act(() => {
      const event: EngineEvent = {
        type: 'WORKOUT_STOPPED',
        reason: 'user',
        ts: Date.now(),
      };
      eventBus?.emit('engine:event', event);
    });

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
