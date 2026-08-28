// Vercel Serverless Function — GET /api/docs
// Public reference for the task API. No token required: it documents the
// endpoints, it never exposes data. Served as plain text so it reads fine in a
// browser, in curl, and to a model asked to "read https://todo.hugues.app/api/docs".
// `?format=json` returns the same thing as a machine-readable descriptor.

import { PERIODS, PRIORITIES, RECURRENCES, SCOPES } from './_todo-store.js';

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
exposed: \`add_task\`, \`add_tasks\`, \`list_tasks\`, \`complete_task\`.

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

Complete or un-complete one task.

\`\`\`bash
curl -X PATCH "${BASE}/api/tasks" \\
  -H "Authorization: Bearer $TODO_TOKEN" -H "Content-Type: application/json" \\
  -d '{"task":"Acheter du pain","date":"today"}'
\`\`\`

\`task\` is an id (from GET) or an exact title; an ambiguous title is refused
with the candidates rather than guessed. \`completed: false\` un-ticks it. For a
recurring task only the occurrence at \`date\` (default today) is touched, never
the series.

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
      mcp:  { url: `${BASE}/api/mcp?token=<token>`, transport: 'streamable-http', protocolVersion: '2025-06-18', tools: ['add_task', 'add_tasks', 'list_tasks', 'complete_task'] },
      rest: {
        base: `${BASE}/api/tasks`,
        methods: { GET: 'list tasks (scope, include_completed)', POST: 'create task(s)', PATCH: 'complete / uncomplete a task' },
        auth: 'Authorization: Bearer <token>, or ?token=<token>',
      },
      enums: { scopes: SCOPES, dayPeriods: PERIODS, priorities: PRIORITIES, recurrences: RECURRENCES },
      docs: `${BASE}/api/docs`,
    });
    return;
  }

  // text/plain rather than text/markdown: browsers render it inline instead of
  // offering to download it, and it stays just as readable to curl or a model.
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.status(200).send(MARKDOWN);
}
