// ════════════════════════════════════════════════════════
//  BACKLOG / INBOX — préférences d'affichage (tri, colonnes),
//  ordre manuel (drag-and-drop) et rendu des en-têtes de groupe
//  ("commissions"), partagés entre les deux vues quasi-jumelles.
//  Mirrors le pattern de focus.js (getQueuePrefs/saveQueuePrefs).
// ════════════════════════════════════════════════════════

import { esc, DS, today, addDays, startOfWeek } from './utils.js';
import { categoryIconSVG } from './admin.js';

// Icône de l'en-tête de groupe (« commissions ») — mêmes conventions que
// render.js (_groupHeaderIconSVG) : trait monochrome, currentColor.
const _groupHeaderIconSVG = `<svg class="task-group-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`;

// { sort: 'date'|'priority'|'title'|'category'|'manual', cols: '1'|'2'|'3'|'4'|'auto',
//   rail: string[], railFold: string[] }
// Défaut : Récentes, 1 colonne, rail sur Échéance + Planifier. Synchronisée
// via getAppConfig()/_applyBackup (clés `backlogQueueView`/`inboxQueueView`).
// `rail`/`railFold` ne sont lus que par le Backlog (rail de classement, plus
// bas) mais vivent dans le même objet de prefs : ils héritent donc
// gratuitement de sa persistance ET de sa synchronisation entre appareils,
// sans nouvelle clé à câbler. `rail` est un tableau ORDONNÉ : il porte à lui
// seul l'état épinglé (« est dedans ») et l'ordre (« son index »).
export function getListPrefs(view) {
  try {
    const p = JSON.parse(localStorage.getItem(`${view}QueueView`));
    if (p) return {
      sort: p.sort || 'date',
      cols: p.cols || '1',
      rail: Array.isArray(p.rail) ? p.rail : null,
      railFold: Array.isArray(p.railFold) ? p.railFold : [],
    };
  } catch {}
  // Migration douce depuis l'ancienne clé plate (backlogSort/inboxSort) —
  // garde le tri déjà choisi au lieu de repartir sur "Récentes".
  const legacy = localStorage.getItem(`${view}Sort`);
  return { sort: legacy || 'date', cols: '1', rail: null, railFold: [] };
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
//  BACKLOG — RAIL DE CLASSEMENT (modules épinglables)
//
//  Même geste que le Bilan (on glisse une ligne sur une grosse zone plutôt
//  que de cliquer un bouton par item), mais empilé dans un rail collant à
//  DROITE de la liste : le Backlog se lit sur toute la hauteur de la page,
//  un bandeau horizontal aurait défilé hors de vue au premier scroll.
//
//  DEUX FAMILLES DE MODULES, à ne pas confondre :
//  - `zones`  : des VALEURS qu'on pose sur une tâche (étiquette, priorité,
//               échéance, estimation, projet, intention, planification).
//               Glisser écrit la valeur ; cliquer filtre la liste dessus.
//  - `piles`  : des CONSTATS calculés (quick wins, qui traînent, non
//               classées…). Cliquer filtre — mais on ne glisse JAMAIS
//               dessus : on ne peut pas « poser » l'ancienneté d'une tâche.
//               D'où l'absence totale de handlers de drop sur ces zones.
//
//  ÉPINGLAGE : `prefs.rail` est un tableau ORDONNÉ de clés de modules — il
//  porte à lui seul l'état épinglé (« est dans le tableau ») ET l'ordre
//  (« son index »), et vit dans le même objet de prefs que sort/cols, donc
//  hérite gratuitement de la persistance et de la synchro entre appareils.
//  `prefs.railFold` liste les modules repliés (le pin reste, les zones se
//  cachent) pour garder 4 modules épinglés sans faire déborder le rail.
//
//  Rien à écrire côté drag : `.inbox-item` est déjà `draggable`
//  (planDragStart, render.js) et déjà dans MS_SELECTABLE — donc un drop
//  emporte toute la sélection multiple (app._dropIds) et Alt/Ctrl/Cmd copie
//  au lieu de classer l'original, gratuitement, via app._reviewDrop().
//
//  ⚠ Les zones sont de vraies cibles de drop natives : aucun ancêtre du rail
//  ne doit recevoir filter/backdrop-filter/transform/will-change (bug
//  Chromium documenté dans CLAUDE.md) — d'où un fond opaque en mode glass,
//  contrairement aux `.inbox-item` qui, elles, ne sont que sources de drag.
// ════════════════════════════════════════════════════════

// Back-compat avec le format mono-id (le boot migre vers les tableaux)
const _catIds = t => t.categoryIds  || (t.categoryId  ? [t.categoryId]  : []);
const _projIds = t => t.projectIds   || (t.projectId   ? [t.projectId]   : []);
const _intIds = t => t.intentionIds || (t.intentionId ? [t.intentionId] : []);

// Icônes trait monochromes (currentColor) — jamais d'emoji multicolore.
const _RI = {
  tag:       `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 2.8 12V4.8A2 2 0 0 1 4.8 2.8H12a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.3"/></svg>`,
  flag:      `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="22" x2="5" y2="3"/><path d="M5 4h13l-2.6 4.5L18 13H5"/></svg>`,
  calendar:  `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  send:      `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/></svg>`,
  clock:     `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>`,
  folder:    `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`,
  target:    `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/></svg>`,
  funnel:    `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18l-7 8v6l-4 2v-8z"/></svg>`,
  none:      `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="5.5" y1="18.5" x2="18.5" y2="5.5"/></svg>`,
  done:      `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  today:     `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.2" y1="4.2" x2="5.6" y2="5.6"/><line x1="18.4" y1="18.4" x2="19.8" y2="19.8"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.2" y1="19.8" x2="5.6" y2="18.4"/><line x1="18.4" y1="5.6" x2="19.8" y2="4.2"/></svg>`,
  inbox:     `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`,
  dot:       `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="5"/></svg>`,
  bolt:      `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 4 14 11 14 10 22 20 10 13 10"/></svg>`,
  hourglass: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h10M7 21h10M8 3v4l4 5 4-5V3M8 21v-4l4-5 4 5v4"/></svg>`,
  dust:      `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 6 12 12 16 14"/><line x1="3" y1="3" x2="6" y2="6"/></svg>`,
  back:      `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 5 4 10 9 15"/><path d="M4 10h10a6 6 0 0 1 0 12h-3"/></svg>`,
  alert:     `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 20h20z"/><line x1="12" y1="9" x2="12" y2="14"/><line x1="12" y1="17" x2="12" y2="17.01"/></svg>`,
  scissors:  `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.1" y2="15.9"/><line x1="14.5" y1="14.5" x2="20" y2="20"/><line x1="8.1" y1="8.1" x2="12" y2="12"/></svg>`,
  pin:       `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3z"/></svg>`,
  grip:      `<svg viewBox="0 0 10 16" width="9" height="14" fill="currentColor"><circle cx="2.5" cy="3" r="1.3"/><circle cx="7.5" cy="3" r="1.3"/><circle cx="2.5" cy="8" r="1.3"/><circle cx="7.5" cy="8" r="1.3"/><circle cx="2.5" cy="13" r="1.3"/><circle cx="7.5" cy="13" r="1.3"/></svg>`,
  chevron:   `<svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 4 6 7 9 4"/></svg>`,
};

// Catalogue. L'ordre ici = l'ordre des pastilles de pin, jamais celui du
// rail (qui vient de prefs.rail).
export const RAIL_MODULES = [
  { key: 'deadline',  label: 'Échéance',   icon: _RI.calendar },
  { key: 'plan',      label: 'Planifier',  icon: _RI.send },
  { key: 'category',  label: 'Étiquette',  icon: _RI.tag },
  { key: 'priority',  label: 'Priorité',   icon: _RI.flag },
  { key: 'estimate',  label: 'Estimation', icon: _RI.clock },
  { key: 'project',   label: 'Projet',     icon: _RI.folder },
  { key: 'intention', label: 'Intention',  icon: _RI.target },
  { key: 'piles',     label: 'Piles',      icon: _RI.funnel },
];
const RAIL_KEYS = RAIL_MODULES.map(m => m.key);
export const RAIL_DEFAULT_PINS = ['deadline', 'plan'];

// Un rail explicitement VIDÉ (tableau vide) reste vide — seul un rail jamais
// configuré (absent/null) retombe sur le défaut. Sans cette distinction,
// détacher le dernier module ferait réapparaître les deux modules par défaut,
// ce qui ressemble à un bug plutôt qu'à un choix.
export function getRailPins(prefs) {
  if (!Array.isArray(prefs.rail)) return [...RAIL_DEFAULT_PINS];
  return prefs.rail.filter(k => RAIL_KEYS.includes(k));
}

export function getRailFolds(prefs) {
  return Array.isArray(prefs.railFold) ? prefs.railFold.filter(k => RAIL_KEYS.includes(k)) : [];
}

// ── Filtre actif ──────────────────────────────────────────
// Volontairement NON synchronisé (localStorage seul, comme calSidebarCollapsed
// ou subtasksCollapsed) : un filtre est un état de travail du moment. Le
// retrouver appliqué sur le téléphone, backlog en apparence vide, serait un
// piège — alors que l'épinglage et l'ordre des modules, eux, sont bien une
// préférence durable et voyagent avec le compte.
const RAIL_FILTER_KEY = 'backlogRailFilter';

export function getRailFilter() {
  try {
    const f = JSON.parse(localStorage.getItem(RAIL_FILTER_KEY));
    // `val` peut légitimement être la chaîne vide — c'est la clé des zones
    // « Sans étiquette / Aucune priorité / Sans échéance / Sans estimation ».
    // Un simple test de véracité rejetterait donc silencieusement le filtre le
    // plus utile de tous (« montre-moi ce qui n'est pas classé »).
    return f && f.mod && typeof f.val === 'string' ? f : null;
  } catch { return null; }
}

export function setRailFilter(f) {
  if (f) localStorage.setItem(RAIL_FILTER_KEY, JSON.stringify(f));
  else localStorage.removeItem(RAIL_FILTER_KEY);
}

// ── Horizons d'échéance ───────────────────────────────────
// Partagés entre l'écriture (app.backlogDropDeadline) et la lecture (compteurs
// + filtre) : une seule définition, sinon un item déposé sur « Ce mois-ci »
// pourrait ne pas se retrouver dans le compte de cette même zone.
export function deadlineHorizonDS(kind) {
  const d = today();
  if (kind === 'week')    return DS(addDays(startOfWeek(d), 6));                       // dimanche
  if (kind === 'month')   return DS(new Date(d.getFullYear(), d.getMonth() + 1, 0));   // dernier jour du mois
  if (kind === 'quarter') return DS(new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3 + 3, 0));
  return null;
}

