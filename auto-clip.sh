#!/bin/bash
# Auto-Clipper: lädt, schneidet und uploaded alles zu Google Drive
set -e

COOKIES="$HOME/yt-clipper-agent/cookies.txt"
DRIVE_FOLDER="gdrive:yt-clips/politik-news-$(date +%Y-%m-%d)"

VIDEOS=(
  "https://www.youtube.com/watch?v=BWK0TfFzbP0"
  "https://www.youtube.com/watch?v=8_1WF6mqyak"
  "https://www.youtube.com/watch?v=rI6hDBvyFPM"
  "https://www.youtube.com/watch?v=Y4agJMp9uDA"
  "https://www.youtube.com/watch?v=eJZjnfLr7u0"
)

cd ~/yt-clipper-agent
git pull -q

echo "================================================"
echo "  Auto-Clipper gestartet — $(date '+%H:%M')"
echo "  ${#VIDEOS[@]} Videos werden verarbeitet"
echo "================================================"

for i in "${!VIDEOS[@]}"; do
  URL="${VIDEOS[$i]}"
  NUM=$((i + 1))
  echo ""
  echo "[$NUM/${#VIDEOS[@]}] $URL"
  node src/clip.js "$URL" --cookies "$COOKIES" || echo "  Fehler bei $URL — weiter..."
done

echo ""
echo "================================================"
echo "  Clips fertig! Lade zu Google Drive hoch..."
echo "  Ziel: $DRIVE_FOLDER"
echo "================================================"

rclone copy ~/yt-clipper-agent/clips/ "$DRIVE_FOLDER" --progress

echo ""
echo "================================================"
echo "  FERTIG! Alle Clips in Google Drive."
echo "================================================"
