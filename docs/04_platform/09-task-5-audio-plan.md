# Task 5: Recorded Audio + Web Audio VoiceDriver

**Doc:** 09-task-5-audio-plan.md
**Created:** 2025-01-10
**Updated:** 2025-01-10 (after review)
**Status:** Ready for Implementation
**Dependencies:** Task 4 (Dev voice driver) ✅
**Related:** 14-voice-driver-spec.md, 05-worker-integration.md

---

## Overview

Implement production-quality voice feedback using the Web Audio API with preloaded audio buffers. Replace the dev SpeechSynthesis driver with a WebAudioVoiceDriver that plays pre-recorded number cues (1-50), milestone announcements, and Circuit time-based cues with <150ms latency for Practice and ±100ms tolerance for Circuit.

**Scope:**
- **Practice mode**: numbers 1-50 + milestones (10, 20) + final rep preemption
- **Circuit mode**: countdown (3,2,1,go), halfway, final5, rest_15s, next_move intros (MVP per voice spec §3)
- **Fallbacks**: Web Audio (primary) → Dev TTS (flag) → Silent with captions+vibration (production)
- **Telemetry**: Track latency (p95), display in debug HUD
- **Single language**: en-US for MVP

---

## Phase 1: Audio Asset Generation & Documentation

### 1.1 Audio Asset Guide Document

**Create:** `docs/04_platform/08-audio-asset-guide.md`

**Contents:**
- **Source requirements:**
  - Format: mp3 (primary) + ogg vorbis (fallback)
  - Sample rate: 44.1kHz recommended
  - Bit depth: 16-bit minimum
  - Channels: mono (stereo acceptable but unnecessary)
- **Loudness normalization:**
  - Target: -16 LUFS (perceived loudness standard)
  - Peak ceiling: -1.0 dBTP (avoid clipping)
  - Use `ffmpeg-normalize` or equivalent
- **File size target:**
  - ≤10 KB per file (use VBR encoding, ~64 kbps)
  - Total payload budget: ~500 KB for numbers 1-50
- **Duration limits:**
  - Numbers: ≤800ms (target 400-600ms)
  - Phrases: ≤2000ms (depends on phrase)
- **Silence trimming:**
  - Remove leading/trailing silence >50ms
  - Keep ~20ms padding for natural start/end
- **Naming convention:**
  - Numbers: `01.mp3` through `50.mp3` (zero-padded, 2 digits)
  - Phrases: `go.mp3`, `halfway.mp3`, `final5.mp3`, `rest_15s.mp3`
- **Directory structure:**
  ```
  /packages/app/public/audio/
  ├── manifest.json
  ├── numbers/
  │   └── en/
  │       ├── 01.mp3
  │       ├── 02.mp3
  │       └── ... (through 50.mp3)
  └── ui/
      ├── 3.mp3, 2.mp3, 1.mp3, go.mp3
      ├── halfway.mp3, final5.mp3
      ├── rest_15s.mp3
      └── next_*.mp3 (9 files for MVP exercises)
  ```
- **Total catalog**: ~65 files (50 numbers + 15 Circuit/UI phrases)

### 1.2 Audio Generation Script (MVP Placeholder)

**Create:** `scripts/generate-audio-assets.js`

**Purpose:** Generate placeholder audio assets using **ffmpeg CLI** beeps/tones so we can develop and test the WebAudioVoiceDriver before final TTS assets arrive.

**Why ffmpeg (not Web Audio API):** Node.js doesn't have the Web Audio API - that's a browser API. Use ffmpeg's `lavfi` (Libavfilter virtual input) to generate tones directly to files.

