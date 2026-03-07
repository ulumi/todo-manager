// ════════════════════════════════════════════════════════
//  MODAL MANAGEMENT
// ════════════════════════════════════════════════════════

import { DS, today, parseDS, esc, daysInMonth, firstDayOfMonth } from './utils.js';
import { getTodosForDate, addTask } from './calendar.js';
import * as state from './state.js';
import { getSuggestedTasks } from './admin.js';

export function openModal(date, todos) {
  date = date || state.navDate;
  state.setEditingId(null);
  state.setSelectedRecurrence('none');
  state.setSelectedWeekDays([]);
  state.setSelectedMonthDays([]);
  state.setSelectedMonthLastDay(false);
  state.setSelectedYearMonth(state.navDate.getMonth());
  state.setSelectedYearDay(state.navDate.getDate());
  document.getElementById('modalTitleEl').textContent = state.T.newTask;
  document.getElementById('saveTask').textContent = state.T.btnAdd;
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskDate').value = DS(date);
  document.querySelectorAll('.rec-option').forEach(o => o.classList.toggle('active', o.dataset.rec==='none'));
  document.getElementById('recDetail').innerHTML = '';
  document.getElementById('dateGroup').style.display = '';
  document.getElementById('modalClouds').innerHTML = cloudsHTML(date, todos);
  const modalBox = document.getElementById('modalOverlay').querySelector('.modal');
  modalBox.classList.add('modal-two-columns');
  document.querySelector('.modal-right').style.display = '';
  document.getElementById('modalOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
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
    onComplete: () => { overlay.classList.add('hidden'); document.body.style.overflow = ''; }
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
    const days = t.recDays ? [...t.recDays] : (t.recDay ? [t.recDay] : [1]);
    state.setSelectedMonthDays(days);
    state.setSelectedMonthLastDay(t.recLastDay || false);
    detail.innerHTML = monthCalendarHTML(state.selectedMonthDays, state.selectedMonthLastDay);
  } else if (state.selectedRecurrence === 'yearly') {
    dateGroup.style.display = 'none';
    state.setSelectedYearMonth(t.recMonth !== undefined ? t.recMonth : state.navDate.getMonth());
    state.setSelectedYearDay(t.recDay !== undefined ? t.recDay : state.navDate.getDate());
    detail.innerHTML = yearCalendarHTML(state.selectedYearMonth, state.selectedYearDay);
  }

  const modalBox = document.getElementById('modalOverlay').querySelector('.modal');
  modalBox.classList.remove('modal-two-columns');
  document.querySelector('.modal-right').style.display = 'none';
  document.getElementById('modalOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  gsap.fromTo(modalBox,
    { scale: 0.92, y: 24, opacity: 0 },
    { scale: 1, y: 0, opacity: 1, duration: 0.3, ease: 'back.out(1.4)' }
  );
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
    state.setSelectedMonthDays([state.navDate.getDate()]);
    state.setSelectedMonthLastDay(false);
    detail.innerHTML = monthCalendarHTML(state.selectedMonthDays, state.selectedMonthLastDay);
  } else if (rec==='yearly') {
    dateGroup.style.display = 'none';
    state.setSelectedYearMonth(state.navDate.getMonth());
    state.setSelectedYearDay(state.navDate.getDate());
    detail.innerHTML = yearCalendarHTML(state.selectedYearMonth, state.selectedYearDay);
  }
}

function monthCalendarHTML(selectedDays, lastDay) {
  const y = state.navDate.getFullYear();
  const m = state.navDate.getMonth();
  const total = daysInMonth(y, m);
  const firstDay = firstDayOfMonth(y, m); // 0=Sun
  const offset = (firstDay + 6) % 7; // Monday-first: Mon=0
  // Header: Mon→Sun reordered from DAYS [Sun,Mon,...,Sat]
  const headerLabels = [1,2,3,4,5,6,0].map(i => `<span>${state.DAYS[i][0]}</span>`).join('');
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push('<div class="month-day-cell empty"></div>');
  for (let d = 1; d <= total; d++) {
    const sel = selectedDays.includes(d) ? ' selected' : '';
    cells.push(`<div class="month-day-cell${sel}" data-day="${d}" onclick="window.app.toggleMonthDay(${d})">${d}</div>`);
  }
  const lastSel = lastDay ? ' selected' : '';
  const lastAbbr = state.T.lastDayAbbr || 'fin';
  cells.push(`<div class="month-day-cell month-day-last${lastSel}" id="monthLastDayBtn" onclick="window.app.toggleMonthLastDay()" title="${state.T.lastDayOfMonth || 'Last day'}">${lastAbbr}</div>`);
  return `<div class="month-cal-wrap">
    <div class="month-cal-header">${headerLabels}</div>
    <div class="month-cal-grid" id="monthDayGrid">${cells.join('')}</div>
  </div>`;
}