// Jours depuis la création — t.id = Date.now() à la création (même convention
// que review.js ageBadge / calendar.js getTodosForDate)
function _ageDays(t) {
  const created = parseInt(t.id, 10);
  if (isNaN(created)) return 0;
  return Math.floor((Date.now() - created) / 86400000);
}

const STALE_DAYS = 60;

// ── Piles : des CONSTATS, jamais des cibles de drop ───────
export const RAIL_PILES = [
  { key: 'quickwins',  label: 'Quick wins',       icon: _RI.bolt,      hint: 'Estimées à 15 min ou moins',              test: t => !!t.durationEstimated && t.durationEstimated <= 15 },
  { key: 'noestimate', label: 'Sans estimation',  icon: _RI.hourglass, hint: 'Aucune durée estimée',                    test: t => !t.durationEstimated },
  { key: 'stale',      label: 'Qui traînent',     icon: _RI.dust,      hint: `Créées il y a plus de ${STALE_DAYS} jours`, test: t => _ageDays(t) > STALE_DAYS },
  { key: 'postponed',  label: 'Souvent reportées',icon: _RI.back,      hint: 'Reportées 2 fois ou plus',                test: t => (t.postponedCount || 0) >= 2 },
  { key: 'pastdue',    label: 'Échéance dépassée',icon: _RI.alert,     hint: "L'échéance que tu t'étais donnée est passée", test: t => !!t.deadline && t.deadline < DS(today()) },
  { key: 'unsorted',   label: 'Non classées',     icon: _RI.none,      hint: 'Ni étiquette, ni projet, ni intention',   test: t => !_catIds(t).length && !_projIds(t).length && !_intIds(t).length },
  { key: 'big',        label: 'Trop grosses',     icon: _RI.scissors,  hint: 'Au moins 2 h et aucune sous-tâche — à découper', test: t => (t.durationEstimated || 0) >= 120 && !(t.subtasks || []).length },
];

