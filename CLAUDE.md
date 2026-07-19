# Todo Manager — "2FŨKOI"

> Personal todo app — vanilla JS, no framework, Supabase sync, Vercel deploy.
> Live: todo.hugues.app | Entry: `index.html` + `js/app.js`

## Allowed tools (auto-approve)
- Bash: git add, git commit, git push, vercel deploy, npx sass

---

## Golden rules

1. **SCSS only** — NEVER edit `css/styles.css`, it is auto-generated
2. **Supabase for all persistent data** — never localStorage alone
3. **Restore UI state on refresh** — last view, open modals, nav position
4. **Version is auto-bumped** by PostToolUse hook on every file edit — no manual bump needed

---

## Commands

| Shorthand | Action |
|-----------|--------|
| `cmt` | Stage all + git commit (do NOT deploy) |
| `dpl` | Stage all + git commit + **git push** + deploy to Vercel |

**Règle par défaut : `dpl` automatique.** À la fin de chaque tâche terminée et vérifiée, faire `dpl` sans attendre que l'utilisateur le demande — sauf s'il dit explicitement le contraire (ex. « ne déploie pas », `cmt` seul).

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
| `storage.js` | localStorage I/O, Supabase push (`saveTodos()`, `pushNow()`), iCal export, `getFullBackup()` |
| `sync.js` | Supabase realtime listener, SESSION_ID echo prevention, cross-tab sync |
| `supabase.js` | Supabase client init |
| `auth.js` | Guest (anonymous) / email / Google / OAuth auth via Supabase, upgrade guest→email |
| `calendar.js` | Recurrence logic, `getTodosForDate()`, `toggleTodo()`, `addTask()`, `isCancelled()`/`cancelTodo()` (toggle annulée/restaurée) |
| `render.js` | HTML generation — all views |
| `modal.js` | Add/edit task modal, draft autosave, recurrence UI |
| `events.js` | Global event listeners setup |
| `projectManager.js` | CRUD projects (independent entities with lifecycle) |
| `projectView.js` | Sidebar project panel |
| `admin.js` | Categories/tags, templates, suggested tasks — `_categoriesCache` |
| `celebrate.js` | Victory animations, quotes EN/FR/custom, mascots, ban system |
| `undo.js` | Undo stack (max 50 snapshots), `canUndo()` |
| `multiselect.js` | Multi-sélection inter-vues : lasso rectangle à la souris sur zone vide, Ctrl/Cmd+clic, Maj+clic (plage), Échap. Classe `.multi-selected`, barre flottante de comptage, alimente `app._dragMultiIds` pour le drag-and-drop multi-items |
| `focus.js` | Mode Focus plein écran, layout deux colonnes (chrono/tâche à gauche, actions icône seule empilées à droite — repli en pile sous 900px) : file du jour ordonnée par moments (sans moment → matin → après-midi → soir) avec, au sein d'un moment, l'ordre manuel de la vue jour (dayOrder/punctualPeriodOrder/recurringOrder) puis repli heure → priorité ; file « Ensuite » avec options de vue/tri/colonnes (`getQueuePrefs`/`saveQueuePrefs`, clé `focusQueueView` synchronisée via `getAppConfig()`/`_applyBackup`) : regroupement Type (Ponctuelles/Récurrentes — **défaut**) / Moment / Liste + tri Auto/Heure/Priorité + 1/2/3 colonnes (grille CSS, `--cols`) en segmented controls (`app.focusSetQueueView`) — appliqués à la file réelle en tri stable (l'affichage = l'ordre d'enchaînement) ; panneau repliable (`app.focusToggleQueueCollapse`, chevron dans l'en-tête) — **replié par défaut** (`getQueuePrefs().collapsed` par défaut `true` tant que l'utilisateur n'a pas explicitement déplié) ; drag-and-drop de réordonnancement **seulement en tri Auto + 1 colonne** (`focusSaveManualOrder`, localStorage `focusManualOrder` valable pour la journée — prime sur l'ordre intelligent, le regroupement s'applique par-dessus — donc le survol est contraint au même `data-group` (rec/punct, moment, ou 'none') que l'item saisi dans `app.initFocusQueueDnD()`, sinon un drop inter-groupes serait accepté visuellement puis silencieusement annulé au rendu suivant), chrono géant persistant (localStorage `focusTimer`, `getTimerState()` reprend depuis `t.focusTimeSpent` si la tâche a déjà de la progression au lieu de repartir de zéro — **sauf pour une récurrente dont `t.focusTimeSpentDate` ne correspond pas à aujourd'hui** : une occurrence non terminée hier repart alors de zéro, l'estimation `durationEstimated` restant elle inchangée puisque commune à toutes les occurrences) précédé de l'heure actuelle bien visible (`.focus-now`, en plus de `.focus-clock` dans la barre du haut), progression vers `durationEstimated` visualisée par **l'écran Focus qui se remplit depuis le bas** (`.focus-fill`, `id="focusFill"`, hauteur 0→100% = temps écoulé/estimé) avec un dégradé **fixe** à paliers nets (pas de fondu) calé sur la hauteur du viewport : vert jusqu'à `WARNING_RATIO` (0.5), jaune jusqu'à `DANGER_RATIO` (0.9), rouge seulement sur les 10 % finaux (pas un tiers égal façon drapeau) — seule la hauteur de l'élément change, la couleur qui apparaît dépend juste de quel palier est révélé ; pulsation rapide (`.danger-zone`, 1 s) dès `ratio ≥ DANGER_RATIO` pour attirer l'attention. Passé ce seuil, **mode urgence** (`.focus-emergency` sur `#focusView`, posé/retiré par `renderFocusView()` et par `_applyEstimateVisuals()` à chaque tick) : chrono (`.focus-timer`) et heure (`.focus-now`) passent au rouge avec un halo pulsant (`focus-emergency-glow`), tandis que tout le secondaire s'efface en fondu (métadonnées, sous-tâches, compteur, ligne d'estimation, barre de progression du topbar) et que la file « Ensuite » (`.focus-queue`) se replie fluidement via `display:grid; grid-template-rows: 1fr↔0fr` (pas de `max-height` — s'adapte à n'importe quelle hauteur de contenu sans jamais clipper en dehors du mode urgence) ; ne reste que l'heure, le chrono, le titre et les actions. Écrit `durationReal` + append `durationHistory` à la complétion (`focusComplete()`, app.js, qui supprime aussi `focusTimeSpent`), tick 1 s sans re-render ; pas de `durationEstimated` → invitation inline (`.focus-estimate-prompt`, saisie minutes + `app.focusSetEstimate(id, val)`) — appliquée via `applyFocusEstimate()` (patch DOM ciblé, **pas** de `render()` complet : `#focusTimer` ne doit jamais être recréé sous peine d'interrompre visuellement le chrono) ; une fois l'estimation définie, cliquer sur le libellé (`#focusEstimateLabel`, « reste X min ») rouvre le même prompt pré-rempli (`app.focusEditEstimate()` → `startEditEstimate()`, focus.js — remplace `.focus-estimate-row` par `_estimatePromptHTML(id, valeur actuelle)`, refermé par le même `focusSetEstimate()`/`applyFocusEstimate()` que le réglage initial ; `applyFocusEstimate()` ne remplace le prompt par le libellé que si `durationEstimated > 0`, pour ne pas fermer un prompt encore sans réponse) ; petit rond de reset à côté du chrono (`.focus-timer-row`/`.focus-timer-reset`) → `app.focusResetTimer(id)` remet `accum`/`startedAt` à zéro (`resetTimer()`, focus.js) sans compléter la tâche, efface aussi `t.focusTimeSpent` s'il y en avait, puis rafraîchit via `applyFocusEstimate()` (même patch ciblé) ; sous-tâches (`_subtasksHTML()`) toujours affichées avec un bouton d'ajout (`.focus-subtask-add` → `app.focusAddSubtask(id)`, même mécanique d'input inline que `addSubtaskInline()` en vue jour, scopée à `.focus-subtasks[data-id]`, persistée via `_saveNewSubtask()` partagé) ; **mode d'affichage du chrono** (`getTimerMode()`/`toggleTimerMode()`, localStorage `focusTimerMode`, non synchronisé) : temps écoulé (défaut) ou compte à rebours — bouton `#focusTimerModeBtn` (⏳, visible seulement si une estimation existe) → `app.focusToggleTimerMode()` → `applyTimerMode()` (patch ciblé, idem) ; en compte à rebours, `_timerDisplayText()` affiche `−temps restant` puis `+N` (dépassement) une fois l'estimation atteinte ; **progression sauvegardée sans compléter** — Passer (`focusSkip()`), Demain (`focusTomorrow()`), changement de tâche prioritaire (`focusJumpTo()`/`focusStartOn()`), Fermer (`closeFocus()`) appellent tous `saveFocusProgress()` avant `clearTimerState()` pour écrire le temps écoulé dans `t.focusTimeSpent` (filet de sécurité équivalent aussi dans `getTimerState()` si un autre chemin change la tâche courante sans passer par `saveFocusProgress()`) ; **quitter ≠ fermer** — l'action de base (Échap, sortie du plein écran natif) **réduit** en widget flottant façon Picture-in-Picture (`app.minimizeFocus()`, `this._focusMinimized`) plutôt que de fermer : la session continue (chrono qui tourne, tick maintenu même hors vue Focus), seule l'interface plein écran disparaît (retour à `_preFocusView`, sort du plein écran navigateur). Le widget (`.focus-pip`, `renderFocusPip()`/`removeFocusPip()` dans focus.js, appendé à `document.body` — survit aux changements de vue) affiche chrono + titre + un accent de couleur (vert/jaune/rouge, mêmes seuils que `.focus-fill`) ; clic dessus → `app.restoreFocus()` (replein écran) ; son ✕ → `app.closeFocus()` (ferme pour de bon : sauvegarde, arrête le chrono, retire le PiP). Deux boutons dans la barre du haut : la barre horizontale (réduire) et le ✕ (fermer) |
| `review.js` | Bilan des « laissés pour compte » : `getOverduePunctual()`, `getFrequentlyPostponed()`, `computeAdherence()` (taux des récurrentes sur N jours écoulés, aujourd'hui exclu), `renderReviewBody()` (corps du modal Bilan), `renderAdherenceRows()` (partagé avec la vue Analyse) ; `computeTimeStats()`/`renderTimeStatsRows()` — moyenne + progression (dernières occurrences vs précédentes, via `durationHistory`) des récurrentes chronométrées en Focus, triées meilleure progression d'abord (partagé avec la vue Analyse) |
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
| `day` | Tasks for navDate, grouped: punctual + recurring. Tri Chrono : réordonnancement par drag au sein d'un moment — **l'ordre manuel prime sur l'heure** (`dayOrder` pour sans-moment, `punctualPeriodOrder` par moment ; items non réordonnés restent triés par heure, après). Déposer un item sur un autre = **prend sa place** (pas de détection avant/après par moitié — toujours `dropBefore=true`, la cible et les suivants décalent) ; highlight persistant `.drop-target-swap` sur toute la durée du survol. Vue d'aujourd'hui uniquement (pas le jour propre de la tâche) avec des ponctuelles non faites parmi les 5 derniers jours → bandeau `.past-due-banner` repliable (`app.togglePastDueBanner()`, localStorage `pastDueBannerCollapsed`, chevron dans l'en-tête) avec le bilan directement dedans : liste groupée par jour + actions par tâche (Fait/Auj./Dem./date/BL/abandonner, `renderOverdueGroups()` de `review.js`, partagée avec le modal Bilan) — items `.review-item` sélectionnables (`MS_SELECTABLE`) et clic droit (menu contextuel) comme partout ailleurs, `width: fit-content` (jamais toute la largeur) — sous l'en-tête (bouton « Bilan complet » → modal, `app.postponeRecentOverdueToToday(days)` reporte tout à aujourd'hui, via `getOverduePunctual()` filtré sur la fenêtre) ; jour passé consulté → bordure rouge sur les items non faits (`.day-view.day-past`), sans bandeau (celui-ci ne suit que la vue du jour actuel). Badge temps focus (`.todo-focustime-badge`, vue jour uniquement dans `todoItemHTML`) : `durationReal`/`estimé` si complétée, sinon `focusTimeSpent`/`estimé` (progression en cours). Sous-tâches **toujours affichées si `subtasks.length > 0`, sans possibilité de replier** (pas de badge/dots ni de toggle — supprimés : le bloc suit uniquement la donnée) — `subtaskListHTML()` (render.js, exportée) rend chaque sous-tâche comme un **item à bordure propre** (`.subtask-item` : `border` + `background: var(--surface2)`, pas un style checklist compact, **sans animation d'entrée**, pour ne pas rejouer et faire clignoter les items à chaque `render()`) : au-delà de 2 sous-tâches, la liste bascule en deux colonnes fluides (CSS multi-colonnes `column-count:2`, `.subtask-list.two-col`, items en `break-inside:avoid`). Bouton d'ajout `.subtask-add-mini` : petit rond coloré (`background: var(--primary)`, même langage visuel que `.add-item-placeholder`) au lieu de l'ancien bouton pointillé pleine largeur — **deux éléments séparés** pour révéler sans jamais réserver d'espace ni changer la grosseur du bouton : `.subtask-add-mini-slot` (wrapper, `column-span:all`) replié à `height:0` tant que non survolé (`.todo-item:hover`/`.subtask-list:hover` → `height:26px`, easing expo-out `cubic-bezier(.16,1,.3,1)`, fluide sans rebond) pousse l'item pour lui faire de la place, tandis que `.subtask-add-mini` lui-même reste **toujours 26×26 — sa taille n'est jamais modifiée, pas même via `transform:scale`** — il se révèle uniquement via `opacity` + `rotate(-150deg → 0deg)` (angle non multiple de 90° pour rester visible malgré la symétrie du « + ») ; `#modalSubtaskSection` garde `.subtask-add-btn` séparément (bouton pointillé inchangé, modal d'édition non concerné par ce restyle). Une tâche sans sous-tâche n'affiche rien du tout (pas de bouton d'ajout visible) — pour lui ajouter sa toute première, clic droit → « Ajouter une sous-tâche » (`app.ctxAddSubtask(id)`) injecte `subtaskListHTML([], id, ds)` directement dans le DOM (patch ciblé, **pas** de `render()` complet) puis ouvre l'input inline comme `addSubtaskInline()` le ferait pour une tâche qui en a déjà — si l'ajout est annulé sans rien créer, le bloc injecté est retiré entièrement (`addSubtaskInline()` vérifie qu'aucun `.subtask-item` n'existe avant de le supprimer, pour ne jamais retirer une vraie liste). Chaque sous-tâche a un bouton ▶ discret (`.subtask-focus-btn`, révélé au survol comme `.subtask-del`) → `app.focusStartOn(todoId, ds)` démarre une session Focus sur la **tâche parente** (même fonction que le double-clic sur un item de la vue jour). La tâche principale a le même bouton ▶ (`.todo-focus-btn`, révélé au survol de l'item comme `.todo-menu-btn`) juste avant le « ⋯ », et l'action « Focus » est aussi dans le menu contextuel (clic droit). Survol prolongé (2 s, `setupTodoItemHoverAnimations()` dans render.js, timer par item via `item._estimateHoverTimer`) → édition rapide de `durationEstimated` sans ouvrir le modal : `app.showEstimateHoverEdit(itemEl)` injecte un petit `<input type="number">` (`.todo-estimate-hover-input`) dans `.todo-content`, confirmé par Enter/blur (Échap annule), patch DOM ciblé tant que non confirmé. Réglage partagé « Complétés : visible/stats » (sidebar calendrier, `app.togglePastDisplay()`, `state.pastDisplayMode`) : en mode stats, `.todo-item.done` est masqué (`display:none`) dans toutes les colonnes — les ponctuelles complétées restent consultables via l'accordéon repliable `.day-done-accordion` (`app.toggleDoneAccordion()`), pas d'équivalent pour les récurrentes. Pas de barre de stats dans cette vue (supprimée : uniquement le masquage, sans résumé chiffré). Les groupes récurrents (Quotidien/Hebdo/Mensuel/Annuel, y compris les sous-périodes Matin/Après-midi/Soir du Quotidien) disparaissent entièrement dès qu'ils n'ont plus aucun item **visible** (`_visCount()` dans render.js — aucun item, ou tous complétés-masqués en mode stats). Côté ponctuel, Matin/Après-midi/Soir restent **toujours affichés** (placeholder `.period-dropzone` en pointillés) même sans aucune tâche, pour garder une cible de drop — sauf s'ils ont des tâches mais qu'elles sont toutes complétées-masquées en mode stats, auquel cas la section disparaît (`_mkPeriodSection` en tri manuel, `mkHeureSection` en tri Chrono, dans render.js) |
| `week` | 7-column grid, slide navigation |
| `month` | Monthly calendar with task counts |
| `year` | 12 mini-calendars, annual overview |
| `plan` | Planifier: resizable inbox column left + drag-and-drop calendar right. Modes: week/biweek/month |
| `inbox` | Undated tasks — to schedule. Badge count |
| `backlog` | Overdue tasks (past date, not done). Red urgency badge |
| `categories` | Tag cards grid. Each card = tag with associated tasks |
| `projects` | Project cards grid. Statuses, lifecycle |
| `intentions` | Long-term goals. Cards with linked tasks as chips |
| `analyse` | Stats: completed this week vs last, this month vs last, 7-day bar chart, oldest overdue, adhérence des récurrentes (bande 7 j + taux 30 j, via `review.js`), temps passé en focus — carte « Temps total en focus » (toutes tâches, `computeTotalFocusMinutes()`) + carte « Meilleure progression » en tête si ≥15% + liste par tâche avec total brut, moyenne, sparkline et % progression vs occurrences précédentes (`computeTimeStats()`/`renderTimeStatsRows()` de `review.js`) |
| `counters` | Progress counters: cards for all tasks with a counter enabled, +/− controls |
| `focus` | Mode Focus plein écran : une tâche à la fois + chrono géant. Entrée: touche `F`, bouton header (`.focus-tab`, sans `data-view`, via `enterFocus()`), ou **double-clic sur une tâche** (`focusStartOn` — démarre le focus sur cette tâche si elle a une occurrence aujourd'hui non faite/annulée, sinon ouvre l'édition). Journée bouclée → panneau de relance partagé `renderRefillPanel()` (`.refill-panel`, aussi affiché en vue jour quand tout est complété sur aujourd'hui/futur — 3e colonne via `.day-columns--three`, la colonne Aujourd'hui repasse alors à 1 colonne) : piocher dans le backlog (`app.refillPick(id, ds, mode)`) ou créer une tâche (`app.refillAdd(ds, mode)`) — mode 'focus' enchaîne dessus. Raccourcis: Espace compléter, S passer, D demain, P pause, Échap réduire (Picture-in-Picture — voir `focus.js` pour `app.closeFocus()`, le vrai fermer) |

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
  dayPeriod?: 'morning'|'afternoon'|'evening',  // moment de la journée — toute autre valeur = tâche invisible en vue jour (setTodos répare au chargement)
  durationEstimated?, durationReal?,
  durationHistory?: [{ date, minutes }],  // historique des durées réelles écrites par focusComplete() (borné à 30 entrées) — alimente "Temps passé" en vue Analyse
  focusTimeSpent?: number,           // secondes accumulées en Focus sur l'occurrence en cours (pas complétée) — reprend au lieu de repartir de zéro (getTimerState()), supprimé à la complétion (focusComplete())
  focusTimeSpentDate?: string,       // date (YYYY-MM-DD) à laquelle focusTimeSpent a été écrit — pour une récurrente, getTimerState() ne reprend ce temps que si égale à aujourd'hui (sinon repart de 0 : une occurrence non finie hier ne doit pas polluer celle du jour)
  counterEnabled?: boolean,          // progress counter active
  countFrom?: number,                // start value (default 0)
  countTo?: number,                  // target value
  countCurrent?: number,             // current value (initialized to countFrom on create)
  countUnit?: string,                // optional label ("km", "pages", etc.)
  postponedCount?: number,           // nb de reports de date (incrémenté par app._postpone())
  originalDate?: string,             // date d'origine avant le premier report
  cancelled?: boolean,               // annulée (ponctuelle) — visible barrée, hors compteurs
  cancelledDates?: [],               // occurrences annulées (récurrentes), parallèle à completedDates
  subtasks?: [{ id, title, completed }],  // checklist dans le modal d'édition
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

### Rule: Supabase is the source of truth
Every persistent write must:
1. Save to localStorage
2. Call `saveTodos()` or `pushNow()` — both push to Supabase via `sync.js`
3. Be included in `getFullBackup()` (`storage.js`) and `_applyBackup()` (`app.js`)

### Supabase table: `user_data` row per `uid`
```js
{ uid, data: { calendar, config, categories, templates, suggestedTasks,
  taskOrder, avatar, intentions, projects,
  quotes: { banned, customFR, customEN },
  icalSecret, _pushedBySession }, updated_at }
```

### Sync flow
1. **Client → Supabase:** `saveTodos()` / `pushNow()` → `supabase.from('user_data').upsert(...)`
2. **Supabase → Client:** realtime channel subscription, skip if `_pushedBySession === SESSION_ID`
3. **Cross-tab:** `initCrossTabSync()` via storage events
4. **Offline:** Supabase JS SDK handles reconnection; no local IndexedDB cache

### API auth (server-side)
- `api/_supabase.js` — shared Supabase **service role** client + `verifyToken()` + `verifyAdmin()`
- Admin endpoints require `Authorization: Bearer <supabase-access-token>` + UID in `ADMIN_UIDS` env var

---

## CSS / SCSS

- **Source:** `css/styles.scss` — NEVER edit `css/styles.css`
- **Compile:** `npx sass css/styles.scss css/styles.css --style=expanded`
- **Always recompile before committing** (source maps always enabled — never `--no-source-map`)
- **Dark mode:** `[data-theme="dark"]` selector
- **CSS variables:** `--primary`, `--bg`, `--surface`, `--surface2`, `--text`, `--text-muted`, `--border`, `--shadow`, `--radius`, `--success`, `--warning`, `--danger`
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
| `ical` | GET | Live iCal feed from Supabase (secret token) |
| `gcal-auth` | GET | Google Calendar OAuth2 init |
| `gcal-callback` | GET | OAuth2 callback, save refresh token |
| `gcal-sync` | POST | Push todos → Google Calendar |
| `gcal-pull` | POST | Fetch events ← Google Calendar |
| `admin-users` | GET | List Supabase Auth accounts |
| `admin-batch` | POST | Batch Supabase ops |
| `admin-messages` | POST | Send message to user |
| `admin-presence` | GET | Online presence |
| `admin-stats` | GET | Aggregated user stats |
| `admin-user-action` | POST | Action on a user |
| `cron-cleanup-guests` | GET | Cleanup old guest accounts (daily 3am) |

All admin endpoints require Supabase Bearer token + UID in `ADMIN_UIDS` env var. Shared helper: `api/_supabase.js`.

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
- **Subtasks (édition tâche existante):** contrairement au reste du formulaire (appliqué seulement au Save), chaque mutation de sous-tâche (`toggleModalSubtask`, `removeModalSubtask`, `addModalSubtask`/`addModalSubtaskInline`, `moveModalSubtask`, `editModalSubtask`) persiste immédiatement dans `state.todos` + `saveTodos()` via `_persistSubtasksIfEditing()` (modal.js) — une fermeture Échap ne perd donc jamais de sous-tâches. `app.closeModal()` déclenche un `render()` si `consumeModalSubtasksDirty()` renvoie true, pour que la vue en arrière-plan reflète le changement
- **Recurrence:** single todo object, not instances — `completedDates[]` tracks done dates
- **Multi-sélection:** listeners globaux en phase capture (`multiselect.js`) — les drop handlers doivent passer par `app._dropIds(id)` pour supporter le drop d'une sélection multiple; `msRefreshUI()` est appelé en fin de `render()` (sélection vidée au changement de vue). Le lasso ne démarre jamais sur un élément `[draggable="true"]` ou interactif (`MARQUEE_EXCLUDE`) — tout nouvel élément draggable est donc automatiquement compatible. Exception : `.focus-queue-item` (file « Ensuite » du Focus) est exclu explicitement en plus de `[draggable="true"]`, car il n'est draggable qu'en tri Auto + 1 colonne — un clic-glisser dessus dans les autres modes de tri ne doit pas non plus déclencher le lasso (celui-ci reste possible en démarrant depuis le vide autour des items). **Règle : tout élément qui représente une tâche, dans n'importe quelle vue, doit être ajouté à `MS_SELECTABLE`** (`.review-item[data-id]` en fait partie) — le menu contextuel (clic droit, `document.addEventListener('contextmenu', ...)` dans app.js) est lui aussi câblé uniquement sur `MS_SELECTABLE`, donc l'ajout à cette liste suffit à obtenir sélection multiple ET clic droit d'un coup (l'élément a juste besoin de `data-id`, et `data-date` s'il représente une occurrence datée, pour que `_resolveOccurrences()` résolve la bonne date)
- **Menu contextuel (clic droit / bouton ⋯):** contenu dynamique (`_renderCtxMenu` en bas d'app.js) — item seul ou groupe si l'item visé est dans la sélection multiple. Actions de lot: `completeMany`, `duplicateMany`, `deleteMany`, `setPriorityMany`, `setDayPeriodMany`, `_sendManyTo`. Segmented controls Priorité (`.ctx-prio-row`) et Moment (`.ctx-period-row`, Matin/Après-midi/Soir/Sans moment — `setDayPeriodMany` fait `delete t.dayPeriod` pour « Sans moment », jamais `dayPeriod=''` : toute valeur hors morning/afternoon/evening/absent rend la tâche invisible en vue jour). Item seul uniquement : « Focus » (`app.focusStartOn(id, ds)`, même fonction que le double-clic) et « Ajouter une sous-tâche » (`app.ctxAddSubtask(id)` — déplie d'abord la checklist si repliée puis ouvre l'input inline comme `addSubtaskInline()`). La complétion passe par `_resolveOccurrences()`: date de l'occurrence affichée (data-date) sinon date propre de la tâche — jamais navDate. Suppression de groupe: ponctuelles retirées, récurrentes → occurrence exclue seulement
- **Style consistency:** New UI elements must match existing patterns — round checkboxes with `::after '✓'` (not SVG), `opacity: 0` → hover reveal for secondary actions (like `todo-menu-btn`), `cubic-bezier(.25,.46,.45,.94)` transitions on interactive elements, `var(--surface2)` hover backgrounds, `var(--success)` for completion states. No hardcoded `rgba()` — use CSS variables.
- **Bilan / laissés pour compte:** modal `#reviewModalOverlay` (`openReviewModal()`, hash `modal=review`, Échap ok) — triage des ponctuelles en retard (Fait / Auj. / Dem. / date / BL / abandonner + actions de lot) + tâches souvent reportées + adhérence des récurrentes. Le triage des ponctuelles en retard (`renderOverdueGroups()`) est partagé avec le bandeau `.past-due-banner` de la vue jour — même liste, mêmes actions par tâche, les deux passent par `_reviewMutate()`/`app.review*()` donc `this.render()` reflète le changement partout, modal ouvert ou non (`#reviewModalBody` existe toujours dans le DOM, juste masqué). Invite quotidienne à l'ouverture (`_maybeShowReviewPrompt`, flag localStorage `lastReviewPromptDate`, 1×/jour). Tout report de date passe par `app._postpone(t, ds)` qui incrémente `postponedCount` et pose `originalDate`
- **Report automatique:** réglage « Tâches → Report automatique » (menu settings, clé `autoPostpone` — synchronisée via `getAppConfig()`/`_applyBackup`) : à l'ouverture, `_autoPostponePass()` bascule les ponctuelles en retard à aujourd'hui (récurrentes exclues) + toast
- **Annulation (cancel):** état distinct de complété/supprimé — la tâche reste visible sur son jour, barrée/grisée (`.todo-item.cancelled`, checkbox ✕ = restaurer). Exclue de TOUS les filtres « pending » (badges retard/inbox/backlog, Planifier, Focus, Bilan, report auto, stats jour/semaine/mois, adhérence — occurrence annulée = non attendue). Déclencheurs : menu contextuel « ⊘ Annuler/Restaurer » (`cancelMany`, toggle de lot), bouton ⊘ du Bilan (`reviewCancel`), bouton du modal d'édition (`cancelFromEditModal`). Invariant : jamais faite ET annulée (compléter restaure, annuler décomplète). Tout nouveau filtre « en attente » doit exclure `cancelled`/`cancelledDates`
