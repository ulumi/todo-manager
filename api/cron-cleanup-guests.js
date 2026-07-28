// Vercel Cron — GET /api/cron-cleanup-guests
// Runs daily at 3 h UTC. Cleans up:
//   1. Anonymous accounts inactive for > 48 h
//   2. Orphan presence/messages for deleted users

import { supabase, ADMIN_UIDS } from './_supabase.js';

const FORTY_EIGHT_H = 48 * 60 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.status(405).end(); return; }

  const secret = process.env.CRON_SECRET;
  if (secret && req.headers['authorization'] !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'Unauthorized' }); return;
  }

  try {
    const now = Date.now();

    // ── 1. Stale anonymous accounts (48h+ inactive) ──────
    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const users = authData?.users || [];

    const staleGuests = users.filter(u => {
      if (ADMIN_UIDS.includes(u.id)) return false;
      // Positive proof required: only ever delete accounts Supabase itself
      // marked anonymous. The previous check ("not anonymous AND has an
      // email" ⇒ protected) failed open for any real account whose email
      // field is empty for any reason (OAuth account Supabase didn't
      // populate, phone auth, migration edge case) — those fell through
      // to the same 48h-inactivity deletion as actual stale guests.
      if (u.is_anonymous !== true) return false;
      const lastSignIn = new Date(u.last_sign_in_at || u.created_at).getTime();
      return lastSignIn < now - FORTY_EIGHT_H;
    });

    // Also check presence for more accurate last_seen
    const { data: presenceData } = await supabase
      .from('presence')
      .select('user_id, last_seen, is_anonymous')
      .eq('is_anonymous', true);

    const presenceMap = {};
    (presenceData || []).forEach(p => { presenceMap[p.user_id] = new Date(p.last_seen).getTime(); });

    // Filter: only delete if presence also confirms staleness
    const toDelete = staleGuests.filter(u => {
      const presenceLastSeen = presenceMap[u.id];
      if (presenceLastSeen && presenceLastSeen > now - FORTY_EIGHT_H) return false;
      return true;
    });

    for (const u of toDelete) {
      await supabase.auth.admin.deleteUser(u.id).catch(() => {});
    }

    // Clean up presence + messages for deleted users
    const deletedIds = toDelete.map(u => u.id);
    if (deletedIds.length) {
      await supabase.from('presence').delete().in('user_id', deletedIds);
      await supabase.from('admin_messages').delete().in('user_id', deletedIds);
    }

    // NOTE: this used to also auto-delete any banned account inactive for
    // 7+ days. Removed: admin-user-action.js's "disable" sets a ~100-year
    // ban as a reversible pause, distinct from its own explicit "delete"
    // action — silently converting a disable into a permanent deletion
    // after 7 days undermined that distinction. An admin who wants a
    // banned account gone should use "delete" directly.

    const summary = { guests: toDelete.length };
    console.log('[cron-cleanup-guests]', summary);
    res.status(200).json({ ok: true, ...summary });
  } catch (e) {
    console.error('[cron-cleanup-guests]', e.message);
    res.status(500).json({ error: e.message });
  }
};
