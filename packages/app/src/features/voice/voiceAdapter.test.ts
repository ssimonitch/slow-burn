import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppEventKey, AppEventListener } from '@/services/event-bus';
import type { EventBus } from '@/services/event-bus/eventBus';
import { installSpeechSynthesisPolyfill, restoreSpeechSynthesis } from '@/test/speechSynthesisPolyfill';
import { initializeDevVoiceAdapter } from './voiceAdapter';

class MockBus implements EventBus {
  listeners = new Map<AppEventKey, Set<AppEventListener<AppEventKey>>>();
  private sequence = 0;

  emit<K extends AppEventKey>(key: K, payload: Parameters<AppEventListener<K>>[0]) {
    this.sequence += 1;
    this.listeners.get(key)?.forEach((listener) => listener(payload));
  }

  subscribe<K extends AppEventKey>(key: K, listener: AppEventListener<K>) {
    const set = this.listeners.get(key) ?? new Set();
    set.add(listener as AppEventListener<AppEventKey>);
    this.listeners.set(key, set);

    return () => {
      set.delete(listener as AppEventListener<AppEventKey>);
      if (set.size === 0) this.listeners.delete(key);
    };
  }

  getSequence() {
    return this.sequence;
  }
}

describe('dev voice adapter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Don't auto-complete so tests can control timing for drop-latest/preemption behavior
    installSpeechSynthesisPolyfill({ autoComplete: false });
  });

  afterEach(() => {
    vi.useRealTimers();
    restoreSpeechSynthesis();
  });

  it('speaks numbers and drops latest while speaking', () => {
    const bus = new MockBus();
    const logs: string[] = [];
    bus.subscribe('debug:log', ({ message, source }) => {
      if (source === 'voice-adapter') logs.push(message);
    });

    initializeDevVoiceAdapter(bus, { enabled: true, now: () => 1000 });

    // First rep: should speak immediately
    bus.emit('engine:event', {
      type: 'REP_TICK',
      repCount: 1,
      totalReps: 1,
      setIndex: 0,
      sessionId: 's',
      ts: 0,
    });
    expect(logs.some((m) => m.includes('spoke 1'))).toBe(true);

    // Second rep while speaking: should be dropped
    bus.emit('engine:event', {
      type: 'REP_TICK',
      repCount: 2,
      totalReps: 2,
      setIndex: 0,
      sessionId: 's',
      ts: 1,
    });
    expect(logs.some((m) => m.includes('drop_latest 2 (busy)'))).toBe(true);
    expect(logs.some((m) => m.includes('spoke 2'))).toBe(false);
  });

  it('preempts current number for milestone 10', () => {
    const bus = new MockBus();
    const logs: string[] = [];
    bus.subscribe('debug:log', ({ message, source }) => {
      if (source === 'voice-adapter') logs.push(message);
    });

    initializeDevVoiceAdapter(bus, { enabled: true, now: () => 2000 });

    // Start speaking a number
    bus.emit('engine:event', {
      type: 'REP_TICK',
      repCount: 3,
      totalReps: 3,
      setIndex: 0,
      sessionId: 's',
      ts: 0,
    });
    expect(logs.some((m) => m.includes('spoke 3'))).toBe(true);

    // Milestone 10 should cancel and then speak milestone
    bus.emit('engine:event', {
      type: 'REP_TICK',
      repCount: 10,
      totalReps: 10,
      setIndex: 0,
      sessionId: 's',
      ts: 1,
    });
    expect(logs.some((m) => m.includes('preempt current utterance for milestone'))).toBe(true);
    expect(logs.some((m) => m.includes('spoke milestone 10'))).toBe(true);
  });

  it('stops on session end', () => {
    const bus = new MockBus();
    const logs: string[] = [];
    bus.subscribe('debug:log', ({ message, source }) => {
      if (source === 'voice-adapter') logs.push(message);
    });

    initializeDevVoiceAdapter(bus, { enabled: true, now: () => 3000 });

    bus.emit('engine:event', {
      type: 'REP_TICK',
      repCount: 1,
      totalReps: 1,
      setIndex: 0,
      sessionId: 's',
      ts: 0,
    });

    bus.emit('engine:event', {
      type: 'WORKOUT_STOPPED',
      sessionId: 's',
      totalReps: 1,
      durationSec: 1,
      reason: 'user',
      ts: 2,
    });

    expect(logs.some((m) => m.includes('stopped on session end'))).toBe(true);
  });

  it('handles voice commands: prime, mute, volume, stop', async () => {
    const bus = new MockBus();
    const logs: string[] = [];
    bus.subscribe('debug:log', ({ message, source }) => {
      if (source === 'voice-adapter') logs.push(message);
    });

    initializeDevVoiceAdapter(bus, { enabled: true, now: () => 4000 });

    // Prime
    bus.emit('voice:command', { type: 'VOICE_PRIME' });
    await vi.advanceTimersByTimeAsync(1100);
    expect(logs.some((m) => m.includes('primed'))).toBe(true);

    // Mute on/off
    bus.emit('voice:command', { type: 'VOICE_MUTE', mute: true });
    bus.emit('voice:command', { type: 'VOICE_MUTE', mute: false });
    expect(logs.some((m) => m.includes('muted on'))).toBe(true);
    expect(logs.some((m) => m.includes('muted off'))).toBe(true);

    // Volume
    bus.emit('voice:command', { type: 'VOICE_SET_VOLUME', volume: 0.7 });
    expect(logs.some((m) => m.includes('volume 0.7'))).toBe(true);

    // Stop (after speaking a number)
    bus.emit('engine:event', {
      type: 'REP_TICK',
      repCount: 4,
      totalReps: 4,
      setIndex: 0,
      sessionId: 's',
      ts: 0,
    });
    bus.emit('voice:command', { type: 'VOICE_STOP' });
    expect(logs.some((m) => m.includes('stopped'))).toBe(true);
  });
});
