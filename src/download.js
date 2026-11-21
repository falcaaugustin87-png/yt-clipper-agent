#!/usr/bin/env node
/**
 * Download a YouTube video.
 * Usage: node src/download.js <URL> <output_path>
 * Downloads best mp4 to output_path.
 */
import { spawnSync } from 'child_process';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const args = process.argv.slice(2);
const url = args[0];
const out = args[1];
const cookiesIdx = args.indexOf('--cookies');
const cookiesFile = cookiesIdx !== -1 ? args[cookiesIdx + 1] : null;

if (!url || !out) {
  console.error('Usage: node src/download.js <URL> <output_path> [--cookies <file>]');
  process.exit(1);
}

mkdirSync(dirname(out), { recursive: true });

const ytdlpArgs = [
  '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best',
  '--merge-output-format', 'mp4',
  '--no-playlist',
  '-o', out,
];
if (cookiesFile) ytdlpArgs.push('--cookies', cookiesFile);
ytdlpArgs.push(url);

const result = spawnSync('yt-dlp', ytdlpArgs, { stdio: 'inherit', timeout: 600_000 });

process.exit(result.status ?? 1);
