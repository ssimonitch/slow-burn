# Voice Driver — Spec (MVP v1)

**Doc:** 14-voice-driver-spec.md
**Updated:** 2025-08-17 (JST)
**Scope:** Client‑side audio service that renders **engine VOICE effects** with minimal latency. Circuits use **time‑based cues only**; Practice (Squats) uses **per‑rep numbers**. Web Audio first, SpeechSynthesis fallback.

> Pairs with: **10‑architecture‑overview\.md** (ports & budgets), **11‑event‑loop‑spec.md** (cue sources), **13‑workout‑engine-spec.md** (VOICE intents), **01‑vision‑mvp.md §5.2** (phrase catalog).

---

## 1) Goals & non‑goals

**Goals**

* **Low‑latency** playback: Practice per‑rep number heard **<150 ms** after `REP_COMPLETE` → VOICE effect; Circuits cues feel on‑beat.
* **Deterministic** rendering: never overlap speech; consistent rules on drops and preemption.
* **Offline‑ready:** preloaded assets for numbers and core phrases; works with no network.
* **Cross‑browser:** handle Safari/iOS autoplay quirks gracefully.

**Non‑goals (MVP)**

* Streaming LLM voice or neural TTS.
* Multilingual/SSML; single **en‑US** voice is sufficient.
* Spatial audio / advanced mixing.

---

## 2) Inputs & outputs

**Input:** VOICE effects from the Engine (see 13‑workout‑engine). Driver does **not** subscribe to the Event Bus directly; it only consumes `Effect` objects.

```ts
// subset of Effect union
type VoiceEffect =
  | { type:'VOICE', cue: VoiceCue }

// cues come from engine intent, already policy‑filtered for mode
// Circuits: countdown, halfway, last5, rest_start, next_move_intro
// Practice: say_number(n), milestone(n)
```

**Output:** audible playback (Web Audio or SpeechSynthesis) + small internal telemetry for debug HUD (play latency, blocked flag). No events are emitted back to the Engine.

---

## 3) Policy rules (MVP)

* **Circuits:**

  * Time‑based **only**. Speak: `countdown(3,2,1,go)`, `halfway`, `final5 ("5..4..3..2..1 — rest")`, `rest_start("Rest 15 seconds")`, `next_move_intro("Next: {exercise}")`.
  * **No per‑rep speech** even if worker emits reps.
* **Practice (Squats):**

  * Speak **numbers** `1..50` only.
  * **Drop‑latest policy**: if a number is playing and a new number arrives, **ignore the new one** (do not queue). Milestones (`10`, `20`) may **preempt** at word boundary.
* **No overlap:** Only one cue at a time. A new cue waits until current clip finishes unless it is a milestone preemption in Practice.
* **Mute during PAUSE:** stop playback and clear queue on `PAUSE`; resume silent until next cue on `RESUME`.
* **Captions:** optional on‑screen captions mirror cues (handled by UI adapter, not the driver).

---

## 4) Architecture & graph

**Primary path:** Web Audio API

* **AudioContext lifecycle:** created on app load but “locked”; **resume()** on first user tap (prime). Suspended again on route leave.
* **Buffers:**

  * **Numbers 1–50** (`/audio/numbers/en/01.mp3` … `/50.mp3`) decoded to **AudioBuffer** at load.
* **Short phrases:** `go`, `halfway`, `final5_beeps` (optional), `rest_15s`, `next_move_intro_{exercise}` (pre-recorded for each MVP circuit move) — all as buffers.
* **Nodes:** One **GainNode** for global volume; create a fresh **AudioBufferSourceNode** per cue.
* **Scheduling:** start buffers ASAP (next tick) to minimize latency; for final‑5s a stitched sequence of 5 short buffers is acceptable.

**Fallback path (development / emergency only):** SpeechSynthesis

* Use `speechSynthesis.speak()` **only** in development or when recorded assets fail to decode. Production builds should rely on the pre-recorded catalog.
* Voice selection: prefer an **en-US female** voice if present; otherwise default `speechSynthesis.getVoices()[0]`.
* If SpeechSynthesis is blocked or unavailable, fall back to **beeps** for countdown/final-5s and **on-screen numbers** for Practice.

**Future path:** third-party neural TTS (e.g. ElevenLabs, PlayHT)

* Maintain a thin `TTSProvider` interface (`synthesize(text, persona) -> ArrayBuffer`) wired behind the driver. Not implemented for MVP but spec'ed so integration can land later.
* Target usage: generate new phrases (e.g., dynamic Coach intros) offline, then ship as cached assets, keeping runtime cost ≤$10/mo.
* Keep prompts/persona consistent with **01-vision-mvp.md**; store synthesized clips alongside the recorded catalog with versioned filenames.

**Autoplay gating**

* On first user gesture (Start/Practice tap), call `audioCtx.resume()` and play a **50 ms silent buffer** to unlock.
* If resume fails, set `blocked=true` and surface a UI banner suggesting volume toggle.

