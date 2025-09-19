import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";

import type { AppEventKey, AppEventListener, AppEventMap } from "./types";

export interface EventBus {
  emit<K extends AppEventKey>(key: K, payload: AppEventMap[K]): void;
  subscribe<K extends AppEventKey>(
    key: K,
    listener: AppEventListener<K>,
  ): () => void;
}

function createEventBus(): EventBus {
  const listeners = new Map<AppEventKey, Set<AppEventListener<AppEventKey>>>();

  return {
    emit(key, payload) {
      listeners.get(key)?.forEach((listener) => {
        listener(payload);
      });
    },
    subscribe(key, listener) {
      const set = listeners.get(key) ?? new Set();
      set.add(listener as AppEventListener<AppEventKey>);
      listeners.set(key, set);

      return () => {
        set.delete(listener as AppEventListener<AppEventKey>);
        if (set.size === 0) {
          listeners.delete(key);
        }
      };
    },
  };
}

const EventBusContext = createContext<EventBus | null>(null);

export function EventBusProvider({ children }: { children: ReactNode }) {
  const bus = useMemo(() => createEventBus(), []);

  return createElement(EventBusContext.Provider, { value: bus, children });
}

export function useEventBus() {
  const bus = useContext(EventBusContext);
  if (!bus) {
    throw new Error("useEventBus must be used within an EventBusProvider");
  }

  return bus;
}

export function useEventSubscription<K extends AppEventKey>(
  key: K,
  listener: AppEventListener<K>,
) {
  const bus = useEventBus();

  useEffect(() => bus.subscribe(key, listener), [bus, key, listener]);
}
