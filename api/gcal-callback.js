// GET /api/gcal-callback — Handles Google OAuth2 redirect.
// Exchanges authorization code for refresh token and stores it in Firestore.

const admin = require('firebase-admin');

if (!admin.apps.length) {
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || 'null');
  if (!sa) throw new Error('FIREBASE_SERVICE_ACCOUNT env var not set');
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();
const APP_URL = 'https://todo.hugues.app';

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

    await db.collection('users').doc(uid).collection('data').doc('main')
      .set({ gcalRefreshToken: tokens.refresh_token, gcalConnected: true }, { merge: true });

    return res.redirect(`${APP_URL}?gcal=connected`);
  } catch (err) {
    console.error('gcal-callback error:', err.message);
    return res.redirect(`${APP_URL}?gcal=error&msg=${encodeURIComponent(err.message)}`);
  }
};
