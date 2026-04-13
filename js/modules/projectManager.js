// ════════════════════════════════════════════════════════
//  PROJECT MANAGER — entités projets indépendantes des catégories
// ════════════════════════════════════════════════════════

import { esc, DS } from './utils.js';
import { categoryIconSVG, CATEGORY_ICONS } from './admin.js';
import { pushNow } from './storage.js';
import * as state from './state.js';

const STORAGE_KEY = 'projects';

export const PROJECT_COLORS = [
  '#6366f1','#3b82f6','#10b981','#ef4444',
  '#f59e0b','#8b5cf6','#f97316','#06b6d4','#ec4899',
];

export const PROJECT_STATUSES     = ['active','on_hold','completed','archived'];
export const PROJECT_STATUS_LABELS = { active:'Actif', on_hold:'En pause', completed:'Terminé', archived:'Archivé' };
export const PROJECT_STATUS_COLORS = { active:'#10b981', on_hold:'#f59e0b', completed:'#3b82f6', archived:'#94a3b8' };

// ── CRUD ─────────────────────────────────────────────────

let _projectsCache = null;

export function getProjects() {
  if (!_projectsCache) {
    const s = localStorage.getItem(STORAGE_KEY);
    _projectsCache = s ? JSON.parse(s) : [];
  }
  return _projectsCache;
}

export function saveProjects(projects) {
  _projectsCache = projects;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  pushNow();
}

export function addProjectItem(name) {
  const projects = getProjects();
  const color = PROJECT_COLORS[projects.length % PROJECT_COLORS.length];
  const p = {
    id: Date.now().toString(),
    name: name.trim(),
    description: '',
    status: 'active',
    deadline: '',
    color,
    icon: '',
    createdAt: Date.now(),
  };
  projects.push(p);
  saveProjects(projects);
  return p;
}

export function deleteProjectItem(id) {
  saveProjects(getProjects().filter(p => p.id !== id));
}

export function updateProjectItem(id, changes) {
  const projects = getProjects();
  const idx = projects.findIndex(p => p.id === id);
  if (idx < 0) return;
  projects[idx] = { ...projects[idx], ...changes };
  saveProjects(projects);
}

// ── Panel ─────────────────────────────────────────────────

let _currentProjectId = null;
export function getCurrentProjectId() { return _currentProjectId; }

export function openProjectPanel(projectId) {
  _currentProjectId = projectId;
  const panel   = document.getElementById('projectPanel');
  const overlay = document.getElementById('projectPanelOverlay');
  if (!panel || !overlay) return;
  panel.classList.remove('hidden');
  overlay.classList.remove('hidden');
  renderProjectPanel(projectId);
  gsap.fromTo(panel,
    { x: 60, opacity: 0 },
    { x: 0, opacity: 1, duration: 0.28, ease: 'expo.out' }
  );
}

export function closeProjectPanel({ immediate = false } = {}) {
  const panel   = document.getElementById('projectPanel');
  const overlay = document.getElementById('projectPanelOverlay');
  if (!panel) return;
  if (immediate) {
    gsap.killTweensOf(panel);
    gsap.set(panel, { clearProps: 'all' });
    panel.classList.add('hidden');
    if (overlay) overlay.classList.add('hidden');
  } else {
    gsap.to(panel, {
      x: 40, opacity: 0, duration: 0.2, ease: 'power2.in',
      onComplete: () => {
        panel.classList.add('hidden');
        if (overlay) overlay.classList.add('hidden');
      },
    });
  }
  _currentProjectId = null;
}

function _projectTaskItemHTML(t) {
  const done = t.completed;
  const dateStr = t.date ? `<span class="project-task-date">${t.date.slice(5).replace('-','/')}</span>` : '';
  return `
    <div class="project-task-item${done ? ' done' : ''}" data-id="${t.id}">
      <div class="todo-check${done ? ' checked' : ''}" onclick="event.stopPropagation();window.app.toggleTodo('${t.id}',window.app.parseDS('${t.date || DS(new Date())}'));window.app.renderProjectPanelById('${t.projectId}')"></div>
      <span class="project-task-title">${esc(t.title)}</span>
      ${dateStr}
      <button class="project-task-edit" onclick="event.stopPropagation();window.app.openEditModal('${t.id}','${t.date || DS(new Date())}')">✎</button>
    </div>`;
}

function _renderProjectTasks(projectId, p) {
  const todos = state.todos || [];
  const pending = [], done = [];
  for (const t of todos) {
    if ((t.projectIds || (t.projectId ? [t.projectId] : [])).includes(projectId) && (!t.recurrence || t.recurrence === 'none'))
      (t.completed ? done : pending).push(t);
  }
  const projectTodos = pending.length + done.length;

  if (projectTodos === 0) {
    return `
      <div class="project-tasks-empty">
        <p>Aucune tâche liée à ce projet.</p>
        <button class="btn btn-primary" style="margin-top:8px;" onclick="window.app.addTaskForProject('${projectId}')">＋ Ajouter une tâche</button>
      </div>`;
  }

  const pct = Math.round(done.length / projectTodos * 100);
  const progressBar = `
    <div class="project-tasks-progress">
      <div class="project-tasks-progress-bar" style="width:${pct}%;background:${p.color};"></div>
    </div>
    <div class="project-tasks-stats">${done.length} / ${projectTodos} tâche${projectTodos > 1 ? 's' : ''} — ${pct}%</div>`;

  const pendingHTML = pending.length > 0
    ? `<div class="project-tasks-section">${pending.map(_projectTaskItemHTML).join('')}</div>`
    : '';

  const doneHTML = done.length > 0
    ? `<details class="project-tasks-done-details"><summary>${done.length} terminée${done.length > 1 ? 's' : ''}</summary><div class="project-tasks-section">${done.map(_projectTaskItemHTML).join('')}</div></details>`
    : '';

  return `
    ${progressBar}
    <div class="project-tasks-add-row">
      <button class="project-tasks-add-btn" onclick="window.app.addTaskForProject('${projectId}')">＋ Ajouter une tâche</button>
    </div>
    ${pendingHTML}
    ${doneHTML}`;
}

