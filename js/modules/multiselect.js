// ════════════════════════════════════════════════════════
//  MULTI-SELECTION — rectangle à la souris (lasso), Ctrl/Cmd+clic,
//  Maj+clic (plage), Échap. Sélection multiple d'items dans toutes
//  les vues, pour agir (drag-and-drop notamment) sur plusieurs
//  tâches à la fois.
// ════════════════════════════════════════════════════════

import * as state from './state.js';

// Tout élément représentant une tâche, dans toutes les vues
export const MS_SELECTABLE = [
  '.todo-item[data-id]',
  '.inbox-item[data-id]',
  '.week-todo-item[data-id]',
  '.plan-week-task[data-id]',
  '.month-todo-dot[data-id]',
].join(', ');

const selected = new Set();
let anchorId = null;   // dernier item cliqué — point de départ du Maj+clic
let lastView = null;   // la sélection est annulée quand on change de vue

export function msIds()    { return [...selected]; }
export function msCount()  { return selected.size; }
export function msHas(id)  { return selected.has(id); }

export function msClear() {
  if (!selected.size) { anchorId = null; return; }
  selected.clear();
  anchorId = null;
  msRefreshUI();
}

export function msToggle(id) {
  if (selected.has(id)) {
    selected.delete(id);
  } else {
    selected.add(id);
    anchorId = id;
  }
  msRefreshUI();
}

// Maj+clic : sélectionne la plage entre l'ancre et l'item cliqué (ordre DOM)
function msRangeTo(id) {
  const els = [...document.querySelectorAll(MS_SELECTABLE)];
  const ids = els.map(el => el.dataset.id);
  const from = ids.indexOf(anchorId);
  const to   = ids.indexOf(id);
  if (from < 0 || to < 0) { msToggle(id); return; }
  const [a, b] = from < to ? [from, to] : [to, from];
  for (let i = a; i <= b; i++) selected.add(ids[i]);
  anchorId = id;
  msRefreshUI();
}

// Ré-applique les classes + met à jour la barre de comptage.
// Appelée après chaque render() (le DOM est régénéré intégralement).
export function msRefreshUI() {
  // La sélection ne survit pas à un changement de vue
  if (state.view !== lastView) {
    lastView = state.view;
    if (selected.size) { selected.clear(); anchorId = null; }
  }
  // Purge les ids de tâches supprimées
  for (const id of [...selected]) {
    if (!state.todos.some(t => t.id === id)) selected.delete(id);
  }
  document.querySelectorAll(MS_SELECTABLE).forEach(el => {
    el.classList.toggle('multi-selected', selected.has(el.dataset.id));
  });
  _updateBar();
}

// ── Barre flottante de comptage ──────────────────────────
let barEl = null;

function _ensureBar() {
  if (barEl) return barEl;
  barEl = document.createElement('div');
  barEl.className = 'multi-select-bar';
  barEl.id = 'multiSelectBar';
  barEl.innerHTML = `
    <span class="multi-select-count" id="multiSelectCount">0</span>
    <span class="multi-select-label" id="multiSelectLabel"></span>
    <span class="multi-select-hint">Glissez la sélection · Maj+clic : plage</span>
    <button class="multi-select-clear" title="Tout désélectionner (Échap)">✕</button>`;
  barEl.querySelector('.multi-select-clear').addEventListener('click', () => msClear());
  document.body.appendChild(barEl);
  return barEl;
}

function _updateBar() {
  const n = selected.size;
  const bar = _ensureBar();
  bar.classList.toggle('visible', n > 0);
  if (n > 0) {
    bar.querySelector('#multiSelectCount').textContent = n;
    bar.querySelector('#multiSelectLabel').textContent =
      n === 1 ? 'tâche sélectionnée' : 'tâches sélectionnées';
  }
}

// ── Branchement global ───────────────────────────────────
export function initMultiSelect(app) {
  lastView = state.view;

  // Phase capture : avale le clic résiduel d'un lasso, puis gère les
  // clics avec modificateur en court-circuitant les onclick inline
  // (ouverture du modal d'édition, navigation, etc.)
  document.addEventListener('click', e => {
    if (_suppressClick) {
      _suppressClick = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (!(e.ctrlKey || e.metaKey || e.shiftKey)) return;
    if (e.target.closest('input, textarea, [contenteditable="true"]')) return;
    const el = e.target.closest(MS_SELECTABLE);
    if (!el || !el.dataset.id) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.shiftKey && anchorId) msRangeTo(el.dataset.id);
    else msToggle(el.dataset.id);
  }, true);

  // Échap : désélectionne tout (sauf si un modal est ouvert — il a priorité)
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !selected.size) return;
    if (document.querySelector('.modal-overlay:not(.hidden)')) return;
    msClear();
  });

  // Drag : si l'item saisi fait partie de la sélection, toute la
  // sélection est emportée (lue par les drop handlers via _dropIds)
  document.addEventListener('dragstart', e => {
    const el = e.target.closest?.(MS_SELECTABLE);
    if (el && selected.size > 1 && selected.has(el.dataset.id)) {
      app._dragMultiIds = msIds();
      document.querySelectorAll(MS_SELECTABLE).forEach(item => {
        if (selected.has(item.dataset.id)) item.classList.add('multi-dragging');
      });
    } else {
      app._dragMultiIds = null;
    }
  }, true);

  document.addEventListener('dragend', () => {
    app._dragMultiIds = null;
    document.querySelectorAll('.multi-dragging').forEach(el => el.classList.remove('multi-dragging'));
  });

  _initMarquee();
}

