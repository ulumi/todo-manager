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
  downloadICalFile, getICalBlobURL, generateICalURL,
  loadFromServer, saveBackupToServer, getFullBackup
} from './modules/storage.js';
import * as state from './modules/state.js';
import {
  getTodosForDate, isCompleted, toggleTodo, deleteOneOccurrence,
  deleteFutureOccurrences, addTask, getSuggestions
} from './modules/calendar.js';
import {
  openModal, closeModal, openEditModal, selectRecurrence, toggleWeekDay,
  toggleMonthDay, toggleMonthLastDay,
  selectYearMonth, selectYearDay,
  saveTaskLogic, cloudsHTML, openDeleteModal, closeDeleteModal,
  toggleCloudSection, toggleModalRight, selectPriority
} from './modules/modal.js';
import {
  todoItemHTML, renderDayView, renderWeekView, renderMonthView, renderYearView,
  renderCategoriesView,
  getPeriodLabel, getCloudsHTML, renderQACloud, setupTodoItemHoverAnimations,
  renderSidebar, renderWeekSidebar, renderYearSidebar
} from './modules/render.js';
import { setupEventListeners } from './modules/events.js';
import { celebrate } from './modules/celebrate.js';
import { VERSION } from './modules/version.js';
import { openAdminModal, closeAdminModal, showAdminSection, addSuggestedTask, removeSuggestedTask, moveSuggestedTask, clearAllSuggestedTasks, clearAllCalendarData, openTemplateModal, closeTemplateModal, applyTemplate, addTemplate, removeTemplate, addTaskToTemplate, removeTaskFromTemplate, addCategory, removeCategory, getCategories, saveCategories } from './modules/admin.js';
import {
  openCategoryView, closeCategoryView, renderCategoryPanel,
  getCurrentCategoryId, getCategoryTaskOrder, saveCategoryTaskOrder,
  saveCategoryDescription, setCategoryIcon
} from './modules/projectView.js';
import { snapshot, undo, canUndo } from './modules/undo.js';
import {
  initAuth, onUserChange, isGuest, getCurrentUser,
  signInGuest, signInWithEmail, registerWithEmail,
  upgradeGuestToEmail, signOut, updateUserProfile,
} from './modules/auth.js';
import { loadFromFirestore, pushToFirestore, subscribeToFirestore, setupOfflineIndicator, deleteUserFirestoreDoc } from './modules/sync.js';
import {
  openAvatarEditor, closeAvatarEditor, getAvatarHTML,
  handleAvatarFile, selectAvatarFilter, selectAvatarEmoji,
  avatarSwitchTab, saveAvatar, FILTERS,
  cropDragStart, setCropZoom, setEmojiZoom,
} from './modules/avatarEditor.js';

// Initialize state
state.initializeState();

// Application class
class TodoApp {
  constructor() {
    window.app = this; // assign early so renderDayView can read recurringOrder/dayOrder on first render
    this._sugg = [];
    this.zoomIdx = parseInt(localStorage.getItem('zoom') ?? '1');
    if (isNaN(this.zoomIdx) || this.zoomIdx < 0 || this.zoomIdx > 2) this.zoomIdx = 1;
    this.dayOrder = JSON.parse(localStorage.getItem('dayOrder') || '{}');
    this.recurringOrder = JSON.parse(localStorage.getItem('recurringOrder') || '{}');
    this._clickTimer = null;
    this._quickAddInDayMode = false;
    this.init();
  }

