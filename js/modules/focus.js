// ════════════════════════════════════════════════════════
//  MODE FOCUS — plein écran, une tâche à la fois
//  File intelligente des tâches du jour, chrono géant depuis le
//  début de la tâche, compte à rebours sur durée estimée, réduction en
//  PiP, sous-tâches, compteurs. Voir app.js pour les actions (enterFocus,
//  focusComplete, focusSkip, minimizeFocus, …).
// ════════════════════════════════════════════════════════

import * as state from './state.js';
import { DS, today, esc } from './utils.js';
import { getTodosForDate, isCompleted, isCancelled } from './calendar.js';
import { getCategories } from './admin.js';
import { saveTodos } from './storage.js';

const PERIOD_RANK = { morning: 0, afternoon: 1, evening: 2 };
const PERIOD_LABEL = { morning: 'Matin', afternoon: 'Après-midi', evening: 'Soir' };

// Seuils du remplissage plein écran (ratio temps écoulé / estimé) : vert
// jusqu'à WARNING_RATIO, jaune jusqu'à DANGER_RATIO — vert + jaune couvrent
// donc l'essentiel (90 %) du temps prévu, le rouge ne marque que la toute
// fin (derniers 10 %) au lieu d'un tiers égal façon drapeau. Passé
// DANGER_RATIO : mode « urgence » (.focus-emergency) — chrono rouge
// pulsant, file « Ensuite » et métadonnées secondaires s'effacent.
const WARNING_RATIO = 0.5;
const DANGER_RATIO = 0.9;

// Ids passés via « Passer » — renvoyés en fin de file (session seulement)
let _skipped = [];
// Tâche courante épinglée : elle reste devant même si une tâche à heure
// fixe devient échue entre-temps (le bandeau propose le basculement,
// il ne l'impose jamais). Levée à la complétion / passage / report.
let _pinned = null;

export function focusResetSkipped() { _skipped = []; _pinned = null; }

export function focusMarkSkipped(id) {
  _skipped = _skipped.filter(x => x !== id);
  _skipped.push(id);
}

export function focusPin(id) {
  _skipped = _skipped.filter(x => x !== id);
  _pinned = id;
}

export function focusUnpin() { _pinned = null; }

// ── Ordre manuel de la file (drag-and-drop) ──────────────
// Persisté pour la journée (localStorage `focusManualOrder`) — prime sur
// l'ordre intelligent pour les ids connus; les nouvelles tâches suivent.
function _loadManualOrder() {
  try {
    const mo = JSON.parse(localStorage.getItem('focusManualOrder'));
    return (mo && mo.ds === DS(today())) ? mo.ids : null;
  } catch { return null; }
}

export function focusSaveManualOrder(ids) {
  localStorage.setItem('focusManualOrder', JSON.stringify({ ds: DS(today()), ids }));
}

// ── Préférences d'affichage de la file « Ensuite » ────────
// { group: 'type'|'moment'|'none', sort: 'auto'|'time'|'prio',
//   cols: '1'|'2'|'3', collapsed: boolean }
// Défaut : groupée Ponctuelles / Récurrentes, ordre intelligent, 1 colonne, repliée.
// Synchronisée via getAppConfig() / _applyBackup (clé `focusQueueView`).
export function getQueuePrefs() {
  try {
    const p = JSON.parse(localStorage.getItem('focusQueueView')) || {};
    return { group: p.group || 'type', sort: p.sort || 'auto', cols: p.cols || '1', collapsed: p.collapsed ?? true };
  } catch { return { group: 'type', sort: 'auto', cols: '1', collapsed: true }; }
}

export function saveQueuePrefs(p) {
  localStorage.setItem('focusQueueView', JSON.stringify(p));
}

