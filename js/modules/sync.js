// ════════════════════════════════════════════════════════
//  SYNC — Firestore read / write / realtime
// ════════════════════════════════════════════════════════

import {
  doc, getDoc, setDoc, deleteDoc, onSnapshot, serverTimestamp,
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
// Returns the stored backup object (with _firestoreUpdatedAt in ms), or null.
export async function loadFromFirestore() {
  try {
    const snap = await getDoc(userDocRef());
    if (!snap.exists()) return null;
    const { updatedAt, ...data } = snap.data();
    return { ...data, _firestoreUpdatedAt: updatedAt?.toMillis() ?? 0 };
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

  return onSnapshot(ref, { includeMetadataChanges: true }, snap => {
    // Skip cache-only snapshots — could be stale and would overwrite newer local data
    if (snap.metadata.fromCache) return;
    if (!snap.exists()) return;
    const { updatedAt, ...data } = snap.data();
    onData(data);
  }, err => {
    console.warn('[sync] onSnapshot error:', err.message);
  });
}

// ── Delete user Firestore doc ─────────────────────────────
export async function deleteUserFirestoreDoc() {
  try {
    await deleteDoc(userDocRef());
  } catch (err) {
    console.warn('[sync] deleteUserFirestoreDoc failed:', err.message);
  }
}

// ── Offline / online indicator ────────────────────────────
export function setupOfflineIndicator() {
  const badge = document.getElementById('offlineBadge');
  if (!badge) return;

  // Don't check navigator.onLine on init — it's unreliable in some environments.
  // The badge starts hidden (via HTML attribute); show it only when an actual
  // offline event fires.
  window.addEventListener('online',  () => { badge.hidden = true; });
  window.addEventListener('offline', () => { badge.hidden = false; });
}