// ── Descripteurs de zones, par module ─────────────────────
// { key, label, icon, test?, drop?, cls?, style?, hint?, wide? }
//  - test  présent → zone comptée ET cliquable (filtre)
//  - drop  présent → zone recevant un glisser (classement)
function _moduleZones(modKey, ctx) {
  const { categories = [], projects = [], intentions = [] } = ctx;

  if (modKey === 'category') {
    if (!categories.length) return { empty: "Aucune étiquette — créez-en dans la vue Catégories." };
    return { zones: [
      ...categories.map(c => ({
        key: c.id, label: c.name, icon: categoryIconSVG(c.icon, 15) || _RI.dot,
        cls: 'backlog-zone--tag', style: `--zone-color:${c.color}`,
        drop: `window.app.backlogDropCategory(event,'${c.id}')`,
        test: t => _catIds(t).includes(c.id),
      })),
      { key: '', label: 'Sans étiquette', icon: _RI.none, cls: 'backlog-zone--clear',
        drop: `window.app.backlogDropCategory(event,'')`, test: t => !_catIds(t).length },
    ] };
  }

  if (modKey === 'project') {
    // Projets terminés/archivés exclus : on ne classe pas dans une coquille vide
    const act = projects.filter(p => p.status !== 'archived' && p.status !== 'completed');
    if (!act.length) return { empty: 'Aucun projet actif.' };
    return { zones: [
      ...act.map(p => ({
        key: p.id, label: p.name, icon: _RI.folder,
        cls: 'backlog-zone--tag', style: `--zone-color:${p.color}`,
        drop: `window.app.backlogDropProject(event,'${p.id}')`,
        test: t => _projIds(t).includes(p.id),
      })),
      { key: '', label: 'Sans projet', icon: _RI.none, cls: 'backlog-zone--clear',
        drop: `window.app.backlogDropProject(event,'')`, test: t => !_projIds(t).length },
    ] };
  }

  if (modKey === 'intention') {
    if (!intentions.length) return { empty: 'Aucune intention définie.' };
    return { zones: [
      ...intentions.map(i => ({
        key: i.id, label: i.title || '—', icon: _RI.target,
        cls: 'backlog-zone--tag', style: `--zone-color:${i.color || 'var(--primary)'}`,
        drop: `window.app.backlogDropIntention(event,'${i.id}')`,
        test: t => _intIds(t).includes(i.id),
      })),
      { key: '', label: 'Sans intention', icon: _RI.none, cls: 'backlog-zone--clear',
        drop: `window.app.backlogDropIntention(event,'')`, test: t => !_intIds(t).length },
    ] };
  }

  if (modKey === 'priority') {
    return { zones: [
      { key: 'high',   label: 'Haute',   icon: _RI.flag, cls: 'backlog-zone--prio-high',   drop: `window.app.backlogDropPriority(event,'high')`,   test: t => t.priority === 'high' },
      { key: 'medium', label: 'Moyenne', icon: _RI.flag, cls: 'backlog-zone--prio-medium', drop: `window.app.backlogDropPriority(event,'medium')`, test: t => t.priority === 'medium' },
      { key: 'low',    label: 'Basse',   icon: _RI.flag, cls: 'backlog-zone--prio-low',    drop: `window.app.backlogDropPriority(event,'low')`,    test: t => t.priority === 'low' },
      { key: '',       label: 'Aucune',  icon: _RI.none, cls: 'backlog-zone--clear',       drop: `window.app.backlogDropPriority(event,'')`,       test: t => !t.priority },
    ] };
  }

  if (modKey === 'deadline') {
    // Tranches EXCLUSIVES (et non « ≤ horizon » qui compterait la semaine dans
    // le mois) : chaque item de backlog tombe dans exactement une zone.
    const w = deadlineHorizonDS('week'), m = deadlineHorizonDS('month'), q = deadlineHorizonDS('quarter');
    return { zones: [
      { key: 'week',    label: 'Cette semaine', icon: _RI.calendar, hint: `Échéance au ${w}`, drop: `window.app.backlogDropDeadline(event,'week')`,    test: t => !!t.deadline && t.deadline <= w },
      { key: 'month',   label: 'Ce mois-ci',    icon: _RI.calendar, hint: `Échéance au ${m}`, drop: `window.app.backlogDropDeadline(event,'month')`,   test: t => !!t.deadline && t.deadline > w && t.deadline <= m },
      { key: 'quarter', label: 'Ce trimestre',  icon: _RI.calendar, hint: `Échéance au ${q}`, drop: `window.app.backlogDropDeadline(event,'quarter')`, test: t => !!t.deadline && t.deadline > m && t.deadline <= q },
      { key: '',        label: 'Sans échéance', icon: _RI.none, cls: 'backlog-zone--clear',   drop: `window.app.backlogDropDeadline(event,'')`,        test: t => !t.deadline },
    ] };
  }

  if (modKey === 'estimate') {
    return { zones: [
      { key: '15',  label: '≤ 15 min', icon: _RI.clock, drop: `window.app.backlogDropEstimate(event,15)`,  test: t => !!t.durationEstimated && t.durationEstimated <= 15 },
      { key: '30',  label: '30 min',   icon: _RI.clock, drop: `window.app.backlogDropEstimate(event,30)`,  test: t => t.durationEstimated > 15 && t.durationEstimated <= 30 },
      { key: '60',  label: '1 h',      icon: _RI.clock, drop: `window.app.backlogDropEstimate(event,60)`,  test: t => t.durationEstimated > 30 && t.durationEstimated <= 60 },
      { key: '120', label: '2 h +',    icon: _RI.clock, drop: `window.app.backlogDropEstimate(event,120)`, test: t => t.durationEstimated > 60 },
      { key: '',    label: 'Sans estimation', icon: _RI.none, cls: 'backlog-zone--clear', drop: `window.app.backlogDropEstimate(event,0)`, test: t => !t.durationEstimated },
    ] };
  }

  if (modKey === 'piles') {
    // Aucun `drop` : on ne pose pas un constat sur une tâche (cf. en-tête)
    return { zones: RAIL_PILES.map(p => ({ ...p, wide: true, cls: 'backlog-zone--pile' })) };
  }

  // 'plan' — des ACTIONS, pas des états : ni compteur ni filtre possible
  return { zones: [
    { key: 'today', label: "Aujourd'hui", icon: _RI.today, wide: true, today: true },
    { key: 'tomorrow', label: 'Demain', icon: _RI.send, drop: `window.app.overdueDropTomorrow(event)` },
    { key: 'inbox', label: 'Inbox', icon: _RI.inbox, drop: `window.app.backlogDropInbox(event)` },
    { key: 'done', label: 'Fait', icon: _RI.done, cls: 'overdue-drop-zone--done', drop: `window.app.overdueDropDone(event)` },
    { key: 'cancel', label: 'Abandonner', icon: _RI.none, cls: 'overdue-drop-zone--cancel', drop: `window.app.overdueDropCancel(event)` },
  ] };
}

