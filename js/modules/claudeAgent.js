// ════════════════════════════════════════════════════════
//  Agent Claude Code — réglages + panneau de l'Inbox
// ════════════════════════════════════════════════════════
//
// L'agent est un Claude Code headless qui tourne sur la machine de Hugues
// (launchd → `.claude/commands/inbox-run.md`). Il ramasse dans l'Inbox les
// tâches portant une étiquette repère, les réalise dans le dépôt, écrit son
// compte rendu dans les notes de la tâche, la date sur aujourd'hui puis la
// coche. Ce fichier ne fait PAS tourner l'agent : il porte le contrat de
// configuration entre les trois endroits qui doivent s'accorder dessus —
// l'app (ce panneau), la ligne Supabase (`config.claudeAgent`), et l'agent
// lui-même, qui les lit par `GET /api/agent`.
//
// ⚠ La moitié « config » de ce module est PURE (aucun accès DOM ni
// localStorage au chargement) : `api/_agent.js` l'importe côté serveur,
// exactement comme `_todo-store.js` importe calendar.js — une seconde
// définition des valeurs par défaut dériverait de celle-ci au premier
// changement, et l'agent tournerait alors avec des réglages qui ne sont pas
// ceux affichés à l'écran. Tout ce qui touche au navigateur reste dans une
// fonction, jamais au niveau du module.

import { esc } from './utils.js';

export const AGENT_KEY = 'claudeAgent';

// Volontairement `enabled: false` : rien ne s'exécute tant que Hugues n'a pas
// armé l'interrupteur lui-même. Un agent qui écrit du code et déploie ne
// s'active pas par défaut au premier déploiement qui l'introduit.
export const AGENT_DEFAULTS = {
  enabled:      false,
  categoryName: 'claude-code',
  autonomy:     'deploy',
  trigger:      'manual',
  maxPerRun:    3,
  lastRun:      null,
  runRequest:   null,
  progress:     null,
};

// Champs que SEUL le serveur écrit : l'agent les publie pendant qu'il
// travaille, le navigateur ne fait que les afficher. `getAppConfig()`
// (storage.js) les retire de ce qu'il téléverse — sans quoi une copie périmée
// du localStorage viendrait écraser la progression réelle une seconde après
// que l'agent l'a écrite. C'est le bug qu'avait déjà causé `runRequest`.
export const SERVER_OWNED_FIELDS = ['runRequest', 'progress'];

// Au-delà, une progression n'est plus « en cours » mais un vestige : un
// passage tué net (quota, plantage) laisse sa dernière ligne derrière lui, et
// l'afficher indéfiniment comme vivante serait mentir.
export const PROGRESS_STALE_MS = 10 * 60 * 1000;

export function liveProgress(cfg, now = Date.now()) {
  const p = cfg?.progress;
  if (!p || !Number.isFinite(p.at) || (now - p.at) >= PROGRESS_STALE_MS) return null;
  return p;
}

// Le runner se réveille toutes les 2 minutes : au pire, un passage demandé
// démarre à cet horizon. C'est une BORNE, pas une prédiction — la page ne peut
// pas connaître la phase du minuteur de launchd, et l'annoncer comme exacte
// serait inventer une information.
export const WAKE_INTERVAL_MS = 120 * 1000;

export function wakeDeadline(cfg) {
  const at = cfg?.runRequest?.at;
  return Number.isFinite(at) ? at + WAKE_INTERVAL_MS : null;
}

export const TRIGGERS = [
  { value: 'manual', label: 'Sur demande',  hint: 'ne part que quand tu appuies sur « Lancer maintenant »' },
  { value: 'auto',   label: 'Automatique',  hint: 'part de lui-même dès qu\'une tâche porte l\'étiquette' },
];

// Une demande de passage périmée ne doit pas déclencher un travail que
// personne n'attend plus — un clic d'hier soir ne réveille pas l'agent au
// prochain démarrage du Mac.
export const RUN_REQUEST_TTL_MS = 15 * 60 * 1000;

