// ════════════════════════════════════════════════════════
//  DEBUG PANEL — connectivity / storage status near the version label
// ════════════════════════════════════════════════════════

import { getSupabaseStatus, SESSION_ID } from './sync.js';
import { isGuest, getCurrentUser } from './auth.js';
import { esc, safeParseJSON } from './utils.js';

function localStorageInfo() {
  let bytes = 0;
  for (const k in localStorage) {
    if (!Object.prototype.hasOwnProperty.call(localStorage, k)) continue;
    bytes += k.length + (localStorage.getItem(k) || '').length;
  }
  const todosCount = safeParseJSON(localStorage.getItem('todos'), []).length;
  return {
    todosCount,
    kb: Math.round(bytes / 1024 * 10) / 10,
    pending: localStorage.getItem('_pendingSync') === '1',
  };
}

// Status keys used by the closed-state icons/dots: 'ok' | 'warn' | 'off'
export function getDebugStatus() {
  const supa = getSupabaseStatus();
  const local = localStorageInfo();
  let cloudState = 'ok';
  if (!supa.online) cloudState = 'off';
  else if (local.pending) cloudState = 'warn';
  return { supa, local, cloudState, localState: local.pending ? 'warn' : 'ok' };
}

export function renderDebugDrawerHTML() {
  const { supa, local, cloudState, localState } = getDebugStatus();
  const guest = isGuest();
  const user = getCurrentUser();
  const accountLabel = guest ? 'Invité' : (user?.email || 'Connecté');
  const lastCheck = supa.lastCheckedAt
    ? `il y a ${Math.max(0, Math.round((Date.now() - supa.lastCheckedAt) / 1000))}s`
    : 'jamais';

  return `
    <div class="debug-row">
      <span class="debug-dot debug-dot--${cloudState}"></span>
      <span class="debug-row-label">Supabase</span>
      <span class="debug-row-value">${supa.online ? 'Connecté' : 'Hors ligne'}</span>
    </div>
    <div class="debug-row-sub">Dernière vérif. ${lastCheck}</div>
    <div class="debug-row">
      <span class="debug-dot debug-dot--${guest ? 'warn' : 'ok'}"></span>
      <span class="debug-row-label">Compte</span>
      <span class="debug-row-value">${esc(accountLabel)}</span>
    </div>
    <div class="debug-row">
      <span class="debug-dot debug-dot--${localState}"></span>
      <span class="debug-row-label">Local</span>
      <span class="debug-row-value">${local.todosCount} tâche${local.todosCount > 1 ? 's' : ''} · ${local.kb} Ko</span>
    </div>
    <div class="debug-row-sub">${local.pending ? 'Synchro en attente…' : 'Synchronisé'}</div>
    <div class="debug-row-sub debug-session">Session ${esc(SESSION_ID)}</div>
  `;
}
