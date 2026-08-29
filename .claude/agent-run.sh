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

# Le modèle de l'agent est FIXÉ ICI, jamais laissé au défaut global de Claude
# Code (~/.claude/settings.json). Sans ce drapeau, chaque invocation héritait de
# `"model": "opus"` — et comme le protocole lance UNE invocation par tâche, dont
# chacune relit CLAUDE.md en entier, un passage de 3 tâches payait trois fois
# une mise en contexte d'Opus. C'est ce qui a vidé le quota deux jours de suite
# (2026-08-28 et 29 : « You're out of extra usage », deux passages morts sans
# rien accomplir). Le travail de l'agent — éditer des fichiers en suivant un
# protocole écrit — n'a pas besoin d'Opus. Surchargeable ponctuellement sans
# toucher au script : AGENT_MODEL=opus .claude/agent-run.sh
AGENT_MODEL="${AGENT_MODEL:-sonnet}"
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

# Nombre de tâches annoncé dans la notification de départ.
COUNT=$(printf '%s' "$STATE" | sed -n 's/.*"count":\([0-9]*\).*/\1/p')
notify() { "$REPO/.claude/notify.sh" "$1" >/dev/null 2>&1 || true; }

notify "▶ 2FŨKOI — passage démarré
${COUNT:-?} tâche(s) marquée(s) · autonomie $(printf '%s' "$STATE" | sed -n 's/.*"autonomy":"\([a-z]*\)".*/\1/p')"

# UNE INVOCATION PAR TÂCHE, et c'est le seul moyen d'avoir des chiffres honnêtes
# par tâche : `claude -p --output-format json` ne rapporte son temps et ses
# jetons que pour l'invocation entière. Un seul appel pour tout le lot ne
# donnerait qu'un total, et le répartir entre les tâches au prorata du temps
# serait inventer un chiffre. Bénéfice secondaire : une tâche qui explose
# n'emporte plus les suivantes.
#
# Le prix à payer est réel : chaque invocation relit CLAUDE.md et le contexte du
# dépôt, donc les jetons d'entrée sont payés autant de fois qu'il y a de tâches.
# C'est assumé — maxPerRun est plafonné à 5.
IDS=$(printf '%s' "$STATE" | python3 -c 'import json,sys; print("\n".join(t["id"] for t in json.load(sys.stdin)["tasks"]))' 2>/dev/null)
TITLES=$(printf '%s' "$STATE" | python3 -c 'import json,sys; print("\n".join(t["title"].replace("\n"," ") for t in json.load(sys.stdin)["tasks"]))' 2>/dev/null)

CODE=0
FAILED=false
TAIL=""
N=0
while IFS= read -r TASK_ID; do
  [ -n "$TASK_ID" ] || continue
  N=$((N + 1))
  TITLE=$(printf '%s' "$TITLES" | sed -n "${N}p")
  echo "── tâche $N : $TASK_ID — $TITLE"

  OUT=$(mktemp)
  # --permission-mode bypassPermissions est inévitable pour un agent sans
  # personne devant l'écran : il ne peut répondre à aucune demande
  # d'autorisation. --max-budget-usd borne la casse par tâche.
  claude -p "/inbox-run $TASK_ID" \
    --model "$AGENT_MODEL" \
    --permission-mode bypassPermissions \
    --max-budget-usd 5 \
    --output-format json > "$OUT" 2>&1
  RC=$?

  # Le JSON de résultat porte durée, jetons et coût réels de CETTE invocation.
  METRIC=$(python3 - "$OUT" "$TASK_ID" "$TITLE" "$RC" <<'PYM'
import json, sys
path, tid, title, rc = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
raw = open(path, encoding='utf-8', errors='replace').read()
d = {}
# La sortie peut contenir du bruit avant le JSON : on prend le dernier objet.
for line in reversed(raw.strip().splitlines()):
    line = line.strip()
    if line.startswith('{'):
        try: d = json.loads(line); break
        except Exception: continue
u = d.get('usage') or {}
print(json.dumps({'taskMetric': {
    'id': tid, 'title': title[:120],
    'seconds': round((d.get('duration_ms') or 0) / 1000),
    'tokensIn': (u.get('input_tokens') or 0) + (u.get('cache_read_input_tokens') or 0),
    'tokensOut': u.get('output_tokens') or 0,
    'costUsd': round(d.get('total_cost_usd') or 0, 4),
    'ok': rc == 0 and d.get('subtype') == 'success',
}}, ensure_ascii=False))
PYM
)
  echo "   $(printf '%s' "$METRIC" | python3 -c 'import json,sys; m=json.load(sys.stdin)["taskMetric"]; print("%ss · %s jetons entrée / %s sortie · %s $" % (m["seconds"], m["tokensIn"], m["tokensOut"], m["costUsd"]))' 2>/dev/null)"
  "$REPO/.claude/todo-api.sh" report "$METRIC" >/dev/null 2>&1 || true

  # Un quota épuisé s'imprime sans forcément faire échouer le processus.
  if [ "$RC" -ne 0 ] || grep -qiE "out of extra usage|usage limit|rate limit|quota|not authenticated|invalid api key" "$OUT"; then
    CODE=$RC; FAILED=true
    TAIL=$(tail -4 "$OUT" | tr '\n' ' ' | sed 's/  */ /g' | cut -c1-300)
    rm -f "$OUT"
    echo "   arrêt du lot : la cause vaut aussi pour les tâches suivantes"
    break
  fi
  rm -f "$OUT"
done <<< "$IDS"

if [ "$FAILED" = true ]; then
  echo "ÉCHEC (code $CODE) : $TAIL"
  notify "⚠ 2FŨKOI — passage échoué (code $CODE)
$TAIL"
else
  notify "✔ 2FŨKOI — passage terminé"
fi

# Un passage interrompu (quota, plantage, machine endormie) n'atteint jamais sa
# propre étape de nettoyage et laisse son worktree derrière lui. Comme launchd
# ne fait jamais tourner deux instances de ce job à la fois, tout worktree
# d'agent encore présent ICI est forcément mort.
for wt in "$REPO"/.claude/worktrees/agent-*; do
  [ -d "$wt" ] || continue
  echo "nettoyage du worktree orphelin : $(basename "$wt")"
  git -C "$REPO" worktree remove --force "$wt" 2>/dev/null || rm -rf "$wt"
done
git -C "$REPO" worktree prune 2>/dev/null

echo "── fin ($(date '+%H:%M:%S')) ──"
