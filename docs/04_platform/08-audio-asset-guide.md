# Audio Asset Guide — Slow Burn MVP

**Doc:** 08-audio-asset-guide.md
**Created:** 2025-01-10
**Scope:** Requirements and workflows for audio assets used in the Voice Driver (numbers 1-50 + Circuit phrases)

---

## Overview

This guide documents the technical requirements for audio assets in the Slow Burn app, including:
- **Placeholder generation** (beep patterns using ffmpeg for development)
- **TTS ingestion** (processing high-quality TTS output for production)
- **Quality standards** (LUFS, format, file size)

All audio must work offline (precached via Service Worker) and play with <150ms latency for Practice reps.

---

## 1. Asset Catalog

### 1.1 Numbers (Practice Mode)

**Purpose:** Per-rep count announcements (1-50)

**Files:** 50 total
- Path: `/packages/app/public/audio/numbers/en/NN.mp3`
- Naming: Zero-padded 2 digits (`01.mp3`, `02.mp3`, ... `50.mp3`)
- Duration target: 400-600ms (max 800ms)
- Content: Spoken number (e.g., "one", "two", "three")

### 1.2 Circuit Phrases (Circuit Mode)

**Purpose:** Time-based cues for HIIT circuits

**Files:** 15 total in `/packages/app/public/audio/ui/`

| File | Content | Duration Target |
|------|---------|-----------------|
| `3.mp3` | "Three" | ~300ms |
| `2.mp3` | "Two" | ~300ms |
| `1.mp3` | "One" | ~300ms |
| `go.mp3` | "Go!" | ~400ms |
| `halfway.mp3` | "Halfway" | ~600ms |
| `final5.mp3` | "Final five" or "5... 4... 3... 2... 1... Rest!" | ~2000ms |
| `rest_15s.mp3` | "Rest fifteen seconds" | ~1500ms |
| `next_squats.mp3` | "Next: squats" | ~1000ms |
| `next_burpees.mp3` | "Next: burpees" | ~1000ms |
| `next_mountain_climbers.mp3` | "Next: mountain climbers" | ~1500ms |
| `next_high_knees.mp3` | "Next: high knees" | ~1000ms |
| `next_push_ups.mp3` | "Next: push-ups" | ~1000ms |
| `next_side_plank_dip.mp3` | "Next: side plank dips" | ~1500ms |
| `next_seated_knee_tuck.mp3` | "Next: seated knee tucks" | ~1500ms |
| `next_up_down_plank.mp3` | "Next: up-down planks" | ~1500ms |
| `next_russian_twist.mp3` | "Next: russian twists" | ~1500ms |

**Total files:** 65 (50 numbers + 15 phrases)
**Total payload:** ~650KB (target <1MB)

---

## 2. Technical Specifications

### 2.1 Audio Format

**Primary:** MP3 (universal browser support)
- Codec: MPEG-1 Audio Layer III
- Encoding: VBR (Variable Bit Rate), target ~64 kbps
- Sample rate: 44.1 kHz
- Channels: Mono (stereo acceptable but wastes space)
- Container: `.mp3`

**Fallback (optional):** OGG Vorbis
- For browsers without MP3 support (rare in 2025)
- Same quality settings as MP3

### 2.2 Loudness Normalization

**Standard:** EBU R128 / ITU-R BS.1770-4 (LUFS)

**Target:**
- Integrated loudness: **-16 LUFS** (±1 LU tolerance)
- True peak ceiling: **-1.0 dBTP** (prevents clipping on mobile DACs)

**Why LUFS?**
- Perceptual loudness standard (not simple RMS/peak)
- Consistent perceived volume across all clips
- Prevents jarring volume jumps during workout

**Tool:** `ffmpeg-normalize` (Python package) or manual `loudnorm` filter in ffmpeg

### 2.3 File Size Constraints

**Individual file:**
- Target: ≤10 KB per file
- Maximum: 15 KB (enforce in validation)

**Total payload:**
- Target: ~650 KB (65 files × 10 KB avg)
- Maximum: 1 MB (enforce in CI)

**Rationale:**
- Fast initial load over mobile networks
- Service Worker precache budget
- Minimize decode time on low-end devices

### 2.4 Silence Trimming

**Leading/trailing silence:**
- Remove silence >50ms at start/end
- Keep ~20ms padding for natural attack/decay

**Tool:** `ffmpeg` with `silenceremove` filter

