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

# Garde-fou contre les valeurs d'exemple laissées telles quelles (« <jeton> »,
# « <id> ») : c'est l'erreur naturelle quand on colle une commande d'installation
# sans la substituer, et sans ce contrôle le script resterait muet POUR TOUJOURS
# sans jamais dire pourquoi. Le message part sur stderr, donc dans le log du
# runner — visible sans jamais faire échouer un passage.
case "$BOT_TOKEN$CHAT_ID" in
  *'<'*|*'>'*)
    echo "notify: $CONF contient encore les valeurs d'exemple — remplace-les par le vrai jeton et le vrai chat id." >&2
    exit 0 ;;
esac

# --data-urlencode : les comptes rendus contiennent des retours à la ligne, des
# accents et des caractères réservés d'URL. -m 10 : un Telegram lent ne doit pas
# retarder le passage.
RESP=$(curl -sS -m 10 \
  -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${CHAT_ID}" \
  --data-urlencode "text=${MSG}" \
  --data-urlencode "disable_web_page_preview=true" \
  2>/dev/null)

# Telegram refuse en répondant 200 avec {"ok":false,...} : un jeton faux, un
# chat id faux ou un bot à qui on n'a jamais écrit passent donc inaperçus si on
# ne lit pas le corps. Signalé sur stderr (log du runner), jamais en échec.
case "$RESP" in
  *'"ok":true'*) ;;
  '') echo "notify: Telegram injoignable (réseau ?)" >&2 ;;
  *)  echo "notify: Telegram a refusé — $(printf '%s' "$RESP" | cut -c1-160)" >&2 ;;
esac

exit 0
