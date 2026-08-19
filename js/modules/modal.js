// ════════════════════════════════════════════════════════
//  MODAL MANAGEMENT
// ════════════════════════════════════════════════════════

import { DS, today, parseDS, esc, daysInMonth, firstDayOfMonth, effectiveEstimate } from './utils.js';
import { getTodosForDate, addTask, getSuggestions, getRecentTasks, resolveOccurrence, occurrenceOverride } from './calendar.js';
import * as state from './state.js';
import { getSuggestedTasks, getCategories, saveCategories, CATEGORY_COLORS } from './admin.js';
import { getProjects, saveProjects } from './projectManager.js';
import { pushNow, saveTodos } from './storage.js';
import { attachMic, autoStartDictation, stopDictation } from './dictation.js';

// ─── Smooth reveal / hide helpers ──────────────────────────────────────────

function _slideIn(el) {
  if (!el || (el.style.display !== 'none' && el.offsetHeight > 0 && !el._hiding)) return;
  if (el._hiding) { el._hiding = false; gsap.killTweensOf(el); }
  el.style.display = '';
  el.style.overflow = 'clip';
  gsap.fromTo(el,
    { height: 0, opacity: 0 },
    { height: 'auto', opacity: 1, duration: 0.3, ease: 'power2.out',
      onComplete: () => { el.style.overflow = ''; el.style.height = ''; } }
  );
}

function _slideOut(el) {
  if (!el || el.style.display === 'none') return;
  el._hiding = true;
  el.style.overflow = 'clip';
  gsap.to(el,
    { height: 0, opacity: 0, duration: 0.2, ease: 'power2.in',
      onComplete: () => { el.style.display = 'none'; el.style.overflow = ''; el.style.height = ''; el._hiding = false; } }
  );
}

// ─── Duration stepper ──────────────────────────────────────────────────────

