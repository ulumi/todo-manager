// Debug panel for celebrate module — LOCAL ONLY
(function() {
  // Only show in localhost/dev
  if (!window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
    return;
  }

  // Wait for app to be ready
  const checkApp = setInterval(() => {
    if (window.app && window.app.celebrate) {
      clearInterval(checkApp);
      initDebugPanel();
    }
  }, 100);

  function initDebugPanel() {
    const panel = document.createElement('div');
    panel.id = 'celebrate-debug-panel';
    panel.style.cssText = `
      position: fixed;
      top: 12px;
      right: 12px;
      z-index: 99999;
      background: rgba(20, 20, 30, 0.95);
      border: 1px solid rgba(255, 100, 220, 0.4);
      border-radius: 8px;
      padding: 12px 16px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      color: #fff;
      backdrop-filter: blur(8px);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
      display: flex;
      gap: 8px;
      align-items: center;
    `;

    const label = document.createElement('span');
    label.textContent = '🎉 Celebrate:';
    label.style.cssText = 'color: rgba(255, 180, 255, 0.8); font-weight: 600;';

    const btnEN = document.createElement('button');
    btnEN.textContent = 'EN';
    btnEN.style.cssText = `
      padding: 6px 12px;
      background: rgba(255, 100, 220, 0.2);
      border: 1px solid rgba(255, 100, 220, 0.5);
      color: #fff;
      border-radius: 4px;
      cursor: pointer;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      transition: all 0.2s;
    `;
    btnEN.addEventListener('mouseover', () => {
      btnEN.style.background = 'rgba(255, 100, 220, 0.4)';
    });
    btnEN.addEventListener('mouseout', () => {
      btnEN.style.background = 'rgba(255, 100, 220, 0.2)';
    });
    btnEN.addEventListener('click', () => {
      window.app.celebrate('en');
    });

    const btnFR = document.createElement('button');
    btnFR.textContent = 'FR';
    btnFR.style.cssText = `
      padding: 6px 12px;
      background: rgba(255, 100, 220, 0.2);
      border: 1px solid rgba(255, 100, 220, 0.5);
      color: #fff;
      border-radius: 4px;
      cursor: pointer;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      transition: all 0.2s;
    `;
    btnFR.addEventListener('mouseover', () => {
      btnFR.style.background = 'rgba(255, 100, 220, 0.4)';
    });
    btnFR.addEventListener('mouseout', () => {
      btnFR.style.background = 'rgba(255, 100, 220, 0.2)';
    });
    btnFR.addEventListener('click', () => {
      window.app.celebrate('fr');
    });

    panel.appendChild(label);
    panel.appendChild(btnEN);
    panel.appendChild(btnFR);
    document.body.appendChild(panel);

    // Make it draggable
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    panel.addEventListener('mousedown', (e) => {
      isDragging = true;
      offsetX = e.clientX - panel.getBoundingClientRect().left;
      offsetY = e.clientY - panel.getBoundingClientRect().top;
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      panel.style.right = 'auto';
      panel.style.left = (e.clientX - offsetX) + 'px';
      panel.style.top = (e.clientY - offsetY) + 'px';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });

    console.log('🎉 Celebrate debug panel ready! Click EN/FR to test.');
  }
})();
