// ════════════════════════════════════════════════════════
//  UTILITIES
// ════════════════════════════════════════════════════════

// A single corrupted localStorage value (crash mid-write, manual tampering)
// must never throw during boot — that aborts the whole app.js module before
// render()/setupEventListeners() ever run, leaving a blank, dead page with
// no visible error. Every JSON.parse(localStorage...) at startup should go
// through this instead of a bare try/catch.
export function safeParseJSON(raw, fallback) {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch {
    return fallback;
  }
}

export const DS = d => `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
export const p2 = n => String(n).padStart(2,'0');

export function parseDS(s) {
  const [y,m,d]=s.split('-').map(Number);
  return new Date(y,m-1,d);
}

export function today() {
  const d=new Date();
  d.setHours(0,0,0,0);
  return d;
}

export function addDays(d,n) {
  const r=new Date(d);
  r.setDate(r.getDate()+n);
  return r;
}

export function startOfWeek(d) {
  const r=new Date(d);
  r.setDate(r.getDate()-(r.getDay()+6)%7);
  return r;
}

export function daysInMonth(y,m) {
  return new Date(y,m+1,0).getDate();
}

export function firstDayOfMonth(y,m) {
  return (new Date(y,m,1).getDay()+6)%7;
}

export function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Repli/dépli des sous-tâches en vue jour — état purement local (comme
// calSidebarCollapsed/pastDueBannerCollapsed), pas synchronisé entre
// appareils. Dépliées par défaut (comportement historique inchangé).
const SUBTASK_COLLAPSED_KEY = 'subtasksCollapsed';

export function isSubtaskCollapsed(todoId) {
  try {
    return JSON.parse(localStorage.getItem(SUBTASK_COLLAPSED_KEY) || '[]').includes(todoId);
  } catch { return false; }
}

// Retourne le nouvel état (true = replié) après bascule
export function toggleSubtaskCollapsed(todoId) {
  let ids = [];
  try { ids = JSON.parse(localStorage.getItem(SUBTASK_COLLAPSED_KEY) || '[]'); } catch { ids = []; }
  const wasCollapsed = ids.includes(todoId);
  ids = wasCollapsed ? ids.filter(x => x !== todoId) : [...ids, todoId];
  localStorage.setItem(SUBTASK_COLLAPSED_KEY, JSON.stringify(ids));
  return !wasCollapsed;
}

export function expandSubtask(todoId) {
  let ids = [];
  try { ids = JSON.parse(localStorage.getItem(SUBTASK_COLLAPSED_KEY) || '[]'); } catch { ids = []; }
  if (!ids.includes(todoId)) return;
  ids = ids.filter(x => x !== todoId);
  localStorage.setItem(SUBTASK_COLLAPSED_KEY, JSON.stringify(ids));
}

// Estimation effective d'une tâche/sous-tâche : sa propre valeur si définie,
// sinon la somme récursive des estimations de ses enfants (0 si rien nulle
// part). Ne remplace JAMAIS le champ brut aux points de RÉGLAGE (préremplissage
// d'un input, comparaison avant écriture) — seulement aux points d'AFFICHAGE/
// CALCUL (badge, chrono Focus) : éditer doit toujours poser une valeur
// explicite qui prime, jamais figer silencieusement la somme calculée.
export function effectiveEstimate(node) {
  if (node.durationEstimated) return node.durationEstimated;
  if (!node.subtasks?.length) return 0;
  return node.subtasks.reduce((s, c) => s + effectiveEstimate(c), 0) || 0;
}
