import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebAudioVoiceDriver } from './webAudioDriver';
import type { EventBus } from '@/services/event-bus/eventBus';

// Mock AudioBuffer
class MockAudioBuffer {
  length: number;
  duration = 0.1;
  sampleRate = 44100;
  numberOfChannels = 1;

  constructor(length: number) {
    this.length = length;
  }
}

// Mock AudioBufferSourceNode
class MockAudioBufferSourceNode {
  buffer: AudioBuffer | null = null;
  playbackRate = { value: 1 };
  onended: (() => void) | null = null;

  connect() {
    // no-op
  }

  start() {
    // Immediately fire onended for test control
    setTimeout(() => this.onended?.(), 0);
  }

  stop() {
    this.onended?.();
  }
}

// Mock GainNode
class MockGainNode {
  gain = { value: 1 };

  connect() {
    // no-op
  }
}

// Mock AudioContext
class MockAudioContext {
  state: 'suspended' | 'running' = 'suspended';
  sampleRate = 44100;
  destination = {};

  async resume() {
    this.state = 'running';
  }

  async decodeAudioData(buf: ArrayBuffer): Promise<AudioBuffer> {
    return new MockAudioBuffer(buf.byteLength) as unknown as AudioBuffer;
  }

  createBufferSource() {
    return new MockAudioBufferSourceNode() as unknown as AudioBufferSourceNode;
  }

  createGain() {
    return new MockGainNode() as unknown as GainNode;
  }

  createBuffer(_channels: number, length: number, _rate: number) {
    return new MockAudioBuffer(length) as unknown as AudioBuffer;
  }

  async close() {
    // no-op
  }
}

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

