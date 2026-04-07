// GET /api/gcal-callback — Handles Google OAuth2 redirect.
// Exchanges authorization code for refresh token and stores it in Supabase.

const { supabase, APP_URL } = require('./_supabase');

module.exports = async function handler(req, res) {
  const { code, state: uid, error } = req.query;

  if (error) {
    return res.redirect(`${APP_URL}?gcal=error&msg=${encodeURIComponent(error)}`);
  }

  if (!code || !uid) {
    return res.status(400).send('Missing code or state');
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     process.env.GCAL_CLIENT_ID,
        client_secret: process.env.GCAL_CLIENT_SECRET,
        redirect_uri:  `${APP_URL}/api/gcal-callback`,
        grant_type:    'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();

    if (!tokens.refresh_token) {
      console.error('gcal-callback: no refresh_token:', JSON.stringify(tokens));
      return res.redirect(`${APP_URL}?gcal=error&msg=no_refresh_token`);
    }

    // Merge gcalRefreshToken + gcalConnected into user_data JSONB
    const { data: row } = await supabase
      .from('user_data')
      .select('data')
      .eq('user_id', uid)
      .maybeSingle();

    const existing = row?.data || {};
    await supabase.from('user_data').upsert({
      user_id: uid,
      data: { ...existing, gcalRefreshToken: tokens.refresh_token, gcalConnected: true },
      updated_at: new Date().toISOString(),
    });

    return res.redirect(`${APP_URL}?gcal=connected`);
  } catch (err) {
    console.error('gcal-callback error:', err.message);
    return res.redirect(`${APP_URL}?gcal=error&msg=${encodeURIComponent(err.message)}`);
  }
};