function _formatDuration(minutes) {
  const m = parseInt(minutes);
  if (!m || m <= 0) return '—';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}`;
}

function _syncDurationStepper(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const stepper = input.closest('.duration-stepper');
  if (!stepper) return;
  const display = stepper.querySelector('.dur-display');
  if (!display) return;
  const val = parseInt(input.value) || 0;
  if (document.activeElement !== display) display.value = _formatDuration(val);
  display.classList.toggle('is-empty', !val);
}

const DUR_STEPS = [0, 1, 2, 3, 5, 10, 15, 30, 60, 90];
const DUR_HOUR_MARK = 180; // 3:00 — au-delà, paliers d'1h plutôt que 30 min

// Au-delà du dernier palier fixe (90 min), la durée reste éditable sans plafond :
// paliers de 30 min jusqu'à 3:00, puis paliers d'1h ensuite. Bornes du + strictement
// exclusives (<90/<180) et du - inclusives (<=90/<=180) pour que +/- restent réversibles
// symétriquement à chaque palier (ex. 150→+30→180→+60→240, et 240→-60→180→-30→150).
function _stepDuration(current, isPlus) {
  if (isPlus) {
    if (current < 90) {
      const next = DUR_STEPS.find(v => v > current);
      return next !== undefined ? next : 90;
    }
    if (current < DUR_HOUR_MARK) return Math.floor(current / 30) * 30 + 30;
    return Math.floor(current / 60) * 60 + 60;
  }
  if (current <= 0) return 0;
  if (current <= 90) {
    for (let i = DUR_STEPS.length - 1; i >= 0; i--) {
      if (DUR_STEPS[i] < current) return DUR_STEPS[i];
    }
    return 0;
  }
  if (current <= DUR_HOUR_MARK) return Math.ceil(current / 30) * 30 - 30;
  return Math.ceil(current / 60) * 60 - 60;
}

function _commitDurationDisplay(display) {
  const stepper = display.closest('.duration-stepper');
  if (!stepper) return;
  const inputId = stepper.dataset.target;
  const input = document.getElementById(inputId);
  if (!input) return;
  const val = Math.max(0, parseInt(display.value) || 0);
  input.value = val || '';
  _syncDurationStepper(inputId);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

document.addEventListener('click', e => {
  const btn = e.target.closest('.dur-btn');
  if (!btn) return;
  const stepper = btn.closest('.duration-stepper');
  if (!stepper) return;
  const inputId = stepper.dataset.target;
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPlus = btn.classList.contains('dur-btn--plus');
  const current = parseInt(input.value) || 0;
  const next = _stepDuration(current, isPlus);
  input.value = next || '';
  _syncDurationStepper(inputId);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});

// Édition directe : au focus, affiche la valeur brute (minutes) sélectionnée
// pour taper une valeur exacte ; au blur/Entrée, on committe vers l'input caché.
document.addEventListener('focusin', e => {
  const display = e.target.closest('.duration-stepper .dur-display');
  if (!display) return;
  const stepper = display.closest('.duration-stepper');
  const input = document.getElementById(stepper.dataset.target);
  if (!input) return;
  display.value = parseInt(input.value) || '';
  requestAnimationFrame(() => display.select());
});

document.addEventListener('input', e => {
  const display = e.target.closest('.duration-stepper .dur-display');
  if (!display) return;
  const cleaned = display.value.replace(/[^0-9]/g, '');
  if (cleaned !== display.value) display.value = cleaned;
});

document.addEventListener('keydown', e => {
  const display = e.target.closest('.duration-stepper .dur-display');
  if (!display) return;
  // Enter committe la valeur (blur → _commitDurationDisplay) PUIS sauve —
  // le champ caché n'est mis à jour qu'au blur, jamais en live sur le input,
  // donc l'ordre blur-avant-saveTask est nécessaire pour ne pas sauver une
  // valeur périmée. Alt+Entrée : même raccourci « sauver + Focus » que
  // partout ailleurs dans ce modal.
  if (e.key === 'Enter') { e.preventDefault(); display.blur(); window.app?.saveTask(e.altKey); }
  else if (e.key === 'Escape') { e.preventDefault(); display._cancel = true; display.blur(); }
});

document.addEventListener('focusout', e => {
  const display = e.target.closest('.duration-stepper .dur-display');
  if (!display) return;
  if (display._cancel) { display._cancel = false; _syncDurationStepper(display.closest('.duration-stepper').dataset.target); return; }
  _commitDurationDisplay(display);
});

// ─── Enter = sauver depuis n'importe quel champ ; Option/Alt+Tab = aller
// directement à la durée estimée ; Option/Alt+Entrée = sauver PUIS basculer
// en mode Focus sur cette tâche (raccourci création rapide) ────────────────
// Exclusions : textarea (notes multi-lignes), bouton/lien (Entrée doit
// activer CE bouton, pas sauver), et tout champ qui a déjà géré lui-même
// Entrée via e.preventDefault()
// (sous-tâche inline, édition de titre de sous-tâche, création inline de tag,
// combobox de titre avec suggestion active).
document.addEventListener('keydown', e => {
  const main = document.querySelector('.modal-main');
  if (!main || !main.contains(e.target)) return;

  if (e.altKey && e.key === 'Tab') {
    e.preventDefault();
    setCatSectionOpen('duration', true);
    document.querySelector('.duration-stepper[data-target="taskDurationEstimated"] .dur-display')?.focus();
    return;
  }

  if (e.key === 'Enter' && !e.shiftKey && !e.defaultPrevented) {
    const tag = e.target.tagName;
    if (tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'A') return;
    e.preventDefault();
    if (e.altKey) window.app?.saveTask(true);
    else document.getElementById('saveTask')?.click();
  }
});

// ─── Date trigger button ───────────────────────────────────────────────────

const _MONTHS_SHORT = ['jan','fév','mar','avr','mai','juin','juil','août','sept','oct','nov','déc'];

function _syncDateBtn() {
  const input = document.getElementById('taskDate');
  const btn   = document.getElementById('taskDateBtn');
  if (!input || !btn) return;
  const val = input.value;
  if (!val) { btn.textContent = 'DATE'; btn.classList.add('is-empty'); return; }
  const d = parseDS(val);
  if (!d) { btn.textContent = 'DATE'; btn.classList.add('is-empty'); return; }
  btn.classList.remove('is-empty');
  if (val === DS(new Date())) { btn.textContent = "Auj."; return; }
  btn.textContent = `${d.getDate()} ${_MONTHS_SHORT[d.getMonth()]}`;
}

document.addEventListener('change', e => { if (e.target.id === 'taskDate') _syncDateBtn(); });

// ─── Day period (Moment) button builder ───────────────────────────────────

const _PERIOD_ICONS = {
  'morning':   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
  'afternoon': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 18a5 5 0 0 0-10 0"/><line x1="12" y1="9" x2="12" y2="2"/><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/><line x1="1" y1="18" x2="3" y2="18"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/></svg>',
  'evening':   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
};
const _PERIOD_LABELS = { 'morning': 'Matin', 'afternoon': 'Après-midi', 'evening': 'Soir' };

// Même glyphe que _plusSVG (render.js, .todo-subtask-add-btn en vue jour) —
// jamais un simple caractère « + », pour rester cohérent visuellement.
const _SUBTASK_PLUS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';

function _dayPeriodHTML(currentPeriod) {
  const periods = ['morning', 'afternoon', 'evening'];
  const buttons = periods.map(p =>
    `<button type="button" class="day-period-btn${currentPeriod === p ? ' active' : ''}" data-period="${p}" onclick="window.app.toggleDayPeriod('${p}')">${_PERIOD_ICONS[p]}<span>${_PERIOD_LABELS[p]}</span></button>`
  ).join('');
  return `<label class="form-label">Moment <span class="timing-flex-hint" title="Matin, après-midi ou soir — aide à planifier sans fixer d'heure précise">?</span></label><div class="day-period-select">${buttons}<input type="hidden" id="taskDayPeriod" value="${currentPeriod}"></div>`;
}

// ─── Modal subtasks ───────────────────────────────────────────────────────

let _modalSubtasks = [];
let _subtasksDirty = false;

export function getModalSubtasks() { return _modalSubtasks; }

export function consumeModalSubtasksDirty() {
  const dirty = _subtasksDirty;
  _subtasksDirty = false;
  return dirty;
}

// Persist subtasks to the actual todo right away (existing task being edited),
// so an Escape close never loses subtasks added mid-edit — only Save applies
// the rest of the form, but subtasks are safe as soon as they're touched.
function _persistSubtasksIfEditing() {
  if (!state.editingId) return;
  const t = state.todos.find(x => x.id === state.editingId);
  if (!t) return;
  const subtasks = JSON.parse(JSON.stringify(_modalSubtasks));
  // Tâche récurrente + occurrence connue : cette checklist n'est valable QUE
  // pour cette date — écrite dans l'override, le master (et donc les autres
  // occurrences) reste intact. Sinon (tâche non récurrente) : comportement
  // inchangé, directement sur le master.
  if (t.recurrence && t.recurrence !== 'none' && state.editingDate) {
    occurrenceOverride(t, state.editingDate).subtasks = subtasks;
  } else {
    t.subtasks = subtasks.length ? subtasks : undefined;
  }
  t.updatedAt = Date.now();
  saveTodos(state.todos);
  _subtasksDirty = true;
}

// Résout une (sous-)sous-tâche : mêmes règles que app._findSubtask —
// parentStid absent → profondeur 1 ; présent → profondeur 2 (la seule
// permise, un seul niveau d'imbrication supplémentaire).
function _findModalSubtask(stid, parentStid) {
  if (parentStid) return _modalSubtasks.find(p => p.id === parentStid)?.subtasks?.find(x => x.id === stid) || null;
  return _modalSubtasks.find(x => x.id === stid) || null;
}

// Rendu récursif (un seul niveau de plus, jamais davantage) : chaque ligne
// de profondeur 1 peut porter, juste après elle, la liste imbriquée de ses
// propres sous-tâches — repliée dans un conteneur indenté distinct
// (.modal-subtask-nested), jamais de 3e niveau (le bouton « + » d'ajout
// imbriqué n'apparaît que sur les lignes de profondeur 1, cf. plus bas).
function _subtaskRowsHTML(list, parentStid) {
  return list.map((s) => {
    const args = parentStid ? `,'${parentStid}'` : '';
    const nested = !parentStid && s.subtasks?.length
      ? `<div class="modal-subtask-nested">${_subtaskRowsHTML(s.subtasks, s.id)}</div>`
      : '';
    return `
    <div class="modal-subtask-item${s.completed ? ' done' : ''}" data-stid="${s.id}"${parentStid ? ` data-parent-stid="${parentStid}"` : ''}>
      <button class="subtask-drag-handle" title="Glisser pour réordonner">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>
      </button>
      <div class="subtask-check${s.completed ? ' done' : ''}" onclick="window.app.toggleModalSubtask('${s.id}'${args})"></div>
      <span class="subtask-title${s.completed ? ' done' : ''}" onclick="window.app.editModalSubtask(this,'${s.id}'${args})">${esc(s.title)}</span>
      <span class="subtask-estimate-badge${effectiveEstimate(s) ? '' : ' ghost'}" onclick="window.app.editModalSubtaskEstimate(this,'${s.id}'${args})" title="${s.durationEstimated ? 'Durée estimée — cliquer pour modifier' : 'Ajouter une durée estimée'}">${effectiveEstimate(s) ? (s.durationEstimated ? `${s.durationEstimated} min` : `~${effectiveEstimate(s)} min`) : '+ durée'}</span>
      ${!parentStid ? `<button class="subtask-add-nested-btn" onclick="window.app.addModalSubtaskInline('${s.id}')" title="Ajouter une sous-tâche">${_SUBTASK_PLUS_SVG}</button>` : ''}
      <button class="subtask-del" onclick="window.app.removeModalSubtask('${s.id}'${args})">×</button>
    </div>${nested}`;
  }).join('');
}

function _renderModalSubtasks() {
  const el = document.getElementById('modalSubtaskList');
  if (!el) return;
  el.innerHTML = _subtaskRowsHTML(_modalSubtasks, null)
    + `<button class="subtask-add-btn" onclick="window.app.addModalSubtaskInline()">${_SUBTASK_PLUS_SVG}<span>sous-tâche</span></button>`;
  // Listener délégué posé une seule fois sur le conteneur (persiste à
  // travers les innerHTML successifs) — voir _onSubtaskListMouseDown.
  if (!el.dataset.dragBound) {
    el.dataset.dragBound = '1';
    el.addEventListener('mousedown', _onSubtaskListMouseDown);
  }
}

// ─── Réordonnancement des sous-tâches par glisser-déposer (modal) ─────────
// Remplace les anciennes flèches ↑/↓ (1 clic = 1 cran, pénible sur une
// longue liste). PAS l'API HTML5 draggable/dragover : .modal-overlay et
// .modal ont un backdrop-filter (blur) sur eux, et un ancêtre filtré/flouté
// empêche une vraie cible de drop native de recevoir dragover/drop (bug
// Chromium documenté au niveau du modal Bilan) — implémenté ici à la main
// via mousedown/mousemove/mouseup, insensible à ce bug. Reprend la même
// sémantique avant/après que le drag-and-drop de sous-tâches en vue jour
// (_reorderSubtask, app.js), juste sans la zone centrale d'imbrication
// (déjà couverte par le bouton dédié « + » imbriqué).
let _subtaskDrag = null;

function _onSubtaskListMouseDown(e) {
  const handle = e.target.closest('.subtask-drag-handle');
  if (!handle) return;
  e.preventDefault();
  const row = handle.closest('.modal-subtask-item');
  const listRoot = document.getElementById('modalSubtaskList');
  if (!row || !listRoot) return;
  const parentStid = row.dataset.parentStid || null;
  // Même niveau seulement : le conteneur DOM est partagé entre les deux
  // profondeurs (une ligne de niveau 2 vit dans .modal-subtask-nested,
  // sibling DOM de la ligne de niveau 1 suivante) — filtrer sur
  // data-parent-stid est indispensable pour ne jamais mélanger les niveaux.
  const rows = Array.from(listRoot.querySelectorAll('.modal-subtask-item'))
    .filter(r => (r.dataset.parentStid || null) === parentStid);
  row.classList.add('dragging');
  document.body.classList.add('subtask-drag-active');
  _subtaskDrag = { stid: row.dataset.stid, parentStid, rows, row, target: null, before: true };
  document.addEventListener('mousemove', _onSubtaskDragMove);
  document.addEventListener('mouseup', _onSubtaskDragEnd, { once: true });
}

function _onSubtaskDragMove(e) {
  if (!_subtaskDrag) return;
  const { rows, row } = _subtaskDrag;
  let closest = null, closestDist = Infinity, before = true;
  for (const r of rows) {
    if (r === row) continue;
    const rect = r.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    const dist = Math.abs(e.clientY - mid);
    if (dist < closestDist) { closestDist = dist; closest = r; before = e.clientY < mid; }
  }
  rows.forEach(r => r.classList.remove('drop-target-swap', 'drop-before', 'drop-after'));
  if (closest) closest.classList.add('drop-target-swap', before ? 'drop-before' : 'drop-after');
  _subtaskDrag.target = closest;
  _subtaskDrag.before = before;
}

function _onSubtaskDragEnd() {
  document.removeEventListener('mousemove', _onSubtaskDragMove);
  if (!_subtaskDrag) return;
  const { stid, parentStid, rows, row, target, before } = _subtaskDrag;
  rows.forEach(r => r.classList.remove('drop-target-swap', 'drop-before', 'drop-after'));
  row.classList.remove('dragging');
  document.body.classList.remove('subtask-drag-active');
  _subtaskDrag = null;
  if (!target) return;
  const arr = parentStid ? _modalSubtasks.find(x => x.id === parentStid)?.subtasks : _modalSubtasks;
  if (!arr) return;
  const fromIdx = arr.findIndex(x => x.id === stid);
  let toIdx = arr.findIndex(x => x.id === target.dataset.stid);
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
  const [item] = arr.splice(fromIdx, 1);
  if (toIdx > fromIdx) toIdx -= 1; // le retrait a déjà décalé tout ce qui suit
  arr.splice(before ? toIdx : toIdx + 1, 0, item);
  _renderModalSubtasks();
  _scheduleDraftSave();
  _persistSubtasksIfEditing();
}

export function populateModalSubtasks(subtasks) {
  _modalSubtasks = subtasks ? JSON.parse(JSON.stringify(subtasks)) : [];
  _subtasksDirty = false;
  _renderModalSubtasks();
}

export function toggleModalSubtask(stid, parentStid) {
  const s = _findModalSubtask(stid, parentStid);
  if (s) { s.completed = !s.completed; _renderModalSubtasks(); _scheduleDraftSave(); _persistSubtasksIfEditing(); }
}

export function removeModalSubtask(stid, parentStid) {
  if (parentStid) {
    const p = _modalSubtasks.find(x => x.id === parentStid);
    if (p?.subtasks) p.subtasks = p.subtasks.filter(x => x.id !== stid);
  } else {
    _modalSubtasks = _modalSubtasks.filter(x => x.id !== stid);
  }
  _renderModalSubtasks();
  _scheduleDraftSave();
  _persistSubtasksIfEditing();
}

export function addModalSubtask(title, parentStid) {
  const item = { id: Date.now().toString(), title, completed: false };
  if (parentStid) {
    const p = _modalSubtasks.find(x => x.id === parentStid);
    if (!p) return null;
    if (!p.subtasks) p.subtasks = [];
    p.subtasks.push(item);
  } else {
    _modalSubtasks.push(item);
  }
  _renderModalSubtasks();
  _scheduleDraftSave();
  _persistSubtasksIfEditing();
  return item;
}

export function editModalSubtask(el, stid, parentStid) {
  // Le span reste cliquable pendant toute l'édition (onclick, pas juste au
  // 1er clic) — sans cette garde, cliquer pour repositionner le curseur
  // dans le titre relançait la sélection du mot entier à chaque fois,
  // rendant impossible tout positionnement fin du curseur.
  if (el.isContentEditable) return;
  const s = _findModalSubtask(stid, parentStid);
  if (!s) return;
  el.contentEditable = 'true';
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  const save = () => {
    el.contentEditable = 'false';
    const newTitle = el.textContent.trim();
    if (newTitle) { s.title = newTitle; _scheduleDraftSave(); _persistSubtasksIfEditing(); }
    // Jamais esc() sur textContent : il échappe déjà seul, donc esc() y
    // écrirait « &gt; » comme texte VISIBLE, relu tel quel dans s.title à la
    // sauvegarde suivante — une couche de plus à chaque cycle d'édition
    else el.textContent = s.title;
  };
  el.addEventListener('blur', save, { once: true });
  // Pas de { once: true } ici : ce listener doit rester actif tant que
  // l'édition dure, pas seulement pour la 1re frappe — sinon corriger le
  // titre (taper un caractère avant d'appuyer sur Entrée) désarme le
  // handler, et Entrée tombe soit sur le listener global du modal (sauve
  // + FERME tout le modal), soit — hors modal — sur le comportement par
  // défaut du navigateur (insertion d'un saut de ligne). Le span est de
  // toute façon recréé à chaque _renderModalSubtasks(), donc pas de fuite.
  // Shift+Entrée est volontairement exclu : seul moyen explicite de sauter
  // une ligne dans un champ en édition (sinon Entrée sauve toujours).
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.blur(); }
    if (e.key === 'Escape') { el.textContent = s.title; el.contentEditable = 'false'; }
  });
}

// Estimation d'une sous-tâche (s.durationEstimated, optionnelle) — même
// pattern d'input en place que editModalSubtask() ci-dessus, mais un nombre.
// Préremplit avec la valeur BRUTE uniquement (jamais effectiveEstimate()/la
// somme calculée, sinon éditer sans rien changer figerait silencieusement
// la somme comme valeur explicite).
export function editModalSubtaskEstimate(badgeEl, stid, parentStid) {
  const s = _findModalSubtask(stid, parentStid);
  if (!s || badgeEl.querySelector('input')) return;
  const prevHTML = badgeEl.innerHTML;
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '1';
  input.step = '1';
  input.inputMode = 'numeric';
  input.className = 'subtask-estimate-input';
  if (s.durationEstimated) input.value = s.durationEstimated;
  input.addEventListener('click', e => e.stopPropagation());
  input.addEventListener('mousedown', e => e.stopPropagation());
  let settled = false;
  const restore = () => { badgeEl.innerHTML = prevHTML; };
  const confirm = () => {
    if (settled) return;
    settled = true;
    const raw = input.value.trim();
    const val = raw ? parseInt(raw, 10) : null;
    if (val !== (s.durationEstimated || null) && (val === null || val > 0)) {
      if (val) s.durationEstimated = val; else delete s.durationEstimated;
      _renderModalSubtasks();
      _scheduleDraftSave();
      _persistSubtasksIfEditing();
    } else {
      restore();
    }
  };
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); confirm(); }
    if (e.key === 'Escape') { settled = true; restore(); }
  });
  input.addEventListener('blur', confirm);
  badgeEl.innerHTML = '';
  badgeEl.appendChild(input);
  input.focus();
  input.select();
}

// parentStid absent : comportement inchangé (input avant le bouton
// persistant .subtask-add-btn). parentStid présent : l'input s'ouvre juste
// après la ligne de la sous-tâche visée, dans son conteneur imbriqué
// (.modal-subtask-nested — créé à la volée s'il n'existe pas encore, pour
// garder l'indentation dès la 1re saisie plutôt qu'un flash non-indenté).
export function addModalSubtaskInline(parentStid) {
  const list = document.getElementById('modalSubtaskList');
  if (!list) return;
  const input = document.createElement('input');
  input.className = 'subtask-new-input';
  input.placeholder = 'Nouvelle sous-tâche…';
  input.autocomplete = 'off';
  let addBtn = null;
  if (parentStid) {
    const rowEl = list.querySelector(`.modal-subtask-item[data-stid="${parentStid}"]`);
    if (!rowEl) return;
    let nestedEl = rowEl.nextElementSibling?.classList.contains('modal-subtask-nested') ? rowEl.nextElementSibling : null;
    if (!nestedEl) {
      nestedEl = document.createElement('div');
      nestedEl.className = 'modal-subtask-nested';
      rowEl.insertAdjacentElement('afterend', nestedEl);
    }
    nestedEl.appendChild(input);
  } else {
    addBtn = list.querySelector(':scope > .subtask-add-btn');
    if (!addBtn) return;
    addBtn.style.display = 'none';
    list.insertBefore(input, addBtn);
  }
  // wrap: ces inputs n'ont pas de conteneur à eux où ancrer le micro.
  // attachMic() redirige aussi input.remove() vers le wrapper (cf. dictation.js).
  attachMic(input, { wrap: true, compact: true });
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    const title = input.value.trim();
    input.remove();
    if (addBtn) addBtn.style.display = '';
    if (title) addModalSubtask(title, parentStid);
  };
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const title = input.value.trim();
      if (!title) return;
      done = true; // prevent blur from firing finish()
      const created = addModalSubtask(title, parentStid);
      // Alt+Entrée : sauver la sous-tâche PUIS basculer en mode Focus dessus
      // — seulement possible si la tâche parente existe déjà réellement
      // (state.editingId, cf. _persistSubtasksIfEditing) et que ce n'est pas
      // une sous-sous-tâche (Focus ne cible jamais la profondeur 2). Ferme
      // le modal en premier pour ne pas laisser son overlay par-dessus le
      // plein écran Focus.
      if (e.altKey && !parentStid && state.editingId && created) {
        const parentId = state.editingId;
        closeModal();
        window.app?.focusStartOn(parentId, DS(today()), created.id, { fallbackToEdit: false });
        return;
      }
      // Re-open inline input immediately for the next subtask — le DOM
      // vient d'être régénéré par addModalSubtask() (y compris le conteneur
      // imbriqué tout juste créé), donc cible à nouveau le même parent
      addModalSubtaskInline(parentStid);
    }
    if (e.key === 'Escape') { done = true; input.remove(); if (addBtn) addBtn.style.display = ''; }
  });
  input.addEventListener('blur', finish);
  input.focus();
  autoStartDictation(input);
}

// ─── Draft management ─────────────────────────────────────────────────────

const DRAFT_KEY = 'modalDraft';
let _draftTimer = null;
let _draftListeners = null;

function _scheduleDraftSave() {
  clearTimeout(_draftTimer);
  _draftTimer = setTimeout(_saveDraft, 300);
}

function _saveDraft() {
  const title = document.getElementById('taskTitle')?.value || '';
  const description = document.getElementById('taskDescription')?.value || '';
  if (!title && !description) { localStorage.removeItem(DRAFT_KEY); return; }
  localStorage.setItem(DRAFT_KEY, JSON.stringify({
    title,
    description,
    priority: state.selectedPriority || '',
    scheduleMode: state.scheduleMode,
    date: document.getElementById('taskDate')?.value || '',
    startTime: document.getElementById('taskStartTime')?.value || '',
    endTime: document.getElementById('taskEndTime')?.value || '',
    flexibleTime: document.getElementById('taskFlexibleTime')?.checked || false,
    durationEstimated: document.getElementById('taskDurationEstimated')?.value || '',
    durationReal: document.getElementById('taskDurationReal')?.value || '',
    categoryIds: [..._selectedCategoryIds],
    projectIds: [..._selectedProjectIds],
    intentionIds: [..._selectedIntentionIds],
    recurrence: state.selectedRecurrence,
    dayPeriod: document.getElementById('taskDayPeriod')?.value || '',
    weekDays: [...state.selectedWeekDays],
    monthDays: [...state.selectedMonthDays],
    monthLastDay: state.selectedMonthLastDay,
    yearMonth: state.selectedYearMonth,
    yearDay: state.selectedYearDay,
    subtasks: _modalSubtasks.length ? _modalSubtasks : undefined,
    counterEnabled: document.getElementById('taskCounterEnabled')?.checked || false,
    countFrom: document.getElementById('taskCountFrom')?.value || '',
    countTo: document.getElementById('taskCountTo')?.value || '',
    countUnit: document.getElementById('taskCountUnit')?.value || '',
  }));
}

export function clearDraft() {
  clearTimeout(_draftTimer);
  localStorage.removeItem(DRAFT_KEY);
  const banner = document.getElementById('draftBanner');
  if (banner) banner.style.display = 'none';
}

export function discardDraft() {
  clearDraft();
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskDescription').value = '';
  document.getElementById('taskDate').value = DS(state.navDate);
  _syncDateBtn();
  document.getElementById('taskStartTime').value = '';
  document.getElementById('taskEndTime').value = '';
  document.getElementById('taskFlexibleTime').checked = false;
  document.getElementById('taskDurationEstimated').value = '';
  document.getElementById('taskDurationReal').value = '';
  _syncDurationStepper('taskDurationEstimated');
  _syncDurationStepper('taskDurationReal');
  selectPriority('');
  populateCategoryTags([]);
  populateProjectTags([]);
  populateIntentionTags([]);
  switchTagTab('categories');
  populateModalSubtasks([]);
  selectScheduleMode('date');
  state.setSelectedRecurrence('none');
  document.querySelectorAll('.rec-option').forEach(o => o.classList.toggle('active', o.dataset.rec === 'none'));
  document.getElementById('recDetail').innerHTML = '';
  const scheduleModeGroup = document.getElementById('scheduleModeGroup');
  if (scheduleModeGroup) scheduleModeGroup.style.display = '';
  const dateGroup = document.getElementById('dateGroup');
  if (dateGroup) dateGroup.style.display = '';
  _autoExpandCatSections();
  document.getElementById('taskTitle').focus();
}

function _tryRestoreDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return false;
  let d;
  try { d = JSON.parse(raw); } catch { return false; }
  if (!d.title && !d.description) return false;
  if (d.title) document.getElementById('taskTitle').value = d.title;
  if (d.description) document.getElementById('taskDescription').value = d.description;
  if (d.date) document.getElementById('taskDate').value = d.date;
  _syncDateBtn();
  if (d.startTime) document.getElementById('taskStartTime').value = d.startTime;
  if (d.endTime) document.getElementById('taskEndTime').value = d.endTime;
  if (d.flexibleTime) document.getElementById('taskFlexibleTime').checked = true;
  if (d.durationEstimated) document.getElementById('taskDurationEstimated').value = d.durationEstimated;
  if (d.durationReal) document.getElementById('taskDurationReal').value = d.durationReal;
  _syncDurationStepper('taskDurationEstimated');
  _syncDurationStepper('taskDurationReal');
  if (d.priority !== undefined) selectPriority(d.priority);
  if (d.categoryIds?.length) populateCategoryTags(d.categoryIds);
  if (d.projectIds?.length) populateProjectTags(d.projectIds);
  if (d.intentionIds?.length) populateIntentionTags(d.intentionIds);
  if (d.scheduleMode) {
    state.setScheduleMode(d.scheduleMode);
    document.querySelectorAll('.schedule-mode-option').forEach(o => o.classList.toggle('active', o.dataset.mode === d.scheduleMode));
    const dg = document.getElementById('dateGroup');
    if (dg) dg.style.display = d.scheduleMode === 'date' ? '' : 'none';
  }
  if (d.recurrence && d.recurrence !== 'none') {
    if (d.weekDays?.length) state.setSelectedWeekDays(d.weekDays);
    if (d.monthDays?.length) state.setSelectedMonthDays(d.monthDays);
    if (d.monthLastDay !== undefined) state.setSelectedMonthLastDay(d.monthLastDay);
    if (d.yearMonth !== undefined) state.setSelectedYearMonth(d.yearMonth);
    if (d.yearDay !== undefined) state.setSelectedYearDay(d.yearDay);
    selectRecurrence(d.recurrence);
  }
  if (d.dayPeriod) window.app?.selectDayPeriod(d.dayPeriod);
  if (d.subtasks?.length) populateModalSubtasks(d.subtasks);
  if (d.counterEnabled) {
    const cEl = document.getElementById('taskCounterEnabled');
    const fEl = document.getElementById('counterFields');
    if (cEl) cEl.checked = true;
    if (fEl) fEl.style.display = '';
    if (d.countFrom !== undefined) document.getElementById('taskCountFrom').value = d.countFrom;
    if (d.countTo) document.getElementById('taskCountTo').value = d.countTo;
    if (d.countUnit) document.getElementById('taskCountUnit').value = d.countUnit;
  }
  return true;
}

export function cancelModal() {
  clearDraft();
  closeModal();
}

function _initDraftListeners() {
  _destroyDraftListeners();
  const listeners = [];
  [['taskTitle','input'],['taskDescription','input'],['taskDate','change'],
   ['taskStartTime','change'],['taskEndTime','change'],['taskFlexibleTime','change'],
   ['taskDurationEstimated','input'],['taskDurationReal','input'],['taskCategory','change'],['taskProject','change']
  ].forEach(([id, evt]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const fn = () => _scheduleDraftSave();
    el.addEventListener(evt, fn);
    listeners.push({ el, evt, fn });
  });
  _draftListeners = listeners;
}

function _destroyDraftListeners() {
  if (!_draftListeners) return;
  _draftListeners.forEach(({ el, evt, fn }) => el.removeEventListener(evt, fn));
  _draftListeners = null;
  clearTimeout(_draftTimer);
}

// ─────────────────────────────────────────────────────────────────────────

export function selectScheduleMode(mode) {
  state.setScheduleMode(mode);
  document.querySelectorAll('.schedule-mode-option').forEach(o =>
    o.classList.toggle('active', o.dataset.mode === mode)
  );
  const dateGroup = document.getElementById('dateGroup');
  if (dateGroup) dateGroup.style.display = mode === 'date' ? '' : 'none';
  _scheduleDraftSave();
}

export function selectBigMode(mode) {
  // Update button highlights with punch animation
  document.querySelectorAll('.schedule-mode-option').forEach(o => {
    const isActive = o.dataset.mode === mode;
    o.classList.toggle('active', isActive);
    if (isActive) gsap.fromTo(o, { scale: 0.92 }, { scale: 1, duration: 0.25, ease: 'back.out(2)' });
  });

  const dateTimeGroup = document.getElementById('dateTimeGroup');
  const recSubOptions = document.getElementById('recSubOptions');
  const dateGroup = document.getElementById('dateGroup');

  if (mode === 'today' || mode === 'tomorrow') {
    // Quick-set date to today or tomorrow, then show date fields
    const d = new Date();
    if (mode === 'tomorrow') d.setDate(d.getDate() + 1);
    const dateInput = document.getElementById('taskDate');
    if (dateInput) { dateInput.value = d.toISOString().slice(0, 10); _syncDateBtn(); }
    state.setScheduleMode('date');
    state.setSelectedRecurrence('none');
    const recSel0 = document.getElementById('taskRecurrence');
    if (recSel0) recSel0.value = 'none';
    _slideIn(dateTimeGroup);
    if (dateGroup) dateGroup.style.display = '';
    _slideOut(recSubOptions);
    const detail0 = document.getElementById('recDetail');
    if (detail0) {
      const curPeriod = document.getElementById('taskDayPeriod')?.value || '';
      detail0.innerHTML = _dayPeriodHTML(curPeriod);
    }
  } else if (mode === 'date') {
    state.setScheduleMode('date');
    state.setSelectedRecurrence('none');
    const recSel = document.getElementById('taskRecurrence');
    if (recSel) recSel.value = 'none';
    _slideIn(dateTimeGroup);
    if (dateGroup) dateGroup.style.display = '';
    _slideOut(recSubOptions);
    // Show day period for "none" recurrence
    const detail = document.getElementById('recDetail');
    if (detail) {
      const curPeriod = document.getElementById('taskDayPeriod')?.value || '';
      detail.innerHTML = _dayPeriodHTML(curPeriod);
    }
  } else if (mode === 'recurring') {
    state.setScheduleMode('date');
    _slideIn(dateTimeGroup);
    _slideIn(recSubOptions);
    // Highlight current recurrence sub-option
    const cur = state.selectedRecurrence === 'none' ? 'daily' : state.selectedRecurrence;
    document.querySelectorAll('.rec-sub-option').forEach(o =>
      o.classList.toggle('active', o.dataset.rec === cur)
    );
    // Auto-select daily if none
    if (state.selectedRecurrence === 'none') selectRecurrence('daily');
  } else if (mode === 'inbox') {
    state.setScheduleMode('inbox');
    state.setSelectedRecurrence('none');
    const recSel = document.getElementById('taskRecurrence');
    if (recSel) recSel.value = 'none';
    _slideOut(dateTimeGroup);
  } else if (mode === 'backlog') {
    state.setScheduleMode('backlog');
    state.setSelectedRecurrence('none');
    const recSel = document.getElementById('taskRecurrence');
    if (recSel) recSel.value = 'none';
    _slideOut(dateTimeGroup);
    if (recSubOptions) recSubOptions.style.display = 'none';
  }
  _scheduleDraftSave();
}

// ─── Tag picker state ────────────────────────────────────────────────
let _selectedCategoryIds = [];
let _selectedProjectIds = [];
let _selectedIntentionIds = [];

export function getSelectedCategoryIds() { return _selectedCategoryIds; }
export function getSelectedProjectIds() { return _selectedProjectIds; }
export function getSelectedIntentionIds() { return _selectedIntentionIds; }

function _renderTagPicker(containerId, items, selectedIds, toggleFn, addBtnLabel, addFn) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const pills = items.map(item => {
    const sel = selectedIds.includes(item.id);
    const color = item.color || '#888';
    const label = escapeCategory(item.name || item.title || '');
    const style = sel ? `background:${color};border-color:${color};color:#fff` : '';
    const dotStyle = sel ? '' : `style="background:${color}"`;
    return `<span class="tag-pill${sel ? ' selected' : ''}" data-id="${item.id}" style="${style}" onclick="${toggleFn}('${item.id}')">${sel ? '' : `<span class="tag-pill-dot" ${dotStyle}></span>`}${label}</span>`;
  }).join('');
  const addBtn = addFn ? `<span class="tag-pill-add" onclick="${addFn}">+ ${addBtnLabel}</span>` : '';
  el.innerHTML = pills + addBtn;
}

