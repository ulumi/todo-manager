// ════════════════════════════════════════════════════════
//  BACKLOG / INBOX — préférences d'affichage (tri, colonnes),
//  ordre manuel (drag-and-drop) et rendu des en-têtes de groupe
//  ("commissions"), partagés entre les deux vues quasi-jumelles.
//  Mirrors le pattern de focus.js (getQueuePrefs/saveQueuePrefs).
// ════════════════════════════════════════════════════════

import { esc } from './utils.js';

// { sort: 'date'|'priority'|'title'|'category'|'manual', cols: '1'|'2'|'3' }
// Défaut : Récentes, 1 colonne. Synchronisée via getAppConfig()/_applyBackup
// (clés `backlogQueueView`/`inboxQueueView`).
export function getListPrefs(view) {
  try {
    const p = JSON.parse(localStorage.getItem(`${view}QueueView`));
    if (p) return { sort: p.sort || 'date', cols: p.cols || '1' };
  } catch {}
  // Migration douce depuis l'ancienne clé plate (backlogSort/inboxSort) —
  // garde le tri déjà choisi au lieu de repartir sur "Récentes".
  const legacy = localStorage.getItem(`${view}Sort`);
  return { sort: legacy || 'date', cols: '1' };
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
        header = `<div class="task-group-header" data-group="${t.groupId}" data-id="${members[0].id}" data-ids="${ids}"><span class="task-group-title">${esc(t.groupTitle || '')}</span></div>`;
      }
    }
    return header + itemTemplateFn(t);
  }).join('');
}
