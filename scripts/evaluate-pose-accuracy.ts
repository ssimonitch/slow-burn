#!/usr/bin/env node

/**
 * Pose Accuracy Evaluation Tool
 *
 * Calculates accuracy metrics by comparing pose detection results (from analyze-pose-video.ts)
 * against ground truth annotations.
 *
 * Usage:
 *   # Evaluate single video
 *   pnpm evaluate-pose-accuracy \
 *     --annotation packages/infra/pose-tuning/annotations/squat-front-01.csv \
 *     --result packages/infra/pose-tuning/processed/squat_front_01.json \
 *     --out packages/infra/pose-tuning/metrics/2025-09-30-squat.md
 *
 *   # Evaluate all results in directory
 *   pnpm evaluate-pose-accuracy \
 *     --annotations packages/infra/pose-tuning/annotations/ \
 *     --results packages/infra/pose-tuning/processed/ \
 *     --out packages/infra/pose-tuning/metrics/2025-09-30-squat.md
 *
 *   # CI mode: require minimum accuracy
 *   pnpm evaluate-pose-accuracy --batch --require-min 95
 *
 * Outputs:
 *   - Markdown report with per-video and aggregate metrics
 *   - Console summary
 *   - Exit code 0 if pass, 1 if fail (when --require-min used)
 *
 * Status: STUB - Implementation required
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { resolve, basename, extname, join } from 'path';

interface CliArgs {
  annotation?: string;
  result?: string;
  annotations?: string;
  results?: string;
  out: string;
  requireMin?: number;
  batch?: boolean;
  exercise?: string;
}

interface Annotation {
  video_id: string;
  exercise: string;
  angle: string;
  lighting: string;
  equipment: string;
  ground_truth_reps: number;
  notes: string;
  camera_height?: string;
  rep_speed?: string;
}

interface AnalysisResult {
  video_meta: {
    id: string;
    fps: number;
    durationMs: number;
  };
  config: Record<string, unknown>;
  events: Array<{ type: string; ts: number; [key: string]: unknown }>;
  summary: {
    total_reps_detected: number;
    pose_lost_count: number;
    avg_confidence: number;
  };
}

interface VideoMetrics {
  video_id: string;
  exercise: string;
  angle: string;
  lighting: string;
  ground_truth_reps: number;
  detected_reps: number;
  accuracy: number;
  false_positives: number;
  false_negatives: number;
  precision: number;
  recall: number;
  avg_confidence: number;
  pose_lost_count: number;
  notes: string;
}

interface AggregateMetrics {
  total_videos: number;
  total_ground_truth_reps: number;
  total_detected_reps: number;
  overall_accuracy: number;
  avg_precision: number;
  avg_recall: number;
  avg_confidence: number;
  by_angle: Record<string, AngleMetrics>;
  by_lighting: Record<string, LightingMetrics>;
}

interface AngleMetrics {
  video_count: number;
  accuracy: number;
  precision: number;
  recall: number;
  issues: string[];
}

interface LightingMetrics {
  video_count: number;
  accuracy: number;
  avg_confidence: number;
}

/**
 * Main entry point
 */
async function main() {
  const args = parseArgs();

  console.log('📊 Pose Accuracy Evaluation Tool');
  console.log('=================================\n');

  let videoMetrics: VideoMetrics[];

  if (args.batch || (args.annotations && args.results)) {
    // Batch mode: process directory
    videoMetrics = await evaluateBatch(args);
  } else if (args.annotation && args.result) {
    // Single mode: process one video
    const metrics = await evaluateSingle(args.annotation, args.result);
    videoMetrics = [metrics];
  } else {
    console.error('❌ Error: Must provide either --annotation + --result OR --annotations + --results');
    process.exit(1);
  }

  // Compute aggregate metrics
  const aggregate = computeAggregateMetrics(videoMetrics);

  // Generate report
  const report = generateMarkdownReport(videoMetrics, aggregate, args.exercise);
  writeFileSync(args.out, report);
  console.log(`\n✅ Report saved to: ${args.out}`);

  // Print summary to console
  printConsoleSummary(aggregate);

  // Check minimum accuracy requirement (CI mode)
  if (args.requireMin !== undefined) {
    if (aggregate.overall_accuracy < args.requireMin) {
      console.error(`\n❌ FAIL: Overall accuracy ${aggregate.overall_accuracy.toFixed(1)}% < required ${args.requireMin}%`);
      process.exit(1);
    } else {
      console.log(`\n✅ PASS: Overall accuracy ${aggregate.overall_accuracy.toFixed(1)}% >= required ${args.requireMin}%`);
    }
  }
}

