#!/usr/bin/env node

/**
 * Ingest high-quality TTS audio assets for production
 *
 * Processes source audio files (WAV, MP3, etc.) from TTS providers:
 * - Normalize loudness to -16 LUFS
 * - Trim leading/trailing silence
 * - Encode to MP3 (VBR ~64 kbps)
 * - Validate file sizes and durations
 * - Generate manifest.json
 *
 * Requirements:
 * - ffmpeg with loudnorm filter
 * - Optional: ffmpeg-normalize (pip install ffmpeg-normalize)
 *
 * Usage:
 *   node scripts/ingest-audio-assets.js --source tmp/audio-source --output packages/app/public/audio
 */

import { execSync } from 'child_process';
import { readdirSync, mkdirSync, writeFileSync, statSync, existsSync, readFileSync } from 'fs';
import { join, basename, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = join(__dirname, '..');

// Parse CLI arguments
const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : null;
};

const SOURCE_DIR = getArg('--source') || join(PROJECT_ROOT, 'tmp/audio-source');
const OUTPUT_DIR = getArg('--output') || join(PROJECT_ROOT, 'packages/app/public/audio');
const VALIDATE_ONLY = args.includes('--validate');

const NUMBERS_OUT = join(OUTPUT_DIR, 'numbers/en');
const UI_OUT = join(OUTPUT_DIR, 'ui');

// Expected files
const EXPECTED_NUMBERS = Array.from({ length: 50 }, (_, i) => String(i + 1));
const EXPECTED_PHRASES = [
  '3', '2', '1', 'go', 'halfway', 'final5', 'rest_15s',
  'next_squats', 'next_burpees', 'next_mountain_climbers',
  'next_high_knees', 'next_push_ups', 'next_side_plank_dip',
  'next_seated_knee_tuck', 'next_up_down_plank', 'next_russian_twist'
];

// Duration limits (ms)
const DURATION_LIMITS = {
  number_single: { min: 250, max: 800 },      // 1-9
  number_double: { min: 300, max: 800 },      // 10-50
  phrase_short: { min: 300, max: 1000 },      // go, 3, 2, 1, halfway
  phrase_long: { min: 1000, max: 2500 },      // rest_15s, next_*
  phrase_final5: { min: 1500, max: 2500 }     // final5
};

console.log('📥 Ingesting TTS audio assets...\n');
console.log(`Source: ${SOURCE_DIR}`);
console.log(`Output: ${OUTPUT_DIR}`);
console.log('');

// Check for ffmpeg
try {
  execSync('ffmpeg -version', { stdio: 'ignore' });
} catch (error) {
  console.error('❌ Error: ffmpeg not found in PATH');
  process.exit(1);
}

// Check source directory
if (!existsSync(SOURCE_DIR)) {
  console.error(`❌ Error: Source directory not found: ${SOURCE_DIR}`);
  console.error('Place your TTS output files in this directory');
  process.exit(1);
}

// Create output directories
if (!VALIDATE_ONLY) {
  mkdirSync(NUMBERS_OUT, { recursive: true });
  mkdirSync(UI_OUT, { recursive: true });
}

const assets = [];
const warnings = [];
let totalSize = 0;

/**
 * Get duration in milliseconds
 */
