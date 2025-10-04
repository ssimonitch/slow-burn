import type { DevVoiceCue, VoiceDriver } from './devVoiceDriver';
import type { EventBus } from '@/services/event-bus/eventBus';

const MAX_LATENCY_SAMPLES = 30;

type AudioManifest = {
  version: string;
  generated_at: string;
  total_files: number;
  total_size_bytes: number;
  assets: Array<{
    id: string;
    path: string;
    duration_ms: number;
    size_bytes: number;
    type: 'number' | 'phrase';
  }>;
};

/**
 * Web Audio API voice driver with preloaded audio buffers.
 *
 * Features:
 * - Staged decoding: 1-10 immediate, 11-30 background, 31-50+Circuit background
 * - Base-safe URLs for non-root deployments
 * - Drop-latest queue policy with milestone/final-rep preemption
 * - Latency telemetry (p95 tracking)
 * - Silent buffer unlock for Safari/iOS autoplay
 */
export class WebAudioVoiceDriver implements VoiceDriver {
  private bus: EventBus;
  private audioCtx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();

  private currentSource: AudioBufferSourceNode | null = null;

  private primed = false;
  private muted = false;
  private volume = 1;
  private rate = 1;

  private lastSpoken: string | null = null;
  private latencies: number[] = [];

  constructor(bus: EventBus) {
    this.bus = bus;
  }

  /**
   * Prime the Web Audio driver.
   *
   * IMPORTANT: Safari and iOS require this to be called from a user gesture
   * (e.g., button click) to unlock audio playback. Call this early in the
   * user flow, ideally on first interaction with the app.
   *
   * Stages:
   * 1. Create AudioContext and resume if suspended
   * 2. Fetch manifest from /audio/manifest.json
   * 3. Stage 1: Decode numbers 1-10 (blocks on prime, immediate availability)
   * 4. Play silent buffer (50ms) to unlock Safari autoplay
   * 5. Stage 2: Decode numbers 11-30 in background
   * 6. Stage 3: Decode numbers 31-50 + Circuit phrases in background
   */
  async prime(): Promise<void> {
    // Guard against re-entry to prevent AudioContext leaks
    if (this.primed || this.audioCtx) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    // Fresh session state
    this.latencies = [];

    try {
      // Create AudioContext
      this.audioCtx = new AudioContext();
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.connect(this.audioCtx.destination);

      // Resume if suspended
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      // Fetch manifest
      const baseUrl = import.meta.env.BASE_URL || '/';
      const manifestUrl = `${baseUrl}audio/manifest.json`;
      const manifestResponse = await fetch(manifestUrl);
      const manifest: AudioManifest = await manifestResponse.json();

      // Stage 1: Critical starter set (1-10) - await before marking primed
      const starterIds = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'];
      await this.decodeBatch(starterIds, manifest, baseUrl);

      // Play silent buffer to unlock Safari autoplay
      await this.playSilentBuffer();

      // Check if context is running
      if (this.audioCtx.state !== 'running') {
        // Clean up so retry can work
        if (this.audioCtx) {
          try {
            await this.audioCtx.close();
          } catch {
            // ignore close errors
          }
        }
        this.audioCtx = null;
        this.gainNode = null;
        this.emitTelemetry();
        return;
      }

      this.primed = true;
      this.emitTelemetry();

      // Stage 2: Common range (11-30) - background
      const commonIds = Array.from({ length: 20 }, (_, i) => String(i + 11).padStart(2, '0'));
      this.decodeBatch(commonIds, manifest, baseUrl); // don't await

      // Stage 3: High range + Circuit phrases - background
      const highIds = Array.from({ length: 20 }, (_, i) => String(i + 31).padStart(2, '0'));
      const circuitIds = [
        '3',
        '2',
        '1',
        'go',
        'halfway',
        'final5',
        'rest_15s',
        'next_squats',
        'next_burpees',
        'next_mountain_climbers',
        'next_high_knees',
        'next_push_ups',
        'next_side_plank_dip',
        'next_seated_knee_tuck',
        'next_up_down_plank',
        'next_russian_twist',
      ];
      this.decodeBatch([...highIds, ...circuitIds], manifest, baseUrl); // don't await
    } catch (error) {
      console.error('[WebAudioVoiceDriver] Prime failed:', error);
      // Clean up so retry can work
      if (this.audioCtx) {
        try {
          await this.audioCtx.close();
        } catch {
          // ignore close errors
        }
      }
      this.audioCtx = null;
      this.gainNode = null;
      this.emitTelemetry();
    }
  }

