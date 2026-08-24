#!/bin/bash
# ════════════════════════════════════════════════════════════════════════════
#  deploy-ref.sh — déployer un COMMIT précis, pas le répertoire de travail
# ════════════════════════════════════════════════════════════════════════════
# `vercel --prod` téléverse le répertoire local TEL QUEL (outputDirectory "."
# dans vercel.json, cf. la section .vercelignore de CLAUDE.md) : ce n'est pas
# un déploiement git. Isoler proprement son commit ne suffit donc PAS à
# isoler son déploiement — tout ce qu'une session concurrente a laissé
# d'inachevé dans le dossier partirait en production avec.
#
# On déploie donc depuis un worktree jetable placé exactement sur le commit
# voulu. Le répertoire de travail principal n'est jamais touché.
#
# Usage :  .claude/deploy-ref.sh [ref]        (défaut : HEAD)
#
# Attention : ce qui n'est pas dans le commit n'est PAS déployé. Avant de
# l'utiliser, vérifier que la production ne fait pas déjà tourner du code
# jamais committé (`curl -s https://todo.hugues.app/js/modules/version.js`
# comparé à `git show HEAD:js/modules/version.js`) — sinon ce déploiement
# le ferait silencieusement disparaître.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
REF="${1:-HEAD}"
SHA=$(git rev-parse --short "$REF^{commit}")
DIR=".claude/worktrees/deploy-$SHA"

cleanup() { git worktree remove --force "$DIR" >/dev/null 2>&1 || true; }
cleanup                       # reste d'un run précédent interrompu
trap cleanup EXIT

git worktree add --detach "$DIR" "$SHA" >/dev/null
# .vercel/ est gitignoré (projectId/orgId) : sans lui la CLI ne sait pas quelle
# cible viser et voudrait relier un nouveau projet.
cp -R .vercel "$DIR/.vercel"

echo "── déploiement de $SHA : $(git log -1 --format=%s "$SHA") ──"
( cd "$DIR" && vercel --prod --yes )
