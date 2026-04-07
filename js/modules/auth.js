// ════════════════════════════════════════════════════════
//  AUTH — guest, login, register, upgrade, logout (Supabase)
// ════════════════════════════════════════════════════════

import { supabase } from './supabase.js';

// ── State ────────────────────────────────────────────────
let _currentUser = null;
let _onUserChange = null; // callback(user)

// ── Normalise Supabase user → app-level user object ──────
// Provides a consistent shape with the fields the rest of the
// app relies on (uid, email, displayName, isAnonymous).
function _wrap(supaUser) {
  if (!supaUser) return null;
  return {
    uid:          supaUser.id,
    email:        supaUser.email,
    displayName:  supaUser.user_metadata?.display_name || supaUser.user_metadata?.full_name || '',
    isAnonymous:  supaUser.is_anonymous ?? (!supaUser.email),
    providerData: supaUser.app_metadata?.providers?.map(p => ({ providerId: p })) || [],
    // Keep the raw Supabase user accessible if needed
    _raw: supaUser,
  };
}

// ── Init ─────────────────────────────────────────────────
// Call once at boot. Resolves when the first auth state is known.
export function initAuth() {
  return new Promise(resolve => {
    // Listen for auth state changes
    supabase.auth.onAuthStateChange((_event, session) => {
      _currentUser = _wrap(session?.user ?? null);
      if (_onUserChange) _onUserChange(_currentUser);
    });

    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      _currentUser = _wrap(session?.user ?? null);
      resolve(_currentUser);
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

// Returns a fresh Supabase access token (for server requests)
export async function getIdToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

// ── Guest sign-in ─────────────────────────────────────────
// Signs in anonymously. If already signed in, does nothing.
export async function signInGuest() {
  if (_currentUser) return _currentUser;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return _wrap(data.user);
}

// ── Email / password ──────────────────────────────────────
export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return _wrap(data.user);
}

export async function registerWithEmail(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return _wrap(data.user);
}

// ── Upgrade guest → real account ─────────────────────────
// Links the anonymous account to email/password.
// The uid stays the same — all data is preserved automatically.
export async function upgradeGuestToEmail(email, password) {
  const { data, error } = await supabase.auth.updateUser({ email, password });
  if (error) throw error;
  return _wrap(data.user);
}

// ── Google / Facebook OAuth ───────────────────────────────
// For guests: Supabase anonymous→OAuth linking happens automatically
// if the anonymous session is active when signInWithOAuth is called.
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
  // OAuth redirects — user state will be updated via onAuthStateChange
}

export async function signInWithFacebook() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'facebook',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

// ── Update profile ────────────────────────────────────────
export async function updateUserProfile(displayName) {
  if (!_currentUser) return;
  const { error } = await supabase.auth.updateUser({
    data: { display_name: displayName },
  });
  if (error) throw error;
  // Update local cache immediately
  if (_currentUser) _currentUser.displayName = displayName;
}

// ── Sign out ──────────────────────────────────────────────
export async function signOut() {
  await supabase.auth.signOut();
  // Re-sign in as guest automatically so the app is never unauthenticated
  await signInGuest();
}