**Implementation:**
```javascript
// Generate beep-based placeholders using ffmpeg
// Numbers 1-50:
//   - 1-9: single beep (880 Hz, 100ms)
//   - 10-19: double beep (880 Hz, 100ms each + 50ms gap)
//   - 20-29: triple beep
//   - 30-39: quad beep
//   - 40-50: penta beep
//
// Circuit phrases:
//   - 3.mp3, 2.mp3, 1.mp3: descending tones (880, 784, 698 Hz)
//   - go.mp3: ascending chirp (440→880 Hz)
//   - halfway.mp3, final5.mp3: distinct patterns
//   - rest_15s.mp3: calm low tone
//   - next_*.mp3: 9 files with beep + pause pattern
//
// Output: /packages/app/public/audio/{numbers/en, ui}/

// Example ffmpeg commands:
// Single beep:
// ffmpeg -f lavfi -i sine=frequency=880:duration=0.1 -filter:a "volume=-10dB" 01.mp3
//
// Double beep (concat):
// ffmpeg -f lavfi -i sine=f=880:d=0.1 -filter_complex "[0:a]volume=-10dB,apad=pad_len=2205[a0];[a0][0:a]volume=-10dB[a1];[a0][a1]concat=n=2:v=0:a=1" 10.mp3
```

**Features:**
- Use ffmpeg CLI via `child_process.execSync`
- Generate all 65 files (50 numbers + 15 phrases)
- Generate manifest.json with metadata:
  ```json
  {
    "version": "1.0.0",
    "generated_at": "2025-01-10T12:00:00Z",
    "assets": {
      "numbers": [
        { "id": "01", "path": "/audio/numbers/en/01.mp3", "duration": 150 }
      ]
    }
  }
  ```
- Validate: all files generated, total size <1MB

**Run:**
```bash
node scripts/generate-audio-assets.js
```

### 1.3 Audio Ingest Script (Future TTS)

**Create:** `scripts/ingest-audio-assets.js`

**Purpose:** Process high-quality TTS-generated audio files (from ElevenLabs, PlayHT, etc.) into optimized, normalized assets for production.

**Workflow:**
1. **Input:** Read source files from `tmp/audio-source/`
   - Expected: `1.wav`, `2.wav`, ... `50.wav` (any format ffmpeg supports)
2. **Normalize:** Use `ffmpeg-normalize` to -16 LUFS
3. **Encode:** Convert to mp3 (VBR ~64kbps) + ogg vorbis
4. **Trim:** Remove silence >50ms (keep ~20ms padding)
5. **Validate:**
   - All numbers 1-50 present
   - Durations within limits (<800ms for numbers)
   - File sizes <10KB
6. **Output:** Write to `/packages/app/public/audio/numbers/en/`
7. **Manifest:** Update `manifest.json` with new version + metadata
8. **Report:** Log missing files, oversized files, total payload

**Dependencies:**
```json
{
  "fluent-ffmpeg": "^2.1.2",
  "ffmpeg-normalize": "^1.24.0"
}
```

**Run:**
```bash
# Place source files in tmp/audio-source/
node scripts/ingest-audio-assets.js --source tmp/audio-source --output packages/app/public/audio
```

---

## Phase 2: Web Audio VoiceDriver Implementation

### 2.1 Architecture

**Key constraint:** AudioContext and `decodeAudioData()` are **not available in Web Workers**. All audio decoding must happen on the main thread.

**Recommendation:** Decode all buffers on main thread during "prime" phase. For ~50 files × 10KB = ~500KB total, modern browsers decode in <100ms. This is a one-time cost acceptable for MVP.

### 2.2 WebAudioVoiceDriver

**Create:** `packages/app/src/features/voice/webAudioDriver.ts`

**Interface:** Implement existing `VoiceDriver` interface (same as DevSpeechSynthesisVoiceDriver)

```typescript
export class WebAudioVoiceDriver implements VoiceDriver {
  private audioCtx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();

  private currentSource: AudioBufferSourceNode | null = null;
  private pendingCue: DevVoiceCue | null = null;

  private primed = false;
  private blocked = false;
  private muted = false;
  private volume = 1;
  private rate = 1; // note: Web Audio uses playbackRate

  private lastCueText: string | null = null;
  private lastCueTimestamp = 0;
  private lastSpoken: string | null = null;

  async prime(): Promise<void>;
  handle(cue: DevVoiceCue): void;
  mute(): void;
  unmute(): void;
  setVolume(v: number): void;
  setRate(r: number): void;
  stopAll(): void;
  dispose(): void;
  isSpeaking(): boolean;
  isPrimed(): boolean;
  isBlocked(): boolean;
  getLastSpoken(): string | null;
}
```

