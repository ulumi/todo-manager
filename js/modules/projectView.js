// ════════════════════════════════════════════════════════
//  PROJECT VIEW PANEL
// ════════════════════════════════════════════════════════

import { DS, esc } from './utils.js';
import { getProjects } from './admin.js';
import { isCompleted } from './calendar.js';
import * as state from './state.js';

const PROJECT_COLORS = ['#f59e0b','#3b82f6','#10b981','#ef4444','#8b5cf6','#f97316','#06b6d4','#ec4899'];

let _currentProjectId = null;

export function getCurrentProjectId() { return _currentProjectId; }

export function openProjectView(projectId) {
  _currentProjectId = projectId;
  const panel = document.getElementById('projectPanel');
  const overlay = document.getElementById('projectPanelOverlay');
  panel.classList.remove('hidden');
  overlay.classList.remove('hidden');
  renderProjectPanel(projectId);
  gsap.fromTo(panel,
    { x: 60, opacity: 0 },
    { x: 0, opacity: 1, duration: 0.28, ease: 'expo.out' }
  );
}

export function closeProjectView() {
  const panel = document.getElementById('projectPanel');
  const overlay = document.getElementById('projectPanelOverlay');
  gsap.to(panel, {
    x: 40, opacity: 0, duration: 0.2, ease: 'power2.in',
    onComplete: () => {
      panel.classList.add('hidden');
      overlay.classList.add('hidden');
    }
  });
  _currentProjectId = null;
}

export function renderProjectPanel(projectId) {
  const panel = document.getElementById('projectPanel');
  if (!panel || panel.classList.contains('hidden')) return;

  const proj = getProjects().find(p => p.id === projectId);
  if (!proj) { closeProjectView(); return; }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayDS = DS(today);
  const projectTasks = state.todos.filter(t => t.projectId === projectId);
  const punctual  = projectTasks.filter(t => !t.recurrence || t.recurrence === 'none');
  const recurring = projectTasks.filter(t => t.recurrence && t.recurrence !== 'none');

  // Stats
  const total        = projectTasks.length;
  const donePunctual = punctual.filter(t => t.completed).length;
  const doneRec      = recurring.filter(t => isCompleted(t, today)).length;
  const done         = donePunctual + doneRec;
  const pct          = total > 0 ? Math.round(done / total * 100) : 0;

  // Ordered sort
  const order = getProjectTaskOrder(projectId);
  const sortTasks = arr => [...arr].sort((a, b) => {
    const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
    if (ia < 0 && ib < 0) return 0;
    if (ia < 0) return 1; if (ib < 0) return -1;
    return ia - ib;
  });
  const sortedPunctual  = sortTasks(punctual);
  const sortedRecurring = sortTasks(recurring);

  const colorSwatches = PROJECT_COLORS.map(c =>
    `<div class="pv-color-swatch${c === proj.color ? ' active' : ''}" style="background:${c};"
      onclick="window.app.setProjectColor('${projectId}','${c}')"></div>`
  ).join('');

  const punctualRows  = sortedPunctual.map((t, i) =>
    pvTaskRow(t, false, todayDS, i, sortedPunctual.length)).join('');
  const recurringRows = sortedRecurring.map((t, i) =>
    pvTaskRow(t, true,  todayDS, i, sortedRecurring.length)).join('');

  panel.innerHTML = `
    <div class="pv-header" style="border-top:3px solid ${proj.color};">
      <div class="pv-title-row">
        <div class="pv-color-dot" style="background:${proj.color};"></div>
        <input class="pv-name-input" value="${esc(proj.name)}" placeholder="Nom du projet"
          onblur="window.app.saveProjectName('${projectId}',this.value)"
          onkeydown="if(event.key==='Enter')this.blur();">
        <button class="pv-close-btn" onclick="window.app.closeProjectView()">✕</button>
      </div>
      <div class="pv-color-picker">${colorSwatches}</div>
      <button class="pv-delete-btn" onclick="window.app.deleteProject('${projectId}')">🗑 Supprimer le projet</button>
    </div>

    <div class="pv-stats">
      <span class="pv-stat-chip">${total} tâche${total !== 1 ? 's' : ''}</span>
      <span class="pv-stat-chip pv-stat-done">${done} faite${done !== 1 ? 's' : ''}</span>
      ${total > 0 ? `<span class="pv-stat-chip pv-stat-pct">${pct}%</span>` : ''}
    </div>
    ${total > 0 ? `<div class="pv-progress-bar"><div class="pv-progress-fill" style="width:${pct}%;background:${proj.color};"></div></div>` : ''}

    <div class="pv-body">
      ${sortedPunctual.length > 0 ? `
        <div class="pv-section-label">Ponctuelles</div>
        <div class="pv-task-list">${punctualRows}</div>` : ''}
      ${sortedRecurring.length > 0 ? `
        <div class="pv-section-label">Récurrentes</div>
        <div class="pv-task-list">${recurringRows}</div>` : ''}
      ${total === 0 ? `<div class="pv-empty">Aucune tâche dans ce projet.<br>Ajoutez-en une ci-dessous.</div>` : ''}
    </div>

    <div class="pv-footer">
      <button class="pv-add-btn" onclick="window.app.openModalForProject('${projectId}')">＋ Ajouter une tâche</button>
    </div>`;
}

