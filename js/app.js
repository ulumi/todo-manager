// ════════════════════════════════════════════════════════
//  MAIN APPLICATION
// ════════════════════════════════════════════════════════

import { TRANSLATIONS, ZOOM_SIZES } from './modules/config.js';
import { initLowPolyBg, setPalette as _setBgPalette, setBgColor as _setBgColor, PALETTE_OPTIONS } from './modules/lowpoly-bg.js';
import {
  DS, p2, parseDS, today, addDays, startOfWeek,
  daysInMonth, firstDayOfMonth, esc, linkHostname,
  toggleSubtaskCollapsed, expandSubtask, safeParseJSON,
  dnDZone, needsSplit, splitIntoPromotedChildren,
  getDaySplit, setDaySplit, resetDaySplit, clampDaySplit, DAY_SPLIT_DEFAULT
} from './modules/utils.js';
import {
  saveTodos, loadTodos, getAppConfig, downloadJSON,
  exportAllData, exportCalendarOnly, exportConfigOnly, importData,
  downloadICalFile, getICalBlobURL,
  loadFromServer, saveBackupToServer, getFullBackup, initCrossTabSync, pushNow,
  scheduleSupabasePush, IS_LOCAL
} from './modules/storage.js';
import * as state from './modules/state.js';
import {
  attachMic, autoStartDictation, stopDictation, stopIfDetached,
  isDictationSupported, isAutoDictate, setAutoDictate
} from './modules/dictation.js';
import {
  getTodosForDate, isCompleted, isCancelled, toggleTodo, cancelTodo, deleteOneOccurrence,
  deleteFutureOccurrences, addTask, getSuggestions, getPeriodStatus,
  resolveOccurrence, occurrenceSubtasks, setOccurrenceField
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
  cancelModal, clearDraft, discardDraft, toggleCatSection,
  toggleModalSubtask, removeModalSubtask, addModalSubtaskInline, editModalSubtask,
  editModalSubtaskEstimate,
  consumeModalSubtasksDirty,
  addModalLinkInline, updateModalLink, normalizeModalLink, removeModalLink,
  setDeadlineQuick, setDeadlineHard, stepDeadlineLead,
} from './modules/modal.js';
import {
  todoItemHTML, renderDayView, renderWeekView, renderMonthView, renderYearView,
  renderCategoriesView, renderInboxView, renderBacklogView, getInboxCount, getBacklogCount,
  getPeriodLabel, getCloudsHTML, setupTodoItemHoverAnimations,
  renderSidebar, renderWeekSidebar, renderYearSidebar,
  renderPlanInboxList, renderProjectsView, renderSearchView,
  renderIntentionsView, renderAnalyseView, renderCountersView,
  subtaskListHTML,
} from './modules/render.js';
import {
  getAgendaPrefs, saveAgendaPrefs, getDayLayout,
  parseHM, fmtHM, snapWithNow, periodForMinutes, blockMinutes,
  SNAP_MIN, FINE_SNAP_MIN, MIN_BLOCK_MIN, DEFAULT_BLOCK_MIN,
} from './modules/agendaView.js';
import { setupEventListeners } from './modules/events.js';
import { celebrate, celebrateSpecial, celebrateWithQuote, celebrateSlideshow, getBannedQuotes, banQuote, unbanQuote, getCustomQuotes, addCustomQuote, updateCustomQuote, removeCustomQuote, getGlobalQuotes, setGlobalQuotes, DEFAULT_QUOTES_EN, DEFAULT_QUOTES_FR, onQuoteSave, onCelebrateDebug, getBannedFonts, banFont, getBannedMascots, banMascot } from './modules/celebrate.js';
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
import { initMultiSelect, msClear, msRefreshUI, msIds, msHas, msCount, MS_SELECTABLE } from './modules/multiselect.js';
import {
  renderFocusView, getFocusQueue, getFocusOrder, getCurrentFocusTask, focusTick, focusMarkSkipped,
  focusSetCurrent, focusResetSession, focusMarkCompletion,
  focusSaveManualOrder, getQueuePrefs, saveQueuePrefs,
  getTimerState, clearTimerState, elapsedSeconds, pauseTimer, resumeTimer, resetTimer,
  applyFocusEstimate, saveFocusProgress, startEditEstimate,
  toggleTimerMode, applyTimerMode,
  renderFocusPip, removeFocusPip,
  getBreakTargetMinutes, setBreakTargetMinutes, startEditBreakTarget, applyFocusBreakTarget,
  resolveFocusRef, focusSubtaskId,
} from './modules/focus.js';
import { getListPrefs, saveListPrefs, saveManualOrder,
  getRailPins, getRailFolds, getRailFilter, setRailFilter, deadlineHorizonDS,
} from './modules/backlogInboxView.js';
import {
  initAuth, onUserChange, isGuest, getCurrentUser,
  signInGuest, signInWithEmail, registerWithEmail,
  upgradeGuestToEmail, signOut, updateUserProfile,
  signInWithGoogle, signInWithFacebook, getIdToken,
} from './modules/auth.js';
import { loadFromSupabase, pushToSupabase, subscribeToSupabase, setupOfflineIndicator, deleteUserData, SESSION_ID, getOrCreateICalToken, disconnectGCal } from './modules/sync.js';
import { getDebugStatus, renderDebugDrawerHTML } from './modules/debugPanel.js';
import { initPresence, destroyPresence, markAllMessagesRead, sendUserMessage, updatePresenceName } from './modules/presence.js';
import {
  openAvatarEditor, closeAvatarEditor, getAvatarHTML,
  handleAvatarFile, selectAvatarFilter, selectAvatarEmoji,
  avatarSwitchTab, saveAvatar, FILTERS,
  cropDragStart, setCropZoom, setEmojiZoom,
} from './modules/avatarEditor.js';
import { getOverduePunctual, renderReviewBody } from './modules/review.js';

// Initialize state
state.initializeState();

// _deletions ({id: deletedAtTimestamp}) exists purely so a device that was
// offline when a delete happened doesn't resurrect the item on reconnect
// (_applyBackup skips any id whose tombstone is newer than its last known
// edit). Left unbounded it grows forever — pruned here, but deliberately
// with a generous horizon: a tombstone pruned too early is exactly the
// resurrection this map exists to prevent, for any device that stayed
// offline longer than the horizon.
const DELETION_HORIZON_MS = 365 * 24 * 60 * 60 * 1000;
function _pruneDeletions(dels) {
  const cutoff = Date.now() - DELETION_HORIZON_MS;
  const pruned = {};
  for (const [id, ts] of Object.entries(dels)) {
    if (ts >= cutoff) pruned[id] = ts;
  }
  return pruned;
}

// Champs qu'une tâche perd en devenant une sous-tâche (nestTaskAsSubtask,
// glisser-déposer en zone « imbriquer ») — une sous-tâche ne supporte que
// id/title/completed/subtasks(+durée/focus). Union sur tout le lot glissé,
// pas par item : un seul confirm() couvre tout le lot plutôt qu'une boîte
// de dialogue par tâche (cohérent avec le tout-ou-rien de moveManyToDate/
// _sendManyTo). La récurrence n'y figure pas : elle est bloquée en amont,
// sans confirm possible, comme addParentTask.
const _LOST_FIELD_CHECKS = [
  [t => !!t.priority, 'priorité'],
  [t => !!(t.categoryIds?.length || t.categoryId), 'catégorie'],
  [t => !!(t.projectIds?.length || t.projectId), 'projet'],
  [t => !!(t.intentionIds?.length || t.intentionId), 'intention'],
  [t => !!t.date, 'date'],
  [t => !!t.dayPeriod, 'moment de la journée'],
  [t => !!(t.startTime || t.endTime), 'heure'],
  [t => !!t.deadline, 'échéance'],
  [t => !!t.counterEnabled, 'compteur'],
  [t => !!t.groupId, 'groupe'],
];
function _lostFieldLabels(sources) {
  return _LOST_FIELD_CHECKS.filter(([test]) => sources.some(test)).map(([, label]) => label);
}
function _fieldLossConfirmMsg(sources, target, labels) {
  const list = labels.join(', ');
  return sources.length === 1
    ? `« ${sources[0].title} » perdra les champs suivants en devenant une sous-tâche de « ${target.title} » : ${list}. Continuer ?`
    : `Ces ${sources.length} tâches perdront les champs suivants en devenant des sous-tâches de « ${target.title} » : ${list}. Continuer ?`;
}
function _splitConfirmMsg(splitSources, target) {
  return splitSources.length === 1
    ? `« ${splitSources[0].title} » a déjà 2 niveaux de sous-tâches : elle sera remplacée par ses sous-tâches directes (renommées « ${splitSources[0].title} - … »), intégrées à « ${target.title} ». Continuer ?`
    : `${splitSources.length} tâches ont déjà 2 niveaux de sous-tâches : chacune sera remplacée par ses propres sous-tâches directes (renommées « Titre - … »), intégrées à « ${target.title} ». Continuer ?`;
}

