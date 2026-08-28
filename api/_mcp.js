// Vercel Serverless Function — /api/mcp
//
// MCP server (Streamable HTTP transport, spec 2025-06-18) so the Claude apps —
// including the phone — can read and write the todo list through a custom
// connector. This is the ONLY channel a web-based Claude client has to reach an
// external service: it can't POST to an arbitrary REST endpoint on its own,
// which is why /api/tasks alone didn't make "add a task from my phone" work.
//
// Connect with:  https://todo.hugues.app/api/mcp?token=<token>
//
// Stateless on purpose: no Mcp-Session-Id is issued (the spec makes it
// optional), so any instance can serve any request and nothing has to survive
// between invocations — which a serverless function can't promise anyway.

import {
  ApiError, authenticate, todosOf, commitTodos, createTask, listTasks,
  completeTask, todayDS, resolveWhen, PERIODS, PRIORITIES, RECURRENCES, SCOPES, DEFAULT_TZ,
} from './_todo-store.js';

const PROTOCOL_VERSION  = '2025-06-18';
// Versions we know how to speak. A client asking for something else still gets
// PROTOCOL_VERSION back — per the lifecycle spec, the server answers with the
// version it will actually use and the client decides whether to continue.
const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

const SERVER_INFO = { name: '2fukoi-todo', title: '2FŨKOI — Todo', version: '1.0.0' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  // The transport requires the endpoint to answer GET (SSE stream) and DELETE
  // (end session); 405 is the spec's way of saying "not offered here".
  if (req.method === 'GET' || req.method === 'DELETE') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).json({ error: 'This MCP endpoint only accepts POST (no server-initiated stream, no sessions).' });
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, GET, DELETE, OPTIONS');
    res.status(405).end();
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    res.status(400).json(rpcError(null, -32700, err.message || 'Parse error'));
    return;
  }

  // 2025-03-26 allowed a batch array; 2025-06-18 removed it. Accepting both
  // costs three lines and keeps older clients working.
  const messages = Array.isArray(body) ? body : [body];
  const replies  = [];
  for (const msg of messages) {
    const reply = await handleMessage(msg, req);
    if (reply) replies.push(reply);
  }

  // Notifications and responses get 202 with no body — the client is not
  // waiting on anything, and returning a JSON-RPC envelope there is an error.
  if (!replies.length) { res.status(202).end(); return; }

  res.status(200).json(Array.isArray(body) ? replies : replies[0]);
}

// ─── JSON-RPC dispatch ─────────────────────────────────────────────────────

const rpcResult = (id, result) => ({ jsonrpc: '2.0', id, result });
const rpcError  = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

async function handleMessage(msg, req) {
  if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0') {
    return rpcError(null, -32600, 'Invalid JSON-RPC message.');
  }
  const { id, method } = msg;
  const isNotification = id === undefined || id === null;
  if (isNotification) return null;                      // nothing to answer
  if (!method) return null;                             // a response, not a request

  try {
    switch (method) {
      case 'initialize': {
        // Authenticating here means a wrong or revoked token shows up as a
        // failed connector right away, instead of every tool call failing later
        // with no obvious cause.
        await authenticate(req);
        const asked = msg.params?.protocolVersion;
        return rpcResult(id, {
          protocolVersion: SUPPORTED_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: 'Task list for 2FŨKOI (todo.hugues.app). Use list_tasks before answering questions about the day, and add_task / add_tasks to capture new work. Dates are YYYY-MM-DD in the user\'s own timezone — the tool descriptions state today\'s date.',
        });
      }

      case 'ping':
        return rpcResult(id, {});

      case 'tools/list': {
        // Today's date is injected into the descriptions: the model otherwise
        // has to guess it, and a task filed one day off is worse than useless.
        let ctx = null;
        try { ctx = await authenticate(req); } catch { /* keep the list usable; tools/call reports the real error */ }
        return rpcResult(id, { tools: toolDefs(ctx?.data) });
      }

      case 'tools/call':
        return rpcResult(id, await callTool(msg.params, req));

      // Not advertised in capabilities, but some clients probe anyway — an
      // empty list is quieter than a "method not found" in their logs.
      case 'resources/list':           return rpcResult(id, { resources: [] });
      case 'resources/templates/list': return rpcResult(id, { resourceTemplates: [] });
      case 'prompts/list':             return rpcResult(id, { prompts: [] });

      default:
        return rpcError(id, -32601, `Method not found: ${method}`);
    }
  } catch (err) {
    if (err instanceof ApiError) {
      // -32002 is the conventional "unauthorized" code in MCP implementations;
      // everything else is an invalid-params / internal split.
      const code = err.status === 401 ? -32002 : err.status === 400 ? -32602 : -32603;
      return rpcError(id, code, err.message);
    }
    console.error('[api/mcp]', method, err);
    return rpcError(id, -32603, 'Internal error.');
  }
}