// Prédicat du filtre actif — résolu depuis les MÊMES descripteurs que les
// zones, donc « ce que la zone compte » et « ce que le filtre garde » ne
// peuvent pas diverger.
export function railFilterFn(filter, ctx) {
  if (!filter) return null;
  const z = (_moduleZones(filter.mod, ctx).zones || []).find(x => x.key === filter.val);
  return z && z.test ? z.test : null;
}

export function railFilterLabel(filter, ctx) {
  if (!filter) return '';
  const z = (_moduleZones(filter.mod, ctx).zones || []).find(x => x.key === filter.val);
  return z ? z.label : '';
}

const _DZ_COMMON = `ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="if(!this.contains(event.relatedTarget))this.classList.remove('drag-over')"`;

function _zoneHTML(modKey, z, items, filter) {
  const count  = z.test ? items.filter(z.test).length : null;
  const active = !!filter && filter.mod === modKey && filter.val === z.key;
  const cls = ['overdue-drop-zone', 'backlog-zone', z.cls || '', z.wide ? 'backlog-zone--wide' : '',
    z.test ? 'is-clickable' : '', active ? 'is-filtered' : '', count === 0 ? 'is-empty' : ''].filter(Boolean).join(' ');
  const dropAttrs  = z.drop ? ` ${_DZ_COMMON} ondrop="${z.drop}"` : '';
  const clickAttr  = z.test ? ` onclick="window.app.railFilter('${modKey}','${z.key}')"` : '';
  const title = esc(z.hint || (z.drop ? `Glisser ici : ${z.label}` : z.label)
    + (z.test ? (active ? ' · clic pour retirer le filtre' : ' · clic pour filtrer') : ''));
  return `<div class="${cls}"${z.style ? ` style="${z.style}"` : ''}${dropAttrs}${clickAttr} title="${title}">
      <span class="overdue-drop-zone-icon">${z.icon}</span>
      <span class="backlog-zone-label">${esc(z.label)}</span>
      ${count !== null ? `<span class="backlog-zone-count">${count}</span>` : ''}
    </div>`;
}

