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

// Nom d'hôte affichable d'un lien (badge/aperçu du modal, popover vue jour) —
// jamais l'URL complète, trop longue pour une pastille. Repli sur l'URL brute
// si elle n'est pas parseable (saisie incomplète, protocole exotique).
export function linkHostname(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
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

// Zone de drop au survol d'une cible : 25% haut = avant, 25% bas = après,
// 50% centre = imbriquer (devient sous-tâche de la cible). allowNest:false
// dégrade en 50/50 avant/après — utilisé partout où imbriquer n'a
// structurellement pas de sens (cible dans la sélection multiple draguée,
// drag de groupe entier, source récurrente, liste de sous-tâches déjà
// profondeur 2 où un 3e niveau est interdit).
export function dnDZone(clientY, rect, { edge = 0.25, allowNest = true } = {}) {
  if (!allowNest || rect.height <= 0) return clientY < rect.top + rect.height / 2 ? 'before' : 'after';
  const ratio = (clientY - rect.top) / rect.height;
  if (ratio < edge) return 'before';
  if (ratio > 1 - edge) return 'after';
  return 'nest';
}

// Profondeur du sous-arbre propre à `node` (tâche racine ou sous-tâche) :
// 0 = pas de sous-tâches, 1 = sous-tâches sans enfants, 2 = au moins une
// sous-tâche a elle-même des enfants (max possible, le modèle interdit un
// 3e niveau partout ailleurs dans l'app).
export function ownDepth(node) {
  if (!node.subtasks?.length) return 0;
  return node.subtasks.some(c => c.subtasks?.length) ? 2 : 1;
}

// targetDepth : 0 = la cible est une tâche racine (vue jour/Backlog/Inbox),
// 1 = la cible est déjà elle-même une sous-tâche (imbrication sous-tâche
// ↔ sous-tâche). Vrai si imbriquer `source` sous une cible à cette
// profondeur dépasserait la limite de 2 niveaux — dans ce cas il faut
// « splitter » (splitIntoPromotedChildren) plutôt qu'imbriquer tel quel.
export function needsSplit(targetDepth, source) {
  return targetDepth + 1 + ownDepth(source) > 2;
}

// Remplace `source` par ses enfants DIRECTS promus au même niveau que
// l'aurait été `source`, titre préfixé pour garder le contexte perdu
// (« TitreSource - TitreEnfant »). Les petits-enfants (child.subtasks)
// restent attachés tels quels sous chaque enfant promu — `source` lui-même
// est jeté, copie superficielle donc aucun risque de référence partagée.
export function splitIntoPromotedChildren(source) {
  return (source.subtasks || []).map(child => ({ ...child, title: `${source.title} - ${child.title}` }));
}

// ── Partage Ponctuel ↔ Quotidien de la vue jour ─────────────────────────────
// Fraction de la largeur disponible prise par la colonne Ponctuelle, réglée
// par la poignée entre les deux colonnes. État purement local (comme
// planInboxWidth / calSidebarCollapsed) : dépend de la taille de l'écran, pas
// du compte — jamais dans getAppConfig().
const DAY_SPLIT_KEY = 'daySplit';
export const DAY_SPLIT_DEFAULT = 2 / 3;   // = l'historique 2fr / 1fr
const DAY_SPLIT_MIN = 0.25;
const DAY_SPLIT_MAX = 0.8;

export function clampDaySplit(r) {
  return Math.min(DAY_SPLIT_MAX, Math.max(DAY_SPLIT_MIN, r));
}

export function getDaySplit() {
  const raw = parseFloat(localStorage.getItem(DAY_SPLIT_KEY));
  return Number.isFinite(raw) ? clampDaySplit(raw) : DAY_SPLIT_DEFAULT;
}

export function setDaySplit(r) {
  localStorage.setItem(DAY_SPLIT_KEY, clampDaySplit(r).toFixed(4));
}

export function resetDaySplit() {
  localStorage.removeItem(DAY_SPLIT_KEY);
}

// Les deux valeurs `fr` de .day-columns (--day-punct / --day-rec). Leur somme
// vaut toujours 2 : la 3e colonne (panneau de relance, .day-columns--three)
// reste figée à 1fr et garde donc son tiers quel que soit le partage des deux
// premières.
export function daySplitVars(r = getDaySplit()) {
  return `--day-punct:${(2 * r).toFixed(4)}fr;--day-rec:${(2 * (1 - r)).toFixed(4)}fr`;
}
