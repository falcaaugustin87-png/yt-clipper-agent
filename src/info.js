#!/usr/bin/env node
/**
 * Get video metadata via yt-dlp.
 * Usage: node src/info.js <URL>
 * Prints JSON: { id, title, type, duration, uploader }
 */
import { execSync } from 'child_process';

const url = process.argv[2];
const cookiesIdx = process.argv.indexOf('--cookies');
const cookies = cookiesIdx !== -1 ? process.argv[cookiesIdx + 1] : null;
if (!url) { console.error('Usage: node src/info.js <URL> [--cookies <file>]'); process.exit(1); }

const cookiesArg = cookies ? `--cookies "${cookies}" ` : '';
let raw;
try {
  raw = execSync(`yt-dlp ${cookiesArg}--extractor-args "youtube:player_client=web_embedded,android_vr" --print-json --skip-download --no-playlist "${url}"`, {
    encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 30_000,
  });
} catch (e) {
  console.error('yt-dlp failed:', e.message);
  process.exit(1);
}

const d = JSON.parse(raw);

let type = 'video';
if (d.is_live) type = 'live';
else if (d.was_live) type = 'ended';

console.log(JSON.stringify({
  id:       d.id,
  title:    d.title,
  type,
  duration: d.duration ?? null,
  uploader: d.uploader ?? d.channel ?? '',
  url,
}));
