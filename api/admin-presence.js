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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  if (!await verifyAdmin(req)) { res.status(403).json({ error: 'Forbidden' }); return; }

  const snap   = await admin.firestore().collection('presence').where('online', '==', true).get();
  const online = [];
  snap.forEach(d => online.push({ uid: d.id, ...d.data(), lastSeen: d.data().lastSeen?.toMillis?.() ?? null }));
  res.status(200).json(online);
};