function pvTaskRow(t, isRec, todayDS, idx, total) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const done   = isRec ? isCompleted(t, today) : t.completed;
  const dateDS = isRec ? todayDS : (t.date || todayDS);

  const priorityDot = t.priority
    ? `<span class="pv-priority pv-priority--${t.priority}" title="${t.priority}"></span>`
    : '';

  const priorityCfg = {
    high:   '▲ Haute',
    medium: '▸ Moy.',
    low:    '▾ Basse',
  };
  const priorityLabel = t.priority ? `<span class="pv-task-priority pv-task-priority--${t.priority}">${priorityCfg[t.priority] || ''}</span>` : '';

  const sub = isRec
    ? `<span class="pv-rec-badge">↻ récurrent</span>${priorityLabel}`
    : `${t.date ? `<span class="pv-task-date">${t.date}</span>` : ''}${priorityLabel}`;

  return `<div class="pv-task-row${done ? ' done' : ''}" data-id="${t.id}">
    <div class="pv-task-reorder">
      <button class="pv-reorder-btn" onclick="window.app.reorderProjectTask('${t.id}','${t.projectId}',-1)" ${idx === 0 ? 'disabled' : ''}>↑</button>
      <button class="pv-reorder-btn" onclick="window.app.reorderProjectTask('${t.id}','${t.projectId}',1)" ${idx === total - 1 ? 'disabled' : ''}>↓</button>
    </div>
    ${priorityDot}
    <div class="pv-task-check${done ? ' checked' : ''}" onclick="window.app.toggleTodo('${t.id}',window.app.parseDS('${dateDS}'))"></div>
    <div class="pv-task-content">
      <span class="pv-task-title">${esc(t.title)}</span>
      <span class="pv-task-sub">${sub}</span>
    </div>
    <div class="pv-task-actions">
      <button class="pv-task-edit" onclick="window.app.openEditModal('${t.id}','${dateDS}')">✎</button>
      <button class="pv-task-unlink" onclick="window.app.unlinkFromProject('${t.id}')" title="Retirer du projet">⊘</button>
    </div>
  </div>`;
}

export function getProjectTaskOrder(projectId) {
  const stored = localStorage.getItem('projectTaskOrder');
  const all = stored ? JSON.parse(stored) : {};
  return all[projectId] || [];
}

export function saveProjectTaskOrder(projectId, order) {
  const stored = localStorage.getItem('projectTaskOrder');
  const all = stored ? JSON.parse(stored) : {};
  all[projectId] = order;
  localStorage.setItem('projectTaskOrder', JSON.stringify(all));
}
