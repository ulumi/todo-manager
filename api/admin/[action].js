// Vercel Serverless Function — the admin endpoints, behind ONE function.
//
//   /api/admin-users, /api/admin-batch, /api/admin-messages,
//   /api/admin-presence, /api/admin-stats, /api/admin-user-action
//
// Those URLs are unchanged — they are rewrites onto this dynamic route
// (vercel.json), so admin.html keeps calling exactly what it always called.
// Collapsed into one function because the Hobby plan caps a deployment at 12
// Serverless Functions: six separate admin routes left no room for the public
// task API. The handlers themselves are untouched, just renamed with a leading
// underscore so Vercel stops treating each one as its own route.
//
// `[action]` cannot collide with a handler's own query params: the only one
// that reads an `action` (_admin-user-action.js) takes it from the POST body.

import users      from '../_admin-users.js';
import batch      from '../_admin-batch.js';
import messages   from '../_admin-messages.js';
import presence   from '../_admin-presence.js';
import stats      from '../_admin-stats.js';
import userAction from '../_admin-user-action.js';

const ACTIONS = { users, batch, messages, presence, stats, 'user-action': userAction };

export default async function handler(req, res) {
  const fn = ACTIONS[String(req.query.action || '').toLowerCase()];
  if (!fn) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(404).json({ error: 'Unknown admin endpoint.', available: Object.keys(ACTIONS) });
    return;
  }
  return fn(req, res);
}