function populateCategoryTags(selectedIds) {
  _selectedCategoryIds = selectedIds || [];
  _renderTagPicker('taskCategoryTags', getCategories(), _selectedCategoryIds,
    'window.app.toggleCategoryTag', 'Ajouter', 'window.app.toggleNewCatRow()');
}

function populateProjectTags(selectedIds) {
  _selectedProjectIds = selectedIds || [];
  _renderTagPicker('taskProjectTags', getProjects(), _selectedProjectIds,
    'window.app.toggleProjectTag', 'Ajouter', 'window.app.toggleNewProjectRow()');
}

function populateIntentionTags(selectedIds) {
  _selectedIntentionIds = selectedIds || [];
  let intentions = [];
  try { intentions = JSON.parse(localStorage.getItem('intentions') || '[]'); } catch { intentions = []; }
  _renderTagPicker('taskIntentionTags', intentions.map(i => ({ ...i, name: i.codename || i.title })), _selectedIntentionIds,
    'window.app.toggleIntentionTag', 'Ajouter', 'window.app.toggleNewIntentionRow()');
}

export function toggleCategoryTag(id) {
  const idx = _selectedCategoryIds.indexOf(id);
  if (idx >= 0) _selectedCategoryIds.splice(idx, 1); else _selectedCategoryIds.push(id);
  populateCategoryTags(_selectedCategoryIds);
  _scheduleDraftSave();
}

