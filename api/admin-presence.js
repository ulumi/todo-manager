// Vercel Serverless Function — GET /api/admin-presence
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(
    JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  )});
}

const ADMIN_UIDS = (process.env.ADMIN_UIDS || '').split(',').map(s => s.trim()).filter(Boolean);

async function verifyAdmin(req) {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '');
  if (!token) return null;
  try {
    const d = await admin.auth().verifyIdToken(token);
    return (ADMIN_UIDS.includes(d.uid) || d.admin === true) ? d.uid : null;
  } catch { return null; }
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allowedOrigins = ['https://todo.hugues.app', 'http://localhost:5500', 'http://localhost:3000', 'http://127.0.0.1:5500'];
  res.setHeader('Access-Control-Allow-Origin', allowedOrigins.includes(origin) ? origin : 'https://todo.hugues.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  if (!await verifyAdmin(req)) { res.status(403).json({ error: 'Forbidden' }); return; }

  const snap   = await admin.firestore().collection('presence').where('online', '==', true).get();
  const online = [];
  snap.forEach(d => {
    const data = d.data();
    online.push({
      uid: d.id, ...data,
      lastSeen:     data.lastSeen?.toMillis?.()     ?? null,
      sessionStart: data.sessionStart?.toMillis?.() ?? null,
    });
  });
  res.status(200).json(online);
};
