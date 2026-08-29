// ════════════════════════════════════════════════════════
//  SYNC — Supabase read / write / realtime
// ════════════════════════════════════════════════════════

import { supabase }      from './supabase.js';
import { getCurrentUser } from './auth.js';

// Unique ID for this browser session — used to detect own echoes.
export const SESSION_ID = Math.random().toString(36).slice(2, 10);

// ── Connection status tracking (debug panel) ──────────────
// `_lastOk` mirrors the outcome of the most recent Supabase call — null
// (unknown, treated as "online") until the first call resolves.
let _lastOk = null;
let _lastCheckedAt = 0;

function _markSupabaseOk()   { _lastOk = true;  _lastCheckedAt = Date.now(); }
function _markSupabaseFail() { _lastOk = false; _lastCheckedAt = Date.now(); }

// Best-known Supabase reachability, powers the debug panel near the version
// number. Requires both the browser to be online AND the last Supabase call
// to have succeeded — either one failing means the app is running off
// localStorage only.
export function getSupabaseStatus() {
  return {
    online: navigator.onLine && _lastOk !== false,
    lastCheckedAt: _lastCheckedAt,
  };
}

// ── Helpers ───────────────────────────────────────────────
function userId() {
  const user = getCurrentUser();
  if (!user) throw new Error('sync: no authenticated user');
  return user.uid;
}

// ── One-time read from Supabase ──────────────────────────
// Returns the stored backup object (with _supabaseUpdatedAt in ms),
// { _empty: true } if no row exists yet (new user),
// or null on network / auth error.
export async function loadFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('data, updated_at')
      .eq('user_id', userId())
      .maybeSingle();

    if (error) throw error;
    _markSupabaseOk();
    if (!data) return { _empty: true };

    return {
      ...data.data,
      _supabaseUpdatedAt: new Date(data.updated_at).getTime(),
    };
  } catch (err) {
    console.warn('[sync] loadFromSupabase failed:', err.message);
    _markSupabaseFail();
    return null;
  }
}

// ── Write full backup to Supabase ────────────────────────
// Fire-and-forget: does not throw, caller doesn't need to await.
// Includes SESSION_ID so the realtime listener can skip our own echoes.
export async function pushToSupabase(backup) {
  try {
    const uid = userId();
    const clean = JSON.parse(JSON.stringify(backup));

    // Ce push REMPLACE `data` : toute clé absente de getFullBackup() serait
    // donc détruite à chaque écriture du navigateur. C'est ce qui effaçait la
    // demande de passage de l'agent quelques secondes après le clic — le
    // serveur l'écrivait, le premier push du navigateur l'emportait.
    // On relit la ligne et on repose telles quelles les clés qu'on ne
    // possède pas, au lieu de les écraser avec rien. Une lecture par push
    // (déjà débouncé à 1,2 s) est un prix acceptable pour que le serveur
    // puisse écrire dans cette ligne sans être systématiquement piétiné.
    let preserved = {};
    try {
      const { data: cur } = await supabase.from('user_data').select('data').eq('user_id', uid).maybeSingle();
      const mine = new Set([...Object.keys(clean), '_pushedBySession']);
      for (const [k, v] of Object.entries(cur?.data || {})) if (!mine.has(k)) preserved[k] = v;
    } catch { /* lecture impossible : on écrit quand même, mieux vaut publier que bloquer */ }

    const { error } = await supabase
      .from('user_data')
      .upsert({
        user_id:    uid,
        data:       { ...preserved, ...clean, _pushedBySession: SESSION_ID },
        updated_at: new Date().toISOString(),
      });
    if (error) throw error;
    _markSupabaseOk();
  } catch (err) {
    console.warn('[sync] pushToSupabase failed:', err.message);
    _markSupabaseFail();
  }
}