/**
 * Evaluate single video
 */
async function evaluateSingle(annotationPath: string, resultPath: string): Promise<VideoMetrics> {
  console.log(`📹 Evaluating: ${basename(resultPath, '.json')}`);

  // Load annotation
  const annotation = loadAnnotation(annotationPath);

  // Load analysis result
  const result: AnalysisResult = JSON.parse(readFileSync(resultPath, 'utf-8'));

  // Calculate metrics
  const groundTruth = annotation.ground_truth_reps;
  const detected = result.summary.total_reps_detected;
  const delta = Math.abs(detected - groundTruth);

  const accuracy = groundTruth > 0 ? (1 - delta / groundTruth) * 100 : 0;
  const falsePositives = Math.max(0, detected - groundTruth);
  const falseNegatives = Math.max(0, groundTruth - detected);
  const precision = detected > 0 ? ((detected - falsePositives) / detected) * 100 : 0;
  const recall = groundTruth > 0 ? ((groundTruth - falseNegatives) / groundTruth) * 100 : 0;

  console.log(`   Ground truth: ${groundTruth} reps`);
  console.log(`   Detected: ${detected} reps`);
  console.log(`   Accuracy: ${accuracy.toFixed(1)}%`);
  console.log(`   Precision: ${precision.toFixed(1)}%`);
  console.log(`   Recall: ${recall.toFixed(1)}%\n`);

  return {
    video_id: annotation.video_id,
    exercise: annotation.exercise,
    angle: annotation.angle,
    lighting: annotation.lighting,
    ground_truth_reps: groundTruth,
    detected_reps: detected,
    accuracy,
    false_positives: falsePositives,
    false_negatives: falseNegatives,
    precision,
    recall,
    avg_confidence: result.summary.avg_confidence,
    pose_lost_count: result.summary.pose_lost_count,
    notes: annotation.notes,
  };
}

/**
 * Evaluate batch of videos
 */
async function evaluateBatch(args: CliArgs): Promise<VideoMetrics[]> {
  console.log('🎬 Batch evaluation mode\n');

  const annotationsDir = args.annotations!;
  const resultsDir = args.results!;

  // Find all annotation files
  const annotationFiles = readdirSync(annotationsDir).filter((f) => f.endsWith('.csv') && !f.includes('-events'));

  console.log(`Found ${annotationFiles.length} annotation files\n`);

  const metrics: VideoMetrics[] = [];

  for (const annotationFile of annotationFiles) {
    const annotationPath = join(annotationsDir, annotationFile);
    const annotation = loadAnnotation(annotationPath);

    // Find corresponding result file
    const resultPath = join(resultsDir, `${annotation.video_id}.json`);

    if (!existsSync(resultPath)) {
      console.warn(`⚠️  Warning: No result found for ${annotation.video_id}, skipping`);
      continue;
    }

    const videoMetrics = await evaluateSingle(annotationPath, resultPath);
    metrics.push(videoMetrics);
  }

  return metrics;
}

/**
 * Load annotation CSV (Phase 1 format)
 */
