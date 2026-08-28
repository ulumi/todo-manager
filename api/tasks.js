// Vercel Serverless Function — /api/tasks
//
//   GET    /api/tasks?token=…&scope=today          → list tasks
//   POST   /api/tasks?token=…   { "title": "…" }   → create a task
//   PATCH  /api/tasks?token=…   { "task": "…" }    → complete / uncomplete
//
// The token can also travel as "Authorization: Bearer <token>".
// Full reference: GET /api/docs (no token needed).
//
// This is the plain-HTTP surface (Shortcuts, curl, scripts). The Claude apps
// talk to /api/mcp instead, which wraps these same helpers.

import { ApiError, authenticate, todosOf, commitTodos, createTask, listTasks, completeTask, todayDS, resolveWhen, SCOPES } from './_todo-store.js';

const DOCS = 'https://todo.hugues.app/api/docs';

export default async function handler(req, res) {
  // Token-authenticated, never cookie-authenticated — so a permissive origin
  // costs nothing (a third-party page still needs the token) and lets iOS
  // Shortcuts, extensions and local dev pages call it.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  try {
    const { uid, data } = await authenticate(req);

    if (req.method === 'GET') {
      const scope = req.query.scope || req.query.date || 'today';
      const tasks = listTasks(scope, data, {
        includeCompleted: ['1', 'true', 'yes'].includes(String(req.query.include_completed || '').toLowerCase()),
      });
      res.status(200).json({ scope: String(scope), today: todayDS(data), count: tasks.length, tasks });
      return;
    }

    if (req.method === 'POST') {
      const body  = await readBody(req);
      const todos = todosOf(data);
      // An array creates several tasks in ONE round-trip: each write re-uploads
      // the whole user_data row and Realtime rebroadcasts it, so N separate
      // calls would be N full-row transfers (see the egress note in CLAUDE.md).
      const inputs = Array.isArray(body) ? body : (Array.isArray(body.tasks) ? body.tasks : [body]);
      if (!inputs.length) throw new ApiError(400, 'Nothing to create.');
      if (inputs.length > 50) throw new ApiError(400, 'Too many tasks in one call (max 50).');
      const created = inputs.map(input => createTask(input, data, todos));
      await commitTodos(uid, data, todos);
      res.status(201).json({ ok: true, count: created.length, tasks: created.map(t => ({ id: t.id, title: t.title, date: t.date || null, backlog: !!t.backlog })) });
      return;
    }

    if (req.method === 'PATCH') {
      const body = await readBody(req);
      const ref  = body.task ?? body.id ?? body.title;
      const ds   = body.date ? (resolveWhen(body.date, data).date || todayDS(data)) : todayDS(data);
      const uncomplete = body.completed === false;
      const { task, changed, todos } = completeTask(ref, data, ds, { uncomplete });
      if (changed) await commitTodos(uid, data, todos);
      res.status(200).json({ ok: true, changed, task });
      return;
    }

    res.setHeader('Allow', 'GET, POST, PATCH, OPTIONS');
    res.status(405).json({ error: `Method ${req.method} not allowed.`, docs: DOCS });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    if (status === 500) console.error('[api/tasks]', err);
    res.status(status).json({
      error: status === 500 ? 'Internal error.' : err.message,
      ...(status === 400 ? { scopes: SCOPES } : {}),
      docs: DOCS,
    });
  }
}

async function readBody(req) {
  let body = req.body;
  if (body === undefined || body === null || body === '') {
    body = await new Promise((resolve, reject) => {
      let buf = '';
      req.on('data', c => { buf += c; if (buf.length > 1e6) reject(new ApiError(413, 'Body too large.')); });
      req.on('end', () => resolve(buf));
      req.on('error', reject);
    });
  }
  if (typeof body === 'string') {
    if (!body.trim()) throw new ApiError(400, 'Missing JSON body.');
    try { return JSON.parse(body); }
    catch { throw new ApiError(400, 'Body is not valid JSON.'); }
  }
  if (typeof body !== 'object') throw new ApiError(400, 'Body must be a JSON object.');
  return body;
}