// Zone Aujourd'hui : bascule libellé ↔ Matin/Après-midi/Soir pendant TOUT drag
// dans l'app (body.is-dragging-task, posé par app.planDragStart) — mêmes
// classes et mêmes handlers que le Bilan, pour ne pas dupliquer le CSS.
function _todayZoneHTML() {
  const sub = (label, call, extra = '') =>
    `<div class="today-period-btn${extra}" ${_DZ_COMMON} ondrop="event.stopPropagation();this.closest('.overdue-drop-zone--today').classList.remove('drag-over');${call}" title="Aujourd'hui — ${esc(label.toLowerCase())}">${label}</div>`;
  return `<div class="overdue-drop-zone backlog-zone backlog-zone--wide overdue-drop-zone--today" ${_DZ_COMMON}
      ondrop="window.app.overdueDropToday(event)" title="Planifier aujourd'hui">
      <div class="today-zone-default">
        <span class="overdue-drop-zone-icon">${_RI.today}</span><span class="backlog-zone-label">Aujourd'hui</span>
      </div>
      <div class="today-zone-periods">
        ${sub('Sans moment', 'window.app.overdueDropToday(event)', ' today-period-btn--none')}
        ${sub('Matin', "window.app.overdueDropTodayPeriod(event,'morning')")}
        ${sub('Après-midi', "window.app.overdueDropTodayPeriod(event,'afternoon')")}
        ${sub('Soir', "window.app.overdueDropTodayPeriod(event,'evening')")}
      </div>
    </div>`;
}

