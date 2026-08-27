// ════════════════════════════════════════════════════════
//  VUE AGENDA (vue jour, mode « Agenda ») — grille horaire façon iCal
//
//  Bascule Liste/Agenda de la vue jour (localStorage `dayLayout`) : le corps
//  de la vue jour (.day-columns, 2 colonnes de cartes) est remplacé par une
//  grille horaire pleine largeur.
//
//  STRUCTURE — la journée n'est PAS une seule grille continue : elle est
//  découpée en BANDES de moment (Matin / Après-midi / Soir), chacune avec sa
//  propre sous-grille horaire, précédée d'une « bande flexible » qui accueille
//  les tâches de ce moment SANS heure. Le concept `dayPeriod` — central dans
//  toute l'app — reste donc la structure primaire, l'heure n'étant qu'une
//  précision à l'intérieur du moment. Une 4e bande sans grille (« Sans
//  moment ») coiffe le tout pour les tâches qui n'ont ni heure ni moment.
//
//  RÈGLE DE PLACEMENT : une tâche AVEC `startTime` est placée dans la bande
//  que son heure désigne, quel que soit son `dayPeriod` stocké (une tâche à
//  14h ne peut pas s'afficher dans une bande qui s'arrête à 12h). Les données
//  se réalignent d'elles-mêmes dès qu'on la déplace, tout drop dérivant
//  `dayPeriod` de l'heure d'arrivée (cf. app.js `_agendaMoveTo`).
//
//  ⚠ Aucun conteneur de cette vue ne doit recevoir `filter`/`backdrop-filter`/
//  `transform` : .agenda-canvas et .agenda-flex-strip sont de vraies cibles de
//  drop natives, qu'un ancêtre filtré casse silencieusement (bug Chromium
//  documenté dans CLAUDE.md). Le mode glass ne stylise donc que les blocs
//  eux-mêmes (sources de drag), jamais les bandes.
// ════════════════════════════════════════════════════════

import { DS, esc, effectiveEstimate, safeParseJSON } from './utils.js';
import { getTodosForDate, isCompleted, isCancelled } from './calendar.js';
import * as state from './state.js';
import { getCategories } from './admin.js';

// ── Constantes de géométrie ─────────────────────────────
export const AGENDA_ZOOMS = [
  { px: 44,  label: 'Compact' },
  { px: 72,  label: 'Normal' },
  { px: 120, label: 'Confort' },
];
export const SNAP_MIN = 15;            // pas de calage d'un déplacement/resize
export const FINE_SNAP_MIN = 5;        // idem, touche Alt maintenue
// Durée minimale qu'un REDIMENSIONNEMENT peut produire (le calage est de
// 15 min, on ne peut donc pas tirer plus court à la souris). Ce n'est PAS un
// plancher de durée : une tâche estimée à 3 min reste une tâche de 3 min.
export const MIN_BLOCK_MIN = 15;
export const DEFAULT_BLOCK_MIN = 30;   // durée d'un bloc sans endTime ni estimation
// Hauteur minimale d'un bloc À L'ÉCRAN, en pixels — la seule contrainte de
// lisibilité admise. Elle ne touche jamais la donnée : gonfler la durée pour
// « faire de la place » faussait à la fois l'heure de fin affichée et la
// détection de chevauchement (deux tâches de 3 min à 5 min d'intervalle
// passaient pour simultanées et se retrouvaient côte à côte en demi-largeur
// au lieu de rester pleine largeur à gauche).
export const MIN_BLOCK_PX = 20;
// Sous-tâches listées DANS le bloc : une ligne fait ~15px, et l'en-tête
// (heure + titre) en réclame ~40. En dessous, le bloc n'affiche que le badge
// « fait/total » — la hauteur d'un bloc reflète sa durée, jamais son contenu,
// donc on n'agrandit rien pour faire tenir une checklist (cf. blockMinutes).
const SUB_ROW_PX = 15;
// Une seule rangée d'en-tête depuis que les badges ont rejoint le titre
// (17px de contenu + les paddings du bloc), contre 40 quand `.agenda-block-meta`
// occupait une 2e ligne : autant de hauteur rendue aux sous-tâches, et donc
// moins de blocs étirés au-delà de leur durée.
const SUB_HEAD_PX = 28;
// Jamais plus de lignes que ça dans un bloc : une tâche à 15 sous-tâches
// mangerait la journée. Le reste part dans « +N de plus », qui ouvre la
// checklist complète en popover.
const SUB_MAX_ROWS = 6;

