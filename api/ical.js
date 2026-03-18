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

  // Step 1: lookup by ical token (stored at users/{uid}/data/ical)
  // Uses collectionGroup to avoid needing the uid upfront.
  let uid;
  try {
    const q = await db.collectionGroup('data').where('icalToken', '==', token).limit(1).get();
    if (q.empty) {
      res.status(404).send('Token not found');
      return;
    }
    // Path is users/{uid}/data/ical — parent.parent.id is the uid
    uid = q.docs[0].ref.parent.parent.id;
  } catch (err) {
    console.error('Firestore token lookup error:', err);
    res.status(500).send('Internal error');
    return;
  }

  // Step 2: load todos from users/{uid}/data/main
  let todos = [];
  try {
    const dataSnap = await db.collection('users').doc(uid).collection('data').doc('main').get();
    if (dataSnap.exists) {
      const d = dataSnap.data();
      todos = d.calendar || d.todos || [];
    }
  } catch (err) {
    console.error('Firestore data read error:', err);
    res.status(500).send('Internal error');
    return;
  }

  const ical = generateICal(todos);

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="todo-manager.ics"');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.status(200).send(ical);
};

// ─── iCal generation ───────────────────────────────────────────────────────

function generateICal(todos) {
  const now = fmtDatetime(new Date());
  const events = todos.map(t => buildEvent(t, now)).filter(Boolean).join('\r\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Todo Manager//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Todo Manager',
    'X-WR-CALDESC:Your tasks from Todo Manager',
    events,
    'END:VCALENDAR',
  ].join('\r\n');
}

function buildEvent(t, now) {
  const isRec = t.recurrence && t.recurrence !== 'none';

  if (!isRec && !t.date) return null; // inbox task — no date, skip

  const uid = `${t.id}@todo-manager.app`;
  const summary = escIcal(t.title || '');
  const desc = t.description ? `DESCRIPTION:${escIcal(t.description)}\r\n` : '';
  const cat = t.projectId ? `CATEGORIES:${escIcal(t.projectId)}\r\n` : '';
  const status = t.completed ? 'STATUS:COMPLETED\r\n' : '';

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
    if (t.endDate) rrule += `;UNTIL=${t.endDate.replace(/-/g, '')}`;

    // Build EXDATE for excluded occurrences
    const exdates = (t.excludedDates || []).length > 0
      ? `EXDATE;VALUE=DATE:${t.excludedDates.map(d => d.replace(/-/g, '')).join(',')}\r\n`
      : '';

    return [
      'BEGIN:VEVENT',
      `UID:${uid}-rec`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${start.replace(/-/g, '')}`,
      `SUMMARY:${summary}`,
      desc + cat + status + exdates + rrule,
      'END:VEVENT',
    ].join('\r\n');
  } else {
    const dtstart = t.date.replace(/-/g, '');
    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${dtstart}`,
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
