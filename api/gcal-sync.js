// POST /api/gcal-sync — Push todos to Google Calendar.
// Creates/updates/deletes GCal events to match app todos.
// Requires Firebase ID token in Authorization header.

const admin = require('firebase-admin');

if (!admin.apps.length) {
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || 'null');
  if (!sa) throw new Error('FIREBASE_SERVICE_ACCOUNT env var not set');
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();

// ── Google API helpers ─────────────────────────────────────

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
  if (!data.access_token) throw new Error('Failed to refresh access token: ' + JSON.stringify(data));
  return data.access_token;
}

async function gcalReq(method, path, accessToken, body) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    method,
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204 || res.status === 404 || res.status === 410) return null;
  if (!res.ok) {
    const text = await res.text();
    console.error(`[gcal] ${method} ${path} → ${res.status}:`, text.slice(0, 500));
    throw new Error(`GCal ${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ── iCal time helpers (mirror api/ical.js) ────────────────

function minsToTimeStr(mins) {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00`;
}

function todoToEvent(todo, tz, baseMins, idx) {
  const isRec = todo.recurrence && todo.recurrence !== 'none';
  if (!isRec && !todo.date) return null;

  const startTime = minsToTimeStr(baseMins + idx * 30);
  const endTime   = minsToTimeStr(baseMins + idx * 30 + 30);
  const dateStr   = isRec ? (todo.startDate || new Date().toISOString().slice(0, 10)) : todo.date;

  const event = {
    summary: todo.title || '(sans titre)',
    start: { dateTime: `${dateStr}T${startTime}`, timeZone: tz },
    end:   { dateTime: `${dateStr}T${endTime}`,   timeZone: tz },
    status: 'confirmed',
  };
  if (todo.description) event.description = todo.description;

  if (isRec) {
    const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    let rrule = '';
    if (todo.recurrence === 'daily') {
      rrule = 'FREQ=DAILY';
    } else if (todo.recurrence === 'weekly') {
      const byDay = (todo.recDays || []).map(d => dayNames[d]).join(',');
      rrule = byDay ? `FREQ=WEEKLY;BYDAY=${byDay}` : 'FREQ=WEEKLY';
    } else if (todo.recurrence === 'monthly') {
      rrule = 'FREQ=MONTHLY';
    } else if (todo.recurrence === 'yearly') {
      rrule = 'FREQ=YEARLY';
    }
    if (rrule) {
      if (todo.endDate) rrule += `;UNTIL=${todo.endDate.replace(/-/g, '')}T${startTime.replace(/:/g, '')}`;
      event.recurrence = [`RRULE:${rrule}`];
    }
  }

  return event;
}

// ── Handler ───────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) { res.status(401).send('Missing token'); return; }

  try {
    const decoded = await admin.auth().verifyIdToken(authHeader.slice(7));
    const uid = decoded.uid;

    const snap = await db.collection('users').doc(uid).collection('data').doc('main').get();
    if (!snap.exists) { res.status(404).send('No data'); return; }

    const data = snap.data();
    if (!data.gcalRefreshToken) { res.json({ skipped: 'not_connected' }); return; }

    const accessToken = await getAccessToken(data.gcalRefreshToken);
    const todos       = data.calendar || data.todos || [];
    const config      = data.config || {};
    const tz          = config.timezone || 'America/Montreal';
    const [hh, mm]    = (config.icalHour || '05:00').split(':');
    const baseMins    = parseInt(hh, 10) * 60 + parseInt(mm, 10);
    const f           = config.icalFilters || {};

    // Apply same filters as iCal feed
    const toSync = todos.filter(t => {
      if (t.completed && !f.completed) return false;
      const isRec = t.recurrence && t.recurrence !== 'none';
      if (isRec  && f.recurring === false) return false;
      if (!isRec && f.oneTime   === false) return false;
      return true;
    });

    console.log(`[gcal-sync] todos=${todos.length} toSync=${toSync.length} filters=`, JSON.stringify(f));

    let gcalEventIds = data.gcalEventIds || {};
    const calId = 'primary';
    let syncCount = 0;

    // Create or update events
    let idx = 0;
    for (const todo of toSync) {
      const event = todoToEvent(todo, tz, baseMins, idx++);
      if (!event) continue;

      const existingGcalId = gcalEventIds[todo.id];
      if (existingGcalId) {
        try {
          await gcalReq('PUT', `/calendars/${encodeURIComponent(calId)}/events/${existingGcalId}`, accessToken, event);
          syncCount++;
        } catch {
          // Event was deleted in GCal; recreate
          const created = await gcalReq('POST', `/calendars/${encodeURIComponent(calId)}/events`, accessToken, event);
          if (created?.id) { gcalEventIds[todo.id] = created.id; syncCount++; }
        }
      } else {
        const created = await gcalReq('POST', `/calendars/${encodeURIComponent(calId)}/events`, accessToken, event);
        if (created?.id) { gcalEventIds[todo.id] = created.id; syncCount++; }
      }
    }

    // Delete GCal events for todos no longer in the sync list
    const syncedTodoIds = new Set(toSync.map(t => t.id));
    for (const [todoId, gcalId] of Object.entries(gcalEventIds)) {
      if (!syncedTodoIds.has(todoId)) {
        await gcalReq('DELETE', `/calendars/${encodeURIComponent(calId)}/events/${gcalId}`, accessToken);
        delete gcalEventIds[todoId];
      }
    }

    // Save updated mapping + timestamp
    await db.collection('users').doc(uid).collection('data').doc('main')
      .set({ gcalEventIds, gcalLastSync: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

    res.json({ synced: syncCount });
  } catch (err) {
    console.error('gcal-sync error:', err.message);
    res.status(500).send('Sync error: ' + err.message);
  }
};
