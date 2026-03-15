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

  const presenceRef = doc(db, 'presence', user.uid);

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
  document.removeEventListener('click', _onUserClick, { capture: true });
  document.removeEventListener('visibilitychange', _onVisibility);
}

// ── Internals ─────────────────────────────────────────────
let _setOnline = null;

function _onUserClick() { _clickCount++; }

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
