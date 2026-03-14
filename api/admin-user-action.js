// Vercel Serverless Function — POST /api/admin-user-action
// Body: { action: 'disable'|'enable'|'delete'|'revoke', uid }
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!await verifyAdmin(req)) { res.status(403).json({ error: 'Forbidden' }); return; }

  let body = '';
  await new Promise(r => { req.on('data', c => body += c); req.on('end', r); });
  const { action, uid } = JSON.parse(body);
  if (!action || !uid) { res.status(400).json({ error: 'Missing action or uid' }); return; }

  // Prevent admin from acting on themselves
  if (ADMIN_UIDS.includes(uid)) {
    res.status(400).json({ error: 'Cannot perform this action on an admin account' });
    return;
  }

  try {
    switch (action) {
      case 'disable': await admin.auth().updateUser(uid, { disabled: true });  break;
      case 'enable':  await admin.auth().updateUser(uid, { disabled: false }); break;
      case 'delete':  await admin.auth().deleteUser(uid);                      break;
      case 'revoke':  await admin.auth().revokeRefreshTokens(uid);             break;
      default: res.status(400).json({ error: `Unknown action: ${action}` }); return;
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