function getDuration(filePath) {
  try {
    const output = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`, {
      encoding: 'utf-8'
    });
    return Math.round(parseFloat(output.trim()) * 1000);
  } catch {
    return 0;
  }
}

/**
 * Get LUFS loudness
 */
function getLUFS(filePath) {
  try {
    const output = execSync(`ffmpeg -i "${filePath}" -af loudnorm=print_format=json -f null - 2>&1`, {
      encoding: 'utf-8'
    });

    // Parse JSON from ffmpeg output
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      return parseFloat(data.input_i);
    }
  } catch {}
  return null;
}

/**
 * Find source file (any supported extension)
 */
function findSourceFile(name) {
  const extensions = ['.wav', '.mp3', '.flac', '.m4a', '.ogg', '.aiff'];
  for (const ext of extensions) {
    const path = join(SOURCE_DIR, name + ext);
    if (existsSync(path)) return path;
  }
  return null;
}

/**
 * Process audio file: normalize, trim, encode
 */
function processAudio(sourcePath, outputPath, limits) {
  if (VALIDATE_ONLY) {
    // Just validate duration
    const duration = getDuration(sourcePath);
    if (duration < limits.min || duration > limits.max) {
      warnings.push(`${basename(sourcePath)}: Duration ${duration}ms outside range ${limits.min}-${limits.max}ms`);
    }
    return;
  }

  // Normalization + trim + encode pipeline
  const filters = [
    // Trim silence
    'silenceremove=start_periods=1:start_silence=0.05:start_threshold=-50dB',
    'areverse',
    'silenceremove=start_periods=1:start_silence=0.05:start_threshold=-50dB',
    'areverse',
    // Normalize to -16 LUFS
    'loudnorm=I=-16:TP=-1.0:LRA=7'
  ].join(',');

  const cmd = `ffmpeg -i "${sourcePath}" -af "${filters}" -c:a libmp3lame -q:a 2 -y "${outputPath}" 2>/dev/null`;

  try {
    execSync(cmd);
  } catch (error) {
    warnings.push(`Failed to process ${basename(sourcePath)}: ${error.message}`);
    return;
  }

  // Validate output
  if (!existsSync(outputPath)) {
    warnings.push(`Output file not created: ${basename(outputPath)}`);
    return;
  }

  const stats = statSync(outputPath);
  const duration = getDuration(outputPath);
  const lufs = getLUFS(outputPath);

  // Check file size
  if (stats.size > 15 * 1024) {
    warnings.push(`${basename(outputPath)}: File size ${(stats.size / 1024).toFixed(1)} KB exceeds 15 KB limit`);
  }

  // Check duration
  if (duration < limits.min || duration > limits.max) {
    warnings.push(`${basename(outputPath)}: Duration ${duration}ms outside range ${limits.min}-${limits.max}ms`);
  }

  // Check LUFS
  if (lufs !== null && (lufs < -17 || lufs > -15)) {
    warnings.push(`${basename(outputPath)}: LUFS ${lufs.toFixed(1)} outside -17 to -15 range`);
  }

  return { stats, duration, lufs };
}

/**
 * Process numbers 1-50
 */
console.log('Processing numbers 1-50...');
for (let i = 1; i <= 50; i++) {
  const id = String(i).padStart(2, '0');
  const sourcePath = findSourceFile(String(i));

  if (!sourcePath) {
    warnings.push(`Missing source file for number: ${i}`);
    continue;
  }

  const outputPath = join(NUMBERS_OUT, `${id}.mp3`);
  const limits = i <= 9 ? DURATION_LIMITS.number_single : DURATION_LIMITS.number_double;

  const result = processAudio(sourcePath, outputPath, limits);

  if (result && !VALIDATE_ONLY) {
    assets.push({
      id,
      path: `audio/numbers/en/${id}.mp3`,
      duration_ms: result.duration,
      size_bytes: result.stats.size,
      type: 'number'
    });
    totalSize += result.stats.size;
  }

  process.stdout.write(`  ${id}.mp3 ✓\r`);
}
console.log('\n✅ Processed numbers\n');

/**
 * Process Circuit phrases
 */
console.log('Processing Circuit phrases...');
for (const phrase of EXPECTED_PHRASES) {
  const sourcePath = findSourceFile(phrase);

  if (!sourcePath) {
    warnings.push(`Missing source file for phrase: ${phrase}`);
    continue;
  }

  const outputPath = join(UI_OUT, `${phrase}.mp3`);

  // Determine duration limits
  let limits;
  if (phrase === 'final5') {
    limits = DURATION_LIMITS.phrase_final5;
  } else if (phrase.startsWith('next_')) {
    limits = DURATION_LIMITS.phrase_long;
  } else {
    limits = DURATION_LIMITS.phrase_short;
  }

  const result = processAudio(sourcePath, outputPath, limits);

  if (result && !VALIDATE_ONLY) {
    assets.push({
      id: phrase,
      path: `audio/ui/${phrase}.mp3`,
      duration_ms: result.duration,
      size_bytes: result.stats.size,
      type: 'phrase'
    });
    totalSize += result.stats.size;
  }

  console.log(`  ${phrase}.mp3 ✓`);
}
console.log('\n✅ Processed phrases\n');

// Generate manifest
if (!VALIDATE_ONLY && assets.length > 0) {
  const manifest = {
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    total_files: assets.length,
    total_size_bytes: totalSize,
    assets: assets.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'number' ? -1 : 1;
      }
      return a.id.localeCompare(b.id);
    })
  };

  const manifestPath = join(OUTPUT_DIR, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log('📋 Manifest Summary:');
  console.log(`   Total files: ${manifest.total_files}`);
  console.log(`   Total size: ${(totalSize / 1024).toFixed(1)} KB`);
  console.log(`   Average file size: ${(totalSize / manifest.total_files / 1024).toFixed(1)} KB`);
  console.log(`   Manifest: ${manifestPath}\n`);
}

// Report warnings
if (warnings.length > 0) {
  console.log('⚠️  Warnings:');
  warnings.forEach(w => console.log(`   - ${w}`));
  console.log('');
}

// Summary
if (VALIDATE_ONLY) {
  console.log(`✅ Validation complete: ${warnings.length} warnings`);
} else {
  console.log(`✅ Ingestion complete: ${assets.length} files processed, ${warnings.length} warnings`);

  if (totalSize > 1024 * 1024) {
    console.warn(`⚠️  Total payload (${(totalSize / 1024 / 1024).toFixed(2)} MB) exceeds 1 MB target`);
  } else {
    console.log(`✅ Total payload within 1 MB budget`);
  }

  console.log('\nNext steps:');
  console.log('  1. Test audio quality: listen to each file');
  console.log('  2. Deploy: pnpm --filter app build');
  console.log('  3. Service Worker will precache new assets');
}

process.exit(warnings.length > 0 ? 1 : 0);
