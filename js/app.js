// ════════════════════════════════════════════════════════
//  MAIN APPLICATION
// ════════════════════════════════════════════════════════

import { TRANSLATIONS, ZOOM_SIZES } from './modules/config.js';
import {
  DS, p2, parseDS, today, addDays, startOfWeek,
  daysInMonth, firstDayOfMonth, esc
} from './modules/utils.js';
import {
  saveTodos, loadTodos, getAppConfig, downloadJSON,
  exportAllData, exportCalendarOnly, exportConfigOnly, importData,
  downloadICalFile, getICalBlobURL, generateICalURL
} from './modules/storage.js';
import * as state from './modules/state.js';
import {
  getTodosForDate, isCompleted, toggleTodo, deleteOneOccurrence,
  deleteFutureOccurrences, addTask, getSuggestions
} from './modules/calendar.js';
import {
  openModal, closeModal, openEditModal, selectRecurrence, toggleWeekDay,
  saveTaskLogic, cloudsHTML, openDeleteModal, closeDeleteModal
} from './modules/modal.js';
import {
  todoItemHTML, renderDayView, renderWeekView, renderMonthView, renderYearView,
  getPeriodLabel, getCloudsHTML, renderQACloud
} from './modules/render.js';
import { setupEventListeners } from './modules/events.js';
import { openAdminModal, closeAdminModal, adminScrollToSection, addSuggestedTask, removeSuggestedTask, moveSuggestedTask } from './modules/admin.js';

// Initialize state
state.initializeState();

// Application class
class TodoApp {
  constructor() {
    this._sugg = [];
    this.zoomIdx = parseInt(localStorage.getItem('zoom') ?? '1');
    if (isNaN(this.zoomIdx) || this.zoomIdx < 0 || this.zoomIdx > 2) this.zoomIdx = 1;
    this.init();
  }

  init() {
    state.setTodos(loadTodos());
    this.applyZoom();
    this.initTheme();
    this.applyLang();
    this.render();
    setupEventListeners(this);
  }

  // ═══════════════════════════════════════════════════
  // THEME & ZOOM
  // ═══════════════════════════════════════════════════
  initTheme() {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    this.updateThemeBtn();
  }

  toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    this.updateThemeBtn();
  }

  updateThemeBtn() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.getElementById('themeBtn').textContent = isDark ? '☀️' : '🌙';
  }

  applyZoom() {
    document.body.style.zoom = ZOOM_SIZES[this.zoomIdx] / 16;
    document.querySelectorAll('.size-btn').forEach((b, i) => b.classList.toggle('active', i === this.zoomIdx));
    localStorage.setItem('zoom', this.zoomIdx);
  }

  setZoom(idx) {
    this.zoomIdx = idx;
    this.applyZoom();
  }

  // ═══════════════════════════════════════════════════
  // LANGUAGE
  // ═══════════════════════════════════════════════════
  applyLang() {
    state.updateDateLocales();
    document.querySelectorAll('[data-i18n]').forEach(el => {
      if (state.T[el.dataset.i18n]) el.textContent = state.T[el.dataset.i18n];
    });
    const quickAddInput = document.getElementById('quickAddInput');
    if (quickAddInput) quickAddInput.placeholder = state.T.quickAddPlaceholder;
    document.getElementById('taskTitle').placeholder = state.T.taskPlaceholder;
    document.querySelector('.zoom-group').title = state.T.zoomButtonTitle;
    const quickAddSubmit = document.getElementById('quickAddSubmit');
    if (quickAddSubmit) quickAddSubmit.textContent = state.T.addMore;
    document.getElementById('deleteOneTitle').textContent = state.T.deleteOneOccurrence;
    document.getElementById('deleteOneDesc').textContent = state.T.deleteOneDesc;
    document.getElementById('deleteFutureTitle').textContent = state.T.deleteFutureOccurrences;
    document.getElementById('deleteFutureDesc').textContent = state.T.deleteFutureDesc;
    document.getElementById('deleteAllTitle').textContent = state.T.deleteAllOccurrences;
    document.getElementById('deleteAllDesc').textContent = state.T.deleteAllDesc;
    const sel = document.getElementById('langSelect');
    if (sel) sel.value = state.lang;
  }

  setLang(l) {
    state.setLang(l);
    this.applyLang();
    this.render();
  }

  // ═══════════════════════════════════════════════════
  // NAVIGATION
  // ═══════════════════════════════════════════════════
  navigate(delta) {
    const d = new Date(state.navDate);
    if (state.view==='day')   d.setDate(d.getDate()+delta);
    if (state.view==='week')  d.setDate(d.getDate()+delta*7);
    if (state.view==='month') d.setMonth(d.getMonth()+delta);
    if (state.view==='year')  d.setFullYear(d.getFullYear()+delta);
    state.setNavDate(d);
    this.render();
  }

  todayNav() {
    state.setNavDate(today());
    this.render();
  }

  setView(v) {
    state.setView(v);
    this.render();
  }

  setNavDateAndView(date, view) {
    if (typeof date === 'string') date = parseDS(date);
    state.setNavDate(date);
    state.setView(view);
    this.render();
  }

  // ═══════════════════════════════════════════════════
  // TODOS
  // ═══════════════════════════════════════════════════
  toggleTodo(id, d) {
    toggleTodo(id, d, state.todos);
    saveTodos(state.todos);
    this.render();
  }

  deleteTodo(id, dateStr) {
    openDeleteModal(id, dateStr, state.todos);
  }

  closeDeleteModal() {
    closeDeleteModal();
  }

  deleteOneOccurrence() {
    const { id, date } = state.pendingDelete;
    deleteOneOccurrence(id, date, state.todos);
    closeDeleteModal();
    saveTodos(state.todos);
    this.render();
  }

  deleteFutureOccurrences() {
    const { id, date } = state.pendingDelete;
    const newTodos = deleteFutureOccurrences(id, date, state.todos);
    state.setTodos(newTodos);
    closeDeleteModal();
    saveTodos(state.todos);
    this.render();
  }

  deleteAllOccurrences() {
    if (!confirm(state.T.confirmDeleteAllOccurrences)) return;
    state.setTodos(state.todos.filter(x => x.id !== state.pendingDelete.id));
    closeDeleteModal();
    saveTodos(state.todos);
    this.render();
  }

  // ═══════════════════════════════════════════════════
  // MODAL
  // ═══════════════════════════════════════════════════
  openModal(date) {
    openModal(date, state.todos);
  }

  closeModal() {
    closeModal();
  }

  openEditModal(id, dateStr) {
    openEditModal(id, dateStr, state.todos);
  }

  selectRecurrence(rec) {
    selectRecurrence(rec);
  }

  toggleWeekDay(i) {
    toggleWeekDay(i);
  }

  saveTask() {
    const hadError = saveTaskLogic(state.todos);
    if (!hadError) {
      saveTodos(state.todos);
      closeModal();
      this.render();
    }
  }

  // ═══════════════════════════════════════════════════
  // QUICK ADD
  // ═══════════════════════════════════════════════════
  quickAdd() {
    const input = document.getElementById('quickAddInput');
    if (!input) return; // Quick add panel doesn't exist
    const title = input.value.trim();
    const d = state.quickAddTarget==='today' ? today() : state.navDate;
    openModal(d, state.todos);
    if (state.quickAddTarget !== 'today') selectRecurrence('daily');
    if (title) {
      document.getElementById('taskTitle').value = title;
      input.value = '';
    }
  }

  setQuickAddTarget(target) {
    state.setQuickAddTarget(target);
    const qaToday = document.getElementById('qaToday');
    const qaNav = document.getElementById('qaNav');
    if (qaToday) qaToday.classList.toggle('active', target==='today');
    if (qaNav) qaNav.classList.toggle('active', target==='nav');
    this.renderQACloud();
  }

  openModalWithTitle(title) {
    const d = state.quickAddTarget==='today' ? today() : state.navDate;
    openModal(d, state.todos);
    document.getElementById('taskTitle').value = title;
    document.getElementById('taskTitle').select();
  }

  getSuggestion(index) {
    return state._sugg[index];
  }

  openModalWithRecurring(id) {
    const t = state.todos.find(x => x.id === id);
    if (!t) return;
    const d = state.quickAddTarget==='today' ? today() : state.navDate;
    openModal(d, state.todos);
    document.getElementById('taskTitle').value = t.title;
    selectRecurrence(t.recurrence || 'none');
    if (t.recurrence === 'weekly' && t.recDays) {
      state.setSelectedWeekDays([...t.recDays]);
      document.querySelectorAll('#weekDayBoxes .day-checkbox').forEach(el => {
        el.classList.toggle('selected', state.selectedWeekDays.includes(+el.dataset.day));
      });
    }
  }

  // ═══════════════════════════════════════════════════
  // DATA EXPORT/IMPORT
  // ═══════════════════════════════════════════════════
  exportAllData() {
    exportAllData(state.todos);
  }

  exportCalendarOnly() {
    exportCalendarOnly(state.todos);
  }

  exportConfigOnly() {
    exportConfigOnly();
  }

  downloadICalFile() {
    downloadICalFile(state.todos);
  }

  getICalSubscriptionURL() {
    return getICalBlobURL(state.todos);
  }

  copyICalSubscriptionLink() {
    // Generate the iCal content
    const icalContent = generateICalURL(state.todos);

    // Create a data URL (client-side solution)
    // Note: For production, you'd deploy this to a server endpoint
    const dataUrl = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(icalContent);

    // Copy to clipboard
    navigator.clipboard.writeText(dataUrl).then(() => {
      alert('✓ Calendar data URL copied!\n\nFor actual subscriptions, you need a real server.\n\nQuick fix:\n1. Use "Download Calendar" button\n2. Upload the .ics to your calendar app\n\nOr: Copy your site to a hosting service (Vercel, GitHub Pages, etc.)');
    }).catch(() => {
      prompt('Copy this calendar URL:', dataUrl);
    });
  }

  async handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await importData(file);
      if (data.calendar) state.setTodos(data.calendar);
      if (data.config) {
        if (data.config.theme) localStorage.setItem('theme', data.config.theme);
        if (data.config.zoom) localStorage.setItem('zoom', data.config.zoom);
        if (data.config.lang) localStorage.setItem('lang', data.config.lang);
        this.initTheme();
        this.applyLang();
        this.zoomIdx = parseInt(localStorage.getItem('zoom') ?? '1');
        this.applyZoom();
      }
      saveTodos(state.todos);
      this.render();
      closeDataModal();
      alert(state.T.importSuccess || 'Data imported successfully!');
    } catch (err) {
      alert(state.T.importError || 'Failed to import data');
    }
    e.target.value = '';
  }

  // ═══════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════
  render() {
    document.getElementById('periodLabel').textContent = getPeriodLabel();
    document.querySelectorAll('.view-tab').forEach(b => b.classList.toggle('active', b.dataset.view===state.view));

    let html = '';
    if (state.view==='day')   html = renderDayView(state.todos);
    if (state.view==='week')  html = renderWeekView(state.todos);
    if (state.view==='month') html = renderMonthView(state.todos);
    if (state.view==='year')  html = renderYearView(state.todos);
    document.getElementById('mainContent').innerHTML = html;
    this.renderQACloud();
  }

  renderQACloud() {
    renderQACloud(state.todos);
  }

  getCloudsHTML(date) {
    if (typeof date === 'string') date = parseDS(date);
    return getCloudsHTML(date, state.todos);
  }

  // ═══════════════════════════════════════════════════
  // QUICK EDIT
  // ═══════════════════════════════════════════════════
  quickEditTitle(element, id, dateStr) {
    const currentText = element.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'todo-text-input';
    input.value = currentText;
    input.style.width = element.offsetWidth + 'px';

    element.replaceWith(input);
    input.focus();
    input.select();

    const saveEdit = () => {
      const newTitle = input.value.trim();
      if (newTitle && newTitle !== currentText) {
        const todo = state.todos.find(t => t.id === id);
        if (todo) {
          todo.title = newTitle;
          saveTodos(state.todos);
        }
      }
      const span = document.createElement('span');
      span.className = 'todo-text editable';
      span.textContent = newTitle || currentText;
      span.ondblclick = () => this.quickEditTitle(span, id, dateStr);
      input.replaceWith(span);
      this.render();
    };

    input.addEventListener('blur', saveEdit);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') saveEdit();
      if (e.key === 'Escape') {
        const span = document.createElement('span');
        span.className = 'todo-text editable';
        span.textContent = currentText;
        span.ondblclick = () => this.quickEditTitle(span, id, dateStr);
        input.replaceWith(span);
      }
    });
  }

  // ═══════════════════════════════════════════════════
  // ADMIN
  // ═══════════════════════════════════════════════════
  openAdminModal() {
    openAdminModal();
  }

  closeAdminModal() {
    closeAdminModal();
  }

  addSuggestedTask(type) {
    addSuggestedTask(type);
  }

  removeSuggestedTask(type, task) {
    removeSuggestedTask(type, task);
  }

  moveSuggestedTask(type, index, direction) {
    moveSuggestedTask(type, index, direction);
  }

  adminScrollToSection(id) {
    adminScrollToSection(id);
  }

  // ═══════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════
  parseDS(s) { return parseDS(s); }
  getNavDate() { return state.navDate; }
}

// Create global app instance
window.app = new TodoApp();

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
  if (!localStorage.getItem('theme')) {
    document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    window.app.updateThemeBtn();
  }
});
