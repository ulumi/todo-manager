// ════════════════════════════════════════════════════════
//  STATE MANAGEMENT
// ════════════════════════════════════════════════════════

import { today } from './utils.js';
import { loadTodos } from './storage.js';
import { TRANSLATIONS } from './config.js';

// Global state
export let todos = loadTodos();
export let view = 'day';
export let navDate = (() => {
  const d = new Date();
  d.setHours(0,0,0,0);
  return d;
})();
export let selectedRecurrence = 'none';
export let selectedWeekDays = [];
export let selectedMonthDays = [];
export let selectedMonthLastDay = false;
export let selectedYearMonth = 0;
export let selectedYearDay = 1;
export let quickAddTarget = 'today'; // 'today' | 'nav'
export let selectedPriority = '';
export let editingId = null;
export let insertAfterId = null;
export let pendingDelete = null;
export let _sugg = []; // safe ref for inline onclick
export let inboxMode = false; // true when modal opened without a date (inbox capture)
export let scheduleMode = 'date'; // 'date' | 'inbox' | 'backlog'
export let pastDisplayMode = localStorage.getItem('pastDisplayMode') || 'normal'; // 'normal' | 'stats'
export let statsViz = localStorage.getItem('statsViz') || 'bars'; // 'bars' | 'rings' | 'stamp'

export let lang = localStorage.getItem('lang') || (navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en');
export let T = TRANSLATIONS[lang] || TRANSLATIONS.en;
export let MONTHS, DAYS, DAY_FULL;

// State setters
export function setTodos(newTodos) {
  todos = newTodos;
}

export function setView(newView) {
  view = newView;
}

export function setNavDate(newNavDate) {
  navDate = newNavDate;
}

export function setSelectedRecurrence(rec) {
  selectedRecurrence = rec;
}

export function setSelectedWeekDays(days) {
  selectedWeekDays = days;
}

export function setSelectedMonthDays(days) {
  selectedMonthDays = days;
}

export function setSelectedMonthLastDay(val) {
  selectedMonthLastDay = val;
}

export function setSelectedYearMonth(m) {
  selectedYearMonth = m;
}

export function setSelectedYearDay(d) {
  selectedYearDay = d;
}

export function setQuickAddTarget(target) {
  quickAddTarget = target;
}

export function setSelectedPriority(p) {
  selectedPriority = p;
}

export function setEditingId(id) {
  editingId = id;
}

export function setInsertAfterId(id) {
  insertAfterId = id;
}

export function setPendingDelete(del) {
  pendingDelete = del;
}

export function setSuggestions(sugg) {
  _sugg = sugg;
}

export function setInboxMode(val) {
  inboxMode = val;
}

export function setScheduleMode(mode) {
  scheduleMode = mode;
  inboxMode = (mode === 'inbox'); // keep in sync for backward compat
}

export function setPastDisplayMode(mode) {
  pastDisplayMode = mode;
  localStorage.setItem('pastDisplayMode', mode);
}

export function setStatsViz(viz) {
  statsViz = viz;
  localStorage.setItem('statsViz', viz);
}

export function setLang(newLang) {
  lang = newLang;
  T = TRANSLATIONS[newLang] || TRANSLATIONS.en;
  localStorage.setItem('lang', newLang);
  updateDateLocales();
}

export function updateDateLocales() {
  MONTHS = T.months;
  DAYS = T.days;
  DAY_FULL = T.dayFull;
}

// Initialize date locales
export function initializeState() {
  updateDateLocales();
}
