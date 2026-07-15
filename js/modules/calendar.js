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

export function isCancelled(todo, d) {
  if (todo.recurrence && todo.recurrence !== 'none')
    return !!d && (todo.cancelledDates||[]).includes(DS(d));
  return !!todo.cancelled;
}

// Toggle annulée/restaurée — une occurrence annulée n'est jamais aussi « faite »
export function cancelTodo(id, d, todos) {
  const t = todos.find(x => x.id === id);
  if (!t) return;
  if (t.recurrence && t.recurrence !== 'none') {
    const ds = DS(d);
    t.cancelledDates = t.cancelledDates || [];
    if (t.cancelledDates.includes(ds)) {
      t.cancelledDates = t.cancelledDates.filter(x => x !== ds);
    } else {
      t.cancelledDates.push(ds);
      t.completedDates = (t.completedDates || []).filter(x => x !== ds);
    }
  } else {
    t.cancelled = !t.cancelled;
    if (t.cancelled) t.completed = false;
  }
  t.updatedAt = Date.now();
}

export function toggleTodo(id, d, todos) {
  const t = todos.find(x => x.id === id);
  if (!t) return;
  if (t.recurrence && t.recurrence !== 'none') {
    const ds = DS(d);
    t.completedDates = t.completedDates || [];
    if (t.completedDates.includes(ds)) t.completedDates = t.completedDates.filter(x=>x!==ds);
    else {
      t.completedDates.push(ds);
      t.cancelledDates = (t.cancelledDates || []).filter(x => x !== ds); // faite ⇒ plus annulée
    }
  } else {
    t.completed = !t.completed;
    if (t.completed) t.cancelled = false;
  }
  t.updatedAt = Date.now();
}

export function deleteOneOccurrence(id, date, todos) {
  const t = todos.find(x => x.id === id);
  if (t) {
    t.excludedDates = t.excludedDates || [];
    t.excludedDates.push(DS(date));
    t.updatedAt = Date.now();
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
      t.updatedAt = Date.now();
    }
  }
  return todos;
}

export function addTask(data, todos) {
  const startDate = (data.recurrence && data.recurrence !== 'none') ? (data.date || DS(today())) : undefined;
  let id = Date.now().toString();
  while (todos.some(t => t.id === id)) id = String(Number(id) + 1); // Date.now() peut collisionner (double-submit rapide)
  todos.push({
    id,
    ...data,
    ...(startDate ? {startDate} : {}),
    ...(data.counterEnabled ? {countCurrent: data.countFrom ?? 0} : {}),
    completedDates: [],
    completed: false,
    updatedAt: parseInt(id),
  });
}

export function getSuggestions(todos) {
  const counts = {};
  todos.filter(t => !t.recurrence || t.recurrence==='none')
    .forEach(t => { counts[t.title] = (counts[t.title]||0)+1; });
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([t])=>t);
}

// 3 most recently added unique titles (by ID desc, non-recurring only)
export function getRecentTasks(todos) {
  const seen = new Set();
  return [...todos]
    .filter(t => !t.recurrence || t.recurrence === 'none')
    .sort((a, b) => Number(b.id) - Number(a.id))
    .reduce((acc, t) => {
      if (!seen.has(t.title)) { seen.add(t.title); acc.push(t.title); }
      return acc;
    }, [])
    .slice(0, 3);
}