**Key implementation details:**

**AudioContext lifecycle:**
- Singleton instance created on first `prime()` call
- `prime()` sequence (with **staged decoding** for better UX):
  1. Create AudioContext (or resume if suspended)
  2. Fetch manifest from `${import.meta.env.BASE_URL}audio/manifest.json` (base-safe)
  3. **Stage 1**: Fetch + decode numbers 1-10 (immediate, blocks on prime)
  4. Play silent buffer (50ms) to unlock Safari autoplay
  5. Set `primed = true` if successful, `blocked = true` if failed
  6. **Stage 2**: Fetch + decode numbers 11-30 in background (Promise pool)
  7. **Stage 3**: Fetch + decode numbers 31-50 + Circuit phrases in background
  8. Emit progress events for harness HUD: `voice:decode_progress` (0-100%)

**Buffer pool preloading with staged decoding:**
```typescript
private async loadBuffers(manifest: AudioManifest): Promise<void> {
  const baseUrl = import.meta.env.BASE_URL || '/';

  // Stage 1: Critical starter set (1-10) - await before returning from prime()
  const starterIds = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'];
  await this.decodeBatch(starterIds, manifest, baseUrl);

  // Stage 2: Common range (11-30) - background
  const commonIds = Array.from({length: 20}, (_, i) => String(i + 11).padStart(2, '0'));
  this.decodeBatch(commonIds, manifest, baseUrl); // don't await

  // Stage 3: High range + Circuit phrases - background
  const highIds = Array.from({length: 20}, (_, i) => String(i + 31).padStart(2, '0'));
  const circuitIds = ['3', '2', '1', 'go', 'halfway', 'final5', 'rest_15s', ...nextMoveIds];
  this.decodeBatch([...highIds, ...circuitIds], manifest, baseUrl); // don't await
}

private async decodeBatch(ids: string[], manifest: AudioManifest, baseUrl: string) {
  for (const id of ids) {
    const asset = manifest.assets.find(a => a.id === id);
    if (!asset) continue;

    const url = `${baseUrl}${asset.path}`;
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.audioCtx!.decodeAudioData(arrayBuffer);
    this.buffers.set(id, audioBuffer);

    // Emit progress
    this.emitProgress(this.buffers.size, manifest.assets.length);
  }
}
```

**Queue logic (per voice spec §6):**

```typescript
handle(cue: DevVoiceCue): void {
  // De-dup: ignore same cue within 250ms
  const cueText = this.resolveCueText(cue);
  const now = performance.now();
  if (this.lastCueText === cueText && now - this.lastCueTimestamp < 250) {
    return; // de-dup
  }
  this.lastCueText = cueText;
  this.lastCueTimestamp = now;

  const isMilestone = cue.type === 'milestone';
  const isFinalRep = this.isFinalRep(cue); // check if final rep (TBD)

  // Preemption logic
  if (isMilestone || isFinalRep) {
    if (this.currentSource) {
      this.stopAll(); // stop current, clear pending
    }
    this.playCue(cue);
    return;
  }

  // Drop-latest for regular numbers
  if (this.currentSource) {
    // Already speaking, drop this cue
    return;
  }

  this.playCue(cue);
}

private playCue(cue: DevVoiceCue): void {
  const buffer = this.getBuffer(cue);
  if (!buffer) return;

  const source = this.audioCtx!.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = this.rate;
  source.connect(this.gainNode!);

  source.onended = () => {
    this.currentSource = null;
    this.lastSpoken = this.resolveCueText(cue);

    // Handle pending cue if any
    if (this.pendingCue) {
      const pending = this.pendingCue;
      this.pendingCue = null;
      this.handle(pending);
    }
  };

  this.currentSource = source;
  source.start(0);
}
```

