// Vercel Serverless Function — GET /api/admin-messages?uid=xxx  /  POST send

const { supabase, verifyAdmin, corsHeaders, parseBody } = require('./_supabase');

module.exports = async function handler(req, res) {
  corsHeaders(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  if (!await verifyAdmin(req)) { res.status(403).json({ error: 'Forbidden' }); return; }

  // GET /api/admin-messages?incoming=N — recent user→admin messages
  if (req.method === 'GET' && req.query?.incoming) {
    const limit = Math.min(parseInt(req.query.incoming) || 5, 20);
    const { data, error } = await supabase
      .from('admin_messages')
      .select('*')
      .eq('sender', 'user')
      .order('sent_at', { ascending: false })
      .limit(limit);

    if (error) { res.status(500).json({ error: error.message }); return; }

    const msgs = (data || []).map(m => ({
      id: m.id, uid: m.user_id, message: m.message,
      from: 'user', sentAt: new Date(m.sent_at).getTime(), read: m.read,
    }));
    res.status(200).json(msgs);

  // GET /api/admin-messages?broadcasts=1 — fetch broadcast history
  } else if (req.method === 'GET' && req.query?.broadcasts) {
    const { data } = await supabase
      .from('broadcasts')
      .select('*')
      .order('sent_at', { ascending: false });

    const list = (data || []).map(b => ({
      id: b.id, message: b.message, from: 'admin',
      sentAt: new Date(b.sent_at).getTime(),
      recipientCount: b.recipient_count, broadcast: true,
    }));
    res.status(200).json(list);

  // GET /api/admin-messages?uid=xxx — fetch user thread
  } else if (req.method === 'GET') {
    const uid = req.query?.uid;
    if (!uid) { res.status(400).json({ error: 'Missing uid' }); return; }

    const { data } = await supabase
      .from('admin_messages')
      .select('*')
      .eq('user_id', uid)
      .order('sent_at', { ascending: true });

    const msgs = (data || []).map(m => ({
      id: m.id, message: m.message, from: m.sender,
      sentAt: new Date(m.sent_at).getTime(), read: m.read,
      broadcastId: m.broadcast_id,
    }));
    res.status(200).json(msgs);

  // POST /api/admin-messages — send a message
  } else if (req.method === 'POST') {
    const { uid, message } = await parseBody(req);
    if (!uid || !message) { res.status(400).json({ error: 'Missing uid or message' }); return; }

    await supabase.from('admin_messages').insert({
      user_id: uid, message, sender: 'admin',
      sent_at: new Date().toISOString(), read: false,
    });
    res.status(200).json({ ok: true });

  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