export function toggleProjectTag(id) {
  const idx = _selectedProjectIds.indexOf(id);
  if (idx >= 0) _selectedProjectIds.splice(idx, 1); else _selectedProjectIds.push(id);
  populateProjectTags(_selectedProjectIds);
  _scheduleDraftSave();
}

export function toggleIntentionTag(id) {
  const idx = _selectedIntentionIds.indexOf(id);
  if (idx >= 0) _selectedIntentionIds.splice(idx, 1); else _selectedIntentionIds.push(id);
  populateIntentionTags(_selectedIntentionIds);
  _scheduleDraftSave();
}

export function toggleNewProjectRow() {
  const row = document.getElementById('newProjectRow');
  if (!row) return;
  row.style.display = row.style.display === 'none' ? '' : 'none';
  if (row.style.display !== 'none') document.getElementById('newProjectInput')?.focus();
}

export function toggleNewIntentionRow() {
  const row = document.getElementById('newIntentionRow');
  if (!row) return;
  row.style.display = row.style.display === 'none' ? '' : 'none';
  if (row.style.display !== 'none') document.getElementById('newIntentionInput')?.focus();
}

export function addIntentionInline() {
  const input = document.getElementById('newIntentionInput');
  const title = input?.value.trim();
  if (!title) return;
  let intentions = [];
  try { intentions = JSON.parse(localStorage.getItem('intentions') || '[]'); } catch { intentions = []; }
  const colors = ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316'];
  const color = colors[intentions.length % colors.length];
  const id = Date.now().toString();
  intentions.push({ id, title, color, description: '', codename: '' });
  localStorage.setItem('intentions', JSON.stringify(intentions));
  pushNow();
  input.value = '';
  document.getElementById('newIntentionRow').style.display = 'none';
  _selectedIntentionIds.push(id);
  populateIntentionTags(_selectedIntentionIds);
}

export function switchTagTab(tab) {
  document.querySelectorAll('.tag-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.tag-tab-panel').forEach(p => p.style.display = p.dataset.tab === tab ? '' : 'none');
}

// Back-compat wrappers (used by openModal / openEditModal)
function populateCategorySelect(selectedId) { populateCategoryTags(selectedId ? [selectedId] : []); }
function populateProjectSelect(selectedId) { populateProjectTags(selectedId ? [selectedId] : []); }
function populateIntentionSelect(selectedId) { populateIntentionTags(selectedId ? [selectedId] : []); }

function escapeCategory(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function toggleNewCatRow() {
  const row = document.getElementById('newCatRow');
  if (!row) return;
  const visible = row.style.display !== 'none';
  row.style.display = visible ? 'none' : 'block';
  if (!visible) setTimeout(() => document.getElementById('newCatInput')?.focus(), 50);
}

export function addCategoryInline() {
  const input = document.getElementById('newCatInput');
  const name = input?.value.trim();
  if (!name) return;
  const categories = getCategories();
  const color = CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length];
  const id = Date.now().toString();
  categories.push({ id, name, color, icon: '', description: '', status: 'active', deadline: '' });
  saveCategories(categories);
  input.value = '';
  document.getElementById('newCatRow').style.display = 'none';
  _selectedCategoryIds.push(id);
  populateCategoryTags(_selectedCategoryIds);
}

export function addProjectInline() {
  const input = document.getElementById('newProjectInput');
  const name = input?.value.trim();
  if (!name) return;
  const projects = getProjects();
  const color = CATEGORY_COLORS[projects.length % CATEGORY_COLORS.length];
  const id = Date.now().toString();
  projects.push({ id, name, color });
  saveProjects(projects);
  input.value = '';
  document.getElementById('newProjectRow').style.display = 'none';
  _selectedProjectIds.push(id);
  populateProjectTags(_selectedProjectIds);
}

export function selectPriority(p) {
  state.setSelectedPriority(p);
  document.querySelectorAll('#priorityPastilleRow .priority-pastille').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.priority === p)
  );
  _scheduleDraftSave();
}

// ─── Sections thématiques dépliables (Quand/Durée/Priorité/Notes/
// Étiquettes/Compteur) — remplace l'ancien dépliant unique « Plus
// d'options ». Chaque section se replie/déplie indépendamment (pas un
// accordéon exclusif) ; _autoExpandCatSections() décide, à l'ouverture du
// modal, laquelle a déjà un contenu non par défaut à montrer d'emblée — sur
// une tâche neuve tous les champs sont vides, donc tout reste replié
// (départ minimaliste), sans avoir besoin d'un cas séparé pour la création.

const CAT_KEYS = ['subtasks', 'when', 'duration', 'priority', 'notes', 'tags', 'counter'];

export function setCatSectionOpen(key, open) {
  document.getElementById(`catSection-${key}`)?.classList.toggle('open', !!open);
}

export function toggleCatSection(key) {
  const section = document.getElementById(`catSection-${key}`);
  if (!section) return;
  setCatSectionOpen(key, !section.classList.contains('open'));
}

function _hasCatData(key) {
  switch (key) {
    // Seule section toujours dépliée par défaut, y compris tâche neuve
    // (demandé explicitement — les sous-tâches restent la chose la plus
    // fréquemment utilisée juste après le titre).
    case 'subtasks':
      return true;
    case 'when':
      if (state.scheduleMode !== 'date') return true; // Inbox / Backlog
      if (state.selectedRecurrence !== 'none') return true;
      if (document.getElementById('taskStartTime')?.value) return true;
      if (document.getElementById('taskFlexibleTime')?.checked) return true;
      if (document.getElementById('taskDayPeriod')?.value) return true;
      return false;
    case 'duration':
      return !!(document.getElementById('taskDurationEstimated')?.value || document.getElementById('taskDurationReal')?.value);
    case 'priority':
      return !!state.selectedPriority;
    case 'notes':
      return !!document.getElementById('taskDescription')?.value.trim();
    case 'tags':
      return !!(_selectedCategoryIds.length || _selectedProjectIds.length || _selectedIntentionIds.length);
    case 'counter':
      return !!document.getElementById('taskCounterEnabled')?.checked;
    default:
      return false;
  }
}

function _autoExpandCatSections() {
  CAT_KEYS.forEach(key => setCatSectionOpen(key, _hasCatData(key)));
  _refreshCollapsePreviews();
}

function _setCatPreview(key, text) {
  const el = document.getElementById(`catPreview-${key}`);
  if (el) el.textContent = text;
}

