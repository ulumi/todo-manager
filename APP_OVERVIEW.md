# Todo Manager — App Overview

**Version actuelle :** `0.4.1422` (`js/modules/version.js`)
**Deploy :** Vercel — [todo.hugues.app](https://todo.hugues.app)
**App title :** "2FŨKOI"

---

## Architecture générale

- **Point d'entrée :** `index.html` + `js/app.js`
- **Classe principale :** `TodoApp` — singleton exposé via `window.app`
- **Pattern rendu :** Pas de framework — mutations → `app.render()` → regen DOM complet depuis `render.js`
- **État :** exports mutables dans `js/modules/state.js` (todos, view, navDate, etc.) avec setters

---

## Modules JS (`js/modules/`)

| Module | Rôle |
|--------|------|
| `state.js` | Variables d'état + setters |
| `storage.js` | localStorage (saveTodos/loadTodos), Firestore push, iCal export, full backup |
| `sync.js` | Firestore realtime (SESSION_ID anti-écho), subscriptions, offline IndexedDB |
| `firebase.js` | Init Firebase + auth + Firestore persistent cache |
| `auth.js` | Guest / email / Google / Facebook, upgrade guest→email |
| `calendar.js` | Récurrence logic, getTodosForDate, toggleTodo, addTask |
| `render.js` | Génération HTML — toutes les vues |
| `modal.js` | Modal add/edit tâche, draft, récurrence UI |
| `events.js` | Setup event listeners globaux |
| `projectManager.js` | CRUD projets (entités indépendantes avec cycle de vie) |
| `projectView.js` | Sidebar panel projet |
| `admin.js` | Categories, templates, suggested tasks — cache `_categoriesCache` |
| `celebrate.js` | Animations victoire, quotes, mascots, ban system |
| `undo.js` | Stack undo (max 50 snapshots) |
| `presence.js` | Online heartbeat, admin inbox messages, click counter |
| `avatarEditor.js` | Upload photo, crop, emoji, filtres |
| `utils.js` | Helpers date (DS, parseDS, today, addDays), esc() |
| `config.js` | Traductions EN/FR/ES, ZOOM_SIZES |
| `lowpoly-bg.js` | Background animé GSAP, palettes |
| `version.js` | Constante VERSION |

---

## Vues disponibles

| Vue | Description |
|-----|-------------|
| `day` | Liste des tâches du jour (navDate). Groupées : ponctuel + récurrent |
| `week` | Grille 7 colonnes. Navigation glissante par 7j |
| `month` | Calendrier mensuel avec count de tâches par date |
| `year` | 12 mini-calendriers, vue annuelle |
| `plan` | Vue "Planifier" : colonne inbox redimensionnable à gauche, calendrier drag-and-drop à droite. Modes : `week` / `biweek` (14j) / `month`. Filtres : types de récurrence, cacher complétées |
| `inbox` | Tâches capturées sans date — à planifier dès que possible. Badge count |
| `backlog` | Tâches avec date passée non marquées done. Badge rouge urgence |
| `categories` | Grille de cards **tags** (voir distinction ci-dessous). Vue par tag avec tâches associées |
| `projects` | Grille de cards **projets** (voir distinction ci-dessous). Statuts, cycle de vie |
| `intentions` | Buts à long terme. Cards avec tâches liées (chips). "Le pourquoi derrière ce qu'on fait" |
| `analyse` | Stats passé : tâches complétées cette semaine vs semaine préc., ce mois vs mois préc., bar chart 7 jours, tâches en souffrance (les plus vieilles) |

---

## Distinction Tags vs Projets

> **IMPORTANT — ne pas confondre ces deux entités**

### Tags (= "categories" dans le code)
- **Ce que c'est :** Labels/groupes pour classer les tâches. Équivalent d'un tag ou d'un contexte.
- **Structure :** `{ id, name, color, icon, description, status, deadline }`
- **Usage :** Une tâche peut avoir un `categoryId`. Affiché comme badge coloré sur la tâche.
- **Vue :** `categories` — grille de cards, chaque card = un tag avec ses tâches
- **Admin :** géré dans le modal admin → section Catégories
- **Stockage :** localStorage key `categories`, Firestore champ `categories`
- **Module :** `admin.js`

### Projets (= "projects" dans le code)
- **Ce que c'est :** Entités indépendantes avec cycle de vie (début, fin, résultat). Équivalent d'un projet Jira/Asana.
- **Structure :** `{ id, name, color, status: 'active'|'on_hold'|'completed'|'archived', created, updated }`
- **Usage :** Une tâche peut avoir un `projectId`. Affiché comme badge dans la todo list avec lien vers le panel projet.
- **Vue :** `projects` — grille de cards avec statuts, sidebar panel par projet
- **Module :** `projectManager.js`
- **Stockage :** localStorage key `projects`, Firestore champ `projects`

### Résumé
| | Tags (categories) | Projets (projects) |
|--|--|--|
| Clé localStorage | `categories` | `projects` |
| Clé Firestore | `categories` | `projects` |
| Champ todo | `categoryId` | `projectId` |
| Vue | `categories` | `projects` |
| Module | `admin.js` | `projectManager.js` |
| Concept | Tag/contexte | Projet avec cycle de vie |

---

## Data model

### Todo
```js
{
  id: string,           // timestamp
  title: string,
  description?: string,
  completed: boolean,
  date?: string,        // YYYY-MM-DD (one-time tasks)
  completedDates: string[],   // dates done pour récurrentes
  recurrence: 'none'|'daily'|'weekly'|'monthly'|'yearly',
  startDate?: string, endDate?: string,
  excludedDates: string[],
  recDays: number[],    // dow (weekly) ou dom (monthly)
  recLastDay?: boolean,
  recMonth?: number, recDay?: number,
  priority: ''|'low'|'medium'|'high',
  categoryId?: string,      // tag/category ID
  projectId?: string,       // board project ID
  intentionId?: string,
  startTime?: string, endTime?: string,
  durationEstimated?: number, durationReal?: number
}
```

### Category (clé localStorage : `categories`)
```js
{ id, name, color (hex), icon (key CATEGORY_ICONS), description, status, deadline }
```

### Project (entité indépendante, clé localStorage : `projects`)
```js
{ id, name, color, status: 'active'|'on_hold'|'completed'|'archived', created, updated }
```

### Intention
```js
{ id, title, description?, status?: 'active'|'completed' }
```

---

## Stockage & Sync

### localStorage (source de vérité côté client)
`todos`, `categories`, `dayTemplates`, `suggestedTasks`, `projects`, `intentions`, `projectTaskOrder`, `dayOrder`, `recurringOrder`, `punctualPeriodOrder`, `zoom`, `lang`, `theme`, `navDate`, `profileAvatar`, `icalSecret`, `bannedQuotes`, `customQuotesFR`, `customQuotesEN`, `modalDraft`, `glassMode`, `timezone`, `icalHour`, `icalFilters`, `bgPalette`, `bgColor`

### Firestore — `users/{uid}/data/main` (single document)
```js
{
  calendar, config, categories, templates, suggestedTasks,
  taskOrder, avatar, intentions, projects,
  quotes: { banned, customFR, customEN },
  icalSecret, _pushedBySession, updatedAt
}
```
Autres collections : `presence/{uid}`, `admin_messages/{uid}/inbox/{id}`

### Sync flow
1. **Client → Firestore :** `pushFirestoreNow()` après chaque write → `pushToFirestore(getFullBackup())`
2. **Firestore → Client :** realtime listener, skip si `_pushedBySession === SESSION_ID`
3. **Cross-tab :** `initCrossTabSync()` via storage events
4. **Offline :** IndexedDB persistent cache (Firebase SDK)

---

## API Serverless (`/api/`)

| Endpoint | Méthode | Rôle |
|----------|---------|------|
| `ical` | GET | Feed iCal live depuis Firestore (token secret) |
| `gcal-auth` | GET | OAuth2 init Google Calendar |
| `gcal-callback` | GET | OAuth2 callback, sauve refresh token |
| `gcal-sync` | POST | Push todos → Google Calendar |
| `gcal-pull` | POST | Fetch events ← Google Calendar |
| `admin-users` | GET | Liste comptes Firebase Auth |
| `admin-batch` | POST | Batch Firestore ops |
| `admin-messages` | POST | Envoie message à utilisateur |
| `admin-presence` | GET | Présence online |
| `admin-stats` | GET | Stats agrégées utilisateurs |
| `admin-user-action` | POST | Action sur un user |
| `cron-cleanup-guests` | GET | Nettoie vieux comptes guests |

Tous les admin endpoints : Firebase ID token requis + UID dans `ADMIN_UIDS`. CORS : liste blanche `todo.hugues.app` + localhost.

---

## CSS/SCSS

- **Source :** `css/styles.scss` — NE JAMAIS éditer `css/styles.css`
- **Compiler :** `npx sass css/styles.scss css/styles.css --style=expanded`
- Dark mode via `[data-theme="dark"]`
- Variables CSS : `--primary`, `--bg`, `--surface`, `--surface2`, `--text`, `--text-muted`, `--border`, `--shadow`, `--radius`

---

## Features notables

- **Undo :** snapshot avant chaque mutation, stack 50, `canUndo()`
- **Récurrence :** daily/weekly(dow)/monthly(dom ou lastDay)/yearly — 1 todo, pas d'instances
- **iCal :** token secret `{uid}_{secret}`, endpoint `/api/ical?token=...`
- **Celebrate :** GSAP, quotes EN/FR/custom, mascots, ban, debug panel
- **Avatar :** upload + crop + emoji + filtres, saved Firestore
- **Présence :** heartbeat 30s, click counter, admin messages inbox
- **Draft :** modal auto-save 300ms debounce dans `modalDraft`
- **_showToast(msg) :** toast non-bloquant (réutilise `#undoToast` / `.undo-toast`)
- **Inline inputs :** addCategoryFromView / addProjectFromView injectent un `<input>` dans `.category-card--add` (pas de `prompt()`)

---

## Auth

- Guest (anonymous), email/password, Google OAuth, Facebook OAuth
- Upgrade guest → email : `upgradeGuestToEmail()`
- Profile : displayName, photoURL, custom avatar, icalSecret, GCal tokens