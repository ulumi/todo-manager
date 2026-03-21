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
  loadFromServer, saveBackupToServer, getFullBackup, initCrossTabSync
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
  toggleCloudSection, toggleModalRight, selectPriority,
  toggleNewCatRow, addCategoryInline, selectScheduleMode, toggleDetailSection,
  cancelModal, clearDraft, discardDraft
} from './modules/modal.js';
import {
  todoItemHTML, renderDayView, renderWeekView, renderMonthView, renderYearView,
  renderCategoriesView, renderInboxView, renderBacklogView, getInboxCount, getBacklogCount,
  getPeriodLabel, getCloudsHTML, renderQACloud, setupTodoItemHoverAnimations,
  renderSidebar, renderWeekSidebar, renderYearSidebar,
  renderPlanInboxList, renderProjectsView,
} from './modules/render.js';
import { setupEventListeners } from './modules/events.js';
import { celebrate } from './modules/celebrate.js';
import { VERSION } from './modules/version.js';
import { openAdminModal, closeAdminModal, showAdminSection, addSuggestedTask, removeSuggestedTask, moveSuggestedTask, clearAllSuggestedTasks, clearAllCalendarData, openTemplateModal, closeTemplateModal, applyTemplate, addTemplate, removeTemplate, addTaskToTemplate, removeTaskFromTemplate, addCategory, removeCategory, getCategories, saveCategories, renderAdminICal } from './modules/admin.js';
import {
  openCategoryView, closeCategoryView, renderCategoryPanel,
  getCurrentCategoryId, getCategoryTaskOrder, saveCategoryTaskOrder,
  saveCategoryDescription, setCategoryIcon,
} from './modules/projectView.js';
import {
  getProjects, saveProjects, addProjectItem, deleteProjectItem, updateProjectItem,
  openProjectPanel, closeProjectPanel, renderProjectPanel, getCurrentProjectId,
} from './modules/projectManager.js';
import { snapshot, undo, canUndo } from './modules/undo.js';
import {
  initAuth, onUserChange, isGuest, getCurrentUser,
  signInGuest, signInWithEmail, registerWithEmail,
  upgradeGuestToEmail, signOut, updateUserProfile,
  signInWithGoogle, signInWithFacebook, getIdToken,
} from './modules/auth.js';
import { loadFromFirestore, pushToFirestore, subscribeToFirestore, setupOfflineIndicator, deleteUserFirestoreDoc, SESSION_ID, getOrCreateICalToken, disconnectGCal } from './modules/sync.js';
import { initPresence, destroyPresence, markAllMessagesRead, sendUserMessage, updatePresenceName } from './modules/presence.js';
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
    const todos = loadTodos();
    // Migration: recurring tasks without startDate get one derived from their ID (creation timestamp)
    let migrated = false;
    todos.forEach(t => {
      if (t.recurrence && t.recurrence !== 'none' && !t.startDate) {
        t.startDate = DS(new Date(parseInt(t.id)));
        migrated = true;
      }
    });
    if (migrated) saveTodos(todos);
    state.setTodos(todos);
    this.applyZoom();
    this.initTheme();
    this.applyLang();
    // Restore saved view
    const savedView = localStorage.getItem('view');
    if (savedView && ['day', 'week', 'month', 'year', 'categories', 'inbox', 'backlog', 'plan', 'projects'].includes(savedView)) {
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
    initCrossTabSync((key, raw) => {
      switch (key) {
        case 'todos':
          try { state.setTodos(JSON.parse(raw)); this.render(); } catch (_) {}
          break;
        case 'theme':
          document.documentElement.setAttribute('data-theme', raw);
          this.updateThemeBtn();
          break;
        case 'zoom':
          this.zoomIdx = parseInt(raw, 10);
          this.applyZoom();
          break;
        case 'lang':
          state.setLang(raw);
          this.applyLang();
          this.render();
          break;
        case 'projects':
        case 'dayTemplates':
        case 'suggestedTasks':
        case 'projectTaskOrder':
        case 'categoriesCols':
        case 'categoriesSort':
          this.render();
          break;
        case 'profileAvatar':
          this._updateUserBtn();
          break;
      }
    });
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
      if (backup.config.theme)    localStorage.setItem('theme',    backup.config.theme);
      if (backup.config.zoom)     localStorage.setItem('zoom',     backup.config.zoom);
      if (backup.config.lang)        localStorage.setItem('lang',        backup.config.lang);
      if (backup.config.timezone)    localStorage.setItem('timezone',    backup.config.timezone);
      if (backup.config.icalHour)    localStorage.setItem('icalHour',    backup.config.icalHour);
      if (backup.config.icalFilters) localStorage.setItem('icalFilters', JSON.stringify(backup.config.icalFilters));
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
    if (state.view==='week')  d.setDate(d.getDate()+delta*14);
    if (state.view==='month') d.setMonth(d.getMonth()+delta);
    if (state.view==='year')  d.setFullYear(d.getFullYear()+delta);
    if (state.view==='plan') {
      const planMode = localStorage.getItem('planMode') || 'week';
      if (planMode === 'month')  d.setMonth(d.getMonth() + delta);
      else if (planMode === 'biweek') d.setDate(d.getDate() + delta * 14);
      else                            d.setDate(d.getDate() + delta * 7);
    }
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
    if (v === 'day') {
      state.setNavDate(today());
    }
    localStorage.setItem('view', v);
    this._pushHistory();
    await this._animateViewChange();
    this._updateInboxBadge();
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
      ease: (isDay || isMonth) && delta ? 'expo.out' : 'power2.out',
      onComplete: () => gsap.set(main, { clearProps: 'x,y,opacity,transform' })
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

  openModalForInbox() {
    openModal(state.navDate, state.todos, 'inbox');
  }

  selectScheduleMode(mode) {
    selectScheduleMode(mode);
  }

  toggleDetailSection(headerEl) {
    toggleDetailSection(headerEl);
  }

  cancelModal() {
    cancelModal();
  }

  clearDraft() {
    clearDraft();
  }

  discardDraft() {
    discardDraft();
  }

  closeModal() {
    closeModal();
  }

  openEditModal(id, dateStr) {
    openEditModal(id, dateStr, state.todos);
  }

  // ═══════════════════════════════════════════════════
  // INBOX
  // ═══════════════════════════════════════════════════
  _updateInboxBadge() {
    const count = getInboxCount(state.todos);
    const badge = document.getElementById('inboxBadge');
    if (badge) {
      badge.textContent = count;
      badge.classList.toggle('hidden', count === 0);
    }
    const backlogCount = getBacklogCount(state.todos);
    const backlogBadge = document.getElementById('backlogBadge');
    if (backlogBadge) { backlogBadge.textContent = backlogCount; backlogBadge.classList.toggle('hidden', backlogCount === 0); }
  }

  assignInboxToday(id) {
    const t = state.todos.find(x => x.id === id);
    if (!t) return;
    snapshot(state.todos);
    t.date = DS(today());
    saveTodos(state.todos);
    this.render();
  }

  assignInboxToDate(id, dateStr) {
    const t = state.todos.find(x => x.id === id);
    if (!t) return;
    snapshot(state.todos);
    t.date = dateStr;
    t.backlog = false;
    saveTodos(state.todos);
    this.render();
  }

  toggleInboxDone(id) {
    const t = state.todos.find(x => x.id === id);
    if (!t) return;
    snapshot(state.todos);
    t.completed = !t.completed;
    saveTodos(state.todos);
    if (!t.completed) celebrate(state.lang);
    this.render();
  }

  setInboxSort(sort) {
    localStorage.setItem('inboxSort', sort);
    this.render();
  }

  setBacklogSort(sort) {
    localStorage.setItem('backlogSort', sort);
    this.render();
  }

  setPlanSort(sort) {
    localStorage.setItem('planSort', sort);
    const col = document.getElementById('planInboxCol');
    if (col) { col.innerHTML = renderPlanInboxList(state.todos); this.initPlanDragDrop(); }
  }

  quickEditInboxTitle(el, id) {
    this.quickEditTitle(el, id, null);
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
    if (clone.recurrence && clone.recurrence !== 'none') {
      clone.startDate = ds;
      delete clone.endDate;
      delete clone.excludedDates;
    } else {
      clone.date = ds;
    }
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
    const view = document.querySelector('.week-view');
    if (!view) return;
    let draggedId = null, draggedDate = null, draggedHeight = 0;
    let placeholder = null, dropTargetId = null, dropBefore = false;

    const removePlaceholder = () => {
      if (placeholder) { placeholder.remove(); placeholder = null; }
      dropTargetId = null;
    };

    const getOrCreatePlaceholder = (height) => {
      if (!placeholder) {
        placeholder = document.createElement('div');
        placeholder.className = 'week-drop-placeholder';
        placeholder.style.height = height + 'px';
      }
      return placeholder;
    };

    view.addEventListener('dragstart', e => {
      const item = e.target.closest('.week-todo-item[draggable]');
      if (!item) return;
      draggedId = item.dataset.id;
      draggedDate = item.dataset.date;
      draggedHeight = item.offsetHeight;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggedId);
      requestAnimationFrame(() => item.classList.add('dragging'));
    });

    view.addEventListener('dragend', e => {
      const item = e.target.closest('.week-todo-item');
      if (item) item.classList.remove('dragging');
      draggedId = null; draggedDate = null;
      removePlaceholder();
    });

    view.addEventListener('dragover', e => {
      e.preventDefault();
      if (!draggedId) return;
      const ph = getOrCreatePlaceholder(draggedHeight);

      // Hovering over another todo item → insert before/after it
      const targetItem = e.target.closest('.week-todo-item[draggable]');
      if (targetItem && targetItem.dataset.id !== draggedId) {
        const rect = targetItem.getBoundingClientRect();
        dropBefore = e.clientY < rect.top + rect.height / 2;
        dropTargetId = targetItem.dataset.id;
        if (dropBefore) targetItem.parentNode.insertBefore(ph, targetItem);
        else targetItem.parentNode.insertBefore(ph, targetItem.nextSibling);
        return;
      }

      // Hovering over a column (no item target) → append at end
      const col = e.target.closest('.week-day-todos');
      if (col && !col.contains(e.target.closest('.week-todo-item'))) {
        dropTargetId = null;
        col.appendChild(ph);
      }
    });

    view.addEventListener('drop', e => {
      e.preventDefault();
      removePlaceholder();
      if (!draggedId) return;

      if (dropTargetId) {
        // Reorder within same day or move + reorder to another day
        const targetItem = view.querySelector(`.week-todo-item[data-id="${dropTargetId}"]`);
        const newDate = targetItem?.dataset.date;
        if (newDate && newDate !== draggedDate) {
          this.moveTodoToDate(draggedId, newDate);
        } else if (newDate) {
          this.weekReorder(draggedId, newDate, dropTargetId, dropBefore);
        }
      } else {
        // Dropped on empty column area
        const col = e.target.closest('.week-day-todos');
        if (!col || !col.dataset.date) return;
        const newDate = col.dataset.date;
        if (newDate !== draggedDate) this.moveTodoToDate(draggedId, newDate);
      }
    });
  }

  weekReorder(draggedId, dateStr, targetId, before) {
    if (draggedId === targetId) return;
    const d = new Date(dateStr + 'T00:00:00');
    const items = getTodosForDate(d, state.todos).filter(t => !t.recurrence || t.recurrence === 'none');
    let order = this.dayOrder[dateStr] ? [...this.dayOrder[dateStr]] : items.map(t => t.id);
    items.forEach(t => { if (!order.includes(t.id)) order.push(t.id); });
    order = order.filter(id => items.some(t => t.id === id));
    const newOrder = order.filter(id => id !== draggedId);
    const idx = newOrder.indexOf(targetId);
    if (idx < 0) return;
    newOrder.splice(before ? idx : idx + 1, 0, draggedId);
    this.dayOrder[dateStr] = newOrder;
    localStorage.setItem('dayOrder', JSON.stringify(this.dayOrder));
    this.render();
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

  initDayMiniWeekDragDrop() {
    const miniWeek = document.querySelector('.day-mini-week');
    if (!miniWeek) return;

    const clearHover = () => miniWeek.querySelectorAll('.day-mini-col.drag-over').forEach(el => el.classList.remove('drag-over'));

    miniWeek.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const col = e.target.closest('.day-mini-col[data-date]');
      clearHover();
      if (col) col.classList.add('drag-over');
    });

    miniWeek.addEventListener('dragleave', e => {
      if (!miniWeek.contains(e.relatedTarget)) clearHover();
    });

    miniWeek.addEventListener('drop', e => {
      e.preventDefault();
      clearHover();
      const col = e.target.closest('.day-mini-col[data-date]');
      if (!col) return;
      const draggedId = e.dataTransfer.getData('text/plain');
      if (!draggedId) return;
      this.moveTodoToDate(draggedId, col.dataset.date);
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

  // Legacy — kept as no-op to avoid errors from old cached HTML calls
  getICalSubscriptionURL() { return ''; }
  copyICalSubscriptionLink() { this.setView('profile'); }

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
        if (data.config.theme)    localStorage.setItem('theme',    data.config.theme);
        if (data.config.zoom)     localStorage.setItem('zoom',     data.config.zoom);
        if (data.config.lang)        localStorage.setItem('lang',        data.config.lang);
        if (data.config.timezone)    localStorage.setItem('timezone',    data.config.timezone);
        if (data.config.icalHour)    localStorage.setItem('icalHour',    data.config.icalHour);
        if (data.config.icalFilters) localStorage.setItem('icalFilters', JSON.stringify(data.config.icalFilters));
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
    const isProjects   = state.view === 'projects';
    const isProfile    = state.view === 'profile';
    const isInbox      = state.view === 'inbox';
    const isBacklog    = state.view === 'backlog';
    const isPlan       = state.view === 'plan';
    document.body.classList.toggle('view-projects', isCategories || isProjects);
    document.body.classList.toggle('view-profile',  isProfile);
    document.body.classList.toggle('view-inbox',    isInbox);
    document.body.classList.toggle('view-backlog',  isBacklog);
    document.body.classList.toggle('view-plan',     isPlan);
    const noLabel = isCategories || isProjects || isProfile || isInbox || isBacklog || isPlan;
    document.getElementById('periodLabel').textContent = noLabel ? '' : getPeriodLabel();
    document.querySelectorAll('.view-tab').forEach(b => b.classList.toggle('active', b.dataset.view===state.view));
    this._updateInboxBadge();
    // Close project panel when switching away
    if (!isProjects && getCurrentProjectId()) closeProjectPanel({ immediate: true });

    let html = '';
    if (state.view==='day')        html = renderDayView(state.todos);
    if (state.view==='week')       html = renderWeekView(state.todos);
    if (state.view==='month')      html = renderMonthView(state.todos);
    if (state.view==='year')       html = renderYearView(state.todos);
    if (state.view==='categories') html = renderCategoriesView(state.todos);
    if (state.view==='projects')   html = renderProjectsView();
    if (state.view==='inbox')      html = renderInboxView(state.todos);
    if (state.view==='backlog')    html = renderBacklogView(state.todos);
    if (state.view==='plan')       html = this._renderPlanView();
    if (state.view==='profile')    html = this._renderProfileView();
    const isPlanMonth = state.view === 'plan' && (localStorage.getItem('planMode')||'week') === 'month';
    if (isPlanMonth) { const s = document.getElementById('planMonthScroll'); if (s) this._planMonthScrollSaved = s.scrollTop; }
    if (!isPlanMonth && this._planMonthIO) { this._planMonthIO.disconnect(); this._planMonthIO = null; }
    document.getElementById('mainContent').innerHTML = html;
    if (isPlanMonth) this._setupPlanMonth();
    const sidebar = document.getElementById('calSidebar');
    if (sidebar) {
      const hiddenViews = ['plan', 'categories', 'projects', 'inbox', 'backlog', 'profile'];
      if (hiddenViews.includes(state.view)) {
        sidebar.style.display = 'none';
        sidebar.innerHTML = '';
      } else {
        sidebar.style.display = '';
        if (state.view === 'week' || state.view === 'biweek') {
          sidebar.innerHTML = renderWeekSidebar(state.todos);
        } else if (state.view === 'year') {
          sidebar.innerHTML = renderYearSidebar();
        } else {
          sidebar.innerHTML = renderSidebar(state.todos);
        }
      }
    }
    if (state.view === 'day') { this.initDayDragDrop(); this.initDayMiniWeekDragDrop(); }
    if (state.view === 'week') this.initWeekDragDrop();
    if (state.view === 'month') this.initMonthDragDrop();
    if (state.view === 'plan') this.initPlanDragDrop();
    this.renderQACloud();
    this._animateQuickAddBtn();
    this._applyMultilineClasses();
  }

  _renderPlanView() {
    const leftWidth = localStorage.getItem('planInboxWidth') || '260';
    return `<div class="plan-view">
      <div class="plan-inbox-col" id="planInboxCol" style="width:${leftWidth}px">
        ${renderPlanInboxList(state.todos)}
      </div>
      <div class="plan-resize-handle" id="planResizeHandle" title="Redimensionner"></div>
      <div class="plan-week-col${(localStorage.getItem('planMode')||'week')==='month'?' plan-month-mode':''}">
        ${this._renderPlanCalendar()}
      </div>
    </div>`;
  }

  _getPlanRecFilter() {
    const defaults = { daily: false, weekly: false, monthly: true, yearly: true, none: true };
    try {
      const stored = localStorage.getItem('planRecFilter');
      return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
    } catch { return defaults; }
  }

  togglePlanRecFilter(key) {
    const f = this._getPlanRecFilter();
    f[key] = !f[key];
    localStorage.setItem('planRecFilter', JSON.stringify(f));
    this.render();
  }

  _renderPlanCalendar() {
    const mode = localStorage.getItem('planMode') || 'week';
    const filter = this._getPlanRecFilter();
    const todayStr = DS(new Date());

    const modeBtns = [
      ['week',   'Sem.'],
      ['biweek', '2 Sem.'],
      ['month',  'Mois'],
    ].map(([m, l]) =>
      `<button class="plan-mode-btn${mode===m?' active':''}" onclick="window.app.setPlanMode('${m}')">${l}</button>`
    ).join('');

    const recToggles = [
      ['none',    'Ponctuel'],
      ['daily',   'Quotidien'],
      ['weekly',  'Hebdomadaire'],
      ['monthly', 'Mensuel'],
      ['yearly',  'Annuel'],
    ].map(([k, l]) =>
      `<button class="plan-rec-btn${filter[k]?' active':''}" onclick="window.app.togglePlanRecFilter('${k}')" title="${k}">${l}</button>`
    ).join('');

    const todayBtn = `<button class="plan-today-btn" onclick="window.app.planScrollToToday()">Aujourd'hui</button>`;
    const navSvgL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
    const navSvgR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

    if (mode === 'month') {
      const dayNames = state.DAYS.map(d => `<div class="plan-month-dayname">${d}</div>`).join('');
      return `<div class="plan-toolbar">
        ${todayBtn}
        <div class="plan-mode-btns">${modeBtns}</div>
        <div class="plan-toolbar-sep"></div>
        <div class="plan-rec-pills">${recToggles}</div>
      </div>
      <div class="plan-month-daynames">${dayNames}</div>
      <div class="plan-month-scroll" id="planMonthScroll">
        <div id="planMonthTop" style="height:1px;flex-shrink:0"></div>
        <div id="planMonthBot" style="height:1px;flex-shrink:0"></div>
      </div>`;
    }

    const numDays = mode === 'biweek' ? 14 : 7;
    const weekStart = startOfWeek(state.navDate);
    const days = [];
    for (let i = 0; i < numDays; i++) days.push(this._planMonthDayHTML(addDays(weekStart, i), filter, todayStr));
    const weekEnd = addDays(weekStart, numDays - 1);
    const label = `${weekStart.getDate()} ${state.MONTHS[weekStart.getMonth()]} – ${weekEnd.getDate()} ${state.MONTHS[weekEnd.getMonth()]}`;
    return `<div class="plan-toolbar">
      <button class="day-nav-btn" onclick="window.app.navigate(-1)">${navSvgL}</button>
      <span class="plan-toolbar-label">${label}</span>
      <button class="day-nav-btn" onclick="window.app.navigate(1)">${navSvgR}</button>
      ${todayBtn}
      <div class="plan-mode-btns">${modeBtns}</div>
      <div class="plan-toolbar-sep"></div>
      <div class="plan-rec-pills">${recToggles}</div>
    </div>
    <div class="plan-week-grid${mode==='biweek'?' plan-biweek-grid':''}">${days.join('')}</div>`;
  }

  planScrollToToday() {
    const mode = localStorage.getItem('planMode') || 'week';
    if (mode !== 'month') {
      state.navDate = new Date();
      this.render();
      return;
    }
    const container = document.getElementById('planMonthScroll');
    if (!container) return;
    const todayWeekId = DS(startOfWeek(new Date()));
    const el = container.querySelector(`[data-week-id="${todayWeekId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // Today's week was pruned — re-init around today
      if (this._planMonthIO) { this._planMonthIO.disconnect(); this._planMonthIO = null; }
      this._planMonthFrom = null;
      this._planMonthScrollSaved = null;
      container.innerHTML = '<div id="planMonthTop" style="height:1px;flex-shrink:0"></div><div id="planMonthBot" style="height:1px;flex-shrink:0"></div>';
      this._setupPlanMonth();
    }
  }

  setPlanMode(mode) {
    if (mode !== 'month') this._planMonthFrom = null;
    if (this._planMonthIO) { this._planMonthIO.disconnect(); this._planMonthIO = null; }
    localStorage.setItem('planMode', mode);
    this.render();
  }

  setStatsViz(viz) {
    state.setStatsViz(viz);
    this.render();
  }

  togglePastDisplay() {
    const newMode = state.pastDisplayMode === 'normal' ? 'stats' : 'normal';
    state.setPastDisplayMode(newMode);
    // Lock main height before toggling to prevent sidebar shift
    const main = document.getElementById('mainContent');
    if (main) main.style.minHeight = main.offsetHeight + 'px';
    const dayView = document.querySelector('.day-view');
    if (dayView) {
      dayView.classList.toggle('stats-mode', newMode === 'stats');
      const toggle = document.querySelector('.cal-sid-toggle input');
      if (toggle) toggle.checked = newMode === 'stats';
      const stateEl = document.querySelector('.cal-sid-toggle-state');
      if (stateEl) stateEl.textContent = newMode === 'stats' ? stateEl.dataset.on : stateEl.dataset.off;
    } else {
      this.render();
    }
  }

  // ═══════════════════════════════════════════════════
  // PLAN MONTH INFINITE SCROLL
  // ═══════════════════════════════════════════════════

  _planMonthDayHTML(d, filter, todayStr) {
    const recKey = (t) => (!t.recurrence || t.recurrence === 'none') ? 'none' : t.recurrence;
    const ds = DS(d);
    const isT = ds === todayStr;
    const items = getTodosForDate(d, state.todos).filter(t => filter[recKey(t)] !== false);
    const taskRows = items.map(t => {
      const done = isCompleted(t, d);
      return `<div class="plan-week-task${done?' done':''}" data-id="${t.id}" data-date="${ds}"
        draggable="true"
        ondragstart="event.stopPropagation();window.app.planDragStart(event,'${t.id}');this.classList.add('dragging')"
        ondragend="this.classList.remove('dragging')"
        onclick="window.app.openEditModal('${t.id}','${ds}')">
        <div class="week-todo-check${done?' checked':''}" onclick="event.stopPropagation();window.app.toggleTodo('${t.id}',window.app.parseDS('${ds}'))"></div>
        <span class="week-todo-text">${esc(t.title)}</span>
        <button class="week-todo-delete" onclick="event.stopPropagation();window.app.deleteTodo('${t.id}','${ds}')">×</button>
      </div>`;
    }).join('');
    return `<div class="plan-week-day${isT?' is-today':''}" data-date="${ds}"
        ondragover="event.preventDefault();this.classList.add('drag-over')"
        ondragleave="if(!this.contains(event.relatedTarget))this.classList.remove('drag-over')"
        ondrop="window.app.planDrop(event,'${ds}')">
      <div class="plan-week-day-header" onclick="window.app.goToDay('${ds}')" title="Voir le ${d.getDate()}">
        <span class="plan-week-day-name">${state.DAYS[(d.getDay()+6)%7]}</span>
        <span class="plan-week-day-num">${d.getDate()}</span>
      </div>
      <div class="plan-week-day-tasks">${taskRows}</div>
      <button class="plan-week-add" onclick="window.app.openModal(window.app.parseDS('${ds}'))">+</button>
    </div>`;
  }

  _planMonthGenWeeks(fromDate, count, filter, startMonthKey) {
    const todayStr = DS(new Date());
    if (startMonthKey === undefined) {
      const db = addDays(fromDate, -1);
      startMonthKey = `${db.getFullYear()}-${db.getMonth()}`;
    }
    let lastMonthKey = startMonthKey;
    let html = '';
    for (let w = 0; w < count; w++) {
      const wStart = addDays(fromDate, w * 7);
      let monthLabel = '';
      for (let i = 0; i < 7; i++) {
        const d = addDays(wStart, i);
        const mk = `${d.getFullYear()}-${d.getMonth()}`;
        if (mk !== lastMonthKey) {
          lastMonthKey = mk;
          monthLabel = `<div class="plan-scroll-month-label">${state.MONTHS[d.getMonth()]} ${d.getFullYear()}</div>`;
          break;
        }
      }
      const days = [];
      for (let i = 0; i < 7; i++) days.push(this._planMonthDayHTML(addDays(wStart, i), filter, todayStr));
      html += `${monthLabel}<div class="plan-month-scroll-week" data-week-id="${DS(wStart)}">${days.join('')}</div>`;
    }
    return html;
  }

  _setupPlanMonth() {
    const container = document.getElementById('planMonthScroll');
    const top = document.getElementById('planMonthTop');
    const bot = document.getElementById('planMonthBot');
    if (!container || !top || !bot) return;

    if (!this._planMonthFrom) {
      this._planMonthFrom = addDays(startOfWeek(new Date()), -4 * 7);
    }

    const filter = this._getPlanRecFilter();
    const html = this._planMonthGenWeeks(this._planMonthFrom, 20, filter);
    bot.insertAdjacentHTML('beforebegin', html);

    if (this._planMonthScrollSaved != null) {
      container.scrollTop = this._planMonthScrollSaved;
      this._planMonthScrollSaved = null;
    } else {
      const prevId = DS(addDays(startOfWeek(new Date()), -7));
      const el = container.querySelector(`[data-week-id="${prevId}"]`);
      if (el) container.scrollTop = el.offsetTop;
    }
    this._initPlanMonthIO();
  }

  _initPlanMonthIO() {
    const container = document.getElementById('planMonthScroll');
    if (!container) return;
    if (this._planMonthIO) { this._planMonthIO.disconnect(); this._planMonthIO = null; }
    const BATCH = 6;
    const MAX_WEEKS = 26;
    let busy = false;

    const removeWeekTop = () => {
      const week = container.querySelector('.plan-month-scroll-week');
      if (!week) return;
      const prev = week.previousElementSibling;
      if (prev && prev.classList.contains('plan-scroll-month-label')) prev.remove();
      this._planMonthFrom = addDays(parseDS(week.dataset.weekId), 7);
      week.remove();
    };

    const removeWeekBottom = () => {
      const week = container.querySelector('.plan-month-scroll-week:last-of-type');
      if (!week) return;
      week.remove();
      // Remove orphaned month label at end
      const bot = document.getElementById('planMonthBot');
      const prev = bot ? bot.previousElementSibling : null;
      if (prev && prev.classList.contains('plan-scroll-month-label')) prev.remove();
    };

    const append = () => {
      if (busy) return;
      busy = true;
      const last = container.querySelector('.plan-month-scroll-week:last-of-type');
      if (!last) { busy = false; return; }
      const lastDate = addDays(parseDS(last.dataset.weekId), 7);
      const html = this._planMonthGenWeeks(lastDate, BATCH, this._getPlanRecFilter());
      document.getElementById('planMonthBot').insertAdjacentHTML('beforebegin', html);
      // Prune top if over limit
      const total = container.querySelectorAll('.plan-month-scroll-week').length;
      if (total > MAX_WEEKS) {
        const prevH = container.scrollHeight;
        const prevTop = container.scrollTop;
        for (let i = 0; i < total - MAX_WEEKS; i++) removeWeekTop();
        container.scrollTop = prevTop - (prevH - container.scrollHeight);
      }
      busy = false;
    };

    const prepend = () => {
      if (busy) return;
      busy = true;
      const first = container.querySelector('.plan-month-scroll-week');
      if (!first) { busy = false; return; }
      const newFrom = addDays(parseDS(first.dataset.weekId), -BATCH * 7);
      const html = this._planMonthGenWeeks(newFrom, BATCH, this._getPlanRecFilter());
      // overflow-anchor:none — manual scroll compensation
      const prevH = container.scrollHeight;
      const prevTop = container.scrollTop;
      document.getElementById('planMonthTop').insertAdjacentHTML('afterend', html);
      container.scrollTop = prevTop + (container.scrollHeight - prevH);
      this._planMonthFrom = newFrom;
      // Prune bottom if over limit
      const total = container.querySelectorAll('.plan-month-scroll-week').length;
      for (let i = 0; i < total - MAX_WEEKS; i++) removeWeekBottom();
      busy = false;
    };

    // Delay first observation to avoid immediate fire on mount
    setTimeout(() => {
      if (!document.getElementById('planMonthTop')) return;
      this._planMonthIO = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          if (e.target.id === 'planMonthBot') append();
          if (e.target.id === 'planMonthTop') prepend();
        }
      }, { root: container, rootMargin: '300px 0px' });
      this._planMonthIO.observe(document.getElementById('planMonthTop'));
      this._planMonthIO.observe(document.getElementById('planMonthBot'));
    }, 100);
  }

  // Plan drag-drop
  planDragStart(event, taskId) {
    event.dataTransfer.setData('text/plain', taskId);
    event.dataTransfer.effectAllowed = 'move';
  }

  planDrop(event, ds) {
    event.preventDefault();
    const col = event.currentTarget;
    col.classList.remove('drag-over');
    const taskId = event.dataTransfer.getData('text/plain');
    if (taskId) this.assignInboxToDate(taskId, ds);
  }

  initPlanDragDrop() {
    document.querySelectorAll('.plan-week-day.drag-over, .plan-inbox-section.drag-over, .plan-backlog-section.drag-over')
      .forEach(el => el.classList.remove('drag-over'));
    this.initPlanResizeHandle();
  }

  initPlanResizeHandle() {
    const handle = document.getElementById('planResizeHandle');
    const col    = document.getElementById('planInboxCol');
    if (!handle || !col) return;
    let startX, startW;
    const onMove = (e) => {
      const w = Math.max(160, Math.min(480, startW + e.clientX - startX));
      col.style.width = w + 'px';
    };
    const onUp = (e) => {
      const w = Math.max(160, Math.min(480, startW + e.clientX - startX));
      localStorage.setItem('planInboxWidth', Math.round(w));
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      handle.classList.remove('dragging');
    };
    handle.addEventListener('mousedown', (e) => {
      startX = e.clientX;
      startW = col.offsetWidth;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.body.style.cursor = 'col-resize';
      handle.classList.add('dragging');
      e.preventDefault();
    });
  }

  planDropToInbox(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');
    const taskId = event.dataTransfer.getData('text/plain');
    if (!taskId) return;
    const t = state.todos.find(x => x.id === taskId);
    if (!t) return;
    snapshot(state.todos);
    t.date = null;
    t.backlog = false;
    saveTodos(state.todos);
    this.render();
  }

  planDropToBacklog(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');
    const taskId = event.dataTransfer.getData('text/plain');
    if (!taskId) return;
    const t = state.todos.find(x => x.id === taskId);
    if (!t) return;
    snapshot(state.todos);
    t.date = null;
    t.backlog = true;
    saveTodos(state.todos);
    this.render();
  }

  goToDay(ds) {
    state.setNavDate(this.parseDS(ds));
    state.setView('day');
    localStorage.setItem('view', 'day');
    this._pushHistory();
    this.render();
  }

  openModalForBacklog() {
    openModal(state.navDate, state.todos, 'backlog');
  }

  _renderProfileView() {
    const user     = getCurrentUser();
    const name     = user?.displayName || user?.email?.split('@')[0] || '';
    const initials = (user?.displayName || user?.email || '?').slice(0, 2).toUpperCase();
    const cats     = getCategories().length;
    const total    = state.todos.length;
    const recur    = state.todos.filter(t => t.recurrence && t.recurrence !== 'none').length;
    const done     = state.todos.filter(t => t.completed).length;

    const html = `
      <div class="profile-view">
        <div class="profile-hero">
          <div class="profile-avatar" onclick="window.app.openAvatarEditor()" title="Modifier l'avatar">
            ${getAvatarHTML(initials)}
            <span class="profile-avatar-hint">✏️</span>
          </div>
          <button class="profile-avatar-edit-btn" onclick="window.app.openAvatarEditor()">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            <span class="profile-avatar-edit-label">Modifier l'avatar</span>
          </button>
          <h1 class="profile-hero-name">${esc(name)}</h1>
          <p class="profile-hero-email">${esc(user?.email || '')}</p>
        </div>

        <div class="profile-body">
          <div class="profile-section">
            <h3 class="profile-section-title">Nom d'affichage</h3>
            <div class="profile-name-row">
              <input class="form-input" type="text" id="profileDisplayName"
                value="${esc(user?.displayName || '')}" placeholder="Ton prénom">
              <button class="btn btn-primary" onclick="window.app.saveDisplayName()">Sauvegarder</button>
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
              <button class="profile-row" onclick="window.app.setView('categories')">
                <span>🏷 Catégories</span><span class="profile-row-arrow">›</span>
              </button>
              <button class="profile-row" onclick="window.app.openAdminSection('taches')">
                <span>📋 Tâches suggérées</span><span class="profile-row-arrow">›</span>
              </button>
              <button class="profile-row" onclick="window.app.openAdminSection('modeles')">
                <span>🗂 Modèles de journée</span><span class="profile-row-arrow">›</span>
              </button>
            </div>
          </div>

          <div class="profile-section">
            <h3 class="profile-section-title">Abonnement calendrier (iCal)</h3>
            <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">Abonne-toi à tes tâches depuis Apple Calendar, Google Calendar ou Outlook. L'URL se met à jour automatiquement.</p>
            <div class="ical-url-row" id="icalUrlRow">
              <input class="form-input ical-url-input" id="icalUrlInput" readonly placeholder="Chargement…" onclick="this.select()" style="font-size:11px;font-family:monospace;">
              <button class="btn btn-primary" onclick="window.app.copyICalLink()" title="Copier l'URL">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              </button>
            </div>
            <p class="ical-copy-msg hidden" id="icalCopyMsg" style="font-size:12px;color:var(--success);margin-top:6px;">✓ URL copiée !</p>
            <div style="display:flex;gap:12px;margin-top:10px;align-items:center;flex-wrap:wrap;">
              <div style="display:flex;flex-direction:column;gap:3px;flex:1;min-width:160px;">
                <label style="font-size:11px;color:var(--text-muted);">Fuseau horaire</label>
                <input id="icalTimezone" class="form-input" style="font-size:12px;" placeholder="America/Montreal"
                  onchange="window.app.saveICalSettings()">
              </div>
              <div style="display:flex;flex-direction:column;gap:3px;">
                <label style="font-size:11px;color:var(--text-muted);">Heure des tâches</label>
                <input id="icalHour" type="time" class="form-input" style="font-size:12px;width:90px;"
                  onchange="window.app.saveICalSettings()">
              </div>
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
    // Load the iCal URL async after the profile view is injected into DOM
    setTimeout(() => this.loadICalURL(), 0);
    return html;
  }

  async saveDisplayName() {
    const input = document.getElementById('profileDisplayName');
    const name  = input?.value?.trim();
    if (!name) return;
    await updateUserProfile(name);
    updatePresenceName(name);
    this._updateUserBtn();
    const msg = document.getElementById('profileSaveMsg');
    if (msg) {
      msg.classList.remove('hidden');
      setTimeout(() => msg.classList.add('hidden'), 2000);
    }
  }

  async loadICalURL() {
    const input = document.getElementById('icalUrlInput');
    if (!input) return;
    const token = await getOrCreateICalToken();
    if (!token) return;
    const host = window.location.hostname === 'localhost' ? 'todo.hugues.app' : window.location.host;
    input.value = `https://${host}/api/ical?token=${token}`;

    // Init timezone + hour fields
    const tzInput = document.getElementById('icalTimezone');
    const hourInput = document.getElementById('icalHour');
    if (tzInput) tzInput.value = localStorage.getItem('timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (hourInput) hourInput.value = localStorage.getItem('icalHour') || '05:00';
  }

  saveICalSettings() {
    const tz   = document.getElementById('icalTimezone')?.value?.trim();
    const hour = document.getElementById('icalHour')?.value;
    if (tz)   localStorage.setItem('timezone', tz);
    if (hour) localStorage.setItem('icalHour', hour);
    pushToFirestore(getFullBackup(state.todos));
  }

  saveICalAdminSettings() {
    const tz   = document.getElementById('adminIcalTimezone')?.value?.trim();
    const hour = document.getElementById('adminIcalHour')?.value;
    if (tz)   localStorage.setItem('timezone', tz);
    if (hour) localStorage.setItem('icalHour', hour);
    const filters = {
      completed: document.getElementById('icalFilterCompleted')?.checked || false,
      recurring: document.getElementById('icalFilterRecurring')?.checked !== false,
      oneTime:   document.getElementById('icalFilterOneTime')?.checked   !== false,
    };
    localStorage.setItem('icalFilters', JSON.stringify(filters));
    pushToFirestore(getFullBackup(state.todos));
    const msg = document.getElementById('icalAdminSaveMsg');
    if (msg) { msg.style.display = 'inline'; setTimeout(() => { msg.style.display = 'none'; }, 2000); }
  }

  async copyICalLink() {
    const input = document.getElementById('icalUrlInput');
    if (!input || !input.value) return;
    try {
      await navigator.clipboard.writeText(input.value);
    } catch {
      input.select();
      document.execCommand('copy');
    }
    const msg = document.getElementById('icalCopyMsg');
    if (msg) {
      msg.classList.remove('hidden');
      setTimeout(() => msg.classList.add('hidden'), 2500);
    }
  }

  // ── Google Calendar ─────────────────────────────────────

  async connectGoogleCalendar() {
    const token = await getIdToken();
    if (!token) { alert('Connecte-toi d\'abord à un compte.'); return; }
    try {
      const res = await fetch('/api/gcal-auth', { headers: { Authorization: `Bearer ${token}` } });
      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      alert('Erreur de connexion Google Calendar: ' + err.message);
    }
  }

  async cleanGcalTodos(skipConfirm = false) {
    const gcalTodos = state.todos.filter(t => t.id && t.id.startsWith('gcal_'));
    if (gcalTodos.length === 0) {
      if (!skipConfirm) alert('Aucun événement Google Calendar importé à supprimer.');
      return;
    }
    if (!skipConfirm && !confirm(`Supprimer ${gcalTodos.length} événement(s) importé(s) de Google Calendar ?`)) return;
    state.setTodos(state.todos.filter(t => !t.id || !t.id.startsWith('gcal_')));
    saveTodos(state.todos);
    this.render();
    if (!skipConfirm) {
      const msg = document.getElementById('gcalSyncMsg');
      if (msg) { msg.style.display = 'block'; msg.textContent = `✓ ${gcalTodos.length} événement(s) supprimé(s).`; setTimeout(() => { msg.style.display = 'none'; }, 4000); }
    }
  }

  _gcalDisconnectDialog() {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
      overlay.innerHTML = `
        <div style="background:var(--bg-card);border-radius:12px;padding:24px;max-width:340px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.3);">
          <h3 style="margin:0 0 8px;font-size:16px;">Déconnecter Google Calendar</h3>
          <p style="font-size:13px;color:var(--text-muted);margin:0 0 20px;">Que faire des événements importés depuis Google Calendar ?</p>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <button id="gcalDlgKeep"   class="btn btn-ghost" style="text-align:left;">Déconnecter uniquement — garder les événements</button>
            <button id="gcalDlgClean"  class="btn btn-ghost" style="text-align:left;color:var(--danger);border-color:var(--danger);">Déconnecter et supprimer les événements importés</button>
            <button id="gcalDlgCancel" class="btn btn-ghost" style="text-align:left;margin-top:4px;">Annuler</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      const done = (val) => { overlay.remove(); resolve(val); };
      overlay.querySelector('#gcalDlgKeep').onclick   = () => done('keep');
      overlay.querySelector('#gcalDlgClean').onclick  = () => done('clean');
      overlay.querySelector('#gcalDlgCancel').onclick = () => done(null);
      overlay.addEventListener('click', e => { if (e.target === overlay) done(null); });
    });
  }

  async disconnectGoogleCalendar() {
    const choice = await this._gcalDisconnectDialog();
    if (!choice) return;
    if (choice === 'clean') await this.cleanGcalTodos(true);
    await disconnectGCal();
    renderAdminICal();
  }

  async gcalSyncNow(force = false) {
    const msg = document.getElementById('gcalSyncMsg');
    if (msg) { msg.style.display = 'block'; msg.textContent = 'Synchronisation…'; }
    try {
      await this._gcalPush();
      const pulled = await this._gcalPull(force);
      if (msg) {
        const newCount = pulled?.newTodos?.length || 0;
        const changed  = (pulled?.completedTodoIds?.length || 0) + (pulled?.movedTodos?.length || 0);
        const dbg      = pulled?.debug ? ` (${pulled.debug.calendars} cal)` : '';
        msg.textContent = (newCount + changed) > 0
          ? `✓ ${newCount} importé(s), ${changed} modifié(s)${dbg}`
          : `✓ Synchronisé${dbg} — rien de nouveau`;
        setTimeout(() => { if (msg) msg.style.display = 'none'; }, 5000);
      }
    } catch (err) {
      if (msg) { msg.textContent = 'Erreur: ' + err.message; }
    }
  }

  async _gcalPush() {
    const token = await getIdToken();
    if (!token) return;
    const res = await fetch('/api/gcal-sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async _gcalPull(force = false) {
    const token = await getIdToken();
    if (!token) return null;
    const url = force ? '/api/gcal-pull?force=1' : '/api/gcal-pull';
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const { completedTodoIds = [], movedTodos = [], newTodos = [] } = await res.json();
    let changed = false;
    for (const id of completedTodoIds) {
      const t = state.todos.find(x => x.id === id);
      if (t && !t.completed) { t.completed = true; changed = true; }
    }
    for (const { id, date } of movedTodos) {
      const t = state.todos.find(x => x.id === id);
      if (t && t.date !== date && !t.recurrence) { t.date = date; changed = true; }
    }
    for (const todo of newTodos) {
      if (!state.todos.find(x => x.id === todo.id)) {
        state.todos.push(todo);
        changed = true;
      }
    }
    if (changed) { saveTodos(state.todos); this.render(); }
    return { completedTodoIds, movedTodos, newTodos };
  }

  openAvatarEditor()           { openAvatarEditor(); }
  closeAvatarEditor()          { closeAvatarEditor(); }
  handleAvatarFile(input)      { handleAvatarFile(input); }
  selectAvatarFilter(id)       { selectAvatarFilter(id); }
  selectAvatarEmoji(emoji)     { selectAvatarEmoji(emoji); }
  avatarSwitchTab(tab)         { avatarSwitchTab(tab); }
  async saveAvatar()           { await saveAvatar(); localStorage.setItem('_localWriteTime', Date.now().toString()); this._updateUserBtn(); pushToFirestore(getFullBackup(state.todos)); }
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
  toggleNewCatRow() { toggleNewCatRow(); }
  addCategoryInline() { addCategoryInline(); }

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

  // ═══════════════════════════════════════════════════
  // PROJECTS (independent entities)
  // ═══════════════════════════════════════════════════
  addProjectFromView() {
    const name = prompt('Nom du projet :');
    if (!name || !name.trim()) return;
    addProjectItem(name.trim());
    this.render();
  }

  openProjectPanel(id)   { openProjectPanel(id); }
  closeProjectPanel()    { closeProjectPanel(); }

  saveProjectName(id, name) {
    if (!name.trim()) return;
    updateProjectItem(id, { name: name.trim() });
    renderProjectPanel(id);
    this.render();
  }

  setProjectColor(id, color) {
    updateProjectItem(id, { color });
    renderProjectPanel(id);
    this.render();
  }

  setProjectIcon(id, icon) {
    updateProjectItem(id, { icon });
    renderProjectPanel(id);
    this.render();
  }

  saveProjectDescription(id, description) {
    updateProjectItem(id, { description });
    this.render();
  }

  setProjectStatus(id, status) {
    updateProjectItem(id, { status });
    this.render();
  }

  setProjectDeadline(id, deadline) {
    updateProjectItem(id, { deadline });
    this.render();
  }

  confirmDeleteProject(id) {
    if (!confirm('Supprimer ce projet ?')) return;
    closeProjectPanel();
    deleteProjectItem(id);
    this.render();
  }

  setProjectsCols(n) {
    localStorage.setItem('projectsCols', n);
    this.render();
  }

  setProjectsSort(s) {
    localStorage.setItem('projectsSort', s);
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
    gsap.fromTo(menu, { x: '100%' }, { x: 0, duration: 0.28, ease: 'expo.out' });
    gsap.fromTo(menu.querySelector('.hm-body'),
      { opacity: 0 },
      { opacity: 1, duration: 0.18, delay: 0.1, ease: 'power2.out' }
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
    // Handle Google Calendar OAuth redirect result
    const urlParams = new URLSearchParams(window.location.search);
    const gcalResult = urlParams.get('gcal');
    if (gcalResult === 'connected') {
      localStorage.setItem('gcalConnected', '1');
      window.history.replaceState({}, '', '/');
    } else if (gcalResult === 'error') {
      const errMsg = urlParams.get('msg') || 'inconnu';
      console.warn('[gcal] connexion échouée:', errMsg);
      window.history.replaceState({}, '', '/');
    }

    // 1. Wait for Firebase to restore the previous session (or get null)
    const user = await initAuth();

    // 2. No session → sign in as guest automatically, then prompt for name
    if (!user) {
      const guest = await signInGuest();
      if (guest?.isAnonymous && !guest.displayName && !localStorage.getItem('guestNameSkipped')) {
        await this._promptGuestName();
      }
    }

    // 3. Merge Firestore data into the app (first load)
    await this._syncFirebase();

    // 3b. Sync with Google Calendar if connected (fire-and-forget)
    if (localStorage.getItem('gcalConnected') === '1') {
      this._gcalPush().catch(() => {});
      this._gcalPull().catch(() => {});
    }

    // 4. Listen for realtime updates from other devices (guard against re-init)
    if (this._firestoreUnsub) this._firestoreUnsub();
    this._firestoreUnsub = subscribeToFirestore(backup => {
      this._applyBackup(backup, { silent: false });
    });

    // 5. Update user button on every auth state change
    onUserChange(user => {
      this._updateUserBtn();
      if (user) initPresence(user, { onMessagesUpdate: msgs => this._updateChatWidget(msgs) });
      else destroyPresence();
    });
    this._updateUserBtn();

    // 6. Start presence tracking for the current user
    const currentUser = getCurrentUser();
    if (currentUser) initPresence(currentUser, { onMessagesUpdate: msgs => this._updateChatWidget(msgs) });

    // 6. Leave prompt for guests
    this._setupLeavePrompt();
  }

  async _syncFirebase() {
    const backup = await loadFromFirestore();
    if (!backup) {
      await pushToFirestore(getFullBackup(state.todos));
      return;
    }

    // Primary guard: if local has todos AND a push is pending (last push failed or
    // page reloaded before push completed), always keep local and retry the push.
    // This is the main protection against sync overwriting local data.
    if (state.todos.length > 0 && localStorage.getItem('_pendingSync') === '1') {
      await pushToFirestore(getFullBackup(state.todos));
      return;
    }

    // Secondary guard: compare timestamps. Local wins if it's strictly newer than
    // Firestore by more than 5s (tolerates clock drift between client and server).
    const localWriteTime = parseInt(localStorage.getItem('_localWriteTime') || '0');
    const firestoreTime  = backup._firestoreUpdatedAt || 0;
    if (localWriteTime > 0 && firestoreTime > 0 && localWriteTime > firestoreTime + 5000) {
      await pushToFirestore(getFullBackup(state.todos));
      return;
    }

    const { _firestoreUpdatedAt, ...cleanBackup } = backup;
    this._applyBackup(cleanBackup, { silent: false });
  }

  // Merge a backup object into the app state (from Firestore or server)
  _applyBackup(backup, { silent }) {
    // Skip our own Firestore echoes using the session ID stamped in every push.
    if (backup._pushedBySession && backup._pushedBySession === SESSION_ID) return;


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
      if (backup.config.theme)    localStorage.setItem('theme',    backup.config.theme);
      if (backup.config.zoom)     localStorage.setItem('zoom',     backup.config.zoom);
      if (backup.config.lang)        localStorage.setItem('lang',        backup.config.lang);
      if (backup.config.timezone)    localStorage.setItem('timezone',    backup.config.timezone);
      if (backup.config.icalHour)    localStorage.setItem('icalHour',    backup.config.icalHour);
      if (backup.config.icalFilters) localStorage.setItem('icalFilters', JSON.stringify(backup.config.icalFilters));
    }
    if ('avatar' in backup) {
      if (backup.avatar) localStorage.setItem('profileAvatar', JSON.stringify(backup.avatar));
      else               localStorage.removeItem('profileAvatar');
      this._updateUserBtn();
    }
    if (backup.icalSecret) localStorage.setItem('icalSecret', backup.icalSecret);

    if (changed && !silent) this.render();
  }

  _updateUserBtn() {
    const user       = getCurrentUser();
    const btn        = document.getElementById('userBtn');
    const logoAvatar = document.getElementById('logoAvatar');
    if (!btn && !logoAvatar) return;
    const guest = !!user?.isAnonymous;

    const uname = user ? (user.displayName || (!guest ? user.email?.split('@')[0] : '') || '') : '';
    const fullTitle = uname ? `2FŨKOI, ${uname}` : '2FŨKOI';
    document.title = fullTitle;
    this._animateLogoText(fullTitle);

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

    // Trigger logo entrance animation AFTER content is set (first call only)
    if (logoAvatar && !logoAvatar.dataset.animated) {
      logoAvatar.dataset.animated = '1';
      requestAnimationFrame(() => requestAnimationFrame(() => {
        logoAvatar.classList.add('logo-avatar--entering');
      }));
    }
  }

  _animateLogoText(text) {
    const el = document.getElementById('logoText');
    if (!el || el.dataset.text === text) return;
    el.dataset.text = text;
    el.style.opacity = '1'; // reveal container (was opacity:0 in CSS to prevent flash)

    const commaIdx = text.indexOf(', ');

    // Brand char delays: 2 / FŨ / KOI — left to right, slight pauses between groups
    const brandDelays = [80, 128, 143, 188, 203, 218]; // 2, F, Ũ, K, O, I

    if (commaIdx > 0) {
      const brand    = text.slice(0, commaIdx);              // "2FŨKOI"
      const username = text.slice(commaIdx + 2).toUpperCase(); // "HUGUES"
      // Random username animation variant per refresh
      const variant  = ['r', 'b', 's'][Math.random() * 3 | 0];
      const nameDelay = 295;

      let html = '';
      [...brand].forEach((ch, i) =>
        html += `<span class="ninja-char" style="--delay:${brandDelays[i]}ms">${esc(ch)}</span>`
      );
      html += `<span class="ninja-char" style="--delay:248ms">,</span>`;
      html += `<span class="ninja-char" style="--delay:250ms">\u00A0</span>`;
      [...username].forEach(ch =>
        html += `<span class="ninja-username-${variant}" style="--delay:${nameDelay}ms">${esc(ch)}</span>`
      );
      html += `<span class="ninja-char" style="--delay:${nameDelay}ms">?</span>`;
      el.innerHTML = html;
    } else {
      // Guest / no username: just "2FŨKOI"
      el.innerHTML = [...text].map((ch, i) =>
        `<span class="ninja-char" style="--delay:${brandDelays[i] ?? i * 30}ms">${esc(ch)}</span>`
      ).join('');
    }
  }

  openUserArea() {
    if (isGuest()) this.openAuthModal();
    else           this.setView('profile');
  }

  _leavingAttempted = null;

  _promptGuestName() {
    return new Promise(resolve => {
      const overlay = document.getElementById('guestNameOverlay');
      const input   = document.getElementById('guestNameInput');
      if (!overlay) { resolve(); return; }
      overlay.classList.remove('hidden');
      input.focus();
      input.addEventListener('keydown', e => { if (e.key === 'Enter') this.saveGuestName(); }, { once: true });
      this._resolveGuestNamePrompt = resolve;
    });
  }

  async saveGuestName() {
    const name  = document.getElementById('guestNameInput')?.value.trim();
    const email = document.getElementById('guestEmailInput')?.value.trim();
    if (name) { await updateUserProfile(name); updatePresenceName(name); }
    this._closeGuestNamePrompt();
    this._updateUserBtn();
    if (email) {
      this.openAuthModal();
      this.showAuthRegister();
      document.getElementById('authEmail').value = email;
      document.getElementById('authPassword')?.focus();
    }
  }

  skipGuestName() {
    localStorage.setItem('guestNameSkipped', '1');
    this._closeGuestNamePrompt();
  }

  async openAvatarFromPrompt() {
    const name = document.getElementById('guestNameInput')?.value.trim();
    if (name) { await updateUserProfile(name); updatePresenceName(name); }
    this._closeGuestNamePrompt();
    this._updateUserBtn();
    this.openAvatarEditor();
  }

  _closeGuestNamePrompt() {
    document.getElementById('guestNameOverlay')?.classList.add('hidden');
    this._resolveGuestNamePrompt?.();
    this._resolveGuestNamePrompt = null;
  }

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
      document.getElementById('authWelcomeBubble').textContent = 'Tes tâches se synchronisent automatiquement sur tous tes appareils. ✓';
    } else if (showGuestPanel) {
      document.getElementById('authUserName').textContent = 'Invité';
      document.getElementById('authUserSub').textContent  = 'Session temporaire · uid: ' + user.uid.slice(0, 8) + '…';
      document.getElementById('authAvatar').textContent   = '👤';
      document.getElementById('authUpgradeSection').classList.remove('hidden');
      document.getElementById('authWelcomeBubble').textContent = 'Tes tâches sont sauvegardées sur cet appareil. Crée un compte pour y accéder depuis n\'importe où 🔒';
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

  showAuthLogin() {
    const panelUser = document.getElementById('authPanelUser');
    const panelForm = document.getElementById('authPanelForm');
    panelUser.classList.add('hidden');
    panelForm.classList.remove('hidden');
    this._authMode = 'login';
    this._updateAuthFormLabels();
  }

  // ── Social auth (Google / Facebook) ───────────────────
  async _runSocialAuth(providerFn, errElId) {
    const errEl = document.getElementById(errElId);
    errEl.classList.add('hidden');
    try {
      await providerFn();
      await this._syncFirebase();
      document.getElementById('authModalOverlay').classList.add('hidden');
      document.getElementById('upgradePromptOverlay').classList.add('hidden');
      this._updateUserBtn();
      this.render();
    } catch (err) {
      errEl.textContent = this._firebaseErrorMessage(err.code);
      errEl.classList.remove('hidden');
    }
  }

  authGoogleSignIn()      { return this._runSocialAuth(() => signInWithGoogle(),   'authError'); }
  authFacebookSignIn()    { return this._runSocialAuth(() => signInWithFacebook(), 'authError'); }
  upgradeGoogleSignIn()   { return this._runSocialAuth(() => signInWithGoogle(),   'upgradeError'); }
  upgradeFacebookSignIn() { return this._runSocialAuth(() => signInWithFacebook(), 'upgradeError'); }

  // ── Chat inbox widget (admin messages) ────────────────
  _chatMessages = [];

  _updateChatWidget(messages) {
    this._chatMessages = messages;
    // Only count unread messages FROM admin (not user's own replies)
    const unread = messages.filter(m => m.from !== 'user' && !m.read).length;
    const badge  = document.getElementById('chatBadge');
    const btn    = document.getElementById('chatInboxBtn');
    if (badge) {
      badge.textContent = unread;
      badge.classList.toggle('hidden', unread === 0);
    }
    if (btn) btn.classList.toggle('has-unread', unread > 0);
    this._renderChatInbox();
  }

  openChat() {
    document.getElementById('chatInboxPanel').classList.add('open');
    document.getElementById('chatInboxOverlay').classList.add('open');
    markAllMessagesRead();
    const badge = document.getElementById('chatBadge');
    if (badge) badge.classList.add('hidden');
    const btn = document.getElementById('chatInboxBtn');
    if (btn) btn.classList.remove('has-unread');
    this._renderChatInbox();
    // Focus reply input
    setTimeout(() => document.getElementById('chatReplyInput')?.focus(), 200);
  }

  closeChat() {
    document.getElementById('chatInboxPanel').classList.remove('open');
    document.getElementById('chatInboxOverlay').classList.remove('open');
  }

  async sendChatMessage() {
    const input = document.getElementById('chatReplyInput');
    const text  = input?.value.trim();
    if (!text) return;
    input.value = '';
    input.style.height = '';
    try {
      await sendUserMessage(text);
      // Firestore listener will pick it up and re-render automatically
    } catch (e) {
      console.warn('[chat] send failed:', e);
    }
  }

  _renderChatInbox() {
    const list = document.getElementById('chatInboxList');
    if (!list) return;
    if (!this._chatMessages.length) {
      list.innerHTML = '<p class="chat-empty-msg">Aucun message pour l\'instant.</p>';
      return;
    }
    list.innerHTML = this._chatMessages.map(msg => {
      const ts = msg.sentAt?.seconds
        ? new Date(msg.sentAt.seconds * 1000).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
        : '';
      const isUser      = msg.from === 'user';
      const isBroadcast = !isUser && !!msg.broadcastId;
      return isUser
        ? `<div class="chat-bubble chat-bubble--user">
            <div class="chat-bubble__body">
              <p class="chat-bubble__text">${this._escHtml(msg.message)}</p>
              ${ts ? `<p class="chat-bubble__time">${ts}</p>` : ''}
            </div>
          </div>`
        : isBroadcast
        ? `<div class="chat-bubble chat-bubble--broadcast">
            <span class="chat-bubble__icon">📢</span>
            <div class="chat-bubble__body">
              <p class="chat-bubble__tag"><span class="chat-bubble__tag-dot"></span>À tous</p>
              <p class="chat-bubble__text">${this._escHtml(msg.message)}</p>
              ${ts ? `<p class="chat-bubble__time">${ts}</p>` : ''}
            </div>
          </div>`
        : `<div class="chat-bubble chat-bubble--direct">
            <span class="chat-bubble__icon">💬</span>
            <div class="chat-bubble__body">
              <p class="chat-bubble__tag"><span class="chat-bubble__tag-dot"></span>Message direct</p>
              <p class="chat-bubble__text">${this._escHtml(msg.message)}</p>
              ${ts ? `<p class="chat-bubble__time">${ts}</p>` : ''}
            </div>
          </div>`;
    }).join('');
    list.scrollTop = list.scrollHeight;
  }

  _escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
    const bubble = document.getElementById('authFormBubble');
    if (bubble) bubble.textContent = isRegister
      ? 'Crée un compte gratuit pour retrouver tes tâches sur tous tes appareils 🚀'
      : 'Connecte-toi pour retrouver tes tâches sur tous tes appareils.';
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
      'auth/popup-closed-by-user':    'Connexion annulée.',
      'auth/popup-blocked':           'Popup bloquée. Autorisez les popups pour ce site.',
      'auth/account-exists-with-different-credential': 'Un compte existe déjà avec cet email. Connectez-vous avec la méthode d\'origine.',
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