// ── Realtime listener ─────────────────────────────────────
// Calls `onData(backup)` every time the user_data row changes
// (from another device, tab, or external update).
// Returns an unsubscribe function.
export function subscribeToSupabase(onData) {
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
export async function deleteUserData() {
  try {
    const { error } = await supabase
      .from('user_data')
      .delete()
      .eq('user_id', userId());
    if (error) throw error;
  } catch (err) {
    console.warn('[sync] deleteUserData failed:', err.message);
  }
}

// ── Feed & API tokens ────────────────────────────────────
// Token format: "{uid}_{secret}" — the uid travels in the token so a
// server-side handler can read that row directly (a bare secret wouldn't say
// whose row to look in).
//
// TWO independent secrets, deliberately never shared:
//   icalSecret → /api/ical           READ-only  (pasted into Google/Apple Calendar)
//   apiSecret  → /api/tasks, /api/mcp READ-WRITE (Claude connector, scripts)
// One secret for both would mean every calendar app that ever received the
// feed URL also holds write access to the task list.

function genSecret() {
  return crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Reads the secret stored in the user_data row, creating it on first use.
// Offline fallback generates one locally: it isn't valid server-side yet, but
// getFullBackup() carries both secrets, so the next successful push writes it
// into the row and the token starts working — no dead-end state.
async function getOrCreateSecretToken(field, tokenKey) {
  const user   = getCurrentUser();
  const uid    = user?.uid;
  const cached = localStorage.getItem(tokenKey);

  if (!uid) return cached || null;

  const remember = (secret) => {
    localStorage.setItem(field, secret);
    const token = uid + '_' + secret;
    localStorage.setItem(tokenKey, token);
    return token;
  };

  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('data')
      .eq('user_id', uid)
      .maybeSingle();

    if (error) throw error;
    if (data?.data?.[field]) return remember(data.data[field]);

    // No secret yet — generate and merge into data
    const secret   = genSecret();
    const existing = data?.data || {};
    await supabase
      .from('user_data')
      .upsert({
        user_id: uid,
        data: { ...existing, [field]: secret },
        updated_at: new Date().toISOString(),
      });
    return remember(secret);
  } catch {
    // Offline — reuse cached if valid for this user, otherwise generate locally
    if (cached && cached.startsWith(uid + '_')) return cached;
    return remember(genSecret());
  }
}

export function getOrCreateICalToken() {
  return getOrCreateSecretToken('icalSecret', 'icalToken');
}

export function getOrCreateApiToken() {
  return getOrCreateSecretToken('apiSecret', 'apiToken');
}

// Reissue the API secret: every URL built from the old one stops working at
// once, which is the whole point (a connector URL pasted somewhere it
// shouldn't have been). Writes straight to the row rather than going through
// the debounced push, so revocation is immediate.
//
// A tab elsewhere that still holds the OLD secret in localStorage would put it
// back on its next full-row push; the Realtime broadcast of this write reaches
// it first and _applyBackup() updates its copy, closing that window.
export async function regenerateApiToken() {
  const uid = getCurrentUser()?.uid;
  if (!uid) throw new Error('no authenticated user');

  const { data, error } = await supabase
    .from('user_data')
    .select('data')
    .eq('user_id', uid)
    .maybeSingle();
  if (error) throw error;

  const secret = genSecret();
  const { error: upsertError } = await supabase
    .from('user_data')
    .upsert({
      user_id: uid,
      data: { ...(data?.data || {}), apiSecret: secret },
      updated_at: new Date().toISOString(),
    });
  if (upsertError) throw upsertError;

  localStorage.setItem('apiSecret', secret);
  const token = uid + '_' + secret;
  localStorage.setItem('apiToken', token);
  return token;
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
  // 'online'/'offline' only fire on transitions — a page loaded while
  // already offline gets neither, so the badge stayed hidden until one
  // full connect/disconnect cycle happened. Check the actual state once.
  if (badge) badge.hidden = navigator.onLine;
  window.addEventListener('online',  () => { if (badge) badge.hidden = true; });
  window.addEventListener('offline', () => { if (badge) badge.hidden = false; _markSupabaseFail(); });
}