function loadAnnotation(path: string): Annotation {
  // TODO: Implement CSV parsing
  // For now, parse simple CSV format manually
  // In production, use a CSV library like 'csv-parse'

  const content = readFileSync(path, 'utf-8');
  const lines = content.trim().split('\n');

  if (lines.length < 2) {
    throw new Error(`Invalid annotation file: ${path}`);
  }

  const headers = lines[0].split(',');
  const values = lines[1].split(',');

  const annotation: Partial<Annotation> = {};

  headers.forEach((header, i) => {
    const key = header.trim();
    const value = values[i]?.trim().replace(/^"|"$/g, ''); // Remove quotes

    switch (key) {
      case 'video_id':
        annotation.video_id = value;
        break;
      case 'exercise':
        annotation.exercise = value;
        break;
      case 'angle':
        annotation.angle = value;
        break;
      case 'lighting':
        annotation.lighting = value;
        break;
      case 'equipment':
        annotation.equipment = value;
        break;
      case 'ground_truth_reps':
        annotation.ground_truth_reps = parseInt(value, 10);
        break;
      case 'notes':
        annotation.notes = value;
        break;
      case 'camera_height':
        annotation.camera_height = value;
        break;
      case 'rep_speed':
        annotation.rep_speed = value;
        break;
    }
  });

  if (!annotation.video_id || !annotation.exercise || annotation.ground_truth_reps === undefined) {
    throw new Error(`Missing required fields in annotation: ${path}`);
  }

  return annotation as Annotation;
}

/**
 * Compute aggregate metrics across all videos
 */