export function isRunRequestPending(cfg, now = Date.now()) {
  const at = cfg?.runRequest?.at;
  return Number.isFinite(at) && (now - at) < RUN_REQUEST_TTL_MS;
}

// Le runner se réveille toutes les 2 min et réclame la demande AVANT de
// travailler. Une demande encore là au bout de trois minutes n'est donc pas
// « en cours de départ » : personne ne l'a ramassée, et la seule explication
// est qu'aucun runner ne tourne sur cette machine. C'est une PREUVE, pas une
// supposition — d'où l'absence de heartbeat, qui aurait coûté une écriture de
// ligne complète toutes les deux minutes (cf. l'egress dans CLAUDE.md) pour
// une information qu'on tient déjà gratuitement.
export const RUN_REQUEST_GRACE_MS = 3 * 60 * 1000;

export function isRunRequestStranded(cfg, now = Date.now()) {
  // Une progression fraîche prouve que l'agent est vivant : quoi qu'il arrive
  // au drapeau de demande, il ne faut alors surtout pas annoncer qu'il est
  // absent.
  if (liveProgress(cfg, now)) return false;
  const at = cfg?.runRequest?.at;
  return Number.isFinite(at) && (now - at) >= RUN_REQUEST_GRACE_MS && (now - at) < RUN_REQUEST_TTL_MS;
}

export const AUTONOMY_LEVELS = [
  { value: 'deploy', label: 'Déployer',  hint: 'commit, push sur master et mise en production' },
  { value: 'master', label: 'Pousser',   hint: 'commit et push sur master, aucune mise en production' },
  { value: 'branch', label: 'Brancher',  hint: 'commit sur une branche dédiée, rien sur master' },
];

export const MAX_PER_RUN_LIMIT = 5;

// Point d'entrée unique de la validation, partagé par l'app et le serveur.
// Tout ce qui arrive ici est potentiellement du JSON écrit par une version
// plus ancienne (ou plus récente) de l'app, donc chaque champ est ramené de
// force dans son domaine plutôt que recopié tel quel.
export function normalizeAgentConfig(raw) {
  const src = (raw && typeof raw === 'object') ? raw : {};
  const name = String(src.categoryName ?? '').trim();
  const max  = Number(src.maxPerRun);
  return {
    enabled:      src.enabled === true,
    categoryName: name || AGENT_DEFAULTS.categoryName,
    autonomy:     AUTONOMY_LEVELS.some(a => a.value === src.autonomy) ? src.autonomy : AGENT_DEFAULTS.autonomy,
    trigger:      TRIGGERS.some(t => t.value === src.trigger) ? src.trigger : AGENT_DEFAULTS.trigger,
    maxPerRun:    Number.isFinite(max) ? Math.min(MAX_PER_RUN_LIMIT, Math.max(1, Math.round(max))) : AGENT_DEFAULTS.maxPerRun,
    lastRun:      normalizeRun(src.lastRun),
    runRequest:   Number.isFinite(Number(src.runRequest?.at)) && Number(src.runRequest.at) > 0 ? { at: Number(src.runRequest.at) } : null,
    progress:     normalizeProgress(src.progress),
  };
}

function normalizeProgress(p) {
  if (!p || typeof p !== 'object') return null;
  const at = Number(p.at);
  const text = String(p.text ?? '').trim();
  if (!Number.isFinite(at) || at <= 0 || !text) return null;
  return { at, text: text.slice(0, 300) };
}

function normalizeRun(r) {
  if (!r || typeof r !== 'object') return null;
  const at = Number(r.at);
  if (!Number.isFinite(at) || at <= 0) return null;
  return {
    at,
    done:    Math.max(0, Number(r.done)    || 0),
    skipped: Math.max(0, Number(r.skipped) || 0),
    note:    String(r.note ?? '').slice(0, 500),
  };
}

