// Vercel Serverless Function — GET /api/ical?token=<token>
// Generates a live iCal feed from the user's Supabase todos.

import { supabase } from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).end(); return; }

  const { token } = req.query;
  if (!token || token.length < 20) {
    res.status(401).send('Missing or invalid token');
    return;
  }

  const sepIdx = token.indexOf('_');
  if (sepIdx < 5) {
    res.status(401).send('Invalid token format');
    return;
  }
  const uid    = token.slice(0, sepIdx);
  const secret = token.slice(sepIdx + 1);

  let todos = [];
  let config = {};
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('data')
      .eq('user_id', uid)
      .maybeSingle();

    if (error) throw error;
    if (!data || data.data?.icalSecret !== secret) {
      res.status(401).send('Invalid token');
      return;
    }

    todos  = data.data.calendar || data.data.todos || [];
    config = data.data.config || {};
  } catch (err) {
    console.error('ical data read error:', err);
    res.status(500).send('Internal error');
    return;
  }

  const tz       = config.timezone || 'America/Montreal';
  const icalHour = config.icalHour || '05:00';
  const [hh, mm] = icalHour.split(':');
  const baseMins = parseInt(hh, 10) * 60 + parseInt(mm, 10);

  const f = config.icalFilters || {};
  const filtered = todos.filter(t => {
    if (t.completed && !f.completed) return false;
    const isRec = t.recurrence && t.recurrence !== 'none';
    if (isRec  && f.recurring === false) return false;
    if (!isRec && f.oneTime   === false) return false;
    return true;
  });

  const ical = generateICal(filtered, tz, baseMins);

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="todo-manager.ics"');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.status(200).send(ical);
};

// ─── iCal generation ───────────────────────────────────────────────────────

function minsToTime(mins) {
  const m = ((mins % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, '0') + String(m % 60).padStart(2, '0') + '00';
}

function generateICal(todos, tz, baseMins) {
  const now = fmtDatetime(new Date());
  let idx = 0;
  const events = todos.map(t => {
    const ev = buildEvent(t, now, tz, baseMins, idx);
    if (ev) idx++;
    return ev;
  }).filter(Boolean).join('\r\n');
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

function buildEvent(t, now, tz, baseMins, idx) {
  const isRec = t.recurrence && t.recurrence !== 'none';
  if (!isRec && !t.date) return null;

  const startMins = baseMins + idx * 30;
  const endMins   = startMins + 30;
  const timeStr    = minsToTime(startMins);
  const endTimeStr = minsToTime(endMins);

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
