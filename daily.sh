#!/bin/bash
# Daily auto-clipper — runs the latest video from a YouTube channel
# Setup: add to crontab with:  crontab -e
#   0 19 * * * /home/YOUR_USER/yt-clipper-agent/daily.sh >> /home/YOUR_USER/yt-clipper-agent/daily.log 2>&1

export PATH="$HOME/.local/bin:$PATH"

# --- SETTINGS ---
CHANNEL_URL="https://www.youtube.com/@LunarGaming/videos"
API_KEY=""   # paste your ANTHROPIC_API_KEY here if not in ~/.bashrc
# ----------------

if [ -n "$API_KEY" ]; then
  export ANTHROPIC_API_KEY="$API_KEY"
fi

if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "[ERROR] ANTHROPIC_API_KEY not set"
  exit 1
fi

cd "$(dirname "$0")"

echo "[$(date)] Starting daily clip job..."

# Get latest video URL
LATEST_ID=$(yt-dlp --get-id --playlist-items 1 "$CHANNEL_URL" 2>/dev/null)
if [ -z "$LATEST_ID" ]; then
  echo "[ERROR] Could not fetch latest video"
  exit 1
fi

LATEST_URL="https://www.youtube.com/watch?v=${LATEST_ID}"
echo "[$(date)] Latest video: $LATEST_URL"

# Run clipper
node src/clip.js "$LATEST_URL" --vertical

echo "[$(date)] Done."
