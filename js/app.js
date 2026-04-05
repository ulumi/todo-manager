// ════════════════════════════════════════════════════════
//  MAIN APPLICATION
// ════════════════════════════════════════════════════════

import { TRANSLATIONS, ZOOM_SIZES } from './modules/config.js';
import { initLowPolyBg, setPalette as _setBgPalette, setBgColor as _setBgColor, PALETTE_OPTIONS } from './modules/lowpoly-bg.js';
import {
  DS, p2, parseDS, today, addDays, startOfWeek,
  daysInMonth, firstDayOfMonth, esc
} from './modules/utils.js';
import {
  saveTodos, loadTodos, getAppConfig, downloadJSON,
  exportAllData, exportCalendarOnly, exportConfigOnly, importData,
  downloadICalFile, getICalBlobURL,
  loadFromServer, saveBackupToServer, getFullBackup, initCrossTabSync, pushFirestoreNow
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
  saveTaskLogic, openDeleteModal, closeDeleteModal,
  toggleCloudSection, toggleModalRight, selectPriority,
  toggleNewCatRow, addCategoryInline, addProjectInline, toggleNewProjectRow,
  toggleCategoryTag, toggleProjectTag, toggleIntentionTag, switchTagTab,
  toggleNewIntentionRow, addIntentionInline,
  selectScheduleMode, selectBigMode, toggleDetailSection,
  cancelModal, clearDraft, discardDraft,
  openGuidedCards, closeGuidedCards, guidedNext, guidedBack, guidedFinish,
  guidedSelectWhen, guidedSelectRecurrence, guidedSetToday, guidedSetTomorrow,
  guidedToggleNewCat, guidedAddCategory,
  toggleModalSubtask, removeModalSubtask, addModalSubtaskInline, editModalSubtask
} from './modules/modal.js';
import {
  todoItemHTML, renderDayView, renderWeekView, renderMonthView, renderYearView,
  renderCategoriesView, renderInboxView, renderBacklogView, getInboxCount, getBacklogCount,
  getPeriodLabel, getCloudsHTML, renderQACloud, setupTodoItemHoverAnimations,
  renderSidebar, renderWeekSidebar, renderYearSidebar,
  renderPlanInboxList, renderProjectsView, renderSearchView,
  renderIntentionsView, renderAnalyseView,
} from './modules/render.js';
import { setupEventListeners } from './modules/events.js';
import { celebrate, celebrateWithQuote, celebrateSlideshow, getBannedQuotes, banQuote, unbanQuote, getCustomQuotes, addCustomQuote, updateCustomQuote, removeCustomQuote, getGlobalQuotes, setGlobalQuotes, DEFAULT_QUOTES_EN, DEFAULT_QUOTES_FR, onQuoteSave, onCelebrateDebug, getBannedFonts, banFont, getBannedMascots, banMascot } from './modules/celebrate.js';
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
    this.daySpacer = JSON.parse(localStorage.getItem('daySpacer') || '{}');
    this.recurringOrder = JSON.parse(localStorage.getItem('recurringOrder') || '{}');
    this.punctualPeriodOrder = JSON.parse(localStorage.getItem('punctualPeriodOrder') || '{}');
    this._clickTimer = null;
    this._quickAddInDayMode = false;
    this._expandedSubtasks = new Set();
    this.init();
  }

  init() {
    // Migration: localStorage key renames
    // 'projects' (was categories/tags) → 'categories'
    if (localStorage.getItem('projects') !== null && localStorage.getItem('categories') === null) {
      localStorage.setItem('categories', localStorage.getItem('projects'));
      localStorage.removeItem('projects');
    }
    // 'boardProjects' (was real projects) → 'projects'
    if (localStorage.getItem('boardProjects') !== null && localStorage.getItem('projects') === null) {
      localStorage.setItem('projects', localStorage.getItem('boardProjects'));
      localStorage.removeItem('boardProjects');
    }

    const todos = loadTodos();
    // Migration: recurring tasks without startDate get one derived from their ID (creation timestamp)
    // Migration: todo field renames — projectId → categoryId, boardProjectId → projectId
    let migrated = false;
    todos.forEach(t => {
      if (t.recurrence && t.recurrence !== 'none' && !t.startDate) {
        t.startDate = DS(new Date(parseInt(t.id)));
        migrated = true;
      }
      if ('projectId' in t && !('categoryId' in t)) {
        t.categoryId = t.projectId || undefined;
        delete t.projectId;
        migrated = true;
      }
      if ('boardProjectId' in t && !('projectId' in t)) {
        t.projectId = t.boardProjectId || undefined;
        delete t.boardProjectId;
        migrated = true;
      }
      // Migration: single ID → array format
      if (t.categoryId && !t.categoryIds) {
        t.categoryIds = [t.categoryId];
        delete t.categoryId;
        migrated = true;
      }
      if (t.projectId && !t.projectIds) {
        t.projectIds = [t.projectId];
        delete t.projectId;
        migrated = true;
      }
      if (t.intentionId && !t.intentionIds) {
        t.intentionIds = [t.intentionId];
        delete t.intentionId;
        migrated = true;
      }
    });
    if (migrated) saveTodos(todos);
    // Migration: stamp existing items without updatedAt using their ID as creation timestamp
    let migratedTs = false;
    todos.forEach(t => { if (!t.updatedAt) { t.updatedAt = parseInt(t.id) || Date.now(); migratedTs = true; } });
    if (migratedTs) saveTodos(todos);
    state.setTodos(todos);
    this.applyZoom();
    this.initTheme();
    this.applyLang();
    initLowPolyBg();
    this.initGlassMode();
    // Restore state from URL hash, fall back to localStorage
    const _hash = new URLSearchParams(window.location.hash.slice(1));
    const _hashView = _hash.get('view');
    const _hashNav  = _hash.get('nav');
    const _ALL_VIEWS = ['day','week','month','year','categories','inbox','backlog','plan','projects','superadmin','search','intentions','profile','analyse'];
    if (_hashView && _ALL_VIEWS.includes(_hashView)) {
      state.setView(_hashView);
    } else {
      const savedView = localStorage.getItem('view');
      if (savedView && _ALL_VIEWS.includes(savedView)) state.setView(savedView);
    }
    if (_hashNav) {
      const [_hy, _hm, _hd] = _hashNav.split('-').map(Number);
      if (!isNaN(_hy)) state.setNavDate(new Date(_hy, _hm - 1, _hd));
    }
    this.render();
    this._syncServer();
    // Restore modal from hash after render
    const _hashModal = _hash.get('modal');
    if (_hashModal === 'edit') {
      const _mId = _hash.get('id'), _mDate = _hash.get('date');
      if (_mId && _mDate) setTimeout(() => this.openEditModal(_mId, _mDate), 50);
    } else if (_hashModal === 'add') {
      const _mDate = _hash.get('date');
      setTimeout(() => this.openModal(_mDate ? parseDS(_mDate) : state.navDate), 50);
    }
    // Seed the history stack with the initial state
    history.replaceState({ view: state.view, nav: DS(state.navDate) }, '', this._buildHash());
    window.addEventListener('popstate', (e) => this._popHistory(e));
    const vl = document.getElementById('versionLabel');
    if (vl) vl.textContent = 'v' + VERSION;
    setupEventListeners(this);

    // Register celebrate debug panel (independent of server sync)
    onCelebrateDebug((data) => { this._showCelebrateDebugPanel(data); });

    // Kill browser autocomplete on all inputs except auth fields (email/password)
    document.addEventListener('focusin', e => {
      if (e.target.tagName === 'INPUT' && !e.target.getAttribute('autocomplete'))
        e.target.setAttribute('autocomplete', 'off');
    });
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

    // Always restore user quote preferences from server
    if (backup.quotes) {
      if (Array.isArray(backup.quotes.banned))   localStorage.setItem('bannedQuotes',   JSON.stringify(backup.quotes.banned));
      if (Array.isArray(backup.quotes.customFR)) localStorage.setItem('customQuotesFR', JSON.stringify(backup.quotes.customFR));
      if (Array.isArray(backup.quotes.customEN)) localStorage.setItem('customQuotesEN', JSON.stringify(backup.quotes.customEN));
    }

    // Register auto-save: any quote mutation pushes to server
    onQuoteSave(() => saveBackupToServer(getFullBackup(state.todos)));

    // Load global (shared) quotes from server — affects celebrate pool for all users
    this._loadGlobalQuotes();

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
    if (backup.categories)     localStorage.setItem('categories',       JSON.stringify(backup.categories));
    if (backup.templates)      localStorage.setItem('dayTemplates',     JSON.stringify(backup.templates));
    if (backup.suggestedTasks) localStorage.setItem('suggestedTasks',   JSON.stringify(backup.suggestedTasks));
    if (backup.taskOrder)      localStorage.setItem('projectTaskOrder', JSON.stringify(backup.taskOrder));
    if (backup.intentions)     localStorage.setItem('intentions',       JSON.stringify(backup.intentions));
    if (backup.projects)  saveProjects(backup.projects);
    if (backup.icalSecret)     localStorage.setItem('icalSecret', backup.icalSecret);
    if ('avatar' in backup) {
      if (backup.avatar) localStorage.setItem('profileAvatar', JSON.stringify(backup.avatar));
      else               localStorage.removeItem('profileAvatar');
    }
    if (backup.config) {
      if (backup.config.zoom)       localStorage.setItem('zoom',       backup.config.zoom);
      if (backup.config.lang)       localStorage.setItem('lang',       backup.config.lang);
      if (backup.config.timezone)   localStorage.setItem('timezone',   backup.config.timezone);
      if (backup.config.icalHour)   localStorage.setItem('icalHour',   backup.config.icalHour);
      if (backup.config.icalFilters) localStorage.setItem('icalFilters', JSON.stringify(backup.config.icalFilters));
      const _bPal0 = backup.config.bgPalette;
      if (_bPal0)  this.setPalette(_bPal0, { sync: false });
      if (backup.config.bgColor && (!_bPal0 || _bPal0 === 'none'))  _setBgColor(backup.config.bgColor);
    }
    localStorage.setItem('todos', JSON.stringify(backup.calendar));
    this.render();
  }

  // ═══════════════════════════════════════════════════
  // THEME & ZOOM
  // ═══════════════════════════════════════════════════

  // Call after any user-triggered config change so Firestore stays in sync
  // and the local config timestamp prevents Firestore from overwriting it on reload.
  _saveConfigChange() {
    localStorage.setItem('_localConfigTime', Date.now().toString());
    pushToFirestore(getFullBackup(state.todos)).catch(() => {});
    saveBackupToServer(getFullBackup(state.todos));
  }

  initTheme() {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    // Restore primary color (migrate old yellow defaults to blue)
    const _yellows = new Set(['#fbbf24', '#f59e0b', '#d97706', '#fcd34d']);
    let primaryColor = localStorage.getItem('primaryColor');
    if (!primaryColor || _yellows.has(primaryColor)) {
      primaryColor = '#60a5fa';
      localStorage.setItem('primaryColor', primaryColor);
    }
    this._applyPrimaryColor(primaryColor);
    this.updateThemeBtn();
  }

  toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    this.updateThemeBtn();
    this._saveConfigChange();
    if (state.view === 'profile') this.render();
  }

  updateThemeBtn() {
    // themeBtn removed — theme state managed by settingsLightBtn/settingsDarkBtn
  }

  toggleSettingsMenu() {
    const menu = document.getElementById('settingsMenu');
    const isHidden = menu.classList.contains('hidden');
    if (isHidden) {
      this.openSettingsMenu();
    } else {
      this.closeSettingsMenu();
    }
  }

  openSettingsMenu() {
    const menu = document.getElementById('settingsMenu');
    menu.classList.remove('hidden');
    document.getElementById('menuSettingsBtn')?.classList.add('open');
    this._updateSettingsMenuContent();
    // Close when clicking outside
    if (!this._settingsMenuCloser) {
      this._settingsMenuCloser = (e) => {
        const btn = document.getElementById('menuSettingsBtn');
        if (!menu.contains(e.target) && !btn.contains(e.target)) {
          this.closeSettingsMenu();
        }
      };
      document.addEventListener('click', this._settingsMenuCloser);
    }
  }

  closeSettingsMenu() {
    const menu = document.getElementById('settingsMenu');
    menu.classList.add('hidden');
    document.getElementById('menuSettingsBtn')?.classList.remove('open');
    document.getElementById('settingsBgColor')?.blur();
    if (this._settingsMenuCloser) {
      document.removeEventListener('click', this._settingsMenuCloser);
      this._settingsMenuCloser = null;
    }
  }

  // ─── Quick Find Search ─────────────────────────────────────────────
  _searchTodos(query) {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return state.todos.filter(t => t.title.toLowerCase().includes(q)).slice(0, 5);
  }

  onQuickFind(event) {
    const input = event.target;
    const query = input.textContent.trim();
    const dropdown = document.getElementById('quickFindDropdown');

    if (!query) {
      dropdown.classList.add('hidden');
      return;
    }

    const results = this._searchTodos(query);
    if (results.length === 0) {
      dropdown.classList.add('hidden');
      return;
    }

    this._renderQuickFindDropdown(results, query);
    dropdown.classList.remove('hidden');
  }

  onQuickFindKeydown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      const input = event.target;
      const query = input.textContent.trim();
      if (query) {
        this.openSearchView(query);
        input.blur();
      }
    } else if (event.key === 'Escape') {
      event.target.blur();
      document.getElementById('quickFindDropdown').classList.add('hidden');
    }
  }

  onSearchPageInput(event) {
    const query = event.target.value;
    localStorage.setItem('searchQuery', query);
    const cursorPos = event.target.selectionStart;
    this.render();
    const input = document.getElementById('searchPageInput');
    if (input) { input.focus(); input.setSelectionRange(cursorPos, cursorPos); }
  }

  onSearchPageKeydown(event) {
    if (event.key === 'Escape') { event.target.blur(); return; }
    if (event.key === 'Enter')  { this._saveSearchHistory(event.target.value.trim()); event.target.blur(); }
  }

  onSearchPageSubmit() {
    const input = document.getElementById('searchPageInput');
    if (!input) return;
    this._saveSearchHistory(input.value.trim());
    input.blur();
  }

  toggleSearchFilter(type, value) {
    localStorage.setItem(`searchFilter_${type}`, value);
    this.render();
    document.getElementById('searchPageInput')?.focus();
  }

  setSearchSort(value) {
    localStorage.setItem('searchSort', value);
    this.render();
    document.getElementById('searchPageInput')?.focus();
  }

  setSearchColumns(value) {
    localStorage.setItem('searchColumns', String(value));
    this.render();
    document.getElementById('searchPageInput')?.focus();
  }

  clearSearchHistory() {
    localStorage.removeItem('searchHistory');
    this.render();
    document.getElementById('searchPageInput')?.focus();
  }

  _saveSearchHistory(query) {
    if (!query) return;
    let h = JSON.parse(localStorage.getItem('searchHistory') || '[]');
    h = [query, ...h.filter(x => x !== query)].slice(0, 8);
    localStorage.setItem('searchHistory', JSON.stringify(h));
  }

  _quickFindItemMeta(todo) {
    const badges = [];
    const cats = getCategories();
    const today = DS(new Date());

    // Categories
    const catIds = todo.categoryIds || (todo.categoryId ? [todo.categoryId] : []);
    catIds.forEach(cid => {
      const cat = cats.find(c => c.id === cid);
      if (cat) badges.push(`<span class="qf-badge" style="background:${cat.color}22;border-color:${cat.color}88;color:${cat.color}">${esc(cat.name.toUpperCase())}</span>`);
    });

    // Priority
    if (todo.priority === 'high')   badges.push(`<span class="qf-badge prio-high">↑ Urgent</span>`);
    if (todo.priority === 'medium') badges.push(`<span class="qf-badge prio-medium">→ Moyen</span>`);
    if (todo.priority === 'low')    badges.push(`<span class="qf-badge prio-low">↓ Bas</span>`);

    const isRec = todo.recurrence && todo.recurrence !== 'none';

    if (isRec) {
      // Recurrence label
      const recLabels = { daily: '↻ Quotidien', weekly: '↻ Hebdo', monthly: '↻ Mensuel', yearly: '↻ Annuel' };
      badges.push(`<span class="qf-badge rec">${recLabels[todo.recurrence] || '↻'}</span>`);
      // Completion rate
      const completed = (todo.completedDates || []).length;
      const total = (todo.dates || []).length;
      if (total > 0) badges.push(`<span class="qf-badge completion">✓ ${completed}/${total}</span>`);
    } else {
      // Next upcoming date
      const upcoming = (todo.dates || []).filter(d => d >= today).sort()[0];
      const lastDate = (todo.dates || []).sort().slice(-1)[0];
      const dateToShow = upcoming || lastDate;
      if (dateToShow) {
        const [y, m, d] = dateToShow.split('-');
        badges.push(`<span class="qf-badge date">📅 ${d}/${m}/${y}</span>`);
      }
      // Done status
      if (todo.completed) badges.push(`<span class="qf-badge done">✓ Fait</span>`);
    }

    // Age depuis création (ID = timestamp ms)
    const ts = parseInt(todo.id);
    if (!isNaN(ts) && ts > 1000000000000) {
      const days = Math.floor((Date.now() - ts) / 86400000);
      let age;
      if (days === 0)       age = "Aujourd'hui";
      else if (days === 1)  age = 'Hier';
      else if (days < 30)   age = `${days}j`;
      else if (days < 365)  age = `${Math.floor(days / 30)} mois`;
      else                  age = `${Math.floor(days / 365)} an${Math.floor(days / 365) > 1 ? 's' : ''}`;
      badges.push(`<span class="qf-badge date" title="Créé il y a ${days} jours">🕐 ${age}</span>`);
    }

    return badges.join('');
  }

  _renderQuickFindDropdown(results, query) {
    const dropdown = document.getElementById('quickFindDropdown');
    const qEsc = query.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    let html = '';

    results.forEach(todo => {
      const meta = this._quickFindItemMeta(todo);
      html += `
        <div class="quick-find-item" data-id="${todo.id}" draggable="true" onclick="window.app.openSearchView('${qEsc}')">
          <div class="quick-find-drag-handle">⠿</div>
          <div class="quick-find-item-body">
            <div class="quick-find-item-title">${esc(todo.title)}</div>
            ${meta ? `<div class="quick-find-item-meta">${meta}</div>` : ''}
          </div>
        </div>
      `;
    });

    html += `<div class="quick-find-view-all" onclick="window.app.openSearchView('${qEsc}')">Voir tous les résultats</div>`;

    dropdown.innerHTML = html;
    this._initQuickFindDragDrop();
    this._setupQuickFindCloser();
  }

  _setupQuickFindCloser() {
    if (this._quickFindCloser) return; // Already set up

    this._quickFindCloser = (e) => {
      const input = document.getElementById('quickFindInput');
      const dropdown = document.getElementById('quickFindDropdown');
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    };
    document.addEventListener('click', this._quickFindCloser);
  }

  _closeQuickFindDropdown() {
    if (this._quickFindCloser) {
      document.removeEventListener('click', this._quickFindCloser);
      this._quickFindCloser = null;
    }
  }

  _initQuickFindDragDrop() {
    const dropdown = document.getElementById('quickFindDropdown');
    let draggedId = null;

    dropdown.addEventListener('dragstart', e => {
      const item = e.target.closest('.quick-find-item[draggable]');
      if (!item) return;
      draggedId = item.dataset.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggedId);
      this._setDragGhost(e, draggedId);
      requestAnimationFrame(() => {
        item.classList.add('dragging');
        this._closeQuickFindDropdown();
        document.getElementById('quickFindDropdown').classList.add('hidden');
      });
    });

    dropdown.addEventListener('dragend', e => {
      const item = e.target.closest('.quick-find-item');
      if (item) item.classList.remove('dragging');
      draggedId = null;
    });
  }

  openSearchView(query) {
    this._closeQuickFindDropdown();
    // Save current view so we can return to it after drop
    this._searchViewPreviousView = state.view;
    state.setView('search');
    localStorage.setItem('view', 'search');
    localStorage.setItem('searchQuery', query);
    // Close the dropdown
    const qfi = document.getElementById('quickFindInput');
    document.getElementById('quickFindDropdown').classList.add('hidden');
    qfi.textContent = '';
    qfi.blur();
    this._saveSearchHistory(query);
    this.render();
    // Focus the in-page search input
    const searchInput = document.getElementById('searchPageInput');
    if (searchInput) { searchInput.focus(); searchInput.setSelectionRange(query.length, query.length); }
  }

  _closeSearchView() {
    if (this._searchViewPreviousView && this._searchViewPreviousView !== 'search') {
      state.setView(this._searchViewPreviousView);
      localStorage.setItem('view', this._searchViewPreviousView);
      this._searchViewPreviousView = null;
      this._pushHistory();
      this.render();
    }
  }

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    this.updateThemeBtn();
    this._saveConfigChange();
    this._updateSettingsMenuContent();
    if (state.view === 'profile') this.render();
  }

  toggleGlassMode() {
    const enabled = document.getElementById('settingsGlassInput').checked;
    localStorage.setItem('glassMode', enabled ? '1' : '0');
    document.documentElement.classList.toggle('glass-mode', enabled);
    this._saveConfigChange();
  }

  _updateSettingsMenuContent() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const zoomIdx = this.zoomIdx ?? 1;
    const glassMode = localStorage.getItem('glassMode') === '1';
    const primaryColor = localStorage.getItem('primaryColor') || '#60a5fa';
    const bgPalette = localStorage.getItem('bgPalette') || 'geo';
    const bgColor = localStorage.getItem('bgColor') || (isDark ? '#0f1117' : '#f8f9fc');

    // Update theme buttons
    document.getElementById('settingsLightBtn').classList.toggle('active', !isDark);
    document.getElementById('settingsDarkBtn').classList.toggle('active', isDark);

    // Update text size buttons
    document.querySelectorAll('.settings-size-btn').forEach((btn, i) => {
      btn.classList.toggle('active', i === zoomIdx);
    });
    document.getElementById('settingsSizePreview').textContent = ['Small', 'Normal', 'Large'][zoomIdx];

    // Update glass mode checkbox
    document.getElementById('settingsGlassInput').checked = glassMode;

    // Update accent color picker (presets + custom input)
    const accentColors = isDark
      ? ['#60a5fa', '#f87171', '#4ade80', '#a78bfa', '#f472b6', '#fb923c']
      : ['#3b82f6', '#ef4444', '#10b981', '#8b5cf6', '#ec4899', '#f97316'];
    const pickerHtml = accentColors.map(c =>
      `<button class="settings-accent-btn${primaryColor === c ? ' active' : ''}" style="background:${c};" onclick="window.app.setPrimaryColor('${c}')" title="${c}"></button>`
    ).join('');
    document.getElementById('settingsAccentPicker').innerHTML = pickerHtml;
    document.getElementById('settingsAccentColor').value = primaryColor;

    // Update background (palettes) buttons (only geo & aurora, no 'none')
    const paletteOpts = [
      { id: 'geo', emoji: '🌋', name: 'Géo' },
      { id: 'aurora', emoji: '🌊', name: 'Aurora' },
    ];
    const palettesHtml = paletteOpts.map(p =>
      `<button class="settings-palette-btn${bgPalette === p.id ? ' active' : ''}" onclick="window.app.setPalette('${p.id}')" title="${p.name}"><span style="font-size:24px;">${p.emoji}</span><div class="palette-label">${p.name}</div></button>`
    ).join('');
    document.getElementById('settingsPalettesGrid').innerHTML = palettesHtml;

    // Update bg color picker (skip if the input is currently active to avoid closing the native picker)
    const _bgColorInput = document.getElementById('settingsBgColor');
    if (_bgColorInput && _bgColorInput !== document.activeElement) {
      _bgColorInput.value = bgColor;
    }
  }

  setPalette(id, { sync = true } = {}) {
    // Close color picker if open
    document.getElementById('settingsBgColor')?.blur();
    _setBgPalette(id);
    // Remember this palette for toggle restore
    if (id !== 'none') {
      localStorage.setItem('lastBgPalette', id);
    }
    if (sync) this._saveConfigChange();
    if (state.view === 'profile') this.render();
  }

  toggleBgMode() {
    const bgPalette = localStorage.getItem('bgPalette') || 'geo';
    if (bgPalette === 'none') {
      // Currently in uni mode — switch to poly (restore last palette)
      // Save current uni color for restoration later
      const currentColor = localStorage.getItem('bgColor');
      if (currentColor) {
        localStorage.setItem('lastBgColor', currentColor);
      }
      const lastPalette = localStorage.getItem('lastBgPalette') || 'geo';
      this.setPalette(lastPalette);
    } else {
      // Currently in poly mode — switch to uni (solid color)
      // Save current palette for restoration later
      localStorage.setItem('lastBgPalette', bgPalette);
      const lastColor = localStorage.getItem('lastBgColor');
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const defaultColor = isDark ? '#0f1117' : '#f8f9fc';
      const colorToUse = lastColor || defaultColor;
      _setBgColor(colorToUse);
      localStorage.setItem('bgColor', colorToUse);
      localStorage.setItem('bgPalette', 'none');
      this._saveConfigChange();
      if (state.view === 'profile') this.render();
    }
  }

  selectBgColor(e) {
    // Don't trigger if clicking the color input itself (let native behavior handle it)
    if (e?.target?.type === 'color') return;

    // Activate custom color mode
    const bgColorInput = document.getElementById('settingsBgColor');
    if (bgColorInput) {
      // Ensure custom color is selected (disable palette)
      const currentColor = bgColorInput.value;
      _setBgColor(currentColor);
      this._updateSettingsMenuContent();
      // Open picker on next tick to avoid interference with close
      setTimeout(() => bgColorInput.click(), 50);
    }
  }

  setBgColor(color) {
    _setBgColor(color);
    // Remember this color for toggle restore
    localStorage.setItem('lastBgColor', color);
    this._saveConfigChange();
    this._updateSettingsMenuContent();
  }

  _applyPrimaryColor(color) {
    document.documentElement.style.setProperty('--primary', color);
    if (/^#[0-9a-f]{6}$/i.test(color)) {
      const r = parseInt(color.slice(1,3), 16);
      const g = parseInt(color.slice(3,5), 16);
      const b = parseInt(color.slice(5,7), 16);
      document.documentElement.style.setProperty('--primary-rgb', `${r},${g},${b}`);
    }
  }

  setPrimaryColor(color) {
    this._applyPrimaryColor(color);
    localStorage.setItem('primaryColor', color);
    this._saveConfigChange();
    this._updateSettingsMenuContent();
  }

  initGlassMode() {
    document.documentElement.classList.toggle('glass-mode', localStorage.getItem('glassMode') === '1');
  }

  setGlassMode(enabled) {
    localStorage.setItem('glassMode', enabled ? '1' : '0');
    document.documentElement.classList.toggle('glass-mode', enabled);
    this._saveConfigChange();
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
    const zoomGroup = document.querySelector('.zoom-group');
    if (zoomGroup) zoomGroup.title = state.T.zoomButtonTitle;
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
    if (state.view==='plan') {
      const planMode = localStorage.getItem('planMode') || 'week';
      if (planMode === 'month' || planMode === 'biweek') {
        // Infinite scroll: shift by scrolling, no re-render needed
        const container = document.getElementById('planMonthScroll');
        if (container) {
          const week = container.querySelector('.plan-month-scroll-week');
          const rowH = week ? (week.offsetHeight + 8) : 130;
          const weeks = planMode === 'biweek' ? 2 : 4;
          container.scrollBy({ top: delta * weeks * rowH, behavior: 'smooth' });
          return;
        }
      } else {
        const base = startOfWeek(d);
        base.setDate(base.getDate() + delta * 14);
        state.setNavDate(base);
        this._pushHistory();
        await this._animateViewChange(delta);
        return;
      }
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
    localStorage.setItem('view', v);
    this._pushHistory();
    await this._animateViewChange();
    this._updateInboxBadge();
  }

  _buildHash(extra = {}) {
    const p = new URLSearchParams();
    p.set('view', state.view);
    p.set('nav', DS(state.navDate));
    for (const [k, v] of Object.entries(extra)) {
      if (v !== null && v !== undefined) p.set(k, v);
    }
    return '#' + p.toString();
  }

  _pushHistory() {
    const navStr = DS(state.navDate);
    history.pushState({ view: state.view, nav: navStr }, '', this._buildHash());
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
      const todoItems = document.querySelectorAll('.todo-item');
      if (todoItems.length) {
        gsap.from(todoItems, {
          opacity: 0,
          y: 8,
          duration: 0.2,
          stagger: { amount: 0.08 },
          ease: 'power3.out',
          overwrite: 'auto'
        });
      }
    }, 220);
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

  toggleTodo(id, d, e) {
    if (e?.ctrlKey) {
      celebrate(state.lang, true);
      return;
    }
    const todo = state.todos.find(x => x.id === id);
    const wasCompleted = isCompleted(todo, d);

    // Warn if completing a todo that has incomplete subtasks
    if (!wasCompleted && todo?.subtasks?.length) {
      const incomplete = todo.subtasks.filter(s => !s.completed);
      if (incomplete.length) {
        this._showSubtaskWarning(id, d, incomplete.length);
        return;
      }
    }

    snapshot(state.todos);
    toggleTodo(id, d, state.todos);
    saveTodos(state.todos);
    if (!wasCompleted && !e?.altKey) celebrate(state.lang);
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

  _showSubtaskWarning(id, d, count) {
    document.querySelectorAll('.subtask-warning-popover').forEach(el => el.remove());
    const ds = DS(d);
    const item = document.querySelector(`[data-id="${id}"]`);
    if (!item) return;
    const label = count === 1 ? '1 sous-tâche incomplète' : `${count} sous-tâches incomplètes`;
    const popover = document.createElement('div');
    popover.className = 'subtask-warning-popover';
    popover.onclick = e => e.stopPropagation();
    popover.innerHTML = `
      <div class="stw-label">${label}</div>
      <div class="stw-actions">
        <button onclick="event.stopPropagation();window.app.completeWithSubtasks('${id}','${ds}','all')">Tout compléter</button>
        <button onclick="event.stopPropagation();window.app.completeWithSubtasks('${id}','${ds}','skip')">Ignorer</button>
        <button onclick="event.stopPropagation();window.app.completeWithSubtasks('${id}','${ds}','cancel')">Annuler</button>
      </div>`;
    item.appendChild(popover);
    setTimeout(() => {
      const dismiss = e => {
        if (!popover.contains(e.target)) {
          popover.remove();
          document.removeEventListener('click', dismiss);
        }
      };
      document.addEventListener('click', dismiss);
    }, 10);
  }

  completeWithSubtasks(id, dsStr, mode) {
    document.querySelectorAll('.subtask-warning-popover').forEach(el => el.remove());
    if (mode === 'cancel') return;
    const todo = state.todos.find(x => x.id === id);
    if (!todo) return;
    snapshot(state.todos);
    if (mode === 'all' && todo.subtasks) {
      todo.subtasks.forEach(s => s.completed = true);
    }
    const d = this.parseDS(dsStr);
    toggleTodo(id, d, state.todos);
    saveTodos(state.todos);
    celebrate(state.lang);
    this.render();
    this._refreshCategoryPanel();
  }

  // ── Subtask methods ────────────────────────────────────────────────────────

  isSubtasksExpanded(id) {
    return this._expandedSubtasks.has(id);
  }

  toggleSubtasks(id) {
    if (this._expandedSubtasks.has(id)) {
      this._expandedSubtasks.delete(id);
    } else {
      this._expandedSubtasks.add(id);
    }
    this.render();
  }

  toggleSubtask(todoId, stid, ds) {
    const t = state.todos.find(x => x.id === todoId);
    const s = t?.subtasks?.find(x => x.id === stid);
    if (!s) return;
    snapshot(state.todos);
    s.completed = !s.completed;
    t.updatedAt = Date.now();
    saveTodos(state.todos);
    this.render();
  }

  deleteSubtask(todoId, stid) {
    const t = state.todos.find(x => x.id === todoId);
    if (!t?.subtasks) return;
    snapshot(state.todos);
    t.subtasks = t.subtasks.filter(x => x.id !== stid);
    t.updatedAt = Date.now();
    saveTodos(state.todos);
    this.render();
  }

  addSubtaskInline(todoId) {
    const list = document.querySelector(`[data-id="${todoId}"] .subtask-list`);
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
      if (title) this._saveNewSubtask(todoId, title);
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

  _saveNewSubtask(todoId, title) {
    const t = state.todos.find(x => x.id === todoId);
    if (!t) return;
    snapshot(state.todos);
    if (!t.subtasks) t.subtasks = [];
    t.subtasks.push({ id: Date.now().toString(), title, completed: false });
    t.updatedAt = Date.now();
    saveTodos(state.todos);
    this.render();
  }

  editSubtaskTitle(el, todoId, stid) {
    const t = state.todos.find(x => x.id === todoId);
    const s = t?.subtasks?.find(x => x.id === stid);
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
      if (newTitle && newTitle !== s.title) {
        snapshot(state.todos);
        s.title = newTitle;
        t.updatedAt = Date.now();
        saveTodos(state.todos);
      } else {
        el.textContent = esc(s.title);
      }
    };
    el.addEventListener('blur', save, { once: true });
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
      if (e.key === 'Escape') { el.textContent = esc(s.title); el.contentEditable = 'false'; }
    }, { once: true });
  }

  // ── Modal subtask delegates (called via window.app from modal HTML) ────────
  toggleModalSubtask(stid)    { toggleModalSubtask(stid); }
  removeModalSubtask(stid)    { removeModalSubtask(stid); }
  addModalSubtaskInline()     { addModalSubtaskInline(); }
  editModalSubtask(el, stid)  { editModalSubtask(el, stid); }

  _trackDeletion(id) {
    const dels = JSON.parse(localStorage.getItem('_deletions') || '{}');
    dels[id] = Date.now();
    localStorage.setItem('_deletions', JSON.stringify(dels));
  }

  deleteTodo(id, dateStr) {
    const t = state.todos.find(x => x.id === id);
    if (!t) return;
    if (!t.recurrence || t.recurrence === 'none') {
      this._animateDeleteAndRefresh(id, () => {
        snapshot(state.todos);
        this._trackDeletion(id);
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
    if (!state.pendingDelete) return;
    const { id } = state.pendingDelete;
    this._animateDeleteAndRefresh(id, () => {
      snapshot(state.todos);
      deleteOneOccurrence(id, state.pendingDelete.date, state.todos);
      closeDeleteModal();
      saveTodos(state.todos);
    });
  }

  deleteFutureOccurrences() {
    if (!state.pendingDelete) return;
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
    if (!state.pendingDelete) return;
    const { id } = state.pendingDelete;
    this._animateDeleteAndRefresh(id, () => {
      snapshot(state.todos);
      this._trackDeletion(id);
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
    const d = date || today();
    openModal(d, state.todos);
    const dateStr = typeof d === 'string' ? d : DS(d);
    history.replaceState({ view: state.view, nav: DS(state.navDate) }, '', this._buildHash({ modal: 'add', date: dateStr }));
  }

  openModalForInbox() {
    openModal(state.navDate, state.todos, 'inbox');
  }

  selectScheduleMode(mode) {
    selectScheduleMode(mode);
  }

  selectBigMode(mode) {
    selectBigMode(mode);
  }

  toggleDetailSection(headerEl) {
    toggleDetailSection(headerEl);
  }

  cancelModal() {
    cancelModal();
    history.replaceState({ view: state.view, nav: DS(state.navDate) }, '', this._buildHash());
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

  deleteFromEditModal() {
    const btn = document.getElementById('deleteFromEditBtn');
    if (!btn) return;
    const id = btn.dataset.id;
    const dateStr = btn.dataset.date || null;
    closeModal();
    setTimeout(() => this.deleteTodo(id, dateStr), 250);
  }

  toggleCompleteMenu() {
    const menu = document.getElementById('completeMenu');
    if (!menu) return;
    const visible = menu.style.display !== 'none';
    menu.style.display = visible ? 'none' : '';
    // Hide date picker when toggling menu
    const picker = document.getElementById('completeDatePicker');
    if (picker) { picker.style.display = 'none'; picker.value = ''; }
    // Close menu on outside click
    if (!visible) {
      const close = (e) => {
        if (!menu.contains(e.target) && e.target.id !== 'completeFromEditBtn') {
          menu.style.display = 'none';
          document.removeEventListener('click', close);
        }
      };
      setTimeout(() => document.addEventListener('click', close), 0);
    }
  }

  showCompleteDatePicker() {
    const picker = document.getElementById('completeDatePicker');
    if (!picker) return;
    picker.style.display = '';
    picker.value = DS(today());
    picker.focus();
    picker.showPicker?.();
  }

  completeFromEditModal(mode) {
    const wrap = document.getElementById('completeFromEditWrap');
    if (!wrap) return;
    const id = wrap.dataset.id;
    const taskDate = wrap.dataset.date || null;
    const t = state.todos.find(x => x.id === id);
    if (!t) return;

    let completedDate;
    if (mode === 'original') {
      completedDate = taskDate || DS(today());
    } else if (mode === 'today') {
      completedDate = DS(today());
    } else if (mode === 'pick') {
      const picker = document.getElementById('completeDatePicker');
      completedDate = picker?.value || DS(today());
    }

    snapshot(state.todos);
    t.completed = true;
    t.completedDate = completedDate;
    t.updatedAt = Date.now();
    saveTodos(state.todos);
    closeModal();
    celebrate(state.lang);
    this.render();
  }

  openEditModal(id, dateStr) {
    openEditModal(id, dateStr, state.todos);
    history.replaceState({ view: state.view, nav: DS(state.navDate) }, '', this._buildHash({ modal: 'edit', id, date: dateStr }));
  }

  _showCelebrateDebugPanel(data) {
    console.log('[panel] showing debug panel with data:', data);
    const { quote, mascot, font, duration } = data;
    const fontName = font.replace(/['",]/g, '').split('sans-serif|serif')[0].trim();

    // Remove old panel if exists
    const old = document.getElementById('celebrateDebugPanel');
    if (old) old.remove();

    const panel = document.createElement('div');
    panel.id = 'celebrateDebugPanel';
    panel.style.cssText = `
      position: fixed; top: 12px; left: 12px; z-index: 9995;
      background: rgba(20,10,30,0.95); border: 2px solid rgba(255,180,255,0.5);
      border-radius: 16px; padding: 24px 32px; max-width: 640px;
      font-family: monospace; font-size: 24px; color: #ddd;
      backdrop-filter: blur(8px); animation: fadeIn 0.25s ease-out;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    `;
    panel.innerHTML = `
      <style>
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        #celebrateDebugPanel button {
          background: rgba(255,100,200,0.7); border: none; color: #fff;
          padding: 4px 12px; border-radius: 6px; cursor: pointer; font-size: 18px;
          margin-left: 8px; transition: background 0.2s; vertical-align: middle;
        }
        #celebrateDebugPanel button:hover { background: rgba(255,100,200,1); }
        #celebrateDebugPanel .editable {
          cursor: pointer; padding: 8px; border-radius: 4px; display: block;
          min-height: 4.5em; white-space: pre-wrap; word-break: break-word;
          background: rgba(0,0,0,0.2); font-family: monospace;
        }
        #celebrateDebugPanel .editable:hover { background: rgba(255,100,200,0.15); }
        #celebrateDebugPanel .editable[contenteditable="true"] { background: rgba(255,100,200,0.2); border: 1px solid rgba(255,100,200,0.5); outline: none; }
      </style>
      <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
        <strong>🎉 Celebrate Debug</strong>
        <button id="closePanel" style="background: rgba(255,100,200,0.5); padding: 2px 8px; font-size: 16px; cursor: pointer; border: none; color: #fff; border-radius: 4px;">✕</button>
      </div>
      <div style="margin-bottom: 12px; opacity: 0.8;">Quote: <div class="editable" id="debugQuote" contenteditable="false">${quote}</div><button id="updateQuoteBtn" style="display: none;" onclick="window.app._updateQuote()">Update</button><button onclick="window.app._banQuote('${quote.replace(/'/g, '"')}')">Ban</button></div>
      <div style="margin-bottom: 12px; opacity: 0.8;">Mascot: <span style="font-size: 48px;">${mascot}</span> <button onclick="window.app._banMascot('${mascot}')">Ban</button></div>
      <div style="margin-bottom: 16px; opacity: 0.8;">Font: <code>${fontName}</code> <button onclick="window.app._banFont('${font.replace(/'/g, '"')}')">Ban</button></div>
      <div style="margin-bottom: 0; opacity: 0.8;">Duration: <code>${duration}s</code></div>
    `;
    document.body.appendChild(panel);

    // Enable quick edit for quote only
    const quoteEl = panel.querySelector('#debugQuote');
    const updateBtn = panel.querySelector('#updateQuoteBtn');

    quoteEl?.addEventListener('click', () => {
      if (quoteEl.getAttribute('contenteditable') === 'false') {
        quoteEl.setAttribute('contenteditable', 'true');
        updateBtn.style.display = 'inline-block';
        quoteEl.focus();
      }
    });

    quoteEl?.addEventListener('keydown', (e) => {
      // Ctrl+Enter or Shift+Enter to save
      if ((e.ctrlKey || e.shiftKey) && e.key === 'Enter') {
        e.preventDefault();
        window.app._updateQuote();
      }
    });

    window.app._updateQuote = function() {
      if (quoteEl) {
        quoteEl.setAttribute('contenteditable', 'false');
        updateBtn.style.display = 'none';
      }
    };

    // Auto-fade after duration + 3.5s (so 3.5s after celebrate animation ends)
    let dismissTimeout = setTimeout(() => {
      if (panel.parentNode) {
        panel.style.animation = 'fadeIn 0.25s ease-in reverse';
        setTimeout(() => panel.remove(), 250);
      }
    }, (duration + 3.5) * 1000);

    // Cancel auto-dismiss if user starts editing
    const cancelAutoClose = () => clearTimeout(dismissTimeout);
    quoteEl?.addEventListener('click', cancelAutoClose);

    // Close button
    const closeBtn = panel.querySelector('#closePanel');
    closeBtn?.addEventListener('click', () => {
      document.removeEventListener('keydown', onKeyDown);
      if (panel.parentNode) {
        panel.style.animation = 'fadeIn 0.25s ease-in reverse';
        setTimeout(() => panel.remove(), 250);
      }
    });

    // Allow Escape to close panel manually
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', onKeyDown);
        if (panel.parentNode) {
          panel.style.animation = 'fadeIn 0.25s ease-in reverse';
          setTimeout(() => panel.remove(), 250);
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
  }

  _banQuote(quote) {
    banQuote(quote);
    const panel = document.getElementById('celebrateDebugPanel');
    if (panel) {
      const btns = panel.querySelectorAll('button');
      const btn = btns[2];
      const orig = btn.textContent;
      btn.textContent = '✓ Banned!';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    }
  }

  _banFont(font) {
    banFont(font);
    const panel = document.getElementById('celebrateDebugPanel');
    if (panel) {
      const btns = panel.querySelectorAll('button');
      const btn = btns[4];
      const orig = btn.textContent;
      btn.textContent = '✓ Banned!';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    }
  }

  _banMascot(mascot) {
    banMascot(mascot);
    const panel = document.getElementById('celebrateDebugPanel');
    if (panel) {
      const btns = panel.querySelectorAll('button');
      const btn = btns[3];
      const orig = btn.textContent;
      btn.textContent = '✓ Banned!';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    }
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

    const projectsCount = getProjects().length;
    const projectsBadge = document.getElementById('projectsBadge');
    if (projectsBadge) { projectsBadge.textContent = projectsCount; projectsBadge.classList.toggle('hidden', projectsCount === 0); }

    let intentionsCount = 0;
    try { intentionsCount = JSON.parse(localStorage.getItem('intentions') || '[]').length; } catch {}
    const intentionsBadge = document.getElementById('intentionsBadge');
    if (intentionsBadge) { intentionsBadge.textContent = intentionsCount; intentionsBadge.classList.toggle('hidden', intentionsCount === 0); }

    const todayStr = DS(today());
    const overdueCount = state.todos.filter(t =>
      t.date && t.date < todayStr &&
      !t.completed &&
      (!t.recurrence || t.recurrence === 'none')
    ).length;
    const overdueBadge = document.getElementById('overdueBadge');
    if (overdueBadge) { overdueBadge.textContent = overdueCount; overdueBadge.classList.toggle('hidden', overdueCount === 0); }
  }

  assignInboxToday(id) {
    const t = state.todos.find(x => x.id === id);
    if (!t) return;
    snapshot(state.todos);
    t.date = DS(today());
    t.updatedAt = Date.now();
    saveTodos(state.todos);
    this.render();
  }

  assignInboxToDate(id, dateStr) {
    const t = state.todos.find(x => x.id === id);
    if (!t) return;
    snapshot(state.todos);
    t.date = dateStr;
    t.backlog = false;
    t.updatedAt = Date.now();
    saveTodos(state.todos);
    this.render();
  }

  toggleInboxDone(id) {
    const t = state.todos.find(x => x.id === id);
    if (!t) return;
    snapshot(state.todos);
    t.completed = !t.completed;
    t.updatedAt = Date.now();
    saveTodos(state.todos);
    if (t.completed) celebrate(state.lang);
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

  _reloadPlanCol() {
    const col = document.getElementById('planInboxCol');
    if (col) { col.innerHTML = renderPlanInboxList(state.todos, this._overdueSelected || new Set()); this.initPlanDragDrop(); }
  }

  setPlanSort(sort, section) {
    const k = `planSort_${section}`;
    const cur = localStorage.getItem(k) || 'date';
    if (cur === sort) {
      const dir = localStorage.getItem(`planSortDir_${section}`) || 'desc';
      localStorage.setItem(`planSortDir_${section}`, dir === 'desc' ? 'asc' : 'desc');
    } else {
      localStorage.setItem(k, sort);
      localStorage.setItem(`planSortDir_${section}`, 'desc');
    }
    this._reloadPlanCol();
  }

  togglePlanSortMenu(section) {
    const k = `planSortCollapsed_${section}`;
    localStorage.setItem(k, localStorage.getItem(k) !== 'false' ? 'false' : 'true');
    this._reloadPlanCol();
  }

  closePlanSortMenu() {
    this._reloadPlanCol();
  }

  setPlanColCount(n) {
    localStorage.setItem('planColCount', n);
    const col = document.getElementById('planInboxCol');
    if (col) { col.innerHTML = renderPlanInboxList(state.todos, this._overdueSelected || new Set()); this.initPlanDragDrop(); }
  }

  togglePlanColMenu() {
    const cur = localStorage.getItem('planColCollapsed') !== 'false';
    localStorage.setItem('planColCollapsed', cur ? 'false' : 'true');
    const col = document.getElementById('planInboxCol');
    if (col) { col.innerHTML = renderPlanInboxList(state.todos, this._overdueSelected || new Set()); this.initPlanDragDrop(); }
  }

  closePlanColMenu() {
    localStorage.setItem('planColCollapsed', 'true');
    const col = document.getElementById('planInboxCol');
    if (col) { col.innerHTML = renderPlanInboxList(state.todos, this._overdueSelected || new Set()); this.initPlanDragDrop(); }
  }

  togglePlanGrouped() {
    const cur = localStorage.getItem('planGrouped') === 'true';
    localStorage.setItem('planGrouped', cur ? 'false' : 'true');
    const col = document.getElementById('planInboxCol');
    if (col) { col.innerHTML = renderPlanInboxList(state.todos, this._overdueSelected || new Set()); this.initPlanDragDrop(); }
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

  selectDayPeriod(period) {
    const input = document.getElementById('taskDayPeriod');
    if (input) input.value = period;
    document.querySelectorAll('.day-period-btn').forEach(btn => {
      const isActive = btn.dataset.period === period;
      btn.classList.toggle('active', isActive);
      if (isActive) gsap.fromTo(btn, { scale: 0.9 }, { scale: 1, duration: 0.25, ease: 'back.out(2)' });
    });
  }

  toggleDayPeriod(period) {
    const input = document.getElementById('taskDayPeriod');
    const current = input?.value || '';
    const newVal = current === period ? '' : period;
    this.selectDayPeriod(newVal);
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

  openGuidedCards() { openGuidedCards(); }
  closeGuidedCards() { closeGuidedCards(); }
  guidedNext() { guidedNext(); }
  guidedBack() { guidedBack(); }
  guidedFinish() { guidedFinish(); }
  guidedSelectWhen(mode) { guidedSelectWhen(mode); }
  guidedSelectRecurrence(val) { guidedSelectRecurrence(val); }
  guidedSetToday() { guidedSetToday(); }
  guidedSetTomorrow() { guidedSetTomorrow(); }
  guidedToggleNewCat() { guidedToggleNewCat(); }
  guidedAddCategory() { guidedAddCategory(); }

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
      history.replaceState({ view: state.view, nav: DS(state.navDate) }, '', this._buildHash());
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
    const catIds = t?.categoryIds || (t?.categoryId ? [t.categoryId] : []);
    if (catIds.length) {
      setTimeout(() => catIds.forEach(cid => toggleCategoryTag(cid)), 60);
    }
  }

  duplicateTodo(id, ds) {
    const t = state.todos.find(x => x.id === id);
    if (!t) return;
    snapshot(state.todos);
    const _cloneId = Date.now().toString();
    const clone = { ...JSON.parse(JSON.stringify(t)), id: _cloneId, completed: false, completedDates: [], updatedAt: parseInt(_cloneId) };
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

  showTodoMenu(e, id, ds) {
    _showTodoCtxMenu(e.currentTarget, id, ds);
  }

  clickTodo(e, id, ds) {
    if (e.target.closest('.todo-check, .todo-actions, .todo-menu-btn, .todo-drag-handle, .subtask-dots, .subtask-list, .subtask-warning-popover')) return;
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
      const items = getTodosForDate(state.navDate, state.todos).filter(t => (!t.recurrence || t.recurrence === 'none') && !t.dayPeriod);
      let order = this.dayOrder[dateStr] ? [...this.dayOrder[dateStr]] : items.map(t => t.id);
      items.forEach(t => { if (!order.includes(t.id)) order.push(t.id); });
      order = order.filter(id => id.startsWith('spacer-') || items.some(t => t.id === id));
      const newOrder = order.filter(id => id !== draggedId);
      const idx = newOrder.indexOf(targetId);
      if (idx < 0) return;
      newOrder.splice(before ? idx : idx + 1, 0, draggedId);
      this.dayOrder[dateStr] = newOrder;
      localStorage.setItem('dayOrder', JSON.stringify(this.dayOrder));
    } else if (group.startsWith('punctual-')) {
      const periodMap = { 'punctual-morning': 'morning', 'punctual-afternoon': 'afternoon', 'punctual-evening': 'evening' };
      const period = periodMap[group];
      const items = getTodosForDate(state.navDate, state.todos).filter(t => (!t.recurrence || t.recurrence === 'none') && t.dayPeriod === period);
      if (!this.punctualPeriodOrder[dateStr]) this.punctualPeriodOrder[dateStr] = {};
      let order = this.punctualPeriodOrder[dateStr][period] ? [...this.punctualPeriodOrder[dateStr][period]] : items.map(t => t.id);
      items.forEach(t => { if (!order.includes(t.id)) order.push(t.id); });
      order = order.filter(id => items.some(t => t.id === id));
      const newOrder = order.filter(id => id !== draggedId);
      const idx = newOrder.indexOf(targetId);
      if (idx < 0) return;
      newOrder.splice(before ? idx : idx + 1, 0, draggedId);
      this.punctualPeriodOrder[dateStr][period] = newOrder;
      localStorage.setItem('punctualPeriodOrder', JSON.stringify(this.punctualPeriodOrder));
    } else {
      // For daily sub-periods, filter by both recurrence and dayPeriod
      const periodMap = { 'daily-morning': 'morning', 'daily-afternoon': 'afternoon', 'daily-evening': 'evening' };
      const period = periodMap[group];
      const recType = period ? 'daily' : group;
      const items = getTodosForDate(state.navDate, state.todos).filter(t => {
        if (t.recurrence !== recType) return false;
        if (period) return t.dayPeriod === period;
        if (recType === 'daily') return !t.dayPeriod;
        return true;
      });
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
    todo.updatedAt = Date.now();
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
      this._setDragGhost(e, draggedId);
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
    order = order.filter(id => id.startsWith('spacer-') || items.some(t => t.id === id));
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
      this._setDragGhost(e, draggedId);
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

  initSearchDragDrop() {
    const container = document.querySelector('.search-view-items');
    if (!container) return;
    let draggedId = null;

    container.addEventListener('dragstart', e => {
      const item = e.target.closest('.todo-item[draggable]');
      if (!item) return;
      draggedId = item.dataset.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggedId);
      this._setDragGhost(e, draggedId);
      requestAnimationFrame(() => item.classList.add('dragging'));
    });

    container.addEventListener('dragend', e => {
      const item = e.target.closest('.todo-item');
      if (item) item.classList.remove('dragging');
      draggedId = null;
    });
  }

  initDayDragDrop() {
    const container = document.querySelector('.day-columns');
    if (!container) return;
    let draggedEl = null, draggedGroup = null, dropTarget = null, dropPriority = null, dropPeriod = null;
    let draggedHeight = 0;

    // Gap placeholder
    const placeholder = document.createElement('div');
    placeholder.className = 'drop-gap';
    let activeDropSpacer = null, activeHeureLabel = null;
    const clearDropSpacer = () => {
      if (activeDropSpacer) { activeDropSpacer.classList.remove('drop-target'); activeDropSpacer = null; }
      if (activeHeureLabel) { activeHeureLabel.classList.remove('drop-target'); activeHeureLabel = null; }
    };
    const removePlaceholder = () => {
      placeholder.style.height = '0px';
      placeholder.classList.remove('visible');
      clearDropSpacer();
      requestAnimationFrame(() => { if (placeholder.parentNode) placeholder.remove(); });
    };

    const showDragged = () => {
      if (draggedEl) { draggedEl.style.display = ''; draggedEl.classList.remove('dragging'); }
    };

    const draggableSel = '.todo-item[draggable], .day-spacer[draggable]';

    container.addEventListener('dragstart', e => {
      const item = e.target.closest(draggableSel);
      if (!item) return;
      draggedEl = item;
      draggedGroup = item.dataset.group;
      draggedHeight = item.offsetHeight;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.dataset.id);
      if (!item.classList.contains('day-spacer')) this._setDragGhost(e, item.dataset.id);
      container.classList.add('dragging-active');
      requestAnimationFrame(() => { item.style.display = 'none'; });
    });

    container.addEventListener('dragend', () => {
      showDragged();
      removePlaceholder();
      container.classList.remove('dragging-active');
      draggedEl = null; draggedGroup = null; dropTarget = null; dropPriority = null; dropPeriod = null;
    });

    container.addEventListener('dragover', e => {
      e.preventDefault();
      if (!draggedEl) return;

      const _ds = localStorage.getItem('daySort');
      const isHeureDrop = _ds === 'chrono' || _ds === 'heure';
      const isPunctGroup = g => g === 'punctual' || g?.startsWith('punctual-');

      // Hover on a todo-item → drop after it
      const todoTarget = e.target.closest('.todo-item[draggable]');
      if (todoTarget && todoTarget !== draggedEl) {
        const sameGroup  = todoTarget.dataset.group === draggedGroup;
        const heureGroup = isHeureDrop && isPunctGroup(todoTarget.dataset.group) && isPunctGroup(draggedGroup);
        if (sameGroup || heureGroup) {
          clearDropSpacer();
          dropTarget = todoTarget.dataset.id;
          dropPriority = todoTarget.closest('.todo-list[data-priority]')?.dataset.priority || null;
          if (isHeureDrop) {
            const grp = todoTarget.dataset.group;
            dropPeriod = grp === 'punctual' ? '' : grp.replace('punctual-', '');
          }
          todoTarget.parentNode.insertBefore(placeholder, todoTarget.nextSibling);
          requestAnimationFrame(() => {
            placeholder.style.height = draggedHeight + 'px';
            placeholder.classList.add('visible');
          });
          return;
        }
      }

      // Hover on a spacer → drop right after it (= bottom of its section)
      const spacerTarget = e.target.closest('.day-spacer[draggable]');
      if (spacerTarget && spacerTarget !== draggedEl) {
        clearDropSpacer();
        activeDropSpacer = spacerTarget;
        spacerTarget.classList.add('drop-target');
        dropTarget = spacerTarget.dataset.id;
        dropPriority = null;
        const group = spacerTarget.closest('.day-spacer-group');
        const todoList = group?.querySelector('.todo-list[data-group="punctual"]');
        if (todoList) {
          // Section has items — show placeholder at end of list
          const lastItem = [...todoList.querySelectorAll('.todo-item[draggable]')].filter(el => el !== draggedEl).pop();
          if (lastItem) {
            dropTarget = lastItem.dataset.id;
            lastItem.parentNode.insertBefore(placeholder, lastItem.nextSibling);
          } else {
            todoList.appendChild(placeholder);
          }
        } else {
          // Empty section — show placeholder right after the spacer
          spacerTarget.parentNode.insertBefore(placeholder, spacerTarget.nextSibling);
        }
        requestAnimationFrame(() => {
          placeholder.style.height = draggedHeight + 'px';
          placeholder.classList.add('visible');
        });
        return;
      }

      // Hover on a group label (priority/tag mode) → drop at end of that group
      const groupLabel = e.target.closest('.day-auto-group-label');
      if (groupLabel) {
        const section = groupLabel.closest('.day-spacer-group, .day-tag-section');
        const todoList = section?.querySelector('.todo-list[data-group]');
        if (todoList && (todoList.dataset.group === draggedGroup || draggedGroup === 'punctual')) {
          dropPriority = todoList.dataset.priority || null;
          const lastItem = [...todoList.querySelectorAll('.todo-item[draggable]')].filter(el => el !== draggedEl).pop();
          if (lastItem) {
            dropTarget = lastItem.dataset.id;
            lastItem.parentNode.insertBefore(placeholder, lastItem.nextSibling);
          } else {
            // Empty group — use first item of next group as "before" target, or fallback
            const allItems = [...container.querySelectorAll('.todo-item[draggable]')].filter(el => el !== draggedEl);
            const lastOverall = allItems.pop();
            if (lastOverall) {
              dropTarget = lastOverall.dataset.id;
              lastOverall.parentNode.insertBefore(placeholder, lastOverall.nextSibling);
            }
          }
          if (dropTarget) {
            requestAnimationFrame(() => {
              placeholder.style.height = draggedHeight + 'px';
              placeholder.classList.add('visible');
            });
          }
        }
        return;
      }

      // Hover on a heure period label or empty section → change moment
      if (isHeureDrop && !e.target.closest('.todo-item')) {
        const heureLabel   = e.target.closest('.day-heure-label[data-period]');
        const heureSection = !heureLabel && e.target.closest('.day-heure-section[data-period]');
        const heureTarget  = heureLabel || heureSection;
        if (heureTarget) {
          clearDropSpacer();
          activeHeureLabel = heureLabel || heureTarget.querySelector('.day-heure-label');
          if (activeHeureLabel) activeHeureLabel.classList.add('drop-target');
          dropPeriod = heureTarget.dataset.period;
          const section  = heureTarget.closest('.day-heure-section') || heureTarget;
          const todoList = section?.querySelector('.todo-list[data-group]');
          if (todoList) {
            const lastItem = [...todoList.querySelectorAll('.todo-item[draggable]')].filter(el => el !== draggedEl).pop();
            if (lastItem) {
              dropTarget = lastItem.dataset.id;
              lastItem.parentNode.insertBefore(placeholder, lastItem.nextSibling);
            } else {
              todoList.appendChild(placeholder);
              dropTarget = '__heure_empty__';
            }
            requestAnimationFrame(() => {
              placeholder.style.height = draggedHeight + 'px';
              placeholder.classList.add('visible');
            });
          }
          return;
        }
      }

      // Hover on empty space inside a spacer group → drop at end of that group
      const spacerGroup = e.target.closest('.day-spacer-group');
      if (spacerGroup && !e.target.closest('.todo-item, .day-spacer')) {
        const spacer = spacerGroup.querySelector('.day-spacer[draggable]');
        if (spacer && spacer !== draggedEl) {
          clearDropSpacer();
          activeDropSpacer = spacer;
          spacer.classList.add('drop-target');
          const todoList = spacerGroup.querySelector('.todo-list[data-group="punctual"]');
          const lastItem = todoList ? [...todoList.querySelectorAll('.todo-item[draggable]')].filter(el => el !== draggedEl).pop() : null;
          if (lastItem) {
            dropTarget = lastItem.dataset.id;
            lastItem.parentNode.insertBefore(placeholder, lastItem.nextSibling);
          } else {
            dropTarget = spacer.dataset.id;
            if (todoList) todoList.appendChild(placeholder);
            else spacer.parentNode.insertBefore(placeholder, spacer.nextSibling);
          }
          requestAnimationFrame(() => {
            placeholder.style.height = draggedHeight + 'px';
            placeholder.classList.add('visible');
          });
          return;
        }
      }

      // Hover on empty zone at bottom of column → drop after last item/spacer
      const col = e.target.closest('.day-col--punctual');
      if (col && !e.target.closest('.todo-item, .day-spacer, .day-spacer-group, .day-auto-group-label, .day-col-title-row, .day-tag-controls')) {
        const allItems = [...col.querySelectorAll('.todo-item[draggable]')].filter(el => el !== draggedEl);
        const lastItem = allItems.pop();
        if (lastItem) {
          dropTarget = lastItem.dataset.id;
          dropPriority = lastItem.closest('.todo-list[data-priority]')?.dataset.priority || null;
          lastItem.parentNode.insertBefore(placeholder, lastItem.nextSibling);
          requestAnimationFrame(() => {
            placeholder.style.height = draggedHeight + 'px';
            placeholder.classList.add('visible');
          });
        }
      }
    });

    container.addEventListener('dragleave', e => {
      if (!container.contains(e.relatedTarget)) removePlaceholder();
    });

    container.addEventListener('drop', e => {
      e.preventDefault();
      removePlaceholder();
      if (!draggedEl) return;

      // In chrono sort mode, change the item's dayPeriod to match the target section
      const _dsMode = localStorage.getItem('daySort');
      if ((_dsMode === 'chrono' || _dsMode === 'heure') && !draggedEl.classList.contains('day-spacer') && dropPeriod !== null) {
        const t = state.todos.find(x => x.id === draggedEl.dataset.id);
        if (t) {
          if (dropPeriod === '') { delete t.dayPeriod; } else { t.dayPeriod = dropPeriod; }
          saveTodos(state.todos);
        }
        this.render();
        return;
      }

      if (!dropTarget) return;

      // In priority sort mode, change the item's priority to match the target group
      if (localStorage.getItem('daySort') === 'priority' && dropPriority != null) {
        const t = state.todos.find(x => x.id === draggedEl.dataset.id);
        if (t) {
          t.priority = dropPriority === 'none' ? '' : dropPriority;
          saveTodos(state.todos);
        }
      }

      this.dropReorder(draggedEl.dataset.id, draggedGroup, dropTarget, false);
    });
  }

  initTagSectionDragDrop() {
    const wrap = document.querySelector('.day-tag-sections');
    if (!wrap) return;
    let draggedSec = null;

    wrap.addEventListener('dragstart', e => {
      const sec = e.target.closest('.day-tag-section[draggable]');
      if (!sec) return;
      // Don't hijack todo-item drags
      if (e.target.closest('.todo-item[draggable]')) return;
      draggedSec = sec;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', sec.dataset.tagId);
      requestAnimationFrame(() => sec.classList.add('dragging'));
    });

    wrap.addEventListener('dragover', e => {
      e.preventDefault();
      if (!draggedSec) return;
      const sec = e.target.closest('.day-tag-section');
      if (!sec || sec === draggedSec) {
        wrap.querySelectorAll('.drag-over-section').forEach(el => el.classList.remove('drag-over-section'));
        return;
      }
      wrap.querySelectorAll('.drag-over-section').forEach(el => el.classList.remove('drag-over-section'));
      sec.classList.add('drag-over-section');
    });

    wrap.addEventListener('dragleave', e => {
      const sec = e.target.closest('.day-tag-section');
      if (sec && !sec.contains(e.relatedTarget)) sec.classList.remove('drag-over-section');
    });

    wrap.addEventListener('dragend', () => {
      if (draggedSec) draggedSec.classList.remove('dragging');
      wrap.querySelectorAll('.drag-over-section').forEach(el => el.classList.remove('drag-over-section'));
      draggedSec = null;
    });

    wrap.addEventListener('drop', e => {
      e.preventDefault();
      wrap.querySelectorAll('.drag-over-section').forEach(el => el.classList.remove('drag-over-section'));
      if (!draggedSec) return;
      const targetSec = e.target.closest('.day-tag-section');
      if (!targetSec || targetSec === draggedSec) return;

      // Reorder: collect current order, move dragged before target
      const sections = [...wrap.querySelectorAll('.day-tag-section')];
      const order = sections.map(s => s.dataset.tagId);
      const fromId = draggedSec.dataset.tagId;
      const toId = targetSec.dataset.tagId;
      const newOrder = order.filter(id => id !== fromId);
      const idx = newOrder.indexOf(toId);
      newOrder.splice(idx, 0, fromId);
      localStorage.setItem('dayTagOrder', JSON.stringify(newOrder));
      draggedSec = null;
      this.render();
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
    this._showToast('↩ Annulé');
  }

  _showToast(msg) {
    let toast = document.getElementById('undoToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'undoToast';
      toast.className = 'undo-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
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
        if (data.config.zoom)       localStorage.setItem('zoom',       data.config.zoom);
        if (data.config.lang)       localStorage.setItem('lang',       data.config.lang);
        if (data.config.timezone)   localStorage.setItem('timezone',   data.config.timezone);
        if (data.config.icalHour)   localStorage.setItem('icalHour',   data.config.icalHour);
        if (data.config.icalFilters) localStorage.setItem('icalFilters', JSON.stringify(data.config.icalFilters));
        const _bPal1 = data.config.bgPalette;
        if (_bPal1)  this.setPalette(_bPal1);
        if (data.config.bgColor && (!_bPal1 || _bPal1 === 'none'))  _setBgColor(data.config.bgColor);
        this.initTheme();
        this.applyLang();
        this.zoomIdx = parseInt(localStorage.getItem('zoom') ?? '1');
        this.applyZoom();
      }
      if (data.categories) localStorage.setItem('categories', JSON.stringify(data.categories));
      if (data.templates) localStorage.setItem('dayTemplates', JSON.stringify(data.templates));
      if (data.suggestedTasks) localStorage.setItem('suggestedTasks', JSON.stringify(data.suggestedTasks));
      if (data.taskOrder) localStorage.setItem('projectTaskOrder', JSON.stringify(data.taskOrder));
      saveTodos(state.todos);
      closeAdminModal();
      this.render();
      this._showToast(state.T.importSuccess || 'Données importées avec succès !');
    } catch (err) {
      this._showToast(state.T.importError || 'Failed to import data');
    }
    e.target.value = '';
  }

  // ═══════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════
  render() {
    const isCategories  = state.view === 'categories';
    const isProjects    = state.view === 'projects';
    const isProfile     = state.view === 'profile';
    const isInbox       = state.view === 'inbox';
    const isBacklog     = state.view === 'backlog';
    const isPlan        = state.view === 'plan';
    const isSuperadmin  = state.view === 'superadmin';
    const isIntentions  = state.view === 'intentions';
    const isAnalyse     = state.view === 'analyse';
    document.body.classList.toggle('view-projects',   isCategories || isProjects);
    document.body.classList.toggle('view-profile',    isProfile);
    document.body.classList.toggle('view-inbox',      isInbox);
    document.body.classList.toggle('view-backlog',    isBacklog);
    document.body.classList.toggle('view-plan',       isPlan);
    document.body.classList.toggle('view-superadmin', isSuperadmin);
    document.body.classList.toggle('view-search',     state.view === 'search');
    const noLabel = isCategories || isProjects || isProfile || isInbox || isBacklog || isPlan || isSuperadmin || isIntentions || isAnalyse;
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
    if (state.view==='search')     html = renderSearchView();
    if (state.view==='plan')       html = this._renderPlanView();
    if (state.view==='profile')    html = this._renderProfileView();
    if (state.view==='superadmin') html = this._renderSuperadminView();
    if (state.view==='intentions') html = renderIntentionsView(state.todos);
    if (state.view==='analyse')    html = renderAnalyseView(state.todos);
    const _planScrollMode = state.view === 'plan' && ['month', 'biweek'].includes(localStorage.getItem('planMode') || 'week');
    if (_planScrollMode) { const s = document.getElementById('planMonthScroll'); if (s) this._planMonthScrollSaved = s.scrollTop; }
    if (!_planScrollMode && this._planMonthIO) { this._planMonthIO.disconnect(); this._planMonthIO = null; }
    const mainEl = document.getElementById('mainContent');
    mainEl.innerHTML = html;
    mainEl.classList.toggle('plan-mode',   state.view === 'plan');
    mainEl.classList.toggle('search-mode', state.view === 'search');
    if (_planScrollMode) this._setupPlanMonth();
    const sidebar = document.getElementById('calSidebar');
    if (sidebar) {
      const hiddenViews = ['plan', 'categories', 'projects', 'inbox', 'backlog', 'search', 'profile', 'superadmin', 'intentions', 'analyse'];
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
    if (state.view === 'day') { this.initDayDragDrop(); this.initDayMiniWeekDragDrop(); this.initTagSectionDragDrop(); }
    if (state.view === 'week') this.initWeekDragDrop();
    if (state.view === 'month') this.initMonthDragDrop();
    if (state.view === 'search') this.initSearchDragDrop();
    if (state.view === 'plan') this.initPlanDragDrop();
    this.initHeaderDropZones();
    this.renderQACloud();
    this._animateQuickAddBtn();
    this._applyMultilineClasses();
    if (state.view === 'day') setupTodoItemHoverAnimations();
  }

  _renderPlanView() {
    const storedWidth = localStorage.getItem('planInboxWidth');
    const leftWidth = storedWidth ? storedWidth + 'px' : '50%';
    return `<div class="plan-container">
      <div class="plan-col-header">
        <div class="plan-col-header-title">Planifier</div>
        <div class="plan-col-header-desc">Glissez les tâches vers le calendrier <br>pour les caser dans le temps.</div>
      </div>
      <div class="plan-view">
        <div class="plan-inbox-col" id="planInboxCol" style="width:${leftWidth}">
          ${renderPlanInboxList(state.todos, this._overdueSelected || new Set())}
        </div>
        <div class="plan-resize-handle" id="planResizeHandle" title="Redimensionner"><svg viewBox="0 0 36 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><polygon points="1,16 7,10 7,22"/><rect x="11" y="2" width="3" height="28" rx="1.5"/><rect x="22" y="2" width="3" height="28" rx="1.5"/><polygon points="35,16 29,10 29,22"/></svg></div>
        <div class="plan-week-col${['month','biweek'].includes(localStorage.getItem('planMode')||'week')?' plan-month-mode':''}">
          ${this._renderPlanCalendar()}
        </div>
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

  togglePlanHideCompleted() {
    const cur = localStorage.getItem('planHideCompleted') === '1';
    localStorage.setItem('planHideCompleted', cur ? '0' : '1');
    this.render();
  }

  _renderPlanCalendar() {
    const mode = localStorage.getItem('planMode') || 'week';
    const filter = this._getPlanRecFilter();
    const hideCompleted = localStorage.getItem('planHideCompleted') === '1';
    const todayStr = DS(new Date());

    const modeBtns = [
      ['week',   'Sem.'],
      ['biweek', '2 Sem.'],
      ['month',  'Mois'],
    ].map(([m, l]) =>
      `<button class="plan-mode-btn${mode===m?' active':''}" onclick="window.app.setPlanMode('${m}')">${l}</button>`
    ).join('');

    const recToggles = [
      ['none',    'Ponct.'],
      ['daily',   'Quot.'],
      ['weekly',  'Hebdo.'],
      ['monthly', 'Mens.'],
      ['yearly',  'Ann.'],
    ].map(([k, l]) =>
      `<button class="plan-rec-btn${filter[k]?' active':''}" onclick="window.app.togglePlanRecFilter('${k}')" title="${k}">${l}</button>`
    ).join('');

    const todayBtn = `<button class="plan-today-btn" onclick="window.app.planScrollToToday()">Aujourd'hui</button>`;
    const hideBtn = `<button class="plan-rec-btn plan-hide-done-btn${hideCompleted?' active':''}" onclick="window.app.togglePlanHideCompleted()">✓ Masquer complétés</button>`;
    const navSvgL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
    const navSvgR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

    if (mode === 'month' || mode === 'biweek') {
      const now = new Date();
      const monthLabel = `${state.MONTHS[now.getMonth()]} ${now.getFullYear()}`;
      const dayNames = state.DAYS.map(d => `<div class="plan-month-dayname">${d}</div>`).join('');
      return `<div class="plan-toolbar">
        <div class="plan-toolbar-nav">${todayBtn}<span class="plan-toolbar-label">${monthLabel}</span></div>
        <div class="plan-toolbar-filters"><div class="plan-mode-btns">${modeBtns}</div><div class="plan-toolbar-sep"></div><div class="plan-rec-pills">${recToggles}</div>${hideBtn}</div>
      </div>
      <div class="plan-month-daynames">${dayNames}</div>
      <div class="plan-month-scroll" id="planMonthScroll">
        <div id="planMonthTop" style="height:1px;flex-shrink:0"></div>
        <div id="planMonthBot" style="height:1px;flex-shrink:0"></div>
      </div>`;
    }

    const weekStart = startOfWeek(new Date(state.navDate));
    const days = [];
    for (let i = 0; i < 14; i++) days.push(this._planMonthDayHTML(addDays(weekStart, i), filter, todayStr, hideCompleted));
    const weekEnd = addDays(weekStart, 13);
    const label = `${weekStart.getDate()} ${state.MONTHS[weekStart.getMonth()]} – ${weekEnd.getDate()} ${state.MONTHS[weekEnd.getMonth()]}`;

    return `<div class="plan-toolbar">
      <div class="plan-toolbar-nav">
        <div class="plan-toolbar-nav-date">
          <button class="day-nav-btn" onclick="window.app.navigate(-1)">${navSvgL}</button>
          <span class="plan-toolbar-label">${label}</span>
          <button class="day-nav-btn" onclick="window.app.navigate(1)">${navSvgR}</button>
        </div>
        ${todayBtn}
      </div>
      <div class="plan-toolbar-filters">
        <div class="plan-mode-btns">${modeBtns}</div>
        <div class="plan-toolbar-sep"></div>
        <div class="plan-rec-pills">${recToggles}</div>
        ${hideBtn}
      </div>
    </div>
    <div class="plan-week-grid plan-week-grid--2rows">
      <div class="plan-week-block">
        <div class="plan-week-row plan-week-row--4">${days.slice(0, 4).join('')}</div>
        <div class="plan-week-row plan-week-row--3">${days.slice(4, 7).join('')}</div>
      </div>
      <div class="plan-week-block">
        <div class="plan-week-row plan-week-row--4">${days.slice(7, 11).join('')}</div>
        <div class="plan-week-row plan-week-row--3">${days.slice(11).join('')}</div>
      </div>
    </div>`;
  }

  planScrollToToday() {
    const mode = localStorage.getItem('planMode') || 'week';
    if (mode !== 'month' && mode !== 'biweek') {
      state.setNavDate(startOfWeek(new Date()));
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
    if (!['month', 'biweek'].includes(mode)) this._planMonthFrom = null;
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

  _planMonthDayHTML(d, filter, todayStr, hideCompleted = false) {
    const recKey = (t) => (!t.recurrence || t.recurrence === 'none') ? 'none' : t.recurrence;
    const ds = DS(d);
    const isT = ds === todayStr;
    const items = getTodosForDate(d, state.todos)
      .filter(t => filter[recKey(t)] !== false)
      .filter(t => !hideCompleted || !isCompleted(t, d));
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
      <div class="plan-week-day-body">
        <div class="plan-week-day-tasks">${taskRows}</div>
        <button class="plan-week-add" onclick="window.app.openModal(window.app.parseDS('${ds}'))">+</button>
      </div>
    </div>`;
  }

  _planMonthGenWeeks(fromDate, count, filter, startMonthKey) {
    const todayStr = DS(new Date());
    const hideCompleted = localStorage.getItem('planHideCompleted') === '1';
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
      for (let i = 0; i < 7; i++) days.push(this._planMonthDayHTML(addDays(wStart, i), filter, todayStr, hideCompleted));
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
    this._setDragGhost(event, taskId);
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
    const clamp = (w) => {
      const maxW = Math.round((col.parentElement?.offsetWidth || window.innerWidth) * 0.50);
      return Math.max(160, Math.min(maxW, w));
    };
    const onMove = (e) => {
      col.style.width = clamp(startW + e.clientX - startX) + 'px';
    };
    const onUp = (e) => {
      const w = clamp(startW + e.clientX - startX);
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

  // ── Overdue actions ──────────────────────────────────────────────────────
  togglePlanSection(sec) {
    const key = `plan${sec.charAt(0).toUpperCase() + sec.slice(1)}Collapsed`;
    const cur = localStorage.getItem(key) === 'true';
    localStorage.setItem(key, cur ? 'false' : 'true');
    const col = document.getElementById('planInboxCol');
    if (col) { col.innerHTML = renderPlanInboxList(state.todos, this._overdueSelected || new Set()); this.initPlanDragDrop(); }
  }

  overdueToToday(id) {
    const t = state.todos.find(x => x.id === id);
    if (!t) return;
    snapshot(state.todos);
    t.date = DS(today());
    t.updatedAt = Date.now();
    saveTodos(state.todos);
    this.render();
  }

  overdueToBacklog(id) {
    const t = state.todos.find(x => x.id === id);
    if (!t) return;
    snapshot(state.todos);
    t.date = null;
    t.backlog = true;
    t.updatedAt = Date.now();
    saveTodos(state.todos);
    this.render();
  }

  overdueAllToToday() {
    const todayStr = DS(today());
    const overdue = state.todos.filter(t =>
      t.date && t.date < todayStr && !t.completed && (!t.recurrence || t.recurrence === 'none')
    );
    if (!overdue.length) return;
    snapshot(state.todos);
    overdue.forEach(t => { t.date = todayStr; t.updatedAt = Date.now(); });
    saveTodos(state.todos);
    this.render();
  }

  overdueAllToBacklog() {
    const todayStr = DS(today());
    const overdue = state.todos.filter(t =>
      t.date && t.date < todayStr && !t.completed && (!t.recurrence || t.recurrence === 'none')
    );
    if (!overdue.length) return;
    snapshot(state.todos);
    overdue.forEach(t => { t.date = null; t.backlog = true; t.updatedAt = Date.now(); });
    saveTodos(state.todos);
    this._overdueSelected = new Set();
    this.render();
  }

  overdueToggleSelect(id) {
    if (!this._overdueSelected) this._overdueSelected = new Set();
    if (this._overdueSelected.has(id)) this._overdueSelected.delete(id);
    else this._overdueSelected.add(id);
    const item = document.querySelector(`.plan-overdue-section .todo-item[data-id="${id}"]`);
    if (item) {
      const sel = this._overdueSelected.has(id);
      item.classList.toggle('overdue-selected', sel);
      const cb = item.querySelector('.overdue-checkbox');
      if (cb) {
        cb.classList.toggle('checked', sel);
        cb.innerHTML = sel ? `<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 6 5 9 10 3"/></svg>` : '';
      }
    }
    this._updateOverdueFooter();
  }

  _updateOverdueFooter() {
    const count = this._overdueSelected?.size || 0;
    const todayBtn   = document.getElementById('overdueFooterToday');
    const backlogBtn = document.getElementById('overdueFooterBacklog');
    if (!todayBtn) return;
    todayBtn.textContent   = count > 0 ? `Reporter la sélection (${count})` : 'Reporter tout à aujourd\'hui';
    backlogBtn.textContent = count > 0 ? `Backlog (${count})` : 'Tout en backlog';
    todayBtn.classList.toggle('plan-overdue-big-btn--primary', true);
  }

  overdueActionToday() {
    const sel = this._overdueSelected;
    if (sel?.size > 0) {
      const todayStr = DS(today());
      const targets = state.todos.filter(t => sel.has(t.id));
      if (!targets.length) return;
      snapshot(state.todos);
      targets.forEach(t => { t.date = todayStr; t.updatedAt = Date.now(); });
      saveTodos(state.todos);
      this._overdueSelected = new Set();
      this.render();
    } else {
      this.overdueAllToToday();
    }
  }

  overdueActionBacklog() {
    const sel = this._overdueSelected;
    if (sel?.size > 0) {
      const targets = state.todos.filter(t => sel.has(t.id));
      if (!targets.length) return;
      snapshot(state.todos);
      targets.forEach(t => { t.date = null; t.backlog = true; t.updatedAt = Date.now(); });
      saveTodos(state.todos);
      this._overdueSelected = new Set();
      this.render();
    } else {
      this.overdueAllToBacklog();
    }
  }

  // ── Header drop zones (Inbox / Backlog / Today buttons) ─────────────────
  initHeaderDropZones() {
    const inboxBtn   = document.getElementById('inboxTab');
    const backlogBtn = document.querySelector('.backlog-tab');
    const todayBtn   = document.querySelector('.view-tab[data-view="day"]');
    if (!inboxBtn || !backlogBtn) return;

    // Avoid duplicate listeners by using a flag
    if (inboxBtn._headerDZ) return;
    inboxBtn._headerDZ = true;

    const setup = (btn, onDrop) => {
      btn.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        btn.classList.add('header-drop-hover');
      });
      btn.addEventListener('dragleave', e => {
        if (!btn.contains(e.relatedTarget)) btn.classList.remove('header-drop-hover');
      });
      btn.addEventListener('drop', e => {
        e.preventDefault();
        btn.classList.remove('header-drop-hover');
        const taskId = e.dataTransfer.getData('text/plain');
        if (!taskId) return;
        onDrop(taskId);
      });
    };

    setup(inboxBtn, id => {
      const t = state.todos.find(x => x.id === id);
      if (!t) return;
      snapshot(state.todos);
      t.date = null;
      t.backlog = false;
      saveTodos(state.todos);
      this.render();
      this._closeSearchView();
    });

    setup(backlogBtn, id => {
      const t = state.todos.find(x => x.id === id);
      if (!t) return;
      snapshot(state.todos);
      t.date = null;
      t.backlog = true;
      saveTodos(state.todos);
      this.render();
      this._closeSearchView();
    });

    if (todayBtn) {
      setup(todayBtn, id => {
        const t = state.todos.find(x => x.id === id);
        if (!t) return;
        snapshot(state.todos);
        t.date = DS(new Date());
        t.backlog = false;
        saveTodos(state.todos);
        this.render();
        this._closeSearchView();
      });
    }

    // Global drag tracking: show/hide header drop zone indicators
    if (!document._headerDragBound) {
      document._headerDragBound = true;
      document.addEventListener('dragstart', () => {
        requestAnimationFrame(() => document.body.classList.add('is-dragging-task'));
      });
      document.addEventListener('dragend', () => {
        document.body.classList.remove('is-dragging-task');
        document.querySelectorAll('.header-drop-hover').forEach(el => el.classList.remove('header-drop-hover'));
      });
    }
  }

  // Custom drag ghost: small card with task title
  _setDragGhost(event, taskId) {
    const t = state.todos.find(x => x.id === taskId);
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.textContent = t ? t.title : '…';
    document.body.appendChild(ghost);
    event.dataTransfer.setDragImage(ghost, 12, 12);
    requestAnimationFrame(() => ghost.remove());
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
    const isDark    = document.documentElement.getAttribute('data-theme') === 'dark';
    const palette   = localStorage.getItem('bgPalette') || 'geo';
    const bgColor   = localStorage.getItem('bgColor') || (isDark ? '#0f1117' : '#f8f9fc');
    const glassMode = localStorage.getItem('glassMode') === '1';
    const user     = getCurrentUser();
    const name     = user?.displayName || user?.email?.split('@')[0] || '';
    const initials = (user?.displayName || user?.email || '?').slice(0, 2).toUpperCase();

    // ── Statistics ──
    const cats      = getCategories().length;
    const total     = state.todos.length;
    const recur     = state.todos.filter(t => t.recurrence && t.recurrence !== 'none').length;
    const done      = state.todos.filter(t => t.completed).length;
    const inbox     = getInboxCount(state.todos);
    const backlog   = getBacklogCount(state.todos);
    const todayDS   = DS(today());
    const todayAll  = state.todos.filter(t => t.date === todayDS);
    const todayDone = todayAll.filter(t => t.completed).length;
    const todayTot  = todayAll.length;
    const overdue   = state.todos.filter(t => t.date && t.date < todayDS && !t.completed && (!t.recurrence || t.recurrence === 'none')).length;
    const highPrio  = state.todos.filter(t => t.priority === 'high' && !t.completed).length;
    const pct       = total > 0 ? Math.round(done / total * 100) : 0;

    // SVG icon helpers (stroke-based, 16×16)
    const ic = {
      tasks:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>',
      done:     '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>',
      recur:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>',
      cats:     '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
      inbox:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>',
      backlog:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
      today:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
      overdue:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
      prio:     '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
      pct:      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>',
      theme:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
      palette:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="19" cy="13.5" r="2.5"/><circle cx="6.5" cy="8" r="2.5"/><circle cx="8" cy="16" r="2.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.5-.75 1.5-1.5 0-.39-.15-.74-.39-1.04-.24-.3-.39-.65-.39-1.04 0-.828.672-1.42 1.5-1.42H16c3.31 0 6-2.69 6-6 0-5.52-4.48-9-10-9z"/></svg>',
      glass:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>',
      tag:      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
      star:     '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
      list:     '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
      template: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>',
      cal:      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
      upload:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
      trash:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>',
      logout:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
      chevron:  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
    };

    const html = `
      <div class="profile-view">
        <div class="profile-body">

          <!-- Identity: avatar + name + display name form -->
          <div class="profile-section profile-section--identity">
            <div class="profile-hero-inner">
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
            <h3 class="profile-section-title">Nom d'affichage</h3>
            <div class="profile-name-row">
              <input class="form-input" type="text" id="profileDisplayName"
                value="${esc(user?.displayName || '')}" placeholder="Ton prénom">
              <button class="btn btn-primary" onclick="window.app.saveDisplayName()">Sauvegarder</button>
            </div>
            <p class="profile-save-msg hidden" id="profileSaveMsg">✓ Sauvegardé</p>
          </div>

          <!-- Stats — grid -->
          <div class="profile-section">
            <h3 class="profile-section-title">Statistiques</h3>
            <div class="profile-stats-grid">
              <div class="profile-stat-card">
                <div class="profile-stat-icon">${ic.today}</div>
                <div class="profile-stat-num">${todayDone}<span class="profile-stat-slash">/${todayTot}</span></div>
                <div class="profile-stat-label">aujourd'hui</div>
              </div>
              <div class="profile-stat-card">
                <div class="profile-stat-icon">${ic.pct}</div>
                <div class="profile-stat-num">${pct}<span class="profile-stat-unit">%</span></div>
                <div class="profile-stat-label">complétion</div>
              </div>
              <div class="profile-stat-card">
                <div class="profile-stat-icon">${ic.tasks}</div>
                <div class="profile-stat-num">${total}</div>
                <div class="profile-stat-label">tâches</div>
              </div>
              <div class="profile-stat-card">
                <div class="profile-stat-icon">${ic.done}</div>
                <div class="profile-stat-num">${done}</div>
                <div class="profile-stat-label">complétées</div>
              </div>
              <div class="profile-stat-card">
                <div class="profile-stat-icon">${ic.recur}</div>
                <div class="profile-stat-num">${recur}</div>
                <div class="profile-stat-label">récurrentes</div>
              </div>
              <div class="profile-stat-card">
                <div class="profile-stat-icon">${ic.cats}</div>
                <div class="profile-stat-num">${cats}</div>
                <div class="profile-stat-label">catégories</div>
              </div>
              ${overdue > 0 ? `<div class="profile-stat-card profile-stat-card--warn">
                <div class="profile-stat-icon">${ic.overdue}</div>
                <div class="profile-stat-num">${overdue}</div>
                <div class="profile-stat-label">en retard</div>
              </div>` : ''}
              ${highPrio > 0 ? `<div class="profile-stat-card profile-stat-card--accent">
                <div class="profile-stat-icon">${ic.prio}</div>
                <div class="profile-stat-num">${highPrio}</div>
                <div class="profile-stat-label">priorité haute</div>
              </div>` : ''}
            </div>
          </div>

          <!-- Inbox & Backlog -->
          <div class="profile-columns">
            <div class="profile-section profile-section--clickable" onclick="window.app.setView('inbox')">
              <div class="profile-section-header">
                <span class="profile-section-icon">${ic.inbox}</span>
                <h3 class="profile-section-title" style="margin:0">Inbox</h3>
                <span class="profile-stat-badge">${inbox}</span>
              </div>
              <p class="profile-section-desc">Tâches capturées rapidement, sans date. Trie-les quand tu veux.</p>
            </div>
            <div class="profile-section profile-section--clickable" onclick="window.app.setView('backlog')">
              <div class="profile-section-header">
                <span class="profile-section-icon">${ic.backlog}</span>
                <h3 class="profile-section-title" style="margin:0">Backlog</h3>
                <span class="profile-stat-badge">${backlog}</span>
              </div>
              <p class="profile-section-desc">Idées et tâches futures. Pas urgentes, mais tu ne veux pas les oublier.</p>
            </div>
          </div>

          <!-- Appearance -->
          <div class="profile-section">
            <h3 class="profile-section-title">Apparence</h3>
            <div class="profile-rows">
              <div class="profile-row">
                <span class="profile-row-label">${ic.theme} Thème</span>
                <button class="btn btn-sm" onclick="window.app.toggleTheme()">${isDark ? 'Passer au clair' : 'Passer au sombre'}</button>
              </div>
              <div class="profile-row">
                <span class="profile-row-label">${ic.palette} Fond d'écran</span>
                <select class="lang-select" onchange="window.app.setPalette(this.value)">
                  <option value="geo"    ${palette === 'geo'    ? 'selected' : ''}>Géo Chaud</option>
                  <option value="aurora" ${palette === 'aurora' ? 'selected' : ''}>Aurore Boréale</option>
                  <option value="none"   ${palette === 'none'   ? 'selected' : ''}>Couleur unie</option>
                </select>
              </div>
              ${palette === 'none' ? `
              <div class="profile-row">
                <span class="profile-row-label">${ic.palette} Couleur du fond</span>
                <input type="color" value="${bgColor}" style="width:38px;height:28px;border:none;border-radius:6px;cursor:pointer;padding:2px;background:none;" onchange="window.app.setBgColor(this.value)">
              </div>` : ''}
              <div class="profile-row">
                <span class="profile-row-label">${ic.glass} Effet verre</span>
                <label class="app-toggle">
                  <input type="checkbox" ${glassMode ? 'checked' : ''} onchange="window.app.setGlassMode(this.checked)">
                  <span class="app-toggle__track"></span>
                </label>
              </div>
            </div>
          </div>

          <!-- Settings -->
          <div class="profile-section">
            <h3 class="profile-section-title">Réglages</h3>
            <div class="profile-rows">
              <button class="profile-row" onclick="window.app.setView('categories')">
                <span class="profile-row-label">${ic.tag} Catégories</span><span class="profile-row-arrow">${ic.chevron}</span>
              </button>
              <button class="profile-row" onclick="window.app.setView('superadmin')">
                <span class="profile-row-label">${ic.star} Messages d'encouragement</span><span class="profile-row-arrow">${ic.chevron}</span>
              </button>
              <button class="profile-row" onclick="window.app.openAdminSection('taches')">
                <span class="profile-row-label">${ic.list} Tâches suggérées</span><span class="profile-row-arrow">${ic.chevron}</span>
              </button>
              <button class="profile-row" onclick="window.app.openAdminSection('modeles')">
                <span class="profile-row-label">${ic.template} Modèles de journée</span><span class="profile-row-arrow">${ic.chevron}</span>
              </button>
            </div>
          </div>

          <!-- iCal -->
          <div class="profile-section">
            <div class="profile-section-header">
              <span class="profile-section-icon">${ic.cal}</span>
              <h3 class="profile-section-title" style="margin:0">Abonnement calendrier (iCal)</h3>
            </div>
            <p style="font-size:13px;color:var(--text-muted);margin:8px 0 12px;">Abonne-toi à tes tâches depuis Apple Calendar, Google Calendar ou Outlook.</p>
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
                <input id="icalHour" type="text" class="form-input" style="font-size:12px;width:90px;" placeholder="HH:MM" maxlength="5" inputmode="numeric"
                  oninput="let v=this.value.replace(/\D/g,'');if(v.length>2)v=v.slice(0,2)+':'+v.slice(2,4);this.value=v"
                  onblur="let p=this.value.split(':');if(p.length===2&&p[0].length===1)this.value='0'+this.value;window.app.saveICalSettings()">
              </div>
            </div>
          </div>

          <!-- Data -->
          <div class="profile-section">
            <h3 class="profile-section-title">Données</h3>
            <div class="profile-rows">
              <button class="profile-row" onclick="window.app.exportAllData()">
                <span class="profile-row-label">${ic.upload} Exporter mes données</span><span class="profile-row-arrow">${ic.chevron}</span>
              </button>
              <button class="profile-row profile-row--danger" onclick="window.app.profileDeleteData()">
                <span class="profile-row-label">${ic.trash} Effacer mes données</span><span class="profile-row-arrow">${ic.chevron}</span>
              </button>
            </div>
          </div>

          <!-- Sign out -->
          <div class="profile-section">
            <button class="btn btn-ghost profile-signout-btn" onclick="window.app.authSignOut()">
              ${ic.logout} Se déconnecter
            </button>
          </div>
        </div>
      </div>
    `;
    // Load the iCal URL async after the profile view is injected into DOM
    setTimeout(() => this.loadICalURL(), 0);
    return html;
  }

  // ── Superadmin view ──────────────────────────────────
  _saTab       = 'all';   // 'all' | 'custom' | 'banned' | 'generate'
  _saLang      = 'fr';
  _saGenerated = [];      // accumulated quotes from all generations
  _saPrompt    = '';      // persisted prompt between renders
  _saUnchecked = new Set(); // quote texts the user has unchecked

  async _loadGlobalQuotes() {
    try {
      const token = await getIdToken();
      const res = await fetch('http://localhost:3333/global-quotes', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) return;
      const data = await res.json();
      setGlobalQuotes(data);
    } catch (_) {}
  }

  async _saveGlobalQuotes(updated) {
    setGlobalQuotes(updated);
    this._saRefresh();
    try {
      const token = await getIdToken();
      await fetch('http://localhost:3333/global-quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(updated),
        signal: AbortSignal.timeout(3000),
      });
    } catch (_) {}
  }

  _renderSuperadminView() {
    return `<div class="superadmin-view">${this._renderSuperadminInner()}</div>`;
  }

  _renderSuperadminInner() {
    const tab         = this._saTab;
    const lang        = this._saLang;
    const globalQ     = getGlobalQuotes();
    const globalBanned = globalQ.banned || [];
    const customFR    = getCustomQuotes('fr');
    const customEN    = getCustomQuotes('en');
    const customAll = [
      ...customFR.map((q, i) => ({ q, l: 'fr', i })),
      ...customEN.map((q, i) => ({ q, l: 'en', i })),
    ];
    const globalCustomAll = [
      ...(globalQ.customFR || []).map((q, i) => ({ q, l: 'fr', i })),
      ...(globalQ.customEN || []).map((q, i) => ({ q, l: 'en', i })),
    ];
    const totalCount = DEFAULT_QUOTES_FR.length + DEFAULT_QUOTES_EN.length + globalCustomAll.length + customAll.length;

    const tabs = [
      { id: 'all',      label: 'Toutes',    count: totalCount },
      { id: 'custom',   label: 'Perso',     count: customAll.length },
      { id: 'banned',   label: 'Bannis',    count: globalBanned.length },
      { id: 'generate', label: '✨ Générer', count: null },
    ];

    const tabBar = `
      <div class="sa-tabs">
        ${tabs.map(t => `
          <button class="sa-tab${tab === t.id ? ' active' : ''}" onclick="window.app.superadminSetTab('${t.id}')">
            ${t.label}${t.count !== null ? ` <span class="sa-tab-count">${t.count}</span>` : ''}
          </button>
        `).join('')}
      </div>`;

    // ── Tab: Toutes ──────────────────────────────────────
    let content = '';
    if (tab === 'all') {
      const defaultFR    = DEFAULT_QUOTES_FR.map(q => ({ q, l: 'fr', src: 'default' }));
      const defaultEN    = DEFAULT_QUOTES_EN.map(q => ({ q, l: 'en', src: 'default' }));
      const globalFR     = (globalQ.customFR || []).map((q, i) => ({ q, l: 'fr', src: 'global', i }));
      const globalEN     = (globalQ.customEN || []).map((q, i) => ({ q, l: 'en', src: 'global', i }));
      const customs      = customAll.map(({ q, l, i }) => ({ q, l, src: 'custom', i }));
      const all          = [...defaultFR, ...defaultEN, ...globalFR, ...globalEN, ...customs];
      const filtered     = all.filter(({ l }) => lang === 'all' || l === lang);
      this._saAllList    = filtered;
      const editing      = this._saEditing;
      content = `
        <div class="sa-search-row">
          <input id="saSearch" class="form-input" placeholder="Rechercher…"
            oninput="window.app.superadminSearch(this.value)">
          <div class="superadmin-lang-toggle">
            <button class="superadmin-lang-btn${lang==='all'?' active':''}" onclick="window.app.superadminFilterLang('all')">Tout</button>
            <button class="superadmin-lang-btn${lang==='fr'?' active':''}" onclick="window.app.superadminFilterLang('fr')">FR</button>
            <button class="superadmin-lang-btn${lang==='en'?' active':''}" onclick="window.app.superadminFilterLang('en')">EN</button>
          </div>
          <button class="btn btn-primary btn-sm" onclick="window.app.superadminTestCelebrate()">▶ Aléatoire</button>
          <button class="btn btn-ghost btn-sm" onclick="window.app.superadminSlideshow()">⏭ Slideshow</button>
        </div>
        <div class="sa-quotes-list" id="saAllList">
          ${filtered.map(({ q, l, src, i }, idx) => {
            const isBanned = globalBanned.includes(q);
            const isEditing = editing && editing.q === q && editing.lang === l;
            if (isEditing) {
              return `<div class="sa-quote-row sa-quote-row--editing" data-text="${esc(q).toLowerCase()}">
                <span class="sa-quote-lang sa-quote-lang--${l}">${l.toUpperCase()}</span>
                <input id="saEditInput" class="form-input sa-edit-input" value="${esc(q)}" maxlength="140"
                  onkeydown="if(event.key==='Enter')window.app.superadminSaveEdit();if(event.key==='Escape')window.app.superadminCancelEdit()">
                <button class="btn btn-primary btn-sm" onclick="window.app.superadminSaveEdit()">✓</button>
                <button class="btn btn-ghost btn-sm" onclick="window.app.superadminCancelEdit()">✕</button>
              </div>`;
            }
            return `<div class="sa-quote-row${isBanned ? ' sa-quote-row--banned' : ''}" data-text="${esc(q).toLowerCase()}">
              <span class="sa-quote-lang sa-quote-lang--${l}">${l.toUpperCase()}</span>
              <span class="sa-quote-tag${src === 'custom' ? '' : ' sa-quote-tag--default'}">${src === 'custom' ? 'perso' : 'défaut'}</span>
              <span class="sa-quote-text">${esc(q)}</span>
              <button class="sa-quote-action sa-quote-play" onclick="window.app.superadminPlayQuote(${idx})" title="Prévisualiser">▶</button>
              ${isBanned
                ? `<button class="sa-quote-action sa-quote-restore" onclick="window.app.superadminToggleBanByIdx(${idx})">↺</button>`
                : `<button class="sa-quote-action sa-quote-ban" onclick="window.app.superadminToggleBanByIdx(${idx})">🚫</button>`
              }
              <button class="sa-quote-action sa-quote-edit" onclick="window.app.superadminStartEditByIdx(${idx})" title="Modifier">✏</button>
              ${src === 'custom'
                ? `<button class="sa-quote-action sa-quote-promote" onclick="window.app.superadminPromoteToGlobal('${l}',${i})" title="Promouvoir en Défaut">↑ Défaut</button><button class="sa-quote-action sa-quote-del" onclick="window.app.superadminRemoveCustom('${l}',${i})" title="Supprimer">✕</button>`
                : src === 'global'
                  ? `<button class="sa-quote-action sa-quote-demote" onclick="window.app.superadminDemoteToPersonal('${l}',${i})" title="Déplacer en Perso">↓ Perso</button><button class="sa-quote-action sa-quote-del" onclick="window.app.superadminRemoveGlobal('${l}',${i})" title="Supprimer">✕</button>`
                  : ''
              }
            </div>`;
          }).join('')}
        </div>`;
    }

    // ── Tab: Perso ───────────────────────────────────────
    if (tab === 'custom') {
      const editing = this._saEditing;
      content = `
        <div class="superadmin-section">
          <h3 class="superadmin-section-title">Ajouter un message</h3>
          <div class="superadmin-add-row">
            <input id="saQuoteInput" class="form-input" placeholder="Ton message en majuscules…" maxlength="140"
              onkeydown="if(event.key==='Enter')window.app.superadminAddQuote()">
            <div class="superadmin-lang-toggle">
              <button class="superadmin-lang-btn${this._saLang==='fr'?' active':''}" id="saLangFR" onclick="window.app.superadminSelectLang('fr')">FR</button>
              <button class="superadmin-lang-btn${this._saLang==='en'?' active':''}" id="saLangEN" onclick="window.app.superadminSelectLang('en')">EN</button>
            </div>
            <button class="btn btn-primary" onclick="window.app.superadminAddQuote()">Ajouter</button>
          </div>
        </div>
        ${customAll.length ? `
        <div class="superadmin-section">
          <h3 class="superadmin-section-title">Mes messages (${customAll.length})</h3>
          <div class="sa-quotes-list">
            ${customAll.map(({ q, l, i }) => {
              const isEditing = editing && editing.type === 'custom' && editing.lang === l && editing.i === i;
              if (isEditing) {
                return `<div class="sa-quote-row sa-quote-row--editing">
                  <span class="sa-quote-lang sa-quote-lang--${l}">${l.toUpperCase()}</span>
                  <input id="saEditInput" class="form-input sa-edit-input" value="${esc(q)}" maxlength="140"
                    onkeydown="if(event.key==='Enter')window.app.superadminSaveEdit();if(event.key==='Escape')window.app.superadminCancelEdit()">
                  <button class="btn btn-primary btn-sm" onclick="window.app.superadminSaveEdit()">✓</button>
                  <button class="btn btn-ghost btn-sm" onclick="window.app.superadminCancelEdit()">✕</button>
                </div>`;
              }
              return `<div class="sa-quote-row">
                <span class="sa-quote-lang sa-quote-lang--${l}">${l.toUpperCase()}</span>
                <span class="sa-quote-tag">perso</span>
                <span class="sa-quote-text">${esc(q)}</span>
                <button class="sa-quote-action sa-quote-edit" onclick="window.app.superadminStartEditCustom('${l}',${i})" title="Modifier">✏</button>
                <button class="sa-quote-action sa-quote-promote" onclick="window.app.superadminPromoteToGlobal('${l}',${i})" title="Promouvoir en Défaut">↑ Défaut</button>
                <button class="sa-quote-action sa-quote-del" onclick="window.app.superadminRemoveCustom('${l}',${i})" title="Supprimer">✕</button>
              </div>`;
            }).join('')}
          </div>
        </div>` : `<p class="superadmin-hint" style="padding:0 4px">Aucun message personnalisé pour l'instant.</p>`}`;
    }

    // ── Tab: Bannis ──────────────────────────────────────
    if (tab === 'banned') {
      content = globalBanned.length ? `
        <p class="superadmin-hint" style="padding:0 4px;margin-bottom:12px">Ces messages ne s'afficheront plus pour personne. Clique ↺ pour les restaurer.</p>
        <div class="superadmin-section">
          <div class="sa-quotes-list">
            ${globalBanned.map((q, i) => `
              <div class="sa-quote-row sa-quote-row--banned">
                <span class="sa-quote-text">${esc(q)}</span>
                <button class="sa-quote-action sa-quote-restore" onclick="window.app.superadminUnbanGlobal(${i})">↺ Restaurer</button>
              </div>
            `).join('')}
          </div>
        </div>` :
        `<div class="superadmin-section"><p class="superadmin-hint">Aucun message banni globalement. Clique 🚫 sur une quote pour la bannir pour tous.</p></div>`;
    }

    // ── Tab: Générer ─────────────────────────────────────
    if (tab === 'generate') {
      const generated = this._saGenerated;
      content = `
        <div class="superadmin-section">
          <h3 class="superadmin-section-title">Prompt de génération</h3>
          <textarea id="saGenPrompt" class="form-input sa-gen-textarea"
            placeholder="Décris le style ou thème voulu&#10;Ex: Chuck Norris, humour absurde, philosophie stoïcienne, citations de films…"
            oninput="window.app._saPrompt=this.value">${esc(this._saPrompt)}</textarea>
          <div class="sa-gen-options">
            <div class="sa-gen-count-row">
              <label class="sa-gen-label">Nombre</label>
              <input id="saGenCount" type="number" class="form-input sa-gen-count-input" value="5" min="1" max="20">
            </div>
            <div class="superadmin-lang-toggle">
              <button class="superadmin-lang-btn${this._saLang==='fr'?' active':''}" id="saGenLangFR" onclick="window.app.superadminSelectLang('fr')">FR</button>
              <button class="superadmin-lang-btn${this._saLang==='en'?' active':''}" id="saGenLangEN" onclick="window.app.superadminSelectLang('en')">EN</button>
            </div>
            <button class="btn btn-primary" id="saGenBtn" onclick="window.app.superadminGenerate()">✨ Générer</button>
          </div>
        </div>
        ${generated.length ? `
        <div class="superadmin-section">
          <h3 class="superadmin-section-title">
            ${generated.length} résultat${generated.length > 1 ? 's' : ''} — coche ceux à garder
            <span class="sa-gen-hint">→ Perso</span>
          </h3>
          <div class="sa-gen-list" id="saGenList">
            ${generated.map((q, i) => `
              <label class="sa-gen-item">
                <input type="checkbox" class="sa-gen-check" data-i="${i}"
                  onchange="window.app.superadminGenToggle(${i})"
                  ${this._saUnchecked.has(i) ? '' : 'checked'}>
                <span class="sa-quote-text">${esc(q)}</span>
              </label>
            `).join('')}
          </div>
          <div class="sa-gen-save-row">
            <button class="btn btn-ghost btn-sm" onclick="window.app.superadminGenSelectAll(false)">Tout décocher</button>
            <button class="btn btn-ghost btn-sm" onclick="window.app.superadminGenSelectAll(true)">Tout cocher</button>
            <button class="btn btn-ghost btn-sm sa-gen-clear" onclick="window.app.superadminGenClear()">🗑 Vider</button>
            <button class="btn btn-primary" onclick="window.app.superadminGenSave()">💾 Sauvegarder → Perso</button>
          </div>
        </div>` : ''}`;
    }

    return `
      <div class="superadmin-header">
        <button class="superadmin-back-btn" onclick="window.app.setView('profile')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h2 class="superadmin-title">Messages d'encouragement</h2>
      </div>
      ${tabBar}
      <div class="superadmin-body">${content}</div>`;
  }

  _saRefresh() {
    const view = document.querySelector('.superadmin-view');
    if (view) {
      view.innerHTML = this._renderSuperadminInner();
    } else {
      this.render();
    }
  }

  superadminSetTab(tab) { this._saTab = tab; this._saEditing = null; this._saRefresh(); }

  superadminTestCelebrate() { celebrate(this._saLang || state.lang || 'fr'); }

  superadminPlayQuote(idx) {
    const item = this._saAllList?.[idx];
    if (item) celebrateWithQuote(item.q, item.l);
  }

  superadminSlideshow() {
    const list = this._saAllList || [];
    if (!list.length) return;
    celebrateSlideshow(list.map(x => x.q), this._saLang || 'fr', 0);
  }

  superadminFilterLang(lang) { this._saLang = lang; this._saRefresh(); }

  superadminSelectLang(lang) { this._saLang = lang; this._saRefresh(); }

  superadminSearch(val) {
    const q = val.toLowerCase();
    document.querySelectorAll('#saAllList .sa-quote-row').forEach(row => {
      row.style.display = row.dataset.text.includes(q) ? '' : 'none';
    });
  }

  superadminAddQuote() {
    const input = document.getElementById('saQuoteInput');
    const text  = input?.value?.trim().toUpperCase();
    if (!text) return;
    addCustomQuote(this._saLang === 'en' ? 'en' : 'fr', text);
    this._saRefresh();
  }

  superadminRemoveCustom(lang, i) {
    const quotes = getCustomQuotes(lang);
    if (quotes[i] !== undefined) { removeCustomQuote(lang, quotes[i]); this._saEditing = null; this._saRefresh(); }
  }

  superadminUnban(i) {
    // legacy: personal ban (not used in current superadmin UI but kept for safety)
    const banned = getBannedQuotes();
    if (banned[i] !== undefined) { unbanQuote(banned[i]); this._saRefresh(); }
  }

  superadminUnbanGlobal(i) {
    const gq = getGlobalQuotes();
    const updated = { ...gq, banned: gq.banned.filter((_, idx) => idx !== i) };
    this._saveGlobalQuotes(updated);
  }

  superadminToggleBanByIdx(idx) {
    const item = this._saAllList?.[idx];
    if (!item) return;
    const gq = getGlobalQuotes();
    const isBanned = (gq.banned || []).includes(item.q);
    const updated = {
      ...gq,
      banned: isBanned
        ? gq.banned.filter(q => q !== item.q)
        : [...(gq.banned || []), item.q],
    };
    this._saveGlobalQuotes(updated);
  }

  superadminStartEditByIdx(idx) {
    const item = this._saAllList?.[idx];
    if (!item) return;
    this._saEditing = { type: item.src, lang: item.l, i: item.i, q: item.q };
    this._saRefresh();
    setTimeout(() => document.getElementById('saEditInput')?.focus(), 50);
  }

  superadminStartEditCustom(lang, i) {
    const quotes = getCustomQuotes(lang);
    this._saEditing = { type: 'custom', lang, i, q: quotes[i] || '' };
    this._saRefresh();
    setTimeout(() => document.getElementById('saEditInput')?.focus(), 50);
  }

  superadminSaveEdit() {
    const val = document.getElementById('saEditInput')?.value?.trim().toUpperCase();
    const editing = this._saEditing;
    this._saEditing = null;
    if (!editing || !val) { this._saRefresh(); return; }

    if (editing.type === 'custom') {
      updateCustomQuote(editing.lang, editing.i, val);
      this._saRefresh();
    } else {
      // default or global: ban original globally, add edited as global custom
      const gq = getGlobalQuotes();
      const key = editing.lang === 'fr' ? 'customFR' : 'customEN';
      const updated = {
        ...gq,
        banned: [...(gq.banned || []), ...(editing.q ? [editing.q] : [])],
        [key]: [...(gq[key] || []), val],
      };
      this._saveGlobalQuotes(updated);
    }
  }

  superadminCancelEdit() {
    this._saEditing = null;
    this._saRefresh();
  }

  async superadminGenerate() {
    // Snapshot current checked state before re-render (by index, since we prepend)
    document.querySelectorAll('.sa-gen-check').forEach(cb => {
      const i = parseInt(cb.dataset.i, 10);
      if (cb.checked) this._saUnchecked.delete(i); else this._saUnchecked.add(i);
    });
    // Shift existing indices up by the number of new results (prepend means old idx += newCount)
    const prompt = this._saPrompt || document.getElementById('saGenPrompt')?.value?.trim() || '';
    const count  = parseInt(document.getElementById('saGenCount')?.value || '5', 10);
    const lang   = this._saLang === 'en' ? 'en' : 'fr';
    const btn    = document.getElementById('saGenBtn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Génération…'; }

    try {
      const token = await getIdToken();
      const res  = await fetch('http://localhost:3333/admin/generate-quotes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ prompt, count, lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur serveur');
      const newQuotes = data.quotes || [];
      // Shift old unchecked indices up by newQuotes.length (prepend shifts indices)
      const shifted = new Set([...this._saUnchecked].map(i => i + newQuotes.length));
      this._saUnchecked = shifted;
      this._saGenerated = [...newQuotes, ...this._saGenerated];
      this._saTab = 'generate';
      this._saRefresh();
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = '✨ Générer'; }
      alert(`Erreur : ${err.message}`);
    }
  }

  superadminGenToggle(i) {
    if (this._saUnchecked.has(i)) this._saUnchecked.delete(i);
    else this._saUnchecked.add(i);
  }

  superadminGenSelectAll(checked) {
    if (checked) {
      this._saUnchecked.clear();
    } else {
      this._saGenerated.forEach((_, i) => this._saUnchecked.add(i));
    }
    document.querySelectorAll('.sa-gen-check').forEach(cb => { cb.checked = checked; });
  }

  superadminGenClear() {
    this._saGenerated = [];
    this._saUnchecked.clear();
    this._saRefresh();
  }

  superadminGenSave() {
    const lang  = this._saLang === 'en' ? 'en' : 'fr';
    const toAdd = this._saGenerated.filter((_, i) => !this._saUnchecked.has(i));
    toAdd.forEach(q => addCustomQuote(lang, q));
    this._saGenerated = [];
    this._saUnchecked.clear();
    this._saTab = 'custom';
    this._saRefresh();
  }

  superadminPromoteToGlobal(lang, i) {
    const q = getCustomQuotes(lang)[i];
    if (!q) return;
    const gq  = getGlobalQuotes();
    const key = lang === 'fr' ? 'customFR' : 'customEN';
    removeCustomQuote(lang, q);
    this._saveGlobalQuotes({ ...gq, [key]: [...(gq[key] || []), q] });
  }

  superadminDemoteToPersonal(lang, i) {
    const gq  = getGlobalQuotes();
    const key = lang === 'fr' ? 'customFR' : 'customEN';
    const arr = gq[key] || [];
    const q   = arr[i];
    if (!q) return;
    addCustomQuote(lang, q);
    this._saveGlobalQuotes({ ...gq, [key]: arr.filter((_, idx) => idx !== i) });
  }

  superadminRemoveGlobal(lang, i) {
    const gq  = getGlobalQuotes();
    const key = lang === 'fr' ? 'customFR' : 'customEN';
    const arr = gq[key] || [];
    this._saveGlobalQuotes({ ...gq, [key]: arr.filter((_, idx) => idx !== i) });
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

  setDayColCount(n) {
    localStorage.setItem('dayColCount', n);
    this.render();
  }

  setDaySort(mode) {
    localStorage.setItem('daySort', mode);
    this.render();
  }

  toggleDayAutoPrio() {
    const cur = localStorage.getItem('dayAutoPrio') === 'true';
    localStorage.setItem('dayAutoPrio', String(!cur));
    this.render();
  }

  toggleDayPeriodGroups() {
    const cur = localStorage.getItem('dayPeriodGroups') !== 'false';
    localStorage.setItem('dayPeriodGroups', String(!cur));
    this.render();
  }

  toggleDaySort() {
    const cur = localStorage.getItem('daySortCollapsed') !== 'false';
    localStorage.setItem('daySortCollapsed', !cur ? 'true' : 'false');
    this.render();
  }

  toggleDayCol() {
    const cur = localStorage.getItem('dayColCollapsed') !== 'false';
    localStorage.setItem('dayColCollapsed', !cur ? 'true' : 'false');
    this.render();
  }

  toggleDayControls() {
    const cur = localStorage.getItem('dayCtrlsCollapsed') !== 'false';
    localStorage.setItem('dayCtrlsCollapsed', !cur ? 'true' : 'false');
    this.render();
  }

  toggleRecControls() {
    const cur = localStorage.getItem('recCtrlsCollapsed') !== 'false';
    localStorage.setItem('recCtrlsCollapsed', !cur ? 'true' : 'false');
    this.render();
  }

  toggleDaySort() {
    const cur = localStorage.getItem('daySortCollapsed') !== 'false';
    localStorage.setItem('daySortCollapsed', !cur ? 'true' : 'false');
    this.render();
    if (!cur) this.startAutoCloseDaySort();
  }

  toggleDayCol() {
    const cur = localStorage.getItem('dayColCollapsed') !== 'false';
    localStorage.setItem('dayColCollapsed', !cur ? 'true' : 'false');
    this.render();
    if (!cur) this.startAutoCloseDayCol();
  }

  closeDaySort() {
    localStorage.setItem('daySortCollapsed', 'true');
    this.render();
  }

  closeDayCol() {
    localStorage.setItem('dayColCollapsed', 'true');
    this.render();
  }

  startAutoCloseDaySort() {
    clearTimeout(this.autoCloseDaySortTimer);
    this.autoCloseDaySortTimer = setTimeout(() => this.closeDaySort(), 3000);
  }

  startAutoCloseDayCol() {
    clearTimeout(this.autoCloseDayColTimer);
    this.autoCloseDayColTimer = setTimeout(() => this.closeDayCol(), 3000);
  }

  resetAutoCloseDaySort() {
    this.startAutoCloseDaySort();
  }

  resetAutoCloseDayCol() {
    this.startAutoCloseDayCol();
  }

  setRecColCount(n) {
    localStorage.setItem('recColCount', n);
    this.render();
  }

  toggleRecPeriodGroups() {
    const cur = localStorage.getItem('recPeriodGroups') !== 'false';
    localStorage.setItem('recPeriodGroups', cur ? 'false' : 'true');
    this.render();
  }

  toggleRecCol() {
    const cur = localStorage.getItem('recColCollapsed') !== 'false';
    localStorage.setItem('recColCollapsed', !cur ? 'true' : 'false');
    this.render();
    if (!cur) this.startAutoCloseRecCol();
  }

  closeRecCol() {
    localStorage.setItem('recColCollapsed', 'true');
    this.render();
  }

  startAutoCloseRecCol() {
    clearTimeout(this.autoCloseRecColTimer);
    this.autoCloseRecColTimer = setTimeout(() => this.closeRecCol(), 3000);
  }

  resetAutoCloseRecCol() {
    this.startAutoCloseRecCol();
  }

  toggleDayTagFilter(tagId) {
    const excludedTags = JSON.parse(localStorage.getItem('dayTagExcluded') || '[]');
    const idx = excludedTags.indexOf(tagId);
    if (idx >= 0) {
      excludedTags.splice(idx, 1); // re-show
    } else {
      excludedTags.push(tagId); // hide
    }
    localStorage.setItem('dayTagExcluded', JSON.stringify(excludedTags));
    this.render();
  }

  toggleDayTagGrouping() {
    const cur = localStorage.getItem('dayTagGrouped') !== 'false';
    localStorage.setItem('dayTagGrouped', !cur ? 'true' : 'false');
    this.render();
  }

  toggleColDropdown() {
    const menu = document.getElementById('dayColDropdownMenu');
    if (menu) menu.classList.toggle('hidden');
  }

  toggleSortDropdown() {
    const menu = document.getElementById('daySortDropdownMenu');
    if (menu) menu.classList.toggle('hidden');
  }

  addDaySpacer() {
    const dateStr = DS(state.navDate);
    const items = getTodosForDate(state.navDate, state.todos).filter(t => !t.recurrence || t.recurrence === 'none');
    if (!this.dayOrder[dateStr]) this.dayOrder[dateStr] = items.map(t => t.id);
    const id = 'spacer-' + Date.now();
    this.dayOrder[dateStr].push(id);
    this.daySpacer[id] = { title: '' };
    localStorage.setItem('dayOrder', JSON.stringify(this.dayOrder));
    localStorage.setItem('daySpacer', JSON.stringify(this.daySpacer));
    this.render();
    // Focus the new spacer title
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-spacer-id="${id}"] .day-spacer-title`);
      if (el) { el.focus(); }
    });
  }

  removeDaySpacer(spacerId) {
    const dateStr = DS(state.navDate);
    if (!this.dayOrder[dateStr]) return;
    this.dayOrder[dateStr] = this.dayOrder[dateStr].filter(id => id !== spacerId);
    delete this.daySpacer[spacerId];
    localStorage.setItem('dayOrder', JSON.stringify(this.dayOrder));
    localStorage.setItem('daySpacer', JSON.stringify(this.daySpacer));
    this.render();
  }

  updateSpacerTitle(spacerId, title) {
    if (!this.daySpacer[spacerId]) this.daySpacer[spacerId] = {};
    this.daySpacer[spacerId].title = title;
    localStorage.setItem('daySpacer', JSON.stringify(this.daySpacer));
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
    input.addEventListener('click', e => e.stopPropagation());

    const saveEdit = () => {
      const newTitle = input.value.trim();
      if (newTitle && newTitle !== currentText) {
        const todo = state.todos.find(t => t.id === id);
        if (todo) {
          snapshot(state.todos);
          todo.title = newTitle;
          todo.updatedAt = Date.now();
          saveTodos(state.todos);
        }
      }
      const span = document.createElement('span');
      span.className = 'todo-text editable';
      span.textContent = newTitle || currentText;
      span.ondblclick = () => this.quickEditTitle(span, id, dateStr);
      input.replaceWith(span);
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
  toggleNewProjectRow() { toggleNewProjectRow(); }
  addProjectInline() { addProjectInline(); }
  switchTagTab(tab) { switchTagTab(tab); }
  toggleCategoryTag(id) { toggleCategoryTag(id); }
  toggleProjectTag(id) { toggleProjectTag(id); }
  toggleIntentionTag(id) { toggleIntentionTag(id); }
  toggleNewIntentionRow() { toggleNewIntentionRow(); }
  addIntentionInline() { addIntentionInline(); }

  addCategoryFromView() {
    const addCard = document.querySelector('.category-card--add');
    if (!addCard || addCard.querySelector('input')) return;
    addCard.innerHTML = `<input class="inline-name-input" type="text" placeholder="Nom de la catégorie" style="width:100%;padding:4px 6px;border:1px solid var(--border);border-radius:4px;background:var(--bg-card);color:var(--text);font-size:0.85rem;" autofocus>`;
    const input = addCard.querySelector('input');
    input.focus();
    const confirm = () => {
      const name = input.value.trim();
      if (!name) { this.render(); return; }
      const colors = ['#f59e0b','#3b82f6','#10b981','#ef4444','#8b5cf6','#f97316','#06b6d4','#ec4899'];
      const categories = getCategories();
      categories.push({ id: Date.now().toString(), name, color: colors[categories.length % colors.length] });
      saveCategories(categories);
      this.render();
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') this.render(); });
    input.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== input) this.render(); }, 150));
  }

  removeCategory(id) {
    // Clear task links before removing
    snapshot(state.todos);
    state.todos.forEach(t => {
      if (t.categoryIds) t.categoryIds = t.categoryIds.filter(cid => cid !== id);
      if (t.categoryId === id) delete t.categoryId;
    });
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
    const addCard = document.querySelector('.category-card--add');
    if (!addCard || addCard.querySelector('input')) return;
    addCard.innerHTML = `<input class="inline-name-input" type="text" placeholder="Nom du projet" style="width:100%;padding:4px 6px;border:1px solid var(--border);border-radius:4px;background:var(--bg-card);color:var(--text);font-size:0.85rem;" autofocus>`;
    const input = addCard.querySelector('input');
    input.focus();
    const confirm = () => {
      const name = input.value.trim();
      if (!name) { this.render(); return; }
      addProjectItem(name);
      this.render();
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') this.render(); });
    input.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== input) this.render(); }, 150));
  }

  openProjectPanel(id)   { openProjectPanel(id); }
  closeProjectPanel()    { closeProjectPanel(); }
  renderProjectPanelById(id) { if (id) renderProjectPanel(id); }

  addTaskForProject(projectId) {
    this.openModal(state.navDate);
    setTimeout(() => toggleProjectTag(projectId), 60);
  }

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

  toggleProjectIntention(projectId, intentionId) {
    const p = getProjects().find(x => x.id === projectId);
    if (!p) return;
    const ids = [...(p.intentionIds || [])];
    const idx = ids.indexOf(intentionId);
    if (idx >= 0) ids.splice(idx, 1);
    else ids.push(intentionId);
    updateProjectItem(projectId, { intentionIds: ids });
    renderProjectPanel(projectId);
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

  // ═══════════════════════════════════════════════════
  // INTENTIONS
  // ═══════════════════════════════════════════════════

  static _INTENTION_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316','#eab308','#22c55e','#10b981','#14b8a6','#0ea5e9','#3b82f6','#a78bfa'];

  _getIntentions() {
    try { return JSON.parse(localStorage.getItem('intentions') || '[]'); } catch { return []; }
  }

  _saveIntentions(arr) {
    localStorage.setItem('intentions', JSON.stringify(arr));
    pushFirestoreNow();
  }

  addIntentionFromView() {
    const intentions = this._getIntentions();
    const color = TodoApp._INTENTION_COLORS[intentions.length % TodoApp._INTENTION_COLORS.length];
    const newInt = { id: 'int-' + Date.now(), title: 'Nouvelle intention', description: '', color, createdAt: Date.now() };
    intentions.push(newInt);
    this._saveIntentions(intentions);
    this.render();
    // Open panel after render
    setTimeout(() => this.openIntentionPanel(newInt.id), 50);
  }

  openIntentionPanel(id) {
    const panel   = document.getElementById('intentionPanel');
    const overlay = document.getElementById('intentionPanelOverlay');
    if (!panel || !overlay) return;
    panel.classList.remove('hidden');
    overlay.classList.remove('hidden');
    this._renderIntentionPanel(id);
    if (window.gsap) gsap.fromTo(panel, { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.28, ease: 'expo.out' });
  }

  closeIntentionPanel() {
    const panel   = document.getElementById('intentionPanel');
    const overlay = document.getElementById('intentionPanelOverlay');
    if (!panel) return;
    if (window.gsap) {
      gsap.to(panel, { x: 60, opacity: 0, duration: 0.22, ease: 'expo.in', onComplete: () => { panel.classList.add('hidden'); overlay?.classList.add('hidden'); } });
    } else {
      panel.classList.add('hidden');
      overlay?.classList.add('hidden');
    }
  }

  _renderIntentionPanel(id) {
    const panel = document.getElementById('intentionPanel');
    if (!panel || panel.classList.contains('hidden')) return;
    const intentions = this._getIntentions();
    const int = intentions.find(x => x.id === id);
    if (!int) { this.closeIntentionPanel(); return; }

    const colorSwatches = TodoApp._INTENTION_COLORS.map(c =>
      `<div class="cv-color-swatch${c === int.color ? ' active' : ''}" style="background:${c};"
        onclick="window.app.setIntentionColor('${id}','${c}')"></div>`
    ).join('');

    const intTasks = state.todos.filter(t => (t.intentionIds || (t.intentionId ? [t.intentionId] : [])).includes(id));
    const taskItems = intTasks.map(t =>
      `<div class="intention-panel-task-item" onclick="window.app.openEditModal('${t.id}', null)">
        <span style="width:6px;height:6px;border-radius:50%;background:${int.color};display:inline-block;flex-shrink:0;"></span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;">${esc(t.title)}</span>
      </div>`
    ).join('');

    const linkedProjects = getProjects().filter(p => (p.intentionIds || []).includes(id));
    const projectItems = linkedProjects.map(p =>
      `<div class="intention-panel-task-item" onclick="window.app.openProjectPanel('${p.id}')">
        <span style="width:6px;height:6px;border-radius:50%;background:${p.color};display:inline-block;flex-shrink:0;"></span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;">${esc(p.name)}</span>
      </div>`
    ).join('');

    panel.innerHTML = `
      <div class="cv-header">
        <div class="cv-color-dot" style="background:${int.color};border-radius:50%;width:14px;height:14px;flex-shrink:0;"></div>
        <input class="cv-name-input" value="${esc(int.title)}" placeholder="Titre de l'intention"
          onblur="window.app.saveIntentionField('${id}','title',this.value)"
          onkeydown="if(event.key==='Enter')this.blur();">
        <button class="cv-close-btn" onclick="window.app.closeIntentionPanel()">✕</button>
      </div>
      <div class="cv-color-picker">${colorSwatches}</div>
      <div style="margin-top:12px;">
        <label style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;">Codename <span class="timing-flex-hint" title="Alias court affiché partout sauf dans cette vue">?</span></label>
        <input class="cv-name-input" value="${esc(int.codename || '')}" placeholder="Alias court (ex: Santé, Pro…)"
          style="margin-top:6px;font-size:13px;"
          onblur="window.app.saveIntentionField('${id}','codename',this.value)"
          onkeydown="if(event.key==='Enter')this.blur();">
      </div>
      <div style="margin-top:12px;">
        <label style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;">Description</label>
        <textarea class="cv-name-input" rows="3"
          style="margin-top:6px;resize:vertical;min-height:60px;font-family:inherit;"
          placeholder="Ce que cette intention représente pour toi…"
          onblur="window.app.saveIntentionField('${id}','description',this.value)">${esc(int.description || '')}</textarea>
      </div>
      ${linkedProjects.length > 0 ? `
      <div class="intention-panel-tasks">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">
          Projets liés (${linkedProjects.length})
        </div>
        ${projectItems}
      </div>` : ''}
      <div class="intention-panel-tasks">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">
          Tâches liées (${intTasks.length})
        </div>
        ${intTasks.length > 0 ? taskItems : '<p style="font-size:12px;color:var(--text-muted);font-style:italic;">Aucune tâche taguée avec cette intention.</p>'}
      </div>
      <div style="margin-top:24px;border-top:1px solid var(--border);padding-top:16px;">
        <button class="btn btn-danger" style="width:100%;" onclick="window.app.deleteIntention('${id}')">Supprimer cette intention</button>
      </div>`;
  }

  saveIntentionField(id, field, value) {
    const intentions = this._getIntentions();
    const int = intentions.find(x => x.id === id);
    if (!int) return;
    int[field] = value.trim();
    this._saveIntentions(intentions);
    this.render();
    this._renderIntentionPanel(id);
  }

  setIntentionColor(id, color) {
    const intentions = this._getIntentions();
    const int = intentions.find(x => x.id === id);
    if (!int) return;
    int.color = color;
    this._saveIntentions(intentions);
    this.render();
    this._renderIntentionPanel(id);
  }

  deleteIntention(id) {
    if (!confirm('Supprimer cette intention ? Les tâches resteront mais ne seront plus taguées.')) return;
    this.closeIntentionPanel();
    // Remove intentionId from tasks
    state.todos.forEach(t => {
      if (t.intentionIds) t.intentionIds = t.intentionIds.filter(iid => iid !== id);
      if (t.intentionId === id) delete t.intentionId;
    });
    saveTodos(state.todos);
    const intentions = this._getIntentions().filter(x => x.id !== id);
    this._saveIntentions(intentions);
    this.render();
  }

  deleteCategory(id) {
    if (!confirm('Supprimer cette catégorie ? Les tâches seront dissociées mais conservées.')) return;
    closeCategoryView();
    this.removeCategory(id);
  }

  reorderCategoryTask(id, categoryId, direction) {
    const tasks = state.todos.filter(t => (t.categoryIds || (t.categoryId ? [t.categoryId] : [])).includes(categoryId));
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
    setTimeout(() => toggleCategoryTag(categoryId), 60);
  }

  unlinkFromCategory(id) {
    snapshot(state.todos);
    const t = state.todos.find(x => x.id === id);
    if (t) { delete t.categoryId; delete t.categoryIds; saveTodos(state.todos); }
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
    if (backup === null) {
      // Network / auth error — work offline, never push blindly
      return;
    }
    if (backup._empty) {
      // New user or cleared Firestore — push local state to initialise
      await pushToFirestore(getFullBackup(state.todos));
      return;
    }

    // Primary guard: if local has todos AND a push is pending (last push failed or
    // page reloaded before push completed), retry the push — BUT only if local data
    // is not clearly older than Firestore (prevents stale devices from overwriting).
    if (state.todos.length > 0 && localStorage.getItem('_pendingSync') === '1') {
      const localWriteTime  = parseInt(localStorage.getItem('_localWriteTime') || '0');
      const firestoreTime   = backup._firestoreUpdatedAt || 0;
      if (firestoreTime > localWriteTime + 5000) {
        // Firestore is clearly newer — our pending push is stale, discard it
        localStorage.removeItem('_pendingSync');
      } else {
        await pushToFirestore(getFullBackup(state.todos));
        return;
      }
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

    // If local config was changed after the last Firestore push, preserve it.
    // This prevents BrowserSync reloads (or any page reload) from reverting
    // theme, palette, glass mode, etc. to a stale Firestore snapshot.
    const localConfigTime = parseInt(localStorage.getItem('_localConfigTime') || '0');
    const firestoreConfigTime = _firestoreUpdatedAt || 0;
    if (localConfigTime > firestoreConfigTime) {
      delete cleanBackup.config;
    }

    this._applyBackup(cleanBackup, { silent: false });
  }

  // Merge a backup object into the app state (from Firestore or server)
  _applyBackup(backup, { silent }) {
    // Skip our own Firestore echoes using the session ID stamped in every push.
    if (backup._pushedBySession && backup._pushedBySession === SESSION_ID) return;


    let changed = false;

    if (backup.calendar) {
      // ── Per-item merge (Option A) ─────────────────────────
      // Merge local deletions with remote deletions
      const localDels  = JSON.parse(localStorage.getItem('_deletions') || '{}');
      const remoteDels = backup._deletions || {};
      const mergedDels = { ...localDels };
      for (const [id, ts] of Object.entries(remoteDels)) {
        mergedDels[id] = Math.max(mergedDels[id] || 0, ts);
      }
      localStorage.setItem('_deletions', JSON.stringify(mergedDels));

      // Build lookup maps
      const localMap  = new Map(state.todos.map(t => [t.id, t]));
      const remoteMap = new Map(backup.calendar.map(t => [t.id, t]));
      const allIds    = new Set([...localMap.keys(), ...remoteMap.keys()]);

      let hadLocalOnly = false;
      const merged = [];

      for (const id of allIds) {
        const delTs    = mergedDels[id] || 0;
        const local    = localMap.get(id);
        const remote   = remoteMap.get(id);
        const localTs  = local?.updatedAt  || parseInt(id) || 0;
        const remoteTs = remote?.updatedAt || parseInt(id) || 0;

        // Skip if deleted after last edit
        if (delTs > Math.max(localTs, remoteTs)) continue;

        if (local && remote) {
          merged.push(localTs >= remoteTs ? local : remote);
        } else if (local) {
          merged.push(local);
          hadLocalOnly = true; // local item unknown to remote → push back
        } else {
          merged.push(remote);
        }
      }

      // Preserve local order; append remote-only items at the end
      const localOrder = new Map(state.todos.map((t, i) => [t.id, i]));
      merged.sort((a, b) => {
        const ai = localOrder.has(a.id) ? localOrder.get(a.id) : Infinity;
        const bi = localOrder.has(b.id) ? localOrder.get(b.id) : Infinity;
        return ai !== bi ? ai - bi : (a.updatedAt || 0) - (b.updatedAt || 0);
      });

      const mergedJSON = JSON.stringify(merged);
      if (mergedJSON !== JSON.stringify(state.todos)) {
        state.setTodos(merged);
        localStorage.setItem('todos', mergedJSON);
        changed = true;
      }

      // Push merged result back if we had local items or deletions the remote didn't know about
      const delsChanged = JSON.stringify(mergedDels) !== JSON.stringify(remoteDels);
      if (hadLocalOnly || delsChanged) {
        saveTodos(state.todos);
      }
    }
    if (backup.categories)     localStorage.setItem('categories',         JSON.stringify(backup.categories));
    if (backup.templates)      localStorage.setItem('dayTemplates',      JSON.stringify(backup.templates));
    if (backup.suggestedTasks) localStorage.setItem('suggestedTasks',    JSON.stringify(backup.suggestedTasks));
    if (backup.taskOrder)      localStorage.setItem('projectTaskOrder',  JSON.stringify(backup.taskOrder));
    if (backup.intentions)     localStorage.setItem('intentions',        JSON.stringify(backup.intentions));
    if (backup.projects)  saveProjects(backup.projects);
    if (backup.config) {
      if (backup.config.zoom)       localStorage.setItem('zoom',       backup.config.zoom);
      if (backup.config.lang)       localStorage.setItem('lang',       backup.config.lang);
      if (backup.config.timezone)   localStorage.setItem('timezone',   backup.config.timezone);
      if (backup.config.icalHour)   localStorage.setItem('icalHour',   backup.config.icalHour);
      if (backup.config.icalFilters) localStorage.setItem('icalFilters', JSON.stringify(backup.config.icalFilters));
      const _bPal2 = backup.config.bgPalette;
      if (_bPal2)  this.setPalette(_bPal2, { sync: false });
      if (backup.config.bgColor && (!_bPal2 || _bPal2 === 'none'))  _setBgColor(backup.config.bgColor);
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
        logoAvatar.innerHTML = `<span class="logo-avatar-emoji" style="--ed-s:${avatarData.scale ?? 1.4};--ed-x:${avatarData.x ?? 0}px;--ed-y:${avatarData.y ?? 0}px">${avatarData.value}</span>`;
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
      if (!overlay) { resolve(); return; }
      // Reset to step 1
      document.getElementById('onboardingStep1')?.classList.remove('onboarding-step--hidden');
      document.getElementById('onboardingStep2')?.classList.add('onboarding-step--hidden');
      overlay.classList.remove('hidden');
      this._resolveGuestNamePrompt = resolve;
    });
  }

  // ── Onboarding step 1 actions ──
  onboardingTryApp() {
    const step1 = document.getElementById('onboardingStep1');
    const step2 = document.getElementById('onboardingStep2');
    // Slide step 1 out, step 2 in
    step1.classList.add('onboarding-step--exit');
    setTimeout(() => {
      step1.classList.add('onboarding-step--hidden');
      step1.classList.remove('onboarding-step--exit');
      step2.classList.remove('onboarding-step--hidden');
      step2.classList.add('onboarding-step--enter');
      document.getElementById('guestNameInput')?.focus();
      // Listen for Enter key
      document.getElementById('guestNameInput')?.addEventListener('keydown',
        e => { if (e.key === 'Enter') this.saveGuestName(); }, { once: true });
    }, 300);
  }

  onboardingSignup() {
    this._closeGuestNamePrompt();
    this.openAuthModal();
    this.showAuthRegister();
  }

  onboardingLogin() {
    this._closeGuestNamePrompt();
    this.openAuthModal();
    this.showAuthLogin();
  }

  // ── Onboarding step 2 actions ──
  async saveGuestName() {
    const name = document.getElementById('guestNameInput')?.value.trim();
    if (name) { await updateUserProfile(name); updatePresenceName(name); }
    localStorage.setItem('guestNameSkipped', '1');
    this._closeGuestNamePrompt();
    this._updateUserBtn();
  }

  skipGuestName() {
    localStorage.setItem('guestNameSkipped', '1');
    this._closeGuestNamePrompt();
  }

  async openAvatarFromPrompt() {
    const name = document.getElementById('guestNameInput')?.value.trim();
    if (name) { await updateUserProfile(name); updatePresenceName(name); }
    localStorage.setItem('guestNameSkipped', '1');
    this._closeGuestNamePrompt();
    this._updateUserBtn();
    this.openAvatarEditor();
  }

  _closeGuestNamePrompt() {
    const overlay = document.getElementById('guestNameOverlay');
    if (!overlay || overlay.classList.contains('hidden')) return;
    overlay.classList.add('onboarding-closing');
    setTimeout(() => {
      overlay.classList.add('hidden');
      overlay.classList.remove('onboarding-closing');
    }, 250);
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
      document.getElementById('authUserName').textContent = user.displayName || user.email || 'Utilisateur';
      document.getElementById('authUserSub').textContent  = 'Compte connecté';
      document.getElementById('authAvatar').textContent   = '✓';
      document.getElementById('authUpgradeSection').classList.add('hidden');
      document.getElementById('authWelcomeBubble').textContent = 'Tes tâches se synchronisent automatiquement sur tous tes appareils.';
    } else if (showGuestPanel) {
      document.getElementById('authUserName').textContent = user.displayName || 'Invité';
      document.getElementById('authUserSub').textContent  = 'Session locale · données sur cet appareil';
      document.getElementById('authAvatar').textContent   = '👤';
      document.getElementById('authUpgradeSection').classList.remove('hidden');
      document.getElementById('authWelcomeBubble').textContent = 'Crée un compte gratuit pour retrouver tes tâches sur tous tes appareils. Pas de spam, promis.';
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
    if (messages[code]) return messages[code];
    console.error('Firebase auth error:', code);
    return `Erreur d'authentification (${code}). Veuillez réessayer.`;
  }

  // ═══════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════
  parseDS(s) { return parseDS(s); }
  getNavDate() { return state.navDate; }
}

// ── Global todo context menu ─────────────────────────────
const _todoCtxMenu = document.createElement('div');
_todoCtxMenu.className = 'todo-ctx-menu hidden';
_todoCtxMenu.innerHTML = `
  <div class="ctx-item" data-action="edit"><span>✎</span> Modifier</div>
  <div class="ctx-item" data-action="add-after"><span>＋</span> Ajouter après</div>
  <div class="ctx-item" data-action="duplicate"><span>⧉</span> Dupliquer</div>
  <div class="ctx-sep"></div>
  <div class="ctx-item danger" data-action="delete"><span>×</span> Supprimer</div>
`;
document.body.appendChild(_todoCtxMenu);

let _ctxTarget = null;

function _showTodoCtxMenu(anchor, id, ds) {
  _ctxTarget = { id, ds };
  _todoCtxMenu.classList.remove('hidden');
  // Position below the anchor button, or at mouse position if anchor is the item itself
  const rect = anchor.getBoundingClientRect();
  const mw = 180, mh = 160;
  const vw = window.innerWidth, vh = window.innerHeight;
  let x = rect.right - mw;
  let y = rect.bottom + 4;
  if (y + mh > vh) y = rect.top - mh - 4;
  if (x < 8) x = 8;
  _todoCtxMenu.style.left = x + 'px';
  _todoCtxMenu.style.top  = y + 'px';
}

function _hideTodoCtxMenu() {
  _todoCtxMenu.classList.add('hidden');
  _ctxTarget = null;
}

_todoCtxMenu.addEventListener('click', e => {
  const item = e.target.closest('.ctx-item');
  if (!item || !_ctxTarget) return;
  const { id, ds } = _ctxTarget;
  _hideTodoCtxMenu();
  const action = item.dataset.action;
  if (action === 'edit')       window.app.openEditModal(id, ds);
  if (action === 'add-after')  window.app.addTaskAfter(id, ds);
  if (action === 'duplicate')  window.app.duplicateTodo(id, ds);
  if (action === 'delete')     window.app.deleteTodo(id, ds);
});

document.addEventListener('click', e => {
  if (!_todoCtxMenu.contains(e.target)) _hideTodoCtxMenu();
});

document.addEventListener('contextmenu', e => {
  const item = e.target.closest('.todo-item');
  if (!item) return;
  e.preventDefault();
  const id = item.getAttribute('data-id');
  const ds = item.getAttribute('data-date');
  _ctxTarget = { id, ds };
  _todoCtxMenu.classList.remove('hidden');
  const mw = 180, mh = 160;
  const vw = window.innerWidth, vh = window.innerHeight;
  let x = e.clientX + 4;
  let y = e.clientY;
  if (x + mw > vw) x = e.clientX - mw - 4;
  if (y + mh > vh) y = vh - mh - 8;
  _todoCtxMenu.style.left = x + 'px';
  _todoCtxMenu.style.top  = y + 'px';
});

// Create global app instance
window.app = new TodoApp();

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
  if (!localStorage.getItem('theme')) {
    document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    window.app.updateThemeBtn();
  }
});

// Keyboard shortcuts
let hoveredItem = null;
let hoveredItemEl = null;

document.addEventListener('mouseover', e => {
  const item = e.target.closest('.todo-item');
  if (item) {
    hoveredItemEl = item;
    hoveredItem = {
      id: item.getAttribute('data-id'),
      ds: item.getAttribute('data-date')
    };
  }
});

document.addEventListener('mouseout', e => {
  const item = e.target.closest('.todo-item');
  if (item && item === hoveredItemEl && !item.contains(e.relatedTarget)) {
    hoveredItem = null;
    hoveredItemEl = null;
  }
});

document.addEventListener('keydown', e => {
  // Skip shortcuts if user is editing a contenteditable element or input
  const activeEl = document.activeElement;
  if (activeEl?.getAttribute('contenteditable') === 'true' || activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA') {
    return;
  }

  // Skip shortcuts if a modal is open
  const isModalOpen = () => {
    const modalIds = ['modalOverlay', 'deleteModalOverlay', 'adminModalOverlay', 'templateModalOverlay', 'authModalOverlay', 'upgradePromptOverlay', 'leavePromptOverlay', 'avatarEditorOverlay', 'guestNameOverlay'];
    return modalIds.some(id => !document.getElementById(id)?.classList.contains('hidden'));
  };

  if (e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
    if (e.code === 'KeyD') {
      e.preventDefault();
      window.app.toggleTheme();
    }
    if (e.code === 'KeyG') {
      e.preventDefault();
      const next = localStorage.getItem('glassMode') !== '1';
      window.app.setGlassMode(next);
    }
    if (e.code === 'KeyB') {
      e.preventDefault();
      window.app.toggleBgMode();
    }
  }

  if (e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
    if (e.code === 'KeyN') {
      e.preventDefault();
      const date = hoveredItem?.ds || window.app.getNavDate?.()?.format?.('YYYY-MM-DD') || new Date().toISOString().split('T')[0];
      window.app.openModal(date);
    }
    if (e.code === 'KeyD' && hoveredItem) {
      e.preventDefault();
      window.app.duplicateTodo(hoveredItem.id, hoveredItem.ds);
    }
  }

  if (!e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
    if ((e.code === 'Delete' || e.code === 'Backspace') && hoveredItem) {
      e.preventDefault();
      window.app.deleteTodo(hoveredItem.id, hoveredItem.ds);
    }
    if (e.code === 'Space' && hoveredItem && !isModalOpen()) {
      e.preventDefault();
      const [y, m, d] = hoveredItem.ds.split('-').map(Number);
      window.app.toggleTodo(hoveredItem.id, new Date(y, m-1, d));
    }
    if (e.code === 'ArrowLeft') {
      e.preventDefault();
      const d = new Date(window.app.getNavDate());
      d.setDate(d.getDate() - 1);
      state.setNavDate(d);
      window.app._pushHistory();
      window.app._animateViewChange(-1);
    }
    if (e.code === 'ArrowRight') {
      e.preventDefault();
      const d = new Date(window.app.getNavDate());
      d.setDate(d.getDate() + 1);
      state.setNavDate(d);
      window.app._pushHistory();
      window.app._animateViewChange(1);
    }
  }
});
