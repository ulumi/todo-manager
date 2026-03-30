// ════════════════════════════════════════════════════════
//  CATEGORY VIEW PANEL
// ════════════════════════════════════════════════════════

import { DS, esc } from './utils.js';
import { getCategories, saveCategories, CATEGORY_ICONS, categoryIconSVG } from './admin.js';
import { isCompleted } from './calendar.js';
import * as state from './state.js';

const CATEGORY_COLORS = ['#f59e0b','#3b82f6','#10b981','#ef4444','#8b5cf6','#f97316','#06b6d4','#ec4899'];

let _currentCategoryId = null;

export function getCurrentCategoryId() { return _currentCategoryId; }

export function openCategoryView(categoryId) {
  _currentCategoryId = categoryId;
  const panel = document.getElementById('categoryPanel');
  const overlay = document.getElementById('categoryPanelOverlay');
  panel.classList.remove('hidden');
  overlay.classList.remove('hidden');
  renderCategoryPanel(categoryId);
  gsap.fromTo(panel,
    { x: 60, opacity: 0 },
    { x: 0, opacity: 1, duration: 0.28, ease: 'expo.out' }
  );
}

export function closeCategoryView({ immediate = false } = {}) {
  const panel = document.getElementById('categoryPanel');
  const overlay = document.getElementById('categoryPanelOverlay');
  if (immediate) {
    gsap.killTweensOf(panel);
    gsap.set(panel, { clearProps: 'all' });
    panel.classList.add('hidden');
    overlay.classList.add('hidden');
  } else {
    gsap.to(panel, {
      x: 40, opacity: 0, duration: 0.2, ease: 'power2.in',
      onComplete: () => {
        panel.classList.add('hidden');
        overlay.classList.add('hidden');
      }
    });
  }
  _currentCategoryId = null;
}

export function renderCategoryPanel(categoryId) {
  const panel = document.getElementById('categoryPanel');
  if (!panel || panel.classList.contains('hidden')) return;

  const cat = getCategories().find(p => p.id === categoryId);
  if (!cat) { closeCategoryView(); return; }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayDS = DS(today);
  const categoryTasks = state.todos.filter(t => (t.projectIds || (t.projectId ? [t.projectId] : [])).includes(categoryId));
  const punctual  = categoryTasks.filter(t => !t.recurrence || t.recurrence === 'none');
  const recurring = categoryTasks.filter(t => t.recurrence && t.recurrence !== 'none');

  // Stats
  const total        = categoryTasks.length;
  const donePunctual = punctual.filter(t => t.completed).length;
  const doneRec      = recurring.filter(t => isCompleted(t, today)).length;
  const done         = donePunctual + doneRec;
  const pct          = total > 0 ? Math.round(done / total * 100) : 0;

  // Ordered sort
  const order = getCategoryTaskOrder(categoryId);
  const sortTasks = arr => [...arr].sort((a, b) => {
    const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
    if (ia < 0 && ib < 0) return 0;
    if (ia < 0) return 1; if (ib < 0) return -1;
    return ia - ib;
  });
  const sortedPunctual  = sortTasks(punctual);
  const sortedRecurring = sortTasks(recurring);

  const colorSwatches = CATEGORY_COLORS.map(c =>
    `<div class="cv-color-swatch${c === cat.color ? ' active' : ''}" style="background:${c};"
      onclick="window.app.setCategoryColor('${categoryId}','${c}')"></div>`
  ).join('');

  const iconBtns = Object.keys(CATEGORY_ICONS).map(key => {
    const isActive = (cat.icon || '') === key;
    const svg = categoryIconSVG(key, 20, isActive ? cat.color : 'currentColor');
    return `<button class="cv-icon-btn${isActive ? ' active' : ''}" style="${isActive ? `border-color:${cat.color};color:${cat.color};` : ''}"
      onclick="window.app.setCategoryIcon('${categoryId}','${isActive ? '' : key}')" title="${key}">${svg}</button>`;
  }).join('');

  const punctualRows  = sortedPunctual.map((t, i) =>
    cvTaskRow(t, false, todayDS, i, sortedPunctual.length)).join('');
  const recurringRows = sortedRecurring.map((t, i) =>
    cvTaskRow(t, true,  todayDS, i, sortedRecurring.length)).join('');

  const iconDisplay = cat.icon ? categoryIconSVG(cat.icon, 14, cat.color) : `<div class="cv-color-dot" style="background:${cat.color};"></div>`;

  panel.innerHTML = `
    <div class="cv-header" style="border-top:3px solid ${cat.color};">
      <div class="cv-title-row">
        <div class="cv-title-icon">${iconDisplay}</div>
        <input class="cv-name-input" value="${esc(cat.name)}" placeholder="Nom de la catégorie"
          onblur="window.app.saveCategoryName('${categoryId}',this.value)"
          onkeydown="if(event.key==='Enter')this.blur();">
        <button class="cv-close-btn" onclick="window.app.closeCategoryView()">✕</button>
      </div>
      <div class="cv-color-picker">${colorSwatches}</div>
      <div class="cv-icon-picker">${iconBtns}</div>
      <textarea class="cv-description" placeholder="Description..." rows="2"
        onblur="window.app.saveCategoryDescription('${categoryId}',this.value)"
      >${esc(cat.description || '')}</textarea>
    </div>

    <div class="cv-stats">
      <span class="cv-stat-chip">${total} tâche${total !== 1 ? 's' : ''}</span>
      <span class="cv-stat-chip cv-stat-done">${done} faite${done !== 1 ? 's' : ''}</span>
      ${total > 0 ? `<span class="cv-stat-chip cv-stat-pct">${pct}%</span>` : ''}
    </div>
    ${total > 0 ? `<div class="cv-progress-bar"><div class="cv-progress-fill" style="width:${pct}%;background:${cat.color};"></div></div>` : ''}

    <div class="cv-body">
      ${sortedPunctual.length > 0 ? `
        <div class="cv-section-label">Ponctuelles</div>
        <div class="cv-task-list">${punctualRows}</div>` : ''}
      ${sortedRecurring.length > 0 ? `
        <div class="cv-section-label">Récurrentes</div>
        <div class="cv-task-list">${recurringRows}</div>` : ''}
      ${total === 0 ? `<div class="cv-empty">Aucune tâche dans cette catégorie.<br>Ajoutez-en une ci-dessous.</div>` : ''}
    </div>

    <div class="cv-footer">
      <button class="cv-add-btn" onclick="window.app.openModalForCategory('${categoryId}')">＋ Ajouter une tâche</button>
      <button class="cv-delete-btn" onclick="window.app.deleteCategory('${categoryId}')">🗑 Supprimer la catégorie</button>
    </div>`;
}

