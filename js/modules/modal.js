// ════════════════════════════════════════════════════════
//  MODAL MANAGEMENT
// ════════════════════════════════════════════════════════

import { DS, today, parseDS, esc, daysInMonth, firstDayOfMonth } from './utils.js';
import { getTodosForDate, addTask, getSuggestions, getRecentTasks } from './calendar.js';
import * as state from './state.js';
import { getSuggestedTasks, getCategories, saveCategories, CATEGORY_COLORS } from './admin.js';
import { getProjects, saveProjects } from './projectManager.js';
import { pushFirestoreNow } from './storage.js';

// ─── Smooth reveal / hide helpers ──────────────────────────────────────────

function _slideIn(el) {
  if (!el || (el.style.display !== 'none' && el.offsetHeight > 0 && !el._hiding)) return;
  if (el._hiding) { el._hiding = false; gsap.killTweensOf(el); }
  el.style.display = '';
  el.style.overflow = 'clip';
  gsap.fromTo(el,
    { height: 0, opacity: 0 },
    { height: 'auto', opacity: 1, duration: 0.3, ease: 'power2.out',
      onComplete: () => { el.style.overflow = ''; el.style.height = ''; } }
  );
}

function _slideOut(el) {
  if (!el || el.style.display === 'none') return;
  el._hiding = true;
  el.style.overflow = 'clip';
  gsap.to(el,
    { height: 0, opacity: 0, duration: 0.2, ease: 'power2.in',
      onComplete: () => { el.style.display = 'none'; el.style.overflow = ''; el.style.height = ''; el._hiding = false; } }
  );
}

// ─── Duration stepper ──────────────────────────────────────────────────────

