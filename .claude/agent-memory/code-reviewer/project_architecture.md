---
name: Architecture Todo Manager
description: Patterns architecturaux clés du projet — modules, persistance, state management
type: project
---

**Patterns centraux :**

- `window.app` est le bus global — tous les `onclick` inline dans le HTML généré passent par `window.app.xxx()`. Couplage fort mais cohérent.
- State partagé via `js/modules/state.js` — variables exportées avec setters. Pas d'enforcement strict.
- `todos` est chargé deux fois au démarrage : une fois dans `state.js` et une fois dans `app.js` constructor.

**Persistance — règle critique :**
- `saveTodos()` → localStorage + `pushToFirestore()` (via `pushFirestoreNow()`) → OK
- `saveProjects()` (projectManager.js) → localStorage + `pushFirestoreNow()` → OK
- `saveCategories()` (admin.js) → localStorage SEULEMENT — pas de Firestore sync (bug connu)
- `saveTemplates()` (admin.js) → localStorage SEULEMENT — pas de Firestore sync (bug connu)
- `_saveIntentions()` (app.js) → localStorage + `pushFirestoreNow()` → OK
- `getFullBackup()` dans storage.js est la source de vérité pour ce qui va dans Firestore
- `_applyBackup()` dans app.js est la source de vérité pour ce qui est restauré depuis Firestore

**Restauration backup :** Deux chemins :
1. `_syncServer()` — serveur local uniquement, restaure categories/templates/config mais PAS intentions/boardProjects/avatar
2. `_applyBackup()` — complet, utilisé pour Firestore realtime et import fichier

**Firestore :**
- `SESSION_ID` dans sync.js pour éviter d'appliquer ses propres échos Firestore
- `subscribeToFirestore` → `_applyBackup` dans initFirebase
- Offline persistence via `persistentLocalCache()`

**Why:** Architecture compréhensible sans framework. Les problèmes de sync Firestore sur categories/templates sont des oublis dans saveCategories/saveTemplates.