  init() {
    state.setTodos(loadTodos());
    this.applyZoom();
    this.initTheme();
    this.applyLang();
    // Restore saved view
    const savedView = localStorage.getItem('view');
    if (savedView && ['day', 'week', 'month', 'year', 'categories'].includes(savedView)) {
      state.setView(savedView);
    }
    this.render();
    this._syncServer();
    // Seed the history stack with the initial state
    history.replaceState({ view: state.view, nav: state.navDate.toISOString().slice(0, 10) }, '');
    window.addEventListener('popstate', (e) => this._popHistory(e));
    const vl = document.getElementById('versionLabel');
    if (vl) vl.textContent = 'v' + VERSION;
    setupEventListeners(this);
    this._animateViewTabs();
    let _resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(_resizeTimer);
      _resizeTimer = setTimeout(() => {
        const sidebar = document.getElementById('calSidebar');
        if (sidebar && state.view === 'day') sidebar.innerHTML = renderSidebar(state.todos);
        this._animateQuickAddBtn();
      }, 150);
    });
    setupOfflineIndicator();
    this._initFirebase(); // async — does not block render
  }

  // ═══════════════════════════════════════════════════
  // SERVER SYNC
  // ═══════════════════════════════════════════════════
  async _syncServer() {
    const backup = await loadFromServer();
    if (!backup) return; // server not running

    const localHasData = state.todos.length > 0;

    if (localHasData) {
      // localStorage is the source of truth — push it to server
      await saveBackupToServer(getFullBackup(state.todos));
      return;
    }

    if (!backup.calendar || backup.calendar.length === 0) {
      // Both empty — nothing to do
      return;
    }

    // localStorage is empty, server has data — pull from server
    state.setTodos(backup.calendar);
    if (backup.categories)     localStorage.setItem('projects',         JSON.stringify(backup.categories));
    if (backup.templates)      localStorage.setItem('dayTemplates',     JSON.stringify(backup.templates));
    if (backup.suggestedTasks) localStorage.setItem('suggestedTasks',   JSON.stringify(backup.suggestedTasks));
    if (backup.taskOrder)      localStorage.setItem('projectTaskOrder', JSON.stringify(backup.taskOrder));
    if (backup.config) {
      if (backup.config.theme) localStorage.setItem('theme', backup.config.theme);
      if (backup.config.zoom)  localStorage.setItem('zoom',  backup.config.zoom);
      if (backup.config.lang)  localStorage.setItem('lang',  backup.config.lang);
    }
    localStorage.setItem('todos', JSON.stringify(backup.calendar));
    this.render();
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
  async navigate(delta) {
    const d = new Date(state.navDate);
    if (state.view==='day')   d.setDate(d.getDate()+delta);
    if (state.view==='week')  d.setDate(d.getDate()+delta*7);
    if (state.view==='month') d.setMonth(d.getMonth()+delta);
    if (state.view==='year')  d.setFullYear(d.getFullYear()+delta);
    state.setNavDate(d);
    this._pushHistory();
    await this._animateViewChange(delta);
  }

  async navigateMonth(delta) {
    const d = new Date(state.navDate);
    d.setMonth(d.getMonth() + delta);
    state.setNavDate(d);
    this._pushHistory();
    await this._animateViewChange(delta);
  }

  todayNav() {
    state.setNavDate(today());
    this._pushHistory();
    this.render();
  }

  async setView(v) {
    state.setView(v);
    localStorage.setItem('view', v);
    this._pushHistory();
    await this._animateViewChange();
  }

  _pushHistory() {
    const navStr = state.navDate.toISOString().slice(0, 10);
    history.pushState({ view: state.view, nav: navStr }, '');
  }

  async _popHistory(e) {
    if (!e.state) return;
    const { view, nav } = e.state;
    const [y, m, d] = nav.split('-').map(Number);
    state.setNavDate(new Date(y, m - 1, d));
    state.setView(view);
    localStorage.setItem('view', view);
    await this._animateViewChange();
  }

  async _animateViewChange(delta = 0) {
    const main = document.getElementById('mainContent');
    const isDay = state.view === 'day';
    const isMonth = state.view === 'month';
    const slideX = isDay && delta !== 0 ? (delta > 0 ? 60 : -60) : 0;
    const slideY = isMonth && delta !== 0 ? (delta > 0 ? 40 : -40) : 0;

    // 1. Exit
    await gsap.to(main, {
      opacity: 0,
      x: slideX ? -slideX : 0,
      y: slideY ? -slideY : 0,
      duration: (isDay || isMonth) && delta ? 0.15 : 0.12,
      ease: 'power2.in'
    });

    // 2. Render new view
    this.render();

    // 2b. Hide blocks immediately (no flash frame)
    const blocks = document.querySelectorAll('.week-container, .month-cell, .year-month-card');
    if (blocks.length > 0) {
      gsap.set(blocks, { opacity: 0, y: 12 });
    }

    // 3. Scroll to top before entering new view
    window.scrollTo(0, 0);

    // 4. Enter
    gsap.set(main, { x: slideX, y: slideY });
    await gsap.to(main, {
      opacity: 1,
      x: 0,
      y: 0,
      duration: (isDay || isMonth) && delta ? 0.28 : 0.25,
      delay: 0.02,
      ease: (isDay || isMonth) && delta ? 'expo.out' : 'power2.out'
    });

    // 5. Stagger blocks — total spread capped at 120ms regardless of count
    if (blocks.length > 0) {
      gsap.to(blocks, {
        opacity: 1,
        y: 0,
        duration: 0.25,
        stagger: { amount: 0.12 },
        ease: 'power3.out',
        delay: 0.05,
        overwrite: 'auto'
      });
    }

    // 6. Stagger todo items
    setTimeout(() => {
      gsap.from('.todo-item', {
        opacity: 0,
        y: 8,
        duration: 0.2,
        stagger: { amount: 0.08 },
        ease: 'power3.out',
        overwrite: 'auto'
      });
    }, 220);

    // Setup hover animations
    setupTodoItemHoverAnimations();
  }

  _animateViewTabs() {
    const tabs = document.querySelectorAll('.view-tab');
    if (tabs.length === 0) return;

    // Animate tabs from hidden to visible
    gsap.fromTo(tabs,
      { opacity: 0, scale: 0.85 }, // from
      { opacity: 1, scale: 1, duration: 0.25, stagger: 0.05, ease: 'power3.out' } // to
    );
  }

  async setNavDateAndView(date, view) {
    if (typeof date === 'string') date = parseDS(date);
    state.setNavDate(date);
    state.setView(view);
    localStorage.setItem('view', view);
    this._pushHistory();
    await this._animateViewChange();
  }

  // ═══════════════════════════════════════════════════
  // TODOS
  // ═══════════════════════════════════════════════════
  _refreshCategoryPanel() {
    const catId = getCurrentCategoryId();
    if (catId) renderCategoryPanel(catId);
  }

  toggleTodo(id, d) {
    const wasCompleted = isCompleted(state.todos.find(x => x.id === id), d);
    snapshot(state.todos);
    toggleTodo(id, d, state.todos);
    saveTodos(state.todos);
    if (!wasCompleted) celebrate(state.lang);
    this.render();
    this._refreshCategoryPanel();
    // Animate checkbox bounce
    setTimeout(() => {
      const check = document.querySelector(`[data-id="${id}"] .todo-check`);
      if (check) {
        gsap.timeline()
          .to(check, { scale: 1.35, duration: 0.12, ease: 'power2.out' })
          .to(check, { scale: 1, duration: 0.2, ease: 'elastic.out(1.2, 0.5)' });
      }
    }, 0);
  }

  deleteTodo(id, dateStr) {
    const t = state.todos.find(x => x.id === id);
    if (!t) return;
    if (!t.recurrence || t.recurrence === 'none') {
      this._animateDeleteAndRefresh(id, () => {
        snapshot(state.todos);
        state.setTodos(state.todos.filter(x => x.id !== id));
        saveTodos(state.todos);
      });
    } else {
      openDeleteModal(id, dateStr, state.todos);
    }
  }

  closeDeleteModal() {
    closeDeleteModal();
  }

  deleteOneOccurrence() {
    const { id } = state.pendingDelete;
    this._animateDeleteAndRefresh(id, () => {
      snapshot(state.todos);
      deleteOneOccurrence(id, state.pendingDelete.date, state.todos);
      closeDeleteModal();
      saveTodos(state.todos);
    });
  }

  deleteFutureOccurrences() {
    const { id } = state.pendingDelete;
    this._animateDeleteAndRefresh(id, () => {
      snapshot(state.todos);
      const newTodos = deleteFutureOccurrences(id, state.pendingDelete.date, state.todos);
      state.setTodos(newTodos);
      closeDeleteModal();
      saveTodos(state.todos);
    });
  }

  deleteAllOccurrences() {
    const { id } = state.pendingDelete;
    this._animateDeleteAndRefresh(id, () => {
      snapshot(state.todos);
      state.setTodos(state.todos.filter(x => x.id !== id));
      closeDeleteModal();
      saveTodos(state.todos);
    });
  }

  _animateDeleteAndRefresh(id, callback) {
    const item = document.querySelector(`[data-id="${id}"]`);
    if (item) {
      gsap.to(item, {
        opacity: 0, x: 24, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0,
        duration: 0.25, ease: 'power2.in',
        onComplete: () => {
          callback();
          this.render();
          this._refreshCategoryPanel();
        }
      });
    } else {
      callback();
      this.render();
      this._refreshCategoryPanel();
    }
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

  toggleMonthDay(d) {
    toggleMonthDay(d);
  }

  toggleMonthLastDay() {
    toggleMonthLastDay();
  }

  selectYearMonth(m) {
    selectYearMonth(m);
  }

  selectYearDay(d) {
    selectYearDay(d);
  }

  setTaskDateToday() {
    document.getElementById('taskDate').value = DS(today());
  }

  setTaskDateTomorrow() {
    const d = today();
    d.setDate(d.getDate() + 1);
    document.getElementById('taskDate').value = DS(d);
  }

  toggleCloudSection(headerEl) {
    toggleCloudSection(headerEl);
  }

  toggleModalRight() {
    toggleModalRight();
  }

  saveTask() {
    const before = JSON.parse(JSON.stringify(state.todos));
    const hadError = saveTaskLogic(state.todos);
    if (!hadError) {
      if (state.insertAfterId && !state.editingId) {
        const newTask = state.todos[state.todos.length - 1];
        const refIdx = state.todos.findIndex(x => x.id === state.insertAfterId);
        if (refIdx !== -1) {
          state.todos.splice(state.todos.length - 1, 1);
          state.todos.splice(refIdx + 1, 0, newTask);
        }
        state.setInsertAfterId(null);
      }
      snapshot(before);
      saveTodos(state.todos);
      closeModal();
      this.render();
      this._refreshCategoryPanel();
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

  addTaskAfter(id, ds) {
    const t = state.todos.find(x => x.id === id);
    state.setInsertAfterId(id);
    openModal(this.parseDS(ds), state.todos);
    if (t?.projectId) {
      setTimeout(() => {
        const sel = document.getElementById('taskCategory');
        if (sel) sel.value = t.projectId;
      }, 60);
    }
  }

  duplicateTodo(id, ds) {
    const t = state.todos.find(x => x.id === id);
    if (!t) return;
    snapshot(state.todos);
    const clone = { ...JSON.parse(JSON.stringify(t)), id: Date.now().toString(), completed: false, completedDates: [] };
    const idx = state.todos.findIndex(x => x.id === id);
    state.todos.splice(idx + 1, 0, clone);
    saveTodos(state.todos);
    this.render();
  }

  clickTodo(e, id, ds) {
    if (e.target.closest('.todo-check, .todo-actions, .todo-drag-handle')) return;
    if (e.target.closest('.todo-text')) {
      // dblclick handled by ondblclick on the span — single click ignored on text
      return;
    }
    clearTimeout(this._clickTimer);
    this._clickTimer = setTimeout(() => {
      this._clickTimer = null;
      this.openEditModal(id, ds);
    }, 220);
  }

  dropReorder(draggedId, group, targetId, before) {
    if (draggedId === targetId) return;
    const dateStr = DS(state.navDate);
    if (group === 'punctual') {
      const items = getTodosForDate(state.navDate, state.todos).filter(t => !t.recurrence || t.recurrence === 'none');
      let order = this.dayOrder[dateStr] ? [...this.dayOrder[dateStr]] : items.map(t => t.id);
      items.forEach(t => { if (!order.includes(t.id)) order.push(t.id); });
      order = order.filter(id => items.some(t => t.id === id));
      const newOrder = order.filter(id => id !== draggedId);
      const idx = newOrder.indexOf(targetId);
      if (idx < 0) return;
      newOrder.splice(before ? idx : idx + 1, 0, draggedId);
      this.dayOrder[dateStr] = newOrder;
      localStorage.setItem('dayOrder', JSON.stringify(this.dayOrder));
    } else {
      const items = getTodosForDate(state.navDate, state.todos).filter(t => t.recurrence === group);
      if (!this.recurringOrder[dateStr]) this.recurringOrder[dateStr] = {};
      let order = this.recurringOrder[dateStr][group] ? [...this.recurringOrder[dateStr][group]] : items.map(t => t.id);
      items.forEach(t => { if (!order.includes(t.id)) order.push(t.id); });
      order = order.filter(id => items.some(t => t.id === id));
      const newOrder = order.filter(id => id !== draggedId);
      const idx = newOrder.indexOf(targetId);
      if (idx < 0) return;
      newOrder.splice(before ? idx : idx + 1, 0, draggedId);
      this.recurringOrder[dateStr][group] = newOrder;
      // Propagate new relative order to future dates that already have a stored order for this group.
      // For each future date, items that appear in newOrder are re-sorted to match its relative order;
      // items unique to that date (not in newOrder) keep their existing relative positions.
      Object.keys(this.recurringOrder)
        .filter(d => d > dateStr && this.recurringOrder[d][group])
        .forEach(d => {
          const existing = this.recurringOrder[d][group];
          const sorted = existing.filter(id => newOrder.includes(id));
          sorted.sort((a, b) => newOrder.indexOf(a) - newOrder.indexOf(b));
          let si = 0;
          this.recurringOrder[d][group] = existing.map(id => newOrder.includes(id) ? sorted[si++] : id);
        });
      localStorage.setItem('recurringOrder', JSON.stringify(this.recurringOrder));
    }
    this.render();
  }

  moveTodoToDate(todoId, newDateStr) {
    const todo = state.todos.find(t => t.id === todoId);
    if (!todo || (todo.recurrence && todo.recurrence !== 'none')) return;
    if (todo.date === newDateStr) return;
    snapshot(state.todos);
    todo.date = newDateStr;
    saveTodos(state.todos);
    this.render();
  }

  initWeekDragDrop() {
    const grid = document.querySelector('.week-grid');
    if (!grid) return;
    let draggedId = null, draggedDate = null;

    grid.addEventListener('dragstart', e => {
      const item = e.target.closest('.week-todo-item[draggable]');
      if (!item) return;
      draggedId = item.dataset.id;
      draggedDate = item.dataset.date;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggedId);
      requestAnimationFrame(() => item.classList.add('dragging'));
    });

    grid.addEventListener('dragend', e => {
      const item = e.target.closest('.week-todo-item');
      if (item) item.classList.remove('dragging');
      draggedId = null; draggedDate = null;
      grid.querySelectorAll('.week-day-todos.drag-over').forEach(el => el.classList.remove('drag-over'));
    });

    grid.addEventListener('dragover', e => {
      e.preventDefault();
      if (!draggedId) return;
      const col = e.target.closest('.week-day-todos');
      if (!col) return;
      grid.querySelectorAll('.week-day-todos.drag-over').forEach(el => el.classList.remove('drag-over'));
      if (col.dataset.date !== draggedDate) col.classList.add('drag-over');
    });

    grid.addEventListener('drop', e => {
      e.preventDefault();
      const col = e.target.closest('.week-day-todos');
      if (!col || !draggedId) return;
      const newDate = col.dataset.date;
      col.classList.remove('drag-over');
      if (newDate && newDate !== draggedDate) this.moveTodoToDate(draggedId, newDate);
    });
  }

  initMonthDragDrop() {
    const grid = document.querySelector('.month-grid');
    if (!grid) return;
    let draggedId = null, draggedDate = null;

    grid.addEventListener('dragstart', e => {
      const item = e.target.closest('.month-todo-dot[draggable]');
      if (!item) return;
      draggedId = item.dataset.id;
      draggedDate = item.dataset.date;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggedId);
      requestAnimationFrame(() => item.classList.add('dragging'));
    });

    grid.addEventListener('dragend', e => {
      const item = e.target.closest('.month-todo-dot');
      if (item) item.classList.remove('dragging');
      draggedId = null; draggedDate = null;
      grid.querySelectorAll('.month-cell.drag-over').forEach(el => el.classList.remove('drag-over'));
    });

    grid.addEventListener('dragover', e => {
      e.preventDefault();
      if (!draggedId) return;
      const cell = e.target.closest('.month-cell[data-date]');
      if (!cell) return;
      grid.querySelectorAll('.month-cell.drag-over').forEach(el => el.classList.remove('drag-over'));
      if (cell.dataset.date !== draggedDate) cell.classList.add('drag-over');
    });

    grid.addEventListener('drop', e => {
      e.preventDefault();
      const cell = e.target.closest('.month-cell[data-date]');
      if (!cell || !draggedId) return;
      const newDate = cell.dataset.date;
      cell.classList.remove('drag-over');
      if (newDate && newDate !== draggedDate) this.moveTodoToDate(draggedId, newDate);
    });
  }

  initDayDragDrop() {
    const container = document.querySelector('.day-columns');
    if (!container) return;
    let draggedEl = null, draggedGroup = null, dropTarget = null, dropBefore = false;
    const indicator = document.createElement('div');
    indicator.className = 'drop-indicator';

    container.addEventListener('dragstart', e => {
      const item = e.target.closest('.todo-item[draggable]');
      if (!item) return;
      draggedEl = item;
      draggedGroup = item.dataset.group;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.dataset.id);
      requestAnimationFrame(() => item.classList.add('dragging'));
    });

    container.addEventListener('dragend', () => {
      if (draggedEl) draggedEl.classList.remove('dragging');
      indicator.remove();
      draggedEl = null; draggedGroup = null; dropTarget = null;
    });

    container.addEventListener('dragover', e => {
      e.preventDefault();
      if (!draggedEl) return;
      const target = e.target.closest('.todo-item[draggable]');
      if (!target || target === draggedEl || target.dataset.group !== draggedGroup) return;
      const rect = target.getBoundingClientRect();
      dropBefore = e.clientY < rect.top + rect.height / 2;
      dropTarget = target.dataset.id;
      if (dropBefore) target.parentNode.insertBefore(indicator, target);
      else target.parentNode.insertBefore(indicator, target.nextSibling);
    });

    container.addEventListener('drop', e => {
      e.preventDefault();
      indicator.remove();
      if (draggedEl && dropTarget) this.dropReorder(draggedEl.dataset.id, draggedGroup, dropTarget, dropBefore);
    });
  }

  setQuickAddTarget(target) {
    state.setQuickAddTarget(target);
    const qaToday = document.getElementById('qaToday');
    const qaNav = document.getElementById('qaNav');
    if (qaToday) qaToday.classList.toggle('active', target==='today');
    if (qaNav) qaNav.classList.toggle('active', target==='nav');
    this.renderQACloud();
  }

  reorderTask(id, dateStr, direction) {
    const date = parseDS(dateStr);
    const otherItems = getTodosForDate(date, state.todos).filter(t => t.recurrence !== 'daily');
    let order = this.dayOrder[dateStr] ? [...this.dayOrder[dateStr]] : otherItems.map(t => t.id);
    // Sync: add missing, remove stale
    otherItems.forEach(t => { if (!order.includes(t.id)) order.push(t.id); });
    order = order.filter(id => otherItems.some(t => t.id === id));
    const idx = order.indexOf(id);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= order.length) return;
    [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
    this.dayOrder[dateStr] = order;
    localStorage.setItem('dayOrder', JSON.stringify(this.dayOrder));
    this.render();
  }

  openModalWithTitle(title) {
    if (document.getElementById('modalOverlay').classList.contains('hidden')) {
      const d = state.quickAddTarget==='today' ? today() : state.navDate;
      openModal(d, state.todos);
    }
    document.getElementById('taskTitle').value = title;
    document.getElementById('taskTitle').select();
  }

  getSuggestion(index) {
    return state._sugg[index];
  }

  openModalWithRecurring(id) {
    const t = state.todos.find(x => x.id === id);
    if (!t) return;
    if (document.getElementById('modalOverlay').classList.contains('hidden')) {
      const d = state.quickAddTarget==='today' ? today() : state.navDate;
      openModal(d, state.todos);
    }
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

  undoAction() {
    const prev = undo();
    if (!prev) return;
    state.setTodos(prev);
    saveTodos(prev);
    this.render();
    this._showUndoToast();
  }

  _showUndoToast() {
    let toast = document.getElementById('undoToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'undoToast';
      toast.className = 'undo-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = '↩ Annulé';
    toast.classList.remove('undo-toast--visible');
    void toast.offsetWidth;
    toast.classList.add('undo-toast--visible');
  }

  async handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await importData(file);
      snapshot(state.todos);
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
      if (data.categories) localStorage.setItem('projects', JSON.stringify(data.categories));
      if (data.templates) localStorage.setItem('dayTemplates', JSON.stringify(data.templates));
      if (data.suggestedTasks) localStorage.setItem('suggestedTasks', JSON.stringify(data.suggestedTasks));
      if (data.taskOrder) localStorage.setItem('projectTaskOrder', JSON.stringify(data.taskOrder));
      saveTodos(state.todos);
      closeAdminModal();
      this.render();
      alert(state.T.importSuccess || 'Données importées avec succès !');
    } catch (err) {
      alert(state.T.importError || 'Failed to import data');
    }
    e.target.value = '';
  }

  // ═══════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════
  render() {
    const isCategories = state.view === 'categories';
    const isProfile    = state.view === 'profile';
    document.body.classList.toggle('view-projects', isCategories);
    document.body.classList.toggle('view-profile',  isProfile);
    document.getElementById('periodLabel').textContent = (isCategories || isProfile) ? '' : getPeriodLabel();
    document.querySelectorAll('.view-tab').forEach(b => b.classList.toggle('active', b.dataset.view===state.view));

    let html = '';
    if (state.view==='day')        html = renderDayView(state.todos);
    if (state.view==='week')       html = renderWeekView(state.todos);
    if (state.view==='month')      html = renderMonthView(state.todos);
    if (state.view==='year')       html = renderYearView(state.todos);
    if (state.view==='categories') html = renderCategoriesView(state.todos);
    if (state.view==='profile')    html = this._renderProfileView();
    document.getElementById('mainContent').innerHTML = html;
    const sidebar = document.getElementById('calSidebar');
    if (sidebar) {
      if (state.view === 'day') {
        sidebar.style.display = '';
        sidebar.innerHTML = renderSidebar(state.todos);
      } else if (state.view === 'year') {
        sidebar.style.display = '';
        sidebar.innerHTML = renderYearSidebar();
      } else {
        sidebar.style.display = 'none';
        sidebar.innerHTML = '';
      }
    }
    if (state.view === 'day') this.initDayDragDrop();
    if (state.view === 'week') this.initWeekDragDrop();
    if (state.view === 'month') this.initMonthDragDrop();
    this.renderQACloud();
    this._animateQuickAddBtn();
    this._applyMultilineClasses();
  }

  _renderProfileView() {
    const user     = getCurrentUser();
    const name     = user?.displayName || user?.email?.split('@')[0] || '';
    const initials = (user?.displayName || user?.email || '?').slice(0, 2).toUpperCase();
    const cats     = getCategories().length;
    const total    = state.todos.length;
    const recur    = state.todos.filter(t => t.recurrence && t.recurrence !== 'none').length;
    const done     = state.todos.filter(t => t.completed).length;

    return `
      <div class="profile-view">
        <div class="profile-hero">
          <div class="profile-avatar" onclick="window.app.openAvatarEditor()" title="Modifier l'avatar">
            ${getAvatarHTML(initials)}
            <span class="profile-avatar-hint">✏️</span>
          </div>
          <h1 class="profile-hero-name">${esc(name)}</h1>
          <p class="profile-hero-email">${esc(user?.email || '')}</p>
        </div>

        <div class="profile-body">
          <div class="profile-section">
            <div class="profile-name-row">
              <span class="profile-name-value">${esc(user?.displayName || user?.email?.split('@')[0] || '')}</span>
              <button class="profile-edit-btn" onclick="window.app.toggleNameEdit()" title="Modifier le nom">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
            </div>
            <div class="profile-name-edit hidden" id="profileNameEdit">
              <p class="profile-edit-invite">Comment veux-tu qu'on t'appelle ?</p>
              <div class="profile-name-input-row">
                <input class="form-input" type="text" id="profileDisplayName"
                  value="${esc(user?.displayName || '')}" placeholder="Ton prénom">
                <button class="btn btn-primary btn-sm" onclick="window.app.saveDisplayName()">OK</button>
              </div>
            </div>
            <p class="profile-save-msg hidden" id="profileSaveMsg">✓ Sauvegardé</p>
          </div>

          <div class="profile-section">
            <h3 class="profile-section-title">Statistiques</h3>
            <div class="profile-stats">
              <div class="profile-stat"><span class="profile-stat-num">${total}</span><span class="profile-stat-label">tâches</span></div>
              <div class="profile-stat"><span class="profile-stat-num">${done}</span><span class="profile-stat-label">complétées</span></div>
              <div class="profile-stat"><span class="profile-stat-num">${recur}</span><span class="profile-stat-label">récurrentes</span></div>
              <div class="profile-stat"><span class="profile-stat-num">${cats}</span><span class="profile-stat-label">catégories</span></div>
            </div>
          </div>

          <div class="profile-section">
            <h3 class="profile-section-title">Réglages</h3>
            <div class="profile-rows">
              <button class="profile-row" onclick="window.app.openAdminSection('taches')">
                <span>📋 Tâches suggérées</span><span class="profile-row-arrow">›</span>
              </button>
              <button class="profile-row" onclick="window.app.openAdminSection('modeles')">
                <span>🗂 Modèles de journée</span><span class="profile-row-arrow">›</span>
              </button>
            </div>
          </div>

          <div class="profile-section">
            <h3 class="profile-section-title">Données</h3>
            <div class="profile-rows">
              <button class="profile-row" onclick="window.app.exportAllData()">
                <span>📤 Exporter mes données</span><span class="profile-row-arrow">›</span>
              </button>
              <button class="profile-row profile-row--danger" onclick="window.app.profileDeleteData()">
                <span>🗑 Effacer mes données</span><span class="profile-row-arrow">›</span>
              </button>
            </div>
          </div>

          <div class="profile-section">
            <button class="btn btn-ghost profile-signout-btn" onclick="window.app.authSignOut()">Se déconnecter</button>
          </div>
        </div>
      </div>
    `;
  }

  toggleNameEdit() {
    const form = document.getElementById('profileNameEdit');
    if (!form) return;
    const opening = form.classList.contains('hidden');
    form.classList.toggle('hidden');
    if (opening) document.getElementById('profileDisplayName')?.focus();
  }

  async saveDisplayName() {
    const input = document.getElementById('profileDisplayName');
    const name  = input?.value?.trim();
    if (!name) return;
    await updateUserProfile(name);
    this._updateUserBtn();
    const nameEl = document.querySelector('.profile-name-value');
    if (nameEl) nameEl.textContent = name;
    document.getElementById('profileNameEdit')?.classList.add('hidden');
    const msg = document.getElementById('profileSaveMsg');
    if (msg) {
      msg.classList.remove('hidden');
      setTimeout(() => msg.classList.add('hidden'), 2000);
    }
  }

  openAvatarEditor()           { openAvatarEditor(); }
  closeAvatarEditor()          { closeAvatarEditor(); }
  handleAvatarFile(input)      { handleAvatarFile(input); }
  selectAvatarFilter(id)       { selectAvatarFilter(id); }
  selectAvatarEmoji(emoji)     { selectAvatarEmoji(emoji); }
  avatarSwitchTab(tab)         { avatarSwitchTab(tab); }
  async saveAvatar()           { await saveAvatar(); this._updateUserBtn(); }
  cropDragStart(e)             { cropDragStart(e); }
  setCropZoom(val)             { setCropZoom(val); }
  setEmojiZoom(val)            { setEmojiZoom(val); }

  openAdminSection(section) {
    openAdminModal();
    setTimeout(() => showAdminSection(section), 50);
  }

  async profileDeleteData() {
    if (!confirm('Effacer toutes tes données ? Cette action est irréversible.')) return;
    await deleteUserFirestoreDoc();
    Object.keys(localStorage).filter(k => !k.startsWith('firebase:')).forEach(k => localStorage.removeItem(k));
    await signOut();
    location.reload();
  }

  _applyMultilineClasses() {
    document.querySelectorAll('.todo-item').forEach(item => {
      const text = item.querySelector('.todo-text');
      if (!text) return;
      const lh = parseFloat(getComputedStyle(text).lineHeight) || 20;
      item.classList.toggle('todo-item--multiline', text.scrollHeight > lh * 1.5);
    });
  }

  clearDay() {
    const dateStr = DS(state.navDate);
    const dayTodos = state.todos.filter(t => (!t.recurrence || t.recurrence === 'none') && t.date === dateStr);
    if (dayTodos.length === 0) return;
    if (!confirm(`Supprimer les ${dayTodos.length} tâche(s) de cette journée ?`)) return;
    snapshot(state.todos);
    state.setTodos(state.todos.filter(t => !(!t.recurrence || t.recurrence === 'none') || t.date !== dateStr));
    saveTodos(state.todos);
    this.render();
  }

  _animateQuickAddBtn() {
    const btn = document.getElementById('quickAddBtn');
    if (!btn || typeof gsap === 'undefined') return;
    const label = btn.querySelector('.qab-label');
    const tBtn = document.getElementById('templateDayBtn');
    const cBtn = document.getElementById('clearDayBtn');

    const isMobile = window.innerWidth <= 600;

    if (state.view === 'day') {
      if (isMobile) {
        // Mobile: add on left, template+clear on right
        if (!this._quickAddInDayMode) {
          this._quickAddInDayMode = true;
          gsap.set(btn, { right: 'auto', left: 16, bottom: -80, xPercent: 0 });
          if (tBtn) gsap.set(tBtn, { left: 'auto', right: 16, bottom: -80, xPercent: 0, opacity: 0 });
          if (cBtn) gsap.set(cBtn, { left: 'auto', right: 82, bottom: -80, xPercent: 0, opacity: 0 });
        }
        gsap.to(btn, { bottom: 16, duration: 0.28, ease: 'expo.out', overwrite: 'auto' });
        if (tBtn) {
          gsap.to(tBtn, { bottom: 16, opacity: 1, duration: 0.28, delay: 0.06, ease: 'expo.out', overwrite: 'auto' });
          setTimeout(() => { if (tBtn) tBtn.style.pointerEvents = 'auto'; }, 340);
        }
        if (cBtn) {
          gsap.to(cBtn, { bottom: 16, opacity: 1, duration: 0.28, delay: 0.12, ease: 'expo.out', overwrite: 'auto' });
          setTimeout(() => { if (cBtn) cBtn.style.pointerEvents = 'auto'; }, 400);
        }
        return;
      }

      const main = document.getElementById('mainContent');
      if (!main) return;
      const rect = main.getBoundingClientRect();
      const gsapX = gsap.getProperty(main, 'x') || 0;

      // Anchor the group to the left of the content area.
      // Layout (left→right): [Add Task pill] gap [Modèle] gap [Vider]
      const tBtnW = tBtn ? tBtn.offsetWidth : 0;
      const cBtnW = cBtn ? cBtn.offsetWidth : 0;
      const anchorX = rect.left - gsapX + 32 + 110;
      const tBtnLeft = anchorX + 110 + 12 + tBtnW / 2;
      const cBtnLeft = anchorX + 110 + 12 + tBtnW + 12 + cBtnW / 2;

      if (!this._quickAddInDayMode) {
        this._quickAddInDayMode = true;
        gsap.set(btn, { right: 'auto', left: window.innerWidth - 52, xPercent: -50 });
        if (tBtn) gsap.set(tBtn, { xPercent: -50, left: tBtnLeft, opacity: 0 });
        if (cBtn) gsap.set(cBtn, { xPercent: -50, left: cBtnLeft, opacity: 0 });
      }

      // Add button: move to anchor (left-aligned group), expand to pill
      gsap.to(btn, { left: anchorX, bottom: 32, duration: 0.32, ease: 'expo.out', overwrite: 'auto' });
      gsap.to(btn, { width: 220, duration: 0.22, delay: 0.1, ease: 'expo.out', overwrite: false });
      if (label) gsap.to(label, { width: 160, opacity: 1, duration: 0.18, delay: 0.22, ease: 'power2.out', overwrite: 'auto' });
      setTimeout(() => btn.classList.add('pill'), 320);

      // Template button: slide in to the right of add button
      if (tBtn) {
        gsap.to(tBtn, { left: tBtnLeft, bottom: 32, opacity: 1, duration: 0.28, delay: 0.2, ease: 'expo.out', overwrite: 'auto' });
        setTimeout(() => { if (tBtn) tBtn.style.pointerEvents = 'auto'; }, 480);
      }
      // Clear day button: slide in to the left of add button
      if (cBtn) {
        gsap.to(cBtn, { left: cBtnLeft, bottom: 32, opacity: 1, duration: 0.28, delay: 0.2, ease: 'expo.out', overwrite: 'auto' });
        setTimeout(() => { if (cBtn) cBtn.style.pointerEvents = 'auto'; }, 480);
      }

    } else {
      if (!this._quickAddInDayMode) return;
      this._quickAddInDayMode = false;
      btn.classList.remove('pill');

      // Hide satellite buttons
      if (tBtn) {
        tBtn.style.pointerEvents = 'none';
        gsap.to(tBtn, { opacity: 0, duration: 0.15, ease: 'power2.in', overwrite: 'auto' });
      }
      if (cBtn) {
        cBtn.style.pointerEvents = 'none';
        gsap.to(cBtn, { opacity: 0, duration: 0.15, ease: 'power2.in', overwrite: 'auto' });
      }

      if (isMobile) {
        gsap.set(btn, { clearProps: 'left,bottom,xPercent,right,width' });
        setTimeout(() => {
          if (tBtn) gsap.set(tBtn, { clearProps: 'left,bottom,right,xPercent,width' });
          if (cBtn) gsap.set(cBtn, { clearProps: 'left,bottom,right,xPercent,width' });
        }, 200);
        return;
      }

      if (label) gsap.to(label, { width: 0, opacity: 0, duration: 0.12, ease: 'power2.in', overwrite: 'auto' });
      gsap.to(btn, { width: 56, duration: 0.15, delay: 0.08, ease: 'power2.in', overwrite: 'auto' });
      gsap.to(btn, {
        left: window.innerWidth - 52,
        bottom: 24,
        duration: 0.2,
        delay: 0.1,
        ease: 'expo.in',
        overwrite: false,
        onComplete: () => gsap.set(btn, { clearProps: 'left,bottom,xPercent,right,width' })
      });
    }
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
          snapshot(state.todos);
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

  clearAllSuggestedTasks() {
    clearAllSuggestedTasks();
  }

  clearAllCalendarData() {
    clearAllCalendarData();
    this.render();
  }

  showAdminSection(id) {
    showAdminSection(id);
  }

  // ═══════════════════════════════════════════════════
  // TEMPLATES
  // ═══════════════════════════════════════════════════
  openTemplateModal(dateStr) { openTemplateModal(dateStr || DS(state.navDate)); }
  closeTemplateModal() { closeTemplateModal(); }
  applyTemplate(templateId, dateStr) {
    applyTemplate(templateId, dateStr, state.todos);
    saveTodos(state.todos);
    this.render();
  }
  addTemplate() { addTemplate(); }
  removeTemplate(id) { removeTemplate(id); }
  addTaskToTemplate(id) { addTaskToTemplate(id); }
  removeTaskFromTemplate(id, idx) { removeTaskFromTemplate(id, idx); }

  // ═══════════════════════════════════════════════════
  // CATEGORIES
  // ═══════════════════════════════════════════════════
  addCategory() { addCategory(); }

  addCategoryFromView() {
    const name = prompt('Nom de la catégorie :');
    if (!name || !name.trim()) return;
    const colors = ['#f59e0b','#3b82f6','#10b981','#ef4444','#8b5cf6','#f97316','#06b6d4','#ec4899'];
    const categories = getCategories();
    categories.push({ id: Date.now().toString(), name: name.trim(), color: colors[categories.length % colors.length] });
    saveCategories(categories);
    this.render();
  }

  removeCategory(id) {
    // Clear task links before removing
    snapshot(state.todos);
    state.todos.forEach(t => { if (t.projectId === id) delete t.projectId; });
    saveTodos(state.todos);
    removeCategory(id);
    this.render();
  }

  getCategories() { return getCategories(); }

  openCategoryView(id) { openCategoryView(id); }
  closeCategoryView()  { closeCategoryView(); }

  setCategoryColor(categoryId, color) {
    const categories = getCategories();
    const cat = categories.find(p => p.id === categoryId);
    if (cat) { cat.color = color; saveCategories(categories); }
    renderCategoryPanel(categoryId);
    this.render();
  }

  saveCategoryName(categoryId, name) {
    if (!name.trim()) return;
    const categories = getCategories();
    const cat = categories.find(p => p.id === categoryId);
    if (cat && cat.name !== name.trim()) { cat.name = name.trim(); saveCategories(categories); }
    renderCategoryPanel(categoryId);
    this.render();
  }

  saveCategoryDescription(categoryId, description) {
    saveCategoryDescription(categoryId, description);
    this.render();
  }

  setCategoryIcon(categoryId, icon) {
    setCategoryIcon(categoryId, icon);
    this.render();
  }

  setCategoriesCols(n) {
    localStorage.setItem('categoriesCols', n);
    this.render();
  }

  setCategoriesSort(s) {
    localStorage.setItem('categoriesSort', s);
    this.render();
  }

  deleteCategory(id) {
    if (!confirm('Supprimer cette catégorie ? Les tâches seront dissociées mais conservées.')) return;
    closeCategoryView();
    this.removeCategory(id);
  }

  reorderCategoryTask(id, categoryId, direction) {
    const tasks = state.todos.filter(t => t.projectId === categoryId);
    let order = getCategoryTaskOrder(categoryId);
    tasks.forEach(t => { if (!order.includes(t.id)) order.push(t.id); });
    order = order.filter(oid => tasks.some(t => t.id === oid));
    const idx = order.indexOf(id);
    if (idx < 0) return;
    const newIdx = idx + parseInt(direction);
    if (newIdx < 0 || newIdx >= order.length) return;
    [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
    saveCategoryTaskOrder(categoryId, order);
    renderCategoryPanel(categoryId);
  }

  openModalForCategory(categoryId) {
    closeCategoryView({ immediate: true });
    openModal(state.navDate, state.todos);
    setTimeout(() => {
      const sel = document.getElementById('taskCategory');
      if (sel) sel.value = categoryId;
    }, 60);
  }

  unlinkFromCategory(id) {
    snapshot(state.todos);
    const t = state.todos.find(x => x.id === id);
    if (t) { delete t.projectId; saveTodos(state.todos); }
    this._refreshCategoryPanel();
    this.render();
  }

  selectPriority(p) { selectPriority(p); }

  // ═══════════════════════════════════════════════════
  // HAMBURGER MENU
  // ═══════════════════════════════════════════════════
  _hamburgerOpen = false;

  toggleHamburger() {
    this._hamburgerOpen ? this.closeHamburger() : this.openHamburger();
  }

  openHamburger() {
    this._hamburgerOpen = true;
    const btn = document.getElementById('hamburgerBtn');
    const menu = document.getElementById('hamburgerMenu');
    const overlay = document.getElementById('hamburgerOverlay');
    btn.classList.add('open');
    overlay.classList.add('open');
    gsap.to(menu, { x: 0, duration: 0.36, ease: 'expo.out' });
    gsap.fromTo(menu.querySelectorAll('.hm-item'),
      { x: 20, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.28, stagger: 0.06, ease: 'power3.out', delay: 0.1 }
    );
  }

  closeHamburger() {
    if (!this._hamburgerOpen) return;
    this._hamburgerOpen = false;
    const btn = document.getElementById('hamburgerBtn');
    const menu = document.getElementById('hamburgerMenu');
    const overlay = document.getElementById('hamburgerOverlay');
    btn.classList.remove('open');
    overlay.classList.remove('open');
    gsap.to(menu, { x: '100%', duration: 0.28, ease: 'power3.in' });
  }

  hmGoToCategories() {
    this.closeHamburger();
    this.setView('categories');
  }

  hmOpenAdmin(section) {
    this.closeHamburger();
    openAdminModal();
    setTimeout(() => showAdminSection(section), 50);
  }

  // ═══════════════════════════════════════════════════
  // FIREBASE — auth & sync
  // ═══════════════════════════════════════════════════
  async _initFirebase() {
    // 1. Wait for Firebase to restore the previous session (or get null)
    const user = await initAuth();

    // 2. No session → sign in as guest automatically
    if (!user) await signInGuest();

    // 3. Merge Firestore data into the app (first load)
    await this._syncFirebase();

    // 4. Listen for realtime updates from other devices (guard against re-init)
    if (this._firestoreUnsub) this._firestoreUnsub();
    this._firestoreUnsub = subscribeToFirestore(backup => {
      this._applyBackup(backup, { silent: true });
    });

    // 5. Update user button on every auth state change
    onUserChange(() => this._updateUserBtn());
    this._updateUserBtn();

    // 6. Leave prompt for guests
    this._setupLeavePrompt();
  }

  async _syncFirebase() {
    const backup = await loadFromFirestore();
    if (!backup) {
      // Nothing in Firestore yet → push current localStorage data up
      await pushToFirestore(getFullBackup(state.todos));
      return;
    }

    // If local data was written more recently than Firestore, local wins.
    // Covers: task created offline, or push not yet confirmed before refresh.
    const localWriteTime = parseInt(localStorage.getItem('_localWriteTime') || '0');
    const firestoreTime  = backup._firestoreUpdatedAt || 0;
    if (localWriteTime > firestoreTime) {
      await pushToFirestore(getFullBackup(state.todos));
      return;
    }

    const { _firestoreUpdatedAt, ...cleanBackup } = backup;
    this._applyBackup(cleanBackup, { silent: false });
  }

  // Merge a backup object into the app state (from Firestore or server)
  _applyBackup(backup, { silent }) {
    let changed = false;

    if (backup.calendar) {
      const localJSON = JSON.stringify(state.todos);
      const remoteJSON = JSON.stringify(backup.calendar);
      if (localJSON !== remoteJSON) {
        state.setTodos(backup.calendar);
        localStorage.setItem('todos', remoteJSON);
        changed = true;
      }
    }
    if (backup.categories)     localStorage.setItem('projects',          JSON.stringify(backup.categories));
    if (backup.templates)      localStorage.setItem('dayTemplates',      JSON.stringify(backup.templates));
    if (backup.suggestedTasks) localStorage.setItem('suggestedTasks',    JSON.stringify(backup.suggestedTasks));
    if (backup.taskOrder)      localStorage.setItem('projectTaskOrder',  JSON.stringify(backup.taskOrder));
    if (backup.config) {
      if (backup.config.theme) localStorage.setItem('theme', backup.config.theme);
      if (backup.config.zoom)  localStorage.setItem('zoom',  backup.config.zoom);
      if (backup.config.lang)  localStorage.setItem('lang',  backup.config.lang);
    }

    if (changed && !silent) this.render();
  }

  _updateUserBtn() {
    const user       = getCurrentUser();
    const btn        = document.getElementById('userBtn');
    const logoAvatar = document.getElementById('logoAvatar');
    if (!btn && !logoAvatar) return;
    const guest = !!user?.isAnonymous;

    if (btn) {
      btn.classList.toggle('authenticated', !!user && !guest);
      btn.title = guest ? 'Invité — cliquer pour créer un compte' : (user?.email || 'Mon compte');
    }

    let avatarData = null;
    try { avatarData = JSON.parse(localStorage.getItem('profileAvatar')); } catch {}

    const defaultLogoSVG = `<svg class="logo-mark" width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="26" height="26" rx="7" fill="var(--primary)"/><path d="M7 13.5L11 17.5L19 9" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const defaultBtnSVG  = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`;

    if (avatarData?.type === 'emoji' && avatarData.value) {
      if (logoAvatar) {
        logoAvatar.classList.add('logo-avatar--has-avatar');
        logoAvatar.innerHTML = `<span class="logo-avatar-emoji">${avatarData.value}</span>`;
      }
      if (btn) { btn.classList.add('user-btn--has-avatar'); btn.innerHTML = `<span class="user-btn-emoji">${avatarData.value}</span>`; }
    } else if (avatarData?.type === 'photo' && avatarData.data) {
      const f = FILTERS.find(f => f.id === avatarData.filter);
      const styleAttr = (f?.css && !f.canvas) ? ` style="filter:${f.css}"` : '';
      if (logoAvatar) {
        logoAvatar.classList.add('logo-avatar--has-avatar');
        logoAvatar.innerHTML = `<img src="${avatarData.data}" class="logo-avatar-photo"${styleAttr}>`;
      }
      if (btn) { btn.classList.add('user-btn--has-avatar'); btn.innerHTML = `<img src="${avatarData.data}" class="user-btn-photo"${styleAttr}>`; }
    } else {
      if (logoAvatar) { logoAvatar.classList.remove('logo-avatar--has-avatar'); logoAvatar.innerHTML = defaultLogoSVG; }
      if (btn) { btn.classList.remove('user-btn--has-avatar'); btn.innerHTML = defaultBtnSVG; }
    }
  }

  openUserArea() {
    if (isGuest()) this.openAuthModal();
    else           this.setView('profile');
  }

  _leavingAttempted = null;

  _setupLeavePrompt() {
    window.addEventListener('beforeunload', e => {
      if (!isGuest()) return;
      this._leavingAttempted = Date.now();
      e.preventDefault();
      e.returnValue = '';
    });
    window.addEventListener('focus', () => {
      if (this._leavingAttempted && Date.now() - this._leavingAttempted < 10000 && isGuest()) {
        this._leavingAttempted = null;
        this.showLeavePrompt();
      }
    });
  }

  showLeavePrompt() {
    document.getElementById('leavePromptOverlay').classList.remove('hidden');
  }

  closeLeavePrompt() {
    document.getElementById('leavePromptOverlay').classList.add('hidden');
  }

  leaveKeepData() {
    this.closeLeavePrompt();
  }

  async leaveDeleteData() {
    // Delete Firestore doc
    await deleteUserFirestoreDoc();
    // Clear all app localStorage keys
    Object.keys(localStorage)
      .filter(k => !k.startsWith('firebase:'))
      .forEach(k => localStorage.removeItem(k));
    // Get fresh anonymous session
    await signOut();
    this.closeLeavePrompt();
    this.render();
  }

  // ── Auth modal ────────────────────────────────────────
  _authMode = 'login'; // 'login' | 'register'

  openAuthModal() {
    const user = getCurrentUser();
    const panelUser = document.getElementById('authPanelUser');
    const panelForm = document.getElementById('authPanelForm');

    const showUserPanel = user && !user.isAnonymous;
    const showGuestPanel = user?.isAnonymous;
    // showForm = no user at all (shouldn't normally happen since we always sign in as guest)

    panelUser.classList.toggle('hidden', !showUserPanel && !showGuestPanel);
    panelForm.classList.toggle('hidden',  showUserPanel || showGuestPanel);

    if (showUserPanel) {
      document.getElementById('authUserName').textContent = user.email || 'Utilisateur';
      document.getElementById('authUserSub').textContent  = 'Compte connecté';
      document.getElementById('authAvatar').textContent   = '✓';
      document.getElementById('authUpgradeSection').classList.add('hidden');
    } else if (showGuestPanel) {
      document.getElementById('authUserName').textContent = 'Invité';
      document.getElementById('authUserSub').textContent  = 'Session temporaire · uid: ' + user.uid.slice(0, 8) + '…';
      document.getElementById('authAvatar').textContent   = '👤';
      document.getElementById('authUpgradeSection').classList.remove('hidden');
    }

    document.getElementById('authModalOverlay').classList.remove('hidden');
    document.getElementById('authError').classList.add('hidden');
    document.getElementById('authEmail').value    = '';
    document.getElementById('authPassword').value = '';
  }

  showAuthRegister() {
    const panelUser = document.getElementById('authPanelUser');
    const panelForm = document.getElementById('authPanelForm');
    panelUser.classList.add('hidden');
    panelForm.classList.remove('hidden');
    this._authMode = 'register';
    this._updateAuthFormLabels();
  }

  closeAuthModal() {
    document.getElementById('authModalOverlay').classList.add('hidden');
  }

  authToggleMode() {
    this._authMode = this._authMode === 'login' ? 'register' : 'login';
    this._updateAuthFormLabels();
  }

  _updateAuthFormLabels() {
    const isRegister = this._authMode === 'register';
    document.getElementById('authFormTitle').textContent   = isRegister ? 'Créer un compte' : 'Se connecter';
    document.getElementById('authSubmitBtn').textContent   = isRegister ? 'Créer mon compte' : 'Se connecter';
    document.getElementById('authSwitchText').textContent  = isRegister ? 'Déjà un compte ?' : 'Pas encore de compte ?';
    document.getElementById('authSwitchBtn').textContent   = isRegister ? 'Se connecter' : 'Créer un compte';
    document.getElementById('authError').classList.add('hidden');
  }

  async authSubmit() {
    const email    = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const errEl    = document.getElementById('authError');
    errEl.classList.add('hidden');

    if (!email || !password) {
      errEl.textContent = 'Veuillez remplir tous les champs.';
      errEl.classList.remove('hidden');
      return;
    }

    try {
      if (this._authMode === 'register') {
        const user = getCurrentUser();
        if (user?.isAnonymous) {
          // Upgrade the guest account → same uid, data preserved
          await upgradeGuestToEmail(email, password);
        } else {
          await registerWithEmail(email, password);
        }
      } else {
        await signInWithEmail(email, password);
        // Pull the newly logged-in user's data from Firestore
        await this._syncFirebase();
      }
      this.closeAuthModal();
      this._updateUserBtn();
      this.render();
    } catch (err) {
      errEl.textContent = this._firebaseErrorMessage(err.code);
      errEl.classList.remove('hidden');
    }
  }

  authContinueAsGuest() {
    this.closeAuthModal();
  }

  async authSignOut() {
    await signOut(); // re-signs in as guest automatically
    this.closeAuthModal();
    this._updateUserBtn();
  }

  // ── Upgrade prompt (shown to guests proactively) ──────
  showUpgradePrompt() {
    document.getElementById('upgradePromptOverlay').classList.remove('hidden');
    document.getElementById('upgradeError').classList.add('hidden');
    document.getElementById('upgradeEmail').value    = '';
    document.getElementById('upgradePassword').value = '';
  }

  async upgradeSubmit() {
    const email    = document.getElementById('upgradeEmail').value.trim();
    const password = document.getElementById('upgradePassword').value;
    const errEl    = document.getElementById('upgradeError');
    errEl.classList.add('hidden');

    if (!email || !password) {
      errEl.textContent = 'Veuillez remplir tous les champs.';
      errEl.classList.remove('hidden');
      return;
    }

    try {
      await upgradeGuestToEmail(email, password);
      document.getElementById('upgradePromptOverlay').classList.add('hidden');
      this._updateUserBtn();
    } catch (err) {
      errEl.textContent = this._firebaseErrorMessage(err.code);
      errEl.classList.remove('hidden');
    }
  }

  upgradeDismiss() {
    document.getElementById('upgradePromptOverlay').classList.add('hidden');
  }

  _firebaseErrorMessage(code) {
    const messages = {
      'auth/email-already-in-use':    'Cet email est déjà utilisé.',
      'auth/invalid-email':           'Email invalide.',
      'auth/weak-password':           'Mot de passe trop faible (minimum 6 caractères).',
      'auth/wrong-password':          'Mot de passe incorrect.',
      'auth/user-not-found':          'Aucun compte associé à cet email.',
      'auth/too-many-requests':       'Trop de tentatives. Réessayez plus tard.',
      'auth/credential-already-in-use': 'Cet email est déjà associé à un autre compte.',
      'auth/network-request-failed':  'Erreur réseau. Vérifiez votre connexion.',
    };
    return messages[code] || 'Une erreur est survenue. Veuillez réessayer.';
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