// Frontières des moments — les mêmes que celles dérivées au drop
// (periodForMinutes). Elles définissent la plage couverte par chaque bande.
export const AGENDA_BANDS = [
  { key: 'morning',   label: 'Matin',      from: 0,  to: 12, defFrom: 7,  defTo: 12 },
  { key: 'afternoon', label: 'Après-midi', from: 12, to: 18, defFrom: 12, defTo: 18 },
  { key: 'evening',   label: 'Soir',       from: 18, to: 24, defFrom: 18, defTo: 23 },
];

const BAND_ICONS = {
  morning:   `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 18a5 5 0 0 0-10 0"/><line x1="12" y1="9" x2="12" y2="2"/><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/><line x1="1" y1="18" x2="3" y2="18"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/><line x1="23" y1="22" x2="1" y2="22"/><polyline points="16 5 12 9 8 5"/></svg>`,
  afternoon: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/></svg>`,
  evening:   `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  none:      `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
};

const _plusSVG = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
// Badge « imbriquer » du glisser-déposer — même markup et mêmes classes que la
// vue jour (render.js `_nestBadgeHTML`), redéfini ici plutôt qu'importé :
// render.js importe déjà agendaView.js, l'inverse créerait un cycle. Toujours
// présent dans le DOM, révélé par la seule classe `.drop-nest` en CSS (jamais
// injecté/retiré pendant le drag, cf. la règle du même badge en vue jour).
const _nestBadgeHTML = `<span class="dnd-nest-badge" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/></svg><span>Sous-tâche</span></span>`;

const _linkSVG = `<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;

// ── Préférences (synchronisées, cf. getAppConfig/_applyBackup) ──────────
const PREFS_KEY = 'agendaPrefs';
const DEFAULT_PREFS = {
  zoom: 72,
  night: false,   // déplie 00:00→07:00 et 23:00→24:00
  rec: { none: true, daily: true, weekly: true, monthly: true, yearly: true },
};

export function getAgendaPrefs() {
  const s = safeParseJSON(localStorage.getItem(PREFS_KEY), null);
  if (!s || typeof s !== 'object') return { ...DEFAULT_PREFS, rec: { ...DEFAULT_PREFS.rec } };
  return { ...DEFAULT_PREFS, ...s, rec: { ...DEFAULT_PREFS.rec, ...(s.rec || {}) } };
}

export function saveAgendaPrefs(patch) {
  const next = { ...getAgendaPrefs(), ...patch };
  localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  return next;
}

export function getDayLayout() {
  return localStorage.getItem('dayLayout') === 'agenda' ? 'agenda' : 'list';
}

// ── Helpers horaires ────────────────────────────────────
// "09:30" → 570 ; toute valeur non conforme → null (une chaîne vide, un
// champ absent ou une heure aberrante ne doit jamais produire un NaN qui
// se propagerait jusqu'aux styles inline des blocs).
export function parseHM(s) {
  if (typeof s !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

export function fmtHM(min) {
  const m = Math.max(0, Math.min(1439, Math.round(min)));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function snapMin(min, step = SNAP_MIN) {
  return Math.round(min / step) * step;
}

// ── Calage magnétique sur l'instant présent ─────────────
// En plus du calage régulier (15 min, 5 min avec Alt), deux points d'ancrage
// liés à MAINTENANT : l'heure courante exacte, et le prochain multiple de
// 5 minutes (à 8h21 → 8h21 et 8h25). Ils ne s'appliquent que sur la journée
// d'aujourd'hui et à l'intérieur de la bande survolée : le candidat retenu est
// simplement le plus proche du curseur, donc loin de l'heure courante la
// grille régulière l'emporte toujours et rien ne change.
export function nowAnchors(nowMinutes) {
  if (nowMinutes == null) return [];
  const next5 = Math.ceil(nowMinutes / 5) * 5;
  return next5 === nowMinutes ? [nowMinutes] : [nowMinutes, next5];
}

// `raw` en minutes depuis minuit → minute calée. `bounds` [min, max] écarte un
// ancrage hors de la bande survolée (l'heure courante n'est dans qu'UNE bande).
export function snapWithNow(raw, step, nowMinutes, bounds) {
  const cands = [snapMin(raw, step), ...nowAnchors(nowMinutes)];
  let best = null, bestD = Infinity;
  for (const c of cands) {
    if (bounds && (c < bounds[0] || c > bounds[1])) continue;
    const d = Math.abs(raw - c);
    // `<` strict et `now` placé avant `next5` : à égalité parfaite, l'heure
    // courante gagne — c'est l'ancrage que Hugues a demandé en premier.
    if (d < bestD) { best = c; bestD = d; }
  }
  return best == null ? snapMin(raw, step) : best;
}

// Moment dérivé d'une heure — LA règle de cohérence entre l'agenda et la
// vue liste : tout drop à une heure donnée réécrit `dayPeriod` avec ceci.
export function periodForMinutes(min) {
  if (min < 12 * 60) return 'morning';
  if (min < 18 * 60) return 'afternoon';
  return 'evening';
}

// Durée effective d'un bloc : endTime si cohérent, sinon l'estimation
// (propre ou somme des sous-tâches, cf. effectiveEstimate), sinon un défaut.
// Durée VRAIE d'un bloc, jamais arrondie vers le haut pour des raisons
// d'affichage : c'est elle qui donne l'heure de fin affichée, la détection de
// chevauchement, et la durée préservée lors d'un déplacement. La lisibilité
// des tout petits blocs est réglée en pixels au rendu (MIN_BLOCK_PX).
//
// `durationEstimated` PRIME sur `endTime`, et non l'inverse. Aucune interface
// ne permet de saisir une heure de fin (`#taskEndTime` est un input hidden) :
// le seul producteur d'`endTime` est le redimensionnement d'un bloc, qui écrit
// TOUJOURS les deux champs ensemble. `endTime` n'est donc jamais qu'un reflet
// de la durée — le laisser primer rendait une tâche déjà redimensionnée sourde
// à toute modification ultérieure de sa durée (modal, badge en place, Focus),
// son ancienne heure de fin continuant seule à dicter la longueur du bloc.
// endTime ne sert plus que de repli quand aucune durée n'est connue.
export function blockMinutes(t) {
  const est = effectiveEstimate(t);
  if (est > 0) return Math.max(1, est);
  const s = parseHM(t.startTime), e = parseHM(t.endTime);
  if (s != null && e != null && e > s) return e - s;
  return DEFAULT_BLOCK_MIN;
}

function recKey(t) { return (!t.recurrence || t.recurrence === 'none') ? 'none' : t.recurrence; }

// Géométrie d'un bloc : ce qu'il occupe VRAIMENT à l'écran. Extraite ici pour
// que le calcul des chevauchements et le rendu partent du même nombre — les
// faire diverger, c'est exactement ce qui a laissé un bloc étiré recouvrir son
// voisin (le voisin était placé comme si l'étirement n'existait pas).
export function blockGeometry(b, px) {
  const subsAll = b.t.subtasks || [];
  const shownSubs = subsAll.slice(0, SUB_MAX_ROWS);
  const hiddenSubs = subsAll.length - shownSubs.length;
  const timeH = Math.max(MIN_BLOCK_PX, ((b.end - b.start) / 60) * px);
  const needH = subsAll.length
    ? SUB_HEAD_PX + (shownSubs.length + (hiddenSubs ? 1 : 0)) * SUB_ROW_PX
    : 0;
  const h = Math.max(timeH, needH);
  // `layoutH` sert au calcul des chevauchements et diffère de `h` sur un point
  // décisif : il ignore le plancher de lisibilité MIN_BLOCK_PX. Deux causes
  // d'agrandissement, deux traitements —
  //  • le PLANCHER (quelques pixels sur une tâche très courte) ne doit PAS
  //    provoquer de mise en colonnes : c'est lui qui renverrait la routine du
  //    matin en demi-largeur, exactement ce que Hugues avait fait corriger ;
  //    un léger recouvrement est ici assumé (il l'a explicitement accepté) ;
  //  • l'ÉTIREMENT pour montrer les sous-tâches, lui, peut valoir 65px et
  //    masquer complètement le bloc suivant : il doit compter.
  const layoutH = Math.max(((b.end - b.start) / 60) * px, needH);
  return { subsAll, shownSubs, hiddenSubs, timeH, h, layoutH, overflows: h > timeH + 0.5 };
}

// ── Chevauchements : colonnes façon iCal ────────────────
// Les blocs qui se recouvrent forment un « cluster » et se partagent la
// largeur de la bande en colonnes égales. Un cluster se ferme dès qu'un bloc
// démarre après la fin la plus tardive rencontrée jusque-là.
// `layoutEnd` (posé par bandHTML depuis blockGeometry) : l'étendue réellement
// occupée à l'écran, pas la seule durée. Un bloc étiré pour montrer ses
// sous-tâches partage donc la largeur avec celui qu'il recouvrirait — mieux
// vaut deux blocs lisibles côte à côte qu'un bloc pleine largeur dont le
// contenu disparaît sous son voisin. Les blocs qui ne s'étirent pas sont
// inchangés : `layoutEnd === end`, donc toujours pleine largeur à gauche.
function assignColumns(blocks) {
  const endOf = b => b.layoutEnd ?? b.end;
  const sorted = [...blocks].sort((a, b) => a.start - b.start || endOf(b) - endOf(a));
  let cluster = [], clusterEnd = -1;
  const flush = () => {
    if (!cluster.length) return;
    const colEnds = [];
    cluster.forEach(b => {
      let c = colEnds.findIndex(end => end <= b.start);
      if (c < 0) { c = colEnds.length; colEnds.push(0); }
      colEnds[c] = endOf(b);
      b.col = c;
    });
    cluster.forEach(b => { b.cols = colEnds.length; });
    cluster = [];
    clusterEnd = -1;
  };
  sorted.forEach(b => {
    if (cluster.length && b.start >= clusterEnd) flush();
    cluster.push(b);
    clusterEnd = Math.max(clusterEnd, endOf(b));
  });
  flush();
  return sorted;
}

// ── Répartition des tâches du jour en bandes ────────────
// Retourne { none: [...chips], morning: {timed, flex}, afternoon, evening }
function splitItems(items, navDate, prefs) {
  const buckets = {
    none: [],
    morning:   { timed: [], flex: [] },
    afternoon: { timed: [], flex: [] },
    evening:   { timed: [], flex: [] },
  };
  items.forEach(t => {
    if (prefs.rec[recKey(t)] === false) return;
    const start = parseHM(t.startTime);
    if (start == null) {
      const p = t.dayPeriod;
      if (p === 'morning' || p === 'afternoon' || p === 'evening') buckets[p].flex.push(t);
      else buckets.none.push(t);
      return;
    }
    // Placement par l'HEURE (pas par dayPeriod stocké) — cf. en-tête du fichier
    const band = periodForMinutes(start);
    const dur = blockMinutes(t);
    buckets[band].timed.push({
      t,
      start,
      end: Math.min(start + dur, AGENDA_BANDS.find(b => b.key === band).to * 60),
      rawEnd: start + dur,
      done: isCompleted(t, navDate),
      cancelled: isCancelled(t, navDate),
    });
  });
  return buckets;
}

// Plage horaire réellement affichée par une bande : ses bornes par défaut,
// élargies pour englober tout ce qu'elle contient (une tâche à 5h30 doit
// rester visible), ou ouvertes en grand si le dépli « Nuit » est actif.
function displayRange(band, timed, prefs) {
  if (prefs.night) return { from: band.from, to: band.to };
  let from = band.defFrom, to = band.defTo;
  timed.forEach(b => {
    from = Math.min(from, Math.floor(b.start / 60));
    to   = Math.max(to,   Math.ceil(b.end / 60));
  });
  return { from: Math.max(band.from, from), to: Math.min(band.to, Math.max(to, from + 1)) };
}

// ── Rendu d'un bloc ─────────────────────────────────────
function blockHTML(b, ds, px, range) {
  const t = b.t;
  const top = ((b.start - range.from * 60) / 60) * px;
  // Seule la HAUTEUR est plancherée (lisibilité) — jamais la durée, d'où un
  // bloc de 3 min qui affiche bien « 07:15–07:18 » tout en restant cliquable.
  // Plancher franc : un bloc reste toujours assez haut pour être lu, quitte à
  // déborder légèrement sur le suivant quand deux tâches très courtes se
  // suivent de près (choix explicite de Hugues : mieux vaut un léger
  // chevauchement que des réglettes illisibles). Le survol remonte le bloc
  // au-dessus de ses voisins, donc rien n'est jamais définitivement caché.
  // Deux hauteurs distinctes, et c'est tout l'enjeu :
  //  • `timeH` = la durée à l'échelle de la grille (avec son plancher) ;
  //  • `h`     = ce que le bloc occupe réellement à l'écran.
  // Un bloc QUI A DES SOUS-TÂCHES s'étire jusqu'à les montrer : « voir ses
  // sous-tâches » l'emporte sur « occuper pile sa durée ». La 1re version ne
  // les affichait qu'au-delà de 55px, donc quasiment jamais — une tâche de
  // 10 min fait 12px (plancher 20px), et elles n'apparaissaient nulle part.
  // Le temps n'est pas menti pour autant : l'heure de fin reste marquée à
  // `timeH` par un trait (.agenda-block-endline), et la zone au-delà se lit
  // comme du débordement de contenu, pas comme de la durée. Les
  // chevauchements restent calculés sur les heures VRAIES (assignColumns),
  // donc un bloc étiré ne pousse jamais ses voisins en demi-largeur.
  const { subsAll, shownSubs, hiddenSubs, timeH, h, overflows } = blockGeometry(b, px);
  const cols = b.cols || 1;
  const col  = b.col || 0;
  const isRec = t.recurrence && t.recurrence !== 'none';
  const clipped = b.rawEnd > b.end;
  const sizeCls = h < 34 ? ' is-tiny' : (h < 64 ? ' is-short' : '');
  const cls = ['agenda-block',
    b.done ? 'done' : '',
    b.cancelled ? 'cancelled' : '',
    t.priority ? `prio-${t.priority}` : '',
    t.flexibleTime ? 'flexible' : '',
    clipped ? 'is-clipped' : '',
    overflows ? 'is-overflowing' : '',
  ].filter(Boolean).join(' ') + sizeCls;

  const cat = (() => {
    const ids = t.categoryIds || (t.categoryId ? [t.categoryId] : []);
    if (!ids.length) return null;
    return getCategories().find(c => c.id === ids[0]) || null;
  })();
  const accent = cat ? `--accent:${cat.color};` : '';
  const timeLabel = `${fmtHM(b.start)}<span class="agenda-block-dash">–</span>${fmtHM(b.rawEnd)}`;

  // TOUS les badges (récurrence, catégorie, lien, heure approximative,
  // fait/total) vivent sur la MÊME ligne que le titre. Il y avait avant une
  // 2e rangée `.agenda-block-meta` sous le titre : elle coûtait une ligne de
  // hauteur à chaque bloc — donc autant de moins pour les sous-tâches — et
  // était de toute façon masquée sur les blocs courts, c'est-à-dire sur la
  // plupart d'entre eux. Le badge « fait/total » reste poussé à droite
  // (margin-left:auto) et ouvre la checklist complète en popover.
  const subDone = subsAll.filter(x => x.completed).length;
  const subBadge = subsAll.length
    ? `<button class="agenda-block-badge agenda-block-subs-btn" title="${subDone}/${subsAll.length} sous-tâches faites — cliquer pour la liste" onclick="event.stopPropagation();window.app.openSubtaskList(this,'${t.id}','${ds}')">${subDone}/${subsAll.length}</button>` : '';
  const linkBadge = (t.links || []).filter(Boolean).length
    ? `<button class="agenda-block-badge agenda-block-link" title="Liens" onclick="event.stopPropagation();window.app.handleLinksBadgeClick(event,'${t.id}')">${_linkSVG}</button>` : '';
  const recBadge = isRec ? `<span class="agenda-block-badge agenda-block-rec" title="Tâche récurrente">↻</span>` : '';
  const catBadge = cat ? `<span class="agenda-block-badge agenda-block-cat" style="background:${cat.color}">${esc(cat.name.toUpperCase())}</span>` : '';
  const flexBadge = t.flexibleTime ? `<span class="agenda-block-badge agenda-block-flex" title="Heure approximative — peut glisser">≈</span>` : '';

  // Checklist compacte, uniquement si la hauteur du bloc la porte — cochable
  // sur place. `t.subtasks` est déjà résolu pour l'occurrence du jour
  // (getTodosForDate → resolveOccurrence) et toggleSubtask() écrit dans le
  // bon bucket via occurrenceSubtasks(), donc une récurrente n'est modifiée
  // que pour CETTE date.
  const subsHTML = (() => {
    if (!shownSubs.length) return '';
    const rows = shownSubs.map(st =>
      `<div class="agenda-sub${st.completed ? ' done' : ''}" onclick="event.stopPropagation();window.app.toggleSubtask('${t.id}','${st.id}','${ds}')" title="${esc(st.title)}"><span class="agenda-sub-check"></span><span class="agenda-sub-title">${esc(st.title)}</span></div>`
    ).join('');
    const more = hiddenSubs > 0
      ? `<div class="agenda-sub agenda-sub-more" onclick="event.stopPropagation();window.app.openSubtaskList(this,'${t.id}','${ds}')">+${hiddenSubs} de plus</div>` : '';
    return `<div class="agenda-block-subs">${rows}${more}</div>`;
  })();

  const checkAction = b.cancelled
    ? `window.app.cancelTodo('${t.id}','${ds}')`
    : `window.app.toggleTodo('${t.id}',window.app.parseDS('${ds}'),event)`;

  // .agenda-block-head garde TOUJOURS l'heure et le titre sur la même ligne,
  // quelle que soit la hauteur du bloc : un bloc plus long ne doit pas faire
  // descendre le titre sous l'heure (il s'ellipse plutôt que de passer à la
  // ligne). Seuls les badges restent en dessous, sur les blocs assez hauts.
  return `<div class="${cls}" data-id="${t.id}" data-date="${ds}" data-start="${b.start}" data-dur="${b.rawEnd - b.start}" draggable="true"
      style="--top:${top}px;--h:${h}px;--col:${col};--cols:${cols};${accent}" title="${esc(t.title)}">
    <div class="todo-check agenda-block-check${b.done ? ' checked' : ''}" onclick="event.stopPropagation();${checkAction}"${b.cancelled ? ' title="Annulée — cliquer pour restaurer"' : ''}></div>
    <div class="agenda-block-body">
      <div class="agenda-block-head">
        <div class="agenda-block-time">${timeLabel}</div>
        <div class="agenda-block-title">${esc(t.title)}</div>
        ${flexBadge}${recBadge}${catBadge}${linkBadge}${subBadge}
      </div>
      ${subsHTML}
    </div>
    <div class="agenda-block-actions">
      <button class="agenda-block-btn" title="Focus sur cette tâche" onclick="event.stopPropagation();window.app.focusStartOn('${t.id}','${ds}')">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5.5v13a1 1 0 0 0 1.53.85l10.5-6.5a1 1 0 0 0 0-1.7L8.53 4.65A1 1 0 0 0 7 5.5Z"/></svg>
      </button>
      <button class="agenda-block-btn" title="Actions" onclick="event.stopPropagation();window.app.showTodoMenu(event,'${t.id}','${ds}')">⋯</button>
    </div>
    ${overflows ? `<div class="agenda-block-endline" style="--t:${timeH}px" title="Fin prévue : ${fmtHM(b.rawEnd)}"></div>` : ''}
    <div class="agenda-block-resize" title="Ajuster la durée"></div>
    ${_nestBadgeHTML}
  </div>`;
}

// ── Rendu d'une pastille « sans heure » ─────────────────
function chipHTML(t, navDate, ds) {
  const done = isCompleted(t, navDate);
  const cancelled = isCancelled(t, navDate);
  const isRec = t.recurrence && t.recurrence !== 'none';
  const est = effectiveEstimate(t);
  const cat = (() => {
    const ids = t.categoryIds || (t.categoryId ? [t.categoryId] : []);
    if (!ids.length) return null;
    return getCategories().find(c => c.id === ids[0]) || null;
  })();
  const checkAction = cancelled
    ? `window.app.cancelTodo('${t.id}','${ds}')`
    : `window.app.toggleTodo('${t.id}',window.app.parseDS('${ds}'),event)`;
  const cls = ['agenda-chip', done ? 'done' : '', cancelled ? 'cancelled' : '',
    t.priority ? `prio-${t.priority}` : ''].filter(Boolean).join(' ');
  return `<div class="${cls}" data-id="${t.id}" data-date="${ds}" draggable="true"
      style="${cat ? `--accent:${cat.color};` : ''}" title="${esc(t.title)} — glisser dans la grille pour lui donner une heure">
    <div class="todo-check agenda-chip-check${done ? ' checked' : ''}" onclick="event.stopPropagation();${checkAction}"></div>
    <span class="agenda-chip-title">${esc(t.title)}</span>
    ${isRec ? `<span class="agenda-chip-rec" title="Récurrente">↻</span>` : ''}
    ${est ? `<span class="agenda-chip-est">${est}′</span>` : ''}
    ${_nestBadgeHTML}
  </div>`;
}

// ── Bande flexible (tâches sans heure d'un moment) ──────
// Pas de « + » ici : l'en-tête de la bande juste au-dessus (.agenda-band-add)
// vise déjà exactement le même moment, un second bouton à 5px de là n'ajoutait
// qu'un doublon dans une vue qui en comptait déjà huit.
function flexStripHTML(items, period, navDate, ds, opts = {}) {
  const chips = items.map(t => chipHTML(t, navDate, ds)).join('');
  const empty = !items.length
    ? `<span class="agenda-flex-empty">${opts.emptyLabel || 'déposer ici pour retirer l’heure'}</span>` : '';
  return `<div class="agenda-flex-strip" data-period="${period}">
    <span class="agenda-flex-label">sans heure</span>
    <div class="agenda-flex-items">${chips}${empty}</div>
  </div>`;
}

// ── Bande de moment complète ────────────────────────────
function bandHTML(band, bucket, navDate, ds, prefs, ctx) {
  const px = prefs.zoom;
  // L'étendue rendue, convertie en minutes, AVANT le regroupement : c'est elle
  // qui décide des colonnes (cf. assignColumns).
  bucket.timed.forEach(b => {
    b.layoutEnd = b.start + (blockGeometry(b, px).layoutH / px) * 60;
  });
  const laid = assignColumns(bucket.timed);
  const range = displayRange(band, laid, prefs);
  const hours = [];
  for (let h = range.from; h <= range.to; h++) hours.push(h);
  const height = (range.to - range.from) * px;

  const railHours = hours.slice(0, -1).map(h =>
    `<div class="agenda-hour" style="--t:${(h - range.from) * px}px"><span>${String(h).padStart(2, '0')}:00</span></div>`
  ).join('');

  const lines = hours.map(h => {
    const half = (px >= 68 && h < range.to)
      ? `<div class="agenda-line agenda-line--half" style="--t:${(h - range.from + 0.5) * px}px"></div>` : '';
    return `<div class="agenda-line" style="--t:${(h - range.from) * px}px"></div>${half}`;
  }).join('');

  const blocks = laid.map(b => blockHTML(b, ds, px, range)).join('');

  // Ligne « maintenant » — seulement aujourd'hui, et seulement dans la bande
  // qui contient l'heure courante (rafraîchie par app._agendaTickNow()).
  let nowLine = '', nowAdd = '';
  if (ctx.isToday) {
    const nowMin = ctx.nowMinutes;
    if (nowMin >= range.from * 60 && nowMin <= range.to * 60) {
      const nowTop = ((nowMin - range.from * 60) / 60) * px;
      nowLine = `<div class="agenda-now" id="agendaNow" style="--t:${nowTop}px"><span class="agenda-now-dot"></span><span class="agenda-now-label">${fmtHM(nowMin)}</span></div>`;
      // Le bouton « + » vit dans la GOUTTIÈRE DES HEURES, pas dans le canevas.
      // Posé sur la ligne elle-même (canevas, left:6px) il recouvrait la case
      // à cocher d'une tâche en cours — et la ligne étant au-dessus des blocs
      // en z-index, il lui volait le clic. La gouttière ne contient jamais de
      // bloc : les deux cibles cohabitent sans se disputer un seul pixel.
      // `.agenda-now` reste traversante (pointer-events:none) pour ne pas
      // voler les survols de dépôt à la grille, et n'a donc plus rien de
      // cliquable — c'est cohérent.
      nowAdd = `<button class="agenda-now-add" style="--t:${nowTop}px" onclick="window.app.agendaAddNow(event)" title="Ajouter une tâche maintenant — Option+clic décale aussi la suite de la journée">${_plusSVG}</button>`;
    }
  }

  const count = bucket.timed.length + bucket.flex.length;
  return `<section class="agenda-band" data-period="${band.key}">
    <header class="agenda-band-head">
      ${BAND_ICONS[band.key]}<span class="agenda-band-label">${band.label}</span>
      ${count ? `<span class="agenda-band-count">${count}</span>` : ''}
      <span class="agenda-band-line"></span>
      <button class="agenda-band-add" title="Ajouter une tâche à ce moment" onclick="window.app.addSectionTask('${band.key}')">${_plusSVG}</button>
    </header>
    ${flexStripHTML(bucket.flex, band.key, navDate, ds)}
    <div class="agenda-grid" style="--px:${px}px;--h:${height}px">
      <div class="agenda-rail">${railHours}${nowAdd}</div>
      <div class="agenda-canvas" data-period="${band.key}" data-from="${range.from * 60}" data-to="${range.to * 60}" data-px="${px}" style="--h:${height}px">
        ${lines}${nowLine}${blocks}
      </div>
    </div>
  </section>`;
}

// ── Barre d'outils de l'agenda ──────────────────────────
const _ZOOM_ICON = `<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="7" cy="7" r="4.6"/><line x1="10.4" y1="10.4" x2="14.5" y2="14.5"/><line x1="4.8" y1="7" x2="9.2" y2="7"/><line x1="7" y1="4.8" x2="7" y2="9.2"/></svg>`;

function toolbarHTML(prefs, ctx) {
  const zoomBtns = AGENDA_ZOOMS.map(z =>
    `<button class="agenda-tool-btn${prefs.zoom === z.px ? ' active' : ''}" onclick="window.app.setAgendaZoom(${z.px})" title="Hauteur d’une heure : ${z.px}px">${z.label}</button>`
  ).join('');
  const recBtns = [
    ['none', 'Ponct.'], ['daily', 'Quot.'], ['weekly', 'Hebdo'],
    ['monthly', 'Mens.'], ['yearly', 'Ann.'],
  ].map(([k, l]) =>
    `<button class="agenda-tool-pill${prefs.rec[k] !== false ? ' active' : ''}" onclick="window.app.toggleAgendaRec('${k}')">${l}</button>`
  ).join('');
  const doneTitle = ctx.isStatsMode ? 'Afficher les tâches complétées et annulées' : 'Masquer les tâches complétées et annulées';
  // Pas de bascule Liste/Agenda ici : elle vit dans `.day-top-row`, commune
  // aux deux modes (cf. dayLayoutSwitchHTML).
  return `<div class="agenda-toolbar">
    <button class="agenda-tool-add" onclick="window.app.openModal()" title="Nouvelle tâche (jour affiché)">${_plusSVG}<span>Ajouter</span></button>
    <div class="agenda-tool-group agenda-tool-group--labelled">
      <span class="agenda-tool-glabel">${_ZOOM_ICON}<span>Zoom</span></span>
      ${zoomBtns}
    </div>
    <button class="agenda-tool-btn${prefs.night ? ' active' : ''}" onclick="window.app.toggleAgendaNight()" title="Afficher la nuit (00:00–07:00 et 23:00–00:00)">Nuit</button>
    <div class="agenda-tool-group agenda-tool-pills">${recBtns}</div>
    <button class="agenda-tool-btn agenda-tool-toggle${ctx.isStatsMode ? ' active' : ''}" onclick="window.app.togglePastDisplay()" title="${doneTitle}">Complétés${ctx.isStatsMode && ctx.hiddenAll > 0 ? `<span class="agenda-tool-count">${ctx.hiddenAll}</span>` : ''}</button>
    ${ctx.isToday ? `<button class="agenda-tool-btn agenda-now-btn" onclick="window.app.agendaScrollToNow()" title="Aller à l’heure actuelle">Maintenant</button>` : ''}
  </div>`;
}

// ── Point d'entrée ──────────────────────────────────────
// Rend le corps de la vue jour en mode Agenda. `ctx` porte ce que
// renderDayView() a déjà calculé (mode stats, aujourd'hui, panneau de
// relance…), pour ne rien recalculer deux fois.
export function renderAgendaBody(todos, navDate, ctx) {
  const prefs = getAgendaPrefs();
  const ds = DS(navDate);
  const all = getTodosForDate(navDate, todos);
  // Mode stats : complétées/annulées retirées de la grille (pas seulement
  // masquées en CSS — un bloc invisible occuperait quand même sa colonne
  // dans le calcul de chevauchement et décalerait ses voisins).
  const items = ctx.isStatsMode
    ? all.filter(t => !isCompleted(t, navDate) && !isCancelled(t, navDate))
    : all;
  const buckets = splitItems(items, navDate, prefs);

  const noneStrip = buckets.none.length
    ? `<section class="agenda-band agenda-band--none" data-period="">
        <header class="agenda-band-head">
          ${BAND_ICONS.none}<span class="agenda-band-label">Sans moment</span>
          <span class="agenda-band-count">${buckets.none.length}</span>
          <span class="agenda-band-line"></span>
          <button class="agenda-band-add" title="Ajouter une tâche sans moment" onclick="window.app.addSectionTask('')">${_plusSVG}</button>
        </header>
        ${flexStripHTML(buckets.none, '', navDate, ds, { emptyLabel: 'aucune' })}
      </section>`
    : '';

  const bands = AGENDA_BANDS.map(b => bandHTML(b, buckets[b.key], navDate, ds, prefs, ctx)).join('');

  return `<div class="agenda-wrap">
    ${toolbarHTML(prefs, ctx)}
    <div class="agenda-scroll" id="agendaScroll">
      ${noneStrip}${bands}
      <div class="agenda-hint">Glissez un bloc pour le déplacer · tirez son bord bas pour la durée · glissez sur une plage vide (ou double-cliquez) pour créer</div>
    </div>
    ${ctx.refillHTML || ''}
  </div>`;
}

// Sélecteur de mode d'affichage de la vue jour — segmented control à deux
// segments (Liste | Agenda), volontairement DIFFÉRENT des boutons fantômes
// des rangées de contrôles : c'est un choix de vue, pas un réglage parmi
// d'autres. Rendu par la coquille commune de renderDayView() (dans
// `.day-top-row`, à droite de la mini-semaine), donc exactement au même
// endroit dans les deux modes — la 1re version vivait dans `.day-col-controls`
// en mode Liste et dans `.agenda-toolbar` en mode Agenda, elle sautait donc
// d'un bout à l'autre de l'écran à chaque bascule.
const _LAYOUT_OPTS = [
  { id: 'list', label: 'Liste', title: 'Vue en listes — cartes par moment (Alt+A)',
    icon: `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="14" y2="8"/><line x1="2" y1="12" x2="14" y2="12"/></svg>` },
  { id: 'agenda', label: 'Agenda', title: 'Vue Agenda — grille horaire (Alt+A)',
    icon: `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="1.6" y="2.6" width="12.8" height="11.8" rx="2"/><line x1="1.6" y1="6.2" x2="14.4" y2="6.2"/><line x1="5.4" y1="6.2" x2="5.4" y2="14.4"/></svg>` },
];

export function dayLayoutSwitchHTML(current = getDayLayout()) {
  const opts = _LAYOUT_OPTS.map(o =>
    `<button class="day-layout-opt${current === o.id ? ' active' : ''}" onclick="window.app.setDayLayout('${o.id}')" title="${o.title}" aria-pressed="${current === o.id}">${o.icon}<span>${o.label}</span></button>`
  ).join('');
  return `<div class="day-layout-switch" role="group" aria-label="Mode d'affichage de la journée">${opts}</div>`;
}
