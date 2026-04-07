// Vercel Serverless Function — GET /api/admin-users
// Lists all Supabase Auth accounts + presence data.

const { supabase, verifyAdmin, corsHeaders } = require('./_supabase');

module.exports = async function handler(req, res) {
  corsHeaders(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  if (!await verifyAdmin(req)) { res.status(403).json({ error: 'Forbidden' }); return; }

  try {
    const [authResult, presenceResult] = await Promise.all([
      supabase.auth.admin.listUsers({ perPage: 1000 }),
      supabase.from('presence').select('*'),
    ]);

    const presenceMap = {};
    (presenceResult.data || []).forEach(p => { presenceMap[p.user_id] = p; });

    const users = (authResult.data?.users || []).map(u => {
      const p = presenceMap[u.id] || {};
      return {
        uid:          u.id,
        email:        u.email || null,
        displayName:  u.user_metadata?.display_name || u.user_metadata?.full_name || p.display_name || null,
        isAnonymous:  u.is_anonymous ?? (!u.email),
        creationTime: u.created_at,
        lastSignIn:   u.last_sign_in_at,
        disabled:     u.banned_until != null,
      };
    });
    res.status(200).json(users);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
