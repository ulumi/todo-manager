#!/bin/bash
DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo "Watching $DIR/css/styles.scss..."
fswatch -o "$DIR/css/styles.scss" | while read; do
  if npx sass "$DIR/css/styles.scss" "$DIR/css/styles.css" --style=expanded 2>/tmp/scss-err.txt; then
    osascript -e 'display notification "SCSS compilé 👋" with title "👋 Todo Manager" sound name "Glass"'
    echo "$(date '+%H:%M:%S') ✓ Compiled"
  else
    osascript -e 'display notification "Erreur SCSS ✗" with title "Todo Manager" sound name "Basso"'
    echo "$(date '+%H:%M:%S') ✗ Error:"
    cat /tmp/scss-err.txt
  fi
done
