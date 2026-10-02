#!/usr/bin/env bash
# Launch Open Tick (dev server with hot reload by default)
# Usage:
#   ./launch.sh
#   ./launch.sh --seed
#   ./launch.sh --appimage

set -e

cd "$(dirname "$0")"

if [[ "$1" == "--appimage" || "$1" == "--packaged" ]]; then
  APPIMAGE=$(find release -maxdepth 1 -name 'Open Tick-*-linux-*.AppImage' | head -n1)
  if [[ -n "$APPIMAGE" ]]; then
    echo "Launching packaged AppImage: $APPIMAGE"
    chmod +x "$APPIMAGE"
    exec "$APPIMAGE"
  else
    echo "No AppImage found in release/. Run npm run package:linux first."
    exit 1
  fi
elif [[ "$1" == "--seed" ]]; then
  echo "Starting dev server with seed data..."
  exec npm run dev:seed
else
  echo "Starting dev server (hot reload)..."
  exec npm run dev
fi