// La valeur vit en localStorage sous forme de CHAÎNE JSON, comme agendaPrefs
// et focusQueueView — c'est ce que `getAppConfig()` (storage.js) téléverse, et
// donc ce que le serveur relit. Jamais un objet : il ne survivrait pas à
// l'aller-retour `localStorage.setItem`.
export function parseAgentConfig(stringOrObject) {
  if (typeof stringOrObject === 'string') {
    try { return normalizeAgentConfig(JSON.parse(stringOrObject)); }
    catch { return normalizeAgentConfig(null); }
  }
  return normalizeAgentConfig(stringOrObject);
}

export function serializeAgentConfig(cfg) {
  return JSON.stringify(normalizeAgentConfig(cfg));
}

// ─── Côté navigateur ───────────────────────────────────────────────────────

export function getAgentConfig() {
  return parseAgentConfig(localStorage.getItem(AGENT_KEY));
}

// Renvoie la config normalisée APRÈS écriture, pour que l'appelant affiche
// exactement ce qui a été enregistré plutôt que ce qu'il croyait envoyer.
export function saveAgentConfig(patch) {
  const next = normalizeAgentConfig({ ...getAgentConfig(), ...patch });
  localStorage.setItem(AGENT_KEY, JSON.stringify(next));
  return next;
}

// ─── Éligibilité ───────────────────────────────────────────────────────────

// Une tâche est pour l'agent si elle est dans l'Inbox (ponctuelle, sans date,
// hors Backlog, ni faite ni annulée) ET qu'elle porte l'étiquette repère.
// Pure et partagée avec `api/_agent.js` : « ce que le panneau annonce comme
// éligible » et « ce que l'agent ira réellement chercher » ne peuvent pas
// diverger.
export function isAgentTask(t, categoryId) {
  if (!categoryId) return false;
  if (t.recurrence && t.recurrence !== 'none') return false;
  if (t.date || t.backlog || t.completed || t.cancelled) return false;
  const ids = Array.isArray(t.categoryIds) ? t.categoryIds : (t.categoryId ? [t.categoryId] : []);
  return ids.includes(categoryId);
}

export function findAgentCategory(categories, name) {
  const wanted = String(name || '').trim().toLowerCase();
  if (!wanted) return null;
  return (categories || []).find(c => String(c.name || '').trim().toLowerCase() === wanted) || null;
}

export function agentEligible(todos, categories, cfg) {
  const cat = findAgentCategory(categories, cfg.categoryName);
  if (!cat) return { category: null, tasks: [] };
  return { category: cat, tasks: (todos || []).filter(t => isAgentTask(t, cat.id)) };
}

// ─── Panneau de l'Inbox ────────────────────────────────────────────────────

const ICON = {
  bot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4"/><circle cx="12" cy="3" r="1.4"/><path d="M9 13.5v1"/><path d="M15 13.5v1"/><path d="M9.5 17.5h5"/></svg>',
  chevron: '<svg class="agent-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
  tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4 12 22l-9-9V4h9l8.6 8.6a1.9 1.9 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.3"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polygon points="7 4 20 12 7 20 7 4"/></svg>',
};

const PANEL_OPEN_KEY = 'claudeAgentPanelOpen';
export const isAgentPanelOpen = () => localStorage.getItem(PANEL_OPEN_KEY) === '1';
export const setAgentPanelOpen = open => localStorage.setItem(PANEL_OPEN_KEY, open ? '1' : '0');

function agoLabel(ts) {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1)  return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const h = Math.round(mins / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return `il y a ${d} j`;
}