function yearDayCells(selMonth, selDay) {
  const y = state.navDate.getFullYear();
  const total = daysInMonth(y, selMonth);
  const offset = (firstDayOfMonth(y, selMonth) + 6) % 7;
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push('<div class="month-day-cell empty"></div>');
  for (let d = 1; d <= total; d++) {
    const sel = d === selDay ? ' selected' : '';
    cells.push(`<div class="month-day-cell${sel}" data-day="${d}" onclick="window.app.selectYearDay(${d})">${d}</div>`);
  }
  return cells.join('');
}

function yearCalendarHTML(selMonth, selDay) {
  const monthCells = state.MONTHS.map((name, i) => {
    const sel = i === selMonth ? ' selected' : '';
    return `<div class="month-picker-cell${sel}" data-month="${i}" onclick="window.app.selectYearMonth(${i})">${name.slice(0,3)}</div>`;
  }).join('');
  const headerLabels = [1,2,3,4,5,6,0].map(i => `<span>${state.DAYS[i][0]}</span>`).join('');
  return `<div class="year-cal-wrap">
    <div class="month-picker-grid" id="yearMonthGrid">${monthCells}</div>
    <div class="month-cal-header" style="margin-top:10px;">${headerLabels}</div>
    <div class="month-cal-grid" id="yearDayGrid">${yearDayCells(selMonth, selDay)}</div>
  </div>`;
}

export function selectYearMonth(m) {
  const y = state.navDate.getFullYear();
  const maxDay = daysInMonth(y, m);
  state.setSelectedYearMonth(m);
  if (state.selectedYearDay > maxDay) state.setSelectedYearDay(maxDay);
  document.querySelectorAll('#yearMonthGrid .month-picker-cell').forEach(el => {
    el.classList.toggle('selected', +el.dataset.month === m);
  });
  const gridEl = document.getElementById('yearDayGrid');
  if (gridEl) gridEl.innerHTML = yearDayCells(m, state.selectedYearDay);
}

export function selectYearDay(d) {
  state.setSelectedYearDay(d);
  document.querySelectorAll('#yearDayGrid .month-day-cell[data-day]').forEach(el => {
    el.classList.toggle('selected', +el.dataset.day === d);
  });
}

export function toggleMonthDay(d) {
  if (state.selectedMonthDays.includes(d)) {
    state.setSelectedMonthDays(state.selectedMonthDays.filter(x => x !== d));
  } else {
    state.setSelectedMonthDays([...state.selectedMonthDays, d]);
  }
  document.querySelectorAll('#monthDayGrid .month-day-cell[data-day]').forEach(el => {
    el.classList.toggle('selected', state.selectedMonthDays.includes(+el.dataset.day));
  });
}

export function toggleMonthLastDay() {
  state.setSelectedMonthLastDay(!state.selectedMonthLastDay);
  const btn = document.getElementById('monthLastDayBtn');
  if (btn) btn.classList.toggle('selected', state.selectedMonthLastDay);
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
    if (!state.selectedMonthLastDay && state.selectedMonthDays.length === 0) {
      alert(state.T.selectMonthDayError || 'Please select at least one day.');
      return true;
    }
    data.recDays = [...state.selectedMonthDays];
    if (state.selectedMonthLastDay) data.recLastDay = true;
  } else if (state.selectedRecurrence==='yearly') {
    data.recMonth = state.selectedYearMonth;
    data.recDay   = state.selectedYearDay;
  }

  if (state.editingId) {
    const t = todos.find(x => x.id === state.editingId);
    if (t) {
      t.title = data.title;
      t.recurrence = data.recurrence;
      delete t.date; delete t.recDays; delete t.recDay; delete t.recMonth; delete t.recLastDay;
      if (data.date !== undefined) t.date = data.date;
      if (data.recDays !== undefined) t.recDays = data.recDays;
      if (data.recDay !== undefined) t.recDay = data.recDay;
      if (data.recMonth !== undefined) t.recMonth = data.recMonth;
      if (data.recLastDay !== undefined) t.recLastDay = data.recLastDay;
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

  // Always show the suggestions sections (they should always be visible, even if empty)
  let html = '';
  if (suggestions.length > 0) {
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
    if (!confirm(state.T.confirmDeleteTask)) return false;
    state.setTodos(state.todos.filter(x => x.id !== id));
    return true;
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
