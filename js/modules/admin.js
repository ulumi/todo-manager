// ════════════════════════════════════════════════════════
//  ADMIN - MANAGE SUGGESTED TASKS
// ════════════════════════════════════════════════════════

import * as state from './state.js';
import { saveTodos } from './storage.js';

const STORAGE_KEY = 'suggestedTasks';
const TEMPLATES_KEY = 'dayTemplates';
const PROJECTS_KEY = 'projects';

const PROJECT_COLORS = ['#f59e0b','#3b82f6','#10b981','#ef4444','#8b5cf6','#f97316','#06b6d4','#ec4899'];

// ── Projects ─────────────────────────────────────────────
export function getProjects() {
  const stored = localStorage.getItem(PROJECTS_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function saveProjects(projects) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function addProject() {
  const input = document.getElementById('newProjectInput');
  const name = input?.value.trim();
  if (!name) return;
  const projects = getProjects();
  const color = PROJECT_COLORS[projects.length % PROJECT_COLORS.length];
  projects.push({ id: Date.now().toString(), name, color });
  saveProjects(projects);
  input.value = '';
  renderAdminProjects();
}

export function removeProject(id) {
  saveProjects(getProjects().filter(p => p.id !== id));
  renderAdminProjects();
}

export function renderAdminProjects() {
  const container = document.getElementById('projectAdminList');
  if (!container) return;
  const projects = getProjects();
  container.innerHTML = projects.map(p => `
    <div class="admin-item" style="cursor:pointer;" onclick="window.app.openProjectView('${p.id}')">
      <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${p.color};margin-right:8px;flex-shrink:0;"></span>
      <span class="admin-item-text">${escapeHtml(p.name)}</span>
      <div class="admin-item-controls">
        <button class="admin-btn-small" onclick="event.stopPropagation();window.app.removeProject('${p.id}')">×</button>
      </div>
    </div>
  `).join('') + `
    <div class="admin-input-row" style="margin-top:8px;">
      <input type="text" id="newProjectInput" placeholder="Nom du projet"
        onkeydown="if(event.key==='Enter') window.app.addProject()">
      <button onclick="window.app.addProject()">Ajouter</button>
    </div>`;
}

// ── Day Templates ────────────────────────────────────────
export function getTemplates() {
  const stored = localStorage.getItem(TEMPLATES_KEY);
  if (stored) return JSON.parse(stored);
  return [
    { id: '1', name: 'Semaine', tasks: ['Douche', 'Dents', 'Diner'] },
    { id: '2', name: 'Fin de semaine', tasks: ['Déjeuner', 'Sport'] }
  ];
}

export function saveTemplates(templates) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

export function addTemplate() {
  const input = document.getElementById('newTemplateInput');
  const name = input?.value.trim();
  if (!name) return;
  const templates = getTemplates();
  templates.push({ id: Date.now().toString(), name, tasks: [] });
  saveTemplates(templates);
  input.value = '';
  renderAdminTemplates();
}

export function removeTemplate(id) {
  saveTemplates(getTemplates().filter(t => t.id !== id));
  renderAdminTemplates();
}

export function addTaskToTemplate(id) {
  const input = document.getElementById('tmplTaskInput_' + id);
  const task = input?.value.trim();
  if (!task) return;
  const templates = getTemplates();
  const tmpl = templates.find(t => t.id === id);
  if (tmpl) { tmpl.tasks.push(task); saveTemplates(templates); renderAdminTemplates(); }
}

export function removeTaskFromTemplate(id, idx) {
  const templates = getTemplates();
  const tmpl = templates.find(t => t.id === id);
  if (tmpl) { tmpl.tasks.splice(idx, 1); saveTemplates(templates); renderAdminTemplates(); }
}

export function renderAdminTemplates() {
  const container = document.getElementById('templateAdminList');
  if (!container) return;
  const templates = getTemplates();
  container.innerHTML = templates.map(tmpl => `
    <div class="admin-template-card">
      <div class="admin-template-header">
        <span class="admin-template-name">${escapeHtml(tmpl.name)}</span>
        <button class="admin-btn-small" onclick="window.app.removeTemplate('${tmpl.id}')">×</button>
      </div>
      <div class="admin-template-tasks">
        ${tmpl.tasks.map((task, idx) => `
          <span class="admin-template-chip">
            ${escapeHtml(task)}
            <button onclick="window.app.removeTaskFromTemplate('${tmpl.id}', ${idx})">×</button>
          </span>`).join('')}
        ${tmpl.tasks.length === 0 ? `<span style="font-size:12px;color:var(--text-muted);">Aucune tâche</span>` : ''}
      </div>
      <div class="admin-input-row">
        <input type="text" id="tmplTaskInput_${tmpl.id}" placeholder="Ajouter une tâche"
          onkeydown="if(event.key==='Enter') window.app.addTaskToTemplate('${tmpl.id}')">
        <button onclick="window.app.addTaskToTemplate('${tmpl.id}')">+</button>
      </div>
    </div>`).join('') + `
    <div class="admin-input-row" style="margin-top:8px;">
      <input type="text" id="newTemplateInput" placeholder="Nom du nouveau modèle"
        onkeydown="if(event.key==='Enter') window.app.addTemplate()">
      <button onclick="window.app.addTemplate()">Ajouter un modèle</button>
    </div>`;
}

export function openTemplateModal(dateStr) {
  const templates = getTemplates();
  const list = document.getElementById('templatePickerList');
  if (!list) return;
  list.innerHTML = templates.length === 0
    ? `<p style="text-align:center;color:var(--text-muted);padding:24px 0;">Aucun modèle configuré.<br>Allez dans <b>Admin</b> pour en créer.</p>`
    : templates.map(t => `
      <div class="template-pick-item" onclick="window.app.applyTemplate('${t.id}','${dateStr}')">
        <div class="template-pick-name">${escapeHtml(t.name)}</div>
        ${t.tasks.length > 0 ? `<div class="template-pick-tasks">${t.tasks.map(escapeHtml).join(' · ')}</div>` : ''}
      </div>`).join('');
  const overlay = document.getElementById('templateModalOverlay');
  overlay.classList.remove('hidden');
  gsap.fromTo(overlay.querySelector('.modal'),
    { scale: 0.92, y: 24, opacity: 0 },
    { scale: 1, y: 0, opacity: 1, duration: 0.3, ease: 'back.out(1.4)' }
  );
}

export function closeTemplateModal() {
  document.getElementById('templateModalOverlay').classList.add('hidden');
}

export function applyTemplate(templateId, dateStr, todos) {
  const tmpl = getTemplates().find(t => t.id === templateId);
  if (!tmpl) return;
  const base = Date.now();
  tmpl.tasks.forEach((title, i) => {
    todos.push({ id: (base + i).toString(), title, date: dateStr, recurrence: 'none', completed: false, completedDates: [] });
  });
  closeTemplateModal();
}

export function getSuggestedTasks() {
  const stored = localStorage.getItem(STORAGE_KEY);
  let tasks;

  if (stored) {
    tasks = JSON.parse(stored);
  } else {
    tasks = {
      daily: [],
      weekly: [],
      monthly: []
    };
  }

  // Clean empty entries
  tasks.daily = tasks.daily.filter(t => t && t.trim());
  tasks.weekly = tasks.weekly.filter(t => t && t.trim());
  tasks.monthly = tasks.monthly.filter(t => t && t.trim());

  return tasks;
}

export function saveSuggestedTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

export function openAdminModal() {
  const tasks = getSuggestedTasks();
  const html = `
    <div class="admin-layout">
      <nav class="admin-sidenav">
        <button class="admin-sidenav-link active" onclick="window.app.showAdminSection('taches')">📋 Tâches</button>
        <button class="admin-sidenav-link" onclick="window.app.showAdminSection('projets')">📁 Projets</button>
        <button class="admin-sidenav-link" onclick="window.app.showAdminSection('modeles')">🗂 Modèles</button>
        <button class="admin-sidenav-link" onclick="window.app.showAdminSection('donnees')">💾 Données</button>
      </nav>
      <div class="admin-content">

        <section id="section-taches" class="admin-page-section">
          <h2 class="admin-section-title">Tâches suggérées</h2>
          <div class="admin-form">
            <div class="admin-section">
              <h3>Quotidiennes</h3>
              <div id="dailyList" class="admin-list"></div>
              <div class="admin-input-row">
                <input type="text" id="dailyInput" placeholder="Ajouter une tâche quotidienne">
                <button onclick="window.app.addSuggestedTask('daily')">Ajouter</button>
              </div>
            </div>
            <div class="admin-section">
              <h3>Hebdomadaires</h3>
              <div id="weeklyList" class="admin-list"></div>
              <div class="admin-input-row">
                <input type="text" id="weeklyInput" placeholder="Ajouter une tâche hebdomadaire">
                <button onclick="window.app.addSuggestedTask('weekly')">Ajouter</button>
              </div>
            </div>
            <div class="admin-section">
              <h3>Mensuelles</h3>
              <div id="monthlyList" class="admin-list"></div>
              <div class="admin-input-row">
                <input type="text" id="monthlyInput" placeholder="Ajouter une tâche mensuelle">
                <button onclick="window.app.addSuggestedTask('monthly')">Ajouter</button>
              </div>
            </div>
          </div>
          <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);">
            <button class="btn btn-ghost" onclick="window.app.clearAllSuggestedTasks()" style="width:100%;">Vider tout</button>
          </div>
        </section>

        <section id="section-projets" class="admin-page-section" style="display:none">
          <h2 class="admin-section-title">Projets</h2>
          <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">Les tâches liées à un projet s'affichent dans la colonne de droite de la vue Jour.</p>
          <div id="projectAdminList"></div>
        </section>

        <section id="section-modeles" class="admin-page-section" style="display:none">
          <h2 class="admin-section-title">Modèles de journée</h2>
          <div id="templateAdminList"></div>
        </section>

        <section id="section-donnees" class="admin-page-section" style="display:none">
          <h2 class="admin-section-title">Données</h2>
          <div class="admin-data-sections">
            <div class="admin-section">
              <h3>Export</h3>
              <div class="admin-data-grid">
                <button class="btn btn-primary" onclick="window.app.exportAllData()" style="width:100%;">Export complet</button>
                <button class="btn btn-ghost" onclick="window.app.exportCalendarOnly()" style="width:100%;">Calendrier seulement</button>
                <button class="btn btn-ghost" onclick="window.app.exportConfigOnly()" style="width:100%;">Paramètres seulement</button>
              </div>
            </div>
            <div class="admin-section">
              <h3>iCal</h3>
              <div class="admin-data-grid">
                <button class="btn btn-primary" onclick="window.app.downloadICalFile()" style="width:100%;">Télécharger .ics</button>
                <button class="btn btn-ghost" onclick="window.app.copyICalSubscriptionLink()" style="width:100%;">Copier le lien</button>
              </div>
            </div>
            <div class="admin-section">
              <h3>Import</h3>
              <input type="file" id="importFileInput" accept=".json" style="display:none;">
              <button class="btn btn-primary" onclick="document.getElementById('importFileInput').click()" style="width:100%;">Importer un fichier</button>
            </div>
            <div class="admin-section">
              <h3>Réinitialiser</h3>
              <button class="btn btn-ghost" onclick="window.app.clearAllCalendarData()" style="width:100%;color:var(--danger);border-color:var(--danger);">${state.T.clearAllData}</button>
            </div>
          </div>
        </section>

      </div>
    </div>
  `;

  document.getElementById('adminClouds').innerHTML = html;
  renderAdminLists(tasks);
  renderAdminTemplates();
  renderAdminProjects();
  document.getElementById('adminModalOverlay').classList.remove('hidden');
}

export function showAdminSection(id) {
  document.querySelectorAll('.admin-content .admin-page-section').forEach(s => s.style.display = 'none');
  document.getElementById('section-' + id).style.display = '';
  document.querySelectorAll('.admin-sidenav-link').forEach(l => {
    l.classList.toggle('active', l.getAttribute('onclick').includes(`'${id}'`));
  });
}

export function renderAdminLists(tasks) {
  const renderList = (type, items) => {
    const list = document.getElementById(`${type}List`);
    list.innerHTML = items.map((item, index) => `
      <div class="admin-item">
        <span class="admin-item-text" data-type="${type}" data-index="${index}">${escapeHtml(item)}</span>
        <div class="admin-item-controls">
          <button class="admin-btn-small" onclick="window.app.moveSuggestedTask('${type}', ${index}, 'up')" ${index === 0 ? 'disabled' : ''} title="Monter">↑</button>
          <button class="admin-btn-small" onclick="window.app.moveSuggestedTask('${type}', ${index}, 'down')" ${index === items.length - 1 ? 'disabled' : ''} title="Descendre">↓</button>
          <button class="admin-btn-small" onclick="window.app.removeSuggestedTask('${type}', '${escapeHtml(item)}')">×</button>
        </div>
      </div>
    `).join('');

    // Add edit listeners
    setTimeout(() => {
      document.querySelectorAll(`#${type}List .admin-item-text`).forEach(el => {
        el.addEventListener('dblclick', startEdit);
      });
    }, 0);
  };

  renderList('daily', tasks.daily);
  renderList('weekly', tasks.weekly);
  renderList('monthly', tasks.monthly);
}

function startEdit(e) {
  const textEl = e.target;
  if (textEl.classList.contains('editing')) return;

  const type = textEl.dataset.type;
  const index = parseInt(textEl.dataset.index);
  const currentText = textEl.textContent;

  textEl.classList.add('editing');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'admin-item-input';
  input.value = currentText;
  input.dataset.type = type;
  input.dataset.index = index;
  input.dataset.oldText = currentText;

  textEl.replaceWith(input);
  input.focus();
  input.select();

  const saveEdit = (save) => {
    const newText = input.value.trim();
    const oldText = input.dataset.oldText;

    if (save && newText && newText !== oldText) {
      const tasks = getSuggestedTasks();
      const idx = parseInt(input.dataset.index);
      tasks[input.dataset.type][idx] = newText;
      saveSuggestedTasks(tasks);
      renderAdminLists(tasks);
    } else {
      renderAdminLists(getSuggestedTasks());
    }
  };

  input.addEventListener('blur', () => saveEdit(true));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveEdit(true);
    if (e.key === 'Escape') saveEdit(false);
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function addSuggestedTask(type) {
  const input = document.getElementById(`${type}Input`);
  const task = input.value.trim();
  if (!task) return;

  const tasks = getSuggestedTasks();
  if (!tasks[type].includes(task)) {
    tasks[type].push(task);
    saveSuggestedTasks(tasks);
    input.value = '';
    renderAdminLists(tasks);
  }
}

export function removeSuggestedTask(type, task) {
  const tasks = getSuggestedTasks();
  tasks[type] = tasks[type].filter(t => t !== task);
  saveSuggestedTasks(tasks);
  renderAdminLists(tasks);
}

export function moveSuggestedTask(type, index, direction) {
  const tasks = getSuggestedTasks();
  const items = tasks[type];

  if (direction === 'up' && index > 0) {
    [items[index - 1], items[index]] = [items[index], items[index - 1]];
  } else if (direction === 'down' && index < items.length - 1) {
    [items[index], items[index + 1]] = [items[index + 1], items[index]];
  }

  saveSuggestedTasks(tasks);
  renderAdminLists(tasks);
}

export function clearAllSuggestedTasks() {
  if (!confirm('Êtes-vous sûr de vouloir vider toutes les tâches suggérées ?')) return;
  const emptyTasks = { daily: [], weekly: [], monthly: [] };
  saveSuggestedTasks(emptyTasks);
  renderAdminLists(emptyTasks);
}

export function clearAllCalendarData() {
  if (!confirm(state.T.confirmClearAllData)) return;
  // Clear todos and save
  saveTodos([]);
  state.setTodos([]);
}

export function closeAdminModal() {
  document.getElementById('adminModalOverlay').classList.add('hidden');
}

export function adminScrollToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;

  // Scroll smoothly
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Update active state in nav
  document.querySelectorAll('.admin-nav-link').forEach(link => {
    link.classList.remove('active');
  });

  // Find and activate the clicked button
  const btns = document.querySelectorAll('.admin-nav-link');
  btns.forEach(btn => {
    if (btn.getAttribute('onclick').includes(id)) {
      btn.classList.add('active');
    }
  });
}