describe('WebAudioVoiceDriver', () => {
  let originalAudioContext: typeof globalThis.AudioContext | undefined;

  beforeEach(() => {
    // Mock AudioContext
    originalAudioContext = globalThis.AudioContext;
    globalThis.AudioContext = MockAudioContext as unknown as typeof AudioContext;

    // Mock fetch using vi.stubGlobal for proper interception
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        // Handle both relative and absolute URLs
        let url: string;
        if (typeof input === 'string') {
          url = input;
        } else if (input instanceof URL) {
          url = input.toString();
        } else if ('url' in input) {
          url = input.url;
        } else {
          url = String(input);
        }

        if (url.includes('manifest.json')) {
          // Generate minimal manifest for testing
          const assets: Array<{
            id: string;
            path: string;
            duration_ms: number;
            size_bytes: number;
            type: string;
          }> = [];

          // Numbers 1-10 (minimal set for tests)
          for (let i = 1; i <= 10; i++) {
            assets.push({
              id: String(i).padStart(2, '0'),
              path: `audio/numbers/en/${String(i).padStart(2, '0')}.mp3`,
              duration_ms: 100,
              size_bytes: 1000,
              type: 'number',
            });
          }

          return Promise.resolve({
            ok: true,
            json: async () => ({
              version: '1.0.0',
              generated_at: '2025-01-10',
              total_files: assets.length,
              total_size_bytes: assets.length * 1000,
              assets,
            }),
          } as Response);
        }

        // Mock audio file fetch
        return Promise.resolve({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(1000),
        } as Response);
      }),
    );
  });

  afterEach(() => {
    if (originalAudioContext) {
      globalThis.AudioContext = originalAudioContext;
    } else {
      // @ts-expect-error - cleaning up
      delete globalThis.AudioContext;
    }

    vi.unstubAllGlobals();
  });

  it('initializes with correct state', () => {
    const bus = new MockBus();
    const driver = new WebAudioVoiceDriver(bus);

    expect(driver.isPrimed()).toBe(false);
    expect(driver.isBlocked()).toBe(true);
    expect(driver.isSpeaking()).toBe(false);
    expect(driver.getLastSpoken()).toBe(null);
  });

  it('primes successfully and loads buffers', async () => {
    const bus = new MockBus();
    const driver = new WebAudioVoiceDriver(bus);

    await driver.prime();

    expect(driver.isPrimed()).toBe(true);
    expect(driver.isBlocked()).toBe(false);

    // Check decode progress events
    const progressEvents = bus.getEvents().filter((e) => e.key === 'voice:decode_progress');
    expect(progressEvents.length).toBeGreaterThan(0);
  });

  it('limits latency tracking to recent samples per session', async () => {
    const bus = new MockBus();
    const driver = new WebAudioVoiceDriver(bus);

    await driver.prime();

    let currentTime = 0;
    const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => currentTime);

    try {
      for (let i = 0; i < 40; i++) {
        currentTime = i * 10;
        driver.handle({ type: 'say_number', value: ((i % 10) + 1) as number });
        currentTime += 20 + i; // latency grows with i
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
    } finally {
      nowSpy.mockRestore();
    }

    const latencies = (driver as unknown as { latencies: number[] }).latencies;
    expect(latencies.length).toBeLessThanOrEqual(30);
    expect(latencies[0]).toBe(30);
    expect(latencies[latencies.length - 1]).toBe(59);
  });

  it('is idempotent and does not leak AudioContext on double prime', async () => {
    const bus = new MockBus();
    const driver = new WebAudioVoiceDriver(bus);

    await driver.prime();
    bus.clearEvents();

    // Second prime should be a no-op
    await driver.prime();
    const secondPrimeProgress = bus.getEvents().filter((e) => e.key === 'voice:decode_progress').length;

    expect(driver.isPrimed()).toBe(true);
    expect(secondPrimeProgress).toBe(0); // No new decode events
  });

  it('reports blocked if AudioContext fails', async () => {
    // Mock AudioContext to fail resume
    globalThis.AudioContext = class extends MockAudioContext {
      async resume() {
        throw new Error('Failed to resume');
      }
    } as unknown as typeof AudioContext;

    const bus = new MockBus();
    const driver = new WebAudioVoiceDriver(bus);

    await driver.prime();

    expect(driver.isBlocked()).toBe(true);
    expect(driver.isPrimed()).toBe(false);
  });

  it('allows retry after prime failure', async () => {
    let resumeCallCount = 0;

    // Mock AudioContext to fail first time, succeed second time
    globalThis.AudioContext = class extends MockAudioContext {
      async resume() {
        resumeCallCount++;
        if (resumeCallCount === 1) {
          throw new Error('First attempt fails');
        }
        this.state = 'running';
      }
    } as unknown as typeof AudioContext;

    const bus = new MockBus();
    const driver = new WebAudioVoiceDriver(bus);

    // First attempt should fail
    await driver.prime();
    expect(driver.isBlocked()).toBe(true);
    expect(driver.isPrimed()).toBe(false);

    bus.clearEvents();

    // Second attempt should succeed (blocked state resets automatically)
    await driver.prime();
    expect(driver.isPrimed()).toBe(true);
    expect(driver.isBlocked()).toBe(false);
    expect(resumeCallCount).toBe(2);
  });

  it('handles say_number cues', async () => {
    const bus = new MockBus();
    const driver = new WebAudioVoiceDriver(bus);

    await driver.prime();

    driver.handle({ type: 'say_number', value: 1 });

    // Should be speaking
    expect(driver.isSpeaking()).toBe(true);

    // Wait for audio to "finish"
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(driver.isSpeaking()).toBe(false);
    expect(driver.getLastSpoken()).toBe('1');

    // Check telemetry event
    const telemetryEvents = bus.getEvents().filter((e) => e.key === 'voice:telemetry');
    expect(telemetryEvents.length).toBeGreaterThan(0);
  });

  it('drops latest number if already speaking', async () => {
    const bus = new MockBus();
    const driver = new WebAudioVoiceDriver(bus);

    await driver.prime();

    // Start speaking number 1
    driver.handle({ type: 'say_number', value: 1 });
    expect(driver.isSpeaking()).toBe(true);

    // Try to speak number 2 while speaking
    driver.handle({ type: 'say_number', value: 2 });

    // Should still be speaking 1
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(driver.getLastSpoken()).toBe('1');
  });

  it('preempts current number for milestone', async () => {
    const bus = new MockBus();
    const driver = new WebAudioVoiceDriver(bus);

    await driver.prime();

    // Start speaking number 9
    driver.handle({ type: 'say_number', value: 9 });
    expect(driver.isSpeaking()).toBe(true);

    // Milestone 10 arrives
    driver.handle({ type: 'milestone', value: 10 });

    // Should have stopped current and started milestone
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(driver.getLastSpoken()).toBe('10');
  });

  it('control methods do not break playback', async () => {
    const bus = new MockBus();
    const driver = new WebAudioVoiceDriver(bus);

    await driver.prime();

    // Verify all control methods work without throwing
    driver.mute();
    driver.unmute();
    driver.setVolume(0.5);
    driver.setRate(1.5);

    // Verify playback still works after control changes
    driver.handle({ type: 'say_number', value: 1 });
    expect(driver.isSpeaking()).toBe(true);
  });

  it('stops all audio', async () => {
    const bus = new MockBus();
    const driver = new WebAudioVoiceDriver(bus);

    await driver.prime();

    driver.handle({ type: 'say_number', value: 1 });
    expect(driver.isSpeaking()).toBe(true);

    driver.stopAll();
    expect(driver.isSpeaking()).toBe(false);
  });

  it('disposes correctly', async () => {
    const bus = new MockBus();
    const driver = new WebAudioVoiceDriver(bus);

    await driver.prime();

    driver.handle({ type: 'say_number', value: 1 });
    driver.dispose();

    expect(driver.isSpeaking()).toBe(false);
  });

  it('does not handle cues if not primed', () => {
    const bus = new MockBus();
    const driver = new WebAudioVoiceDriver(bus);

    // Try to handle before priming
    driver.handle({ type: 'say_number', value: 1 });

    expect(driver.isSpeaking()).toBe(false);
    expect(driver.getLastSpoken()).toBe(null);
  });

  it('handles missing buffer gracefully', async () => {
    const bus = new MockBus();
    const driver = new WebAudioVoiceDriver(bus);

    await driver.prime();

    // Try to play a number that wasn't loaded
    driver.handle({ type: 'say_number', value: 99 });

    expect(driver.isSpeaking()).toBe(false);
  });
});
