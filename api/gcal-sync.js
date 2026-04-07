// POST /api/gcal-sync — Push todos to Google Calendar.

import { supabase, verifyToken, corsHeaders } from './_supabase.js';

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
    throw new Error(`GCal ${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

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
    if (todo.recurrence === 'daily') rrule = 'FREQ=DAILY';
    else if (todo.recurrence === 'weekly') {
      const byDay = (todo.recDays || []).map(d => dayNames[d]).join(',');
      rrule = byDay ? `FREQ=WEEKLY;BYDAY=${byDay}` : 'FREQ=WEEKLY';
    } else if (todo.recurrence === 'monthly') rrule = 'FREQ=MONTHLY';
    else if (todo.recurrence === 'yearly') rrule = 'FREQ=YEARLY';
    if (rrule) {
      if (todo.endDate) rrule += `;UNTIL=${todo.endDate.replace(/-/g, '')}T${startTime.replace(/:/g, '')}`;
      event.recurrence = [`RRULE:${rrule}`];
    }
  }

  return event;
}

// ── Handler ───────────────────────────────────────────────

export default async function handler(req, res) {
  corsHeaders(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const user = await verifyToken(req);
  if (!user) { res.status(401).send('Missing token'); return; }
  const uid = user.id;

  try {
    const { data: row } = await supabase
      .from('user_data')
      .select('data')
      .eq('user_id', uid)
      .maybeSingle();

    if (!row) { res.status(404).send('No data'); return; }

    const userData = row.data;
    if (!userData.gcalRefreshToken) { res.json({ skipped: 'not_connected' }); return; }

    const accessToken = await getAccessToken(userData.gcalRefreshToken);
    const todos       = userData.calendar || userData.todos || [];
    const config      = userData.config || {};
    const tz          = config.timezone || 'America/Montreal';
    const [hh, mm]    = (config.icalHour || '05:00').split(':');
    const baseMins    = parseInt(hh, 10) * 60 + parseInt(mm, 10);
    const f           = config.icalFilters || {};

    const toSync = todos.filter(t => {
      if (t.completed && !f.completed) return false;
      const isRec = t.recurrence && t.recurrence !== 'none';
      if (isRec  && f.recurring === false) return false;
      if (!isRec && f.oneTime   === false) return false;
      return true;
    });

    let gcalEventIds = userData.gcalEventIds || {};
    const calId = 'primary';
    let syncCount = 0;

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
          const created = await gcalReq('POST', `/calendars/${encodeURIComponent(calId)}/events`, accessToken, event);
          if (created?.id) { gcalEventIds[todo.id] = created.id; syncCount++; }
        }
      } else {
        const created = await gcalReq('POST', `/calendars/${encodeURIComponent(calId)}/events`, accessToken, event);
        if (created?.id) { gcalEventIds[todo.id] = created.id; syncCount++; }
      }
    }

    const syncedTodoIds = new Set(toSync.map(t => t.id));
    for (const [todoId, gcalId] of Object.entries(gcalEventIds)) {
      if (!syncedTodoIds.has(todoId)) {
        await gcalReq('DELETE', `/calendars/${encodeURIComponent(calId)}/events/${gcalId}`, accessToken);
        delete gcalEventIds[todoId];
      }
    }

    // Save updated mapping + timestamp
    await supabase.from('user_data').upsert({
      user_id: uid,
      data: { ...userData, gcalEventIds, gcalLastSync: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    });

    res.json({ synced: syncCount });
  } catch (err) {
    console.error('gcal-sync error:', err.message);
    res.status(500).send('Sync error: ' + err.message);
  }
};
