// Vercel Serverless Function — GET /api/docs
// Public reference for the task API. No token required: it documents the
// endpoints, it never exposes data. Served as plain text so it reads fine in a
// browser, in curl, and to a model asked to "read https://todo.hugues.app/api/docs".
// `?format=json` returns the same thing as a machine-readable descriptor.

import { PERIODS, PRIORITIES, RECURRENCES, SCOPES, UPDATE_SCOPES, DELETE_SCOPES } from './_todo-store.js';

const BASE = 'https://todo.hugues.app';

const MARKDOWN = `# 2FŨKOI — Task API

Two ways in, one task list behind them:

| Surface | Endpoint | For |
|---|---|---|
| MCP connector | \`${BASE}/api/mcp?token=<token>\` | The Claude apps (desktop, web, **phone**) |
| REST | \`${BASE}/api/tasks\` | iOS Shortcuts, curl, scripts |

Anything written through either shows up live in every open tab of the app
(Supabase Realtime), and syncs to every device.

## Getting a token

In the app: menu ☰ → **Réglages** → **API & Claude**. The panel shows the
connector URL and the token, with copy buttons, and can revoke and reissue one.

The token looks like \`<uid>_<secret>\`. It grants **read and write** on the task
list — it is not the iCal token, which is read-only and safe to hand to a
calendar app. Never paste this one into a third-party service.

Send it either way:

- \`?token=<token>\` in the query string (the only option for the MCP connector,
  which has no place to set headers)
- \`Authorization: Bearer <token>\` (preferred for scripts)

## Adding the connector to Claude

claude.ai → Settings → Connectors → **Add custom connector** → paste the URL
including \`?token=…\`. It then shows up in the Claude mobile app too. Tools
exposed: \`add_task\`, \`add_tasks\`, \`list_tasks\`, \`update_task\`,
\`delete_task\`, \`complete_task\`.

## REST

### GET /api/tasks

Query: \`scope\` (default \`today\`), \`include_completed\` (\`1\`/\`true\`).

Scopes: ${SCOPES.map(s => `\`${s}\``).join(', ')}, or any \`YYYY-MM-DD\` date.

\`\`\`bash
curl "${BASE}/api/tasks?scope=today" -H "Authorization: Bearer $TODO_TOKEN"
\`\`\`

\`\`\`json
{ "scope": "today", "today": "2026-08-28", "count": 1,
  "tasks": [ { "id": "1756...", "title": "Appeler le dentiste",
               "completed": false, "cancelled": false,
               "date": "2026-08-28", "dayPeriod": "morning" } ] }
\`\`\`

Recurring tasks are expanded to the occurrence of the day asked for, with that
day's overrides applied — the same resolution the app itself does.

### POST /api/tasks

Body: one task object, or an array, or \`{ "tasks": [...] }\` (max 50 — one call
writes once, and every write re-uploads the whole row).

\`\`\`bash
curl -X POST "${BASE}/api/tasks" \\
  -H "Authorization: Bearer $TODO_TOKEN" -H "Content-Type: application/json" \\
  -d '{"title":"Acheter du pain","date":"today","day_period":"morning"}'
\`\`\`

Fields:

| Field | Type | Notes |
|---|---|---|
| \`title\` | string | **required** |
| \`date\` | string | \`YYYY-MM-DD\`, \`today\`, \`tomorrow\`, \`+N\`, \`inbox\`, \`backlog\`. Default \`inbox\`. Resolved in **your** timezone (\`config.timezone\`), not the server's |
| \`day_period\` | string | ${PERIODS.join(' \\| ')} |
| \`start_time\` | string | \`HH:MM\`, 24h |
| \`duration_minutes\` | integer | estimated duration |
| \`priority\` | string | ${PRIORITIES.join(' \\| ')} |
| \`description\` | string | notes |
| \`subtasks\` | string[] | checklist |
| \`category\` | string | name of an **existing** tag; unknown names are refused with the list of known ones |
| \`deadline\` | string | hard due date — distinct from \`date\`. Rejected on a recurring task |
| \`deadline_time\` | string | \`HH:MM\` |
| \`recurrence\` | string | ${RECURRENCES.join(' \\| ')}. Default \`none\` |
| \`week_days\` | int[] | required with \`weekly\` — 0 = Sunday … 6 = Saturday |
| \`month_days\` | int[] | optional with \`monthly\` — 1–31 |
| \`links\` | string[] | URLs (\`https://\` added if missing) |

Unknown dates, periods, priorities and categories are **rejected**, never
silently defaulted: a task quietly filed on the wrong day is worse than a 400.

Returns \`201\` with \`{ ok, count, tasks: [{ id, title, date, backlog }] }\`.

### PATCH /api/tasks

Change a task: edit its fields, tick it off, or both in one call.

\`task\` is an id (from GET) or an exact title; an ambiguous title is refused
with the candidates rather than guessed. A body with nothing but \`task\`
completes it — \`completed: false\` un-ticks it.

\`\`\`bash
# tick it off
curl -X PATCH "${BASE}/api/tasks" \\
  -H "Authorization: Bearer $TODO_TOKEN" -H "Content-Type: application/json" \\
  -d '{"task":"Acheter du pain","date":"today"}'

# edit it
curl -X PATCH "${BASE}/api/tasks" \\
  -H "Authorization: Bearer $TODO_TOKEN" -H "Content-Type: application/json" \\
  -d '{"task":"Acheter du pain","priority":"high","move_to":"tomorrow"}'
\`\`\`

**Only the fields you send change.** Everything else is left alone — this is a
patch, not the whole task. Send \`null\` to clear a field, \`[]\` to clear a list.

\`date\` says **which occurrence** the call is about (default today) — it never
moves the task. Rescheduling is \`move_to\`, so the two can't be confused.

| Field | Notes |
|---|---|
| \`title\` | cannot be emptied |
| \`description\`, \`priority\`, \`day_period\`, \`start_time\`, \`duration_minutes\` | same values as POST |
| \`subtasks\`, \`links\` | replace the whole list |
| \`category\` | name of an existing tag |
| \`move_to\` | new \`date\` / \`inbox\` / \`backlog\` |
| \`deadline\`, \`deadline_time\` | punctual tasks only |
| \`recurrence\`, \`week_days\`, \`month_days\` | change how it repeats; \`none\` makes it a one-off again |
| \`end_date\` | recurring only — last day the series runs |
| \`cancelled\` | \`true\` abandons the task (kept, struck through, out of every count) |
| \`completed\` | tick / un-tick |
| \`scope\` | recurring only: ${UPDATE_SCOPES.map(x => `\`${x}\``).join(' or ')} |