// ── Sélection au rectangle (lasso) ───────────────────────
// mousedown sur une zone vide de #mainContent → on trace un rectangle;
// tout item qui l'intersecte est sélectionné en direct. Ctrl/Cmd/Maj
// enfoncé au départ = mode additif (la sélection existante est gardée).
// Un simple clic sur du vide (sans mouvement) désélectionne tout.
const MARQUEE_THRESHOLD = 5; // px avant d'activer le lasso (préserve les clics)

// Zones où le lasso ne doit jamais démarrer : tout élément interactif ou
// draggable (le drag natif des items a priorité)
const MARQUEE_EXCLUDE = [
  '[draggable="true"]',
  'button, input, textarea, select, a, [contenteditable="true"]',
  '.modal-overlay', '.plan-resize-handle', '.multi-select-bar',
  '.day-mini-week',
].join(', ');

let _suppressClick = false;

function _initMarquee() {
  let armed = false, started = false, additive = false;
  let startX = 0, startY = 0;
  let baseSel = null;   // sélection au départ (gardée en mode additif)
  let rectEl = null;

  const _endMarquee = () => {
    started = false;
    armed = false;
    if (rectEl) { rectEl.remove(); rectEl = null; }
    document.body.classList.remove('marquee-active');
  };

  document.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const main = document.getElementById('mainContent');
    if (!main || !main.contains(e.target)) return;
    if (e.target.closest(MARQUEE_EXCLUDE)) return;
    // Clic sur la scrollbar d'un conteneur défilable → pas de lasso
    const t = e.target;
    if (t.clientWidth && (e.offsetX > t.clientWidth || e.offsetY > t.clientHeight)) return;
    armed = true;
    started = false;
    startX = e.clientX;
    startY = e.clientY;
    additive = e.ctrlKey || e.metaKey || e.shiftKey;
    baseSel = new Set(additive ? selected : []);
  });

  document.addEventListener('mousemove', e => {
    if (!armed) return;
    if (!started) {
      if (Math.hypot(e.clientX - startX, e.clientY - startY) < MARQUEE_THRESHOLD) return;
      started = true;
      rectEl = document.createElement('div');
      rectEl.className = 'marquee-rect';
      document.body.appendChild(rectEl);
      document.body.classList.add('marquee-active');
      window.getSelection()?.removeAllRanges();
    }
    e.preventDefault();
    const x = Math.min(startX, e.clientX);
    const y = Math.min(startY, e.clientY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);
    rectEl.style.left   = x + 'px';
    rectEl.style.top    = y + 'px';
    rectEl.style.width  = w + 'px';
    rectEl.style.height = h + 'px';

    // Sélection en direct : base (mode additif) + items intersectés
    selected.clear();
    baseSel.forEach(id => selected.add(id));
    document.querySelectorAll(MS_SELECTABLE).forEach(el => {
      const b = el.getBoundingClientRect();
      if (b.left < x + w && b.right > x && b.top < y + h && b.bottom > y) {
        selected.add(el.dataset.id);
        anchorId = el.dataset.id;
      }
    });
    msRefreshUI();
  });

  document.addEventListener('mouseup', e => {
    if (!armed) return;
    const wasStarted = started;
    _endMarquee();
    if (wasStarted) {
      // Le clic qui suit ne doit pas ouvrir/naviguer (avalé par le
      // handler capture ci-dessus). Le clic est synchrone après mouseup :
      // si aucun ne vient, on réarme au tick suivant.
      _suppressClick = true;
      setTimeout(() => { _suppressClick = false; }, 0);
    } else if (!additive && selected.size) {
      msClear();            // simple clic sur du vide → tout désélectionner
    }
  });

  // Échap pendant le lasso : on l'annule et on restaure la sélection de départ
  // (stopPropagation : le handler Échap général ne doit pas vider la sélection)
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !started) return;
    e.stopPropagation();
    selected.clear();
    baseSel?.forEach(id => selected.add(id));
    _endMarquee();
    msRefreshUI();
  }, true);
}
