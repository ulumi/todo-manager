// ════════════════════════════════════════════════════════
//  BACKLOG / INBOX — préférences d'affichage (tri, colonnes),
//  ordre manuel (drag-and-drop) et rendu des en-têtes de groupe
//  ("commissions"), partagés entre les deux vues quasi-jumelles.
//  Mirrors le pattern de focus.js (getQueuePrefs/saveQueuePrefs).
// ════════════════════════════════════════════════════════

import { esc } from './utils.js';
import { categoryIconSVG } from './admin.js';

// Icône de l'en-tête de groupe (« commissions ») — mêmes conventions que
// render.js (_groupHeaderIconSVG) : trait monochrome, currentColor.
const _groupHeaderIconSVG = `<svg class="task-group-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`;

// { sort: 'date'|'priority'|'title'|'category'|'manual', cols: '1'|'2'|'3'|'4'|'auto',
//   zones: 'category'|'priority'|'deadline'|'plan' }
// Défaut : Récentes, 1 colonne, rail de classement sur Étiquette. Synchronisée
// via getAppConfig()/_applyBackup (clés `backlogQueueView`/`inboxQueueView`).
// `zones` n'est lu que par le Backlog (rail de classement, plus bas) mais vit
// dans le même objet de prefs : il hérite donc gratuitement de sa persistance
// ET de sa synchronisation entre appareils, sans nouvelle clé à câbler.
export function getListPrefs(view) {
  try {
    const p = JSON.parse(localStorage.getItem(`${view}QueueView`));
    if (p) return { sort: p.sort || 'date', cols: p.cols || '1', zones: p.zones || 'category' };
  } catch {}
  // Migration douce depuis l'ancienne clé plate (backlogSort/inboxSort) —
  // garde le tri déjà choisi au lieu de repartir sur "Récentes".
  const legacy = localStorage.getItem(`${view}Sort`);
  return { sort: legacy || 'date', cols: '1', zones: 'category' };
}

export function saveListPrefs(view, prefs) {
  localStorage.setItem(`${view}QueueView`, JSON.stringify(prefs));
}

// ── Ordre manuel (drag-and-drop) ──────────────────────────
// Pas de scoping par jour (contrairement à focusManualOrder) : Backlog/Inbox
// n'ont pas de date, l'ordre est un simple tableau d'ids persistant.
export function loadManualOrder(view) {
  try {
    const ids = JSON.parse(localStorage.getItem(`${view}Order`));
    return Array.isArray(ids) ? ids : [];
  } catch { return []; }
}

export function saveManualOrder(view, ids) {
  localStorage.setItem(`${view}Order`, JSON.stringify(ids));
}

export function applyManualOrder(view, items) {
  const base = [...items].sort((a, b) => b.id.localeCompare(a.id)); // plus récent d'abord
  const order = loadManualOrder(view);
  if (!order.length) return base;
  // Tri stable → les ids inconnus du manuel gardent l'ordre de base, après.
  const idx = id => { const i = order.indexOf(id); return i === -1 ? Infinity : i; };
  return base.sort((a, b) => {
    const ia = idx(a.id), ib = idx(b.id);
    return ia === ib ? 0 : ia - ib;
  });
}

// ── En-têtes de groupe ("commissions") ────────────────────
// Version générique de la logique seen-Set de todoListHTML() (render.js),
// découplée de todoItemHTML() : avant le 1er membre rencontré d'un groupId
// partagé par ≥2 items dans ce tableau, insère un .task-group-header (sans
// draggable — v1 sans drag de groupe entier), puis rend chaque item.
export function renderGroupedItems(items, itemTemplateFn) {
  const seen = new Set();
  return items.map(t => {
    let header = '';
    if (t.groupId && !seen.has(t.groupId)) {
      const members = items.filter(x => x.groupId === t.groupId);
      if (members.length > 1) {
        seen.add(t.groupId);
        const ids = members.map(m => m.id).join(',');
        header = `<div class="task-group-header" data-group="${t.groupId}" data-group-id="${t.groupId}" data-id="${members[0].id}" data-ids="${ids}"><span class="task-group-chip">${_groupHeaderIconSVG}<span class="task-group-title">${esc(t.groupTitle || '')}</span></span></div>`;
      }
    }
    return header + itemTemplateFn(t);
  }).join('');
}