function _fmtSubtasksPreview() {
  if (!_modalSubtasks.length) return 'Aucune';
  const done = _modalSubtasks.filter(s => s.completed).length;
  return `${done}/${_modalSubtasks.length}`;
}

function _fmtWhenPreview() {
  if (state.scheduleMode === 'inbox') return 'Inbox';
  if (state.scheduleMode === 'backlog') return 'Backlog';
  if (state.selectedRecurrence !== 'none') {
    const labels = { daily: 'Quotidien', weekly: 'Hebdo', monthly: 'Mensuel', yearly: 'Annuel' };
    return labels[state.selectedRecurrence] || 'Répète';
  }
  const parts = [];
  const dateVal = document.getElementById('taskDate')?.value;
  if (dateVal) {
    const d = parseDS(dateVal);
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    if (dateVal === DS(new Date())) parts.push("Aujourd'hui");
    else if (dateVal === DS(tomorrow)) parts.push('Demain');
    else if (d) parts.push(`${d.getDate()} ${_MONTHS_SHORT[d.getMonth()]}`);
  }
  const time = document.getElementById('taskStartTime')?.value;
  if (time) parts.push(time);
  const period = document.getElementById('taskDayPeriod')?.value;
  if (period) parts.push(_PERIOD_LABELS[period]);
  return parts.join(' · ') || 'Non planifiée';
}

function _fmtDurationPreview() {
  const est = document.getElementById('taskDurationEstimated')?.value;
  const real = document.getElementById('taskDurationReal')?.value;
  const parts = [];
  if (est) parts.push(`≈ ${_formatDuration(est)}`);
  if (real) parts.push(`réel ${_formatDuration(real)}`);
  return parts.join(' · ') || 'Aucune';
}

function _fmtPriorityPreview() {
  const labels = { low: 'Basse', medium: 'Moyenne', high: 'Haute' };
  return labels[state.selectedPriority] || 'Aucune';
}

function _fmtNotesPreview() {
  const v = document.getElementById('taskDescription')?.value.trim();
  if (!v) return 'Aucune';
  return v.length > 42 ? v.slice(0, 42) + '…' : v;
}

function _fmtTagsPreview() {
  const names = [];
  const cats = getCategories();
  const projs = getProjects();
  let intentions = [];
  try { intentions = JSON.parse(localStorage.getItem('intentions') || '[]'); } catch { intentions = []; }
  _selectedCategoryIds.forEach(id => { const c = cats.find(x => x.id === id); if (c) names.push(c.name); });
  _selectedProjectIds.forEach(id => { const p = projs.find(x => x.id === id); if (p) names.push(p.name); });
  _selectedIntentionIds.forEach(id => { const i = intentions.find(x => x.id === id); if (i) names.push(i.codename || i.title); });
  return names.length ? names.join(', ') : 'Aucune';
}

function _fmtCounterPreview() {
  if (!document.getElementById('taskCounterEnabled')?.checked) return 'Désactivé';
  const from = document.getElementById('taskCountFrom')?.value || 0;
  const to   = document.getElementById('taskCountTo')?.value;
  const unit = document.getElementById('taskCountUnit')?.value || '';
  return to ? `${from} / ${to} ${unit}`.trim() : `Depuis ${from}${unit ? ' ' + unit : ''}`;
}

function _refreshCollapsePreviews() {
  _setCatPreview('subtasks', _fmtSubtasksPreview());
  _setCatPreview('when', _fmtWhenPreview());
  _setCatPreview('duration', _fmtDurationPreview());
  _setCatPreview('priority', _fmtPriorityPreview());
  _setCatPreview('notes', _fmtNotesPreview());
  _setCatPreview('tags', _fmtTagsPreview());
  _setCatPreview('counter', _fmtCounterPreview());
}

// Rafraîchi après (quasi) toute interaction dans le modal plutôt que d'être
// fileté explicitement dans chaque mutateur (selectBigMode, selectPriority,
// toggle des tags, saisie des durées/notes/compteur...) — un seul point
// d'entrée, robuste à un futur champ ajouté sans y penser. Coût négligeable :
// juste quelques lectures de state/DOM + écritures de textContent.
let _cpRAF = null;
function _scheduleCollapsePreviewRefresh() {
  if (_cpRAF) return;
  _cpRAF = requestAnimationFrame(() => { _cpRAF = null; _refreshCollapsePreviews(); });
}
['click', 'input', 'change'].forEach(evt => {
  document.addEventListener(evt, e => {
    if (e.target.closest('.modal-main')) _scheduleCollapsePreviewRefresh();
  });
});

export function openModal(date, todos, scheduleMode = 'date', { restoreDraft = false } = {}) {
  date = date || state.navDate;
  state.setEditingId(null);
  state.setScheduleMode(scheduleMode);
  state.setSelectedRecurrence('none');
  state.setSelectedWeekDays([]);
  state.setSelectedMonthDays([]);
  state.setSelectedMonthLastDay(false);
  state.setSelectedYearMonth(state.navDate.getMonth());
  state.setSelectedYearDay(state.navDate.getDate());
  selectPriority('');
  document.getElementById('modalTitleEl').textContent = state.T.newTask;
  document.getElementById('saveTask').textContent = state.T.btnAdd;
  const _deleteBtn = document.getElementById('deleteFromEditBtn');
  if (_deleteBtn) _deleteBtn.style.display = 'none';
  const _cancelTaskBtn = document.getElementById('cancelTaskFromEditBtn');
  if (_cancelTaskBtn) _cancelTaskBtn.style.display = 'none';
  const _completeWrap = document.getElementById('completeFromEditWrap');
  if (_completeWrap) _completeWrap.style.display = 'none';
  const _completeMenu = document.getElementById('completeMenu');
  if (_completeMenu) _completeMenu.style.display = 'none';
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskDescription').value = '';
  document.getElementById('taskDate').value = DS(date);
  _syncDateBtn();
  document.getElementById('taskStartTime').value = '';
  document.getElementById('taskEndTime').value = '';
  document.getElementById('taskFlexibleTime').checked = false;
  document.getElementById('taskDurationEstimated').value = '';
  document.getElementById('taskDurationReal').value = '';
  _syncDurationStepper('taskDurationEstimated');
  _syncDurationStepper('taskDurationReal');
  const durationRealField = document.getElementById('durationRealField');
  if (durationRealField) durationRealField.style.display = 'none';
  // Reset counter fields
  const _cEnabled = document.getElementById('taskCounterEnabled');
  const _cFields  = document.getElementById('counterFields');
  if (_cEnabled) _cEnabled.checked = false;
  if (_cFields)  _cFields.style.display = 'none';
  const _cFrom = document.getElementById('taskCountFrom');
  const _cTo   = document.getElementById('taskCountTo');
  const _cUnit = document.getElementById('taskCountUnit');
  if (_cFrom) _cFrom.value = '0';
  if (_cTo)   _cTo.value   = '';
  if (_cUnit) _cUnit.value = '';
  const recSel = document.getElementById('taskRecurrence');
  if (recSel) recSel.value = 'none';
  // Show day period buttons for date mode, empty for inbox/backlog
  const recDetail = document.getElementById('recDetail');
  if (scheduleMode === 'date') {
    recDetail.innerHTML = _dayPeriodHTML('');
  } else {
    recDetail.innerHTML = '';
  }
  // Big mode UI
  const bigMode = scheduleMode === 'date' ? 'date' : scheduleMode;
  document.querySelectorAll('.schedule-mode-option').forEach(o => o.classList.toggle('active', o.dataset.mode === bigMode));
  const scheduleModeGroup = document.getElementById('scheduleModeGroup');
  if (scheduleModeGroup) scheduleModeGroup.style.display = '';
  const recSubOptions = document.getElementById('recSubOptions');
  if (recSubOptions) recSubOptions.style.display = 'none';
  const dateTimeGroup = document.getElementById('dateTimeGroup');
  if (dateTimeGroup) dateTimeGroup.style.display = (scheduleMode === 'inbox' || scheduleMode === 'backlog') ? 'none' : '';
  const dateGroup = document.getElementById('dateGroup');
  if (dateGroup) dateGroup.style.display = scheduleMode === 'date' ? '' : 'none';
  populateCategoryTags([]);
  populateProjectTags([]);
  populateIntentionTags([]);
  switchTagTab('categories');
  populateModalSubtasks([]);
  // Restore draft only on page refresh (not on explicit "new task" click)
  const draftBanner = document.getElementById('draftBanner');
  const hadDraft = restoreDraft ? _tryRestoreDraft() : false;
  if (!restoreDraft) clearDraft();
  if (draftBanner) draftBanner.style.display = hadDraft ? '' : 'none';
  const modalBox = document.getElementById('modalOverlay').querySelector('.modal');
  _autoExpandCatSections();
  document.getElementById('modalOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  gsap.fromTo(modalBox,
    { scale: 0.94, y: 30, opacity: 0 },
    { scale: 1, y: 0, opacity: 1, duration: 0.45, ease: 'power2.out' }
  );
  _initModalSwipe();
  _initCombobox(todos);
  _initDraftListeners();
  setTimeout(() => {
    const ti = document.getElementById('taskTitle');
    ti?.focus();
    // Dictée automatique à l'ouverture de « Nouvelle tâche » (réglage
    // dictationAuto). Jamais sur un brouillon restauré : le champ n'est pas
    // vierge, l'utilisateur vient relire/compléter, pas dicter à neuf.
    if (ti && !ti.value) autoStartDictation(ti);
  }, 50);
}

export function closeModal() {
  stopDictation();
  _destroyCombobox();
  _destroyDraftListeners();
  state.setEditingId(null);
  state.setEditingDate(null);
  state.setInsertAfterId(null);
  const modalBox = document.getElementById('modalOverlay').querySelector('.modal');
  const overlay = document.getElementById('modalOverlay');
  gsap.to(modalBox, {
    scale: 0.92, y: 16, opacity: 0, duration: 0.2, ease: 'power2.in',
    onComplete: () => { overlay.classList.add('hidden'); document.body.style.overflow = ''; }
  });
}

