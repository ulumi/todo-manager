# Todo Manager — "2FŨKOI"

> Personal todo app — vanilla JS, no framework, Firestore sync, Vercel deploy.
> Live: todo.hugues.app | Entry: `index.html` + `js/app.js`

## Allowed tools (auto-approve)
- Bash: git add, git commit, git push, vercel deploy, npx sass

---

## Golden rules

1. **SCSS only** — NEVER edit `css/styles.css`, it is auto-generated
2. **Firestore for all persistent data** — never localStorage alone
3. **Restore UI state on refresh** — last view, open modals, nav position
4. **Version is auto-bumped** by PostToolUse hook on every file edit — no manual bump needed

---

## Commands

| Shorthand | Action |
|-----------|--------|
| `cmt` | Stage all + git commit (do NOT deploy) |
| `dpl` | Stage all + git commit + deploy to Vercel |

---

## Architecture

```
index.html          ← Single page, all views
js/app.js           ← TodoApp class (singleton → window.app), 5800 LOC
js/modules/         ← Feature modules (see below)
css/styles.scss     ← All styles, 11800 LOC
api/                ← Vercel serverless functions
playground/         ← Demo/test pages (never at root)
server.js           ← Local dev API server (port 3333)
```

### Render pattern
Mutations → `app.render()` → full DOM regen from `render.js`. No virtual DOM, no diffing.

### State management
Mutable exports in `state.js` with setter functions (`setTodos()`, `setView()`, `setNavDate()`, etc.). Global state — no stores, no signals.

---

## JS Modules (`js/modules/`)

| Module | Role |
|--------|------|
| `state.js` | Global state variables + setters |
| `storage.js` | localStorage I/O, Firestore push, iCal export, `getFullBackup()` |
| `sync.js` | Firestore realtime listener, SESSION_ID echo prevention, cross-tab sync, offline IndexedDB |
| `firebase.js` | Firebase init + auth + Firestore persistent cache |
| `auth.js` | Guest / email / Google / Facebook auth, upgrade guest→email |
| `calendar.js` | Recurrence logic, `getTodosForDate()`, `toggleTodo()`, `addTask()` |
| `render.js` | HTML generation — all views |
| `modal.js` | Add/edit task modal, draft autosave, recurrence UI |
| `events.js` | Global event listeners setup |
| `projectManager.js` | CRUD projects (independent entities with lifecycle) |
| `projectView.js` | Sidebar project panel |
| `admin.js` | Categories/tags, templates, suggested tasks — `_categoriesCache` |
| `celebrate.js` | Victory animations, quotes EN/FR/custom, mascots, ban system |
| `undo.js` | Undo stack (max 50 snapshots), `canUndo()` |
| `presence.js` | Online heartbeat, admin inbox messages, click counter |
| `avatarEditor.js` | Photo upload + crop + emoji + filters |
| `utils.js` | Date helpers (`DS`, `parseDS`, `today`, `addDays`), `esc()` |
| `config.js` | Translations EN/FR/ES, `ZOOM_SIZES` |
| `lowpoly-bg.js` | GSAP animated background, palettes |
| `version.js` | `VERSION` constant (semver, auto-bumped) |

---

## Views

| View | Description |
|------|-------------|
| `day` | Tasks for navDate, grouped: punctual + recurring |
| `week` | 7-column grid, slide navigation |
| `month` | Monthly calendar with task counts |
| `year` | 12 mini-calendars, annual overview |
| `plan` | Planifier: resizable inbox column left + drag-and-drop calendar right. Modes: week/biweek/month |
| `inbox` | Undated tasks — to schedule. Badge count |
| `backlog` | Overdue tasks (past date, not done). Red urgency badge |
| `categories` | Tag cards grid. Each card = tag with associated tasks |
| `projects` | Project cards grid. Statuses, lifecycle |
| `intentions` | Long-term goals. Cards with linked tasks as chips |
| `analyse` | Stats: completed this week vs last, this month vs last, 7-day bar chart, oldest overdue |

---

## Data model

