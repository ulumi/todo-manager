#!/bin/bash
# PostToolUse hook: bumps patch version on every project file edit
# Receives JSON on stdin: { tool_name, tool_input, tool_response }

INPUT=$(cat)

FILE=$(echo "$INPUT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('tool_input', {}).get('file_path', ''))
" 2>/dev/null)

# Skip non-project files, version.js itself, and README.md (avoids loops/noise)
case "$FILE" in
  *version.js*|*README.md*|"") exit 0 ;;
esac

VERSION_FILE="/Users/hugues/Projects/todo/todo-manager/js/modules/version.js"

CURRENT=$(grep -oE "[0-9]+\.[0-9]+\.[0-9]+" "$VERSION_FILE" | head -1)
[ -z "$CURRENT" ] && exit 0

MAJOR=$(echo "$CURRENT" | cut -d. -f1)
MINOR=$(echo "$CURRENT" | cut -d. -f2)
PATCH=$(echo "$CURRENT" | cut -d. -f3)
NEW="$MAJOR.$MINOR.$((PATCH + 1))"

sed -i '' "s/'$CURRENT'/'$NEW'/" "$VERSION_FILE"
echo "Version bumped: $CURRENT → $NEW (file: $(basename $FILE))"
