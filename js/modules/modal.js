// ════════════════════════════════════════════════════════
//  MODAL MANAGEMENT
// ════════════════════════════════════════════════════════

import { DS, today, parseDS, esc, daysInMonth, firstDayOfMonth } from './utils.js';
import { getTodosForDate, addTask, getSuggestions, getRecentTasks } from './calendar.js';
import * as state from './state.js';
import { getSuggestedTasks, getCategories, saveCategories, CATEGORY_COLORS } from './admin.js';

// ─── Draft management ─────────────────────────────────────────────────────

const DRAFT_KEY = 'modalDraft';
let _draftTimer = null;
let _draftListeners = null;

function _scheduleDraftSave() {
  clearTimeout(_draftTimer);
  _draftTimer = setTimeout(_saveDraft, 300);
}

function _saveDraft() {
  const title = document.getElementById('taskTitle')?.value || '';
  const description = document.getElementById('taskDescription')?.value || '';
  if (!title && !description) { localStorage.removeItem(DRAFT_KEY); return; }
  localStorage.setItem(DRAFT_KEY, JSON.stringify({
    title,
    description,
    priority: state.selectedPriority || '',
    scheduleMode: state.scheduleMode,
    date: document.getElementById('taskDate')?.value || '',
    startTime: document.getElementById('taskStartTime')?.value || '',
    endTime: document.getElementById('taskEndTime')?.value || '',
    flexibleTime: document.getElementById('taskFlexibleTime')?.checked || false,
    durationEstimated: document.getElementById('taskDurationEstimated')?.value || '',
    durationReal: document.getElementById('taskDurationReal')?.value || '',
    categoryId: document.getElementById('taskCategory')?.value || '',
    recurrence: state.selectedRecurrence,
    weekDays: [...state.selectedWeekDays],
    monthDays: [...state.selectedMonthDays],
    monthLastDay: state.selectedMonthLastDay,
    yearMonth: state.selectedYearMonth,
    yearDay: state.selectedYearDay,
  }));
}

export function clearDraft() {
  clearTimeout(_draftTimer);
  localStorage.removeItem(DRAFT_KEY);
  const banner = document.getElementById('draftBanner');
  if (banner) banner.style.display = 'none';
}

export function discardDraft() {
  clearDraft();
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskDescription').value = '';
  document.getElementById('taskDate').value = DS(state.navDate);
  document.getElementById('taskStartTime').value = '';
  document.getElementById('taskEndTime').value = '';
  document.getElementById('taskFlexibleTime').checked = false;
  document.getElementById('taskDurationEstimated').value = '';
  document.getElementById('taskDurationReal').value = '';
  selectPriority('');
  populateCategorySelect('');
  selectScheduleMode('date');
  state.setSelectedRecurrence('none');
  document.querySelectorAll('.rec-option').forEach(o => o.classList.toggle('active', o.dataset.rec === 'none'));
  document.getElementById('recDetail').innerHTML = '';
  const scheduleModeGroup = document.getElementById('scheduleModeGroup');
  if (scheduleModeGroup) scheduleModeGroup.style.display = '';
  const dateGroup = document.getElementById('dateGroup');
  if (dateGroup) dateGroup.style.display = '';
  document.getElementById('taskTitle').focus();
}

function _tryRestoreDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return false;
  let d;
  try { d = JSON.parse(raw); } catch { return false; }
  if (!d.title && !d.description) return false;
  if (d.title) document.getElementById('taskTitle').value = d.title;
  if (d.description) document.getElementById('taskDescription').value = d.description;
  if (d.date) document.getElementById('taskDate').value = d.date;
  if (d.startTime) document.getElementById('taskStartTime').value = d.startTime;
  if (d.endTime) document.getElementById('taskEndTime').value = d.endTime;
  if (d.flexibleTime) document.getElementById('taskFlexibleTime').checked = true;
  if (d.durationEstimated) document.getElementById('taskDurationEstimated').value = d.durationEstimated;
  if (d.durationReal) document.getElementById('taskDurationReal').value = d.durationReal;
  if (d.priority !== undefined) selectPriority(d.priority);
  if (d.categoryId) { const sel = document.getElementById('taskCategory'); if (sel) sel.value = d.categoryId; }
  if (d.scheduleMode) {
    state.setScheduleMode(d.scheduleMode);
    document.querySelectorAll('.schedule-mode-option').forEach(o => o.classList.toggle('active', o.dataset.mode === d.scheduleMode));
    const dg = document.getElementById('dateGroup');
    if (dg) dg.style.display = d.scheduleMode === 'date' ? '' : 'none';
  }
  if (d.recurrence && d.recurrence !== 'none') {
    if (d.weekDays?.length) state.setSelectedWeekDays(d.weekDays);
    if (d.monthDays?.length) state.setSelectedMonthDays(d.monthDays);
    if (d.monthLastDay !== undefined) state.setSelectedMonthLastDay(d.monthLastDay);
    if (d.yearMonth !== undefined) state.setSelectedYearMonth(d.yearMonth);
    if (d.yearDay !== undefined) state.setSelectedYearDay(d.yearDay);
    selectRecurrence(d.recurrence);
  }
  return true;
}