// ─── Tools ─────────────────────────────────────────────────────────────────

const TASK_FIELDS = today => ({
  title:       { type: 'string', description: 'What the task is. Required.' },
  date:        { type: 'string', description: `When to do it: a YYYY-MM-DD date, "today", "tomorrow", "+N" (in N days), "inbox" (no date yet) or "backlog" (set aside for later). Today is ${today}. Defaults to "inbox" when omitted.` },
  day_period:  { type: 'string', enum: PERIODS, description: 'Moment of the day. The app groups the day into morning / afternoon / evening.' },
  start_time:  { type: 'string', description: 'Time of day, HH:MM in 24h (e.g. "14:30"). Only for a task that happens at a set time.' },
  duration_minutes: { type: 'integer', description: 'Estimated duration in minutes. Drives the block height in the agenda view and the focus-mode timer target.' },
  priority:    { type: 'string', enum: PRIORITIES, description: 'Priority. Omit for none.' },
  description: { type: 'string', description: 'Free-form notes attached to the task.' },
  subtasks:    { type: 'array', items: { type: 'string' }, description: 'Checklist items inside the task.' },
  category:    { type: 'string', description: 'Name of an EXISTING tag/category (case-insensitive). The call fails and lists the known ones if it does not exist — it never creates one.' },
  deadline:    { type: 'string', description: 'Hard due date (YYYY-MM-DD, "today", "tomorrow", "+N") — "after this it is too late", distinct from `date` which is when you plan to do it. Not allowed on a recurring task.' },
  recurrence:  { type: 'string', enum: RECURRENCES, description: 'Repeat rule. Defaults to "none". With "weekly" you must also pass week_days.' },
  week_days:   { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 }, description: 'Required for recurrence "weekly": weekday numbers, 0 = Sunday … 6 = Saturday.' },
  month_days:  { type: 'array', items: { type: 'integer', minimum: 1, maximum: 31 }, description: 'Optional for recurrence "monthly": days of the month.' },
  links:       { type: 'array', items: { type: 'string' }, description: 'URLs to attach to the task.' },
});

