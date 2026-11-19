#!/bin/bash
# Daily auto-clipper — clips the most-viewed video from a YouTube channel
# Output: always 9:16 vertical (blur background) for Shorts/Reels/TikTok
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

# Get most-viewed video
LATEST_ID=$(yt-dlp --get-id --playlist-items 1 "$CHANNEL_URL" 2>/dev/null)
if [ -z "$LATEST_ID" ]; then
  echo "[ERROR] Could not fetch video list"
  exit 1
fi

LATEST_URL="https://www.youtube.com/watch?v=${LATEST_ID}"
echo "[$(date)] Processing: $LATEST_URL"

# Always output 9:16 vertical for Shorts/Reels/TikTok
node src/clip.js "$LATEST_URL" --vertical

# Upload clips to Google Drive
DRIVE_FOLDER="gdrive:yt-clips/$(date +%Y-%m-%d)"
echo "[$(date)] Uploading clips to Google Drive: $DRIVE_FOLDER"
rclone copy clips/ "$DRIVE_FOLDER" --include "*.mp4" --progress 2>&1
if [ $? -eq 0 ]; then
  echo "[$(date)] Upload complete: $DRIVE_FOLDER"
else
  echo "[$(date)] Upload failed — clips are still saved locally"
fi

# Auto-cleanup: delete clips older than 7 days to save space
find "$(dirname "$0")/clips" -name "*.mp4" -mtime +7 -delete 2>/dev/null

echo "[$(date)] Done."
