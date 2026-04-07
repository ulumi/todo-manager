// Vercel Serverless Function — GET /api/admin-presence

const { supabase, verifyAdmin, corsHeaders } = require('./_supabase');

module.exports = async function handler(req, res) {
  corsHeaders(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  if (!await verifyAdmin(req)) { res.status(403).json({ error: 'Forbidden' }); return; }

  const { data, error } = await supabase
    .from('presence')
    .select('*')
    .eq('online', true);

  if (error) { res.status(500).json({ error: error.message }); return; }

  const online = (data || []).map(d => ({
    uid:          d.user_id,
    online:       d.online,
    email:        d.email,
    displayName:  d.display_name,
    isAnonymous:  d.is_anonymous,
    clickCount:   d.click_count,
    avatar:       d.avatar,
    lastSeen:     d.last_seen ? new Date(d.last_seen).getTime() : null,
    sessionStart: d.session_start ? new Date(d.session_start).getTime() : null,
  }));
  res.status(200).json(online);
};
