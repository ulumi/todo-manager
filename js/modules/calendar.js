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
  }).map(t => resolveOccurrence(t, ds));
}

// ── Édition « cette occurrence seulement » (tâches récurrentes) ───────────
// Un override (t.overrides[ds]) est une snapshot PARTIELLE de champs qui
// prime sur le master pour UNE SEULE occurrence datée — jamais pour les
// champs qui définissent la récurrence elle-même (recurrence/recDays/
// recDay/recMonth/recLastDay/startDate/endDate/excludedDates), ni pour le
// compteur (countCurrent etc., cumulatif sur toute la série), ni pour
// durationReal/durationHistory/focusTimeSpent* (déjà un système d'historique
// séparé, cf. focus.js) — ces champs-là restent toujours sur le master.
// Pour une tâche non récurrente (ou sans `ds` connu), resolveOccurrence()
// renvoie `t` LUI-MÊME (même référence) : zéro changement de comportement,
// zéro coût, pour l'immense majorité des tâches (ponctuelles).
export function resolveOccurrence(t, ds) {
  if (!t.recurrence || t.recurrence === 'none' || !ds) return t;
  const ov = t.overrides && t.overrides[ds];
  if (!ov) return t;
  return { ...t, ...ov };
}

// Renvoie le bucket d'override d'UNE occurrence, en le créant au besoin —
// point d'entrée unique pour toute mutation « cette occurrence seulement ».
export function occurrenceOverride(t, ds) {
  t.overrides = t.overrides || {};
  if (!t.overrides[ds]) t.overrides[ds] = {};
  return t.overrides[ds];
}

// Écrit un champ scalaire quelconque (priority, dayPeriod…) : dans l'override
// de cette occurrence pour une tâche récurrente avec ds connu — toujours une
// valeur explicite (null pour « vide », jamais undefined : undefined ne
// survit pas à un aller-retour JSON, ce qui ferait réapparaître la valeur du
// master après un rechargement) — sinon directement sur le master (tâche non
// récurrente, ou pas de contexte de date), comportement inchangé.
export function setOccurrenceField(t, ds, key, value) {
  if (t.recurrence && t.recurrence !== 'none' && ds) {
    occurrenceOverride(t, ds)[key] = (value === undefined ? null : value);
  } else if (value === undefined || value === null) {
    delete t[key];
  } else {
    t[key] = value;
  }
}

// Sous-tâches : renvoie le tableau MUTABLE à utiliser pour cette occurrence —
// pour une tâche récurrente avec ds connu, clone profond des sous-tâches
// EFFECTIVES actuelles au premier accès (donc identique à ce qui était
// affiché juste avant), puis toute mutation ultérieure (push/splice sur le
// tableau retourné, ou sur les objets qu'il contient) ne touche que cette
// date — jamais le master ni les autres occurrences. Toujours muter ce
// tableau EN PLACE (push/splice) : une réaffectation (`arr = arr.filter(…)`)
// perdrait la référence vers le bucket réellement stocké.
export function occurrenceSubtasks(t, ds) {
  if (!t.recurrence || t.recurrence === 'none' || !ds) {
    if (!t.subtasks) t.subtasks = [];
    return t.subtasks;
  }
  const ov = occurrenceOverride(t, ds);
  if (!ov.subtasks) ov.subtasks = JSON.parse(JSON.stringify(resolveOccurrence(t, ds).subtasks || []));
  return ov.subtasks;
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

// Occurrences actives (non annulées) d'un moment donné (morning/afternoon/
// evening) pour une date — sert aux célébrations spéciales de fin de
// journée (app.js `_maybeCelebrateMilestone`, cf. celebrate.js `celebrateSpecial`).
export function getPeriodStatus(ds, period, todos) {
  const d = parseDS(ds);
  const items = getTodosForDate(d, todos).filter(t => t.dayPeriod === period && !isCancelled(t, d));
  const done = items.filter(t => isCompleted(t, d)).length;
  return { items, total: items.length, done };
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

// Date à laquelle la tâche a été RÉELLEMENT cochée (`t.completedDate`, YYYY-MM-DD),
// à ne pas confondre avec `t.date` (le jour où elle était prévue) : une tâche du
// 20 août cochée le 29 ne montrait nulle part cet écart.
//
// Ponctuelles seulement, et c'est un choix, pas un raccourci : pour une
// récurrente, `completedDates` porte déjà la date de l'occurrence, et on ne
// regarde une occurrence que sur son propre jour — afficher « complétée le 29 »
// en consultant le 29 serait du bruit.
//
// Le champ existait déjà, écrit par le seul sélecteur de date de complétion et
// relu par personne. Il est désormais posé par TOUS les chemins de complétion
// (il y en a six) et effacé au décochage — sans quoi une tâche décochée puis
// laissée telle quelle garderait une date de complétion mensongère.
export function stampCompletion(t) {
  if (!t) return;
  if (t.completed) t.completedDate = t.completedDate || DS(today());
  else delete t.completedDate;
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
    stampCompletion(t);
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