function _formatDuration(minutes) {
  const m = parseInt(minutes);
  if (!m || m <= 0) return '—';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}`;
}

function _syncDurationStepper(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const stepper = input.closest('.duration-stepper');
  if (!stepper) return;
  const display = stepper.querySelector('.dur-display');
  if (!display) return;
  const val = parseInt(input.value) || 0;
  display.textContent = _formatDuration(val);
  display.classList.toggle('is-empty', !val);
}

document.addEventListener('click', e => {
  const btn = e.target.closest('.dur-btn');
  if (!btn) return;
  const stepper = btn.closest('.duration-stepper');
  if (!stepper) return;
  const inputId = stepper.dataset.target;
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPlus = btn.classList.contains('dur-btn--plus');
  const current = parseInt(input.value) || 0;
  const step = (current > 0 && current < 60) ? 15 : (current >= 60 ? 30 : 15);
  let next = current + (isPlus ? step : -step);
  if (isPlus && current > 0 && current < 60 && next >= 60) next = 60;
  if (!isPlus && current >= 60 && next < 60) next = 45;
  next = Math.max(0, next);
  input.value = next || '';
  _syncDurationStepper(inputId);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});

// ─── Date trigger button ───────────────────────────────────────────────────

const _MONTHS_SHORT = ['jan','fév','mar','avr','mai','juin','juil','août','sept','oct','nov','déc'];

function _syncDateBtn() {
  const input = document.getElementById('taskDate');
  const btn   = document.getElementById('taskDateBtn');
  if (!input || !btn) return;
  const val = input.value;
  if (!val) { btn.textContent = 'DATE'; btn.classList.add('is-empty'); return; }
  const d = parseDS(val);
  if (!d) { btn.textContent = 'DATE'; btn.classList.add('is-empty'); return; }
  btn.classList.remove('is-empty');
  if (val === DS(new Date())) { btn.textContent = "Auj."; return; }
  btn.textContent = `${d.getDate()} ${_MONTHS_SHORT[d.getMonth()]}`;
}

document.addEventListener('change', e => { if (e.target.id === 'taskDate') _syncDateBtn(); });

// ─── Day period (Moment) button builder ───────────────────────────────────

const _PERIOD_ICONS = {
  'morning':   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
  'afternoon': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 18a5 5 0 0 0-10 0"/><line x1="12" y1="9" x2="12" y2="2"/><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/><line x1="1" y1="18" x2="3" y2="18"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/></svg>',
  'evening':   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
};
const _PERIOD_LABELS = { 'morning': 'Matin', 'afternoon': 'Après-midi', 'evening': 'Soir' };

function _dayPeriodHTML(currentPeriod) {
  const periods = ['morning', 'afternoon', 'evening'];
  const buttons = periods.map(p =>
    `<button type="button" class="day-period-btn${currentPeriod === p ? ' active' : ''}" data-period="${p}" onclick="window.app.toggleDayPeriod('${p}')">${_PERIOD_ICONS[p]}<span>${_PERIOD_LABELS[p]}</span></button>`
  ).join('');
  return `<label class="form-label">Moment <span class="timing-flex-hint" title="Matin, après-midi ou soir — aide à planifier sans fixer d'heure précise">?</span></label><div class="day-period-select">${buttons}<input type="hidden" id="taskDayPeriod" value="${currentPeriod}"></div>`;
}

// ─── Modal subtasks ───────────────────────────────────────────────────────

let _modalSubtasks = [];

export function getModalSubtasks() { return _modalSubtasks; }

function _renderModalSubtasks() {
  const el = document.getElementById('modalSubtaskList');
  if (!el) return;
  el.innerHTML = _modalSubtasks.map(s => `
    <div class="modal-subtask-item">
      <div class="subtask-check${s.completed ? ' done' : ''}" onclick="window.app.toggleModalSubtask('${s.id}')"></div>
      <span class="subtask-title${s.completed ? ' done' : ''}" onclick="window.app.editModalSubtask(this,'${s.id}')">${esc(s.title)}</span>
      <button class="subtask-del" onclick="window.app.removeModalSubtask('${s.id}')">×</button>
    </div>`).join('')
  + `<button class="subtask-add-btn" onclick="window.app.addModalSubtaskInline()">+ sous-tâche</button>`;
}

export function populateModalSubtasks(subtasks) {
  _modalSubtasks = subtasks ? JSON.parse(JSON.stringify(subtasks)) : [];
  _renderModalSubtasks();
}

export function toggleModalSubtask(stid) {
  const s = _modalSubtasks.find(x => x.id === stid);
  if (s) { s.completed = !s.completed; _renderModalSubtasks(); }
}

export function removeModalSubtask(stid) {
  _modalSubtasks = _modalSubtasks.filter(x => x.id !== stid);
  _renderModalSubtasks();
}

export function addModalSubtask(title) {
  _modalSubtasks.push({ id: Date.now().toString(), title, completed: false });
  _renderModalSubtasks();
}

export function editModalSubtask(el, stid) {
  const s = _modalSubtasks.find(x => x.id === stid);
  if (!s) return;
  el.contentEditable = 'true';
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  const save = () => {
    el.contentEditable = 'false';
    const newTitle = el.textContent.trim();
    if (newTitle) s.title = newTitle;
    else el.textContent = esc(s.title);
  };
  el.addEventListener('blur', save, { once: true });
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
    if (e.key === 'Escape') { el.textContent = esc(s.title); el.contentEditable = 'false'; }
  }, { once: true });
}

export function addModalSubtaskInline() {
  const list = document.getElementById('modalSubtaskList');
  if (!list) return;
  const addBtn = list.querySelector('.subtask-add-btn');
  if (!addBtn) return;
  const input = document.createElement('input');
  input.className = 'subtask-new-input';
  input.placeholder = 'Nouvelle sous-tâche…';
  input.autocomplete = 'off';
  let saved = false;
  const confirm = () => {
    if (saved) return;
    saved = true;
    const title = input.value.trim();
    input.remove();
    addBtn.style.display = '';
    if (title) { addModalSubtask(title); }
  };
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); confirm(); }
    if (e.key === 'Escape') { saved = true; input.remove(); addBtn.style.display = ''; }
  });
  input.addEventListener('blur', confirm);
  addBtn.style.display = 'none';
  list.appendChild(input);
  input.focus();
}

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
    categoryIds: [..._selectedCategoryIds],
    projectIds: [..._selectedProjectIds],
    intentionIds: [..._selectedIntentionIds],
    recurrence: state.selectedRecurrence,
    dayPeriod: document.getElementById('taskDayPeriod')?.value || '',
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
  _syncDateBtn();
  document.getElementById('taskStartTime').value = '';
  document.getElementById('taskEndTime').value = '';
  document.getElementById('taskFlexibleTime').checked = false;
  document.getElementById('taskDurationEstimated').value = '';
  document.getElementById('taskDurationReal').value = '';
  _syncDurationStepper('taskDurationEstimated');
  _syncDurationStepper('taskDurationReal');
  selectPriority('');
  populateCategoryTags([]);
  populateProjectTags([]);
  populateIntentionTags([]);
  switchTagTab('categories');
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
  _syncDateBtn();
  if (d.startTime) document.getElementById('taskStartTime').value = d.startTime;
  if (d.endTime) document.getElementById('taskEndTime').value = d.endTime;
  if (d.flexibleTime) document.getElementById('taskFlexibleTime').checked = true;
  if (d.durationEstimated) document.getElementById('taskDurationEstimated').value = d.durationEstimated;
  if (d.durationReal) document.getElementById('taskDurationReal').value = d.durationReal;
  _syncDurationStepper('taskDurationEstimated');
  _syncDurationStepper('taskDurationReal');
  if (d.priority !== undefined) selectPriority(d.priority);
  if (d.categoryIds?.length) populateCategoryTags(d.categoryIds);
  if (d.projectIds?.length) populateProjectTags(d.projectIds);
  if (d.intentionIds?.length) populateIntentionTags(d.intentionIds);
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
  if (d.dayPeriod) window.app?.selectDayPeriod(d.dayPeriod);
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
   ['taskDurationEstimated','input'],['taskDurationReal','input'],['taskCategory','change'],['taskProject','change']
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

export function selectBigMode(mode) {
  // Update button highlights with punch animation
  document.querySelectorAll('.schedule-mode-option').forEach(o => {
    const isActive = o.dataset.mode === mode;
    o.classList.toggle('active', isActive);
    if (isActive) gsap.fromTo(o, { scale: 0.92 }, { scale: 1, duration: 0.25, ease: 'back.out(2)' });
  });

  const dateTimeGroup = document.getElementById('dateTimeGroup');
  const recSubOptions = document.getElementById('recSubOptions');
  const dateGroup = document.getElementById('dateGroup');

  if (mode === 'today' || mode === 'tomorrow') {
    // Quick-set date to today or tomorrow, then show date fields
    const d = new Date();
    if (mode === 'tomorrow') d.setDate(d.getDate() + 1);
    const dateInput = document.getElementById('taskDate');
    if (dateInput) { dateInput.value = d.toISOString().slice(0, 10); _syncDateBtn(); }
    state.setScheduleMode('date');
    state.setSelectedRecurrence('none');
    const recSel0 = document.getElementById('taskRecurrence');
    if (recSel0) recSel0.value = 'none';
    _slideIn(dateTimeGroup);
    if (dateGroup) dateGroup.style.display = '';
    _slideOut(recSubOptions);
    const detail0 = document.getElementById('recDetail');
    if (detail0) {
      const curPeriod = document.getElementById('taskDayPeriod')?.value || '';
      detail0.innerHTML = _dayPeriodHTML(curPeriod);
    }
  } else if (mode === 'date') {
    state.setScheduleMode('date');
    state.setSelectedRecurrence('none');
    const recSel = document.getElementById('taskRecurrence');
    if (recSel) recSel.value = 'none';
    _slideIn(dateTimeGroup);
    if (dateGroup) dateGroup.style.display = '';
    _slideOut(recSubOptions);
    // Show day period for "none" recurrence
    const detail = document.getElementById('recDetail');
    if (detail) {
      const curPeriod = document.getElementById('taskDayPeriod')?.value || '';
      detail.innerHTML = _dayPeriodHTML(curPeriod);
    }
  } else if (mode === 'recurring') {
    state.setScheduleMode('date');
    _slideIn(dateTimeGroup);
    _slideIn(recSubOptions);
    // Highlight current recurrence sub-option
    const cur = state.selectedRecurrence === 'none' ? 'daily' : state.selectedRecurrence;
    document.querySelectorAll('.rec-sub-option').forEach(o =>
      o.classList.toggle('active', o.dataset.rec === cur)
    );
    // Auto-select daily if none
    if (state.selectedRecurrence === 'none') selectRecurrence('daily');
  } else if (mode === 'inbox') {
    state.setScheduleMode('inbox');
    state.setSelectedRecurrence('none');
    const recSel = document.getElementById('taskRecurrence');
    if (recSel) recSel.value = 'none';
    _slideOut(dateTimeGroup);
  } else if (mode === 'backlog') {
    state.setScheduleMode('backlog');
    state.setSelectedRecurrence('none');
    const recSel = document.getElementById('taskRecurrence');
    if (recSel) recSel.value = 'none';
    _slideOut(dateTimeGroup);
    if (recSubOptions) recSubOptions.style.display = 'none';
  }
  _scheduleDraftSave();
}

// ─── Tag picker state ────────────────────────────────────────────────
let _selectedCategoryIds = [];
let _selectedProjectIds = [];
let _selectedIntentionIds = [];

export function getSelectedCategoryIds() { return _selectedCategoryIds; }
export function getSelectedProjectIds() { return _selectedProjectIds; }
export function getSelectedIntentionIds() { return _selectedIntentionIds; }

function _renderTagPicker(containerId, items, selectedIds, toggleFn, addBtnLabel, addFn) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const pills = items.map(item => {
    const sel = selectedIds.includes(item.id);
    const color = item.color || '#888';
    const label = escapeCategory(item.name || item.title || '');
    const style = sel ? `background:${color};border-color:${color};color:#fff` : '';
    const dotStyle = sel ? '' : `style="background:${color}"`;
    return `<span class="tag-pill${sel ? ' selected' : ''}" data-id="${item.id}" style="${style}" onclick="${toggleFn}('${item.id}')">${sel ? '' : `<span class="tag-pill-dot" ${dotStyle}></span>`}${label}</span>`;
  }).join('');
  const addBtn = addFn ? `<span class="tag-pill-add" onclick="${addFn}">+ ${addBtnLabel}</span>` : '';
  el.innerHTML = pills + addBtn;
}

