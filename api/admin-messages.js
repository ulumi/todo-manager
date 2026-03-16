// Vercel Serverless Function — GET /api/admin-messages?uid=xxx  /  POST send
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  if (!await verifyAdmin(req)) { res.status(403).json({ error: 'Forbidden' }); return; }

  // GET /api/admin-messages?incoming=N — recent user→admin messages (collection group)
  if (req.method === 'GET' && req.query?.incoming) {
    const limit = Math.min(parseInt(req.query.incoming) || 5, 20);
    const snap = await admin.firestore()
      .collectionGroup('inbox')
      .where('from', '==', 'user')
      .orderBy('sentAt', 'desc')
      .limit(limit)
      .get();
    const msgs = [];
    snap.forEach(d => {
      const uid = d.ref.parent.parent.id;
      msgs.push({ id: d.id, uid, message: d.data().message, from: 'user', sentAt: d.data().sentAt?.toMillis?.() ?? null, read: d.data().read });
    });
    res.status(200).json(msgs);

  // GET /api/admin-messages?broadcasts=1 — fetch broadcast history
  } else if (req.method === 'GET' && req.query?.broadcasts) {
    const snap = await admin.firestore()
      .collection('broadcasts').orderBy('sentAt', 'desc').get();
    const list = [];
    snap.forEach(d => list.push({
      id:             d.id,
      message:        d.data().message,
      from:           'admin',
      sentAt:         d.data().sentAt?.toMillis?.() ?? null,
      recipientCount: d.data().recipientCount ?? null,
      broadcast:      true,
    }));
    res.status(200).json(list);

  // GET /api/admin-messages?uid=xxx — fetch user thread
  } else if (req.method === 'GET') {
    const uid = req.query?.uid;
    if (!uid) { res.status(400).json({ error: 'Missing uid' }); return; }
    const snap = await admin.firestore()
      .collection('admin_messages').doc(uid).collection('inbox')
      .orderBy('sentAt', 'asc').get();
    const msgs = [];
    snap.forEach(d => msgs.push({
      id:          d.id,
      message:     d.data().message,
      from:        d.data().from || 'admin',
      sentAt:      d.data().sentAt?.toMillis?.() ?? null,
      read:        d.data().read,
      broadcastId: d.data().broadcastId ?? null,
    }));
    res.status(200).json(msgs);

  // POST /api/admin-messages — send a message
  } else if (req.method === 'POST') {
    let body = '';
    await new Promise(r => { req.on('data', c => body += c); req.on('end', r); });
    const { uid, message } = JSON.parse(body);
    if (!uid || !message) { res.status(400).json({ error: 'Missing uid or message' }); return; }
    await admin.firestore()
      .collection('admin_messages').doc(uid).collection('inbox').add({
        message, from: 'admin',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
      });
    res.status(200).json({ ok: true });

  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
