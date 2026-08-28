// ════════════════════════════════════════════════════════
//  Shared task store for the public API
//  — api/tasks.js  (REST, for Shortcuts / curl / scripts)
//  — api/mcp.js    (MCP connector, for the Claude apps)
//  Prefixed with _ so Vercel doesn't expose it as a route.
// ════════════════════════════════════════════════════════
//
// Reuses the app's OWN logic from js/modules/ instead of reimplementing it:
// addTask / getTodosForDate / toggleTodo / isCompleted / isCancelled /
// resolveOccurrence are pure functions with no DOM or localStorage access at
// import time (verified — they import only utils.js), so Vercel bundles them
// fine and the server behaves EXACTLY like the browser. A second copy of the
// recurrence rules here would silently drift from the app's the first time
// one of them changes.

import { timingSafeEqual } from 'node:crypto';
import { supabase, supabaseConfigured } from './_supabase.js';
import {
  addTask, getTodosForDate, toggleTodo,
  isCompleted, isCancelled, resolveOccurrence,
} from '../js/modules/calendar.js';
import { DS, parseDS, addDays } from '../js/modules/utils.js';

export { DS, parseDS, getTodosForDate };

export const DEFAULT_TZ  = 'America/Montreal';
export const PERIODS     = ['morning', 'afternoon', 'evening'];
export const PRIORITIES  = ['low', 'medium', 'high'];
export const RECURRENCES = ['none', 'daily', 'weekly', 'monthly', 'yearly'];
export const SCOPES      = ['today', 'tomorrow', 'week', 'inbox', 'backlog', 'overdue'];

// Thrown by every helper below; handlers turn it into an HTTP status (REST) or
// an isError tool result (MCP). `status` is always set.
export class ApiError extends Error {
  constructor(status, message) { super(message); this.name = 'ApiError'; this.status = status; }
}

// ─── Auth ──────────────────────────────────────────────────────────────────
// Token shape is "<supabase uid>_<secret>", same as the iCal feed token, but
// backed by a SEPARATE secret (data.apiSecret). Deliberately not shared: the
// iCal URL gets pasted into Google/Apple Calendar and other people's clients,
// and must never also grant write access to the task list.

function safeEqual(a, b) {
  const ba = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function readToken(req) {
  const header = req.headers?.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  const q = req.query?.token;
  if (typeof q === 'string' && q.trim()) return q.trim();
  return null;
}

export async function authenticate(req) {
  const token = readToken(req);
  if (!token) {
    throw new ApiError(401, 'Missing token — pass ?token=<token> or an "Authorization: Bearer <token>" header. Generate one in the app: menu → Réglages → API & Claude.');
  }
  const sep = token.indexOf('_');
  if (sep < 5) throw new ApiError(401, 'Malformed token (expected "<uid>_<secret>").');

  const uid    = token.slice(0, sep);
  const secret = token.slice(sep + 1);
  if (!secret) throw new ApiError(401, 'Malformed token (empty secret).');
  // user_id is a uuid column: querying it with a non-uuid makes Postgres fail
  // the whole statement, which would surface as "storage unavailable" (503) —
  // a misleading answer to what is simply a bad token.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uid)) {
    throw new ApiError(401, 'Malformed token (bad account id).');
  }

  // Contrôlé seulement ici : après la forme du jeton (une requête sans jeton
  // est fautive quelle que soit la config du serveur — la signaler en 503
  // masquerait l'erreur de l'appelant), et avant le réseau (sans clé, Supabase
  // répondrait « Invalid API key », qui remonterait en « jeton invalide » et
  // enverrait chercher le problème du mauvais côté).
  if (!supabaseConfigured) {
    throw new ApiError(503, 'Server misconfigured: no Supabase service key. Check the deployment environment variables.');
  }

  let row;
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('data')
      .eq('user_id', uid)
      .maybeSingle();
    if (error) throw error;
    row = data;
  } catch (err) {
    console.error('[api] user_data read failed:', err.message);
    throw new ApiError(503, 'Storage unavailable, try again.');
  }

  if (!row?.data?.apiSecret || !safeEqual(row.data.apiSecret, secret)) {
    throw new ApiError(401, 'Invalid token.');
  }
  return { uid, data: row.data };
}

// ─── Read / write ──────────────────────────────────────────────────────────

export function todosOf(data) {
  return Array.isArray(data.calendar) ? data.calendar : (Array.isArray(data.todos) ? data.todos : []);
}

