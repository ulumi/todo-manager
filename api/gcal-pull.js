// GET /api/gcal-pull — Pull changes from Google Calendar back to the app.
// Returns todos to mark as completed (deleted events) and date changes.
// Requires Firebase ID token in Authorization header.

const admin = require('firebase-admin');

if (!admin.apps.length) {
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || 'null');
  if (!sa) throw new Error('FIREBASE_SERVICE_ACCOUNT env var not set');
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();

async function getAccessToken(refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token:  refreshToken,
      client_id:      process.env.GCAL_CLIENT_ID,
      client_secret:  process.env.GCAL_CLIENT_SECRET,
      grant_type:     'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to refresh access token');
  return data.access_token;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).end(); return; }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) { res.status(401).send('Missing token'); return; }

  try {
    const decoded = await admin.auth().verifyIdToken(authHeader.slice(7));
    const uid = decoded.uid;

    const snap = await db.collection('users').doc(uid).collection('data').doc('main').get();
    if (!snap.exists) { res.json({ completedTodoIds: [], movedTodos: [] }); return; }

    const data = snap.data();
    if (!data.gcalRefreshToken || !data.gcalEventIds) {
      res.json({ completedTodoIds: [], movedTodos: [] });
      return;
    }

    const accessToken  = await getAccessToken(data.gcalRefreshToken);
    const gcalEventIds = data.gcalEventIds; // { todoId: gcalEventId }

    // Reverse map: gcalEventId → todoId
    const gcalToTodo = Object.fromEntries(
      Object.entries(gcalEventIds).map(([tid, gid]) => [gid, tid])
    );

    // Fetch events updated since last sync (or 30 days ago)
    const lastSync = data.gcalLastSync?.toDate?.() ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const updatedMin = lastSync.toISOString();
    const calId = 'primary';

    const listUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?` +
      new URLSearchParams({ updatedMin, showDeleted: 'true', singleEvents: 'false', maxResults: '500' });

    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!listRes.ok) {
      const text = await listRes.text();
      throw new Error(`GCal list error ${listRes.status}: ${text}`);
    }

    const listData = await listRes.json();
    const events = listData.items || [];

    const completedTodoIds = [];
    const movedTodos = [];

    for (const event of events) {
      const todoId = gcalToTodo[event.id];
      if (!todoId) continue; // event not managed by us

      if (event.status === 'cancelled') {
        // Deleted in GCal → complete in app
        completedTodoIds.push(todoId);
      } else if (event.start?.dateTime || event.start?.date) {
        // Date changed in GCal → update todo date
        const newDate = (event.start.dateTime || event.start.date).slice(0, 10);
        movedTodos.push({ id: todoId, date: newDate });
      }
    }

    // Update gcalLastSync
    await db.collection('users').doc(uid).collection('data').doc('main')
      .set({ gcalLastSync: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

    res.json({ completedTodoIds, movedTodos });
  } catch (err) {
    console.error('gcal-pull error:', err.message);
    res.status(500).send('Pull error: ' + err.message);
  }
};
