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
  doc, setDoc, updateDoc, collection, query, where,
  onSnapshot, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

import { db } from './firebase.js';

let _heartbeat  = null;
let _inboxUnsub = null;
let _setOffline = null;

// ── Init ─────────────────────────────────────────────────
// Call after every auth state change that yields a real user.
export function initPresence(user) {
  destroyPresence();

  const presenceRef = doc(db, 'presence', user.uid);

  const setOnline = () => setDoc(presenceRef, {
    online:      true,
    lastSeen:    serverTimestamp(),
    email:       user.email       || null,
    displayName: user.displayName || null,
    isAnonymous: user.isAnonymous,
  }, { merge: true }).catch(() => {});

  _setOffline = () => setDoc(presenceRef, {
    online:   false,
    lastSeen: serverTimestamp(),
  }, { merge: true }).catch(() => {});

  setOnline();
  _heartbeat = setInterval(setOnline, 30_000);

  window.addEventListener('beforeunload', _setOffline);
  document.addEventListener('visibilitychange', _onVisibility);

  // Listen for unread admin messages
  const inboxRef = collection(db, 'admin_messages', user.uid, 'inbox');
  _inboxUnsub = onSnapshot(
    query(inboxRef, where('read', '==', false)),
    snap => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          _showMessage(change.doc.data().message, change.doc.ref);
        }
      });
    },
    err => console.warn('[presence] inbox:', err.message),
  );
}

// ── Cleanup ───────────────────────────────────────────────
export function destroyPresence() {
  if (_heartbeat)  { clearInterval(_heartbeat); _heartbeat = null; }
  if (_inboxUnsub) { _inboxUnsub(); _inboxUnsub = null; }
  if (_setOffline) {
    window.removeEventListener('beforeunload', _setOffline);
    _setOffline = null;
  }
  document.removeEventListener('visibilitychange', _onVisibility);
}

// ── Internals ─────────────────────────────────────────────
function _onVisibility() {
  if (_setOffline) document.hidden ? _setOffline() : null;
}

function _showMessage(message, docRef) {
  const toast = document.createElement('div');
  toast.className = 'admin-toast';
  toast.innerHTML = `
    <span class="admin-toast__icon">📣</span>
    <div class="admin-toast__body">
      <p class="admin-toast__label">Admin</p>
      <p class="admin-toast__text">${_esc(message)}</p>
    </div>
    <button class="admin-toast__close" aria-label="Fermer">✕</button>
  `;
  document.body.appendChild(toast);

  // Mark as read after a short delay
  setTimeout(() => updateDoc(docRef, { read: true }).catch(() => {}), 800);

  const dismiss = () => {
    toast.classList.add('admin-toast--out');
    setTimeout(() => toast.remove(), 300);
  };
  toast.querySelector('.admin-toast__close').addEventListener('click', dismiss);
  setTimeout(dismiss, 12_000);
}

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
