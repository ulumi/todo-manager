// ════════════════════════════════════════════════════════
//  MODAL MANAGEMENT
// ════════════════════════════════════════════════════════

import { DS, today, parseDS, esc } from './utils.js';
import { getTodosForDate, addTask } from './calendar.js';
import * as state from './state.js';
import { getSuggestedTasks } from './admin.js';

export function openModal(date, todos) {
  date = date || state.navDate;
  state.setEditingId(null);
  state.setSelectedRecurrence('none');
  state.setSelectedWeekDays([]);
  document.getElementById('modalTitleEl').textContent = state.T.newTask;
  document.getElementById('saveTask').textContent = state.T.btnAdd;
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskDate').value = DS(date);
  document.querySelectorAll('.rec-option').forEach(o => o.classList.toggle('active', o.dataset.rec==='none'));
  document.getElementById('recDetail').innerHTML = '';
  document.getElementById('dateGroup').style.display = '';
  document.getElementById('modalClouds').innerHTML = cloudsHTML(date, todos);
  document.getElementById('modalOverlay').classList.remove('hidden');
  const modalBox = document.getElementById('modalOverlay').querySelector('.modal');
  gsap.fromTo(modalBox,
    { scale: 0.92, y: 24, opacity: 0 },
    { scale: 1, y: 0, opacity: 1, duration: 0.3, ease: 'back.out(1.4)' }
  );
  setTimeout(() => document.getElementById('taskTitle').focus(), 50);
}

export function closeModal() {
  state.setEditingId(null);
  const modalBox = document.getElementById('modalOverlay').querySelector('.modal');
  const overlay = document.getElementById('modalOverlay');
  gsap.to(modalBox, {
    scale: 0.92, y: 16, opacity: 0, duration: 0.2, ease: 'power2.in',
    onComplete: () => overlay.classList.add('hidden')
  });
}

