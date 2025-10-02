import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SilentVoiceDriver } from './silentDriver';
import type { EventBus } from '@/services/event-bus/eventBus';

// Mock EventBus
class MockBus implements EventBus {
  private events: Array<{ key: string; payload: unknown }> = [];

  emit(key: string, payload: unknown) {
    this.events.push({ key, payload });
  }

  subscribe() {
    return () => undefined;
  }

  getSequence() {
    return 0;
  }

  getEvents() {
    return this.events;
  }

  clearEvents() {
    this.events = [];
  }
}

describe('SilentVoiceDriver', () => {
  let originalNavigator: typeof globalThis.navigator;

  beforeEach(() => {
    // Mock navigator.vibrate
    originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        ...originalNavigator,
        vibrate: vi.fn(() => true),
      },
      configurable: true,
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
    });
  });

  it('initializes with correct state', () => {
    const bus = new MockBus();
    const driver = new SilentVoiceDriver(bus);

    expect(driver.isPrimed()).toBe(true); // Always primed
    expect(driver.isBlocked()).toBe(true); // Always blocked
    expect(driver.isSpeaking()).toBe(false); // Never speaking
    expect(driver.getLastSpoken()).toBe(null);
  });

  it('prime is a no-op', async () => {
    const bus = new MockBus();
    const driver = new SilentVoiceDriver(bus);

    await driver.prime();

    expect(driver.isPrimed()).toBe(true);
    expect(driver.isBlocked()).toBe(true);
  });

  it('handles say_number cues by emitting captions', () => {
    const bus = new MockBus();
    const driver = new SilentVoiceDriver(bus);

    driver.handle({ type: 'say_number', value: 1 });

    expect(driver.getLastSpoken()).toBe('1');
    expect(driver.isSpeaking()).toBe(false);

    // Check caption event
    const captionEvents = bus.getEvents().filter((e) => e.key === 'voice:caption');
    expect(captionEvents).toHaveLength(1);
    expect(captionEvents[0].payload).toEqual({ text: '1' });
  });

  it('handles milestone cues by emitting captions and vibrating', () => {
    const bus = new MockBus();
    const driver = new SilentVoiceDriver(bus);

    driver.handle({ type: 'milestone', value: 10 });

    expect(driver.getLastSpoken()).toBe('10');
    expect(driver.isSpeaking()).toBe(false);

    // Check caption event
    const captionEvents = bus.getEvents().filter((e) => e.key === 'voice:caption');
    expect(captionEvents).toHaveLength(1);
    expect(captionEvents[0].payload).toEqual({ text: '10' });

    // Check vibrate was called
    expect(globalThis.navigator.vibrate).toHaveBeenCalledWith([100]);
  });

  it('does not vibrate for regular numbers', () => {
    const bus = new MockBus();
    const driver = new SilentVoiceDriver(bus);

    driver.handle({ type: 'say_number', value: 5 });

    expect(globalThis.navigator.vibrate).not.toHaveBeenCalled();
  });

  it('control methods are no-ops', () => {
    const bus = new MockBus();
    const driver = new SilentVoiceDriver(bus);

    // All control methods should not throw and not change state
    expect(() => {
      driver.mute();
      driver.unmute();
      driver.setVolume(0.5);
      driver.setRate(1.5);
    }).not.toThrow();
  });

  it('stopAll clears lastSpoken', () => {
    const bus = new MockBus();
    const driver = new SilentVoiceDriver(bus);

    driver.handle({ type: 'say_number', value: 1 });
    expect(driver.getLastSpoken()).toBe('1');

    driver.stopAll();
    expect(driver.getLastSpoken()).toBe(null);
  });

  it('dispose is a no-op', () => {
    const bus = new MockBus();
    const driver = new SilentVoiceDriver(bus);

    driver.handle({ type: 'say_number', value: 1 });
    driver.dispose();

    // No error, no change in state
    expect(driver.isSpeaking()).toBe(false);
  });

  it('handles multiple cues in sequence', () => {
    const bus = new MockBus();
    const driver = new SilentVoiceDriver(bus);

    driver.handle({ type: 'say_number', value: 1 });
    driver.handle({ type: 'say_number', value: 2 });
    driver.handle({ type: 'milestone', value: 10 });

    expect(driver.getLastSpoken()).toBe('10');

    // Check all caption events
    const captionEvents = bus.getEvents().filter((e) => e.key === 'voice:caption');
    expect(captionEvents).toHaveLength(3);
    expect(captionEvents[0].payload).toEqual({ text: '1' });
    expect(captionEvents[1].payload).toEqual({ text: '2' });
    expect(captionEvents[2].payload).toEqual({ text: '10' });

    // Only milestone should trigger vibration
    expect(globalThis.navigator.vibrate).toHaveBeenCalledTimes(1);
  });

  it('handles vibrate not being available', () => {
    // Remove vibrate from navigator
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        ...originalNavigator,
        // No vibrate method
      },
      configurable: true,
    });

    const bus = new MockBus();
    const driver = new SilentVoiceDriver(bus);

    // Should not throw
    driver.handle({ type: 'milestone', value: 10 });

    expect(driver.getLastSpoken()).toBe('10');
  });
});
