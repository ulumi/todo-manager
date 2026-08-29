#!/bin/bash
# ════════════════════════════════════════════════════════
#  Client de l'API 2FŨKOI pour l'agent d'Inbox
# ════════════════════════════════════════════════════════
#
# ⚠ Le jeton donne un accès EN ÉCRITURE à toutes les tâches, et ce dépôt est
# PUBLIC. Il ne vit donc jamais ici : ni dans ce fichier, ni ailleurs sous le
# dépôt, même gitignoré (`vercel --prod` téléverse le dossier TEL QUEL — c'est
# comme ça qu'un identifiant Firebase gitignoré s'est retrouvé téléchargeable
# en production, cf. .vercelignore dans CLAUDE.md). Il est lu depuis
# ~/.2fukoi-token, hors du dépôt, ou depuis $TODO_TOKEN.
#
# À récupérer dans l'app : menu ☰ → Réglages → API & Claude → Copier le jeton.
#   printf '%s' '<jeton>' > ~/.2fukoi-token && chmod 600 ~/.2fukoi-token
#
# Usage :
#   .claude/todo-api.sh agent                 # réglages + file de travail
#   .claude/todo-api.sh report '{"done":1,"skipped":0,"note":"…"}'
#   .claude/todo-api.sh tasks inbox           # liste brute
#   .claude/todo-api.sh patch '{"task":"…","description":"…"}'
#
# Sort en code 2 si le jeton manque, 1 si l'API répond une erreur — jamais
# silencieusement, sinon l'agent croirait avoir une liste vide alors qu'il n'a
# simplement pas pu la lire, et conclurait « rien à faire ».

set -euo pipefail

BASE="${TODO_API_BASE:-https://todo.hugues.app}"
TOKEN_FILE="${TODO_TOKEN_FILE:-$HOME/.2fukoi-token}"

if [ -n "${TODO_TOKEN:-}" ]; then
  TOKEN="$TODO_TOKEN"
elif [ -f "$TOKEN_FILE" ]; then
  TOKEN="$(tr -d '[:space:]' < "$TOKEN_FILE")"
else
  echo "todo-api: aucun jeton — pose-le dans $TOKEN_FILE (Réglages → API & Claude)." >&2
  exit 2
fi
[ -n "$TOKEN" ] || { echo "todo-api: $TOKEN_FILE est vide." >&2; exit 2; }

# --fail-with-body : un 4xx/5xx doit rester lisible (le corps porte le message
# d'erreur de l'API) tout en donnant un code de sortie non nul.
req() {
  local method="$1" url="$2" body="${3:-}"
  local args=(-sS --fail-with-body -X "$method" -H "Authorization: Bearer $TOKEN")
  [ -n "$body" ] && args+=(-H 'Content-Type: application/json' -d "$body")
  curl "${args[@]}" "$BASE$url"
}

cmd="${1:-agent}"
case "$cmd" in
  agent)  req GET  "/api/agent" ;;
  report) req POST "/api/agent" "${2:?corps JSON attendu}" ;;
  tasks)  req GET  "/api/tasks?scope=${2:-inbox}" ;;
  patch)  req PATCH "/api/tasks" "${2:?corps JSON attendu}" ;;
  *)      echo "todo-api: commande inconnue « $cmd » (agent|report|tasks|patch)" >&2; exit 64 ;;
esac