export function openEditModal(id, dateStr, todos) {
  const t = todos.find(x => x.id === id);
  if (!t) return;
  state.setEditingId(id);
  state.setSelectedRecurrence(t.recurrence || 'none');
  state.setSelectedWeekDays(t.recDays ? [...t.recDays] : []);
  document.getElementById('modalTitleEl').textContent = state.T.editTask;
  document.getElementById('saveTask').textContent = state.T.btnModify;
  document.getElementById('taskTitle').value = t.title;
  document.getElementById('modalClouds').innerHTML = '';

  // Set recurrence UI
  document.querySelectorAll('.rec-option').forEach(o => o.classList.toggle('active', o.dataset.rec === state.selectedRecurrence));
  const dateGroup = document.getElementById('dateGroup');
  const detail = document.getElementById('recDetail');

  if (state.selectedRecurrence === 'none') {
    dateGroup.style.display = '';
    document.getElementById('taskDate').value = t.date || dateStr;
    detail.innerHTML = '';
  } else if (state.selectedRecurrence === 'daily') {
    dateGroup.style.display = 'none';
    detail.innerHTML = `<p style="font-size:13px;color:var(--text-muted);margin-top:4px;">${state.T.repeatsEveryDay}</p>`;
  } else if (state.selectedRecurrence === 'weekly') {
    dateGroup.style.display = 'none';
    detail.innerHTML = `<div class="day-checkboxes" id="weekDayBoxes">
      ${state.DAYS.map((d,i) => `<div class="day-checkbox${state.selectedWeekDays.includes(i)?' selected':''}" data-day="${i}"
        onclick="window.app.toggleWeekDay(${i})">${d[0]}</div>`).join('')}
    </div>`;
  } else if (state.selectedRecurrence === 'monthly') {
    dateGroup.style.display = 'none';
    detail.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
      <span style="font-size:13px;color:var(--text-muted);">${state.T.dayOfMonth}</span>
      <select id="monthDay" class="form-input" style="width:80px;padding:6px 8px;">
        ${Array.from({length:31},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('')}
      </select>
    </div>`;
    document.getElementById('monthDay').value = t.recDay || 1;
  } else if (state.selectedRecurrence === 'yearly') {
    dateGroup.style.display = 'none';
    detail.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap;">
      <span style="font-size:13px;color:var(--text-muted);">${state.T.every}:</span>
      <select id="yearMonth" class="form-input" style="width:130px;padding:6px 8px;">
        ${state.MONTHS.map((m,i)=>`<option value="${i}">${m}</option>`).join('')}
      </select>
      <select id="yearDay" class="form-input" style="width:80px;padding:6px 8px;">
        ${Array.from({length:31},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('')}
      </select>
    </div>`;
    if (t.recMonth !== undefined) document.getElementById('yearMonth').value = t.recMonth;
    if (t.recDay !== undefined) document.getElementById('yearDay').value = t.recDay;
  }

  document.getElementById('modalOverlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('taskTitle').focus(), 50);
}

export function selectRecurrence(rec) {
  state.setSelectedRecurrence(rec);
  document.querySelectorAll('.rec-option').forEach(o => o.classList.toggle('active', o.dataset.rec===rec));
  const dateGroup = document.getElementById('dateGroup');
  const detail = document.getElementById('recDetail');

  if (rec==='none') {
    dateGroup.style.display = '';
    detail.innerHTML = '';
  } else if (rec==='daily') {
    dateGroup.style.display = 'none';
    detail.innerHTML = `<p style="font-size:13px;color:var(--text-muted);margin-top:4px;">${state.T.repeatsEveryDay}</p>`;
  } else if (rec==='weekly') {
    dateGroup.style.display = 'none';
    state.setSelectedWeekDays([today().getDay()]);
    detail.innerHTML = `<div class="day-checkboxes" id="weekDayBoxes">
      ${state.DAYS.map((d,i) => `<div class="day-checkbox${state.selectedWeekDays.includes(i)?' selected':''}" data-day="${i}"
        onclick="window.app.toggleWeekDay(${i})">${d[0]}</div>`).join('')}
    </div>`;
  } else if (rec==='monthly') {
    dateGroup.style.display = 'none';
    detail.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
      <span style="font-size:13px;color:var(--text-muted);">${state.T.dayOfMonth}</span>
      <select id="monthDay" class="form-input" style="width:80px;padding:6px 8px;">
        ${Array.from({length:31},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('')}
      </select>
    </div>`;
    document.getElementById('monthDay').value = state.navDate.getDate();
  } else if (rec==='yearly') {
    dateGroup.style.display = 'none';
    detail.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap;">
      <span style="font-size:13px;color:var(--text-muted);">${state.T.every}:</span>
      <select id="yearMonth" class="form-input" style="width:130px;padding:6px 8px;">
        ${state.MONTHS.map((m,i)=>`<option value="${i}">${m}</option>`).join('')}
      </select>
      <select id="yearDay" class="form-input" style="width:80px;padding:6px 8px;">
        ${Array.from({length:31},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('')}
      </select>
    </div>`;
    document.getElementById('yearMonth').value = state.navDate.getMonth();
    document.getElementById('yearDay').value = state.navDate.getDate();
  }
}

export function toggleWeekDay(i) {
  if (state.selectedWeekDays.includes(i)) {
    state.setSelectedWeekDays(state.selectedWeekDays.filter(x=>x!==i));
  } else {
    state.selectedWeekDays.push(i);
    state.setSelectedWeekDays([...state.selectedWeekDays]);
  }
  document.querySelectorAll('#weekDayBoxes .day-checkbox').forEach(el => {
    el.classList.toggle('selected', state.selectedWeekDays.includes(+el.dataset.day));
  });
}

export function saveTaskLogic(todos) {
  const title = document.getElementById('taskTitle').value.trim();
  if (!title) {
    document.getElementById('taskTitle').focus();
    return true; // error
  }

  const data = { title, recurrence: state.selectedRecurrence };

  if (state.selectedRecurrence==='none') {
    data.date = document.getElementById('taskDate').value || DS(state.navDate);
  } else if (state.selectedRecurrence==='weekly') {
    if (state.selectedWeekDays.length===0) { alert(state.T.selectWeekdayError); return true; }
    data.recDays = [...state.selectedWeekDays];
  } else if (state.selectedRecurrence==='monthly') {
    data.recDay = parseInt(document.getElementById('monthDay').value);
  } else if (state.selectedRecurrence==='yearly') {
    data.recMonth = parseInt(document.getElementById('yearMonth').value);
    data.recDay   = parseInt(document.getElementById('yearDay').value);
  }

  if (state.editingId) {
    const t = todos.find(x => x.id === state.editingId);
    if (t) {
      t.title = data.title;
      t.recurrence = data.recurrence;
      delete t.date; delete t.recDays; delete t.recDay; delete t.recMonth;
      if (data.date !== undefined) t.date = data.date;
      if (data.recDays !== undefined) t.recDays = data.recDays;
      if (data.recDay !== undefined) t.recDay = data.recDay;
      if (data.recMonth !== undefined) t.recMonth = data.recMonth;
      if (data.recurrence !== 'none' && !t.startDate) t.startDate = DS(today());
    }
  } else {
    addTask(data, todos);
  }
  return false; // no error
}

export function cloudsHTML(date, todos) {
  const suggestedTasksConfig = getSuggestedTasks();
  const allSuggestedItems = [...suggestedTasksConfig.daily, ...suggestedTasksConfig.weekly, ...suggestedTasksConfig.monthly];

  const suggestions = getSuggestions(todos).filter(s => !allSuggestedItems.includes(s));
  state.setSuggestions(suggestions);

  // Check if there's anything to display: suggestions, suggested tasks, or templates
  const hasSuggestions = suggestions.length > 0;
  const hasSuggestedTasks = suggestedTasksConfig.daily.length > 0 || suggestedTasksConfig.weekly.length > 0 || suggestedTasksConfig.monthly.length > 0;

  if (!hasSuggestions && !hasSuggestedTasks) return '';

  let html = '';
  if (hasSuggestions) {
    html += `<div class="clouds-section">
      <span class="cloud-label">${state.T.frequentlyUsed}</span>
      <div class="cloud-chips">${suggestions.map((t,i)=>`<div class="chip" onclick="window.app.openModalWithTitle(window.app._sugg[${i}])">${esc(t)}</div>`).join('')}</div>
    </div>`;
  }
  html += `<div class="clouds-section">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      <span class="cloud-label" style="margin: 0;">${state.T.recurringDaily}</span>
      <button onclick="window.app.openAdminModal()" style="background: none; border: none; color: var(--primary); cursor: pointer; font-size: 12px; text-decoration: underline; padding: 0;">éditer</button>
    </div>
    <div class="cloud-chips">
      ${suggestedTasksConfig.daily.map(t=>`<div class="chip" onclick="window.app.openModalWithTitle('${t}')">${t}</div>`).join('')}
    </div>
  </div>`;

  html += `<div class="clouds-section">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      <span class="cloud-label" style="margin: 0;">${state.T.recurringWeekly}</span>
      <button onclick="window.app.openAdminModal()" style="background: none; border: none; color: var(--primary); cursor: pointer; font-size: 12px; text-decoration: underline; padding: 0;">éditer</button>
    </div>
    <div class="cloud-chips">
      ${suggestedTasksConfig.weekly.map(t=>`<div class="chip" onclick="window.app.openModalWithTitle('${t}')">${t}</div>`).join('')}
    </div>
  </div>`;

  html += `<div class="clouds-section">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      <span class="cloud-label" style="margin: 0;">${state.T.recurringMonthly}</span>
      <button onclick="window.app.openAdminModal()" style="background: none; border: none; color: var(--primary); cursor: pointer; font-size: 12px; text-decoration: underline; padding: 0;">éditer</button>
    </div>
    <div class="cloud-chips">
      ${suggestedTasksConfig.monthly.map(t=>`<div class="chip" onclick="window.app.openModalWithTitle('${t}')">${t}</div>`).join('')}
    </div>
  </div>`;
  html += `<div class="clouds-section">
    <span class="cloud-label">${state.T.templates || 'Templates'}</span>
    <div class="cloud-chips">
      <div class="chip" onclick="window.app.openModalWithTitle('Semaine')">Semaine</div>
      <div class="chip" onclick="window.app.openModalWithTitle('Fin de Semaine')">Fin de Semaine</div>
    </div>
  </div>`;
  return html;
}

export function openDataModal() {
  document.getElementById('dataModalOverlay').classList.remove('hidden');
}

export function closeDataModal() {
  document.getElementById('dataModalOverlay').classList.add('hidden');
}

export function openDeleteModal(id, dateStr, todos) {
  const t = todos.find(x => x.id === id);
  if (!t) return;
  if (!t.recurrence || t.recurrence === 'none') {
    if (!confirm(state.T.confirmDeleteTask)) return;
    state.setTodos(state.todos.filter(x => x.id !== id));
    return;
  }
  state.setPendingDelete({ id, date: parseDS(dateStr) });
  document.getElementById('deleteTaskName').textContent = t.title;
  document.getElementById('deleteModalOverlay').classList.remove('hidden');
  const deleteModalBox = document.getElementById('deleteModalOverlay').querySelector('.modal');
  gsap.fromTo(deleteModalBox,
    { scale: 0.92, y: 24, opacity: 0 },
    { scale: 1, y: 0, opacity: 1, duration: 0.3, ease: 'back.out(1.4)' }
  );
}

export function closeDeleteModal() {
  const deleteModalBox = document.getElementById('deleteModalOverlay').querySelector('.modal');
  const overlay = document.getElementById('deleteModalOverlay');
  gsap.to(deleteModalBox, {
    scale: 0.92, y: 16, opacity: 0, duration: 0.2, ease: 'power2.in',
    onComplete: () => overlay.classList.add('hidden')
  });
  state.setPendingDelete(null);
}


function getSuggestions(todos) {
  const counts = {};
  todos.filter(t => !t.recurrence || t.recurrence==='none')
    .forEach(t => { counts[t.title] = (counts[t.title]||0)+1; });
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([t])=>t);
}
