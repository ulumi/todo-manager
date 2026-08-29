#!/bin/bash
# ════════════════════════════════════════════════════════
#  Configuration Telegram de l'agent d'Inbox
# ════════════════════════════════════════════════════════
#
#   .claude/setup-telegram.sh
#
# Demande le jeton BotFather, trouve le chat id tout seul, écrit
# ~/.2fukoi-telegram et envoie un message de test.
#
# Ce qui reste à faire à la main AVANT (et qui ne peut pas être automatisé :
# les deux passent par un compte Telegram) :
#   1. @BotFather → /newbot → il renvoie le jeton
#   2. écrire n'importe quel message à ce nouveau bot — Telegram interdit à un
#      bot d'écrire en premier, sans ça aucun chat id n'existe
#
# Le jeton n'est jamais affiché, ni passé en argument (donc absent de
# l'historique du shell et de la liste des processus), ni écrit ailleurs que
# dans le fichier de configuration, en 600.

set -uo pipefail

CONF="${TELEGRAM_CONF:-$HOME/.2fukoi-telegram}"

printf 'Jeton BotFather (saisie masquée, colle-le puis Entrée) : '
stty -echo 2>/dev/null
read -r BT
stty echo 2>/dev/null
printf '\n'

BT=$(printf '%s' "$BT" | tr -d '[:space:]')
[ -n "$BT" ] || { echo "Aucun jeton saisi — rien de changé." >&2; exit 1; }
case "$BT" in *'<'*|*'>'*) echo "C'est le texte d'exemple, pas un vrai jeton." >&2; exit 1 ;; esac

# getMe valide le jeton avant toute écriture : un jeton fautif doit échouer ici,
# clairement, plutôt que de produire un fichier qui ne marchera jamais.
ME=$(curl -sS -m 10 "https://api.telegram.org/bot${BT}/getMe" 2>/dev/null)
case "$ME" in
  *'"ok":true'*) ;;
  *) echo "Jeton refusé par Telegram : $(printf '%s' "$ME" | cut -c1-160)" >&2; exit 1 ;;
esac
BOTNAME=$(printf '%s' "$ME" | sed -n 's/.*"username":"\([^"]*\)".*/\1/p')
echo "✓ Bot reconnu : @${BOTNAME:-?}"

# Le chat id vient du premier message que TU as envoyé au bot.
UPD=$(curl -sS -m 10 "https://api.telegram.org/bot${BT}/getUpdates" 2>/dev/null)
CI=$(printf '%s' "$UPD" | sed -n 's/.*"chat":{"id":\(-\{0,1\}[0-9]*\).*/\1/p' | head -1)
if [ -z "$CI" ]; then
  echo "Aucune conversation trouvée. Ouvre Telegram, écris un message à @${BOTNAME:-ton bot}, puis relance ce script." >&2
  exit 1
fi
echo "✓ Conversation trouvée : $CI"

umask 077
printf 'BOT_TOKEN=%s\nCHAT_ID=%s\n' "$BT" "$CI" > "$CONF"
chmod 600 "$CONF"
echo "✓ Enregistré dans $CONF"

"$(dirname "$0")/notify.sh" "✅ 2FŨKOI — Telegram configuré. C'est par ici que l'agent te donnera son avancement."
echo "✓ Message de test envoyé — regarde ton Telegram."