// ════════════════════════════════════════════════════════
//  BACKLOG — RAIL DE CLASSEMENT (glisser-déposer)
//
//  Même geste que le Bilan (on glisse une ligne sur une grosse zone plutôt
//  que de cliquer un bouton par item), mais empilé dans un rail collant à
//  DROITE de la liste au lieu d'un bandeau horizontal : le Backlog se lit sur
//  toute la hauteur de la page, une rangée sous l'en-tête aurait défilé hors
//  de vue au premier scroll.
//
//  Rien à écrire côté drag : `.inbox-item` est déjà `draggable` (planDragStart,
//  render.js) et déjà dans MS_SELECTABLE — donc un drop emporte toute la
//  sélection multiple (app._dropIds) et Alt/Ctrl/Cmd copie au lieu de classer
//  l'original, gratuitement, via app._reviewDrop() partagé avec le Bilan.
//
//  ⚠ Les zones sont de vraies cibles de drop natives : aucun ancêtre du rail
//  ne doit recevoir filter/backdrop-filter/transform/will-change (bug
//  Chromium documenté dans CLAUDE.md) — d'où un fond opaque en mode glass,
//  contrairement aux `.inbox-item` qui, elles, ne sont que sources de drag.
// ════════════════════════════════════════════════════════

// Icônes trait monochromes (currentColor) — jamais d'emoji multicolore.
const _RAIL_ICONS = {
  tag:      `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 2.8 12V4.8A2 2 0 0 1 4.8 2.8H12a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.3"/></svg>`,
  flag:     `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="22" x2="5" y2="3"/><path d="M5 4h13l-2.6 4.5L18 13H5"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  send:     `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/></svg>`,
  none:     `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="5.5" y1="18.5" x2="18.5" y2="5.5"/></svg>`,
  done:     `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  today:    `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.2" y1="4.2" x2="5.6" y2="5.6"/><line x1="18.4" y1="18.4" x2="19.8" y2="19.8"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.2" y1="19.8" x2="5.6" y2="18.4"/><line x1="18.4" y1="5.6" x2="19.8" y2="4.2"/></svg>`,
  inbox:    `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`,
  dot:      `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="5"/></svg>`,
};

// Les 4 familles de zones. `zones` (getListPrefs) retient la dernière choisie.
const BACKLOG_AXES = [
  { key: 'category', label: 'Étiquette', icon: _RAIL_ICONS.tag },
  { key: 'priority', label: 'Priorité',  icon: _RAIL_ICONS.flag },
  { key: 'deadline', label: 'Échéance',  icon: _RAIL_ICONS.calendar },
  { key: 'plan',     label: 'Planifier', icon: _RAIL_ICONS.send },
];

const _DZ_COMMON = `ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="if(!this.contains(event.relatedTarget))this.classList.remove('drag-over')"`;

// Une zone = les classes du Bilan (.overdue-drop-zone, donc mêmes états
// drag-over/succès/danger) + .backlog-zone qui la remet en rangée compacte
// icône-puis-libellé, le rail étant étroit.
function _zone(dropCall, icon, label, { cls = '', style = '', title = '' } = {}) {
  const safe = esc(label);
  return `<div class="overdue-drop-zone backlog-zone${cls}"${style ? ` style="${style}"` : ''} ${_DZ_COMMON}
    ondrop="${dropCall}" title="${esc(title || label)}">
    <span class="overdue-drop-zone-icon">${icon}</span><span class="backlog-zone-label">${safe}</span>
  </div>`;
}

function _categoryZones(categories) {
  if (!categories.length) {
    return `<p class="backlog-rail-empty">Aucune étiquette pour l'instant — créez-en dans la vue Catégories.</p>`;
  }
  const tags = categories.map(c => _zone(
    `window.app.backlogDropCategory(event,'${c.id}')`,
    categoryIconSVG(c.icon, 15) || _RAIL_ICONS.dot,
    c.name,
    { cls: ' backlog-zone--tag', style: `--zone-color:${c.color}`, title: `Étiqueter « ${c.name} »` }
  )).join('');
  return tags + _zone(
    `window.app.backlogDropCategory(event,'')`,
    _RAIL_ICONS.none, 'Sans étiquette',
    { cls: ' backlog-zone--clear', title: 'Retirer toutes les étiquettes' }
  );
}

function _priorityZones() {
  const rows = [
    ['high',   'Haute',   ' backlog-zone--prio-high'],
    ['medium', 'Moyenne', ' backlog-zone--prio-medium'],
    ['low',    'Basse',   ' backlog-zone--prio-low'],
  ];
  return rows.map(([v, label, cls]) => _zone(
    `window.app.backlogDropPriority(event,'${v}')`, _RAIL_ICONS.flag, label, { cls }
  )).join('') + _zone(
    `window.app.backlogDropPriority(event,'')`, _RAIL_ICONS.none, 'Aucune',
    { cls: ' backlog-zone--clear', title: 'Retirer la priorité' }
  );
}

