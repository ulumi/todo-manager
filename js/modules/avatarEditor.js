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
let _photo     = null; // base64 of uploaded photo
let _filter    = 'natural';
let _emoji     = null;
let _mode      = 'emoji'; // 'emoji' | 'photo'
let _cropZoom  = 1.4;    // starts at 140% to allow cropping
let _cropX     = 0.5;    // normalized center 0–1
let _cropY     = 0.5;
let _drag      = null;   // { lastX, lastY }
let _debugRings = true;  // DEBUG: toggle ring colors


// ── Public ────────────────────────────────────────────

export function openAvatarEditor() {
  const saved = _loadAvatar();
  if (saved?.type === 'emoji')  { _emoji = saved.value; _mode = 'emoji'; _photo = null; }
  else if (saved?.type === 'photo') { _photo = saved.data; _filter = saved.filter || 'natural'; _mode = 'photo'; _emoji = null; }
  else { _emoji = null; _photo = null; _filter = 'natural'; _mode = 'emoji'; }
  _cropZoom = 1.4; _cropX = 0.5; _cropY = 0.5;

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
  _photo    = await _compressImage(file, SIZE);
  _mode     = 'photo';
  _filter   = 'natural';
  _cropZoom = 1.4; _cropX = 0.5; _cropY = 0.5;
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

export function previewAvatarEmoji(emoji) {
  const el = document.getElementById('avatarEditorPreview');
  if (!el) return;
  el.innerHTML = `<span class="profile-avatar-emoji">${esc(emoji)}</span>`;
}

export function restoreAvatarPreview() {
  _updatePreview();
}

export function avatarSwitchTab(tab) {
  _mode = tab;
  document.getElementById('avatarPanelEmoji')?.classList.toggle('hidden', tab !== 'emoji');
  document.getElementById('avatarPanelPhoto')?.classList.toggle('hidden', tab !== 'photo');
  document.getElementById('cropControls')?.classList.toggle('hidden', tab !== 'photo' || !_photo);
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
    const cropped = (_cropZoom !== 1.0 || _cropX !== 0.5 || _cropY !== 0.5)
      ? await _applyCrop(_photo)
      : _photo;
    if (f?.canvas) {
      const processed = await _applyCartoonToBase64(cropped);
      _saveAvatar({ type: 'photo', data: processed, filter: 'natural' });
    } else {
      _saveAvatar({ type: 'photo', data: cropped, filter: _filter });
    }
  }
  closeAvatarEditor();
  window.app.render();
}

// ── Crop controls (exported) ──────────────────────────

export function cropDragStart(e) {
  e.preventDefault();
  const pt = e.touches ? e.touches[0] : e;
  _drag = { lastX: pt.clientX, lastY: pt.clientY };

  const onMove = ev => {
    if (!_drag) return;
    ev.preventDefault();
    const p    = ev.touches ? ev.touches[0] : ev;
    const dx   = p.clientX - _drag.lastX;
    const dy   = p.clientY - _drag.lastY;
    _drag.lastX = p.clientX; _drag.lastY = p.clientY;

    const canvas = document.getElementById('avatarCropCanvas');
    if (!canvas) return;
    // translate display-pixel delta → normalized image fraction
    _cropX -= dx / (canvas.clientWidth  * _cropZoom);
    _cropY -= dy / (canvas.clientHeight * _cropZoom);
    const half = 0.5 / _cropZoom;
    _cropX = Math.max(half, Math.min(1 - half, _cropX));
    _cropY = Math.max(half, Math.min(1 - half, _cropY));
    _drawCropCanvas();
  };
  const onEnd = () => {
    _drag = null;
    document.removeEventListener('mousemove',  onMove);
    document.removeEventListener('touchmove',  onMove);
    document.removeEventListener('mouseup',    onEnd);
    document.removeEventListener('touchend',   onEnd);
  };
  document.addEventListener('mousemove',  onMove);
  document.addEventListener('touchmove',  onMove, { passive: false });
  document.addEventListener('mouseup',    onEnd);
  document.addEventListener('touchend',   onEnd);
}

export function toggleDebugRings() {
  _debugRings = !_debugRings;
  _renderEditor();
}

export function setCropZoom(val) {
  _cropZoom  = Math.max(1, Math.min(3, parseFloat(val)));
  const half = 0.5 / _cropZoom;
  _cropX = Math.max(half, Math.min(1 - half, _cropX));
  _cropY = Math.max(half, Math.min(1 - half, _cropY));
  _drawCropCanvas();
  const display = document.getElementById('cropZoomDisplay');
  if (display) display.textContent = `${Math.round(_cropZoom * 100)}%`;
}

// ── Private: render editor ────────────────────────────