// Read-modify-write of the whole row, like every client push (sync.js
// pushToSupabase) — Realtime then rebroadcasts it and each open tab merges it
// per item on `updatedAt` (_applyBackup in app.js), so a task added here shows
// up live everywhere without a reload.
//
// `_pushedBySession` MUST be dropped: it is the echo guard of whichever tab
// pushed last, and _applyBackup returns early on a matching id — writing it
// back verbatim would make exactly that tab (very likely the one on screen)
// ignore our update.
export function buildRowPayload(uid, data, todos) {
  const { _pushedBySession, ...rest } = data;
  return {
    user_id:    uid,
    data:       { ...rest, calendar: todos },
    updated_at: new Date().toISOString(),
  };
}

export async function commitTodos(uid, data, todos) {
  try {
    const { error } = await supabase
      .from('user_data')
      .upsert(buildRowPayload(uid, data, todos));
    if (error) throw error;
  } catch (err) {
    console.error('[api] user_data write failed:', err.message);
    throw new ApiError(503, 'Could not save — try again.');
  }
}

// ─── Dates ─────────────────────────────────────────────────────────────────
// The function runs on a UTC box; "today" must mean the user's today. Their
// timezone lives in config.timezone (same field the iCal feed reads), and
// en-CA formats as YYYY-MM-DD natively.
export function todayDS(data) {
  const opts = { year: 'numeric', month: '2-digit', day: '2-digit' };
  const tz   = data?.config?.timezone || DEFAULT_TZ;
  try {
    return new Intl.DateTimeFormat('en-CA', { ...opts, timeZone: tz }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat('en-CA', { ...opts, timeZone: DEFAULT_TZ }).format(new Date());
  }
}

export function isValidDS(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parseDS(s);
  return !isNaN(d) && DS(d) === s;
}

// Where a task lands: a date, the Inbox (no date), or the Backlog.
// Anything unrecognized is REJECTED rather than defaulted to today — silently
// guessing is how a task ends up on the wrong day with nobody noticing.
export function resolveWhen(input, data) {
  const raw = (input ?? '').toString().trim().toLowerCase();
  if (!raw || raw === 'inbox' || raw === 'someday') return {};
  if (raw === 'backlog') return { backlog: true };

  const t = todayDS(data);
  if (['today', "aujourd'hui", 'aujourdhui', 'auj'].includes(raw)) return { date: t };
  if (['tomorrow', 'demain'].includes(raw))  return { date: DS(addDays(parseDS(t),  1)) };
  if (['yesterday', 'hier'].includes(raw))   return { date: DS(addDays(parseDS(t), -1)) };

  const rel = raw.match(/^\+(\d{1,3})$/);
  if (rel) return { date: DS(addDays(parseDS(t), parseInt(rel[1], 10))) };

  if (isValidDS(raw)) return { date: raw };

  throw new ApiError(400, `Unrecognized date "${input}" — use YYYY-MM-DD, "today", "tomorrow", "+N" (in N days), "inbox" or "backlog".`);
}

// ─── Task creation ─────────────────────────────────────────────────────────

function str(v, field, max) {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  if (max && s.length > max) throw new ApiError(400, `${field} is too long (max ${max} characters).`);
  return s;
}

function oneOf(v, allowed, field) {
  const s = str(v, field);
  if (s === undefined) return undefined;
  if (!allowed.includes(s)) throw new ApiError(400, `${field} must be one of: ${allowed.join(', ')}.`);
  return s;
}

function time(v, field) {
  const s = str(v, field);
  if (s === undefined) return undefined;
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m || +m[1] > 23 || +m[2] > 59) throw new ApiError(400, `${field} must be HH:MM (24h).`);
  return `${String(+m[1]).padStart(2, '0')}:${m[2]}`;
}

function posInt(v, field, max) {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > max) throw new ApiError(400, `${field} must be a number between 1 and ${max}.`);
  return Math.round(n);
}