**GainNode for volume:**
```typescript
constructor() {
  // Create gain node during prime
  this.gainNode = this.audioCtx.createGain();
  this.gainNode.connect(this.audioCtx.destination);
}

setVolume(v: number): void {
  this.volume = Math.max(0, Math.min(1, v));
  if (this.gainNode) {
    this.gainNode.gain.value = this.muted ? 0 : this.volume;
  }
}

mute(): void {
  this.muted = true;
  if (this.gainNode) this.gainNode.gain.value = 0;
}
```

**isSpeaking implementation:**
```typescript
isSpeaking(): boolean {
  return this.currentSource !== null;
}
```

### 2.3 voiceAdapter.ts (no changes needed)

The existing adapter subscribes to `engine:event`, applies cue policies (milestone tracking, final rep detection), and calls `driver.handle(cue)`. This works with both drivers.

### 2.4 VoiceRuntimeBridge Updates

**Update:** `packages/app/src/features/voice/VoiceRuntimeBridge.tsx`

**Feature detection + driver selection:**

```typescript
function selectVoiceDriver(): VoiceDriver {
  const hasWebAudio = typeof window !== 'undefined' && 'AudioContext' in window;
  const devTtsEnabled = import.meta.env.VITE_VOICE_DEV_TTS === 'true';
  const webAudioEnabled = import.meta.env.VITE_VOICE_WEB_AUDIO !== 'false'; // default true

  // Check if assets are available
  const assetsAvailable = checkAudioAssets(); // fetch /audio/manifest.json

  if (hasWebAudio && webAudioEnabled && assetsAvailable) {
    return new WebAudioVoiceDriver();
  }

  if (import.meta.env.DEV || devTtsEnabled) {
    return new DevSpeechSynthesisVoiceDriver();
  }

  // Production fallback: silent (captions only)
  return new SilentVoiceDriver();
}

function checkAudioAssets(): boolean {
  try {
    // Sync check: does manifest.json exist?
    // This is a best-effort check; actual fetch happens in prime()
    return true; // For now, assume assets exist
  } catch {
    return false;
  }
}
```

### 2.5 Captions + Haptics Fallback (Required per Spec)

**When audio is blocked:**
- `prime()` fails or `audioCtx.state !== 'running'`
- Set `blocked = true` in driver
- UI must render **captions** for all voice cues
- Optionally call `navigator.vibrate([100])` for important cues

**Implementation in Practice Harness:**

```typescript
// In PracticeHarness.tsx or VoiceOverlay component
{voiceBlocked && voiceLast && (
  <div className="fixed bottom-20 left-0 right-0 flex justify-center">
    <div className="rounded-lg bg-slate-900/90 px-6 py-3 text-2xl font-bold text-white shadow-lg">
      {voiceLast}
    </div>
  </div>
)}
```

**Haptic feedback for key events:**
```typescript
// In voiceAdapter.ts when driver is blocked
if (driver.isBlocked()) {
  // Show caption
  bus.emit('voice:caption', { text: cueText });

  // Vibrate for countdown/milestones
  if (cue.type === 'milestone' || cue.type === 'countdown') {
    if ('vibrate' in navigator) {
      navigator.vibrate([100]);
    }
  }
}
```

**Satisfies voice spec §10 acceptance criteria:**
> "Autoplay: after first gesture, audio works on Safari iOS and Chrome Android; if blocked, **captions + vibration appear**."

### 2.6 Telemetry (Required for Acceptance)

**Track latency per voice spec §8:**
- Record `t_play - t_cue_received` (ms) for each cue
- Calculate rolling p95 latency (last 100 cues)
- Display in harness debug HUD
- Flag if latency exceeds thresholds:
  - Practice: >150ms
  - Circuit: >200ms

**Implementation:**

