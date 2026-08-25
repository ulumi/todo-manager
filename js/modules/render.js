// ════════════════════════════════════════════════════════
//  RENDERING FUNCTIONS
// ════════════════════════════════════════════════════════

import { DS, addDays, startOfWeek, daysInMonth, firstDayOfMonth, esc, isSubtaskCollapsed, effectiveEstimate, daySplitVars } from './utils.js';
import { getTodosForDate, isCompleted, isCancelled, getSuggestions, getRecentTasks } from './calendar.js';
import * as state from './state.js';
import { getCategories, categoryIconSVG } from './admin.js';
import { getProjects, PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from './projectManager.js';
import { renderAdherenceRows, computeTimeStats, renderTimeStatsRows, computeTotalFocusMinutes, fmtMinutes, getOverduePunctual, renderOverdueGroups, renderOverdueDropZones, dayLabel, ageBadge, deadlineBadge } from './review.js';
import { renderRefillPanel } from './focus.js';
import { getListPrefs, applyManualOrder, renderGroupedItems, renderBacklogRail, getRailFilter, railFilterFn, railFilterLabel } from './backlogInboxView.js';
import { renderAgendaBody, agendaSwitchButtonHTML, getDayLayout } from './agendaView.js';

// Helper: get category/project/intention IDs (back-compat with old single-ID format)
function _getCatIds(t) { return t.categoryIds || (t.categoryId ? [t.categoryId] : []); }
function _getProjIds(t) { return t.projectIds || (t.projectId ? [t.projectId] : []); }
function _getIntIds(t) { return t.intentionIds || (t.intentionId ? [t.intentionId] : []); }
function _hasCat(t, id) { return _getCatIds(t).includes(id); }
function _hasProj(t, id) { return _getProjIds(t).includes(id); }
function _hasInt(t, id) { return _getIntIds(t).includes(id); }

const _dragHandleSVG = `<svg width="12" height="10" viewBox="0 0 12 10" fill="currentColor"><rect y="0" width="12" height="2" rx="1"/><rect y="4" width="12" height="2" rx="1"/><rect y="8" width="12" height="2" rx="1"/></svg>`;

// Icône de l'en-tête de groupe de tâches (« commissions ») — trait
// monochrome, currentColor (jamais de couleur figée, cf. CLAUDE.md), la
// distingue visuellement des en-têtes de moment/type qui n'en ont pas.
const _groupHeaderIconSVG = `<svg class="task-group-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`;

// Badge de la zone « imbriquer » (glisser-déposer, voir app.js
// initDayDragDrop/initQueueListDnD/initSubtaskDragDrop) — toujours présent
// dans le DOM, visibilité pilotée uniquement par .drop-nest en CSS (jamais
// injecté/retiré pendant le drag).
const _nestIconSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/></svg>`;
const _nestBadgeHTML = `<span class="dnd-nest-badge" aria-hidden="true">${_nestIconSVG}<span>Sous-tâche</span></span>`;

// Flèches d'insertion avant/après (glisser-déposer) — un simple liseré
// interne était trop discret (retour utilisateur) : pastille + chevron
// pleins, pinnés au bord haut/bas de la carte, toujours dans le DOM,
// visibilité pilotée par .drop-before/.drop-after en CSS (jamais injectées/
// retirées pendant le drag, même logique que le badge « imbriquer »).
const _arrowUpSVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5l7 7H5z"/></svg>`;
const _arrowDownSVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 19l-7-7h14z"/></svg>`;
const _edgeArrowsHTML = `<span class="dnd-edge-arrow dnd-edge-arrow--before" aria-hidden="true">${_arrowUpSVG}</span><span class="dnd-edge-arrow dnd-edge-arrow--after" aria-hidden="true">${_arrowDownSVG}</span>`;

const _subtaskChevronSVG = (collapsed) => `<svg class="subtask-toggle-chevron${collapsed ? ' collapsed' : ''}" viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 4 6 7 9 4"/></svg>`;

// Exportée : app.ctxAddSubtask()/ctxAddNestedSubtask() injectent ce même
// bloc par patch DOM ciblé (pas de render() complet) quand une tâche ou une
// sous-tâche sans enfant en reçoit son premier. parentStid non-null = on
// rend le niveau sous-sous-tâche POUR cette sous-tâche précise — jamais plus
// profond (décision produit : un seul niveau d'imbrication supplémentaire),
// d'où `!parentStid` qui garde la récursion à un seul cran ci-dessous.
// ds vide = item sans date (cartes Inbox/Backlog) : la file Focus ne couvre
// que la journée en cours, donc focusStartOn() n'y ferait rien — le bouton ▶
// est masqué plutôt que laissé mort à l'écran (le ds vide se propage aux
// listes imbriquées via data-ds, cf. app.ctxAddNestedSubtask).
export function subtaskListHTML(subtasks, todoId, ds, parentStid = null) {
  const canFocus = !!ds;
  const items = (subtasks || []).map(s => {
    const args = parentStid ? `,'${parentStid}'` : '';
    const child = !parentStid && s.subtasks?.length
      ? subtaskListHTML(s.subtasks, todoId, ds, s.id)
      : '';
    // Une estimation déjà posée est de l'INFORMATION (comme .todo-focustime-
    // badge sur la tâche parente) — toujours visible, jamais réservée en
    // pointillés. Le ghost « + durée », lui, n'est qu'une AFFORDANCE d'ajout :
    // il ne doit apparaître qu'au survol de la ligne, via .subtask-estimate-
    // slot, replié en largeur tant que non survolé (même technique que
    // .subtask-add-mini-slot juste plus bas, largeur au lieu de hauteur) — le
    // laisser réserver sa place en permanence, même invisible, écrasait le
    // titre dans les cartes étroites (Backlog/Inbox en plusieurs colonnes).
    // .subtask-focus-btn/.subtask-del (juste après) ne se disputent plus
    // cette largeur : ▶/× vivent dans .subtask-action-slot, un overlay
    // position:absolute totalement hors du flux (voir le commentaire sur
    // .subtask-action-slot, styles.scss) — sinon les deux slots réclamaient
    // chacun leur pleine largeur au survol et le second (▶/×, dernier dans
    // l'ordre) se retrouvait poussé hors champ dans une carte étroite.
    const est = effectiveEstimate(s);
    const estimateHTML = est
      ? `<span class="subtask-estimate-badge" onclick="event.stopPropagation();window.app.editSubtaskEstimate(this,'${todoId}','${s.id}','${ds}'${args})" title="Durée estimée — cliquer pour modifier">${s.durationEstimated ? `${s.durationEstimated} min` : `~${est} min`}</span>`
      : `<span class="subtask-estimate-slot"><span class="subtask-estimate-badge ghost" onclick="event.stopPropagation();window.app.editSubtaskEstimate(this,'${todoId}','${s.id}','${ds}'${args})" title="Ajouter une durée estimée">+ durée</span></span>`;
    return `
    <div class="subtask-item${s.completed ? ' done' : ''}" data-todo-id="${todoId}" data-stid="${s.id}" data-ds="${ds}"${parentStid ? ` data-parent-stid="${parentStid}"` : ''} draggable="true">
      ${_edgeArrowsHTML}
      ${!parentStid ? _nestBadgeHTML : ''}
      <div class="subtask-check${s.completed ? ' done' : ''}" onclick="event.stopPropagation();window.app.toggleSubtask('${todoId}','${s.id}','${ds}'${args})"></div>
      <span class="subtask-title${s.completed ? ' done' : ''}" onclick="event.stopPropagation();window.app.editSubtaskTitle(this,'${todoId}','${s.id}','${ds}'${args})">${esc(s.title)}</span>
      ${estimateHTML}
      <span class="subtask-action-slot">
        ${canFocus ? `<button class="subtask-focus-btn" onclick="event.stopPropagation();window.app.focusStartOn('${todoId}','${ds}','${parentStid || s.id}')" title="Focus sur cette tâche">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5.5v13a1 1 0 0 0 1.53.85l10.5-6.5a1 1 0 0 0 0-1.7L8.53 4.65A1 1 0 0 0 7 5.5Z"/></svg>
        </button>` : ''}
        <button class="subtask-del" onclick="event.stopPropagation();window.app.deleteSubtask('${todoId}','${s.id}','${ds}'${args})">×</button>
      </span>
    </div>${child}`;
  }).join('');
  return `<div class="subtask-list${parentStid ? ' subtask-list--nested' : ''}"${parentStid ? ` data-parent-stid="${parentStid}"` : ''}>
    ${items}
    <span class="subtask-add-mini-slot">
      <button class="subtask-add-mini" onclick="event.stopPropagation();window.app.addSubtaskInline('${todoId}',${parentStid ? `'${parentStid}'` : 'null'},'${ds}')" title="Ajouter une sous-tâche">＋</button>
    </span>
  </div>`;
}

const _plusSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;

// Icône « lien » — même glyphe que le modal (modal.js, section Liens), vue
// jour uniquement (todo.links, voir todoItemHTML) : ouvre le lien en un clic
// s'il n'y en a qu'un, sinon un petit menu (app.handleLinksBadgeClick).
const _linkIconSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;

// Trois morceaux, partagés entre la vue jour (todoItemHTML) et les cartes
// Inbox/Backlog pour que les sous-tâches s'affichent partout de la même façon :
// - `toggle` : badge chevron + compteur « fait/total », posé dans .todo-meta ;
// - `block`  : la checklist repliable (repli persistant par tâche,
//   isSubtaskCollapsed, utils.js) — son propre bouton « + » vit dedans, en
//   fin de liste (.subtask-add-mini-slot) ;
// - `addBtn` : uniquement quand la tâche n'a AUCUNE sous-tâche (donc aucune
//   checklist, donc aucun « + » dedans) — bouton d'ajout posé dans la rangée
//   d'actions de l'item, en ligne à droite du titre avec ▶ et ⋯. En flux
//   comme ses voisins : la carte ne change jamais de taille, ni au survol ni
//   d'une tâche à l'autre.
function subtaskParts(todo, ds) {
  const subs = todo.subtasks || [];
  if (!subs.length) return {
    toggle: '', block: '',
    addBtn: `<button class="todo-subtask-add-btn" onclick="event.stopPropagation();window.app.ctxAddSubtask('${todo.id}')" title="Ajouter une sous-tâche">${_plusSVG}</button>`,
  };
  const collapsed = isSubtaskCollapsed(todo.id);
  const doneCnt = subs.filter(s => s.completed).length;
  return {
    addBtn: '',
    toggle: `<button class="todo-subtask-toggle" onclick="event.stopPropagation();window.app.toggleSubtasksCollapse(this,'${todo.id}')" title="${collapsed ? 'Afficher les sous-tâches' : 'Masquer les sous-tâches'}">${_subtaskChevronSVG(collapsed)}<span class="todo-subtask-toggle-cnt">${doneCnt}/${subs.length}</span></button>`,
    block: `<div class="subtask-collapse${collapsed ? ' collapsed' : ''}"><div class="subtask-collapse-inner">${subtaskListHTML(subs, todo.id, ds)}</div></div>`,
  };
}

// ── Stats viz color helpers ───────────────────────────────────────────────
function _pctColor(pct) {
  if (pct >= 85) return { h: 148, s: 58, l: 52 }; // green
  if (pct >= 65) return { h: 148, s: 40, l: 44 }; // muted green
  if (pct >= 40) return { h: 36,  s: 62, l: 52 }; // amber
  if (pct >= 20) return { h: 12,  s: 58, l: 52 }; // red-orange
  return             { h: 220, s: 12, l: 32 };     // near-bg
}
function _pctHsl(pct, a = 1) {
  const { h, s, l } = _pctColor(pct);
  return `hsla(${h},${s}%,${l}%,${a})`;
}

function addItemPlaceholderHTML() {
  return `<div class="add-item-placeholder" onclick="window.app.openModal()">
    <div class="add-item-placeholder-pill">
      <span class="add-item-placeholder-label">Ajouter</span>
      <div class="add-item-placeholder-icon">＋</div>
    </div>
  </div>`;
}

export function todoItemHTML(todo, date, group = null, dayView = false, hideCategoryBadge = false) {
  const done = isCompleted(todo, date);
  const cancelled = isCancelled(todo, date);
  const rec = recLabel(todo, dayView);
  const isRec = todo.recurrence && todo.recurrence !== 'none';
  const ds = DS(date);
  const dragHandleHTML = '';
  const categoryBadge = (() => {
    if (hideCategoryBadge) return '';
    const ids = todo.categoryIds || (todo.categoryId ? [todo.categoryId] : []);
    if (!ids.length) return '';
    return ids.map(cid => {
      const cat = getCategories().find(p => p.id === cid);
      if (!cat) return '';
      return `<span class="todo-category-badge" style="background:${cat.color};color:#fff;border-color:${cat.color};cursor:pointer;" onclick="event.stopPropagation();window.app.openCategoryView('${cat.id}')">${esc(cat.name.toUpperCase())}</span>`;
    }).join('');
  })();
  const projectBadge = (() => {
    const ids = todo.projectIds || (todo.projectId ? [todo.projectId] : []);
    if (!ids.length) return '';
    return ids.map(pid => {
      const proj = getProjects().find(p => p.id === pid);
      if (!proj) return '';
      return `<span class="todo-project-badge" style="background:${proj.color}20;color:${proj.color};border-color:${proj.color}60;cursor:pointer;" onclick="event.stopPropagation();window.app.openProjectPanel('${proj.id}')">${esc(proj.name)}</span>`;
    }).join('');
  })();
  const intentionBadge = (() => {
    const ids = todo.intentionIds || (todo.intentionId ? [todo.intentionId] : []);
    if (!ids.length) return '';
    const intentions = _getIntentions();
    return ids.map(iid => {
      const int = intentions.find(i => i.id === iid);
      if (!int) return '';
      return `<span class="todo-intention-badge" style="background:${int.color}20;color:${int.color};border-color:${int.color}60;cursor:pointer;" onclick="event.stopPropagation();window.app.openIntentionPanel('${int.id}')">${esc(int.title)}</span>`;
    }).join('');
  })();
  const prioCls = todo.priority ? ` prio-${todo.priority}` : '';
  const timeBadge = todo.startTime
    ? `<span class="todo-time-badge"><svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="6" cy="6" r="5"/><polyline points="6 3.5 6 6 8 7.2"/></svg>${todo.startTime}</span>`
    : '';
  // Temps focus : durée réelle (occurrence complétée) ou progression en
  // cours (focusTimeSpent, tâche non complétée reprise depuis un focus
  // précédent) + estimation — vue jour uniquement
  const focusTimeBadge = (() => {
    if (!dayView) return '';
    const est = effectiveEstimate(todo) || null;
    // Un focusTimeSpent accumulé sur une date passée ne doit pas s'afficher
    // sur l'occurrence affichée aujourd'hui — vrai pour une récurrente
    // (occurrence différente) comme pour une ponctuelle reportée après avoir
    // déjà eu du temps de focus (t.date change, focusTimeSpentDate non) —
    // voir focusTimeSpentDate (focus.js)
    const sameDayProgress = todo.focusTimeSpentDate === ds;
    const spentMin = done ? (todo.durationReal || null) : ((sameDayProgress && todo.focusTimeSpent) ? Math.round(todo.focusTimeSpent / 60) : null);
    if (!spentMin && !est) return '';
    const label = spentMin && est ? `${spentMin}/${est} min` : spentMin ? `${spentMin} min` : `~${est} min`;
    const title = spentMin && est ? 'Temps passé en focus / estimé' : spentMin ? 'Temps passé en focus' : 'Temps estimé';
    // Une estimation déjà définie s'édite directement à sa place (le libellé
    // .todo-focustime-label devient un <input> — app.editEstimateBadge()) ;
    // le survol prolongé de 2 s (showEstimateHoverEdit) édite au même endroit
    const cls = `todo-focustime-badge${est ? ' editable' : ''}`;
    const badgeTitle = est ? `${title} — cliquer pour modifier` : title;
    const onclick = est ? ` onclick="event.stopPropagation();window.app.editEstimateBadge(this,'${todo.id}')"` : '';
    return `<span class="${cls}" title="${badgeTitle}"${onclick}><span class="todo-focustime-label">${label}</span></span>`;
  })();
  const counterBar = (() => {
    if (!todo.counterEnabled || todo.countTo === undefined) return '';
    const cur  = todo.countCurrent ?? todo.countFrom ?? 0;
    const from = todo.countFrom ?? 0;
    const to   = todo.countTo;
    const pct  = to > from ? Math.min(100, Math.round(((cur - from) / (to - from)) * 100)) : 0;
    const unit = todo.countUnit ? ` ${esc(todo.countUnit)}` : '';
    return `<div class="todo-counter" onclick="event.stopPropagation()">
      <button class="todo-counter-btn" onclick="event.stopPropagation();window.app.decrementCount('${todo.id}')" title="Décrémenter">−</button>
      <span class="todo-counter-val">${cur}${unit}</span>
      <button class="todo-counter-btn" onclick="event.stopPropagation();window.app.incrementCount('${todo.id}')" title="Incrémenter">+</button>
      <div class="todo-counter-bar-wrap"><div class="todo-counter-bar-fill" style="width:${pct}%"></div></div>
      <span class="todo-counter-target">/ ${to}${unit}</span>
    </div>`;
  })();
  // Badge « lien » — vue jour uniquement, comme focusTimeBadge : todo.links
  // est déjà résolu par occurrence (getTodosForDate → resolveOccurrence),
  // donc lu directement ici sans re-résolution.
  const linksBadge = (() => {
    if (!dayView) return '';
    const links = (todo.links || []).filter(Boolean);
    if (!links.length) return '';
    const multi = links.length > 1;
    const badgeTitle = multi ? `${links.length} liens` : links[0];
    return `<button class="todo-links-badge${multi ? ' multi' : ''}" title="${esc(badgeTitle)}" onclick="event.stopPropagation();window.app.handleLinksBadgeClick(event,'${todo.id}')">${_linkIconSVG}${multi ? `<span class="todo-links-badge-cnt">${links.length}</span>` : ''}</button>`;
  })();
  // Badge échéance (t.deadline) — vue jour uniquement, comme focusTimeBadge
  // et linksBadge. Jamais sur une récurrente : la section « Échéance » du
  // modal y est masquée, une date limite absolue n'ayant pas de sens sur une
  // série. Gris au repos, orange dans la fenêtre deadlineLeadDays, rouge une
  // fois dépassée (voir deadlineBadge/deadlineInfo, review.js).
  const deadlineBadgeHTML = (dayView && !isRec) ? deadlineBadge(todo) : '';
  const { toggle: subtaskToggleHTML, block: expandedHTML, addBtn: subtaskAddBtnHTML } = subtaskParts(todo, ds);
  const hasMeta = categoryBadge || projectBadge || intentionBadge || rec || timeBadge || focusTimeBadge || linksBadge || deadlineBadgeHTML || subtaskToggleHTML;
  const draggableAttr = group ? ` draggable="true" data-group="${group}"` : '';
  return `
    <div class="todo-item${done?' done':''}${cancelled?' cancelled':''}${prioCls}" data-id="${todo.id}" data-date="${ds}"${draggableAttr} onclick="window.app.clickTodo(event,'${todo.id}','${ds}')">
      ${group ? _edgeArrowsHTML : ''}
      ${group ? _nestBadgeHTML : ''}
      <div class="todo-check${done?' checked':''}" onclick="event.stopPropagation();${cancelled ? `window.app.cancelTodo('${todo.id}','${ds}')` : `window.app.toggleTodo('${todo.id}',window.app.parseDS('${ds}'),event)`}" ${cancelled ? 'title="Annulée — cliquer pour restaurer"' : ''}></div>
      <div class="todo-content">
        <span class="todo-text">${esc(todo.title)}</span>
        ${hasMeta ? `<div class="todo-meta">${timeBadge}${deadlineBadgeHTML}${focusTimeBadge}${linksBadge}${categoryBadge}${projectBadge}${intentionBadge}${rec ? `<span class="todo-badge${isRec?' recurring':''}">${rec}</span>` : ''}${subtaskToggleHTML}</div>` : ''}
        ${counterBar}
      </div>
      <div class="todo-actions">
        ${subtaskAddBtnHTML}
        <button class="todo-focus-btn" onclick="event.stopPropagation();window.app.focusStartOn('${todo.id}','${ds}')" title="Focus sur cette tâche">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5.5v13a1 1 0 0 0 1.53.85l10.5-6.5a1 1 0 0 0 0-1.7L8.53 4.65A1 1 0 0 0 7 5.5Z"/></svg>
        </button>
        <button class="todo-delete-btn" onclick="event.stopPropagation();window.app.deleteTodo('${todo.id}','${ds}')" title="Supprimer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
        <button class="todo-menu-btn" onclick="event.stopPropagation();window.app.showTodoMenu(event,'${todo.id}','${ds}')" title="Actions">⋯</button>
      </div>
      ${dragHandleHTML}
      ${expandedHTML}
    </div>`;
}

// Rend une liste d'items en insérant un en-tête de groupe (titre, draggable
// pour déplacer tout le groupe d'un bloc) devant le 1er membre rencontré
// d'un groupId partagé par ≥2 items visibles — sans réordonner la liste
// (les membres suivants du même groupe restent à leur position normale,
// pas de 2e en-tête). data-ids porte tous les membres du groupe DANS CETTE
// LISTE (même bucket moment/type) : app.initDayDragDrop() les lit au
// dragstart pour peupler _dragMultiIds et déplacer le groupe entier.
function todoListHTML(items, navDate, group, dayView = false, hideCategoryBadge = false) {
  const seen = new Set();
  return items.map(t => {
    let header = '';
    if (t.groupId && !seen.has(t.groupId)) {
      const members = items.filter(x => x.groupId === t.groupId);
      // Un groupe volontairement créé sur une seule tâche (menu contextuel
      // « Créer un groupe ») n'a qu'un membre AU TOTAL : son
      // en-tête doit s'afficher, sinon l'action semble sans effet. Distinct
      // du membre isolé d'un groupe qui en compte plusieurs (déplacé à un
      // autre jour/moment) : celui-là reste une tâche normale sans en-tête,
      // d'où le compte sur state.todos et pas seulement sur la liste visible.
      const totalMembers = state.todos.filter(x => x.groupId === t.groupId).length;
      if (members.length > 1 || totalMembers === 1) {
        seen.add(t.groupId);
        const ids = members.map(m => m.id).join(',');
        header = `<div class="task-group-header" draggable="true" data-group="${group}" data-group-id="${t.groupId}" data-id="${members[0].id}" data-ids="${ids}"><span class="task-group-chip">${_groupHeaderIconSVG}<span class="task-group-title">${esc(t.groupTitle || '')}</span></span></div>`;
      }
    }
    return header + todoItemHTML(t, navDate, group, dayView, hideCategoryBadge);
  }).join('');
}

function recLabel(t, dayView = false) {
  if (!t.recurrence || t.recurrence==='none') return '';
  if (t.recurrence==='daily') return dayView ? '' : `↻ ${state.T.recDaily}`;
  if (t.recurrence==='weekly') {
    const dayNames = [...(t.recDays || [])].sort((a, b) => {
      // Sort Mon-first: shift Sunday (0) to end
      const order = a === 0 ? 7 : a;
      const orderB = b === 0 ? 7 : b;
      return order - orderB;
    });
    const names = dayView
      ? dayNames.map(i => state.DAY_FULL[i]).join(', ')
      : dayNames.map(i => state.DAYS[(i+6)%7]).join(', ');
    return `↻ ${names}`;
  }
  if (t.recurrence==='monthly') {
    if (dayView) {
      const parts = [];
      if (t.recDays && t.recDays.length > 0) parts.push(...t.recDays);
      else if (t.recDay) parts.push(t.recDay);
      if (t.recLastDay) parts.push(state.T.lastDayAbbr || 'fin');
      return parts.length ? `↻ ${parts.join(', ')}` : `↻ ${state.T.recMonthly}`;
    }
    return `↻ ${state.T.recMonthly}`;
  }
  if (t.recurrence==='yearly') {
    if (dayView && t.recDay != null && t.recMonth != null) {
      return `↻ ${t.recDay} ${state.MONTHS[t.recMonth]}`;
    }
    return `↻ ${state.T.recYearly}`;
  }
  return '';
}

function _renderDayMiniWeek() {
  const navDate = state.navDate;
  const todayStr = DS(new Date());
  const navStr = DS(navDate);
  const startDate = new Date(); startDate.setHours(0, 0, 0, 0);

  let html = '<div class="day-mini-week"><div class="day-mini-week-row">';
  for (let i = 0; i < 14; i++) {
    const d = addDays(startDate, i);
    const ds = DS(d);
    const isToday = ds === todayStr;
    const isCurrent = ds === navStr;
    const isPast = ds < todayStr;
    const cls = ['day-mini-col', isToday ? 'is-today' : '', isCurrent ? 'is-current' : '', isPast ? 'past' : '', i === 6 ? 'week-end' : ''].filter(Boolean).join(' ');
    html += `<div class="${cls}" data-date="${ds}" onclick="window.app.setNavDateAndView('${ds}', 'day')">
      <div class="day-mini-col-hd">
        <span class="day-mini-abbr">${state.DAYS[(d.getDay()+6)%7]}</span>
        <span class="day-mini-num">${d.getDate()}</span>
      </div>
      <div class="day-mini-col-body" data-date="${ds}"></div>
    </div>`;
  }
  html += '</div></div>';
  return html;
}

export function renderDayView(todos) {
  const navDate = state.navDate;
  const dateStr = DS(navDate);
  const now = new Date();
  const isToday = dateStr === DS(now);
  const allItems = getTodosForDate(navDate, todos);

  const prevDate = new Date(navDate); prevDate.setDate(prevDate.getDate() - 1);
  const nextDate = new Date(navDate); nextDate.setDate(nextDate.getDate() + 1);
  const prevMonth = new Date(navDate); prevMonth.setMonth(prevMonth.getMonth() - 1);
  const nextMonth = new Date(navDate); nextMonth.setMonth(nextMonth.getMonth() + 1);

  const header = `
    <div class="day-header-wrapper">
      <button class="day-nav-btn day-nav-btn--prev-month" onclick="window.app.navigateMonth(-1)" title="${state.MONTHS[prevMonth.getMonth()]} ${prevMonth.getFullYear()}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 18 12 12 18 6"/><polyline points="12 18 6 12 12 6"/></svg>
      </button>
      <button class="day-nav-btn day-nav-btn--prev" onclick="window.app.navigate(-1)" title="${state.DAY_FULL[prevDate.getDay()]}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <div class="day-header">
        <div class="day-title-line">${state.DAY_FULL[navDate.getDay()]} ${navDate.getDate()} ${state.MONTHS[navDate.getMonth()]} ${navDate.getFullYear()}</div>
      </div>
      <button class="day-nav-btn day-nav-btn--next" onclick="window.app.navigate(1)" title="${state.DAY_FULL[nextDate.getDay()]}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
      <button class="day-nav-btn day-nav-btn--next-month" onclick="window.app.navigateMonth(1)" title="${state.MONTHS[nextMonth.getMonth()]} ${nextMonth.getFullYear()}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 18 12 12 6 6"/><polyline points="12 18 18 12 12 6"/></svg>
      </button>
    </div>`;

  const isStatsMode = state.pastDisplayMode === 'stats';
  const isPastDay = dateStr < DS(new Date());
  // Nombre d'items réellement visibles (les complétées masquées en mode
  // stats ne comptent pas) — une section/un groupe sans item visible disparaît
  const _visCount = items => isStatsMode ? items.filter(t => !isCompleted(t, navDate) && !isCancelled(t, navDate)).length : items.length;

  // Complétées/annulées visibles (mode normal) → reléguées en bas de CHAQUE
  // liste par défaut, les non-complétées remontant d'autant — tri stable
  // (Array#sort), donc l'ordre relatif au sein de chaque groupe (manuel/heure/
  // priorité/tag) est préservé, seul le statut fait/pas-fait prime dessus.
  // Toggle utilisateur (`app.toggleDayDoneBottom()`), réglage local comme
  // dayAutoPrio/dayPeriodGroups — sans effet visible en mode stats puisque
  // ces items y sont de toute façon masqués en CSS. Appliqué en tout DERNIER
  // (après tri manuel/heure/priorité/auto-prio) sur chaque liste finale.
  const doneBottom = localStorage.getItem('dayDoneBottom') !== 'false';
  const _isDone = t => isCompleted(t, navDate) || isCancelled(t, navDate);
  const _sinkDone = items => doneBottom ? [...items].sort((a, b) => _isDone(a) - _isDone(b)) : items;

  // Un moment PONCTUEL vide (aucune tâche) garde normalement sa place —
  // placeholder .period-dropzone en pointillés, toujours là comme cible de
  // drop (voir _mkPeriodSection/mkHeureSection plus bas). Passé son heure de
  // fin, ce placeholder vide n'a plus d'utilité : il disparaît. Ne s'applique
  // QUE si le moment est réellement vide (aucune tâche dedans, faite ou pas)
  // — un moment qui contient des tâches ne disparaît JAMAIS avec l'heure,
  // seulement quand il est vide au sens strict (cf. _visCount ci-dessus,
  // qui gère déjà le cas « tout complété masqué en mode stats » séparément).
  // Uniquement pour AUJOURD'HUI : un jour passé est de toute façon figé, un
  // jour futur n'a encore rien d'« expiré ». Soir n'a pas de moment suivant
  // pour justifier sa propre expiration — reste toujours affiché.
  const PERIOD_EXPIRY_HOUR = { morning: 13, afternoon: 15 };
  const _periodExpired = period => isToday && now.getHours() >= (PERIOD_EXPIRY_HOUR[period] ?? Infinity);

  const dailyItems   = allItems.filter(t => t.recurrence === 'daily');
  const weeklyItems  = allItems.filter(t => t.recurrence === 'weekly');
  const monthlyItems = allItems.filter(t => t.recurrence === 'monthly');
  const yearlyItems  = allItems.filter(t => t.recurrence === 'yearly');
  const punctualItems = allItems.filter(t => !t.recurrence || t.recurrence === 'none');

  // Sort by stored order (recurring per-day, punctual per-day)
  const recOrd = window.app?.recurringOrder?.[dateStr] || {};
  const dayOrd = window.app?.dayOrder?.[dateStr] || [];
  const sortByOrder = (items, ord) => [...items].sort((a, b) => {
    const ia = ord.indexOf(a.id), ib = ord.indexOf(b.id);
    if (ia < 0 && ib < 0) return 0;
    if (ia < 0) return 1; if (ib < 0) return -1;
    return ia - ib;
  });
  const dailyMorning   = dailyItems.filter(t => t.dayPeriod === 'morning');
  const dailyAfternoon = dailyItems.filter(t => t.dayPeriod === 'afternoon');
  const dailyEvening   = dailyItems.filter(t => t.dayPeriod === 'evening');
  const dailyNoPeriod  = dailyItems.filter(t => !t.dayPeriod);

  // Heure d'abord, puis l'ordre manuel PRIME (les items réordonnés suivent
  // l'ordre stocké, les autres restent triés par heure après)
  const _recSortApply = items => {
    const timed   = [...items].filter(t => t.startTime).sort((a, b) => a.startTime.localeCompare(b.startTime));
    const untimed = items.filter(t => !t.startTime);
    return [...timed, ...untimed];
  };
  const sortedDailyMorning   = _sinkDone(sortByOrder(_recSortApply(dailyMorning),   recOrd['daily-morning']   || []));
  const sortedDailyAfternoon = _sinkDone(sortByOrder(_recSortApply(dailyAfternoon), recOrd['daily-afternoon'] || []));
  const sortedDailyEvening   = _sinkDone(sortByOrder(_recSortApply(dailyEvening),   recOrd['daily-evening']   || []));
  const sortedDailyNoPeriod  = _sinkDone(sortByOrder(_recSortApply(dailyNoPeriod),  recOrd['daily']           || []));
  const sortedWeekly  = _sinkDone(sortByOrder(weeklyItems,  recOrd.weekly  || []));
  const sortedMonthly = _sinkDone(sortByOrder(monthlyItems, recOrd.monthly || []));
  const sortedYearly  = _sinkDone(sortByOrder(yearlyItems,  recOrd.yearly  || []));

  const punctualPeriodOrd = window.app?.punctualPeriodOrder?.[dateStr] || {};
  const punctualMorning   = punctualItems.filter(t => t.dayPeriod === 'morning');
  const punctualAfternoon = punctualItems.filter(t => t.dayPeriod === 'afternoon');
  const punctualEvening   = punctualItems.filter(t => t.dayPeriod === 'evening');
  const punctualNoPeriod  = punctualItems.filter(t => !t.dayPeriod);

  const sortedPunctualMorning   = sortByOrder(punctualMorning,   punctualPeriodOrd['morning']   || []);
  const sortedPunctualAfternoon = sortByOrder(punctualAfternoon, punctualPeriodOrd['afternoon'] || []);
  const sortedPunctualEvening   = sortByOrder(punctualEvening,   punctualPeriodOrd['evening']   || []);
  const sortedPunctual = sortByOrder(punctualNoPeriod, dayOrd);

  const recAllItems = [...dailyItems, ...weeklyItems, ...monthlyItems, ...yearlyItems];
  const recActive   = recAllItems.filter(t => !isCancelled(t, navDate));
  const punctActive = punctualItems.filter(t => !isCancelled(t, navDate));
  const recDone = recActive.filter(t => isCompleted(t, navDate)).length;
  const punctDone = punctActive.filter(t => isCompleted(t, navDate)).length;

  // Annulées hors compte
  const totalAll = punctActive.length + recActive.length;
  // Journée bouclée (aujourd'hui/futur, tout complété) → 3e colonne de relance,
  // et la colonne Aujourd'hui repasse sur une seule colonne
  const hasRefill = !isPastDay && totalAll > 0 && (punctDone + recDone) === totalAll;
  const doneAll = punctDone + recDone;
  // Soirée libre après une journée bouclée : le placeholder vide du moment
  // Soir devient une invitation à ajouter une tâche plutôt qu'un simple
  // pointillé neutre — voir aussi celebrate.js `celebrateSpecial` (tier
  // 'afternoon'), qui propose la même action depuis l'écran de célébration.
  const eveningFreeInvite = isToday && hasRefill;
  // Masqués en mode stats : complétées + annulées (ces dernières hors totalAll ci-dessus)
  const cancelledAll = (recAllItems.length - recActive.length) + (punctualItems.length - punctActive.length);
  const hiddenAll = doneAll + cancelledAll;

  // Always render ALL items (CSS hides .done items in stats-mode)
  // Daily column count (only for daily group)
  const recColCount = parseInt(localStorage.getItem('recColCount') || '1');
  const recColStyle = `grid-template-columns:repeat(${recColCount},1fr)`;
  const recColCollapsed = localStorage.getItem('recColCollapsed') !== 'false';
  const recColIcon = n => {
    const bars = Array.from({length: n}, (_, i) => {
      const w = Math.floor(12 / n);
      const g = n > 1 ? Math.floor((12 - w * n) / (n - 1)) : 0;
      const x = i * (w + g);
      return `<rect x="${x}" y="0" width="${w}" height="16" rx="2" fill="currentColor"/>`;
    }).join('');
    return `<svg viewBox="0 0 14 16" width="13" height="15">${bars}</svg>`;
  };
  const recColBtns = [1,2,3,4].map(n =>
    `<button class="day-ctrl-btn${n===recColCount?' active':''}" onclick="window.app.setRecColCount(${n}); window.app.closeRecCol();" onmouseenter="window.app.resetAutoCloseRecCol()" title="${n} colonne${n>1?'s':''}">${n} col${n>1?'s':''}</button>`
  ).join('');
  const recPeriodGroups = localStorage.getItem('recPeriodGroups') !== 'false';
  const recCtrlsCollapsed = localStorage.getItem('recCtrlsCollapsed') !== 'false';
  const periodToggleSvg = recPeriodGroups
    ? `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/></svg>`
    : `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`;
  const dailyGroupLabel = `<div class="day-group-label day-group-label--with-ctrl">
    <span>${state.T.recDaily}</span>
    <button class="day-add-task-btn" onclick="window.app.addDailyTask()" title="Ajouter une tâche quotidienne">${_plusSVG}</button>
    <div class="day-group-label-line"></div>
    <div class="day-col-controls${recCtrlsCollapsed ? ' collapsed' : ''}">
      <button class="day-ctrl-btn${recPeriodGroups ? ' active' : ''}${recCtrlsCollapsed ? ' hidden' : ''}" onclick="window.app.toggleRecPeriodGroups()" title="Grouper par moment">${periodToggleSvg} Moments</button>
      <div class="day-ctrl-expandable${!recColCollapsed ? ' expanded' : ''}${recCtrlsCollapsed ? ' hidden' : ''}">
        <button class="day-ctrl-toggle" onclick="window.app.toggleRecCol()" title="Colonnes" onmouseenter="window.app.resetAutoCloseRecCol()">
          <span class="day-ctrl-label">Colonnes</span>
          <svg class="day-ctrl-chevron" viewBox="0 0 12 12" width="10" height="10"><polyline points="3 5 6 8 9 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="day-ctrl-group" onmouseenter="window.app.resetAutoCloseRecCol()">${recColBtns}</div>
      </div>
      <button class="day-ctrl-gear" onclick="window.app.toggleRecControls()" title="Options">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/></svg>
      </button>
    </div>
  </div>`;

  let leftCol = '';

  // Toujours affiché (même sans aucune quotidienne), pour garder le « + »
  // d'ajout accessible — même logique que le header Aujourd'hui/Ponctuel
  leftCol += dailyGroupLabel;

  if (recPeriodGroups) {
    if (_visCount(sortedDailyNoPeriod) > 0)
      leftCol += `<div class="todo-list" data-group="daily" style="${recColStyle}">${sortedDailyNoPeriod.map(t => todoItemHTML(t, navDate, 'daily', true)).join('')}</div>`;
    // Matin/Après-midi/Soir TOUJOURS affichés, avec un placeholder
    // .period-dropzone en pointillés si vides — même recette que
    // mkHeureSection côté ponctuel (« garder une cible de drop » même sans
    // tâche), portée ici aux sous-périodes du Quotidien pour que le
    // glisser-déposer d'une quotidienne vers son moment fonctionne même
    // quand ce moment n'a encore aucune tâche. Disparaît seulement si des
    // items existent mais sont tous complétés-masqués en mode stats
    // (_visCount === 0 avec items.length > 0), pas si vraiment vide.
    const _mkDailyPeriodSection = (items, group, period, label) => {
      if (items.length > 0 && _visCount(items) === 0) return '';
      const content = items.length
        ? items.map(t => todoItemHTML(t, navDate, group, true)).join('')
        : `<div class="period-dropzone"></div>`;
      return `<div class="day-heure-section" data-period="${period}"><div class="day-period-label day-heure-label" data-period="${period}">${label}</div><div class="todo-list" data-group="${group}" style="${recColStyle}">${content}</div></div>`;
    };
    leftCol += `<div class="day-heure-grid">${
      _mkDailyPeriodSection(sortedDailyMorning, 'daily-morning', 'morning', 'Matin') +
      _mkDailyPeriodSection(sortedDailyAfternoon, 'daily-afternoon', 'afternoon', 'Après-midi') +
      _mkDailyPeriodSection(sortedDailyEvening, 'daily-evening', 'evening', 'Soir')
    }</div>`;
  } else {
    const allDaily = _sinkDone(sortByOrder([...sortedDailyNoPeriod, ...sortedDailyMorning, ...sortedDailyAfternoon, ...sortedDailyEvening], recOrd['daily'] || []));
    leftCol += `<div class="todo-list" data-group="daily" style="${recColStyle}">${allDaily.map(t => todoItemHTML(t, navDate, 'daily', true)).join('')}</div>`;
  }

  if (_visCount(sortedWeekly) > 0)  leftCol += `<div class="day-group-label">${state.T.recWeekly}</div><div class="todo-list" data-group="weekly">${sortedWeekly.map(t => todoItemHTML(t, navDate, 'weekly', true)).join('')}</div>`;
  if (_visCount(sortedMonthly) > 0) leftCol += `<div class="day-group-label">${state.T.recMonthly}</div><div class="todo-list" data-group="monthly">${sortedMonthly.map(t => todoItemHTML(t, navDate, 'monthly', true)).join('')}</div>`;
  if (_visCount(sortedYearly) > 0)  leftCol += `<div class="day-group-label">${state.T.recYearly}</div><div class="todo-list" data-group="yearly">${sortedYearly.map(t => todoItemHTML(t, navDate, 'yearly', true)).join('')}</div>`;

  // Column count — icon buttons (forcé à 1 quand le panneau de relance occupe la 3e colonne)
  const colCountSetting = parseInt(localStorage.getItem('dayColCount') || '2');
  const colCount = hasRefill ? 1 : colCountSetting;
  const colIcon = n => {
    const bars = Array.from({length: n}, () => `<rect/>`).map((_, i) => {
      const w = Math.floor(12 / n);
      const g = n > 1 ? Math.floor((12 - w * n) / (n - 1)) : 0;
      const x = i * (w + g);
      return `<rect x="${x}" y="0" width="${w}" height="16" rx="2" fill="currentColor"/>`;
    }).join('');
    return `<svg viewBox="0 0 14 16" width="13" height="15">${bars}</svg>`;
  };
  const colBtns = [2,3,4,6].map(n =>
    `<button class="day-ctrl-btn${n===colCountSetting?' active':''}" onclick="window.app.setDayColCount(${n}); window.app.closeDayCol();" onmouseenter="window.app.resetAutoCloseDayCol()" title="${n} colonnes">${n} cols</button>`
  ).join('');
  const spacerBtn = `<button class="day-ctrl-btn day-spacer-btn" onclick="window.app.addDaySpacer()" title="Ajouter un séparateur"><svg viewBox="0 0 16 10" width="14" height="9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="0" y1="2" x2="16" y2="2"/><line x1="0" y1="8" x2="16" y2="8"/></svg> Spacer</button>`;

  // Sort / group mode
  const _rawDaySort = localStorage.getItem('daySort');
  const daySort = (!_rawDaySort || _rawDaySort === 'manual' || _rawDaySort === 'heure') ? 'chrono' : _rawDaySort;
  const sortOpts = [
    { id: 'chrono',   label: 'Chrono' },
    { id: 'priority', label: 'Priorité' },
    { id: 'tag',      label: 'Tag' },
  ];
  const sortBtns = sortOpts.map(o =>
    `<button class="day-ctrl-btn day-sort-btn${daySort===o.id?' active':''}" onclick="window.app.setDaySort('${o.id}'); window.app.closeDaySort();" onmouseenter="window.app.resetAutoCloseDaySort()">${o.label}</button>`
  ).join('');

  // Auto-prioritize checkbox
  const autoPrio = localStorage.getItem('dayAutoPrio') === 'true';
  const autoPrioCheck = `<label class="day-ctrl-toggle" title="Remonter automatiquement les tâches prioritaires"><input type="checkbox" ${autoPrio?'checked':''} onchange="window.app.toggleDayAutoPrio()"><span class="toggle-track"></span><span>Auto-prio</span></label>`;

  const dayPeriodGroupsForRender = localStorage.getItem('dayPeriodGroups') !== 'false';
  const periodGroupsCheck = `<label class="day-ctrl-toggle" title="Grouper les tâches par moment de la journée"><input type="checkbox" ${dayPeriodGroupsForRender?'checked':''} onchange="window.app.toggleDayPeriodGroups()"><span class="toggle-track"></span><span>Moments</span></label>`;

  // priority/tag modes always include all items; chrono handles its own grouping
  const _allPunctual = sortByOrder([...punctualNoPeriod, ...punctualMorning, ...punctualAfternoon, ...punctualEvening], dayOrd);
  let itemsForRender = (daySort === 'priority' || daySort === 'tag')
    ? _allPunctual
    : (dayPeriodGroupsForRender ? [...sortedPunctual] : _allPunctual);
  if (autoPrio) {
    const prioW = { high: 0, medium: 1, low: 2 };
    itemsForRender.sort((a, b) => (prioW[a.priority] ?? 3) - (prioW[b.priority] ?? 3));
  }
  itemsForRender = _sinkDone(itemsForRender);

  const colStyle = `grid-template-columns:repeat(${colCount},1fr)`;
  let rightColItems = '';

  // Punctual period sections — toujours rendues même vides (pour garder une
  // cible de drop) — SAUF si elles ont des items mais qu'ils sont tous
  // complétés-masqués (mode stats) : là, la section disparaît
  const hasPunctualPeriods = dayPeriodGroupsForRender;
  let punctualPeriodSections = '';
  // Placeholder du moment vide — invitation ludique pour Soir quand la
  // journée est bouclée et qu'il n'y a rien de prévu ce soir, pointillé
  // neutre sinon (cible de drop, cf. règle CSS filter/backdrop-filter plus
  // bas dans le fichier — aucun ancêtre filtré ici, donc pas de souci de drop)
  const _periodDropzoneHTML = period => (period === 'evening' && eveningFreeInvite)
    ? `<div class="period-dropzone period-dropzone--evening-invite" onclick="window.app.addSectionTask('evening')" title="Ajouter une tâche pour ce soir">
         <span class="period-invite-icon">🌙</span><span>Rien de prévu ce soir — une envie&nbsp;?</span>
       </div>`
    : `<div class="period-dropzone"></div>`;
  const _mkPeriodSection = (items, group, label) => {
    if (items.length > 0 && _visCount(items) === 0) return '';
    if (items.length === 0 && _periodExpired(group.replace('punctual-', ''))) return '';
    const content = items.length
      ? items.map(t => todoItemHTML(t, navDate, group, true)).join('')
      : _periodDropzoneHTML(group.replace('punctual-', ''));
    return `<div class="day-heure-section" data-period="${group.replace('punctual-', '')}"><div class="day-period-label day-heure-label" data-period="${group.replace('punctual-', '')}">${label}</div><div class="todo-list" data-group="${group}" style="${colStyle}">${content}</div></div>`;
  };
  if (dayPeriodGroupsForRender && daySort !== 'chrono') {
    punctualPeriodSections += _mkPeriodSection(sortedPunctualMorning, 'punctual-morning', 'Matin');
    punctualPeriodSections += _mkPeriodSection(sortedPunctualAfternoon, 'punctual-afternoon', 'Après-midi');
    punctualPeriodSections += _mkPeriodSection(sortedPunctualEvening, 'punctual-evening', 'Soir');
  }

  if (daySort === 'priority') {
    // Group by priority
    const prioGroups = [
      { key: 'high',   label: 'Haute' },
      { key: 'medium', label: 'Moyenne' },
      { key: 'low',    label: 'Basse' },
      { key: 'none',   label: 'Sans priorité' },
    ];
    const grouped = prioGroups.map(g => {
      const items = itemsForRender.filter(t => g.key === 'none' ? !t.priority : t.priority === g.key);
      if (!items.length) return '';
      const listHtml = `<div class="todo-list" data-group="punctual" data-priority="${g.key}" style="${colStyle}">${items.map(t => todoItemHTML(t, navDate, 'punctual', true)).join('')}</div>`;
      return `<div class="day-spacer-group"><div class="day-auto-group-label">${g.label}</div>${listHtml}</div>`;
    }).join('');
    rightColItems = grouped || `<div class="day-col-empty">${state.T.emptyPunctual || state.T.emptyDay}</div>`;

  } else if (daySort === 'tag') {
    // Group by category/tag — sections draggable to reorder
    const categories = getCategories();
    const tagOrder = JSON.parse(localStorage.getItem('dayTagOrder') || '[]');
    const catGroups = categories.filter(c => itemsForRender.some(t => _hasCat(t, c.id)));
    const untagged = itemsForRender.filter(t => !_getCatIds(t).length);

    // Tag cloud filter — excluded tags are hidden
    const excludedTags = JSON.parse(localStorage.getItem('dayTagExcluded') || '[]');
    const allTags = [
      ...catGroups.map(c => {
        const count = itemsForRender.filter(t => _hasCat(t, c.id)).length;
        return { id: c.id, name: c.name, color: c.color, count };
      }),
      ...(untagged.length ? [{ id: 'none', name: 'Sans tag', color: '#999', count: untagged.length }] : [])
    ];
    const tagCloud = allTags.map(tag => {
      const isVisible = !excludedTags.includes(tag.id);
      const countLabel = tag.count > 1 ? ` (${tag.count})` : '';
      return `<button class="day-tag-cloud-item${isVisible ? ' selected' : ''}" style="--tag-color:${tag.color}" onclick="window.app.toggleDayTagFilter('${tag.id}')" title="${tag.name}">${esc(tag.name)}${countLabel}<span class="day-tag-x">\u00d7</span></button>`;
    }).join('');

    // Grouping toggle
    const tagGrouped = localStorage.getItem('dayTagGrouped') !== 'false';
    const groupIconSvg = `<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1" y="1" width="14" height="4" rx="1"/><rect x="1" y="7" width="14" height="4" rx="1"/><rect x="1" y="13" width="14" height="2" rx="1"/></svg>`;
    const groupToggle = `<button class="day-tag-group-toggle${tagGrouped ? ' active' : ''}" onclick="window.app.toggleDayTagGrouping()" title="Grouper par tag">${groupIconSvg} GROUPER</button>`;

    // Sort catGroups by stored order
    catGroups.sort((a, b) => {
      const ia = tagOrder.indexOf(a.id), ib = tagOrder.indexOf(b.id);
      if (ia < 0 && ib < 0) return 0;
      if (ia < 0) return 1; if (ib < 0) return -1;
      return ia - ib;
    });

    if (tagGrouped) {
      // Grouped view — untagged items first, no header
      let grouped = '';
      if (untagged.length) {
        const isVisible = !excludedTags.includes('none');
        const listHtml = `<div class="todo-list" data-group="punctual" data-tag="none" style="${colStyle}">${untagged.map(t => todoItemHTML(t, navDate, 'punctual', true, true)).join('')}</div>`;
        grouped += `<div class="day-tag-section${isVisible ? '' : ' hidden'}" data-tag-id="none">${listHtml}</div>`;
      }
      grouped += catGroups.map(c => {
        const isVisible = !excludedTags.includes(c.id);
        const items = itemsForRender.filter(t => _hasCat(t, c.id));
        const listHtml = `<div class="todo-list" data-group="punctual" data-tag="${c.id}" style="${colStyle}">${items.map(t => todoItemHTML(t, navDate, 'punctual', true, true)).join('')}</div>`;
        return `<div class="day-tag-section${isVisible ? '' : ' hidden'}" draggable="true" data-tag-id="${c.id}"><div class="day-auto-group-label" style="background:${c.color}">${esc(c.name)}</div>${listHtml}</div>`;
      }).join('');
      rightColItems = `<div class="day-tag-controls">${groupToggle}${tagCloud}</div><div class="day-tag-sections">${grouped}</div>`;
    } else {
      // Flat view with tag indicator
      const filteredItems = itemsForRender.filter(t => {
        const cids = _getCatIds(t);
        if (!cids.length) return !excludedTags.includes('none');
        return cids.some(cid => !excludedTags.includes(cid));
      });
      const flat = filteredItems.map(t => todoItemHTML(t, navDate, 'punctual', true)).join('');
      rightColItems = `<div class="day-tag-controls">${groupToggle}${tagCloud}</div><div class="todo-list" data-group="punctual" style="${colStyle}">${flat}</div>`;
    }

  } else if (daySort === 'chrono') {
    // Group by moment, sort within each group by startTime —
    // puis l'ordre manuel (drag-and-drop) PRIME sur l'heure : les items
    // réordonnés suivent l'ordre stocké, les autres restent triés par heure après
    const sortByTime = items => {
      const timed   = [...items].filter(t => t.startTime).sort((a, b) => a.startTime.localeCompare(b.startTime));
      const untimed = items.filter(t => !t.startTime);
      return [...timed, ...untimed];
    };
    const _chronoSort = (items, ord) => _sinkDone(sortByOrder(sortByTime(items), ord));
    const hNone = _chronoSort(punctualItems.filter(t => !t.dayPeriod), dayOrd);
    const hMorn = _chronoSort(punctualItems.filter(t => t.dayPeriod === 'morning'),   punctualPeriodOrd['morning']   || []);
    const hAftn = _chronoSort(punctualItems.filter(t => t.dayPeriod === 'afternoon'), punctualPeriodOrd['afternoon'] || []);
    const hEvng = _chronoSort(punctualItems.filter(t => t.dayPeriod === 'evening'),   punctualPeriodOrd['evening']   || []);

    const _sunriseSvg = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 18a5 5 0 0 0-10 0"/><line x1="12" y1="9" x2="12" y2="2"/><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/><line x1="1" y1="18" x2="3" y2="18"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/><line x1="23" y1="22" x2="1" y2="22"/><polyline points="16 5 12 9 8 5"/></svg>`;
    const _sunSvg     = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/></svg>`;
    const _moonSvg    = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

    const mkHeureSection = (items, group, period, label, icon) => {
      if (items.length > 0 && _visCount(items) === 0) return '';
      if (items.length === 0 && _periodExpired(period)) return '';
      const labelHtml = `<div class="day-period-label day-heure-label" data-period="${period}">${icon}<span>${label}</span></div>`;
      const listContent = items.length
        ? todoListHTML(items, navDate, group, true)
        : _periodDropzoneHTML(period);
      const listHtml  = `<div class="todo-list" data-group="${group}" style="${colStyle}">${listContent}</div>`;
      return `<div class="day-heure-section" data-period="${period}">${labelHtml}${listHtml}</div>`;
    };

    let hHtml = '';
    if (hNone.length) hHtml += `<div class="todo-list" data-group="punctual" style="${colStyle}">${todoListHTML(hNone, navDate, 'punctual', true)}</div>`;
    const heureSections =
      mkHeureSection(hMorn, 'punctual-morning',   'morning',   'Matin',      _sunriseSvg) +
      mkHeureSection(hAftn, 'punctual-afternoon', 'afternoon', 'Après-midi', _sunSvg) +
      mkHeureSection(hEvng, 'punctual-evening',   'evening',   'Soir',       _moonSvg);
    hHtml += `<div class="day-heure-grid">${heureSections}</div>`;

    rightColItems = punctualItems.length ? hHtml : `<div class="day-col-empty">${state.T.emptyPunctual || state.T.emptyDay}</div>`;

  } else {
    // Manual mode — with spacers
    const dayOrdFull = window.app?.dayOrder?.[dateStr] || [];
    const punctualIds = itemsForRender.map(t => t.id);
    const allEntries = dayOrdFull.filter(id => id.startsWith('spacer-') || punctualIds.includes(id));
    punctualIds.forEach(id => { if (!allEntries.includes(id)) allEntries.push(id); });

    if (itemsForRender.length > 0 || allEntries.some(id => id.startsWith('spacer-'))) {
      const groups = [];
      let cur = { spacer: '', items: [] };
      groups.push(cur);
      for (const id of allEntries) {
        if (id.startsWith('spacer-')) {
          const spacerData = window.app?.daySpacer?.[id] || {};
          const sTitle = esc(spacerData.title || '');
          cur = { spacer: `<div class="day-spacer" data-spacer-id="${id}" draggable="true" data-group="punctual" data-id="${id}">
            <div class="day-spacer-top">
              <span class="day-spacer-title" contenteditable="true" spellcheck="false"
                onblur="window.app.updateSpacerTitle('${id}',this.textContent.trim())"
                onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}"
                onclick="event.stopPropagation()"
                placeholder="Titre…">${sTitle}</span>
              <button class="day-spacer-remove" onclick="event.stopPropagation();window.app.removeDaySpacer('${id}')" title="Supprimer">×</button>
            </div>
            <div class="day-spacer-line"></div>
          </div>`, items: [] };
          groups.push(cur);
        } else {
          const t = itemsForRender.find(x => x.id === id);
          if (t) cur.items.push(todoItemHTML(t, navDate, 'punctual', true));
        }
      }
      rightColItems = groups.map(g => {
        let itemsHtml = '';
        if (g.items.length) {
          itemsHtml = `<div class="todo-list" data-group="punctual" style="${colStyle}">${g.items.join('')}</div>`;
        }
        if (!g.spacer) return itemsHtml;
        return `<div class="day-spacer-group">${g.spacer}${itemsHtml}</div>`;
      }).join('');
    } else {
      rightColItems = `<div class="day-col-empty">${state.T.emptyPunctual || state.T.emptyDay}</div>`;
    }
  }

  // Append period sections after no-period items — manual mode only
  if (hasPunctualPeriods && dayPeriodGroupsForRender && (daySort !== 'heure' && daySort !== 'chrono' && daySort !== 'priority' && daySort !== 'tag')) {
    const emptyMsg = `<div class="day-col-empty">${state.T.emptyPunctual || state.T.emptyDay}</div>`;
    const noPeriodHtml = rightColItems !== emptyMsg ? rightColItems : '';
    rightColItems = (noPeriodHtml + punctualPeriodSections) || emptyMsg;
  }

  // Add placeholder at the very end (replace empty message or append to items)
  const emptyMsg = `<div class="day-col-empty">${state.T.emptyPunctual || state.T.emptyDay}</div>`;
  if (rightColItems === emptyMsg) {
    rightColItems = addItemPlaceholderHTML();
  } else if (rightColItems) {
    rightColItems += addItemPlaceholderHTML();
  }

  // Done accordion (stats mode) — collapsible section for completed/cancelled punctual items
  let doneAccordion = '';
  if (isStatsMode) {
    const doneItems = punctualItems.filter(t => isCompleted(t, navDate) || isCancelled(t, navDate));
    if (doneItems.length > 0) {
      const isOpen = localStorage.getItem('dayDoneAccordionOpen') === '1';
      const chevron = `<svg class="day-done-chevron" viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 4 6 7 9 4"/></svg>`;
      const label = state.lang === 'fr' ? 'Masquées' : 'Hidden';
      doneAccordion = `<div class="day-done-accordion${isOpen ? ' open' : ''}">
        <button class="day-done-accordion-hd" onclick="window.app.toggleDoneAccordion()">
          ${chevron}
          <span class="day-done-accordion-lbl">${label}</span>
          <span class="day-done-accordion-cnt">${doneItems.length}</span>
        </button>
        <div class="day-done-accordion-bd">
          <div class="todo-list" data-group="punctual">${doneItems.map(t => todoItemHTML(t, navDate, 'punctual', true)).join('')}</div>
        </div>
      </div>`;
    }
  }

  const sortCollapsed = localStorage.getItem('daySortCollapsed') !== 'false';
  const colCollapsed = localStorage.getItem('dayColCollapsed') !== 'false';
  const ctrlsCollapsed = localStorage.getItem('dayCtrlsCollapsed') !== 'false';

  // Toggle "Complétés" (Tri / Colonnes / Complétés) — remplace l'ancien
  // panneau "Options d'affichage" de la colonne calendrier (#calSidebar),
  // déplacé ici pour rester à portée de main pendant qu'on regarde le jour
  // qu'il affecte. Le réglage (state.pastDisplayMode) reste global : il
  // continue d'agir sur les vues semaine/mois même si le contrôle ne vit
  // plus que dans la vue jour. Bascule directe (pas de sous-menu) : un clic
  // inverse Visibles/Masquées.
  const doneToggleTitle = isStatsMode ? 'Afficher les tâches complétées et annulées' : 'Masquer les tâches complétées et annulées';
  // Bascule visible seulement quand les complétées sont montrées (mode
  // normal) — sans effet en mode stats, où l'option n'aurait rien à montrer.
  const doneBottomTitle = doneBottom ? 'Garder les tâches complétées à leur place' : 'Envoyer les tâches complétées en bas de la liste';
  const doneBottomToggle = !isStatsMode
    ? `<button class="day-ctrl-toggle day-ctrl-toggle--switch${!doneBottom ? ' active' : ''}" onclick="window.app.toggleDayDoneBottom()" title="${doneBottomTitle}">
        <span class="day-ctrl-label">En bas</span>
      </button>`
    : '';

  const punctualTitle = isToday ? state.T.groupOnce : (state.lang === 'fr' ? 'Ponctuel' : 'One-time');
  const punctualHeader = `<div class="day-col-title-row">
    <div class="day-col-title">${punctualTitle}<button class="day-add-task-btn" onclick="window.app.openModal()" title="Ajouter une tâche">${_plusSVG}</button></div>
    <div class="day-col-controls${ctrlsCollapsed ? ' collapsed' : ''}">
      <div class="day-ctrl-expandable${!sortCollapsed ? ' expanded' : ''}">
        <button class="day-ctrl-toggle" onclick="window.app.toggleDaySort()" title="Tri">
          <span class="day-ctrl-label">Tri</span>
          <svg class="day-ctrl-chevron" viewBox="0 0 12 12" width="10" height="10"><polyline points="3 5 6 8 9 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="day-ctrl-group day-sort-group" onmouseenter="window.app.resetAutoCloseDaySort()">${sortBtns}</div>
      </div>

      <div class="day-ctrl-expandable${!colCollapsed ? ' expanded' : ''}">
        <button class="day-ctrl-toggle" onclick="window.app.toggleDayCol()" title="Colonnes">
          <span class="day-ctrl-label">Colonnes</span>
          <svg class="day-ctrl-chevron" viewBox="0 0 12 12" width="10" height="10"><polyline points="3 5 6 8 9 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="day-ctrl-group day-col-group" onmouseenter="window.app.resetAutoCloseDayCol()">${colBtns}</div>
      </div>

      <button class="day-ctrl-toggle day-ctrl-toggle--switch${isStatsMode ? ' active' : ''}" onclick="window.app.togglePastDisplay()" title="${doneToggleTitle}">
        <span class="day-ctrl-label">Complétés</span>
        ${isStatsMode && hiddenAll > 0 ? `<span class="day-ctrl-count">${hiddenAll}</span>` : ''}
      </button>
      ${doneBottomToggle}
      ${agendaSwitchButtonHTML()}

      <div class="day-ctrl-other${ctrlsCollapsed ? ' hidden' : ''}">
        ${spacerBtn}
      </div>

      <button class="day-ctrl-gear" onclick="window.app.toggleDayControls()" title="Options">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/></svg>
      </button>
    </div>
  </div>`;

  const actionBar = '';

  // ── Vue jour en mode AGENDA (grille horaire) ──────────────────────────
  // Bascule `dayLayout` : le corps de la vue (les 2 colonnes de cartes) est
  // remplacé par la grille horaire de agendaView.js. Tout ce qui l'entoure —
  // en-tête de date, mini-semaine, bandeau des retards, panneau de relance —
  // reste identique : seul le corps change.
  const dayLayout = getDayLayout();

  // Journée bouclée → 3e colonne : piocher dans le backlog ou créer une tâche
  const refillCol = hasRefill
    ? `<div class="day-col day-col--refill">${renderRefillPanel({ ds: dateStr, mode: 'day', doneCount: doneAll })}</div>`
    : '';

  // Bandeau « laissées pour compte » — suit l'utilisateur sur la vue
  // d'AUJOURD'HUI (pas sur le jour propre de la tâche) : ponctuelles non
  // complétées des PAST_DUE_WINDOW_DAYS derniers jours, tous jours confondus
  const PAST_DUE_WINDOW_DAYS = 5;
  let pastDueBanner = '';
  if (isToday) {
    const cutoff = DS(addDays(navDate, -PAST_DUE_WINDOW_DAYS));
    const missed = getOverduePunctual(todos).filter(t => t.date >= cutoff);
    if (missed.length > 0) {
      const collapsed = localStorage.getItem('pastDueBannerCollapsed') === 'true';
      const chevron = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="past-due-banner-chevron${collapsed ? ' collapsed' : ''}"><polyline points="6,9 12,15 18,9"/></svg>`;
      // Un seul jour concerné (le cas le plus fréquent : « Hier ») → ce jour
      // est intégré au titre plutôt que répété juste en dessous par le
      // libellé de groupe (renderOverdueGroups({ hideSingleGroupLabel })) — évite le doublon « 6 tâches... » / « Hier 6 »
      const missedDates = [...new Set(missed.map(t => t.date))];
      const singleDayLabel = missedDates.length === 1 ? dayLabel(missedDates[0], { inline: true }) : null;
      pastDueBanner = `<div class="past-due-banner">
        <div class="past-due-banner-head">
          <button class="past-due-banner-toggle" onclick="window.app.togglePastDueBanner()" title="${collapsed ? 'Déplier' : 'Replier'}">
            ${chevron}
            <span class="past-due-banner-icon">⚠</span>
            <span class="past-due-banner-text"><strong>${missed.length} tâche${missed.length > 1 ? 's' : ''} non accomplie${missed.length > 1 ? 's' : ''}</strong> ${singleDayLabel || `ces ${PAST_DUE_WINDOW_DAYS} derniers jours`}</span>
          </button>
        </div>
        ${!collapsed ? `<div class="past-due-banner-list">${renderOverdueGroups(missed, { hideSingleGroupLabel: true })}</div>${renderOverdueDropZones({
          onTodayClick: `window.app.postponeRecentOverdueToToday(${PAST_DUE_WINDOW_DAYS})`,
          bilanLink: true,
        })}` : ''}
      </div>`;
    }
  }

  // Poignée de partage Ponctuel ↔ Quotidien : colonne de grille de largeur 0
  // (elle ne coûte rien au gabarit), sa zone de saisie déborde en absolu dans
  // la gouttière. Le partage lui-même passe par les variables --day-punct/
  // --day-rec et JAMAIS par un grid-template-columns inline : les media
  // queries tablette/mobile doivent pouvoir reprendre la main sur le gabarit,
  // ce qu'un style inline leur interdirait quelle que soit leur spécificité.
  const colResize = `<div class="day-col-resize" id="dayColResize"><div class="day-col-resize-grip" title="Glisser pour redimensionner — double-clic pour réinitialiser"><svg viewBox="0 0 12 28" fill="currentColor" aria-hidden="true"><rect x="2" y="4" width="2.2" height="20" rx="1.1"/><rect x="7.8" y="4" width="2.2" height="20" rx="1.1"/></svg></div></div>`;

  if (dayLayout === 'agenda') {
    const agendaBody = renderAgendaBody(todos, navDate, {
      isToday,
      isStatsMode,
      hiddenAll,
      nowMinutes: now.getHours() * 60 + now.getMinutes(),
      refillHTML: hasRefill ? `<div class="agenda-refill">${renderRefillPanel({ ds: dateStr, mode: 'day', doneCount: doneAll })}</div>` : '',
    });
    return `<div class="day-view day-agenda-mode${isStatsMode ? ' stats-mode' : ''}${isPastDay ? ' day-past' : ''}"><div class="day-top-sticky">${_renderDayMiniWeek()}${header}</div>${pastDueBanner}${agendaBody}</div>`;
  }

  return `<div class="day-view${isStatsMode ? ' stats-mode' : ''}${isPastDay ? ' day-past' : ''}"><div class="day-top-sticky">${_renderDayMiniWeek()}${header}</div>${pastDueBanner}<div class="day-columns${hasRefill ? ' day-columns--three' : ''}" style="${daySplitVars()}"><div class="day-col day-col--punctual">${punctualHeader}${rightColItems}${doneAccordion}</div>${colResize}<div class="day-col day-col--recurring">${leftCol}</div>${refillCol}</div>${actionBar}</div>`;
}

function viewNavHeader(title, prevAction, nextAction, prevBigAction = null, nextBigAction = null) {
  const svgPrev     = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
  const svgNext     = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
  const svgPrevBig  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 18 12 12 18 6"/><polyline points="12 18 6 12 12 6"/></svg>`;
  const svgNextBig  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 18 12 12 6 6"/><polyline points="12 18 18 12 12 6"/></svg>`;
  const cols = prevBigAction ? '36px 52px 1fr 52px 36px' : '52px 1fr 52px';
  return `<div class="sticky-header-wrap"><div class="day-header-wrapper" style="grid-template-columns:${cols}">
    ${prevBigAction ? `<button class="day-nav-btn day-nav-btn--prev-month" onclick="${prevBigAction}">${svgPrevBig}</button>` : ''}
    <button class="day-nav-btn day-nav-btn--prev" onclick="${prevAction}">${svgPrev}</button>
    <div class="day-header"><div class="day-title-line">${title}</div></div>
    <button class="day-nav-btn day-nav-btn--next" onclick="${nextAction}">${svgNext}</button>
    ${nextBigAction ? `<button class="day-nav-btn day-nav-btn--next-month" onclick="${nextBigAction}">${svgNextBig}</button>` : ''}
  </div></div>`;
}

// fillDiv is absolute in .week-day-col, same pattern as month
function _weekCellStats(doneCount, totalCount) {
  const pct = Math.round(totalCount > 0 ? doneCount / totalCount * 100 : 0);

  return `<div class="mc-bars-fill" style="height:${Math.max(pct,5)}%;background:${_pctHsl(pct,.4)}"></div>
  <div class="week-cell-stats wc-bars">
    <div class="mc-bars-score" style="color:${_pctHsl(pct,.95)}">${doneCount}/${totalCount}</div>
  </div>`;
}

function _renderWeekBlock(todos, weekStart, todayStr) {
  const isStatsMode = state.pastDisplayMode === 'stats';
  let html = `<div class="week-grid">`;
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    const ds = DS(d);
    const isT = ds === todayStr;
    const isPast = ds < todayStr;
    const allItems = getTodosForDate(d, todos);
    const totalCount = allItems.filter(t => !isCancelled(t, d)).length;
    const doneCount = allItems.filter(t => isCompleted(t, d)).length;
    const showStats = isPast && !isT && isStatsMode;
    const todayStats = isT && isStatsMode;
    const nonDaily = allItems.filter(t => t.recurrence !== 'daily')
      .sort((a, b) => isCompleted(a, d) - isCompleted(b, d));
    const displayItems = showStats ? [] : todayStats ? nonDaily.filter(t => !isCompleted(t, d)) : nonDaily;
    let weekStatsHTML = '';
    if (showStats && totalCount > 0) {
      weekStatsHTML = _weekCellStats(doneCount, totalCount);
    }
    let todayScoreHTML = '';
    if (todayStats && doneCount > 0) {
      todayScoreHTML = `<div class="week-today-score">${doneCount}/${totalCount} ✓</div>`;
    }
    const noExpand = (showStats && !weekStatsHTML) || (!showStats && !todayStats && displayItems.length === 0);
    html += `<div class="week-day-col${isT?' is-today':isPast?' past':''}${noExpand?' empty':''}" onclick="window.app.setNavDateAndView('${ds}', 'day')">
      <div class="week-day-header">
        <div class="week-day-name">${state.DAYS[(d.getDay()+6)%7]}</div>
        <div class="week-day-num">${d.getDate()}</div>
      </div>
      <div class="week-day-todos" data-date="${ds}">
        ${todayScoreHTML}
        ${showStats ? weekStatsHTML : displayItems.map(t => {
          const done = isCompleted(t,d);
          const isRec = t.recurrence && t.recurrence!=='none';
          return `<div class="week-todo-item${done?' done':''}${isRec?' recurring':''}"${!isRec?` draggable="true" data-id="${t.id}" data-date="${ds}"`:''}  onclick="event.stopPropagation()">
            <div class="week-todo-check${done?' checked':''}" onclick="event.stopPropagation();window.app.toggleTodo('${t.id}',window.app.parseDS('${ds}'),event)"></div>
            <span class="week-todo-text" onclick="event.stopPropagation();window.app.openEditModal('${t.id}','${ds}')">${esc(t.title)}</span>
            <button class="week-todo-edit" onclick="event.stopPropagation();window.app.openEditModal('${t.id}','${ds}')">✎</button>
            <button class="week-todo-delete" onclick="event.stopPropagation();window.app.deleteTodo('${t.id}','${ds}')">×</button>
          </div>`;
        }).join('')}
        <button class="week-add-btn" onclick="event.stopPropagation();window.app.openModal(window.app.parseDS('${ds}'))" title="${state.T.addMore}">+</button>
      </div>
    </div>`;
  }
  html += `</div>`;
  return html;
}