function toolDefs(data) {
  const today = data ? todayDS(data) : 'unknown';
  const tz    = data?.config?.timezone || DEFAULT_TZ;
  const stamp = data ? `Today is ${today} (${tz}).` : '';
  const fields = TASK_FIELDS(today);

  return [
    {
      name: 'add_task',
      title: 'Add a task',
      description: `Create one task in the 2FŨKOI todo list. ${stamp} Use this for a single item; for several at once use add_tasks, which saves in one round-trip.`,
      inputSchema: { type: 'object', properties: fields, required: ['title'] },
      annotations: { title: 'Add a task', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    {
      name: 'add_tasks',
      title: 'Add several tasks',
      description: `Create several tasks at once (max 50). ${stamp} Each entry takes the same fields as add_task; a bare string is treated as a title landing in the Inbox.`,
      inputSchema: {
        type: 'object',
        properties: {
          tasks: {
            type: 'array',
            description: 'The tasks to create.',
            items: { type: 'object', properties: fields, required: ['title'] },
          },
          date: { type: 'string', description: `Default date applied to every entry that does not set its own. Same accepted values as add_task.date. Today is ${today}.` },
        },
        required: ['tasks'],
      },
      annotations: { title: 'Add several tasks', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    {
      name: 'list_tasks',
      title: 'List tasks',
      description: `Read the todo list. ${stamp} Returns each task with its id, which complete_task can take. Recurring tasks are expanded to the occurrence of the day asked for.`,
      inputSchema: {
        type: 'object',
        properties: {
          scope: { type: 'string', description: `What to list: "today", "tomorrow", "week" (the next 7 days), "inbox" (undated), "backlog" (set aside), "overdue" (past dates still unfinished), or a YYYY-MM-DD date. Today is ${today}. Defaults to "today".` },
          include_completed: { type: 'boolean', description: 'Include tasks already done or cancelled. Defaults to false.' },
        },
      },
      annotations: { title: 'List tasks', readOnlyHint: true, openWorldHint: false },
    },
    {
      name: 'complete_task',
      title: 'Complete a task',
      description: `Tick a task off (or untick it with completed:false). ${stamp} Identify it by the id from list_tasks, or by title — an ambiguous title is refused rather than guessed.`,
      inputSchema: {
        type: 'object',
        properties: {
          task: { type: 'string', description: 'The task id (preferred) or its exact title.' },
          date: { type: 'string', description: `Which occurrence, for a recurring task: YYYY-MM-DD, "today", "tomorrow". Defaults to today (${today}). Only that day is affected, never the whole series.` },
          completed: { type: 'boolean', description: 'false to mark it as not done again. Defaults to true.' },
        },
        required: ['task'],
      },
      annotations: { title: 'Complete a task', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
  ];
}

const text = t => ({ content: [{ type: 'text', text: t }], isError: false });

async function callTool(params, req) {
  const name = params?.name;
  const args = params?.arguments && typeof params.arguments === 'object' ? params.arguments : {};
  const { uid, data } = await authenticate(req);

  switch (name) {
    case 'add_task': {
      const todos = todosOf(data);
      const task  = createTask(args, data, todos);
      await commitTodos(uid, data, todos);
      return text(`Added: ${describeCreated(task)}`);
    }

    case 'add_tasks': {
      const list = Array.isArray(args.tasks) ? args.tasks : [];
      if (!list.length) throw new ApiError(400, 'tasks must be a non-empty array.');
      if (list.length > 50) throw new ApiError(400, 'Too many tasks in one call (max 50).');
      const todos = todosOf(data);
      // One commit for the whole batch: every write re-uploads the entire
      // user_data row and Realtime rebroadcasts it to each open tab, so
      // per-task saves would multiply that payload for no benefit.
      const created = list.map(entry => createTask(
        typeof entry === 'string'
          ? { title: entry, date: args.date }
          : { date: args.date, ...entry },
        data, todos,
      ));
      await commitTodos(uid, data, todos);
      return text(`Added ${created.length} task${created.length > 1 ? 's' : ''}:\n` + created.map(t => `• ${describeCreated(t)}`).join('\n'));
    }

    case 'list_tasks': {
      const scope = args.scope || 'today';
      const tasks = listTasks(scope, data, { includeCompleted: args.include_completed === true });
      if (!tasks.length) return text(`No task for "${scope}".`);
      return text(`${tasks.length} task${tasks.length > 1 ? 's' : ''} for "${scope}" (today is ${todayDS(data)}):\n` + tasks.map(formatTask).join('\n'));
    }

    case 'complete_task': {
      const ds = args.date ? (resolveWhen(args.date, data).date || todayDS(data)) : todayDS(data);
      const { task, changed, todos } = completeTask(args.task, data, ds, { uncomplete: args.completed === false });
      if (changed) await commitTodos(uid, data, todos);
      const state = task.completed ? 'done' : 'not done';
      return text(changed ? `Marked "${task.title}" as ${state} for ${ds}.` : `"${task.title}" was already ${state} for ${ds} — nothing changed.`);
    }

    default:
      throw new ApiError(400, `Unknown tool: ${name}`);
  }
}

function describeCreated(t) {
  const where = t.date ? `on ${t.date}` : (t.backlog ? 'in the Backlog' : 'in the Inbox');
  const bits  = [where];
  if (t.dayPeriod) bits.push({ morning: 'morning', afternoon: 'afternoon', evening: 'evening' }[t.dayPeriod]);
  if (t.startTime) bits.push(`at ${t.startTime}`);
  if (t.recurrence && t.recurrence !== 'none') bits.push(`repeats ${t.recurrence}`);
  return `"${t.title}" ${bits.join(', ')} [id ${t.id}]`;
}

function formatTask(t) {
  const bits = [];
  if (t.startTime) bits.push(t.startTime);
  if (t.dayPeriod) bits.push(t.dayPeriod);
  if (t.priority)  bits.push(`priority ${t.priority}`);
  if (t.recurrence) bits.push(`repeats ${t.recurrence}`);
  if (t.deadline)  bits.push(`deadline ${t.deadline}`);
  if (t.subtasks?.length) bits.push(`${t.subtasks.filter(s => s.completed).length}/${t.subtasks.length} subtasks`);
  const mark = t.cancelled ? '⊘' : t.completed ? '✓' : '○';
  return `${mark} ${t.title}${bits.length ? ` — ${bits.join(', ')}` : ''} [id ${t.id}]`;
}

async function readBody(req) {
  let body = req.body;
  if (body === undefined || body === null || body === '') {
    body = await new Promise((resolve, reject) => {
      let buf = '';
      req.on('data', c => { buf += c; if (buf.length > 1e6) reject(new Error('Body too large')); });
      req.on('end', () => resolve(buf));
      req.on('error', reject);
    });
  }
  if (typeof body === 'string') {
    if (!body.trim()) throw new Error('Empty body');
    return JSON.parse(body);
  }
  return body;
}
