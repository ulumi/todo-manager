// ════════════════════════════════════════════════════════
//  AVATAR EDITOR — emoji, photo upload, filters, cartoon
// ════════════════════════════════════════════════════════

import { esc } from './utils.js';

const AVATAR_KEY = 'profileAvatar';
const SIZE = 240; // compressed canvas size

export const FILTERS = [
  { id: 'natural', label: 'Naturel',  css: '',                            canvas: false },
  { id: 'bw',      label: 'N&B',      css: 'grayscale(1)',                canvas: false },
  { id: 'sepia',   label: 'Sépia',    css: 'sepia(1)',                    canvas: false },
  { id: 'vivid',   label: 'Vivid',    css: 'saturate(2) contrast(1.1)',   canvas: false },
  { id: 'cool',    label: 'Cool',     css: 'hue-rotate(200deg) saturate(1.3)', canvas: false },
  { id: 'vintage', label: 'Vintage',  css: 'sepia(.4) saturate(.9) brightness(1.05)', canvas: false },
  { id: 'cartoon', label: 'Cartoon',  css: 'contrast(1.5) saturate(1.8)', canvas: true  },
];

const EMOJIS = ['🦊','🐨','🐸','🦁','🐯','🐻','🐼','🐧','🦉','🦋','🌟','⚡','🎯','🚀','🌈','🍀','🔥','💎','🎮','🎵','🏔️','🌊','🦄','🎨'];

// ── Module state ──────────────────────────────────────
let _photo  = null; // base64 of uploaded photo
let _filter = 'natural';
let _emoji  = null;
let _mode   = 'emoji'; // 'emoji' | 'photo'

// ── Zoom overlay ──────────────────────────────────────
function _showZoom(html) {
  if (!html || html.includes('avatar-preview-placeholder')) return;
  const overlay = document.createElement('div');
  overlay.className = 'avatar-zoom-overlay';
  overlay.innerHTML = `<div class="avatar-zoom-content">${html}</div>`;
  overlay.addEventListener('click', () => {
    overlay.classList.remove('visible');
    setTimeout(() => overlay.remove(), 280);
  });
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('visible'));
}

export function zoomPreview() { _showZoom(_getPreviewHTML()); }
export function zoomSavedAvatar(initials) { _showZoom(getAvatarHTML(initials)); }

// ── Public ────────────────────────────────────────────

export function openAvatarEditor() {
  const saved = _loadAvatar();
  if (saved?.type === 'emoji')  { _emoji = saved.value; _mode = 'emoji'; _photo = null; }
  else if (saved?.type === 'photo') { _photo = saved.data; _filter = saved.filter || 'natural'; _mode = 'photo'; _emoji = null; }
  else { _emoji = null; _photo = null; _filter = 'natural'; _mode = 'emoji'; }

  _renderEditor();
  document.getElementById('avatarEditorOverlay').classList.remove('hidden');
}

export function closeAvatarEditor() {
  document.getElementById('avatarEditorOverlay').classList.add('hidden');
}

// Returns inner HTML for the avatar circle in profile view
export function getAvatarHTML(initials) {
  const saved = _loadAvatar();
  if (!saved) return esc(initials);
  if (saved.type === 'emoji') return `<span class="profile-avatar-emoji">${esc(saved.value)}</span>`;
  if (saved.type === 'photo') {
    const f = FILTERS.find(f => f.id === saved.filter);
    const style = (f?.css && !f.canvas) ? ` style="filter:${f.css}"` : '';
    return `<img src="${saved.data}" class="profile-avatar-img"${style}>`;
  }
  return esc(initials);
}

export async function handleAvatarFile(input) {
  const file = input.files[0];
  if (!file) return;
  _photo  = await _compressImage(file, SIZE);
  _mode   = 'photo';
  _filter = 'natural';
  _renderEditor();
  avatarSwitchTab('photo');
}

