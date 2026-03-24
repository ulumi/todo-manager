# Todo Manager

## Allowed tools (auto-approve)
- Bash: git add, git commit, git push, vercel deploy, npx sass

## CSS / SCSS
⚠ NEVER edit `css/styles.css` directly — it is auto-generated from `css/styles.scss`.
- Source: `css/styles.scss` — always edit this
- Compile: `npx sass css/styles.scss css/styles.css --style=expanded`
- Always recompile before committing

## Navigation & état UI
- La dernière vue active doit être restaurée au refresh (toutes les vues sans exception)
- Si un modal était ouvert, le rouvrir au refresh
- Persister via `localStorage` ou URL hash

## Data storage
⚠ Toute donnée persistante doit être dans **Firestore** — jamais localStorage seulement.
- Ajouter dans `getFullBackup()` (`js/modules/storage.js`)
- Restaurer dans `_applyBackup()` (`js/app.js`)
- Déclencher `pushFirestoreNow()` ou `saveTodos()` à chaque écriture

## Shorthand commands
- `cmt`: stage all changes and create a git commit (do NOT deploy to Vercel)
  - Version is auto-bumped by the PostToolUse hook on every file edit — no manual bump needed
- `dpl`: stage all changes, create a git commit, and deploy to Vercel
  - Version is auto-bumped by the PostToolUse hook on every file edit — no manual bump needed
