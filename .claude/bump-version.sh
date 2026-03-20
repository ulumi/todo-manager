#!/bin/bash
# PostToolUse hook: bumps patch version on every project file edit

INPUT=$(cat)

# Skip if editing version.js itself (avoid loop)
echo "$INPUT" | grep -q "version.js" && exit 0

# Skip if not a todo-manager project file
echo "$INPUT" | grep -q "/Users/hugues/Projects/todo/todo-manager/" || exit 0

VERSION_FILE="/Users/hugues/Projects/todo/todo-manager/js/modules/version.js"

CURRENT=$(grep -oE "[0-9]+\.[0-9]+\.[0-9]+" "$VERSION_FILE" | head -1)
[ -z "$CURRENT" ] && exit 0

MAJOR=$(echo "$CURRENT" | cut -d. -f1)
MINOR=$(echo "$CURRENT" | cut -d. -f2)
PATCH=$(echo "$CURRENT" | cut -d. -f3)
NEW="$MAJOR.$MINOR.$((PATCH + 1))"

sed -i '' "s/'$CURRENT'/'$NEW'/" "$VERSION_FILE"
echo "Version bumped: $CURRENT → $NEW"