export function openEditModal(id, dateStr, todos) {
  const t = todos.find(x => x.id === id);
  if (!t) return;
  // effT = valeurs EFFECTIVES de cette occurrence (override s'il y en a un
  // pour une tâche récurrente) — pour PEUPLER le formulaire. `t` (master)
  // reste utilisé pour les champs qui définissent la récurrence elle-même
  // et le compteur, jamais par occurrence (cf. calendar.js resolveOccurrence).
  const effT = resolveOccurrence(t, dateStr);
  state.setEditingId(id);
  state.setEditingDate(dateStr || null);
  // Detect schedule mode
  const isBacklog = (!t.recurrence || t.recurrence === 'none') && !t.date && t.backlog;
  const isInbox   = (!t.recurrence || t.recurrence === 'none') && !t.date && !t.backlog;
  const schedMode = isBacklog ? 'backlog' : (isInbox ? 'inbox' : 'date');
  state.setScheduleMode(schedMode);
  state.setSelectedRecurrence(t.recurrence || 'none');
  state.setSelectedWeekDays(t.recDays ? [...t.recDays] : []);
  document.getElementById('modalTitleEl').textContent = state.T.editTask;
  document.getElementById('saveTask').textContent = state.T.btnModify;
  const _deleteBtn = document.getElementById('deleteFromEditBtn');
  if (_deleteBtn) { _deleteBtn.dataset.id = id; _deleteBtn.dataset.date = dateStr || ''; _deleteBtn.style.display = ''; }
  const _cancelTaskBtn = document.getElementById('cancelTaskFromEditBtn');
  if (_cancelTaskBtn) {
    const _isCancelledHere = (t.recurrence && t.recurrence !== 'none')
      ? !!dateStr && (t.cancelledDates || []).includes(dateStr)
      : !!t.cancelled;
    _cancelTaskBtn.dataset.id = id;
    _cancelTaskBtn.dataset.date = dateStr || '';
    _cancelTaskBtn.textContent = _isCancelledHere ? '↺ Restaurer la tâche' : '⊘ Annuler la tâche';
    _cancelTaskBtn.style.display = '';
  }
  const _completeWrap = document.getElementById('completeFromEditWrap');
  if (_completeWrap) {
    _completeWrap.style.display = t.completed ? 'none' : '';
    _completeWrap.dataset.id = id;
    _completeWrap.dataset.date = t.date || dateStr || '';
  }
  const _completeMenu = document.getElementById('completeMenu');
  if (_completeMenu) _completeMenu.style.display = 'none';
  // Hide "original date" option when task has no date
  const _completeOrigBtn = document.getElementById('completeOrigDate');
  if (_completeOrigBtn) _completeOrigBtn.style.display = (t.date || dateStr) ? '' : 'none';
  document.getElementById('taskTitle').value = effT.title;
  document.getElementById('taskDescription').value = effT.description || '';
  document.getElementById('taskStartTime').value = effT.startTime || '';
  document.getElementById('taskEndTime').value = effT.endTime || '';
  document.getElementById('taskFlexibleTime').checked = effT.flexibleTime || false;
  document.getElementById('taskDurationEstimated').value = effT.durationEstimated || '';
  document.getElementById('taskDurationReal').value = t.durationReal || '';
  _syncDurationStepper('taskDurationEstimated');
  _syncDurationStepper('taskDurationReal');
  const durationRealField = document.getElementById('durationRealField');
  if (durationRealField) durationRealField.style.display = '';
  populateCategoryTags(effT.categoryIds || (effT.categoryId ? [effT.categoryId] : []));
  populateProjectTags(effT.projectIds || (effT.projectId ? [effT.projectId] : []));
  populateIntentionTags(effT.intentionIds || (effT.intentionId ? [effT.intentionId] : []));
  selectPriority(effT.priority || '');
  // Counter fields
  const counterEnabledEl = document.getElementById('taskCounterEnabled');
  const counterFieldsEl  = document.getElementById('counterFields');
  if (counterEnabledEl) counterEnabledEl.checked = !!t.counterEnabled;
  if (counterFieldsEl) counterFieldsEl.style.display = t.counterEnabled ? '' : 'none';
  if (t.counterEnabled) {
    const cfrom = document.getElementById('taskCountFrom');
    const cto   = document.getElementById('taskCountTo');
    const cunit = document.getElementById('taskCountUnit');
    if (cfrom) cfrom.value = t.countFrom ?? 0;
    if (cto)   cto.value   = t.countTo !== undefined ? t.countTo : '';
    if (cunit) cunit.value = t.countUnit || '';
  }

  // Big mode UI
  const isRecurring = t.recurrence && t.recurrence !== 'none';
  const bigMode = isRecurring ? 'recurring' : schedMode;
  document.querySelectorAll('.schedule-mode-option').forEach(o => o.classList.toggle('active', o.dataset.mode === bigMode));
  const scheduleModeGroup = document.getElementById('scheduleModeGroup');
  const recSubOptions = document.getElementById('recSubOptions');
  const dateTimeGroup = document.getElementById('dateTimeGroup');

  // Set recurrence UI
  const recSel2 = document.getElementById('taskRecurrence');
  if (recSel2) recSel2.value = state.selectedRecurrence;
  const dateGroup = document.getElementById('dateGroup');
  const detail = document.getElementById('recDetail');

  if (schedMode === 'inbox' || schedMode === 'backlog') {
    // Inbox/Backlog: hide date/time/moment
    if (dateTimeGroup) dateTimeGroup.style.display = 'none';
    if (recSubOptions) recSubOptions.style.display = 'none';
  } else if (isRecurring) {
    // Recurring: show dateTimeGroup, show rec sub-options, hide dateGroup
    if (dateTimeGroup) dateTimeGroup.style.display = '';
    if (recSubOptions) {
      recSubOptions.style.display = '';
      document.querySelectorAll('.rec-sub-option').forEach(o =>
        o.classList.toggle('active', o.dataset.rec === state.selectedRecurrence)
      );
    }
    if (state.selectedRecurrence === 'daily') {
      dateGroup.style.display = 'none';
      detail.innerHTML = _dayPeriodHTML(effT.dayPeriod || '');
    } else if (state.selectedRecurrence === 'weekly') {
      dateGroup.style.display = 'none';
      detail.innerHTML = `<div class="day-checkboxes" id="weekDayBoxes">
        ${state.DAYS.map((d,i) => { const dow=(i+1)%7; return `<div class="day-checkbox${state.selectedWeekDays.includes(dow)?' selected':''}" data-day="${dow}"
          onclick="window.app.toggleWeekDay(${dow})">${d[0]}</div>`; }).join('')}
      </div>`;
    } else if (state.selectedRecurrence === 'monthly') {
      dateGroup.style.display = 'none';
      const days = t.recDays ? [...t.recDays] : (t.recDay ? [t.recDay] : [1]);
      state.setSelectedMonthDays(days);
      state.setSelectedMonthLastDay(t.recLastDay || false);
      detail.innerHTML = monthCalendarHTML(state.selectedMonthDays, state.selectedMonthLastDay);
    } else if (state.selectedRecurrence === 'yearly') {
      dateGroup.style.display = 'none';
      state.setSelectedYearMonth(t.recMonth !== undefined ? t.recMonth : state.navDate.getMonth());
      state.setSelectedYearDay(t.recDay !== undefined ? t.recDay : state.navDate.getDate());
      detail.innerHTML = yearCalendarHTML(state.selectedYearMonth, state.selectedYearDay);
    }
  } else {
    // Date mode: show dateTimeGroup, hide rec sub-options
    if (dateTimeGroup) dateTimeGroup.style.display = '';
    if (recSubOptions) recSubOptions.style.display = 'none';
    dateGroup.style.display = '';
    document.getElementById('taskDate').value = t.date || dateStr || '';
    _syncDateBtn();
    detail.innerHTML = _dayPeriodHTML(t.dayPeriod || '');
  }

  // Subtasks — peuplées AVANT _autoExpandCatSections() ci-dessous, dont
  // l'aperçu replié (« done/total ») lit _modalSubtasks au moment de l'appel.
  populateModalSubtasks(effT.subtasks || []);

  const modalBox = document.getElementById('modalOverlay').querySelector('.modal');
  // Sections thématiques : seules celles qui contiennent déjà une valeur
  // non par défaut s'ouvrent automatiquement — le contenu existant ne se
  // cache jamais derrière un clic, mais une tâche simple (juste une date)
  // reste compacte.
  _autoExpandCatSections();
  switchTagTab('categories');
  document.getElementById('modalOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  gsap.fromTo(modalBox,
    { scale: 0.94, y: 30, opacity: 0 },
    { scale: 1, y: 0, opacity: 1, duration: 0.45, ease: 'power2.out' }
  );
  _initCombobox(todos);
  _initModalSwipe();
  setTimeout(() => document.getElementById('taskTitle').focus(), 50);
}

export function selectRecurrence(rec) {
  state.setSelectedRecurrence(rec);
  const sel = document.getElementById('taskRecurrence');
  if (sel) sel.value = rec;
  // Highlight rec sub-option buttons with punch
  document.querySelectorAll('.rec-sub-option').forEach(o => {
    const isActive = o.dataset.rec === rec;
    o.classList.toggle('active', isActive);
    if (isActive) gsap.fromTo(o, { scale: 0.9 }, { scale: 1, duration: 0.25, ease: 'back.out(2)' });
  });
  _scheduleDraftSave();
  const dateGroup = document.getElementById('dateGroup');
  const detail = document.getElementById('recDetail');
  const scheduleModeGroup = document.getElementById('scheduleModeGroup');

  if (rec==='none') {
    dateGroup.style.display = '';
    detail.innerHTML = _dayPeriodHTML(document.getElementById('taskDayPeriod')?.value || '');
  } else if (rec==='daily') {
    dateGroup.style.display = 'none';
    detail.innerHTML = _dayPeriodHTML(document.getElementById('taskDayPeriod')?.value || '');
  } else if (rec==='weekly') {
    dateGroup.style.display = 'none';
    if (!state.selectedWeekDays.length) {
      state.setSelectedWeekDays([state.navDate.getDay()]);
    }
    detail.innerHTML = `<div class="day-checkboxes" id="weekDayBoxes">
      ${state.DAYS.map((d,i) => { const dow=(i+1)%7; return `<div class="day-checkbox${state.selectedWeekDays.includes(dow)?' selected':''}" data-day="${dow}"
        onclick="window.app.toggleWeekDay(${dow})">${d[0]}</div>`; }).join('')}
    </div>`;
  } else if (rec==='monthly') {
    dateGroup.style.display = 'none';
    state.setSelectedMonthDays([state.navDate.getDate()]);
    state.setSelectedMonthLastDay(false);
    detail.innerHTML = monthCalendarHTML(state.selectedMonthDays, state.selectedMonthLastDay);
  } else if (rec==='yearly') {
    dateGroup.style.display = 'none';
    state.setSelectedYearMonth(state.navDate.getMonth());
    state.setSelectedYearDay(state.navDate.getDate());
    detail.innerHTML = yearCalendarHTML(state.selectedYearMonth, state.selectedYearDay);
  }
}

function monthCalendarHTML(selectedDays, lastDay) {
  const y = state.navDate.getFullYear();
  const m = state.navDate.getMonth();
  const total = daysInMonth(y, m);
  const offset = firstDayOfMonth(y, m); // 0=Mon
  const headerLabels = state.DAYS.map(d => `<span>${d[0]}</span>`).join('');
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push('<div class="month-day-cell empty"></div>');
  for (let d = 1; d <= total; d++) {
    const sel = selectedDays.includes(d) ? ' selected' : '';
    cells.push(`<div class="month-day-cell${sel}" data-day="${d}" onclick="window.app.toggleMonthDay(${d})">${d}</div>`);
  }
  const lastSel = lastDay ? ' selected' : '';
  const lastAbbr = state.T.lastDayAbbr || 'fin';
  cells.push(`<div class="month-day-cell month-day-last${lastSel}" id="monthLastDayBtn" onclick="window.app.toggleMonthLastDay()" title="${state.T.lastDayOfMonth || 'Last day'}">${lastAbbr}</div>`);
  return `<div class="month-cal-wrap">
    <div class="month-cal-header">${headerLabels}</div>
    <div class="month-cal-grid" id="monthDayGrid">${cells.join('')}</div>
  </div>`;
}

function yearDayCells(selMonth, selDay) {
  const y = state.navDate.getFullYear();
  const total = daysInMonth(y, selMonth);
  const offset = firstDayOfMonth(y, selMonth); // 0=Mon
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push('<div class="month-day-cell empty"></div>');
  for (let d = 1; d <= total; d++) {
    const sel = d === selDay ? ' selected' : '';
    cells.push(`<div class="month-day-cell${sel}" data-day="${d}" onclick="window.app.selectYearDay(${d})">${d}</div>`);
  }
  return cells.join('');
}

