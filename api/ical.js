// Vercel Serverless Function — GET /api/ical?token=<token>
// Generates a live iCal feed from the user's Firestore todos.
// The token is a secret stored in the user's Firestore profile doc.
// Anyone with the URL can subscribe — token acts as a bearer secret.

const admin = require('firebase-admin');

// Singleton init
if (!admin.apps.length) {
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || 'null');
  if (!sa) throw new Error('FIREBASE_SERVICE_ACCOUNT env var not set');
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();

module.exports = async function handler(req, res) {
  // Allow calendar apps to subscribe (no CORS needed — they use direct HTTP)
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).end(); return; }

  const { token } = req.query;
  if (!token || token.length < 20) {
    res.status(401).send('Missing or invalid token');
    return;
  }

  // Token format: "{uid}_{secret}" — uid is embedded so we can do a direct
  // document read at users/{uid}/data/ical without any query or index.
  const sepIdx = token.indexOf('_');
  if (sepIdx < 5) {
    res.status(401).send('Invalid token format');
    return;
  }
  const uid    = token.slice(0, sepIdx);
  const secret = token.slice(sepIdx + 1);

  // Step 1+2 combined: read data/main — verify icalSecret AND load todos in one shot
  let todos = [];
  try {
    const dataSnap = await db.collection('users').doc(uid).collection('data').doc('main').get();
    if (!dataSnap.exists || dataSnap.data().icalSecret !== secret) {
      res.status(401).send('Invalid token');
      return;
    }
    const d = dataSnap.data();
    todos = d.calendar || d.todos || [];
  } catch (err) {
    console.error('Firestore data read error:', err);
    res.status(500).send('Internal error');
    return;
  }

  const config  = d.config || {};
  const tz      = config.timezone || 'America/Montreal';
  const icalHour = config.icalHour || '05:00';
  const [hh, mm] = icalHour.split(':').map(n => String(n).padStart(2, '0'));
  const timeStr  = `${hh}${mm}00`; // e.g. "050000"

  // Compute end hour (+1h, wraps at 23→00 but good enough for todos)
  const endHH = String((parseInt(hh, 10) + 1) % 24).padStart(2, '0');
  const endTimeStr = `${endHH}${mm}00`;

  const ical = generateICal(todos, tz, timeStr, endTimeStr);

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="todo-manager.ics"');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.status(200).send(ical);
};

// ─── iCal generation ───────────────────────────────────────────────────────

function generateICal(todos, tz, timeStr, endTimeStr) {
  const now = fmtDatetime(new Date());
  const events = todos.map(t => buildEvent(t, now, tz, timeStr, endTimeStr)).filter(Boolean).join('\r\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Todo Manager//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-TIMEZONE:${tz}`,
    'X-WR-CALNAME:Todo Manager',
    'X-WR-CALDESC:Your tasks from Todo Manager',
    events,
    'END:VCALENDAR',
  ].join('\r\n');
}

function buildEvent(t, now, tz, timeStr, endTimeStr) {
  const isRec = t.recurrence && t.recurrence !== 'none';

  if (!isRec && !t.date) return null; // inbox task — no date, skip

  const uid = `${t.id}@todo-manager.app`;
  const summary = escIcal(t.title || '');
  const desc = t.description ? `DESCRIPTION:${escIcal(t.description)}\r\n` : '';
  const cat = t.projectId ? `CATEGORIES:${escIcal(t.projectId)}\r\n` : '';
  const status = t.completed ? 'STATUS:COMPLETED\r\n' : '';

  const dtStart = (date) => `DTSTART;TZID=${tz}:${date.replace(/-/g, '')}T${timeStr}`;
  const dtEnd   = (date) => `DTEND;TZID=${tz}:${date.replace(/-/g, '')}T${endTimeStr}`;

  if (isRec) {
    const start = t.startDate || fmtDate(new Date());
    let rrule = '';
    if (t.recurrence === 'daily') {
      rrule = 'RRULE:FREQ=DAILY';
    } else if (t.recurrence === 'weekly') {
      const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
      const byDay = (t.recDays || []).map(d => dayNames[d]).join(',');
      rrule = byDay ? `RRULE:FREQ=WEEKLY;BYDAY=${byDay}` : 'RRULE:FREQ=WEEKLY';
    } else if (t.recurrence === 'monthly') {
      if (t.recLastDay) {
        rrule = 'RRULE:FREQ=MONTHLY;BYDAY=-1MO,-1TU,-1WE,-1TH,-1FR,-1SA,-1SU';
      } else if (t.recDays && t.recDays.length > 0) {
        rrule = `RRULE:FREQ=MONTHLY;BYMONTHDAY=${t.recDays.join(',')}`;
      } else {
        rrule = 'RRULE:FREQ=MONTHLY';
      }
    } else if (t.recurrence === 'yearly') {
      rrule = 'RRULE:FREQ=YEARLY';
    }
    if (t.endDate) rrule += `;UNTIL=${t.endDate.replace(/-/g, '')}T${timeStr}`;

    // Build EXDATE for excluded occurrences
    const exdates = (t.excludedDates || []).length > 0
      ? `EXDATE;TZID=${tz}:${t.excludedDates.map(d => d.replace(/-/g, '') + 'T' + timeStr).join(',')}\r\n`
      : '';

    return [
      'BEGIN:VEVENT',
      `UID:${uid}-rec`,
      `DTSTAMP:${now}`,
      dtStart(start),
      dtEnd(start),
      `SUMMARY:${summary}`,
      desc + cat + status + exdates + rrule,
      'END:VEVENT',
    ].join('\r\n');
  } else {
    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      dtStart(t.date),
      dtEnd(t.date),
      `SUMMARY:${summary}`,
      desc + cat + status.trimEnd(),
      'END:VEVENT',
    ].join('\r\n');
  }
}

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtDatetime(d) {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return `${y}${mo}${da}T${h}${mi}${s}Z`;
}

function escIcal(str) {
  return (str || '')
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n');
}
