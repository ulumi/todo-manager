// ════════════════════════════════════════════════════════
//  AUTH — guest, login, register, upgrade, logout
// ════════════════════════════════════════════════════════

import {
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  linkWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  linkWithPopup,
  browserPopupRedirectResolver,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';

import { auth } from './firebase.js';

// ── State ────────────────────────────────────────────────
let _currentUser = null;
let _onUserChange = null; // callback(user)

// ── Init ─────────────────────────────────────────────────
// Call once at boot. Resolves when the first auth state is known.
export function initAuth() {
  return new Promise(resolve => {
    onAuthStateChanged(auth, async user => {
      // Firebase keeps isAnonymous=true after linkWithPopup — reload to fix
      if (user?.isAnonymous && user.providerData.length > 0) {
        await user.reload();
        user = auth.currentUser;
      }
      _currentUser = user;
      if (_onUserChange) _onUserChange(user);
      resolve(user);
    });
  });
}

// Register a callback fired on every auth state change after init
export function onUserChange(cb) {
  _onUserChange = cb;
}

export function getCurrentUser() {
  return _currentUser;
}

export function isGuest() {
  return _currentUser?.isAnonymous ?? false;
}

// Returns a fresh Firebase ID token (for server requests)
export async function getIdToken() {
  if (!_currentUser) return null;
  return _currentUser.getIdToken();
}

// ── Guest sign-in ─────────────────────────────────────────
// Signs in anonymously. If already signed in, does nothing.
export async function signInGuest() {
  if (_currentUser) return _currentUser;
  const { user } = await signInAnonymously(auth);
  return user;
}

// ── Email / password ──────────────────────────────────────
export async function signInWithEmail(email, password) {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  return user;
}

export async function registerWithEmail(email, password) {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  return user;
}

// ── Upgrade guest → real account ─────────────────────────
// Links the anonymous account to email/password.
// The uid stays the same — all data is preserved automatically.
export async function upgradeGuestToEmail(email, password) {
  const credential = EmailAuthProvider.credential(email, password);
  const { user } = await linkWithCredential(_currentUser, credential);
  await user.reload();
  return user;
}

// ── Google / Facebook OAuth ───────────────────────────────
// For guests: links the anonymous account (preserves uid + data).
// For registered users: signs in with the provider.
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  if (_currentUser?.isAnonymous) {
    const { user } = await linkWithPopup(_currentUser, provider, browserPopupRedirectResolver);
    await user.reload();
    return user;
  }
  const { user } = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
  return user;
}

export async function signInWithFacebook() {
  const provider = new FacebookAuthProvider();
  if (_currentUser?.isAnonymous) {
    const { user } = await linkWithPopup(_currentUser, provider, browserPopupRedirectResolver);
    await user.reload();
    return user;
  }
  const { user } = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
  return user;
}

// ── Update profile ────────────────────────────────────────
export async function updateUserProfile(displayName) {
  if (!_currentUser) return;
  await updateProfile(_currentUser, { displayName });
}

// ── Sign out ──────────────────────────────────────────────
export async function signOut() {
  await firebaseSignOut(auth);
  // Re-sign in as guest automatically so the app is never unauthenticated
  await signInGuest();
}