function yearCalendarHTML(selMonth, selDay) {
  const monthCells = state.MONTHS.map((name, i) => {
    const sel = i === selMonth ? ' selected' : '';
    return `<div class="month-picker-cell${sel}" data-month="${i}" onclick="window.app.selectYearMonth(${i})">${name.slice(0,3)}</div>`;
  }).join('');
  const headerLabels = state.DAYS.map(d => `<span>${d[0]}</span>`).join('');
  return `<div class="year-cal-wrap">
    <div class="month-picker-grid" id="yearMonthGrid">${monthCells}</div>
    <div class="month-cal-header" style="margin-top:10px;">${headerLabels}</div>
    <div class="month-cal-grid" id="yearDayGrid">${yearDayCells(selMonth, selDay)}</div>
  </div>`;
}

export function selectYearMonth(m) {
  const y = state.navDate.getFullYear();
  const maxDay = daysInMonth(y, m);
  state.setSelectedYearMonth(m);
  if (state.selectedYearDay > maxDay) state.setSelectedYearDay(maxDay);
  document.querySelectorAll('#yearMonthGrid .month-picker-cell').forEach(el => {
    el.classList.toggle('selected', +el.dataset.month === m);
  });
  const gridEl = document.getElementById('yearDayGrid');
  if (gridEl) gridEl.innerHTML = yearDayCells(m, state.selectedYearDay);
}

export function selectYearDay(d) {
  state.setSelectedYearDay(d);
  document.querySelectorAll('#yearDayGrid .month-day-cell[data-day]').forEach(el => {
    el.classList.toggle('selected', +el.dataset.day === d);
  });
}

export function toggleMonthDay(d) {
  if (state.selectedMonthDays.includes(d)) {
    state.setSelectedMonthDays(state.selectedMonthDays.filter(x => x !== d));
  } else {
    state.setSelectedMonthDays([...state.selectedMonthDays, d]);
  }
  document.querySelectorAll('#monthDayGrid .month-day-cell[data-day]').forEach(el => {
    el.classList.toggle('selected', state.selectedMonthDays.includes(+el.dataset.day));
  });
}

export function toggleMonthLastDay() {
  state.setSelectedMonthLastDay(!state.selectedMonthLastDay);
  const btn = document.getElementById('monthLastDayBtn');
  if (btn) btn.classList.toggle('selected', state.selectedMonthLastDay);
}

export function toggleWeekDay(i) {
  if (state.selectedWeekDays.includes(i)) {
    state.setSelectedWeekDays(state.selectedWeekDays.filter(x=>x!==i));
  } else {
    state.selectedWeekDays.push(i);
    state.setSelectedWeekDays([...state.selectedWeekDays]);
  }
  document.querySelectorAll('#weekDayBoxes .day-checkbox').forEach(el => {
    el.classList.toggle('selected', state.selectedWeekDays.includes(+el.dataset.day));
  });
  _scheduleDraftSave();
}

// ─── Collapsible cloud sections ───────────────────────────────────────────

export function toggleCloudSection(headerEl) {
  const section = headerEl.closest('.clouds-section');
  if (!section) return;
  const body = section.querySelector('.clouds-section-body');
  if (!body) return;
  const isOpen = section.classList.contains('open');
  if (isOpen) {
    section.classList.remove('open');
    gsap.to(body, { height: 0, duration: 0.22, ease: 'power2.inOut', overwrite: 'auto' });
  } else {
    section.classList.add('open');
    gsap.to(body, { height: 'auto', duration: 0.28, ease: 'power2.out', overwrite: 'auto' });
  }
}

export function toggleDetailSection(headerEl) {
  const section = headerEl.closest('.modal-detail-section');
  if (!section) return;
  const body = section.querySelector('.modal-detail-body');
  if (!body) return;
  const isOpen = section.classList.contains('open');
  if (isOpen) {
    section.classList.remove('open');
    gsap.to(body, { height: 0, duration: 0.22, ease: 'power2.inOut', overwrite: 'auto' });
  } else {
    section.classList.add('open');
    gsap.to(body, { height: 'auto', duration: 0.28, ease: 'power2.out', overwrite: 'auto' });
  }
}

// ─── Right column (removed) ───────────────────────────────────────────────

export function toggleModalRight() { /* panel removed */ }

// ─── Swipe gesture ────────────────────────────────────────────────────────

function _initModalSwipe() {
  const modal = document.getElementById('modalOverlay').querySelector('.modal');
  if (!modal || modal._swipeInit) return;
  modal._swipeInit = true;

  let sx = 0, active = false;
  const THRESHOLD = 55;

  modal.addEventListener('pointerdown', e => {
    if (e.target.closest('input, select, button, .rec-option, .chip, .day-checkbox, .month-day-cell, .month-picker-cell')) return;
    sx = e.clientX;
    active = true;
  }, { passive: true });

  modal.addEventListener('pointerup', () => { active = false; }, { passive: true });
}

