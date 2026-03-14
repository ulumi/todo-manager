// Vercel Serverless Function — POST /api/admin-batch
// Body: { action: 'delete-anon' }
//       { action: 'broadcast', message: '...' }
//       { action: 'clean-sessions' }
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
  const payload = JSON.parse(body);

  try {
    // ── Delete all anonymous accounts ─────────────────────
    if (payload.action === 'delete-anon') {
      const result = await admin.auth().listUsers(1000);
      const anons  = result.users.filter(u => u.providerData.length === 0 && !ADMIN_UIDS.includes(u.uid));
      await Promise.all(anons.map(u => admin.auth().deleteUser(u.uid)));
      res.status(200).json({ ok: true, deleted: anons.length });

    // ── Broadcast message to all registered users ─────────
    } else if (payload.action === 'broadcast') {
      const { message, showPublicTag = true } = payload;
      if (!message) { res.status(400).json({ error: 'Missing message' }); return; }
      const result = await admin.auth().listUsers(1000);
      const targets = result.users;
      const db          = admin.firestore();
      const broadcastRef = db.collection('broadcasts').doc();
      const broadcastId  = broadcastRef.id;
      const ts           = admin.firestore.FieldValue.serverTimestamp();
      await broadcastRef.set({ message, from: 'admin', sentAt: ts, recipientCount: targets.length });
      const inboxDoc = { message, from: 'admin', sentAt: ts, read: false };
      if (showPublicTag) inboxDoc.broadcastId = broadcastId;
      await Promise.all(targets.map(u =>
        db.collection('admin_messages').doc(u.uid).collection('inbox').add(inboxDoc)
      ));
      res.status(200).json({ ok: true, sent: targets.length, broadcastId });

    // ── Clean stale presence sessions ─────────────────────
    } else if (payload.action === 'clean-sessions') {
      const TWO_HOURS = 2 * 60 * 60 * 1000;
      const cutoff    = Date.now() - TWO_HOURS;
      const snap      = await admin.firestore().collection('presence').where('online', '==', true).get();
      const batch     = admin.firestore().batch();
      let count = 0;
      snap.forEach(d => {
        const lastSeen = d.data().lastSeen?.toMillis?.() ?? 0;
        if (lastSeen < cutoff) { batch.update(d.ref, { online: false }); count++; }
      });
      if (count > 0) await batch.commit();
      res.status(200).json({ ok: true, cleaned: count });

    } else {
      res.status(400).json({ error: `Unknown action: ${payload.action}` });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
