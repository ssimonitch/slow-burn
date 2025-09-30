import { createContext, createElement, useContext, useEffect, useMemo, type ReactNode } from 'react';

import type { AppEventKey, AppEventListener, AppEventMap } from './types';

export interface EventBus {
  emit<K extends AppEventKey>(key: K, payload: AppEventMap[K]): void;
  subscribe<K extends AppEventKey>(key: K, listener: AppEventListener<K>): () => void;
  getSequence(): number;
}

function createEventBus(): EventBus {
  const listeners = new Map<AppEventKey, Set<AppEventListener<AppEventKey>>>();
  let sequence = 0;
  const isDev = typeof import.meta !== 'undefined' ? Boolean(import.meta.env?.DEV) : false;

  return {
    emit(key, payload) {
      sequence += 1;
      const currentSeq = sequence;

      const listenerSet = listeners.get(key);
      if (!listenerSet) {
        return;
      }

      listenerSet.forEach((listener) => {
        try {
          listener(payload);
        } catch (error) {
          // Log error and continue dispatching to remaining listeners
          console.error(`[EventBus] Error in listener for '${key}' (seq ${currentSeq}):`, error);

          // Emit diagnostic event in dev mode (if not already emitting debug:log to avoid recursion)
          if (isDev && key !== 'debug:log') {
            try {
              const debugListeners = listeners.get('debug:log');
              debugListeners?.forEach((debugListener) => {
                try {
                  debugListener({
                    message: `Event listener error: ${error instanceof Error ? error.message : String(error)}`,
                    ts: performance.now(),
                    source: 'event-bus',
                  });
                } catch {
                  // Silently ignore debug logging errors
                }
              });
            } catch {
              // Silently ignore debug logging errors
            }
          }
        }
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
    getSequence() {
      return sequence;
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
    throw new Error('useEventBus must be used within an EventBusProvider');
  }

  return bus;
}

export function useEventSubscription<K extends AppEventKey>(key: K, listener: AppEventListener<K>) {
  const bus = useEventBus();

  useEffect(() => {
    const unsubscribe = bus.subscribe(key, listener);
    return unsubscribe;
  }, [bus, key, listener]);
}
