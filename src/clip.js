#!/usr/bin/env node
/**
 * CLI entry point — orchestrates the full clipping pipeline.
 * Usage: node src/clip.js <YouTube-URL> [--keep-raw] [--vertical]
 * --vertical: output clips in 9:16 format with blur background (Shorts/Reels/TikTok)
 */
import { execSync } from 'child_process';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import Anthropic from '@anthropic-ai/sdk';

const url      = process.argv[2];
const keep     = process.argv.includes('--keep-raw');
const vertical = process.argv.includes('--vertical');
const cookiesIdx = process.argv.indexOf('--cookies');
const cookies  = cookiesIdx !== -1 ? process.argv[cookiesIdx + 1] : null;
if (!url) { console.error('Usage: node src/clip.js <URL> [--keep-raw] [--vertical] [--cookies <file>]'); process.exit(1); }

const run = cmd => execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] });

// -- 1. Check dependencies
for (const bin of ['yt-dlp', 'ffmpeg']) {
  try { run(`which ${bin}`); }
  catch { console.error(`\n  Missing: ${bin}\n  See README for install instructions.\n`); process.exit(1); }
}

// -- 2. Video info
console.log('[1/5] Fetching video info...');
const cookiesFlag = cookies ? ` --cookies "${cookies}"` : '';
const info = JSON.parse(run(`node src/info.js "${url}"${cookiesFlag}`))
console.log(`  ${info.title} [${info.type}]`);
if (vertical) console.log('  Output: 9:16 vertical (blur background)');

mkdirSync('clips', { recursive: true });

// -- 3. Transcript
console.log('[2/5] Downloading transcript...');
let transcript = [];
try {
  transcript = JSON.parse(run(`node src/transcript.js "${url}"${cookiesFlag}`));
  console.log(`  ${transcript.length} subtitle segments`);
} catch {
  console.log('  No subtitles - will sample evenly');
}

// -- 4. Chat replay (ended streams)
let chat = [];
if (info.type === 'ended') {
  console.log('[+] Downloading chat replay...');
  try {
    chat = JSON.parse(run(`node src/chat.js "${url}"`));
    console.log(`  ${chat.length} chat messages`);
  } catch {
    console.log('  No chat replay available');
  }
}

// -- 5. Analyze with Claude
console.log('[3/5] Analyzing for best moments...');
const client = new Anthropic();

const transcriptText = transcript.length
  ? transcript.map(s => `[${s.start.toFixed(0)}s] ${s.text}`).join('\n')
  : 'No transcript available.';

const chatText = chat.length
  ? chat.slice(0, 2000).map(m => `[${m.time.toFixed(0)}s] ${m.author}: ${m.message}${m.superChat ? ' $' : ''}`).join('\n')
  : '';

const dur = info.duration ?? 600;
const skipStart = Math.min(30, dur * 0.05);
const skipEnd   = Math.max(0, dur - Math.min(30, dur * 0.05));

const prompt = `You are a viral short-form video editor specializing in TikTok, YouTube Shorts and Instagram Reels.
Analyze this ${
  info.type === 'live' ? 'live stream' : info.type === 'ended' ? 'ended live stream' : 'video'
} and find the 6 best 15-second moments with strong viral hooks.

Video: "${info.title}"
Duration: ${Math.round(dur)}s

STRICT RULES - follow these exactly:
- Each clip must be EXACTLY 15 seconds long (end = start + 15)
- NEVER start before ${Math.round(skipStart)}s (intro)
- NEVER go past ${Math.round(skipEnd)}s (outro)
- Each clip MUST start with a viral hook — a moment that grabs attention in the first 2 seconds:
  * A shocking statement or revelation
  * A strong emotional reaction (anger, disbelief, laughter, shock)
  * A controversial or surprising opinion
  * A powerful quote or one-liner
  * A heated argument or confrontation
  * A "wait what?" or unexpected moment
- PREFER: moments where someone says something bold, surprising, emotional or controversial
- Each clip must make sense on its own without context
- For news/politics: find the most dramatic, emotional or controversial statements

TRANSCRIPT:
${transcriptText.slice(0, 8000)}

${chatText ? `CHAT REPLAY (shows viewer reactions):\n${chatText.slice(0, 4000)}` : ''}

Return ONLY valid JSON - an array of exactly 6 objects:
[
  { "start": <seconds>, "end": <seconds>, "hook": "<the opening hook in 1 sentence>", "reason": "<why this goes viral>", "score": <1-10> }
]
Note: end must always equal start + 15. Sorted by score descending.`;

const response = await client.messages.create({
  model: 'claude-opus-4-5',
  max_tokens: 1024,
  messages: [{ role: 'user', content: prompt }],
});

let moments = [];
try {
  const jsonMatch = response.content[0].text.match(/\[[\s\S]*\]/);
  moments = JSON.parse(jsonMatch[0]);
} catch {
  console.log('  Analysis fallback - using even intervals');
  const step = Math.floor((skipEnd - skipStart) / 6);
  moments = Array.from({ length: 6 }, (_, i) => ({
    start: skipStart + i * step,
    end: skipStart + i * step + 15,
    hook: `segment ${i + 1}`,
    reason: `segment ${i + 1} (unranked)`, score: 5,
  }));
}

console.log(`  ${moments.length} moments identified`);

// -- 6. Download video
const rawPath = join('clips', `raw_${info.id}.mp4`);
if (!existsSync(rawPath)) {
  console.log('[4/5] Downloading video...');
  const cookiesArg = cookies ? ` --cookies "${cookies}"` : '';
  execSync(`node src/download.js "${url}" "${rawPath}"${cookiesArg}`, { stdio: 'inherit' });
}

// -- 7. Cut clips
console.log('[5/5] Cutting clips...');
const clips = [];
for (let i = 0; i < moments.length; i++) {
  const m = moments[i];
  const suffix = vertical ? '_vertical' : '';
  const out = join('clips', `clip_${i + 1}${suffix}_${info.id}.mp4`);
  const vertFlag = vertical ? ' --vertical' : '';
  execSync(`node src/cut.js "${rawPath}" ${m.start} ${m.end} "${out}"${vertFlag}`, { stdio: 'inherit' });
  clips.push({ ...m, file: out });
  process.stdout.write(`  clip ${i + 1}/${moments.length} done\n`);
}

// -- 8. Cleanup & report
if (!keep) {
  try { unlinkSync(rawPath); } catch {}
}

const fmt = s => {
  const m = Math.floor(s / 60), sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
};

console.log(`\nDone! ${clips.length} clips ready - ranked best first\n`);
clips.forEach((c, i) => {
  console.log(`  ${i + 1}. ${c.file.padEnd(45)} [${fmt(c.start)}-${fmt(c.end)}]  score ${c.score}  - ${c.reason}`);
});
console.log('');
