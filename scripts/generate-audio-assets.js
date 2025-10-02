#!/usr/bin/env node

/**
 * Generate placeholder audio assets using ffmpeg
 *
 * Generates 65 beep-based placeholder files:
 * - Numbers 1-50: Beep patterns (1-9: single, 10-19: double, etc.)
 * - Circuit phrases: 15 files with distinct tone patterns
 *
 * Outputs to: packages/app/public/audio/
 * Creates: manifest.json with metadata
 *
 * Requirements:
 * - ffmpeg installed and in PATH
 *
 * Usage:
 *   node scripts/generate-audio-assets.js
 */

import { execSync } from 'child_process';
import { mkdirSync, writeFileSync, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = join(__dirname, '..');
const OUTPUT_DIR = join(PROJECT_ROOT, 'packages/app/public/audio');
const NUMBERS_DIR = join(OUTPUT_DIR, 'numbers/en');
const UI_DIR = join(OUTPUT_DIR, 'ui');

// MVP exercises for next_* files
const MVP_EXERCISES = [
  'squats',
  'burpees',
  'mountain_climbers',
  'high_knees',
  'push_ups',
  'side_plank_dip',
  'seated_knee_tuck',
  'up_down_plank',
  'russian_twist'
];

console.log('🎵 Generating placeholder audio assets with ffmpeg...\n');

// Check for ffmpeg
try {
  execSync('ffmpeg -version', { stdio: 'ignore' });
} catch (error) {
  console.error('❌ Error: ffmpeg not found in PATH');
  console.error('Please install ffmpeg:');
  console.error('  macOS: brew install ffmpeg');
  console.error('  Ubuntu: apt-get install ffmpeg');
  console.error('  Windows: choco install ffmpeg');
  process.exit(1);
}

// Create output directories
mkdirSync(NUMBERS_DIR, { recursive: true });
mkdirSync(UI_DIR, { recursive: true });

const assets = [];
let totalSize = 0;

/**
 * Generate a single beep
 */
function generateBeep(outputPath, frequency = 880, duration = 0.1, volume = -10) {
  const cmd = `ffmpeg -f lavfi -i "sine=frequency=${frequency}:duration=${duration}" -af "volume=${volume}dB,afade=t=in:st=0:d=0.01,afade=t=out:st=${duration - 0.01}:d=0.01" -c:a libmp3lame -q:a 4 -y "${outputPath}" 2>/dev/null`;
  execSync(cmd);
}

/**
 * Generate multiple beeps with gaps
 */
function generateMultiBeep(outputPath, count, frequency = 880, beepDuration = 0.1, gapDuration = 0.05, volume = -10) {
  // Generate individual beeps
  const tempBeeps = [];
  for (let i = 0; i < count; i++) {
    const tempFile = join(dirname(outputPath), `temp_beep_${i}.wav`);
    const cmd = `ffmpeg -f lavfi -i "sine=frequency=${frequency}:duration=${beepDuration}" -af "volume=${volume}dB,afade=t=in:st=0:d=0.01,afade=t=out:st=${beepDuration - 0.01}:d=0.01,apad=pad_dur=${gapDuration}" -y "${tempFile}" 2>/dev/null`;
    execSync(cmd);
    tempBeeps.push(tempFile);
  }

  // Create concat file
  const concatFile = join(dirname(outputPath), 'concat.txt');
  const concatContent = tempBeeps.map(f => `file '${f}'`).join('\n');
  writeFileSync(concatFile, concatContent);

  // Concatenate
  const cmd = `ffmpeg -f concat -safe 0 -i "${concatFile}" -c:a libmp3lame -q:a 4 -y "${outputPath}" 2>/dev/null`;
  execSync(cmd);

  // Cleanup
  tempBeeps.forEach(f => {
    try {
      execSync(`rm "${f}"`);
    } catch {}
  });
  try {
    execSync(`rm "${concatFile}"`);
  } catch {}
}

/**
 * Generate chirp (frequency sweep)
 * Note: ffmpeg 8.0 changed lavfi syntax, using two-tone pattern instead
 */
function generateChirp(outputPath, startFreq = 440, endFreq = 880, duration = 0.2, volume = -10) {
  // Generate two overlapping tones for a "chirp" effect
  const cmd = `ffmpeg -f lavfi -i "sine=frequency=${startFreq}:duration=${duration}" -f lavfi -i "sine=frequency=${endFreq}:duration=${duration}" -filter_complex "[0:a][1:a]amerge=inputs=2,pan=mono|c0=0.5*c0+0.5*c1,volume=${volume}dB,afade=t=in:st=0:d=0.02,afade=t=out:st=${duration - 0.02}:d=0.02" -c:a libmp3lame -q:a 4 -y "${outputPath}" 2>/dev/null`;
  execSync(cmd);
}

/**
 * Get duration of audio file in milliseconds
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
 * Add asset to manifest
 */
function addAsset(id, relativePath, type) {
  const fullPath = join(OUTPUT_DIR, relativePath);
  if (!existsSync(fullPath)) {
    console.warn(`⚠️  Warning: ${relativePath} not found`);
    return;
  }

  const stats = statSync(fullPath);
  const duration = getDuration(fullPath);

  assets.push({
    id,
    path: `audio/${relativePath}`,
    duration_ms: duration,
    size_bytes: stats.size,
    type
  });

  totalSize += stats.size;
}

// Generate numbers 1-50
console.log('Generating numbers 1-50...');
for (let i = 1; i <= 50; i++) {
  const id = String(i).padStart(2, '0');
  const outputPath = join(NUMBERS_DIR, `${id}.mp3`);

  // Determine beep count based on range
  let beepCount;
  if (i <= 9) beepCount = 1;
  else if (i <= 19) beepCount = 2;
  else if (i <= 29) beepCount = 3;
  else if (i <= 39) beepCount = 4;
  else beepCount = 5;

  if (beepCount === 1) {
    generateBeep(outputPath);
  } else {
    generateMultiBeep(outputPath, beepCount);
  }

  addAsset(id, `numbers/en/${id}.mp3`, 'number');
  process.stdout.write(`  ${id}.mp3 ✓\r`);
}
console.log('\n✅ Generated 50 number files\n');

// Generate Circuit phrases
console.log('Generating Circuit phrases...');

// Countdown: 3, 2, 1
const countdownFreqs = [880, 784, 698]; // Descending tones
['3', '2', '1'].forEach((num, idx) => {
  const outputPath = join(UI_DIR, `${num}.mp3`);
  generateBeep(outputPath, countdownFreqs[idx], 0.15, -8);
  addAsset(num, `ui/${num}.mp3`, 'phrase');
  console.log(`  ${num}.mp3 ✓`);
});

// Go: ascending chirp
const goPath = join(UI_DIR, 'go.mp3');
generateChirp(goPath, 440, 880, 0.2, -8);
addAsset('go', 'ui/go.mp3', 'phrase');
console.log('  go.mp3 ✓');

// Halfway: two-tone pattern
const halfwayPath = join(UI_DIR, 'halfway.mp3');
generateMultiBeep(halfwayPath, 2, 660, 0.15, 0.1, -8);
addAsset('halfway', 'ui/halfway.mp3', 'phrase');
console.log('  halfway.mp3 ✓');

// Final5: rapid beep sequence
const final5Path = join(UI_DIR, 'final5.mp3');
generateMultiBeep(final5Path, 5, 880, 0.1, 0.05, -8);
addAsset('final5', 'ui/final5.mp3', 'phrase');
console.log('  final5.mp3 ✓');

// Rest 15s: calming low tone
const restPath = join(UI_DIR, 'rest_15s.mp3');
generateBeep(restPath, 220, 0.4, -12);
addAsset('rest_15s', 'ui/rest_15s.mp3', 'phrase');
console.log('  rest_15s.mp3 ✓');

// Next move intros: beep + pause pattern
MVP_EXERCISES.forEach(exercise => {
  const filename = `next_${exercise}.mp3`;
  const outputPath = join(UI_DIR, filename);

  // Single beep (440 Hz, 100ms) + 200ms silence
  const cmd = `ffmpeg -f lavfi -i "sine=frequency=440:duration=0.1" -af "volume=-10dB,afade=t=in:st=0:d=0.01,afade=t=out:st=0.09:d=0.01,apad=pad_dur=0.2" -c:a libmp3lame -q:a 4 -y "${outputPath}" 2>/dev/null`;
  execSync(cmd);

  addAsset(`next_${exercise}`, `ui/${filename}`, 'phrase');
  console.log(`  ${filename} ✓`);
});

console.log('\n✅ Generated 15 Circuit phrase files\n');

// Generate manifest.json
const manifest = {
  version: '1.0.0',
  generated_at: new Date().toISOString(),
  total_files: assets.length,
  total_size_bytes: totalSize,
  assets: assets.sort((a, b) => {
    // Sort numbers first, then phrases
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

if (totalSize > 1024 * 1024) {
  console.warn(`⚠️  Warning: Total payload (${(totalSize / 1024 / 1024).toFixed(2)} MB) exceeds 1 MB target`);
} else {
  console.log(`✅ Total payload within 1 MB budget\n`);
}

console.log('✨ Done! Audio assets generated at:');
console.log(`   ${OUTPUT_DIR}\n`);
console.log('Next steps:');
console.log('  1. Test playback: pnpm --filter app dev');
console.log('  2. Implement WebAudioVoiceDriver');
console.log('  3. Replace with high-quality TTS when ready\n');
