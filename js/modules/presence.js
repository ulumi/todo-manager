// ════════════════════════════════════════════════════════
//  PRESENCE — track online status + receive admin messages (Supabase)
// ════════════════════════════════════════════════════════

import { supabase } from './supabase.js';

let _heartbeat         = null;
let _inboxChannel      = null;
let _setOffline        = null;
let _onMessagesUpdate  = null;
let _allMessages       = [];
let _userId            = null;
let _clickCount        = 0;
let _sessionStartMs    = null;

// ── Init ─────────────────────────────────────────────────
// Call after every auth state change that yields a real user.
// options.onMessagesUpdate(messages[]) is called whenever the inbox changes.
export function initPresence(user, { onMessagesUpdate } = {}) {
  destroyPresence();
  _onMessagesUpdate = onMessagesUpdate || null;
  _allMessages = [];
  _userId = user.uid;
  _clickCount = 0;
  _sessionStartMs = Date.now();

  const uid = user.uid;

  // First call: set sessionStart + online for this session
  supabase.from('presence').upsert({
    user_id:       uid,
    online:        true,
    last_seen:     new Date().toISOString(),
    session_start: new Date().toISOString(),
    click_count:   0,
    email:         user.email       || null,
    display_name:  user.displayName || null,
    is_anonymous:  user.isAnonymous,
  }).then(({ error }) => { if (error) console.warn('[presence] init:', error.message); });

  // Heartbeat: update last_seen + click_count
  _setOnline = () => supabase.from('presence').upsert({
    user_id:     uid,
    online:      true,
    last_seen:   new Date().toISOString(),
    click_count: _clickCount,
  }).then(() => {}).catch(() => {});

  _setOffline = () => supabase.from('presence').upsert({
    user_id:   uid,
    online:    false,
    last_seen: new Date().toISOString(),
  }).then(() => {}).catch(() => {});

  _heartbeat = setInterval(_setOnline, 30_000);
  document.addEventListener('click', _onUserClick, { capture: true });

  // Write avatar asynchronously (fire-and-forget)
  _getPresenceAvatar().then(avatar => {
    supabase.from('presence').upsert({
      user_id: uid,
      avatar:  avatar ?? null,
    }).then(() => {}).catch(() => {});
  });

  window.addEventListener('beforeunload', _setOffline);
  document.addEventListener('visibilitychange', _onVisibility);

  // Load all inbox messages
  _loadMessages(uid);

  // Subscribe to realtime changes on admin_messages for this user
  _inboxChannel = supabase
    .channel(`admin_messages:${uid}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'admin_messages',
        filter: `user_id=eq.${uid}`,
      },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          const msg = payload.new;
          _allMessages.push(msg);
          _allMessages.sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));
          if (_onMessagesUpdate) _onMessagesUpdate([..._allMessages]);
          // Show toast for new admin messages
          if (!msg.read && msg.sender !== 'user') {
            _showMessage(msg);
          }
        } else if (payload.eventType === 'UPDATE') {
          const idx = _allMessages.findIndex(m => m.id === payload.new.id);
          if (idx >= 0) _allMessages[idx] = payload.new;
          if (_onMessagesUpdate) _onMessagesUpdate([..._allMessages]);
        } else if (payload.eventType === 'DELETE') {
          _allMessages = _allMessages.filter(m => m.id !== payload.old.id);
          if (_onMessagesUpdate) _onMessagesUpdate([..._allMessages]);
        }
      },
    )
    .subscribe();
}

// ── Load all messages for user ──────────────────────────
async function _loadMessages(uid) {
  const { data, error } = await supabase
    .from('admin_messages')
    .select('*')
    .eq('user_id', uid)
    .order('sent_at', { ascending: true });

  if (error) { console.warn('[presence] loadMessages:', error.message); return; }
  _allMessages = data || [];
  if (_onMessagesUpdate) _onMessagesUpdate([..._allMessages]);
}

// ── Send a reply from the user to admin ──────────────────
export async function sendUserMessage(text) {
  if (!_userId || !text) return;
  await supabase.from('admin_messages').insert({
    user_id: _userId,
    message: text,
    sender:  'user',
    sent_at: new Date().toISOString(),
    read:    true, // user's own message — no unread badge for themselves
  });
}

// ── Mark all admin messages as read ──────────────────────
export function markAllMessagesRead() {
  const unread = _allMessages.filter(m => !m.read);
  if (!unread.length) return;

  // Optimistic update
  unread.forEach(m => { m.read = true; });
  if (_onMessagesUpdate) _onMessagesUpdate([..._allMessages]);

  // Batch update in Supabase
  const ids = unread.map(m => m.id);
  supabase
    .from('admin_messages')
    .update({ read: true })
    .in('id', ids)
    .then(() => {}).catch(() => {});
}

// ── Update avatar in presence (call after user changes avatar) ──────────
export async function updatePresenceAvatar() {
  if (!_userId) return;
  const avatar = await _getPresenceAvatar();
  supabase.from('presence').upsert({
    user_id: _userId,
    avatar:  avatar ?? null,
  }).then(() => {}).catch(() => {});
}

// ── Update displayName in presence (call after updateProfile) ────────────
export function updatePresenceName(displayName) {
  if (!_userId || !displayName) return;
  supabase.from('presence').upsert({
    user_id:      _userId,
    display_name: displayName,
  }).then(() => {}).catch(() => {});
}

// ── Cleanup ───────────────────────────────────────────────
export function destroyPresence() {
  if (_heartbeat)    { clearInterval(_heartbeat); _heartbeat = null; }
  if (_inboxChannel) { supabase.removeChannel(_inboxChannel); _inboxChannel = null; }
  if (_setOffline)   { window.removeEventListener('beforeunload', _setOffline); _setOffline = null; }
  _setOnline = null;
  _onMessagesUpdate = null;
  _allMessages = [];
  _userId = null;
  _clickCount = 0;
  _sessionStartMs = null;
  document.removeEventListener('click', _onUserClick, { capture: true });
  document.removeEventListener('visibilitychange', _onVisibility);
}

// ── Internals ─────────────────────────────────────────────
let _setOnline = null;

function _onUserClick() { _clickCount++; }

async function _getPresenceAvatar() {
  try {
    const saved = JSON.parse(localStorage.getItem('profileAvatar'));
    if (!saved) return null;
    if (saved.type === 'emoji') {
      return { type: 'emoji', value: saved.value, scale: saved.scale ?? 1.2, x: saved.x ?? 0, y: saved.y ?? 0 };
    }
    if (saved.type === 'photo' && saved.data) {
      // Downscale to 48px thumbnail — lightweight for Supabase
      return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = c.height = 48;
          c.getContext('2d').drawImage(img, 0, 0, 48, 48);
          resolve({ type: 'photo', data: c.toDataURL('image/jpeg', 0.7), filter: saved.filter || 'natural' });
        };
        img.onerror = () => resolve(null);
        img.src = saved.data;
      });
    }
  } catch {}
  return null;
}

function _onVisibility() {
  if (document.hidden) { if (_setOffline) _setOffline(); }
  else                  { if (_setOnline)  _setOnline();  }
}

function _showMessage(data) {
  const label = data.broadcast_id ? 'Envoyé à tous' : 'Admin';
  const toast = document.createElement('div');
  toast.className = 'admin-toast';
  toast.innerHTML = `
    <div class="admin-toast__main" role="button" tabindex="0" aria-label="Ouvrir le chat pour répondre">
      <span class="admin-toast__icon">📣</span>
      <div class="admin-toast__body">
        <p class="admin-toast__label">${label}</p>
        <p class="admin-toast__text">${_esc(data.message)}</p>
        <p class="admin-toast__reply-cta"><span class="admin-toast__reply-arrow">↩</span> Répondre</p>
      </div>
    </div>
    <button class="admin-toast__close" aria-label="Fermer">✕</button>
  `;
  document.body.appendChild(toast);

  const dismiss = () => {
    toast.classList.add('admin-toast--out');
    setTimeout(() => toast.remove(), 300);
  };

  // Main area → open chat + focus reply
  const main = toast.querySelector('.admin-toast__main');
  const openAndReply = () => {
    supabase.from('admin_messages').update({ read: true }).eq('id', data.id).then(() => {}).catch(() => {});
    dismiss();
    window.app?.openChat?.();
  };
  main.addEventListener('click', openAndReply);
  main.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openAndReply(); });

  // ✕ button → dismiss only, mark as read
  toast.querySelector('.admin-toast__close').addEventListener('click', () => {
    supabase.from('admin_messages').update({ read: true }).eq('id', data.id).then(() => {}).catch(() => {});
    dismiss();
  });
}

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