export function selectAvatarFilter(id) {
  _filter = id;
  _updatePreview();
  document.querySelectorAll('.filter-option').forEach(b =>
    b.classList.toggle('active', b.dataset.filter === id));
}

export function selectAvatarEmoji(emoji) {
  _emoji = emoji || null;
  _updatePreview();
  document.querySelectorAll('.avatar-emoji-opt').forEach(b =>
    b.classList.toggle('active', b.dataset.emoji === (emoji || '')));
}

export function avatarSwitchTab(tab) {
  _mode = tab;
  document.getElementById('avatarPanelEmoji')?.classList.toggle('hidden', tab !== 'emoji');
  document.getElementById('avatarPanelPhoto')?.classList.toggle('hidden', tab !== 'photo');
  document.querySelectorAll('.avatar-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab));
  _updatePreview();
}

export async function saveAvatar() {
  if (_mode === 'emoji') {
    if (_emoji) _saveAvatar({ type: 'emoji', value: _emoji });
    else        localStorage.removeItem(AVATAR_KEY);
  } else if (_mode === 'photo' && _photo) {
    const f = FILTERS.find(f => f.id === _filter);
    if (f?.canvas) {
      const processed = await _applyCartoonToBase64(_photo);
      _saveAvatar({ type: 'photo', data: processed, filter: 'natural' });
    } else {
      _saveAvatar({ type: 'photo', data: _photo, filter: _filter });
    }
  }
  closeAvatarEditor();
  window.app.render();
}

// ── Private: render editor ────────────────────────────

function _renderEditor() {
  const content = document.getElementById('avatarEditorContent');
  if (!content) return;

  const filterGrid = _photo ? `
    <div class="avatar-filter-grid">
      ${FILTERS.map(f => `
        <button class="filter-option ${_filter === f.id ? 'active' : ''}" data-filter="${f.id}"
          onclick="window.app.selectAvatarFilter('${f.id}')">
          <div class="filter-thumb-wrap">
            <img src="${_photo}" class="filter-thumb" ${f.css ? `style="filter:${f.css}"` : ''}>
            ${f.canvas ? '<span class="filter-canvas-badge">✦</span>' : ''}
          </div>
          <span>${esc(f.label)}</span>
        </button>
      `).join('')}
    </div>
  ` : '';

  content.innerHTML = `
    <div class="avatar-editor-preview" id="avatarEditorPreview"
      onclick="window.app.zoomPreview()">${_getPreviewHTML()}</div>

    <div class="avatar-editor-tabs">
      <button class="avatar-tab ${_mode==='emoji'?'active':''}" data-tab="emoji"
        onclick="window.app.avatarSwitchTab('emoji')">Emoji</button>
      <button class="avatar-tab ${_mode==='photo'?'active':''}" data-tab="photo"
        onclick="window.app.avatarSwitchTab('photo')">Photo</button>
    </div>

    <div id="avatarPanelEmoji" class="avatar-panel ${_mode!=='emoji'?'hidden':''}">
      <div class="avatar-emoji-grid">
        ${EMOJIS.map(e => `<span class="avatar-emoji-opt ${_emoji===e?'active':''}" data-emoji="${e}"
          onclick="window.app.selectAvatarEmoji('${e}')">${e}</span>`).join('')}
        <span class="avatar-emoji-opt avatar-emoji-reset" data-emoji=""
          onclick="window.app.selectAvatarEmoji(null)">↩</span>
      </div>
    </div>

    <div id="avatarPanelPhoto" class="avatar-panel ${_mode!=='photo'?'hidden':''}">
      <input type="file" id="avatarFileInput" accept="image/*" style="display:none"
        onchange="window.app.handleAvatarFile(this)">
      <button class="btn btn-ghost avatar-upload-btn"
        onclick="document.getElementById('avatarFileInput').click()">
        📸 ${_photo ? 'Changer la photo' : 'Choisir une photo'}
      </button>
      ${filterGrid}
    </div>

    <button class="btn btn-primary avatar-save-btn" onclick="window.app.saveAvatar()">Appliquer</button>
  `;
}

function _getPreviewHTML() {
  if (_mode === 'emoji' && _emoji) return `<span class="profile-avatar-emoji">${esc(_emoji)}</span>`;
  if (_mode === 'photo' && _photo) {
    const f = FILTERS.find(f => f.id === _filter);
    const style = f?.css ? `filter:${f.css}` : '';
    return `<img src="${_photo}" class="profile-avatar-img" ${style ? `style="${style}"` : ''}>`;
  }
  return `<span class="avatar-preview-placeholder">?</span>`;
}

function _updatePreview() {
  const el = document.getElementById('avatarEditorPreview');
  if (el) el.innerHTML = _getPreviewHTML();
}

// ── Private: canvas utils ─────────────────────────────

function _compressImage(file, size) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      const dim = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width-dim)/2, (img.height-dim)/2, dim, dim, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = url;
  });
}