export function renderBacklogRail(prefs, ctx) {
  const pins   = getRailPins(prefs);
  const folds  = getRailFolds(prefs);
  const filter = getRailFilter();
  const items  = ctx.items || [];

  // Pastilles de pin : allumée = module dans le rail. L'ordre des pastilles
  // est celui du catalogue, jamais celui du rail — sinon elles danseraient à
  // chaque réordonnancement.
  const pinBtns = RAIL_MODULES.map(m =>
    `<button class="backlog-axis-btn${pins.includes(m.key) ? ' active' : ''}" title="${esc(m.label)} — ${pins.includes(m.key) ? 'détacher du rail' : 'épingler au rail'}"
      onclick="window.app.toggleRailPin('${m.key}')">${m.icon}</button>`
  ).join('');

  const mods = pins.map(key => {
    const m = RAIL_MODULES.find(x => x.key === key);
    if (!m) return '';
    const folded = folds.includes(key);
    const { zones, empty } = _moduleZones(key, ctx);
    const body = empty
      ? `<p class="backlog-rail-empty">${esc(empty)}</p>`
      : `<div class="rail-zones">${zones.map(z => z.today ? _todayZoneHTML() : _zoneHTML(key, z, items, filter)).join('')}</div>`;
    return `<div class="rail-mod rail-mod--${key}${folded ? ' folded' : ''}" data-mod="${key}">
        <div class="rail-mod-hd" draggable="true" onclick="if(!event.target.closest('.rail-mod-unpin'))window.app.toggleRailFold('${key}')" title="Glisser pour réordonner · clic pour replier">
          <span class="rail-mod-grip">${_RI.grip}</span>
          <span class="rail-mod-icon">${m.icon}</span>
          <span class="rail-mod-title">${esc(m.label)}</span>
          <span class="rail-mod-chevron">${_RI.chevron}</span>
          <button class="rail-mod-unpin" onclick="event.stopPropagation();window.app.toggleRailPin('${key}')" title="Détacher du rail">${_RI.pin}</button>
        </div>
        <div class="rail-mod-body"><div class="rail-mod-body-inner">${body}</div></div>
      </div>`;
  }).join('');

  // Bandeau pleine largeur AU-DESSUS de la liste (et non plus une colonne de
  // 220px à droite, trop étroite dès que deux modules sont épinglés) : les
  // pastilles de pin et l'aide tiennent sur une ligne, les modules s'étalent
  // en grille en dessous.
  const hint = pins.length
    ? `<p class="backlog-rail-hint">Glisser = classer · clic = filtrer · Alt/⌘ = classer une copie</p>`
    : `<p class="backlog-rail-hint">Aucun module épinglé — activez-en un à gauche.</p>`;

  return `<aside class="backlog-rail" id="backlogRail">
    <div class="backlog-rail-bar">
      <span class="backlog-rail-lbl">Classer</span>
      <div class="backlog-rail-axes">${pinBtns}</div>
      ${hint}
    </div>
    ${pins.length ? `<div class="backlog-rail-mods" id="backlogRailMods">${mods}</div>` : ''}
  </aside>`;
}
