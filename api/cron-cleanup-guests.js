// Vercel Cron — GET /api/cron-cleanup-guests
// Runs daily at 3 h UTC. Cleans up:
//   1. Anonymous accounts inactive for > 48 h (via presence.lastSeen)
//   2. Anonymous accounts with no presence doc (via Auth lastSignInTime)
//   3. Disabled accounts older than 7 days
//   4. Orphan admin_messages inbox docs for deleted users
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(
    JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  )});
}

const FORTY_EIGHT_H = 48 * 60 * 60 * 1000;
const SEVEN_DAYS    =  7 * 24 * 60 * 60 * 1000;

// Delete all docs in a subcollection (no batch limit issue — inbox is small)
async function deleteInbox(db, uid) {
  const snap = await db.collection('admin_messages').doc(uid).collection('inbox').get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

async function deleteUsers(db, uids) {
  if (!uids.length) return;
  await Promise.all(uids.map(uid =>
    admin.auth().deleteUser(uid).catch(() => {}) // ignore already-deleted
  ));
  // Presence docs
  const presenceBatch = db.batch();
  uids.forEach(uid => presenceBatch.delete(db.collection('presence').doc(uid)));
  await presenceBatch.commit();
  // Orphan inbox docs
  await Promise.all(uids.map(uid => deleteInbox(db, uid)));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') { res.status(405).end(); return; }

  const secret = process.env.CRON_SECRET;
  if (secret && req.headers['authorization'] !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'Unauthorized' }); return;
  }

  try {
    const db  = admin.firestore();
    const now = Date.now();

    // ── 1 & 2. Stale anonymous accounts ──────────────────────────────────
    // Start from presence collection (most accurate lastSeen)
    const presenceSnap = await db.collection('presence').where('isAnonymous', '==', true).get();
    const seenInPresence = new Set();
    const staleGuests = [];

    presenceSnap.forEach(doc => {
      const uid        = doc.id;
      const lastSeenMs = doc.data().lastSeen?.toMillis?.() ?? 0; // 0 = never seen → stale
      seenInPresence.add(uid);
      if (lastSeenMs < now - FORTY_EIGHT_H) staleGuests.push(uid);
    });

    // Fallback: anonymous Auth accounts with no presence doc
    const authResult = await admin.auth().listUsers(1000);
    authResult.users.forEach(u => {
      if (!u.providerData.length && !seenInPresence.has(u.uid)) {
        const lastSignIn = new Date(u.metadata.lastSignInTime).getTime();
        if (lastSignIn < now - FORTY_EIGHT_H) staleGuests.push(u.uid);
      }
    });

    await deleteUsers(db, staleGuests);

    // ── 3. Disabled accounts older than 7 days ────────────────────────────
    const disabledUids = authResult.users
      .filter(u => u.disabled)
      .filter(u => new Date(u.metadata.lastSignInTime).getTime() < now - SEVEN_DAYS)
      .map(u => u.uid);

    await deleteUsers(db, disabledUids);

    const summary = { guests: staleGuests.length, disabled: disabledUids.length };
    console.log('[cron-cleanup-guests]', summary);
    res.status(200).json({ ok: true, ...summary });
  } catch (e) {
    console.error('[cron-cleanup-guests]', e.message);
    res.status(500).json({ error: e.message });
  }
};