function populateCategoryTags(selectedIds) {
  _selectedCategoryIds = selectedIds || [];
  _renderTagPicker('taskCategoryTags', getCategories(), _selectedCategoryIds,
    'window.app.toggleCategoryTag', 'Ajouter', 'window.app.toggleNewCatRow()');
}

function populateProjectTags(selectedIds) {
  _selectedProjectIds = selectedIds || [];
  _renderTagPicker('taskProjectTags', getProjects(), _selectedProjectIds,
    'window.app.toggleProjectTag', 'Ajouter', 'window.app.toggleNewProjectRow()');
}

function populateIntentionTags(selectedIds) {
  _selectedIntentionIds = selectedIds || [];
  let intentions = [];
  try { intentions = JSON.parse(localStorage.getItem('intentions') || '[]'); } catch { intentions = []; }
  _renderTagPicker('taskIntentionTags', intentions.map(i => ({ ...i, name: i.codename || i.title })), _selectedIntentionIds,
    'window.app.toggleIntentionTag', 'Ajouter', 'window.app.toggleNewIntentionRow()');
}

export function toggleCategoryTag(id) {
  const idx = _selectedCategoryIds.indexOf(id);
  if (idx >= 0) _selectedCategoryIds.splice(idx, 1); else _selectedCategoryIds.push(id);
  populateCategoryTags(_selectedCategoryIds);
  _scheduleDraftSave();
}

export function toggleProjectTag(id) {
  const idx = _selectedProjectIds.indexOf(id);
  if (idx >= 0) _selectedProjectIds.splice(idx, 1); else _selectedProjectIds.push(id);
  populateProjectTags(_selectedProjectIds);
  _scheduleDraftSave();
}

export function toggleIntentionTag(id) {
  const idx = _selectedIntentionIds.indexOf(id);
  if (idx >= 0) _selectedIntentionIds.splice(idx, 1); else _selectedIntentionIds.push(id);
  populateIntentionTags(_selectedIntentionIds);
  _scheduleDraftSave();
}

export function toggleNewProjectRow() {
  const row = document.getElementById('newProjectRow');
  if (!row) return;
  row.style.display = row.style.display === 'none' ? '' : 'none';
  if (row.style.display !== 'none') document.getElementById('newProjectInput')?.focus();
}

