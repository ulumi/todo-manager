// ════════════════════════════════════════════════════════
//  SYNC — Supabase read / write / realtime
//  (replaces Firestore sync)
// ════════════════════════════════════════════════════════

import { supabase }      from './supabase.js';
import { getCurrentUser } from './auth.js';

// Unique ID for this browser session — used to detect own echoes.
export const SESSION_ID = Math.random().toString(36).slice(2, 10);

// ── Helpers ───────────────────────────────────────────────
function userId() {
  const user = getCurrentUser();
  if (!user) throw new Error('sync: no authenticated user');
  return user.uid;
}

// ── One-time read from Supabase ──────────────────────────
// Returns the stored backup object (with _firestoreUpdatedAt in ms),
// { _empty: true } if no row exists yet (new user),
// or null on network / auth error.
export async function loadFromFirestore() {
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('data, updated_at')
      .eq('user_id', userId())
      .maybeSingle();

    if (error) throw error;
    if (!data) return { _empty: true };

    return {
      ...data.data,
      _firestoreUpdatedAt: new Date(data.updated_at).getTime(),
    };
  } catch (err) {
    console.warn('[sync] loadFromFirestore failed:', err.message);
    return null;
  }
}

// ── Write full backup to Supabase ────────────────────────
// Fire-and-forget: does not throw, caller doesn't need to await.
// Includes SESSION_ID so the realtime listener can skip our own echoes.
export async function pushToFirestore(backup) {
  try {
    const uid = userId();
    const clean = JSON.parse(JSON.stringify(backup));
    const { error } = await supabase
      .from('user_data')
      .upsert({
        user_id:    uid,
        data:       { ...clean, _pushedBySession: SESSION_ID },
        updated_at: new Date().toISOString(),
      });
    if (error) throw error;
  } catch (err) {
    console.warn('[sync] pushToFirestore failed:', err.message);
  }
}

// ── Realtime listener ─────────────────────────────────────
// Calls `onData(backup)` every time the user_data row changes
// (from another device, tab, or external update).
// Returns an unsubscribe function.
export function subscribeToFirestore(onData) {
  let uid;
  try { uid = userId(); } catch { return () => {}; }

  const channel = supabase
    .channel(`user_data:${uid}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_data',
        filter: `user_id=eq.${uid}`,
      },
      (payload) => {
        const row = payload.new;
        if (!row?.data) return;
        onData(row.data);
      },
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

// ── Delete user data row ─────────────────────────────────
export async function deleteUserFirestoreDoc() {
  try {
    const { error } = await supabase
      .from('user_data')
      .delete()
      .eq('user_id', userId());
    if (error) throw error;
  } catch (err) {
    console.warn('[sync] deleteUserFirestoreDoc failed:', err.message);
  }
}

// ── iCal token ───────────────────────────────────────────
// Token format: "{uid}_{secret}" — uid embedded for direct row read.

function genSecret() {
  return crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function getOrCreateICalToken() {
  const user = getCurrentUser();
  const uid = user?.uid;
  const cached = localStorage.getItem('icalToken');

  if (!uid) return cached || null;

  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('data')
      .eq('user_id', uid)
      .maybeSingle();

    if (error) throw error;

    if (data?.data?.icalSecret) {
      const token = uid + '_' + data.data.icalSecret;
      localStorage.setItem('icalSecret', data.data.icalSecret);
      localStorage.setItem('icalToken', token);
      return token;
    }

    // No secret yet — generate and merge into data
    const secret = genSecret();
    const existing = data?.data || {};
    await supabase
      .from('user_data')
      .upsert({
        user_id: uid,
        data: { ...existing, icalSecret: secret },
        updated_at: new Date().toISOString(),
      });
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
    const uid = userId();
    const { data } = await supabase
      .from('user_data')
      .select('data')
      .eq('user_id', uid)
      .maybeSingle();

    if (data?.data) {
      const { gcalConnected, gcalRefreshToken, gcalEventIds, gcalLastSync, ...rest } = data.data;
      await supabase
        .from('user_data')
        .upsert({
          user_id: uid,
          data: rest,
          updated_at: new Date().toISOString(),
        });
    }
    localStorage.removeItem('gcalConnected');
  } catch (err) {
    console.warn('[sync] disconnectGCal failed:', err.message);
  }
}

// ── Offline / online indicator ────────────────────────────
export function setupOfflineIndicator() {
  const badge = document.getElementById('offlineBadge');
  if (!badge) return;
  window.addEventListener('online',  () => { badge.hidden = true; });
  window.addEventListener('offline', () => { badge.hidden = false; });
}