function _renderEditor() {
  const content = document.getElementById('avatarEditorContent');
  if (!content) return;

  content.innerHTML = `
    <div class="avatar-editor-preview ${_debugRings ? 'debug-rings' : ''}" id="avatarEditorPreview">${_getPreviewHTML()}</div>
    <div class="avatar-debug-legend ${_debugRings ? '' : 'hidden'}">
      <span style="background:#3b82f6"></span>A – fill central (::before z-0)<br>
      <span style="background:#22c55e"></span>B – anneau intermédiaire (::before z-0)<br>
      <span style="background:#f97316"></span>C – anneau extérieur (::before z-0, fond)<br>
      <span style="background:#ef4444"></span>C – anneau extérieur (::after z-2, PAR-DESSUS emoji)<br>
    </div>
    <button class="avatar-debug-toggle" onclick="window.app.toggleDebugRings()">
      ${_debugRings ? '→ Vraies couleurs' : '→ Mode debug'}
    </button>

    <div class="avatar-crop-controls ${!_photo || _mode !== 'photo' ? 'hidden' : ''}" id="cropControls">
      <span class="crop-zoom-icon">−</span>
      <input type="range" id="cropZoomSlider" class="crop-zoom-slider"
        min="1" max="3" step="0.05" value="${_cropZoom}"
        oninput="window.app.setCropZoom(this.value)">
      <span class="crop-zoom-icon">+</span>
      <span id="cropZoomDisplay" class="crop-zoom-display">${Math.round(_cropZoom * 100)}%</span>
    </div>

    <div class="avatar-editor-tabs">
      <button class="avatar-tab ${_mode==='emoji'?'active':''}" data-tab="emoji"
        onclick="window.app.avatarSwitchTab('emoji')">Emoji</button>
      <button class="avatar-tab ${_mode==='photo'?'active':''}" data-tab="photo"
        onclick="window.app.avatarSwitchTab('photo')">Photo</button>
    </div>

    <div id="avatarPanelEmoji" class="avatar-panel ${_mode!=='emoji'?'hidden':''}">
      <div class="avatar-emoji-grid">
        ${EMOJIS.map(e => `<span class="avatar-emoji-opt ${_emoji===e?'active':''}" data-emoji="${e}"
          onclick="window.app.selectAvatarEmoji('${e}')"
          onmouseenter="window.app.previewAvatarEmoji('${e}')"
          onmouseleave="window.app.restoreAvatarPreview()">${e}</span>`).join('')}
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
    </div>

    <button class="btn btn-primary avatar-save-btn" onclick="window.app.saveAvatar()">Appliquer</button>
  `;

  if (_mode === 'photo' && _photo) _drawCropCanvas();
}

function _getPreviewHTML() {
  if (_mode === 'emoji' && _emoji) return `<span class="profile-avatar-emoji">${esc(_emoji)}</span>`;
  if (_mode === 'photo' && _photo) {
    const f = FILTERS.find(f => f.id === _filter);
    const style = (f?.css && !f.canvas) ? `style="filter:${f.css}"` : '';
    return `<canvas id="avatarCropCanvas" width="${SIZE}" height="${SIZE}"
      class="avatar-crop-canvas" ${style}
      onmousedown="window.app.cropDragStart(event)"
      ontouchstart="window.app.cropDragStart(event)"></canvas>`;
  }
  return `<span class="avatar-preview-placeholder">?</span>`;
}

function _updatePreview() {
  const el = document.getElementById('avatarEditorPreview');
  if (!el) return;
  el.innerHTML = _getPreviewHTML();
  if (_mode === 'photo' && _photo) _drawCropCanvas();
}

// ── Private: canvas utils ─────────────────────────────

function _drawCropCanvas() {
  const canvas = document.getElementById('avatarCropCanvas');
  if (!canvas || !_photo) return;
  const ctx = canvas.getContext('2d');
  const s   = canvas.width;
  const img = new Image();
  img.onload = () => {
    const imgW    = img.naturalWidth;
    const imgH    = img.naturalHeight;
    const srcSize = imgW / _cropZoom;
    const cx      = _cropX * imgW;
    const cy      = _cropY * imgH;
    const srcX    = Math.max(0, Math.min(imgW - srcSize, cx - srcSize / 2));
    const srcY    = Math.max(0, Math.min(imgH - srcSize, cy - srcSize / 2));
    ctx.clearRect(0, 0, s, s);
    ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, s, s);
  };
  img.src = _photo;
}

function _applyCrop(base64) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas  = document.createElement('canvas');
      canvas.width  = canvas.height = SIZE;
      const ctx     = canvas.getContext('2d');
      const imgW    = img.naturalWidth;
      const imgH    = img.naturalHeight;
      const srcSize = imgW / _cropZoom;
      const cx      = _cropX * imgW;
      const cy      = _cropY * imgH;
      const srcX    = Math.max(0, Math.min(imgW - srcSize, cx - srcSize / 2));
      const srcY    = Math.max(0, Math.min(imgH - srcSize, cy - srcSize / 2));
      ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, SIZE, SIZE);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = base64;
  });
}

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
