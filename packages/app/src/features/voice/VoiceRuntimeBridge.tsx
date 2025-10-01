import { useEffect } from 'react';

import { useEventBus } from '@/services/event-bus';

import { initializeDevVoiceAdapter } from './voiceAdapter';

function parseBooleanFlag(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null) return defaultValue;
  const normalized = value.trim().toLowerCase();
  return !(normalized === 'false' || normalized === '0' || normalized === 'off' || normalized === 'no');
}

function isDevTtsEnabled(): boolean {
  // Enabled only in dev builds; default true unless explicitly disabled
  const desired = parseBooleanFlag(import.meta.env.VITE_VOICE_DEV_TTS, true);
  return import.meta.env.DEV && desired;
}

export function VoiceRuntimeBridge() {
  const bus = useEventBus();

  useEffect(() => {
    const enabled = isDevTtsEnabled();
    if (!enabled) {
      return;
    }
    const dispose = initializeDevVoiceAdapter(bus, { enabled });
    return () => dispose();
  }, [bus]);

  return null;
}

export default VoiceRuntimeBridge;