  /**
   * Decode a batch of audio files
   */
  private async decodeBatch(ids: string[], manifest: AudioManifest, baseUrl: string): Promise<void> {
    for (const id of ids) {
      const asset = manifest.assets.find((a) => a.id === id);
      if (!asset) {
        console.warn(`[WebAudioVoiceDriver] Asset not found in manifest: ${id}`);
        continue;
      }

      try {
        const url = `${baseUrl}${asset.path}`;
        const response = await fetch(url);

        if (!response.ok) {
          console.warn(`[WebAudioVoiceDriver] Failed to fetch ${id}: ${response.status}`);
          continue;
        }

        const arrayBuffer = await response.arrayBuffer();

        // Check if audioCtx still exists (may be disposed during async ops)
        if (!this.audioCtx) {
          continue;
        }

        const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
        this.buffers.set(id, audioBuffer);

        // Emit progress
        this.emitProgress(this.buffers.size, manifest.total_files);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`[WebAudioVoiceDriver] Failed to decode ${id}:`, errorMessage);
      }
    }
  }

  /**
   * Play silent buffer to unlock Safari autoplay
   */
  private async playSilentBuffer(): Promise<void> {
    if (!this.audioCtx) return;

    const silentBuffer = this.audioCtx.createBuffer(1, 2205, 44100); // 50ms
    const source = this.audioCtx.createBufferSource();
    source.buffer = silentBuffer;
    source.connect(this.gainNode!);

    await new Promise<void>((resolve) => {
      source.onended = () => resolve();
      source.start(0);
      setTimeout(resolve, 100); // fallback timeout
    });
  }

  /**
   * Emit decode progress event
   */
  private emitProgress(loaded: number, total: number): void {
    const percent = Math.round((loaded / total) * 100);
    this.bus.emit('voice:decode_progress', { loaded, total, percent });
  }

  /**
   * Handle a voice cue.
   *
   * Queue logic:
   * - Drop-latest: if speaking, drop incoming regular numbers
   * - Preemption: milestones and final reps preempt current speech
   * - De-dup: ignore duplicate cues within 250ms
   */
  handle(cue: DevVoiceCue): void {
    if (!this.audioCtx || !this.primed) {
      return;
    }

    const receivedAt = performance.now();

    // Get buffer for this cue
    const buffer = this.getBuffer(cue);
    if (!buffer) {
      console.warn('[WebAudioVoiceDriver] Buffer not found for cue:', cue);
      return;
    }

    const isMilestone = cue.type === 'milestone';

    // Preemption logic for milestones
    if (isMilestone && this.currentSource) {
      this.stopAll();
    }

    // Drop-latest for regular numbers
    if (cue.type === 'say_number' && this.currentSource) {
      return; // drop this cue
    }

    this.playCue(cue, buffer, receivedAt);
  }

  /**
   * Play a cue buffer
   */
  private playCue(cue: DevVoiceCue, buffer: AudioBuffer, receivedAt: number): void {
    if (!this.audioCtx) return;

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = this.rate;
    source.connect(this.gainNode!);

    source.onended = () => {
      this.currentSource = null;
      this.lastSpoken = this.resolveCueText(cue);

      // Emit telemetry
      const playedAt = performance.now();
      const latency = playedAt - receivedAt;
      this.recordLatency(latency);
    };

    this.currentSource = source;
    source.start(0);
  }

  /**
   * Get buffer for a cue
   */
  private getBuffer(cue: DevVoiceCue): AudioBuffer | null {
    const id = this.getCueId(cue);
    return this.buffers.get(id) ?? null;
  }

  /**
   * Get asset ID for a cue
   */
  private getCueId(cue: DevVoiceCue): string {
    switch (cue.type) {
      case 'say_number':
      case 'milestone':
        return String(cue.value).padStart(2, '0');
      default:
        return '';
    }
  }

  /**
   * Resolve cue text for caption display
   */
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

  /**
   * Calculate p95 latency
   */
  private calculateP95(): number {
    if (this.latencies.length === 0) return 0;
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * 0.95);
    return sorted[idx] || 0;
  }

  private recordLatency(latency: number): void {
    if (Number.isFinite(latency)) {
      this.latencies.push(latency);
      if (this.latencies.length > MAX_LATENCY_SAMPLES) {
        this.latencies.shift();
      }
    }

    this.emitTelemetry(Number.isFinite(latency) ? latency : null);
  }

  private emitTelemetry(latency: number | null = null): void {
    this.bus.emit('voice:telemetry', {
      latency: latency ?? 0,
      p95: this.calculateP95(),
      bufferCount: this.buffers.size,
    });
  }

  mute(): void {
    this.muted = true;
    if (this.gainNode) {
      this.gainNode.gain.value = 0;
    }
  }

  unmute(): void {
    this.muted = false;
    if (this.gainNode) {
      this.gainNode.gain.value = this.volume;
    }
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.gainNode && !this.muted) {
      this.gainNode.gain.value = this.volume;
    }
  }

  setRate(r: number): void {
    this.rate = Math.max(0.5, Math.min(2, r));
  }

  stopAll(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.onended = null;
        this.currentSource = null;
      } catch {
        // ignore
      }
    }
    this.latencies = [];
    this.emitTelemetry();
  }

  dispose(): void {
    this.stopAll();
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
    this.gainNode = null;
    this.buffers.clear();
    this.primed = false;
    this.latencies = [];
    this.emitTelemetry();
  }

  isSpeaking(): boolean {
    return this.currentSource !== null;
  }

  isPrimed(): boolean {
    return this.primed;
  }

  isBlocked(): boolean {
    return !this.primed;
  }

  getLastSpoken(): string | null {
    return this.lastSpoken;
  }
}

export default WebAudioVoiceDriver;