**Example:**
```bash
ffmpeg -i input.mp3 -af "silenceremove=start_periods=1:start_silence=0.05:start_threshold=-50dB,reverse,silenceremove=start_periods=1:start_silence=0.05:start_threshold=-50dB,reverse" -c:a libmp3lame -q:a 2 output.mp3
```

### 2.5 Duration Limits

| Asset Type | Min | Target | Max | Reason |
|------------|-----|--------|-----|--------|
| Numbers (1-9) | 250ms | 400-500ms | 800ms | Single syllable |
| Numbers (10-19) | 300ms | 500-600ms | 800ms | Two syllables |
| Numbers (20-50) | 300ms | 500-700ms | 800ms | Two syllables |
| Short phrases | 300ms | 600ms | 1000ms | "Go", "Halfway" |
| Long phrases | 1000ms | 1500ms | 2500ms | "Next: mountain climbers" |

**Enforcement:** Validation script rejects files outside these ranges.

---

## 3. Placeholder Generation (Development)

### 3.1 Purpose

Generate beep-based placeholders using **ffmpeg** so we can develop/test the WebAudioVoiceDriver before final TTS assets are ready.

### 3.2 Beep Pattern Strategy

**Numbers 1-50:**
- 1-9: Single beep (880 Hz, 100ms)
- 10-19: Double beep (880 Hz × 2, 50ms gap)
- 20-29: Triple beep
- 30-39: Quadruple beep
- 40-50: Quintuple beep

**Circuit phrases:**
- 3, 2, 1: Descending tones (880 Hz → 784 Hz → 698 Hz)
- go: Ascending chirp (440 Hz → 880 Hz over 200ms)
- halfway: Two-tone pattern (440 Hz + 880 Hz)
- final5: Rapid beep sequence (5× 100ms beeps)
- rest_15s: Low calming tone (220 Hz, 400ms)
- next_*: Short beep (440 Hz, 100ms) + pause

### 3.3 FFmpeg Commands

**Single beep (numbers 1-9):**
```bash
ffmpeg -f lavfi -i "sine=frequency=880:duration=0.1" \
  -af "volume=-10dB" \
  -c:a libmp3lame -q:a 4 \
  01.mp3
```

**Double beep (numbers 10-19):**
```bash
# Generate two beeps and concatenate
ffmpeg -f lavfi -i "sine=f=880:d=0.1" \
  -af "volume=-10dB,apad=pad_dur=0.05" \
  temp_beep.wav

ffmpeg -f lavfi -i "sine=f=880:d=0.1" \
  -af "volume=-10dB" \
  temp_beep2.wav

ffmpeg -f concat -safe 0 -i <(printf "file '%s'\nfile '%s'\n" temp_beep.wav temp_beep2.wav) \
  -c:a libmp3lame -q:a 4 \
  10.mp3

rm temp_beep.wav temp_beep2.wav
```

**Ascending chirp (go):**
```bash
ffmpeg -f lavfi -i "sine=frequency=440+440*t:duration=0.2" \
  -af "volume=-10dB" \
  -c:a libmp3lame -q:a 4 \
  go.mp3
```

**Calming tone (rest_15s):**
```bash
ffmpeg -f lavfi -i "sine=frequency=220:duration=0.4" \
  -af "volume=-12dB,afade=t=out:st=0.3:d=0.1" \
  -c:a libmp3lame -q:a 4 \
  rest_15s.mp3
```

### 3.4 Automation Script

See: `scripts/generate-audio-assets.js`

**Usage:**
```bash
node scripts/generate-audio-assets.js
# Generates 65 files → packages/app/public/audio/
# Creates manifest.json with metadata
```

---

## 4. TTS Ingestion (Production)

### 4.1 Purpose

Process high-quality TTS output (ElevenLabs, PlayHT, etc.) into optimized assets for production deployment.

### 4.2 Source Requirements

**Input format:** Any ffmpeg-compatible format
- WAV (preferred): 44.1 kHz or 48 kHz, 16-bit or 24-bit, mono or stereo
- MP3, OGG, FLAC, M4A: Also supported

**Input location:** `tmp/audio-source/`
- Numbers: `1.wav`, `2.wav`, ... `50.wav`
- Phrases: `go.wav`, `halfway.wav`, etc.

**Naming:** Must match expected filenames (validation enforces this)

### 4.3 Ingestion Pipeline

See: `scripts/ingest-audio-assets.js`

**Steps:**
1. **Validate input:**
   - Check all required files present (50 numbers + 15 phrases)
   - Verify durations within limits
   - Check for clipping or distortion
2. **Normalize loudness:**
   - Target: -16 LUFS integrated, -1.0 dBTP peak
   - Tool: `ffmpeg-normalize` or `loudnorm` filter
