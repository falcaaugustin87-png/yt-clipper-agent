#!/usr/bin/env node
/**
 * Download and parse subtitles for a YouTube video.
 * Usage: node src/transcript.js <URL>
 * Prints JSON array: [{ start, end, text }] with times in seconds.
 */
import { execSync, spawnSync } from 'child_process';
import { readFileSync, readdirSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtempSync } from 'fs';

const url = process.argv[2];
const cookiesIdx = process.argv.indexOf('--cookies');
const cookies = cookiesIdx !== -1 ? process.argv[cookiesIdx + 1] : null;
if (!url) { console.error('Usage: node src/transcript.js <URL> [--cookies <file>]'); process.exit(1); }

const dir = mkdtempSync(join(tmpdir(), 'yt-subs-'));

const ytdlpArgs = [
  '--write-subs', '--write-auto-subs',
  '--skip-download',
  '--sub-lang', 'de,en',
  '--sub-format', 'vtt',
  '--output', join(dir, '%(id)s.%(ext)s'),
  '--no-playlist',
];
if (cookies) ytdlpArgs.push('--cookies', cookies);
ytdlpArgs.push(url);

const result = spawnSync('yt-dlp', ytdlpArgs, { encoding: 'utf8', timeout: 60_000 });

if (result.status !== 0) {
  console.error('yt-dlp subtitle download failed:', result.stderr);
  process.exit(1);
}

// Find the .vtt file
const files = readdirSync(dir).filter(f => f.endsWith('.vtt'));
if (!files.length) {
  console.error('No subtitles found for this video.');
  process.exit(1);
}

const vtt = readFileSync(join(dir, files[0]), 'utf8');

// Parse VTT into segments
const segments = [];
const cueRe = /(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})[^\n]*\n([\s\S]*?)(?=\n\n|\n*$)/g;
const toSec = t => {
  const [h, m, s] = t.split(':');
  return +h * 3600 + +m * 60 + parseFloat(s);
};
let m;
while ((m = cueRe.exec(vtt)) !== null) {
  const text = m[3].replace(/<[^>]+>/g, '').replace(/\n/g, ' ').trim();
  if (!text || text === '&nbsp;') continue;
  segments.push({ start: toSec(m[1]), end: toSec(m[2]), text });
}

// Clean up temp files
files.forEach(f => { try { unlinkSync(join(dir, f)); } catch {} });

console.log(JSON.stringify(segments, null, 2));