---

## 5) Assets & caching

* Package numbers and short phrases as small MP3/OGG files (≤10 KB each ideally). Keep total <1 MB.
* Preload & decode on initial “Ready” screen *after* first gesture; show a spinner until `decodeAudioData` resolves or a 1.5s timeout elapses (then continue lazily by decoding on first use).
* Service Worker caches assets with a **versioned** cache key; purge on new deploy.

---

## 6) Driver API (internal)

```ts
export type VoiceDriver = {
  prime(): Promise<void>;                  // unlock AudioContext
  handle(effect: VoiceEffect): void;       // main entry point from Engine adapter
  mute(): void; unmute(): void;            // app‑wide mute
  setVolume(v: number): void;              // 0..1
  stopAll(): void;                         // cancel any playing sources
  dispose(): void;                         // close AudioContext, release buffers
}
```

**Implementation notes**

* **Queue:** maintain `current` playback plus an optional `pending` slot. Incoming cues follow policy:

  * Practice numbers → if `current` is still playing, **drop** the new number (no pending change).
  * Milestone preemption → if `current` is a number, place the milestone in `pending` and start it via the `onended` callback; if `current` already a milestone/phrase, replace `pending`.
* **Session halt:** once the engine adapter observes `session_halted`, call `stopAll()` and stop invoking `handle()` until a new workout starts.
* **De‑dup:** ignore identical cue received within 250 ms.
* **Timing:** For circuit cues driven by timers, the Engine already aligns triggers; the driver should **play immediately** when called.

---

## 7) Cue mapping (catalog → assets)

**Numbers:** `say_number(n:1..50)` → `/audio/numbers/en/${pad2(n)}.mp3`

**Phrases:**

* `countdown(3|2|1)` → `/audio/ui/${n}.mp3`
* `go` → `/audio/ui/go.mp3`
* `halfway` → `/audio/ui/halfway.mp3`
* `final5` → sequence `/audio/ui/5.mp3`…`/1.mp3` then `rest.mp3` **or** one stitched file `/audio/ui/final5.mp3`
* `rest_start(15)` → `/audio/ui/rest_15s.mp3`
* `next_move_intro(name)` → `/audio/ui/next_${slug(name)}.mp3` (pre-recorded for each MVP move) triggered after a short **beep** buffer

> Keep catalog consistent with **01‑vision‑mvp.md §5.2**; exact filenames are implementation details but must be stable for caching.

---

## 8) Error handling & telemetry

* **Blocked audio:** if `audioCtx.state!=='running'` after `prime()`, set `blocked=true`; UI shows caption + vibration only.
* **play() errors:** catch and ignore; log to debug HUD.
* **SpeechSynthesis** errors: catch and mark `tts_blocked=true`.
* **Telemetry (dev only):** record `t_play - t_effect` (ms) for latest cue; show p95 in debug HUD; flag if >150 ms for Practice or >200 ms for Circuit.
* **Session halt:** adapters must set `session_halted` and call `stopAll()`; driver should ignore subsequent cues until a new workout primes it.

---

## 9) Memory & performance

* Reuse **AudioBuffers**; do not re‑decode while in session.
* Release buffers on `dispose()`; free references on route change.
* Keep only a single active `AudioBufferSourceNode`; stop it on `PAUSE`/`STOP`.

---

## 10) Acceptance criteria (Voice)

* **Practice latency:** per‑rep number audible **<150 ms** from `VOICE(say_number)` effect on mid‑tier phones.
* **Circuit cadence:** countdown/halfway/final‑5 cues play at scheduled moments with **±100 ms** tolerance.
* **No overlap:** at no time do two cues play simultaneously.
* **Autoplay:** after first gesture, audio works on Safari iOS and Chrome Android; if blocked, captions + vibration appear.
* **Offline:** with cached assets, Practice and Circuit cues work with airplane mode.

---

## 11) Test vectors

1. **Practice rush reps:** fire say\_number 1..20 at 250 ms cadence; ensure several numbers are **dropped** (no backlog), milestone 10 plays.
2. **Circuit countdown:** deliver countdown → go → halfway → final‑5; measure cue drift ≤100 ms.
3. **Pause during cue:** mid‑number `PAUSE` stops playback; `RESUME` does not replay; next rep speaks normally.
4. **Autoplay blocked path:** without gesture, verify `prime()` fails → captions + vibration.
5. **Offline cache:** disable network and replay test vectors; all assets play.

---

## 12) Open items

* Consider **coalesce-to-latest** policy (speak the most recent number after a burst) if drop-latest feels too sparse.
* Evaluate adding a tiny **audio sprite** for final-5 to reduce source churn.
* Optional volume ducking for background music (post-MVP).
* Production-quality neural TTS integration via `TTSProvider` (e.g., ElevenLabs) to auto-generate new phrases while keeping runtime costs predictable.