function _showRecError(msg) {
  const recDetail = document.getElementById('recDetail');
  if (!recDetail) return;
  let el = recDetail.parentElement.querySelector('.rec-error');
  if (!el) {
    el = document.createElement('div');
    el.className = 'rec-error';
    el.style.cssText = 'color:#ef4444;font-size:0.8rem;margin-top:4px;';
    recDetail.after(el);
  }
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

export function saveTaskLogic(todos) {
  const title = document.getElementById('taskTitle').value.trim();
  if (!title) {
    document.getElementById('taskTitle').focus();
    return true; // error
  }

  const categoryIds       = _selectedCategoryIds.length ? [..._selectedCategoryIds] : undefined;
  const projectIds        = _selectedProjectIds.length ? [..._selectedProjectIds] : undefined;
  const intentionIds      = _selectedIntentionIds.length ? [..._selectedIntentionIds] : undefined;
  const priority          = state.selectedPriority || undefined;
  const description       = document.getElementById('taskDescription').value.trim() || undefined;
  const startTime         = document.getElementById('taskStartTime')?.value || undefined;
  const endTime           = document.getElementById('taskEndTime')?.value || undefined;
  const flexibleTime      = document.getElementById('taskFlexibleTime')?.checked || undefined;
  const durationEstimated = document.getElementById('taskDurationEstimated')?.value ? parseInt(document.getElementById('taskDurationEstimated').value) : undefined;
  const durationReal      = document.getElementById('taskDurationReal')?.value ? parseInt(document.getElementById('taskDurationReal').value) : undefined;

  const counterEnabled = document.getElementById('taskCounterEnabled')?.checked || false;
  const countFrom = counterEnabled ? (parseInt(document.getElementById('taskCountFrom')?.value) || 0) : undefined;
  const countTo   = counterEnabled && document.getElementById('taskCountTo')?.value ? parseInt(document.getElementById('taskCountTo').value) : undefined;
  const countUnit = counterEnabled ? (document.getElementById('taskCountUnit')?.value.trim() || undefined) : undefined;

  const dayPeriod = (state.selectedRecurrence === 'daily' || state.selectedRecurrence === 'none')
    ? (document.getElementById('taskDayPeriod')?.value || undefined)
    : undefined;

  const subtasks = _modalSubtasks.length ? getModalSubtasks() : undefined;

  const data = {
    title,
    recurrence: state.selectedRecurrence,
    categoryIds,
    projectIds,
    intentionIds,
    priority,
    description,
    startTime,
    endTime,
    flexibleTime: flexibleTime || undefined,
    durationEstimated,
    durationReal,
    dayPeriod: dayPeriod || undefined,
    counterEnabled: counterEnabled || undefined,
    countFrom,
    countTo,
    countUnit,
    subtasks,
  };

  if (state.selectedRecurrence==='none') {
    if (state.scheduleMode === 'backlog') {
      data.date = null;
      data.backlog = true;
    } else if (state.scheduleMode === 'inbox') {
      data.date = null;
    } else {
      data.date = document.getElementById('taskDate').value || DS(state.navDate);
    }
  } else {
    // For all recurring types, capture the navDate as the intended start date
    data.date = document.getElementById('taskDate').value || DS(state.navDate);
  }

  if (state.selectedRecurrence==='weekly') {
    if (state.selectedWeekDays.length===0) { _showRecError(state.T.selectWeekdayError); return true; }
    data.recDays = [...state.selectedWeekDays];
  } else if (state.selectedRecurrence==='monthly') {
    if (!state.selectedMonthLastDay && state.selectedMonthDays.length === 0) {
      _showRecError(state.T.selectMonthDayError || 'Please select at least one day.');
      return true;
    }
    data.recDays = [...state.selectedMonthDays];
    if (state.selectedMonthLastDay) data.recLastDay = true;
  } else if (state.selectedRecurrence==='yearly') {
    data.recMonth = state.selectedYearMonth;
    data.recDay   = state.selectedYearDay;
  }

  if (state.editingId) {
    const t = todos.find(x => x.id === state.editingId);
    if (t) {
      // Tâche récurrente + occurrence connue (dateStr passé à openEditModal)
      // ⇒ tous les champs de CONTENU ci-dessous n'écrivent que dans
      // l'override de cette date, jamais sur le master : les autres
      // occurrences (passées/futures) ne voient jamais ce changement.
      const perOccurrence = data.recurrence !== 'none' && !!state.editingDate;

      // ── Champs qui définissent la récurrence elle-même, plus le
      // compteur (cumulatif sur toute la série) et durationReal (déjà un
      // système d'historique séparé, cf. durationHistory/focus.js) :
      // toujours sur le master, jamais par occurrence.
      t.recurrence = data.recurrence;
      delete t.date; delete t.recDays; delete t.recDay; delete t.recMonth; delete t.recLastDay;
      delete t.backlog; delete t.durationReal;
      if (data.date !== undefined) t.date = data.date;
      if (data.recDays !== undefined) t.recDays = data.recDays;
      if (data.recDay !== undefined) t.recDay = data.recDay;
      if (data.recMonth !== undefined) t.recMonth = data.recMonth;
      if (data.recLastDay !== undefined) t.recLastDay = data.recLastDay;
      if (data.recurrence !== 'none' && !t.startDate) t.startDate = DS(today());
      if (data.backlog) t.backlog = true;
      if (data.durationReal) t.durationReal = data.durationReal;
      // Counter: update config but preserve countCurrent
      delete t.counterEnabled; delete t.countFrom; delete t.countTo; delete t.countUnit;
      if (data.counterEnabled) {
        t.counterEnabled = true;
        t.countFrom = data.countFrom ?? 0;
        t.countTo   = data.countTo;
        t.countUnit = data.countUnit;
        if (t.countCurrent === undefined) t.countCurrent = t.countFrom;
      } else {
        delete t.countCurrent;
      }

      // ── Champs de « contenu » : sur le master pour une tâche non
      // récurrente (comportement inchangé), sinon UNIQUEMENT dans l'override
      // — valeurs toujours explicites (null/[] plutôt qu'undefined :
      // undefined ne survit pas à un aller-retour JSON, ce qui ferait
      // réapparaître la valeur du master après un rechargement).
      if (perOccurrence) {
        const ov = occurrenceOverride(t, state.editingDate);
        ov.title             = data.title;
        ov.description       = data.description ?? null;
        ov.startTime         = data.startTime ?? null;
        ov.endTime           = data.endTime ?? null;
        ov.flexibleTime      = data.flexibleTime ?? false;
        ov.durationEstimated = data.durationEstimated ?? null;
        ov.dayPeriod         = data.dayPeriod ?? null;
        ov.categoryIds       = data.categoryIds || [];
        ov.projectIds        = data.projectIds || [];
        ov.intentionIds      = data.intentionIds || [];
        ov.priority          = data.priority ?? null;
        ov.subtasks          = getModalSubtasks();
      } else {
        t.title = data.title;
        delete t.startTime; delete t.endTime; delete t.flexibleTime;
        delete t.durationEstimated; delete t.dayPeriod;
        if (data.startTime) t.startTime = data.startTime;
        if (data.endTime) t.endTime = data.endTime;
        if (data.flexibleTime) t.flexibleTime = data.flexibleTime;
        if (data.durationEstimated) t.durationEstimated = data.durationEstimated;
        if (data.dayPeriod) t.dayPeriod = data.dayPeriod;
        t.categoryIds    = data.categoryIds;
        t.projectIds     = data.projectIds;
        t.intentionIds   = data.intentionIds;
        delete t.categoryId; delete t.projectId; delete t.intentionId;
        t.priority    = data.priority;
        t.description = data.description;
        t.subtasks    = getModalSubtasks();
      }
      t.updatedAt = Date.now();
    }
  } else {
    addTask(data, todos);
  }
  clearDraft();
  return false; // no error
}

const _chevronSVG = `<svg class="clouds-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

function _cloudSection(label, chipsHTML, withEdit = false, openByDefault = false) {
  const editBtn = withEdit
    ? `<button class="clouds-edit-btn" onclick="event.stopPropagation();window.app.openAdminModal()">éditer</button>`
    : '';
  const openClass = openByDefault ? ' open' : '';
  const bodyStyle = openByDefault ? 'height:auto' : 'height:0';
  return `<div class="clouds-section${openClass}">
    <div class="clouds-section-header" onclick="window.app.toggleCloudSection(this)">
      <span class="cloud-label">${label}</span>
      ${editBtn}
      ${_chevronSVG}
    </div>
    <div class="clouds-section-body" style="${bodyStyle};overflow:hidden">
      <div class="cloud-chips">${chipsHTML}</div>
    </div>
  </div>`;
}

// ─── Quick access (3 frequent + 3 recent) in modal-right ─────────────────

function _quickAccessHTML(todos) {
  const suggestedItems = (() => {
    const cfg = getSuggestedTasks();
    return [...cfg.daily, ...cfg.weekly, ...cfg.monthly];
  })();

  const frequent = getSuggestions(todos)
    .filter(s => !suggestedItems.includes(s))
    .slice(0, 3);
  const recent = getRecentTasks(todos)
    .filter(s => !suggestedItems.includes(s) && !frequent.includes(s))
    .slice(0, 3);

  state.setSuggestions([...frequent, ...recent]);
  if (frequent.length === 0 && recent.length === 0) return '';

  const chip = (title, type, idx) =>
    `<div class="chip qa-chip" data-qa-type="${type}" data-qa-index="${idx}" data-qa-title="${esc(title)}">${esc(title)}</div>`;

  let chips = '';
  if (frequent.length > 0)
    chips += `<span class="qa-sub-label">${esc(state.T.frequentlyUsed)}</span>` +
      frequent.map((t, i) => chip(t, 'frequent', i)).join('');
  if (recent.length > 0)
    chips += `<span class="qa-sub-label">${esc(state.T.recentlyAdded)}</span>` +
      recent.map((t, i) => chip(t, 'recent', i)).join('');

  return _cloudSection(state.T.quickAccess, chips, false, true);
}

export function cloudsHTML(date, todos) {
  const suggestedTasksConfig = getSuggestedTasks();

  let html = _quickAccessHTML(todos);
  html += _cloudSection(state.T.recurringDaily,   suggestedTasksConfig.daily.map(t=>`<div class="chip" data-chip-type="daily" data-chip-title="${esc(t)}">${esc(t)}</div>`).join(''), true);
  html += _cloudSection(state.T.recurringWeekly,  suggestedTasksConfig.weekly.map(t=>`<div class="chip" data-chip-type="weekly" data-chip-title="${esc(t)}">${esc(t)}</div>`).join(''), true);
  html += _cloudSection(state.T.recurringMonthly, suggestedTasksConfig.monthly.map(t=>`<div class="chip" data-chip-type="monthly" data-chip-title="${esc(t)}">${esc(t)}</div>`).join(''), true);

  // Setup event listeners after HTML is inserted
  setTimeout(() => {
    // Recurring chip → open modal with title
    document.querySelectorAll('[data-chip-type]').forEach(chip => {
      chip.style.cursor = 'pointer';
      chip.addEventListener('click', () => {
        const title = chip.dataset.chipTitle;
        if (title) window.app.openModalWithTitle(title);
      });
    });
    // Quick access chip → fill title input
    document.querySelectorAll('.qa-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const title = chip.dataset.qaTitle;
        if (title) {
          document.getElementById('taskTitle').value = title;
          document.getElementById('taskTitle').focus();
        }
      });
    });
  }, 0);

  return html;
}

export function openDataModal() {
  document.getElementById('dataModalOverlay').classList.remove('hidden');
}

export function closeDataModal() {
  document.getElementById('dataModalOverlay').classList.add('hidden');
}

export function openDeleteModal(id, dateStr, todos) {
  const t = todos.find(x => x.id === id);
  if (!t) return;
  state.setPendingDelete({ id, date: parseDS(dateStr) });
  // Translate all texts
  const T = state.T;
  document.getElementById('deleteModalTitle').textContent   = T.deleteRecurringTitle;
  document.getElementById('deleteModalPrompt').textContent  = T.deleteRecurringPrompt;
  document.getElementById('deleteTaskName').textContent     = t.title;
  document.getElementById('deleteOneTitle').textContent    = T.deleteOneOccurrence;
  document.getElementById('deleteOneDesc').textContent     = T.deleteOneDesc;
  document.getElementById('deleteFutureTitle').textContent = T.deleteFutureOccurrences;
  document.getElementById('deleteFutureDesc').textContent  = T.deleteFutureDesc;
  document.getElementById('deleteAllTitle').textContent    = T.deleteAllOccurrences;
  document.getElementById('deleteAllDesc').textContent     = T.deleteAllDesc;
  document.getElementById('deleteModalOverlay').classList.remove('hidden');
  const deleteModalBox = document.getElementById('deleteModalOverlay').querySelector('.modal');
  gsap.fromTo(deleteModalBox,
    { scale: 0.92, y: 24, opacity: 0 },
    { scale: 1, y: 0, opacity: 1, duration: 0.3, ease: 'back.out(1.4)' }
  );
  // Enter key → delete all occurrences
  const onKey = e => {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('deleteAllBtn').click(); }
    if (e.key === 'Escape') { e.preventDefault(); document.getElementById('cancelDeleteModal').click(); }
  };
  document.addEventListener('keydown', onKey);
  deleteModalBox._deleteKeyHandler = onKey;
}

export function _removeDeleteKeyHandler() {
  const deleteModalBox = document.getElementById('deleteModalOverlay')?.querySelector('.modal');
  if (deleteModalBox?._deleteKeyHandler) {
    document.removeEventListener('keydown', deleteModalBox._deleteKeyHandler);
    deleteModalBox._deleteKeyHandler = null;
  }
}

export function closeDeleteModal() {
  _removeDeleteKeyHandler();
  const deleteModalBox = document.getElementById('deleteModalOverlay').querySelector('.modal');
  const overlay = document.getElementById('deleteModalOverlay');
  gsap.to(deleteModalBox, {
    scale: 0.92, y: 16, opacity: 0, duration: 0.2, ease: 'power2.in',
    onComplete: () => overlay.classList.add('hidden')
  });
  state.setPendingDelete(null);
}


// ─── Combobox (title autocomplete) ───────────────────────────────────────

let _comboboxPool = [];
let _comboboxActiveIdx = -1;
let _comboboxHandlers = null;

function _buildPool(todos) {
  const cfg = getSuggestedTasks();
  const recurring = [...cfg.daily, ...cfg.weekly, ...cfg.monthly];
  const frequent  = getSuggestions(todos);
  // Deduplicate: frequent first (ordered by usage), then recurring
  const seen = new Set(frequent);
  const extra = recurring.filter(t => !seen.has(t));
  return [...frequent, ...extra];
}

function _renderCombobox(matches, query) {
  const box = document.getElementById('titleCombobox');
  if (!box) return;
  if (!matches.length) { box.classList.add('hidden'); return; }
  _comboboxActiveIdx = -1;
  box.innerHTML = matches.map((title, i) => {
    const lo = title.toLowerCase();
    const qi = lo.indexOf(query.toLowerCase());
    let label = esc(title);
    if (qi !== -1) {
      const pre  = esc(title.slice(0, qi));
      const bold = esc(title.slice(qi, qi + query.length));
      const post = esc(title.slice(qi + query.length));
      label = `${pre}<strong>${bold}</strong>${post}`;
    }
    return `<div class="title-combobox-item" data-idx="${i}" role="option">${label}</div>`;
  }).join('');
  box.classList.remove('hidden');
}

function _comboboxSelect(title) {
  const input = document.getElementById('taskTitle');
  if (input) { input.value = title; input.dispatchEvent(new Event('input')); }
  const box = document.getElementById('titleCombobox');
  if (box) box.classList.add('hidden');
}

function _initCombobox(todos) {
  _destroyCombobox();
  _comboboxPool = _buildPool(todos);
  const input = document.getElementById('taskTitle');
  const box   = document.getElementById('titleCombobox');
  if (!input || !box) return;

  const onInput = () => {
    const q = input.value.trim();
    if (!q) { box.classList.add('hidden'); return; }
    const lo = q.toLowerCase();
    const prefix = _comboboxPool.filter(t => t.toLowerCase().startsWith(lo));
    const sub    = _comboboxPool.filter(t => !t.toLowerCase().startsWith(lo) && t.toLowerCase().includes(lo));
    _renderCombobox([...prefix, ...sub].slice(0, 6), q);
  };

  const onKeydown = e => {
    if (box.classList.contains('hidden')) return;
    const items = box.querySelectorAll('.title-combobox-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      _comboboxActiveIdx = Math.min(_comboboxActiveIdx + 1, items.length - 1);
      items.forEach((el, i) => el.classList.toggle('active', i === _comboboxActiveIdx));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      _comboboxActiveIdx = Math.max(_comboboxActiveIdx - 1, 0);
      items.forEach((el, i) => el.classList.toggle('active', i === _comboboxActiveIdx));
    } else if (e.key === 'Enter' && _comboboxActiveIdx >= 0) {
      e.preventDefault();
      _comboboxSelect(items[_comboboxActiveIdx].textContent);
    } else if (e.key === 'Enter' && box.classList.contains('hidden')) {
      e.preventDefault();
      document.getElementById('saveTask')?.click();
    } else if (e.key === 'Escape') {
      box.classList.add('hidden');
    }
  };

  const onBlur = () => setTimeout(() => box.classList.add('hidden'), 150);

  const onClick = e => {
    const item = e.target.closest('.title-combobox-item');
    if (item) _comboboxSelect(_comboboxPool[+item.dataset.idx]);
  };

  input.addEventListener('input',   onInput);
  input.addEventListener('keydown', onKeydown);
  input.addEventListener('blur',    onBlur);
  box.addEventListener('mousedown', onClick);

  _comboboxHandlers = { input, box, onInput, onKeydown, onBlur, onClick };
}

function _destroyCombobox() {
  if (!_comboboxHandlers) return;
  const { input, box, onInput, onKeydown, onBlur, onClick } = _comboboxHandlers;
  input?.removeEventListener('input',   onInput);
  input?.removeEventListener('keydown', onKeydown);
  input?.removeEventListener('blur',    onBlur);
  box?.removeEventListener('mousedown', onClick);
  if (box) box.classList.add('hidden');
  _comboboxHandlers = null;
}

