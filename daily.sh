#!/bin/bash
# Daily auto-clipper — clips the most-viewed video + top Shorts from a YouTube channel
# Output: always 9:16 vertical for Shorts/Reels/TikTok
# Setup: crontab -e
#   0 19 * * * /home/falcaalix/yt-clipper-agent/daily.sh >> /home/falcaalix/yt-clipper-agent/daily.log 2>&1

export PATH="$HOME/.local/bin:$PATH"

# --- SETTINGS ---
CHANNEL_URL="https://www.youtube.com/@xLunarGaming/videos?sort=p"  # sort=p = most viewed
SHORTS_URL="https://www.youtube.com/@xLunarGaming/shorts"           # Shorts: already 9:16, max 60s
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
mkdir -p clips/shorts

echo "[$(date)] Starting daily clip job..."

# --- PART 1: Long video — clip best moments in 9:16 ---
LATEST_ID=$(yt-dlp --get-id --playlist-items 1 "$CHANNEL_URL" 2>/dev/null)
if [ -z "$LATEST_ID" ]; then
  echo "[WARN] Could not fetch video list, skipping long video"
else
  LATEST_URL="https://www.youtube.com/watch?v=${LATEST_ID}"
  echo "[$(date)] Processing long video: $LATEST_URL"
  node src/clip.js "$LATEST_URL" --vertical
fi

# --- PART 2: Shorts — already 9:16 and max 60s, download directly ---
echo "[$(date)] Fetching top 3 Shorts from channel..."
SHORTS_IDS=$(yt-dlp --get-id --playlist-items 1-3 "$SHORTS_URL" 2>/dev/null)
if [ -z "$SHORTS_IDS" ]; then
  echo "[WARN] No Shorts found"
else
  while IFS= read -r VID_ID; do
    [ -z "$VID_ID" ] && continue
    SHORT_URL="https://www.youtube.com/watch?v=${VID_ID}"
    OUT_FILE="clips/shorts/short_${VID_ID}.mp4"
    if [ -f "$OUT_FILE" ]; then
      echo "[$(date)] Already downloaded: $VID_ID — skipping"
      continue
    fi
    echo "[$(date)] Downloading Short: $SHORT_URL"
    yt-dlp -f 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]' \
      --match-filter 'duration <= 61' \
      -o "$OUT_FILE" \
      "$SHORT_URL" 2>&1 | tail -5
  done <<< "$SHORTS_IDS"
fi

# --- Upload all clips to Google Drive ---
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
