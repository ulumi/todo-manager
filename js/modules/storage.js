// ════════════════════════════════════════════════════════
//  STORAGE (localStorage + optional local API server)
// ════════════════════════════════════════════════════════

import { DS, today } from './utils.js';
import { getIdToken } from './auth.js';
import { pushToFirestore } from './sync.js';

const API = 'http://localhost:3333';
const IS_LOCAL = typeof window !== 'undefined' && window.location.hostname === 'localhost';

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

export function saveTodos(todos) {
  const json = JSON.stringify(todos);
  localStorage.setItem('todos', json);
  localStorage.setItem('_localWriteTime', Date.now().toString());
  // Mark as pending until Firestore confirms receipt
  localStorage.setItem('_pendingSync', '1');
  // Safety backup: last known good state, never touched by sync
  if (todos.length > 0) {
    localStorage.setItem('_todosSafetyBackup', JSON.stringify({ todos, ts: Date.now() }));
  }
  serverPost('/todos', todos);
  pushToFirestore(getFullBackup(todos))
    .then(() => localStorage.removeItem('_pendingSync'))
    .catch(() => {}); // stays pending if push fails — protects local data on next load
}

export function loadTodos() {
  return JSON.parse(localStorage.getItem('todos') || '[]');
}

// Sync across tabs: fires when another tab writes to localStorage
// onUpdate(key, rawValue) — rawValue is the raw string; caller handles JSON parsing
export function initCrossTabSync(onUpdate) {
  window.addEventListener('storage', (e) => {
    if (e.newValue === e.oldValue) return;
    onUpdate(e.key, e.newValue);
  });
}

export function getAppConfig() {
  const icalFilters = localStorage.getItem('icalFilters');
  return {
    theme: localStorage.getItem('theme'),
    zoom: localStorage.getItem('zoom'),
    lang: localStorage.getItem('lang'),
    timezone: localStorage.getItem('timezone'),
    icalHour: localStorage.getItem('icalHour'),
    icalFilters: icalFilters ? JSON.parse(icalFilters) : null,
    bgPalette: localStorage.getItem('bgPalette'),
    bgColor:   localStorage.getItem('bgColor'),
    glassMode: localStorage.getItem('glassMode'),
  };
}

export function getFullBackup(todos) {
  const raw = key => { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; };
  const backup = {
    calendar: todos,
    config: getAppConfig(),
    categories: raw('categories'),
    templates: raw('dayTemplates'),
    suggestedTasks: raw('suggestedTasks'),
    taskOrder: raw('projectTaskOrder'),
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
  const icalSecret = localStorage.getItem('icalSecret');
  if (icalSecret) backup.icalSecret = icalSecret;
  return backup;
}

export function pushFirestoreNow() {
  const todos = loadTodos();
  localStorage.setItem('_localWriteTime', Date.now().toString());
  localStorage.setItem('_pendingSync', '1');
  pushToFirestore(getFullBackup(todos))
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
