# App Overview — Todo Manager

> This document is intended for AI assistants. It provides a comprehensive picture of what the application is, what it does, and how it is structured. Update it whenever the application's goals, architecture, or module responsibilities change meaningfully.

---

## Purpose

A personal task management web application. The primary user is a solo developer using it daily to manage personal todos across multiple devices. The app is deployed at [todo-hugues.vercel.app](https://todo-hugues.vercel.app) and supports multiple authenticated users, though it is primarily a personal tool.

The admin panel provides oversight and management of all users, templates, and system messages.

---

## Application Goals

- Make task creation fast and frictionless (quick-add, templates)
- Support recurring tasks with flexible patterns
- Provide multiple calendar views so tasks can be seen in context
- Keep data in sync across devices in real time via Firebase
- Support offline use via Service Worker
- Allow guest access with zero friction, with an optional upgrade path to a real account
- Provide a polished, animated, mobile-friendly UI

---

## Key Concepts

### Task (Todo)
The core data unit. Stored in Firestore under each user's collection. A task has:
- `text` — main task label
- `description` — optional longer note
- `date` — ISO date string (YYYY-MM-DD) — the base/start date
- `completed` — boolean
- `priority` — `"none"` | `"low"` | `"medium"` | `"high"`
- `category` — category ID string (optional)
- `recurrence` — recurrence rule object (optional)
- `completedDates` — array of ISO dates when a recurring task was marked done
- `deletedDates` — array of ISO dates when a single occurrence was deleted
- `id` — unique string ID

### Recurrence
Tasks can recur on a pattern: daily, weekly (on specific weekdays), monthly (by day-of-month or nth weekday), yearly, or a custom interval in days. Recurrence is computed at render time from the base `date` and pattern — no separate instances are stored.

### Category / Project
Categories are named groups with a color and optional icon/emoji. Tasks can belong to a category. The "Categories" view groups and displays tasks by their category.

### Templates
Reusable task presets. Stored globally (admin-created) and locally (user-created). Applying a template pre-fills the task modal.

### Views
The app has 5 views: Day, Week, Month, Year, Categories. The current view and navigation date are stored in global state and drive all rendering.

---

## Module Responsibilities

### `js/app.js`
Entry point. Imports all modules and boots the app: initializes Firebase, restores state, attaches event listeners, performs initial render.

### `js/modules/state.js`
Single source of truth for runtime state. Exports a `state` object and typed setters. Key state fields:
- `todos` — flat array of all task objects for the current user
- `currentView` — active view (`"day"` | `"week"` | `"month"` | `"year"` | `"categories"`)
- `navDate` — the currently navigated date (Date object)
- `currentUser` — Firebase user object
- `categories` — array of category objects
- `selectedRecurrence` — current recurrence rule being edited in modal
- `undoStack` — stack of snapshots for undo

### `js/modules/config.js`
Static configuration: translation strings for EN and FR, zoom size constants, any other app-wide constants. Locale is derived from the browser or user preference.

### `js/modules/utils.js`
Pure helper functions: date formatting, string escaping, DOM helpers, date arithmetic.

### `js/modules/firebase.js`
Initializes the Firebase SDK (app + Firestore + Auth). Exports `db` and `auth` instances used by other modules.

### `js/modules/auth.js`
Handles all authentication flows:
- Anonymous / guest login
- Email/password login and registration
- Google and Facebook OAuth
- Account upgrade from guest to real account
- Logout and account deletion

### `js/modules/sync.js`
Manages Firestore data:
- Loads todos and categories from Firestore on login
- Sets up real-time listeners for live updates
- Writes tasks and categories back to Firestore
- Generates a session ID to deduplicate updates and prevent loops

### `js/modules/storage.js`
Handles localStorage persistence (for offline/guest mode) and the local dev API server (port 3333) used in development. Also handles:
- JSON data export (backup)
- iCalendar (.ics) export

### `js/modules/calendar.js`
Core task logic (no rendering):
- Get all tasks relevant to a given date (including recurring)
- Toggle task completion (handles recurring vs single tasks)
- Delete a single occurrence vs all future occurrences vs the whole task
- Recurrence expansion: given a task and a date range, compute which dates it applies to

### `js/modules/render.js`
All view rendering. Takes the current state and produces DOM. Handles:
- Day view
- Week view
- Month view (calendar grid)
- Year view
- Category view (delegated to `projectView.js`)
- Individual task items (with drag handles, badges, priority, completion)
- Mini calendar sidebar

### `js/modules/modal.js`
The task creation/edit modal UI. Manages:
- Form fields: text, description, date, priority, category
- Recurrence picker UI
- Template selector
- Save/delete/cancel actions
- Calls `sync.js` and `storage.js` to persist changes

### `js/modules/events.js`
Attaches all global event listeners on startup: keyboard shortcuts, click delegation, window resize, swipe gestures, etc.

### `js/modules/projectView.js`
Renders the Categories view. Groups tasks by category, handles category CRUD, manages task ordering within a category.

### `js/modules/presence.js`
Real-time user presence using Firestore. Shows which users are online. Also manages the in-app messaging/inbox system with read receipts and message badges.

### `js/modules/avatarEditor.js`
A full avatar editor UI. Users can upload a photo, crop it, apply filters (sepia, grayscale, etc.), or pick an emoji as their avatar. Stores the result in their Firebase profile.

### `js/modules/celebrate.js`
Confetti and celebration animations triggered when a task is completed. Uses GSAP. Includes logic for varying the celebration intensity.

### `js/modules/undo.js`
Takes snapshots of the `todos` state and allows undoing the last destructive action (delete, bulk clear, etc.).

### `js/modules/admin.js`
Manages the admin UI (in `admin.html`):
- View and manage all users
- Create/edit/delete global templates
- Create/edit/delete global categories
- Send broadcast messages to all users
- View usage stats and activity

### `js/modules/version.js`
Single-line export of the current semver version string. Auto-bumped by a PostToolUse hook on every file edit.

---

## API Endpoints (Vercel Serverless Functions)

All endpoints require admin authentication via a Firebase ID token.

| Endpoint | Purpose |
|----------|---------|
| `/api/admin-users` | List all users, get user details |
| `/api/admin-user-action` | Perform actions on a user (delete, promote) |
| `/api/admin-batch` | Batch operations (delete anonymous users, etc.) |
| `/api/admin-messages` | Read and send admin messages |
| `/api/admin-presence` | Read presence data for all users |
| `/api/admin-stats` | Usage statistics and activity data |
| `/api/cron-cleanup-guests` | Cron job (daily 3 AM UTC): delete stale guest accounts |

---

## Data Flow

### Startup
1. `app.js` boots → Firebase initialized
2. Auth state checked → user loaded or guest created
3. Firestore listener opened → `state.todos` and `state.categories` populated
4. Initial render triggered

### Task creation
1. User opens modal → fills form
2. Submit → `modal.js` calls `sync.js` (Firestore write) + `storage.js` (localStorage)
3. Firestore listener fires → `state.todos` updated → re-render

### Navigation
1. User clicks prev/next or a date → `state.navDate` updated
2. `render.js` called → filters and displays tasks for new date range

### Recurrence rendering
- Recurring tasks are not stored as multiple instances
- At render time, `calendar.js` expands a recurrence rule over the visible date range
- Completion/deletion of a single occurrence writes to `completedDates` / `deletedDates` arrays

---

## Infrastructure

| Service | Role |
|---------|------|
| Vercel | Hosting + serverless functions |
| Firebase Firestore | Primary database (per-user collections) |
| Firebase Auth | User authentication |
| GitHub | Source control (`master` branch) |
| Service Worker (`sw.js`) | Offline support and caching |

### Cron
`vercel.json` configures a daily cron at `0 3 * * *` (3 AM UTC) calling `/api/cron-cleanup-guests`.

### Local development
`server.js` runs a local Node.js API server on port 3333 using Firebase Admin SDK. Data is stored in `~/.todo-hugues/` locally. The frontend detects `localhost` and routes API calls to the local server instead of Vercel.

---

## CSS / SCSS

All styles live in `css/styles.scss`. The compiled `css/styles.css` is generated and committed. Never edit `styles.css` directly.

Compile command:
```bash
npx sass css/styles.scss css/styles.css --style=expanded --no-source-map
```

---

## Localization

The app supports English and French. All user-facing strings are defined in `config.js` under `translations.en` and `translations.fr`. The active locale is stored in state and applied at render time.

---

## Version

The version is a semver string in `js/modules/version.js`. A PostToolUse hook in `.claude/settings.json` auto-bumps the patch version on every file edit via `.claude/bump-version.sh`. No manual version management is needed.

---

## Notable Patterns

- **No framework**: pure vanilla JS with ES modules. No React, Vue, etc.
- **Module imports**: all modules import from each other directly; `app.js` is the root.
- **State mutation**: state is mutated through setter functions in `state.js`. There is no reactive binding between state and DOM (no Vue/Svelte/MobX-style auto-render). Mutating state does not automatically update the UI — renders must be triggered explicitly by calling `render()`.
- **Drag-and-drop**: native HTML5 drag/drop API (`dragstart`/`dragover`/`drop`, `draggable="true"`, `dataTransfer`). Three separate implementations in `app.js`: day view (reorder tasks), week view (move task to another day), month view (move task to another day). Interact.js is listed in `package.json` but is not imported or used.
- **Animations**: GSAP for celebrations; CSS transitions for view changes and hover effects.
- **Single HTML file per view**: `index.html` for the app, `admin.html` for the admin panel.