function _nowHM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── File du jour ─────────────────────────────────────────
// Ordre : moments d'abord (sans moment → matin → après-midi → soir),
// et au sein d'un moment l'ordre manuel de la vue jour (dayOrder /
// punctualPeriodOrder / recurringOrder) ; sans ordre manuel, repli
// sur heure puis priorité. Les « passées » vont en fin de file.
export function getFocusQueue(app) {
  const d = today();
  const ds = DS(d);
  const prioRank = { high: 0, medium: 1, low: 2, '': 3 };

  // Ordres manuels de la vue jour, fusionnés par moment (ponctuelles puis récurrentes)
  const ppo = app.punctualPeriodOrder?.[ds] || {};
  const rec = app.recurringOrder?.[ds] || {};
  const momentOrder = {
    0: [...(app.dayOrder[ds] || []), ...(rec['daily'] || []), ...(rec['weekly'] || []), ...(rec['monthly'] || []), ...(rec['yearly'] || [])],
    1: [...(ppo['morning']   || []), ...(rec['daily-morning']   || [])],
    2: [...(ppo['afternoon'] || []), ...(rec['daily-afternoon'] || [])],
    3: [...(ppo['evening']   || []), ...(rec['daily-evening']   || [])],
  };
  const moment = t => t.dayPeriod ? (PERIOD_RANK[t.dayPeriod] ?? -1) + 1 : 0;

  const items = getTodosForDate(d, state.todos).filter(t => !isCompleted(t, d) && !isCancelled(t, d));

  const sorted = [...items].sort((a, b) => {
    const ma = moment(a), mb = moment(b);
    if (ma !== mb) return ma - mb;
    const ord = momentOrder[ma] || [];
    const ia = ord.indexOf(a.id), ib = ord.indexOf(b.id);
    if (ia !== -1 || ib !== -1) {
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    }
    if (a.startTime || b.startTime) {
      if (!a.startTime) return 1;
      if (!b.startTime) return -1;
      const c = a.startTime.localeCompare(b.startTime);
      if (c) return c;
    }
    const pa = prioRank[a.priority || ''] ?? 3, pb = prioRank[b.priority || ''] ?? 3;
    if (pa !== pb) return pa - pb;
    return a.id.localeCompare(b.id);
  });

  const active  = sorted.filter(t => !_skipped.includes(t.id));
  const skipped = sorted.filter(t => _skipped.includes(t.id))
    .sort((a, b) => _skipped.indexOf(a.id) - _skipped.indexOf(b.id));
  let queue = [...active, ...skipped];

  // Ordre manuel (drag-and-drop) : prime sur l'ordre intelligent.
  // Tri stable → les ids inconnus du manuel gardent l'ordre intelligent, après.
  const manual = _loadManualOrder();
  if (manual?.length) {
    const idx = id => { const i = manual.indexOf(id); return i === -1 ? Infinity : i; };
    queue = [...queue].sort((a, b) => {
      const ia = idx(a.id), ib = idx(b.id);
      return ia === ib ? 0 : ia - ib;
    });
  }

  // Vue + tri choisis (contrôles de la file) : un tri explicite
  // (heure / priorité) remplace l'ordre intelligent + manuel, puis le
  // regroupement s'applique en tri stable — l'ordre est conservé au
  // sein de chaque groupe. La file réelle suit ce qui est affiché.
  const prefs = getQueuePrefs();
  if (prefs.sort === 'time') {
    queue = [...queue].sort((a, b) => {
      if (!a.startTime && !b.startTime) return 0;
      if (!a.startTime) return 1;
      if (!b.startTime) return -1;
      return a.startTime.localeCompare(b.startTime);
    });
  } else if (prefs.sort === 'prio') {
    queue = [...queue].sort((a, b) =>
      (prioRank[a.priority || ''] ?? 3) - (prioRank[b.priority || ''] ?? 3));
  }
  if (prefs.group === 'type') {
    const rec = t => (t.recurrence && t.recurrence !== 'none') ? 1 : 0;
    queue = [...queue].sort((a, b) => rec(a) - rec(b));
  } else if (prefs.group === 'moment') {
    queue = [...queue].sort((a, b) => moment(a) - moment(b));
  }

  // La tâche épinglée reste en tête
  if (_pinned) {
    const i = queue.findIndex(t => t.id === _pinned);
    if (i > 0) queue.unshift(queue.splice(i, 1)[0]);
    if (i === -1) _pinned = null; // complétée/supprimée entre-temps
  }
  return queue;
}

// ── Chrono de tâche (persiste au refresh via localStorage) ──
// { taskId, startedAt (ms, si en cours), accum (sec cumulées), paused }
// Quand une NOUVELLE tâche démarre (taskId différent), reprend depuis
// t.focusTimeSpent si la tâche a déjà du temps accumulé (Échap, Passer,
// Demain, changement de tâche prioritaire — voir saveFocusProgress()) au
// lieu de repartir de zéro. Filet de sécurité : si la tâche quittée n'est
// pas passée par saveFocusProgress() avant d'être remplacée, on la
// sauvegarde ici avant d'écraser son état.
// Pour une tâche RÉCURRENTE, ce temps ne doit reprendre que s'il vient de
// l'occurrence d'AUJOURD'HUI (t.focusTimeSpentDate) — sinon un reste non
// terminé hier resterait affecté à la nouvelle occurrence du jour.
export function getTimerState(taskId) {
  let ts = null;
  try { ts = JSON.parse(localStorage.getItem('focusTimer')); } catch { /* corrompu */ }
  if (!ts || ts.taskId !== taskId) {
    if (ts) _flushProgress(ts.taskId, ts);
    const t = state.todos.find(x => x.id === taskId);
    const isRec = t?.recurrence && t.recurrence !== 'none';
    const sameDayProgress = !isRec || t?.focusTimeSpentDate === DS(today());
    const resume = sameDayProgress ? Math.max(0, Math.round(t?.focusTimeSpent || 0)) : 0;
    ts = { taskId, startedAt: Date.now(), accum: resume, paused: false };
    localStorage.setItem('focusTimer', JSON.stringify(ts));
  }
  return ts;
}

function _flushProgress(taskId, ts) {
  if (!ts || ts.taskId !== taskId) return;
  const sec = elapsedSeconds(ts);
  if (sec < 5) return; // micro-session : rien à sauvegarder
  const t = state.todos.find(x => x.id === taskId);
  if (!t) return;
  t.focusTimeSpent = Math.round(sec);
  t.focusTimeSpentDate = DS(today());
  t.updatedAt = Date.now();
  saveTodos(state.todos);
}

