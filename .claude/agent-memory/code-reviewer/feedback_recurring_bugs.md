---
name: Bugs récurrents à surveiller dans ce projet
description: Patterns d'erreurs qui reviennent dans le codebase — à vérifier à chaque review
type: feedback
---

**1. Manque de pushFirestoreNow() après localStorage.setItem()**

Toute nouvelle fonction `saveXxx()` qui écrit dans localStorage doit appeler `pushFirestoreNow()` (ou `saveTodos()` qui l'inclut). Exemples ratés : `saveCategories()`, `saveTemplates()`, `saveSuggestedTasks()` dans admin.js.

**Why:** Les données stockées uniquement dans localStorage sont perdues si l'utilisateur change d'appareil ou vide le cache.

**How to apply:** À chaque review, grep les fonctions qui font `localStorage.setItem` sans appeler `pushFirestoreNow` ou `saveTodos` dans le même scope.

---

**2. Celebrate déclenché à l'envers**

Pattern correct :
```js
const wasCompleted = isCompleted(todo, d);
toggleTodo(id, d, todos);
if (!wasCompleted) celebrate(lang);
```

Pattern incorrect (bug trouvé dans toggleInboxDone) :
```js
t.completed = !t.completed;
if (!t.completed) celebrate(lang);  // FAUX — t.completed est déjà muté
```

**How to apply:** Vérifier que l'état AVANT la mutation est capturé avant de conditionner celebrate.

---

**3. Nouveaux champs de backup non restaurés dans _syncServer**

`_syncServer()` (app.js) et `_applyBackup()` (app.js) font tous les deux de la restauration mais `_syncServer` est plus ancienne et moins complète. Quand on ajoute un champ dans `getFullBackup()`, vérifier aussi `_applyBackup()` ET `_syncServer()`.

---

**4. XSS via attributs onclick générés avec des données utilisateur**

Les IDs (timestamps numériques) sont sûrs dans les onclick. Mais les query strings de recherche, les titres de tâches, les couleurs de catégories dans les styles inline peuvent poser problème. Toujours utiliser `esc()` pour les données textuelles dans les attributs onclick.