export function toggleNewIntentionRow() {
  const row = document.getElementById('newIntentionRow');
  if (!row) return;
  row.style.display = row.style.display === 'none' ? '' : 'none';
  if (row.style.display !== 'none') document.getElementById('newIntentionInput')?.focus();
}

export function addIntentionInline() {
  const input = document.getElementById('newIntentionInput');
  const title = input?.value.trim();
  if (!title) return;
  let intentions = [];
  try { intentions = JSON.parse(localStorage.getItem('intentions') || '[]'); } catch { intentions = []; }
  const colors = ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316'];
  const color = colors[intentions.length % colors.length];
  const id = Date.now().toString();
  intentions.push({ id, title, color, description: '', codename: '' });
  localStorage.setItem('intentions', JSON.stringify(intentions));
  pushFirestoreNow();
  input.value = '';
  document.getElementById('newIntentionRow').style.display = 'none';
  _selectedIntentionIds.push(id);
  populateIntentionTags(_selectedIntentionIds);
}

export function switchTagTab(tab) {
  document.querySelectorAll('.tag-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.tag-tab-panel').forEach(p => p.style.display = p.dataset.tab === tab ? '' : 'none');
}

// Back-compat wrappers (used by openModal / openEditModal)
function populateCategorySelect(selectedId) { populateCategoryTags(selectedId ? [selectedId] : []); }
function populateProjectSelect(selectedId) { populateProjectTags(selectedId ? [selectedId] : []); }
function populateIntentionSelect(selectedId) { populateIntentionTags(selectedId ? [selectedId] : []); }

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
  _selectedCategoryIds.push(id);
  populateCategoryTags(_selectedCategoryIds);
}