```typescript
// In WebAudioVoiceDriver
private latencies: number[] = [];

private playCue(cue: DevVoiceCue, receivedAt: number): void {
  // ... existing code ...

  const playedAt = performance.now();
  const latency = playedAt - receivedAt;
  this.latencies.push(latency);
  if (this.latencies.length > 100) this.latencies.shift();

  // Emit to HUD
  bus.emit('voice:telemetry', {
    latency,
    p95: this.calculateP95(),
    bufferCount: this.buffers.size,
    blocked: this.blocked
  });
}

private calculateP95(): number {
  const sorted = [...this.latencies].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * 0.95);
  return sorted[idx] || 0;
}
```

**Display in harness:**
```typescript
// In PracticeHarness voice panel
<dt className="text-slate-400">Latency (p95)</dt>
<dd className={`font-medium ${voiceP95 > 150 ? 'text-rose-300' : 'text-slate-100'}`}>
  {voiceP95 ? `${Math.round(voiceP95)}ms` : '—'}
</dd>
```

### 2.7 SilentVoiceDriver (Production Fallback)

**Create:** `packages/app/src/features/voice/silentDriver.ts`

```typescript
// No-op driver for production when audio fails
// Tracks lastSpoken so captions can display
export class SilentVoiceDriver implements VoiceDriver {
  private lastSpoken: string | null = null;

  async prime() { /* no-op */ }
  handle(cue: DevVoiceCue) {
    // Track for captions
    this.lastSpoken = cue.type === 'say_number' ? String(cue.value) : `milestone ${cue.value}`;
  }
  mute() { /* no-op */ }
  unmute() { /* no-op */ }
  setVolume() { /* no-op */ }
  setRate() { /* no-op */ }
  stopAll() { this.lastSpoken = null; }
  dispose() { /* no-op */ }
  isSpeaking() { return false; }
  isPrimed() { return true; }
  isBlocked() { return true; }
  getLastSpoken() { return this.lastSpoken; }
}
```

---

## Phase 3: Testing

### 3.1 Unit Tests

**Create:** `packages/app/src/features/voice/webAudioDriver.test.ts`

**Mock AudioContext:**
```typescript
class MockAudioContext {
  state = 'suspended';
  sampleRate = 44100;
  destination = {};

  async resume() { this.state = 'running'; }
  async decodeAudioData(buf: ArrayBuffer): Promise<AudioBuffer> {
    return new MockAudioBuffer(buf.byteLength);
  }
  createBufferSource() { return new MockAudioBufferSourceNode(); }
  createGain() { return new MockGainNode(); }
}

class MockAudioBufferSourceNode {
  buffer: AudioBuffer | null = null;
  playbackRate = { value: 1 };
  onended: (() => void) | null = null;

  connect() {}
  start() {
    // Immediately fire onended for test control
    setTimeout(() => this.onended?.(), 0);
  }
  stop() {
    this.onended?.();
  }
}
```

**Test cases:**
1. **Prime sequence**: verify buffers loaded, silent buffer played
2. **Drop-latest policy**: fire 5 numbers rapidly, only first + milestones play
3. **Milestone preemption**: number playing → milestone arrives → currentSource.stop() called
4. **Final rep preemption**: rep 29 playing → rep 30 (final) preempts
5. **De-dup**: same cue twice within 250ms → second ignored
6. **Queue state**: verify `currentSource` and `pendingCue` transitions
7. **Volume/mute**: verify GainNode.gain.value changes
8. **Rate**: verify playbackRate.value changes

### 3.2 Manual Testing in Harness

**Test with generated beep assets first:**
1. Run `node scripts/generate-audio-assets.js`
2. Start dev server: `pnpm --filter app dev`
3. Open harness, click "Prime Voice"
4. Start workout → start set (target 30)
5. Click "Start Auto Reps" or spam "Fake Rep Complete"
6. **Verify:**
   - Hear beeps for reps (distinct patterns)
   - Milestones 10, 20 always play (even if spamming)
   - Final rep (30) always plays
   - "Last Spoken Indicator" updates correctly
   - Mute toggle works
   - Volume slider adjusts loudness
   - Rate slider adjusts playback speed

**Toggle drivers:**
```bash
# Web Audio (default if assets exist)
VITE_VOICE_WEB_AUDIO=true pnpm --filter app dev

# Dev TTS fallback
VITE_VOICE_DEV_TTS=true pnpm --filter app dev
```