export function cancelModal() {
  clearDraft();
  closeModal();
}

function _initDraftListeners() {
  _destroyDraftListeners();
  const listeners = [];
  [['taskTitle','input'],['taskDescription','input'],['taskDate','change'],
   ['taskStartTime','change'],['taskEndTime','change'],['taskFlexibleTime','change'],
   ['taskDurationEstimated','input'],['taskDurationReal','input'],['taskCategory','change']
  ].forEach(([id, evt]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const fn = () => _scheduleDraftSave();
    el.addEventListener(evt, fn);
    listeners.push({ el, evt, fn });
  });
  _draftListeners = listeners;
}

function _destroyDraftListeners() {
  if (!_draftListeners) return;
  _draftListeners.forEach(({ el, evt, fn }) => el.removeEventListener(evt, fn));
  _draftListeners = null;
  clearTimeout(_draftTimer);
}

// ─────────────────────────────────────────────────────────────────────────

export function selectScheduleMode(mode) {
  state.setScheduleMode(mode);
  document.querySelectorAll('.schedule-mode-option').forEach(o =>
    o.classList.toggle('active', o.dataset.mode === mode)
  );
  const dateGroup = document.getElementById('dateGroup');
  if (dateGroup) dateGroup.style.display = mode === 'date' ? '' : 'none';
  _scheduleDraftSave();
}

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

export function toggleNewCatRow() {
  const row = document.getElementById('newCatRow');
  if (!row) return;
  const visible = row.style.display !== 'none';
  row.style.display = visible ? 'none' : 'block';
  if (!visible) setTimeout(() => document.getElementById('newCatInput')?.focus(), 50);
}

export function addCategoryInline() {
  const input = document.getElementById('newCatInput');
  const name = input?.value.trim();
  if (!name) return;
  const categories = getCategories();
  const color = CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length];
  const id = Date.now().toString();
  categories.push({ id, name, color, icon: '', description: '', status: 'active', deadline: '' });
  saveCategories(categories);
  input.value = '';
  document.getElementById('newCatRow').style.display = 'none';
  populateCategorySelect(id);
}

export function selectPriority(p) {
  state.setSelectedPriority(p);
  const sel = document.getElementById('taskPriority');
  if (sel) sel.value = p;
  _scheduleDraftSave();
}