export function addProjectInline() {
  const input = document.getElementById('newProjectInput');
  const name = input?.value.trim();
  if (!name) return;
  const projects = getProjects();
  const color = CATEGORY_COLORS[projects.length % CATEGORY_COLORS.length];
  const id = Date.now().toString();
  projects.push({ id, name, color });
  saveProjects(projects);
  input.value = '';
  document.getElementById('newProjectRow').style.display = 'none';
  _selectedProjectIds.push(id);
  populateProjectTags(_selectedProjectIds);
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
  const _deleteBtn = document.getElementById('deleteFromEditBtn');
  if (_deleteBtn) _deleteBtn.style.display = 'none';
  const _completeWrap = document.getElementById('completeFromEditWrap');
  if (_completeWrap) _completeWrap.style.display = 'none';
  const _completeMenu = document.getElementById('completeMenu');
  if (_completeMenu) _completeMenu.style.display = 'none';
  const _guidedPill = document.getElementById('guidedPillBtn');
  if (_guidedPill) _guidedPill.style.display = '';
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskDescription').value = '';
  document.getElementById('taskDate').value = DS(date);
  _syncDateBtn();
  document.getElementById('taskStartTime').value = '';
  document.getElementById('taskEndTime').value = '';
  document.getElementById('taskFlexibleTime').checked = false;
  document.getElementById('taskDurationEstimated').value = '';
  document.getElementById('taskDurationReal').value = '';
  _syncDurationStepper('taskDurationEstimated');
  _syncDurationStepper('taskDurationReal');
  const durationRealField = document.getElementById('durationRealField');
  if (durationRealField) durationRealField.style.display = 'none';
  const recSel = document.getElementById('taskRecurrence');
  if (recSel) recSel.value = 'none';
  document.getElementById('recDetail').innerHTML = '';
  // Big mode UI
  const bigMode = scheduleMode === 'date' ? 'date' : scheduleMode;
  document.querySelectorAll('.schedule-mode-option').forEach(o => o.classList.toggle('active', o.dataset.mode === bigMode));
  const scheduleModeGroup = document.getElementById('scheduleModeGroup');
  if (scheduleModeGroup) scheduleModeGroup.style.display = '';
  const recSubOptions = document.getElementById('recSubOptions');
  if (recSubOptions) recSubOptions.style.display = 'none';
  const dateTimeGroup = document.getElementById('dateTimeGroup');
  if (dateTimeGroup) dateTimeGroup.style.display = (scheduleMode === 'inbox' || scheduleMode === 'backlog') ? 'none' : '';
  const dateGroup = document.getElementById('dateGroup');
  if (dateGroup) dateGroup.style.display = scheduleMode === 'date' ? '' : 'none';
  populateCategoryTags([]);
  populateProjectTags([]);
  populateIntentionTags([]);
  switchTagTab('categories');
  // Subtasks — hidden for new tasks
  const _stSection = document.getElementById('modalSubtaskSection');
  if (_stSection) _stSection.style.display = 'none';
  populateModalSubtasks([]);
  // Restore draft (new tasks only)
  const draftBanner = document.getElementById('draftBanner');
  const hadDraft = _tryRestoreDraft();
  if (draftBanner) draftBanner.style.display = hadDraft ? '' : 'none';
  const modalBox = document.getElementById('modalOverlay').querySelector('.modal');
  // Context fields — hidden until title has content
  const ctxFields = document.getElementById('contextFields');
  if (ctxFields) {
    if (hadDraft && document.getElementById('taskTitle').value.trim()) {
      gsap.set(ctxFields, { maxHeight: 'none', overflow: 'visible', opacity: 1 });
    } else {
      gsap.set(ctxFields, { maxHeight: 0, overflow: 'hidden', opacity: 0 });
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
  const _deleteBtn = document.getElementById('deleteFromEditBtn');
  if (_deleteBtn) { _deleteBtn.dataset.id = id; _deleteBtn.dataset.date = dateStr || ''; _deleteBtn.style.display = ''; }
  const _completeWrap = document.getElementById('completeFromEditWrap');
  if (_completeWrap) {
    _completeWrap.style.display = t.completed ? 'none' : '';
    _completeWrap.dataset.id = id;
    _completeWrap.dataset.date = t.date || dateStr || '';
  }
  const _completeMenu = document.getElementById('completeMenu');
  if (_completeMenu) _completeMenu.style.display = 'none';
  // Hide "original date" option when task has no date
  const _completeOrigBtn = document.getElementById('completeOrigDate');
  if (_completeOrigBtn) _completeOrigBtn.style.display = (t.date || dateStr) ? '' : 'none';
  const _guidedPill = document.getElementById('guidedPillBtn');
  if (_guidedPill) _guidedPill.style.display = 'none';
  document.getElementById('taskTitle').value = t.title;
  document.getElementById('taskDescription').value = t.description || '';
  document.getElementById('taskStartTime').value = t.startTime || '';
  document.getElementById('taskEndTime').value = t.endTime || '';
  document.getElementById('taskFlexibleTime').checked = t.flexibleTime || false;
  document.getElementById('taskDurationEstimated').value = t.durationEstimated || '';
  document.getElementById('taskDurationReal').value = t.durationReal || '';
  _syncDurationStepper('taskDurationEstimated');
  _syncDurationStepper('taskDurationReal');
  const durationRealField = document.getElementById('durationRealField');
  if (durationRealField) durationRealField.style.display = '';
  populateCategoryTags(t.categoryIds || (t.categoryId ? [t.categoryId] : []));
  populateProjectTags(t.projectIds || (t.projectId ? [t.projectId] : []));
  populateIntentionTags(t.intentionIds || (t.intentionId ? [t.intentionId] : []));
  selectPriority(t.priority || '');

  // Big mode UI
  const isRecurring = t.recurrence && t.recurrence !== 'none';
  const bigMode = isRecurring ? 'recurring' : schedMode;
  document.querySelectorAll('.schedule-mode-option').forEach(o => o.classList.toggle('active', o.dataset.mode === bigMode));
  const scheduleModeGroup = document.getElementById('scheduleModeGroup');
  const recSubOptions = document.getElementById('recSubOptions');
  const dateTimeGroup = document.getElementById('dateTimeGroup');

  // Set recurrence UI
  const recSel2 = document.getElementById('taskRecurrence');
  if (recSel2) recSel2.value = state.selectedRecurrence;
  const dateGroup = document.getElementById('dateGroup');
  const detail = document.getElementById('recDetail');

  if (schedMode === 'inbox' || schedMode === 'backlog') {
    // Inbox/Backlog: hide date/time/moment
    if (dateTimeGroup) dateTimeGroup.style.display = 'none';
    if (recSubOptions) recSubOptions.style.display = 'none';
  } else if (isRecurring) {
    // Recurring: show dateTimeGroup, show rec sub-options, hide dateGroup
    if (dateTimeGroup) dateTimeGroup.style.display = '';
    if (recSubOptions) {
      recSubOptions.style.display = '';
      document.querySelectorAll('.rec-sub-option').forEach(o =>
        o.classList.toggle('active', o.dataset.rec === state.selectedRecurrence)
      );
    }
    if (state.selectedRecurrence === 'daily') {
      dateGroup.style.display = 'none';
      detail.innerHTML = _dayPeriodHTML(t.dayPeriod || '');
    } else if (state.selectedRecurrence === 'weekly') {
      dateGroup.style.display = 'none';
      detail.innerHTML = `<div class="day-checkboxes" id="weekDayBoxes">
        ${state.DAYS.map((d,i) => { const dow=(i+1)%7; return `<div class="day-checkbox${state.selectedWeekDays.includes(dow)?' selected':''}" data-day="${dow}"
          onclick="window.app.toggleWeekDay(${dow})">${d[0]}</div>`; }).join('')}
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
  } else {
    // Date mode: show dateTimeGroup, hide rec sub-options
    if (dateTimeGroup) dateTimeGroup.style.display = '';
    if (recSubOptions) recSubOptions.style.display = 'none';
    dateGroup.style.display = '';
    document.getElementById('taskDate').value = t.date || dateStr || '';
    _syncDateBtn();
    detail.innerHTML = _dayPeriodHTML(t.dayPeriod || '');
  }

  const modalBox = document.getElementById('modalOverlay').querySelector('.modal');
  // Context fields — immediately visible in edit mode
  const ctxFields = document.getElementById('contextFields');
  if (ctxFields) gsap.set(ctxFields, { maxHeight: 'none', overflow: 'visible', opacity: 1 });
  switchTagTab('categories');
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
  // Subtasks
  const subtaskSection = document.getElementById('modalSubtaskSection');
  if (subtaskSection) subtaskSection.style.display = '';
  populateModalSubtasks(t.subtasks || []);
  setTimeout(() => document.getElementById('taskTitle').focus(), 50);
}

export function selectRecurrence(rec) {
  state.setSelectedRecurrence(rec);
  const sel = document.getElementById('taskRecurrence');
  if (sel) sel.value = rec;
  // Highlight rec sub-option buttons with punch
  document.querySelectorAll('.rec-sub-option').forEach(o => {
    const isActive = o.dataset.rec === rec;
    o.classList.toggle('active', isActive);
    if (isActive) gsap.fromTo(o, { scale: 0.9 }, { scale: 1, duration: 0.25, ease: 'back.out(2)' });
  });
  _scheduleDraftSave();
  const dateGroup = document.getElementById('dateGroup');
  const detail = document.getElementById('recDetail');
  const scheduleModeGroup = document.getElementById('scheduleModeGroup');

  if (rec==='none') {
    dateGroup.style.display = '';
    detail.innerHTML = _dayPeriodHTML(document.getElementById('taskDayPeriod')?.value || '');
  } else if (rec==='daily') {
    dateGroup.style.display = 'none';
    detail.innerHTML = _dayPeriodHTML(document.getElementById('taskDayPeriod')?.value || '');
  } else if (rec==='weekly') {
    dateGroup.style.display = 'none';
    if (!state.selectedWeekDays.length) {
      state.setSelectedWeekDays([state.navDate.getDay()]);
    }
    detail.innerHTML = `<div class="day-checkboxes" id="weekDayBoxes">
      ${state.DAYS.map((d,i) => { const dow=(i+1)%7; return `<div class="day-checkbox${state.selectedWeekDays.includes(dow)?' selected':''}" data-day="${dow}"
        onclick="window.app.toggleWeekDay(${dow})">${d[0]}</div>`; }).join('')}
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
  _scheduleDraftSave();
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

// ─── Right column (removed) ───────────────────────────────────────────────

export function toggleModalRight() { /* panel removed */ }

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

  modal.addEventListener('pointerup', () => { active = false; }, { passive: true });
}

function _showRecError(msg) {
  const recDetail = document.getElementById('recDetail') || document.getElementById('guidedRecDetail');
  if (!recDetail) return;
  let el = recDetail.parentElement.querySelector('.rec-error');
  if (!el) {
    el = document.createElement('div');
    el.className = 'rec-error';
    el.style.cssText = 'color:#ef4444;font-size:0.8rem;margin-top:4px;';
    recDetail.after(el);
  }
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

export function saveTaskLogic(todos) {
  const title = document.getElementById('taskTitle').value.trim();
  if (!title) {
    document.getElementById('taskTitle').focus();
    return true; // error
  }

  const categoryIds       = _selectedCategoryIds.length ? [..._selectedCategoryIds] : undefined;
  const projectIds        = _selectedProjectIds.length ? [..._selectedProjectIds] : undefined;
  const intentionIds      = _selectedIntentionIds.length ? [..._selectedIntentionIds] : undefined;
  const priority          = state.selectedPriority || undefined;
  const description       = document.getElementById('taskDescription').value.trim() || undefined;
  const startTime         = document.getElementById('taskStartTime')?.value || undefined;
  const endTime           = document.getElementById('taskEndTime')?.value || undefined;
  const flexibleTime      = document.getElementById('taskFlexibleTime')?.checked || undefined;
  const durationEstimated = document.getElementById('taskDurationEstimated')?.value ? parseInt(document.getElementById('taskDurationEstimated').value) : undefined;
  const durationReal      = document.getElementById('taskDurationReal')?.value ? parseInt(document.getElementById('taskDurationReal').value) : undefined;

  const dayPeriod = (state.selectedRecurrence === 'daily' || state.selectedRecurrence === 'none')
    ? (document.getElementById('taskDayPeriod')?.value || undefined)
    : undefined;

  const data = {
    title,
    recurrence: state.selectedRecurrence,
    categoryIds,
    projectIds,
    intentionIds,
    priority,
    description,
    startTime,
    endTime,
    flexibleTime: flexibleTime || undefined,
    durationEstimated,
    durationReal,
    dayPeriod: dayPeriod || undefined,
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
    if (state.selectedWeekDays.length===0) { _showRecError(state.T.selectWeekdayError); return true; }
    data.recDays = [...state.selectedWeekDays];
  } else if (state.selectedRecurrence==='monthly') {
    if (!state.selectedMonthLastDay && state.selectedMonthDays.length === 0) {
      _showRecError(state.T.selectMonthDayError || 'Please select at least one day.');
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
      delete t.durationEstimated; delete t.durationReal; delete t.dayPeriod;
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
      if (data.dayPeriod) t.dayPeriod = data.dayPeriod;
      t.categoryIds    = data.categoryIds;
      t.projectIds     = data.projectIds;
      t.intentionIds   = data.intentionIds;
      delete t.categoryId; delete t.projectId; delete t.intentionId;
      t.priority    = data.priority;
      t.description = data.description;
      t.subtasks    = getModalSubtasks();
      t.updatedAt   = Date.now();
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
    } else if (e.key === 'Enter' && box.classList.contains('hidden')) {
      e.preventDefault();
      document.getElementById('saveTask')?.click();
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
  if (!title || !ctx) return;

  // If already has content (edit mode or draft), mark as revealed
  if (title.value.trim()) _contextRevealed = true;

  _contextRevealHandler = () => {
    const hasContent = title.value.trim().length > 0;
    if (hasContent && !_contextRevealed) {
      _contextRevealed = true;
      gsap.fromTo(ctx,
        { maxHeight: 0, opacity: 0 },
        { maxHeight: 2000, opacity: 1, duration: 0.35, ease: 'expo.out',
          onComplete: () => { ctx.style.maxHeight = 'none'; ctx.style.overflow = 'visible'; } }
      );
    } else if (!hasContent && _contextRevealed) {
      _contextRevealed = false;
      gsap.to(ctx, { maxHeight: 0, opacity: 0, duration: 0.2, ease: 'power3.in',
        onComplete: () => { ctx.style.overflow = 'hidden'; } });
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

const GUIDED_TOTAL_STEPS = 4;
let _guidedStep = 0;
let _guidedKeyHandler = null;

export function openGuidedCards() {
  const overlay = document.getElementById('guidedOverlay');
  const main = document.querySelector('.modal-main');
  if (!overlay) return;

  // Sync current form values to guided fields
  const gTitle = document.getElementById('guidedTitle');
  if (gTitle) gTitle.value = document.getElementById('taskTitle')?.value || '';
  const gDate = document.getElementById('guidedDate');
  if (gDate) gDate.value = document.getElementById('taskDate')?.value || '';
  const gPrio = document.getElementById('guidedPriority');
  if (gPrio) gPrio.value = document.getElementById('taskPriority')?.value || '';
  const gRec = document.getElementById('guidedRecurrence');
  if (gRec) gRec.value = state.selectedRecurrence || 'none';
  // Populate guided category from main category
  const gCat = document.getElementById('guidedCategory');
  const mainCat = document.getElementById('taskCategory');
  if (gCat && mainCat) {
    gCat.innerHTML = mainCat.innerHTML;
    gCat.value = mainCat.value;
  }
  // Populate guided project from main project
  const gProj = document.getElementById('guidedProject');
  const mainProj = document.getElementById('taskProject');
  if (gProj && mainProj) {
    gProj.innerHTML = mainProj.innerHTML;
    gProj.value = mainProj.value;
  }
  const gDesc = document.getElementById('guidedDescription');
  if (gDesc) gDesc.value = document.getElementById('taskDescription')?.value || '';
  const gTime = document.getElementById('guidedStartTime');
  if (gTime) gTime.value = document.getElementById('taskStartTime')?.value || '';
  const gDur = document.getElementById('guidedDuration');
  if (gDur) gDur.value = document.getElementById('taskDurationEstimated')?.value || '';
  const gFlex = document.getElementById('guidedFlexibleTime');
  if (gFlex) gFlex.checked = document.getElementById('taskFlexibleTime')?.checked || false;

  // Set correct destination based on current scheduleMode
  const currentMode = state.scheduleMode || 'inbox';
  document.querySelectorAll('.guided-dest-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === currentMode));
  const guidedDateExtras = document.getElementById('guidedDateExtras');
  if (guidedDateExtras) guidedDateExtras.style.display = currentMode === 'date' ? '' : 'none';

  // Hide main, show guided
  if (main) gsap.to(main, { opacity: 0, x: -20, duration: 0.2, onComplete: () => main.style.display = 'none' });

  overlay.style.display = 'flex';
  gsap.fromTo(overlay, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'power2.out' });

  _guidedStep = 0;
  _showGuidedStep(0);

  // Enter key handler for guided mode
  _guidedKeyHandler = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      const tag = e.target.tagName;
      if (tag === 'TEXTAREA') return; // allow newlines in textarea
      e.preventDefault();
      if (_guidedStep < GUIDED_TOTAL_STEPS - 1) guidedNext();
      else guidedFinish();
    }
  };
  overlay.addEventListener('keydown', _guidedKeyHandler);

  setTimeout(() => document.getElementById('guidedTitle')?.focus(), 100);
}

export function closeGuidedCards() {
  const overlay = document.getElementById('guidedOverlay');
  const main = document.querySelector('.modal-main');

  // Sync guided values back to main form
  _syncGuidedToMain();

  // Remove key handler
  if (overlay && _guidedKeyHandler) overlay.removeEventListener('keydown', _guidedKeyHandler);
  _guidedKeyHandler = null;

  if (overlay) gsap.to(overlay, { opacity: 0, scale: 0.96, duration: 0.2, onComplete: () => overlay.style.display = 'none' });
  if (main) {
    main.style.display = '';
    gsap.to(main, { opacity: 1, x: 0, duration: 0.3, ease: 'power2.out' });
  }
}

export function guidedNext() {
  if (_guidedStep >= GUIDED_TOTAL_STEPS - 1) return;
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
  // Update destination buttons
  document.querySelectorAll('.guided-dest-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  // Show/hide date extras with animation
  const extras = document.getElementById('guidedDateExtras');
  if (extras) {
    if (mode === 'date') {
      extras.style.display = '';
      gsap.fromTo(extras, { opacity: 0, maxHeight: 0 }, { opacity: 1, maxHeight: 600, duration: 0.35, ease: 'power2.out' });
    } else {
      gsap.to(extras, { opacity: 0, maxHeight: 0, duration: 0.25, ease: 'power2.in', onComplete: () => extras.style.display = 'none' });
    }
  }
  // Also sync to main form schedule mode
  const opts = document.querySelectorAll('.schedule-mode-option');
  opts.forEach(o => o.classList.toggle('active', o.dataset.mode === mode));
  state.setScheduleMode(mode);
  const dateGroup = document.getElementById('dateGroup');
  if (dateGroup) dateGroup.style.display = mode === 'date' ? '' : 'none';
}

export function guidedSelectRecurrence(rec) {
  selectRecurrence(rec);
  // Show recurrence detail in guided mode
  const detail = document.getElementById('guidedRecDetail');
  if (!detail) return;
  if (rec === 'none' || rec === 'daily') {
    detail.innerHTML = '';
  } else if (rec === 'weekly') {
    state.setSelectedWeekDays([today().getDay()]);
    detail.innerHTML = `<div class="day-checkboxes" id="weekDayBoxes">
      ${state.DAYS.map((d,i) => { const dow=(i+1)%7; return `<div class="day-checkbox${state.selectedWeekDays.includes(dow)?' selected':''}" data-day="${dow}"
        onclick="window.app.toggleWeekDay(${dow})">${d[0]}</div>`; }).join('')}
    </div>`;
  } else if (rec === 'monthly') {
    state.setSelectedMonthDays([state.navDate.getDate()]);
    state.setSelectedMonthLastDay(false);
    detail.innerHTML = monthCalendarHTML(state.selectedMonthDays, state.selectedMonthLastDay);
  } else if (rec === 'yearly') {
    state.setSelectedYearMonth(state.navDate.getMonth());
    state.setSelectedYearDay(state.navDate.getDate());
    detail.innerHTML = yearCalendarHTML(state.selectedYearMonth, state.selectedYearDay);
  }
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

export function guidedToggleNewCat() {
  const row = document.getElementById('guidedNewCatRow');
  if (!row) return;
  const visible = row.style.display !== 'none';
  row.style.display = visible ? 'none' : '';
  if (!visible) document.getElementById('guidedNewCatInput')?.focus();
}

export function guidedAddCategory() {
  const input = document.getElementById('guidedNewCatInput');
  const name = input?.value.trim();
  if (!name) return;
  // Add to admin categories
  const cats = getCategories();
  const id = name.toLowerCase().replace(/\s+/g, '-');
  if (!cats.find(c => c.id === id)) {
    cats.push({ id, name, color: CATEGORY_COLORS[cats.length % CATEGORY_COLORS.length] });
    saveCategories(cats);
  }
  // Refresh both selects
  populateCategorySelect(id);
  // Also refresh guided select
  const gCat = document.getElementById('guidedCategory');
  const mainCat = document.getElementById('taskCategory');
  if (gCat && mainCat) {
    gCat.innerHTML = mainCat.innerHTML;
    gCat.value = id;
  }
  input.value = '';
  document.getElementById('guidedNewCatRow').style.display = 'none';
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
  if (indicator) indicator.textContent = `${step + 1} / ${GUIDED_TOTAL_STEPS}`;

  // Build summary on last step
  if (step === GUIDED_TOTAL_STEPS - 1) _buildGuidedSummary();
}

function _buildGuidedSummary() {
  const el = document.getElementById('guidedSummary');
  if (!el) return;
  const title = document.getElementById('guidedTitle')?.value || '—';
  const date = document.getElementById('guidedDate')?.value || '';
  const prio = document.getElementById('guidedPriority')?.value || '';
  const cat = document.getElementById('guidedCategory');
  const catName = cat?.selectedOptions[0]?.textContent || '';
  const proj = document.getElementById('guidedProject');
  const projName = proj?.selectedOptions[0]?.textContent || '';
  const desc = document.getElementById('guidedDescription')?.value || '';
  const time = document.getElementById('guidedStartTime')?.value || '';
  const dur = document.getElementById('guidedDuration')?.value || '';
  const rec = document.getElementById('guidedRecurrence')?.value || 'none';
  const flex = document.getElementById('guidedFlexibleTime')?.checked;

  const mode = state.scheduleMode;
  let whenText = '';
  if (mode === 'inbox') whenText = 'Inbox';
  else if (mode === 'backlog') whenText = 'Backlog';
  else if (date) {
    const d = new Date(date + 'T00:00:00');
    whenText = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' });
  } else whenText = '—';

  const prioLabels = { low: 'Basse', medium: 'Moyenne', high: 'Haute' };
  const recLabels = { none: '', daily: 'Quotidien', weekly: 'Hebdomadaire', monthly: 'Mensuel', yearly: 'Annuel' };

  const rows = [
    ['Titre', title],
    ['Quand', whenText],
  ];
  if (rec !== 'none') rows.push(['Répétition', recLabels[rec] || '']);
  if (prio) rows.push(['Priorité', prioLabels[prio] || prio]);
  if (catName && catName !== '— Aucune catégorie —') rows.push(['Catégorie', catName]);
  if (projName && projName !== '— Aucun projet —') rows.push(['Projet', projName]);
  if (time) rows.push(['Heure', time + (flex ? ' (flexible)' : '')]);
  if (dur) rows.push(['Durée', dur + ' min']);
  if (desc) rows.push(['Notes', desc.length > 50 ? desc.slice(0, 50) + '...' : desc]);

  el.innerHTML = rows.map(([label, value]) =>
    `<div class="summary-row"><span class="summary-label">${label}</span><span class="summary-value">${esc(value)}</span></div>`
  ).join('');
}

function _syncGuidedToMain() {
  const map = [
    ['guidedTitle', 'taskTitle'],
    ['guidedDate', 'taskDate'],
    ['guidedPriority', 'taskPriority'],
    ['guidedCategory', 'taskCategory'],
    ['guidedProject', 'taskProject'],
    ['guidedDescription', 'taskDescription'],
    ['guidedStartTime', 'taskStartTime'],
    ['guidedDuration', 'taskDurationEstimated'],
  ];
  map.forEach(([gId, mId]) => {
    const g = document.getElementById(gId);
    const m = document.getElementById(mId);
    if (g && m) m.value = g.value;
  });
  _syncDurationStepper('taskDurationEstimated');
  // Sync priority to state
  const p = document.getElementById('taskPriority')?.value || '';
  selectPriority(p);
  // Sync recurrence
  const gRec = document.getElementById('guidedRecurrence')?.value || 'none';
  const mainRec = document.getElementById('taskRecurrence');
  if (mainRec) mainRec.value = gRec;
  // Sync flexible time
  const gFlex = document.getElementById('guidedFlexibleTime');
  const mFlex = document.getElementById('taskFlexibleTime');
  if (gFlex && mFlex) mFlex.checked = gFlex.checked;
  // Ensure context fields are revealed
  const ctx = document.getElementById('contextFields');
  if (ctx && document.getElementById('taskTitle')?.value.trim()) {
    _contextRevealed = true;
    gsap.set(ctx, { maxHeight: 'none', overflow: 'visible', opacity: 1 });
  }
}
