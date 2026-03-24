// ════════════════════════════════════════════════════════
//  PROJECT MANAGER — entités projets indépendantes des catégories
// ════════════════════════════════════════════════════════

import { esc } from './utils.js';
import { categoryIconSVG, CATEGORY_ICONS } from './admin.js';
import { pushFirestoreNow } from './storage.js';

const STORAGE_KEY = 'boardProjects';

export const PROJECT_COLORS = [
  '#6366f1','#3b82f6','#10b981','#ef4444',
  '#f59e0b','#8b5cf6','#f97316','#06b6d4','#ec4899',
];

export const PROJECT_STATUSES     = ['active','on_hold','completed','archived'];
export const PROJECT_STATUS_LABELS = { active:'Actif', on_hold:'En pause', completed:'Terminé', archived:'Archivé' };
export const PROJECT_STATUS_COLORS = { active:'#10b981', on_hold:'#f59e0b', completed:'#3b82f6', archived:'#94a3b8' };

// ── CRUD ─────────────────────────────────────────────────

export function getProjects() {
  const s = localStorage.getItem(STORAGE_KEY);
  return s ? JSON.parse(s) : [];
}

export function saveProjects(projects) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  pushFirestoreNow();
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
    </div>

    <div class="cv-body" style="padding:16px;">
      <p style="font-size:13px;color:var(--text-muted);text-align:center;margin-top:32px;">
        Les tâches liées aux projets arrivent dans une prochaine version.
      </p>
    </div>

    <div class="cv-footer">
      <button class="cv-delete-btn" onclick="window.app.confirmDeleteProject('${projectId}')">🗑 Supprimer le projet</button>
    </div>`;
}