// Sauvegarde la progression de la tâche courante AVANT de la quitter sans
// la compléter (Échap, Passer, Demain, clic sur une autre tâche pour la
// prioriser). Elle reprendra exactement à ce temps la prochaine fois
// qu'on la (re)focus, via getTimerState() ci-dessus.
export function saveFocusProgress(app) {
  const t = getFocusQueue(app)[0];
  if (!t) return;
  _flushProgress(t.id, getTimerState(t.id));
}

export function saveTimerState(ts) {
  localStorage.setItem('focusTimer', JSON.stringify(ts));
}

export function clearTimerState() {
  localStorage.removeItem('focusTimer');
}

export function elapsedSeconds(ts) {
  if (!ts) return 0;
  return Math.floor(ts.accum + (ts.paused ? 0 : (Date.now() - ts.startedAt) / 1000));
}

export function pauseTimer(ts) {
  if (ts.paused) return ts;
  ts.accum += (Date.now() - ts.startedAt) / 1000;
  ts.paused = true;
  saveTimerState(ts);
  return ts;
}

export function resumeTimer(ts) {
  if (!ts.paused) return ts;
  ts.startedAt = Date.now();
  ts.paused = false;
  saveTimerState(ts);
  return ts;
}

// Remet le chrono de la tâche courante à zéro (garde l'état pause/lecture)
export function resetTimer(ts) {
  ts.accum = 0;
  ts.startedAt = Date.now();
  saveTimerState(ts);
  return ts;
}