export function openModal(date, todos, scheduleMode = 'date') {
  date = date || state.navDate;
  state.setEditingId(null);
  state.setScheduleMode(scheduleMode);
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
  document.getElementById('taskStartTime').value = '';
  document.getElementById('taskEndTime').value = '';
  document.getElementById('taskFlexibleTime').checked = false;
  document.getElementById('taskDurationEstimated').value = '';
  document.getElementById('taskDurationReal').value = '';
  const recSel = document.getElementById('taskRecurrence');
  if (recSel) recSel.value = 'none';
  document.getElementById('recDetail').innerHTML = '';
  // Schedule mode UI
  document.querySelectorAll('.schedule-mode-option').forEach(o => o.classList.toggle('active', o.dataset.mode === scheduleMode));
  const scheduleModeGroup = document.getElementById('scheduleModeGroup');
  if (scheduleModeGroup) scheduleModeGroup.style.display = '';
  const dateGroup = document.getElementById('dateGroup');
  if (dateGroup) dateGroup.style.display = scheduleMode === 'date' ? '' : 'none';
  document.getElementById('modalClouds').innerHTML = cloudsHTML(date, todos);
  populateCategorySelect('');
  // Restore draft (new tasks only)
  const draftBanner = document.getElementById('draftBanner');
  const hadDraft = _tryRestoreDraft();
  if (draftBanner) draftBanner.style.display = hadDraft ? '' : 'none';
  const modalBox = document.getElementById('modalOverlay').querySelector('.modal');
  // Reset right column state — collapsed in add mode
  const right = document.getElementById('modalRight');
  const inner = document.getElementById('modalRightInner');
  const toggle = document.getElementById('modalColToggle');
  if (right) { right.style.display = ''; right.classList.add('collapsed'); gsap.set(right, { width: 0 }); }
  if (inner) gsap.set(inner, { x: 30, opacity: 0 });
  if (toggle) { toggle.classList.add('collapsed'); toggle.style.display = 'none'; }
  // Context fields — hidden until title has content
  const ctxFields = document.getElementById('contextFields');
  if (ctxFields) {
    if (hadDraft && document.getElementById('taskTitle').value.trim()) {
      gsap.set(ctxFields, { maxHeight: 2000, opacity: 1 });
      if (toggle) toggle.style.display = '';
    } else {
      gsap.set(ctxFields, { maxHeight: 0, opacity: 0 });
    }
  }
  // Hide guided overlay
  const guidedOv = document.getElementById('guidedOverlay');
  if (guidedOv) guidedOv.style.display = 'none';
  document.getElementById('modalOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  gsap.fromTo(modalBox,
    { scale: 0.94, y: 30, opacity: 0 },
    { scale: 1, y: 0, opacity: 1, duration: 0.45, ease: 'power2.out' }
  );
  _initModalSwipe();
  _initCombobox(todos);
  _initDraftListeners();
  _initContextReveal();
  setTimeout(() => document.getElementById('taskTitle').focus(), 50);
}

