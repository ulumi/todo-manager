// ════════════════════════════════════════════════════════
//  SYNC — Firestore read / write / realtime
// ════════════════════════════════════════════════════════

import {
  doc, getDoc, setDoc, deleteDoc, onSnapshot, serverTimestamp, deleteField,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

// Unique ID for this browser session — used to detect own Firestore echoes.
// Never matches a previous session (even on the same device) since it's regenerated on each page load.
export const SESSION_ID = Math.random().toString(36).slice(2, 10);

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
// Includes SESSION_ID so the realtime listener can skip our own echoes.
export async function pushToFirestore(backup) {
  try {
    await setDoc(userDocRef(), { ...backup, updatedAt: serverTimestamp(), _pushedBySession: SESSION_ID });
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
    if (snap.metadata.fromCache) return; // stale cache, skip
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

// ── iCal token (stored in users/{uid}/data/main as icalSecret) ────────────
// Token format: "{uid}_{secret}" — uid embedded for direct doc read, no query.
// Secret stored in data/main (same doc as todos) — guaranteed writable.

function genSecret() {
  return crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function getOrCreateICalToken() {
  const user = getCurrentUser();
  const uid = user?.uid;
  const cached = localStorage.getItem('icalToken');

  if (!uid) return cached || null;

  try {
    const snap = await getDoc(userDocRef());
    if (snap.exists() && snap.data().icalSecret) {
      const token = uid + '_' + snap.data().icalSecret;
      localStorage.setItem('icalSecret', snap.data().icalSecret);
      localStorage.setItem('icalToken', token);
      return token;
    }
    // No secret in Firestore yet — generate and merge into data/main
    const secret = genSecret();
    await setDoc(userDocRef(), { icalSecret: secret }, { merge: true });
    localStorage.setItem('icalSecret', secret);
    const token = uid + '_' + secret;
    localStorage.setItem('icalToken', token);
    return token;
  } catch {
    // Offline — reuse cached if valid for this user, otherwise generate locally
    if (cached && cached.startsWith(uid + '_')) return cached;
    const secret = genSecret();
    localStorage.setItem('icalSecret', secret);
    const token = uid + '_' + secret;
    localStorage.setItem('icalToken', token);
    return token;
  }
}

// ── Google Calendar disconnect ────────────────────────────
export async function disconnectGCal() {
  try {
    await setDoc(userDocRef(), {
      gcalConnected:    deleteField(),
      gcalRefreshToken: deleteField(),
      gcalEventIds:     deleteField(),
      gcalLastSync:     deleteField(),
    }, { merge: true });
    localStorage.removeItem('gcalConnected');
  } catch (err) {
    console.warn('[sync] disconnectGCal failed:', err.message);
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