Returns \`{ ok, changed: [...], task }\`.

#### Recurring tasks

By default an edit touches **only the occurrence at \`date\`** — exactly like
editing that day in the app, which stores the change as a per-day override and
leaves every other occurrence alone. Pass \`"scope":"series"\` to edit the task
itself instead.

A series never carries a deadline, and never sits in the Inbox or Backlog; the
API refuses those rather than storing a state the app can't show. Moving a
single occurrence to another day isn't a thing either — delete that occurrence
and add a one-off task.

### DELETE /api/tasks

\`\`\`bash
curl -X DELETE "${BASE}/api/tasks?task=1756123456789" -H "Authorization: Bearer $TODO_TOKEN"
curl -X DELETE "${BASE}/api/tasks?task=Yoga&scope=series" -H "Authorization: Bearer $TODO_TOKEN"
\`\`\`

\`task\`, \`date\` and \`scope\` travel in the query string or in a JSON body.
A one-off task is simply removed. A recurring one takes the app's own three
choices:

| \`scope\` | Effect |
|---|---|
| \`occurrence\` *(default)* | skip the single day at \`date\`, keep the series |
| \`future\` | end the series the day before \`date\` |
| \`series\` | delete the task entirely, history included |

Returns \`{ ok, mode, removed, changed, task }\` — \`removed\` tells you whether
the task itself is gone or just one of its days. Deletions are tombstoned, so a
device that was offline at the time won't re-upload the task on reconnect.

There is no undo here. \`cancelled: true\` via PATCH is the reversible option:
the task stays, struck through, and out of every count.

## Errors

JSON \`{ "error": "...", "docs": "${BASE}/api/docs" }\` with status \`400\`
(bad input), \`401\` (missing/invalid token), \`404\` (no such task), \`405\`,
\`503\` (storage unreachable). Over MCP the same messages come back as JSON-RPC
errors: \`-32002\` unauthorized, \`-32602\` bad arguments, \`-32603\` internal.

## Also available

\`GET /api/ical?token=<ical token>\` — read-only calendar feed, **different
token**, generated in Réglages → Calendrier.
`;

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=300');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET, OPTIONS'); res.status(405).end(); return; }

  if (String(req.query.format || '').toLowerCase() === 'json') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json({
      name: '2FŨKOI Task API',
      mcp:  { url: `${BASE}/api/mcp?token=<token>`, transport: 'streamable-http', protocolVersion: '2025-06-18', tools: ['add_task', 'add_tasks', 'list_tasks', 'update_task', 'delete_task', 'complete_task'] },
      rest: {
        base: `${BASE}/api/tasks`,
        methods: {
          GET: 'list tasks (scope, include_completed)',
          POST: 'create task(s)',
          PATCH: 'edit fields and/or complete a task',
          DELETE: 'delete a task (task, date, scope)',
        },
        auth: 'Authorization: Bearer <token>, or ?token=<token>',
      },
      enums: { scopes: SCOPES, dayPeriods: PERIODS, priorities: PRIORITIES, recurrences: RECURRENCES, updateScopes: UPDATE_SCOPES, deleteScopes: DELETE_SCOPES },
      docs: `${BASE}/api/docs`,
    });
    return;
  }

  // text/plain rather than text/markdown: browsers render it inline instead of
  // offering to download it, and it stays just as readable to curl or a model.
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.status(200).send(MARKDOWN);
}
