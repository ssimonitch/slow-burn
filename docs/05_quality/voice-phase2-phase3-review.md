# Voice Driver Phase 2 & 3.1 Code Review

## Context
- Scope: commits `eea4445` and `1b2b3c2` implementing Phase 2 and Phase 3.1 of `docs/04_platform/09-task-5-audio-plan.md`.
- Focus: new Web Audio voice driver, silent fallback, adapter updates, practice harness telemetry, lint/test infrastructure tweaks.

## Summary
The Web Audio driver introduces richer telemetry, staged preloading, and caption fallbacks, while the silent driver covers blocked environments. The accompanying tests exercise many happy paths, yet a few engineering and testing gaps create maintainability and UX risks.

## Key Findings
1. **`prime()` is not idempotent (potential AudioContext leak)**  
   Path: `packages/app/src/features/voice/webAudioDriver.ts:64`  
   Repeated calls to `prime()` always construct a brand-new `AudioContext`, reattach a `GainNode`, and kick off manifest decoding. The previous context is never closed and decoded buffers are discarded. A double click on the “Prime Voice” button (easily triggered during QA) leaves multiple contexts alive and the driver still blocked because the new preload begins from scratch.  
   _Recommendation_: Make `prime()` re-entrant safe—bail out when already primed or currently priming, or close/dispose the prior context before allocating another. Add a regression test that calls `prime()` twice.

2. **Global console suppression hides real decoder failures**  
   Path: `packages/app/src/test/setup.ts:6`  
   The Vitest setup now swallows any warning containing `[WebAudioVoiceDriver] Failed to decode` and any error containing `[WebAudioVoiceDriver] Prime failed:`. Those strings are exactly what we need to surface if production assets fail to load or prime genuinely breaks. Because the suppression is global, future regressions would be silent.  
   _Recommendation_: Remove the blanket suppression; instead, make the tests deterministic (e.g. provide the background asset entries) or stub `console` only inside the specific test case.

3. **Caption/vibration fallback lacks automated coverage**  
   Path: `packages/app/src/features/voice/voiceAdapter.ts:26`  
   When the chosen driver reports `isBlocked()`, the adapter now emits `voice:caption` and triggers `navigator.vibrate`. None of the updated Vitest suites assert this behavior, so the regression could go unnoticed.  
   _Recommendation_: Extend `voiceAdapter.test.ts` to inject a fake blocked driver and assert `voice:caption` emission and the vibration branch.

4. **Practice harness sets timeouts without cleanup**  
   Path: `packages/app/src/features/workout-engine/harness/PracticeHarness.tsx:192`  
   Each caption event schedules `setTimeout(() => setVoiceCaption(null), 2000)` but never clears the timer. If the harness unmounts before the timeout fires, React will warn about state updates on an unmounted component.  
   _Recommendation_: Capture the timeout ID and clear it in the subscription cleanup (or move the timer into a ref with cleanup in `useEffect`).

5. **HUD driver label can misreport runtime driver**  
   Path: `packages/app/src/features/workout-engine/harness/PracticeHarness.tsx:52`  
   The displayed driver name is derived purely from environment flags. If Web Audio fails feature detection and we fall back to the silent driver, the HUD still claims “Web Audio”, confusing QA.  
   _Recommendation_: Emit the selected driver identity from the bridge (or infer from `voice:debug` logs) instead of assuming the env flags succeed.

## Test Coverage Notes
- `webAudioDriver.test.ts` rigorously covers prime/init, queue policies, and control methods (341 LOC), which is great.  
- Missing: blocked-caption/vibration path, repeated prime behavior, and auto-fallback telemetry when Stage 2/3 decoding fails.  
- Silent driver tests are thorough and validate vibration toggling when available.

## Decision Log
- **Dev TTS fallback**: By product decision, we should _not_ fall back to the dev SpeechSynthesis driver automatically; it remains opt-in via `VITE_VOICE_DEV_TTS`.

## Suggested Next Steps
1. Guard `prime()` against re-entry and add a double-prime regression test.  
2. Replace global console suppression with deterministic fixtures or localized mocks.  
3. Add adapter tests for the blocked-driver caption path and vibration.  
4. Clean up caption timeouts on unmount.  
5. Source the HUD driver label from the actual runtime driver.
