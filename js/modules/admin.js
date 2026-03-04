// ════════════════════════════════════════════════════════
//  ADMIN - MANAGE SUGGESTED TASKS
// ════════════════════════════════════════════════════════

import * as state from './state.js';

const STORAGE_KEY = 'suggestedTasks';

export function getSuggestedTasks() {
  const stored = localStorage.getItem(STORAGE_KEY);
  let tasks;

  if (stored) {
    tasks = JSON.parse(stored);
  } else {
    tasks = {
      daily: ['Lavage', 'Douche', 'Dents'],
      weekly: ['Déjeuner', 'Diner'],
      monthly: ['Souper', 'Planchers']
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
    <div class="admin-form">
      <div class="admin-section">
        <h3>Tâches quotidiennes</h3>
        <div id="dailyList" class="admin-list"></div>
        <div class="admin-input-row">
          <input type="text" id="dailyInput" placeholder="Ajouter une tâche quotidienne">
          <button onclick="window.app.addSuggestedTask('daily')">Ajouter</button>
        </div>
      </div>

      <div class="admin-section">
        <h3>Tâches hebdomadaires</h3>
        <div id="weeklyList" class="admin-list"></div>
        <div class="admin-input-row">
          <input type="text" id="weeklyInput" placeholder="Ajouter une tâche hebdomadaire">
          <button onclick="window.app.addSuggestedTask('weekly')">Ajouter</button>
        </div>
      </div>

      <div class="admin-section">
        <h3>Tâches mensuelles</h3>
        <div id="monthlyList" class="admin-list"></div>
        <div class="admin-input-row">
          <input type="text" id="monthlyInput" placeholder="Ajouter une tâche mensuelle">
          <button onclick="window.app.addSuggestedTask('monthly')">Ajouter</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('adminClouds').innerHTML = html;
  renderAdminLists(tasks);
  document.getElementById('adminModalOverlay').classList.remove('hidden');
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

export function closeAdminModal() {
  document.getElementById('adminModalOverlay').classList.add('hidden');
}