export function agentPanelHTML(todos, categories) {
  const cfg = getAgentConfig();
  const { category, tasks } = agentEligible(todos, categories, cfg);
  const open = isAgentPanelOpen();

  const state = !cfg.enabled ? 'Désactivé'
    : !category               ? "Étiquette introuvable"
    : tasks.length            ? `${tasks.length} tâche${tasks.length > 1 ? 's' : ''} en attente`
    : 'Actif — rien à faire';

  const autonomy = AUTONOMY_LEVELS.map(a => `
    <button class="agent-seg-opt${cfg.autonomy === a.value ? ' active' : ''}"
            onclick="window.app.setClaudeAgentField('autonomy','${a.value}')"
            title="${esc(a.hint)}">${esc(a.label)}</button>`).join('');

  // L'étiquette est le SEUL critère d'éligibilité : sans elle, rien ne peut
  // être ramassé — d'où l'avertissement plutôt qu'un panneau d'apparence
  // fonctionnelle qui ne ferait jamais rien.
  const tagBlock = category
    ? `<span class="agent-tag-chip" style="--tag:${esc(category.color || 'var(--primary)')}">${ICON.tag}${esc(category.name)}</span>`
    : `<div class="agent-warn">${ICON.warn}
         <span>Aucune étiquette « ${esc(cfg.categoryName)} » n'existe — l'agent ne peut rien ramasser.</span>
         <button class="btn btn-ghost agent-mini-btn" onclick="window.app.createClaudeAgentCategory()">Créer l'étiquette</button>
       </div>`;

  const triggers = TRIGGERS.map(x => `
    <button class="agent-seg-opt${cfg.trigger === x.value ? ' active' : ''}"
            onclick="window.app.setClaudeAgentField('trigger','${x.value}')"
            title="${esc(x.hint)}">${esc(x.label)}</button>`).join('');

  // Le bouton ne LANCE rien : une page web ne peut pas démarrer un processus
  // sur la machine (même frontière de bac à sable que le son des autres
  // onglets, qui a imposé une extension). Il dépose une demande que le runner
  // local ramasse à son prochain réveil — d'où le libellé d'attente, qui dit
  // la vérité plutôt que de faire croire à un démarrage immédiat.
  const pending  = isRunRequestPending(cfg);
  const stranded = isRunRequestStranded(cfg);
  const blocked  = !cfg.enabled ? "l'agent est désactivé"
                 : !category    ? "l'étiquette n'existe pas"
                 : !tasks.length ? 'aucune tâche marquée'
                 : null;

  // Une demande restée sur le carreau ne doit pas continuer à annoncer un
  // départ imminent : c'est le seul moment où l'app apprend que le runner
  // local n'est pas installé, autant le dire là plutôt que laisser Hugues
  // attendre quelque chose qui ne viendra pas.
  const strandedBlock = stranded ? `
      <div class="agent-warn agent-warn--stranded">${ICON.warn}
        <span>Personne n'a réclamé cette demande. Soit le runner local n'est pas installé sur cette machine, soit il ne tourne plus — sans lui, le bouton ne peut rien déclencher.</span>
        <code class="agent-cmd">launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/app.hugues.2fukoi-agent.plist</code>
      </div>` : '';

  const runBlock = `
    <div class="agent-run-row">
      <button class="agent-run-btn${pending && !stranded ? ' is-pending' : ''}" ${blocked ? 'disabled' : ''}
              onclick="window.app.runClaudeAgentNow()"
              title="${esc(blocked || 'Demander un passage immédiat')}">
        ${ICON.play}<span>${pending && !stranded ? 'Passage demandé' : 'Lancer maintenant'}</span>
      </button>
      <span class="agent-run-hint">${esc(blocked
        ? `Indisponible — ${blocked}.`
        : stranded
          ? "Demande en attente depuis plus de 3 min — voir ci-dessous."
          : pending
            ? "L'agent démarre à son prochain réveil (moins de 2 min)."
            : `${tasks.length} tâche${tasks.length > 1 ? 's' : ''} partira${tasks.length > 1 ? 'ient' : ''} au prochain passage.`)}</span>
    </div>
    ${strandedBlock}`;

  const eligibleList = tasks.length
    ? `<ul class="agent-eligible">${tasks.slice(0, 6).map(t => `<li>${esc(t.title)}</li>`).join('')}
       ${tasks.length > 6 ? `<li class="agent-eligible-more">+ ${tasks.length - 6} autre${tasks.length - 6 > 1 ? 's' : ''}</li>` : ''}</ul>`
    : `<p class="agent-note">Aucune tâche marquée pour l'instant. Ajoute l'étiquette à une tâche de l'Inbox pour la lui confier.</p>`;

  const lastRun = cfg.lastRun
    ? `<div class="agent-lastrun">${ICON.clock}<span><strong>${agoLabel(cfg.lastRun.at)}</strong> — ${cfg.lastRun.done} faite${cfg.lastRun.done > 1 ? 's' : ''}, ${cfg.lastRun.skipped} laissée${cfg.lastRun.skipped > 1 ? 's' : ''}${cfg.lastRun.note ? ` · ${esc(cfg.lastRun.note)}` : ''}</span></div>`
    : `<div class="agent-lastrun">${ICON.clock}<span>Jamais exécuté.</span></div>`;

  return `
  <section class="agent-panel${open ? ' open' : ''}${cfg.enabled ? ' is-on' : ''}">
    <header class="agent-panel-head" onclick="window.app.toggleClaudeAgentPanel()">
      <span class="agent-panel-icon">${ICON.bot}</span>
      <span class="agent-panel-title">
        <span class="agent-panel-name">Agent Claude Code</span>
        <span class="agent-panel-state">${esc(state)}</span>
      </span>
      <button class="agent-switch${cfg.enabled ? ' on' : ''}" role="switch" aria-checked="${cfg.enabled}"
              title="${cfg.enabled ? 'Désactiver' : 'Activer'} l'agent"
              onclick="event.stopPropagation();window.app.toggleClaudeAgent()"><span class="agent-switch-knob"></span></button>
      ${ICON.chevron}
    </header>
    <div class="agent-panel-body"><div class="agent-panel-body-inner"><div class="agent-panel-pad">

      <p class="agent-desc">À chaque passage, il prend dans l'Inbox les tâches portant l'étiquette repère, les réalise dans le dépôt, écrit ce qu'il a fait dans les <strong>notes</strong> de la tâche, la date sur aujourd'hui puis la coche.</p>
      <p class="agent-desc agent-desc--limits">Il ne touche jamais à une tâche non étiquetée, ne supprime rien, et laisse la tâche <strong>ouverte</strong> avec une note d'explication s'il n'a pas pu la finir ou la vérifier.</p>

      <div class="agent-field">
        <label class="agent-field-label">Étiquette repère</label>
        ${tagBlock}
      </div>

      <div class="agent-field">
        <label class="agent-field-label">Jusqu'où il va</label>
        <div class="agent-seg">${autonomy}</div>
        <p class="agent-note">${esc(AUTONOMY_LEVELS.find(a => a.value === cfg.autonomy).hint)}</p>
      </div>

      <div class="agent-field">
        <label class="agent-field-label">Déclenchement</label>
        <div class="agent-seg">${triggers}</div>
        <p class="agent-note">${esc(TRIGGERS.find(x => x.value === cfg.trigger).hint)}</p>
      </div>

      <div class="agent-field">
        <label class="agent-field-label">Tâches par passage</label>
        <div class="agent-stepper">
          <button class="agent-step-btn" onclick="window.app.stepClaudeAgentMax(-1)" ${cfg.maxPerRun <= 1 ? 'disabled' : ''}>−</button>
          <span class="agent-step-val">${cfg.maxPerRun}</span>
          <button class="agent-step-btn" onclick="window.app.stepClaudeAgentMax(1)" ${cfg.maxPerRun >= MAX_PER_RUN_LIMIT ? 'disabled' : ''}>+</button>
        </div>
      </div>

      <div class="agent-field">
        <label class="agent-field-label">Éligibles maintenant</label>
        ${eligibleList}
      </div>

      ${runBlock}
      ${lastRun}
    </div></div></div>
  </section>`;
}