function _getIntentions() {
  try { return JSON.parse(localStorage.getItem('intentions') || '[]'); } catch { return []; }
}

function _renderProjectIntentions(projectId, p) {
  const intentions  = _getIntentions();
  const linkedIds   = p.intentionIds || [];
  const linked      = linkedIds.map(id => intentions.find(i => i.id === id)).filter(Boolean);
  const unlinked    = intentions.filter(i => !linkedIds.includes(i.id));

  const chips = linked.map(i =>
    `<span class="cv-intention-chip" style="border-color:${i.color};">
      <span class="cv-intention-chip-dot" style="background:${i.color};"></span>
      <span>${esc(i.title)}</span>
      <button class="cv-intention-chip-remove" onclick="event.stopPropagation();window.app.toggleProjectIntention('${projectId}','${i.id}')">✕</button>
    </span>`
  ).join('');

  const addSelect = unlinked.length > 0
    ? `<select class="cv-intention-add-select" onchange="if(this.value){window.app.toggleProjectIntention('${projectId}',this.value);this.value='';}">
        <option value="">＋ Lier une intention</option>
        ${unlinked.map(i => `<option value="${i.id}">${esc(i.title)}</option>`).join('')}
      </select>`
    : '';

  return `<div class="cv-intention-chips">${chips}${addSelect}</div>`;
}

export function renderProjectPanel(projectId) {
  const panel = document.getElementById('projectPanel');
  if (!panel || panel.classList.contains('hidden')) return;
  const p = getProjects().find(x => x.id === projectId);
  if (!p) { closeProjectPanel(); return; }

  const colorSwatches = PROJECT_COLORS.map(c =>
    `<div class="cv-color-swatch${c === p.color ? ' active' : ''}" style="background:${c};"
      onclick="window.app.setProjectColor('${projectId}','${c}')"></div>`
  ).join('');

  const iconBtns = Object.keys(CATEGORY_ICONS).map(key => {
    const isActive = (p.icon || '') === key;
    const svg = categoryIconSVG(key, 20, isActive ? p.color : 'currentColor');
    return `<button class="cv-icon-btn${isActive ? ' active' : ''}" style="${isActive ? `border-color:${p.color};color:${p.color};` : ''}"
      onclick="window.app.setProjectIcon('${projectId}','${isActive ? '' : key}')" title="${key}">${svg}</button>`;
  }).join('');

  const iconDisplay = p.icon
    ? categoryIconSVG(p.icon, 14, p.color)
    : `<div class="cv-color-dot" style="background:${p.color};"></div>`;

  panel.innerHTML = `
    <div class="cv-header" style="border-top:3px solid ${p.color};">
      <div class="cv-title-row">
        <div class="cv-title-icon">${iconDisplay}</div>
        <input class="cv-name-input" value="${esc(p.name)}" placeholder="Nom du projet"
          onblur="window.app.saveProjectName('${projectId}',this.value)"
          onkeydown="if(event.key==='Enter')this.blur();">
        <button class="cv-close-btn" onclick="window.app.closeProjectPanel()">✕</button>
      </div>
      <div class="cv-color-picker">${colorSwatches}</div>
      <div class="cv-icon-picker">${iconBtns}</div>
      <textarea class="cv-description" placeholder="Description..." rows="3"
        onblur="window.app.saveProjectDescription('${projectId}',this.value)"
      >${esc(p.description || '')}</textarea>
      <div class="cv-meta-row">
        <div class="cv-meta-field">
          <label class="cv-meta-label">Statut</label>
          <select class="cv-status-select" onchange="window.app.setProjectStatus('${projectId}',this.value)">
            ${PROJECT_STATUSES.map(s =>
              `<option value="${s}"${(p.status||'active')===s?' selected':''}>${PROJECT_STATUS_LABELS[s]}</option>`
            ).join('')}
          </select>
        </div>
        <div class="cv-meta-field">
          <label class="cv-meta-label">Échéance</label>
          <input type="date" class="cv-deadline-input" value="${esc(p.deadline || '')}"
            onchange="window.app.setProjectDeadline('${projectId}',this.value)"
            onclick="this.showPicker()">
        </div>
      </div>
      ${_getIntentions().length > 0 ? `
      <div class="cv-intentions-section">
        <label class="cv-meta-label">Intentions</label>
        ${_renderProjectIntentions(projectId, p)}
      </div>` : ''}
    </div>

    <div class="cv-body">
      ${_renderProjectTasks(projectId, p)}
    </div>

    <div class="cv-footer">
      <button class="cv-delete-btn" onclick="window.app.confirmDeleteProject('${projectId}')">🗑 Supprimer le projet</button>
    </div>`;
}