function _deadlineZones() {
  const rows = [
    ['week',    'Cette semaine', 'Échéance : dimanche de cette semaine'],
    ['month',   'Ce mois-ci',    'Échéance : dernier jour du mois'],
    ['quarter', 'Ce trimestre',  'Échéance : dernier jour du trimestre'],
  ];
  return rows.map(([v, label, title]) => _zone(
    `window.app.backlogDropDeadline(event,'${v}')`, _RAIL_ICONS.calendar, label, { title }
  )).join('') + _zone(
    `window.app.backlogDropDeadline(event,'')`, _RAIL_ICONS.none, 'Sans échéance',
    { cls: ' backlog-zone--clear', title: "Retirer l'échéance" }
  );
}

// Zone Aujourd'hui : bascule libellé ↔ Matin/Après-midi/Soir pendant TOUT drag
// dans l'app (body.is-dragging-task, posé par app.planDragStart) — mêmes
// classes et mêmes handlers que le Bilan, pour ne pas dupliquer le CSS.
function _planZones() {
  return `<div class="overdue-drop-zone backlog-zone overdue-drop-zone--today" ${_DZ_COMMON}
      ondrop="window.app.overdueDropToday(event)" title="Planifier aujourd'hui">
      <div class="today-zone-default">
        <span class="overdue-drop-zone-icon">${_RAIL_ICONS.today}</span><span class="backlog-zone-label">Aujourd'hui</span>
      </div>
      <div class="today-zone-periods">
        <div class="today-period-btn today-period-btn--none" ${_DZ_COMMON} ondrop="event.stopPropagation();this.closest('.overdue-drop-zone--today').classList.remove('drag-over');window.app.overdueDropToday(event)" title="Aujourd'hui — sans moment">Sans moment</div>
        <div class="today-period-btn" ${_DZ_COMMON} ondrop="event.stopPropagation();this.closest('.overdue-drop-zone--today').classList.remove('drag-over');window.app.overdueDropTodayPeriod(event,'morning')" title="Aujourd'hui — matin">Matin</div>
        <div class="today-period-btn" ${_DZ_COMMON} ondrop="event.stopPropagation();this.closest('.overdue-drop-zone--today').classList.remove('drag-over');window.app.overdueDropTodayPeriod(event,'afternoon')" title="Aujourd'hui — après-midi">Après-midi</div>
        <div class="today-period-btn" ${_DZ_COMMON} ondrop="event.stopPropagation();this.closest('.overdue-drop-zone--today').classList.remove('drag-over');window.app.overdueDropTodayPeriod(event,'evening')" title="Aujourd'hui — soir">Soir</div>
      </div>
    </div>`
    + _zone(`window.app.overdueDropTomorrow(event)`, _RAIL_ICONS.send, 'Demain', { title: 'Planifier demain' })
    + _zone(`window.app.backlogDropInbox(event)`, _RAIL_ICONS.inbox, 'Inbox', { title: "Sortir du backlog vers l'Inbox (sans date)" })
    + _zone(`window.app.overdueDropDone(event)`, _RAIL_ICONS.done, 'Fait', { cls: ' overdue-drop-zone--done', title: 'Marquer comme faite' })
    + _zone(`window.app.overdueDropCancel(event)`, _RAIL_ICONS.none, 'Abandonner', { cls: ' overdue-drop-zone--cancel', title: 'Abandonner — retrouvable dans « Abandonnées » en bas de la liste' });
}

export function renderBacklogRail(prefs, categories) {
  const axis = BACKLOG_AXES.some(a => a.key === prefs.zones) ? prefs.zones : 'category';
  const axisBtns = BACKLOG_AXES.map(a =>
    `<button class="backlog-axis-btn${a.key === axis ? ' active' : ''}" title="Classer par ${esc(a.label.toLowerCase())}"
      onclick="window.app.setListQueueView('backlog','zones','${a.key}')">${a.icon}</button>`
  ).join('');

  const zones = axis === 'priority' ? _priorityZones()
    : axis === 'deadline' ? _deadlineZones()
    : axis === 'plan'     ? _planZones()
    : _categoryZones(categories);

  const label = BACKLOG_AXES.find(a => a.key === axis).label;

  return `<aside class="backlog-rail" id="backlogRail">
    <div class="backlog-rail-axes">${axisBtns}</div>
    <div class="backlog-rail-title">${esc(label)}</div>
    <div class="backlog-rail-zones">${zones}</div>
    <p class="backlog-rail-hint">Glissez une tâche sur une zone. Alt/⌘ pour classer une copie.</p>
  </aside>`;
}
