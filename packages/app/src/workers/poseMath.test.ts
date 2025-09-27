import { describe, expect, it } from 'vitest';

import { computeKneeMetrics, type PoseKeypoint } from './poseMath';
import { computeHipDeltaMetrics } from './poseMath';

function createKeypoint(name: string, x: number, y: number, score = 0.9): PoseKeypoint {
  return { name, x, y, score };
}

describe('computeKneeMetrics', () => {
  it('returns invalid when required keypoints fall below threshold', () => {
    const keypoints: PoseKeypoint[] = [
      createKeypoint('left_hip', 0, 0, 0.5),
      createKeypoint('left_knee', 1, 0, 0.4),
      createKeypoint('left_ankle', 2, 0, 0.3),
    ];

    const result = computeKneeMetrics(keypoints, {
      confidenceThreshold: 0.6,
      singleSidePenalty: 0.8,
    });

    expect(result.isValid).toBe(false);
    expect(result.theta).toBeUndefined();
    expect(result.confidence).toBe(0);
  });

  it('computes theta and confidence for both legs, selecting the lower angle', () => {
    const keypoints: PoseKeypoint[] = [
      createKeypoint('left_hip', 0, 3),
      createKeypoint('left_knee', 0, 2),
      createKeypoint('left_ankle', 1, 1),
      createKeypoint('right_hip', 0, 3),
      createKeypoint('right_knee', 0, 2),
      createKeypoint('right_ankle', 0, 1),
    ];

    const result = computeKneeMetrics(keypoints, {
      confidenceThreshold: 0.5,
      singleSidePenalty: 0.8,
    });

    expect(result.isValid).toBe(true);
    expect(result.validSideCount).toBe(2);
    expect(result.theta).toBeGreaterThan(0);
    expect(result.theta).toBeLessThanOrEqual(180);
    expect(result.confidence).toBeCloseTo(0.9, 2);
  });

  it('applies a penalty when only one side is valid', () => {
    const keypoints: PoseKeypoint[] = [
      createKeypoint('left_hip', 0, 3),
      createKeypoint('left_knee', 0, 2),
      createKeypoint('left_ankle', 1, 1),
      createKeypoint('right_hip', 0, 3, 0.2),
      createKeypoint('right_knee', 0, 2, 0.2),
      createKeypoint('right_ankle', 0, 1, 0.2),
    ];

    const result = computeKneeMetrics(keypoints, {
      confidenceThreshold: 0.5,
      singleSidePenalty: 0.7,
    });

    expect(result.isValid).toBe(true);
    expect(result.validSideCount).toBe(1);
    expect(result.dominantSide).toBe('left');
    expect(result.confidence).toBeCloseTo(0.9 * 0.7, 4);
  });
});

describe('computeHipDeltaMetrics', () => {
  it('returns invalid when hips or knees are below threshold', () => {
    const keypoints: PoseKeypoint[] = [
      createKeypoint('left_hip', 0, 1, 0.3),
      createKeypoint('left_knee', 0, 2, 0.9),
      createKeypoint('right_hip', 0, 1, 0.2),
      createKeypoint('right_knee', 0, 2, 0.7),
    ];

    const metrics = computeHipDeltaMetrics(keypoints, 0.6);

    expect(metrics.isValid).toBe(false);
    expect(metrics.delta).toBeUndefined();
    expect(metrics.confidence).toBe(0);
  });

  it('averages hip delta across valid sides', () => {
    const keypoints: PoseKeypoint[] = [
      createKeypoint('left_hip', 0, 10),
      createKeypoint('left_knee', 0, 30),
      createKeypoint('right_hip', 0, 12),
      createKeypoint('right_knee', 0, 32),
    ];

    const metrics = computeHipDeltaMetrics(keypoints, 0.5);

    expect(metrics.isValid).toBe(true);
    expect(metrics.validSideCount).toBe(2);
    expect(metrics.delta).toBeCloseTo(20, 5);
    expect(metrics.confidence).toBeCloseTo(0.9, 2);
  });

  it('handles single-side validity', () => {
    const keypoints: PoseKeypoint[] = [
      createKeypoint('left_hip', 0, 10),
      createKeypoint('left_knee', 0, 30),
      createKeypoint('right_hip', 0, 12, 0.4),
      createKeypoint('right_knee', 0, 32, 0.3),
    ];

    const metrics = computeHipDeltaMetrics(keypoints, 0.5);

    expect(metrics.isValid).toBe(true);
    expect(metrics.validSideCount).toBe(1);
    expect(metrics.delta).toBe(20);
    expect(metrics.confidence).toBeCloseTo(0.9, 2);
  });
});
