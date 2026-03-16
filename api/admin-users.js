// Vercel Serverless Function — GET /api/admin-users
// Lists all Firebase Auth accounts (requires Admin SDK).
// All other admin operations (presence, messages) use Firestore client SDK directly.

const admin = require('firebase-admin');

// Singleton init (Vercel may reuse warm instances)
if (!admin.apps.length) {
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || 'null');
  if (!sa) throw new Error('FIREBASE_SERVICE_ACCOUNT env var not set');
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const ADMIN_UIDS = (process.env.ADMIN_UIDS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET')     { res.status(405).json({ error: 'Method not allowed' }); return; }

  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(token);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  if (!ADMIN_UIDS.includes(decoded.uid) && decoded.admin !== true) {
    res.status(403).json({ error: 'Forbidden — not an admin' });
    return;
  }

  try {
    // Fetch auth users + presence docs in parallel.
    // Presence docs may contain displayName set via in-app guest prompt
    // even when Firebase Auth u.displayName is null.
    const [authResult, presenceSnap] = await Promise.all([
      admin.auth().listUsers(1000),
      admin.firestore().collection('presence').get(),
    ]);

    const presenceMap = {};
    presenceSnap.forEach(d => { presenceMap[d.id] = d.data(); });

    const users = authResult.users.map(u => {
      const p = presenceMap[u.uid] || {};
      return {
        uid:          u.uid,
        email:        u.email       || null,
        displayName:  u.displayName || p.displayName || null,
        isAnonymous:  u.providerData.length === 0,
        creationTime: u.metadata.creationTime,
        lastSignIn:   u.metadata.lastSignInTime,
        disabled:     u.disabled,
      };
    });
    res.status(200).json(users);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
