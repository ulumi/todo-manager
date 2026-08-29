#!/bin/bash
# ════════════════════════════════════════════════════════
#  Point d'entrée de l'agent d'Inbox (appelé par launchd)
# ════════════════════════════════════════════════════════
#
# Lance `/inbox-run` en headless. Toute la logique est dans
# .claude/commands/inbox-run.md — ce script ne fait que poser un
# environnement utilisable et journaliser.
#
# Installation du déclencheur : voir la fin de .claude/commands/inbox-run.md
# et le plist livré à côté. Rien ne s'exécute tant que l'interrupteur du
# panneau Inbox est coupé : le premier geste de /inbox-run est de lire
# `GET /api/agent` et de s'arrêter net si `enabled` est faux. C'est voulu —
# couper l'agent depuis le téléphone doit suffire, sans toucher au cron.

set -uo pipefail

REPO="/Users/hugues/Desktop/Projects/todo/todo-manager"
LOG="$HOME/Library/Logs/2fukoi-agent.log"

# launchd ne charge aucun profil : sans ça, ni claude, ni node, ni npx, ni
# vercel ne sont trouvables, et le passage échouerait pour une raison qui
# n'a rien à voir avec les tâches.
export PATH="$HOME/.local/bin:$HOME/.nvm/versions/node/v24.14.1/bin:/opt/local/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

mkdir -p "$(dirname "$LOG")"
exec >> "$LOG" 2>&1
echo "──────── $(date '+%Y-%m-%d %H:%M:%S') ────────"

cd "$REPO" || { echo "dépôt introuvable : $REPO"; exit 1; }

# Sortie silencieuse et sans coût si le jeton n'est pas posé : inutile de
# réveiller un modèle pour lui faire constater qu'il ne peut rien lire.
if [ ! -f "${TODO_TOKEN_FILE:-$HOME/.2fukoi-token}" ] && [ -z "${TODO_TOKEN:-}" ]; then
  echo "jeton absent — passage ignoré"
  exit 0
fi

# Même chose pour l'interrupteur : on interroge l'API AVANT de lancer Claude.
# Le modèle refait ce contrôle de son côté (il pourrait être appelé à la main),
# mais le faire ici évite d'ouvrir une session complète pour rien à chaque
# déclenchement alors que l'agent est coupé — c'est-à-dire la plupart du temps.
STATE="$("$REPO/.claude/todo-api.sh" agent 2>/dev/null)" || { echo "API injoignable — passage ignoré"; exit 0; }
case "$STATE" in
  *'"enabled":true'*) ;;
  *) echo "agent désactivé — passage ignoré"; exit 0 ;;
esac
case "$STATE" in
  *'"count":0'*) echo "aucune tâche marquée — passage ignoré"; exit 0 ;;
esac

# « Sur demande » : rien ne part sans un clic sur « Lancer maintenant » dans le
# panneau de l'Inbox. C'est le mode par défaut — une tâche qu'on vient
# d'étiqueter ne doit pas déclencher un déploiement deux minutes plus tard
# sans que personne ne l'ait voulu maintenant.
REQUESTED=false
case "$STATE" in *'"runRequested":true'*) REQUESTED=true ;; esac
case "$STATE" in
  *'"trigger":"auto"'*) ;;
  *) if [ "$REQUESTED" != true ]; then echo "mode sur demande, aucune demande en attente — passage ignoré"; exit 0; fi ;;
esac

# Réclamer AVANT de travailler : si le passage échoue, la demande est déjà
# consommée et le suivant ne repart pas en boucle sur le même clic.
if [ "$REQUESTED" = true ]; then
  "$REPO/.claude/todo-api.sh" claim >/dev/null 2>&1 || echo "(demande non réclamée — on continue)"
fi

echo "réglages : $STATE"

# --permission-mode bypassPermissions est inévitable pour un agent sans
# personne devant l'écran : il ne peut répondre à aucune demande d'autorisation.
# --max-budget-usd borne la casse si un passage part en boucle.
claude -p "/inbox-run" \
  --permission-mode bypassPermissions \
  --max-budget-usd 5 \
  --output-format text

echo "── fin ($(date '+%H:%M:%S')) ──"
