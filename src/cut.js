#!/usr/bin/env node
/**
 * Cut a clip from a video using ffmpeg.
 * Usage: node src/cut.js <input> <start_sec> <end_sec> <output> [--vertical]
 * --vertical: output 9:16 with blurred background (for Shorts/Reels/TikTok)
 */
import { spawnSync } from 'child_process';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const args = process.argv.slice(2);
const [input, startStr, endStr, output] = args;
const vertical = args.includes('--vertical');

if (!input || !startStr || !endStr || !output) {
  console.error('Usage: node src/cut.js <input> <start_sec> <end_sec> <output> [--vertical]');
  process.exit(1);
}

const start = parseFloat(startStr);
const duration = parseFloat(endStr) - start;

mkdirSync(dirname(output), { recursive: true });

const baseArgs = [
  '-y',
  '-ss', String(start),
  '-i', input,
  '-t', String(duration),
];

let filterArgs;
if (vertical) {
  // 9:16 blur-background: original video centered on blurred version of itself
  const vf = [
    'split[original][copy]',
    '[copy]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=luma_radius=20:luma_power=1[bg]',
    '[original]scale=-2:1920:force_original_aspect_ratio=decrease[fg]',
    '[bg][fg]overlay=(W-w)/2:(H-h)/2',
  ].join(';');
  filterArgs = ['-vf', vf, '-c:v', 'libx264', '-crf', '18', '-preset', 'fast', '-c:a', 'aac'];
} else {
  filterArgs = ['-map', '0:v:0', '-map', '0:a:0', '-c', 'copy', '-avoid_negative_ts', 'make_zero'];
}

const result = spawnSync('ffmpeg', [...baseArgs, ...filterArgs, output], {
  stdio: 'inherit',
  timeout: 300_000,
});

if (result.status !== 0 && !vertical) {
  // Re-encode fallback if stream copy fails
  const retry = spawnSync('ffmpeg', [
    '-y',
    '-ss', String(start),
    '-i', input,
    '-t', String(duration),
    '-map', '0:v:0', '-map', '0:a:0',
    '-c:v', 'libx264', '-crf', '18', '-preset', 'fast',
    '-c:a', 'aac',
    output,
  ], { stdio: 'inherit', timeout: 300_000 });
  process.exit(retry.status ?? 1);
}

if (result.status !== 0) process.exit(result.status ?? 1);