export function closeModal() {
  _destroyCombobox();
  _destroyDraftListeners();
  _destroyContextReveal();
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
  // Detect schedule mode
  const isBacklog = (!t.recurrence || t.recurrence === 'none') && !t.date && t.backlog;
  const isInbox   = (!t.recurrence || t.recurrence === 'none') && !t.date && !t.backlog;
  const schedMode = isBacklog ? 'backlog' : (isInbox ? 'inbox' : 'date');
  state.setScheduleMode(schedMode);
  state.setSelectedRecurrence(t.recurrence || 'none');
  state.setSelectedWeekDays(t.recDays ? [...t.recDays] : []);
  document.getElementById('modalTitleEl').textContent = state.T.editTask;
  document.getElementById('saveTask').textContent = state.T.btnModify;
  document.getElementById('taskTitle').value = t.title;
  document.getElementById('taskDescription').value = t.description || '';
  document.getElementById('taskStartTime').value = t.startTime || '';
  document.getElementById('taskEndTime').value = t.endTime || '';
  document.getElementById('taskFlexibleTime').checked = t.flexibleTime || false;
  document.getElementById('taskDurationEstimated').value = t.durationEstimated || '';
  document.getElementById('taskDurationReal').value = t.durationReal || '';
  document.getElementById('modalClouds').innerHTML = cloudsHTML(dateStr ? parseDS(dateStr) : state.navDate, todos);
  populateCategorySelect(t.projectId || '');
  selectPriority(t.priority || '');

  // Schedule mode UI
  document.querySelectorAll('.schedule-mode-option').forEach(o => o.classList.toggle('active', o.dataset.mode === schedMode));
  const scheduleModeGroup = document.getElementById('scheduleModeGroup');

  // Set recurrence UI
  const recSel2 = document.getElementById('taskRecurrence');
  if (recSel2) recSel2.value = state.selectedRecurrence;
  const dateGroup = document.getElementById('dateGroup');
  const detail = document.getElementById('recDetail');

  if (state.selectedRecurrence === 'none') {
    if (scheduleModeGroup) scheduleModeGroup.style.display = '';
    dateGroup.style.display = schedMode === 'date' ? '' : 'none';
    document.getElementById('taskDate').value = t.date || dateStr || '';
    detail.innerHTML = '';
  } else if (state.selectedRecurrence === 'daily') {
    if (scheduleModeGroup) scheduleModeGroup.style.display = 'none';
    dateGroup.style.display = 'none';
    detail.innerHTML = '';
  } else if (state.selectedRecurrence === 'weekly') {
    if (scheduleModeGroup) scheduleModeGroup.style.display = 'none';
    dateGroup.style.display = 'none';
    detail.innerHTML = `<div class="day-checkboxes" id="weekDayBoxes">
      ${state.DAYS.map((d,i) => `<div class="day-checkbox${state.selectedWeekDays.includes(i)?' selected':''}" data-day="${i}"
        onclick="window.app.toggleWeekDay(${i})">${d[0]}</div>`).join('')}
    </div>`;
  } else if (state.selectedRecurrence === 'monthly') {
    if (scheduleModeGroup) scheduleModeGroup.style.display = 'none';
    dateGroup.style.display = 'none';
    const days = t.recDays ? [...t.recDays] : (t.recDay ? [t.recDay] : [1]);
    state.setSelectedMonthDays(days);
    state.setSelectedMonthLastDay(t.recLastDay || false);
    detail.innerHTML = monthCalendarHTML(state.selectedMonthDays, state.selectedMonthLastDay);
  } else if (state.selectedRecurrence === 'yearly') {
    if (scheduleModeGroup) scheduleModeGroup.style.display = 'none';
    dateGroup.style.display = 'none';
    state.setSelectedYearMonth(t.recMonth !== undefined ? t.recMonth : state.navDate.getMonth());
    state.setSelectedYearDay(t.recDay !== undefined ? t.recDay : state.navDate.getDate());
    detail.innerHTML = yearCalendarHTML(state.selectedYearMonth, state.selectedYearDay);
  }

  const modalBox = document.getElementById('modalOverlay').querySelector('.modal');
  const right = document.getElementById('modalRight');
  const inner = document.getElementById('modalRightInner');
  const toggle = document.getElementById('modalColToggle');
  if (right) { right.style.display = ''; right.classList.remove('collapsed'); gsap.set(right, { clearProps: 'width' }); }
  if (inner) gsap.set(inner, { clearProps: 'x,opacity' });
  if (toggle) { toggle.classList.remove('collapsed'); toggle.style.display = ''; }
  // Context fields — immediately visible in edit mode
  const ctxFields = document.getElementById('contextFields');
  if (ctxFields) gsap.set(ctxFields, { maxHeight: 2000, opacity: 1 });
  // Hide guided overlay
  const guidedOv = document.getElementById('guidedOverlay');
  if (guidedOv) guidedOv.style.display = 'none';
  document.getElementById('modalOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  gsap.fromTo(modalBox,
    { scale: 0.94, y: 30, opacity: 0 },
    { scale: 1, y: 0, opacity: 1, duration: 0.45, ease: 'power2.out' }
  );
  _initCombobox(todos);
  _initModalSwipe();
  _initContextReveal();
  setTimeout(() => document.getElementById('taskTitle').focus(), 50);
}