// Application class
class TodoApp {
  constructor() {
    window.app = this; // assign early so renderDayView can read recurringOrder/dayOrder on first render
    // Registered before init() so it's live even for saveTodos() calls that
    // happen during boot migrations (storage.js dispatches this when a
    // localStorage write throws — full quota, Safari private browsing).
    window.addEventListener('storage-write-failed', () => {
      this._showToast('⚠ Stockage local plein — ce changement n’a pas pu être sauvegardé sur cet appareil');
    });
    this._sugg = [];
    this.zoomIdx = parseInt(localStorage.getItem('zoom') ?? '1');
    if (isNaN(this.zoomIdx) || this.zoomIdx < 0 || this.zoomIdx > 2) this.zoomIdx = 1;
    this.dayOrder = safeParseJSON(localStorage.getItem('dayOrder'), {});
    this.daySpacer = safeParseJSON(localStorage.getItem('daySpacer'), {});
    this.recurringOrder = safeParseJSON(localStorage.getItem('recurringOrder'), {});
    this.punctualPeriodOrder = safeParseJSON(localStorage.getItem('punctualPeriodOrder'), {});
    this._clickTimer = null;
    this._quickAddInDayMode = false;
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
    // Report automatique : ponctuelles en retard → aujourd'hui (récurrentes exclues)
    if (localStorage.getItem('autoPostpone') === 'true') this._autoPostponePass();
    this.applyZoom();
    this.initTheme();
    this.applyLang();
    this._initDictation();
    initLowPolyBg();
    this.initGlassMode();
    // Restore state from URL hash, fall back to localStorage
    const _hash = new URLSearchParams(window.location.hash.slice(1));
    const _hashView = _hash.get('view');
    const _hashNav  = _hash.get('nav');
    const _ALL_VIEWS = ['day','week','month','year','categories','inbox','backlog','plan','projects','superadmin','search','intentions','profile','analyse','focus'];
    // If last refresh was more than 8h ago, snap back to today's day view
    const _lastSeen = parseInt(localStorage.getItem('_lastSeen') || '0');
    const _staleSession = _lastSeen > 0 && Date.now() - _lastSeen > 8 * 3600 * 1000;
    localStorage.setItem('_lastSeen', Date.now().toString());
    // Le snap n'a réellement lieu que si rien dans le hash ne l'a déjà court-circuité
    // (lien partagé vers une vue/date précise) — sert à ne montrer l'indicateur/
    // l'entrée animée ci-dessous que quand le saut s'est vraiment produit.
    const _staleSnap = _staleSession && !_hashView && !_hashNav;
    if (_hashView && _ALL_VIEWS.includes(_hashView)) {
      state.setView(_hashView);
    } else if (_staleSession) {
      state.setView('day');
    } else {
      const savedView = localStorage.getItem('view');
      if (savedView && _ALL_VIEWS.includes(savedView)) state.setView(savedView);
    }
    if (_hashNav) {
      const [_hy, _hm, _hd] = _hashNav.split('-').map(Number);
      if (!isNaN(_hy)) state.setNavDate(new Date(_hy, _hm - 1, _hd));
    } else if (_staleSession) {
      state.setNavDate(today());
    }
    // Premier paint masqué le temps de render() pour pouvoir l'animer en entrée
    // juste après (fondu + léger glissement) — sinon la vue apparaîtrait d'un
    // coup sec, sans aucun signe que l'app vient de sauter d'elle-même sur
    // aujourd'hui à cause de l'absence prolongée.
    const _mainEl = document.getElementById('mainContent');
    if (_staleSnap && _mainEl) gsap.set(_mainEl, { opacity: 0, y: 10 });
    this.render();
    this._syncServer();
    if (_staleSnap && _mainEl) {
      gsap.to(_mainEl, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', clearProps: 'transform,opacity' });
      const _staleItems = document.querySelectorAll('.todo-item');
      if (_staleItems.length) {
        gsap.from(_staleItems, { opacity: 0, y: 8, duration: 0.25, stagger: { amount: 0.1 }, ease: 'power3.out' });
      }
      this._showToast("↻ Longue absence — retour à aujourd'hui");
    }
    // Restore modal from hash after render
    const _hashModal = _hash.get('modal');
    if (_hashModal === 'edit') {
      const _mId = _hash.get('id'), _mDate = _hash.get('date');
      if (_mId && _mDate) setTimeout(() => this.openEditModal(_mId, _mDate), 50);
    } else if (_hashModal === 'add') {
      const _mDate = _hash.get('date');
      setTimeout(() => openModal(_mDate ? parseDS(_mDate) : state.navDate, state.todos, 'date', { restoreDraft: true }), 50);
    } else if (_hashModal === 'review') {
      setTimeout(() => this.openReviewModal(), 50);
    }
    // Toast du report auto + invite quotidienne au bilan (pas si un modal est restauré)
    if (this._autoPostponedCount) this._showToast(`↪ ${this._autoPostponedCount} tâche${this._autoPostponedCount > 1 ? 's' : ''} reportée${this._autoPostponedCount > 1 ? 's' : ''} à aujourd'hui`);
    if (!_hashModal) this._maybeShowReviewPrompt();
    // Seed the history stack with the initial state
    history.replaceState({ view: state.view, nav: DS(state.navDate) }, '', this._buildHash());
    window.addEventListener('popstate', (e) => this._popHistory(e));
    const vl = document.getElementById('versionLabel');
    if (vl) vl.textContent = 'v' + VERSION;
    this._initDebugPanel();
    setupEventListeners(this);
    initMultiSelect(this);
    this._initNewDayWatch();
    this._initVersionWatch();

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
        // Le nombre de colonnes peut changer (media queries) : les hauteurs
        // seules sont suivies par le ResizeObserver, pas le passage
        // grille ↔ colonne unique
        if (state.view === 'day') this._layoutMasonry();
      }, 150);
    });
    setupOfflineIndicator();
    initCrossTabSync((key, raw) => {
      switch (key) {
        case 'todos': {
          // Blind overwrite (state.setTodos(JSON.parse(raw))) used to let
          // whichever tab wrote last simply clobber the other tab's
          // in-memory edit if both fired within the same instant — route
          // through the same per-item, timestamp-based merge _applyBackup()
          // already uses for cross-device sync instead of a flat replace.
          const parsed = safeParseJSON(raw, null);
          if (Array.isArray(parsed)) this._applyBackup({ calendar: parsed }, { silent: false });
          break;
        }
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
    this._initSupabase(); // async — does not block render
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

  // Call after any user-triggered config change so Supabase stays in sync
  // and the local config timestamp prevents Supabase from overwriting it on reload.
  _saveConfigChange() {
    localStorage.setItem('_localConfigTime', Date.now().toString());
    scheduleSupabasePush(); // debounced — avoid a full-row push per click (see storage.js)
    saveBackupToServer(getFullBackup(state.todos));
  }

  initTheme() {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    // Restore primary color
    let primaryColor = localStorage.getItem('primaryColor');
    if (!primaryColor) {
      primaryColor = '#e07040';
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
    let h = safeParseJSON(localStorage.getItem('searchHistory'), []);
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
      e.dataTransfer.effectAllowed = 'copyMove';
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
    const primaryColor = localStorage.getItem('primaryColor') || '#e07040';
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

    // Update auto-postpone checkbox
    const autoPostponeInput = document.getElementById('settingsAutoPostponeInput');
    if (autoPostponeInput) autoPostponeInput.checked = localStorage.getItem('autoPostpone') === 'true';

    // Update dictation checkbox
    const dictationInput = document.getElementById('settingsDictationInput');
    if (dictationInput) dictationInput.checked = isAutoDictate();

    // Update accent color picker (presets + custom input)
    const accentColors = isDark
      ? ['#e07040', '#f87171', '#4ade80', '#a78bfa', '#f472b6', '#fb923c']
      : ['#c85a2e', '#ef4444', '#10b981', '#8b5cf6', '#ec4899', '#f97316'];
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
    // Don't trigger if clicking the color input itself (let native behavior handle it —
    // the label would otherwise ALSO forward this same click to the input natively,
    // opening the picker a 2nd time via the setTimeout below and interfering with it
    // ever closing again).
    if (e?.target?.type === 'color') return;

    // Clicking elsewhere in the label (e.g. the "Color" text) would normally have the
    // browser forward the click to the input natively too — prevent that default action
    // so only the single manual .click() below opens the picker, not both.
    e?.preventDefault();

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
    document.getElementById('taskTitle').placeholder = state.T.taskPlaceholder;
    document.getElementById('quickInsertHintLabel').textContent = state.T.quickInsertPlaceholder;
    const zoomGroup = document.querySelector('.zoom-group');
    if (zoomGroup) zoomGroup.title = state.T.zoomButtonTitle;
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

  // ── Détection du changement de jour à la réactivation de l'onglet ──────────
  // Contrairement à la session « périmée » (>8h, voir init()) qui ne se
  // corrige qu'au rechargement, ceci réagit sans reload quand l'onglet est
  // resté ouvert (ordinateur en veille, changement d'appli) et qu'on y
  // revient après minuit : visibilitychange + focus fenêtre, plus un filet
  // de secours périodique (aucun des deux événements n'est garanti au
  // réveil d'un ordinateur endormi si l'onglet était déjà celui au premier
  // plan avant la veille — rien ne « change » de son point de vue, donc pas
  // de transition à détecter).
  //
  // BUG corrigé : le filet de secours tournait sans condition de visibilité
  // — un onglet resté actif en arrière-plan (écran verrouillé/éteint mais
  // pas de vraie veille système) consommait le changement de jour tout
  // seul entre minuit et le réveil de l'utilisateur (le toast s'affichait
  // ET se refermait tout seul, personne ne le voyait). check() doit donc
  // vérifier explicitement que la page est visible AVANT de faire quoi que
  // ce soit — y compris avant de mettre à jour lastSeenDay, sinon le signal
  // est perdu silencieusement sans jamais avoir été montré.
  _initNewDayWatch() {
    if (!localStorage.getItem('lastSeenDay')) localStorage.setItem('lastSeenDay', DS(today()));
    const check = () => { if (document.visibilityState === 'visible') this._maybeShowNewDayToast(); };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    setInterval(check, 60 * 1000);
  }

  // Le service worker (network-first, sw.js) garantit déjà qu'un rechargement
  // obtient le code à jour — mais un onglet resté ouvert pendant un déploiement
  // continue de tourner sur ses modules JS déjà évalués en mémoire, qu'aucun
  // mécanisme de cache ne peut rafraîchir sans un vrai rechargement. Même
  // schéma que _initNewDayWatch() (visibilitychange + focus + filet 60s) —
  // aligné sur le même filet, pas 30 min : un onglet resté actif en continu
  // (jamais de blur/focus) doit détecter un déploiement sans attendre, et le
  // coût (deux petits fichiers statiques via cache:'no-store') est négligeable.
  _initVersionWatch() {
    const check = () => { if (document.visibilityState === 'visible') this._checkForNewVersion(); };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    setInterval(check, 60 * 1000);
  }

  // Pas de garde "déjà montré une fois" — un onglet resté ouvert pendant
  // plusieurs déploiements successifs doit voir un nouveau toast apparaître à
  // chaque nouvelle version détectée, pas rester figé sur la toute première
  // annonce. On ne re-déclenche que si la version distante a réellement
  // changé depuis la dernière annonce, pour ne pas empiler un toast à chaque
  // poll de 60s sans rien de neuf.
  // _checkingVersion : verrou anti-course — cette fonction a PLUSIEURS
  // déclencheurs indépendants (poll 60s, visibilitychange, focus, et
  // maintenant aussi controllerchange/SW_UPDATED, cf. index.html) qui
  // peuvent tous se déclencher dans le même instant (ex. l'onglet reprend le
  // focus pile au moment où le SW active) ; sans ce verrou, plusieurs appels
  // concurrents passent tous le test `=== this._announcedVersion` (encore à
  // l'ancienne valeur) avant qu'aucun n'ait eu le temps de le mettre à jour
  // — chacun finit alors par appeler _showUpdateToast() séparément pour la
  // MÊME version tout juste détectée, d'où plusieurs toasts identiques
  // empilés. Le verrou rend les appels concurrents inoffensifs (no-op) sans
  // rien perdre : le prochain poll/trigger repassera de toute façon.
  async _checkForNewVersion() {
    if (this._checkingVersion) return;
    this._checkingVersion = true;
    try {
      const res = await fetch('/js/modules/version.js', { cache: 'no-store' });
      const text = await res.text();
      const m = text.match(/VERSION\s*=\s*['"]([^'"]+)['"]/);
      if (!m || m[1] === VERSION || m[1] === this._announcedVersion) return;
      // Depuis la dernière annonce (pas depuis VERSION à chaque fois) : les
      // toasts sont désormais indépendants les uns des autres, donc chacun ne
      // doit montrer que ce qui est nouveau DEPUIS le précédent, jamais un
      // rappel de notes déjà affichées sur un toast antérieur toujours visible.
      const since = this._announcedVersion || VERSION;
      const notes = await this._fetchChangelogNotes(since);
      this._announcedVersion = m[1];
      this._showUpdateToast(m[1], notes);
    } catch {} finally {
      this._checkingVersion = false;
    }
  }

  // Entrées écrites à chaque `cmt`/`dpl` (voir CLAUDE.md) — une par commit,
  // { version, date, message }, la plus récente en premier. Ne montre que
  // celles postérieures à `sinceVersion`.
  async _fetchChangelogNotes(sinceVersion) {
    try {
      const res = await fetch('/js/modules/changelog.json', { cache: 'no-store' });
      const list = await res.json();
      const idx = list.findIndex(e => e.version === sinceVersion);
      return idx === -1 ? list.slice(0, 5) : list.slice(0, idx);
    } catch { return []; }
  }

  // Chaque nouvelle version détectée crée son propre toast, indépendant des
  // précédents (jamais remplacé/fusionné) — empilés dans #updateToastStack,
  // ancré en bas comme l'était l'ancien toast unique. Container à hauteur
  // automatique + toasts ajoutés en fin de DOM : le plus récent reste près de
  // l'ancre (comportement naturel du flex, pas besoin de column-reverse), les
  // plus anciens sont repoussés vers le haut au fur et à mesure. Chacun garde
  // son propre numéro de version, son heure d'apparition et son état
  // déplié/replié — contrairement à .undo-toast (auto-fade), aucun ne
  // disparaît tout seul (jusqu'au rechargement).
  _showUpdateToast(newVersion, notes = []) {
    let stack = document.getElementById('updateToastStack');
    if (!stack) {
      stack = document.createElement('div');
      stack.id = 'updateToastStack';
      stack.className = 'update-toast-stack';
      document.body.appendChild(stack);
    }
    const toast = document.createElement('div');
    toast.className = notes.length ? 'update-toast expanded' : 'update-toast';
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const label = newVersion ? `Nouvelle version disponible (v${esc(newVersion)})` : 'Nouvelle version disponible';
    const toggleBtn = notes.length ? `
      <button class="update-toast-notes-btn" onclick="window.app.toggleUpdateToastNotes(this)" aria-label="Voir les changements">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
      </button>` : '';
    const notesHTML = notes.length ? `
      <div class="update-toast-notes">
        <div class="update-toast-notes-inner">
          <ul>${notes.map(n => `<li>${esc(n.message)}</li>`).join('')}</ul>
        </div>
      </div>` : '';
    toast.innerHTML = `
      <div class="update-toast-main">
        <span>${label}</span>
        <span class="update-toast-time" title="Heure de détection">${time}</span>
        ${toggleBtn}
        <button class="update-toast-btn" onclick="window.app.reloadForUpdate()">Recharger</button>
      </div>
      ${notesHTML}`;
    stack.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('update-toast--visible'));
  }

  toggleUpdateToastNotes(btn) {
    btn.closest('.update-toast')?.classList.toggle('expanded');
  }

  // Un chrono Focus laissé EN COURS (paused:false) au moment du reload
  // perdrait tout le temps écoulé depuis son dernier `startedAt` : le filet
  // de sécurité au chargement du module (focus.js) le fige en pause SANS
  // recalculer ce delta (pas fiable après un rechargement non maîtrisé —
  // crash, fermeture d'onglet…), donc systématiquement sous-compté. Ici le
  // rechargement est un clic délibéré : on peut donc le faire correctement,
  // comme un vrai clic Pause (`pauseTimer` réplie le temps écoulé dans
  // `accum` et persiste), juste avant de recharger — le filet de focus.js
  // n'a alors plus rien à corriger.
  reloadForUpdate() {
    try {
      const ts = JSON.parse(localStorage.getItem('focusTimer'));
      if (ts && ts.paused === false) pauseTimer(ts);
    } catch {}
    location.reload();
  }

  _maybeShowNewDayToast() {
    const freshToday = DS(today());
    const lastSeenDay = localStorage.getItem('lastSeenDay');
    localStorage.setItem('lastSeenDay', freshToday);
    // Rien à signaler : jour inchangé, ou déjà sur la vue d'aujourd'hui
    if (!lastSeenDay || lastSeenDay === freshToday || DS(state.navDate) === freshToday) return;
    this._showNewDayToast();
  }

  // Toast dédié (pas _showToast/#undoToast, non interactif) : bouton Annuler
  // + décompte 3→1s avant de sauter à aujourd'hui (todayNav()).
  _showNewDayToast() {
    document.getElementById('newDayToast')?.remove();
    if (this._newDayInterval) clearInterval(this._newDayInterval);
    const toast = document.createElement('div');
    toast.id = 'newDayToast';
    toast.className = 'newday-toast';
    document.body.appendChild(toast);
    let remaining = 3;
    const paint = () => {
      toast.innerHTML = `<span class="newday-toast-msg">Nouvelle journée — retour à aujourd'hui dans <span class="newday-toast-count">${remaining}</span>s</span><button class="newday-toast-cancel" onclick="window.app.cancelNewDayJump()">Annuler</button>`;
    };
    paint();
    requestAnimationFrame(() => toast.classList.add('newday-toast--visible'));
    this._newDayInterval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) { this._finishNewDayJump(); return; }
      paint();
    }, 1000);
  }

  cancelNewDayJump() {
    if (this._newDayInterval) { clearInterval(this._newDayInterval); this._newDayInterval = null; }
    const toast = document.getElementById('newDayToast');
    if (!toast) return;
    toast.classList.remove('newday-toast--visible');
    setTimeout(() => toast.remove(), 200);
  }

  _finishNewDayJump() {
    if (this._newDayInterval) { clearInterval(this._newDayInterval); this._newDayInterval = null; }
    document.getElementById('newDayToast')?.remove();
    this.todayNav();
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

    // Warn if completing a todo that has incomplete subtasks — compte
    // récursif (sous-sous-tâches incluses), sinon compléter une tâche
    // ignorerait silencieusement des enfants non faits nichés un niveau
    // plus bas. resolveOccurrence() : les sous-tâches EFFECTIVES de cette
    // date (override si la tâche récurrente en a un pour aujourd'hui).
    const effSubtasks = todo && resolveOccurrence(todo, DS(d)).subtasks;
    if (!wasCompleted && effSubtasks?.length) {
      const incomplete = this._countIncompleteSubtasks(effSubtasks);
      if (incomplete) {
        this._showSubtaskWarning(id, d, incomplete);
        return;
      }
    }

    snapshot(state.todos);
    toggleTodo(id, d, state.todos);
    saveTodos(state.todos);
    if (!wasCompleted && !e?.altKey) {
      if (!this._maybeCelebrateMilestone(todo, d)) celebrate(state.lang);
    }
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
    if (!wasCompleted && !e?.altKey && this._hasNoTimerInfo(todo)) {
      this._showCompletionDurationPrompt(id, DS(d));
    }
  }

  _hasNoTimerInfo(t) {
    return !t?.durationReal && (!Array.isArray(t?.durationHistory) || t.durationHistory.length === 0);
  }

  // Célébrations spéciales de fin de journée (voir celebrate.js
  // `celebrateSpecial`) : « spécial » quand la dernière tâche d'après-midi
  // vient d'être complétée ET que la soirée n'a rien de prévu (journée
  // quasi bouclée) ; « super spécial » quand la dernière tâche de soirée
  // vient d'être complétée (journée entièrement bouclée). Portée
  // volontairement limitée à la case à cocher de la vue jour, sur
  // aujourd'hui — pas les actions de lot, pas les autres vues. Retourne
  // true si une célébration spéciale a été jouée (remplace celebrate()).
  _maybeCelebrateMilestone(todo, d) {
    const period = todo?.dayPeriod;
    if (period !== 'afternoon' && period !== 'evening') return false;
    const ds = DS(d);
    if (ds !== DS(today())) return false;
    const status = getPeriodStatus(ds, period, state.todos);
    if (!status.total || status.done < status.total) return false; // pas encore la dernière

    if (period === 'evening') {
      celebrateSpecial(state.lang, 'evening');
      return true;
    }
    // Après-midi bouclé : « spécial » seulement si la soirée est libre —
    // sinon célébration normale, il reste du travail ce soir
    const evening = getPeriodStatus(ds, 'evening', state.todos);
    if (evening.total > 0) return false;
    celebrateSpecial(state.lang, 'afternoon', () => this.addSectionTask('evening'));
    return true;
  }

  // Invite « Durée ? » à la complétion d'une tâche jamais chronométrée.
  // Inline dans .todo-content (jamais un overlay) : contrairement à
  // l'ancien popover ancré à l'item (retiré, voir historique git — il
  // recouvrait la ligne voisine et cassait la complétion en un clic),
  // ceci participe au flux normal de la ligne et ne peut donc jamais
  // chevaucher un item voisin. Ignoré silencieusement si laissé vide.
  _showCompletionDurationPrompt(id, ds) {
    // Exclusion .task-group-header : voir _showSubtaskWarning() — même
    // data-id partagé pour une tâche seule dans son groupe.
    const item = document.querySelector(`[data-id="${id}"]:not(.task-group-header):not(.day-spacer)`);
    if (!item || item.querySelector('.todo-duration-prompt')) return;
    if (item.offsetParent === null) return; // masquée (ex. mode stats) — inutile d'inviter dans le vide
    const content = item.querySelector('.todo-content');
    if (!content) return;
    const wrap = document.createElement('span');
    wrap.className = 'todo-duration-prompt';
    wrap.innerHTML = '<span class="tdp-label">Durée ?</span>';
    wrap.addEventListener('click', ev => ev.stopPropagation());
    wrap.addEventListener('mousedown', ev => ev.stopPropagation());
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '1';
    input.step = '1';
    input.inputMode = 'numeric';
    input.className = 'tdp-input';
    input.placeholder = 'min';
    input.title = 'Combien de temps ça a pris ?';
    input.addEventListener('click', ev => ev.stopPropagation());
    input.addEventListener('mousedown', ev => ev.stopPropagation());
    wrap.appendChild(input);
    let done = false;
    const commit = () => {
      if (done) return;
      done = true;
      const minutes = parseInt(input.value, 10);
      wrap.remove();
      if (minutes > 0) {
        const t = state.todos.find(x => x.id === id);
        if (!t) return;
        snapshot(state.todos);
        t.durationReal = minutes;
        if (!Array.isArray(t.durationHistory)) t.durationHistory = [];
        t.durationHistory.push({ date: ds, minutes });
        if (t.durationHistory.length > 30) t.durationHistory = t.durationHistory.slice(-30);
        t.updatedAt = Date.now();
        saveTodos(state.todos);
        this.render();
      }
    };
    input.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
      if (ev.key === 'Escape') { done = true; wrap.remove(); }
    });
    input.addEventListener('blur', commit);
    content.appendChild(wrap);
    input.focus();
  }

  _showSubtaskWarning(id, d, count) {
    document.querySelectorAll('.subtask-warning-popover').forEach(el => el.remove());
    const ds = DS(d);
    // `.task-group-header` porte le même data-id que le 1er membre du
    // groupe (voir render.js/backlogInboxView.js todoListHTML/
    // renderGroupedItems) — sans cette exclusion, une tâche seule dans son
    // groupe (visible car unique membre) matchait l'en-tête à la place de
    // la vraie carte : le popover s'accrochait à un conteneur non
    // positionné, atterrissait n'importe où (souvent hors du viewport) et
    // semblait ne rien faire au clic. `.day-spacer` (placeholder de drag)
    // porte aussi ce data-id, exclu par la même précaution.
    const item = document.querySelector(`[data-id="${id}"]:not(.task-group-header):not(.day-spacer)`);
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
    // Flip sous la carte si pas assez de place au-dessus (ex. tout 1er item
    // d'une colonne/section, en haut de la vue) — sinon `bottom: 100%+6px`
    // pousse le popover hors du viewport (top négatif), invisible et donc
    // inutilisable : au clic sur la checkbox, rien ne semble se passer alors
    // que l'avertissement est bien là, juste rendu au-dessus de l'écran.
    const rect = item.getBoundingClientRect();
    if (rect.top < popover.offsetHeight + 16) popover.classList.add('stw-below');
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
    if (mode === 'all') {
      occurrenceSubtasks(todo, dsStr).forEach(s => s.completed = true);
    }
    const d = this.parseDS(dsStr);
    toggleTodo(id, d, state.todos);
    saveTodos(state.todos);
    celebrate(state.lang);
    this.render();
    this._refreshCategoryPanel();
  }

  // Survol prolongé (2 s, setupTodoItemHoverAnimations() dans render.js) —
  // édition rapide de la durée estimée sans ouvrir le modal. Si un badge
  // temps focus (.todo-focustime-label) est déjà affiché, l'édition se fait
  // en place dedans (_editEstimateLabel, partagé avec editEstimateBadge) ;
  // sinon (aucun temps passé ni estimation, donc aucun badge) un input
  // flottant rejoint .todo-meta (créée si absente) — jamais .todo-content
  // directement : ce dernier est le conteneur du TITRE lui-même (flex-wrap),
  // y ajouter un enfant de plus le fait concurrencer le titre pour la place
  // sur sa propre ligne. .todo-meta est la rangée de badges dédiée — le
  // rejoindre revient à traiter ce champ comme le futur badge qu'il deviendra.
  showEstimateHoverEdit(itemEl) {
    if (!itemEl.isConnected) return;
    // Le timer de 2s (setupTodoItemHoverAnimations) tourne depuis l'entrée
    // du survol, indépendamment de ce qui se passe ensuite dans l'item — si
    // l'utilisateur est déjà en train de taper ailleurs dans cet item (ex.
    // nouvelle sous-tâche via le bouton +), voler le focus interromprait sa
    // saisie. Même garde que le listener keydown global (ligne ~8135).
    const activeEl = document.activeElement;
    if (itemEl.contains(activeEl) && (activeEl?.getAttribute('contenteditable') === 'true' || activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA')) {
      return;
    }
    const id = itemEl.dataset.id;
    const ds = itemEl.dataset.date;
    const t = state.todos.find(x => x.id === id);
    if (!t) return;
    const label = itemEl.querySelector('.todo-focustime-label');
    if (label) { this._editEstimateLabel(label, t, ds); return; }
    const content = itemEl.querySelector('.todo-content');
    if (!content) return;
    let meta = itemEl.querySelector('.todo-meta');
    if (!meta) {
      meta = document.createElement('div');
      meta.className = 'todo-meta';
      content.appendChild(meta);
    } else if (meta.querySelector('.todo-estimate-hover-input')) {
      return;
    }
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '1';
    input.step = '1';
    input.inputMode = 'numeric';
    input.className = 'todo-estimate-hover-input';
    input.placeholder = 'min';
    input.title = 'Durée estimée (minutes)';
    input.addEventListener('click', e => e.stopPropagation());
    input.addEventListener('mousedown', e => e.stopPropagation());
    let saved = false;
    const confirm = () => {
      if (saved) return;
      saved = true;
      itemEl.removeEventListener('mouseleave', confirm);
      const val = parseInt(input.value, 10);
      input.remove();
      if (val > 0 && val !== resolveOccurrence(t, ds).durationEstimated) {
        snapshot(state.todos);
        setOccurrenceField(t, ds, 'durationEstimated', val);
        t.updatedAt = Date.now();
        saveTodos(state.todos);
        this.render();
      }
    };
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); confirm(); }
      if (e.key === 'Escape') { saved = true; itemEl.removeEventListener('mouseleave', confirm); input.remove(); }
    });
    input.addEventListener('blur', confirm);
    // « Juste un hover » : quitter l'item referme le champ (sauve s'il y a
    // une valeur valide, sinon disparaît sans rien créer) — même confirm()
    // que blur/Entrée, pour ne jamais laisser un champ orphelin une fois la
    // souris repartie.
    itemEl.addEventListener('mouseleave', confirm);
    meta.appendChild(input);
    input.focus();
    input.select();
  }

  // Clic direct sur le badge temps focus (.todo-focustime-badge.editable,
  // posé seulement si durationEstimated existe déjà) — même édition en
  // place que showEstimateHoverEdit, déclenchée immédiatement sans survol
  editEstimateBadge(badgeEl, id) {
    const t = state.todos.find(x => x.id === id);
    const label = badgeEl.querySelector('.todo-focustime-label');
    if (!t || !label) return;
    const ds = badgeEl.closest('[data-date]')?.dataset.date;
    this._editEstimateLabel(label, t, ds);
  }

  // Remplace le contenu texte du badge par un <input> in situ — même
  // position, même taille de police (voir .todo-focustime-input en SCSS) —
  // pour éditer sans jamais faire apparaître un champ ailleurs sur la ligne
  _editEstimateLabel(label, t, ds) {
    if (label.querySelector('input')) return;
    const prevText = label.textContent;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '1';
    input.step = '1';
    input.inputMode = 'numeric';
    input.className = 'todo-focustime-input';
    const curEstimate = resolveOccurrence(t, ds).durationEstimated;
    if (curEstimate) input.value = curEstimate;
    input.addEventListener('click', e => e.stopPropagation());
    input.addEventListener('mousedown', e => e.stopPropagation());
    let settled = false;
    const restore = () => { label.textContent = prevText; };
    const confirm = () => {
      if (settled) return;
      settled = true;
      const val = parseInt(input.value, 10);
      if (val > 0 && val !== curEstimate) {
        snapshot(state.todos);
        setOccurrenceField(t, ds, 'durationEstimated', val);
        t.updatedAt = Date.now();
        saveTodos(state.todos);
        this.render();
      } else {
        restore();
      }
    };
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); confirm(); }
      if (e.key === 'Escape') { settled = true; restore(); }
    });
    input.addEventListener('blur', confirm);
    label.textContent = '';
    label.appendChild(input);
    input.focus();
    input.select();
  }

  // ── Subtask methods ────────────────────────────────────────────────────────

  // Menu contextuel « Ajouter une sous-tâche » sur une tâche qui n'en a
  // encore aucune : le bloc sous-tâches (todoItemHTML, render.js) ne se
  // rend normalement que si subtasks.length > 0, donc il n'existe pas
  // encore dans le DOM — on l'injecte ici par patch ciblé (pas de render()
  // complet, pour ne pas faire clignoter le reste de la vue jour), puis on
  // ouvre l'input inline comme le bouton natif le ferait déjà.
  // Ancré aussi sur .inbox-item (cartes Inbox/Backlog, même checklist rendue
  // dans la carte) — ds vide dans ce cas : un item sans date n'est pas
  // focusable, subtaskListHTML masque alors les boutons ▶.
  // Point d'entrée commun avec le bouton « + » de la rangée d'actions de
  // l'item (`.todo-subtask-add-btn`, rendu seulement quand la tâche n'a pas
  // encore de checklist — cf. subtaskParts, render.js).
  ctxAddSubtask(id) {
    const itemEl = document.querySelector(`.todo-item[data-id="${id}"], .inbox-item[data-id="${id}"]`);
    if (!itemEl) return;
    // data-date porte l'occurrence RÉELLEMENT affichée (peut différer
    // d'aujourd'hui si on consulte un autre jour) — jamais DS(today()) en dur.
    const ds = itemEl.classList.contains('inbox-item') ? '' : (itemEl.dataset.date || DS(today()));
    if (!itemEl.querySelector('.subtask-list')) {
      itemEl.insertAdjacentHTML('beforeend', `<div class="subtask-collapse"><div class="subtask-collapse-inner">${subtaskListHTML([], id, ds)}</div></div>`);
    } else {
      // La liste peut déjà exister mais être repliée (grid-template-rows:0)
      // — sans dépli, l'input inline serait injecté hors de vue
      const wrap = itemEl.querySelector('.subtask-collapse.collapsed');
      if (wrap) {
        wrap.classList.remove('collapsed');
        expandSubtask(id);
        const toggleBtn = itemEl.querySelector('.todo-subtask-toggle');
        toggleBtn?.querySelector('.subtask-toggle-chevron')?.classList.remove('collapsed');
        if (toggleBtn) toggleBtn.title = 'Masquer les sous-tâches';
      }
    }
    this.addSubtaskInline(id, null, ds);
  }

  // Petit input inline injecté juste au-dessus d'un item de tâche pour
  // saisir un titre (tâche parente, en-tête de groupe) — jamais de prompt()
  // natif, cf. patterns projet. Patch DOM ciblé : aucun render() tant que
  // la saisie n'est pas confirmée. Échap ou champ vide annule sans trace.
  _inlineTitlePrompt(id, placeholder, onConfirm) {
    const itemEl = document.querySelector(`.todo-item[data-id="${id}"]`);
    if (!itemEl || itemEl.previousElementSibling?.classList.contains('ctx-title-input')) return;
    this._inlineInput(placeholder, onConfirm, el => itemEl.before(el));
  }

  // Cœur partagé des saisies inline de titre : Entrée confirme, Échap annule
  // sans trace, blur confirme. `place` décide de l'emplacement (avant un
  // item, en fin de section…) — c'est la seule chose qui change d'un appel à
  // l'autre. onConfirm reçoit `viaEnter` : seule une validation au clavier
  // peut enchaîner sur une nouvelle saisie (même convention que la rafale de
  // sous-tâches — sinon le clic destiné à SORTIR du champ rouvrirait aussitôt
  // un champ qui reprend le focus). En liste masonry, l'input doit recevoir
  // son --rspan comme les autres enfants, sinon il n'occuperait qu'une
  // tranche de 4 px.
  _inlineInput(placeholder, onConfirm, place) {
    const input = document.createElement('input');
    input.className = 'ctx-title-input';
    input.placeholder = placeholder;
    input.autocomplete = 'off';
    let done = false;
    const finish = (viaEnter = false) => {
      if (done) return;
      done = true;
      const title = input.value.trim();
      input.remove();
      if (title) onConfirm(title, viaEnter);
    };
    input.addEventListener('keydown', e => {
      // Empêche toute lettre tapée ici (n, d, w, m, y, t, f…) de bubbler
      // jusqu'aux raccourcis clavier globaux sans touche modificatrice
      // (events.js/app.js) — sinon une frappe change de vue ou ouvre un
      // autre panneau en pleine saisie, qui démonte cet input au passage.
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      if (e.key === 'Escape') { done = true; input.remove(); }
    });
    input.addEventListener('blur', () => finish(false));
    place(input);
    this._updateMasonrySpan(input);
    this._masonryRO?.observe(input);
    input.focus();
    return input;
  }

  // Menu contextuel → Grouper → « Créer une tâche parente » : crée une nouvelle tâche
  // qui hérite du contexte de la tâche visée (date/backlog, moment, heure,
  // priorité, tag/projet/intention, groupe) et l'absorbe comme 1re
  // sous-tâche — inverse exact d'« Ajouter une sous-tâche ». La tâche visée
  // cesse d'exister comme tâche autonome : le modèle n'a qu'UN niveau
  // d'imbrication, d'où l'exclusion des récurrentes (la récurrence et
  // completedDates n'ont pas d'équivalent sur une sous-tâche) et la
  // confirmation quand elle a déjà des sous-tâches, aplaties à son niveau.
  addParentTask(id) {
    const t = state.todos.find(x => x.id === id);
    if (!t || (t.recurrence && t.recurrence !== 'none')) return;
    this._inlineTitlePrompt(id, 'Titre de la tâche parente…', title => {
      const cur = state.todos.find(x => x.id === id);
      if (!cur) return;
      const kids = cur.subtasks || [];
      if (kids.length && !confirm(`« ${cur.title} » a ${kids.length} sous-tâche(s) : elles passeront au même niveau qu'elle, sous « ${title} ». Continuer ?`)) return;
      snapshot(state.todos);
      const pid = Date.now().toString();
      const parent = {
        id: pid,
        title,
        completed: false,
        completedDates: [],
        date: cur.date,
        subtasks: [
          { id: cur.id, title: cur.title, completed: !!cur.completed },
          ...kids.map(s => ({ ...s })),
        ],
        updatedAt: parseInt(pid),
      };
      if (cur.backlog) parent.backlog = true;
      if (cur.deadline) parent.deadline = cur.deadline;
      if (cur.dayPeriod) parent.dayPeriod = cur.dayPeriod;
      if (cur.startTime) parent.startTime = cur.startTime;
      if (cur.endTime) parent.endTime = cur.endTime;
      if (cur.priority) parent.priority = cur.priority;
      if (cur.categoryIds?.length) parent.categoryIds = [...cur.categoryIds];
      else if (cur.categoryId) parent.categoryId = cur.categoryId;
      if (cur.projectIds?.length) parent.projectIds = [...cur.projectIds];
      else if (cur.projectId) parent.projectId = cur.projectId;
      if (cur.intentionIds?.length) parent.intentionIds = [...cur.intentionIds];
      else if (cur.intentionId) parent.intentionId = cur.intentionId;
      // Le parent prend la place du membre dans un éventuel groupe existant
      if (cur.groupId) { parent.groupId = cur.groupId; parent.groupTitle = cur.groupTitle; }
      const idx = state.todos.findIndex(x => x.id === id);
      // L'id disparaît de state.todos : sans tombstone, un appareil resté
      // hors ligne le ressusciterait au prochain merge de _applyBackup()
      this._trackDeletion(cur.id);
      state.todos.splice(idx, 1, parent);
      saveTodos(state.todos);
      this.render();
    });
  }

  // Menu contextuel « Créer un groupe » : pose un groupId/groupTitle neuf sur
  // la tâche visée, qui reste une tâche autonome à part entière (contrairement
  // à « Ajouter une tâche parente » ci-dessus, qui la fait disparaître en
  // sous-tâche). D'autres tâches rejoignent ce groupe ensuite via la
  // multi-sélection → « Grouper », ou en réutilisant le même groupId.
  // L'en-tête s'affiche dès ce seul membre (cf. todoListHTML).
  addGroupHeader(id) {
    const t = state.todos.find(x => x.id === id);
    if (!t || t.groupId) return;
    this._inlineTitlePrompt(id, 'Nom du groupe…', title => {
      const cur = state.todos.find(x => x.id === id);
      if (!cur || cur.groupId) return;
      snapshot(state.todos);
      cur.groupId = 'grp-' + Date.now().toString();
      cur.groupTitle = title;
      cur.updatedAt = Date.now();
      saveTodos(state.todos);
      this.render();
    });
  }

  // Liste d'un moment de la colonne Aujourd'hui (Matin/Après-midi/Soir, ou
  // la liste sans moment) — cible des saisies inline lancées par le clic
  // droit sur la section elle-même.
  _sectionListEl(period) {
    const col = document.querySelector('.day-col--punctual');
    if (!col) return null;
    if (period) {
      return col.querySelector(`.day-heure-section[data-period="${period}"] .todo-list`)
          || col.querySelector(`.todo-list[data-group="punctual-${period}"]`);
    }
    const existing = col.querySelector('.todo-list[data-group="punctual"]');
    if (existing) return existing;
    // Aucune tâche sans moment aujourd'hui : cette liste n'est pas rendue du
    // tout — on pose un conteneur d'accueil à l'endroit exact qu'elle
    // occupera (juste avant les sections de moment). Il disparaît au
    // prochain render(), et ne laisse rien de visible si la saisie est annulée.
    const grid = col.querySelector('.day-heure-grid');
    if (!grid) return null;
    const holder = document.createElement('div');
    holder.className = 'todo-list';
    grid.before(holder);
    return holder;
  }

  // Clic droit sur un moment → « Créer un groupe ». Un groupe n'existe que
  // par ses membres (groupId/groupTitle dénormalisés sur chaque tâche, pas de
  // collection séparée) : un en-tête vide est impossible à stocker, d'où
  // l'enchaînement direct titre du groupe → 1re tâche.
  addSectionGroupHeader(period) {
    const list = this._sectionListEl(period);
    if (!list) return;
    this._inlineInput('Nom du groupe…', title => {
      this._addSectionTaskInline(period, 'grp-' + Date.now().toString(), title);
    }, el => list.appendChild(el));
  }

  // Saisie inline d'une tâche dans un moment donné (avec ou sans groupe), en
  // rafale : Entrée crée et rouvre aussitôt un champ pour la suivante —
  // remplir un groupe qu'on vient de nommer doit rester d'un seul geste.
  // Entrée à vide ou Échap sort.
  _addSectionTaskInline(period, groupId, groupTitle) {
    const list = this._sectionListEl(period);
    if (!list) return;
    const ph = groupTitle ? `Tâche dans « ${groupTitle} »…` : 'Titre de la tâche…';
    this._inlineInput(ph, (title, viaEnter) => {
      snapshot(state.todos);
      const data = { title, date: DS(state.navDate), recurrence: 'none' };
      if (period) data.dayPeriod = period;
      if (groupId) { data.groupId = groupId; data.groupTitle = groupTitle; }
      addTask(data, state.todos);
      saveTodos(state.todos);
      this.render();
      if (viaEnter) this._addSectionTaskInline(period, groupId, groupTitle);
    }, el => list.appendChild(el));
  }

  addSectionTask(period) { this._addSectionTaskInline(period, null, null); }

  // .inbox-item : cartes Inbox/Backlog, qui rendent la même checklist que la
  // vue jour (cf. subtaskParts, render.js) — sans ce sélecteur, le repli y
  // serait persisté mais jamais appliqué visuellement
  toggleSubtasksCollapse(btn, id) {
    const collapsed = toggleSubtaskCollapsed(id);
    const item = btn.closest('.todo-item, .inbox-item');
    const wrap = item?.querySelector('.subtask-collapse');
    if (wrap) wrap.classList.toggle('collapsed', collapsed);
    btn.querySelector('.subtask-toggle-chevron')?.classList.toggle('collapsed', collapsed);
    btn.title = collapsed ? 'Afficher les sous-tâches' : 'Masquer les sous-tâches';
  }

  // Résout une (sous-)sous-tâche DANS UN TABLEAU DÉJÀ RÉSOLU (cf.
  // occurrenceSubtasks/resolveOccurrence, calendar.js) : parentStid absent →
  // cherche à la racine du tableau (profondeur 1) ; présent → cherche dans
  // les enfants de CE membre (profondeur 2, la seule autorisée — décision
  // produit : un seul niveau d'imbrication supplémentaire, jamais de 3e niveau).
  _findSubtask(subs, stid, parentStid) {
    if (!subs) return null;
    if (parentStid) return subs.find(p => p.id === parentStid)?.subtasks?.find(x => x.id === stid) || null;
    return subs.find(x => x.id === stid) || null;
  }

  // Compte récursif des (sous-)sous-tâches non faites — utilisé par
  // l'avertissement de complétion ci-dessus.
  _countIncompleteSubtasks(subtasks) {
    let n = 0;
    (subtasks || []).forEach(s => {
      if (!s.completed) n++;
      if (s.subtasks?.length) n += this._countIncompleteSubtasks(s.subtasks);
    });
    return n;
  }

  // ds = occurrence visée (cf. occurrenceSubtasks, calendar.js) : pour une
  // tâche récurrente, toute mutation ne touche QUE cette date — les autres
  // occurrences (passées/futures) gardent le master intact.
  toggleSubtask(todoId, stid, ds, parentStid) {
    const t = state.todos.find(x => x.id === todoId);
    if (!t) return;
    const arr = occurrenceSubtasks(t, ds);
    const s = this._findSubtask(arr, stid, parentStid);
    if (!s) return;
    snapshot(state.todos);
    s.completed = !s.completed;
    t.updatedAt = Date.now();
    saveTodos(state.todos);
    this.render();
  }

  deleteSubtask(todoId, stid, ds, parentStid) {
    const t = state.todos.find(x => x.id === todoId);
    if (!t) return;
    const arr = occurrenceSubtasks(t, ds);
    snapshot(state.todos);
    if (parentStid) {
      const p = arr.find(x => x.id === parentStid);
      const i = p?.subtasks?.findIndex(x => x.id === stid) ?? -1;
      if (i > -1) p.subtasks.splice(i, 1);
    } else {
      const i = arr.findIndex(x => x.id === stid);
      if (i > -1) arr.splice(i, 1);
    }
    t.updatedAt = Date.now();
    saveTodos(state.todos);
    this.render();
  }

  // Réordonnancement par glisser-déposer des sous-tâches (vue jour, cartes
  // Inbox/Backlog — subtaskListHTML est partagé) : la ligne ENTIÈRE est
  // draggable="true" (un grip seul serait trop fragile à saisir, cf.
  // .review-item) — déjà couverte par MARQUEE_EXCLUDE (générique sur
  // [draggable="true"]), donc pas de conflit avec le lasso. Survoler un
  // autre item de LA MÊME liste (même tâche, même profondeur — jamais
  // entre deux tâches ni entre un niveau et son sous-niveau, cf. dragList)
  // insère l'item glissé avant/après cette cible selon la moitié survolée
  // (`insertAfter`, calculée sur `clientY` — indispensable pour pouvoir
  // descendre d'UN cran : sans détection de moitié, déposer sur le voisin
  // immédiat suivant est un no-op, cf. `_reorderSubtask`). Survoler la zone
  // vide APRÈS le dernier item (padding, bouton "+") — écouteur posé sur
  // .subtask-list elle-même, atteint seulement quand aucun item ne
  // consomme l'event — équivaut à « fin de liste » (targetStid=null).
  // e.stopPropagation() systématique : .subtask-item vit à l'intérieur d'un
  // .todo-item lui-même draggable (délégation sur .day-columns dans
  // initDayDragDrop) — sans ça son dragstart bulle jusqu'à ce listener et
  // ferait démarrer le drag de toute la tâche parente à la place. Écouteurs
  // posés directement sur chaque item/liste (pas de délégation sur
  // .day-columns) : appelée après CHAQUE render(), les nœuds sont donc
  // toujours neufs.
  initSubtaskDragDrop(root) {
    let dragEl = null, dragList = null, activeTarget = null, insertAfter = false, activeZone = 'before';
    const clearTarget = () => { if (activeTarget) { activeTarget.classList.remove('drop-target-swap', 'drop-before', 'drop-after', 'drop-nest'); activeTarget = null; } };
    (root || document).querySelectorAll('.subtask-item[draggable]').forEach(item => {
      item.addEventListener('dragstart', e => {
        e.stopPropagation();
        dragEl = item;
        dragList = item.closest('.subtask-list');
        requestAnimationFrame(() => item.classList.add('dragging'));
      });
      item.addEventListener('dragend', e => {
        e.stopPropagation();
        item.classList.remove('dragging');
        clearTarget();
        dragEl = null; dragList = null;
      });
      item.addEventListener('dragover', e => {
        if (!dragEl || dragEl === item || item.closest('.subtask-list') !== dragList) return;
        e.preventDefault();
        e.stopPropagation();
        const r = item.getBoundingClientRect();
        // Profondeur 2 (.subtask-list--nested) : jamais de zone imbriquer,
        // un 3e niveau est interdit et aucun split ne peut le rescaper —
        // dégrade en 50/50 avant/après, comme avant cette fonctionnalité.
        const isNested = dragList.classList.contains('subtask-list--nested');
        activeZone = isNested ? (e.clientY > r.top + r.height / 2 ? 'after' : 'before') : dnDZone(e.clientY, r);
        insertAfter = activeZone === 'after';
        if (activeTarget !== item) { clearTarget(); activeTarget = item; item.classList.add('drop-target-swap'); }
        item.classList.toggle('drop-before', activeZone === 'before');
        item.classList.toggle('drop-after', activeZone === 'after');
        item.classList.toggle('drop-nest', activeZone === 'nest');
      });
      item.addEventListener('dragleave', e => {
        if (activeTarget === item && !item.contains(e.relatedTarget)) clearTarget();
      });
      item.addEventListener('drop', e => {
        if (!dragEl || dragEl === item || item.closest('.subtask-list') !== dragList) return;
        e.preventDefault();
        e.stopPropagation();
        clearTarget();
        const todoId = dragEl.dataset.todoId;
        const ds = dragEl.dataset.ds;
        const parentStid = dragEl.dataset.parentStid || null;
        if (activeZone === 'nest') { this.nestSubtaskUnderSibling(todoId, dragEl.dataset.stid, item.dataset.stid, ds); return; }
        this._reorderSubtask(todoId, dragEl.dataset.stid, item.dataset.stid, ds, parentStid, insertAfter);
      });
    });
    (root || document).querySelectorAll('.subtask-list').forEach(list => {
      list.addEventListener('dragover', e => {
        if (!dragEl || list !== dragList) return;
        e.preventDefault();
        e.stopPropagation();
        const items = [...list.querySelectorAll(':scope > .subtask-item')];
        const lastItem = items[items.length - 1];
        if (!lastItem || lastItem === dragEl) { clearTarget(); return; }
        insertAfter = true;
        if (activeTarget !== lastItem) { clearTarget(); activeTarget = lastItem; lastItem.classList.add('drop-target-swap'); }
        lastItem.classList.add('drop-after');
      });
      list.addEventListener('drop', e => {
        if (!dragEl || list !== dragList) return;
        e.preventDefault();
        e.stopPropagation();
        clearTarget();
        const todoId = dragEl.dataset.todoId;
        const parentStid = dragEl.dataset.parentStid || null;
        this._reorderSubtask(todoId, dragEl.dataset.stid, null, dragEl.dataset.ds, parentStid);
      });
    });

    // Sortir une sous-tâche du groupe par glisser-déposer : la lâcher
    // n'importe où dans .day-columns HORS de sa propre .subtask-list (dragEl
    // toujours actif, mais item.closest('.subtask-list') !== dragList dans
    // tous les handlers ci-dessus, qui `return` donc sans stopPropagation)
    // la fait redevenir une tâche indépendante (app.extractSubtask()),
    // positionnée là où elle a été lâchée — même langage que le dépôt d'une
    // tâche normale (avant/après un item voisin, en tête d'un moment/groupe
    // si lâchée sur son en-tête). Jamais de ré-imbrication sous un AUTRE
    // parent ici (hors scope de ce geste) : le survol d'un .todo-item
    // n'insère qu'avant/après, ne nest jamais. Écouteurs délégués sur
    // .day-columns (pas par item) — celui-ci est entièrement régénéré à
    // chaque render() donc pas de risque de doublon, mais un appel scopé
    // (root ciblé, sans passer par un render() complet) laisse le même nœud
    // en place : data-subtask-extract-bound évite d'empiler des écouteurs.
    const dayColumns = document.querySelector('.day-columns');
    if (dayColumns && !dayColumns.dataset.subtaskExtractBound) {
      dayColumns.dataset.subtaskExtractBound = '1';
      let extractTarget = null;
      const clearExtractTarget = () => {
        if (extractTarget?.el) extractTarget.el.classList.remove('drop-target-swap', 'drop-before', 'drop-after', 'drop-target');
        extractTarget = null;
      };
      dayColumns.addEventListener('dragover', e => {
        if (!dragEl || e.target.closest('.subtask-list') === dragList) return;
        e.preventDefault();
        e.stopPropagation();
        clearExtractTarget();
        const todoTarget = e.target.closest('.todo-item[draggable]');
        const groupHeaderTarget = !todoTarget && e.target.closest('.task-group-header');
        const heureLabel = !todoTarget && !groupHeaderTarget && e.target.closest('.day-heure-label[data-period]');
        const heureSection = !heureLabel && !todoTarget && !groupHeaderTarget && e.target.closest('.day-heure-section[data-period]');
        const heureTarget = heureLabel || heureSection;
        if (todoTarget) {
          const r = todoTarget.getBoundingClientRect();
          const before = e.clientY < r.top + r.height / 2;
          todoTarget.classList.add('drop-target-swap');
          todoTarget.classList.toggle('drop-before', before);
          todoTarget.classList.toggle('drop-after', !before);
          extractTarget = { kind: 'sibling', el: todoTarget, id: todoTarget.dataset.id, before, group: todoTarget.dataset.group };
        } else if (groupHeaderTarget) {
          const firstMember = state.todos.find(x => x.id === groupHeaderTarget.dataset.id);
          if (firstMember?.groupId) {
            groupHeaderTarget.classList.add('drop-target');
            const grp = groupHeaderTarget.dataset.group;
            const m = grp.match(/-(morning|afternoon|evening)$/);
            extractTarget = { kind: 'group', el: groupHeaderTarget, groupId: firstMember.groupId, groupTitle: firstMember.groupTitle || '', dayPeriodValue: m ? m[1] : '', sectionGroup: grp, firstMemberId: firstMember.id };
          }
        } else if (heureTarget) {
          const labelEl = heureLabel || heureTarget.querySelector('.day-heure-label') || heureTarget;
          labelEl.classList.add('drop-target');
          extractTarget = { kind: 'period', el: labelEl, dayPeriodValue: heureTarget.dataset.period };
        }
      });
      dayColumns.addEventListener('dragleave', e => {
        if (!dayColumns.contains(e.relatedTarget)) clearExtractTarget();
      });
      dayColumns.addEventListener('drop', e => {
        if (!dragEl || e.target.closest('.subtask-list') === dragList) return;
        e.preventDefault();
        e.stopPropagation();
        const todoId = dragEl.dataset.todoId;
        const stid = dragEl.dataset.stid;
        const ds = dragEl.dataset.ds;
        const parentStid = dragEl.dataset.parentStid || null;
        const target = extractTarget;
        clearExtractTarget();
        const extracted = this.extractSubtask(todoId, stid, ds, parentStid);
        if (!extracted || !target) return;
        // Cible ponctuelle seulement : une tâche extraite est toujours
        // non-récurrente, la positionner dans un groupe récurrent (daily/
        // weekly/…) ne voudrait rien dire (dropReorder() y filtre par
        // t.recurrence === recType, l'extraite n'y matcherait jamais).
        const isPunctGroup = g => g === 'punctual' || g?.startsWith('punctual-');
        if (target.kind === 'sibling' && isPunctGroup(target.group)) {
          const targetTask = state.todos.find(x => x.id === target.id);
          if (targetTask?.dayPeriod) extracted.dayPeriod = targetTask.dayPeriod; else delete extracted.dayPeriod;
          saveTodos(state.todos);
          this.dropReorder([extracted.id], target.group, target.id, target.before);
        } else if (target.kind === 'group') {
          extracted.groupId = target.groupId;
          if (target.groupTitle) extracted.groupTitle = target.groupTitle;
          if (target.dayPeriodValue === '') delete extracted.dayPeriod; else extracted.dayPeriod = target.dayPeriodValue;
          saveTodos(state.todos);
          this.dropReorder([extracted.id], target.sectionGroup, target.firstMemberId, true);
        } else if (target.kind === 'period') {
          if (target.dayPeriodValue === '') delete extracted.dayPeriod; else extracted.dayPeriod = target.dayPeriodValue;
          saveTodos(state.todos);
          this.render();
        }
      });
    }
  }

  // Sous-tâche déposée sur une autre : elle s'insère avant ou après la
  // cible selon `insertAfter` (moitié survolée) ; `targetStid` nul = fin de
  // liste (survol de la zone vide après le dernier item). `to` est calculé
  // sur les index AVANT retrait, donc décrémenté d'un cran si la source
  // était avant la cible (le splice de retrait a déjà décalé tout ce qui
  // suit) ; les deux no-op (`from===to` et `from===to-1`) couvrent les cas
  // où l'item est déjà exactement à la position visée (immédiatement avant/
  // après la cible), pour ne pas re-render inutilement.
  _reorderSubtask(todoId, stid, targetStid, ds, parentStid, insertAfter = false) {
    const t = state.todos.find(x => x.id === todoId);
    if (!t) return;
    const base = occurrenceSubtasks(t, ds);
    const arr = parentStid ? base.find(p => p.id === parentStid)?.subtasks : base;
    if (!arr) return;
    const from = arr.findIndex(x => x.id === stid);
    if (from < 0) return;
    let to;
    if (targetStid == null) {
      to = arr.length;
    } else {
      to = arr.findIndex(x => x.id === targetStid);
      if (to < 0) return;
      if (insertAfter) to++;
    }
    if (from === to || from === to - 1) return;
    snapshot(state.todos);
    const [item] = arr.splice(from, 1);
    if (from < to) to--;
    arr.splice(to, 0, item);
    t.updatedAt = Date.now();
    saveTodos(state.todos);
    this.render();
  }

  // Glisser-déposer en zone « imbriquer » entre deux sous-tâches SŒURS
  // (même .subtask-list, donc même profondeur — garanti par le garde-fou
  // de initSubtaskDragDrop en amont) : `stid` devient sous-tâche de
  // `targetStid`. Pas de multi-sélection (.subtask-item hors MS_SELECTABLE),
  // pas de confirm perte-de-champs (une sous-tâche n'a que id/title/
  // completed/subtasks, rien à perdre). needsSplit(1, source) : la cible
  // est déjà elle-même profondeur 1, donc toute source qui a ses propres
  // enfants dépasserait la limite — split (enfants promus, titre préfixé)
  // au lieu d'imbriquer telle quelle.
  nestSubtaskUnderSibling(todoId, stid, targetStid, ds) {
    const t = state.todos.find(x => x.id === todoId);
    if (!t || stid === targetStid) return false;
    const arr = occurrenceSubtasks(t, ds);
    if (!arr.length) return false;
    const fromIdx = arr.findIndex(x => x.id === stid);
    const target = arr.find(x => x.id === targetStid);
    if (fromIdx < 0 || !target) return false;
    const source = arr[fromIdx];

    const split = needsSplit(1, source);
    if (split && !confirm(_splitConfirmMsg([source], target))) return false;

    snapshot(state.todos);
    const entries = split ? splitIntoPromotedChildren(source)
      : [{ id: source.id, title: source.title, completed: !!source.completed,
           ...(source.subtasks?.length ? { subtasks: source.subtasks.map(c => ({ ...c })) } : {}) }];
    arr.splice(fromIdx, 1);
    if (!target.subtasks) target.subtasks = [];
    target.subtasks.push(...entries);
    t.updatedAt = Date.now();
    saveTodos(state.todos);
    this.render();
    return true;
  }

  // Menu contextuel (sous-tâche) « Sortir du groupe » : retire CETTE seule
  // (sous-)sous-tâche de sa liste et la fait redevenir une tâche indépendante
  // à part entière, sans toucher aux autres membres — contrairement à
  // convertTaskToGroup() qui convertit TOUTE la liste d'un coup. Hérite du
  // contexte de la tâche RACINE t (date/backlog/deadline, moment, heures,
  // priorité, tag/projet/intention — mêmes champs que addParentTask() /
  // convertTaskToGroup()), jamais celui du membre parent : une sous-tâche
  // parente est un simple item de checklist, elle n'a pas ces champs.
  // Fonctionne à n'importe quelle profondeur : extraire une sous-sous-tâche
  // saute directement au statut de tâche indépendante.
  extractSubtask(todoId, stid, ds, parentStid) {
    const t = state.todos.find(x => x.id === todoId);
    if (!t) return;
    const arr = occurrenceSubtasks(t, ds);
    const s = parentStid
      ? arr.find(p => p.id === parentStid)?.subtasks?.find(x => x.id === stid)
      : arr.find(x => x.id === stid);
    if (!s) return;
    snapshot(state.todos);
    if (parentStid) {
      const p = arr.find(x => x.id === parentStid);
      const i = p.subtasks.findIndex(x => x.id === stid);
      if (i > -1) p.subtasks.splice(i, 1);
    } else {
      const i = arr.findIndex(x => x.id === stid);
      if (i > -1) arr.splice(i, 1);
    }
    const nid = Date.now().toString();
    const isRec = t.recurrence && t.recurrence !== 'none';
    // Contexte hérité : valeurs EFFECTIVES de cette occurrence (résolues —
    // un dayPeriod/priorité surchargé aujourd'hui doit suivre la sous-tâche
    // extraite, pas la valeur du master).
    const ctx = resolveOccurrence(t, ds);
    const extracted = {
      id: nid,
      title: s.title,
      completed: s.completed,
      completedDates: [],
      date: isRec ? (ds || undefined) : t.date,
      updatedAt: parseInt(nid),
    };
    // Ses propres enfants (sous-sous-tâche extraite depuis la profondeur 1)
    // deviennent les subtasks de la nouvelle tâche indépendante — même
    // profondeur relative, jamais un niveau de trop.
    if (s.subtasks?.length) extracted.subtasks = JSON.parse(JSON.stringify(s.subtasks));
    if (t.backlog) extracted.backlog = true;
    if (t.deadline) extracted.deadline = t.deadline;
    if (ctx.dayPeriod) extracted.dayPeriod = ctx.dayPeriod;
    if (ctx.startTime) extracted.startTime = ctx.startTime;
    if (ctx.endTime) extracted.endTime = ctx.endTime;
    if (ctx.priority) extracted.priority = ctx.priority;
    if (ctx.categoryIds?.length) extracted.categoryIds = [...ctx.categoryIds];
    else if (ctx.categoryId) extracted.categoryId = ctx.categoryId;
    if (ctx.projectIds?.length) extracted.projectIds = [...ctx.projectIds];
    else if (ctx.projectId) extracted.projectId = ctx.projectId;
    if (ctx.intentionIds?.length) extracted.intentionIds = [...ctx.intentionIds];
    else if (ctx.intentionId) extracted.intentionId = ctx.intentionId;
    t.updatedAt = Date.now();
    const idx = state.todos.findIndex(x => x.id === todoId);
    state.todos.splice(idx + 1, 0, extracted);
    saveTodos(state.todos);
    this.render();
    return extracted;
  }

  addSubtaskInline(todoId, parentStid, ds) {
    const list = parentStid
      ? document.querySelector(`.subtask-list[data-parent-stid="${parentStid}"]`)
      : document.querySelector(`[data-id="${todoId}"] .subtask-list`);
    if (!list) return;
    // :scope > … cible le bouton de CE niveau — sans ça, une liste racine
    // dont une sous-tâche a déjà des enfants aurait trouvé le mini-bouton
    // de la liste IMBRIQUÉE en premier (1er match en ordre document), pas
    // le sien propre.
    const addBtn = list.querySelector(':scope > .subtask-add-mini-slot > .subtask-add-mini');
    if (!addBtn) return;
    // Masquer le SLOT entier (pas juste le bouton) : sinon, si la souris
    // survole encore la liste au moment du clic sur "+", .subtask-list:hover
    // le maintient déplié à 26px — un bloc vide et invisible juste au-dessus
    // de l'input, perçu comme un excès d'espace non désiré.
    const slot = addBtn.closest('.subtask-add-mini-slot');
    const input = document.createElement('input');
    input.className = 'subtask-new-input subtask-new-input--card';
    input.placeholder = 'Nouvelle sous-tâche…';
    input.autocomplete = 'off';
    let saved = false;
    // Liste injectée par ctxAddSubtask()/ctxAddNestedSubtask() pour un
    // parent sans enfant : si l'ajout est annulé sans rien créer, retirer
    // le bloc — mais SEULEMENT ce niveau (list.remove()) pour une liste
    // imbriquée : remonter à .closest('.subtask-collapse') retirerait TOUTES
    // les sous-tâches du niveau racine, pas seulement cette liste-ci.
    const cancel = () => {
      if (list.querySelector(':scope > .subtask-item')) { slot.style.display = ''; return; }
      if (parentStid) list.remove();
      else (list.closest('.subtask-collapse') || list).remove();
    };
    // reopen=true (Entrée) enchaîne directement sur un nouvel input pour la
    // sous-tâche suivante — ajout en rafale sans re-cliquer sur le "+" à
    // chaque fois. false (blur, ex. clic ailleurs) ne rouvre jamais : sinon
    // le nouvel input reprendrait le focus juste après le clic qui visait
    // à en sortir, rendant la liste impossible à quitter autrement qu'Échap.
    // andFocus=true (Alt+Entrée) : au lieu d'enchaîner, bascule directement
    // en mode Focus sur la sous-tâche tout juste créée (profondeur 1
    // seulement — le Focus ne cible jamais une sous-sous-tâche, cf. focus.js).
    const confirm = (reopen = false, andFocus = false) => {
      if (saved) return;
      saved = true;
      const title = input.value.trim();
      input.remove();
      if (title) {
        slot.style.display = '';
        const newSub = this._saveNewSubtask(todoId, title, parentStid, ds);
        if (andFocus && newSub && !parentStid) this.focusStartOn(todoId, DS(today()), newSub.id, { fallbackToEdit: false });
        else if (reopen) this.addSubtaskInline(todoId, parentStid, ds);
      } else {
        cancel();
      }
    };
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); confirm(!e.altKey, e.altKey); }
      if (e.key === 'Escape') { saved = true; input.remove(); cancel(); }
    });
    input.addEventListener('blur', () => confirm(false));
    slot.style.display = 'none';
    list.insertBefore(input, slot);
    // Micro avant le focus : attachMic({wrap}) détache brièvement l'input le
    // temps de l'envelopper, ce qui perdrait un focus déjà posé.
    attachMic(input, { wrap: true, compact: true });
    input.focus();
    autoStartDictation(input);
  }

  // Menu contextuel (sous-tâche) « Ajouter une sous-tâche » : même patch
  // ciblé que ctxAddSubtask, un niveau plus profond — injecte la liste
  // imbriquée si elle n'existe pas encore. Masqué au menu (cf.
  // _renderSubtaskCtxMenu) si la cible du clic droit est déjà elle-même
  // une sous-sous-tâche, donc jamais appelé avec un parentStid invalide.
  ctxAddNestedSubtask(todoId, parentStid, ds) {
    const rowEl = document.querySelector(`.subtask-item[data-stid="${parentStid}"]:not([data-parent-stid])`);
    if (!rowEl) return;
    if (!document.querySelector(`.subtask-list[data-parent-stid="${parentStid}"]`)) {
      rowEl.insertAdjacentHTML('afterend', subtaskListHTML([], todoId, ds, parentStid));
    }
    this.addSubtaskInline(todoId, parentStid, ds);
  }

  _saveNewSubtask(todoId, title, parentStid, ds) {
    const t = state.todos.find(x => x.id === todoId);
    if (!t) return null;
    const arr = occurrenceSubtasks(t, ds);
    snapshot(state.todos);
    const newSub = { id: Date.now().toString(), title, completed: false };
    if (parentStid) {
      const p = arr.find(x => x.id === parentStid);
      if (!p) return null;
      if (!p.subtasks) p.subtasks = [];
      p.subtasks.push(newSub);
    } else {
      arr.push(newSub);
    }
    t.updatedAt = Date.now();
    saveTodos(state.todos);
    this.render();
    return newSub;
  }

  editSubtaskTitle(el, todoId, stid, ds, parentStid) {
    // Même garde que editModalSubtask() (modal.js) : le span reste cliquable
    // pendant toute l'édition, sans quoi cliquer pour repositionner le
    // curseur relançait la sélection du mot entier à chaque fois.
    if (el.isContentEditable) return;
    const t = state.todos.find(x => x.id === todoId);
    if (!t) return;
    const arr = occurrenceSubtasks(t, ds);
    const s = this._findSubtask(arr, stid, parentStid);
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
        // Jamais esc() ici : textContent échappe déjà de lui-même, donc
        // esc() y écrirait « &gt; » comme texte VISIBLE, que la sauvegarde
        // suivante relirait tel quel dans s.title — puis esc() au rendu en
        // rajouterait une couche à chaque cycle (&amp;gt;, &amp;amp;gt;…)
        el.textContent = s.title;
      }
    };
    el.addEventListener('blur', save, { once: true });
    // Pas de { once: true } : voir le même commentaire dans editModalSubtask()
    // (modal.js) — ce listener doit survivre à la 1re frappe, sinon corriger
    // le titre avant d'appuyer sur Entrée le désarme, et Entrée retombe sur
    // le comportement par défaut du navigateur (saut de ligne inséré dans le
    // span). Shift+Entrée reste le seul moyen explicite de sauter une ligne.
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.blur(); }
      if (e.key === 'Escape') { el.textContent = s.title; el.contentEditable = 'false'; }
    });
  }

  // Estimation d'une sous-tâche (s.durationEstimated, optionnelle) : édition
  // en place, même pattern qu'editBacklogDeadline — le badge devient un
  // <input type=number>. Préremplit avec la valeur BRUTE uniquement (jamais
  // effectiveEstimate()/la somme calculée, sinon éditer sans rien changer
  // figerait silencieusement la somme comme valeur explicite du parent).
  editSubtaskEstimate(badgeEl, todoId, stid, ds, parentStid) {
    const t = state.todos.find(x => x.id === todoId);
    if (!t) return;
    const arr = occurrenceSubtasks(t, ds);
    const s = this._findSubtask(arr, stid, parentStid);
    if (!s || badgeEl.querySelector('input')) return;
    const prevHTML = badgeEl.innerHTML;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '1';
    input.step = '1';
    input.inputMode = 'numeric';
    input.className = 'subtask-estimate-input';
    if (s.durationEstimated) input.value = s.durationEstimated;
    input.addEventListener('click', e => e.stopPropagation());
    input.addEventListener('mousedown', e => e.stopPropagation());
    let settled = false;
    const restore = () => { badgeEl.innerHTML = prevHTML; };
    const confirm = () => {
      if (settled) return;
      settled = true;
      const raw = input.value.trim();
      const val = raw ? parseInt(raw, 10) : null;
      if (val !== (s.durationEstimated || null) && (val === null || val > 0)) {
        snapshot(state.todos);
        if (val) s.durationEstimated = val; else delete s.durationEstimated;
        t.updatedAt = Date.now();
        saveTodos(state.todos);
        this.render();
      } else {
        restore();
      }
    };
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); confirm(); }
      if (e.key === 'Escape') { settled = true; restore(); }
    });
    input.addEventListener('blur', confirm);
    badgeEl.innerHTML = '';
    badgeEl.appendChild(input);
    input.focus();
    input.select();
  }

  // ── Task grouping — commissions-style : tâche+sous-tâches ⇄ groupe de
  // tâches indépendantes reliées par groupId/groupTitle (pas de collection
  // séparée, juste une étiquette partagée — cf. CLAUDE.md) ────────────────

  // Convertit une tâche + ses sous-tâches en un groupe de tâches indépendantes
  // (date/moment/priorité/tag hérités du parent) ; la tâche parente disparaît,
  // chaque sous-tâche devient une vraie tâche à part entière.
  convertTaskToGroup(id) {
    const t = state.todos.find(x => x.id === id);
    if (!t || !t.subtasks?.length) return;
    snapshot(state.todos);
    const groupId = 'grp-' + Date.now().toString();
    const base = Date.now();
    const children = t.subtasks.map((s, i) => {
      const child = {
        id: String(base + i + 1),
        title: s.title,
        completed: s.completed,
        completedDates: [],
        date: t.date,
        groupId,
        groupTitle: t.title,
        updatedAt: base + i + 1,
      };
      // Les enfants d'une sous-tâche (sous-sous-tâche, un seul niveau
      // permis) deviennent tels quels les sous-tâches de la nouvelle tâche
      // indépendante — profondeur inchangée par rapport à s, jamais un
      // niveau de trop.
      if (s.subtasks?.length) child.subtasks = JSON.parse(JSON.stringify(s.subtasks));
      if (t.dayPeriod) child.dayPeriod = t.dayPeriod;
      if (t.priority) child.priority = t.priority;
      if (t.categoryIds?.length) child.categoryIds = [...t.categoryIds];
      else if (t.categoryId) child.categoryId = t.categoryId;
      if (t.projectIds?.length) child.projectIds = [...t.projectIds];
      else if (t.projectId) child.projectId = t.projectId;
      if (t.intentionIds?.length) child.intentionIds = [...t.intentionIds];
      else if (t.intentionId) child.intentionId = t.intentionId;
      return child;
    });
    const idx = state.todos.findIndex(x => x.id === id);
    state.todos.splice(idx, 1, ...children);
    saveTodos(state.todos);
    this.render();
  }

  // Inverse : réunit toutes les tâches partageant ce groupId en une seule
  // tâche + sous-tâches. Si les membres ont des dates différentes, elles
  // sont toutes réunies sur celle du 1er membre — confirmation demandée.
  convertGroupToTask(groupId) {
    const members = state.todos.filter(x => x.groupId === groupId);
    if (members.length < 2) return;
    const dates = new Set(members.map(m => m.date));
    if (dates.size > 1 && !confirm(`Ces tâches ont des dates différentes : elles seront toutes réunies sur ${members[0].date}. Continuer ?`)) return;
    snapshot(state.todos);
    const first = members[0];
    const parent = {
      id: Date.now().toString(),
      title: first.groupTitle || first.title,
      date: first.date,
      completed: false,
      completedDates: [],
      // Les propres sous-tâches de chaque membre (m.subtasks) deviennent
      // depth 1 sous la nouvelle tâche — mais si CES sous-tâches avaient
      // elles-mêmes des enfants, les garder créerait un 3e niveau (m était
      // une tâche autonome, m.subtasks était donc déjà son propre niveau 1) :
      // on aplatit cette éventuelle profondeur supplémentaire pour ne
      // jamais dépasser le seul niveau d'imbrication permis.
      subtasks: members.map(m => ({
        id: m.id,
        title: m.title,
        completed: !!m.completed,
        ...(m.subtasks?.length ? { subtasks: m.subtasks.map(s => ({ id: s.id, title: s.title, completed: !!s.completed })) } : {}),
      })),
      updatedAt: Date.now(),
    };
    if (first.dayPeriod) parent.dayPeriod = first.dayPeriod;
    if (first.priority) parent.priority = first.priority;
    if (first.categoryIds?.length) parent.categoryIds = [...first.categoryIds];
    else if (first.categoryId) parent.categoryId = first.categoryId;
    if (first.projectIds?.length) parent.projectIds = [...first.projectIds];
    else if (first.projectId) parent.projectId = first.projectId;
    if (first.intentionIds?.length) parent.intentionIds = [...first.intentionIds];
    else if (first.intentionId) parent.intentionId = first.intentionId;
    const memberIds = members.map(m => m.id);
    const remaining = state.todos.filter(x => !memberIds.includes(x.id));
    remaining.push(parent);
    state.setTodos(remaining);
    saveTodos(state.todos);
    this.render();
  }

  // Retire une seule tâche de son groupe (reste une tâche normale) sans
  // toucher aux autres membres. Si un seul membre reste après ce retrait,
  // il est aussi dégroupé — un groupe d'1 seul membre n'a pas de sens
  // (l'en-tête ne s'affiche que pour ≥2 membres, cf. todoListHTML()).
  ungroupTask(id) {
    const t = state.todos.find(x => x.id === id);
    if (!t?.groupId) return;
    const groupId = t.groupId;
    snapshot(state.todos);
    delete t.groupId;
    delete t.groupTitle;
    t.updatedAt = Date.now();
    const remaining = state.todos.filter(x => x.groupId === groupId);
    if (remaining.length === 1) {
      delete remaining[0].groupId;
      delete remaining[0].groupTitle;
      remaining[0].updatedAt = Date.now();
    }
    saveTodos(state.todos);
    this.render();
  }

  // Groupe une sélection de tâches existantes sous un chapeau commun
  // (menu contextuel multi-sélection → showGroupPrompt() demande le titre)
  groupTasks(ids, title) {
    const targets = state.todos.filter(t => ids.includes(t.id));
    if (targets.length < 2 || !title) return;
    snapshot(state.todos);
    const groupId = 'grp-' + Date.now().toString();
    targets.forEach(t => { t.groupId = groupId; t.groupTitle = title; t.updatedAt = Date.now(); });
    saveTodos(state.todos);
    msClear();
    this.render();
  }

  // Injecte un input inline dans la barre flottante de multi-sélection pour
  // nommer le nouveau groupe (jamais de prompt() natif, cf. patterns projet)
  showGroupPrompt(ids) {
    const bar = document.getElementById('multiSelectBar');
    if (!bar || bar.querySelector('.multi-select-group-input')) return;
    const input = document.createElement('input');
    input.className = 'multi-select-group-input';
    input.placeholder = 'Nom du groupe…';
    input.autocomplete = 'off';
    let saved = false;
    const confirmFn = () => {
      if (saved) return;
      saved = true;
      const title = input.value.trim();
      input.remove();
      if (title) this.groupTasks(ids, title);
    };
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); confirmFn(); }
      if (e.key === 'Escape') { saved = true; input.remove(); }
    });
    input.addEventListener('blur', confirmFn);
    bar.appendChild(input);
    input.focus();
  }

  // ── Actions du clic droit sur un .task-group-header lui-même (pas un
  // membre) — kind:'group-header' dans _ctxTarget, cf. _renderGroupHeaderCtxMenu
  // plus bas. Communes aux vues qui rendent un en-tête de groupe (jour en
  // tri Chrono, Backlog/Inbox en tri Manuel) puisqu'elles partagent la même
  // classe/structure DOM (todoListHTML() / renderGroupedItems()).

  // Supprime le groupe : dissout TOUS les membres d'un coup (contrairement à
  // ungroupTask(), qui n'en retire qu'un seul). Les tâches elles-mêmes ne
  // sont jamais touchées, seulement leur étiquette de groupe — symétrique de
  // « Créer un groupe ».
  dissolveGroup(groupId) {
    const members = state.todos.filter(x => x.groupId === groupId);
    if (!members.length) return;
    snapshot(state.todos);
    members.forEach(t => { delete t.groupId; delete t.groupTitle; t.updatedAt = Date.now(); });
    saveTodos(state.todos);
    this.render();
  }

  renameGroup(groupId, title) {
    if (!title) return;
    const members = state.todos.filter(x => x.groupId === groupId);
    if (!members.length) return;
    snapshot(state.todos);
    members.forEach(t => { t.groupTitle = title; t.updatedAt = Date.now(); });
    saveTodos(state.todos);
    this.render();
  }

  // Édition en place du titre de l'en-tête (input remplace le span le temps
  // de la saisie, restauré AVANT toute mutation — que ce soit un Entrée, un
  // blur ou une Échap — pour ne jamais laisser l'en-tête visuellement vide
  // si le champ est confirmé vide ou annulé).
  renameGroupPrompt(groupId) {
    const header = document.querySelector(`.task-group-header[data-group-id="${groupId}"]`);
    const titleEl = header?.querySelector('.task-group-title');
    if (!titleEl) return;
    const current = titleEl.textContent;
    const input = document.createElement('input');
    input.className = 'task-group-title-input';
    input.value = current;
    input.autocomplete = 'off';
    let done = false;
    const finish = commit => {
      if (done) return;
      done = true;
      const title = input.value.trim();
      input.replaceWith(titleEl);
      if (commit && title && title !== current) this.renameGroup(groupId, title);
    };
    input.addEventListener('keydown', e => {
      // Même garde que _inlineInput() : sans stopPropagation, taper "d"/"w"/
      // "m"/"y"/"t"/"n"/"f" ici bubble jusqu'aux raccourcis globaux sans
      // touche modificatrice et change de vue en pleine saisie du nom.
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      if (e.key === 'Escape') finish(false);
    });
    input.addEventListener('blur', () => finish(true));
    titleEl.replaceWith(input);
    input.focus();
    input.select();
  }

  // Nouvelle tâche qui rejoint directement ce groupe, héritant du contexte
  // d'un membre existant (date/backlog/moment/priorité/tag) — générique à
  // toutes les vues où un en-tête peut apparaître (jour, Backlog, Inbox),
  // contrairement à _addSectionTaskInline() qui est scopée à la colonne
  // Ponctuelle du jour. Rafale comme les autres saisies inline : Entrée sur
  // un titre non vide enchaîne aussitôt sur un nouveau champ.
  addTaskToGroup(groupId) {
    const ref = state.todos.find(x => x.groupId === groupId);
    const header = document.querySelector(`.task-group-header[data-group-id="${groupId}"]`);
    if (!ref || !header) return;
    this._inlineInput(`Tâche dans « ${ref.groupTitle || ''} »…`, (title, viaEnter) => {
      snapshot(state.todos);
      const data = { title, groupId, groupTitle: ref.groupTitle, recurrence: 'none' };
      if (ref.backlog) data.backlog = true; else if (ref.date) data.date = ref.date;
      if (ref.dayPeriod) data.dayPeriod = ref.dayPeriod;
      if (ref.priority) data.priority = ref.priority;
      if (ref.categoryIds?.length) data.categoryIds = [...ref.categoryIds];
      else if (ref.categoryId) data.categoryId = ref.categoryId;
      if (ref.projectIds?.length) data.projectIds = [...ref.projectIds];
      else if (ref.projectId) data.projectId = ref.projectId;
      if (ref.intentionIds?.length) data.intentionIds = [...ref.intentionIds];
      else if (ref.intentionId) data.intentionId = ref.intentionId;
      addTask(data, state.todos);
      saveTodos(state.todos);
      this.render();
      if (viaEnter) this.addTaskToGroup(groupId);
    }, el => header.after(el));
  }

  // Clone TOUS les membres du groupe d'un coup, reliés par un groupId neuf
  // (groupe indépendant) — mêmes règles que duplicateMany() (reset complété/
  // sous-tâches/compteur), chaque clone inséré juste après son original.
  duplicateGroup(groupId) {
    const members = state.todos.filter(x => x.groupId === groupId);
    if (!members.length) return;
    snapshot(state.todos);
    const base = Date.now();
    const newGroupId = 'grp-' + base;
    members.forEach((t, i) => {
      const cloneId = String(base + i);
      const clone = { ...JSON.parse(JSON.stringify(t)), id: cloneId, completed: false, completedDates: [], groupId: newGroupId, updatedAt: base + i };
      delete clone.overrides;
      if (clone.counterEnabled) clone.countCurrent = clone.countFrom ?? 0;
      if (Array.isArray(clone.subtasks)) clone.subtasks = clone.subtasks.map(s => ({ ...s, completed: false, ...(s.subtasks?.length ? { subtasks: s.subtasks.map(ss => ({ ...ss, completed: false })) } : {}) }));
      const idx = state.todos.findIndex(x => x.id === t.id);
      state.todos.splice(idx + 1, 0, clone);
    });
    saveTodos(state.todos);
    this.render();
  }

  // Détache `t` de son groupe si ce déplacement le retire d'un contexte
  // partagé avec les autres membres (nouvelle date/backlog/moment) — sauf si
  // TOUS les membres du groupe bougent ensemble dans la même opération
  // (`movingIds`), auquel cas le groupe entier se déplace d'un bloc et reste
  // groupé. Symétrique du geste « Sortir une sous-tâche du groupe » déjà
  // existant (extractSubtask via drag), appliqué ici aux groupes de tâches :
  // glisser un membre hors de son contexte actuel l'en détache pour de bon
  // (là où l'ancien comportement gardait un groupId périmé « prêt à se
  // regrouper »). Ne s'applique qu'aux tâches non récurrentes en pratique
  // (seules elles portent un groupId significatif au niveau racine).
  _leaveGroupUnlessWhole(t, movingIds) {
    if (!t?.groupId) return;
    const members = state.todos.filter(x => x.groupId === t.groupId);
    if (members.every(m => movingIds.includes(m.id))) return;
    delete t.groupId;
    delete t.groupTitle;
    t.updatedAt = Date.now();
  }

  // ── Modal subtask delegates (called via window.app from modal HTML) ────────
  toggleModalSubtask(stid, parentStid)    { toggleModalSubtask(stid, parentStid); }
  removeModalSubtask(stid, parentStid)    { removeModalSubtask(stid, parentStid); }
  addModalSubtaskInline(parentStid)       { addModalSubtaskInline(parentStid); }
  editModalSubtask(el, stid, parentStid)  { editModalSubtask(el, stid, parentStid); }
  editModalSubtaskEstimate(badgeEl, stid, parentStid) { editModalSubtaskEstimate(badgeEl, stid, parentStid); }

  // ── Modal deadline delegates (called via window.app from modal HTML) ──
  setDeadlineQuick(kind)  { setDeadlineQuick(kind); }
  setDeadlineHard(hard)   { setDeadlineHard(hard); }
  stepDeadlineLead(plus)  { stepDeadlineLead(plus); }

  // ── Modal link delegates (called via window.app from modal HTML) ───────
  addModalLinkInline()          { addModalLinkInline(); }
  updateModalLink(idx, value)   { updateModalLink(idx, value); }
  normalizeModalLink(idx)       { normalizeModalLink(idx); }
  removeModalLink(idx)          { removeModalLink(idx); }

  _trackDeletion(id) {
    const dels = safeParseJSON(localStorage.getItem('_deletions'), {});
    dels[id] = Date.now();
    localStorage.setItem('_deletions', JSON.stringify(_pruneDeletions(dels)));
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
    // Exclusion .task-group-header : voir _showSubtaskWarning() — même
    // data-id partagé pour une tâche seule dans son groupe.
    const item = document.querySelector(`[data-id="${id}"]:not(.task-group-header):not(.day-spacer)`);
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
    // Sans date explicite : le jour actuellement affiché, pas aujourd'hui
    const d = date || state.navDate || today();
    openModal(d, state.todos);
    const dateStr = typeof d === 'string' ? d : DS(d);
    history.replaceState({ view: state.view, nav: DS(state.navDate) }, '', this._buildHash({ modal: 'add', date: dateStr }));
  }

  openModalForInbox() {
    openModal(state.navDate, state.todos, 'inbox');
  }

  // « + » du header Quotidien (vue jour) : même modal que le « + » Ajouter
  // une tâche, mais bascule directement sur le grand mode « Récurrent »
  // (comme un clic sur ce bouton) — selectBigMode('recurring') active aussi
  // le sous-choix Quotidien/Hebdo/Mensuel/Annuel (recSubOptions, masqué par
  // défaut) et pré-sélectionne Quotidien puisque selectedRecurrence vient
  // d'être remis à 'none' par openModal(). Appeler selectRecurrence('daily')
  // seul ne suffit pas : le bouton « Date » du grand mode restait actif à
  // l'écran et le sous-menu recSubOptions restait caché, donc rien ne
  // montrait visuellement que la récurrence était sur Quotidien.
  addDailyTask() {
    this.openModal();
    this.selectBigMode('recurring');
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
    // Subtasks added/edited before an Escape/backdrop close were already
    // persisted live — refresh the background view so it reflects them.
    if (consumeModalSubtasksDirty()) this.render();
  }

  deleteFromEditModal() {
    const btn = document.getElementById('deleteFromEditBtn');
    if (!btn) return;
    const id = btn.dataset.id;
    const dateStr = btn.dataset.date || null;
    closeModal();
    setTimeout(() => this.deleteTodo(id, dateStr), 250);
  }

  cancelFromEditModal() {
    const btn = document.getElementById('cancelTaskFromEditBtn');
    if (!btn) return;
    const id = btn.dataset.id;
    const dateStr = btn.dataset.date || null;
    closeModal();
    setTimeout(() => this.cancelTodo(id, dateStr), 250);
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
        if (!menu.contains(e.target) && e.target.id !== 'completeMenuToggle') {
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

  // ── Debug panel (Supabase / localStorage status, near the version label) ──
  _initDebugPanel() {
    this._updateDebugPanel();
    setInterval(() => this._updateDebugPanel(), 3000);
  }

  _updateDebugPanel() {
    const { cloudState, localState } = getDebugStatus();
    const cloud = document.getElementById('debugIconCloud');
    const local = document.getElementById('debugIconLocal');
    if (cloud) cloud.setAttribute('class', `debug-icon debug-icon-cloud debug-icon--${cloudState}`);
    if (local) local.setAttribute('class', `debug-icon debug-icon-local debug-icon--${localState}`);
    const drawer = document.getElementById('debugDrawer');
    if (drawer && drawer.classList.contains('open')) drawer.innerHTML = renderDebugDrawerHTML();

    // Glanceable connection dots in the header (logo avatar + mobile user
    // button) — same cloudState the debug drawer already computes, just
    // surfaced where it's actually visible instead of buried in a drawer.
    const dotLogo   = document.getElementById('connDot');
    const dotMobile = document.getElementById('connDotMobile');
    if (dotLogo)   dotLogo.className   = `conn-dot conn-dot--${cloudState}`;
    if (dotMobile) dotMobile.className = `conn-dot conn-dot--${cloudState}`;
    const statusLabel = cloudState === 'ok' ? 'Connecté' : cloudState === 'warn' ? 'Synchro en attente' : 'Hors ligne';
    const title = document.querySelector('.app-title');
    if (title) title.title = `Mon compte — ${statusLabel}`;

    this._renderHmAccount(cloudState);
  }

  // Hamburger menu "Compte" row — status dot + label always current, plus a
  // one-click "Se déconnecter" item (only shown for a real logged-in user;
  // signing out of a guest session doesn't make sense).
  _renderHmAccount(cloudState) {
    const label     = document.getElementById('hmAccountLabel');
    const dot       = document.getElementById('hmAccountDot');
    const signOutEl = document.getElementById('hmSignOutItem');
    if (!label) return;
    if (!cloudState) cloudState = getDebugStatus().cloudState;
    const user  = getCurrentUser();
    const guest = isGuest() || !user;
    const uname = user ? (user.displayName || (!guest ? user.email?.split('@')[0] : '') || '') : '';
    label.textContent = guest ? 'Invité — se connecter' : (uname || user.email || 'Mon compte');
    if (dot) dot.className = `debug-dot debug-dot--${cloudState}`;
    if (signOutEl) signOutEl.classList.toggle('hidden', guest);
  }

  toggleDebugPanel() {
    const drawer = document.getElementById('debugDrawer');
    const trigger = document.getElementById('debugTrigger');
    if (!drawer) return;
    const opening = !drawer.classList.contains('open');
    drawer.classList.toggle('open', opening);
    if (trigger) trigger.classList.toggle('debug-open', opening);
    if (opening) drawer.innerHTML = renderDebugDrawerHTML();
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

    const countersCount = state.todos.filter(t => t.counterEnabled && t.countTo !== undefined).length;
    const countersBadge = document.getElementById('countersBadge');
    if (countersBadge) { countersBadge.textContent = countersCount; countersBadge.classList.toggle('hidden', countersCount === 0); }

    const todayStr = DS(today());
    const overdueCount = state.todos.filter(t =>
      t.date && t.date < todayStr &&
      !t.completed && !t.cancelled &&
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
    this._leaveGroupUnlessWhole(t, [id]);
    saveTodos(state.todos);
    this.render();
  }

  assignInboxToDate(id, dateStr, event) {
    this._assignManyToDate(this._dropIds(id), dateStr, event);
  }

  _assignManyToDate(ids, dateStr, event) {
    const targets = state.todos.filter(t => ids.includes(t.id) && (!t.recurrence || t.recurrence === 'none'));
    if (!targets.length) return;
    snapshot(state.todos);
    const isCopy = this._isCopyDrag(event);
    targets.forEach(t => {
      if (isCopy) this._insertClone(t, { date: dateStr, backlog: false });
      else { t.date = dateStr; t.backlog = false; t.updatedAt = Date.now(); this._leaveGroupUnlessWhole(t, ids); }
    });
    saveTodos(state.todos);
    if (ids.length > 1) msClear();
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

  // Préférences d'affichage (tri, colonnes) du Backlog/Inbox — mirrors
  // focusSetQueueView. Synchronisées entre appareils (getAppConfig()).
  setListQueueView(view, key, val) {
    const p = getListPrefs(view);
    p[key] = val;
    saveListPrefs(view, p);
    this._saveConfigChange();
    this.render();
  }

  // Drag-and-drop de réordonnancement manuel du Backlog/Inbox — actif
  // seulement en tri Manuel + 1 colonne (au-delà, le calcul de position
  // par curseur Y n'a pas de sens en grille, même garde-fou que la file
  // « Ensuite » du Focus). N'attache jamais de handler 'drop' sur la
  // liste : le drag-and-drop existant vers les onglets du header
  // (planDragStart, déjà posé en inline sur .inbox-item) continue de
  // fonctionner sans collision — ces listeners s'ajoutent en plus,
  // jamais à la place.
  initQueueListDnD(view) {
    const prefs = getListPrefs(view);
    if (prefs.sort !== 'manual' || prefs.cols !== '1') return;
    const list = document.getElementById(view === 'backlog' ? 'backlogList' : 'inboxList');
    if (!list) return;
    let dragEl = null, dragOrigId = null, origParent = null, origNext = null;
    let nestTargetEl = null, nestTargetId = null; // zone « imbriquer » survolée (voir dragover plus bas)
    // Copie (Alt/Ctrl/Cmd maintenu) : un placeholder dédié se déplace dans
    // la liste pendant le survol à la place de l'item réel, qui lui reste
    // visuellement à sa position d'origine tant que le drop ne confirme pas
    // une copie — vérifié à CHAQUE dragover (pas figé au dragstart), donc la
    // touche peut être pressée/relâchée en cours de geste, comme ailleurs.
    const ghost = document.createElement('div');
    ghost.className = 'inbox-item inbox-copy-ghost';
    ghost.textContent = '+ copie';
    list.querySelectorAll('.inbox-item').forEach(item => {
      item.addEventListener('dragstart', () => {
        dragEl = item;
        dragOrigId = item.dataset.id;
        origParent = item.parentNode;
        origNext = item.nextSibling;
        item.classList.add('dragging');
      });
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        if (nestTargetId) {
          const targetId = nestTargetId, ids = this._dropIds(dragOrigId);
          nestTargetEl?.classList.remove('drop-nest');
          nestTargetEl = null; nestTargetId = null;
          dragEl = null; dragOrigId = null; origParent = null; origNext = null;
          this.nestTaskAsSubtask(ids, targetId);
          return;
        }
        if (!dragOrigId) { ghost.remove(); return; }
        const isCopy = !!ghost.parentNode;
        // Backlog/Inbox n'a pas de drag de groupe entier (pas de draggable sur
        // .task-group-header, cf. renderGroupedItems) : toute tâche glissée ici
        // est donc forcément un membre isolé — elle quitte son groupe dès
        // qu'elle est repositionnée, comme en vue jour (_leaveGroupUnlessWhole).
        if (isCopy) {
          const t = state.todos.find(x => x.id === dragOrigId);
          if (t) {
            snapshot(state.todos);
            const clone = this._insertClone(t);
            this._leaveGroupUnlessWhole(clone, [clone.id]);
            // Le placeholder prend l'id du clone : sa position dans le DOM
            // (celle du drop) devient directement l'ordre final à persister.
            ghost.dataset.id = clone.id;
            const ids = [...list.querySelectorAll('.inbox-item')].map(el => el.dataset.id);
            ghost.remove();
            saveManualOrder(view, ids);
            saveTodos(state.todos);
          } else {
            ghost.remove();
          }
        } else {
          const t = state.todos.find(x => x.id === dragOrigId);
          const ids = [...list.querySelectorAll('.inbox-item')].map(el => el.dataset.id);
          saveManualOrder(view, ids);
          if (t?.groupId) { this._leaveGroupUnlessWhole(t, [dragOrigId]); saveTodos(state.todos); }
        }
        dragEl = null; dragOrigId = null; origParent = null; origNext = null;
        this._saveConfigChange();
        this.render();
      });
    });
    list.addEventListener('dragover', e => {
      if (!dragEl) return;
      e.preventDefault();
      const isCopy = this._isCopyDrag(e);
      e.dataTransfer.dropEffect = isCopy ? 'copy' : 'move';
      // Zone « imbriquer » : survoler le centre d'un item (hors copie) gèle
      // le repositionnement DOM habituel — la cible est simplement mise en
      // surbrillance, la mutation réelle se décide à dragend (ci-dessus).
      const hovered = e.target.closest('.inbox-item[data-id]');
      const dropIds = this._dropIds(dragOrigId);
      const eligible = !isCopy && hovered && hovered !== dragEl
        && !hovered.classList.contains('inbox-copy-ghost') && !dropIds.includes(hovered.dataset.id);
      const zone = eligible ? dnDZone(e.clientY, hovered.getBoundingClientRect()) : null;
      if (zone === 'nest') {
        if (nestTargetEl && nestTargetEl !== hovered) nestTargetEl.classList.remove('drop-nest');
        nestTargetEl = hovered; nestTargetId = hovered.dataset.id;
        hovered.classList.add('drop-nest');
        return;
      }
      if (nestTargetEl) { nestTargetEl.classList.remove('drop-nest'); nestTargetEl = null; nestTargetId = null; }
      if (isCopy) {
        if (dragEl.parentNode !== origParent || dragEl.nextSibling !== origNext) {
          origParent.insertBefore(dragEl, origNext);
        }
      } else if (ghost.parentNode) {
        ghost.remove();
      }
      const movingEl = isCopy ? ghost : dragEl;
      const items = [...list.querySelectorAll('.inbox-item:not(.dragging):not(.inbox-copy-ghost)')];
      const after = items.find(el => {
        const r = el.getBoundingClientRect();
        return e.clientY < r.top + r.height / 2;
      });
      list.insertBefore(movingEl, after || null);
    });
  }

  // Échéance d'un item de backlog (t.deadline, optionnelle — distincte de
  // t.date, que les tâches en backlog n'ont pas) : édition en place, même
  // pattern que _editEstimateLabel — le libellé du badge devient un
  // <input type=date>, jamais un champ ailleurs sur la ligne.
  editBacklogDeadline(badgeEl, id) {
    const t = state.todos.find(x => x.id === id);
    const label = badgeEl.querySelector('.backlog-deadline-label');
    if (!t || !label || label.querySelector('input')) return;
    const prevHTML = label.innerHTML;
    const input = document.createElement('input');
    input.type = 'date';
    input.className = 'backlog-deadline-input';
    if (t.deadline) input.value = t.deadline;
    input.addEventListener('click', e => e.stopPropagation());
    input.addEventListener('mousedown', e => e.stopPropagation());
    let settled = false;
    const restore = () => { label.innerHTML = prevHTML; };
    const confirm = () => {
      if (settled) return;
      settled = true;
      const val = input.value;
      if (val !== (t.deadline || '')) {
        snapshot(state.todos);
        if (val) {
          t.deadline = val;
        } else {
          // Retirer l'échéance retire aussi ses réglages : les laisser
          // traîner les ferait ressurgir sur une échéance posée plus tard
          delete t.deadline; delete t.deadlineTime;
          delete t.deadlineHard; delete t.deadlineLeadDays;
        }
        t.updatedAt = Date.now();
        saveTodos(state.todos);
        this.render();
      } else {
        restore();
      }
    };
    input.addEventListener('change', confirm);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); confirm(); }
      if (e.key === 'Escape') { settled = true; restore(); }
    });
    input.addEventListener('blur', confirm);
    label.innerHTML = '';
    label.appendChild(input);
    input.focus();
    input.showPicker?.();
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

  toggleCatSection(key) { toggleCatSection(key); }

  // andFocus (raccourci Alt+Entrée) : sauve puis bascule directement en mode
  // Focus sur la tâche (nouvelle ou éditée) — id capturé avant closeModal()
  // qui remet state.editingId à null. fallbackToEdit:false pour ne jamais
  // rouvrir le modal qu'on vient de fermer si la tâche n'a pas d'occurrence
  // aujourd'hui (ex. créée dans le backlog/inbox ou datée dans le futur).
  saveTask(andFocus = false) {
    const before = JSON.parse(JSON.stringify(state.todos));
    const hadError = saveTaskLogic(state.todos);
    if (!hadError) {
      const newId = state.editingId || state.todos[state.todos.length - 1].id;
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
      if (andFocus) this.focusStartOn(newId, DS(today()), null, { fallbackToEdit: false });
    }
  }

  // ═══════════════════════════════════════════════════
  // QUICK INSERT — raccourci 'n' : ajout ultra-rapide (titre seul, jour
  // affiché, sans récurrence) sans ouvrir la modale complète. La modale
  // reste accessible via le bouton rond +/clic droit pour un ajout détaillé.
  // ═══════════════════════════════════════════════════
  openQuickInsert() {
    if (document.querySelector('.modal-overlay:not(.hidden)')) return;
    const overlay = document.getElementById('quickInsertOverlay');
    const input = document.getElementById('quickInsertInput');
    if (!overlay || !input) return;
    overlay.classList.remove('hidden');
    input.value = '';
    input.focus();
    autoStartDictation(input); // champ toujours vierge à l'ouverture — même convention que openModal()
  }

  closeQuickInsert() {
    const overlay = document.getElementById('quickInsertOverlay');
    if (!overlay || overlay.classList.contains('hidden')) return;
    stopDictation();
    const input = document.getElementById('quickInsertInput');
    if (input) input.value = ''; // vide avant le blur() pour que confirmQuickInsert() ne crée rien en double
    overlay.classList.add('hidden');
    input?.blur();
  }

  // Entrée et blur font tous deux la même chose : créer (si un titre a été
  // saisi/dicté) puis fermer. Pas de rafale — Entrée referme le champ plutôt
  // que d'en réarmer un nouveau (qui relancerait la dictée automatique à
  // chaque tâche, donc un bip Chrome à la suite).
  confirmQuickInsert() {
    const input = document.getElementById('quickInsertInput');
    const title = input?.value.trim();
    if (title) {
      snapshot(state.todos);
      addTask({ title, date: DS(state.navDate), recurrence: 'none' }, state.todos);
      saveTodos(state.todos);
      this.render();
    }
    this.closeQuickInsert();
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
    if (clone.counterEnabled) clone.countCurrent = clone.countFrom ?? 0;
    if (Array.isArray(clone.subtasks)) clone.subtasks = clone.subtasks.map(s => ({ ...s, completed: false, ...(s.subtasks?.length ? { subtasks: s.subtasks.map(ss => ({ ...ss, completed: false })) } : {}) }));
    const idx = state.todos.findIndex(x => x.id === id);
    state.todos.splice(idx + 1, 0, clone);
    saveTodos(state.todos);
    this.render();
  }

  showTodoMenu(e, id, ds) {
    _showTodoCtxMenu(e.currentTarget, id, ds);
  }

  // Badge lien (.todo-links-badge, vue jour) : todo.links est déjà résolu
  // par occurrence au rendu, mais on relit ici via resolveOccurrence (id+ds)
  // plutôt que de faire transiter les URLs à travers l'attribut onclick —
  // même convention que editEstimateBadge()/_editEstimateLabel(). Un seul
  // lien s'ouvre directement ; plusieurs ouvrent le petit menu dédié.
  handleLinksBadgeClick(e, id) {
    const t = state.todos.find(x => x.id === id);
    if (!t) return;
    const ds = e.currentTarget.closest('[data-date]')?.dataset.date;
    const links = (resolveOccurrence(t, ds).links || []).filter(Boolean);
    if (!links.length) return;
    if (links.length === 1) { window.open(links[0], '_blank', 'noopener'); return; }
    _toggleLinksMenu(e.currentTarget, links);
  }

  // ── Actions de lot (menu contextuel, sélection simple ou multiple) ──────
  // Résout l'occurrence de chaque id : la date affichée de l'élément
  // (data-date), sinon la date propre de la tâche — jamais navDate.
  // « Compléter » vaut donc toujours pour la date du jour de la tâche.
  _resolveOccurrences(ids) {
    return ids.map(id => {
      const t = state.todos.find(x => x.id === id);
      if (!t) return null;
      const el = document.querySelector(`[data-id="${id}"][data-date]`);
      return { t, ds: el?.dataset.date || t.date || null };
    }).filter(Boolean);
  }

  _isDoneAt(t, ds) {
    if (t.recurrence && t.recurrence !== 'none') return !!ds && (t.completedDates || []).includes(ds);
    return !!t.completed;
  }

  _isCancelledAt(t, ds) {
    if (t.recurrence && t.recurrence !== 'none') return !!ds && (t.cancelledDates || []).includes(ds);
    return !!t.cancelled;
  }

  // Toggle annulée/restaurée sur une occurrence (checkbox ✕, modal édition)
  cancelTodo(id, ds) {
    const t = state.todos.find(x => x.id === id);
    if (!t) return;
    snapshot(state.todos);
    cancelTodo(id, ds ? parseDS(ds) : (t.date ? parseDS(t.date) : today()), state.todos);
    saveTodos(state.todos);
    this.render();
  }

  // Toggle de lot : si tout le lot est déjà annulé → restaure, sinon annule tout
  cancelMany(ids) {
    const occ = this._resolveOccurrences(ids);
    if (!occ.length) return;
    const allCancelled = occ.every(({ t, ds }) => this._isCancelledAt(t, ds));
    snapshot(state.todos);
    occ.forEach(({ t, ds }) => {
      if (t.recurrence && t.recurrence !== 'none') {
        if (!ds) return;
        t.cancelledDates = t.cancelledDates || [];
        if (allCancelled) t.cancelledDates = t.cancelledDates.filter(x => x !== ds);
        else if (!t.cancelledDates.includes(ds)) {
          t.cancelledDates.push(ds);
          t.completedDates = (t.completedDates || []).filter(x => x !== ds);
        }
      } else {
        t.cancelled = !allCancelled;
        if (t.cancelled) t.completed = false;
      }
      t.updatedAt = Date.now();
    });
    saveTodos(state.todos);
    if (ids.length > 1) msClear();
    this.render();
  }

  // Toggle : si tout le lot est déjà complété → décomplète, sinon complète tout
  completeMany(ids) {
    const occ = this._resolveOccurrences(ids);
    if (!occ.length) return;
    const allDone = occ.every(({ t, ds }) => this._isDoneAt(t, ds));
    snapshot(state.todos);
    occ.forEach(({ t, ds }) => {
      if (t.recurrence && t.recurrence !== 'none') {
        if (!ds) return;
        t.completedDates = t.completedDates || [];
        if (allDone) t.completedDates = t.completedDates.filter(x => x !== ds);
        else if (!t.completedDates.includes(ds)) {
          t.completedDates.push(ds);
          t.cancelledDates = (t.cancelledDates || []).filter(x => x !== ds);
        }
      } else {
        t.completed = !allDone;
        if (t.completed) t.cancelled = false;
      }
      t.updatedAt = Date.now();
    });
    saveTodos(state.todos);
    if (!allDone) celebrate(state.lang);
    if (ids.length > 1) msClear();
    this.render();
  }

  duplicateMany(ids) {
    const occ = this._resolveOccurrences(ids);
    if (!occ.length) return;
    snapshot(state.todos);
    const base = Date.now();
    occ.forEach(({ t, ds }, i) => {
      const cloneId = String(base + i); // base+i : Date.now() en boucle collisionne
      // resolveOccurrence() : on duplique ce qui est EFFECTIVEMENT affiché
      // pour cette occurrence (override du jour compris), pas forcément le
      // master — puis on retire `overrides`, propre à l'ancienne série, pour
      // que le clone démarre sans aucun override hérité.
      const clone = { ...JSON.parse(JSON.stringify(resolveOccurrence(t, ds))), id: cloneId, completed: false, completedDates: [], updatedAt: base + i };
      delete clone.overrides;
      if (clone.recurrence && clone.recurrence !== 'none') {
        if (ds) clone.startDate = ds;
        delete clone.endDate;
        delete clone.excludedDates;
      } else if (ds) {
        clone.date = ds;
      }
      if (clone.counterEnabled) clone.countCurrent = clone.countFrom ?? 0;
      if (Array.isArray(clone.subtasks)) clone.subtasks = clone.subtasks.map(s => ({ ...s, completed: false, ...(s.subtasks?.length ? { subtasks: s.subtasks.map(ss => ({ ...ss, completed: false })) } : {}) }));
      const idx = state.todos.findIndex(x => x.id === t.id);
      state.todos.splice(idx + 1, 0, clone);
    });
    saveTodos(state.todos);
    if (ids.length > 1) msClear();
    this.render();
  }

  // Suppression de lot : ponctuelles retirées, récurrentes → seule
  // l'occurrence sélectionnée est exclue (pas de modal en mode groupe)
  deleteMany(ids) {
    const occ = this._resolveOccurrences(ids);
    if (!occ.length) return;
    snapshot(state.todos);
    const removeIds = [];
    occ.forEach(({ t, ds }) => {
      if (!t.recurrence || t.recurrence === 'none') {
        this._trackDeletion(t.id);
        removeIds.push(t.id);
      } else if (ds) {
        t.excludedDates = t.excludedDates || [];
        if (!t.excludedDates.includes(ds)) t.excludedDates.push(ds);
        t.updatedAt = Date.now();
      }
    });
    if (removeIds.length) state.setTodos(state.todos.filter(x => !removeIds.includes(x.id)));
    saveTodos(state.todos);
    msClear();
    this.render();
  }

  // _resolveOccurrences() (pas un simple state.todos.filter) : une tâche
  // récurrente n'écrit que dans l'override de SON occurrence affichée —
  // les autres jours ne sont jamais impactés.
  setPriorityMany(ids, prio) {
    const occ = this._resolveOccurrences(ids);
    if (!occ.length) return;
    snapshot(state.todos);
    occ.forEach(({ t, ds }) => { setOccurrenceField(t, ds, 'priority', prio || null); t.updatedAt = Date.now(); });
    saveTodos(state.todos);
    this.render(); // la sélection est conservée (action modifiante, pas de déplacement)
  }

  // '' → sans moment : delete plutôt que '' (toute valeur hors
  // morning/afternoon/evening/absent rend la tâche invisible en vue jour — cf. state.js)
  setDayPeriodMany(ids, period) {
    const occ = this._resolveOccurrences(ids);
    if (!occ.length) return;
    snapshot(state.todos);
    occ.forEach(({ t, ds }) => {
      // Détacher seulement si le moment change réellement (sinon un simple
      // clic sur le moment déjà actif détacherait à tort un membre groupé,
      // cf. _leaveGroupUnlessWhole).
      const changed = (resolveOccurrence(t, ds).dayPeriod || '') !== (period || '');
      setOccurrenceField(t, ds, 'dayPeriod', period || null);
      t.updatedAt = Date.now();
      if (changed) this._leaveGroupUnlessWhole(t, ids);
    });
    saveTodos(state.todos);
    this.render();
  }

  // ═══════════════════════════════════════════════════
  // MODE FOCUS
  // ═══════════════════════════════════════════════════
  enterFocus() {
    // Le menu contextuel est en position:fixed au-dessus de tout : ouvert au
    // moment où le Focus démarre (raccourci F, double-clic…), il restait
    // affiché par-dessus le plein écran. Fermé ici pour couvrir toutes les
    // entrées en Focus d'un coup, et pas seulement son propre item « Focus ».
    _hideTodoCtxMenu();
    if (state.view === 'focus') return;
    if (this._focusMinimized) { this.restoreFocus(); return; }
    this._preFocusView = state.view;
    state.setView('focus');
    localStorage.setItem('view', 'focus');
    // La file « Ensuite » démarre toujours repliée à l'ouverture du mode,
    // même si elle avait été laissée dépliée lors d'une session précédente.
    const qp = getQueuePrefs();
    if (!qp.collapsed) {
      qp.collapsed = true;
      saveQueuePrefs(qp);
      this._saveConfigChange();
    }
    this._pushHistory();
    this.render();
    // Plein écran au mieux (refusé sans geste utilisateur, ex. restauration)
    document.documentElement.requestFullscreen?.().then(() => {
      this._focusWasFullscreen = true;
    }).catch(() => {});
  }

  // Réduit le Focus en petit widget flottant (Picture-in-Picture) : la
  // session continue (le chrono tourne toujours), seule l'interface plein
  // écran disparaît. Action de base en quittant (Échap, sortie du plein
  // écran natif) — voir closeFocus() pour fermer la session pour de bon.
  minimizeFocus() {
    if (state.view !== 'focus') return;
    this._focusMinimized = true;
    this._focusWasFullscreen = false;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    const back = this._preFocusView && this._preFocusView !== 'focus' ? this._preFocusView : 'day';
    state.setView(back);
    localStorage.setItem('view', back);
    this._pushHistory();
    this.render();
  }

  // Restaure le Focus plein écran depuis le widget PiP
  restoreFocus() {
    if (!this._focusMinimized) return;
    this._focusMinimized = false;
    removeFocusPip();
    this._preFocusView = state.view;
    state.setView('focus');
    localStorage.setItem('view', 'focus');
    this._pushHistory();
    this.render();
    document.documentElement.requestFullscreen?.().then(() => {
      this._focusWasFullscreen = true;
    }).catch(() => {});
  }

  // Ferme la session pour de bon (bouton ✕, plein écran ou PiP) : sauvegarde
  // la progression, arrête le chrono, quitte la vue Focus et le PiP.
  closeFocus() {
    if (state.view !== 'focus' && !this._focusMinimized) return;
    this._stopFocusTick();
    // Sauvegarde le temps déjà passé sur la tâche courante (reprend à ce
    // point la prochaine fois qu'on la refocus)
    saveFocusProgress(this);
    clearTimerState();
    focusResetSession();
    this._focusMinimized = false;
    removeFocusPip();
    this._focusWasFullscreen = false;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (state.view === 'focus') {
      const back = this._preFocusView && this._preFocusView !== 'focus' ? this._preFocusView : 'day';
      state.setView(back);
      localStorage.setItem('view', back);
      this._pushHistory();
    }
    this.render();
  }

  initFocusView() {
    this._stopFocusTick();
    this.initFocusQueueDnD();
    this._focusInterval = setInterval(() => {
      if (state.view !== 'focus' && !this._focusMinimized) { this._stopFocusTick(); return; }
      if (focusTick(this)) this.render();
    }, 1000);
    // Sortie du plein écran natif (Échap navigateur) → réduit en PiP
    if (!this._focusFsBound) {
      this._focusFsBound = true;
      document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement && state.view === 'focus' && this._focusWasFullscreen) {
          this.minimizeFocus();
        }
      });
    }
  }

  _stopFocusTick() {
    if (this._focusInterval) {
      clearInterval(this._focusInterval);
      this._focusInterval = null;
    }
  }

  // Drag-and-drop de la file « Ensuite » : réordonne le DOM pendant le
  // survol, persiste l'ordre complet (courante en tête) au lâcher.
  // Le survol est contraint au même data-group (rec/punct, moment ou
  // 'none') que l'item saisi : getFocusQueue() re-trie toujours par
  // groupe après l'ordre manuel (le regroupement prime), donc un drop
  // inter-groupes serait accepté visuellement puis silencieusement
  // annulé au rendu suivant — mieux vaut l'empêcher pendant le geste.
  initFocusQueueDnD() {
    const list = document.getElementById('focusQueueList');
    if (!list) return;
    let dragEl = null;
    list.querySelectorAll('.focus-queue-item').forEach(item => {
      item.addEventListener('dragstart', e => {
        dragEl = item;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', item.dataset.id); } catch {}
      });
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        if (!dragEl) return;
        dragEl = null;
        const ids = [...list.querySelectorAll('.focus-queue-item')].map(el => el.dataset.id);
        // Une tâche courante complétée n'a pas de position dans la file
        // vivante — ne pas l'insérer dans l'ordre manuel persisté.
        const current = getCurrentFocusTask(this);
        const currentLive = current && getFocusQueue(this).some(t => t.id === current.id) ? current : null;
        focusSaveManualOrder(currentLive ? [currentLive.id, ...ids] : ids);
        this.render();
      });
    });
    list.addEventListener('dragover', e => {
      if (!dragEl) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const groupItems = [...list.querySelectorAll('.focus-queue-item:not(.dragging)')]
        .filter(el => el.dataset.group === dragEl.dataset.group);
      if (!groupItems.length) return; // seul item de son groupe : rien à réordonner
      const after = groupItems.find(el => {
        const r = el.getBoundingClientRect();
        return e.clientY < r.top + r.height / 2;
      });
      // Pas de cible trouvée après le point de survol : replacer en fin de
      // CE groupe (avant l'en-tête ou le 1er item du groupe suivant), pas
      // en toute fin de liste qui pourrait appartenir à un autre groupe.
      list.insertBefore(dragEl, after || groupItems[groupItems.length - 1].nextSibling);
    });
  }

  // Bascule compléter/décompléter (Entrée, ou bouton Compléter/Décompléter) —
  // ne change plus jamais la tâche affichée (_currentId inchangé) : c'est ce
  // qui remplace l'ancienne avance automatique après complétion. Décompléter
  // ne retire pas les stats déjà écrites (durationReal/durationHistory) —
  // journal en ajout seul, plus simple qu'un rollback exact.
  focusComplete() {
    const t = getCurrentFocusTask(this);
    if (!t) return;
    // Sous-tâche courante : mêmes stats (durationReal/durationHistory/
    // focusTimeSpent) mais portées par la sous-tâche elle-même, pas le
    // parent — et bascule via s.completed plutôt que toggleTodo(). own est
    // l'objet RÉEL (dans state.todos) contrairement à `t` qui, pour une
    // sous-tâche, est une vue normalisée en lecture seule (getCurrentFocusTask).
    const ref = resolveFocusRef(t.id);
    if (!ref) return;
    const own = ref.s || ref.t;
    const wasCompleted = ref.kind === 'subtask' ? !!own.completed : isCompleted(ref.t, today());
    const sec = elapsedSeconds(getTimerState(t.id));
    snapshot(state.todos);
    // Durée réelle = temps passé sur la tâche en mode focus (minutes).
    // Historisée dans durationHistory (borné à 30 entrées) pour pouvoir
    // comparer une occurrence aux précédentes dans la vue Analyse.
    if (!wasCompleted && sec >= 30) {
      const minutes = Math.max(1, Math.round(sec / 60));
      own.durationReal = minutes;
      if (!Array.isArray(own.durationHistory)) own.durationHistory = [];
      own.durationHistory.push({ date: DS(today()), minutes });
      if (own.durationHistory.length > 30) own.durationHistory = own.durationHistory.slice(-30);
    }
    if (!wasCompleted) { delete own.focusTimeSpent; delete own.focusTimeSpentDate; } // occurrence complétée : plus de progression à reprendre
    if (ref.kind === 'subtask') { own.completed = !own.completed; ref.t.updatedAt = Date.now(); }
    else toggleTodo(ref.t.id, today(), state.todos);
    saveTodos(state.todos);
    clearTimerState();
    if (!wasCompleted) {
      focusMarkCompletion();
      celebrate(state.lang);
      // Tâche tout juste complétée : déplier la file « Ensuite » pour
      // enchaîner facilement sur la suivante (repliée par défaut à l'entrée
      // en Focus — voir enterFocus() — mais pas d'intérêt à le rester une
      // fois qu'il n'y a plus « rien à faire maintenant »)
      const qp = getQueuePrefs();
      if (qp.collapsed) {
        qp.collapsed = false;
        saveQueuePrefs(qp);
        this._saveConfigChange();
      }
    }
    this.render();
  }

  // Invitation en mode Focus quand la tâche courante n'a pas de temps estimé.
  // Pas de render() complet ici : ça recréerait #focusTimer et redémarrerait
  // l'intervalle, interrompant visuellement le chrono en cours. On applique
  // la mutation puis on patche juste le remplissage/le prompt (applyFocusEstimate).
  focusSetEstimate(id, val) {
    const minutes = parseInt(val, 10);
    if (!minutes || minutes <= 0) return;
    const ref = resolveFocusRef(id);
    if (!ref) return;
    snapshot(state.todos);
    // Sous-tâche : ref.s cible déjà le tableau occurrence-aware (cf. le
    // resolveFocusRef corrigé de focus.js) — mutation directe correcte.
    // Tâche de premier niveau récurrente : par l'override d'aujourd'hui,
    // jamais le master (setOccurrenceField gère aussi le cas non récurrent).
    if (ref.kind === 'subtask') ref.s.durationEstimated = minutes;
    else setOccurrenceField(ref.t, DS(today()), 'durationEstimated', minutes);
    ref.t.updatedAt = Date.now();
    saveTodos(state.todos);
    applyFocusEstimate(this);
  }

  // Rouvre le prompt d'estimation (pré-rempli) pour la tâche courante —
  // clic sur le libellé « reste X min » une fois l'estimation déjà définie.
  focusEditEstimate() {
    startEditEstimate(this);
  }

  // Objectif de pause (bandeau après complétion) — clic sur « objectif X min »
  focusEditBreakTarget() {
    startEditBreakTarget();
  }

  focusSetBreakTarget(val) {
    const minutes = parseInt(val, 10);
    if (!minutes || minutes <= 0) return;
    setBreakTargetMinutes(minutes);
    this._saveConfigChange();
    applyFocusBreakTarget();
  }

  // Remet le chrono de la tâche courante à zéro sans la compléter.
  focusResetTimer(id) {
    const current = getCurrentFocusTask(this);
    if (!current || current.id !== id || isCompleted(current, today()) || isCancelled(current, today())) return;
    resetTimer(getTimerState(id));
    const ref = resolveFocusRef(id);
    const own = ref?.s || ref?.t;
    if (own?.focusTimeSpent) {
      delete own.focusTimeSpent;
      delete own.focusTimeSpentDate;
      saveTodos(state.todos);
    }
    applyFocusEstimate(this);
  }

  // Bascule chrono (temps écoulé) ↔ compte à rebours (temps restant),
  // uniquement pertinent quand une estimation existe. Patch DOM ciblé
  // (comme focusSetEstimate) : ne touche jamais #focusTimer autrement
  // que son texte, pour ne pas interrompre le chrono en cours.
  focusToggleTimerMode() {
    toggleTimerMode();
    applyTimerMode(this);
  }

  // « Autre chose à faire maintenant » — pas de la navigation (flèches) :
  // choisit explicitement la meilleure tâche suivante, l'avance automatique
  // par re-render n'existant plus (voir getFocusQueue()/getCurrentFocusTask()).
  focusSkip() {
    const t = getCurrentFocusTask(this);
    const queue = getFocusQueue(this);
    if (!t || isCompleted(t, today()) || isCancelled(t, today()) || queue.filter(x => x.id !== t.id).length === 0) return;
    saveFocusProgress(this);
    focusMarkSkipped(t.id);
    clearTimerState();
    const next = getFocusQueue(this)[0]; // re-triée post-passage — t est maintenant en fin de file
    if (next) focusSetCurrent(next.id);
    this.render();
  }

  focusTomorrow() {
    const t = getCurrentFocusTask(this);
    // Une sous-tâche n'a pas de date propre à reporter à demain.
    if (!t || isCompleted(t, today()) || isCancelled(t, today()) || (t.recurrence && t.recurrence !== 'none') || t.id.includes('::')) return;
    saveFocusProgress(this);
    clearTimerState();
    const rest = getFocusQueue(this).filter(x => x.id !== t.id); // avant que _sendManyTo ne change t.date
    if (rest[0]) focusSetCurrent(rest[0].id);
    this._sendManyTo([t.id], { date: DS(addDays(today(), 1)), backlog: false }); // appelle déjà this.render()
  }

  focusPauseResume() {
    const t = getCurrentFocusTask(this);
    if (!t || isCompleted(t, today()) || isCancelled(t, today())) return;
    const ts = getTimerState(t.id);
    ts.paused ? resumeTimer(ts) : pauseTimer(ts);
    this.render();
  }

  focusJumpTo(id) {
    if (id === getCurrentFocusTask(this)?.id) return;
    saveFocusProgress(this);
    focusSetCurrent(id);
    clearTimerState();
    this.render();
  }

  // Navigation ← → : parcourt l'ordre stable de la session (getFocusOrder),
  // indépendant de la file vivante — une tâche complétée y reste atteignable.
  // Bornes : ne rien faire, SAUF → en bout de file avec la tâche courante
  // complétée, qui affiche l'écran de relance (_currentId = null).
  focusNext() {
    const order = getFocusOrder(this);
    const cur = getCurrentFocusTask(this);
    const idx = cur ? order.indexOf(cur.id) : -1;
    if (idx >= 0 && idx < order.length - 1) {
      saveFocusProgress(this);
      focusSetCurrent(order[idx + 1]);
      clearTimerState();
      this.render();
      return;
    }
    if (idx === order.length - 1 && cur && isCompleted(cur, today())) {
      saveFocusProgress(this);
      focusSetCurrent(null);
      clearTimerState();
      this.render();
    }
  }

  focusPrev() {
    const order = getFocusOrder(this);
    const cur = getCurrentFocusTask(this);
    const idx = cur ? order.indexOf(cur.id) : -1;
    if (idx > 0) {
      saveFocusProgress(this);
      focusSetCurrent(order[idx - 1]);
      clearTimerState();
      this.render();
      return;
    }
    if (idx === -1 && order.length) {
      saveFocusProgress(this);
      focusSetCurrent(order[order.length - 1]);
      clearTimerState();
      this.render();
    }
  }

  // Options de vue/tri/colonnes de la file « Ensuite » (segmented controls)
  focusSetQueueView(key, val) {
    const p = getQueuePrefs();
    p[key] = val;
    saveQueuePrefs(p);
    this._saveConfigChange();
    this.render();
  }

  focusToggleQueueCollapse() {
    const p = getQueuePrefs();
    p.collapsed = !p.collapsed;
    saveQueuePrefs(p);
    this._saveConfigChange();
    this.render();
  }

  // Panneau « Journée bouclée » (focus + vue jour) : piocher une tâche du
  // backlog → datée `ds`, sortie du backlog ; en mode focus elle devient la courante
  refillPick(id, ds, mode) {
    const t = state.todos.find(x => x.id === id);
    if (!t) return;
    snapshot(state.todos);
    t.date = ds;
    t.backlog = false;
    t.updatedAt = Date.now();
    this._leaveGroupUnlessWhole(t, [id]);
    saveTodos(state.todos);
    if (mode === 'focus') { focusSetCurrent(id); clearTimerState(); }
    this.render();
  }

  // Panneau « Journée bouclée » : créer une tâche pour `ds` (et enchaîner en focus)
  refillAdd(ds, mode) {
    const input = document.getElementById('refillNewTaskInput');
    const title = input?.value.trim();
    if (!title) return;
    snapshot(state.todos);
    addTask({ title, date: ds, recurrence: 'none' }, state.todos);
    const created = state.todos[state.todos.length - 1];
    saveTodos(state.todos);
    if (mode === 'focus') { focusSetCurrent(created.id); clearTimerState(); }
    this.render();
  }

  // todoId composé ("todoId::parentStid") quand la tâche courante en Focus
  // est elle-même une sous-tâche de profondeur 1 : ses propres enfants
  // (profondeur 2) restent une simple checklist, gérée via le paramètre
  // parentStid déjà supporté par toggleSubtask().
  focusToggleSubtask(todoId, stid) {
    if (todoId.includes('::')) {
      const [realTodoId, parentStid] = todoId.split('::');
      this.toggleSubtask(realTodoId, stid, DS(today()), parentStid);
    } else {
      this.toggleSubtask(todoId, stid, DS(today()));
    }
  }

  // Ajout de sous-tâche depuis le mode Focus — même mécanique que
  // addSubtaskInline (vue jour), scopée à .focus-subtasks/.focus-subtask-add
  // au lieu de .subtask-list/.subtask-add-mini. Persiste via _saveNewSubtask()
  // (partagé), donc identique en base à un ajout fait depuis la vue jour.
  focusAddSubtask(todoId) {
    const box = document.querySelector(`.focus-subtasks[data-id="${todoId}"]`);
    if (!box) return;
    const addBtn = box.querySelector('.focus-subtask-add');
    if (!addBtn) return;
    const input = document.createElement('input');
    input.className = 'focus-subtask-new-input';
    input.placeholder = 'Nouvelle sous-tâche…';
    input.autocomplete = 'off';
    let saved = false;
    // andFocus=true (Alt+Entrée) : bascule le Focus courant sur la sous-tâche
    // tout juste créée au lieu de rester sur la tâche/sous-tâche affichée —
    // seulement quand la cible est une tâche de premier niveau (parentStid
    // absent), une sous-sous-tâche n'étant jamais un item de file indépendant.
    const confirm = (andFocus = false) => {
      if (saved) return;
      saved = true;
      const title = input.value.trim();
      input.remove();
      addBtn.style.display = '';
      if (title) {
        // Même id composé que focusToggleSubtask() ci-dessus.
        const isSub = todoId.includes('::');
        const realTodoId = isSub ? todoId.split('::')[0] : todoId;
        const parentStid = isSub ? todoId.split('::')[1] : undefined;
        const newSub = this._saveNewSubtask(realTodoId, title, parentStid, DS(today()));
        if (andFocus && newSub && !parentStid) this.focusStartOn(realTodoId, DS(today()), newSub.id, { fallbackToEdit: false });
      }
    };
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); confirm(e.altKey); }
      if (e.key === 'Escape') { saved = true; input.remove(); addBtn.style.display = ''; }
    });
    input.addEventListener('blur', confirm);
    addBtn.style.display = 'none';
    box.appendChild(input);
    attachMic(input, { wrap: true });
    input.focus();
    autoStartDictation(input);
  }

  focusCounterStep(id, dir) {
    dir > 0 ? this.incrementCount(id) : this.decrementCount(id);
  }

  // Clic sur une carte Inbox/Backlog → édition, sauf dans le bloc
  // sous-tâches : ses propres contrôles stoppent déjà la propagation, mais
  // pas les zones de padding entre eux (ni l'input inline de création d'une
  // nouvelle sous-tâche). Même garde que clickTodo() en vue jour.
  clickInboxItem(e, id) {
    if (e.target.closest('.subtask-collapse')) return;
    this.openEditModal(id, null);
  }

  clickTodo(e, id, ds) {
    if (e.ctrlKey || e.metaKey || e.shiftKey) return; // clic de multi-sélection (multiselect.js)
    if (e.target.closest('.todo-check, .todo-actions, .todo-menu-btn, .todo-drag-handle, .subtask-list, .subtask-warning-popover')) return;
    if (this._clickTimer) { // 2e clic pendant la fenêtre → double-clic
      clearTimeout(this._clickTimer);
      this._clickTimer = null;
      this.focusStartOn(id, ds);
      return;
    }
    this._clickTimer = setTimeout(() => {
      this._clickTimer = null;
      this.openEditModal(id, ds);
    }, 220);
  }

  // Double-clic sur une tâche → session Focus démarrée sur cette tâche.
  // La file Focus ne couvre que la journée : si la tâche n'a pas
  // d'occurrence aujourd'hui, on retombe sur l'édition. `stid` optionnel
  // (profondeur 1 seulement) cible directement une sous-tâche comme item de
  // file indépendant — la tâche parente doit elle-même être focusable (pas
  // déjà complétée/annulée aujourd'hui), sinon une sous-tâche d'une tâche
  // annulée deviendrait « courante » avec un chrono vivant. `opts.fallbackToEdit`
  // (défaut true) désactive le repli vers l'édition quand la cible n'est pas
  // focusable — utilisé par le raccourci Alt+Entrée (création tâche/sous-tâche
  // → focus direct) pour ne jamais rouvrir un modal qu'on vient de fermer.
  focusStartOn(id, ds, stid, opts = {}) {
    _hideTodoCtxMenu(); // cf. enterFocus() — vaut aussi quand on est DÉJÀ en Focus
    const d = today();
    const targetId = stid ? focusSubtaskId(id, stid) : id;
    const focusable = stid
      ? !!(getTodosForDate(d, state.todos).find(t => t.id === id && !isCompleted(t, d) && !isCancelled(t, d))?.subtasks?.find(s => s.id === stid && !s.completed))
      : getTodosForDate(d, state.todos).some(t => t.id === id && !isCompleted(t, d) && !isCancelled(t, d));
    if (!focusable) { if (!stid && opts.fallbackToEdit !== false) this.openEditModal(id, ds); return; }
    // Déjà en focus (plein écran ou réduit) sur une autre tâche : sauvegarde
    // sa progression avant de basculer
    if ((state.view === 'focus' || this._focusMinimized) && targetId !== getCurrentFocusTask(this)?.id) saveFocusProgress(this);
    focusSetCurrent(targetId);
    clearTimerState();
    if (state.view === 'focus') this.render();
    else this.enterFocus();
  }

  dropReorder(draggedId, group, targetId, before) {
    // draggedId peut être un id seul ou un tableau (drop d'une multi-sélection)
    const draggedIds = (Array.isArray(draggedId) ? draggedId : [draggedId]).filter(id => id !== targetId);
    if (!draggedIds.length) return;
    // Réordonne order : retire les ids déplacés puis les réinsère (dans leur
    // ordre relatif actuel) après/avant la cible. Ids absents de order ignorés.
    const _reinsert = (order) => {
      const moving = order.filter(id => draggedIds.includes(id));
      if (!moving.length) return null;
      const newOrder = order.filter(id => !draggedIds.includes(id));
      const idx = newOrder.indexOf(targetId);
      if (idx < 0) return null;
      newOrder.splice(before ? idx : idx + 1, 0, ...moving);
      return newOrder;
    };
    const dateStr = DS(state.navDate);
    // Sans ordre stocké, l'ordre initial doit refléter l'AFFICHAGE (heure d'abord),
    // pas l'ordre interne du tableau — sinon le premier drag fait sauter la liste
    const _displayOrder = arr => {
      const timed = arr.filter(t => t.startTime).sort((a, b) => a.startTime.localeCompare(b.startTime));
      return [...timed, ...arr.filter(t => !t.startTime)].map(t => t.id);
    };
    if (group === 'punctual') {
      const items = getTodosForDate(state.navDate, state.todos).filter(t => (!t.recurrence || t.recurrence === 'none') && !t.dayPeriod);
      let order = this.dayOrder[dateStr] ? [...this.dayOrder[dateStr]] : _displayOrder(items);
      items.forEach(t => { if (!order.includes(t.id)) order.push(t.id); });
      order = order.filter(id => id.startsWith('spacer-') || items.some(t => t.id === id));
      const newOrder = _reinsert(order);
      if (!newOrder) return;
      this.dayOrder[dateStr] = newOrder;
      localStorage.setItem('dayOrder', JSON.stringify(this.dayOrder));
    } else if (group.startsWith('punctual-')) {
      const periodMap = { 'punctual-morning': 'morning', 'punctual-afternoon': 'afternoon', 'punctual-evening': 'evening' };
      const period = periodMap[group];
      const items = getTodosForDate(state.navDate, state.todos).filter(t => (!t.recurrence || t.recurrence === 'none') && t.dayPeriod === period);
      if (!this.punctualPeriodOrder[dateStr]) this.punctualPeriodOrder[dateStr] = {};
      let order = this.punctualPeriodOrder[dateStr][period] ? [...this.punctualPeriodOrder[dateStr][period]] : _displayOrder(items);
      items.forEach(t => { if (!order.includes(t.id)) order.push(t.id); });
      order = order.filter(id => items.some(t => t.id === id));
      const newOrder = _reinsert(order);
      if (!newOrder) return;
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
      let order = this.recurringOrder[dateStr][group] ? [...this.recurringOrder[dateStr][group]] : _displayOrder(items);
      items.forEach(t => { if (!order.includes(t.id)) order.push(t.id); });
      order = order.filter(id => items.some(t => t.id === id));
      const newOrder = _reinsert(order);
      if (!newOrder) return;
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

  // Glisser-déposer en zone « imbriquer » (vue jour/Backlog/Inbox) : les
  // tâches `draggedIds` deviennent des sous-tâches de `target` — mêmes
  // précédents que addParentTask/convertGroupToTask (confirm() natif,
  // dépouillement de champs, _trackDeletion avant retrait de state.todos).
  // Récurrente en source → bloqué sans confirm, aucun équivalent sous-tâche
  // pour completedDates (comme addParentTask). Récurrente en CIBLE → permis,
  // seule la source absorbée est gardée. `needsSplit(0, s)` : une source qui
  // a déjà 2 niveaux de sous-tâches dépasserait la limite en s'imbriquant
  // telle quelle sous une cible racine — ses enfants directs sont alors
  // promus à la place (splitIntoPromotedChildren), titre préfixé.
  nestTaskAsSubtask(draggedIds, targetId) {
    const target = state.todos.find(x => x.id === targetId);
    if (!target) return false;
    const sources = draggedIds.filter(id => id !== targetId)
      .map(id => state.todos.find(x => x.id === id)).filter(Boolean);
    if (!sources.length) return false;
    if (sources.some(s => s.recurrence && s.recurrence !== 'none')) return false;

    const lost = _lostFieldLabels(sources);
    if (lost.length && !confirm(_fieldLossConfirmMsg(sources, target, lost))) return false;
    const splitSources = sources.filter(s => needsSplit(0, s));
    if (splitSources.length && !confirm(_splitConfirmMsg(splitSources, target))) return false;

    snapshot(state.todos);
    const newSubtasks = sources.flatMap(s =>
      needsSplit(0, s) ? splitIntoPromotedChildren(s)
                       : [{ id: s.id, title: s.title, completed: !!s.completed,
                            ...(s.subtasks?.length ? { subtasks: s.subtasks.map(c => ({ ...c })) } : {}) }]
    );
    sources.forEach(s => this._trackDeletion(s.id));
    if (!target.subtasks) target.subtasks = [];
    target.subtasks.push(...newSubtasks);
    const removeIds = new Set(sources.map(s => s.id));
    state.setTodos(state.todos.filter(t => !removeIds.has(t.id)));
    target.updatedAt = Date.now();
    saveTodos(state.todos);
    this.render();
    return true;
  }

  moveTodoToDate(todoId, newDateStr, event) {
    this.moveManyToDate(this._dropIds(todoId), newDateStr, event);
  }

  moveManyToDate(ids, newDateStr, event) {
    const isCopy = this._isCopyDrag(event);
    const targets = state.todos.filter(t =>
      ids.includes(t.id) && (!t.recurrence || t.recurrence === 'none') && (isCopy || t.date !== newDateStr)
    );
    if (!targets.length) return;
    snapshot(state.todos);
    targets.forEach(t => {
      if (isCopy) this._insertClone(t, { date: newDateStr });
      else { t.date = newDateStr; t.updatedAt = Date.now(); this._leaveGroupUnlessWhole(t, ids); }
    });
    saveTodos(state.todos);
    if (ids.length > 1) msClear();
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
      e.dataTransfer.effectAllowed = 'copyMove';
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
      const multi = this._dropIds(draggedId).length > 1;
      const isCopy = this._isCopyDrag(e);

      if (dropTargetId) {
        // Reorder within same day or move + reorder to another day
        const targetItem = view.querySelector(`.week-todo-item[data-id="${dropTargetId}"]`);
        const newDate = targetItem?.dataset.date;
        if (newDate && (multi || newDate !== draggedDate || isCopy)) {
          this.moveTodoToDate(draggedId, newDate, e);
        } else if (newDate) {
          this.weekReorder(draggedId, newDate, dropTargetId, dropBefore);
        }
      } else {
        // Dropped on empty column area
        const col = e.target.closest('.week-day-todos');
        if (!col || !col.dataset.date) return;
        const newDate = col.dataset.date;
        if (multi || newDate !== draggedDate || isCopy) this.moveTodoToDate(draggedId, newDate, e);
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
      e.dataTransfer.effectAllowed = 'copyMove';
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
      if (newDate && (newDate !== draggedDate || this._dropIds(draggedId).length > 1 || this._isCopyDrag(e))) this.moveTodoToDate(draggedId, newDate, e);
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
      e.dataTransfer.effectAllowed = 'copyMove';
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
    let dropBefore = false; // drop sur la moitié haute d'un item → insérer avant
    let dropZone = 'before'; // 'before' | 'after' | 'nest' — zone survolée sur l'item cible
    let dropJoinGroup = null; // { groupId, groupTitle, dayPeriodValue, sectionGroup, firstMemberId } quand un .task-group-header est survolé
    let draggedHeight = 0;
    // Posé au dragstart quand l'élément glissé EST le chip d'en-tête du
    // groupe (`.task-group-header` lui-même) — seul geste qui déplace tout
    // le groupe d'un bloc. `null` pour un drag de carte membre (même la 1re,
    // qui porte l'en-tête juste au-dessus) : ce cas ne touche jamais à
    // l'en-tête, la carte se déplace seule et quitte le groupe au drop.
    let draggedOwnHeader = null;

    // Gap placeholder (utilisé pour les zones section-level : séparateurs,
    // libellés de moment/groupe, fin de colonne — pas pour l'échange item↔item)
    const placeholder = document.createElement('div');
    placeholder.className = 'drop-gap';
    let activeDropSpacer = null, activeHeureLabel = null, activeItemTarget = null, activeGroupHeader = null;
    const clearItemTarget = () => {
      if (activeItemTarget) {
        activeItemTarget.classList.remove('drop-target-swap', 'drop-before', 'drop-after', 'drop-nest');
        activeItemTarget = null;
      }
    };
    const clearDropSpacer = () => {
      if (activeDropSpacer) { activeDropSpacer.classList.remove('drop-target'); activeDropSpacer = null; }
      if (activeHeureLabel) { activeHeureLabel.classList.remove('drop-target'); activeHeureLabel = null; }
      if (activeGroupHeader) { activeGroupHeader.classList.remove('drop-target'); activeGroupHeader = null; }
    };
    // Drag EXTERNE (une tâche non accomplie du Bilan/bandeau .review-item,
    // via planDragStart) : son dragstart ne bubble jamais jusqu'ici (le
    // .review-item vit hors de .day-columns), donc draggedEl reste null tout
    // le temps du survol/drop — cf. les 2 branches "!draggedEl" plus bas.
    let activeExternalTarget = null;
    const clearExternalTarget = () => {
      if (activeExternalTarget) { activeExternalTarget.classList.remove('drop-target'); activeExternalTarget = null; }
    };
    const removePlaceholder = () => {
      placeholder.style.height = '0px';
      placeholder.classList.remove('visible');
      clearDropSpacer();
      requestAnimationFrame(() => { if (placeholder.parentNode) placeholder.remove(); });
    };

    const showDragged = () => {
      if (draggedEl) { draggedEl.style.display = ''; draggedEl.style.visibility = ''; draggedEl.classList.remove('dragging'); }
    };

    const draggableSel = '.todo-item[draggable], .day-spacer[draggable], .task-group-header[draggable]';

    container.addEventListener('dragstart', e => {
      const item = e.target.closest(draggableSel);
      if (!item) return;
      draggedEl = item;
      draggedGroup = item.dataset.group;
      draggedHeight = item.offsetHeight;
      e.dataTransfer.effectAllowed = 'copyMove';
      e.dataTransfer.setData('text/plain', item.dataset.id);
      draggedOwnHeader = null;
      // SEUL le chip d'en-tête (.task-group-header) déplace tout le groupe
      // d'un bloc (data-ids, posé par todoListHTML(), même mécanisme que le
      // drag d'une multi-sélection — _dragMultiIds/_dropIds). Glisser une
      // carte membre — même la 1re, qui porte l'en-tête juste au-dessus —
      // reste un déplacement de CETTE tâche seule : elle quitte le groupe au
      // drop si elle n'y reste pas entière (cf. _leaveGroupUnlessWhole,
      // appelé côté drop). Poser tout le groupe sur l'en-tête reste le seul
      // geste pour le déplacer en bloc — ajouter/retrancher un membre passe
      // par le drag de sa propre carte (retrancher) ou un drop sur l'en-tête
      // (ajouter, cf. dropJoinGroup plus bas).
      let groupTitleOverride = null;
      if (item.classList.contains('task-group-header')) {
        draggedOwnHeader = item;
        const memberIds = (draggedOwnHeader.dataset.ids || '').split(',').filter(Boolean);
        this._dragMultiIds = memberIds;
        groupTitleOverride = state.todos.find(x => x.id === memberIds[0])?.groupTitle || null;
        memberIds.forEach(mid => {
          container.querySelector(`.todo-item[data-id="${mid}"]`)?.classList.add('multi-dragging');
        });
      }
      if (!item.classList.contains('day-spacer')) this._setDragGhost(e, item.dataset.id, groupTitleOverride);
      container.classList.add('dragging-active');
      requestAnimationFrame(() => {
        // En liste masonry (≥2 colonnes), chaque item n'a qu'un --rspan (span
        // de hauteur) posé par _layoutMasonry() — jamais de grid-row-start
        // explicite : le positionnement vertical au sein d'une colonne repose
        // donc sur le placement automatique de la grille. `display:none`
        // retire l'item du flux, et la grille republie AUSSITÔT les items
        // suivants de sa colonne pour combler le vide — une AUTRE carte se
        // retrouve alors sous le curseur dès le pickup, avant même le premier
        // mouvement de souris, rendant tout ciblage (dégroupage, repositionnement
        // précis) imprévisible. `visibility:hidden` garde la cellule de grille
        // réservée (mesurée, donc aucun voisin ne bouge) tout en restant
        // invisible et hors du hit-test du curseur (elementFromPoint()/les
        // events pointeur l'ignorent, comme display:none) — seule cette liste
        // en a besoin ; les autres (flex/1 colonne) gardent display:none pour
        // fermer visuellement l'espace, effet recherché là où il n'y a pas de
        // grille à casser.
        if (item.closest('.todo-list.masonry')) item.style.visibility = 'hidden';
        else item.style.display = 'none';
      });
    });

    container.addEventListener('dragend', () => {
      showDragged();
      removePlaceholder();
      clearItemTarget();
      container.classList.remove('dragging-active');
      draggedEl = null; draggedGroup = null; dropTarget = null; dropPriority = null; dropPeriod = null; dropBefore = false; dropZone = 'before'; dropJoinGroup = null; draggedOwnHeader = null;
    });

    container.addEventListener('dragover', e => {
      e.preventDefault();
      if (!draggedEl) {
        // Drag externe — seulement sur la vue d'AUJOURD'HUI (même condition
        // que le titre "Aujourd'hui", isToday, qui sert de 2e cible ici) :
        // survol d'un moment (Matin/Après-midi/Soir) → highlight son label ;
        // sinon survol du titre "Aujourd'hui" → highlight toute la ligne
        if (DS(state.navDate) !== DS(today())) { clearExternalTarget(); return; }
        const heureSection = e.target.closest('.day-heure-section[data-period]');
        const titleRow = !heureSection && e.target.closest('.day-col-title-row');
        const next = (heureSection && (heureSection.querySelector('.day-heure-label') || heureSection)) || titleRow || null;
        if (next !== activeExternalTarget) {
          clearExternalTarget();
          if (next) { activeExternalTarget = next; next.classList.add('drop-target'); }
        }
        return;
      }
      // Survol du placeholder lui-même (la liste vient de glisser sous le
      // curseur, ex. insertion avant le 1er item) → garder la cible actuelle,
      // sinon la branche « bas de colonne » renvoie le drop en fin de liste
      if (placeholder.contains(e.target)) return;
      dropJoinGroup = null; // reposé par la branche .task-group-header ci-dessous si elle matche cette fois-ci

      const _ds = localStorage.getItem('daySort');
      const _periodGroups = localStorage.getItem('dayPeriodGroups') !== 'false';
      const isHeureDrop = _ds === 'chrono' || _ds === 'heure' || _periodGroups;
      const isPunctGroup = g => g === 'punctual' || g?.startsWith('punctual-');
      // Équivalent pour la colonne Quotidien — son propre réglage
      // (recPeriodGroups), indépendant du tri/regroupement de la colonne
      // Ponctuelle, gouverne si les sous-listes Matin/Après-midi/Soir de
      // .day-heure-section existent pour servir de cible de drop.
      const isDailyPeriodDrop = localStorage.getItem('recPeriodGroups') !== 'false';
      const isDailyGroup = g => g === 'daily' || g?.startsWith('daily-');

      // Survol du haut/bas d'un item → il PREND SA PLACE avant/après ;
      // survol du centre → la tâche(s) glissée(s) devient sous-tâche de
      // l'item survolé (voir nestTaskAsSubtask). Highlight persistant sur
      // toute la durée du survol, en confirmation visuelle claire.
      const todoTarget = e.target.closest('.todo-item[draggable]');
      if (todoTarget && todoTarget !== draggedEl) {
        const sameGroup  = todoTarget.dataset.group === draggedGroup;
        const heureGroup = isHeureDrop && isPunctGroup(todoTarget.dataset.group) && isPunctGroup(draggedGroup);
        const dailyGroup = isDailyPeriodDrop && isDailyGroup(todoTarget.dataset.group) && isDailyGroup(draggedGroup);
        if (sameGroup || heureGroup || dailyGroup) {
          clearDropSpacer();
          if (activeItemTarget && activeItemTarget !== todoTarget) clearItemTarget();
          activeItemTarget = todoTarget;
          todoTarget.classList.add('drop-target-swap');
          dropTarget = todoTarget.dataset.id;
          // Imbriquer désactivé : cible dans la sélection draguée, drag de
          // groupe entier, copy-drag (Alt/Ctrl/Cmd), ou une source récurrente
          // (aucun équivalent sous-tâche pour completedDates) — dégrade en
          // 50/50 avant/après dans tous ces cas (dnDZone, utils.js).
          const dropIds = this._dropIds(draggedEl.dataset.id);
          const anyRecurring = dropIds.some(id => { const s = state.todos.find(x => x.id === id); return s?.recurrence && s.recurrence !== 'none'; });
          const isGroupDrag = !!draggedOwnHeader;
          const allowNest = !anyRecurring && !isGroupDrag && !this._isCopyDrag(e) && !dropIds.includes(todoTarget.dataset.id);
          dropZone = dnDZone(e.clientY, todoTarget.getBoundingClientRect(), { allowNest });
          dropBefore = dropZone !== 'after';
          todoTarget.classList.toggle('drop-before', dropZone === 'before');
          todoTarget.classList.toggle('drop-after', dropZone === 'after');
          todoTarget.classList.toggle('drop-nest', dropZone === 'nest');
          dropPriority = todoTarget.closest('.todo-list[data-priority]')?.dataset.priority || null;
          if (isHeureDrop || dailyGroup) {
            // Normaliser groupe → moment : 'punctual-morning'/'daily-morning' → 'morning',
            // 'punctual'/'daily'/etc. (sans moment) → '' — sinon on écrit un
            // dayPeriod invalide qui rend la tâche invisible en vue jour
            const grp = todoTarget.dataset.group;
            const m = grp.match(/-(morning|afternoon|evening)$/);
            dropPeriod = m ? m[1] : '';
          }
          if (placeholder.parentNode) removePlaceholder();
          return;
        }
      }
      clearItemTarget();

      // Hover sur l'en-tête d'un groupe (« commissions », groupId) → la
      // tâche glissée rejoint ce groupe et en devient le 1er membre — geste
      // symétrique du dépôt sur un en-tête de moment (toujours en tête de
      // liste, jamais en fin). Un seul geste possible ici (rejoindre), pas
      // besoin des 3 zones avant/après/imbriquer.
      const groupHeaderTarget = e.target.closest('.task-group-header');
      if (groupHeaderTarget && groupHeaderTarget !== draggedEl) {
        const firstMember = state.todos.find(x => x.id === groupHeaderTarget.dataset.id);
        const dropIds = this._dropIds(draggedEl.dataset.id);
        if (firstMember?.groupId && !dropIds.includes(firstMember.id)) {
          clearDropSpacer();
          activeGroupHeader = groupHeaderTarget;
          groupHeaderTarget.classList.add('drop-target');
          const grp = groupHeaderTarget.dataset.group;
          const m = grp.match(/-(morning|afternoon|evening)$/);
          dropJoinGroup = {
            groupId: firstMember.groupId,
            groupTitle: firstMember.groupTitle || '',
            dayPeriodValue: m ? m[1] : '',
            sectionGroup: grp,
            firstMemberId: firstMember.id,
          };
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
        dropBefore = false;
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
          placeholder.style.setProperty('--rspan', Math.max(1, Math.ceil((draggedHeight + 10) / 4)));
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
          dropBefore = false;
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
              placeholder.style.setProperty('--rspan', Math.max(1, Math.ceil((draggedHeight + 10) / 4)));
              placeholder.classList.add('visible');
            });
          }
        }
        return;
      }

      // Hover on a heure period label or empty section → change moment ET
      // devient le 1er item de ce moment (déposer sur l'en-tête = en tête de
      // liste, pas en fin — demandé explicitement par Hugues, cf. CLAUDE.md).
      // Marche aussi pour les sous-périodes du Quotidien (mêmes classes
      // .day-heure-label/.day-heure-section, cf. render.js) — gouverné par
      // isDailyPeriodDrop plutôt que isHeureDrop puisque ce sont deux
      // réglages de colonnes indépendants (dayPeriodGroups vs recPeriodGroups).
      if ((isHeureDrop || (isDailyPeriodDrop && isDailyGroup(draggedGroup))) && !e.target.closest('.todo-item')) {
        const heureLabel   = e.target.closest('.day-heure-label[data-period]');
        const heureSection = !heureLabel && e.target.closest('.day-heure-section[data-period]');
        const heureTarget  = heureLabel || heureSection;
        if (heureTarget) {
          clearDropSpacer();
          activeHeureLabel = heureLabel || heureTarget.querySelector('.day-heure-label');
          if (activeHeureLabel) activeHeureLabel.classList.add('drop-target');
          dropPeriod = heureTarget.dataset.period;
          dropBefore = true;
          const section  = heureTarget.closest('.day-heure-section') || heureTarget;
          const todoList = section?.querySelector('.todo-list[data-group]');
          if (todoList) {
            const firstItem = [...todoList.querySelectorAll('.todo-item[draggable]')].find(el => el !== draggedEl);
            if (firstItem) {
              dropTarget = firstItem.dataset.id;
              firstItem.parentNode.insertBefore(placeholder, firstItem);
            } else {
              todoList.appendChild(placeholder);
              dropTarget = '__heure_empty__';
            }
            requestAnimationFrame(() => {
              placeholder.style.height = draggedHeight + 'px';
              placeholder.style.setProperty('--rspan', Math.max(1, Math.ceil((draggedHeight + 10) / 4)));
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
          dropBefore = false;
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
            placeholder.style.setProperty('--rspan', Math.max(1, Math.ceil((draggedHeight + 10) / 4)));
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
          dropBefore = false;
          lastItem.parentNode.insertBefore(placeholder, lastItem.nextSibling);
          requestAnimationFrame(() => {
            placeholder.style.height = draggedHeight + 'px';
            placeholder.style.setProperty('--rspan', Math.max(1, Math.ceil((draggedHeight + 10) / 4)));
            placeholder.classList.add('visible');
          });
        }
      }
    });

    container.addEventListener('dragleave', e => {
      if (!container.contains(e.relatedTarget)) { removePlaceholder(); clearItemTarget(); clearExternalTarget(); }
    });

    container.addEventListener('drop', e => {
      e.preventDefault();
      removePlaceholder();
      clearItemTarget();
      if (!draggedEl) {
        clearExternalTarget();
        if (DS(state.navDate) !== DS(today())) return;
        const taskId = e.dataTransfer.getData('text/plain');
        // Garde-fou : un drag de section de tag (initTagSectionDragDrop)
        // laisse lui aussi draggedEl à null ici (son dragstart ne matche pas
        // draggableSel) et pose lui aussi du text/plain — mais un tagId, pas
        // un id de tâche. On ne mute que si l'id correspond à une vraie tâche.
        if (!taskId || !state.todos.some(t => t.id === taskId)) return;
        const heureSection = e.target.closest('.day-heure-section[data-period]');
        if (heureSection) { this.overdueDropTodayPeriod(e, heureSection.dataset.period); return; }
        if (e.target.closest('.day-col-title-row')) { this.overdueDropToday(e); return; }
        return;
      }

      const originalIds = this._dropIds(draggedEl.dataset.id);
      if (dropJoinGroup) {
        const { groupId, groupTitle, dayPeriodValue, sectionGroup, firstMemberId } = dropJoinGroup;
        const targets = state.todos.filter(t => originalIds.includes(t.id));
        if (targets.length) {
          snapshot(state.todos);
          targets.forEach(t => {
            t.groupId = groupId;
            if (groupTitle) t.groupTitle = groupTitle;
            if (dayPeriodValue === '') delete t.dayPeriod; else t.dayPeriod = dayPeriodValue;
          });
          saveTodos(state.todos);
          this.dropReorder(originalIds, sectionGroup, firstMemberId, true);
        }
        return;
      }
      if (dropZone === 'nest' && dropTarget) { this.nestTaskAsSubtask(originalIds, dropTarget); return; }
      // Copie (Alt/Ctrl/Cmd maintenu) : les clones prennent la place cible,
      // les originaux restent intouchés (même dayPeriod/priorité/position).
      // Résolu paresseusement (une seule fois, snapshot() inclus) au premier
      // point du handler qui mute réellement quelque chose — cloner plus tôt
      // risquerait un clone orphelin non sauvegardé sur un chemin qui `return`
      // avant toute mutation (ex. dropTarget introuvable).
      let opIds = originalIds;
      let resolved = false;
      const resolveIds = () => {
        if (resolved) return opIds;
        resolved = true;
        if (this._isCopyDrag(e)) {
          snapshot(state.todos);
          opIds = originalIds.map(id => {
            const t = state.todos.find(x => x.id === id);
            return t ? this._insertClone(t).id : id;
          });
        }
        return opIds;
      };

      // Change the item's dayPeriod to match the target section (chrono or period groups)
      const _dsMode = localStorage.getItem('daySort');
      const _pgMode = localStorage.getItem('dayPeriodGroups') !== 'false';
      // Équivalent Quotidien : son propre réglage (recPeriodGroups), pas
      // celui du ponctuel — cf. isDailyPeriodDrop dans le dragover ci-dessus.
      const _recPgMode = localStorage.getItem('recPeriodGroups') !== 'false';
      const _isDailyDrag = draggedGroup === 'daily' || draggedGroup?.startsWith('daily-');
      if ((_dsMode === 'chrono' || _dsMode === 'heure' || _pgMode || (_isDailyDrag && _recPgMode)) && !draggedEl.classList.contains('day-spacer') && dropPeriod !== null) {
        const ids = resolveIds();
        // _resolveOccurrences() : une tâche récurrente ne change de moment
        // que pour SON occurrence affichée — les autres jours ne bougent pas.
        const occ = this._resolveOccurrences(ids);
        if (occ.length) {
          occ.forEach(({ t, ds }) => {
            setOccurrenceField(t, ds, 'dayPeriod', dropPeriod || null);
            t.updatedAt = Date.now();
            // Glisser sa propre carte (jamais l'en-tête, cf. draggedOwnHeader)
            // détache un membre groupé — que le moment change réellement ou
            // que ce soit un simple réordonnancement au sein du même moment :
            // seul le chip d'en-tête déplace le groupe entier sans le rompre.
            if (!draggedOwnHeader) this._leaveGroupUnlessWhole(t, ids);
          });
          saveTodos(state.todos);
        }
        // Lâché sur un item → réordonner aussi dans ce moment
        // (l'ordre manuel prime sur l'heure dans le rendu chrono)
        if (dropTarget && dropTarget !== '__heure_empty__' && !dropTarget.startsWith('spacer-')) {
          const groupPrefix = _isDailyDrag ? 'daily' : 'punctual';
          const targetGroup = dropPeriod === '' ? groupPrefix : `${groupPrefix}-${dropPeriod}`;
          this.dropReorder(ids, targetGroup, dropTarget, dropBefore);
          return; // dropReorder re-render
        }
        this.render();
        return;
      }

      if (!dropTarget) return;

      const ids = resolveIds();

      // In priority sort mode, change the item's priority to match the target group
      if (localStorage.getItem('daySort') === 'priority' && dropPriority != null) {
        const occ = this._resolveOccurrences(ids);
        if (occ.length) {
          occ.forEach(({ t, ds }) => { setOccurrenceField(t, ds, 'priority', dropPriority === 'none' ? null : dropPriority); t.updatedAt = Date.now(); });
          saveTodos(state.todos);
        }
      }

      // Même règle que la branche moment ci-dessus : glisser sa propre carte
      // (jamais l'en-tête) détache un membre groupé, y compris pour un simple
      // réordonnancement manuel/priorité sans changement de moment.
      if (!draggedOwnHeader) {
        const left = ids.filter(id => {
          const t = state.todos.find(x => x.id === id);
          if (!t?.groupId) return false;
          this._leaveGroupUnlessWhole(t, ids);
          return !t.groupId;
        });
        if (left.length) saveTodos(state.todos);
      }

      this.dropReorder(ids, draggedGroup, dropTarget, dropBefore);
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
      e.dataTransfer.dropEffect = this._isCopyDrag(e) ? 'copy' : 'move';
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
      this.moveTodoToDate(draggedId, col.dataset.date, e);
    });
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
      openModal(state.navDate, state.todos);
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
      openModal(state.navDate, state.todos);
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
        if (data.config.autoPostpone) localStorage.setItem('autoPostpone', data.config.autoPostpone);
        if (data.config.dictationAuto) localStorage.setItem('dictationAuto', data.config.dictationAuto);
        if (data.config.focusQueueView) localStorage.setItem('focusQueueView', data.config.focusQueueView);
        if (data.config.focusBreakMinutes) localStorage.setItem('focusBreakMinutes', data.config.focusBreakMinutes);
        if (data.config.backlogQueueView) localStorage.setItem('backlogQueueView', data.config.backlogQueueView);
        if (data.config.inboxQueueView)   localStorage.setItem('inboxQueueView',   data.config.inboxQueueView);
        if (data.config.dayLayout)   localStorage.setItem('dayLayout',   data.config.dayLayout);
        if (data.config.agendaPrefs) localStorage.setItem('agendaPrefs', data.config.agendaPrefs);
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
      if (data.backlogOrder) localStorage.setItem('backlogOrder', JSON.stringify(data.backlogOrder));
      if (data.inboxOrder) localStorage.setItem('inboxOrder', JSON.stringify(data.inboxOrder));
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
    stopIfDetached(); // le DOM va être régénéré : ne pas laisser un micro tourner dans le vide
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
    document.body.classList.toggle('view-focus',      state.view === 'focus');
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
    if (state.view==='counters')   html = renderCountersView(state.todos);
    if (state.view==='focus')      html = renderFocusView(this);
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
      const hiddenViews = ['plan', 'categories', 'projects', 'inbox', 'backlog', 'search', 'profile', 'superadmin', 'intentions', 'analyse', 'counters', 'focus'];
      if (hiddenViews.includes(state.view)) {
        sidebar.style.display = 'none';
        sidebar.innerHTML = '';
      } else {
        sidebar.style.display = '';
        sidebar.classList.toggle('collapsed', localStorage.getItem('calSidebarCollapsed') === 'true');
        if (state.view === 'week' || state.view === 'biweek') {
          sidebar.innerHTML = renderWeekSidebar(state.todos);
        } else if (state.view === 'year') {
          sidebar.innerHTML = renderYearSidebar();
        } else {
          sidebar.innerHTML = renderSidebar(state.todos);
        }
      }
    }
    if (state.view === 'day') { this.initDayDragDrop(); this.initDayMiniWeekDragDrop(); this.initTagSectionDragDrop(); this.initDayColResize(); }
    // Grille horaire (mode Agenda) — initDayDragDrop()/initDayColResize()
    // ci-dessus sont des no-op dans ce mode (.day-columns n'existe pas), et
    // réciproquement initAgendaView() ne fait rien en mode Liste.
    if (state.view === 'day' && getDayLayout() === 'agenda') this.initAgendaView(); else this._stopAgendaTick();
    if (state.view === 'week') this.initWeekDragDrop();
    if (state.view === 'month') this.initMonthDragDrop();
    if (state.view === 'search') this.initSearchDragDrop();
    if (state.view === 'plan') this.initPlanDragDrop();
    if (state.view === 'backlog' || state.view === 'inbox') this.initQueueListDnD(state.view);
    if (state.view === 'backlog') this.initBacklogRailDnD();
    if (state.view === 'focus' || this._focusMinimized) this.initFocusView(); else this._stopFocusTick();
    renderFocusPip(this);
    document.querySelector('.focus-tab')?.classList.toggle('active', state.view === 'focus');
    this.initHeaderDropZones();
    this._animateQuickAddBtn();
    this._applyMultilineClasses();
    if (state.view === 'day') { setupTodoItemHoverAnimations(); this._layoutMasonry(); }
    this.initSubtaskDragDrop();
    msRefreshUI();
    // #reviewModalBody existe toujours dans le DOM (juste masqué si le modal
    // est fermé) — le tenir à jour ici, dans le seul point de sortie commun à
    // TOUTE mutation, plutôt que dans chaque action individuelle (cancelMany,
    // completeMany, deleteMany...). Sinon une action lancée depuis le menu
    // contextuel d'un .review-item pendant que le Bilan est ouvert (ex.
    // "Annuler") mute bien les données mais laisse la ligne du modal affichée
    // telle quelle, sans aucun signe que quelque chose a changé.
    this._renderReviewBody();
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

  setPastDisplay(mode) {
    if (state.pastDisplayMode === mode) return;
    state.setPastDisplayMode(mode);
    this.render();
  }

  togglePastDisplay() {
    this.setPastDisplay(state.pastDisplayMode === 'stats' ? 'normal' : 'stats');
  }

  toggleDoneAccordion() {
    const isOpen = localStorage.getItem('dayDoneAccordionOpen') === '1';
    localStorage.setItem('dayDoneAccordionOpen', isOpen ? '0' : '1');
    const acc = document.querySelector('.day-done-accordion');
    if (acc) acc.classList.toggle('open', !isOpen);
  }

  toggleCounterFields(checked) {
    const fields = document.getElementById('counterFields');
    if (fields) fields.style.display = checked ? '' : 'none';
  }

  // ── Endroit (modal) : toggle virtuel / adresse + mini carte Google Maps ─
  toggleLocationVirtual(checked) {
    const field = document.getElementById('locationAddressField');
    if (field) field.style.display = checked ? 'none' : '';
    this.updateLocationMap();
  }

  // Embed sans clé API (`output=embed`) — pas d'intégration Google Maps
  // existante dans le projet (gcal-* concerne Google Calendar, pas Maps).
  updateLocationMap() {
    const virtual = document.getElementById('taskLocationVirtual')?.checked;
    const address = document.getElementById('taskLocationAddress')?.value.trim();
    const wrap  = document.getElementById('locationMapWrap');
    const frame = document.getElementById('locationMapFrame');
    if (!wrap || !frame) return;
    if (virtual || !address) {
      wrap.style.display = 'none';
      frame.src = '';
      return;
    }
    wrap.style.display = '';
    frame.src = `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
  }

  incrementCount(id) {
    const t = state.todos.find(x => x.id === id);
    if (!t || !t.counterEnabled || t.countTo === undefined) return;
    const cur = t.countCurrent ?? t.countFrom ?? 0;
    if (cur >= t.countTo) return;
    snapshot(state.todos);
    t.countCurrent = cur + 1;
    t.updatedAt = Date.now();
    saveTodos(state.todos);
    this.render();
  }

  decrementCount(id) {
    const t = state.todos.find(x => x.id === id);
    if (!t || !t.counterEnabled) return;
    const cur  = t.countCurrent ?? t.countFrom ?? 0;
    const from = t.countFrom ?? 0;
    if (cur <= from) return;
    snapshot(state.todos);
    t.countCurrent = cur - 1;
    t.updatedAt = Date.now();
    saveTodos(state.todos);
    this.render();
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
    event.dataTransfer.effectAllowed = 'copyMove';
    this._setDragGhost(event, taskId);
    // Posé ici (pas seulement via le listener global document/dragstart,
    // voir setupEventListeners) car .review-item-handle appelle
    // event.stopPropagation() avant planDragStart() — l'événement
    // n'atteindrait donc jamais document, et la classe ne serait jamais
    // posée pour un drag démarré depuis le Bilan/bandeau (voir
    // renderOverdueDropZones() en review.js, qui en dépend pour révéler
    // Matin/Après-midi/Soir sur la zone Aujourd'hui)
    document.body.classList.add('is-dragging-task');
  }

  planDrop(event, ds) {
    event.preventDefault();
    const col = event.currentTarget;
    col.classList.remove('drag-over');
    const taskId = event.dataTransfer.getData('text/plain');
    if (taskId) this.assignInboxToDate(taskId, ds, event);
  }

  initPlanDragDrop() {
    document.querySelectorAll('.plan-week-day.drag-over, .plan-inbox-section.drag-over, .plan-backlog-section.drag-over')
      .forEach(el => el.classList.remove('drag-over'));
    this.initPlanResizeHandle();
  }

  // Poignée de partage Ponctuel ↔ Quotidien de la vue jour. N'écrit QUE les
  // variables --day-punct/--day-rec de .day-columns : un grid-template-columns
  // inline gagnerait sur les media queries tablette/mobile (un style inline
  // l'emporte quelle que soit la spécificité), qui doivent au contraire
  // reprendre la main sur le gabarit — cf. .day-col-resize { display:none }.
  initDayColResize() {
    const grid   = document.querySelector('.day-columns');
    const handle = document.getElementById('dayColResize');
    if (!grid || !handle) return;
    const punct = grid.querySelector('.day-col--punctual');
    const rec   = grid.querySelector('.day-col--recurring');
    if (!punct || !rec) return;

    let startX = 0, startW = 0, total = 0, ratio = getDaySplit(), raf = 0;
    // --day-punct + --day-rec == 2 : la 3e colonne (relance, figée à 1fr)
    // garde son tiers, et la somme en pixels des deux premières ne bouge pas
    // pendant le glissement — d'où le ratio calculé sur elles seules.
    const apply = (r) => {
      ratio = clampDaySplit(r);
      grid.style.setProperty('--day-punct', (2 * ratio).toFixed(4) + 'fr');
      grid.style.setProperty('--day-rec',   (2 * (1 - ratio)).toFixed(4) + 'fr');
      // Le nombre de colonnes tenables par .todo-list change avec la largeur :
      // sans ce recalcul les tranches masonry resteraient calées sur
      // l'ancienne hauteur des cartes et les items se recouvriraient.
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; this._layoutMasonry(); });
    };
    const onMove = (e) => apply((startW + e.clientX - startX) / total);
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.classList.remove('day-col-resizing');
      handle.classList.remove('dragging');
      setDaySplit(ratio);
      this._layoutMasonry();
    };
    handle.addEventListener('mousedown', (e) => {
      total  = punct.offsetWidth + rec.offsetWidth;
      if (total <= 0) return;
      startX = e.clientX;
      startW = punct.offsetWidth;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.body.classList.add('day-col-resizing');
      handle.classList.add('dragging');
      e.preventDefault();
    });
    handle.addEventListener('dblclick', () => {
      resetDaySplit();
      apply(DAY_SPLIT_DEFAULT);
      this._layoutMasonry();
    });
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
    if (taskId) this._sendManyTo(this._dropIds(taskId), { date: null, backlog: false }, event);
  }

  planDropToBacklog(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');
    const taskId = event.dataTransfer.getData('text/plain');
    if (taskId) this._sendManyTo(this._dropIds(taskId), { date: null, backlog: true }, event);
  }

  // Applique { date, backlog } à un lot de tâches (drop multiple ou simple)
  _sendManyTo(ids, { date, backlog }, event) {
    const targets = state.todos.filter(t => ids.includes(t.id) && (!t.recurrence || t.recurrence === 'none'));
    if (!targets.length) return;
    snapshot(state.todos);
    const isCopy = this._isCopyDrag(event);
    targets.forEach(t => {
      if (isCopy) this._insertClone(t, { date, backlog });
      else { t.date = date; t.backlog = backlog; t.updatedAt = Date.now(); this._leaveGroupUnlessWhole(t, ids); }
    });
    saveTodos(state.todos);
    if (ids.length > 1) msClear();
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
    this._postpone(t, DS(today()), [id]);
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
    this._leaveGroupUnlessWhole(t, [id]);
    saveTodos(state.todos);
    this.render();
  }

  overdueAllToToday() {
    const todayStr = DS(today());
    const overdue = state.todos.filter(t =>
      t.date && t.date < todayStr && !t.completed && !t.cancelled && (!t.recurrence || t.recurrence === 'none')
    );
    if (!overdue.length) return;
    snapshot(state.todos);
    const movingIds = overdue.map(t => t.id);
    overdue.forEach(t => this._postpone(t, todayStr, movingIds));
    saveTodos(state.todos);
    this.render();
  }

  overdueAllToBacklog() {
    const todayStr = DS(today());
    const overdue = state.todos.filter(t =>
      t.date && t.date < todayStr && !t.completed && !t.cancelled && (!t.recurrence || t.recurrence === 'none')
    );
    if (!overdue.length) return;
    snapshot(state.todos);
    const movingIds = overdue.map(t => t.id);
    overdue.forEach(t => { t.date = null; t.backlog = true; t.updatedAt = Date.now(); this._leaveGroupUnlessWhole(t, movingIds); });
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
      const movingIds = targets.map(t => t.id);
      targets.forEach(t => this._postpone(t, todayStr, movingIds));
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
      const movingIds = targets.map(t => t.id);
      targets.forEach(t => { t.date = null; t.backlog = true; t.updatedAt = Date.now(); this._leaveGroupUnlessWhole(t, movingIds); });
      saveTodos(state.todos);
      this._overdueSelected = new Set();
      this.render();
    } else {
      this.overdueAllToBacklog();
    }
  }

  // ── Bilan / Review — tâches laissées pour compte ─────────────────────────
  // Report d'une ponctuelle vers une nouvelle date en gardant la trace
  // (postponedCount / originalDate) — signal de procrastination pour le bilan.
  // `movingIds` (défaut : t seul) — voir _leaveGroupUnlessWhole() : les
  // appelants qui reportent plusieurs tâches d'un coup (bilan, sélection,
  // report auto) doivent passer l'id de TOUTES pour que déplacer un groupe
  // entier ensemble ne le détache pas.
  _postpone(t, newDateStr, movingIds = [t.id]) {
    if (t.date && t.date !== newDateStr) {
      if (!t.originalDate) t.originalDate = t.date;
      t.postponedCount = (t.postponedCount || 0) + 1;
    }
    t.date = newDateStr;
    t.backlog = false;
    // Un report générique (pas de moment ciblé) ne doit jamais laisser
    // traîner un dayPeriod d'une planification précédente — sinon la tâche
    // réapparaît sous "Soir" alors qu'on l'a justement reportée SANS moment.
    // overdueDropTodayPeriod() repose là-dessus : il repose t.dayPeriod
    // juste après avoir appelé _postpone(), donc rien ne change pour lui.
    delete t.dayPeriod;
    t.updatedAt = Date.now();
    this._leaveGroupUnlessWhole(t, movingIds);
  }

  _autoPostponePass() {
    const todayStr = DS(today());
    const overdue = state.todos.filter(t =>
      (!t.recurrence || t.recurrence === 'none') && t.date && t.date < todayStr && !t.completed && !t.cancelled
    );
    if (!overdue.length) return;
    const movingIds = overdue.map(t => t.id);
    overdue.forEach(t => this._postpone(t, todayStr, movingIds));
    saveTodos(state.todos);
    this._autoPostponedCount = overdue.length;
  }

  _maybeShowReviewPrompt() {
    const todayStr = DS(today());
    if (localStorage.getItem('lastReviewPromptDate') === todayStr) return;
    const overdue = getOverduePunctual(state.todos);
    if (!overdue.length) return;
    localStorage.setItem('lastReviewPromptDate', todayStr);
    const days = new Set(overdue.map(t => t.date)).size;
    const prompt = document.createElement('div');
    prompt.className = 'review-prompt';
    prompt.innerHTML = `
      <span class="review-prompt-icon">⚠</span>
      <span class="review-prompt-text"><strong>${overdue.length} tâche${overdue.length > 1 ? 's' : ''}</strong> laissée${overdue.length > 1 ? 's' : ''} pour compte sur ${days} jour${days > 1 ? 's' : ''}</span>
      <button class="review-prompt-btn" onclick="window.app.openReviewModal();this.closest('.review-prompt').remove()">Faire le bilan</button>
      <button class="review-prompt-close" onclick="this.closest('.review-prompt').remove()" title="Ignorer">×</button>`;
    document.body.appendChild(prompt);
    requestAnimationFrame(() => prompt.classList.add('review-prompt--visible'));
    setTimeout(() => { if (prompt.isConnected) { prompt.classList.remove('review-prompt--visible'); setTimeout(() => prompt.remove(), 400); } }, 15000);
  }

  toggleAutoPostpone() {
    const enabled = document.getElementById('settingsAutoPostponeInput')?.checked;
    localStorage.setItem('autoPostpone', enabled ? 'true' : 'false');
    this._saveConfigChange();
    if (enabled) {
      snapshot(state.todos);
      this._autoPostponedCount = 0;
      this._autoPostponePass();
      if (this._autoPostponedCount) {
        this._showToast(`↪ ${this._autoPostponedCount} tâche${this._autoPostponedCount > 1 ? 's' : ''} reportée${this._autoPostponedCount > 1 ? 's' : ''} à aujourd'hui`);
        this.render();
      }
    }
  }

  // Dictée vocale — pose le bouton micro sur les champs statiques du modal
  // (titre + notes). Les champs de sous-tâche, créés à la volée, sont
  // équipés à leur création (addSubtaskInline,
  // focusAddSubtask, addModalSubtaskInline). Sans support navigateur, rien
  // n'est injecté du tout — pas de bouton mort à l'écran.
  _initDictation() {
    if (!isDictationSupported()) return;
    // #taskTitle / #taskDescription : PAS de wrapper — leur label flottant
    // dépend de `.fl-input:focus ~ .fl-label`, envelopper l'input romprait
    // cette fratrie. Leur .fl-group est déjà en position:relative.
    attachMic(document.getElementById('taskTitle'));
    attachMic(document.getElementById('taskDescription'));
    // #quickInsertInput : même raison que taskTitle — PAS de wrapper, son
    // hint (.quick-insert-hint) dépend de `:not(:placeholder-shown) ~`, un
    // sélecteur de fratrie directe qu'un wrapper romprait. .quick-insert-field
    // est déjà en position:relative.
    attachMic(document.getElementById('quickInsertInput'));
    const section = document.getElementById('settingsDictationSection');
    if (section) section.style.display = '';
  }

  toggleDictationAuto() {
    setAutoDictate(!!document.getElementById('settingsDictationInput')?.checked);
    this._saveConfigChange();
  }

  openReviewModal() {
    const overlay = document.getElementById('reviewModalOverlay');
    if (!overlay) return;
    this._renderReviewBody();
    overlay.classList.remove('hidden');
    history.replaceState({ view: state.view, nav: DS(state.navDate) }, '', this._buildHash({ modal: 'review' }));
  }

  closeReviewModal() {
    document.getElementById('reviewModalOverlay')?.classList.add('hidden');
    history.replaceState({ view: state.view, nav: DS(state.navDate) }, '', this._buildHash());
  }

  _renderReviewBody() {
    const body = document.getElementById('reviewModalBody');
    if (body) body.innerHTML = renderReviewBody(state.todos);
  }

  _reviewMutate(fn) {
    snapshot(state.todos);
    fn();
    saveTodos(state.todos);
    this.render(); // rafraîchit aussi #reviewModalBody, voir render()
  }

  // Grosses zones de dépôt du Bilan (bandeau vue jour + modal) : on drague
  // une tâche — ou toute la sélection multiple si elle en fait partie, via
  // _dropIds() — dessus pour appliquer l'action. Remplace les anciens
  // boutons par-ligne (review-act).
  _reviewDrop(event, mutateEach) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');
    const taskId = event.dataTransfer.getData('text/plain');
    if (!taskId) return;
    const ids = this._dropIds(taskId);
    // Un drop dont aucun id ne correspond à une vraie tâche (module du rail
    // réordonné, section de tag…) ne doit ni créer une entrée d'annulation
    // vide, ni déclencher un render inutile : _reviewMutate() prend son
    // snapshot AVANT de savoir si quoi que ce soit va muter.
    if (!ids.some(id => state.todos.some(t => t.id === id))) return;
    const isCopy = this._isCopyDrag(event);
    this._reviewMutate(() => {
      ids.forEach(id => {
        const t = state.todos.find(x => x.id === id);
        if (!t) return;
        // Copie : la mutation (postpone/complete/cancel/backlog…) s'applique
        // au clone, l'original reste intouché — même snapshot() unique que
        // le reste (_reviewMutate en prend une avant tout ceci).
        mutateEach(isCopy ? this._insertClone(t) : t, ids);
      });
    });
    if (ids.length > 1) msClear();
  }

  overdueDropDone(event) {
    this._reviewDrop(event, t => { t.completed = true; t.updatedAt = Date.now(); });
  }

  overdueDropToday(event) {
    this._reviewDrop(event, (t, ids) => this._postpone(t, DS(today()), ids));
  }

  // Sous-cible « moment » de la zone Aujourd'hui (révélées pendant tout
  // drag via body.is-dragging-task — voir renderOverdueDropZones, review.js)
  overdueDropTodayPeriod(event, period) {
    this._reviewDrop(event, (t, ids) => { this._postpone(t, DS(today()), ids); t.dayPeriod = period; });
  }

  overdueDropTomorrow(event) {
    this._reviewDrop(event, (t, ids) => this._postpone(t, DS(addDays(today(), 1)), ids));
  }

  overdueDropBacklog(event) {
    this._reviewDrop(event, (t, ids) => { t.date = null; t.backlog = true; t.updatedAt = Date.now(); this._leaveGroupUnlessWhole(t, ids); });
  }

  // « Abandonner » dans le Bilan = annuler (trace conservée), pas supprimer
  overdueDropCancel(event) {
    this._reviewDrop(event, t => { t.cancelled = true; t.completed = false; t.updatedAt = Date.now(); });
  }

  // ── Backlog : rail de classement (renderBacklogRail, backlogInboxView.js) ─
  // Même geste que le Bilan, donc même plomberie : tout passe par
  // _reviewDrop(), qui résout la sélection multiple (_dropIds), gère la copie
  // sur Alt/Ctrl/Cmd (_insertClone) et ne prend qu'UN snapshot d'annulation
  // par geste. Seule la mutation change d'une zone à l'autre.
  //
  // Les zones Aujourd'hui / Demain / Fait / Abandonner du rail réutilisent
  // directement les handlers overdueDrop* ci-dessus, sans variante : vérifié
  // que _postpone() n'incrémente postponedCount que si la tâche avait DÉJÀ
  // une date — un item de backlog n'en a jamais, il ne repart donc pas avec
  // un faux compteur de reports, et repasse bien backlog=false.

  backlogDropCategory(event, catId) {
    this._reviewDrop(event, t => {
      const cur = t.categoryIds || (t.categoryId ? [t.categoryId] : []);
      // Ajout, jamais remplacement : une tâche peut porter plusieurs
      // étiquettes (le modal en pose plusieurs), classer par glisser ne doit
      // pas en effacer une au passage. La zone « Sans étiquette » (catId
      // vide) est la seule à retirer quoi que ce soit.
      const next = catId ? (cur.includes(catId) ? cur : [...cur, catId]) : [];
      if (next.length) t.categoryIds = next; else delete t.categoryIds;
      delete t.categoryId; // format mono-id legacy, déjà migré au démarrage
      t.updatedAt = Date.now();
    });
  }

  backlogDropPriority(event, prio) {
    this._reviewDrop(event, t => {
      if (prio) t.priority = prio; else delete t.priority;
      t.updatedAt = Date.now();
    });
  }

  // Horizon → date d'échéance concrète. `deadlineHorizonDS()` vit dans
  // backlogInboxView.js et sert AUSSI aux compteurs/filtres des zones : une
  // seule définition, sinon un item déposé sur « Ce mois-ci » pourrait ne pas
  // apparaître dans le compte de cette même zone. Calculée une fois avant le
  // drop, pas par item : tout le lot reçoit la même échéance.
  backlogDropDeadline(event, horizon) {
    const ds = deadlineHorizonDS(horizon);
    this._reviewDrop(event, t => {
      if (ds) t.deadline = ds; else delete t.deadline;
      t.updatedAt = Date.now();
    });
  }

  // Sortir du backlog sans planifier : redevient une tâche d'Inbox (sans date)
  backlogDropInbox(event) {
    this._reviewDrop(event, (t, ids) => {
      t.backlog = false;
      t.date = null;
      t.updatedAt = Date.now();
      this._leaveGroupUnlessWhole(t, ids);
    });
  }

  // Accordéon « Abandonnées » du Backlog — un item annulé y est la SEULE
  // trace visible (sans date, il n'apparaît sur aucun jour). Patch DOM ciblé
  // comme toggleDoneAccordion(), pas de render() complet.
  toggleBacklogCancelled() {
    const isOpen = localStorage.getItem('backlogCancelledOpen') === '1';
    localStorage.setItem('backlogCancelledOpen', isOpen ? '0' : '1');
    const acc = document.querySelector('.backlog-cancelled');
    if (acc) acc.classList.toggle('open', !isOpen);
  }

  backlogDropProject(event, id) {
    this._reviewDrop(event, t => {
      const cur = t.projectIds || (t.projectId ? [t.projectId] : []);
      const next = id ? (cur.includes(id) ? cur : [...cur, id]) : [];
      if (next.length) t.projectIds = next; else delete t.projectIds;
      delete t.projectId; // format mono-id legacy, déjà migré au démarrage
      t.updatedAt = Date.now();
    });
  }

  backlogDropIntention(event, id) {
    this._reviewDrop(event, t => {
      const cur = t.intentionIds || (t.intentionId ? [t.intentionId] : []);
      const next = id ? (cur.includes(id) ? cur : [...cur, id]) : [];
      if (next.length) t.intentionIds = next; else delete t.intentionIds;
      delete t.intentionId;
      t.updatedAt = Date.now();
    });
  }

  // 0 = zone « Sans estimation » (retire la valeur)
  backlogDropEstimate(event, minutes) {
    this._reviewDrop(event, t => {
      if (minutes > 0) t.durationEstimated = minutes; else delete t.durationEstimated;
      t.updatedAt = Date.now();
    });
  }

  // ── Rail : épinglage, repli, ordre, filtre ───────────────────────────────
  // `prefs.rail` porte à lui seul l'épinglage ET l'ordre (cf.
  // backlogInboxView.js), et vit dans backlogQueueView : déjà persisté et
  // synchronisé entre appareils, aucune clé supplémentaire.
  toggleRailPin(key) {
    const p = getListPrefs('backlog');
    const pins = getRailPins(p);
    const next = pins.includes(key) ? pins.filter(k => k !== key) : [...pins, key];
    p.rail = next;
    p.railFold = getRailFolds(p).filter(k => next.includes(k)); // un module détaché ne garde pas son repli
    saveListPrefs('backlog', p);
    this._saveConfigChange();
    // Le filtre actif n'a plus de zone où se lire NI se retirer si son module
    // quitte le rail — on le lève plutôt que de laisser une liste filtrée
    // sans aucun moyen visible de revenir en arrière.
    const f = getRailFilter();
    if (f && !next.includes(f.mod)) setRailFilter(null);
    this.render();
  }

  toggleRailFold(key) {
    const p = getListPrefs('backlog');
    const folds = getRailFolds(p);
    p.rail = getRailPins(p);
    p.railFold = folds.includes(key) ? folds.filter(k => k !== key) : [...folds, key];
    saveListPrefs('backlog', p);
    this._saveConfigChange();
    // Patch DOM ciblé (pas de render()) pour profiter de la transition CSS
    document.querySelector(`.rail-mod[data-mod="${key}"]`)?.classList.toggle('folded');
  }

  // Clic sur une zone = filtrer la liste sur cette valeur ; re-clic = retirer.
  // `railFilter(null)` (chip d'en-tête, état vide) lève le filtre.
  // Volontairement NON synchronisé entre appareils — voir setRailFilter().
  railFilter(mod, val) {
    const cur = getRailFilter();
    const same = !!cur && !!mod && cur.mod === mod && cur.val === val;
    setRailFilter(mod && !same ? { mod, val } : null);
    msClear(); // une sélection faite avant le filtre ne correspond plus à l'écran
    this.render();
  }

  // Réordonnancement des modules du rail (glisser leur en-tête). Ne pose
  // JAMAIS de `text/plain` : _reviewDrop() sort immédiatement sur un id vide,
  // donc lâcher un module sur une zone de classement ne peut rien muter. Le
  // stopPropagation() du dragstart empêche aussi body.is-dragging-task d'être
  // posé par le listener global (sinon la zone Aujourd'hui basculerait sur
  // ses sous-cibles pendant qu'on réorganise le rail).
  initBacklogRailDnD() {
    const wrap = document.getElementById('backlogRailMods');
    if (!wrap || wrap.dataset.dndBound) return;
    wrap.dataset.dndBound = '1';
    let dragEl = null;

    wrap.addEventListener('dragstart', e => {
      const hd = e.target.closest('.rail-mod-hd');
      if (!hd) return;
      e.stopPropagation();
      dragEl = hd.closest('.rail-mod');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('application/x-rail-mod', dragEl.dataset.mod);
      requestAnimationFrame(() => dragEl?.classList.add('rail-mod--dragging'));
    });

    wrap.addEventListener('dragover', e => {
      if (!dragEl) return;
      e.preventDefault();
      e.stopPropagation();
      const over = e.target.closest('.rail-mod');
      if (!over || over === dragEl) return;
      const r = over.getBoundingClientRect();
      // Le rail est un bandeau : les modules sont côte à côte (comparer X),
      // sauf en écran étroit où ils s'empilent en pleine largeur (comparer Y).
      // La largeur du module survolé suffit à distinguer les deux cas — pas
      // besoin d'un état ni d'un media query dupliqué en JS.
      const horiz = r.width < wrap.clientWidth * 0.85;
      const after = horiz ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2;
      wrap.insertBefore(dragEl, after ? over.nextSibling : over);
    });

    wrap.addEventListener('drop', e => { if (dragEl) { e.preventDefault(); e.stopPropagation(); } });

    wrap.addEventListener('dragend', () => {
      if (!dragEl) return;
      dragEl.classList.remove('rail-mod--dragging');
      dragEl = null;
      // L'ordre du DOM EST l'ordre final (déplacé en direct au survol) —
      // rien à re-rendre, juste à persister.
      const p = getListPrefs('backlog');
      p.rail = [...wrap.querySelectorAll('.rail-mod')].map(el => el.dataset.mod);
      p.railFold = getRailFolds(p);
      saveListPrefs('backlog', p);
      this._saveConfigChange();
    });
  }

  reviewAllToday() {
    this._reviewMutate(() => {
      const todayStr = DS(today());
      const overdue = getOverduePunctual(state.todos);
      const movingIds = overdue.map(t => t.id);
      overdue.forEach(t => this._postpone(t, todayStr, movingIds));
    });
  }

  reviewAllBacklog() {
    this._reviewMutate(() => {
      const overdue = getOverduePunctual(state.todos);
      const movingIds = overdue.map(t => t.id);
      overdue.forEach(t => { t.date = null; t.backlog = true; t.updatedAt = Date.now(); this._leaveGroupUnlessWhole(t, movingIds); });
    });
  }

  // Bandeau vue du jour (aujourd'hui uniquement) : reporter à aujourd'hui
  // les ponctuelles non faites des `days` derniers jours, peu importe leur
  // propre date — le rappel suit l'utilisateur sur aujourd'hui
  postponeRecentOverdueToToday(days = 5) {
    const cutoff = DS(addDays(today(), -days));
    const targets = getOverduePunctual(state.todos).filter(t => t.date >= cutoff);
    if (!targets.length) return;
    snapshot(state.todos);
    const todayStr = DS(today());
    const movingIds = targets.map(t => t.id);
    targets.forEach(t => this._postpone(t, todayStr, movingIds));
    saveTodos(state.todos);
    this._showToast(`↪ ${targets.length} tâche${targets.length > 1 ? 's' : ''} reportée${targets.length > 1 ? 's' : ''} à aujourd'hui`);
    this.render();
  }

  // Replie/déplie la liste de tâches du bandeau de rappel (vue jour)
  togglePastDueBanner() {
    const collapsed = localStorage.getItem('pastDueBannerCollapsed') === 'true';
    localStorage.setItem('pastDueBannerCollapsed', String(!collapsed));
    this.render();
  }

  // Replie/déplie la colonne calendrier (mini calendrier + options, sidebar
  // #calSidebar — day/week/month/year partagent le même élément). Patch DOM
  // ciblé (pas de render() complet) pour profiter de la transition CSS de
  // largeur ; l'onglet reste toujours visible, replié ou non.
  toggleCalSidebar() {
    const collapsed = localStorage.getItem('calSidebarCollapsed') === 'true';
    const next = !collapsed;
    localStorage.setItem('calSidebarCollapsed', String(next));
    const sidebar = document.getElementById('calSidebar');
    sidebar?.classList.toggle('collapsed', next);
    const btn = sidebar?.querySelector('.cal-sidebar-handle');
    if (btn) btn.title = next ? 'Déplier le calendrier' : 'Replier le calendrier';
    sidebar?.querySelector('.cal-sidebar-handle-chevron')?.classList.toggle('collapsed', next);
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
        e.dataTransfer.dropEffect = this._isCopyDrag(e) ? 'copy' : 'move';
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
        onDrop(taskId, e);
      });
    };

    setup(inboxBtn, (id, e) => {
      this._sendManyTo(this._dropIds(id), { date: null, backlog: false }, e);
      this._closeSearchView();
    });

    setup(backlogBtn, (id, e) => {
      this._sendManyTo(this._dropIds(id), { date: null, backlog: true }, e);
      this._closeSearchView();
    });

    if (todayBtn) {
      setup(todayBtn, (id, e) => {
        this._sendManyTo(this._dropIds(id), { date: DS(new Date()), backlog: false }, e);
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
        // Filet de sécurité pour le highlight des cibles externes de
        // initDayDragDrop() (Matin/Après-midi/Soir/titre "Aujourd'hui") :
        // leur dragend ne bubble pas jusqu'à .day-columns (source hors de ce
        // conteneur), donc son propre nettoyage ne se déclenche jamais pour
        // elles — utile si le drag est annulé (Échap) pendant leur survol.
        document.querySelectorAll('.day-heure-label.drop-target, .day-col-title-row.drop-target').forEach(el => el.classList.remove('drop-target'));
      });
    }
  }

  // Custom drag ghost: small card with task title (+ count badge when
  // dragging a multi-selection). titleOverride : titre du groupe quand on
  // drague un task-group-header (taskId n'est alors qu'un membre du groupe,
  // pas le titre à afficher)
  _setDragGhost(event, taskId, titleOverride) {
    const t = state.todos.find(x => x.id === taskId);
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.textContent = titleOverride || (t ? t.title : '…');
    const multi = this._dragMultiIds;
    if (multi && multi.length > 1 && multi.includes(taskId)) {
      ghost.classList.add('drag-ghost--multi');
      const badge = document.createElement('span');
      badge.className = 'drag-ghost-count';
      badge.textContent = multi.length;
      ghost.appendChild(badge);
    }
    document.body.appendChild(ghost);
    event.dataTransfer.setDragImage(ghost, 12, 12);
    requestAnimationFrame(() => ghost.remove());
  }

  // Ids concernés par un drop : la sélection multiple entière si l'item
  // déposé en fait partie, sinon juste lui.
  _dropIds(primaryId) {
    const m = this._dragMultiIds;
    return (m && m.length > 1 && m.includes(primaryId)) ? [...m] : [primaryId];
  }

  // Copie-sur-drag : maintenir Alt/Ctrl/Cmd pendant le lâcher (comme
  // Finder/Explorer) copie la tâche au lieu de la déplacer — vérifié sur
  // l'event du drop/dragend (pas figé au dragstart), donc la touche peut
  // être pressée/relâchée en cours de geste. `event` est optionnel (les
  // DnD non concernées, ex. file « Ensuite » du Focus, n'en passent pas).
  _isCopyDrag(event) {
    return !!(event && (event.altKey || event.ctrlKey || event.metaKey));
  }

  // Clone identique (mêmes règles que duplicateTodo/duplicateMany : reset
  // complété + sous-tâches + compteur) inséré juste après l'original SANS
  // le modifier — pas de snapshot()/saveTodos() ici : à la charge de
  // l'appelant, pour rester dans la même transaction undo que la mutation
  // qui suit (date/backlog/moment/priorité…) plutôt que deux entrées
  // distinctes dans la pile d'annulation pour un seul geste de drag.
  _insertClone(t, overrides = {}) {
    // Compteur monotone en plus de Date.now() : un drag de multi-sélection
    // (ou d'un groupe entier) appelle _insertClone() plusieurs fois dans la
    // même boucle synchrone, donc dans la même milliseconde — Date.now()
    // seul collisionnerait (même id pour deux clones distincts).
    this._cloneSeq = (this._cloneSeq || 0) + 1;
    const cloneId = (Date.now() + this._cloneSeq).toString();
    const clone = { ...JSON.parse(JSON.stringify(t)), id: cloneId, completed: false, completedDates: [], updatedAt: parseInt(cloneId) };
    if (clone.counterEnabled) clone.countCurrent = clone.countFrom ?? 0;
    if (Array.isArray(clone.subtasks)) clone.subtasks = clone.subtasks.map(s => ({ ...s, completed: false, ...(s.subtasks?.length ? { subtasks: s.subtasks.map(ss => ({ ...ss, completed: false })) } : {}) }));
    Object.assign(clone, overrides);
    const idx = state.todos.findIndex(x => x.id === t.id);
    state.todos.splice(idx + 1, 0, clone);
    return clone;
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
    const overdue   = state.todos.filter(t => t.date && t.date < todayDS && !t.completed && !t.cancelled && (!t.recurrence || t.recurrence === 'none')).length;
    const highPrio  = state.todos.filter(t => t.priority === 'high' && !t.completed && !t.cancelled).length;
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

  // /global-quotes only exists on the local dev API server (server.js) —
  // never ported to api/, so this always silently no-ops in production
  // today. Guarded explicitly rather than left to fail quietly: the
  // superadmin UI (_renderSuperadminInner) shows a banner instead of a
  // false "saved" state when !IS_LOCAL.
  async _loadGlobalQuotes() {
    if (!IS_LOCAL) return;
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
    if (!IS_LOCAL) { this._showToast('⚠ Citations globales indisponibles en production — non sauvegardé'); return; }
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
    const prodNotice = IS_LOCAL ? '' : `
      <div class="sa-prod-notice">⚠ Citations globales indisponibles en production — cette section ne fonctionne qu'en local (<code>npm run server</code>). Les modifications ci-dessous ne seront pas sauvegardées.</div>`;
    return `<div class="superadmin-view">${prodNotice}${this._renderSuperadminInner()}</div>`;
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
    try {
      await updateUserProfile(name);
    } catch {
      this._showToast('Nom enregistré localement — connexion indisponible pour synchroniser');
    }
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
    pushToSupabase(getFullBackup(state.todos));
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
    pushToSupabase(getFullBackup(state.todos));
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
      if (t && !t.completed && !t.cancelled) { t.completed = true; changed = true; }
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
  async saveAvatar()           { await saveAvatar(); localStorage.setItem('_localWriteTime', Date.now().toString()); this._updateUserBtn(); pushToSupabase(getFullBackup(state.todos)); }
  cropDragStart(e)             { cropDragStart(e); }
  setCropZoom(val)             { setCropZoom(val); }
  setEmojiZoom(val)            { setEmojiZoom(val); }

  openAdminSection(section) {
    openAdminModal();
    setTimeout(() => showAdminSection(section), 50);
  }

  async profileDeleteData() {
    if (!confirm('Effacer toutes tes données ? Cette action est irréversible.')) return;
    await deleteUserData();
    Object.keys(localStorage).filter(k => !k.startsWith('sb-')).forEach(k => localStorage.removeItem(k));
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

  // ── Empilement masonry des listes de la vue jour ────────────────────────
  // Une grille CSS raisonne par RANGÉE : une carte courte à côté d'une carte
  // haute laisse un grand vide (et s'étirait même à sa hauteur avant
  // `align-items: start`, cf. .day-col dans styles.scss). On découpe donc les
  // rangées en tranches de MASONRY_ROW px et on donne à chaque enfant autant
  // de tranches que sa hauteur réelle. Ça ne suffit pas seul : sans assigner
  // aussi la COLONNE de chaque item, le placement auto du navigateur reste
  // 1 item par colonne sur la 1re rangée (checkup/suivi/Tablettes Storage →
  // 3 colonnes occupées même si les deux premières tiennent ensemble dans la
  // hauteur de la 3e) — `_packColumns()` calcule donc, par petits groupes
  // d'items consécutifs (DOM order jamais changé, donc l'ordre manuel et le
  // drag-and-drop restent inchangés), la colonne qui minimise la hauteur max
  // ; item 1+2 finissent alors empilés dans la même colonne si ça les fait
  // tenir sous la hauteur du plus grand voisin. Les éléments pleine-largeur
  // (en-tête de groupe, input de saisie inline) gardent leur `grid-column:
  // 1/-1` du CSS — jamais écrasé par une colonne explicite — et servent de
  // coupure : l'empilement recommence à zéro juste après.
  // Mesure PUIS pose de la classe dans la même tâche JS : jamais d'état
  // intermédiaire où .masonry serait active avec des --rspan encore absents.
  _layoutMasonry() {
    const ROW = 4, GAP = 10; // ROW = .todo-list.masonry grid-auto-rows, GAP = row-gap d'origine
    if (!this._masonryRO && window.ResizeObserver) {
      // Le contenu d'un item change de hauteur sans re-render : survol (slot
      // du « + » sous-tâche), repli/dépli de la checklist, édition en place
      // d'une estimation… sans ce recalcul l'item déborderait de ses tranches
      // et recouvrirait son voisin du dessous.
      this._masonryRO = new ResizeObserver(entries => {
        entries.forEach(e => this._updateMasonrySpan(e.target));
      });
    }
    this._masonryRO?.disconnect();
    // Ponctuel seulement — le Quotidien reste une grille N-par-ligne stricte
    // (chaque tâche garde sa propre cellule, même si ça laisse un vide sous
    // une tâche courte à côté d'une plus haute) : Hugues a explicitement
    // choisi ce comportement plutôt que l'empilement masonry, qui rendait
    // « 2 colonnes » imprévisible dès que les tâches d'un même moment
    // n'avaient pas des hauteurs proches (ex. une tâche à sous-tâches à côté
    // de deux tâches simples — ces deux dernières finissaient empilées dans
    // la même colonne au lieu d'être chacune sur leur ligne).
    document.querySelectorAll('.day-col--punctual .todo-list').forEach(list => {
      const cs = getComputedStyle(list);
      const cols = cs.display === 'grid' ? cs.gridTemplateColumns.split(' ').filter(Boolean).length : 1;
      const kids = [...list.children];
      if (cols < 2) {
        list.classList.remove('masonry');
        kids.forEach(el => { el.style.removeProperty('--rspan'); el.style.removeProperty('grid-column'); });
        return;
      }
      const spans = kids.map(el => Math.max(1, Math.ceil((el.getBoundingClientRect().height + GAP) / ROW)));
      kids.forEach((el, i) => el.style.setProperty('--rspan', spans[i]));
      // Coupures pleine-largeur : jamais de colonne explicite dessus (leur
      // CSS pose déjà 1/-1), l'empilement des items normaux repart à zéro
      // juste après pour ne pas fausser l'équilibrage sur toute la liste.
      let segment = [];
      const flushSegment = () => {
        if (!segment.length) return;
        const heights = segment.map(el => el.getBoundingClientRect().height + GAP);
        this._packColumns(heights, cols).forEach((c, i) => segment[i].style.setProperty('grid-column', c + 1));
        segment = [];
      };
      kids.forEach(el => {
        if (el.matches('.task-group-header, .ctx-title-input, .drop-gap')) {
          el.style.removeProperty('grid-column');
          flushSegment();
        } else {
          segment.push(el);
        }
      });
      flushSegment();
      list.classList.add('masonry');
      kids.forEach(el => this._masonryRO?.observe(el));
    });
  }

  // Partitionne `heights` (dans l'ordre du DOM) en au plus `cols` groupes
  // contigus en minimisant la hauteur max d'un groupe (recherche binaire sur
  // la capacité + vérif gloutonne — variante « masonry équilibré » du
  // problème classique de partition d'un tableau en K sous-tableaux). Renvoie
  // l'index de colonne (0-based) de chaque item ; les colonnes en trop
  // restent simplement vides plutôt que d'être forcées à 1 item chacune.
  _packColumns(heights, cols) {
    if (!heights.length) return [];
    const groupsFor = capacity => {
      let groups = 1, sum = 0;
      for (const h of heights) {
        if (sum > 0 && sum + h > capacity) { groups++; sum = 0; }
        sum += h;
      }
      return groups;
    };
    let lo = Math.max(...heights), hi = heights.reduce((a, b) => a + b, 0);
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (groupsFor(mid) <= cols) hi = mid; else lo = mid + 1;
    }
    const capacity = lo, colOf = [];
    let col = 0, sum = 0;
    for (const h of heights) {
      if (sum > 0 && sum + h > capacity) { col++; sum = 0; }
      colOf.push(col);
      sum += h;
    }
    return colOf;
  }

  _updateMasonrySpan(el) {
    if (!el.parentElement?.classList.contains('masonry')) return;
    const span = Math.max(1, Math.ceil((el.getBoundingClientRect().height + 10) / 4));
    if (el.style.getPropertyValue('--rspan') !== String(span)) el.style.setProperty('--rspan', span);
  }


  // ═══════════════════════════════════════════════════
  // VUE AGENDA (vue jour, grille horaire — agendaView.js)
  // ═══════════════════════════════════════════════════

  // Bascule Liste ⇄ Agenda. Réglage synchronisé (getAppConfig/_applyBackup) :
  // c'est une préférence d'affichage durable, pas un état de session.
  // Choix explicite d'un mode (segmented control Liste|Agenda) — idempotent,
  // contrairement à toggleDayLayout() qui sert au raccourci Alt+A.
  setDayLayout(mode) {
    const next = mode === 'agenda' ? 'agenda' : 'list';
    if (next === getDayLayout() && state.view === 'day') return;
    this._applyDayLayout(next);
  }

  toggleDayLayout() {
    this._applyDayLayout(getDayLayout() === 'agenda' ? 'list' : 'agenda');
  }

  _applyDayLayout(next) {
    localStorage.setItem('dayLayout', next);
    this._saveConfigChange();
    if (state.view !== 'day') {
      // setNavDateAndView est async (elle rend elle-même) : on centre sur
      // l'heure une fois son rendu passé, pas avant que la grille existe.
      Promise.resolve(this.setNavDateAndView(state.navDate, 'day'))
        .then(() => { if (next === 'agenda') this.agendaScrollToNow({ smooth: false }); });
      return;
    }
    this.render();
    if (next === 'agenda') this.agendaScrollToNow({ smooth: false });
  }

  setAgendaZoom(px) {
    saveAgendaPrefs({ zoom: px });
    this._saveConfigChange();
    this.render();
    this.agendaScrollToNow({ smooth: false });
  }

  toggleAgendaNight() {
    const p = getAgendaPrefs();
    saveAgendaPrefs({ night: !p.night });
    this._saveConfigChange();
    this.render();
  }

  toggleAgendaRec(key) {
    const p = getAgendaPrefs();
    saveAgendaPrefs({ rec: { ...p.rec, [key]: p.rec[key] === false } });
    this._saveConfigChange();
    this.render();
  }

  // Centre la ligne « maintenant » dans le conteneur défilant. Sans elle
  // (jour passé/futur, ou heure hors des bandes affichées), remonte en haut.
  agendaScrollToNow(opts = {}) {
    const scroll = document.getElementById('agendaScroll');
    if (!scroll) return;
    const now = document.getElementById('agendaNow');
    if (!now) { scroll.scrollTop = 0; return; }
    const top = now.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop;
    scroll.scrollTo({ top: Math.max(0, top - scroll.clientHeight / 3), behavior: opts.smooth === false ? 'auto' : 'smooth' });
  }

  // Résout la cible sous le curseur pendant un drag : une plage horaire dans
  // une bande (calage 15 min, 5 min avec Alt) ou une bande « sans heure ».
  // Le hit-test remonte depuis e.target, donc survoler un autre bloc renvoie
  // quand même la position horaire correspondante dans son canevas.
  // Minute courante — seulement si le jour AFFICHÉ est aujourd'hui. Relue à
  // chaque appel (jamais figée au rendu) pour que l'ancrage « maintenant »
  // reste juste même après une longue session sans re-render.
  _agendaNowMinutes() {
    if (DS(state.navDate) !== DS(today())) return null;
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  }

  _agendaHit(e) {
    const canvas = e.target.closest?.('.agenda-canvas');
    if (canvas) {
      const r = canvas.getBoundingClientRect();
      const px = parseFloat(canvas.dataset.px) || 72;
      const from = parseInt(canvas.dataset.from, 10);
      const to = parseInt(canvas.dataset.to, 10);
      const step = e.altKey ? FINE_SNAP_MIN : SNAP_MIN;
      const raw = from + ((e.clientY - r.top) / px) * 60;
      const bounds = [from, to - MIN_BLOCK_MIN];
      const now = this._agendaNowMinutes();
      const minutes = Math.max(bounds[0], Math.min(bounds[1], snapWithNow(raw, step, now, bounds)));
      return { kind: 'time', canvas, minutes, period: canvas.dataset.period, px, from, isNow: now != null && minutes === now };
    }
    const strip = e.target.closest?.('.agenda-flex-strip');
    if (strip) return { kind: 'flex', strip, period: strip.dataset.period || '' };
    return null;
  }

  // Déplacement (drag natif) : pose l'heure d'arrivée et DÉRIVE le moment de
  // cette heure — c'est ce qui garantit que la vue Liste (groupée par
  // dayPeriod) et l'agenda racontent toujours la même chose. La durée est
  // préservée ; `endTime` n'est réécrit que si la tâche en avait déjà un
  // (ne jamais inventer une heure de fin qui n'existait pas).
  _agendaMoveTo(ids, minutes, event) {
    const period = periodForMinutes(minutes);
    let occ = this._resolveOccurrences(ids);
    if (!occ.length) return;
    snapshot(state.todos);
    if (this._isCopyDrag(event)) {
      occ = occ.map(({ t, ds }) => ({ t: this._insertClone(t), ds }));
    }
    const targetDs = DS(state.navDate);
    occ.forEach(({ t, ds }) => {
      // eff EST t lui-même pour une ponctuelle (resolveOccurrence renvoie la
      // même référence sans override) : tout ce qu'on lit dessus doit l'être
      // AVANT la moindre mutation, sinon on relit ce qu'on vient d'écrire.
      const eff = resolveOccurrence(t, ds);
      const hadEnd = parseHM(eff.endTime) != null;
      const dur = blockMinutes(eff);
      const changed = (eff.dayPeriod || '') !== period;
      // Tâche venue d'ailleurs (bandeau des retards, onglet Inbox/Backlog) :
      // lui poser une heure sans la DATER la laisserait sur son ancien jour,
      // donc invisible juste après le drop. Même chemin que la zone
      // « Aujourd'hui » du Bilan (postponedCount, originalDate, sortie de
      // backlog, détachement du groupe) — jamais une simple affectation de date.
      const moved = this._agendaLandOnDay(t, targetDs, ids);
      setOccurrenceField(t, ds, 'startTime', fmtHM(minutes));
      if (hadEnd) setOccurrenceField(t, ds, 'endTime', fmtHM(Math.min(24 * 60 - 1, minutes + dur)));
      setOccurrenceField(t, ds, 'dayPeriod', period);
      t.updatedAt = Date.now();
      if (changed && !moved) this._leaveGroupUnlessWhole(t, ids);
    });
    saveTodos(state.todos);
    this.render();
  }

  // Ramène une ponctuelle sur le jour affiché si elle n'y était pas (drag
  // entrant depuis le bandeau des retards ou un onglet du header). Renvoie
  // true si un report a réellement eu lieu — _postpone() ayant déjà fait le
  // détachement de groupe, l'appelant ne doit pas le refaire.
  _agendaLandOnDay(t, targetDs, ids) {
    if (t.recurrence && t.recurrence !== 'none') return false;
    if (t.date === targetDs && !t.backlog) return false;
    this._postpone(t, targetDs, ids);
    return true;
  }

  // Dépôt dans une bande « sans heure » : l'heure est retirée, le moment
  // devient celui de la bande (ou disparaît pour « Sans moment »).
  _agendaUnschedule(ids, period, event) {
    let occ = this._resolveOccurrences(ids);
    if (!occ.length) return;
    snapshot(state.todos);
    if (this._isCopyDrag(event)) {
      occ = occ.map(({ t, ds }) => ({ t: this._insertClone(t), ds }));
    }
    const targetDs = DS(state.navDate);
    occ.forEach(({ t, ds }) => {
      const changed = (resolveOccurrence(t, ds).dayPeriod || '') !== (period || '');
      const moved = this._agendaLandOnDay(t, targetDs, ids);
      setOccurrenceField(t, ds, 'startTime', null);
      setOccurrenceField(t, ds, 'endTime', null);
      setOccurrenceField(t, ds, 'dayPeriod', period || null);
      t.updatedAt = Date.now();
      if (changed && !moved) this._leaveGroupUnlessWhole(t, ids);
    });
    saveTodos(state.todos);
    this.render();
  }

  // Redimensionnement : écrit endTime ET durationEstimated, pour que le
  // badge de durée de la vue jour, l'objectif du mode Focus et la hauteur du
  // bloc parlent toujours du même nombre (décision produit assumée).
  _agendaResizeCommit(id, ds, minutes) {
    const t = state.todos.find(x => x.id === id);
    if (!t) return;
    const eff = resolveOccurrence(t, ds);
    const start = parseHM(eff.startTime);
    if (start == null) return;
    const dur = Math.max(MIN_BLOCK_MIN, Math.min(24 * 60 - 1 - start, minutes));
    if (dur === blockMinutes(eff) && parseHM(eff.endTime) != null) return;
    snapshot(state.todos);
    setOccurrenceField(t, ds, 'endTime', fmtHM(start + dur));
    setOccurrenceField(t, ds, 'durationEstimated', dur);
    t.updatedAt = Date.now();
    saveTodos(state.todos);
    this.render();
  }

  // Création par glisser sur une plage vide (ou double-clic → 30 min) :
  // saisie inline du titre à l'emplacement dessiné, jamais un prompt() natif.
  _agendaCreateAt(period, startMin, endMin) {
    const canvas = document.querySelector(`.agenda-canvas[data-period="${period}"]`);
    if (!canvas) return;
    const px = parseFloat(canvas.dataset.px) || 72;
    const from = parseInt(canvas.dataset.from, 10);
    const dur = Math.max(MIN_BLOCK_MIN, endMin - startMin);
    const holder = document.createElement('div');
    holder.className = 'agenda-create-input';
    holder.style.setProperty('--top', `${((startMin - from) / 60) * px}px`);
    holder.style.setProperty('--h', `${Math.max(24, (dur / 60) * px)}px`);
    const label = document.createElement('span');
    label.className = 'agenda-create-time';
    label.textContent = `${fmtHM(startMin)} – ${fmtHM(startMin + dur)}`;
    holder.appendChild(label);
    canvas.appendChild(holder);
    this._inlineInput('Titre de la tâche…', title => {
      snapshot(state.todos);
      addTask({
        title,
        date: DS(state.navDate),
        recurrence: 'none',
        dayPeriod: periodForMinutes(startMin),
        startTime: fmtHM(startMin),
        endTime: fmtHM(startMin + dur),
        durationEstimated: dur,
      }, state.todos);
      saveTodos(state.todos);
      this.render();
    }, el => holder.appendChild(el));
    // Le champ retiré (Entrée/Échap/blur) laisse sinon l'esquisse à l'écran :
    // _inlineInput ne connaît que son <input>, pas le cadre qui l'entoure.
    const obs = new MutationObserver(() => {
      if (!holder.querySelector('.ctx-title-input')) { holder.remove(); obs.disconnect(); }
    });
    obs.observe(holder, { childList: true });
  }

  // Rafraîchit la ligne « maintenant » sans re-render (un render() complet
  // toutes les minutes détruirait un drag/resize en cours et remonterait le
  // scroll). Tick d'une minute, arrêté dès qu'on quitte l'agenda.
  _agendaTickNow() {
    const line = document.getElementById('agendaNow');
    if (!line) return;
    const canvas = line.closest('.agenda-canvas');
    if (!canvas) return;
    const px = parseFloat(canvas.dataset.px) || 72;
    const from = parseInt(canvas.dataset.from, 10);
    const to = parseInt(canvas.dataset.to, 10);
    const n = new Date();
    const mins = n.getHours() * 60 + n.getMinutes();
    // Sorti de la bande affichée (on a passé minuit, ou franchi une frontière
    // de moment) → un render() complet remettra la ligne dans la bonne bande.
    if (mins < from || mins > to) { this.render(); return; }
    line.style.setProperty('--t', `${((mins - from) / 60) * px}px`);
    const lbl = line.querySelector('.agenda-now-label');
    if (lbl) lbl.textContent = fmtHM(mins);
  }

  _stopAgendaTick() {
    if (this._agendaTimer) { clearInterval(this._agendaTimer); this._agendaTimer = null; }
  }

  // ── Câblage des gestes de la grille ────────────────────────────────────
  // Déplacement = drag natif HTML5 (comme partout dans l'app : garde le
  // copier-sur-Alt, le drag d'une multi-sélection, les dépôts vers les
  // onglets du header et les drags entrants du bandeau des retards).
  // Redimensionnement et création = pointer events (aucun besoin de sortir
  // de la grille, et le drag natif est trop grossier pour ces deux gestes-là).
  initAgendaView() {
    this._stopAgendaTick();
    const wrap = document.querySelector('.agenda-wrap');
    if (!wrap) return;
    this._agendaTimer = setInterval(() => this._agendaTickNow(), 60000);

    let ghost = null;
    const clearGhost = () => { ghost?.remove(); ghost = null; wrap.querySelectorAll('.agenda-flex-strip.drop-target').forEach(el => el.classList.remove('drop-target')); };

    wrap.addEventListener('dragstart', e => {
      const el = e.target.closest('.agenda-block[data-id], .agenda-chip[data-id]');
      if (!el) return;
      e.dataTransfer.effectAllowed = 'copyMove';
      e.dataTransfer.setData('text/plain', el.dataset.id);
      this._setDragGhost(e, el.dataset.id);
      wrap.classList.add('agenda-dragging');
      requestAnimationFrame(() => el.classList.add('dragging'));
    });

    wrap.addEventListener('dragend', () => {
      wrap.classList.remove('agenda-dragging');
      wrap.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
      clearGhost();
    });

    wrap.addEventListener('dragover', e => {
      const hit = this._agendaHit(e);
      if (!hit) { clearGhost(); return; }
      e.preventDefault();
      e.dataTransfer.dropEffect = this._isCopyDrag(e) ? 'copy' : 'move';
      if (hit.kind === 'flex') {
        clearGhost();
        hit.strip.classList.add('drop-target');
        return;
      }
      wrap.querySelectorAll('.agenda-flex-strip.drop-target').forEach(el => el.classList.remove('drop-target'));
      if (!ghost || ghost.parentElement !== hit.canvas) {
        ghost?.remove();
        ghost = document.createElement('div');
        ghost.className = 'agenda-drop-ghost';
        ghost.innerHTML = '<span></span>';
        hit.canvas.appendChild(ghost);
      }
      ghost.style.setProperty('--top', `${((hit.minutes - hit.from) / 60) * hit.px}px`);
      ghost.classList.toggle('is-now', !!hit.isNow);
      ghost.firstChild.textContent = hit.isNow ? `maintenant · ${fmtHM(hit.minutes)}` : fmtHM(hit.minutes);
    });

    wrap.addEventListener('dragleave', e => {
      if (!wrap.contains(e.relatedTarget)) clearGhost();
    });

    wrap.addEventListener('drop', e => {
      e.preventDefault();
      const hit = this._agendaHit(e);
      clearGhost();
      wrap.classList.remove('agenda-dragging');
      const taskId = e.dataTransfer.getData('text/plain');
      // Même garde-fou que la vue jour : un drag de section de tag pose lui
      // aussi du text/plain (un tagId). On ne mute que sur un vrai id.
      if (!hit || !taskId || !state.todos.some(t => t.id === taskId)) return;
      const ids = this._dropIds(taskId);
      if (hit.kind === 'time') this._agendaMoveTo(ids, hit.minutes, e);
      else this._agendaUnschedule(ids, hit.period, e);
    });

    // ── Resize (pointer) ────────────────────────────────
    wrap.addEventListener('pointerdown', e => {
      const handle = e.target.closest('.agenda-block-resize');
      if (!handle || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const block = handle.closest('.agenda-block');
      const canvas = block.closest('.agenda-canvas');
      const px = parseFloat(canvas.dataset.px) || 72;
      const to = parseInt(canvas.dataset.to, 10);
      const start = parseInt(block.dataset.start, 10);
      const startY = e.clientY;
      const startDur = parseInt(block.dataset.dur, 10);
      let dur = startDur;
      block.classList.add('resizing');
      handle.setPointerCapture(e.pointerId);
      const onMove = ev => {
        const step = ev.altKey ? FINE_SNAP_MIN : SNAP_MIN;
        const raw = startDur + ((ev.clientY - startY) / px) * 60;
        // On cale l'heure de FIN, pas la durée : « jusqu'à maintenant » est une
        // heure d'horloge, alors qu'une durée de 21 min ne veut rien dire.
        const snappedEnd = snapWithNow(start + raw, step, this._agendaNowMinutes(), [start + MIN_BLOCK_MIN, 24 * 60]);
        dur = Math.max(MIN_BLOCK_MIN, Math.min(24 * 60 - start, snappedEnd - start));
        block.style.setProperty('--h', `${Math.max(18, (Math.min(dur, to - start) / 60) * px)}px`);
        const lbl = block.querySelector('.agenda-block-time');
        if (lbl) lbl.innerHTML = `${fmtHM(start)}<span class="agenda-block-dash">–</span>${fmtHM(start + dur)}`;
      };
      const onUp = () => {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        handle.removeEventListener('pointercancel', onUp);
        block.classList.remove('resizing');
        if (dur !== startDur) this._agendaResizeCommit(block.dataset.id, block.dataset.date, dur);
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onUp);
    });

    // ── Créer par glisser sur une plage vide (pointer) ──
    wrap.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      if (e.target.closest('.agenda-block, .agenda-chip, button, input, .ctx-title-input')) return;
      const canvas = e.target.closest('.agenda-canvas');
      if (!canvas) return;
      const r = canvas.getBoundingClientRect();
      const px = parseFloat(canvas.dataset.px) || 72;
      const from = parseInt(canvas.dataset.from, 10);
      const to = parseInt(canvas.dataset.to, 10);
      const yToMin = y => Math.max(from, Math.min(to, from + ((y - r.top) / px) * 60));
      const anchor = yToMin(e.clientY);
      let sketch = null, moved = false;
      const onMove = ev => {
        if (!moved && Math.abs(ev.clientY - e.clientY) < 8) return;
        moved = true;
        const step = ev.altKey ? FINE_SNAP_MIN : SNAP_MIN;
        const nowM = this._agendaNowMinutes();
        const a = snapWithNow(anchor, step, nowM, [from, to]);
        const b = snapWithNow(yToMin(ev.clientY), step, nowM, [from, to]);
        const s = Math.min(a, b), en = Math.max(a, b, s + MIN_BLOCK_MIN);
        if (!sketch) {
          sketch = document.createElement('div');
          sketch.className = 'agenda-create-sketch';
          sketch.innerHTML = '<span></span>';
          canvas.appendChild(sketch);
        }
        sketch.style.setProperty('--top', `${((s - from) / 60) * px}px`);
        sketch.style.setProperty('--h', `${((en - s) / 60) * px}px`);
        sketch.firstChild.textContent = `${fmtHM(s)} – ${fmtHM(en)}`;
        sketch.dataset.start = s;
        sketch.dataset.end = en;
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        if (moved && sketch) {
          const s = parseInt(sketch.dataset.start, 10), en = parseInt(sketch.dataset.end, 10);
          sketch.remove();
          this._agendaCreateAt(canvas.dataset.period, s, en);
        } else sketch?.remove();
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });

    // Double-clic sur une plage vide → créneau de 30 min (geste sûr, alors
    // qu'un simple clic créerait des tâches par accident).
    wrap.addEventListener('dblclick', e => {
      if (e.target.closest('.agenda-block, .agenda-chip, button, input')) return;
      const canvas = e.target.closest('.agenda-canvas');
      if (!canvas) return;
      const r = canvas.getBoundingClientRect();
      const px = parseFloat(canvas.dataset.px) || 72;
      const from = parseInt(canvas.dataset.from, 10);
      const to = parseInt(canvas.dataset.to, 10);
      const bounds = [from, to - MIN_BLOCK_MIN];
      const s = Math.max(bounds[0], Math.min(bounds[1], snapWithNow(from + ((e.clientY - r.top) / px) * 60, SNAP_MIN, this._agendaNowMinutes(), bounds)));
      this._agendaCreateAt(canvas.dataset.period, s, Math.min(to, s + DEFAULT_BLOCK_MIN));
    });

    // Clic sur un bloc/une pastille → exactement le même arbitrage que la
    // vue liste : clickTodo() distingue clic simple (édition) et double-clic
    // (Focus) via sa fenêtre de 220 ms, plutôt qu'un 2e listener 'dblclick'
    // qui laisserait le clic simple ouvrir le modal AVANT d'entrer en Focus.
    // Posé ici et non en onclick inline pour rester hors du chemin du drag.
    wrap.addEventListener('click', e => {
      if (e.target.closest('button, input, .todo-check, .agenda-block-resize, .ctx-title-input')) return;
      const el = e.target.closest('.agenda-block[data-id], .agenda-chip[data-id]');
      if (!el) return;
      this.clickTodo(e, el.dataset.id, el.dataset.date);
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

  toggleDayDoneBottom() {
    const cur = localStorage.getItem('dayDoneBottom') !== 'false';
    localStorage.setItem('dayDoneBottom', String(!cur));
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
    const excludedTags = safeParseJSON(localStorage.getItem('dayTagExcluded'), []);
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
    openModal(state.navDate, state.todos, 'backlog');
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
    pushNow();
  }

  /** Force push all local data to Supabase (useful for manual sync recovery) */
  forcePush() { pushNow(); console.log('[sync] force push done'); }

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
    this._renderHmAccount();
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
  // AUTH & SYNC (Supabase)
  // ═══════════════════════════════════════════════════
  async _initSupabase() {
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

    // 1. Wait for auth to restore the previous session (or get null)
    const user = await initAuth();

    // 2. No session → sign in as guest automatically, then prompt for name.
    // Guarded: signInGuest() throws on failure (e.g. Supabase outage) —
    // unguarded, that becomes an unhandled rejection that aborts every step
    // below (realtime subscription, onUserChange listener, presence,
    // leave-prompt setup) for the rest of the session. Those steps are each
    // individually safe to run without a user (they no-op internally), so
    // just log and continue instead of leaving the app half-initialized.
    if (!user) {
      try {
        const guest = await signInGuest();
        // Defaults for new guests: yellow accent + French
        if (guest?.isAnonymous && !localStorage.getItem('primaryColor')) {
          localStorage.setItem('primaryColor', '#f59e0b');
          this._applyPrimaryColor('#f59e0b');
        }
        if (guest?.isAnonymous && !localStorage.getItem('lang')) {
          state.setLang('fr');
          this.applyLang();
        }
        if (guest?.isAnonymous && !guest.displayName && !localStorage.getItem('guestNameSkipped')) {
          await this._promptGuestName();
        }
      } catch (err) {
        console.warn('[auth] signInGuest failed — continuing without a session:', err.message);
      }
    }

    // 3. Merge remote data into the app (first load)
    await this._syncSupabase();

    // 3b. Sync with Google Calendar if connected (fire-and-forget)
    if (localStorage.getItem('gcalConnected') === '1') {
      this._gcalPush().catch(() => {});
      this._gcalPull().catch(() => {});
    }

    // 4. Listen for realtime updates from other devices (guard against re-init)
    if (this._supabaseUnsub) this._supabaseUnsub();
    this._supabaseUnsub = subscribeToSupabase(backup => {
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

  async _syncSupabase() {
    const backup = await loadFromSupabase();
    if (backup === null) {
      // Network / auth error — work offline, never push blindly
      return;
    }
    if (backup._empty) {
      // New user or no remote data — push local state to initialise
      await pushToSupabase(getFullBackup(state.todos));
      return;
    }

    const { _supabaseUpdatedAt, ...cleanBackup } = backup;

    // Primary guard: if local has todos AND a push is pending (last push failed or
    // page reloaded before push completed), retry the push — BUT only if local data
    // is not clearly older than Supabase (prevents stale devices from overwriting).
    if (state.todos.length > 0 && localStorage.getItem('_pendingSync') === '1') {
      const localWriteTime = parseInt(localStorage.getItem('_localWriteTime') || '0');
      const supabaseTime   = _supabaseUpdatedAt || 0;
      if (supabaseTime > localWriteTime + 5000) {
        // Supabase is clearly newer — our pending push is stale, discard it
        localStorage.removeItem('_pendingSync');
      } else {
        // Merge first, THEN push — never overwrite remote-only items
        this._applyBackup(cleanBackup, { silent: true });
        await pushToSupabase(getFullBackup(state.todos));
        this.render();
        return;
      }
    }

    // Secondary guard: compare timestamps. Local wins if it's strictly newer than
    // Supabase by more than 5s (tolerates clock drift between client and server).
    const localWriteTime = parseInt(localStorage.getItem('_localWriteTime') || '0');
    const supabaseTime   = _supabaseUpdatedAt || 0;
    if (localWriteTime > 0 && supabaseTime > 0 && localWriteTime > supabaseTime + 5000) {
      // Merge first, THEN push — never overwrite remote-only items
      this._applyBackup(cleanBackup, { silent: true });
      await pushToSupabase(getFullBackup(state.todos));
      this.render();
      return;
    }

    // If local config was changed after the last Supabase push, preserve it.
    // This prevents page reloads from reverting theme, palette, glass mode, etc.
    const localConfigTime  = parseInt(localStorage.getItem('_localConfigTime') || '0');
    const supabaseConfigTime = _supabaseUpdatedAt || 0;
    if (localConfigTime > supabaseConfigTime) {
      delete cleanBackup.config;
    }

    this._applyBackup(cleanBackup, { silent: false });
  }

  // Merge a backup object into the app state (from Supabase or server)
  _applyBackup(backup, { silent }) {
    // Skip our own echoes using the session ID stamped in every push.
    if (backup._pushedBySession && backup._pushedBySession === SESSION_ID) return;


    let changed = false;

    if (backup.calendar) {
      // ── Per-item merge (Option A) ─────────────────────────
      // Merge local deletions with remote deletions
      const localDels  = safeParseJSON(localStorage.getItem('_deletions'), {});
      const remoteDels = backup._deletions || {};
      let mergedDels = { ...localDels };
      for (const [id, ts] of Object.entries(remoteDels)) {
        mergedDels[id] = Math.max(mergedDels[id] || 0, ts);
      }
      mergedDels = _pruneDeletions(mergedDels);
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
    if (backup.categories) {
      const prev = localStorage.getItem('categories');
      const next = JSON.stringify(backup.categories);
      if (prev !== next) { localStorage.setItem('categories', next); changed = true; }
    }
    if (backup.templates) {
      const prev = localStorage.getItem('dayTemplates');
      const next = JSON.stringify(backup.templates);
      if (prev !== next) { localStorage.setItem('dayTemplates', next); changed = true; }
    }
    if (backup.suggestedTasks) {
      const prev = localStorage.getItem('suggestedTasks');
      const next = JSON.stringify(backup.suggestedTasks);
      if (prev !== next) { localStorage.setItem('suggestedTasks', next); changed = true; }
    }
    if (backup.taskOrder) {
      const prev = localStorage.getItem('projectTaskOrder');
      const next = JSON.stringify(backup.taskOrder);
      if (prev !== next) { localStorage.setItem('projectTaskOrder', next); changed = true; }
    }
    if (backup.backlogOrder) {
      const prev = localStorage.getItem('backlogOrder');
      const next = JSON.stringify(backup.backlogOrder);
      if (prev !== next) { localStorage.setItem('backlogOrder', next); changed = true; }
    }
    if (backup.inboxOrder) {
      const prev = localStorage.getItem('inboxOrder');
      const next = JSON.stringify(backup.inboxOrder);
      if (prev !== next) { localStorage.setItem('inboxOrder', next); changed = true; }
    }
    if (backup.intentions) {
      const prev = localStorage.getItem('intentions');
      const next = JSON.stringify(backup.intentions);
      if (prev !== next) { localStorage.setItem('intentions', next); changed = true; }
    }
    if (backup.projects) {
      const prev = localStorage.getItem('projects');
      const next = JSON.stringify(backup.projects);
      if (prev !== next) { saveProjects(backup.projects); changed = true; }
    }
    if (backup.config) {
      if (backup.config.zoom)       localStorage.setItem('zoom',       backup.config.zoom);
      if (backup.config.lang)       localStorage.setItem('lang',       backup.config.lang);
      if (backup.config.timezone)   localStorage.setItem('timezone',   backup.config.timezone);
      if (backup.config.icalHour)   localStorage.setItem('icalHour',   backup.config.icalHour);
      if (backup.config.icalFilters) localStorage.setItem('icalFilters', JSON.stringify(backup.config.icalFilters));
      if (backup.config.autoPostpone) localStorage.setItem('autoPostpone', backup.config.autoPostpone);
      if (backup.config.dictationAuto) localStorage.setItem('dictationAuto', backup.config.dictationAuto);
      if (backup.config.focusQueueView) localStorage.setItem('focusQueueView', backup.config.focusQueueView);
      if (backup.config.focusBreakMinutes) localStorage.setItem('focusBreakMinutes', backup.config.focusBreakMinutes);
      if (backup.config.backlogQueueView) localStorage.setItem('backlogQueueView', backup.config.backlogQueueView);
      if (backup.config.inboxQueueView)   localStorage.setItem('inboxQueueView',   backup.config.inboxQueueView);
      if (backup.config.dayLayout)   localStorage.setItem('dayLayout',   backup.config.dayLayout);
      if (backup.config.agendaPrefs) localStorage.setItem('agendaPrefs', backup.config.agendaPrefs);
      const _bPal2 = backup.config.bgPalette;
      if (_bPal2)  this.setPalette(_bPal2, { sync: false });
      if (backup.config.bgColor && (!_bPal2 || _bPal2 === 'none'))  _setBgColor(backup.config.bgColor);
      changed = true;
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
    this._renderHmAccount();

    if (btn) {
      btn.classList.toggle('authenticated', !!user && !guest);
      btn.title = guest ? 'Invité — cliquer pour créer un compte' : (user?.email || 'Mon compte');
    }

    let avatarData = null;
    try { avatarData = JSON.parse(localStorage.getItem('profileAvatar')); } catch {}

    const defaultLogoSVG = `<svg class="logo-mark" width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="26" height="26" rx="7" fill="var(--primary)"/><path d="M7 13.5L11 17.5L19 9" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const defaultBtnSVG  = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`;

    // Build desired HTML to avoid unnecessary innerHTML replacement (prevents animation replay)
    let logoHTML = defaultLogoSVG, btnHTML = defaultBtnSVG;
    let hasAvatar = false;

    if (avatarData?.type === 'emoji' && avatarData.value) {
      hasAvatar = true;
      logoHTML = `<span class="logo-avatar-emoji" style="--ed-s:${avatarData.scale ?? 1.4};--ed-x:${avatarData.x ?? 0}px;--ed-y:${avatarData.y ?? 0}px">${avatarData.value}</span>`;
      btnHTML = `<span class="user-btn-emoji">${avatarData.value}</span>`;
    } else if (avatarData?.type === 'photo' && avatarData.data) {
      hasAvatar = true;
      const f = FILTERS.find(f => f.id === avatarData.filter);
      const styleAttr = (f?.css && !f.canvas) ? ` style="filter:${f.css}"` : '';
      logoHTML = `<img src="${avatarData.data}" class="logo-avatar-photo"${styleAttr}>`;
      btnHTML = `<img src="${avatarData.data}" class="user-btn-photo"${styleAttr}>`;
    }

    if (logoAvatar) {
      logoAvatar.classList.toggle('logo-avatar--has-avatar', hasAvatar);
      if (logoAvatar.dataset.avatarKey !== (avatarData ? JSON.stringify({t: avatarData.type, v: avatarData.value || '', f: avatarData.filter || ''}) : '')) {
        logoAvatar.dataset.avatarKey = avatarData ? JSON.stringify({t: avatarData.type, v: avatarData.value || '', f: avatarData.filter || ''}) : '';
        logoAvatar.innerHTML = logoHTML;
      }
    }
    if (btn) {
      btn.classList.toggle('user-btn--has-avatar', hasAvatar);
      btn.innerHTML = btnHTML;
    }

    // Trigger logo entrance animation AFTER content is set (first call only)
    if (logoAvatar && !logoAvatar.dataset.animated) {
      logoAvatar.dataset.animated = '1';
      requestAnimationFrame(() => requestAnimationFrame(() => {
        logoAvatar.classList.add('logo-avatar--entering');
        logoAvatar.addEventListener('animationend', () => {
          logoAvatar.style.opacity = '1';
          logoAvatar.classList.remove('logo-avatar--entering');
        }, { once: true });
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

  openUserArea(e) {
    // Option+click on avatar → toggle localhost / todo.hugues.app
    if (e && e.altKey) {
      e.preventDefault();
      const loc = window.location;
      const isLocal = loc.hostname === 'localhost' || loc.hostname === '127.0.0.1';
      const target = isLocal
        ? `https://todo.hugues.app${loc.pathname}${loc.search}${loc.hash}`
        : `http://localhost:3000${loc.pathname}${loc.search}${loc.hash}`;
      window.location.href = target;
      return;
    }
    // !getCurrentUser() covers the case where auth never resolved at all
    // (e.g. Supabase outage) — isGuest() alone returns false there (same as
    // a real logged-in user, since `_currentUser?.isAnonymous ?? false` is
    // false for null too), which used to route to the Profile view with no
    // way back to the login modal for the rest of the session.
    if (isGuest() || !getCurrentUser()) this.openAuthModal();
    else                                this.setView('profile');
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
      // Listen for Enter key — pas de { once: true } : même bug que
      // editModalSubtask()/editSubtaskTitle(), la 1re lettre tapée du prénom
      // désarmait le listener avant même que Entrée soit pressée.
      document.getElementById('guestNameInput')?.addEventListener('keydown',
        e => { if (e.key === 'Enter') this.saveGuestName(); });
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
    if (name) { try { await updateUserProfile(name); } catch {} updatePresenceName(name); }
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
    if (name) { try { await updateUserProfile(name); } catch {} updatePresenceName(name); }
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
    // Delete user data
    await deleteUserData();
    // Clear all app localStorage keys
    Object.keys(localStorage)
      .filter(k => !k.startsWith('sb-'))
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
      await this._syncSupabase();
      document.getElementById('authModalOverlay').classList.add('hidden');
      document.getElementById('upgradePromptOverlay').classList.add('hidden');
      this._updateUserBtn();
      this.render();
    } catch (err) {
      errEl.textContent = this._authErrorMessage(err);
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
      // Supabase realtime listener will pick it up and re-render automatically
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
        // Pull the newly logged-in user's data from Supabase
        await this._syncSupabase();
      }
      this.closeAuthModal();
      this._updateUserBtn();
      this.render();
    } catch (err) {
      errEl.textContent = this._authErrorMessage(err);
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
      errEl.textContent = this._authErrorMessage(err);
      errEl.classList.remove('hidden');
    }
  }

  upgradeDismiss() {
    document.getElementById('upgradePromptOverlay').classList.add('hidden');
  }

  _authErrorMessage(errOrCode) {
    // Supabase errors have .message; legacy error codes mapped below
    const msg = typeof errOrCode === 'string' ? errOrCode : (errOrCode?.message || '');
    const code = typeof errOrCode === 'string' ? errOrCode : (errOrCode?.code || '');

    // Match Supabase error messages
    if (msg.includes('already registered') || msg.includes('already been registered'))
      return 'Cet email est déjà utilisé.';
    if (msg.includes('Invalid login'))
      return 'Email ou mot de passe incorrect.';
    if (msg.includes('Email not confirmed'))
      return 'Veuillez confirmer votre email.';
    if (msg.includes('Password should be'))
      return 'Mot de passe trop faible (minimum 6 caractères).';
    if (msg.includes('rate limit') || msg.includes('too many'))
      return 'Trop de tentatives. Réessayez plus tard.';
    if (msg.includes('network') || msg.includes('fetch'))
      return 'Erreur réseau. Vérifiez votre connexion.';
    if (msg.includes('popup'))
      return 'Connexion annulée.';

    // Legacy error codes (fallback)
    const legacyMessages = {
      'auth/email-already-in-use':    'Cet email est déjà utilisé.',
      'auth/invalid-email':           'Email invalide.',
      'auth/wrong-password':          'Mot de passe incorrect.',
      'auth/user-not-found':          'Aucun compte associé à cet email.',
    };
    if (legacyMessages[code]) return legacyMessages[code];

    console.error('Auth error:', msg || code);
    return `Erreur d'authentification. Veuillez réessayer.`;
  }

  // ═══════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════
  parseDS(s) { return parseDS(s); }
  getNavDate() { return state.navDate; }
}

// ── Popover « liens » (badge .todo-links-badge, vue jour, ≥2 liens) ─────
// Élément unique appendé à body, positionné en fixed (comme _todoCtxMenu
// ci-dessous), pour ne jamais être clippé/recouvert par les .todo-item
// suivants dans le DOM (position:relative + z-index:auto sur .todo-item —
// un enfant absolute nesté dedans se ferait dépasser par les cartes
// suivantes). Fermeture au clic extérieur, comme le menu contextuel.
const _linksMenu = document.createElement('div');
_linksMenu.className = 'todo-links-menu hidden';
document.body.appendChild(_linksMenu);

function _hideLinksMenu() { _linksMenu.classList.add('hidden'); }

function _toggleLinksMenu(anchor, links) {
  const wasOpenForThisAnchor = !_linksMenu.classList.contains('hidden') && _linksMenu._anchor === anchor;
  _hideLinksMenu();
  if (wasOpenForThisAnchor) return;
  _linksMenu._anchor = anchor;
  _linksMenu.innerHTML = links.map(url =>
    `<a class="todo-links-menu-item" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(linkHostname(url))}</a>`
  ).join('');
  _linksMenu.classList.remove('hidden');
  const rect = anchor.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  let x = rect.left, y = rect.bottom + 4;
  const mw = _linksMenu.offsetWidth, mh = _linksMenu.offsetHeight;
  if (x + mw > vw - 8) x = Math.max(8, vw - mw - 8);
  if (y + mh > vh - 8) y = Math.max(8, rect.top - mh - 4);
  _linksMenu.style.left = x + 'px';
  _linksMenu.style.top = y + 'px';
}

document.addEventListener('click', e => {
  if (!_linksMenu.contains(e.target) && !e.target.closest('.todo-links-badge')) _hideLinksMenu();
});

// ── Global todo context menu (item seul ou sélection multiple) ──────────
const _todoCtxMenu = document.createElement('div');
_todoCtxMenu.className = 'todo-ctx-menu hidden';
document.body.appendChild(_todoCtxMenu);

let _ctxTarget = null; // { kind: 'task', ids: [...], ds } | { kind: 'subtask', todoId, stid, ds, parentStid }

// Menu minimal pour une (sous-)sous-tâche (clic droit sur .subtask-item) :
// ses seules actions pertinentes sont celles déjà exposées par les boutons
// hover de la ligne (case à cocher, ▶ focus, × suppression) — jamais les
// actions de la tâche PARENTE (Modifier/Grouper/Déplacer/… n'ont pas de
// sens ici). Sans ce menu dédié, .subtask-item (sans data-id propre)
// laissait le clic droit remonter à .todo-item ancêtre : « Supprimer »
// supprimait alors toute la tâche parente au lieu de la seule sous-tâche.
// « Ajouter une sous-tâche » n'apparaît que si la cible est elle-même de
// profondeur 1 (parentStid absent) — une sous-sous-tâche ne peut pas avoir
// d'enfant (décision produit : un seul niveau d'imbrication de plus).
// « Sortir du groupe » (app.extractSubtask), elle, s'applique à N'IMPORTE
// QUELLE profondeur : extraire une sous-sous-tâche saute directement au
// statut de tâche indépendante, sans étape intermédiaire.
function _renderSubtaskCtxMenu() {
  const { todoId, stid, ds, parentStid } = _ctxTarget;
  const t = state.todos.find(x => x.id === todoId);
  const s = t && window.app._findSubtask(resolveOccurrence(t, ds).subtasks, stid, parentStid);
  if (!s) { _todoCtxMenu.innerHTML = ''; return; }
  // La file Focus ne couvre que la journée en cours (cf. focusStartOn) : sur
  // une sous-tâche d'un item Inbox/Backlog (aucune date) ou d'une tâche déjà
  // faite/annulée aujourd'hui, l'action serait un clic mort — on la masque.
  const d = today();
  const canFocus = getTodosForDate(d, state.todos).some(x => x.id === todoId && !isCompleted(x, d) && !isCancelled(x, d));
  _todoCtxMenu.innerHTML = `
    <div class="ctx-item" data-action="subtask-complete"><span>${s.completed ? '↺' : '✓'}</span> ${s.completed ? 'Décompléter' : 'Compléter'}</div>
    ${canFocus ? `<div class="ctx-item" data-action="subtask-focus"><span>▶</span> Focus</div>` : ''}
    ${!parentStid ? `<div class="ctx-item" data-action="subtask-add-nested"><span>☑</span> Ajouter une sous-tâche</div>` : ''}
    <div class="ctx-item" data-action="subtask-extract"><span>⤴</span> Sortir du groupe</div>
    <div class="ctx-sep"></div>
    <div class="ctx-item danger" data-action="subtask-delete"><span>×</span> Supprimer</div>
  `;
}

// Menu d'une SECTION de la colonne Aujourd'hui (un moment de la journée, ou
// la zone sans moment) : le clic droit doit être actif partout, y compris
// dans le vide d'un moment — c'est là qu'on veut créer un groupe ou poser
// une tâche, pas seulement sur une tâche existante.
const _PERIOD_LABELS = { morning: 'Matin', afternoon: 'Après-midi', evening: 'Soir', '': 'Sans moment' };

function _renderSectionCtxMenu() {
  const label = _PERIOD_LABELS[_ctxTarget.period] ?? 'Sans moment';
  _todoCtxMenu.innerHTML = `
    <div class="ctx-section-label">${esc(label)}</div>
    <div class="ctx-item" data-action="section-add-task"><span>＋</span> Ajouter une tâche</div>
    <div class="ctx-item" data-action="section-group-header"><span>⊞</span> Créer un groupe</div>
  `;
}

// Menu du clic droit sur un .task-group-header lui-même (kind:'group-header').
// « Supprimer le groupe » dissout TOUT le groupe (tous les membres, pas un
// seul comme « Dégrouper » sur une tâche) — pas de confirm(), symétrique de
// « Créer un groupe » et cohérent avec ungroupTask() qui n'en a pas non plus
// (les tâches elles-mêmes ne sont jamais perdues, seulement l'étiquette).
function _renderGroupHeaderCtxMenu() {
  const { groupTitle } = _ctxTarget;
  _todoCtxMenu.innerHTML = `
    <div class="ctx-section-label">${esc(groupTitle || 'Groupe')}</div>
    <div class="ctx-item" data-action="group-add-task"><span>＋</span> Ajouter une tâche</div>
    <div class="ctx-item" data-action="group-rename"><span>✎</span> Renommer</div>
    <div class="ctx-item" data-action="group-duplicate"><span>⧉</span> Dupliquer le groupe</div>
    <div class="ctx-sep"></div>
    <div class="ctx-item danger" data-action="group-dissolve"><span>×</span> Supprimer le groupe</div>
  `;
}

// Contenu dynamique selon la cible : groupe (N > 1) ou item seul,
// état complété, présence de tâches déplaçables (non récurrentes)
function _renderCtxMenu() {
  if (_ctxTarget.kind === 'subtask') { _renderSubtaskCtxMenu(); return; }
  if (_ctxTarget.kind === 'section') { _renderSectionCtxMenu(); return; }
  if (_ctxTarget.kind === 'group-header') { _renderGroupHeaderCtxMenu(); return; }
  const { ids } = _ctxTarget;
  const group = ids.length > 1;
  const occ = window.app._resolveOccurrences(ids);
  const allDone = occ.length > 0 && occ.every(({ t, ds }) => window.app._isDoneAt(t, ds));
  const allCancelled = occ.length > 0 && occ.every(({ t, ds }) => window.app._isCancelledAt(t, ds));
  const anyMovable = occ.some(({ t }) => !t.recurrence || t.recurrence === 'none');
  // Grouping : tâche seule avec sous-tâches (pas déjà groupée) → peut devenir
  // un groupe ; tâche seule déjà groupée → peut se re-fondre en sous-tâches
  const single = !group ? occ[0]?.t : null;
  const canGroupify = !!single && (single.subtasks?.length > 0) && !single.groupId;
  const canUngroupify = !!single && !!single.groupId;
  // « Regrouper en sous-tâches » exige ≥2 membres (convertGroupToTask sort
  // sinon sans rien faire) — un groupe d'un seul membre est un état normal
  // depuis « Créer un groupe », l'item serait mort silencieusement
  const canGroupToTask = canUngroupify && state.todos.filter(x => x.groupId === single.groupId).length > 1;
  // Les deux actions ci-dessous ouvrent un input inline ancré à l'item dans
  // le DOM (_inlineTitlePrompt) : ne les proposer que là où cet ancrage
  // existe (.todo-item), pas depuis une pastille de mois ou la file Focus.
  const hasAnchor = !!single && !!document.querySelector(`.todo-item[data-id="${single.id}"]`);
  // Une récurrente ne peut pas devenir sous-tâche (perte de la récurrence)
  const canAddParent = hasAnchor && (!single.recurrence || single.recurrence === 'none');
  const canAddGroupHeader = hasAnchor && !single.groupId;
  // Cluster « Grouper » (flyout) : n'existe que si au moins une des actions
  // de groupement s'applique — sinon le sous-menu serait vide.
  const canGroupCluster = !group && (canAddGroupHeader || canAddParent || canGroupify || canGroupToTask || canUngroupify);
  const nb = group ? ` <span class="ctx-count">${ids.length}</span>` : '';
  const curPrio = group
    ? (occ.every(({ t }) => (t.priority || '') === (occ[0].t.priority || '')) ? (occ[0].t.priority || '') : null)
    : (occ[0] ? (occ[0].t.priority || '') : null);
  const prios = [
    ['high',   'H', 'Priorité haute'],
    ['medium', 'M', 'Priorité moyenne'],
    ['low',    'B', 'Priorité basse'],
    ['',       '—', 'Sans priorité'],
  ];
  const curPeriod = group
    ? (occ.every(({ t }) => (t.dayPeriod || '') === (occ[0].t.dayPeriod || '')) ? (occ[0].t.dayPeriod || '') : null)
    : (occ[0] ? (occ[0].t.dayPeriod || '') : null);
  const periods = [
    ['morning',   '🌅', 'Matin'],
    ['afternoon', '☀',  'Après-midi'],
    ['evening',   '🌙', 'Soir'],
    ['',          '—',  'Sans moment'],
  ];
  // Sous-menus (« mega menu ») : un cluster d'actions apparentées partage
  // une seule icône de groupe (span devant le libellé) + un chevron ›,
  // les items enfants du .ctx-submenu n'ont plus chacun leur propre icône
  // (contrairement aux actions autonomes ci-dessus/dessous, qui gardent la
  // leur). Ouverture au survol (CSS :hover) ou au clic sur l'en-tête
  // (classe .open, posée par le handler ci-dessous — utile au tactile) ;
  // _layoutSubmenus() bascule .flip-left si ça déborderait l'écran.
  const addSubmenu = group ? '' : `
    <div class="ctx-item has-submenu"><span>＋</span> Ajouter<span class="ctx-caret">›</span>
      <div class="ctx-submenu">
        <div class="ctx-item" data-action="add-after">Ajouter après</div>
        <div class="ctx-item" data-action="add-subtask">Ajouter une sous-tâche</div>
        <div class="ctx-item" data-action="duplicate">Dupliquer</div>
      </div>
    </div>`;
  const groupSubmenu = !canGroupCluster ? '' : `
    <div class="ctx-item has-submenu"><span>⊞</span> Grouper<span class="ctx-caret">›</span>
      <div class="ctx-submenu">
        ${canAddGroupHeader ? `<div class="ctx-item" data-action="group-header">Créer un groupe</div>` : ''}
        ${canAddParent ? `<div class="ctx-item" data-action="add-parent">Créer une tâche parente</div>` : ''}
        ${canGroupify ? `<div class="ctx-item" data-action="task-to-group">Transformer en groupe</div>` : ''}
        ${canGroupToTask ? `<div class="ctx-item" data-action="group-to-task">Regrouper en sous-tâches</div>` : ''}
        ${canUngroupify ? `<div class="ctx-item" data-action="ungroup">Dégrouper</div>` : ''}
      </div>
    </div>`;
  const moveSubmenu = !anyMovable ? '' : `
    <div class="ctx-item has-submenu"><span>→</span> Déplacer${nb}<span class="ctx-caret">›</span>
      <div class="ctx-submenu">
        <div class="ctx-item" data-action="today">Aujourd'hui</div>
        <div class="ctx-item" data-action="tomorrow">Demain</div>
        <div class="ctx-item" data-action="inbox">Inbox</div>
        <div class="ctx-item" data-action="backlog">Backlog</div>
      </div>
    </div>`;
  _todoCtxMenu.innerHTML = `
    <div class="ctx-item" data-action="complete"><span>${allDone ? '↺' : '✓'}</span> ${allDone ? 'Décompléter' : 'Compléter'}${nb}</div>
    ${group ? '' : `
    <div class="ctx-item" data-action="focus"><span>▶</span> Focus</div>
    <div class="ctx-item" data-action="edit"><span>✎</span> Modifier</div>`}
    ${group ? `<div class="ctx-item" data-action="group"><span>⊞</span> Grouper${nb}</div>` : ''}
    ${group ? `<div class="ctx-item" data-action="duplicate"><span>⧉</span> Dupliquer${nb}</div>` : ''}
    ${addSubmenu}
    ${groupSubmenu}
    ${moveSubmenu}
    <div class="ctx-sep"></div>
    <div class="ctx-prio-row">
      <span class="ctx-prio-label">Priorité</span>
      ${prios.map(([v, l, title]) => `<button class="ctx-prio-btn ctx-prio-btn--${v || 'none'}${curPrio === v ? ' active' : ''}" data-prio="${v}" title="${title}">${l}</button>`).join('')}
    </div>
    <div class="ctx-period-row">
      <span class="ctx-period-label">Moment</span>
      ${periods.map(([v, l, title]) => `<button class="ctx-period-btn${curPeriod === v ? ' active' : ''}" data-period="${v}" title="${title}">${l}</button>`).join('')}
    </div>
    <div class="ctx-sep"></div>
    <div class="ctx-item" data-action="cancel"><span>⊘</span> ${allCancelled ? 'Restaurer' : 'Annuler'}${nb}</div>
    <div class="ctx-item danger" data-action="delete"><span>×</span> Supprimer${nb}</div>
    ${group ? `<div class="ctx-item" data-action="deselect"><span>✕</span> Désélectionner</div>` : ''}
  `;
}

// Ajuste chaque .ctx-submenu pour ne jamais déborder l'écran — basculement
// horizontal (.flip-left) si le survol atteindrait le bord droit, décalage
// vertical (transform) si le bas déborderait. Un sous-menu en visibility:
// hidden (pas display:none) garde son layout, donc getBoundingClientRect()
// est fiable même avant tout survol — pas besoin d'attendre le :hover.
function _layoutSubmenus() {
  const vw = window.innerWidth, vh = window.innerHeight;
  _todoCtxMenu.querySelectorAll('.ctx-submenu').forEach(sub => {
    sub.classList.remove('flip-left');
    sub.style.transform = '';
    let r = sub.getBoundingClientRect();
    if (r.right > vw - 8) sub.classList.add('flip-left');
    r = sub.getBoundingClientRect();
    const overflow = r.bottom - (vh - 8);
    if (overflow > 0) sub.style.transform = `translateY(-${overflow}px)`;
  });
}

// Si l'item visé fait partie d'une sélection multiple, le menu agit sur
// toute la sélection; sinon sur l'item seul
function _ctxIdsFor(id) {
  return (msHas(id) && msCount() > 1) ? msIds() : [id];
}

function _positionCtxMenu(x, y) {
  const vw = window.innerWidth, vh = window.innerHeight;
  const mw = _todoCtxMenu.offsetWidth, mh = _todoCtxMenu.offsetHeight;
  if (x + mw > vw - 8) x = Math.max(8, x - mw - 4);
  if (y + mh > vh - 8) y = Math.max(8, vh - mh - 8);
  _todoCtxMenu.style.left = x + 'px';
  _todoCtxMenu.style.top  = y + 'px';
}

function _showTodoCtxMenu(anchor, id, ds) {
  _ctxTarget = { kind: 'task', ids: _ctxIdsFor(id), ds };
  _renderCtxMenu();
  _todoCtxMenu.classList.remove('hidden');
  const rect = anchor.getBoundingClientRect();
  _positionCtxMenu(rect.right - _todoCtxMenu.offsetWidth, rect.bottom + 4);
  _layoutSubmenus();
}

function _hideTodoCtxMenu() {
  _todoCtxMenu.classList.add('hidden');
  _ctxTarget = null;
}

_todoCtxMenu.addEventListener('click', e => {
  if (_ctxTarget?.kind === 'subtask') {
    const item = e.target.closest('.ctx-item');
    if (!item) return;
    const { todoId, stid, ds, parentStid } = _ctxTarget;
    _hideTodoCtxMenu();
    const action = item.dataset.action;
    if (action === 'subtask-complete')   window.app.toggleSubtask(todoId, stid, ds, parentStid);
    if (action === 'subtask-focus')      window.app.focusStartOn(todoId, ds, parentStid || stid);
    if (action === 'subtask-add-nested') window.app.ctxAddNestedSubtask(todoId, stid, ds);
    if (action === 'subtask-extract')    window.app.extractSubtask(todoId, stid, ds, parentStid);
    if (action === 'subtask-delete')     window.app.deleteSubtask(todoId, stid, ds, parentStid);
    return;
  }
  if (_ctxTarget?.kind === 'section') {
    const item = e.target.closest('.ctx-item');
    if (!item) return;
    const { period } = _ctxTarget;
    _hideTodoCtxMenu();
    if (item.dataset.action === 'section-add-task')     window.app.addSectionTask(period);
    if (item.dataset.action === 'section-group-header') window.app.addSectionGroupHeader(period);
    return;
  }
  if (_ctxTarget?.kind === 'group-header') {
    const item = e.target.closest('.ctx-item');
    if (!item) return;
    const { groupId } = _ctxTarget;
    _hideTodoCtxMenu();
    if (item.dataset.action === 'group-add-task')  window.app.addTaskToGroup(groupId);
    if (item.dataset.action === 'group-rename')    window.app.renameGroupPrompt(groupId);
    if (item.dataset.action === 'group-duplicate') window.app.duplicateGroup(groupId);
    if (item.dataset.action === 'group-dissolve')  window.app.dissolveGroup(groupId);
    return;
  }
  const prioBtn = e.target.closest('.ctx-prio-btn');
  const periodBtn = e.target.closest('.ctx-period-btn');
  // .ctx-item:not(.has-submenu) cible la feuille cliquée — closest() s'arrête
  // au 1er match, donc un clic dans un .ctx-submenu résout la feuille, pas
  // l'en-tête ancêtre. Un clic sur l'en-tête lui-même (icône/libellé/chevron,
  // hors sous-menu) ne matche que groupHeader : bascule .open (utile au
  // tactile, en plus du survol CSS) sans exécuter d'action ni fermer le menu.
  const groupHeader = e.target.closest('.ctx-item.has-submenu');
  const item = e.target.closest('.ctx-item:not(.has-submenu)');
  if (groupHeader && !item) {
    const wasOpen = groupHeader.classList.contains('open');
    _todoCtxMenu.querySelectorAll('.ctx-item.has-submenu.open').forEach(h => h.classList.remove('open'));
    if (!wasOpen) groupHeader.classList.add('open');
    return;
  }
  if ((!item && !prioBtn && !periodBtn) || !_ctxTarget) return;
  const { ids, ds } = _ctxTarget;
  const single = ids[0];
  _hideTodoCtxMenu();
  const app = window.app;
  if (prioBtn)   { app.setPriorityMany(ids, prioBtn.dataset.prio); return; }
  if (periodBtn) { app.setDayPeriodMany(ids, periodBtn.dataset.period); return; }
  const action = item.dataset.action;
  if (action === 'complete')    app.completeMany(ids);
  if (action === 'focus')       app.focusStartOn(single, ds);
  if (action === 'edit')        app.openEditModal(single, ds);
  if (action === 'add-after')   app.addTaskAfter(single, ds);
  if (action === 'add-subtask') app.ctxAddSubtask(single);
  if (action === 'add-parent')  app.addParentTask(single);
  if (action === 'group-header') app.addGroupHeader(single);
  if (action === 'task-to-group') app.convertTaskToGroup(single);
  if (action === 'group-to-task') {
    const t = state.todos.find(x => x.id === single);
    if (t?.groupId) app.convertGroupToTask(t.groupId);
  }
  if (action === 'ungroup')     app.ungroupTask(single);
  if (action === 'group')       app.showGroupPrompt(ids);
  if (action === 'duplicate')   app.duplicateMany(ids);
  if (action === 'today')       app._sendManyTo(ids, { date: DS(today()), backlog: false });
  if (action === 'tomorrow')    app._sendManyTo(ids, { date: DS(addDays(today(), 1)), backlog: false });
  if (action === 'inbox')       app._sendManyTo(ids, { date: null, backlog: false });
  if (action === 'backlog')     app._sendManyTo(ids, { date: null, backlog: true });
  if (action === 'cancel')      app.cancelMany(ids);
  if (action === 'delete')      ids.length > 1 ? app.deleteMany(ids) : app.deleteTodo(single, ds);
  if (action === 'deselect')    msClear();
});

document.addEventListener('click', e => {
  if (!_todoCtxMenu.contains(e.target)) _hideTodoCtxMenu();
});

document.addEventListener('contextmenu', e => {
  // Vérifié AVANT MS_SELECTABLE : .subtask-item est imbriqué dans .todo-item,
  // qui matcherait sinon via closest() en remontant l'arbre — routant par
  // erreur le clic droit vers le menu de la tâche PARENTE (cf. _renderSubtaskCtxMenu).
  const subEl = e.target.closest('.subtask-item');
  if (subEl) {
    e.preventDefault();
    _ctxTarget = { kind: 'subtask', todoId: subEl.dataset.todoId, stid: subEl.dataset.stid, ds: subEl.dataset.ds, parentStid: subEl.dataset.parentStid || null };
    _renderCtxMenu();
    _todoCtxMenu.classList.remove('hidden');
    _positionCtxMenu(e.clientX + 4, e.clientY);
    return;
  }
  // Clic droit directement sur l'en-tête d'un groupe (« commissions ») —
  // pas sur un membre : menu dédié (renommer/ajouter/dupliquer/supprimer
  // l'en-tête), cf. _renderGroupHeaderCtxMenu. Partagé entre la vue jour et
  // Backlog/Inbox (même classe/structure, cf. todoListHTML()/renderGroupedItems()).
  const groupHeaderEl = e.target.closest('.task-group-header');
  if (groupHeaderEl) {
    e.preventDefault();
    _ctxTarget = { kind: 'group-header', groupId: groupHeaderEl.dataset.groupId, groupTitle: groupHeaderEl.querySelector('.task-group-title')?.textContent || '' };
    _renderCtxMenu();
    _todoCtxMenu.classList.remove('hidden');
    _positionCtxMenu(e.clientX + 4, e.clientY);
    return;
  }
  // Clic droit dans le vide d'un moment de la colonne Aujourd'hui (label,
  // liste, zone de dépôt vide) — jamais sur une tâche, un en-tête de groupe
  // ou un séparateur, qui ont déjà leur propre menu.
  if (!e.target.closest('.todo-item, .task-group-header, .day-spacer, .ctx-title-input')) {
    const sectionEl = e.target.closest('.day-col--punctual .day-heure-section[data-period], .day-col--punctual .todo-list[data-group]');
    if (sectionEl) {
      e.preventDefault();
      const grp = sectionEl.dataset.group || '';
      const m = grp.match(/-(morning|afternoon|evening)$/);
      _ctxTarget = { kind: 'section', period: sectionEl.dataset.period || (m ? m[1] : '') };
      _renderCtxMenu();
      _todoCtxMenu.classList.remove('hidden');
      _positionCtxMenu(e.clientX + 4, e.clientY);
      return;
    }
  }
  const item = e.target.closest(MS_SELECTABLE);
  if (!item || !item.dataset.id) return;
  // Ligne de file Focus (.focus-queue-item) ou item courant
  // (.focus-current-item) représentant une sous-tâche (id composé
  // "todoId::stid") : pas de menu contextuel en v1 — le menu générique
  // "tâche" suppose des ids simples résolvables dans state.todos.
  if (item.dataset.id.includes('::')) { e.preventDefault(); return; }
  e.preventDefault();
  _ctxTarget = { kind: 'task', ids: _ctxIdsFor(item.dataset.id), ds: item.getAttribute('data-date') };
  _renderCtxMenu();
  _todoCtxMenu.classList.remove('hidden');
  _positionCtxMenu(e.clientX + 4, e.clientY);
  _layoutSubmenus();
});

// Create global app instance. Last-resort net: every known risky
// localStorage read at boot now goes through safeParseJSON (never throws),
// but if something still throws during construction, the alternative is a
// permanently blank page with no rendered UI, no listeners, and no visible
// error — offer a way out instead.
try {
  window.app = new TodoApp();
} catch (err) {
  console.error('[boot] TodoApp() threw during construction:', err);
  document.body.innerHTML = `
    <div style="max-width:420px;margin:15vh auto;padding:28px;font-family:-apple-system,sans-serif;text-align:center;">
      <p style="font-size:15px;line-height:1.5;color:#333;">Une erreur inattendue a empêché le chargement de l'application.</p>
      <p style="font-size:13px;color:#888;margin:8px 0 20px;">${esc(err?.message || String(err))}</p>
      <button id="_bootRetry" style="padding:10px 18px;margin:0 6px;border-radius:8px;border:1px solid #ccc;background:#fff;cursor:pointer;">Réessayer</button>
      <button id="_bootReset" style="padding:10px 18px;margin:0 6px;border-radius:8px;border:none;background:#c0392b;color:#fff;cursor:pointer;">Réinitialiser les données locales</button>
    </div>`;
  document.getElementById('_bootRetry').onclick = () => location.reload();
  document.getElementById('_bootReset').onclick = () => {
    if (!confirm('Efface toutes les données stockées sur cet appareil (tâches, préférences). Action irréversible localement — utile seulement si tes données sont aussi sauvegardées ailleurs (Supabase). Continuer ?')) return;
    localStorage.clear();
    location.reload();
  };
}

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
  // Alt+Maj+D — Alt+D seul est réservé à la navigation (Jour), voir events.js
  if (e.altKey && e.shiftKey && !e.metaKey && !e.ctrlKey && e.code === 'KeyD') {
    e.preventDefault();
    window.app.toggleTheme();
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
  }
});
