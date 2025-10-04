import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppEventKey, AppEventListener } from '@/services/event-bus';
import type { EventBus } from '@/services/event-bus/eventBus';
import { installSpeechSynthesisPolyfill, restoreSpeechSynthesis } from '@/test/speechSynthesisPolyfill';
import type { VoiceDriver } from './devVoiceDriver';
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
    expect(logs.some((m) => m.includes('spoke 10'))).toBe(true);
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

  it('preempts current number for final rep of set', () => {
    const bus = new MockBus();
    const logs: string[] = [];
    bus.subscribe('debug:log', ({ message, source }) => {
      if (source === 'voice-adapter') logs.push(message);
    });

    initializeDevVoiceAdapter(bus, { enabled: true, now: () => 5000 });

    // Start a set with goal of 5 reps
    bus.emit('engine:event', {
      type: 'SET_STARTED',
      sessionId: 's',
      setIndex: 0,
      exercise: 'squat',
      targetType: 'reps',
      goalValue: 5,
      startedAt: 0,
      ts: 0,
    });

    // Start speaking rep 4
    bus.emit('engine:event', {
      type: 'REP_TICK',
      repCount: 4,
      totalReps: 4,
      setIndex: 0,
      sessionId: 's',
      ts: 1,
    });
    expect(logs.some((m) => m.includes('spoke 4'))).toBe(true);

    // Final rep (5) should preempt rep 4
    bus.emit('engine:event', {
      type: 'REP_TICK',
      repCount: 5,
      totalReps: 5,
      setIndex: 0,
      sessionId: 's',
      ts: 2,
    });
    expect(logs.some((m) => m.includes('preempt for final rep'))).toBe(true);
    expect(logs.some((m) => m.includes('spoke 5'))).toBe(true);
  });

  it('preempts when final rep is also a milestone (10/10)', () => {
    const bus = new MockBus();
    const logs: string[] = [];
    bus.subscribe('debug:log', ({ message, source }) => {
      if (source === 'voice-adapter') logs.push(message);
    });

    initializeDevVoiceAdapter(bus, { enabled: true, now: () => 6000 });

    // Start a set with goal of 10 reps (milestone AND final rep)
    bus.emit('engine:event', {
      type: 'SET_STARTED',
      sessionId: 's',
      setIndex: 0,
      exercise: 'squat',
      targetType: 'reps',
      goalValue: 10,
      startedAt: 0,
      ts: 0,
    });

    // Start speaking rep 9
    bus.emit('engine:event', {
      type: 'REP_TICK',
      repCount: 9,
      totalReps: 9,
      setIndex: 0,
      sessionId: 's',
      ts: 1,
    });
    expect(logs.some((m) => m.includes('spoke 9'))).toBe(true);

    // Rep 10 is both milestone and final rep - should preempt and speak as milestone
    bus.emit('engine:event', {
      type: 'REP_TICK',
      repCount: 10,
      totalReps: 10,
      setIndex: 0,
      sessionId: 's',
      ts: 2,
    });
    expect(logs.some((m) => m.includes('preempt'))).toBe(true);
    expect(logs.some((m) => m.includes('spoke 10'))).toBe(true);
  });

  it('handles rapid-fire reps with final rep preemption', () => {
    const bus = new MockBus();
    const logs: string[] = [];
    bus.subscribe('debug:log', ({ message, source }) => {
      if (source === 'voice-adapter') logs.push(message);
    });

    initializeDevVoiceAdapter(bus, { enabled: true, now: () => 7000 });

    // Start a set with goal of 3 reps
    bus.emit('engine:event', {
      type: 'SET_STARTED',
      sessionId: 's',
      setIndex: 0,
      exercise: 'squat',
      targetType: 'reps',
      goalValue: 3,
      startedAt: 0,
      ts: 0,
    });

    // Spam reps 1, 2, 3 rapidly while voice is busy
    bus.emit('engine:event', {
      type: 'REP_TICK',
      repCount: 1,
      totalReps: 1,
      setIndex: 0,
      sessionId: 's',
      ts: 1,
    });
    expect(logs.some((m) => m.includes('spoke 1'))).toBe(true);

    // Rep 2 arrives while speaking - should be dropped
    bus.emit('engine:event', {
      type: 'REP_TICK',
      repCount: 2,
      totalReps: 2,
      setIndex: 0,
      sessionId: 's',
      ts: 2,
    });
    expect(logs.some((m) => m.includes('drop_latest 2'))).toBe(true);

    // Rep 3 (final) arrives while still speaking - should preempt
    bus.emit('engine:event', {
      type: 'REP_TICK',
      repCount: 3,
      totalReps: 3,
      setIndex: 0,
      sessionId: 's',
      ts: 3,
    });
    expect(logs.some((m) => m.includes('preempt for final rep'))).toBe(true);
    expect(logs.some((m) => m.includes('spoke 3'))).toBe(true);
  });

  it('does not treat final rep as special for time-based sets', () => {
    const bus = new MockBus();
    const logs: string[] = [];
    bus.subscribe('debug:log', ({ message, source }) => {
      if (source === 'voice-adapter') logs.push(message);
    });

    initializeDevVoiceAdapter(bus, { enabled: true, now: () => 8000 });

    // Start a time-based set (targetType: 'time' instead of 'reps')
    bus.emit('engine:event', {
      type: 'SET_STARTED',
      sessionId: 's',
      setIndex: 0,
      exercise: 'squat',
      targetType: 'time',
      goalValue: 60,
      startedAt: 0,
      ts: 0,
    });

    // Start speaking rep 4
    bus.emit('engine:event', {
      type: 'REP_TICK',
      repCount: 4,
      totalReps: 4,
      setIndex: 0,
      sessionId: 's',
      ts: 1,
    });
    expect(logs.some((m) => m.includes('spoke 4'))).toBe(true);

    // Rep 5 should use normal drop-latest, not final-rep preemption
    bus.emit('engine:event', {
      type: 'REP_TICK',
      repCount: 5,
      totalReps: 5,
      setIndex: 0,
      sessionId: 's',
      ts: 2,
    });
    expect(logs.some((m) => m.includes('drop_latest 5'))).toBe(true);
    expect(logs.some((m) => m.includes('preempt for final rep'))).toBe(false);
  });

  it('emits captions and vibrates when driver is blocked', () => {
    const bus = new MockBus();
    const logs: string[] = [];
    const captions: string[] = [];
    const vibratePattern: number[][] = [];

    bus.subscribe('debug:log', ({ message, source }) => {
      if (source === 'voice-adapter') logs.push(message);
    });

    bus.subscribe('voice:caption', ({ text }) => {
      captions.push(text);
    });

    // Mock navigator.vibrate
    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        ...originalNavigator,
        vibrate: vi.fn((pattern: number | number[]) => {
          vibratePattern.push(Array.isArray(pattern) ? pattern : [pattern]);
          return true;
        }),
      },
      configurable: true,
    });

    // Create a mock blocked driver
    const mockDriver: VoiceDriver = {
      prime: vi.fn().mockResolvedValue(undefined),
      handle: vi.fn(),
      mute: vi.fn(),
      unmute: vi.fn(),
      setVolume: vi.fn(),
      setRate: vi.fn(),
      stopAll: vi.fn(),
      dispose: vi.fn(),
      isSpeaking: vi.fn().mockReturnValue(false),
      isPrimed: vi.fn().mockReturnValue(false),
      isBlocked: vi.fn().mockReturnValue(true),
      getLastSpoken: vi.fn().mockReturnValue(null),
    };

    initializeDevVoiceAdapter(bus, { enabled: true, driver: mockDriver, now: () => 10000 });

    // Start a set
    bus.emit('engine:event', {
      type: 'SET_STARTED',
      sessionId: 's',
      setIndex: 0,
      exercise: 'squat',
      targetType: 'reps',
      goalValue: 10,
      startedAt: 0,
      ts: 0,
    });

    // Rep 1 (regular number) - should emit caption only
    bus.emit('engine:event', {
      type: 'REP_TICK',
      repCount: 1,
      totalReps: 1,
      setIndex: 0,
      sessionId: 's',
      ts: 1,
    });

    expect(captions).toContain('1');
    expect(vibratePattern).toHaveLength(0); // No vibration for regular numbers
    expect(logs.some((m) => m.includes('caption 1 (blocked)'))).toBe(true);

    // Rep 10 (milestone) - should emit caption AND vibrate
    bus.emit('engine:event', {
      type: 'REP_TICK',
      repCount: 10,
      totalReps: 10,
      setIndex: 0,
      sessionId: 's',
      ts: 2,
    });

    expect(captions).toContain('10');
    expect(vibratePattern).toContainEqual([100]); // Milestone should vibrate
    expect(logs.some((m) => m.includes('caption 10 (blocked)'))).toBe(true);

    // Restore navigator
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
    });
  });

  it('resets goal tracking correctly across multiple sets', () => {
    const bus = new MockBus();
    const logs: string[] = [];
    bus.subscribe('debug:log', ({ message, source }) => {
      if (source === 'voice-adapter') logs.push(message);
    });

    initializeDevVoiceAdapter(bus, { enabled: true, now: () => 9000 });

    // Start first set with goal of 5
    bus.emit('engine:event', {
      type: 'SET_STARTED',
      sessionId: 's',
      setIndex: 0,
      exercise: 'squat',
      targetType: 'reps',
      goalValue: 5,
      startedAt: 0,
      ts: 0,
    });

    // Rep 5 should preempt (final rep of first set)
    bus.emit('engine:event', {
      type: 'REP_TICK',
      repCount: 1,
      totalReps: 1,
      setIndex: 0,
      sessionId: 's',
      ts: 1,
    });
    bus.emit('engine:event', {
      type: 'REP_TICK',
      repCount: 5,
      totalReps: 5,
      setIndex: 0,
      sessionId: 's',
      ts: 2,
    });
    expect(logs.some((m) => m.includes('preempt for final rep'))).toBe(true);
    expect(logs.some((m) => m.includes('spoke 5'))).toBe(true);
    logs.length = 0; // Clear logs

    // Complete first set
    bus.emit('engine:event', {
      type: 'SET_COMPLETE',
      sessionId: 's',
      setIndex: 0,
      exercise: 'squat',
      targetType: 'reps',
      goalValue: 5,
      actualReps: 5,
      durationSec: 10,
      ts: 3,
    });

    // Start second set with different goal of 8
    bus.emit('engine:event', {
      type: 'SET_STARTED',
      sessionId: 's',
      setIndex: 1,
      exercise: 'squat',
      targetType: 'reps',
      goalValue: 8,
      startedAt: 4,
      ts: 4,
    });

    // Rep 5 should NOT preempt now (not final for this set)
    bus.emit('engine:event', {
      type: 'REP_TICK',
      repCount: 4,
      totalReps: 9,
      setIndex: 1,
      sessionId: 's',
      ts: 5,
    });
    bus.emit('engine:event', {
      type: 'REP_TICK',
      repCount: 5,
      totalReps: 10,
      setIndex: 1,
      sessionId: 's',
      ts: 6,
    });
    expect(logs.some((m) => m.includes('drop_latest 5'))).toBe(true);
    expect(logs.some((m) => m.includes('spoke 5'))).toBe(false);
    logs.length = 0; // Clear logs

    // Rep 8 SHOULD preempt (final of second set)
    bus.emit('engine:event', {
      type: 'REP_TICK',
      repCount: 7,
      totalReps: 12,
      setIndex: 1,
      sessionId: 's',
      ts: 7,
    });
    bus.emit('engine:event', {
      type: 'REP_TICK',
      repCount: 8,
      totalReps: 13,
      setIndex: 1,
      sessionId: 's',
      ts: 8,
    });
    expect(logs.some((m) => m.includes('preempt for final rep'))).toBe(true);
    expect(logs.some((m) => m.includes('spoke 8'))).toBe(true);
  });
});
