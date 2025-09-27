# Pose Heuristic Tuning Plan — Rear/Side/Front Coverage

Updated: 2025-09-25
Scope: Define how we will gather, annotate, and analyze video footage to make the pose worker heuristics reliable across front, side, and back camera angles.

## 1) Goals
- Achieve consistent rep counting accuracy (≤1 miss or double-count per 20 reps) for squats across the three supported camera angles.
- Validate and tune MoveNet-based heuristics before iterating on heavier models.
- Build reusable tooling so we can repeat the process when we add new exercises or upgrade models.

## 2) Data Collection Strategy
- **Personal library (primary):** curate existing recordings (side/back/front). Capture new clips where needed:
  - Vary light, clothing, and camera height (floor, chest, overhead).
  - Keep full body in frame; note when joints are occluded to measure failure modes.
- **Supplemental footage:** gather public clips (YouTube workouts, open datasets) for edge cases (different body types, gym environments). Archive timestamps + URLs for attribution.
- **Future expansion:** consider staged sessions with tripod-mounted devices to capture synchronized multi-angle footage (front + back) for cross-validation.

## 3) Labeling & Ground Truth
- Start with lightweight logs:
  - Note rep counts + issue timestamps while watching each clip.
  - Mark camera angle, lighting, occlusions, and any notable anomalies.
- For higher fidelity:
  - Use simple annotation CSV (`frame_ts_ms`, `phase`, `rep_index`, `notes`).
  - Focus detailed labels on ~5 reps per clip; the rest can rely on total counts.
- Version control annotations in `infra/pose-data/annotations/*.csv` (to add later) so we can compare runs over time.

## 4) Offline Evaluation Harness
Build a standalone script/page to replay videos through the worker without a webcam:
- **Pipeline:**
  1. Read MP4 → generate `ImageBitmap` frames via `OffscreenCanvas` (Node w/ `canvas` or Vite dev page).
  2. Pump frames into the worker at recorded timestamps; collect emitted events + debug metrics.
  3. Dump per-frame metrics (theta, hip delta, confidence, pose-lost flags) to JSON.
- **Deliverables:**
  - `scripts/analyze-pose-video.ts`: CLI taking `--angle`, `--video`, `--out metrics.json`.
  - Optional web harness (`/pose-lab`) to visualize overlays + time series charts.

## 5) Heuristic Tuning Process
1. Run baseline analysis for each clip; export summary stats (mean/max theta, deltas, success rate).
2. Compare worker event counts vs. annotations.
3. Adjust configuration knobs per angle:
   - `thetaUpDegrees`, `thetaDownDegrees`, `minDownHoldMs`, `emaAlpha` for front/side.
   - `BACK_HIP_DOWN_RATIO`, `BACK_HIP_UP_RATIO`, `confidenceThreshold` deltas, baseline smoothing for back.
4. Rerun evaluation harness; iterate until error rate hits target.
5. Capture chosen constants + justification in a short CHANGELOG block.

## 6) Automation & Reporting
- Generate a markdown/HTML report summarizing each run (counts, false positives/negatives, confidence distribution).
- Track historical runs in `docs/metrics/pose-tuning/YYYY-MM-DD.md` (add once automation exists).
- Add CI hook later to replay a small sample to guard against regressions.

## 7) Next Steps
1. Export a small subset of videos (3 per angle) into `infra/pose-data/raw/` (gitignored).
2. Implement the CLI harness + metrics dump.
3. Create initial annotations (manual counts + key timestamps).
4. Run baseline analysis and document current accuracy.
5. Schedule a review session after first tuning pass to decide whether heuristics suffice or we need alternative models for back view.

## 8) Open Questions
- Do we need angle auto-detection, or is manual selection acceptable for MVP?
- Should rear-view heuristics incorporate torso/shoulder cues to improve confidence?
- When do we invest in on-device model hosting vs. CDN fetch for MoveNet?

Once these steps are complete we’ll have measurable targets and tooling to iterate on the heuristics without manual camera testing for every change.
