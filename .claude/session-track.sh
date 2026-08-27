#!/bin/bash
# ════════════════════════════════════════════════════════════════════════════
#  session-track.sh — qui a touché quoi, quand plusieurs sessions Claude
#  travaillent en même temps sur ce repo
# ════════════════════════════════════════════════════════════════════════════
# Deux branchements dans .claude/settings.json, tous deux en matcher « * » :
#   PreToolUse  → `session-track.sh pre`  : pose l'heure de départ de l'appel
#   PostToolUse → `session-track.sh`      : attribue ce qui a bougé depuis
#
# Le passage par Bash est la raison d'être du matcher « * » : beaucoup
# d'éditions se font par sed/python/heredoc via Bash et jamais par les outils
# Edit/Write, qu'un matcher « Edit|Write » serait donc seul à voir.
#
# Fichiers écrits dans .claude/.sessions/ (gitignoré), par session :
#   <sid>.alive   — touché à chaque passage : son mtime EST le signal de vie
#   <sid>.tstart  — début de l'appel d'outil en cours (fenêtre d'attribution)
#   <sid>.snap    — « chemin<TAB>mtime » des fichiers sales au passage précédent
#   <sid>.owns    — « chemin<TAB>mtime » des fichiers salis, pas encore committés
#
# ── Attribution ─────────────────────────────────────────────────────────────
# Edit/Write & co : le chemin est DANS la charge utile du hook (`file_path`),
# aucune devinette. Bash : on retient les fichiers sales dont le mtime tombe
# APRÈS le `.tstart` de cet appel-ci — fenêtre de quelques centaines de ms,
# au lieu de « depuis mon passage précédent » qui couvrait aussi tout le temps
# de réflexion du modèle et ramassait donc les écritures de la session d'à
# côté. Les mtimes sont comparés en flottant (`stat -f %Fm`) et jamais avec
# `test -nt` : bash 3.2 (macOS) n'y compare que des SECONDES entières, si bien
# qu'une écriture faite dans la même seconde passait inaperçue.
#
# « Premier arrivé, premier servi » en cas d'égalité : un fichier déjà réclamé
# par une autre session vivante DANS SA VERSION ACTUELLE n'est pas re-réclamé.
# Ce qu'on possède se raisonne ensuite par CHEMIN : si l'autre session réécrit
# par-dessus, on reste dessus tous les deux et le pre-commit le signale comme
# PARTAGÉ, plutôt que d'en perdre silencieusement la paternité.
#
# Rien ici ne bloque : c'est .claude/githooks/pre-commit qui s'en sert pour
# refuser un commit qui embarquerait le travail d'une autre session. Sort
# TOUJOURS en 0 — ce hook ne doit jamais faire échouer un appel d'outil.
IN=$(cat)
MODE="${1:-post}"
ROOT=$(cd "$(dirname "$0")/.." && pwd)
D="$ROOT/.claude/.sessions"

SID=$(printf '%s' "$IN" | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
[ -z "$SID" ] && exit 0
mkdir -p "$D" || exit 0
: > "$D/$SID.alive"
[ "$MODE" = "pre" ] && { : > "$D/$SID.tstart"; exit 0; }

_mtime() { stat -f '%Fm' "$1" 2>/dev/null || stat -c '%.9Y' "$1" 2>/dev/null; }

SNAP="$D/$SID.snap"; OWNS="$D/$SID.owns"
TOOL=$(printf '%s' "$IN" | sed -n 's/.*"tool_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)

if [ ! -f "$SNAP" ]; then
  # Filet : core.hooksPath a déjà pointé vers un dossier disparu (repo
  # déplacé), ce qui désactive silencieusement TOUS les hooks. Chaque session
  # le remet d'aplomb une fois, à son premier appel d'outil.
  [ "$(git -C "$ROOT" config --get core.hooksPath)" = ".claude/githooks" ] \
    || git -C "$ROOT" config core.hooksPath .claude/githooks 2>/dev/null
  : > "$SNAP"   # premier passage : on ne réclame rien, on prend le repère
fi

# Seuls les outils qui écrivent peuvent salir un fichier : inutile de lancer
# un `git diff` après chaque Read/Grep.
case "$TOOL" in
  Bash|Edit|Write|NotebookEdit|MultiEdit) ;;
  *) exit 0 ;;
esac

CUR=$(mktemp) || exit 0
while IFS= read -r f; do
  [ -n "$f" ] && [ -f "$ROOT/$f" ] && printf '%s\t%s\n' "$f" "$(_mtime "$ROOT/$f")" >> "$CUR"
done < <( { git -C "$ROOT" -c core.quotepath=false diff --name-only HEAD;
            git -C "$ROOT" -c core.quotepath=false ls-files --others --exclude-standard; } 2>/dev/null | sort -u )

# Ce que CET appel d'outil a écrit
WROTE=$(mktemp)
if [ "$TOOL" = "Bash" ]; then
  TS=$(_mtime "$D/$SID.tstart")
  if [ -n "$TS" ]; then
    awk -F'\t' -v ts="$TS" '$2 >= ts {print $1}' "$CUR" > "$WROTE"
  else
    # Pas de hook PreToolUse (ancienne config) : repli sur « changé depuis mon
    # passage précédent », moins précis mais toujours mieux que rien.
    cut -f1 "$CUR" | grep -vxF -f <(cut -f1 "$SNAP" 2>/dev/null) > "$WROTE" 2>/dev/null
    grep -vxF -f "$SNAP" "$CUR" 2>/dev/null | cut -f1 >> "$WROTE"
  fi
else
  printf '%s' "$IN" | sed -n 's|.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*|\1|p' | head -1 \
    | sed "s|^$ROOT/||" > "$WROTE"
fi

# Réclamations des autres sessions vivantes, version par version
CLAIMED=$(mktemp)
for a in $(find "$D" -name '*.alive' -mmin -120 2>/dev/null); do
  o=$(basename "$a" .alive); [ "$o" = "$SID" ] && continue
  [ -f "$D/$o.owns" ] && cat "$D/$o.owns" >> "$CLAIMED"
done

MINEPATHS=$(mktemp); cut -f1 "$OWNS" 2>/dev/null | sort -u > "$MINEPATHS"
NEW=$(mktemp)
while IFS= read -r line; do
  [ -n "$line" ] || continue
  path="${line%%$'\t'*}"
  if grep -qxF -- "$path" "$MINEPATHS" 2>/dev/null; then
    printf '%s\n' "$line" >> "$NEW"           # déjà à moi, mtime rafraîchi
  elif ! grep -qxF -- "$path" "$WROTE" 2>/dev/null; then
    :                                         # pas écrit par cet appel-ci
  elif grep -qxF -- "$line" "$CLAIMED" 2>/dev/null; then
    :                                         # version déjà réclamée à côté
  else
    printf '%s\n' "$line" >> "$NEW"
  fi
done < "$CUR"
# Les lignes de .owns absentes de CUR (fichier redevenu propre : committé ou
# annulé) disparaissent d'elles-mêmes, .owns étant reconstruit ici.
mv -f "$NEW" "$OWNS" 2>/dev/null || rm -f "$NEW"
mv -f "$CUR" "$SNAP" 2>/dev/null || rm -f "$CUR"
rm -f "$CLAIMED" "$MINEPATHS" "$WROTE"
exit 0
