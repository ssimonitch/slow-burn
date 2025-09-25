import { renderHook } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import AppProviders from './providers';
import { useEventBus } from '@/services/event-bus';

describe('AppProviders', () => {
  it('exposes a stable QueryClient instance', () => {
    const { result, rerender } = renderHook(() => useQueryClient(), {
      wrapper: AppProviders,
    });

    const firstClient = result.current;
    rerender();

    expect(result.current).toBe(firstClient);
  });

  it('provides the event bus context', () => {
    const { result } = renderHook(() => useEventBus(), {
      wrapper: AppProviders,
    });

    expect(result.current.emit).toBeTypeOf('function');
    expect(result.current.subscribe).toBeTypeOf('function');
  });
});
