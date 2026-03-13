// ════════════════════════════════════════════════════════
//  MODAL MANAGEMENT
// ════════════════════════════════════════════════════════

import { DS, today, parseDS, esc, daysInMonth, firstDayOfMonth } from './utils.js';
import { getTodosForDate, addTask } from './calendar.js';
import * as state from './state.js';
import { getSuggestedTasks, getCategories } from './admin.js';

function populateCategorySelect(selectedId) {
  const sel = document.getElementById('taskCategory');
  if (!sel) return;
  const categories = getCategories();
  sel.innerHTML = `<option value="">— Aucune catégorie —</option>` +
    categories.map(p => `<option value="${p.id}"${p.id === selectedId ? ' selected' : ''}>${escapeCategory(p.name)}</option>`).join('');
}

function escapeCategory(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function selectPriority(p) {
  state.setSelectedPriority(p);
  document.querySelectorAll('.priority-option').forEach(o =>
    o.classList.toggle('active', o.dataset.priority === p)
  );
}

export function openModal(date, todos) {
  date = date || state.navDate;
  state.setEditingId(null);
  state.setSelectedRecurrence('none');
  state.setSelectedWeekDays([]);
  state.setSelectedMonthDays([]);
  state.setSelectedMonthLastDay(false);
  state.setSelectedYearMonth(state.navDate.getMonth());
  state.setSelectedYearDay(state.navDate.getDate());
  selectPriority('');
  document.getElementById('modalTitleEl').textContent = state.T.newTask;
  document.getElementById('saveTask').textContent = state.T.btnAdd;
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskDescription').value = '';
  document.getElementById('taskDate').value = DS(date);
  document.querySelectorAll('.rec-option').forEach(o => o.classList.toggle('active', o.dataset.rec==='none'));
  document.getElementById('recDetail').innerHTML = '';
  document.getElementById('dateGroup').style.display = '';
  document.getElementById('modalClouds').innerHTML = cloudsHTML(date, todos);
  populateCategorySelect('');
  const modalBox = document.getElementById('modalOverlay').querySelector('.modal');
  modalBox.classList.add('modal-two-columns');
  // Reset right column state (open)
  const right = document.getElementById('modalRight');
  const inner = document.getElementById('modalRightInner');
  const toggle = document.getElementById('modalColToggle');
  if (right) { right.style.display = ''; right.classList.remove('collapsed'); gsap.set(right, { clearProps: 'width' }); }
  if (inner) gsap.set(inner, { clearProps: 'x,opacity' });
  if (toggle) { toggle.classList.remove('collapsed'); toggle.style.display = ''; }
  document.getElementById('modalOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  gsap.fromTo(modalBox,
    { scale: 0.92, y: 24, opacity: 0 },
    { scale: 1, y: 0, opacity: 1, duration: 0.3, ease: 'back.out(1.4)' }
  );
  _initModalSwipe();
  setTimeout(() => document.getElementById('taskTitle').focus(), 50);
}

export function closeModal() {
  state.setEditingId(null);
  state.setInsertAfterId(null);
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
  document.getElementById('taskDescription').value = t.description || '';
  document.getElementById('modalClouds').innerHTML = cloudsHTML(parseDS(dateStr), todos);
  populateCategorySelect(t.projectId || '');
  selectPriority(t.priority || '');

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
  modalBox.classList.add('modal-two-columns');
  const right = document.getElementById('modalRight');
  const inner = document.getElementById('modalRightInner');
  const toggle = document.getElementById('modalColToggle');
  if (right) { right.style.display = ''; right.classList.remove('collapsed'); gsap.set(right, { clearProps: 'width' }); }
  if (inner) gsap.set(inner, { clearProps: 'x,opacity' });
  if (toggle) { toggle.classList.remove('collapsed'); toggle.style.display = ''; }
  document.getElementById('modalOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  gsap.fromTo(modalBox,
    { scale: 0.92, y: 24, opacity: 0 },
    { scale: 1, y: 0, opacity: 1, duration: 0.3, ease: 'back.out(1.4)' }
  );
  _initModalSwipe();
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
  const offset = firstDayOfMonth(y, m); // 0=Mon
  const headerLabels = state.DAYS.map(d => `<span>${d[0]}</span>`).join('');
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
  const offset = firstDayOfMonth(y, selMonth); // 0=Mon
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
  const headerLabels = state.DAYS.map(d => `<span>${d[0]}</span>`).join('');
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

// ─── Collapsible cloud sections ───────────────────────────────────────────

export function toggleCloudSection(headerEl) {
  const section = headerEl.closest('.clouds-section');
  if (!section) return;
  const body = section.querySelector('.clouds-section-body');
  if (!body) return;
  const isOpen = section.classList.contains('open');
  if (isOpen) {
    section.classList.remove('open');
    gsap.to(body, { height: 0, duration: 0.22, ease: 'power2.inOut', overwrite: 'auto' });
  } else {
    section.classList.add('open');
    gsap.to(body, { height: 'auto', duration: 0.28, ease: 'power2.out', overwrite: 'auto' });
  }
}

// ─── Right column slide toggle ────────────────────────────────────────────

let _rightNaturalWidth = 0;

export function toggleModalRight() {
  const right = document.getElementById('modalRight');
  const inner = document.getElementById('modalRightInner');
  const toggle = document.getElementById('modalColToggle');
  if (!right || !toggle) return;

  const isOpen = !right.classList.contains('collapsed');

  if (isOpen) {
    _rightNaturalWidth = right.offsetWidth || 360;
    gsap.set(right, { width: _rightNaturalWidth });
    if (inner) gsap.to(inner, { x: 30, opacity: 0, duration: 0.22, ease: 'power2.in', overwrite: 'auto' });
    gsap.to(right, {
      width: 0,
      borderLeftWidth: 0,
      borderRightWidth: 0,
      duration: 0.32,
      ease: 'expo.inOut',
      overwrite: 'auto',
      onComplete: () => { right.classList.add('collapsed'); toggle.classList.add('collapsed'); }
    });
  } else {
    right.classList.remove('collapsed');
    toggle.classList.remove('collapsed');
    gsap.set(right, { width: 0, borderLeftWidth: 0, borderRightWidth: 0 });
    if (inner) gsap.set(inner, { x: 30, opacity: 0 });
    gsap.to(right, {
      width: _rightNaturalWidth || 360,
      borderLeftWidth: 1.5,
      borderRightWidth: 1.5,
      duration: 0.35,
      ease: 'expo.out',
      overwrite: 'auto',
      onComplete: () => gsap.set(right, { clearProps: 'width,borderLeftWidth,borderRightWidth' })
    });
    if (inner) gsap.to(inner, { x: 0, opacity: 1, duration: 0.3, delay: 0.1, ease: 'expo.out', overwrite: 'auto' });
  }
}

// ─── Swipe gesture ────────────────────────────────────────────────────────

function _initModalSwipe() {
  const modal = document.getElementById('modalOverlay').querySelector('.modal');
  if (!modal || modal._swipeInit) return;
  modal._swipeInit = true;

  let sx = 0, active = false;
  const THRESHOLD = 55;

  modal.addEventListener('pointerdown', e => {
    if (e.target.closest('input, select, button, .rec-option, .chip, .day-checkbox, .month-day-cell, .month-picker-cell')) return;
    sx = e.clientX;
    active = true;
  }, { passive: true });

  modal.addEventListener('pointerup', e => {
    if (!active) return;
    active = false;
    if (window.innerWidth <= 600) return;
    const dx = e.clientX - sx;
    if (Math.abs(dx) < THRESHOLD) return;
    const right = document.getElementById('modalRight');
    if (!right) return;
    const isOpen = !right.classList.contains('collapsed');
    if (dx < 0 && isOpen) window.app.toggleModalRight();
    else if (dx > 0 && !isOpen) window.app.toggleModalRight();
  }, { passive: true });
}

export function saveTaskLogic(todos) {
  const title = document.getElementById('taskTitle').value.trim();
  if (!title) {
    document.getElementById('taskTitle').focus();
    return true; // error
  }

  const projectId   = document.getElementById('taskCategory')?.value || '';
  const priority    = state.selectedPriority || undefined;
  const description = document.getElementById('taskDescription').value.trim() || undefined;
  const data = { title, recurrence: state.selectedRecurrence, projectId: projectId || undefined, priority, description };

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
      t.projectId   = data.projectId;
      t.priority    = data.priority;
      t.description = data.description;
    }
  } else {
    addTask(data, todos);
  }
  return false; // no error
}