### Todo
```js
{
  id, title, description?,
  completed, date?,              // YYYY-MM-DD (one-time)
  completedDates: [],            // dates done for recurring
  recurrence: 'none'|'daily'|'weekly'|'monthly'|'yearly',
  startDate?, endDate?, excludedDates: [],
  recDays: [],                   // day-of-week (weekly) or day-of-month (monthly)
  recLastDay?, recMonth?, recDay?,
  priority: ''|'low'|'medium'|'high',
  categoryId?, projectId?, intentionId?,
  startTime?, endTime?,
  durationEstimated?, durationReal?
}
```

### Tags vs Projects — DON'T CONFUSE

| | Tags (= "categories" in code) | Projects |
|--|--|--|
| What | Labels/groups for classifying tasks | Independent entities with lifecycle |
| Todo field | `categoryId` | `projectId` |
| Module | `admin.js` | `projectManager.js` |
| localStorage key | `categories` | `projects` |
| View | `categories` | `projects` |

---

## Data storage & sync

### Rule: Firestore is the source of truth
Every persistent write must:
1. Save to localStorage
2. Call `pushFirestoreNow()` or `saveTodos()` (which handles Firestore push)
3. Be included in `getFullBackup()` (`storage.js`) and `_applyBackup()` (`app.js`)

### Firestore document: `users/{uid}/data/main`
```js
{ calendar, config, categories, templates, suggestedTasks,
  taskOrder, avatar, intentions, projects,
  quotes: { banned, customFR, customEN },
  icalSecret, _pushedBySession, updatedAt }
```

### Sync flow
1. **Client → Firestore:** `pushFirestoreNow()` → `pushToFirestore(getFullBackup())`
2. **Firestore → Client:** realtime listener, skip if `_pushedBySession === SESSION_ID`
3. **Cross-tab:** `initCrossTabSync()` via storage events
4. **Offline:** IndexedDB persistent cache (Firebase SDK)

---

## CSS / SCSS

- **Source:** `css/styles.scss` — NEVER edit `css/styles.css`
- **Compile:** `npx sass css/styles.scss css/styles.css --style=expanded`
- **Always recompile before committing** (source maps always enabled — never `--no-source-map`)
- **Dark mode:** `[data-theme="dark"]` selector
- **CSS variables:** `--primary`, `--bg`, `--surface`, `--surface2`, `--text`, `--text-muted`, `--border`, `--shadow`, `--radius`
- **Todo items layout:** `display: flex; align-items: center` — NEVER use `display: grid` on `.todo-item`

---

## Navigation & UI state
- Last active view must restore on refresh (all views, no exception)
- If a modal was open, reopen it on refresh
- Persist via `localStorage` or URL hash

---

## API endpoints (`/api/`)

| Endpoint | Method | Role |
|----------|--------|------|
| `ical` | GET | Live iCal feed from Firestore (secret token) |
| `gcal-auth` | GET | Google Calendar OAuth2 init |
| `gcal-callback` | GET | OAuth2 callback, save refresh token |
| `gcal-sync` | POST | Push todos → Google Calendar |
| `gcal-pull` | POST | Fetch events ← Google Calendar |
| `admin-users` | GET | List Firebase Auth accounts |
| `admin-batch` | POST | Batch Firestore ops |
| `admin-messages` | POST | Send message to user |
| `admin-presence` | GET | Online presence |
| `admin-stats` | GET | Aggregated user stats |
| `admin-user-action` | POST | Action on a user |
| `cron-cleanup-guests` | GET | Cleanup old guest accounts (daily 3am) |

All admin endpoints require Firebase ID token + UID in `ADMIN_UIDS`.

---

## Dev workflow

```bash
# Watch SCSS changes
npm run dev

# Local API server
npm run server    # port 3333

# Compile SCSS once
npx sass css/styles.scss css/styles.css --style=expanded
```

---

## Key patterns to follow

- **Toast notifications:** `app._showToast(msg)` — reuses `#undoToast` / `.undo-toast`
- **Inline inputs:** `addCategoryFromView` / `addProjectFromView` inject `<input>` in `.category-card--add` (no `prompt()`)
- **Undo:** snapshot before each mutation, stack of 50, check `canUndo()`
- **Modal draft:** autosave 300ms debounce in `modalDraft` localStorage key
- **Recurrence:** single todo object, not instances — `completedDates[]` tracks done dates
