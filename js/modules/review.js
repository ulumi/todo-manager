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

function _dayLabel(ds) {
  const diff = Math.round((today() - parseDS(ds)) / 86400000);
  if (diff === 1) return 'Hier';
  if (diff === 2) return 'Avant-hier';
  const d = parseDS(ds);
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

// data-id + data-date : sélectionnable (MS_SELECTABLE), clic droit (menu
// contextuel, résolu via data-date par _resolveOccurrences()) et draggable
// vers les grosses zones de dépôt (renderOverdueDropZones) — aucun bouton
// sur la ligne elle-même, uniquement le titre
function _itemRow(t) {
  const prioDot = t.priority ? `<span class="review-prio-dot prio-${t.priority}"></span>` : '';
  return `<div class="review-item" data-id="${t.id}"${t.date ? ` data-date="${t.date}"` : ''}
    draggable="true"
    ondragstart="event.stopPropagation();window.app.planDragStart(event,'${t.id}');this.classList.add('dragging')"
    ondragend="this.classList.remove('dragging')">
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
const _DZ_COMMON = `ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="if(!this.contains(event.relatedTarget))this.classList.remove('drag-over')"`;
export function renderOverdueDropZones({ onTodayClick = null, bilanLink = false } = {}) {
  const todayClickAttr = onTodayClick ? ` onclick="${onTodayClick}"` : '';
  const todayBadge = onTodayClick ? `<span class="overdue-drop-zone-badge" title="Clic = tout reporter à aujourd'hui">tout</span>` : '';
  return `<div class="overdue-drop-zones">
    <div class="overdue-drop-zone overdue-drop-zone--done" ${_DZ_COMMON} ondrop="window.app.overdueDropDone(event)" title="Marquer comme faite">
      <span class="overdue-drop-zone-icon">✓</span>Fait
    </div>
    <div class="overdue-drop-zone${onTodayClick ? ' overdue-drop-zone--clickable' : ''}" ${_DZ_COMMON}${todayClickAttr} ondrop="window.app.overdueDropToday(event)" title="${onTodayClick ? 'Glisser une tâche : la reporter · Clic : tout reporter à aujourd\'hui' : 'Reporter à aujourd\'hui'}">
      ${todayBadge}<span class="overdue-drop-zone-icon">☀</span>Aujourd'hui
    </div>
    <div class="overdue-drop-zone" ${_DZ_COMMON} ondrop="window.app.overdueDropTomorrow(event)" title="Reporter à demain">
      <span class="overdue-drop-zone-icon">→</span>Demain
    </div>
    <div class="overdue-drop-zone" ${_DZ_COMMON} ondrop="window.app.overdueDropBacklog(event)" title="Envoyer au backlog">
      <span class="overdue-drop-zone-icon">🗂</span>Backlog
    </div>
    <div class="overdue-drop-zone overdue-drop-zone--cancel" ${_DZ_COMMON} ondrop="window.app.overdueDropCancel(event)" title="Abandonner (annuler la tâche — reste visible, barrée)">
      <span class="overdue-drop-zone-icon">⊘</span>Abandonner
    </div>
    ${bilanLink ? `<div class="overdue-drop-zone overdue-drop-zone--link" onclick="window.app.openReviewModal()" title="Ouvrir le bilan complet">
      <span class="overdue-drop-zone-icon">📋</span>Bilan complet
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
// Bilan et le bandeau de rappel de la vue jour
export function renderOverdueGroups(overdue) {
  if (!overdue.length) return '';
  const byDate = new Map();
  overdue.forEach(t => {
    if (!byDate.has(t.date)) byDate.set(t.date, []);
    byDate.get(t.date).push(t);
  });
  return [...byDate.entries()].map(([ds, items]) => `
    <div class="review-group">
      <div class="review-group-label">${_dayLabel(ds)}<span class="review-group-count">${items.length}</span></div>
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
