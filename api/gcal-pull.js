// GET /api/gcal-pull — Pull changes from Google Calendar back to the app.

const { supabase, verifyToken, corsHeaders } = require('./_supabase');

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

async function listEvents(accessToken, calendarId, params) {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
    new URLSearchParams(params);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return [];
  return (await res.json()).items || [];
}

async function getAllCalendarIds(accessToken) {
  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return ['primary'];
  const data = await res.json();
  return (data.items || []).map(c => c.id).filter(Boolean);
}

module.exports = async function handler(req, res) {
  corsHeaders(req, res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).end(); return; }

  const user = await verifyToken(req);
  if (!user) { res.status(401).send('Missing token'); return; }
  const uid = user.id;

  try {
    const { data: row } = await supabase
      .from('user_data')
      .select('data')
      .eq('user_id', uid)
      .maybeSingle();

    const empty = { completedTodoIds: [], movedTodos: [], newTodos: [] };
    if (!row) { res.json(empty); return; }

    const userData = row.data;
    if (!userData.gcalRefreshToken) { res.json(empty); return; }

    const accessToken    = await getAccessToken(userData.gcalRefreshToken);
    const gcalEventIds   = userData.gcalEventIds || {};
    const forceReimport  = req.query.force === '1';
    const gcalImported   = forceReimport ? new Set() : new Set(userData.gcalImportedIds || []);

    const gcalToTodo = Object.fromEntries(
      Object.entries(gcalEventIds).map(([tid, gid]) => [gid, tid])
    );
    const knownGcalIds = new Set([...Object.values(gcalEventIds), ...gcalImported]);

    const calendarIds = await getAllCalendarIds(accessToken);

    // ── 1. Check for changes to app-managed events ────────
    const completedTodoIds = [];
    const movedTodos = [];

    if (Object.keys(gcalEventIds).length > 0) {
      const lastSync   = userData.gcalLastSync ? new Date(userData.gcalLastSync) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const updatedMin = lastSync.toISOString();

      for (const calId of calendarIds) {
        const changedEvents = await listEvents(accessToken, calId, {
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
    }

    // ── 2. Fetch upcoming GCal events not yet imported ────
    const now   = new Date();
    const until = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const from  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const allUpcoming = [];
    for (const calId of calendarIds) {
      const events = await listEvents(accessToken, calId, {
        timeMin: from.toISOString(), timeMax: until.toISOString(),
        showDeleted: 'false', singleEvents: 'true', maxResults: '250', orderBy: 'startTime',
      });
      allUpcoming.push(...events);
    }

    const newTodos = [];
    const newImportedIds = [];
    const updatedGcalEventIds = { ...gcalEventIds };

    for (const event of allUpcoming) {
      if (knownGcalIds.has(event.id)) continue;
      if (!event.summary) continue;

      const dateStr = (event.start?.dateTime || event.start?.date || '').slice(0, 10);
      if (!dateStr) continue;

      const todoId = 'gcal_' + event.id.slice(0, 20);
      newTodos.push({
        id: todoId, title: event.summary, date: dateStr,
        recurrence: 'none', completed: false, completedDates: [],
        ...(event.description ? { description: event.description } : {}),
      });
      newImportedIds.push(event.id);
      updatedGcalEventIds[todoId] = event.id;
    }

    // ── 3. Persist changes ────────────────────────────────
    const updatedData = { ...userData, gcalLastSync: new Date().toISOString(), gcalEventIds: updatedGcalEventIds };
    if (forceReimport) {
      updatedData.gcalImportedIds = newImportedIds;
    } else if (newImportedIds.length > 0) {
      updatedData.gcalImportedIds = [...(userData.gcalImportedIds || []), ...newImportedIds];
    }

    await supabase.from('user_data').upsert({
      user_id: uid, data: updatedData, updated_at: new Date().toISOString(),
    });

    res.json({ completedTodoIds, movedTodos, newTodos, debug: { calendars: calendarIds.length, newCount: newTodos.length } });
  } catch (err) {
    console.error('gcal-pull error:', err.message);
    res.status(500).send('Pull error: ' + err.message);
  }
};
