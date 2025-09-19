import type { PropsWithChildren } from "react";
import { act, render, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  EventBusProvider,
  type EventBus,
  useEventBus,
  useEventSubscription,
} from "./eventBus";

describe("EventBus", () => {
  it("notifies listeners when events are emitted", () => {
    const listener = vi.fn();

    const { result } = renderHook(() => useEventBus(), {
      wrapper: ({ children }: PropsWithChildren) => (
        <EventBusProvider>{children}</EventBusProvider>
      ),
    });

    const payload = { workoutId: "alpha" } as const;

    const unsubscribe = result.current.subscribe("workout:start", listener);

    act(() => {
      result.current.emit("workout:start", payload);
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(payload);

    unsubscribe();
  });

  it("does not notify listeners after unsubscribe", () => {
    const listener = vi.fn();

    const { result } = renderHook(() => useEventBus(), {
      wrapper: ({ children }: PropsWithChildren) => (
        <EventBusProvider>{children}</EventBusProvider>
      ),
    });

    const unsubscribe = result.current.subscribe("rep:complete", listener);

    act(() => {
      result.current.emit("rep:complete", {
        exercise: "squat",
        count: 1,
        timestamp: Date.now(),
      });
    });

    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();

    act(() => {
      result.current.emit("rep:complete", {
        exercise: "squat",
        count: 2,
        timestamp: Date.now(),
      });
    });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("useEventSubscription wires and tears down listeners", () => {
    const listener = vi.fn();
    let eventBus: EventBus | null = null;

    function BusHandle({ children }: PropsWithChildren) {
      eventBus = useEventBus();
      return <>{children}</>;
    }

    function Subscriber() {
      useEventSubscription("workout:stop", listener);
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
      eventBus?.emit("workout:stop", { reason: "user" });
    });

    expect(listener).toHaveBeenCalledTimes(1);

    unmount();

    act(() => {
      eventBus?.emit("workout:stop", { reason: "user" });
    });

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
