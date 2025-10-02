import type { DevVoiceCue, VoiceDriver } from './devVoiceDriver';
import type { EventBus } from '@/services/event-bus/eventBus';

/**
 * Silent voice driver for production fallback when audio fails.
 *
 * Features:
 * - Tracks lastSpoken so captions can display
 * - Emits voice:caption events for UI
 * - Always reports as blocked (triggers caption mode)
 * - No-op for all audio operations
 */
export class SilentVoiceDriver implements VoiceDriver {
  private bus: EventBus;
  private lastSpoken: string | null = null;

  constructor(bus: EventBus) {
    this.bus = bus;
  }

  async prime(): Promise<void> {
    // no-op
  }

  handle(cue: DevVoiceCue): void {
    // Track for captions
    const text = this.resolveCueText(cue);
    this.lastSpoken = text;

    // Emit caption
    this.bus.emit('voice:caption', { text });

    // Vibrate for key events
    if (cue.type === 'milestone') {
      if ('vibrate' in navigator) {
        navigator.vibrate([100]);
      }
    }
  }

  mute(): void {
    // no-op
  }

  unmute(): void {
    // no-op
  }

  setVolume(_: number): void {
    // no-op
  }

  setRate(_: number): void {
    // no-op
  }

  stopAll(): void {
    this.lastSpoken = null;
  }

  dispose(): void {
    // no-op
  }

  isSpeaking(): boolean {
    return false;
  }

  isPrimed(): boolean {
    return true;
  }

  isBlocked(): boolean {
    return true; // always blocked
  }

  getLastSpoken(): string | null {
    return this.lastSpoken;
  }

  private resolveCueText(cue: DevVoiceCue): string {
    switch (cue.type) {
      case 'say_number':
        return String(cue.value);
      case 'milestone':
        return String(cue.value);
      default:
        return '';
    }
  }
}

export default SilentVoiceDriver;