const _chevronSVG = `<svg class="clouds-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

function _cloudSection(label, chipsHTML, withEdit = false, openByDefault = false) {
  const editBtn = withEdit
    ? `<button class="clouds-edit-btn" onclick="event.stopPropagation();window.app.openAdminModal()">éditer</button>`
    : '';
  const openClass = openByDefault ? ' open' : '';
  const bodyStyle = openByDefault ? 'height:auto' : 'height:0';
  return `<div class="clouds-section${openClass}">
    <div class="clouds-section-header" onclick="window.app.toggleCloudSection(this)">
      <span class="cloud-label">${label}</span>
      ${editBtn}
      ${_chevronSVG}
    </div>
    <div class="clouds-section-body" style="${bodyStyle};overflow:hidden">
      <div class="cloud-chips">${chipsHTML}</div>
    </div>
  </div>`;
}

export function cloudsHTML(date, todos) {
  const suggestedTasksConfig = getSuggestedTasks();
  const allSuggestedItems = [...suggestedTasksConfig.daily, ...suggestedTasksConfig.weekly, ...suggestedTasksConfig.monthly];

  const suggestions = getSuggestions(todos).filter(s => !allSuggestedItems.includes(s));
  state.setSuggestions(suggestions);

  let html = '';
  if (suggestions.length > 0) {
    const chips = suggestions.map((t, i) => `<div class="chip" data-chip-type="suggestion" data-chip-index="${i}">${esc(t)}</div>`).join('');
    html += _cloudSection(state.T.frequentlyUsed, chips, false, true);
  }
  html += _cloudSection(state.T.recurringDaily,   suggestedTasksConfig.daily.map(t=>`<div class="chip" data-chip-type="daily" data-chip-title="${esc(t)}">${esc(t)}</div>`).join(''), true);
  html += _cloudSection(state.T.recurringWeekly,  suggestedTasksConfig.weekly.map(t=>`<div class="chip" data-chip-type="weekly" data-chip-title="${esc(t)}">${esc(t)}</div>`).join(''), true);
  html += _cloudSection(state.T.recurringMonthly, suggestedTasksConfig.monthly.map(t=>`<div class="chip" data-chip-type="monthly" data-chip-title="${esc(t)}">${esc(t)}</div>`).join(''), true);

  // Setup event listeners after HTML is inserted
  setTimeout(() => {
    document.querySelectorAll('[data-chip-type]').forEach(chip => {
      chip.style.cursor = 'pointer';
      chip.addEventListener('click', () => {
        let title = '';
        if (chip.dataset.chipType === 'suggestion') {
          title = suggestions[parseInt(chip.dataset.chipIndex)];
        } else {
          title = chip.dataset.chipTitle;
        }
        if (title) window.app.openModalWithTitle(title);
      });
    });
  }, 0);

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
  state.setPendingDelete({ id, date: parseDS(dateStr) });
  // Translate all texts
  const T = state.T;
  document.getElementById('deleteModalTitle').textContent   = T.deleteRecurringTitle;
  document.getElementById('deleteModalPrompt').textContent  = T.deleteRecurringPrompt;
  document.getElementById('deleteTaskName').textContent     = t.title;
  document.getElementById('deleteOneTitle').textContent    = T.deleteOneOccurrence;
  document.getElementById('deleteOneDesc').textContent     = T.deleteOneDesc;
  document.getElementById('deleteFutureTitle').textContent = T.deleteFutureOccurrences;
  document.getElementById('deleteFutureDesc').textContent  = T.deleteFutureDesc;
  document.getElementById('deleteAllTitle').textContent    = T.deleteAllOccurrences;
  document.getElementById('deleteAllDesc').textContent     = T.deleteAllDesc;
  document.getElementById('deleteModalOverlay').classList.remove('hidden');
  const deleteModalBox = document.getElementById('deleteModalOverlay').querySelector('.modal');
  gsap.fromTo(deleteModalBox,
    { scale: 0.92, y: 24, opacity: 0 },
    { scale: 1, y: 0, opacity: 1, duration: 0.3, ease: 'back.out(1.4)' }
  );
  // Enter key → delete all occurrences
  const onKey = e => {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('deleteAllBtn').click(); }
    if (e.key === 'Escape') { e.preventDefault(); document.getElementById('cancelDeleteModal').click(); }
  };
  document.addEventListener('keydown', onKey);
  deleteModalBox._deleteKeyHandler = onKey;
}

export function _removeDeleteKeyHandler() {
  const deleteModalBox = document.getElementById('deleteModalOverlay')?.querySelector('.modal');
  if (deleteModalBox?._deleteKeyHandler) {
    document.removeEventListener('keydown', deleteModalBox._deleteKeyHandler);
    deleteModalBox._deleteKeyHandler = null;
  }
}

export function closeDeleteModal() {
  _removeDeleteKeyHandler();
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
