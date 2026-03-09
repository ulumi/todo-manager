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
  toggleMonthDay, toggleMonthLastDay,
  selectYearMonth, selectYearDay,
  saveTaskLogic, cloudsHTML, openDeleteModal, closeDeleteModal,
  toggleCloudSection, toggleModalRight, selectPriority
} from './modules/modal.js';
import {
  todoItemHTML, renderDayView, renderWeekView, renderMonthView, renderYearView,
  renderProjectsView,
  getPeriodLabel, getCloudsHTML, renderQACloud, setupTodoItemHoverAnimations,
  renderSidebar, renderWeekSidebar, renderYearSidebar
} from './modules/render.js';
import { setupEventListeners } from './modules/events.js';
import { celebrate } from './modules/celebrate.js';
import { VERSION } from './modules/version.js';
import { openAdminModal, closeAdminModal, showAdminSection, addSuggestedTask, removeSuggestedTask, moveSuggestedTask, clearAllSuggestedTasks, clearAllCalendarData, openTemplateModal, closeTemplateModal, applyTemplate, addTemplate, removeTemplate, addTaskToTemplate, removeTaskFromTemplate, addProject, removeProject, getProjects, saveProjects } from './modules/admin.js';
import {
  openProjectView, closeProjectView, renderProjectPanel,
  getCurrentProjectId, getProjectTaskOrder, saveProjectTaskOrder
} from './modules/projectView.js';
import { snapshot, undo, canUndo } from './modules/undo.js';

// Initialize state
state.initializeState();

// Application class
class TodoApp {
  constructor() {
    this._sugg = [];
    this.zoomIdx = parseInt(localStorage.getItem('zoom') ?? '1');
    if (isNaN(this.zoomIdx) || this.zoomIdx < 0 || this.zoomIdx > 2) this.zoomIdx = 1;
    this.dayOrder = JSON.parse(localStorage.getItem('dayOrder') || '{}');
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
    if (savedView && ['day', 'week', 'month', 'year', 'projects'].includes(savedView)) {
      state.setView(savedView);
    }
    this.render();
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

    // 3. Enter
    gsap.set(main, { x: slideX, y: slideY });
    await gsap.to(main, {
      opacity: 1,
      x: 0,
      y: 0,
      duration: (isDay || isMonth) && delta ? 0.28 : 0.25,
      delay: 0.02,
      ease: (isDay || isMonth) && delta ? 'expo.out' : 'power2.out'
    });

    // 4. Stagger blocks — total spread capped at 120ms regardless of count
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

    // 5. Stagger todo items
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
  _refreshProjectPanel() {
    const projId = getCurrentProjectId();
    if (projId) renderProjectPanel(projId);
  }

  toggleTodo(id, d) {
    const wasCompleted = isCompleted(state.todos.find(x => x.id === id), d);
    snapshot(state.todos);
    toggleTodo(id, d, state.todos);
    saveTodos(state.todos);
    if (!wasCompleted) celebrate(state.lang);
    this.render();
    this._refreshProjectPanel();
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
          this._refreshProjectPanel();
        }
      });
    } else {
      callback();
      this.render();
      this._refreshProjectPanel();
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
      snapshot(before);
      saveTodos(state.todos);
      closeModal();
      this.render();
      this._refreshProjectPanel();
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
    const isProjects = state.view === 'projects';
    document.body.classList.toggle('view-projects', isProjects);
    document.getElementById('periodLabel').textContent = isProjects ? '' : getPeriodLabel();
    document.querySelectorAll('.view-tab').forEach(b => b.classList.toggle('active', b.dataset.view===state.view));

    let html = '';
    if (state.view==='day')      html = renderDayView(state.todos);
    if (state.view==='week')     html = renderWeekView(state.todos);
    if (state.view==='month')    html = renderMonthView(state.todos);
    if (state.view==='year')     html = renderYearView(state.todos);
    if (state.view==='projects') html = renderProjectsView(state.todos);
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
    this.renderQACloud();
    this._animateQuickAddBtn();
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
  // PROJECTS
  // ═══════════════════════════════════════════════════
  addProject() { addProject(); }

  addProjectFromView() {
    const name = prompt('Nom du projet :');
    if (!name || !name.trim()) return;
    const colors = ['#f59e0b','#3b82f6','#10b981','#ef4444','#8b5cf6','#f97316','#06b6d4','#ec4899'];
    const projects = getProjects();
    projects.push({ id: Date.now().toString(), name: name.trim(), color: colors[projects.length % colors.length] });
    saveProjects(projects);
    this.render();
  }

  removeProject(id) {
    // Clear task links before removing
    snapshot(state.todos);
    state.todos.forEach(t => { if (t.projectId === id) delete t.projectId; });
    saveTodos(state.todos);
    removeProject(id);
    this.render();
  }

  getProjects() { return getProjects(); }

  openProjectView(id) { openProjectView(id); }
  closeProjectView()  { closeProjectView(); }

  setProjectColor(projectId, color) {
    const projects = getProjects();
    const proj = projects.find(p => p.id === projectId);
    if (proj) { proj.color = color; saveProjects(projects); }
    renderProjectPanel(projectId);
    this.render();
  }

  saveProjectName(projectId, name) {
    if (!name.trim()) return;
    const projects = getProjects();
    const proj = projects.find(p => p.id === projectId);
    if (proj && proj.name !== name.trim()) { proj.name = name.trim(); saveProjects(projects); }
    renderProjectPanel(projectId);
    this.render();
  }

  deleteProject(id) {
    if (!confirm('Supprimer ce projet ? Les tâches seront dissociées mais conservées.')) return;
    closeProjectView();
    this.removeProject(id);
  }

  reorderProjectTask(id, projectId, direction) {
    const tasks = state.todos.filter(t => t.projectId === projectId);
    let order = getProjectTaskOrder(projectId);
    tasks.forEach(t => { if (!order.includes(t.id)) order.push(t.id); });
    order = order.filter(oid => tasks.some(t => t.id === oid));
    const idx = order.indexOf(id);
    if (idx < 0) return;
    const newIdx = idx + parseInt(direction);
    if (newIdx < 0 || newIdx >= order.length) return;
    [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
    saveProjectTaskOrder(projectId, order);
    renderProjectPanel(projectId);
  }

  openModalForProject(projectId) {
    openModal(state.navDate, state.todos);
    setTimeout(() => {
      const sel = document.getElementById('taskProject');
      if (sel) sel.value = projectId;
    }, 60);
  }

  unlinkFromProject(id) {
    snapshot(state.todos);
    const t = state.todos.find(x => x.id === id);
    if (t) { delete t.projectId; saveTodos(state.todos); }
    this._refreshProjectPanel();
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

  hmGoToProjects() {
    this.closeHamburger();
    this.setView('projects');
  }

  hmOpenAdmin(section) {
    this.closeHamburger();
    openAdminModal();
    setTimeout(() => showAdminSection(section), 50);
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