function computeAggregateMetrics(videoMetrics: VideoMetrics[]): AggregateMetrics {
  const totalGroundTruth = videoMetrics.reduce((sum, m) => sum + m.ground_truth_reps, 0);
  const totalDetected = videoMetrics.reduce((sum, m) => sum + m.detected_reps, 0);
  const overallAccuracy =
    totalGroundTruth > 0 ? (1 - Math.abs(totalDetected - totalGroundTruth) / totalGroundTruth) * 100 : 0;

  const avgPrecision = videoMetrics.reduce((sum, m) => sum + m.precision, 0) / videoMetrics.length;
  const avgRecall = videoMetrics.reduce((sum, m) => sum + m.recall, 0) / videoMetrics.length;
  const avgConfidence = videoMetrics.reduce((sum, m) => sum + m.avg_confidence, 0) / videoMetrics.length;

  // Group by angle
  const byAngle: Record<string, AngleMetrics> = {};
  for (const metric of videoMetrics) {
    if (!byAngle[metric.angle]) {
      byAngle[metric.angle] = {
        video_count: 0,
        accuracy: 0,
        precision: 0,
        recall: 0,
        issues: [],
      };
    }

    const angleMetrics = byAngle[metric.angle];
    angleMetrics.video_count++;
    angleMetrics.accuracy += metric.accuracy;
    angleMetrics.precision += metric.precision;
    angleMetrics.recall += metric.recall;

    // Collect issues
    if (metric.false_positives > 0) {
      angleMetrics.issues.push(`${metric.video_id}: ${metric.false_positives} false positives`);
    }
    if (metric.false_negatives > 0) {
      angleMetrics.issues.push(`${metric.video_id}: ${metric.false_negatives} false negatives`);
    }
  }

  // Average angle metrics
  for (const angle in byAngle) {
    const metrics = byAngle[angle];
    metrics.accuracy /= metrics.video_count;
    metrics.precision /= metrics.video_count;
    metrics.recall /= metrics.video_count;
  }

  // Group by lighting
  const byLighting: Record<string, LightingMetrics> = {};
  for (const metric of videoMetrics) {
    if (!byLighting[metric.lighting]) {
      byLighting[metric.lighting] = {
        video_count: 0,
        accuracy: 0,
        avg_confidence: 0,
      };
    }

    const lightingMetrics = byLighting[metric.lighting];
    lightingMetrics.video_count++;
    lightingMetrics.accuracy += metric.accuracy;
    lightingMetrics.avg_confidence += metric.avg_confidence;
  }

  // Average lighting metrics
  for (const lighting in byLighting) {
    const metrics = byLighting[lighting];
    metrics.accuracy /= metrics.video_count;
    metrics.avg_confidence /= metrics.video_count;
  }

  return {
    total_videos: videoMetrics.length,
    total_ground_truth_reps: totalGroundTruth,
    total_detected_reps: totalDetected,
    overall_accuracy: overallAccuracy,
    avg_precision: avgPrecision,
    avg_recall: avgRecall,
    avg_confidence: avgConfidence,
    by_angle: byAngle,
    by_lighting: byLighting,
  };
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(
  videoMetrics: VideoMetrics[],
  aggregate: AggregateMetrics,
  exercise?: string
): string {
  const date = new Date().toISOString().split('T')[0];
  const exerciseName = exercise || videoMetrics[0]?.exercise || 'Unknown';

  let md = `# ${exerciseName.charAt(0).toUpperCase() + exerciseName.slice(1)} Tuning Run — ${date}\n\n`;

  // Summary section
  md += `## Summary\n\n`;
  md += `- **Videos evaluated:** ${aggregate.total_videos}\n`;
  md += `- **Total ground truth reps:** ${aggregate.total_ground_truth_reps}\n`;
  md += `- **Total detected reps:** ${aggregate.total_detected_reps}\n`;
  md += `- **Overall accuracy:** ${aggregate.overall_accuracy.toFixed(1)}%\n`;
  md += `- **Average precision:** ${aggregate.avg_precision.toFixed(1)}%\n`;
  md += `- **Average recall:** ${aggregate.avg_recall.toFixed(1)}%\n`;
  md += `- **Average confidence:** ${aggregate.avg_confidence.toFixed(3)}\n\n`;

  // Per-angle breakdown
  md += `## Per-Angle Breakdown\n\n`;
  md += `| Angle | Videos | Accuracy | Precision | Recall | Issues |\n`;
  md += `|-------|--------|----------|-----------|--------|---------|\n`;

  for (const angle in aggregate.by_angle) {
    const metrics = aggregate.by_angle[angle];
    const issueCount = metrics.issues.length;
    md += `| ${angle} | ${metrics.video_count} | ${metrics.accuracy.toFixed(1)}% | ${metrics.precision.toFixed(1)}% | ${metrics.recall.toFixed(1)}% | ${issueCount} |\n`;
  }

  md += '\n';

  // Issues section
  md += `## Issues by Angle\n\n`;
  for (const angle in aggregate.by_angle) {
    const metrics = aggregate.by_angle[angle];
    if (metrics.issues.length === 0) continue;

    md += `### ${angle.charAt(0).toUpperCase() + angle.slice(1)} Angle\n`;
    metrics.issues.forEach((issue) => {
      md += `- ${issue}\n`;
    });
    md += '\n';
  }

  // Lighting breakdown
  md += `## Per-Lighting Breakdown\n\n`;
  md += `| Lighting | Videos | Accuracy | Avg Confidence |\n`;
  md += `|----------|--------|----------|----------------|\n`;

  for (const lighting in aggregate.by_lighting) {
    const metrics = aggregate.by_lighting[lighting];
    md += `| ${lighting} | ${metrics.video_count} | ${metrics.accuracy.toFixed(1)}% | ${metrics.avg_confidence.toFixed(3)} |\n`;
  }

  md += '\n';

  // Per-video details
  md += `## Per-Video Details\n\n`;
  md += `| Video ID | Angle | Lighting | Ground Truth | Detected | Accuracy | Precision | Recall | Notes |\n`;
  md += `|----------|-------|----------|--------------|----------|----------|-----------|--------|-------|\n`;

  videoMetrics.forEach((m) => {
    md += `| ${m.video_id} | ${m.angle} | ${m.lighting} | ${m.ground_truth_reps} | ${m.detected_reps} | ${m.accuracy.toFixed(1)}% | ${m.precision.toFixed(1)}% | ${m.recall.toFixed(1)}% | ${m.notes} |\n`;
  });

  md += '\n';

  // Recommendations section
  md += `## Recommendations\n\n`;

  // Auto-generate recommendations based on issues
  const lowAccuracyAngles = Object.entries(aggregate.by_angle)
    .filter(([, metrics]) => metrics.accuracy < 95)
    .map(([angle]) => angle);

  if (lowAccuracyAngles.length > 0) {
    md += `### Accuracy Below Target\n`;
    lowAccuracyAngles.forEach((angle) => {
      const metrics = aggregate.by_angle[angle];
      md += `- **${angle}:** ${metrics.accuracy.toFixed(1)}% accuracy (target: ≥95%)\n`;
      md += `  - Consider adjusting \`${angle}.confidenceDelta\` or \`theta*Delta\` parameters\n`;
      md += `  - Review issues: ${metrics.issues.slice(0, 3).join('; ')}\n`;
    });
    md += '\n';
  }

  const lowConfidenceLighting = Object.entries(aggregate.by_lighting)
    .filter(([, metrics]) => metrics.avg_confidence < 0.5)
    .map(([lighting]) => lighting);

  if (lowConfidenceLighting.length > 0) {
    md += `### Low Confidence Lighting Conditions\n`;
    lowConfidenceLighting.forEach((lighting) => {
      const metrics = aggregate.by_lighting[lighting];
      md += `- **${lighting}:** ${metrics.avg_confidence.toFixed(3)} average confidence\n`;
      md += `  - Consider adjusting \`confidenceDelta\` or \`poseLostTimeoutMs\`\n`;
    });
    md += '\n';
  }

  if (lowAccuracyAngles.length === 0 && lowConfidenceLighting.length === 0) {
    md += `✅ All metrics meet target thresholds. No tuning required.\n\n`;
  }

  // Footer
  md += `---\n\n`;
  md += `**Generated:** ${new Date().toISOString()}\n`;
  md += `**Tool:** evaluate-pose-accuracy.ts\n`;

  return md;
}

/**
 * Print summary to console
 */
function printConsoleSummary(aggregate: AggregateMetrics): void {
  console.log('\n📈 Aggregate Metrics');
  console.log('===================\n');
  console.log(`Videos: ${aggregate.total_videos}`);
  console.log(`Overall accuracy: ${aggregate.overall_accuracy.toFixed(1)}%`);
  console.log(`Precision: ${aggregate.avg_precision.toFixed(1)}%`);
  console.log(`Recall: ${aggregate.avg_recall.toFixed(1)}%`);
  console.log(`Confidence: ${aggregate.avg_confidence.toFixed(3)}\n`);

  console.log('By Angle:');
  for (const angle in aggregate.by_angle) {
    const metrics = aggregate.by_angle[angle];
    console.log(`  ${angle}: ${metrics.accuracy.toFixed(1)}% (${metrics.video_count} videos, ${metrics.issues.length} issues)`);
  }
}

/**
 * Parse CLI arguments
 */
function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const parsed: Partial<CliArgs> = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--annotation':
        parsed.annotation = resolve(args[++i]);
        break;
      case '--result':
        parsed.result = resolve(args[++i]);
        break;
      case '--annotations':
        parsed.annotations = resolve(args[++i]);
        break;
      case '--results':
        parsed.results = resolve(args[++i]);
        break;
      case '--out':
        parsed.out = resolve(args[++i]);
        break;
      case '--require-min':
        parsed.requireMin = parseFloat(args[++i]);
        break;
      case '--batch':
        parsed.batch = true;
        break;
      case '--exercise':
        parsed.exercise = args[++i];
        break;
      default:
        console.error(`Unknown argument: ${args[i]}`);
        process.exit(1);
    }
  }

  // Validate required args
  if (!parsed.out) {
    console.error('Usage: evaluate-pose-accuracy --out <path> [--annotation <path> --result <path> | --annotations <dir> --results <dir>]');
    process.exit(1);
  }

  return parsed as CliArgs;
}

// Run main
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { evaluateSingle, computeAggregateMetrics, generateMarkdownReport };
