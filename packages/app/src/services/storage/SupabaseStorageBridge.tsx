import { useEffect } from 'react';

import { useEventBus } from '@/services/event-bus';

import { initializeSupabaseStorageAdapter } from './supabaseAdapter';

export function SupabaseStorageBridge() {
  const bus = useEventBus();

  useEffect(() => {
    const dispose = initializeSupabaseStorageAdapter(bus);

    return () => {
      dispose();
    };
  }, [bus]);

  return null;
}

export default SupabaseStorageBridge;
