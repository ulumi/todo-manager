// Vercel Cron — DELETE /api/cron-cleanup-guests
// Runs daily; deletes anonymous accounts inactive for more than 48 h.
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(
    JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  )});
}

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') { res.status(405).end(); return; }

  // Vercel sends Authorization: Bearer <CRON_SECRET> for cron requests
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers['authorization'] !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'Unauthorized' }); return;
  }

  try {
    const db     = admin.firestore();
    const cutoff = Date.now() - FORTY_EIGHT_HOURS_MS;

    // Find anonymous presence docs with lastSeen older than 48 h
    const snap = await db.collection('presence').where('isAnonymous', '==', true).get();
    const staleUids = [];
    snap.forEach(doc => {
      const lastSeenMs = doc.data().lastSeen?.toMillis?.() ?? 0;
      if (lastSeenMs < cutoff) staleUids.push(doc.id);
    });

    if (!staleUids.length) {
      res.status(200).json({ ok: true, deleted: 0 }); return;
    }

    // Delete Firebase Auth accounts (ignore already-deleted)
    await Promise.all(staleUids.map(uid =>
      admin.auth().deleteUser(uid).catch(() => {})
    ));

    // Delete their presence docs
    const batch = db.batch();
    staleUids.forEach(uid => batch.delete(db.collection('presence').doc(uid)));
    await batch.commit();

    console.log(`[cron-cleanup-guests] deleted ${staleUids.length} inactive guest(s)`);
    res.status(200).json({ ok: true, deleted: staleUids.length });
  } catch (e) {
    console.error('[cron-cleanup-guests]', e.message);
    res.status(500).json({ error: e.message });
  }
};
