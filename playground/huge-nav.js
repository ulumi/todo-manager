(function () {
  const GATEWAY = './index.html';
  const JSON_PATH = './playgrounds.json';
  const currentFile = window.location.pathname.split('/').pop() || 'index.html';
  const isGateway = currentFile === 'index.html' || currentFile === '';

  /* ── CSS ─────────────────────────────────────────────────────────── */
  const css = `
    #huge-nav-toggle {
      position: fixed;
      left: 0; top: 50%;
      transform: translateY(-50%);
      z-index: 9999;
      background: rgba(15,10,26,.88);
      border: 1px solid rgba(167,139,250,.35);
      border-left: none;
      border-radius: 0 10px 10px 0;
      padding: 14px 10px;
      cursor: pointer;
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      writing-mode: vertical-rl;
      text-orientation: mixed;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 10px; font-weight: 800; letter-spacing: .12em;
      color: #a78bfa;
      text-transform: uppercase;
      transition: background .2s, border-color .2s, color .2s;
      user-select: none;
    }
    #huge-nav-toggle:hover {
      background: rgba(167,139,250,.18);
      border-color: rgba(167,139,250,.6);
      color: #d8b4fe;
    }
    #huge-nav-overlay {
      position: fixed; inset: 0; z-index: 9997;
      background: rgba(0,0,0,.55);
      backdrop-filter: blur(3px);
      -webkit-backdrop-filter: blur(3px);
      opacity: 0; pointer-events: none;
      transition: opacity .3s;
    }
    #huge-nav-overlay.open { opacity: 1; pointer-events: all; }
    #huge-nav-panel {
      position: fixed;
      left: -320px; top: 0; bottom: 0;
      width: 300px;
      z-index: 9998;
      background: rgba(7,4,16,.97);
      border-right: 1px solid rgba(167,139,250,.18);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      transition: left .32s cubic-bezier(.2,1,.3,1);
      display: flex; flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      overflow: hidden;
    }
    #huge-nav-panel.open { left: 0; }

    /* Header */
    .hn-header {
      padding: 18px 18px 14px;
      border-bottom: 1px solid rgba(255,255,255,.06);
      display: flex; align-items: center; gap: 10px;
      flex-shrink: 0;
    }
    .hn-title {
      font-size: 17px; font-weight: 900; letter-spacing: -.5px; flex: 1;
      background: linear-gradient(135deg, #a78bfa 0%, #60a5fa 50%, #34d399 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    }
    .hn-close {
      width: 26px; height: 26px; border-radius: 7px;
      background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.08);
      color: rgba(255,255,255,.45); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; transition: background .15s, color .15s;
      flex-shrink: 0;
    }
    .hn-close:hover { background: rgba(255,255,255,.12); color: #f1f5f9; }

    /* Gateway link */
    .hn-gateway {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 18px;
      font-size: 11px; font-weight: 600; color: rgba(255,255,255,.35);
      text-decoration: none;
      border-bottom: 1px solid rgba(255,255,255,.05);
      transition: color .15s, background .15s;
    }
    .hn-gateway:hover { color: #a78bfa; background: rgba(167,139,250,.06); }
    .hn-gateway.active { color: #a78bfa; font-weight: 700; }

    /* Count badge */
    .hn-count {
      margin-left: auto;
      font-size: 10px; font-weight: 700;
      padding: 1px 7px; border-radius: 99px;
      background: rgba(167,139,250,.15); color: rgba(167,139,250,.7);
    }

    /* Scrollable list */
    .hn-list {
      flex: 1; overflow-y: auto; padding: 6px 0;
    }
    .hn-list::-webkit-scrollbar { width: 3px; }
    .hn-list::-webkit-scrollbar-track { background: transparent; }
    .hn-list::-webkit-scrollbar-thumb { background: rgba(167,139,250,.25); border-radius: 2px; }

    /* Items */
    .hn-item {
      display: block; padding: 8px 18px;
      font-size: 12px; font-weight: 500; color: rgba(255,255,255,.48);
      text-decoration: none;
      border-left: 2px solid transparent;
      transition: color .15s, background .15s, border-color .15s;
      line-height: 1.35;
    }
    .hn-item:hover {
      color: #f1f5f9; background: rgba(255,255,255,.04);
      border-left-color: rgba(167,139,250,.4);
    }
    .hn-item.current {
      color: #d8b4fe; background: rgba(167,139,250,.1);
      border-left-color: #a78bfa; font-weight: 700;
    }
    .hn-item-title { display: block; }
    .hn-item-date {
      display: block; font-size: 10px; color: rgba(255,255,255,.22);
      margin-top: 2px; font-weight: 400;
    }
    .hn-item.current .hn-item-date { color: rgba(167,139,250,.45); }

    /* Footer */
    .hn-footer {
      padding: 10px 18px;
      border-top: 1px solid rgba(255,255,255,.05);
      font-size: 10px; color: rgba(255,255,255,.2);
      flex-shrink: 0;
    }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ── DOM ─────────────────────────────────────────────────────────── */
  const overlay = document.createElement('div');
  overlay.id = 'huge-nav-overlay';

  const panel = document.createElement('div');
  panel.id = 'huge-nav-panel';
  panel.innerHTML = `
    <div class="hn-header">
      <span class="hn-title">HUGE Playground</span>
      <button class="hn-close" id="hn-close" title="Close (Esc)">✕</button>
    </div>
    <a href="${GATEWAY}" class="hn-gateway${isGateway ? ' active' : ''}">
      ⬡ Gateway — all experiments
      <span class="hn-count" id="hn-count">…</span>
    </a>
    <div class="hn-list" id="hn-list">
      <div style="padding:18px;color:rgba(255,255,255,.25);font-size:12px">Loading…</div>
    </div>
    <div class="hn-footer">Press <strong>H</strong> to toggle · Esc to close</div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(panel);

  // Toggle tab — hidden on gateway (redundant)
  if (!isGateway) {
    const toggle = document.createElement('button');
    toggle.id = 'huge-nav-toggle';
    toggle.textContent = '⬡ HUGE';
    toggle.title = 'HUGE Playground nav (H)';
    document.body.appendChild(toggle);
    toggle.addEventListener('click', openNav);
  }

  /* ── Open / Close ────────────────────────────────────────────────── */
  function openNav() {
    panel.classList.add('open');
    overlay.classList.add('open');
  }
  function closeNav() {
    panel.classList.remove('open');
    overlay.classList.remove('open');
  }

  overlay.addEventListener('click', closeNav);
  document.getElementById('hn-close').addEventListener('click', closeNav);

  document.addEventListener('keydown', e => {
    const tag = document.activeElement.tagName;
    const editable = document.activeElement.isContentEditable;
    if (e.key === 'Escape') { closeNav(); return; }
    if (e.key === 'h' && !e.ctrlKey && !e.metaKey && !e.shiftKey &&
        !['INPUT','TEXTAREA','SELECT'].includes(tag) && !editable) {
      panel.classList.contains('open') ? closeNav() : openNav();
    }
  });

  /* ── Load & render list ──────────────────────────────────────────── */
  fetch(JSON_PATH)
    .then(r => r.json())
    .then(data => {
      const items = [...data.playgrounds].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      document.getElementById('hn-count').textContent = items.length;

      const fmt = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      document.getElementById('hn-list').innerHTML = items.map(pg => {
        const isCurrent = pg.file === currentFile;
        const date = fmt.format(new Date(pg.createdAt));
        return `<a href="${pg.file}" class="hn-item${isCurrent ? ' current' : ''}">
          <span class="hn-item-title">${pg.title}</span>
          <span class="hn-item-date">${date}</span>
        </a>`;
      }).join('');
    })
    .catch(() => {
      document.getElementById('hn-list').innerHTML =
        '<div style="padding:18px;color:rgba(255,100,100,.4);font-size:12px">Failed to load playgrounds.json</div>';
    });
})();
