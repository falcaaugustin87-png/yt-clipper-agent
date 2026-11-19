#!/bin/bash
# Daily auto-clipper — clips the most-viewed video from a YouTube channel
# Setup: crontab -e
#   0 19 * * * /home/falcaalix/yt-clipper-agent/daily.sh >> /home/falcaalix/yt-clipper-agent/daily.log 2>&1

export PATH="$HOME/.local/bin:$PATH"

# --- SETTINGS ---
CHANNEL_URL="https://www.youtube.com/@xLunarGaming/videos?sort=p"  # sort=p = most viewed
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

# Get most-viewed video not yet clipped today
LATEST_ID=$(yt-dlp --get-id --playlist-items 1 "$CHANNEL_URL" 2>/dev/null)
if [ -z "$LATEST_ID" ]; then
  echo "[ERROR] Could not fetch video list"
  exit 1
fi

LATEST_URL="https://www.youtube.com/watch?v=${LATEST_ID}"
echo "[$(date)] Processing: $LATEST_URL"

# Run clipper with vertical output for Shorts/Reels/TikTok
node src/clip.js "$LATEST_URL" --vertical

echo "[$(date)] Done."
