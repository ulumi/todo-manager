// GET /api/gcal-auth — Returns Google OAuth URL for Calendar access.
// Requires Firebase ID token in Authorization header.

const admin = require('firebase-admin');

if (!admin.apps.length) {
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || 'null');
  if (!sa) throw new Error('FIREBASE_SERVICE_ACCOUNT env var not set');
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const APP_URL = 'https://todo.hugues.app';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', APP_URL);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).end(); return; }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).send('Missing token');
    return;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(authHeader.slice(7));
    const uid = decoded.uid;

    const params = new URLSearchParams({
      client_id:     process.env.GCAL_CLIENT_ID,
      redirect_uri:  `${APP_URL}/api/gcal-callback`,
      response_type: 'code',
      scope:         'https://www.googleapis.com/auth/calendar',
      access_type:   'offline',
      prompt:        'consent',
      state:         uid,
    });

    res.json({ url: `https://accounts.google.com/o/oauth2/auth?${params}` });
  } catch (err) {
    console.error('gcal-auth error:', err.message);
    res.status(401).send('Invalid token');
  }
};