export function fmtElapsed(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const p2 = n => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p2(m)}:${p2(s)}` : `${p2(m)}:${p2(s)}`;
}

// ── Panneau de relance « Journée bouclée » ───────────────
// Partagé entre le mode Focus et la vue jour : piocher dans le backlog
// (la tâche est datée `ds` et sortie du backlog) ou créer une tâche pour `ds`.
// mode 'focus' : la tâche choisie/créée devient la courante du focus.
export function renderRefillPanel({ ds, mode, header = true, doneCount = 0 }) {
  const prioRank = { high: 0, medium: 1, low: 2, '': 3 };
  const backlogItems = state.todos
    .filter(t => (!t.recurrence || t.recurrence === 'none') && !t.date && t.backlog && !t.completed && !t.cancelled)
    .sort((a, b) => {
      const pa = prioRank[a.priority || ''] ?? 3, pb = prioRank[b.priority || ''] ?? 3;
      return pa !== pb ? pa - pb : a.id.localeCompare(b.id);
    });

  const headerHTML = header ? `
    <div class="refill-header">
      <span class="refill-emoji">🎉</span>
      <div class="refill-header-txt">
        <div class="refill-title">Journée bouclée</div>
        <div class="refill-sub">${doneCount} tâche${doneCount > 1 ? 's' : ''} complétée${doneCount > 1 ? 's' : ''} — envie de continuer ?</div>
      </div>
    </div>` : '';

  const listHTML = backlogItems.length ? `
    <div class="refill-section-label">Piocher dans le backlog</div>
    <div class="refill-list">
      ${backlogItems.map(t => `
        <div class="refill-item${t.priority ? ` prio-${t.priority}` : ''}" onclick="window.app.refillPick('${t.id}','${ds}','${mode}')" title="Planifier cette tâche et continuer">
          <span class="refill-item-plus">＋</span>
          <span class="refill-item-title">${esc(t.title)}</span>
          <span class="refill-item-hint">${mode === 'focus' ? 'En focus' : 'Ajouter au jour'}</span>
        </div>`).join('')}
    </div>` : '';

  return `<div class="refill-panel">
    ${headerHTML}
    ${listHTML}
    <div class="refill-section-label">${backlogItems.length ? 'Ou créer une nouvelle tâche' : 'Créer une nouvelle tâche'}</div>
    <div class="refill-new">
      <input type="text" id="refillNewTaskInput" class="refill-input" placeholder="Nouvelle tâche…" autocomplete="off"
        onkeydown="if(event.key==='Enter')window.app.refillAdd('${ds}','${mode}')">
      <button class="refill-add-btn" onclick="window.app.refillAdd('${ds}','${mode}')">Ajouter</button>
    </div>
  </div>`;
}

// ── Rendu ────────────────────────────────────────────────
function _metaBadges(t) {
  const cats = getCategories();
  const catIds = t.categoryIds || (t.categoryId ? [t.categoryId] : []);
  const badges = catIds.map(cid => {
    const c = cats.find(x => x.id === cid);
    return c ? `<span class="todo-category-badge" style="background:${c.color};color:#fff;border-color:${c.color}">${esc(c.name.toUpperCase())}</span>` : '';
  }).filter(Boolean);
  if (t.priority) {
    const cfg = { high: ['Haute', '#ef4444'], medium: ['Moyenne', '#f59e0b'], low: ['Basse', '#3b82f6'] };
    const [label, color] = cfg[t.priority];
    badges.push(`<span class="focus-prio-badge" style="color:${color};border-color:${color}">${label}</span>`);
  }
  if (t.startTime) badges.push(`<span class="focus-time-badge">🕐 ${t.startTime}${t.endTime ? `–${t.endTime}` : ''}</span>`);
  else if (t.dayPeriod) badges.push(`<span class="focus-time-badge">${PERIOD_LABEL[t.dayPeriod] || ''}</span>`);
  if (t.recurrence && t.recurrence !== 'none') badges.push(`<span class="focus-time-badge">↻ récurrente</span>`);
  return badges.join('');
}

function _subtasksHTML(t) {
  const subtasks = t.subtasks || [];
  const rows = subtasks.map(s => `
    <div class="focus-subtask${s.completed ? ' done' : ''}" onclick="window.app.focusToggleSubtask('${t.id}','${s.id}')">
      <div class="focus-subtask-check${s.completed ? ' checked' : ''}"></div>
      <span>${esc(s.title)}</span>
    </div>`).join('');
  const done = subtasks.filter(s => s.completed).length;
  // Toujours rendu (même sans sous-tâche) pour garder le bouton d'ajout
  // accessible — data-id : cible de app.focusAddSubtask() (ancre le nouvel
  // input, comme .subtask-list/data-id pour addSubtaskInline en vue jour).
  return `<div class="focus-subtasks" data-id="${t.id}">
    ${subtasks.length ? `<div class="focus-subtasks-count">${done}/${subtasks.length}</div>` : ''}
    ${rows}
    <button class="focus-subtask-add" onclick="event.stopPropagation();window.app.focusAddSubtask('${t.id}')">+ sous-tâche</button>
  </div>`;
}

function _counterHTML(t) {
  if (!t.counterEnabled || t.countTo === undefined) return '';
  const cur = t.countCurrent ?? t.countFrom ?? 0;
  return `<div class="focus-counter">
    <button class="focus-counter-btn" onclick="window.app.focusCounterStep('${t.id}',-1)">−</button>
    <div class="focus-counter-value">${cur}<span class="focus-counter-target">/${t.countTo}${t.countUnit ? ' ' + esc(t.countUnit) : ''}</span></div>
    <button class="focus-counter-btn" onclick="window.app.focusCounterStep('${t.id}',1)">＋</button>
  </div>`;
}

export function renderFocusView(app) {
  const d = today();
  const queue = getFocusQueue(app);
  const current = queue[0] || null;
  // Épingle la courante et mémorise ce qui est affiché (le tick détecte
  // les désynchronisations, ex. complétion via un autre appareil)
  if (current) _pinned = current.id;
  app._focusRenderedId = current?.id || null;
  app._focusRenderedQueueSig = queue.map(t => t.id).join(',');
  const next = queue.slice(1); // toute la journée restante

  const todayAll = getTodosForDate(d, state.todos);
  const doneCount = todayAll.filter(t => isCompleted(t, d)).length;
  const total = todayAll.length;
  const remainMin = queue.reduce((s, t) => s + (parseInt(t.durationEstimated) || 0), 0);
  const remainLabel = remainMin > 0
    ? ` · ~${remainMin >= 60 ? `${Math.floor(remainMin / 60)}h${String(remainMin % 60).padStart(2, '0')}` : `${remainMin} min`} restantes`
    : '';
  const pct = total > 0 ? Math.round(doneCount / total * 100) : 0;

  const topbar = `
    <div class="focus-topbar">
      <div class="focus-clock" id="focusClock">${_nowHM()}</div>
      <div class="focus-progress">
        <div class="focus-progress-bar"><div class="focus-progress-fill" style="width:${pct}%"></div></div>
        <span class="focus-progress-label">${doneCount}/${total}${remainLabel}</span>
      </div>
      <div class="focus-topbar-actions">
        <button class="focus-pill" onclick="window.app.minimizeFocus()" title="Réduire, façon Picture-in-Picture (Échap)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <button class="focus-pill" onclick="window.app.closeFocus()" title="Fermer le focus">✕</button>
      </div>
    </div>`;

  if (!current) {
    // Journée bouclée → interface de relance : piocher dans le backlog
    // (la tâche passe à aujourd'hui et devient la courante) ou créer une tâche
    return `<div class="focus-view">
      ${topbar}
      <div class="focus-stage focus-stage--done">
        <div class="focus-done-emoji">🎉</div>
        <div class="focus-done-title">Journée bouclée</div>
        <div class="focus-done-sub">${doneCount} tâche${doneCount > 1 ? 's' : ''} complétée${doneCount > 1 ? 's' : ''} aujourd'hui</div>
        ${renderRefillPanel({ ds: DS(d), mode: 'focus', header: false })}
        <button class="focus-action" onclick="window.app.closeFocus()">Quitter le focus</button>
      </div>
    </div>`;
  }

  const est = parseInt(current.durationEstimated) || 0;
  const isRec = current.recurrence && current.recurrence !== 'none';
  const ts = getTimerState(current.id);

  // Progression vers l'estimation : l'écran Focus se remplit depuis le bas
  // (#focusFill, en dehors de .focus-main — jamais recréé par
  // applyFocusEstimate() pour ne jamais interrompre le chrono en cours).
  // Dégradé fixe à paliers nets (pas de fondu) : vert jusqu'à WARNING_RATIO,
  // jaune jusqu'à DANGER_RATIO, rouge seulement sur les 10% finaux — la
  // hauteur du remplissage (= temps écoulé / estimé) révèle progressivement
  // ces paliers depuis le bas, façon niveau qui monte. Passé DANGER_RATIO :
  // mode urgence (voir .focus-emergency plus bas).
  const estSec = est * 60;
  const sec0 = elapsedSeconds(ts);
  const fillRatio0 = estSec > 0 ? sec0 / estSec : 0;
  const fillHeight0 = Math.min(1, fillRatio0) * 100;
  const fillDanger0 = fillRatio0 >= DANGER_RATIO;

  const estimateSideHTML = est > 0 ? _estimateLabelRowHTML() : _estimatePromptHTML(current.id);

  const _grip = `<svg class="focus-queue-grip" viewBox="0 0 10 16" width="10" height="16" fill="currentColor"><circle cx="3" cy="3" r="1.4"/><circle cx="7" cy="3" r="1.4"/><circle cx="3" cy="8" r="1.4"/><circle cx="7" cy="8" r="1.4"/><circle cx="3" cy="13" r="1.4"/><circle cx="7" cy="13" r="1.4"/></svg>`;

  // Icônes des actions : traits fins, cohérentes entre elles (remplacent
  // les glyphes unicode ✓ ▶ ⏸ ↷ →, boutons désormais icône seule)
  const ICON = {
    check:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4,13 9,18 20,6"/></svg>`,
    pause:  `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4.5" height="14" rx="1.2"/><rect x="13.5" y="5" width="4.5" height="14" rx="1.2"/></svg>`,
    play:   `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5.5v13a1 1 0 0 0 1.53.85l10.5-6.5a1 1 0 0 0 0-1.7L8.53 4.65A1 1 0 0 0 7 5.5Z"/></svg>`,
    skip:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6v12l8-6-8-6Z"/><path d="M13 6v12l8-6-8-6Z"/></svg>`,
    tomorrow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5.5" width="16" height="15" rx="2.5"/><path d="M4 10h16"/><path d="M9 15h4M9 15l1.6-1.6M9 15l1.6 1.6"/></svg>`,
    reset: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11A8 8 0 1 0 18 16"/><polyline points="20 4 20 11 13 11"/></svg>`,
  };
  const actBtn = (cls, onclick, id, icon, label, kbd) =>
    `<button class="focus-action ${cls}" onclick="${onclick}"${id ? ` id="${id}"` : ''} title="${label} (${kbd})">${icon}</button>`;

  // File « Ensuite » : groupée selon la préférence (Type par défaut),
  // sur 1 à 3 colonnes, repliable. Le drag-and-drop n'est actif qu'en
  // tri Auto + 1 colonne (un tri explicite ou une grille multi-colonnes
  // recalculerait/désaligne l'ordre au prochain rendu). `data-group`
  // (rec/punct, moment, ou 'none') laisse app.initFocusQueueDnD()
  // contraindre le survol au même groupe que l'item saisi : getFocusQueue()
  // re-trie toujours par groupe après l'ordre manuel, donc un drag inter-
  // groupes serait silencieusement annulé au prochain rendu si on le permettait.
  const prefs = getQueuePrefs();
  const canDrag = prefs.sort === 'auto' && prefs.cols === '1';
  const groupOf = t => {
    if (prefs.group === 'type') return (t.recurrence && t.recurrence !== 'none')
      ? { key: 'rec', label: '↻ Récurrentes' } : { key: 'punct', label: 'Ponctuelles' };
    if (prefs.group === 'moment') return t.dayPeriod
      ? { key: t.dayPeriod, label: PERIOD_LABEL[t.dayPeriod] || '' } : { key: 'none', label: 'Sans moment' };
    return null;
  };
  const seg = (key, val, label, title) =>
    `<button class="focus-seg-btn${String(prefs[key]) === val ? ' active' : ''}" onclick="window.app.focusSetQueueView('${key}','${val}')" title="${title}">${label}</button>`;

  let queueRows = '', lastGroup = null;
  next.forEach(t => {
    const g = groupOf(t);
    if (g && g.key !== lastGroup) {
      const n = next.filter(x => groupOf(x).key === g.key).length;
      queueRows += `<div class="focus-queue-group">${g.label}<span class="focus-queue-group-n">${n}</span></div>`;
      lastGroup = g.key;
    }
    queueRows += `
        <div class="focus-queue-item${t.priority ? ` prio-${t.priority}` : ''}"${canDrag ? ' draggable="true"' : ''} data-id="${t.id}" data-date="${DS(d)}" data-group="${g ? g.key : 'none'}" onclick="window.app.focusJumpTo('${t.id}')" title="Cliquer : passer à cette tâche${canDrag ? ' · Glisser : réordonner' : ''} · Clic droit : actions">
          ${canDrag ? _grip : ''}
          <span class="focus-queue-text">${esc(t.title)}</span>
          ${t.startTime ? `<span class="focus-queue-time">${t.startTime}</span>` : (t.dayPeriod ? `<span class="focus-queue-time">${PERIOD_LABEL[t.dayPeriod] || ''}</span>` : '')}
        </div>`;
  });

  const collapsed = prefs.collapsed;
  const chevron = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="focus-queue-chevron${collapsed ? ' collapsed' : ''}"><polyline points="6,9 12,15 18,9"/></svg>`;
  const qWidth = { '1': 680, '2': 960, '3': 1220 }[prefs.cols] || 680;

  const optsHTML = !collapsed ? `
        <div class="focus-queue-opts">
          <div class="focus-seg" role="group" aria-label="Regroupement">
            ${seg('group', 'type', 'Type', 'Grouper : ponctuelles / récurrentes')}
            ${seg('group', 'moment', 'Moment', 'Grouper par moment de la journée')}
            ${seg('group', 'none', 'Liste', 'Liste simple, sans groupes')}
          </div>
          <div class="focus-seg" role="group" aria-label="Tri">
            ${seg('sort', 'auto', 'Auto', 'Ordre intelligent (moments, ordre manuel, heure, priorité)')}
            ${seg('sort', 'time', 'Heure', 'Trier par heure')}
            ${seg('sort', 'prio', 'Priorité', 'Trier par priorité')}
          </div>
          <div class="focus-seg" role="group" aria-label="Colonnes">
            ${seg('cols', '1', '1', '1 colonne')}
            ${seg('cols', '2', '2', '2 colonnes')}
            ${seg('cols', '3', '3', '3 colonnes')}
          </div>
        </div>` : '';

  const queueHTML = next.length ? `
    <div class="focus-queue">
      <div class="focus-queue-inner" style="width:min(${qWidth}px, 94vw)">
        <div class="focus-queue-head">
          <button class="focus-queue-toggle" onclick="window.app.focusToggleQueueCollapse()" title="${collapsed ? 'Déplier' : 'Replier'}">
            ${chevron}
            <span class="focus-queue-title">Ensuite <span class="focus-queue-count">${next.length}</span></span>
          </button>
          ${optsHTML}
        </div>
        ${!collapsed ? `<div class="focus-queue-list" id="focusQueueList" style="--cols:${prefs.cols}">${queueRows}
        </div>` : ''}
      </div>
    </div>` : '';

  return `<div class="focus-view${fillDanger0 ? ' focus-emergency' : ''}" id="focusView">
    <div class="focus-fill${fillDanger0 ? ' danger-zone' : ''}" id="focusFill" style="height:${fillHeight0}%"></div>
    ${topbar}
    <div class="focus-alert hidden" id="focusAlert"></div>
    <div class="focus-stage focus-current-item" data-id="${current.id}" data-date="${DS(d)}" title="Clic droit : actions">
      <div class="focus-main">
        <div class="focus-now" id="focusNow">${_nowHM()}</div>
        <div class="focus-timer-row">
          <div class="focus-timer${ts.paused ? ' paused' : ''}" id="focusTimer" title="${_timerTitle(current)}">${_timerDisplayText(current, sec0)}</div>
          <button class="focus-timer-reset" onclick="window.app.focusResetTimer('${current.id}')" title="Réinitialiser le chrono">${ICON.reset}</button>
        </div>
        ${estimateSideHTML}
        <div class="focus-task-title">${esc(current.title)}</div>
        ${current.description ? `<div class="focus-task-desc">${esc(current.description)}</div>` : ''}
        <div class="focus-task-meta">${_metaBadges(current)}</div>
        ${_subtasksHTML(current)}
        ${_counterHTML(current)}
      </div>
      <div class="focus-actions">
        ${actBtn('focus-action--primary', 'window.app.focusComplete()', null, ICON.check, 'Terminer', 'Espace')}
        ${actBtn('', 'window.app.focusPauseResume()', 'focusPauseBtn', ts.paused ? ICON.play : ICON.pause, ts.paused ? 'Reprendre' : 'Pause', 'P')}
        ${queue.length > 1 ? actBtn('', 'window.app.focusSkip()', null, ICON.skip, 'Passer', 'S') : ''}
        ${!isRec ? actBtn('', 'window.app.focusTomorrow()', null, ICON.tomorrow, 'Demain', 'D') : ''}
      </div>
    </div>
    ${queueHTML}
  </div>`;
}

// ── Mode d'affichage du chrono : temps écoulé (défaut) ou compte à
// rebours (uniquement affiché si une estimation existe). Préférence
// globale locale (non synchronisée). ──
export function getTimerMode() {
  return localStorage.getItem('focusTimerMode') === 'countdown' ? 'countdown' : 'elapsed';
}

export function toggleTimerMode() {
  localStorage.setItem('focusTimerMode', getTimerMode() === 'elapsed' ? 'countdown' : 'elapsed');
}

function _timerDisplayText(current, sec) {
  const est = (parseInt(current.durationEstimated) || 0) * 60;
  if (est > 0 && getTimerMode() === 'countdown') {
    return sec <= est ? `−${fmtElapsed(est - sec)}` : `+${fmtElapsed(sec - est)}`;
  }
  return fmtElapsed(sec);
}

function _timerTitle(current) {
  const est = (parseInt(current.durationEstimated) || 0) * 60;
  return (est > 0 && getTimerMode() === 'countdown') ? 'Temps restant avant l\'estimation' : 'Temps écoulé sur cette tâche';
}

// Invitation à estimer / rééditer le temps prévu — même bloc utilisé au
// premier réglage (renderFocusView, value vide) et pour changer une
// estimation déjà définie (app.focusEditEstimate(), value pré-remplie) :
// focusSetEstimate() cherche #focusEstimateBlock et le remplace toujours
// par _estimateLabelRowHTML() via applyFocusEstimate(), donc ce même id
// fonctionne dans les deux cas sans code dédié.
function _estimatePromptHTML(id, value = '') {
  return `<div class="focus-estimate-prompt" id="focusEstimateBlock">
      <span class="focus-estimate-prompt-label">${value ? 'Nouvelle estimation ?' : 'Combien de temps pour cette tâche ?'}</span>
      <input type="number" min="1" step="1" inputmode="numeric" class="focus-estimate-input" id="focusEstimateInput" value="${value}" placeholder="min" onkeydown="if(event.key==='Enter')window.app.focusSetEstimate('${id}', this.value)">
      <button class="focus-estimate-save" onclick="window.app.focusSetEstimate('${id}', document.getElementById('focusEstimateInput').value)">OK</button>
    </div>`;
}

// Lance l'édition d'une estimation déjà définie : remplace la ligne
// libellé + toggle par le même prompt que le réglage initial, pré-rempli.
// Patch DOM ciblé (jamais de render() complet — voir applyFocusEstimate).
export function startEditEstimate(app) {
  const current = getFocusQueue(app)[0];
  if (!current) return;
  const row = document.querySelector('.focus-estimate-row');
  if (!row) return;
  row.outerHTML = _estimatePromptHTML(current.id, current.durationEstimated || '');
  const input = document.getElementById('focusEstimateInput');
  input?.focus();
  input?.select();
}

function _estimateLabelRowHTML() {
  const mode = getTimerMode();
  return `<div class="focus-estimate-row">
      <span class="focus-estimate-label" id="focusEstimateLabel" onclick="window.app.focusEditEstimate()" title="Cliquer pour changer l'estimation"></span>
      <button class="focus-timermode-btn${mode === 'countdown' ? ' active' : ''}" id="focusTimerModeBtn" onclick="window.app.focusToggleTimerMode()" title="${mode === 'countdown' ? 'Revenir au chrono (temps écoulé)' : 'Passer en compte à rebours (temps restant)'}">⏳</button>
    </div>`;
}

// Met à jour le remplissage de l'écran + son libellé pour la tâche
// courante, sans toucher au chrono lui-même. Partagé entre le tick 1 s et
// applyFocusEstimate() (saisie inline d'une estimation en cours de tâche).
function _applyEstimateVisuals(current) {
  const est = (parseInt(current.durationEstimated) || 0) * 60;
  const fill = document.getElementById('focusFill');
  if (est <= 0 || !fill) return;
  const ts = getTimerState(current.id);
  const sec = elapsedSeconds(ts);
  const ratio = sec / est;
  fill.style.height = (Math.min(1, ratio) * 100) + '%';
  const emergency = ratio >= DANGER_RATIO;
  fill.classList.toggle('danger-zone', emergency);
  document.getElementById('focusView')?.classList.toggle('focus-emergency', emergency);
  const label = document.getElementById('focusEstimateLabel');
  if (label) {
    label.textContent = sec <= est
      ? `reste ${Math.ceil((est - sec) / 60)} min`
      : `+${Math.ceil((sec - est) / 60)} min au-delà de l'estimation`;
  }
}

