// ════════════════════════════════════════════════════════
//  PRESENCE — track online status + receive admin messages
//
//  Firestore structure:
//    presence/{uid}                           — online status
//    admin_messages/{uid}/inbox/{messageId}   — incoming messages
//
//  Required Firestore security rules (add to your rules):
//    match /presence/{uid} {
//      allow read, write: if request.auth.uid == uid;
//    }
//    match /admin_messages/{uid}/inbox/{msg} {
//      allow read, write: if request.auth.uid == uid;
//    }
// ════════════════════════════════════════════════════════

import {
  doc, setDoc, updateDoc, collection, query, addDoc,
  onSnapshot, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

import { db } from './firebase.js';

let _heartbeat         = null;
let _inboxUnsub        = null;
let _setOffline        = null;
let _onMessagesUpdate  = null;
let _allMessages       = [];
let _userId            = null;
let _presenceRef       = null;
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

  _presenceRef = doc(db, 'presence', user.uid);
  const presenceRef = _presenceRef;

  // First call: set sessionStart for this session
  setDoc(presenceRef, {
    online:       true,
    lastSeen:     serverTimestamp(),
    sessionStart: serverTimestamp(),
    clickCount:   0,
    email:        user.email       || null,
    displayName:  user.displayName || null,
    isAnonymous:  user.isAnonymous,
  }, { merge: true }).catch(() => {});

  // Heartbeat: update lastSeen + clickCount only (keeps sessionStart intact)
  _setOnline = () => setDoc(presenceRef, {
    online:     true,
    lastSeen:   serverTimestamp(),
    clickCount: _clickCount,
  }, { merge: true }).catch(() => {});

  _setOffline = () => setDoc(presenceRef, {
    online:   false,
    lastSeen: serverTimestamp(),
  }, { merge: true }).catch(() => {});

  _heartbeat = setInterval(_setOnline, 30_000);
  document.addEventListener('click', _onUserClick, { capture: true });

  // Write avatar asynchronously (fire-and-forget)
  _getPresenceAvatar().then(avatar => {
    setDoc(presenceRef, { avatar: avatar ?? null }, { merge: true }).catch(() => {});
  });

  window.addEventListener('beforeunload', _setOffline);
  document.addEventListener('visibilitychange', _onVisibility);

  // Listen to ALL inbox messages (not just unread) for the chat widget.
  // Toasts are only shown for messages that arrive AFTER the initial load.
  const inboxRef = collection(db, 'admin_messages', user.uid, 'inbox');
  let _initialLoadDone = false;

  _inboxUnsub = onSnapshot(
    query(inboxRef),
    snap => {
      _allMessages = [];
      snap.forEach(d => _allMessages.push({ id: d.id, ref: d.ref, ...d.data() }));
      // Sort by sentAt ascending (serverTimestamp → seconds field)
      _allMessages.sort((a, b) => {
        const ta = a.sentAt?.seconds ?? 0;
        const tb = b.sentAt?.seconds ?? 0;
        return ta - tb;
      });

      if (_onMessagesUpdate) _onMessagesUpdate([..._allMessages]);

      // Show toasts only for NEW unread messages FROM admin (after initial load)
      if (_initialLoadDone) {
        snap.docChanges().forEach(change => {
          const d = change.doc.data();
          if (change.type === 'added' && !d.read && d.from !== 'user') {
            _showMessage(d, change.doc.ref);
          }
        });
      }
      _initialLoadDone = true;
    },
    err => console.warn('[presence] inbox:', err.message),
  );
}

// ── Send a reply from the user to admin ──────────────────
export async function sendUserMessage(text) {
  if (!_userId || !text) return;
  await addDoc(collection(db, 'admin_messages', _userId, 'inbox'), {
    message: text,
    from:    'user',
    sentAt:  serverTimestamp(),
    read:    true, // user's own message — no unread badge for themselves
  });
}

// ── Mark all admin messages as read ──────────────────────
export function markAllMessagesRead() {
  _allMessages.forEach(m => {
    if (!m.read) {
      m.read = true; // optimistic
      updateDoc(m.ref, { read: true }).catch(() => {});
    }
  });
}

// ── Update avatar in presence (call after user changes avatar) ──────────
export async function updatePresenceAvatar() {
  if (!_presenceRef) return;
  const avatar = await _getPresenceAvatar();
  setDoc(_presenceRef, { avatar: avatar ?? null }, { merge: true }).catch(() => {});
}

// ── Cleanup ───────────────────────────────────────────────
export function destroyPresence() {
  if (_heartbeat)  { clearInterval(_heartbeat); _heartbeat = null; }
  if (_inboxUnsub) { _inboxUnsub(); _inboxUnsub = null; }
  if (_setOffline) { window.removeEventListener('beforeunload', _setOffline); _setOffline = null; }
  _setOnline = null;
  _onMessagesUpdate = null;
  _allMessages = [];
  _userId = null;
  _clickCount = 0;
  _sessionStartMs = null;
  _presenceRef = null;
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
      // Downscale to 48px thumbnail — lightweight for Firestore
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

function _showMessage(data, docRef) {
  const label = data.broadcastId ? 'Envoyé à tous' : 'Admin';
  const toast = document.createElement('div');
  toast.className = 'admin-toast';
  toast.innerHTML = `
    <span class="admin-toast__icon">📣</span>
    <div class="admin-toast__body">
      <p class="admin-toast__label">${label}</p>
      <p class="admin-toast__text">${_esc(data.message)}</p>
    </div>
    <button class="admin-toast__close" aria-label="Fermer">✕</button>
  `;
  document.body.appendChild(toast);

  // Only dismiss + mark as read when the user explicitly clicks ✕
  toast.querySelector('.admin-toast__close').addEventListener('click', () => {
    updateDoc(docRef, { read: true }).catch(() => {});
    toast.classList.add('admin-toast--out');
    setTimeout(() => toast.remove(), 300);
  });
}

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
