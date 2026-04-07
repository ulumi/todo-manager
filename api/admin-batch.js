// Vercel Serverless Function — POST /api/admin-batch
// Body: { action: 'delete-anon' }
//       { action: 'broadcast', message: '...' }
//       { action: 'clean-sessions' }

const { supabase, ADMIN_UIDS, verifyAdmin, corsHeaders, parseBody } = require('./_supabase');

module.exports = async function handler(req, res) {
  corsHeaders(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!await verifyAdmin(req)) { res.status(403).json({ error: 'Forbidden' }); return; }

  const payload = await parseBody(req);

  try {
    // ── Delete all anonymous accounts ─────────────────────
    if (payload.action === 'delete-anon') {
      const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const anons = (authData?.users || []).filter(u =>
        (u.is_anonymous || !u.email) && !ADMIN_UIDS.includes(u.id)
      );
      await Promise.all(anons.map(u => supabase.auth.admin.deleteUser(u.id)));
      res.status(200).json({ ok: true, deleted: anons.length });

    // ── Broadcast message to all users ────────────────────
    } else if (payload.action === 'broadcast') {
      const { message, showPublicTag = true } = payload;
      if (!message) { res.status(400).json({ error: 'Missing message' }); return; }

      const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const targets = authData?.users || [];

      // Insert broadcast record
      const { data: broadcast } = await supabase
        .from('broadcasts')
        .insert({ message, sent_at: new Date().toISOString(), recipient_count: targets.length })
        .select('id')
        .single();

      const broadcastId = broadcast?.id || null;

      // Insert inbox message for each user
      const messages = targets.map(u => ({
        user_id:      u.id,
        message,
        sender:       'admin',
        sent_at:      new Date().toISOString(),
        read:         false,
        broadcast_id: showPublicTag ? broadcastId : null,
      }));
      if (messages.length) {
        await supabase.from('admin_messages').insert(messages);
      }
      res.status(200).json({ ok: true, sent: targets.length, broadcastId });

    // ── Clean stale presence sessions ─────────────────────
    } else if (payload.action === 'clean-sessions') {
      const TWO_HOURS = 2 * 60 * 60 * 1000;
      const cutoff = new Date(Date.now() - TWO_HOURS).toISOString();
      const { data: stale } = await supabase
        .from('presence')
        .update({ online: false })
        .eq('online', true)
        .lt('last_seen', cutoff)
        .select('user_id');
      res.status(200).json({ ok: true, cleaned: stale?.length || 0 });

    } else {
      res.status(400).json({ error: `Unknown action: ${payload.action}` });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