// Applique une estimation saisie via le prompt inline SANS re-render complet
// — sinon #focusTimer serait recréé et l'intervalle redémarré, interrompant
// visuellement le chrono en cours. Seul le prompt (remplacé par le libellé +
// la bascule chrono/compte à rebours) et le remplissage (déjà présent, à 0%)
// sont mis à jour en place.
export function applyFocusEstimate(app) {
  const queue = getFocusQueue(app);
  const current = queue[0];
  if (!current) return;
  // Ne remplace le prompt que s'il a effectivement été répondu (une
  // estimation existe désormais) — appelé aussi par focusResetTimer(),
  // qui ne doit pas fermer un prompt encore sans réponse.
  const promptEl = document.getElementById('focusEstimateBlock');
  if (promptEl && current.durationEstimated > 0) promptEl.outerHTML = _estimateLabelRowHTML();
  const progLabel = document.querySelector('.focus-progress-label');
  if (progLabel) {
    const todayAll = getTodosForDate(today(), state.todos);
    const doneCount = todayAll.filter(t => isCompleted(t, today())).length;
    const remainMin = queue.reduce((s, t) => s + (parseInt(t.durationEstimated) || 0), 0);
    const remainLabel = remainMin > 0
      ? ` · ~${remainMin >= 60 ? `${Math.floor(remainMin / 60)}h${String(remainMin % 60).padStart(2, '0')}` : `${remainMin} min`} restantes`
      : '';
    progLabel.textContent = `${doneCount}/${todayAll.length}${remainLabel}`;
  }
  _applyEstimateVisuals(current);
  const timerEl = document.getElementById('focusTimer');
  if (timerEl) timerEl.textContent = _timerDisplayText(current, elapsedSeconds(getTimerState(current.id)));
}