export function renderWeekView(todos) {
  const todayStr = DS(new Date());
  const week1Start = startOfWeek(state.navDate);
  const week2Start = addDays(week1Start, 7);
  const week2End   = addDays(week2Start, 6);

  const startStr = week1Start.getDate() + ' ' + state.MONTHS[week1Start.getMonth()];
  const endStr   = week2End.getDate() + ' ' + state.MONTHS[week2End.getMonth()] + ' ' + week2End.getFullYear();

  const header = viewNavHeader(
    `${startStr} – ${endStr}`,
    `window.app.navigate(-1)`,
    `window.app.navigate(1)`,
    `window.app.navigateMonth(-1)`,
    `window.app.navigateMonth(1)`
  );

  return `<div class="week-view">
    <div class="week-container">
      ${header}
      ${_renderWeekBlock(todos, week1Start, todayStr)}
    </div>
    <div class="week-container">
      ${_renderWeekBlock(todos, week2Start, todayStr)}
    </div>
  </div>`;
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getTotalWeeks(year) {
  return getWeekNumber(new Date(year, 11, 31));
}

export function renderMonthView(todos) {
  const y = state.navDate.getFullYear(), m = state.navDate.getMonth();
  const firstDay = firstDayOfMonth(y,m);
  const days = daysInMonth(y,m);
  const todayDS = DS(new Date());

  const numRows = Math.ceil((firstDay + days) / 7);
  let grid = `<div class="month-grid-header">${state.DAYS.map(d=>`<div class="month-dow">${d}</div>`).join('')}</div>
    <div class="month-grid" style="grid-template-rows:repeat(${numRows},1fr)">`;

  // Prev month filler
  const prevDays = daysInMonth(y, m-1);
  for (let i=0; i<firstDay; i++) {
    const d2 = new Date(y, m-1, prevDays-firstDay+i+1);
    grid += monthCell(d2, true, todayDS, todos);
  }
  // Current month
  for (let d=1; d<=days; d++) {
    const date = new Date(y, m, d);
    grid += monthCell(date, false, todayDS, todos);
  }
  // Next month filler
  const total = firstDay + days;
  const nextCells = total%7 === 0 ? 0 : 7 - (total%7);
  for (let i=1; i<=nextCells; i++) {
    const d2 = new Date(y, m+1, i);
    grid += monthCell(d2, true, todayDS, todos);
  }
  grid += '</div>';

  return `<div class="month-view">
    ${viewNavHeader(`${state.MONTHS[m]} ${y}`, `window.app.navigate(-1)`, `window.app.navigate(1)`, `window.app.navigate(-12)`, `window.app.navigate(12)`)}
    ${grid}
  </div>`;
}

function monthMiniCal(y, m, todayDS) {
  // Handle month overflow (e.g. m = -1 or m = 12)
  const d0 = new Date(y, m, 1);
  const ry = d0.getFullYear(), rm = d0.getMonth();
  const days = daysInMonth(ry, rm);
  const firstDay = firstDayOfMonth(ry, rm);
  let cells = state.DAYS.map(d => `<div class="mym-dow">${d[0]}</div>`).join('');
  for (let i = 0; i < firstDay; i++) cells += '<div class="mym-day other"></div>';
  for (let d = 1; d <= days; d++) {
    const ds = DS(new Date(ry, rm, d));
    const isT = ds === todayDS;
    const isPast = ds < todayDS;
    cells += `<div class="mym-day${isT ? ' today' : isPast ? ' past' : ''}">${d}</div>`;
  }
  return `<div class="month-year-mini" onclick="window.app.setNavDateAndView(new Date(${ry},${rm},1),'month')">
    <div class="mym-label">${state.MONTHS[rm]} ${ry}</div>
    <div class="mym-grid">${cells}</div>
  </div>`;
}

// fill positioned relative to the full .month-cell (covers entire cell height)
function monthCellStats(date, ds, total, done) {
  const pct = Math.round(total > 0 ? done / total * 100 : 0);
  return `<div class="mc-bars-fill" style="height:${Math.max(pct, 5)}%;background:${_pctHsl(pct,.4)}"></div>
  <div class="month-cell-stats mc-bars">
    <div class="mc-bars-score" style="color:${_pctHsl(pct,.95)}">${done}/${total}</div>
  </div>`;
}

function monthCell(date, otherMonth, todayDS, todos) {
  const ds = DS(date);
  const isT = ds===todayDS;
  const isPast = ds < todayDS;
  const allItems = getTodosForDate(date, todos).filter(t => t.recurrence !== 'daily')
    .sort((a, b) => isCompleted(a, date) - isCompleted(b, date));
  const isStatsMode = state.pastDisplayMode === 'stats';
  const showStats = isPast && !isT && isStatsMode && allItems.length > 0;
  const todayStats = isT && isStatsMode;
  const items = todayStats ? allItems.filter(t => !isCompleted(t, date)) : allItems;
  const doneCount = allItems.filter(t => isCompleted(t, date)).length;
  const activeCount = allItems.filter(t => !isCancelled(t, date)).length;
  const visible = items.slice(0,3);
  const more = items.length - visible.length;
  let todayScoreHTML = '';
  if (todayStats && doneCount > 0) {
    todayScoreHTML = `<div class="month-today-score">${doneCount}/${activeCount} ✓</div>`;
  }
  return `<div class="month-cell${otherMonth?' other-month':''}${isT?' is-today':isPast?' past':''}" data-date="${ds}"
    onclick="window.app.setNavDateAndView('${ds}', 'day')">
    <div class="month-cell-top">
      <div class="month-cell-num">${date.getDate()}</div>
      ${todayScoreHTML}
      <button class="month-add-btn" onclick="event.stopPropagation();window.app.openModal(window.app.parseDS('${ds}'))">+</button>
    </div>
    ${showStats ? monthCellStats(date, ds, allItems.length, doneCount) : `${visible.map(t => {
      const done = isCompleted(t,date);
      const isRec = t.recurrence && t.recurrence!=='none';
      const isLongTitle = t.title.length > 28;
      return `<div class="month-todo-dot${done?' done':''}${isRec?' recurring':''}"${!isRec?` draggable="true" data-id="${t.id}" data-date="${ds}"`:''}>
        <div class="month-dot-check" onclick="event.stopPropagation();window.app.toggleTodo('${t.id}',window.app.parseDS('${ds}'),event)"></div>
        <span class="month-todo-dot-text${isLongTitle?' long-title':''}" title="${esc(t.title)}">${esc(t.title)}</span>
        <button class="month-todo-edit" onclick="event.stopPropagation();window.app.openEditModal('${t.id}','${ds}')">✎</button>
        <button class="month-todo-delete" onclick="event.stopPropagation();window.app.deleteTodo('${t.id}','${ds}')">×</button>
      </div>`;
    }).join('')}
    ${more>0 ? `<div class="month-more">${state.T.moreTasksCount.replace('{more}', more)}</div>` : ''}`}
  </div>`;
}

export function renderYearView(todos) {
  const y = state.navDate.getFullYear();
  const todayDS = DS(new Date());
  const td = new Date();
  const header = viewNavHeader(`${y}`, `window.app.navigate(-1)`, `window.app.navigate(1)`);
  let html = `<div class="year-view-wrapper">${header}<div class="year-view">`;
  for (let m=0; m<12; m++) {
    const hasToday = td.getFullYear()===y && td.getMonth()===m;
    const days = daysInMonth(y,m);
    const firstDay = firstDayOfMonth(y,m);

    const isYearRelevant = t => t.recurrence !== 'daily' && t.recurrence !== 'weekly';

    // Count todos for the month (exclude daily/weekly recurring tasks)
    let total=0, done=0;
    for (let d=1; d<=days; d++) {
      const date = new Date(y,m,d);
      const items = getTodosForDate(date, todos).filter(isYearRelevant);
      total += items.length;
      done += items.filter(t=>isCompleted(t,date)).length;
    }

    // Mini grid
    let miniHTML = '<div class="year-mini-grid">';
    miniHTML += state.DAYS.map(d=>`<div class="year-mini-dow">${d[0]}</div>`).join('');
    for (let i=0; i<firstDay; i++) miniHTML += '<div class="year-mini-day other">·</div>';
    for (let d=1; d<=days; d++) {
      const date = new Date(y,m,d);
      const ds = DS(date);
      const isT = ds===todayDS;
      const isPast = ds < todayDS;
      const hasTodos = getTodosForDate(date, todos).filter(isYearRelevant).length > 0;
      miniHTML += `<div class="year-mini-day${isT?' is-today':isPast?' past':''}${hasTodos&&!isT&&!isPast?' has-todos':''}" onclick="event.stopPropagation();window.app.setNavDateAndView('${ds}','day')">${d}</div>`;
    }
    miniHTML += '</div>';

    html += `<div class="year-month-card${hasToday?' has-today':''}"
      onclick="window.app.setNavDateAndView(new Date(${y},${m},1), 'month')">
      <div class="year-month-name">${state.MONTHS[m]}</div>
      ${miniHTML}
      ${total>0 ? `<div class="year-month-stats">
        <span class="year-stat"><span class="year-stat-dot" style="background:var(--primary)"></span>${total} tasks</span>
        <span class="year-stat"><span class="year-stat-dot" style="background:var(--success)"></span>${done} ${state.T.done}</span>
      </div>` : `<div class="year-month-stats" style="color:var(--border)">${state.T.noTasks}</div>`}
    </div>`;
  }
  html += '</div></div>';
  return html;
}

// Petit onglet toujours visible (même colonne repliée) pour replier/déplier
// la colonne calendrier — app.toggleCalSidebar() bascule juste une classe
// CSS sur #calSidebar (pas de render() complet, transition en pur CSS).
function _calSidebarHandleHTML() {
  const collapsed = localStorage.getItem('calSidebarCollapsed') === 'true';
  return `<button class="cal-sidebar-handle" onclick="window.app.toggleCalSidebar()" title="${collapsed ? 'Déplier le calendrier' : 'Replier le calendrier'}">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="cal-sidebar-handle-chevron${collapsed ? ' collapsed' : ''}"><polyline points="15,6 9,12 15,18"/></svg>
  </button>`;
}

export function renderSidebar(todos) {
  const MONTH_H = 185;
  const headerH = document.querySelector('header')?.offsetHeight ?? 65;
  const availH = window.innerHeight - headerH - 48;
  const maxMonths = Math.max(1, Math.floor(availH / MONTH_H));

  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
  const navDate = state.navDate;

  let html = '';
  for (let i = 0; i < maxMonths; i++) {
    const monthDate = new Date(navDate.getFullYear(), navDate.getMonth() + i, 1);
    html += renderSideMonth(monthDate, todayDate, navDate, todos);
  }
  return `${_calSidebarHandleHTML()}<div class="cal-sidebar-inner">${html}</div>`;
}

export function renderWeekSidebar(todos) {
  const MONTH_H = 185;
  const headerH = document.querySelector('header')?.offsetHeight ?? 65;
  const availH = window.innerHeight - headerH - 36;
  const maxMonths = Math.max(1, Math.floor(availH / MONTH_H));

  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
  const y = todayDate.getFullYear();
  const m = todayDate.getMonth();

  let html = '';
  for (let i = 0; i < maxMonths; i++) {
    const monthDate = new Date(y, m + i, 1);
    html += renderSideMonth(monthDate, todayDate, state.navDate, todos);
  }
  return `${_calSidebarHandleHTML()}<div class="cal-sidebar-inner">${html}</div>`;
}

function renderSideMonthWeek(monthDate, todayDate, weekStartDS, weekEndDS, todos) {
  const y = monthDate.getFullYear();
  const m = monthDate.getMonth();
  const days = daysInMonth(y, m);
  const firstDay = firstDayOfMonth(y, m);
  const todayDS = DS(todayDate);

  let html = `<div class="cal-sid-month">
    <div class="cal-sid-month-title" onclick="window.app.setNavDateAndView(new Date(${y},${m},1),'month')">${state.MONTHS[m]} ${y}</div>
    <div class="cal-sid-grid">`;

  html += state.DAYS.map(d => `<div class="cal-sid-dow">${d[0]}</div>`).join('');
  for (let i = 0; i < firstDay; i++) html += '<div class="cal-sid-day other-month"></div>';

  for (let d = 1; d <= days; d++) {
    const date = new Date(y, m, d);
    const ds = DS(date);
    const isToday = ds === todayDS;
    const isPast = ds < todayDS;
    const inWeek = ds >= weekStartDS && ds <= weekEndDS;
    const hasTodos = getTodosForDate(date, todos).filter(t => t.recurrence !== 'daily').length > 0;
    let cls = 'cal-sid-day';
    if (isPast && !isToday) cls += ' past';
    if (isToday) cls += ' today';
    if (inWeek) cls += ' nav-date';
    if (hasTodos) cls += ' has-todos';
    html += `<div class="${cls}" onclick="window.app.setNavDateAndView('${ds}','day')">${d}</div>`;
  }

  html += '</div></div>';
  return html;
}

export function renderYearSidebar() {
  const y = state.navDate.getFullYear();
  const todayY = new Date().getFullYear();
  let html = '<div class="year-sid-list">';
  for (let yr = y - 1; yr <= y + 4; yr++) {
    const isNav = yr === y;
    const isCurrent = yr === todayY;
    html += `<div class="year-sid-item${isNav ? ' nav-year' : ''}${isCurrent ? ' today-year' : ''}"
      onclick="window.app.setNavDateAndView(new Date(${yr},0,1),'year')">${yr}</div>`;
  }
  html += '</div>';
  return `${_calSidebarHandleHTML()}<div class="cal-sidebar-inner">${html}</div>`;
}

function renderSideMonth(monthDate, todayDate, navDate, todos) {
  const y = monthDate.getFullYear();
  const m = monthDate.getMonth();
  const days = daysInMonth(y, m);
  const firstDay = firstDayOfMonth(y, m);
  const todayDS = DS(todayDate);
  const navDS = DS(navDate);

  let html = `<div class="cal-sid-month">
    <div class="cal-sid-month-title" onclick="window.app.setNavDateAndView(new Date(${y},${m},1),'month')">${state.MONTHS[m]} ${y}</div>
    <div class="cal-sid-grid">`;

  html += state.DAYS.map(d => `<div class="cal-sid-dow">${d[0]}</div>`).join('');

  for (let i = 0; i < firstDay; i++) {
    html += '<div class="cal-sid-day other-month"></div>';
  }

  for (let d = 1; d <= days; d++) {
    const date = new Date(y, m, d);
    const ds = DS(date);
    const isToday = ds === todayDS;
    const isPast = ds < todayDS;
    const isNav = ds === navDS;
    const hasTodos = getTodosForDate(date, todos).filter(t => t.recurrence !== 'daily').length > 0;
    let cls = 'cal-sid-day';
    if (isPast && !isToday) cls += ' past';
    if (isToday) cls += ' today';
    if (isNav) cls += ' nav-date';
    if (hasTodos) cls += ' has-todos';
    html += `<div class="${cls}" data-date="${ds}" onclick="window.app.setNavDateAndView('${ds}','day')">${d}</div>`;
  }

  html += '</div></div>';
  return html;
}

export function getPeriodLabel() {
  const d = state.navDate;
  if (state.view==='day')   return '';
  if (state.view==='week') {
    return `${state.MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }
  if (state.view==='month') return `${state.MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  if (state.view==='year')  return `${d.getFullYear()}`;
}

export function getCloudsHTML(date, todos) {
  const frequent = getSuggestions(todos).slice(0, 3);
  const recent = getRecentTasks(todos).filter(t => !frequent.includes(t)).slice(0, 3);
  const allQA = [...frequent, ...recent];
  state.setSuggestions(allQA);
  const recurring = todos.filter(t => t.recurrence && t.recurrence!=='none');
  if (allQA.length===0 && recurring.length===0) return '';
  let html = '';
  if (allQA.length > 0) {
    const freqChips = frequent.map((t, i)=>`<div class="chip" data-chip-type="suggestion-render" data-chip-index="${i}">${esc(t)}</div>`).join('');
    const recentChips = recent.map((t, i)=>`<div class="chip" data-chip-type="suggestion-render" data-chip-index="${frequent.length + i}">${esc(t)}</div>`).join('');
    let chips = '';
    if (frequent.length > 0) chips += `<span class="qa-sub-label">${esc(state.T.frequentlyUsed)}</span>${freqChips}`;
    if (recent.length > 0) chips += `<span class="qa-sub-label">${esc(state.T.recentlyAdded)}</span>${recentChips}`;
    html += `<div class="clouds-section">
      <span class="cloud-label">${state.T.quickAccess}</span>
      <div class="cloud-chips">${chips}</div>
    </div>`;
  }
  if (recurring.length > 0) {
    html += `<div class="clouds-section">
      <span class="cloud-label">${state.T.recurringTasks}</span>
      <div class="cloud-chips">${recurring.map(t=>{
        const done = isCompleted(t, date);
        return `<div class="chip rec${done?' done':''}" title="${esc(recLabel(t))}" data-chip-type="recurring" data-chip-id="${t.id}">${esc(t.title)}</div>`;
      }).join('')}</div>
    </div>`;
  }

  // Setup event listeners after HTML is inserted
  setTimeout(() => {
    document.querySelectorAll('[data-chip-type="suggestion-render"]').forEach(chip => {
      chip.style.cursor = 'pointer';
      chip.addEventListener('click', () => {
        const title = allQA[parseInt(chip.dataset.chipIndex)];
        if (title) window.app.openModalWithTitle(title);
      });
    });
    document.querySelectorAll('[data-chip-type="recurring"]').forEach(chip => {
      chip.addEventListener('click', () => {
        window.app.openModalWithRecurring(chip.dataset.chipId);
      });
    });
  }, 0);

  return html;
}


export function renderCategoriesView(todos) {
  const categories = getCategories();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // Prefs
  const cols = parseInt(localStorage.getItem('categoriesCols') || '0');
  const sort = localStorage.getItem('categoriesSort') || 'name';

  // Compute stats for all categories
  const data = categories.map(p => {
    const tasks = todos.filter(t => _hasCat(t, p.id));
    const total = tasks.length;
    const punctual  = tasks.filter(t => !t.recurrence || t.recurrence === 'none');
    const recurring = tasks.filter(t => t.recurrence && t.recurrence !== 'none');
    const done = punctual.filter(t => t.completed).length + recurring.filter(t => isCompleted(t, today)).length;
    const pct = total > 0 ? Math.round(done / total * 100) : 0;
    return { p, total, done, pct };
  });

  // Sort
  const sorted = [...data].sort((a, b) => {
    if (sort === 'tasks')  return b.total - a.total;
    if (sort === 'pct')    return b.pct - a.pct;
    if (sort === 'done')   return b.done - a.done;
    return a.p.name.localeCompare(b.p.name, undefined, { sensitivity: 'base' });
  });

  // Grid cols style
  const gridStyle = cols > 0
    ? `grid-template-columns: repeat(${cols}, 1fr);`
    : `grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));`;

  // Column buttons (1–4 + auto)
  const colBtns = [1, 2, 3, 4, 0].map(c => {
    const label = c === 0 ? `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="0" y="0" width="4" height="4" rx="1"/><rect x="5" y="0" width="4" height="4" rx="1"/><rect x="10" y="0" width="4" height="4" rx="1"/><rect x="0" y="5" width="4" height="4" rx="1"/><rect x="5" y="5" width="4" height="4" rx="1"/><rect x="10" y="5" width="4" height="4" rx="1"/></svg>` : c;
    return `<button class="cat-col-btn${cols === c ? ' active' : ''}" onclick="window.app.setCategoriesCols(${c})" title="${c === 0 ? 'Auto' : `${c} colonne${c > 1 ? 's' : ''}`}">${label}</button>`;
  }).join('');

  // Sort options
  const sortOptions = [
    ['name',  'Nom A–Z'],
    ['tasks', 'Tâches ↓'],
    ['pct',   'Progression ↓'],
    ['done',  'Faites ↓'],
  ].map(([v, l]) => `<option value="${v}"${sort === v ? ' selected' : ''}>${l}</option>`).join('');

  const cards = sorted.map(({ p, total, done, pct }) => {
    const cardIcon = p.icon
      ? `<span class="category-card-icon" style="color:${p.color};">${categoryIconSVG(p.icon, 16, p.color)}</span>`
      : `<span class="category-card-dot" style="background:${p.color};"></span>`;
    return `
      <div class="category-card" onclick="window.app.openCategoryView('${p.id}')" style="border-top:3px solid ${p.color};">
        <div class="category-card-header">
          ${cardIcon}
          <span class="category-card-name">${esc(p.name)}</span>
        </div>
        ${p.description ? `<div class="category-card-description">${esc(p.description)}</div>` : ''}
        <div class="category-card-stats">
          <span class="category-card-stat">${total} tâche${total !== 1 ? 's' : ''}</span>
          <span class="category-card-stat category-card-stat--done">${done} faite${done !== 1 ? 's' : ''}</span>
          ${total > 0 ? `<span class="category-card-stat category-card-stat--pct">${pct}%</span>` : ''}
        </div>
        ${total > 0 ? `<div class="category-card-progress"><div class="category-card-progress-fill" style="width:${pct}%;background:${p.color};"></div></div>` : ''}
      </div>`;
  }).join('');

  const emptyState = categories.length === 0 ? `
    <div class="categories-empty">
      <div class="categories-empty-icon">📁</div>
      <p>Aucune catégorie pour l'instant.</p>
      <button class="btn btn-primary" onclick="window.app.addCategoryFromView()">＋ Créer une catégorie</button>
    </div>` : '';

  return `
    <div class="categories-view">
      <div class="categories-view-header">
        <h1 class="categories-view-title">${state.T.viewProjects}</h1>
        ${categories.length > 0 ? `
        <div class="categories-view-controls">
          <select class="categories-sort-select" onchange="window.app.setCategoriesSort(this.value)">${sortOptions}</select>
          <div class="categories-col-btns">${colBtns}</div>
        </div>` : ''}
      </div>
      ${emptyState}
      ${categories.length > 0 ? `<div class="categories-grid" style="${gridStyle}">
        ${cards}
        <div class="category-card category-card--add" onclick="window.app.addCategoryFromView()">
          <span class="category-card-add-icon">＋</span>
          <span class="category-card-add-label">Nouvelle catégorie</span>
        </div>
      </div>` : ''}
    </div>`;
}

// ─── Inbox View ────────────────────────────────────────────────────────────

export function getInboxCount(todos) {
  return todos.filter(t => (!t.recurrence || t.recurrence === 'none') && !t.date && !t.backlog && !t.completed && !t.cancelled).length;
}

export function getBacklogCount(todos) {
  return todos.filter(t => (!t.recurrence || t.recurrence === 'none') && !t.date && t.backlog && !t.completed && !t.cancelled).length;
}

export function renderInboxView(todos) {
  const inboxItems = todos.filter(t => (!t.recurrence || t.recurrence === 'none') && !t.date && !t.backlog && !t.completed && !t.cancelled);

  const prefs = getListPrefs('inbox');
  const priorityOrder = { high: 0, medium: 1, low: 2, '': 3 };
  const sorted = prefs.sort === 'manual' ? applyManualOrder('inbox', inboxItems) : [...inboxItems].sort((a, b) => {
    if (prefs.sort === 'priority') return (priorityOrder[a.priority || ''] ?? 3) - (priorityOrder[b.priority || ''] ?? 3);
    if (prefs.sort === 'title')    return a.title.localeCompare(b.title);
    if (prefs.sort === 'category') return (_getCatIds(a)[0] || '').localeCompare(_getCatIds(b)[0] || '');
    return b.id.localeCompare(a.id); // newest first (default)
  });
  const canDrag = prefs.sort === 'manual' && prefs.cols === '1';

  const categories = getCategories();
  const itemTemplate = t => {
    const cat = t.categoryId ? categories.find(c => c.id === t.categoryId) : null;
    const catBadge = cat
      ? `<span class="todo-category-badge" style="background:${cat.color}20;color:${cat.color};border-color:${cat.color}40;cursor:pointer;" onclick="event.stopPropagation();window.app.openCategoryView('${cat.id}')">${esc(cat.name.toUpperCase())}</span>`
      : '';
    const prioCls = t.priority ? ` prio-${t.priority}` : '';
    // Sous-tâches affichées dans la carte comme en vue jour — ds vide : un
    // item d'inbox n'a pas de date, donc rien à focuser (cf. subtaskListHTML)
    const subtasks = subtaskParts(t, '');
    const hasMeta = !!catBadge || !!subtasks.toggle;
    return `
      <div class="inbox-item${prioCls}${canDrag ? ' inbox-item--draggable' : ''}" data-id="${t.id}" draggable="true"
        ondragstart="window.app.planDragStart(event,'${t.id}')"
        ondragend="this.classList.remove('dragging')"
        onclick="window.app.clickInboxItem(event,'${t.id}')">
        ${canDrag ? _nestBadgeHTML : ''}
        <div class="todo-check" onclick="event.stopPropagation();window.app.toggleInboxDone('${t.id}')"></div>
        <div class="inbox-item-body">
          <span class="todo-text editable" ondblclick="event.stopPropagation();window.app.quickEditInboxTitle(this,'${t.id}')">${esc(t.title)}</span>
          ${hasMeta ? `<div class="todo-meta">${catBadge}${subtasks.toggle}</div>` : ''}
        </div>
        <div class="inbox-item-actions">
          ${subtasks.addBtn}
          <button class="inbox-assign-today" onclick="event.stopPropagation();window.app.assignInboxToday('${t.id}')" title="Assigner à aujourd'hui">
            ${state.T.assignToday || "Auj."}
          </button>
          <button class="inbox-assign-date" onclick="event.stopPropagation();window.app.openEditModal('${t.id}', null)" title="Choisir une date">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </button>
          <button class="todo-edit" onclick="event.stopPropagation();window.app.openEditModal('${t.id}', null)">✎</button>
          <button class="todo-delete" onclick="event.stopPropagation();window.app.deleteTodo('${t.id}', null)">×</button>
        </div>
        ${subtasks.block}
      </div>`;
  };
  const items = prefs.sort === 'manual' ? renderGroupedItems(sorted, itemTemplate) : sorted.map(itemTemplate).join('');

  const empty = sorted.length === 0 ? `
    <div class="inbox-empty">
      <div class="inbox-empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="opacity:.3"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>
      </div>
      <p>Inbox vide — tout est planifié !</p>
      <button class="btn btn-primary" onclick="window.app.openModalForInbox()">＋ Capturer une tâche</button>
    </div>` : '';

  const sortLabels = [['date', 'Récentes'], ['priority', 'Priorité'], ['title', 'A–Z'], ['category', 'Catégorie'], ['manual', 'Manuel']];
  const sortBtns = sortLabels.map(([v, l]) =>
    `<button class="inbox-sort-btn${prefs.sort === v ? ' active' : ''}" onclick="window.app.setListQueueView('inbox','sort','${v}')">${l}</button>`
  ).join('');
  const colBtns = ['1', '2', '3', '4', 'auto'].map(c =>
    `<button class="inbox-sort-btn${prefs.cols === c ? ' active' : ''}" onclick="window.app.setListQueueView('inbox','cols','${c}')" title="${c === 'auto' ? 'Colonnes automatiques' : `${c} colonne${c !== '1' ? 's' : ''}`}">${c === 'auto' ? 'Auto' : c}</button>`
  ).join('');
  const colsStyle = prefs.cols === 'auto'
    ? 'grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));'
    : `--cols:${prefs.cols};`;

  return `
    <div class="inbox-view">
      <div class="inbox-view-header">
        <div class="inbox-view-title-block">
          <h1 class="inbox-view-title">Inbox</h1>
          <p class="inbox-view-desc">Tâches capturées sans date <br>— à planifier ou traiter dès que possible.</p>
        </div>
        <div class="inbox-view-controls">
          <span class="inbox-count-label">${sorted.length} tâche${sorted.length !== 1 ? 's' : ''}</span>
          <div class="inbox-sort-group">${sortBtns}</div>
          <div class="inbox-sort-group">${colBtns}</div>
          <button class="btn btn-primary inbox-add-btn" onclick="window.app.openModalForInbox()">＋ Capturer</button>
        </div>
      </div>
      ${empty}
      ${sorted.length > 0 ? `<div class="inbox-list" id="inboxList" style="${colsStyle}">${items}</div>` : ''}
    </div>`;
}

export function renderBacklogView(todos) {
  const backlogItems = todos.filter(t => (!t.recurrence || t.recurrence === 'none') && t.backlog && !t.date && !t.completed && !t.cancelled);

  const prefs = getListPrefs('backlog');
  // Contexte du rail : les compteurs de zones et les piles se calculent
  // toujours sur le backlog COMPLET (backlogItems), jamais sur la liste déjà
  // filtrée — sinon cliquer un filtre remettrait tous les autres compteurs à
  // zéro et on ne saurait plus où aller ensuite.
  const railCtx = { categories: getCategories(), projects: getProjects(), intentions: _getIntentions(), items: backlogItems };
  const railFilter = getRailFilter();
  const filterFn = railFilterFn(railFilter, railCtx);
  const visibleItems = filterFn ? backlogItems.filter(filterFn) : backlogItems;

  const priorityOrder = { high: 0, medium: 1, low: 2, '': 3 };
  const sorted = prefs.sort === 'manual' ? applyManualOrder('backlog', visibleItems) : [...visibleItems].sort((a, b) => {
    if (prefs.sort === 'priority') return (priorityOrder[a.priority || ''] ?? 3) - (priorityOrder[b.priority || ''] ?? 3);
    if (prefs.sort === 'title')    return a.title.localeCompare(b.title);
    if (prefs.sort === 'category') return (_getCatIds(a)[0] || '').localeCompare(_getCatIds(b)[0] || '');
    return b.id.localeCompare(a.id);
  });
  const canDrag = prefs.sort === 'manual' && prefs.cols === '1';

  const categories = railCtx.categories;
  const itemTemplate = t => {
    const cat = t.categoryId ? categories.find(c => c.id === t.categoryId) : null;
    const catBadge = cat
      ? `<span class="todo-category-badge" style="background:${cat.color}20;color:${cat.color};border-color:${cat.color}40;cursor:pointer;" onclick="event.stopPropagation();window.app.openCategoryView('${cat.id}')">${esc(cat.name.toUpperCase())}</span>`
      : '';
    const prioCls = t.priority ? ` prio-${t.priority}` : '';
    // Sous-tâches affichées dans la carte comme en vue jour — ds vide : un
    // item de backlog n'a pas de date, donc rien à focuser (subtaskListHTML)
    const subtasks = subtaskParts(t, '');
    return `
      <div class="inbox-item${prioCls}${canDrag ? ' inbox-item--draggable' : ''}" data-id="${t.id}" draggable="true"
        ondragstart="window.app.planDragStart(event,'${t.id}')"
        ondragend="this.classList.remove('dragging')"
        onclick="window.app.clickInboxItem(event,'${t.id}')">
        ${canDrag ? _nestBadgeHTML : ''}
        <div class="todo-check" onclick="event.stopPropagation();window.app.toggleInboxDone('${t.id}')"></div>
        <div class="inbox-item-body">
          <span class="todo-text editable" ondblclick="event.stopPropagation();window.app.quickEditInboxTitle(this,'${t.id}')">${esc(t.title)}</span>
          <div class="todo-meta">${catBadge}${ageBadge(t)}${deadlineBadge(t, { ghostIfEmpty: true })}${subtasks.toggle}</div>
        </div>
        <div class="inbox-item-actions">
          ${subtasks.addBtn}
          <button class="inbox-assign-today" onclick="event.stopPropagation();window.app.assignInboxToday('${t.id}')" title="Planifier aujourd'hui">
            ${state.T.assignToday || "Auj."}
          </button>
          <button class="inbox-assign-date" onclick="event.stopPropagation();window.app.openEditModal('${t.id}', null)" title="Choisir une date">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </button>
          <button class="todo-edit" onclick="event.stopPropagation();window.app.openEditModal('${t.id}', null)">✎</button>
          <button class="todo-delete" onclick="event.stopPropagation();window.app.deleteTodo('${t.id}', null)">×</button>
        </div>
        ${subtasks.block}
      </div>`;
  };
  const items = prefs.sort === 'manual' ? renderGroupedItems(sorted, itemTemplate) : sorted.map(itemTemplate).join('');

  const backlogIcon = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="opacity:.3"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>`;
  // Deux états vides bien distincts : un backlog réellement vide (on propose
  // d'ajouter) vs un filtre du rail qui ne ramène rien (on propose de le
  // retirer — sinon la vue a l'air cassée alors qu'il y a bien des tâches)
  const empty = sorted.length > 0 ? '' : (filterFn ? `
    <div class="inbox-empty">
      <div class="inbox-empty-icon">${backlogIcon}</div>
      <p>Aucune tâche dans « ${esc(railFilterLabel(railFilter, railCtx))} ».</p>
      <button class="btn btn-primary" onclick="window.app.railFilter(null)">Retirer le filtre</button>
    </div>` : `
    <div class="inbox-empty">
      <div class="inbox-empty-icon">${backlogIcon}</div>
      <p>Backlog vide — rien en attente !</p>
      <button class="btn btn-primary" onclick="window.app.openModalForBacklog()">＋ Ajouter au backlog</button>
    </div>`);

  const sortLabels = [['date', 'Récentes'], ['priority', 'Priorité'], ['title', 'A–Z'], ['category', 'Catégorie'], ['manual', 'Manuel']];
  const sortBtns = sortLabels.map(([v, l]) =>
    `<button class="inbox-sort-btn${prefs.sort === v ? ' active' : ''}" onclick="window.app.setListQueueView('backlog','sort','${v}')">${l}</button>`
  ).join('');
  const colBtns = ['1', '2', '3', '4', 'auto'].map(c =>
    `<button class="inbox-sort-btn${prefs.cols === c ? ' active' : ''}" onclick="window.app.setListQueueView('backlog','cols','${c}')" title="${c === 'auto' ? 'Colonnes automatiques' : `${c} colonne${c !== '1' ? 's' : ''}`}">${c === 'auto' ? 'Auto' : c}</button>`
  ).join('');
  const colsStyle = prefs.cols === 'auto'
    ? 'grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));'
    : `--cols:${prefs.cols};`;

  // Items abandonnés (t.cancelled) : filtrés de la liste principale ET sans
  // date, ils ne réapparaîtraient nulle part ailleurs dans l'app (aucun jour
  // ne peut les afficher, contrairement à une ponctuelle datée annulée qui
  // reste visible barrée sur son jour) — d'où cet accordéon, replié par
  // défaut, qui reste leur seule porte de sortie : restaurer via la case ✕,
  // ou supprimer. C'est ce qui rend la zone « Abandonner » du rail sûre.
  const cancelledItems = todos.filter(t => (!t.recurrence || t.recurrence === 'none') && t.backlog && !t.date && !t.completed && t.cancelled);
  let cancelledAccordion = '';
  if (cancelledItems.length) {
    const isOpen = localStorage.getItem('backlogCancelledOpen') === '1';
    const chevron = `<svg class="day-done-chevron" viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 4 6 7 9 4"/></svg>`;
    const rows = cancelledItems.map(t => `
        <div class="inbox-item cancelled" data-id="${t.id}" onclick="window.app.clickInboxItem(event,'${t.id}')">
          <div class="todo-check" title="Abandonnée — cliquer pour restaurer" onclick="event.stopPropagation();window.app.cancelTodo('${t.id}', null)"></div>
          <div class="inbox-item-body"><span class="todo-text">${esc(t.title)}</span></div>
          <div class="inbox-item-actions">
            <button class="todo-delete" onclick="event.stopPropagation();window.app.deleteTodo('${t.id}', null)">×</button>
          </div>
        </div>`).join('');
    cancelledAccordion = `<div class="day-done-accordion backlog-cancelled${isOpen ? ' open' : ''}">
        <button class="day-done-accordion-hd" onclick="window.app.toggleBacklogCancelled()">
          ${chevron}<span class="day-done-accordion-lbl">Abandonnées</span><span class="day-done-accordion-cnt">${cancelledItems.length}</span>
        </button>
        <div class="day-done-accordion-bd"><div class="inbox-list" style="--cols:1">${rows}</div></div>
      </div>`;
  }

  // .backlog-layout : liste à gauche (largeur inchangée), rail de classement
  // collant à droite. Le rail est une vraie cible de drop native — ne jamais
  // poser filter/backdrop-filter/transform sur un de ses ancêtres (cf.
  // renderBacklogRail, backlogInboxView.js).
  return `
    <div class="inbox-view inbox-view--rail">
      <div class="inbox-view-header">
        <div class="inbox-view-title-block">
          <h1 class="inbox-view-title">Backlog</h1>
          <p class="inbox-view-desc">Tâches mises de côté <br>— à reprendre quand le moment est venu.</p>
        </div>
        <div class="inbox-view-controls">
          <span class="inbox-count-label">${filterFn ? `${sorted.length} sur ${backlogItems.length}` : `${sorted.length} tâche${sorted.length !== 1 ? 's' : ''}`}</span>
          ${filterFn ? `<button class="backlog-filter-chip" onclick="window.app.railFilter(null)" title="Retirer le filtre du rail">${esc(railFilterLabel(railFilter, railCtx))}<span class="backlog-filter-chip-x">✕</span></button>` : ''}
          <div class="inbox-sort-group">${sortBtns}</div>
          <div class="inbox-sort-group">${colBtns}</div>
          <button class="btn btn-primary inbox-add-btn" onclick="window.app.openModalForBacklog()">＋ Ajouter</button>
        </div>
      </div>
      <div class="backlog-layout${backlogItems.length ? '' : ' backlog-layout--norail'}">
        <div class="backlog-main">
          ${empty}
          ${sorted.length > 0 ? `<div class="inbox-list" id="backlogList" style="${colsStyle}">${items}</div>` : ''}
          ${cancelledAccordion}
        </div>
        ${backlogItems.length ? renderBacklogRail(prefs, railCtx) : ''}
      </div>
    </div>`;
}

export function setupTodoItemHoverAnimations() {
  document.querySelectorAll('.todo-item').forEach(item => {
    item.addEventListener('mouseenter', () => {
      gsap.to(item, { y: -3, duration: 0.12, ease: 'power2.out' });
      // Survol prolongé (2 s) → édition rapide de la durée estimée
      item._estimateHoverTimer = setTimeout(() => window.app.showEstimateHoverEdit(item), 2000);
    });
    item.addEventListener('mouseleave', () => {
      gsap.to(item, { y: 0, duration: 0.18, ease: 'power2.inOut' });
      clearTimeout(item._estimateHoverTimer);
    });
  });

  const placeholder = document.querySelector('.add-item-placeholder');
  if (!placeholder) return;
  const pill  = placeholder.querySelector('.add-item-placeholder-pill');
  const icon  = placeholder.querySelector('.add-item-placeholder-icon');
  const label = placeholder.querySelector('.add-item-placeholder-label');

  // Reset state au repos : pill = 36px (juste l'icon)
  gsap.set(pill,  { width: 36 });
  gsap.set(icon,  { rotation: 0 });
  gsap.set(label, { opacity: 0, visibility: 'hidden' });

  placeholder.addEventListener('mouseenter', () => {
    const tl = gsap.timeline();
    tl.to(pill,  { width: 130, duration: 0.45, ease: 'elastic.out(1, 0.65)' }, 0);
    tl.to(icon,  { rotation: 135, duration: 0.4, ease: 'back.out(2.5)' }, 0);
    tl.set(label, { visibility: 'visible' }, 0.2);
    tl.to(label, { opacity: 1, duration: 0.2, ease: 'power2.out' }, 0.2);
  });

  placeholder.addEventListener('mouseleave', () => {
    const tl = gsap.timeline();
    tl.to(label, { opacity: 0, duration: 0.12, ease: 'power2.in', onComplete: () => gsap.set(label, { visibility: 'hidden' }) }, 0);
    tl.to(icon,  { rotation: 0, duration: 0.35, ease: 'back.out(2)' }, 0.05);
    tl.to(pill,  { width: 36, duration: 0.32, ease: 'power3.inOut' }, 0.08);
  });
}

// ─── Plan Inbox List (stripped, for plan split-pane) ─────────────────────────

export function renderPlanInboxList(todos, overdueSelected = new Set()) {
  const todayStr = DS(new Date());
  const grouped = localStorage.getItem('planGrouped') === 'true';
  const priorityOrder = { high: 0, medium: 1, low: 2, '': 3 };
  const cats = getCategories();

  const _mkSortFn = (sec) => {
    const s = localStorage.getItem(`planSort_${sec}`) || 'date';
    const d = localStorage.getItem(`planSortDir_${sec}`) || 'desc';
    return (a, b) => {
      let cmp = 0;
      if (s === 'priority') cmp = (priorityOrder[a.priority||'']??3) - (priorityOrder[b.priority||'']??3);
      else if (s === 'tag') {
        const ca = cats.find(c => _hasCat(a, c.id))?.name || 'zzz';
        const cb = cats.find(c => _hasCat(b, c.id))?.name || 'zzz';
        cmp = ca.localeCompare(cb);
      } else cmp = b.id.localeCompare(a.id);
      return d === 'asc' ? -cmp : cmp;
    };
  };

  const _mkOverdueSortFn = () => {
    const s = localStorage.getItem('planSort_overdue') || 'date';
    const d = localStorage.getItem('planSortDir_overdue') || 'desc';
    return (a, b) => {
      let cmp = 0;
      if (s === 'priority') cmp = (priorityOrder[a.priority||'']??3) - (priorityOrder[b.priority||'']??3);
      else if (s === 'tag') {
        const ca = cats.find(c => _hasCat(a, c.id))?.name || 'zzz';
        const cb = cats.find(c => _hasCat(b, c.id))?.name || 'zzz';
        cmp = ca.localeCompare(cb);
      } else cmp = b.date.localeCompare(a.date); // plus récent (plus proche d'aujourd'hui) en premier
      return d === 'asc' ? -cmp : cmp;
    };
  };

  const overdueItems = todos
    .filter(t => t.date && t.date < todayStr && !t.completed && !t.cancelled && (!t.recurrence || t.recurrence === 'none'))
    .sort(_mkOverdueSortFn());

  const noDateItems = todos.filter(t => (!t.recurrence || t.recurrence === 'none') && !t.date && !t.completed && !t.cancelled);

  const inboxItems   = [...noDateItems.filter(t => !t.backlog)].sort(_mkSortFn('inbox'));
  const backlogItems = [...noDateItems.filter(t =>  t.backlog)].sort(_mkSortFn('backlog'));

  const chevron = `<svg class="day-ctrl-chevron" viewBox="0 0 12 12" width="10" height="10"><polyline points="3 5 6 8 9 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const sortLabels = [['date','Par date'],['priority','Priorité'],['tag','Tags']];

  const _mkSortCtrl = (sec) => {
    const s = localStorage.getItem(`planSort_${sec}`) || 'date';
    const d = localStorage.getItem(`planSortDir_${sec}`) || 'desc';
    const collapsed = localStorage.getItem(`planSortCollapsed_${sec}`) !== 'false';
    const arrow = d === 'asc' ? ' ↑' : ' ↓';
    const btns = sortLabels.map(([v,l]) =>
      `<button class="day-ctrl-btn${s===v?' active':''}" onclick="window.app.setPlanSort('${v}','${sec}')">${l}${s===v?arrow:''}</button>`
    ).join('');
    return `<div class="day-ctrl-expandable${!collapsed?' expanded':''}">
      <button class="day-ctrl-toggle" onclick="window.app.togglePlanSortMenu('${sec}')" title="Tri">
        <span class="day-ctrl-label">Tri</span>${chevron}
      </button>
      <div class="day-ctrl-group">${btns}</div>
    </div>`;
  };
  const inboxSortCtrl   = _mkSortCtrl('inbox');
  const backlogSortCtrl = _mkSortCtrl('backlog');

  const groupToggle = `<button class="day-ctrl-toggle plan-group-toggle${grouped?' active':''}" onclick="window.app.togglePlanGrouped()" title="Grouper par tag">
    <span class="day-ctrl-label">Grouper</span>
  </button>`;

  const colCount = parseInt(localStorage.getItem('planColCount') || '1');
  const colCollapsed = localStorage.getItem('planColCollapsed') !== 'false';
  const colBtns = [1, 2, 3].map(n =>
    `<button class="day-ctrl-btn${n===colCount?' active':''}" onclick="window.app.setPlanColCount(${n});window.app.closePlanColMenu()">${n} col${n>1?'s':''}</button>`
  ).join('');
  const colCtrl = `
    <div class="day-ctrl-expandable${!colCollapsed ? ' expanded' : ''}">
      <button class="day-ctrl-toggle" onclick="window.app.togglePlanColMenu()" title="Colonnes">
        <span class="day-ctrl-label">Colonnes</span>${chevron}
      </button>
      <div class="day-ctrl-group">${colBtns}</div>
    </div>`;
  const _GAP = 10, _MIN_COL_W = 180;
  const gridCss = colCount <= 1
    ? 'grid-template-columns:1fr'
    : `grid-template-columns:repeat(auto-fill,minmax(max(${_MIN_COL_W}px,calc((100% - ${(colCount-1)*_GAP}px)/${colCount})),1fr))`;
  const colStyle     = `style="${gridCss}"`;
  const groupedStyle = `style="${gridCss};align-items:start"`;

  const _ageBadge = (t) => {
    const ts = parseInt(t.id);
    if (isNaN(ts) || ts < 1000000000000) return '';
    const days = Math.floor((Date.now() - ts) / 86400000);
    const label = days === 0 ? "Auj." : days === 1 ? '1j' : days < 30 ? `${days}j` : days < 365 ? `${Math.floor(days/30)}mo` : `${Math.floor(days/365)}an`;
    return `<span class="plan-stat-badge plan-stat-age" title="Créé il y a ${days} jour${days>1?'s':''}">⏱ ${label}</span>`;
  };
  const _histBadge = (t) => {
    const done = (t.completedDates || []).length;
    if (!done) return '';
    return `<span class="plan-stat-badge plan-stat-hist" title="${done} fois complété">✓ ${done}</span>`;
  };
  const _prioBadge = (t) => {
    if (!t.priority) return '';
    const cfg = { high: ['H', '#ef4444', 'Priorité haute'], medium: ['M', '#f59e0b', 'Priorité moyenne'], low: ['L', '#3b82f6', 'Priorité basse'] };
    const [letter, color, title] = cfg[t.priority] || [];
    return letter ? `<span class="plan-prio-dot" style="background:${color};box-shadow:0 0 0 2px ${color}33" title="${title}">${letter}</span>` : '';
  };

  const itemRow = (t) => {
    const cat = t.categoryId ? cats.find(c => c.id === t.categoryId) : null;
    const categoryBadge = cat
      ? `<span class="todo-category-badge" style="background:${cat.color};color:#fff;border-color:${cat.color};cursor:pointer;" onclick="event.stopPropagation();window.app.openCategoryView('${cat.id}')">${esc(cat.name.toUpperCase())}</span>`
      : '';
    const prioCls = t.priority ? ` prio-${t.priority}` : '';
    const meta = [categoryBadge, _prioBadge(t), _ageBadge(t), _histBadge(t)].filter(Boolean).join('');
    return `
      <div class="todo-item${prioCls}" data-id="${t.id}" draggable="true" data-group="plan"
        ondragstart="window.app.planDragStart(event,'${t.id}')"
        ondragend="this.classList.remove('dragging')"
        onclick="window.app.openEditModal('${t.id}',null)">
        <div class="todo-content">
          <span class="todo-text editable" ondblclick="event.stopPropagation();window.app.quickEditInboxTitle(this,'${t.id}')">${esc(t.title)}</span>
          ${meta ? `<div class="todo-meta">${meta}</div>` : ''}
        </div>
        <div class="todo-actions">
          <button class="todo-delete" onclick="event.stopPropagation();window.app.deleteTodo('${t.id}',null)" title="Supprimer">×</button>
        </div>
        <div class="plan-drag-handle" title="Glisser vers le calendrier">${_dragHandleSVG}</div>
      </div>`;
  };

  const _buildGroupDefs = (items, sortKey) => {
    if (sortKey === 'priority') {
      const prioCfg = [
        { key: 'high',   label: 'Haute',        color: '#ef4444' },
        { key: 'medium', label: 'Moyenne',       color: '#f59e0b' },
        { key: 'low',    label: 'Basse',         color: '#3b82f6' },
        { key: '',       label: 'Sans priorité', color: 'var(--text-muted)' },
      ];
      const byPrio = {};
      for (const t of items) { const k = t.priority || ''; (byPrio[k] = byPrio[k] || []).push(t); }
      return prioCfg.filter(p => byPrio[p.key]?.length).map(p => ({ ...p, items: byPrio[p.key] }));
    } else if (sortKey === 'date') {
      const now = Date.now();
      const DAY = 86400000;
      const buckets = [
        { key: 'new',   label: '< 7j',    color: 'var(--success)',    test: (age) => age < 7 * DAY },
        { key: 'week',  label: '7–30j',   color: 'var(--text-muted)', test: (age) => age < 30 * DAY },
        { key: 'month', label: '1–3 mois',color: 'var(--text-muted)', test: (age) => age < 90 * DAY },
        { key: 'old',   label: '> 3 mois',color: '#ef4444',           test: () => true },
      ];
      const byBucket = {};
      for (const t of items) {
        const age = now - parseInt(t.id);
        const b = buckets.find(bk => bk.test(age)) || buckets[buckets.length - 1];
        (byBucket[b.key] = byBucket[b.key] || []).push(t);
      }
      return buckets.filter(b => byBucket[b.key]?.length).map(b => ({ ...b, items: byBucket[b.key] }));
    } else {
      const byTag = {};
      for (const t of items) { const k = t.categoryId || '__none__'; (byTag[k] = byTag[k] || []).push(t); }
      return [...cats, null].flatMap(cat => {
        const key = cat ? cat.id : '__none__';
        if (!byTag[key]?.length) return [];
        return [{ key, label: cat ? esc(cat.name) : 'Sans tag', color: cat?.color || 'var(--text-muted)', items: byTag[key] }];
      });
    }
  };

  const _renderGrouped = (items, rowFn, sec) => {
    if (!grouped) return items.map(rowFn).join('');
    const sortKey = localStorage.getItem(`planSort_${sec}`) || 'date';
    const groupDefs = _buildGroupDefs(items, sortKey);
    if (colCount <= 1) {
      return groupDefs.map(g =>
        `<div class="plan-group-label" style="border-left-color:${g.color};color:${g.color}">${g.label}</div>` +
        g.items.map(rowFn).join('')
      ).join('');
    } else {
      return groupDefs.map(g =>
        `<div class="plan-group-card">` +
        `<div class="plan-group-label" style="border-left-color:${g.color};color:${g.color}">${g.label}</div>` +
        g.items.map(rowFn).join('') +
        `</div>`
      ).join('');
    }
  };

  const inboxEmpty = '';

  const backlogEmpty = backlogItems.length === 0
    ? `<div class="plan-backlog-empty">Backlog vide</div>`
    : '';

  const overdueCollapsed  = localStorage.getItem('planOverdueCollapsed')  === 'true';
  const inboxCollapsed   = localStorage.getItem('planInboxCollapsed')   === 'true';
  const backlogCollapsed = localStorage.getItem('planBacklogCollapsed') === 'true';

  const _sectionChevron = `<button class="day-ctrl-toggle plan-section-collapse-btn" onclick="window.app.togglePlanSection('SECTION')" title="Réduire/déplier"><svg class="day-ctrl-chevron plan-section-chevron" viewBox="0 0 12 12" width="10" height="10"><polyline points="3 5 6 8 9 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
  const _daysAgo = (dateStr) => {
    const d = Math.round((new Date(todayStr + 'T00:00:00') - new Date(dateStr + 'T00:00:00')) / 86400000);
    return d === 1 ? 'hier' : `il y a ${d}j`;
  };

  const _checkSVG = `<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 6 5 9 10 3"/></svg>`;

  const overdueItemRow = (t) => {
    const sel = overdueSelected.has(t.id);
    const cat = t.categoryId ? cats.find(c => c.id === t.categoryId) : null;
    const categoryBadge = cat
      ? `<span class="todo-category-badge" style="background:${cat.color};color:#fff;border-color:${cat.color};cursor:pointer;" onclick="event.stopPropagation();window.app.openCategoryView('${cat.id}')">${esc(cat.name.toUpperCase())}</span>`
      : '';
    const prioCls = t.priority ? ` prio-${t.priority}` : '';
    const agobadge = `<span class="plan-stat-badge plan-stat-overdue">${_daysAgo(t.date)}</span>`;
    const meta = [categoryBadge, _prioBadge(t), agobadge, _histBadge(t)].filter(Boolean).join('');
    return `
      <div class="todo-item${prioCls}${sel ? ' overdue-selected' : ''}" data-id="${t.id}" draggable="true" data-group="plan"
        ondragstart="window.app.planDragStart(event,'${t.id}')"
        ondragend="this.classList.remove('dragging')"
        onclick="window.app.openEditModal('${t.id}',null)">
        <div class="overdue-checkbox${sel ? ' checked' : ''}" onclick="event.stopPropagation();window.app.overdueToggleSelect('${t.id}')">${sel ? _checkSVG : ''}</div>
        <div class="todo-content">
          <span class="todo-text editable" ondblclick="event.stopPropagation();window.app.quickEditInboxTitle(this,'${t.id}')">${esc(t.title)}</span>
          ${meta ? `<div class="todo-meta">${meta}</div>` : `<div class="todo-meta">${agobadge}</div>`}
        </div>
        <div class="todo-actions" onclick="event.stopPropagation()">
          <button class="todo-action-btn todo-action-btn--today" onclick="window.app.overdueToToday('${t.id}')" title="Reporter à aujourd'hui">Auj.</button>
          <button class="todo-action-btn" onclick="window.app.overdueToBacklog('${t.id}')" title="Mettre en backlog">BL</button>
        </div>
        <div class="plan-drag-handle" title="Glisser vers le calendrier">${_dragHandleSVG}</div>
      </div>`;
  };

  const overdueCtrlBtns = `<div class="day-col-controls">
    ${_mkSortCtrl('overdue')}${colCtrl}
    ${_sectionChevron.replace('SECTION', 'overdue')}
  </div>`;

  const overdueSection = overdueItems.length === 0 ? '' : `
    <div class="plan-overdue-section${overdueCollapsed ? ' collapsed' : ''}">
      <div class="plan-inbox-header plan-overdue-header">
        <span class="plan-inbox-header-title">En retard</span>
        <span class="plan-inbox-count plan-overdue-count">${overdueItems.length}</span>
        ${overdueCtrlBtns}
      </div>
      <div class="plan-overdue-list" style="${gridCss}">
        ${overdueItems.map(overdueItemRow).join('')}
      </div>
      <div class="plan-overdue-footer">
        <button id="overdueFooterToday" class="plan-overdue-big-btn plan-overdue-big-btn--primary" onclick="window.app.overdueActionToday()">Reporter tout à aujourd'hui</button>
        <button id="overdueFooterBacklog" class="plan-overdue-big-btn" onclick="window.app.overdueActionBacklog()">Tout en backlog</button>
      </div>
    </div>`;

  return `
    ${overdueSection}
    <div class="plan-inbox-section${inboxCollapsed ? ' collapsed' : ''}"
      ondragover="event.preventDefault();this.classList.add('drag-over')"
      ondragleave="if(!this.contains(event.relatedTarget))this.classList.remove('drag-over')"
      ondrop="window.app.planDropToInbox(event)">
      <div class="plan-inbox-header">
        <span class="plan-inbox-header-title">Inbox</span>
        <span class="plan-inbox-count">${inboxItems.length}</span>
        <div class="day-col-controls">${inboxSortCtrl}${colCtrl}${groupToggle}${_sectionChevron.replace('SECTION', 'inbox')}</div>
      </div>
      <div class="plan-inbox-list" ${grouped ? groupedStyle : colStyle}>
        ${inboxEmpty}${_renderGrouped(inboxItems, itemRow, 'inbox')}
        <div class="plan-add-item plan-add-item--full" onclick="window.app.openModalForInbox()">＋ Capturer</div>
      </div>
    </div>
    <div class="plan-backlog-section${backlogCollapsed ? ' collapsed' : ''}"
      ondragover="event.preventDefault();this.classList.add('drag-over')"
      ondragleave="if(!this.contains(event.relatedTarget))this.classList.remove('drag-over')"
      ondrop="window.app.planDropToBacklog(event)">
      <div class="plan-backlog-header">
        <span class="plan-backlog-title">Backlog</span>
        <span class="plan-backlog-count">${backlogItems.length}</span>
        <div class="day-col-controls">${backlogSortCtrl}${colCtrl}${groupToggle}${_sectionChevron.replace('SECTION', 'backlog')}</div>
      </div>
      <div class="plan-backlog-list" ${grouped ? groupedStyle : colStyle}>
        ${backlogEmpty}${_renderGrouped(backlogItems, itemRow, 'backlog')}
        <div class="plan-add-item plan-add-item--full" onclick="window.app.openModalForBacklog()">＋ Ajouter</div>
      </div>
    </div>`;
}

// ─── Projects View ────────────────────────────────────────────────────────────

export function renderProjectsView() {
  const projects = getProjects();
  const cols = parseInt(localStorage.getItem('projectsCols') || '0');
  const sort = localStorage.getItem('projectsSort') || 'name';
  const todayDS = DS(new Date());

  const sorted = [...projects].sort((a, b) => {
    if (sort === 'status') return (a.status||'active').localeCompare(b.status||'active');
    if (sort === 'deadline') {
      const da = a.deadline || '9999-99-99', db = b.deadline || '9999-99-99';
      return da.localeCompare(db);
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  const gridStyle = cols > 0
    ? `grid-template-columns: repeat(${cols}, 1fr);`
    : `grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));`;

  const colBtns = [1,2,3,4,0].map(c => {
    const label = c === 0 ? `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="0" y="0" width="4" height="4" rx="1"/><rect x="5" y="0" width="4" height="4" rx="1"/><rect x="10" y="0" width="4" height="4" rx="1"/><rect x="0" y="5" width="4" height="4" rx="1"/><rect x="5" y="5" width="4" height="4" rx="1"/><rect x="10" y="5" width="4" height="4" rx="1"/></svg>` : c;
    return `<button class="cat-col-btn${cols===c?' active':''}" onclick="window.app.setProjectsCols(${c})">${label}</button>`;
  }).join('');

  const sortOptions = [
    ['name','Nom A–Z'],['status','Statut'],['deadline','Échéance ↑'],
  ].map(([v,l]) => `<option value="${v}"${sort===v?' selected':''}>${l}</option>`).join('');

  const cards = sorted.map(p => {
    const status = p.status || 'active';
    const statusLabel = PROJECT_STATUS_LABELS[status] || status;
    const statusColor = PROJECT_STATUS_COLORS[status] || '#10b981';
    const isDim = status === 'archived' || status === 'completed';
    const cardIcon = p.icon
      ? `<span class="category-card-icon" style="color:${p.color};">${categoryIconSVG(p.icon, 16, p.color)}</span>`
      : `<span class="category-card-dot" style="background:${p.color};"></span>`;
    const statusBadge = `<span class="category-status-badge" style="background:${statusColor}20;color:${statusColor};border-color:${statusColor}40;">${statusLabel}</span>`;
    const deadlineBadge = p.deadline
      ? `<span class="category-deadline-badge${p.deadline < todayDS && status !== 'completed' ? ' overdue' : ''}">📅 ${p.deadline.slice(5).replace('-','/')}</span>`
      : '';
    return `
      <div class="category-card${isDim ? ' category-card--dim' : ''}" onclick="window.app.openProjectPanel('${p.id}')" style="border-top:3px solid ${p.color};">
        <div class="category-card-header">
          ${cardIcon}
          <span class="category-card-name">${esc(p.name)}</span>
          <div class="category-card-badges">${statusBadge}${deadlineBadge}</div>
        </div>
        ${p.description ? `<div class="category-card-description">${esc(p.description)}</div>` : ''}
      </div>`;
  }).join('');

  const empty = projects.length === 0 ? `
    <div class="categories-empty">
      <div class="categories-empty-icon">🗂</div>
      <p>Aucun projet pour l'instant.</p>
      <button class="btn btn-primary" onclick="window.app.addProjectFromView()">＋ Créer un projet</button>
    </div>` : '';

  return `
    <div class="categories-view">
      <div class="categories-view-header">
        <div class="inbox-view-title-block">
          <h1 class="inbox-view-title">Projets</h1>
          <p class="inbox-view-desc">Livrables concrets regroupant vos tâches —<br>chaque projet a un début, une fin, et un résultat tangible.</p>
        </div>
        ${projects.length > 0 ? `
        <div class="categories-view-controls">
          <select class="categories-sort-select" onchange="window.app.setProjectsSort(this.value)">${sortOptions}</select>
          <div class="categories-col-btns">${colBtns}</div>
        </div>` : ''}
      </div>
      ${empty}
      ${projects.length > 0 ? `<div class="categories-grid" style="${gridStyle}">
        ${cards}
        <div class="category-card category-card--add" onclick="window.app.addProjectFromView()">
          <span class="category-card-add-icon">＋</span>
          <span class="category-card-add-label">Nouveau projet</span>
        </div>
      </div>` : ''}
    </div>`;
}

// ─── Intentions View ──────────────────────────────────────────────────────────

function _getIntentions() {
  try { return JSON.parse(localStorage.getItem('intentions') || '[]'); } catch { return []; }
}

export function renderIntentionsView(todos) {
  const intentions = _getIntentions();


  const allProjects = getProjects();
  const cards = intentions.map(int => {
    const intTasks = todos.filter(t => _hasInt(t, int.id));
    const count = intTasks.length;
    const chips = intTasks.slice(0, 6).map(t =>
      `<span class="intention-task-chip">${esc(t.title)}</span>`
    ).join('') + (count > 6 ? `<span class="intention-task-chip">+${count - 6}</span>` : '');

    const linkedProjects = allProjects.filter(p => (p.intentionIds || []).includes(int.id));
    const projectChips = linkedProjects.map(p =>
      `<span class="intention-project-chip" style="border-color:${p.color};" onclick="event.stopPropagation();window.app.openProjectPanel('${p.id}')">
        <span style="width:6px;height:6px;border-radius:50%;background:${p.color};flex-shrink:0;display:inline-block;"></span>
        ${esc(p.name)}
      </span>`
    ).join('');
    const projectsSection = linkedProjects.length > 0
      ? `<details class="intention-card-projects" onclick="event.stopPropagation()">
          <summary>${linkedProjects.length} projet${linkedProjects.length > 1 ? 's' : ''} lié${linkedProjects.length > 1 ? 's' : ''}</summary>
          <div class="intention-card-project-chips">${projectChips}</div>
        </details>`
      : '';

    return `
      <div class="intention-card" style="border-top:3px solid ${int.color};" onclick="window.app.openIntentionPanel('${int.id}')">
        <div class="intention-card-header">
          <span class="intention-card-dot" style="background:${int.color};"></span>
          <span class="intention-card-name">${esc(int.title)}</span>
          <span class="intention-card-count">${count} tâche${count !== 1 ? 's' : ''}</span>
        </div>
        ${int.description ? `<div class="intention-card-description">${esc(int.description)}</div>` : ''}
        ${projectsSection}
        ${count > 0 ? `<div class="intention-card-tasks">${chips}</div>` : ''}
      </div>`;
  }).join('');

  const empty = intentions.length === 0 ? `
    <div class="categories-empty">
      <div class="categories-empty-icon">🧭</div>
      <p>Aucune intention pour l'instant.<br>Une intention représente un but à long terme qui donne du sens à vos tâches.</p>
      <button class="btn btn-primary" onclick="window.app.addIntentionFromView()">＋ Créer une intention</button>
    </div>` : '';

  return `
    <div class="intentions-view">
      <div class="intentions-view-header">
        <div class="inbox-view-title-block">
          <h1 class="inbox-view-title">Intentions</h1>
          <p class="inbox-view-desc">Vos buts à long terme — le pourquoi derrière tout ce que vous faites.</p>
        </div>
      </div>
      ${empty}
      ${intentions.length > 0 ? `<div class="categories-grid">
        ${cards}
        <div class="intention-card intention-card--add" onclick="window.app.addIntentionFromView()">
          <span class="intention-card-add-icon">＋</span>
          <span class="intention-card-add-label">Nouvelle intention</span>
        </div>
      </div>` : ''}
    </div>`;
}

// ─── Analyse View ──────────────────────────────────────────────────────────────

export function renderAnalyseView(todos) {
  const todayStr = DS(new Date());
  const monthStr = todayStr.slice(0, 7);
  const lastMonthDate = new Date();
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonthStr = DS(lastMonthDate).slice(0, 7);
  const weekStart = DS(addDays(new Date(), -6));
  const prevWeekStart = DS(addDays(new Date(), -13));
  const prevWeekEnd = DS(addDays(new Date(), -7));

  function countCompletions(dateFilter) {
    let n = 0;
    todos.forEach(t => {
      if (t.recurrence && t.recurrence !== 'none') {
        n += (t.completedDates || []).filter(dateFilter).length;
      } else if (t.completed && t.date && dateFilter(t.date)) {
        n++;
      }
    });
    return n;
  }

  const completedThisMonth  = countCompletions(d => d.startsWith(monthStr));
  const completedLastMonth  = countCompletions(d => d.startsWith(lastMonthStr));
  const completedThisWeek   = countCompletions(d => d >= weekStart && d <= todayStr);
  const completedLastWeek   = countCompletions(d => d >= prevWeekStart && d <= prevWeekEnd);

  function deltaHTML(cur, prev) {
    if (prev === 0 && cur === 0) return `<span class="analyse-delta neutral">— identique</span>`;
    if (prev === 0) return `<span class="analyse-delta up">▲ nouveau</span>`;
    const diff = cur - prev;
    const pct = Math.round(Math.abs(diff) / prev * 100);
    if (diff > 0) return `<span class="analyse-delta up">▲ +${pct}% vs période préc.</span>`;
    if (diff < 0) return `<span class="analyse-delta down">▼ −${pct}% vs période préc.</span>`;
    return `<span class="analyse-delta neutral">— identique</span>`;
  }

  // 7-day bar chart
  const chartDays = Array.from({length: 7}, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i)); return DS(d);
  });
  const chartData = chartDays.map(ds => ({ label: ds.slice(5).replace('-', '/'), count: countCompletions(d => d === ds) }));
  const maxBar = Math.max(...chartData.map(d => d.count), 1);
  const bars = chartData.map(d => {
    const pct = Math.max(Math.round(d.count / maxBar * 100), d.count > 0 ? 4 : 0);
    return `<div class="analyse-bar-col">
      <div class="analyse-bar" style="height:${pct}%;" title="${d.count} complétée${d.count !== 1 ? 's' : ''}"></div>
      <div class="analyse-bar-label">${d.label}</div>
    </div>`;
  }).join('');

  // Lingering tasks (oldest first)
  function ageFmt(id) {
    const days = Math.floor((Date.now() - parseInt(id)) / 86400000);
    if (days === 0) return "aujourd'hui";
    if (days === 1) return '1 jour';
    if (days < 30) return `${days} j`;
    const m = Math.floor(days / 30);
    return `${m} mois`;
  }
  const pendingNonRec = todos.filter(t => (!t.recurrence || t.recurrence === 'none') && !t.completed && !t.cancelled);
  const inboxTasks   = pendingNonRec.filter(t => !t.date && !t.backlog).sort((a,b) => parseInt(a.id) - parseInt(b.id));
  const backlogTasks = pendingNonRec.filter(t => t.backlog && !t.date).sort((a,b) => parseInt(a.id) - parseInt(b.id));
  const backlogPastDeadlineCount = backlogTasks.filter(t => t.deadline && t.deadline < todayStr).length;
  const lingeringItems = [...inboxTasks, ...backlogTasks].sort((a,b) => parseInt(a.id) - parseInt(b.id)).slice(0, 10);
  const lingeringList = lingeringItems.map(t =>
    `<div class="analyse-lingering-item" onclick="window.app.openEditModal('${t.id}', null)">
      <span class="analyse-lingering-title">${esc(t.title)}</span>
      ${deadlineBadge(t)}
      <span class="analyse-lingering-age">${ageFmt(t.id)}</span>
    </div>`
  ).join('');

  // Per intention
  const intentions = _getIntentions();
  const intentionRows = intentions.map(int => {
    const intTasks = todos.filter(t => _hasInt(t, int.id) && (!t.recurrence || t.recurrence === 'none'));
    const count = intTasks.length;
    const done  = intTasks.filter(t => t.completed).length;
    const pct   = count > 0 ? Math.round(done / count * 100) : 0;
    return `<div class="analyse-list-item">
      <span class="analyse-list-dot" style="background:${int.color};"></span>
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="analyse-list-name">${esc(int.codename || int.title)}</span>
          <span class="analyse-list-count">${count} tâche${count !== 1 ? 's' : ''}</span>
        </div>
        <div class="analyse-progress-bar">
          <div class="analyse-progress-fill" style="width:${pct}%;background:${int.color};"></div>
        </div>
      </div>
    </div>`;
  }).join('');

  // Per project
  const projects = getProjects();
  const projRows = projects.map(p => {
    const pTasks = todos.filter(t => _hasProj(t, p.id) && (!t.recurrence || t.recurrence === 'none'));
    const count = pTasks.length;
    const done  = pTasks.filter(t => t.completed).length;
    const pct   = count > 0 ? Math.round(done / count * 100) : 0;
    return `<div class="analyse-list-item">
      <span class="analyse-list-dot" style="background:${p.color};"></span>
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="analyse-list-name">${esc(p.name)}</span>
          <span class="analyse-list-count">${count} tâche${count !== 1 ? 's' : ''}</span>
        </div>
        <div class="analyse-progress-bar">
          <div class="analyse-progress-fill" style="width:${pct}%;background:${p.color};"></div>
        </div>
      </div>
    </div>`;
  }).join('');

  const nonRecTodos    = todos.filter(t => !t.recurrence || t.recurrence === 'none');
  const totalNonRec    = nonRecTodos.length;
  const completedTotal = nonRecTodos.filter(t => t.completed).length;
  const monthName      = new Date().toLocaleString('fr', { month: 'long' });
  const adherenceRows  = renderAdherenceRows(todos, { limit: 10 });
  const timeStats      = computeTimeStats(todos);
  const timeStatsRows  = renderTimeStatsRows(todos, { limit: 10 });
  const bestImprovement = timeStats.find(r => (r.improvementPct || 0) >= 15) || null;
  const totalFocusMinutes = computeTotalFocusMinutes(todos);

  return `<div class="analyse-view">
    <div class="analyse-view-header">
      <div class="inbox-view-title-block">
        <h1 class="inbox-view-title">Analyse</h1>
        <p class="inbox-view-desc">Vue d'ensemble de votre activité — complétions, tendances et état de votre backlog.</p>
      </div>
    </div>

    <p class="analyse-section-title">Complétions</p>
    <div class="analyse-grid">
      <div class="analyse-card">
        <div class="analyse-card-title">Ce mois (${monthName})</div>
        <div class="analyse-big-num">${completedThisMonth}</div>
        <div class="analyse-sub">tâches complétées</div>
        ${deltaHTML(completedThisMonth, completedLastMonth)}
      </div>
      <div class="analyse-card">
        <div class="analyse-card-title">Cette semaine</div>
        <div class="analyse-big-num">${completedThisWeek}</div>
        <div class="analyse-sub">7 derniers jours</div>
        ${deltaHTML(completedThisWeek, completedLastWeek)}
      </div>
      <div class="analyse-card">
        <div class="analyse-card-title">Total complétées</div>
        <div class="analyse-big-num">${completedTotal}</div>
        <div class="analyse-sub">sur ${totalNonRec} tâches ponctuelles</div>
      </div>
      <div class="analyse-card analyse-card--wide">
        <div class="analyse-card-title">Activité — 7 derniers jours</div>
        <div class="analyse-chart">${bars}</div>
      </div>
    </div>

    <p class="analyse-section-title">En suspens</p>
    <div class="analyse-grid">
      <div class="analyse-card">
        <div class="analyse-card-title">Inbox non traitée</div>
        <div class="analyse-big-num">${inboxTasks.length}</div>
        <div class="analyse-sub">${inboxTasks.length > 0 ? `plus ancienne : ${ageFmt(inboxTasks[0].id)}` : 'tout est planifié !'}</div>
      </div>
      <div class="analyse-card">
        <div class="analyse-card-title">Backlog</div>
        <div class="analyse-big-num">${backlogTasks.length}</div>
        <div class="analyse-sub">idées en attente</div>
        ${backlogPastDeadlineCount > 0 ? `<div class="analyse-sub analyse-sub--danger">${backlogPastDeadlineCount} échéance${backlogPastDeadlineCount > 1 ? 's' : ''} dépassée${backlogPastDeadlineCount > 1 ? 's' : ''}</div>` : ''}
      </div>
      ${lingeringList ? `<div class="analyse-card analyse-card--wide">
        <div class="analyse-card-title">Tâches qui traînent — les plus anciennes</div>
        <div class="analyse-lingering">${lingeringList}</div>
      </div>` : ''}
    </div>

    ${adherenceRows ? `
    <p class="analyse-section-title">Récurrentes — adhérence</p>
    <div class="analyse-grid">
      <div class="analyse-card analyse-card--wide">
        <div class="analyse-card-title">7 derniers jours (les moins suivies d'abord)</div>
        <div class="adherence-list">${adherenceRows}</div>
      </div>
    </div>` : ''}

    ${totalFocusMinutes > 0 ? `
    <p class="analyse-section-title">Temps passé en focus</p>
    <div class="analyse-grid">
      <div class="analyse-card">
        <div class="analyse-card-title">Temps total en focus</div>
        <div class="analyse-big-num">${fmtMinutes(totalFocusMinutes)}</div>
        <div class="analyse-sub">toutes tâches confondues</div>
      </div>
      ${bestImprovement ? `
      <div class="analyse-card analyse-card--wide timestat-highlight">
        <div class="timestat-highlight-emoji">🏆</div>
        <div>
          <div class="timestat-highlight-title">Meilleure progression</div>
          <div class="timestat-highlight-text">${esc(bestImprovement.todo.title)} — ${bestImprovement.improvementPct}% plus rapide qu'avant (${Math.round(bestImprovement.recentAvg)} min en moyenne dernièrement, contre ${Math.round(bestImprovement.priorAvg)} min avant)</div>
        </div>
      </div>` : ''}
      ${timeStatsRows ? `
      <div class="analyse-card analyse-card--wide">
        <div class="analyse-card-title">Durée réelle par tâche (mieux classées d'abord)</div>
        <div class="timestat-list">${timeStatsRows}</div>
      </div>` : ''}
    </div>` : ''}

    ${intentions.length > 0 ? `
    <p class="analyse-section-title">Par intention</p>
    <div class="analyse-grid">
      <div class="analyse-card analyse-card--wide">
        <div class="analyse-card-title">Tâches par intention (ponctuelles)</div>
        <div class="analyse-list">${intentionRows || '<p class="analyse-empty">Aucune tâche taguée</p>'}</div>
      </div>
    </div>` : ''}

    ${projects.length > 0 ? `
    <p class="analyse-section-title">Par projet</p>
    <div class="analyse-grid">
      <div class="analyse-card analyse-card--wide">
        <div class="analyse-card-title">Tâches par projet (ponctuelles)</div>
        <div class="analyse-list">${projRows || '<p class="analyse-empty">Aucune tâche dans les projets</p>'}</div>
      </div>
    </div>` : ''}
  </div>`;
}

// ─── Search View ──────────────────────────────────────────────────────────

export function renderSearchView() {
  const query          = localStorage.getItem('searchQuery')           || '';
  const filterPriority = localStorage.getItem('searchFilter_priority') || '';
  const filterDone     = localStorage.getItem('searchFilter_done')     || '';
  const filterType     = localStorage.getItem('searchFilter_type')     || '';
  const sort           = localStorage.getItem('searchSort')            || 'date';
  const cols           = parseInt(localStorage.getItem('searchColumns') || '1', 10);
  const history        = JSON.parse(localStorage.getItem('searchHistory') || '[]');

  const q        = query.toLowerCase().trim();
  const today    = new Date();
  const isActive = q || filterPriority || filterDone || filterType;

  // Filter
  const filtered = state.todos.filter(t => {
    if (q && !t.title.toLowerCase().includes(q)) return false;
    if (filterPriority && (t.priority || '') !== filterPriority) return false;
    if (filterDone === 'done'   && !isCompleted(t, today)) return false;
    if (filterDone === 'undone' &&  isCompleted(t, today)) return false;
    if (filterType === 'has-date'  && !t.date) return false;
    if (filterType === 'no-date'   &&  t.date) return false;
    if (filterType === 'recurring' && (!t.recurrence || t.recurrence === 'none')) return false;
    return true;
  });

  // Sort
  const prioOrder = { high: 0, medium: 1, low: 2, '': 3 };
  const results = [...filtered].sort((a, b) => {
    if (sort === 'priority') return (prioOrder[a.priority||''] ?? 3) - (prioOrder[b.priority||''] ?? 3);
    if (sort === 'title')    return a.title.localeCompare(b.title);
    if (sort === 'category') return (a.categoryId||'').localeCompare(b.categoryId||'');
    return b.id.localeCompare(a.id); // date — newest first
  });

  const loupeIcon  = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
  const searchIcon = `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;

  // Shared title block
  const desc = isActive
    ? `${results.length} résultat${results.length !== 1 ? 's' : ''}${q ? ` pour "<strong>${esc(query)}</strong>"` : ''}`
    : `Cherche parmi ${state.todos.length} tâches.`;

  const header = `
    <div class="inbox-view-header search-page-header">
      <div class="inbox-view-title-block">
        <h1 class="inbox-view-title">${searchIcon} Recherche</h1>
        <p class="inbox-view-desc">${desc}</p>
      </div>
    </div>`;

  // ── MINIMAL STATE ────────────────────────────────────────────────────────
  if (!isActive) {
    const histHtml = history.length ? `
      <div class="search-history">
        <span class="search-history-label">Récents :</span>
        <div class="search-history-chips">
          ${history.map(h => `<button class="search-history-chip" data-query="${esc(h)}" onclick="window.app.openSearchView(this.dataset.query)">${esc(h)}</button>`).join('')}
        </div>
        <button class="search-history-clear" onclick="window.app.clearSearchHistory()">Effacer</button>
      </div>` : '';

    return `
      <div class="search-page">
        ${header}
        <div class="search-minimal">
          <div class="search-field-wrap search-field-wrap--big">
            ${loupeIcon}
            <input type="text" id="searchPageInput" class="search-page-input"
              value="${esc(query)}" placeholder="Chercher parmi ${state.todos.length} tâches..."
              oninput="window.app.onSearchPageInput(event)"
              onkeydown="window.app.onSearchPageKeydown(event)">
            <button class="search-go-btn" onclick="window.app.onSearchPageSubmit()">${loupeIcon} Recherche</button>
          </div>
          ${histHtml}
        </div>
      </div>`;
  }

  // ── ACTIVE STATE ─────────────────────────────────────────────────────────
  const fBtn = (group, val, label) => {
    const curr = group === 'priority' ? filterPriority : group === 'done' ? filterDone : filterType;
    return `<button class="search-filter-btn${curr === val ? ' active' : ''}" onclick="window.app.toggleSearchFilter('${group}','${val}')">${label}</button>`;
  };

  const sortLabels = [['date','Récentes'],['priority','Priorité'],['title','A–Z'],['category','Catégorie']];
  const sortBtns = sortLabels.map(([v,l]) =>
    `<button class="search-sort-btn${sort===v?' active':''}" onclick="window.app.setSearchSort('${v}')">${l}</button>`
  ).join('');

  const colBtns = [1,2,3].map(n => {
    const icons = ['▤','⊞','⊟⊟⊟'];
    return `<button class="search-col-btn${cols===n?' active':''}" onclick="window.app.setSearchColumns(${n})" title="${n} colonne${n>1?'s':''}">${icons[n-1]}</button>`;
  }).join('');

  const histSidebar = history.length ? `
    <div class="search-sidebar-section">
      <div class="search-filter-label search-filter-label--row">Historique
        <button class="search-history-clear" onclick="window.app.clearSearchHistory()">Effacer</button>
      </div>
      <div class="search-history-chips search-history-chips--col">
        ${history.map(h => `<button class="search-history-chip" data-query="${esc(h)}" onclick="window.app.openSearchView(this.dataset.query)">${esc(h)}</button>`).join('')}
      </div>
    </div>` : '';

  const items = results.map(t => todoItemHTML(t, today, 'search', false, false)).join('');
  const emptyState = `
    <div class="search-empty">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:.3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <p>${q ? `Aucun résultat pour "<strong>${esc(query)}</strong>"` : 'Sélectionne un filtre pour explorer.'}</p>
    </div>`;

  return `
    <div class="search-page">
      ${header}
      <div class="search-active-bar">
        <div class="search-field-wrap search-field-wrap--compact">
          ${loupeIcon}
          <input type="text" id="searchPageInput" class="search-page-input"
            value="${esc(query)}" placeholder="Chercher..."
            oninput="window.app.onSearchPageInput(event)"
            onkeydown="window.app.onSearchPageKeydown(event)">
          <button class="search-go-btn" onclick="window.app.onSearchPageSubmit()">${loupeIcon} Recherche</button>
        </div>
      </div>
      <div class="search-page-body">
        <div class="search-sidebar">
          <div class="search-sidebar-section">
            <div class="search-filter-label">Tri</div>
            <div class="search-sort-group">${sortBtns}</div>
          </div>
          <div class="search-sidebar-section">
            <div class="search-filter-label">Colonnes</div>
            <div class="search-col-group">${colBtns}</div>
          </div>
          <div class="search-sidebar-section search-filters">
            <div class="search-filter-group">
              <div class="search-filter-label">Priorité</div>
              <div class="search-filter-options">
                ${fBtn('priority', '', 'Toutes')}
                ${fBtn('priority', 'high', '↑ Urgent')}
                ${fBtn('priority', 'medium', '→ Moyen')}
                ${fBtn('priority', 'low', '↓ Bas')}
              </div>
            </div>
            <div class="search-filter-group">
              <div class="search-filter-label">Statut</div>
              <div class="search-filter-options">
                ${fBtn('done', '', 'Tous')}
                ${fBtn('done', 'undone', 'En cours')}
                ${fBtn('done', 'done', 'Complétées')}
              </div>
            </div>
            <div class="search-filter-group">
              <div class="search-filter-label">Type</div>
              <div class="search-filter-options">
                ${fBtn('type', '', 'Toutes')}
                ${fBtn('type', 'has-date', 'Avec date')}
                ${fBtn('type', 'no-date', 'Sans date')}
                ${fBtn('type', 'recurring', 'Récurrentes')}
              </div>
            </div>
          </div>
          ${histSidebar}
          <div class="search-result-count">${results.length} résultat${results.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="search-results search-results--${cols}">
          ${results.length > 0 ? items : emptyState}
        </div>
      </div>
    </div>`;
}

// ─── Counters View ────────────────────────────────────────────────────────

export function renderCountersView(todos) {
  const counterTodos = todos.filter(t => t.counterEnabled && t.countTo !== undefined);
  if (!counterTodos.length) {
    return `<div class="counters-view counters-view--empty">
      <div class="view-empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <p>Aucun compteur actif.</p>
        <p class="view-empty-hint">Active un compteur sur n'importe quelle tâche dans Détails → Compteur de progression.</p>
      </div>
    </div>`;
  }
  const cards = counterTodos.map(t => {
    const cur  = t.countCurrent ?? t.countFrom ?? 0;
    const from = t.countFrom ?? 0;
    const to   = t.countTo;
    const unit = t.countUnit ? esc(t.countUnit) : '';
    const pct  = to > from ? Math.min(100, Math.round(((cur - from) / (to - from)) * 100)) : 0;
    const done = cur >= to;
    return `<div class="counter-card${done ? ' counter-card--done' : ''}">
      <div class="counter-card-header">
        <span class="counter-card-title">${esc(t.title)}</span>
        <button class="counter-card-edit-btn" onclick="window.app.openEditModal('${t.id}')" title="Modifier">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
      </div>
      <div class="counter-card-progress-bar"><div class="counter-card-progress-fill" style="width:${pct}%"></div></div>
      <div class="counter-card-controls">
        <button class="counter-card-btn counter-card-btn--dec" onclick="window.app.decrementCount('${t.id}')" title="Décrémenter"${cur <= from ? ' disabled' : ''}>−</button>
        <div class="counter-card-values">
          <span class="counter-card-cur">${cur}</span>
          <span class="counter-card-sep"> / ${to}${unit ? ' ' + unit : ''}</span>
          <span class="counter-card-pct">${pct}%</span>
        </div>
        <button class="counter-card-btn counter-card-btn--inc" onclick="window.app.incrementCount('${t.id}')" title="Incrémenter"${cur >= to ? ' disabled' : ''}>+</button>
      </div>
      ${done ? `<div class="counter-card-done-badge">✓ Objectif atteint !</div>` : ''}
    </div>`;
  }).join('');
  return `<div class="counters-view">
    <div class="counters-grid">${cards}</div>
  </div>`;
}
