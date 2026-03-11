// ════════════════════════════════════════════════════════
//  STORAGE (localStorage)
// ════════════════════════════════════════════════════════

import { DS, today } from './utils.js';

export function saveTodos(todos) {
  localStorage.setItem('todos', JSON.stringify(todos));
}

export function loadTodos() {
  return JSON.parse(localStorage.getItem('todos') || '[]');
}

export function getAppConfig() {
  return {
    theme: localStorage.getItem('theme'),
    zoom: localStorage.getItem('zoom'),
    lang: localStorage.getItem('lang')
  };
}

export function getFullBackup(todos) {
  const raw = key => { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; };
  return {
    calendar: todos,
    config: getAppConfig(),
    categories: raw('projects'),
    templates: raw('dayTemplates'),
    suggestedTasks: raw('suggestedTasks'),
    taskOrder: raw('projectTaskOrder'),
    exportDate: new Date().toISOString()
  };
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

export function generateICalURL(todos) {
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
  const icalContent = generateICalURL(todos);
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
  const icalContent = generateICalURL(todos);
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