function cvTaskRow(t, isRec, todayDS, idx, total) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const done   = isRec ? isCompleted(t, today) : t.completed;
  const dateDS = isRec ? todayDS : (t.date || todayDS);

  const priorityDot = t.priority
    ? `<span class="cv-priority cv-priority--${t.priority}" title="${t.priority}"></span>`
    : '';

  const priorityCfg = {
    high:   '▲ Haute',
    medium: '▸ Moy.',
    low:    '▾ Basse',
  };
  const priorityLabel = t.priority ? `<span class="cv-task-priority cv-task-priority--${t.priority}">${priorityCfg[t.priority] || ''}</span>` : '';

  const sub = isRec
    ? `<span class="cv-rec-badge">↻ récurrent</span>${priorityLabel}`
    : `${t.date ? `<span class="cv-task-date">${t.date}</span>` : ''}${priorityLabel}`;

  return `<div class="cv-task-row${done ? ' done' : ''}" data-id="${t.id}">
    <div class="cv-task-reorder">
      <button class="cv-reorder-btn" onclick="window.app.reorderCategoryTask('${t.id}','${t.projectId}',-1)" ${idx === 0 ? 'disabled' : ''}>↑</button>
      <button class="cv-reorder-btn" onclick="window.app.reorderCategoryTask('${t.id}','${t.projectId}',1)" ${idx === total - 1 ? 'disabled' : ''}>↓</button>
    </div>
    ${priorityDot}
    <div class="cv-task-check${done ? ' checked' : ''}" onclick="window.app.toggleTodo('${t.id}',window.app.parseDS('${dateDS}'))"></div>
    <div class="cv-task-content">
      <span class="cv-task-title">${esc(t.title)}</span>
      <span class="cv-task-sub">${sub}</span>
    </div>
    <div class="cv-task-actions">
      <button class="cv-task-edit" onclick="window.app.openEditModal('${t.id}','${dateDS}')">✎</button>
      <button class="cv-task-unlink" onclick="window.app.unlinkFromCategory('${t.id}')" title="Retirer de la catégorie">⊘</button>
    </div>
  </div>`;
}

export function getCategoryTaskOrder(categoryId) {
  const stored = localStorage.getItem('projectTaskOrder');
  const all = stored ? JSON.parse(stored) : {};
  return all[categoryId] || [];
}

export function saveCategoryDescription(categoryId, description) {
  const categories = getCategories();
  const cat = categories.find(p => p.id === categoryId);
  if (cat) { cat.description = description; saveCategories(categories); }
}


export function setCategoryIcon(categoryId, icon) {
  const categories = getCategories();
  const cat = categories.find(p => p.id === categoryId);
  if (cat) { cat.icon = icon; saveCategories(categories); }
  renderCategoryPanel(categoryId);
}

export function saveCategoryTaskOrder(categoryId, order) {
  const stored = localStorage.getItem('projectTaskOrder');
  const all = stored ? JSON.parse(stored) : {};
  all[categoryId] = order;
  localStorage.setItem('projectTaskOrder', JSON.stringify(all));
}
