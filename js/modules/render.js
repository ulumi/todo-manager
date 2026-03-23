// ════════════════════════════════════════════════════════
//  RENDERING FUNCTIONS
// ════════════════════════════════════════════════════════

import { DS, addDays, startOfWeek, daysInMonth, firstDayOfMonth, esc } from './utils.js';
import { getTodosForDate, isCompleted, getSuggestions, getRecentTasks } from './calendar.js';
import * as state from './state.js';
import { getCategories, categoryIconSVG } from './admin.js';
import { getProjects, PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from './projectManager.js';

const _dragHandleSVG = `<svg width="12" height="10" viewBox="0 0 12 10" fill="currentColor"><rect y="0" width="12" height="2" rx="1"/><rect y="4" width="12" height="2" rx="1"/><rect y="8" width="12" height="2" rx="1"/></svg>`;

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

export function todoItemHTML(todo, date, group = null, dayView = false, hideCategoryBadge = false) {
  const done = isCompleted(todo, date);
  const rec = recLabel(todo, dayView);
  const isRec = todo.recurrence && todo.recurrence !== 'none';
  const ds = DS(date);
  const dragHandleHTML = group ? `<div class="todo-drag-handle" title="Déplacer">${_dragHandleSVG}</div>` : '';
  const categoryBadge = (() => {
    if (hideCategoryBadge || !todo.projectId) return '';
    const cat = getCategories().find(p => p.id === todo.projectId);
    if (!cat) return '';
    return `<span class="todo-category-badge" style="background:${cat.color}20;color:${cat.color};border-color:${cat.color}40;cursor:pointer;" onclick="event.stopPropagation();window.app.openCategoryView('${cat.id}')">${esc(cat.name.toUpperCase())}</span>`;
  })();
  const prioCls = todo.priority ? ` prio-${todo.priority}` : '';
  const hasMeta = categoryBadge || rec;
  const draggableAttr = group ? ` draggable="true" data-group="${group}"` : '';
  return `
    <div class="todo-item${done?' done':''}${prioCls}" data-id="${todo.id}" data-date="${ds}"${draggableAttr} onclick="window.app.clickTodo(event,'${todo.id}','${ds}')">
      <div class="todo-check${done?' checked':''}" onclick="event.stopPropagation();window.app.toggleTodo('${todo.id}',window.app.parseDS('${ds}'))"></div>
      <div class="todo-content">
        <span class="todo-text editable" ondblclick="event.stopPropagation();window.app.quickEditTitle(this,'${todo.id}','${ds}')">${esc(todo.title)}</span>
        ${hasMeta ? `<div class="todo-meta">${categoryBadge}${rec ? `<span class="todo-badge${isRec?' recurring':''}">${rec}</span>` : ''}</div>` : ''}
      </div>
      <div class="todo-actions">
        <button class="todo-add-after" onclick="window.app.addTaskAfter('${todo.id}','${ds}')" title="Ajouter après">＋</button>
        <button class="todo-edit" onclick="window.app.openEditModal('${todo.id}','${ds}')">✎</button>
        <button class="todo-duplicate" onclick="window.app.duplicateTodo('${todo.id}','${ds}')" title="Dupliquer">⧉</button>
        <button class="todo-delete" onclick="window.app.deleteTodo('${todo.id}','${ds}')">×</button>
      </div>
      ${dragHandleHTML}
    </div>`;
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
  const sortedDaily   = sortByOrder(dailyItems,   recOrd.daily   || []);
  const sortedWeekly  = sortByOrder(weeklyItems,  recOrd.weekly  || []);
  const sortedMonthly = sortByOrder(monthlyItems, recOrd.monthly || []);
  const sortedYearly  = sortByOrder(yearlyItems,  recOrd.yearly  || []);
  const sortedPunctual = sortByOrder(punctualItems, dayOrd);

  const recAllItems = [...dailyItems, ...weeklyItems, ...monthlyItems, ...yearlyItems];
  const recDone = recAllItems.filter(t => isCompleted(t, navDate)).length;
  const punctDone = punctualItems.filter(t => isCompleted(t, navDate)).length;

  // Combined stats bar (single, in left column only)
  const totalAll = punctualItems.length + recAllItems.length;
  const doneAll = punctDone + recDone;
  const statsPct = totalAll > 0 ? Math.round((doneAll / totalAll) * 100) : 0;
  const combinedStats = totalAll > 0 ? `<div class="day-stats-summary">
    <div class="day-stats-bar"><div class="day-stats-fill" style="width:${statsPct}%"></div></div>
    <span class="day-stats-label">${doneAll}/${totalAll}</span>
    <span class="day-stats-pct">${statsPct}%</span>
  </div>` : '';

  // Always render ALL items (CSS hides .done items in stats-mode)
  let leftCol = '';
  if (sortedDaily.length > 0)   leftCol += `<div class="day-group-label">${state.T.recDaily}</div><div class="todo-list" data-group="daily">${sortedDaily.map(t => todoItemHTML(t, navDate, 'daily', true)).join('')}</div>`;
  if (sortedWeekly.length > 0)  leftCol += `<div class="day-group-label">${state.T.recWeekly}</div><div class="todo-list" data-group="weekly">${sortedWeekly.map(t => todoItemHTML(t, navDate, 'weekly', true)).join('')}</div>`;
  if (sortedMonthly.length > 0) leftCol += `<div class="day-group-label">${state.T.recMonthly}</div><div class="todo-list" data-group="monthly">${sortedMonthly.map(t => todoItemHTML(t, navDate, 'monthly', true)).join('')}</div>`;
  if (sortedYearly.length > 0)  leftCol += `<div class="day-group-label">${state.T.recYearly}</div><div class="todo-list" data-group="yearly">${sortedYearly.map(t => todoItemHTML(t, navDate, 'yearly', true)).join('')}</div>`;
  if (!leftCol) leftCol = `<div class="day-col-empty">${state.T.emptyRecurring || state.T.emptyDay}</div>`;

  // Column count — icon buttons
  const colCount = parseInt(localStorage.getItem('dayColCount') || '2');
  const colIcon = n => {
    const bars = Array.from({length: n}, () => `<rect/>`).map((_, i) => {
      const w = Math.floor(12 / n);
      const g = n > 1 ? Math.floor((12 - w * n) / (n - 1)) : 0;
      const x = i * (w + g);
      return `<rect x="${x}" y="0" width="${w}" height="16" rx="2" fill="currentColor"/>`;
    }).join('');
    return `<svg viewBox="0 0 14 16" width="13" height="15">${bars}</svg>`;
  };
  const colBtns = [1,2,3,4].map(n =>
    `<button class="day-ctrl-btn${n===colCount?' active':''}" onclick="window.app.setDayColCount(${n})" title="${n} colonne${n>1?'s':''}">${colIcon(n)}</button>`
  ).join('');
  const spacerBtn = `<button class="day-ctrl-btn day-spacer-btn" onclick="window.app.addDaySpacer()" title="Ajouter un séparateur"><svg viewBox="0 0 12 12" width="12" height="12"><line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" stroke-width="2" stroke-dasharray="2 2"/></svg> Spacer</button>`;

  // Sort / group mode
  const daySort = localStorage.getItem('daySort') || 'manual';
  const sortOpts = [
    { id: 'manual',   label: 'Manuel' },
    { id: 'priority', label: 'Priorité' },
    { id: 'tag',      label: 'Tag' },
  ];
  const sortBtns = sortOpts.map(o =>
    `<button class="day-ctrl-btn day-sort-btn${daySort===o.id?' active':''}" onclick="window.app.setDaySort('${o.id}')">${o.label}</button>`
  ).join('');

  // Auto-prioritize checkbox
  const autoPrio = localStorage.getItem('dayAutoPrio') === 'true';
  const autoPrioCheck = `<label class="day-ctrl-check" title="Remonter automatiquement les tâches prioritaires"><input type="checkbox" ${autoPrio?'checked':''} onchange="window.app.toggleDayAutoPrio()"><span>Auto-prio</span></label>`;

  // Apply auto-prioritize: sort by priority weight before manual order
  let itemsForRender = [...sortedPunctual];
  if (autoPrio) {
    const prioW = { high: 0, medium: 1, low: 2 };
    itemsForRender.sort((a, b) => (prioW[a.priority] ?? 3) - (prioW[b.priority] ?? 3));
  }

  const colStyle = `grid-template-columns:repeat(${colCount},1fr)`;
  let rightColItems = '';

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
      const listHtml = `<div class="todo-list" data-group="punctual" data-priority="${g.key}" style="${colStyle}">${items.map(t => todoItemHTML(t, navDate, 'punctual')).join('')}</div>`;
      return `<div class="day-spacer-group"><div class="day-auto-group-label">${g.label}</div>${listHtml}</div>`;
    }).join('');
    rightColItems = grouped || `<div class="day-col-empty">${state.T.emptyPunctual || state.T.emptyDay}</div>`;

  } else if (daySort === 'tag') {
    // Group by category/tag — sections draggable to reorder
    const categories = getCategories();
    const tagOrder = JSON.parse(localStorage.getItem('dayTagOrder') || '[]');
    const catGroups = categories.filter(c => itemsForRender.some(t => t.projectId === c.id));
    const untagged = itemsForRender.filter(t => !t.projectId);
    // Sort catGroups by stored order
    catGroups.sort((a, b) => {
      const ia = tagOrder.indexOf(a.id), ib = tagOrder.indexOf(b.id);
      if (ia < 0 && ib < 0) return 0;
      if (ia < 0) return 1; if (ib < 0) return -1;
      return ia - ib;
    });
    let grouped = catGroups.map(c => {
      const items = itemsForRender.filter(t => t.projectId === c.id);
      const listHtml = `<div class="todo-list" data-group="punctual" data-tag="${c.id}" style="${colStyle}">${items.map(t => todoItemHTML(t, navDate, 'punctual')).join('')}</div>`;
      return `<div class="day-tag-section" draggable="true" data-tag-id="${c.id}"><div class="day-auto-group-label" style="color:#fff">${esc(c.name)}</div>${listHtml}</div>`;
    }).join('');
    if (untagged.length) {
      const listHtml = `<div class="todo-list" data-group="punctual" data-tag="none" style="${colStyle}">${untagged.map(t => todoItemHTML(t, navDate, 'punctual')).join('')}</div>`;
      grouped += `<div class="day-tag-section" data-tag-id="none"><div class="day-auto-group-label">Sans tag</div>${listHtml}</div>`;
    }
    rightColItems = `<div class="day-tag-sections">${grouped}</div>` || `<div class="day-col-empty">${state.T.emptyPunctual || state.T.emptyDay}</div>`;

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
          if (t) cur.items.push(todoItemHTML(t, navDate, 'punctual'));
        }
      }
      rightColItems = groups.map(g => {
        const itemsHtml = g.items.length ? `<div class="todo-list" data-group="punctual" style="${colStyle}">${g.items.join('')}</div>` : '';
        if (!g.spacer) return itemsHtml;
        return `<div class="day-spacer-group">${g.spacer}${itemsHtml}</div>`;
      }).join('');
    } else {
      rightColItems = `<div class="day-col-empty">${state.T.emptyPunctual || state.T.emptyDay}</div>`;
    }
  }

  const sortCollapsed = localStorage.getItem('daySortCollapsed') !== 'false';
  const colCollapsed = localStorage.getItem('dayColCollapsed') !== 'false';
  const ctrlsCollapsed = localStorage.getItem('dayCtrlsCollapsed') !== 'false';

  const punctualHeader = `<div class="day-col-title-row">
    <div class="day-col-title">${state.T.groupOnce}</div>
    <div class="day-col-controls${ctrlsCollapsed ? ' collapsed' : ''}">
      <button class="day-ctrl-toggle" onclick="window.app.toggleDaySort()" title="Tri">
        <span class="day-ctrl-label">Tri</span>
        <svg class="day-ctrl-chevron" viewBox="0 0 12 12" width="10" height="10"><polyline points="3 5 6 8 9 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="day-ctrl-group day-sort-group${sortCollapsed ? ' hidden' : ''}">${sortBtns}</div>

      <button class="day-ctrl-toggle" onclick="window.app.toggleDayCol()" title="Colonnes">
        <span class="day-ctrl-label">Colonnes</span>
        <svg class="day-ctrl-chevron" viewBox="0 0 12 12" width="10" height="10"><polyline points="3 5 6 8 9 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="day-ctrl-group day-col-group${colCollapsed ? ' hidden' : ''}">${colBtns}</div>

      <div class="day-ctrl-other${ctrlsCollapsed ? ' hidden' : ''}">
        ${spacerBtn}
        <div class="day-ctrl-sep"></div>
        ${autoPrioCheck}
      </div>

      <button class="day-ctrl-gear" onclick="window.app.toggleDayControls()" title="Options">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/></svg>
      </button>
    </div>
  </div>`;

  const hasPunctual = sortedPunctual.length > 0;
  const actionBar = `
    <div class="day-action-bar">
      <button class="day-action-btn day-action-btn--add" onclick="window.app.openModal()">＋ Ajouter</button>
      <button class="day-action-btn" onclick="window.app.openTemplateModal()">☰ Insérer</button>
      ${hasPunctual ? `<button class="day-action-btn day-action-btn--danger" onclick="window.app.clearDay()">⊘ Vider</button>` : ''}
    </div>`;

  return `<div class="day-view${isStatsMode ? ' stats-mode' : ''}"><div class="day-top-sticky">${_renderDayMiniWeek()}${header}</div><div class="day-columns"><div class="day-col day-col--punctual">${punctualHeader}${rightColItems}</div><div class="day-col day-col--recurring">${leftCol}</div></div>${combinedStats}${actionBar}</div>`;
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

