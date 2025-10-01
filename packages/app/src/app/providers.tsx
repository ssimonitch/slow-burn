import { Suspense, type PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import { EventBusProvider } from '@/services/event-bus';
import { WorkoutEngineRuntimeBridge } from '@/features/workout-engine';
import { SupabaseStorageBridge } from '@/services/storage';
import { VoiceRuntimeBridge } from '@/features/voice';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export function AppProviders({ children }: PropsWithChildren<unknown>) {
  return (
    <EventBusProvider>
      <SupabaseStorageBridge />
      <WorkoutEngineRuntimeBridge />
      <VoiceRuntimeBridge />
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={null}>{children}</Suspense>
        {import.meta.env.DEV ? <ReactQueryDevtools buttonPosition="bottom-left" /> : null}
      </QueryClientProvider>
    </EventBusProvider>
  );
}

export default AppProviders;