function normalizeUrl(u) {
  const s = String(u).trim();
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

// Category by name (case-insensitive) — the API deals in names because that's
// what a person (or Claude) says out loud; ids are an internal detail.
function resolveCategoryIds(input, data) {
  const wanted = []
    .concat(input.category ?? [], input.categories ?? [])
    .map(c => String(c).trim().toLowerCase())
    .filter(Boolean);
  if (!wanted.length) return undefined;

  const cats = Array.isArray(data.categories) ? data.categories : [];
  const ids  = [];
  for (const name of wanted) {
    const hit = cats.find(c => String(c.name || '').trim().toLowerCase() === name);
    if (!hit) {
      const known = cats.map(c => c.name).filter(Boolean).join(', ') || '(none yet)';
      throw new ApiError(400, `Unknown category "${name}". Existing categories: ${known}.`);
    }
    if (!ids.includes(hit.id)) ids.push(hit.id);
  }
  return ids;
}

function buildSubtasks(input) {
  const list = input.subtasks;
  if (list === undefined || list === null) return undefined;
  if (!Array.isArray(list)) throw new ApiError(400, 'subtasks must be an array of strings.');
  const base = Date.now();
  return list.map((s, i) => {
    const title = str(typeof s === 'string' ? s : s?.title, 'subtask title', 500);
    if (!title) throw new ApiError(400, 'A subtask cannot be empty.');
    return { id: String(base + i), title, completed: false };
  });
}

// Builds the todo payload and appends it via the app's own addTask(), which
// owns id generation (with collision retry), completedDates/completed and
// startDate for recurring tasks. Returns the created task.
export function createTask(input, data, todos) {
  const title = str(input.title, 'title', 500);
  if (!title) throw new ApiError(400, 'title is required.');

  const recurrence = oneOf(input.recurrence, RECURRENCES, 'recurrence') || 'none';
  const recurring  = recurrence !== 'none';

  // A recurring task has no Inbox/Backlog state — its date is the series start.
  const when = recurring
    ? { date: resolveWhen(input.date ?? 'today', data).date || todayDS(data) }
    : resolveWhen(input.date, data);

  const payload = {
    title,
    recurrence,
    ...when,
    description:       str(input.description ?? input.notes, 'description', 5000),
    priority:          oneOf(input.priority, PRIORITIES, 'priority'),
    dayPeriod:         oneOf(input.day_period ?? input.dayPeriod, PERIODS, 'day_period'),
    startTime:         time(input.start_time ?? input.startTime, 'start_time'),
    durationEstimated: posInt(input.duration_minutes ?? input.durationEstimated, 'duration_minutes', 24 * 60),
    categoryIds:       resolveCategoryIds(input, data),
    subtasks:          buildSubtasks(input),
  };

  if (recurrence === 'weekly') {
    const days = input.week_days ?? input.recDays;
    if (!Array.isArray(days) || !days.length) {
      throw new ApiError(400, 'A weekly task needs week_days — an array of weekday numbers (0 = Sunday … 6 = Saturday).');
    }
    payload.recDays = days.map(d => {
      const n = Number(d);
      if (!Number.isInteger(n) || n < 0 || n > 6) throw new ApiError(400, 'week_days entries must be integers from 0 (Sunday) to 6 (Saturday).');
      return n;
    });
  }
  if (recurrence === 'monthly') {
    const days = input.month_days ?? input.recDays;
    if (Array.isArray(days) && days.length) {
      payload.recDays = days.map(d => {
        const n = Number(d);
        if (!Number.isInteger(n) || n < 1 || n > 31) throw new ApiError(400, 'month_days entries must be integers from 1 to 31.');
        return n;
      });
    }
  }

  // Deadline is a punctual-task concept only — the modal hides the section on
  // a recurring task and saveTaskLogic() strips the fields (see CLAUDE.md).
  const deadline = str(input.deadline, 'deadline');
  if (deadline) {
    if (recurring) throw new ApiError(400, 'A recurring task cannot have a deadline.');
    const resolved = resolveWhen(deadline, data).date;
    if (!resolved) throw new ApiError(400, 'deadline must be a date (YYYY-MM-DD, "today", "tomorrow", "+N").');
    payload.deadline = resolved;
    const dTime = time(input.deadline_time ?? input.deadlineTime, 'deadline_time');
    if (dTime) payload.deadlineTime = dTime;
  }

  const links = input.links;
  if (Array.isArray(links) && links.length) {
    payload.links = links.map(normalizeUrl).filter(Boolean);
  }

  // Never store an explicit empty/undefined field — the app treats "absent"
  // and "" differently in places (dayPeriod above all: any value outside
  // morning/afternoon/evening makes a task invisible in the day view).
  for (const k of Object.keys(payload)) {
    if (payload[k] === undefined) delete payload[k];
  }

  const before = new Set(todos.map(t => t.id));
  addTask(payload, todos);
  return todos.find(t => !before.has(t.id));
}

// ─── Reading ───────────────────────────────────────────────────────────────

// One task as the API exposes it. `ds` is the occurrence date being asked
// about, so a recurring task reports the status (and overridden fields) of
// THAT day rather than of the shared master.
export function serializeTask(t, ds) {
  const eff  = ds ? resolveOccurrence(t, ds) : t;
  const date = ds ? parseDS(ds) : (t.date ? parseDS(t.date) : null);
  const out = {
    id:        t.id,
    title:     eff.title,
    completed: date ? isCompleted(t, date) : !!t.completed,
    cancelled: date ? isCancelled(t, date) : !!t.cancelled,
  };
  if (ds || eff.date)          out.date       = ds || eff.date;
  if (eff.dayPeriod)           out.dayPeriod  = eff.dayPeriod;
  if (eff.startTime)           out.startTime  = eff.startTime;
  if (eff.priority)            out.priority   = eff.priority;
  if (eff.recurrence && eff.recurrence !== 'none') out.recurrence = eff.recurrence;
  if (t.backlog)               out.backlog    = true;
  if (eff.deadline)            out.deadline   = eff.deadline;
  if (eff.durationEstimated)   out.durationMinutes = eff.durationEstimated;
  if (eff.description)         out.description = eff.description;
  const subs = eff.subtasks || [];
  if (subs.length) {
    out.subtasks = subs.map(s => ({ title: s.title, completed: !!s.completed }));
  }
  return out;
}

const isPunctual = t => !t.recurrence || t.recurrence === 'none';

// scope: "today" | "tomorrow" | "week" | "inbox" | "backlog" | "overdue" | YYYY-MM-DD
export function listTasks(scope, data, { includeCompleted = false } = {}) {
  const todos = todosOf(data);
  const t     = todayDS(data);
  const raw   = (scope ?? 'today').toString().trim().toLowerCase();

  const forDate = ds => getTodosForDate(parseDS(ds), todos)
    .map(x => serializeTask(x, ds))
    .filter(x => includeCompleted || (!x.completed && !x.cancelled));

  if (raw === 'inbox') {
    return todos
      .filter(x => isPunctual(x) && !x.date && !x.backlog && !x.completed && !x.cancelled)
      .map(x => serializeTask(x, null));
  }
  if (raw === 'backlog') {
    return todos
      .filter(x => isPunctual(x) && x.backlog && !x.completed && !x.cancelled)
      .map(x => serializeTask(x, null));
  }
  if (raw === 'overdue') {
    return todos
      .filter(x => isPunctual(x) && x.date && x.date < t && !x.completed && !x.cancelled)
      .map(x => serializeTask(x, x.date));
  }
  if (raw === 'week') {
    const out = [];
    for (let i = 0; i < 7; i++) out.push(...forDate(DS(addDays(parseDS(t), i))));
    return out;
  }

  const when = resolveWhen(raw, data);
  if (!when.date) throw new ApiError(400, `Unknown scope "${scope}" — use one of: ${SCOPES.join(', ')}, or a YYYY-MM-DD date.`);
  return forDate(when.date);
}

// ─── Mutations on an existing task ─────────────────────────────────────────

// Finds one task by id, or by a case-insensitive title match. Ambiguity is an
// error, never a silent "first match wins" — completing the wrong task is not
// something the caller can see happening.
export function findTask(ref, data, ds) {
  const todos = todosOf(data);
  const needle = str(ref, 'task');
  if (!needle) throw new ApiError(400, 'Give a task id or title.');

  const byId = todos.find(t => t.id === needle);
  if (byId) return byId;

  const lower  = needle.toLowerCase();
  const scoped = ds
    ? getTodosForDate(parseDS(ds), todos).map(t => todos.find(x => x.id === t.id)).filter(Boolean)
    : todos;

  const exact = scoped.filter(t => String(resolveOccurrence(t, ds).title || '').trim().toLowerCase() === lower);
  const pool  = exact.length ? exact
    : scoped.filter(t => String(resolveOccurrence(t, ds).title || '').toLowerCase().includes(lower));

  if (!pool.length)    throw new ApiError(404, `No task matching "${ref}"${ds ? ` on ${ds}` : ''}.`);
  if (pool.length > 1) {
    throw new ApiError(400, `"${ref}" matches ${pool.length} tasks (${pool.map(t => `${t.title} [id ${t.id}]`).join(', ')}). Use the id.`);
  }
  return pool[0];
}

// Toggle completion for one occurrence. `ds` matters for recurring tasks —
// toggleTodo writes into completedDates for that date, never the whole series.
export function completeTask(ref, data, ds, { uncomplete = false } = {}) {
  const todos  = todosOf(data);
  const target = findTask(ref, data, ds);
  const date   = parseDS(ds);
  const done   = isCompleted(target, date);
  if (done !== uncomplete) {
    // Already in the requested state — report it without touching anything.
    return { task: serializeTask(target, ds), changed: false, todos };
  }
  toggleTodo(target.id, date, todos);
  return { task: serializeTask(target, ds), changed: true, todos };
}
