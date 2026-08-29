#!/bin/bash
# PostToolUse hook: bumps patch version on every project file edit.
#
# Le fichier bumpé est celui du dépôt qui CONTIENT le fichier édité, résolu en
# remontant depuis son chemin — jamais un chemin absolu en dur. L'agent d'Inbox
# travaille dans un worktree (.claude/worktrees/…), et une valeur figée pointant
# sur le dépôt principal bumpait le mauvais version.js : le worktree repartait
# en prod avec un numéro inchangé pendant que le dossier de travail de Hugues se
# retrouvait sali par un bump qu'il n'avait pas demandé. Constaté en vrai le
# 2026-08-28 (2963 → 2964 dans le dépôt principal pendant un passage d'agent).

INPUT=$(cat)

# Ni version.js (boucle) ni changelog.json (son champ `version` doit rester
# aligné sur le VERSION réellement déployé — un bump ici les désynchroniserait).
echo "$INPUT" | grep -q "version.js" && exit 0
echo "$INPUT" | grep -q "changelog.json" && exit 0

# Premier "file_path" du payload, quel que soit son niveau d'imbrication.
EDITED=$(printf '%s' "$INPUT" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
[ -n "$EDITED" ] || exit 0

# Remonter jusqu'au dépôt (ou worktree) qui porte js/modules/version.js.
DIR=$(dirname "$EDITED")
VERSION_FILE=""
while [ "$DIR" != "/" ] && [ -n "$DIR" ]; do
  if [ -f "$DIR/js/modules/version.js" ]; then
    VERSION_FILE="$DIR/js/modules/version.js"
    break
  fi
  DIR=$(dirname "$DIR")
done

# Fichier hors d'un dépôt todo-manager : rien à bumper, et surtout pas le
# dépôt principal par défaut.
[ -n "$VERSION_FILE" ] || exit 0

CURRENT=$(grep -oE "[0-9]+\.[0-9]+\.[0-9]+" "$VERSION_FILE" | head -1)
[ -z "$CURRENT" ] && exit 0

MAJOR=$(echo "$CURRENT" | cut -d. -f1)
MINOR=$(echo "$CURRENT" | cut -d. -f2)
PATCH=$(echo "$CURRENT" | cut -d. -f3)
NEW="$MAJOR.$MINOR.$((PATCH + 1))"

sed -i '' "s/'$CURRENT'/'$NEW'/" "$VERSION_FILE"
echo "Version bumped: $CURRENT → $NEW  ($VERSION_FILE)"
