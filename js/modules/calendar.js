// ════════════════════════════════════════════════════════
//  CALENDAR & RECURRENCE LOGIC
// ════════════════════════════════════════════════════════

import { DS, today, addDays, parseDS } from './utils.js';

export function getTodosForDate(d, todos) {
  const ds = DS(d);
  const dow = d.getDay();
  const dom = d.getDate();
  const mon = d.getMonth();
  return todos.filter(t => {
    if (!t.recurrence || t.recurrence === 'none') return t.date === ds;
    const effectiveStart = t.startDate || DS(new Date(parseInt(t.id)));
    if (ds < effectiveStart) return false;
    if (t.endDate && ds > t.endDate) return false;
    if ((t.excludedDates || []).includes(ds)) return false;
    switch(t.recurrence) {
      case 'daily':   return true;
      case 'weekly':  return (t.recDays||[]).includes(dow);
      case 'monthly': {
        const daysInM = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
        if (t.recLastDay && dom === daysInM) return true;
        if (t.recDays && t.recDays.length > 0) return t.recDays.includes(dom);
        return t.recDay === dom; // backward compat
      }
      case 'yearly':  return t.recMonth === mon && t.recDay === dom;
    }
    return false;
  });
}

export function isCompleted(todo, d) {
  if (todo.recurrence && todo.recurrence !== 'none')
    return (todo.completedDates||[]).includes(DS(d));
  return !!todo.completed;
}

export function toggleTodo(id, d, todos) {
  const t = todos.find(x => x.id === id);
  if (!t) return;
  if (t.recurrence && t.recurrence !== 'none') {
    const ds = DS(d);
    t.completedDates = t.completedDates || [];
    if (t.completedDates.includes(ds)) t.completedDates = t.completedDates.filter(x=>x!==ds);
    else t.completedDates.push(ds);
  } else {
    t.completed = !t.completed;
  }
}

export function deleteOneOccurrence(id, date, todos) {
  const t = todos.find(x => x.id === id);
  if (t) {
    t.excludedDates = t.excludedDates || [];
    t.excludedDates.push(DS(date));
  }
}

export function deleteFutureOccurrences(id, date, todos) {
  const t = todos.find(x => x.id === id);
  if (t) {
    const endDate = DS(addDays(date, -1));
    if (t.startDate && endDate < t.startDate) {
      return todos.filter(x => x.id !== id);
    } else {
      t.endDate = endDate;
    }
  }
  return todos;
}

export function addTask(data, todos) {
  const startDate = (data.recurrence && data.recurrence !== 'none') ? (data.date || DS(today())) : undefined;
  todos.push({
    id: Date.now().toString(),
    ...data,
    ...(startDate ? {startDate} : {}),
    completedDates: [],
    completed: false
  });
}

export function getSuggestions(todos) {
  const counts = {};
  todos.filter(t => !t.recurrence || t.recurrence==='none')
    .forEach(t => { counts[t.title] = (counts[t.title]||0)+1; });
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([t])=>t);
}
