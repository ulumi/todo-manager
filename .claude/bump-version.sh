#!/bin/bash
# PostToolUse hook: bumps patch version on every project file edit

INPUT=$(cat)

# Skip if editing version.js itself (avoid loop)
echo "$INPUT" | grep -q "version.js" && exit 0

# Skip if editing changelog.json — its version field must stay in sync with
# the VERSION that's about to be committed/deployed, an extra bump here would desync them
echo "$INPUT" | grep -q "changelog.json" && exit 0

# Skip if not a todo-manager project file
echo "$INPUT" | grep -q "/Users/hugues/Desktop/Projects/todo/todo-manager/" || exit 0

VERSION_FILE="/Users/hugues/Desktop/Projects/todo/todo-manager/js/modules/version.js"

CURRENT=$(grep -oE "[0-9]+\.[0-9]+\.[0-9]+" "$VERSION_FILE" | head -1)
[ -z "$CURRENT" ] && exit 0

MAJOR=$(echo "$CURRENT" | cut -d. -f1)
MINOR=$(echo "$CURRENT" | cut -d. -f2)
PATCH=$(echo "$CURRENT" | cut -d. -f3)
NEW="$MAJOR.$MINOR.$((PATCH + 1))"

sed -i '' "s/'$CURRENT'/'$NEW'/" "$VERSION_FILE"
echo "Version bumped: $CURRENT → $NEW"
