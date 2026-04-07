// Vercel Serverless Function — GET /api/admin-stats

import { supabase, verifyAdmin, corsHeaders } from './_supabase.js';

export default async function handler(req, res) {
  corsHeaders(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!await verifyAdmin(req)) { res.status(403).json({ error: 'Forbidden' }); return; }

  try {
    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const users = authData?.users || [];
    const now = Date.now();
    const DAY = 86_400_000;

    const ms = t => t ? new Date(t).getTime() : 0;

    res.status(200).json({
      total:      users.length,
      registered: users.filter(u => !u.is_anonymous && u.email).length,
      anonymous:  users.filter(u => u.is_anonymous || !u.email).length,
      disabled:   users.filter(u => u.banned_until != null).length,
      active7d:   users.filter(u => now - ms(u.last_sign_in_at) < 7  * DAY).length,
      active30d:  users.filter(u => now - ms(u.last_sign_in_at) < 30 * DAY).length,
      newWeek:    users.filter(u => now - ms(u.created_at)       < 7  * DAY).length,
      newMonth:   users.filter(u => now - ms(u.created_at)       < 30 * DAY).length,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
