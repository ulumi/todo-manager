// Vercel Serverless Function — POST /api/admin-user-action
// Body: { action: 'disable'|'enable'|'delete', uid }

import { supabase, ADMIN_UIDS, verifyAdmin, corsHeaders, parseBody } from './_supabase.js';

export default async function handler(req, res) {
  corsHeaders(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!await verifyAdmin(req)) { res.status(403).json({ error: 'Forbidden' }); return; }

  const { action, uid } = await parseBody(req);
  if (!action || !uid) { res.status(400).json({ error: 'Missing action or uid' }); return; }

  if (ADMIN_UIDS.includes(uid)) {
    res.status(400).json({ error: 'Cannot perform this action on an admin account' });
    return;
  }

  try {
    switch (action) {
      case 'disable': {
        // Supabase uses ban_duration to disable users
        await supabase.auth.admin.updateUser(uid, { ban_duration: '876000h' }); // ~100 years
        break;
      }
      case 'enable': {
        await supabase.auth.admin.updateUser(uid, { ban_duration: 'none' });
        break;
      }
      case 'delete': {
        await supabase.auth.admin.deleteUser(uid);
        break;
      }
      default:
        res.status(400).json({ error: `Unknown action: ${action}` });
        return;
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
