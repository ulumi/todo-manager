// ════════════════════════════════════════════════════════
//  LOW-POLY BACKGROUND
// ════════════════════════════════════════════════════════

const PALETTES = {
  geo: {
    name: '🌋 Géo Chaud',
    light: [
      { x: 0.0, y: 0.0, r: 196, g: 55,  b: 38  },
      { x: 0.4, y: 0.0, r: 110, g: 22,  b: 38  },
      { x: 1.0, y: 0.0, r: 42,  g: 105, b: 42  },
      { x: 0.0, y: 0.5, r: 215, g: 88,  b: 28  },
      { x: 0.5, y: 0.4, r: 148, g: 44,  b: 36  },
      { x: 1.0, y: 0.5, r: 55,  g: 138, b: 55  },
      { x: 0.0, y: 1.0, r: 222, g: 148, b: 25  },
      { x: 0.5, y: 1.0, r: 195, g: 108, b: 38  },
      { x: 1.0, y: 1.0, r: 65,  g: 162, b: 65  },
    ],
    dark: [
      { x: 0.0, y: 0.0, r: 105, g: 30,  b: 20  },
      { x: 0.4, y: 0.0, r: 48,  g: 10,  b: 22  },
      { x: 1.0, y: 0.0, r: 18,  g: 58,  b: 22  },
      { x: 0.0, y: 0.5, r: 115, g: 45,  b: 12  },
      { x: 0.5, y: 0.4, r: 65,  g: 20,  b: 14  },
      { x: 1.0, y: 0.5, r: 22,  g: 75,  b: 25  },
      { x: 0.0, y: 1.0, r: 120, g: 78,  b: 10  },
      { x: 0.5, y: 1.0, r: 95,  g: 50,  b: 18  },
      { x: 1.0, y: 1.0, r: 26,  g: 85,  b: 30  },
    ],
  },
  aurora: {
    name: '🌊 Aurore Boréale',
    light: [
      { x: 0.0, y: 0.0, r: 80,  g: 30,  b: 155 },
      { x: 0.5, y: 0.0, r: 30,  g: 55,  b: 175 },
      { x: 1.0, y: 0.0, r: 20,  g: 130, b: 155 },
      { x: 0.0, y: 0.5, r: 115, g: 30,  b: 160 },
      { x: 0.5, y: 0.5, r: 55,  g: 45,  b: 168 },
      { x: 1.0, y: 0.5, r: 25,  g: 148, b: 130 },
      { x: 0.0, y: 1.0, r: 145, g: 50,  b: 120 },
      { x: 0.5, y: 1.0, r: 75,  g: 65,  b: 178 },
      { x: 1.0, y: 1.0, r: 35,  g: 168, b: 108 },
    ],
    dark: [
      { x: 0.0, y: 0.0, r: 38,  g: 12,  b: 80  },
      { x: 0.5, y: 0.0, r: 12,  g: 22,  b: 90  },
      { x: 1.0, y: 0.0, r: 8,   g: 65,  b: 80  },
      { x: 0.0, y: 0.5, r: 58,  g: 12,  b: 82  },
      { x: 0.5, y: 0.5, r: 25,  g: 18,  b: 85  },
      { x: 1.0, y: 0.5, r: 12,  g: 75,  b: 65  },
      { x: 0.0, y: 1.0, r: 75,  g: 22,  b: 62  },
      { x: 0.5, y: 1.0, r: 36,  g: 28,  b: 92  },
      { x: 1.0, y: 1.0, r: 18,  g: 85,  b: 52  },
    ],
  },
  none: { name: '⬜ Aucun', light: null, dark: null },
};

export const PALETTE_OPTIONS = Object.entries(PALETTES).map(([id, p]) => ({ id, name: p.name }));

let _canvas = null;
let _currentId = 'geo';

function _lerp(tx, ty, palette) {
  let r = 0, g = 0, b = 0, w = 0;
  for (const s of palette) {
    const dx = tx - s.x, dy = ty - s.y;
    const wi = 1 / (dx * dx + dy * dy + 0.0001);
    r += s.r * wi; g += s.g * wi; b += s.b * wi; w += wi;
  }
  return [r / w, g / w, b / w];
}

function _drawTri(ctx, p1, p2, p3, W, H, palette, isDark) {
  const cx = (p1[0] + p2[0] + p3[0]) / 3 / W;
  const cy = (p1[1] + p2[1] + p3[1]) / 3 / H;
  let [r, g, b] = _lerp(cx, cy, palette);
  const v = (Math.random() - 0.5) * (isDark ? 80 : 30);
  r = Math.max(0, Math.min(255, r + v));
  g = Math.max(0, Math.min(255, g + v));
  b = Math.max(0, Math.min(255, b + v));

  ctx.beginPath();
  ctx.moveTo(p1[0], p1[1]);
  ctx.lineTo(p2[0], p2[1]);
  ctx.lineTo(p3[0], p3[1]);
  ctx.closePath();
  ctx.fillStyle = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
  ctx.fill();
  ctx.strokeStyle = isDark ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.05)';
  ctx.lineWidth = 0.7;
  ctx.stroke();
}

function _generate() {
  if (!_canvas) return;
  const p = PALETTES[_currentId];
  if (!p?.light) { _canvas.style.display = 'none'; return; }
  _canvas.style.display = 'block';

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const palette = isDark ? p.dark : p.light;
  const dpr = window.devicePixelRatio || 1;
  const W = window.innerWidth, H = window.innerHeight;

  _canvas.width  = W * dpr;
  _canvas.height = H * dpr;
  _canvas.style.width  = W + 'px';
  _canvas.style.height = H + 'px';

  const ctx = _canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const cols = 14, rows = 10;
  const cw = W / cols, ch = H / rows;
  const jitter = 0.44;
  const pts = [];

  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      let x = c * cw, y = r * ch;
      if (c > 0 && c < cols) x += (Math.random() - 0.5) * cw * jitter;
      if (r > 0 && r < rows) y += (Math.random() - 0.5) * ch * jitter;
      pts.push([x, y]);
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tl = pts[r * (cols + 1) + c];
      const tr = pts[r * (cols + 1) + c + 1];
      const bl = pts[(r + 1) * (cols + 1) + c];
      const br = pts[(r + 1) * (cols + 1) + c + 1];
      _drawTri(ctx, tl, tr, bl, W, H, palette, isDark);
      _drawTri(ctx, tr, br, bl, W, H, palette, isDark);
    }
  }
}

export function initLowPolyBg() {
  _currentId = localStorage.getItem('bgPalette') || 'geo';
  _canvas = document.createElement('canvas');
  _canvas.id = 'lowpoly-bg';
  // Insérer dans <html> et non <body> pour échapper au body.style.zoom
  document.documentElement.appendChild(_canvas);
  _generate();

  let _rt;
  window.addEventListener('resize', () => { clearTimeout(_rt); _rt = setTimeout(_generate, 200); });
  new MutationObserver(_generate).observe(
    document.documentElement,
    { attributes: true, attributeFilter: ['data-theme'] }
  );
}

export function setPalette(id) {
  _currentId = id;
  localStorage.setItem('bgPalette', id);
  _generate();
}
