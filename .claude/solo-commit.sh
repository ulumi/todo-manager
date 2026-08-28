#!/bin/bash
# ════════════════════════════════════════════════════════════════════════════
#  solo-commit.sh — committer SEULEMENT le travail de cette session
# ════════════════════════════════════════════════════════════════════════════
# Hugues ouvre parfois plusieurs sessions Claude Code sur ce repo en même
# temps. Un `git add -A` embarque alors le travail INACHEVÉ de l'autre session
# dans un commit dont le message ne décrit que le nôtre — et l'inverse
# (`git checkout HEAD -- fichier`, on rejoue ses éditions, on restaure) est
# pire encore : l'autre session écrit EN DIRECT, la restauration écraserait
# ce qu'elle a écrit entre-temps.
#
# Ce script construit le commit dans un index TEMPORAIRE : il ne lit ni
# n'écrit jamais le répertoire de travail. L'autre session ne voit rien
# bouger sous elle.
#
# Usage :
#   .claude/solo-commit.sh -m <fichier-message> [-p <parent>] \
#       [-w <chemin-repo>]... [-s <chemin-repo>=<fichier-contenu>]...
#
#   -m  fichier contenant le message de commit (sujet + corps + trailer)
#   -p  commit parent (défaut : HEAD). Utiliser le grand-parent pour
#       RECONSTRUIRE un commit local déjà fait mais pollué (jamais poussé).
#   -w  fichier que cette session est SEULE à avoir touché : son contenu
#       actuel du répertoire de travail est pris tel quel.
#   -d  chemin à SUPPRIMER du commit (fichier retiré, ou ancien nom d'un
#       fichier renommé : sans lui il resterait, hérité du parent).
#   -s  fichier PARTAGÉ (les deux sessions y ont écrit) : le contenu à
#       committer est fourni à part — typiquement le fichier de <parent> sur
#       lequel on a rejoué nos seules éditions. Voir « Fichier partagé »
#       dans CLAUDE.md pour le cas du SCSS, qui doit être recompilé à part.
#
#   Tout fichier non listé garde le contenu qu'il a dans <parent>.
#
# Termine par un `git reset` (mixed) : sans lui, l'index par défaut reste
# calé sur l'ancien HEAD et l'autre session voit TOUS les fichiers en « MM ».
# Ne touche aucun contenu de fichier — au pire, cela désindexe un
# `git add` que l'autre session aurait fait sans committer.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

MSG=""; PARENT="HEAD"; WT=(); SHARED=(); DEL=()
while getopts "m:p:w:s:d:" opt; do
  case "$opt" in
    m) MSG="$OPTARG" ;;
    p) PARENT="$OPTARG" ;;
    w) WT+=("$OPTARG") ;;
    s) SHARED+=("$OPTARG") ;;
    d) DEL+=("$OPTARG") ;;
    *) echo "usage: $0 -m <msgfile> [-p <parent>] [-w path]... [-s path=file]... [-d path]..." >&2; exit 2 ;;
  esac
done
[ -n "$MSG" ] && [ -f "$MSG" ] || { echo "solo-commit: -m <fichier-message> requis" >&2; exit 2; }

PARENT_SHA=$(git rev-parse --verify "$PARENT^{commit}")

IDX=$(mktemp -t solocommit); rm -f "$IDX"
export GIT_INDEX_FILE="$IDX"
trap 'rm -f "$IDX"' EXIT

git read-tree "$PARENT_SHA"

for p in ${WT[@]+"${WT[@]}"}; do
  [ -f "$p" ] || { echo "solo-commit: -w $p introuvable" >&2; exit 1; }
  git update-index --add -- "$p"
done

# Suppressions (fichier retiré ou renommé — sans ça l'ancien chemin, hérité du
# parent, survivrait au commit à côté du nouveau).
for p in ${DEL[@]+"${DEL[@]}"}; do
  git update-index --force-remove -- "$p"
done

for pair in ${SHARED[@]+"${SHARED[@]}"}; do
  path="${pair%%=*}"; src="${pair#*=}"
  [ -f "$src" ] || { echo "solo-commit: -s source $src introuvable" >&2; exit 1; }
  mode=$(git ls-files --stage -- "$path" | awk '{print $1}'); mode=${mode:-100644}
  blob=$(git hash-object -w -- "$src")
  git update-index --add --cacheinfo "$mode,$blob,$path"
done

TREE=$(git write-tree)
COMMIT=$(git commit-tree "$TREE" -p "$PARENT_SHA" -F "$MSG")

BRANCH=$(git symbolic-ref --quiet HEAD || echo "HEAD")
git update-ref "$BRANCH" "$COMMIT"

unset GIT_INDEX_FILE
git reset -q

echo "── commit $(git rev-parse --short HEAD) sur ${BRANCH#refs/heads/} ─────────────"
git show --stat --oneline HEAD | tail -n +1
echo
echo "── reste au répertoire de travail (autre session) ───────────────"
git status --short
