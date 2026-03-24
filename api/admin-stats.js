// Vercel Serverless Function — GET /api/admin-stats
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

  const result = await admin.auth().listUsers(1000);
  const now    = Date.now();
  const DAY    = 86_400_000;

  const ms = t => t ? new Date(t).getTime() : 0;

  res.status(200).json({
    total:      result.users.length,
    registered: result.users.filter(u => u.providerData.length > 0).length,
    anonymous:  result.users.filter(u => u.providerData.length === 0).length,
    disabled:   result.users.filter(u => u.disabled).length,
    active7d:   result.users.filter(u => now - ms(u.metadata.lastSignInTime) < 7  * DAY).length,
    active30d:  result.users.filter(u => now - ms(u.metadata.lastSignInTime) < 30 * DAY).length,
    newWeek:    result.users.filter(u => now - ms(u.metadata.creationTime)   < 7  * DAY).length,
    newMonth:   result.users.filter(u => now - ms(u.metadata.creationTime)   < 30 * DAY).length,
  });
};
