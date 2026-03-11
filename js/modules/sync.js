// ════════════════════════════════════════════════════════
//  SYNC — Firestore read / write / realtime
// ════════════════════════════════════════════════════════

import {
  doc, getDoc, setDoc, onSnapshot, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

import { db }             from './firebase.js';
import { getCurrentUser } from './auth.js';

// ── Helpers ───────────────────────────────────────────────
function userDocRef() {
  const user = getCurrentUser();
  if (!user) throw new Error('sync: no authenticated user');
  return doc(db, 'users', user.uid, 'data', 'main');
}

// ── One-time read from Firestore ──────────────────────────
// Returns the stored backup object, or null if none exists.
export async function loadFromFirestore() {
  try {
    const snap = await getDoc(userDocRef());
    if (!snap.exists()) return null;
    const { updatedAt, ...data } = snap.data();
    return data;
  } catch (err) {
    console.warn('[sync] loadFromFirestore failed:', err.message);
    return null;
  }
}

// ── Write full backup to Firestore ────────────────────────
// Fire-and-forget: does not throw, caller doesn't need to await.
export async function pushToFirestore(backup) {
  try {
    await setDoc(userDocRef(), { ...backup, updatedAt: serverTimestamp() });
  } catch (err) {
    console.warn('[sync] pushToFirestore failed:', err.message);
  }
}

// ── Realtime listener ─────────────────────────────────────
// Calls `onData(backup)` every time the Firestore doc changes
// (from another device, tab, or external update).
// Returns an unsubscribe function.
export function subscribeToFirestore(onData) {
  let ref;
  try {
    ref = userDocRef();
  } catch {
    return () => {}; // no user yet
  }

  return onSnapshot(ref, snap => {
    if (!snap.exists()) return;
    const { updatedAt, ...data } = snap.data();
    onData(data);
  }, err => {
    console.warn('[sync] onSnapshot error:', err.message);
  });
}

// ── Offline / online indicator ────────────────────────────
let _unsubOffline = null;

export function setupOfflineIndicator() {
  const badge = document.getElementById('offlineBadge');
  if (!badge) return;

  function update() {
    badge.hidden = navigator.onLine;
  }

  update();
  window.addEventListener('online',  update);
  window.addEventListener('offline', update);

  _unsubOffline = () => {
    window.removeEventListener('online',  update);
    window.removeEventListener('offline', update);
  };
}

export function teardownOfflineIndicator() {
  if (_unsubOffline) { _unsubOffline(); _unsubOffline = null; }
}
