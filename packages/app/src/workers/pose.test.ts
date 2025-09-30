import { describe, expect, it } from 'vitest';

import type { PoseKeypoint } from './poseMath';

/**
 * Unit tests for pose worker orientation detection functions.
 * These are pure functions extracted for testing without requiring full worker context.
 */

type DetectedOrientation = 'front' | 'back' | 'side' | 'unknown';

/**
 * Detects user orientation based on facial keypoint confidence.
 * Copied from pose.ts for testing purposes.
 */
function detectOrientation(keypoints: PoseKeypoint[]): DetectedOrientation {
  const nose = keypoints.find((kp) => kp.name === 'nose' || kp.part === 'nose');
  const leftEye = keypoints.find((kp) => kp.name === 'left_eye' || kp.part === 'left_eye');
  const rightEye = keypoints.find((kp) => kp.name === 'right_eye' || kp.part === 'right_eye');

  const noseScore = nose?.score ?? 0;
  const leftEyeScore = leftEye?.score ?? 0;
  const rightEyeScore = rightEye?.score ?? 0;

  const facialConfidence = (noseScore + leftEyeScore + rightEyeScore) / 3;

  if (facialConfidence > 0.4) {
    return 'front';
  }

  if (facialConfidence < 0.2) {
    return 'back';
  }

  const hasOneSide = (leftEyeScore > 0.3 && rightEyeScore < 0.2) || (rightEyeScore > 0.3 && leftEyeScore < 0.2);
  if (hasOneSide || (facialConfidence >= 0.2 && facialConfidence <= 0.4)) {
    return 'side';
  }

  return 'unknown';
}

/**
 * Validates detected orientation matches expected camera angle.
 * Copied from pose.ts for testing purposes.
 */
function isOrientationValid(detected: DetectedOrientation, expected: 'front' | 'side' | 'back'): boolean {
  if (detected === 'unknown') {
    return false;
  }

  if (detected === expected) {
    return true;
  }

  if (detected === 'side' || expected === 'side') {
    return true;
  }

  return false;
}

function createKeypoint(name: string, x: number, y: number, score: number): PoseKeypoint {
  return { name, x, y, score };
}

describe('detectOrientation', () => {
  it('returns front when facial confidence is high (>0.4)', () => {
    const keypoints: PoseKeypoint[] = [
      createKeypoint('nose', 0, 0, 0.9),
      createKeypoint('left_eye', -1, -1, 0.85),
      createKeypoint('right_eye', 1, -1, 0.8),
    ];

    const result = detectOrientation(keypoints);

    expect(result).toBe('front');
  });

  it('returns back when facial confidence is low (<0.2)', () => {
    const keypoints: PoseKeypoint[] = [
      createKeypoint('nose', 0, 0, 0.1),
      createKeypoint('left_eye', -1, -1, 0.1),
      createKeypoint('right_eye', 1, -1, 0.15),
    ];

    const result = detectOrientation(keypoints);

    expect(result).toBe('back');
  });

  it('returns side when one eye is visible but not the other (left visible)', () => {
    const keypoints: PoseKeypoint[] = [
      createKeypoint('nose', 0, 0, 0.3),
      createKeypoint('left_eye', -1, -1, 0.7),
      createKeypoint('right_eye', 1, -1, 0.1),
    ];

    const result = detectOrientation(keypoints);

    expect(result).toBe('side');
  });

  it('returns side when one eye is visible but not the other (right visible)', () => {
    const keypoints: PoseKeypoint[] = [
      createKeypoint('nose', 0, 0, 0.3),
      createKeypoint('left_eye', -1, -1, 0.1),
      createKeypoint('right_eye', 1, -1, 0.7),
    ];

    const result = detectOrientation(keypoints);

    expect(result).toBe('side');
  });

  it('returns side when facial confidence is medium (0.2-0.4)', () => {
    const keypoints: PoseKeypoint[] = [
      createKeypoint('nose', 0, 0, 0.3),
      createKeypoint('left_eye', -1, -1, 0.3),
      createKeypoint('right_eye', 1, -1, 0.3),
    ];

    const result = detectOrientation(keypoints);

    expect(result).toBe('side');
  });

  it('handles missing facial keypoints gracefully', () => {
    const keypoints: PoseKeypoint[] = [createKeypoint('left_hip', 0, 5, 0.9), createKeypoint('right_hip', 2, 5, 0.9)];

    const result = detectOrientation(keypoints);

    // Missing facial keypoints result in 0 confidence, which is < 0.2 -> back
    expect(result).toBe('back');
  });

  it('returns side at the exact lower boundary (0.2)', () => {
    const keypoints: PoseKeypoint[] = [
      createKeypoint('nose', 0, 0, 0.2),
      createKeypoint('left_eye', -1, -1, 0.2),
      createKeypoint('right_eye', 1, -1, 0.2),
    ];

    const result = detectOrientation(keypoints);

    expect(result).toBe('side');
  });

  it('returns front just above the upper boundary (>0.4)', () => {
    const keypoints: PoseKeypoint[] = [
      createKeypoint('nose', 0, 0, 0.45),
      createKeypoint('left_eye', -1, -1, 0.42),
      createKeypoint('right_eye', 1, -1, 0.41),
    ];

    const result = detectOrientation(keypoints);

    // Average = (0.45 + 0.42 + 0.41) / 3 = 0.4267 > 0.4
    expect(result).toBe('front');
  });
});

describe('isOrientationValid', () => {
  it('returns false when detected orientation is unknown', () => {
    expect(isOrientationValid('unknown', 'front')).toBe(false);
    expect(isOrientationValid('unknown', 'side')).toBe(false);
    expect(isOrientationValid('unknown', 'back')).toBe(false);
  });

  it('returns true when detected matches expected exactly', () => {
    expect(isOrientationValid('front', 'front')).toBe(true);
    expect(isOrientationValid('side', 'side')).toBe(true);
    expect(isOrientationValid('back', 'back')).toBe(true);
  });

  it('returns true when detected is side (regardless of expected)', () => {
    expect(isOrientationValid('side', 'front')).toBe(true);
    expect(isOrientationValid('side', 'back')).toBe(true);
    expect(isOrientationValid('side', 'side')).toBe(true);
  });

  it('returns true when expected is side (regardless of detected)', () => {
    expect(isOrientationValid('front', 'side')).toBe(true);
    expect(isOrientationValid('back', 'side')).toBe(true);
    expect(isOrientationValid('side', 'side')).toBe(true);
  });

  it('returns false when front and back are mismatched', () => {
    expect(isOrientationValid('front', 'back')).toBe(false);
    expect(isOrientationValid('back', 'front')).toBe(false);
  });
});
