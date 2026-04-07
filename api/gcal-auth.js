// GET /api/gcal-auth — Returns Google OAuth URL for Calendar access.

const { verifyToken, corsHeaders, APP_URL } = require('./_supabase');

module.exports = async function handler(req, res) {
  corsHeaders(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).end(); return; }

  const user = await verifyToken(req);
  if (!user) { res.status(401).send('Invalid token'); return; }

  const params = new URLSearchParams({
    client_id:     process.env.GCAL_CLIENT_ID,
    redirect_uri:  `${APP_URL}/api/gcal-callback`,
    response_type: 'code',
    scope:         'https://www.googleapis.com/auth/calendar',
    access_type:   'offline',
    prompt:        'consent',
    state:         user.id,
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  res.json({ url: authUrl });
};