export function selectRecurrence(rec) {
  state.setSelectedRecurrence(rec);
  const sel = document.getElementById('taskRecurrence');
  if (sel) sel.value = rec;
  _scheduleDraftSave();
  const dateGroup = document.getElementById('dateGroup');
  const detail = document.getElementById('recDetail');
  const scheduleModeGroup = document.getElementById('scheduleModeGroup');

  if (rec==='none') {
    if (scheduleModeGroup) scheduleModeGroup.style.display = '';
    dateGroup.style.display = state.scheduleMode === 'date' ? '' : 'none';
    detail.innerHTML = '';
  } else if (rec==='daily') {
    if (scheduleModeGroup) scheduleModeGroup.style.display = 'none';
    dateGroup.style.display = 'none';
    detail.innerHTML = '';
  } else if (rec==='weekly') {
    if (scheduleModeGroup) scheduleModeGroup.style.display = 'none';
    dateGroup.style.display = 'none';
    state.setSelectedWeekDays([today().getDay()]);
    detail.innerHTML = `<div class="day-checkboxes" id="weekDayBoxes">
      ${state.DAYS.map((d,i) => `<div class="day-checkbox${state.selectedWeekDays.includes(i)?' selected':''}" data-day="${i}"
        onclick="window.app.toggleWeekDay(${i})">${d[0]}</div>`).join('')}
    </div>`;
  } else if (rec==='monthly') {
    if (scheduleModeGroup) scheduleModeGroup.style.display = 'none';
    dateGroup.style.display = 'none';
    state.setSelectedMonthDays([state.navDate.getDate()]);
    state.setSelectedMonthLastDay(false);
    detail.innerHTML = monthCalendarHTML(state.selectedMonthDays, state.selectedMonthLastDay);
  } else if (rec==='yearly') {
    if (scheduleModeGroup) scheduleModeGroup.style.display = 'none';
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

export function toggleDetailSection(headerEl) {
  const section = headerEl.closest('.modal-detail-section');
  if (!section) return;
  const body = section.querySelector('.modal-detail-body');
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

  const projectId         = document.getElementById('taskCategory')?.value || '';
  const priority          = state.selectedPriority || undefined;
  const description       = document.getElementById('taskDescription').value.trim() || undefined;
  const startTime         = document.getElementById('taskStartTime')?.value || undefined;
  const endTime           = document.getElementById('taskEndTime')?.value || undefined;
  const flexibleTime      = document.getElementById('taskFlexibleTime')?.checked || undefined;
  const durationEstimated = document.getElementById('taskDurationEstimated')?.value ? parseInt(document.getElementById('taskDurationEstimated').value) : undefined;
  const durationReal      = document.getElementById('taskDurationReal')?.value ? parseInt(document.getElementById('taskDurationReal').value) : undefined;

  const data = {
    title,
    recurrence: state.selectedRecurrence,
    projectId: projectId || undefined,
    priority,
    description,
    startTime,
    endTime,
    flexibleTime: flexibleTime || undefined,
    durationEstimated,
    durationReal,
  };

  if (state.selectedRecurrence==='none') {
    if (state.scheduleMode === 'backlog') {
      data.date = null;
      data.backlog = true;
    } else if (state.scheduleMode === 'inbox') {
      data.date = null;
    } else {
      data.date = document.getElementById('taskDate').value || DS(state.navDate);
    }
  } else {
    // For all recurring types, capture the navDate as the intended start date
    data.date = document.getElementById('taskDate').value || DS(state.navDate);
  }

  if (state.selectedRecurrence==='weekly') {
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
      delete t.backlog; delete t.startTime; delete t.endTime; delete t.flexibleTime;
      delete t.durationEstimated; delete t.durationReal;
      if (data.date !== undefined) t.date = data.date;
      if (data.recDays !== undefined) t.recDays = data.recDays;
      if (data.recDay !== undefined) t.recDay = data.recDay;
      if (data.recMonth !== undefined) t.recMonth = data.recMonth;
      if (data.recLastDay !== undefined) t.recLastDay = data.recLastDay;
      if (data.recurrence !== 'none' && !t.startDate) t.startDate = DS(today());
      if (data.backlog) t.backlog = true;
      if (data.startTime) t.startTime = data.startTime;
      if (data.endTime) t.endTime = data.endTime;
      if (data.flexibleTime) t.flexibleTime = data.flexibleTime;
      if (data.durationEstimated) t.durationEstimated = data.durationEstimated;
      if (data.durationReal) t.durationReal = data.durationReal;
      t.projectId   = data.projectId;
      t.priority    = data.priority;
      t.description = data.description;
    }
  } else {
    addTask(data, todos);
  }
  clearDraft();
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

// ─── Quick access (3 frequent + 3 recent) in modal-right ─────────────────

function _quickAccessHTML(todos) {
  const suggestedItems = (() => {
    const cfg = getSuggestedTasks();
    return [...cfg.daily, ...cfg.weekly, ...cfg.monthly];
  })();

  const frequent = getSuggestions(todos)
    .filter(s => !suggestedItems.includes(s))
    .slice(0, 3);
  const recent = getRecentTasks(todos)
    .filter(s => !suggestedItems.includes(s) && !frequent.includes(s))
    .slice(0, 3);

  state.setSuggestions([...frequent, ...recent]);
  if (frequent.length === 0 && recent.length === 0) return '';

  const chip = (title, type, idx) =>
    `<div class="chip qa-chip" data-qa-type="${type}" data-qa-index="${idx}" data-qa-title="${esc(title)}">${esc(title)}</div>`;

  let chips = '';
  if (frequent.length > 0)
    chips += `<span class="qa-sub-label">${esc(state.T.frequentlyUsed)}</span>` +
      frequent.map((t, i) => chip(t, 'frequent', i)).join('');
  if (recent.length > 0)
    chips += `<span class="qa-sub-label">${esc(state.T.recentlyAdded)}</span>` +
      recent.map((t, i) => chip(t, 'recent', i)).join('');

  return _cloudSection(state.T.quickAccess, chips, false, true);
}

export function cloudsHTML(date, todos) {
  const suggestedTasksConfig = getSuggestedTasks();

  let html = _quickAccessHTML(todos);
  html += _cloudSection(state.T.recurringDaily,   suggestedTasksConfig.daily.map(t=>`<div class="chip" data-chip-type="daily" data-chip-title="${esc(t)}">${esc(t)}</div>`).join(''), true);
  html += _cloudSection(state.T.recurringWeekly,  suggestedTasksConfig.weekly.map(t=>`<div class="chip" data-chip-type="weekly" data-chip-title="${esc(t)}">${esc(t)}</div>`).join(''), true);
  html += _cloudSection(state.T.recurringMonthly, suggestedTasksConfig.monthly.map(t=>`<div class="chip" data-chip-type="monthly" data-chip-title="${esc(t)}">${esc(t)}</div>`).join(''), true);

  // Setup event listeners after HTML is inserted
  setTimeout(() => {
    // Recurring chip → open modal with title
    document.querySelectorAll('[data-chip-type]').forEach(chip => {
      chip.style.cursor = 'pointer';
      chip.addEventListener('click', () => {
        const title = chip.dataset.chipTitle;
        if (title) window.app.openModalWithTitle(title);
      });
    });
    // Quick access chip → fill title input
    document.querySelectorAll('.qa-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const title = chip.dataset.qaTitle;
        if (title) {
          document.getElementById('taskTitle').value = title;
          document.getElementById('taskTitle').focus();
        }
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


// ─── Combobox (title autocomplete) ───────────────────────────────────────

let _comboboxPool = [];
let _comboboxActiveIdx = -1;
let _comboboxHandlers = null;

function _buildPool(todos) {
  const cfg = getSuggestedTasks();
  const recurring = [...cfg.daily, ...cfg.weekly, ...cfg.monthly];
  const frequent  = getSuggestions(todos);
  // Deduplicate: frequent first (ordered by usage), then recurring
  const seen = new Set(frequent);
  const extra = recurring.filter(t => !seen.has(t));
  return [...frequent, ...extra];
}

function _renderCombobox(matches, query) {
  const box = document.getElementById('titleCombobox');
  if (!box) return;
  if (!matches.length) { box.classList.add('hidden'); return; }
  _comboboxActiveIdx = -1;
  box.innerHTML = matches.map((title, i) => {
    const lo = title.toLowerCase();
    const qi = lo.indexOf(query.toLowerCase());
    let label = esc(title);
    if (qi !== -1) {
      const pre  = esc(title.slice(0, qi));
      const bold = esc(title.slice(qi, qi + query.length));
      const post = esc(title.slice(qi + query.length));
      label = `${pre}<strong>${bold}</strong>${post}`;
    }
    return `<div class="title-combobox-item" data-idx="${i}" role="option">${label}</div>`;
  }).join('');
  box.classList.remove('hidden');
}

function _comboboxSelect(title) {
  const input = document.getElementById('taskTitle');
  if (input) { input.value = title; input.dispatchEvent(new Event('input')); }
  const box = document.getElementById('titleCombobox');
  if (box) box.classList.add('hidden');
}

function _initCombobox(todos) {
  _destroyCombobox();
  _comboboxPool = _buildPool(todos);
  const input = document.getElementById('taskTitle');
  const box   = document.getElementById('titleCombobox');
  if (!input || !box) return;

  const onInput = () => {
    const q = input.value.trim();
    if (!q) { box.classList.add('hidden'); return; }
    const lo = q.toLowerCase();
    const prefix = _comboboxPool.filter(t => t.toLowerCase().startsWith(lo));
    const sub    = _comboboxPool.filter(t => !t.toLowerCase().startsWith(lo) && t.toLowerCase().includes(lo));
    _renderCombobox([...prefix, ...sub].slice(0, 6), q);
  };

  const onKeydown = e => {
    if (box.classList.contains('hidden')) return;
    const items = box.querySelectorAll('.title-combobox-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      _comboboxActiveIdx = Math.min(_comboboxActiveIdx + 1, items.length - 1);
      items.forEach((el, i) => el.classList.toggle('active', i === _comboboxActiveIdx));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      _comboboxActiveIdx = Math.max(_comboboxActiveIdx - 1, 0);
      items.forEach((el, i) => el.classList.toggle('active', i === _comboboxActiveIdx));
    } else if (e.key === 'Enter' && _comboboxActiveIdx >= 0) {
      e.preventDefault();
      _comboboxSelect(items[_comboboxActiveIdx].textContent);
    } else if (e.key === 'Escape') {
      box.classList.add('hidden');
    }
  };

  const onBlur = () => setTimeout(() => box.classList.add('hidden'), 150);

  const onClick = e => {
    const item = e.target.closest('.title-combobox-item');
    if (item) _comboboxSelect(_comboboxPool[+item.dataset.idx]);
  };

  input.addEventListener('input',   onInput);
  input.addEventListener('keydown', onKeydown);
  input.addEventListener('blur',    onBlur);
  box.addEventListener('mousedown', onClick);

  _comboboxHandlers = { input, box, onInput, onKeydown, onBlur, onClick };
}

function _destroyCombobox() {
  if (!_comboboxHandlers) return;
  const { input, box, onInput, onKeydown, onBlur, onClick } = _comboboxHandlers;
  input?.removeEventListener('input',   onInput);
  input?.removeEventListener('keydown', onKeydown);
  input?.removeEventListener('blur',    onBlur);
  box?.removeEventListener('mousedown', onClick);
  if (box) box.classList.add('hidden');
  _comboboxHandlers = null;
}

// ─── Progressive disclosure (context reveal) ─────────────────────────────

let _contextRevealed = false;
let _contextRevealHandler = null;

function _initContextReveal() {
  _contextRevealed = false;
  const title = document.getElementById('taskTitle');
  const ctx = document.getElementById('contextFields');
  const toggle = document.getElementById('modalColToggle');
  if (!title || !ctx) return;

  // If already has content (edit mode or draft), mark as revealed
  if (title.value.trim()) _contextRevealed = true;

  _contextRevealHandler = () => {
    const hasContent = title.value.trim().length > 0;
    if (hasContent && !_contextRevealed) {
      _contextRevealed = true;
      gsap.to(ctx, { maxHeight: 2000, opacity: 1, duration: 0.4, ease: 'power2.out' });
      if (toggle) { toggle.style.display = ''; gsap.fromTo(toggle, { opacity: 0 }, { opacity: 1, duration: 0.3 }); }
    } else if (!hasContent && _contextRevealed) {
      _contextRevealed = false;
      gsap.to(ctx, { maxHeight: 0, opacity: 0, duration: 0.3, ease: 'power2.in' });
      if (toggle) gsap.to(toggle, { opacity: 0, duration: 0.2, onComplete: () => { toggle.style.display = 'none'; } });
    }
  };
  title.addEventListener('input', _contextRevealHandler);
}

function _destroyContextReveal() {
  const title = document.getElementById('taskTitle');
  if (title && _contextRevealHandler) title.removeEventListener('input', _contextRevealHandler);
  _contextRevealHandler = null;
  _contextRevealed = false;
}

// ─── Guided Cards ─────────────────────────────────────────────────────────

let _guidedStep = 0;

export function openGuidedCards() {
  const overlay = document.getElementById('guidedOverlay');
  const main = document.querySelector('.modal-main');
  const colToggle = document.getElementById('modalColToggle');
  const right = document.getElementById('modalRight');
  if (!overlay) return;

  // Sync current form values to guided fields
  const gTitle = document.getElementById('guidedTitle');
  if (gTitle) gTitle.value = document.getElementById('taskTitle')?.value || '';
  const gDate = document.getElementById('guidedDate');
  if (gDate) gDate.value = document.getElementById('taskDate')?.value || '';
  const gPrio = document.getElementById('guidedPriority');
  if (gPrio) gPrio.value = document.getElementById('taskPriority')?.value || '';
  // Populate guided category from main category
  const gCat = document.getElementById('guidedCategory');
  const mainCat = document.getElementById('taskCategory');
  if (gCat && mainCat) {
    gCat.innerHTML = mainCat.innerHTML;
    gCat.value = mainCat.value;
  }
  const gDesc = document.getElementById('guidedDescription');
  if (gDesc) gDesc.value = document.getElementById('taskDescription')?.value || '';
  const gTime = document.getElementById('guidedStartTime');
  if (gTime) gTime.value = document.getElementById('taskStartTime')?.value || '';
  const gDur = document.getElementById('guidedDuration');
  if (gDur) gDur.value = document.getElementById('taskDurationEstimated')?.value || '';

  // Hide main, show guided
  if (main) gsap.to(main, { opacity: 0, x: -20, duration: 0.2, onComplete: () => main.style.display = 'none' });
  if (colToggle) colToggle.style.display = 'none';
  if (right) gsap.to(right, { width: 0, duration: 0.2 });

  overlay.style.display = 'flex';
  gsap.fromTo(overlay, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'power2.out' });

  _guidedStep = 0;
  _showGuidedStep(0);
  setTimeout(() => document.getElementById('guidedTitle')?.focus(), 100);
}

export function closeGuidedCards() {
  const overlay = document.getElementById('guidedOverlay');
  const main = document.querySelector('.modal-main');

  // Sync guided values back to main form
  _syncGuidedToMain();

  if (overlay) gsap.to(overlay, { opacity: 0, scale: 0.96, duration: 0.2, onComplete: () => overlay.style.display = 'none' });
  if (main) {
    main.style.display = '';
    gsap.to(main, { opacity: 1, x: 0, duration: 0.3, ease: 'power2.out' });
  }
  // Re-show toggle if title has content
  const toggle = document.getElementById('modalColToggle');
  if (toggle && document.getElementById('taskTitle')?.value.trim()) toggle.style.display = '';
}

export function guidedNext() {
  if (_guidedStep >= 3) return;
  // Validate title on step 0
  if (_guidedStep === 0) {
    const t = document.getElementById('guidedTitle')?.value.trim();
    if (!t) { document.getElementById('guidedTitle')?.focus(); return; }
  }
  _guidedStep++;
  _showGuidedStep(_guidedStep);
}

export function guidedBack() {
  if (_guidedStep <= 0) return;
  _guidedStep--;
  _showGuidedStep(_guidedStep);
}

export function guidedFinish() {
  _syncGuidedToMain();
  // Trigger save via existing save button click
  document.getElementById('saveTask')?.click();
}

export function guidedSelectWhen(mode) {
  document.querySelectorAll('.guided-when-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  const dateRow = document.getElementById('guidedDateRow');
  if (dateRow) dateRow.style.display = mode === 'date' ? '' : 'none';
  // Also sync to main form schedule mode
  const opts = document.querySelectorAll('.schedule-mode-option');
  opts.forEach(o => o.classList.toggle('active', o.dataset.mode === mode));
  state.setScheduleMode(mode);
  const dateGroup = document.getElementById('dateGroup');
  if (dateGroup) dateGroup.style.display = mode === 'date' ? '' : 'none';
}

export function guidedSetToday() {
  const d = document.getElementById('guidedDate');
  if (d) d.value = DS(today());
}

export function guidedSetTomorrow() {
  const d = document.getElementById('guidedDate');
  const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
  if (d) d.value = DS(tmr);
}

function _showGuidedStep(step) {
  const cards = document.querySelectorAll('.guided-card');
  cards.forEach((c, i) => {
    if (i === step) {
      c.classList.add('active');
      gsap.fromTo(c, { opacity: 0, x: 30 }, { opacity: 1, x: 0, duration: 0.3, ease: 'power2.out' });
    } else {
      c.classList.remove('active');
    }
  });
  const indicator = document.getElementById('guidedStepIndicator');
  if (indicator) indicator.textContent = `${step + 1} / 4`;
}

function _syncGuidedToMain() {
  const map = [
    ['guidedTitle', 'taskTitle'],
    ['guidedDate', 'taskDate'],
    ['guidedPriority', 'taskPriority'],
    ['guidedCategory', 'taskCategory'],
    ['guidedDescription', 'taskDescription'],
    ['guidedStartTime', 'taskStartTime'],
    ['guidedDuration', 'taskDurationEstimated'],
  ];
  map.forEach(([gId, mId]) => {
    const g = document.getElementById(gId);
    const m = document.getElementById(mId);
    if (g && m) m.value = g.value;
  });
  // Sync priority to state
  const p = document.getElementById('taskPriority')?.value || '';
  selectPriority(p);
  // Ensure context fields are revealed
  const ctx = document.getElementById('contextFields');
  if (ctx && document.getElementById('taskTitle')?.value.trim()) {
    _contextRevealed = true;
    gsap.set(ctx, { maxHeight: 2000, opacity: 1 });
  }
}
