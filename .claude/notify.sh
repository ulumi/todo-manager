#!/bin/bash
# ════════════════════════════════════════════════════════
#  Notification Telegram de l'agent d'Inbox
# ════════════════════════════════════════════════════════
#
# Usage : .claude/notify.sh "message"
#
# Les identifiants vivent HORS du dépôt (~/.2fukoi-telegram), pour la même
# raison que le jeton d'API : `vercel --prod` téléverse le dossier tel quel,
# gitignoré ou non, et ce dépôt est public. Format attendu, deux lignes :
#
#   BOT_TOKEN=123456789:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
#   CHAT_ID=987654321
#
# Obtenir les deux :
#   1. Sur Telegram, parler à @BotFather → /newbot → il renvoie le BOT_TOKEN.
#   2. Écrire un message quelconque à son propre bot, puis :
#      curl -s "https://api.telegram.org/bot<TOKEN>/getUpdates" | grep -o '"id":[0-9]*'
#      → le premier nombre est le CHAT_ID.
#
# ⚠ Ce script ne DOIT jamais faire échouer un passage. Sans configuration, sans
# réseau, ou si Telegram répond une erreur, il sort en 0 sans rien dire : une
# notification manquée n'est pas une raison d'interrompre un travail qui, lui,
# se passe bien. C'est le seul endroit du projet où avaler une erreur est le bon
# comportement — partout ailleurs, un échec silencieux est un bug.

CONF="${TELEGRAM_CONF:-$HOME/.2fukoi-telegram}"
MSG="${1:-}"

[ -n "$MSG" ] || exit 0
[ -f "$CONF" ] || exit 0

BOT_TOKEN=""; CHAT_ID=""
# shellcheck disable=SC1090
while IFS='=' read -r k v; do
  case "$k" in
    BOT_TOKEN) BOT_TOKEN="$v" ;;
    CHAT_ID)   CHAT_ID="$v" ;;
  esac
done < "$CONF"

[ -n "$BOT_TOKEN" ] && [ -n "$CHAT_ID" ] || exit 0

# --data-urlencode : les comptes rendus contiennent des retours à la ligne, des
# accents et des caractères réservés d'URL. -m 10 : un Telegram lent ne doit pas
# retarder le passage.
curl -sS -m 10 -o /dev/null \
  -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${CHAT_ID}" \
  --data-urlencode "text=${MSG}" \
  --data-urlencode "disable_web_page_preview=true" \
  2>/dev/null

exit 0