// Bascule chrono ↔ compte à rebours pour la tâche courante (clic sur
// #focusTimerModeBtn) — met à jour #focusTimer immédiatement plutôt que
// d'attendre le prochain tick (≤ 1 s).
export function applyTimerMode(app) {
  const current = getFocusQueue(app)[0];
  if (!current) return;
  const timerEl = document.getElementById('focusTimer');
  if (timerEl) {
    timerEl.textContent = _timerDisplayText(current, elapsedSeconds(getTimerState(current.id)));
    timerEl.title = _timerTitle(current);
  }
  const btn = document.getElementById('focusTimerModeBtn');
  if (btn) {
    const mode = getTimerMode();
    btn.classList.toggle('active', mode === 'countdown');
    btn.title = mode === 'countdown' ? 'Revenir au chrono (temps écoulé)' : 'Passer en compte à rebours (temps restant)';
  }
}

// ── Picture-in-Picture : petit widget flottant quand le Focus est réduit
// (app.minimizeFocus()/restoreFocus()/closeFocus(), app.js). Vit en dehors
// de #mainContent (appendé à document.body) pour survivre aux changements
// de vue pendant que la session continue. Le chrono garde son état réel
// (getTimerState) — seul l'affichage change ; focusTick() met à jour son
// texte chaque seconde comme pour la vue plein écran.
export function renderFocusPip(app) {
  if (!app._focusMinimized) { removeFocusPip(); return; }
  const queue = getFocusQueue(app);
  const current = queue[0];
  if (!current) { app._focusMinimized = false; removeFocusPip(); return; }
  // Garde le tick synchronisé même quand renderFocusView() (qui pose
  // normalement _focusRenderedQueueSig) n'est pas appelée
  app._focusRenderedQueueSig = queue.map(t => t.id).join(',');

  const sec = elapsedSeconds(getTimerState(current.id));
  const est = (parseInt(current.durationEstimated) || 0) * 60;
  const ratio = est > 0 ? sec / est : 0;
  const zone = est <= 0 ? '' : ratio >= DANGER_RATIO ? ' zone-danger' : ratio >= WARNING_RATIO ? ' zone-warning' : ' zone-success';

  let pip = document.getElementById('focusPip');
  if (!pip) {
    pip = document.createElement('div');
    pip.id = 'focusPip';
    pip.onclick = () => window.app.restoreFocus();
    document.body.appendChild(pip);
  }
  pip.className = `focus-pip${zone}`;
  pip.innerHTML = `
    <div class="focus-pip-timer" id="focusPipTimer">${_timerDisplayText(current, sec)}</div>
    <div class="focus-pip-title">${esc(current.title)}</div>
    <button class="focus-pip-close" onclick="event.stopPropagation();window.app.closeFocus()" title="Fermer">✕</button>`;
}

