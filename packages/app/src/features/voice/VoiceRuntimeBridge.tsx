import { useEffect } from 'react';

import { useEventBus } from '@/services/event-bus';

import { initializeDevVoiceAdapter } from './voiceAdapter';
import { DevSpeechSynthesisVoiceDriver, type VoiceDriver } from './devVoiceDriver';
import { WebAudioVoiceDriver } from './webAudioDriver';
import { SilentVoiceDriver } from './silentDriver';

function parseBooleanFlag(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null) return defaultValue;
  const normalized = value.trim().toLowerCase();
  return !(normalized === 'false' || normalized === '0' || normalized === 'off' || normalized === 'no');
}

/**
 * Check if Web Audio API is available
 */
function hasWebAudio(): boolean {
  return typeof window !== 'undefined' && 'AudioContext' in window;
}

/**
 * Check if audio assets are available
 * (Best-effort sync check; actual fetch happens in prime())
 */
function checkAudioAssets(): boolean {
  // For now, assume assets exist if we're in a browser
  // The actual check happens during prime() when we fetch manifest.json
  return typeof window !== 'undefined';
}

/**
 * Select voice driver based on environment and feature detection
 *
 * Priority:
 * 1. WebAudioVoiceDriver if Web Audio API available and assets exist
 * 2. DevSpeechSynthesisVoiceDriver if dev mode or VITE_VOICE_DEV_TTS=true
 * 3. SilentVoiceDriver (production fallback with captions)
 */
function selectVoiceDriver(bus: ReturnType<typeof useEventBus>): VoiceDriver {
  const hasWebAudioAPI = hasWebAudio();
  const devTtsEnabled = parseBooleanFlag(import.meta.env.VITE_VOICE_DEV_TTS, false);
  const webAudioEnabled = parseBooleanFlag(import.meta.env.VITE_VOICE_WEB_AUDIO, true); // default true
  const assetsAvailable = checkAudioAssets();

  // Web Audio driver (production primary)
  if (hasWebAudioAPI && webAudioEnabled && assetsAvailable) {
    return new WebAudioVoiceDriver(bus);
  }

  // Dev TTS driver (development fallback)
  if (import.meta.env.DEV || devTtsEnabled) {
    return new DevSpeechSynthesisVoiceDriver();
  }

  // Silent driver (production fallback)
  return new SilentVoiceDriver(bus);
}

export function VoiceRuntimeBridge() {
  const bus = useEventBus();

  useEffect(() => {
    const driver = selectVoiceDriver(bus);
    const dispose = initializeDevVoiceAdapter(bus, { enabled: true, driver });
    return () => dispose();
  }, [bus]);

  return null;
}

export default VoiceRuntimeBridge;
