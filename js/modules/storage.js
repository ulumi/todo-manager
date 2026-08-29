// ════════════════════════════════════════════════════════
//  STORAGE (localStorage + optional local API server)
// ════════════════════════════════════════════════════════

import { DS, today, safeParseJSON } from './utils.js';
import { getIdToken } from './auth.js';
import { pushToSupabase } from './sync.js';

const API = 'http://localhost:3333';
export const IS_LOCAL = typeof window !== 'undefined' && window.location.hostname === 'localhost';

// Quick health-check: only talk to the local API if it's actually running.
// Cached for the page lifetime so we probe at most once.
let _serverAlive = null;
async function isServerAlive() {
  if (_serverAlive !== null) return _serverAlive;
  if (!IS_LOCAL) return (_serverAlive = false);
  try {
    await fetch(`${API}/health`, { signal: AbortSignal.timeout(500) });
    return (_serverAlive = true);
  } catch {
    return (_serverAlive = false);
  }
}

// Fire-and-forget POST — never throws, 1.5s timeout
async function serverPost(endpoint, data) {
  if (!await isServerAlive()) return;
  const token = await getIdToken();
  if (!token) return; // no auth yet — skip silently
  try {
    await fetch(`${API}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(1500),
    });
  } catch (_) {}
}

// Returns full backup from server, or null if unavailable
export async function loadFromServer() {
  if (!await isServerAlive()) return null;
  const token = await getIdToken();
  if (!token) return null; // no auth yet — skip silently
  try {
    const res = await fetch(`${API}/backup`, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

// Push full backup to server (used to initialise server from localStorage)
export async function saveBackupToServer(backup) {
  await serverPost('/backup', backup);
}

// Debounced Supabase push — coalesces rapid successive writes (drag reorder,
// clicking through several toolbar options, etc.) into a single full-row
// upsert instead of one per change. Each push re-sends the ENTIRE row
// (todos + config + avatar) and Supabase Realtime rebroadcasts it whole to
// every connected tab/device, so pushing on every keystroke/click is a real
// egress cost, not just a request-count nuisance. Safe to debounce: if the
// tab closes before the timer fires, `_pendingSync` stays '1' and the next
// load's startup reconciliation (_applyBackup path in app.js) retries it —
// no data loss, just a delayed sync.
const PUSH_DEBOUNCE_MS = 1200;
let _pushTimer = null;

// Soft warning, once per session — the backup grows with total accumulated
// history (unbounded arrays like completedDates/cancelledDates), and every
// push resends it in full regardless of how small the actual edit was.
// 2MB is well under the ~5-10MB localStorage cap, meant as an early signal
// long before that becomes a real problem, not a hard limit.
const SIZE_WARN_BYTES = 2 * 1024 * 1024;
let _sizeWarned = false;

export function scheduleSupabasePush() {
  localStorage.setItem('_pendingSync', '1');
  clearTimeout(_pushTimer);
  _pushTimer = setTimeout(() => {
    _pushTimer = null;
    const backup = getFullBackup(loadTodos());
    if (!_sizeWarned) {
      const size = JSON.stringify(backup).length;
      if (size > SIZE_WARN_BYTES) {
        _sizeWarned = true;
        console.warn(`[storage] backup is ${(size / 1024 / 1024).toFixed(1)}MB — every push resends this in full; consider pruning old history`);
      }
    }
    pushToSupabase(backup)
      .then(() => localStorage.removeItem('_pendingSync'))
      .catch(() => {});
  }, PUSH_DEBOUNCE_MS);
}

export function saveTodos(todos) {
  const json = JSON.stringify(todos);
  try {
    localStorage.setItem('todos', json);
    localStorage.setItem('_localWriteTime', Date.now().toString());
    // Safety backup: last known good state, never touched by sync
    if (todos.length > 0) {
      localStorage.setItem('_todosSafetyBackup', JSON.stringify({ todos, ts: Date.now() }));
    }
  } catch (err) {
    // QuotaExceededError (localStorage full, ~5-10MB/origin) or Safari
    // private browsing (throws on any write). The in-memory state.todos
    // mutation already happened before saveTodos() was called, so it isn't
    // lost — but every subsequent action will fail the same way until
    // something frees up space, silently, unless we surface it. storage.js
    // has no UI of its own (and importing app.js here would be circular),
    // so dispatch an event app.js listens for once at boot.
    console.error('[storage] saveTodos: localStorage write failed —', err.message);
    window.dispatchEvent(new CustomEvent('storage-write-failed', { detail: { error: err } }));
  }
  // Still worth attempting even if the local write above failed — the
  // server/Supabase writes are independent storage, not gated on it.
  serverPost('/todos', todos);
  scheduleSupabasePush();
}

export function loadTodos() {
  const primary = safeParseJSON(localStorage.getItem('todos'), null);
  if (Array.isArray(primary)) return primary;
  // "todos" missing or corrupted (crash mid-write, tampering) — recover
  // from the safety backup written on every saveTodos() call below instead
  // of silently handing the user an empty list.
  const backup = safeParseJSON(localStorage.getItem('_todosSafetyBackup'), null);
  if (backup && Array.isArray(backup.todos) && backup.todos.length > 0) {
    console.warn('[storage] "todos" was missing/corrupted — recovered from _todosSafetyBackup written', new Date(backup.ts).toISOString());
    return backup.todos;
  }
  return [];
}

// Sync across tabs: fires when another tab writes to localStorage
// onUpdate(key, rawValue) — rawValue is the raw string; caller handles JSON parsing
export function initCrossTabSync(onUpdate) {
  window.addEventListener('storage', (e) => {
    if (e.newValue === e.oldValue) return;
    onUpdate(e.key, e.newValue);
  });
}

function stripRunRequest(raw) {
  if (!raw) return raw;
  try {
    const { runRequest, ...rest } = JSON.parse(raw);
    return JSON.stringify(rest);
  } catch {
    return raw;   // valeur illisible : on la laisse telle quelle, le serveur la normalisera
  }
}

export function getAppConfig() {
  return {
    zoom: localStorage.getItem('zoom'),
    lang: localStorage.getItem('lang'),
    timezone: localStorage.getItem('timezone'),
    icalHour: localStorage.getItem('icalHour'),
    icalFilters: safeParseJSON(localStorage.getItem('icalFilters'), null),
    bgPalette: localStorage.getItem('bgPalette'),
    bgColor:   localStorage.getItem('bgColor'),
    autoPostpone: localStorage.getItem('autoPostpone'),
    dictationAuto: localStorage.getItem('dictationAuto'),
    focusQueueView: localStorage.getItem('focusQueueView'),
    focusBreakMinutes: localStorage.getItem('focusBreakMinutes'),
    backlogQueueView: localStorage.getItem('backlogQueueView'),
    inboxQueueView: localStorage.getItem('inboxQueueView'),
    dayLayout: localStorage.getItem('dayLayout'),
    agendaPrefs: localStorage.getItem('agendaPrefs'),
    // `runRequest` est délibérément RETIRÉ de ce que le client téléverse : c'est
    // un signal serveur, que l'agent efface (claimRun) au moment où il part
    // travailler. Le navigateur en garde une copie locale pour afficher
    // « Passage demandé » tout de suite, mais s'il la repoussait avec le reste
    // de la config, il ressusciterait la demande une seconde après que le
    // serveur l'a effacée — et l'agent repartirait en boucle sur le même clic.
    // Constaté en vrai : `claim` répondait `{"claimed":true}` et le drapeau
    // revenait aussitôt, les écritures de l'agent déclenchant du Realtime, donc
    // des merges, donc des pushes.
    claudeAgent: stripRunRequest(localStorage.getItem('claudeAgent')),
  };
}

export function getFullBackup(todos) {
  const raw = key => safeParseJSON(localStorage.getItem(key), null);
  const backup = {
    calendar: todos,
    _deletions: safeParseJSON(localStorage.getItem('_deletions'), {}),
    config: getAppConfig(),
    categories: raw('categories'),
    templates: raw('dayTemplates'),
    suggestedTasks: raw('suggestedTasks'),
    taskOrder: raw('projectTaskOrder'),
    backlogOrder: raw('backlogOrder'),
    inboxOrder: raw('inboxOrder'),
    avatar: raw('profileAvatar'),
    intentions: raw('intentions'),
    projects: raw('projects'),
    quotes: {
      banned:   raw('bannedQuotes')   || [],
      customFR: raw('customQuotesFR') || [],
      customEN: raw('customQuotesEN') || [],
    },
    exportDate: new Date().toISOString()
  };
  // Both feed/API secrets ride along so a device that generated one while
  // offline gets it written into the row on the next successful push (see
  // getOrCreateSecretToken in sync.js).
  const icalSecret = localStorage.getItem('icalSecret');
  if (icalSecret) backup.icalSecret = icalSecret;
  const apiSecret = localStorage.getItem('apiSecret');
  if (apiSecret) backup.apiSecret = apiSecret;
  return backup;
}

export function pushNow() {
  clearTimeout(_pushTimer); // supersedes any pending debounced push
  _pushTimer = null;
  const todos = loadTodos();
  localStorage.setItem('_localWriteTime', Date.now().toString());
  localStorage.setItem('_pendingSync', '1');
  pushToSupabase(getFullBackup(todos))
    .then(() => localStorage.removeItem('_pendingSync'))
    .catch(() => {});
}

export function downloadJSON(obj, filename) {
  const json = JSON.stringify(obj, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportAllData(todos) {
  downloadJSON(getFullBackup(todos), `todo-backup-${DS(today())}.json`);
}

export function exportCalendarOnly(todos) {
  const data = { calendar: todos, exportDate: new Date().toISOString() };
  downloadJSON(data, `todo-calendar-${DS(today())}.json`);
}

export function exportConfigOnly() {
  const data = { config: getAppConfig(), exportDate: new Date().toISOString() };
  downloadJSON(data, `todo-config-${DS(today())}.json`);
}

export function importData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const data = JSON.parse(event.target.result);
        resolve(data);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function generateICalContent(todos) {
  const icalEvents = todos.map(todo => {
    // Generate unique ID based on todo id and date
    const uid = `${todo.id}@todo-manager`;

    // Use today's date as DTSTAMP
    const dtstamp = formatICalDate(new Date());

    // For recurring tasks, create multiple events
    if (todo.recurrence && todo.recurrence !== 'none') {
      // Get the start date from the todo (or use today)
      const startDate = todo.date ? new Date(todo.date) : new Date();

      let recurrenceRule = '';
      if (todo.recurrence === 'daily') {
        recurrenceRule = 'RRULE:FREQ=DAILY';
      } else if (todo.recurrence === 'weekly') {
        const byDay = (todo.recDays || []).map(d => {
          const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
          return dayNames[d];
        }).join(',');
        recurrenceRule = byDay ? `RRULE:FREQ=WEEKLY;BYDAY=${byDay}` : 'RRULE:FREQ=WEEKLY';
      } else if (todo.recurrence === 'monthly') {
        recurrenceRule = 'RRULE:FREQ=MONTHLY';
      } else if (todo.recurrence === 'yearly') {
        recurrenceRule = 'RRULE:FREQ=YEARLY';
      }

      const dtstart = formatICalDate(startDate);
      return `BEGIN:VEVENT
UID:${uid}-recurring
DTSTAMP:${dtstamp}
DTSTART;VALUE=DATE:${dtstart}
SUMMARY:${escapeICalText(todo.title)}
DESCRIPTION:Recurring task
${recurrenceRule}
END:VEVENT`;
    } else {
      // Single event
      const eventDate = todo.date ? new Date(todo.date) : new Date();
      const dtstart = formatICalDate(eventDate);
      return `BEGIN:VEVENT
UID:${uid}
DTSTAMP:${dtstamp}
DTSTART;VALUE=DATE:${dtstart}
SUMMARY:${escapeICalText(todo.title)}
END:VEVENT`;
    }
  }).join('\n');

  const icalContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Todo Manager//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:My Tasks
X-WR-TIMEZONE:UTC
X-WR-CALDESC:Calendar export from Todo Manager
${icalEvents}
END:VCALENDAR`;

  return icalContent;
}

export function downloadICalFile(todos) {
  const icalContent = generateICalContent(todos);
  const blob = new Blob([icalContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `todo-calendar-${DS(today())}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function getICalBlobURL(todos) {
  const icalContent = generateICalContent(todos);
  const blob = new Blob([icalContent], { type: 'text/calendar;charset=utf-8' });
  return URL.createObjectURL(blob);
}

function formatICalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function escapeICalText(text) {
  return (text || '')
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n');
}