export function removeFocusPip() {
  document.getElementById('focusPip')?.remove();
}

// ── Tick (1 s) — met à jour chrono, estimation, bandeau, PiP si réduit ──
// sans re-render complet. Retourne true si un render est nécessaire.
export function focusTick(app) {
  const queue = getFocusQueue(app);
  const current = queue[0];
  const nowStr = _nowHM();
  const clock = document.getElementById('focusClock');
  if (clock) clock.textContent = nowStr;
  const nowBig = document.getElementById('focusNow');
  if (nowBig) nowBig.textContent = nowStr;
  // Désynchronisation (complétée ailleurs, sync, …) → re-render complet.
  // Comparer toute la file, pas juste la courante : une tâche complétée
  // depuis un autre appareil doit disparaître de « Ensuite » aussi.
  if (queue.map(t => t.id).join(',') !== app._focusRenderedQueueSig) return true;
  if (!current) return false;

  const ts = getTimerState(current.id);
  const sec = elapsedSeconds(ts);
  const timerEl = document.getElementById('focusTimer');
  if (timerEl) timerEl.textContent = _timerDisplayText(current, sec);
  const pipTimerEl = document.getElementById('focusPipTimer');
  if (pipTimerEl) pipTimerEl.textContent = _timerDisplayText(current, sec);

  _applyEstimateVisuals(current);

  // Bandeau : une tâche à heure fixe est échue et n'est pas la courante
  const nowHM = _nowHM();
  const due = queue.find(t => t.id !== current.id && t.startTime && t.startTime <= nowHM);
  const alert = document.getElementById('focusAlert');
  if (alert) {
    if (due) {
      alert.classList.remove('hidden');
      alert.innerHTML = `🕐 Il est l'heure de : <b>${esc(due.title)}</b> (${due.startTime})
        <button class="focus-pill" onclick="window.app.focusJumpTo('${due.id}')">Y passer</button>`;
    } else {
      alert.classList.add('hidden');
      alert.innerHTML = '';
    }
  }
  return false;
}
