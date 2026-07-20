// ════════════════════════════════════════════════════════
//  BILAN / REVIEW — tâches laissées pour compte
//  Triage des ponctuelles en retard + adhérence des récurrentes
// ════════════════════════════════════════════════════════

import * as state from './state.js';
import { DS, parseDS, today, addDays, esc } from './utils.js';
import { getTodosForDate, isCompleted, isCancelled } from './calendar.js';

// Ponctuelles datées dans le passé, non complétées — plus anciennes d'abord
export function getOverduePunctual(todos) {
  const todayStr = DS(today());
  return todos
    .filter(t => (!t.recurrence || t.recurrence === 'none') && t.date && t.date < todayStr && !t.completed && !t.cancelled)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Ponctuelles souvent reportées (2× ou plus), non complétées, hors retard (déjà listé)
export function getFrequentlyPostponed(todos) {
  const todayStr = DS(today());
  return todos
    .filter(t => (!t.recurrence || t.recurrence === 'none') && !t.completed && !t.cancelled
      && (t.postponedCount || 0) >= 2 && (!t.date || t.date >= todayStr))
    .sort((a, b) => (b.postponedCount || 0) - (a.postponedCount || 0))
    .slice(0, 8);
}

// Adhérence des récurrentes sur les N derniers jours ÉCOULÉS (hier inclus, aujourd'hui exclu
// car la journée n'est pas finie). → triés du pire taux au meilleur, occurrences attendues > 0.
export function computeAdherence(todos, nDays = 7) {
  const recurring = todos.filter(t => t.recurrence && t.recurrence !== 'none');
  if (!recurring.length) return [];
  const days = Array.from({ length: nDays }, (_, i) => addDays(today(), -(nDays - i)));
  return recurring.map(t => {
    let expected = 0, done = 0;
    const cells = days.map(d => {
      // Une occurrence annulée n'est pas attendue — elle ne pénalise pas l'adhérence
      const exp = getTodosForDate(d, [t]).length > 0 && !isCancelled(t, d);
      const ok  = exp && isCompleted(t, d);
      if (exp) expected++;
      if (ok)  done++;
      return { ds: DS(d), expected: exp, done: ok };
    });
    return { todo: t, expected, done, rate: expected > 0 ? done / expected : 1, cells };
  }).filter(r => r.expected > 0).sort((a, b) => a.rate - b.rate);
}

// inline: version minuscule sans détail, pour s'insérer dans une phrase
// (ex. « 6 tâches non accomplies hier ») — utilisée par render.js quand le
// bandeau ne couvre qu'un seul jour, pour ne pas répéter l'info deux fois
// (titre du bandeau + libellé de groupe redondants)
export function dayLabel(ds, { inline = false } = {}) {
  const diff = Math.round((today() - parseDS(ds)) / 86400000);
  const d = parseDS(ds);
  if (inline) {
    if (diff === 1) return 'hier';
    if (diff === 2) return 'avant-hier';
    return `le ${state.DAY_FULL[d.getDay()]} ${d.getDate()} ${state.MONTHS[d.getMonth()]}`;
  }
  if (diff === 1) return 'Hier';
  if (diff === 2) return 'Avant-hier';
  return `${state.DAY_FULL[d.getDay()]} ${d.getDate()} ${state.MONTHS[d.getMonth()]} · il y a ${diff} jours`;
}

function _postponedBadge(t) {
  const n = t.postponedCount || 0;
  if (n < 2) return '';
  return `<span class="review-postponed-badge" title="Reportée ${n} fois${t.originalDate ? ` depuis le ${t.originalDate}` : ''}">↪ ×${n}</span>`;
}

// t.id = Date.now() à la création (même convention que getTodosForDate()
// dans calendar.js, qui l'utilise déjà comme date de création par défaut)
function _daysSinceCreated(t) {
  const created = new Date(parseInt(t.id, 10));
  if (isNaN(created.getTime())) return null;
  created.setHours(0, 0, 0, 0);
  return Math.round((today() - created) / 86400000);
}

function _ageBadge(t) {
  const days = _daysSinceCreated(t);
  if (days === null) return '';
  const label = days <= 0 ? 'auj.' : `${days} j`;
  return `<span class="review-age-badge" title="Créée ${days <= 0 ? "aujourd'hui" : `il y a ${days} jour${days > 1 ? 's' : ''}`}">${label}</span>`;
}

// Petit handle dédié (grip à 6 points) : seul point de départ du drag, pour
// ne pas rendre toute la ligne « draggable » (le clic/la sélection restent
// libres ailleurs sur la ligne). draggable="true" est sur le handle, mais
// dragstart lit '${t.id}' par closure donc le payload est correct quel que
// soit l'élément qui a initié le drag ; .closest('.review-item') porte la
// classe .dragging pour que toute la ligne s'estompe, pas juste le handle
const _DRAG_HANDLE_SVG = `<svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor"><circle cx="2.5" cy="2.5" r="1.4"/><circle cx="7.5" cy="2.5" r="1.4"/><circle cx="2.5" cy="8" r="1.4"/><circle cx="7.5" cy="8" r="1.4"/><circle cx="2.5" cy="13.5" r="1.4"/><circle cx="7.5" cy="13.5" r="1.4"/></svg>`;

// data-id + data-date : sélectionnable (MS_SELECTABLE) et clic droit (menu
// contextuel, résolu via data-date par _resolveOccurrences()) — aucun
// bouton sur la ligne elle-même, uniquement le titre + le handle de drag
function _itemRow(t) {
  const prioDot = t.priority ? `<span class="review-prio-dot prio-${t.priority}"></span>` : '';
  return `<div class="review-item" data-id="${t.id}"${t.date ? ` data-date="${t.date}"` : ''}>
    <span class="review-item-handle" draggable="true" title="Glisser vers une zone d'action"
      ondragstart="event.stopPropagation();window.app.planDragStart(event,'${t.id}');this.closest('.review-item').classList.add('dragging')"
      ondragend="this.closest('.review-item').classList.remove('dragging')">${_DRAG_HANDLE_SVG}</span>
    <div class="review-item-main">
      ${prioDot}<span class="review-item-title">${esc(t.title)}</span>${_postponedBadge(t)}${_ageBadge(t)}
    </div>
  </div>`;
}

// Grosses zones de dépôt partagées (bandeau vue jour + modal Bilan) : on
// drague une tâche (ou toute la sélection multiple, via app._dropIds())
// dessus pour appliquer l'action, plutôt que des boutons sur chaque ligne.
// - onTodayClick : le bandeau vue jour n'a plus de bouton « Tout à
//   aujourd'hui » séparé — cette action est intégrée à la zone Aujourd'hui
//   (clic = tout le lot fenêtré, glisser = juste la tâche déposée), signalée
//   par un badge distinctif pour ne pas la confondre avec les zones
//   glisser-seulement. Le modal Bilan garde ses propres boutons « Tout... »
//   dédiés (`.review-bulk`) donc n'active pas cette option.
// - bilanLink : ajoute un bouton « Bilan complet » dans la même rangée
//   (bandeau seulement — inutile depuis le modal, qui EST le Bilan) — style
//   plein, pas en pointillés, pour signaler que ce n'est pas une cible de
//   drop mais un lien de navigation
//
// Icônes en SVG trait (stroke="currentColor"), jamais en emoji : contrainte
// globale de Hugues (voir ~/.claude/CLAUDE.md), pas seulement pour éviter
// l'ancien 🗂 du Backlog qu'il n'aimait pas — aucune icône de l'app ne doit
// être un pictogramme multicolore, la couleur ne doit venir que du thème
// (currentColor hérite de la couleur du texte/état de la zone)
const _DZ_ICONS = {
  done:     `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  today:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.2" y1="4.2" x2="5.6" y2="5.6"/><line x1="18.4" y1="18.4" x2="19.8" y2="19.8"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.2" y1="19.8" x2="5.6" y2="18.4"/><line x1="18.4" y1="5.6" x2="19.8" y2="4.2"/></svg>`,
  tomorrow: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/></svg>`,
  backlog:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
  cancel:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="5.5" y1="5.5" x2="18.5" y2="18.5"/></svg>`,
  bilan:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="3" width="12" height="18" rx="2"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>`,
};
const _DZ_COMMON = `ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="if(!this.contains(event.relatedTarget))this.classList.remove('drag-over')"`;
export function renderOverdueDropZones({ onTodayClick = null, bilanLink = false } = {}) {
  const todayClickAttr = onTodayClick ? ` onclick="${onTodayClick}"` : '';
  const todayBadge = onTodayClick ? `<span class="overdue-drop-zone-badge" title="Clic = tout reporter à aujourd'hui">tout</span>` : '';
  return `<div class="overdue-drop-zones">
    <div class="overdue-drop-zone overdue-drop-zone--done" ${_DZ_COMMON} ondrop="window.app.overdueDropDone(event)" title="Marquer comme faite">
      <span class="overdue-drop-zone-icon">${_DZ_ICONS.done}</span>Fait
    </div>
    <div class="overdue-drop-zone${onTodayClick ? ' overdue-drop-zone--clickable' : ''}" ${_DZ_COMMON}${todayClickAttr} ondrop="window.app.overdueDropToday(event)" title="${onTodayClick ? 'Glisser une tâche : la reporter · Clic : tout reporter à aujourd\'hui' : 'Reporter à aujourd\'hui'}">
      ${todayBadge}<span class="overdue-drop-zone-icon">${_DZ_ICONS.today}</span>Aujourd'hui
    </div>
    <div class="overdue-drop-zone" ${_DZ_COMMON} ondrop="window.app.overdueDropTomorrow(event)" title="Reporter à demain">
      <span class="overdue-drop-zone-icon">${_DZ_ICONS.tomorrow}</span>Demain
    </div>
    <div class="overdue-drop-zone" ${_DZ_COMMON} ondrop="window.app.overdueDropBacklog(event)" title="Envoyer au backlog">
      <span class="overdue-drop-zone-icon">${_DZ_ICONS.backlog}</span>Backlog
    </div>
    <div class="overdue-drop-zone overdue-drop-zone--cancel" ${_DZ_COMMON} ondrop="window.app.overdueDropCancel(event)" title="Abandonner (annuler la tâche — reste visible, barrée)">
      <span class="overdue-drop-zone-icon">${_DZ_ICONS.cancel}</span>Abandonner
    </div>
    ${bilanLink ? `<div class="overdue-drop-zone overdue-drop-zone--link" onclick="window.app.openReviewModal()" title="Ouvrir le bilan complet">
      <span class="overdue-drop-zone-icon">${_DZ_ICONS.bilan}</span>Bilan complet
    </div>` : ''}
  </div>`;
}

// Bande 7 jours : ✓ fait · ✗ manqué · − pas prévu ce jour-là
function _adherenceStrip(cells) {
  return `<div class="adherence-strip">${cells.map(c => {
    const cls = !c.expected ? 'na' : c.done ? 'ok' : 'miss';
    const sym = !c.expected ? '·' : c.done ? '✓' : '✗';
    return `<span class="adherence-cell adherence-cell--${cls}" title="${c.ds}">${sym}</span>`;
  }).join('')}</div>`;
}

export function renderAdherenceRows(todos, { limit = 10 } = {}) {
  const week  = computeAdherence(todos, 7);
  const month = computeAdherence(todos, 30);
  const monthById = new Map(month.map(r => [r.todo.id, r]));
  return week.slice(0, limit).map(r => {
    const m = monthById.get(r.todo.id);
    const pct30 = m ? Math.round(m.rate * 100) : null;
    return `<div class="adherence-row">
      <span class="adherence-name">${esc(r.todo.title)}</span>
      ${_adherenceStrip(r.cells)}
      <span class="adherence-rate${r.rate < 0.5 ? ' adherence-rate--low' : ''}">${r.done}/${r.expected}</span>
      ${pct30 !== null ? `<span class="adherence-rate-30">${pct30}<small>% / 30 j</small></span>` : ''}
    </div>`;
  }).join('');
}

// Temps passé sur les récurrentes (via durationHistory, alimenté par le focus
// mode à chaque focusComplete()) — total brut + moyenne + progression sur
// les dernières occurrences vs les précédentes. Triées meilleure progression d'abord.
export function computeTimeStats(todos, { minOccurrences = 2, recentN = 3 } = {}) {
  return todos
    .filter(t => Array.isArray(t.durationHistory) && t.durationHistory.length >= minOccurrences)
    .map(t => {
      const hist = [...t.durationHistory].sort((a, b) => a.date < b.date ? -1 : 1);
      const minutes = hist.map(h => h.minutes);
      const total = minutes.reduce((a, b) => a + b, 0);
      const avg = total / minutes.length;
      const n = Math.min(recentN, Math.floor(minutes.length / 2)) || 1;
      const recent = minutes.slice(-n);
      const prior = minutes.slice(0, -n);
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const priorAvg = prior.length ? prior.reduce((a, b) => a + b, 0) / prior.length : null;
      const improvementPct = priorAvg ? Math.round(((priorAvg - recentAvg) / priorAvg) * 100) : null;
      return { todo: t, count: minutes.length, total, avg, recentAvg, priorAvg, improvementPct, minutes };
    })
    .sort((a, b) => (b.improvementPct ?? -Infinity) - (a.improvementPct ?? -Infinity));
}

// Temps total passé en focus, toutes tâches confondues (somme brute de
// durationHistory — pas de filtre sur le nombre d'occurrences, contrairement
// à computeTimeStats). C'est le chiffre "gardé" tel quel, pas une moyenne.
export function computeTotalFocusMinutes(todos) {
  return todos.reduce((sum, t) => {
    if (!Array.isArray(t.durationHistory)) return sum;
    return sum + t.durationHistory.reduce((s, h) => s + (h.minutes || 0), 0);
  }, 0);
}

export function fmtMinutes(min) {
  return min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}` : `${min} min`;
}

function _timeSparkline(minutes) {
  const shown = minutes.slice(-8);
  const max = Math.max(...shown, 1);
  return `<div class="timestat-spark">${shown.map(m => {
    const pct = Math.max(Math.round(m / max * 100), 6);
    return `<div class="timestat-spark-bar" style="height:${pct}%" title="${m} min"></div>`;
  }).join('')}</div>`;
}

function _timeDeltaHTML(pct) {
  if (pct === null) return `<span class="timestat-delta neutral">— pas assez d'historique</span>`;
  if (pct > 4) return `<span class="timestat-delta improved">▼ ${pct}% plus rapide</span>`;
  if (pct < -4) return `<span class="timestat-delta worse">▲ ${Math.abs(pct)}% plus lent</span>`;
  return `<span class="timestat-delta neutral">— stable</span>`;
}

export function renderTimeStatsRows(todos, { limit = 10 } = {}) {
  return computeTimeStats(todos).slice(0, limit).map(r => `
    <div class="timestat-row">
      <span class="timestat-name">${esc(r.todo.title)}</span>
      ${_timeSparkline(r.minutes)}
      <span class="timestat-total">${fmtMinutes(r.total)}<small> total</small></span>
      <span class="timestat-avg">${Math.round(r.avg)}<small> min moy.</small></span>
      ${_timeDeltaHTML(r.improvementPct)}
    </div>`).join('');
}

// Ponctuelles en retard groupées par jour — lignes de titre pur (aucun
// bouton) : on drague une ligne vers renderOverdueDropZones() pour agir
// dessus (rendu séparément par l'appelant, hors de la zone scrollable, pour
// rester toujours atteignable pendant le drag). Partagé entre le modal
// Bilan et le bandeau de rappel de la vue jour.
// hideSingleGroupLabel : quand un seul jour est concerné, le bandeau vue
// jour unifie déjà ce jour dans son titre (« N tâches non accomplies hier »
// plutôt que « ... ces 5 derniers jours ») — inutile de répéter le même
// libellé juste en dessous (« Hier 6 ») ; le modal Bilan n'active pas cette
// option, son titre de section ne mentionne pas de jour
export function renderOverdueGroups(overdue, { hideSingleGroupLabel = false } = {}) {
  if (!overdue.length) return '';
  const byDate = new Map();
  overdue.forEach(t => {
    if (!byDate.has(t.date)) byDate.set(t.date, []);
    byDate.get(t.date).push(t);
  });
  const skipLabel = hideSingleGroupLabel && byDate.size === 1;
  return [...byDate.entries()].map(([ds, items]) => `
    <div class="review-group">
      ${skipLabel ? '' : `<div class="review-group-label">${dayLabel(ds)}<span class="review-group-count">${items.length}</span></div>`}
      <div class="review-group-items">${items.map(t => _itemRow(t)).join('')}</div>
    </div>`).join('');
}

// Corps du modal Bilan
export function renderReviewBody(todos) {
  const overdue   = getOverduePunctual(todos);
  const postponed = getFrequentlyPostponed(todos);
  const adherence = renderAdherenceRows(todos, { limit: 6 });

  let html = '';

  // ── Ponctuelles en retard, groupées par jour ──
  if (overdue.length) {
    html += `<div class="review-section">
      <div class="review-section-title">Laissées pour compte <span class="review-section-badge">${overdue.length}</span></div>
      ${renderOverdueGroups(overdue)}
      ${renderOverdueDropZones()}
      <div class="review-bulk">
        <button class="btn btn-primary" onclick="window.app.reviewAllToday()">Tout reporter à aujourd'hui</button>
        <button class="btn btn-ghost" onclick="window.app.reviewAllBacklog()">Tout en backlog</button>
      </div>
    </div>`;
  } else {
    html += `<div class="review-empty">✓ Aucune tâche ponctuelle en retard</div>`;
  }

  // ── Souvent reportées ──
  if (postponed.length) {
    html += `<div class="review-section">
      <div class="review-section-title">Souvent reportées</div>
      ${postponed.map(t => _itemRow(t)).join('')}
    </div>`;
  }

  // ── Récurrentes : adhérence 7 jours ──
  if (adherence) {
    html += `<div class="review-section">
      <div class="review-section-title">Récurrentes — 7 derniers jours</div>
      <div class="adherence-list">${adherence}</div>
    </div>`;
  }

  return html;
}