3. **Trim silence:**
   - Remove leading/trailing silence >50ms
   - Keep ~20ms padding
4. **Encode to MP3:**
   - VBR encoding, quality level 2-4 (64-96 kbps target)
   - 44.1 kHz sample rate, mono
5. **Generate OGG fallback (optional):**
   - Same quality settings
6. **Validate output:**
   - Check file sizes (<10 KB target, <15 KB max)
   - Verify durations within limits
   - Confirm LUFS within ±1 LU of target
7. **Write to public/audio/:**
   - numbers/en/NN.mp3
   - ui/*.mp3
8. **Update manifest.json:**
   - Add paths, durations, file sizes
   - Bump version
9. **Report:**
   - Log any warnings (oversized, too long, etc.)
   - Show total payload size

**Usage:**
```bash
# Place TTS output in tmp/audio-source/
node scripts/ingest-audio-assets.js \
  --source tmp/audio-source \
  --output packages/app/public/audio \
  --validate
```

### 4.4 Quality Validation

**Automated checks:**
- LUFS within -17 to -15 LUFS (±1 LU tolerance)
- True peak < -1.0 dBTP
- Duration within limits per asset type
- File size < 15 KB
- No clipping detected
- Sample rate = 44.1 kHz

**Manual QA:**
- Listen to each file for artifacts
- Check perceived volume consistency
- Verify clarity on mobile speakers

---

## 5. Manifest Schema

**File:** `/packages/app/public/audio/manifest.json`

**Purpose:** Map asset IDs to paths with metadata for WebAudioVoiceDriver preloading.

**Schema:**
```json
{
  "version": "1.0.0",
  "generated_at": "2025-01-10T12:34:56Z",
  "total_files": 65,
  "total_size_bytes": 650000,
  "assets": [
    {
      "id": "01",
      "path": "audio/numbers/en/01.mp3",
      "duration_ms": 450,
      "size_bytes": 8192,
      "type": "number"
    },
    {
      "id": "go",
      "path": "audio/ui/go.mp3",
      "duration_ms": 400,
      "size_bytes": 7200,
      "type": "phrase"
    }
  ]
}
```

**Fields:**
- `id`: Unique identifier (e.g., "01", "halfway", "next_squats")
- `path`: Relative to `public/` directory (base-url safe)
- `duration_ms`: Duration in milliseconds (for UI/debugging)
- `size_bytes`: File size (for payload monitoring)
- `type`: "number" | "phrase" (for categorization)

---

## 6. Directory Structure

```
packages/app/public/audio/
├── manifest.json               # Asset catalog
├── numbers/
│   └── en/
│       ├── 01.mp3
│       ├── 02.mp3
│       └── ... (through 50.mp3)
└── ui/
    ├── 3.mp3
    ├── 2.mp3
    ├── 1.mp3
    ├── go.mp3
    ├── halfway.mp3
    ├── final5.mp3
    ├── rest_15s.mp3
    ├── next_squats.mp3
    ├── next_burpees.mp3
    ├── next_mountain_climbers.mp3
    ├── next_high_knees.mp3
    ├── next_push_ups.mp3
    ├── next_side_plank_dip.mp3
    ├── next_seated_knee_tuck.mp3
    ├── next_up_down_plank.mp3
    └── next_russian_twist.mp3
```

**Note:** The `en/` subdirectory under `numbers/` allows for future internationalization (e.g., `numbers/es/`, `numbers/ja/`).

---

## 7. Testing Audio Assets

### 7.1 Automated Tests

**Validation script** (`scripts/validate-audio-assets.js`):
```bash
node scripts/validate-audio-assets.js
# Checks:
# - All 65 files present
# - File sizes within limits
# - Durations within limits (requires ffprobe)
# - Manifest.json valid and complete
# - Total payload < 1 MB
```

### 7.2 Manual QA Checklist

**Playback quality:**
- [ ] Numbers 1-50 clear and distinct
- [ ] No clipping or distortion
- [ ] Consistent perceived volume
- [ ] Natural pacing (not too fast/slow)

**Circuit phrases:**
- [ ] Countdown (3,2,1,go) has appropriate urgency
- [ ] "Halfway" sounds encouraging
- [ ] "Rest" sounds calming
- [ ] Next-move intros are clear

**Cross-device testing:**
- [ ] Test on iPhone (Safari)
- [ ] Test on Android (Chrome)
- [ ] Test with phone speaker (common case)
- [ ] Test with Bluetooth headphones
- [ ] Test with wired headphones

### 7.3 Latency Testing

**Target:** <150ms from cue trigger to audible sound

**Test method:**
1. Start Practice mode in harness
2. Spam "Fake Rep Complete" button rapidly
3. Measure visual rep counter update → audible beep delay
4. Check p95 latency in harness HUD
5. Should be <150ms on mid-tier phone (Pixel 5, iPhone 12)

---

## 8. Maintenance

### 8.1 Updating Assets

**When to regenerate:**
- TTS provider changes (ElevenLabs → PlayHT)
- Voice persona changes (friendlier, more energetic, etc.)
- New exercises added (need new `next_*` files)
- Quality improvements (better LUFS, cleaner recording)

**Process:**
1. Generate new TTS output → `tmp/audio-source/`
2. Run ingestion script: `node scripts/ingest-audio-assets.js`
3. Test in harness: `pnpm --filter app dev`
4. Validate: `node scripts/validate-audio-assets.js`
5. Build: `pnpm --filter app build`
6. Deploy: Service Worker auto-invalidates old cache

### 8.2 Version Bumping

**When to bump manifest version:**
- Any asset change (re-record, re-encode, etc.)
- Triggers Service Worker cache invalidation
- Format: `{major}.{minor}.{patch}`
  - Major: Breaking changes (schema, file structure)
  - Minor: New assets added
  - Patch: Quality improvements, re-encodes

**Example:** `1.0.0` → `1.1.0` (added 5 new next_* files)

---

## 9. Future Enhancements

### 9.1 Dynamic TTS (Post-MVP)

**Goal:** Generate coach commentary on-the-fly using ElevenLabs API

**Architecture:**
- Static assets (numbers, core phrases): Preloaded as-is
- Dynamic phrases: Generated + cached in IndexedDB
- See voice spec §4 for TTSProvider interface

**Examples:**
- "Great form on that last rep!"
- "You've hit 100 reps this week!"
- "New personal best!"

**Cost control:**
- Aggressive caching (generate once, use forever)
- LRU eviction (keep 100 most recent)
- Estimated cost: <$5/mo per active user

### 9.2 Internationalization

**Structure:**
```
audio/
├── numbers/
│   ├── en/ (existing)
│   ├── es/ (Spanish)
│   └── ja/ (Japanese)
└── ui/
    ├── en/ (existing)
    ├── es/
    └── ja/
```

**Manifest extension:**
```json
{
  "locale": "en-US",
  "assets": [ ... ]
}
```

### 9.3 Voice Personas

**Future:** Multiple voice options (motivational coach, calm instructor, etc.)

**Implementation:**
- Duplicate asset tree per persona
- UI setting: "Voice Persona"
- Driver loads from `audio/{persona}/numbers/...`

---

## 10. Dependencies

**Required tools:**
- `ffmpeg` ≥5.0 (audio encoding, filter graphs)
- `ffprobe` (bundled with ffmpeg, for metadata extraction)
- `Node.js` ≥20 (for scripts)

**Optional tools:**
- `ffmpeg-normalize` (Python package for LUFS normalization)
- `sox` (alternative audio processor, not required)

**Installation:**
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
apt-get install ffmpeg

# Windows
choco install ffmpeg
# or download from ffmpeg.org

# Python package (optional)
pip install ffmpeg-normalize
```

---

## 11. Troubleshooting

### Issue: Files too large (>10 KB)

**Cause:** High bitrate or long duration

**Fix:**
- Increase compression: `-q:a 6` (lower quality)
- Trim silence more aggressively
- Reduce duration (speak faster, trim pauses)

### Issue: LUFS out of range

**Cause:** Source audio too quiet/loud

**Fix:**
```bash
ffmpeg -i input.mp3 \
  -af "loudnorm=I=-16:TP=-1.0:LRA=7" \
  output.mp3
```

### Issue: Clipping detected

**Cause:** True peak >-1.0 dBTP

**Fix:**
- Lower peak ceiling: `-af "loudnorm=TP=-1.5"`
- Check source for pre-existing clipping

### Issue: Beeps sound robotic

**Cause:** No envelope shaping on sine waves

**Fix:**
```bash
# Add fade in/out
-af "afade=t=in:st=0:d=0.01,afade=t=out:st=0.09:d=0.01"
```

---

## Related Documentation

- **Voice Driver Spec:** `docs/01_system/14-voice-driver-spec.md`
- **Task 5 Plan:** `docs/04_platform/09-task-5-audio-plan.md`
- **Bootstrap Plan:** `docs/04_platform/00-bootstrap-plan.md`