// Returns [fillDiv, statsDiv] — fillDiv is absolute in .week-day-col, same pattern as month
function _weekCellStats(doneCount, totalCount) {
  const pct = Math.round(totalCount > 0 ? doneCount / totalCount * 100 : 0);
  const viz = state.statsViz;

  if (viz === 'rings') {
    const R = 26, CX = 32, CY = 32, SZ = 64;
    const circ = (2 * Math.PI * R).toFixed(1);
    const offset = (2 * Math.PI * R * (1 - pct / 100)).toFixed(1);
    const color = _pctHsl(pct, 0.92);
    const check = pct >= 85;
    return `<div class="week-cell-stats wc-rings">
      <svg width="${SZ}" height="${SZ}" viewBox="0 0 ${SZ} ${SZ}">
        <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="hsla(220,12%,22%,1)" stroke-width="2.5"/>
        <circle cx="${CX}" cy="${CY}" r="${R}" fill="none"
          stroke="${color}" stroke-width="2.5"
          stroke-dasharray="${circ}" stroke-dashoffset="${offset}"
          stroke-linecap="round" transform="rotate(-90 ${CX} ${CY})"/>
        ${check
          ? `<text x="${CX}" y="${CY+4}" text-anchor="middle" font-size="17" fill="${color}" font-weight="800">✓</text>`
          : `<text x="${CX}" y="${CY+4}" text-anchor="middle" font-size="13" fill="${_pctHsl(pct,.72)}" font-weight="700">${pct}%</text>`}
      </svg>
    </div>`;
  }

  if (viz === 'stamp') {
    // tint applied on .week-day-col externally; just show score
    return `<div class="week-cell-stats wc-stamp">
      <div class="mc-stamp-score" style="color:${_pctHsl(pct,.95)}">${doneCount}/${totalCount}</div>
    </div>`;
  }

  // bars — same pattern as month: fill positioned absolute in .week-day-col
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
    const totalCount = allItems.length;
    const doneCount = allItems.filter(t => isCompleted(t, d)).length;
    const ratio = totalCount > 0 ? doneCount / totalCount : 0;
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
    // Stamp mode: tinted background on the cell itself
    let cellStyle = '';
    if (showStats && state.statsViz === 'stamp' && totalCount > 0) {
      const pct = Math.round(ratio * 100);
      cellStyle = ` style="background:${_pctHsl(pct,.16)};border-color:${_pctHsl(pct,.45)};"`;
    }
    html += `<div class="week-day-col${isT?' is-today':isPast?' past':''}${noExpand?' empty':''}"${cellStyle} onclick="window.app.setNavDateAndView('${ds}', 'day')">
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
            <div class="week-todo-check${done?' checked':''}" onclick="event.stopPropagation();window.app.toggleTodo('${t.id}',window.app.parseDS('${ds}'))"></div>
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

  let grid = `<div class="month-grid-header">${state.DAYS.map(d=>`<div class="month-dow">${d}</div>`).join('')}</div>
    <div class="month-grid">`;

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

function monthCellStats(date, ds, total, done) {
  const pct = Math.round(total > 0 ? done / total * 100 : 0);
  const viz = state.statsViz;

  if (viz === 'rings') {
    const R = 26, CX = 32, CY = 32, SZ = 64;
    const circ = (2 * Math.PI * R).toFixed(1);
    const offset = (2 * Math.PI * R * (1 - pct / 100)).toFixed(1);
    const color = _pctHsl(pct, 0.92);
    const check = pct >= 85;
    return `<div class="month-cell-stats mc-rings">
      <svg width="${SZ}" height="${SZ}" viewBox="0 0 ${SZ} ${SZ}">
        <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="hsla(220,12%,22%,1)" stroke-width="2.5"/>
        <circle cx="${CX}" cy="${CY}" r="${R}" fill="none"
          stroke="${color}" stroke-width="2.5"
          stroke-dasharray="${circ}" stroke-dashoffset="${offset}"
          stroke-linecap="round" transform="rotate(-90 ${CX} ${CY})"/>
        ${check
          ? `<text x="${CX}" y="${CY+4}" text-anchor="middle" font-size="17" fill="${color}" font-weight="800">✓</text>`
          : `<text x="${CX}" y="${CY+4}" text-anchor="middle" font-size="13" fill="${_pctHsl(pct,.72)}" font-weight="700">${pct}%</text>`}
      </svg>
    </div>`;
  }

  if (viz === 'stamp') {
    return `<div class="month-cell-stats mc-stamp">
      <div class="mc-stamp-score" style="color:${_pctHsl(pct,.95)}">${done}/${total}</div>
    </div>`;
  }

  // bars — fill positioned relative to the full .month-cell (covers entire cell height)
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
  const visible = items.slice(0,3);
  const more = items.length - visible.length;
  let todayScoreHTML = '';
  if (todayStats && doneCount > 0) {
    todayScoreHTML = `<div class="month-today-score">${doneCount}/${allItems.length} ✓</div>`;
  }
  let cellStyle = '';
  if (showStats && state.statsViz === 'stamp' && allItems.length > 0) {
    const pct = Math.round(doneCount / allItems.length * 100);
    cellStyle = ` style="background:${_pctHsl(pct,.16)};border-color:${_pctHsl(pct,.45)};"`;
  }
  return `<div class="month-cell${otherMonth?' other-month':''}${isT?' is-today':isPast?' past':''}" data-date="${ds}"${cellStyle}
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
        <div class="month-dot-check" onclick="event.stopPropagation();window.app.toggleTodo('${t.id}',window.app.parseDS('${ds}'))"></div>
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

function renderSidebarOptions() {
  const isStats = state.pastDisplayMode === 'stats';
  const viz = state.statsViz;
  const title = state.lang === 'fr' ? 'Options d\'affichage' : 'Display options';
  const label = state.lang === 'fr' ? 'Complétés' : 'Completed';
  const stateLabel = isStats ? 'stats' : 'visible';
  const vizOpts = [
    { id: 'bars',  fr: 'Barres',  en: 'Bars'  },
    { id: 'rings', fr: 'Anneaux', en: 'Rings'  },
    { id: 'stamp', fr: 'Sceau',   en: 'Stamp'  },
  ];
  const vizPicker = isStats ? `
    <div class="cal-sid-viz-row">
      <div class="cal-sid-viz-pick">
        ${vizOpts.map(o => `<button class="cal-sid-viz-btn${viz===o.id?' active':''}" onclick="window.app.setStatsViz('${o.id}')">${state.lang==='fr'?o.fr:o.en}</button>`).join('')}
      </div>
    </div>` : '';
  return `<div class="cal-sid-options">
    <div class="cal-sid-options-title">${title}</div>
    <div class="cal-sid-toggle-row">
      <span class="cal-sid-toggle-label">${label}</span>
      <div class="cal-sid-toggle-right">
        <span class="cal-sid-toggle-state" data-on="stats" data-off="visible">${stateLabel}</span>
        <label class="cal-sid-toggle">
          <input type="checkbox" ${isStats ? 'checked' : ''} onchange="window.app.togglePastDisplay()">
          <span class="cal-sid-toggle-track"></span>
        </label>
      </div>
    </div>
    ${vizPicker}
  </div>`;
}

export function renderSidebar(todos) {
  const MONTH_H = 185;
  const headerH = document.querySelector('header')?.offsetHeight ?? 65;
  const availH = window.innerHeight - headerH - 48;
  const maxMonths = Math.max(1, Math.floor(availH / MONTH_H));

  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
  const navDate = state.navDate;

  let html = renderSidebarOptions();
  for (let i = 0; i < maxMonths; i++) {
    const monthDate = new Date(navDate.getFullYear(), navDate.getMonth() + i, 1);
    html += renderSideMonth(monthDate, todayDate, navDate, todos);
  }
  return html;
}

export function renderWeekSidebar(todos) {
  const MONTH_H = 185;
  const headerH = document.querySelector('header')?.offsetHeight ?? 65;
  const availH = window.innerHeight - headerH - 36;
  const maxMonths = Math.max(1, Math.floor(availH / MONTH_H));

  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
  const y = todayDate.getFullYear();
  const m = todayDate.getMonth();

  let html = renderSidebarOptions();
  for (let i = 0; i < maxMonths; i++) {
    const monthDate = new Date(y, m + i, 1);
    html += renderSideMonth(monthDate, todayDate, state.navDate, todos);
  }
  return html;
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
  return html;
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

export function renderQACloud(todos) {
  const el = document.getElementById('qaCloud');
  if (!el) return; // Quick add panel doesn't exist
  const d = state.quickAddTarget==='today' ? new Date() : state.navDate;
  const html = getCloudsHTML(d, todos);
  if (html) {
    el.innerHTML = `<div class="qa-cloud-title">${state.T.qaTitle}</div>${html}`;
    el.classList.add('visible');
  } else {
    el.classList.remove('visible');
  }
}

export function renderCategoriesView(todos) {
  const categories = getCategories();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // Prefs
  const cols = parseInt(localStorage.getItem('categoriesCols') || '0');
  const sort = localStorage.getItem('categoriesSort') || 'name';

  // Compute stats for all categories
  const data = categories.map(p => {
    const tasks = todos.filter(t => t.projectId === p.id);
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
  return todos.filter(t => (!t.recurrence || t.recurrence === 'none') && !t.date && !t.backlog).length;
}

export function getBacklogCount(todos) {
  return todos.filter(t => (!t.recurrence || t.recurrence === 'none') && !t.date && t.backlog).length;
}

export function renderInboxView(todos) {
  const inboxItems = todos.filter(t => (!t.recurrence || t.recurrence === 'none') && !t.date);

  const sort = localStorage.getItem('inboxSort') || 'date';
  const priorityOrder = { high: 0, medium: 1, low: 2, '': 3 };
  const sorted = [...inboxItems].sort((a, b) => {
    if (sort === 'priority') return (priorityOrder[a.priority || ''] ?? 3) - (priorityOrder[b.priority || ''] ?? 3);
    if (sort === 'title')    return a.title.localeCompare(b.title);
    if (sort === 'category') return (a.projectId || '').localeCompare(b.projectId || '');
    return b.id.localeCompare(a.id); // newest first (default)
  });

  const categories = getCategories();
  const items = sorted.map(t => {
    const cat = t.projectId ? categories.find(c => c.id === t.projectId) : null;
    const catBadge = cat
      ? `<span class="todo-category-badge" style="background:${cat.color}20;color:${cat.color};border-color:${cat.color}40;cursor:pointer;" onclick="event.stopPropagation();window.app.openCategoryView('${cat.id}')">${esc(cat.name.toUpperCase())}</span>`
      : '';
    const prioCls = t.priority ? ` prio-${t.priority}` : '';
    const hasMeta = !!catBadge;
    return `
      <div class="inbox-item${prioCls}" data-id="${t.id}" draggable="true"
        ondragstart="window.app.planDragStart(event,'${t.id}')"
        ondragend="this.classList.remove('dragging')"
        onclick="window.app.openEditModal('${t.id}', null)">
        <div class="todo-check" onclick="event.stopPropagation();window.app.toggleInboxDone('${t.id}')"></div>
        <div class="inbox-item-body">
          <span class="todo-text editable" ondblclick="event.stopPropagation();window.app.quickEditInboxTitle(this,'${t.id}')">${esc(t.title)}</span>
          ${hasMeta ? `<div class="todo-meta">${catBadge}</div>` : ''}
        </div>
        <div class="inbox-item-actions">
          <button class="inbox-assign-today" onclick="event.stopPropagation();window.app.assignInboxToday('${t.id}')" title="Assigner à aujourd'hui">
            ${state.T.assignToday || "Auj."}
          </button>
          <button class="inbox-assign-date" onclick="event.stopPropagation();window.app.openEditModal('${t.id}', null)" title="Choisir une date">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </button>
          <button class="todo-edit" onclick="event.stopPropagation();window.app.openEditModal('${t.id}', null)">✎</button>
          <button class="todo-delete" onclick="event.stopPropagation();window.app.deleteTodo('${t.id}', null)">×</button>
        </div>
      </div>`;
  }).join('');

  const empty = sorted.length === 0 ? `
    <div class="inbox-empty">
      <div class="inbox-empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="opacity:.3"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>
      </div>
      <p>Inbox vide — tout est planifié !</p>
      <button class="btn btn-primary" onclick="window.app.openModalForInbox()">＋ Capturer une tâche</button>
    </div>` : '';

  const sortLabels = [['date', 'Récentes'], ['priority', 'Priorité'], ['title', 'A–Z'], ['category', 'Catégorie']];
  const sortBtns = sortLabels.map(([v, l]) =>
    `<button class="inbox-sort-btn${sort === v ? ' active' : ''}" onclick="window.app.setInboxSort('${v}')">${l}</button>`
  ).join('');

  return `
    <div class="inbox-view">
      <div class="inbox-view-header">
        <h1 class="inbox-view-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>
          Inbox
        </h1>
        <span class="inbox-count-label">${sorted.length} tâche${sorted.length !== 1 ? 's' : ''}</span>
        <div class="inbox-sort-group">${sortBtns}</div>
        <button class="btn btn-primary inbox-add-btn" onclick="window.app.openModalForInbox()">＋ Capturer</button>
      </div>
      ${empty}
      ${sorted.length > 0 ? `<div class="inbox-list">${items}</div>` : ''}
    </div>`;
}

export function renderBacklogView(todos) {
  const backlogItems = todos.filter(t => (!t.recurrence || t.recurrence === 'none') && t.backlog && !t.date);

  const sort = localStorage.getItem('backlogSort') || 'date';
  const priorityOrder = { high: 0, medium: 1, low: 2, '': 3 };
  const sorted = [...backlogItems].sort((a, b) => {
    if (sort === 'priority') return (priorityOrder[a.priority || ''] ?? 3) - (priorityOrder[b.priority || ''] ?? 3);
    if (sort === 'title')    return a.title.localeCompare(b.title);
    if (sort === 'category') return (a.projectId || '').localeCompare(b.projectId || '');
    return b.id.localeCompare(a.id);
  });

  const categories = getCategories();
  const items = sorted.map(t => {
    const cat = t.projectId ? categories.find(c => c.id === t.projectId) : null;
    const catBadge = cat
      ? `<span class="todo-category-badge" style="background:${cat.color}20;color:${cat.color};border-color:${cat.color}40;cursor:pointer;" onclick="event.stopPropagation();window.app.openCategoryView('${cat.id}')">${esc(cat.name.toUpperCase())}</span>`
      : '';
    const prioCls = t.priority ? ` prio-${t.priority}` : '';
    const hasMeta = !!catBadge;
    return `
      <div class="inbox-item${prioCls}" data-id="${t.id}" draggable="true"
        ondragstart="window.app.planDragStart(event,'${t.id}')"
        ondragend="this.classList.remove('dragging')"
        onclick="window.app.openEditModal('${t.id}', null)">
        <div class="todo-check" onclick="event.stopPropagation();window.app.toggleInboxDone('${t.id}')"></div>
        <div class="inbox-item-body">
          <span class="todo-text editable" ondblclick="event.stopPropagation();window.app.quickEditInboxTitle(this,'${t.id}')">${esc(t.title)}</span>
          ${hasMeta ? `<div class="todo-meta">${catBadge}</div>` : ''}
        </div>
        <div class="inbox-item-actions">
          <button class="inbox-assign-today" onclick="event.stopPropagation();window.app.assignInboxToday('${t.id}')" title="Planifier aujourd'hui">
            ${state.T.assignToday || "Auj."}
          </button>
          <button class="inbox-assign-date" onclick="event.stopPropagation();window.app.openEditModal('${t.id}', null)" title="Choisir une date">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </button>
          <button class="todo-edit" onclick="event.stopPropagation();window.app.openEditModal('${t.id}', null)">✎</button>
          <button class="todo-delete" onclick="event.stopPropagation();window.app.deleteTodo('${t.id}', null)">×</button>
        </div>
      </div>`;
  }).join('');

  const empty = sorted.length === 0 ? `
    <div class="inbox-empty">
      <div class="inbox-empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="opacity:.3"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>
      </div>
      <p>Backlog vide — rien en attente !</p>
      <button class="btn btn-primary" onclick="window.app.openModalForBacklog()">＋ Ajouter au backlog</button>
    </div>` : '';

  const sortLabels = [['date', 'Récentes'], ['priority', 'Priorité'], ['title', 'A–Z'], ['category', 'Catégorie']];
  const sortBtns = sortLabels.map(([v, l]) =>
    `<button class="inbox-sort-btn${sort === v ? ' active' : ''}" onclick="window.app.setBacklogSort('${v}')">${l}</button>`
  ).join('');

  return `
    <div class="inbox-view">
      <div class="inbox-view-header">
        <h1 class="inbox-view-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>
          Backlog
        </h1>
        <span class="inbox-count-label">${sorted.length} tâche${sorted.length !== 1 ? 's' : ''}</span>
        <div class="inbox-sort-group">${sortBtns}</div>
        <button class="btn btn-primary inbox-add-btn" onclick="window.app.openModalForBacklog()">＋ Ajouter</button>
      </div>
      ${empty}
      ${sorted.length > 0 ? `<div class="inbox-list">${items}</div>` : ''}
    </div>`;
}

export function setupTodoItemHoverAnimations() {
  document.querySelectorAll('.todo-item').forEach(item => {
    item.addEventListener('mouseenter', () =>
      gsap.to(item, { y: -3, duration: 0.12, ease: 'power2.out' })
    );
    item.addEventListener('mouseleave', () =>
      gsap.to(item, { y: 0, duration: 0.18, ease: 'power2.inOut' })
    );
  });
}

// ─── Plan Inbox List (stripped, for plan split-pane) ─────────────────────────

export function renderPlanInboxList(todos) {
  const noDateItems = todos.filter(t => (!t.recurrence || t.recurrence === 'none') && !t.date);
  const sort = localStorage.getItem('planSort') || 'date';
  const priorityOrder = { high: 0, medium: 1, low: 2, '': 3 };
  const sortFn = (a, b) => {
    if (sort === 'priority') return (priorityOrder[a.priority||'']??3) - (priorityOrder[b.priority||'']??3);
    if (sort === 'title')    return a.title.localeCompare(b.title);
    return b.id.localeCompare(a.id);
  };
  const sortLabels = [['date','Récentes'],['priority','Priorité'],['title','A–Z']];
  const sortBtns = sortLabels.map(([v,l]) =>
    `<button class="plan-sort-btn${sort===v?' active':''}" onclick="window.app.setPlanSort('${v}')">${l}</button>`
  ).join('');

  const inboxItems   = [...noDateItems.filter(t => !t.backlog)].sort(sortFn);
  const backlogItems = [...noDateItems.filter(t =>  t.backlog)].sort(sortFn);

  const cats = getCategories();
  const itemRow = (t) => {
    const cat = t.projectId ? cats.find(c => c.id === t.projectId) : null;
    const catDot = cat ? `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${cat.color};flex-shrink:0;"></span>` : '';
    const prioCfg = {
      high:   { label:'▲', color:'var(--danger)' },
      medium: { label:'▸', color:'var(--primary)' },
      low:    { label:'▾', color:'#3b82f6' },
    };
    const pc = t.priority ? prioCfg[t.priority] : null;
    const prio = pc ? `<span style="font-size:10px;color:${pc.color};flex-shrink:0;">${pc.label}</span>` : '';
    return `
      <div class="plan-inbox-item" data-id="${t.id}" draggable="true"
        ondragstart="window.app.planDragStart(event,'${t.id}')"
        onclick="window.app.openEditModal('${t.id}',null)">
        <div class="plan-inbox-drag">⠿</div>
        ${prio}${catDot}
        <span class="plan-inbox-title">${esc(t.title)}</span>
        <button class="plan-inbox-today" onclick="event.stopPropagation();window.app.assignInboxToday('${t.id}')" title="Aujourd'hui">→</button>
      </div>`;
  };

  const inboxRows   = inboxItems.map(itemRow).join('');
  const backlogRows = backlogItems.map(itemRow).join('');

  const inboxEmpty = inboxItems.length === 0
    ? `<div class="plan-inbox-empty">Vide !<br><button class="btn btn-primary" style="margin-top:6px;font-size:11px;" onclick="window.app.openModalForInbox()">＋ Capturer</button></div>`
    : '';

  const backlogEmpty = backlogItems.length === 0
    ? `<div class="plan-backlog-empty">Backlog vide</div>`
    : '';

  return `
    <div class="plan-sort-bar">${sortBtns}</div>
    <div class="plan-inbox-section"
      ondragover="event.preventDefault();this.classList.add('drag-over')"
      ondragleave="if(!this.contains(event.relatedTarget))this.classList.remove('drag-over')"
      ondrop="window.app.planDropToInbox(event)">
      <div class="plan-inbox-header">
        <span class="plan-inbox-header-title">Inbox</span>
        <span class="plan-inbox-count">${inboxItems.length}</span>
        <button class="plan-inbox-add" onclick="window.app.openModalForInbox()" title="Capturer">＋</button>
      </div>
      ${inboxEmpty}
      ${inboxItems.length > 0 ? `<div class="plan-inbox-list">${inboxRows}</div>` : ''}
    </div>
    <div class="plan-backlog-section"
      ondragover="event.preventDefault();this.classList.add('drag-over')"
      ondragleave="if(!this.contains(event.relatedTarget))this.classList.remove('drag-over')"
      ondrop="window.app.planDropToBacklog(event)">
      <div class="plan-backlog-header">
        <span class="plan-backlog-title">Backlog</span>
        <span class="plan-backlog-count">${backlogItems.length}</span>
        <button class="plan-backlog-add" onclick="window.app.openModalForBacklog()" title="Ajouter au backlog">＋</button>
      </div>
      ${backlogEmpty}
      ${backlogItems.length > 0 ? `<div class="plan-backlog-list">${backlogRows}</div>` : ''}
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
        <h1 class="categories-view-title">Projets</h1>
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