function _applyCartoonToBase64(base64) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      _applyCartoon(ctx, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.src = base64;
  });
}

function _applyCartoon(ctx, w, h) {
  const id  = ctx.getImageData(0, 0, w, h);
  const src = id.data;
  const out = new Uint8ClampedArray(src);

  // 1. Posterize (reduce color palette)
  const levels = 5, step = 255 / levels;
  for (let i = 0; i < src.length; i += 4) {
    out[i]   = Math.round(Math.round(src[i]   / step) * step);
    out[i+1] = Math.round(Math.round(src[i+1] / step) * step);
    out[i+2] = Math.round(Math.round(src[i+2] / step) * step);
    out[i+3] = src[i+3];
  }

  // 2. Saturation boost
  for (let i = 0; i < out.length; i += 4) {
    const avg = (out[i] + out[i+1] + out[i+2]) / 3;
    const s = 1.4;
    out[i]   = Math.min(255, Math.max(0, avg + (out[i]   - avg) * s));
    out[i+1] = Math.min(255, Math.max(0, avg + (out[i+1] - avg) * s));
    out[i+2] = Math.min(255, Math.max(0, avg + (out[i+2] - avg) * s));
  }

  // 3. Sobel edge detection on grayscale
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = 0.299*src[i*4] + 0.587*src[i*4+1] + 0.114*src[i*4+2];
  }
  const edges = new Float32Array(w * h);
  for (let y = 1; y < h-1; y++) {
    for (let x = 1; x < w-1; x++) {
      const i = y*w+x;
      const gx = -gray[i-w-1] + gray[i-w+1] - 2*gray[i-1] + 2*gray[i+1] - gray[i+w-1] + gray[i+w+1];
      const gy = -gray[i-w-1] - 2*gray[i-w] - gray[i-w+1] + gray[i+w-1] + 2*gray[i+w] + gray[i+w+1];
      edges[i] = Math.sqrt(gx*gx + gy*gy);
    }
  }

  // 4. Normalize + apply edges
  let maxEdge = 0;
  for (let i = 0; i < edges.length; i++) if (edges[i] > maxEdge) maxEdge = edges[i];
  const threshold = 0.25;
  for (let i = 0; i < w*h; i++) {
    const e = edges[i] / (maxEdge || 1);
    if (e > threshold) {
      const p = i*4, str = Math.min(1, (e - threshold) / 0.3);
      out[p]   = Math.round(out[p]   * (1 - str * 0.85));
      out[p+1] = Math.round(out[p+1] * (1 - str * 0.85));
      out[p+2] = Math.round(out[p+2] * (1 - str * 0.85));
    }
  }

  ctx.putImageData(new ImageData(out, w, h), 0, 0);
}

// ── Private: storage ──────────────────────────────────
function _loadAvatar() {
  try { return JSON.parse(localStorage.getItem(AVATAR_KEY)); }
  catch { return null; }
}

function _saveAvatar(data) {
  localStorage.setItem(AVATAR_KEY, JSON.stringify(data));
}
