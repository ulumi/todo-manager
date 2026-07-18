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

function _itemActions(t, { withToday = true } = {}) {
  return `<div class="review-item-actions">
    <button class="review-act review-act--done" onclick="window.app.reviewDone('${t.id}')" title="Marquer comme faite">✓ Fait</button>
    ${withToday ? `<button class="review-act" onclick="window.app.reviewToToday('${t.id}')" title="Reporter à aujourd'hui">Auj.</button>` : ''}
    <button class="review-act" onclick="window.app.reviewToTomorrow('${t.id}')" title="Reporter à demain">Dem.</button>
    <label class="review-act review-act--date" title="Choisir une date">📅<input type="date" onchange="window.app.reviewSetDate('${t.id}', this.value)"></label>
    <button class="review-act" onclick="window.app.reviewToBacklog('${t.id}')" title="Envoyer au backlog">BL</button>
    <button class="review-act review-act--del" onclick="window.app.reviewCancel('${t.id}')" title="Abandonner (annuler la tâche — reste visible, barrée)">⊘</button>
  </div>`;
}

function _itemRow(t, opts) {
  const prioDot = t.priority ? `<span class="review-prio-dot prio-${t.priority}"></span>` : '';
  return `<div class="review-item" data-id="${t.id}">
    <div class="review-item-main">
      ${prioDot}<span class="review-item-title">${esc(t.title)}</span>${_postponedBadge(t)}
    </div>
    ${_itemActions(t, opts)}
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

// Ponctuelles en retard groupées par jour, avec actions (Fait/Auj./Dem./
// date/BL/abandonner) — partagé entre le modal Bilan et le bandeau de
// rappel de la vue jour (le bilan peut se faire directement dans les deux)
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
      ${items.map(t => _itemRow(t)).join('')}
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
      ${postponed.map(t => _itemRow(t, { withToday: false })).join('')}
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