---

## Phase 4: Workbox Precaching (CORRECTED)

### 4.1 Update vite-plugin-pwa Config

**Important:** We're using `strategies: 'injectManifest'`, which means:
- **Precache patterns** go in `injectManifest.globPatterns`
- **Runtime caching routes** stay ONLY in `src/sw/entry.ts` (already configured)
- Do NOT duplicate `runtimeCaching` in plugin config

**Edit:** `packages/app/vite.config.ts`

```typescript
VitePWA({
  strategies: 'injectManifest',
  srcDir: 'src/sw',
  filename: 'entry.ts',
  injectRegister: 'auto',
  registerType: 'autoUpdate',
  devOptions: { enabled: true, type: 'module' },
  injectManifest: {
    globPatterns: [
      '**/*.{js,css,html,svg,png,webmanifest,json}',
      '**/*.{mp3,ogg}',           // Audio assets
      'audio/**/*',                // All audio directory files
      'assets/models/**/*.json'    // Pose models
    ],
    maximumFileSizeToCacheInBytes: 3 * 1024 * 1024 // 3MB (accommodates model + audio)
  },
  // NO runtimeCaching here - already in src/sw/entry.ts
})
```

**Verify `src/sw/entry.ts` already has audio routes (✅ already correct):**

```typescript
registerRoute(
  ({ request }) => request.destination === 'audio',
  new CacheFirst({
    cacheName: 'sb-audio',
  }),
);
```

### 4.2 Test Offline Mode

1. Build: `pnpm --filter app build`
2. Preview: `pnpm --filter app preview`
3. Open DevTools → Application → Service Workers → verify registered
4. DevTools → Network → toggle "Offline"
5. Reload page
6. Start workout → start set → verify audio plays

---

## Browser Support Target

Given MVP → native port timeline:

**Supported:**
- Safari iOS 16+ (modern AudioContext, PWA support)
- Chrome/Edge 100+ (stable Web Audio, AudioWorklet)
- Firefox 100+ (Web Audio API complete)

**Not supported:**
- IE11 (deprecated, no AudioContext)
- Safari <15 (old AudioContext quirks)
- Niche browsers (Opera Mini, UC Browser)

**Minimum requirements documented in:**
- README.md browser compatibility section
- `/public/unsupported-browser.html` fallback page

---

## Deliverables Checklist

**Documentation:**
- [ ] `docs/04_platform/08-audio-asset-guide.md` — asset requirements, ffmpeg commands, LUFS normalization

**Asset Generation:**
- [ ] `scripts/generate-audio-assets.js` — ffmpeg-based beep placeholder generator (65 files: 50 numbers + 15 Circuit)
- [ ] `scripts/ingest-audio-assets.js` — TTS asset ingestion pipeline (normalize, encode, validate)
- [ ] `packages/app/public/audio/manifest.json` — asset catalog with ids, paths, durations
- [ ] `packages/app/public/audio/numbers/en/01.mp3` ... `50.mp3` — generated placeholders
- [ ] `packages/app/public/audio/ui/` — Circuit phrases (3.mp3, 2.mp3, 1.mp3, go.mp3, halfway.mp3, final5.mp3, rest_15s.mp3, next_*.mp3 × 9)

**Web Audio Driver:**
- [ ] `packages/app/src/features/voice/webAudioDriver.ts` — Web Audio implementation with:
  - Staged decoding (1-10 immediate, 11-30 background, 31-50+Circuit background)
  - Base-safe URLs (`import.meta.env.BASE_URL` prefix)
  - Queue logic (no overlap, drop-latest, preemption)
  - Telemetry (latency tracking, p95)
  - Progress events for HUD
- [ ] `packages/app/src/features/voice/silentDriver.ts` — production fallback (tracks lastSpoken for captions)

