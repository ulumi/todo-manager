// GET /api/gcal-pull — Pull changes from Google Calendar back to the app.
// Returns:
//   completedTodoIds — app-managed events deleted in GCal → mark as complete
//   movedTodos       — app-managed events moved in GCal → update date
//   newTodos         — GCal events not yet in the app → import as new todos

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

async function listEvents(accessToken, params) {
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
    new URLSearchParams(params);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GCal list error ${res.status}: ${text}`);
  }
  return (await res.json()).items || [];
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).end(); return; }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) { res.status(401).send('Missing token'); return; }

  try {
    const decoded = await admin.auth().verifyIdToken(authHeader.slice(7));
    const uid = decoded.uid;

    const snap = await db.collection('users').doc(uid).collection('data').doc('main').get();
    if (!snap.exists) { res.json({ completedTodoIds: [], movedTodos: [], newTodos: [] }); return; }

    const data = snap.data();
    if (!data.gcalRefreshToken) {
      res.json({ completedTodoIds: [], movedTodos: [], newTodos: [] });
      return;
    }

    const accessToken    = await getAccessToken(data.gcalRefreshToken);
    const gcalEventIds   = data.gcalEventIds || {};   // { todoId: gcalEventId }
    const gcalImported   = new Set(data.gcalImportedIds || []); // already-imported gcalEventIds

    // Reverse map: gcalEventId → todoId
    const gcalToTodo = Object.fromEntries(
      Object.entries(gcalEventIds).map(([tid, gid]) => [gid, tid])
    );
    // All known gcalEventIds (managed + imported)
    const knownGcalIds = new Set([...Object.values(gcalEventIds), ...gcalImported]);

    // ── 1. Check for changes to app-managed events since last sync ────────
    const completedTodoIds = [];
    const movedTodos = [];

    if (Object.keys(gcalEventIds).length > 0) {
      const lastSync   = data.gcalLastSync?.toDate?.() ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const updatedMin = lastSync.toISOString();

      const changedEvents = await listEvents(accessToken, {
        updatedMin, showDeleted: 'true', singleEvents: 'false', maxResults: '500',
      });

      for (const event of changedEvents) {
        const todoId = gcalToTodo[event.id];
        if (!todoId) continue;

        if (event.status === 'cancelled') {
          completedTodoIds.push(todoId);
        } else if (event.start?.dateTime || event.start?.date) {
          const newDate = (event.start.dateTime || event.start.date).slice(0, 10);
          movedTodos.push({ id: todoId, date: newDate });
        }
      }
    }

    // ── 2. Fetch upcoming GCal events not yet imported ────────────────────
    const now   = new Date();
    const until = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days ahead
    // Also check past 7 days (to catch "ce soir" that may already have passed midnight)
    const from  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const upcomingEvents = await listEvents(accessToken, {
      timeMin:      from.toISOString(),
      timeMax:      until.toISOString(),
      showDeleted:  'false',
      singleEvents: 'true',
      maxResults:   '250',
      orderBy:      'startTime',
    });

    const newTodos = [];
    const newImportedIds = [];

    for (const event of upcomingEvents) {
      if (knownGcalIds.has(event.id)) continue; // already in app
      if (!event.summary) continue;             // skip untitled events

      const dateStr = (event.start?.dateTime || event.start?.date || '').slice(0, 10);
      if (!dateStr) continue;

      // Use a stable ID based on GCal event ID so we don't duplicate on re-sync
      const todoId = 'gcal_' + event.id.slice(0, 20);
      const todo = {
        id:             todoId,
        title:          event.summary,
        date:           dateStr,
        recurrence:     'none',
        completed:      false,
        completedDates: [],
      };
      if (event.description) todo.description = event.description;

      newTodos.push(todo);
      newImportedIds.push(event.id);

      // Add to gcalEventIds so future syncs manage this event
      gcalEventIds[todoId] = event.id;
    }

    // ── 3. Persist changes ────────────────────────────────────────────────
    const updates = {
      gcalLastSync:     admin.firestore.FieldValue.serverTimestamp(),
    };
    if (newImportedIds.length > 0) {
      updates.gcalImportedIds = admin.firestore.FieldValue.arrayUnion(...newImportedIds);
      updates.gcalEventIds    = gcalEventIds;
    }
    await db.collection('users').doc(uid).collection('data').doc('main').set(updates, { merge: true });

    console.log(`[gcal-pull] changed=${completedTodoIds.length + movedTodos.length} new=${newTodos.length}`);
    res.json({ completedTodoIds, movedTodos, newTodos });

  } catch (err) {
    console.error('gcal-pull error:', err.message);
    res.status(500).send('Pull error: ' + err.message);
  }
};