**Integration:**
- [ ] `packages/app/src/features/voice/VoiceRuntimeBridge.tsx` — updated driver selection with feature detection
- [ ] `packages/app/src/features/voice/voiceAdapter.ts` — add captions + vibration when blocked
- [ ] `packages/app/src/features/workout-engine/harness/PracticeHarness.tsx` — add:
  - Decode progress indicator
  - Latency (p95) display
  - Caption overlay when audio blocked

**Workbox:**
- [ ] `packages/app/vite.config.ts` — Workbox config with `injectManifest.globPatterns` for audio precaching

**Testing:**
- [ ] `packages/app/src/features/voice/webAudioDriver.test.ts` — unit tests with mocked AudioContext
- [ ] Manual testing validation:
  - Practice: numbers 1-50, milestones 10/20, final rep preemption
  - Circuit: countdown → go → halfway → final5 → rest_15s
  - Blocked audio: captions + vibration
  - Latency: p95 < 150ms (Practice), < 200ms (Circuit)
- [ ] Offline mode verification: precached assets play with network disabled

---

## Implementation Notes

### PlaybackRate Handling

**Important:** Web Audio's `playbackRate` affects **both speed and pitch** (unlike HTML5 video). Changing rate from 1.0 will alter the pitch of recorded audio.

**MVP approach:**
- Default `playbackRate = 1.0` for production (preserve original pitch)
- Expose rate control (0.5x–2.0x) as **dev-only feature** for testing
- Document clearly: "Rate control is for development testing only; production uses 1.0x to preserve voice quality"
- If accessibility requires speed adjustment post-MVP, consider time-stretching algorithms (e.g., Sonic library) instead of simple playbackRate

### Driver vs Adapter Responsibility

**Clarified split per voice spec:**

**Adapter** (`voiceAdapter.ts`):
- Subscribes to `engine:event` on event bus
- **Policy decisions**: Which cues to send, when to preempt
  - Tracks current set goal (final rep detection)
  - Detects milestones (10, 20)
  - Decides: "This cue should preempt" vs "This cue is normal"
- Calls `driver.handle(cue)` with the appropriate cue

**Driver** (`webAudioDriver.ts`, `devVoiceDriver.ts`, `silentDriver.ts`):
- Does NOT subscribe to event bus
- **Playback decisions**: How to play the cue
  - Enforces no-overlap (only one source at a time)
  - Implements drop-if-busy or queue logic
  - Manages AudioContext, buffers, GainNode
- Simple interface: `handle(cue)`, `prime()`, `mute()`, etc.

**Example flow:**
1. Event bus: `REP_TICK` (repCount: 10)
2. Adapter: "10 is a milestone → preempt current"
3. Adapter: `driver.stopAll()` then `driver.handle({ type: 'milestone', value: 10 })`
4. Driver: "Not busy → play milestone_10 buffer immediately"

## Open Questions (Updated)

1. **Final rep detection:** ✅ Resolved
   - Tracks `currentSetGoal` from `SET_STARTED` event (already implemented in Task 4)

2. **Circuit cues:** ✅ Resolved
   - Include in Task 5 scope per MVP voice spec §3

3. **Phrase catalog size:** ✅ Resolved
   - 15 Circuit phrases: 3,2,1,go, halfway, final5, rest_15s, next_*.mp3 × 9 exercises
   - Total: 65 files (50 numbers + 15 phrases) ≈ 650KB

4. **TTS provider:** ✅ Plan documented
   - User will provide high-quality TTS output
   - Ingest script handles any ffmpeg-compatible source format
   - Future: ElevenLabs or PlayHT via thin TTSProvider interface

5. **Latency telemetry:** ✅ Resolved
   - Track in dev mode (harness HUD)
   - Required for acceptance criteria validation

---

## Related Documentation

- **Voice Driver Spec:** `docs/01_system/14-voice-driver-spec.md`
- **Worker Integration:** `docs/04_platform/05-worker-integration.md`
- **Bootstrap Plan (Task 4):** `docs/04_platform/00-bootstrap-plan.md` §5.4
- **Event Loop Spec:** `docs/01_system/11-event-loop-spec.md` (cue sources)
