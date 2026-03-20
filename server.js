// ════════════════════════════════════════════════════════
//  TODO LOCAL API SERVER
//  API  → http://localhost:3333
//  App  → http://localhost:3000
// ════════════════════════════════════════════════════════

import http  from 'http';
import fs    from 'fs';
import path  from 'path';
import os    from 'os';
import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Load .env ────────────────────────────────────────────
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
}

const API_PORT  = 3333;
const APP_PORT  = 3000;
const DATA_DIR  = path.join(os.homedir(), '.todo-hugues');
const APP_DIR   = __dirname;
const SA_PATH   = path.join(APP_DIR, 'firebase-service-account.json');

// UIDs that have super-admin access (comma-separated env var)
const ADMIN_UIDS = (process.env.ADMIN_UIDS || '').split(',').map(s => s.trim()).filter(Boolean);

// ── Firebase Admin init ──────────────────────────────────
let adminReady = false;
if (fs.existsSync(SA_PATH)) {
  const serviceAccount = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  adminReady = true;
  console.log('  Auth → Firebase Admin ready');
} else {
  console.warn('  Auth → firebase-service-account.json not found — auth disabled (dev mode)');
}

// ── Data helpers ────────────────────────────────────────
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function dataFile(uid) {
  // Sanitise uid to prevent path traversal
  const safe = uid.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(DATA_DIR, `data-${safe}.json`);
}

function readData(uid) {
  const f = dataFile(uid);
  if (!fs.existsSync(f)) return { calendar: [], categories: null, templates: null, suggestedTasks: null, taskOrder: null, config: null };
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch { return { calendar: [] }; }
}

function writeData(uid, data) {
  fs.writeFileSync(dataFile(uid), JSON.stringify(data, null, 2), 'utf8');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', c => s += c);
    req.on('end', () => { try { resolve(JSON.parse(s)); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

// ── Auth middleware ──────────────────────────────────────
// Verifies the Firebase ID token from Authorization: Bearer <token>.
// Returns the uid, or null if auth is disabled / token invalid.
async function verifyToken(req) {
  if (!adminReady) return 'dev-user'; // no service account → single dev user

  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

// ── Admin auth middleware ────────────────────────────────
// Returns uid if the request comes from a super-admin, null otherwise.
async function verifyAdmin(req) {
  if (!adminReady) return 'dev-admin';

  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    if (ADMIN_UIDS.includes(decoded.uid) || decoded.admin === true) return decoded.uid;
    return null;
  } catch {
    return null;
  }
}

// ── CORS headers ────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ── API server (:3333) ───────────────────────────────────
http.createServer(async (req, res) => {
  Object.entries({ ...CORS, 'Content-Type': 'application/json' }).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  try {
    const uid = await verifyToken(req);
    if (!uid) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    // ── Super-admin routes (/admin/*) ────────────────────
    if (req.url.startsWith('/admin/')) {
      const adminUid = await verifyAdmin(req);
      if (!adminUid) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: 'Forbidden — not an admin' }));
        return;
      }

      // GET /admin/users — list all Firebase Auth accounts
      if (req.method === 'GET' && req.url === '/admin/users') {
        if (!adminReady) { res.writeHead(503); res.end(JSON.stringify({ error: 'Firebase Admin not ready' })); return; }
        const result = await admin.auth().listUsers(1000);
        const users  = result.users.map(u => ({
          uid:          u.uid,
          email:        u.email        || null,
          displayName:  u.displayName  || null,
          isAnonymous:  u.providerData.length === 0,
          creationTime: u.metadata.creationTime,
          lastSignIn:   u.metadata.lastSignInTime,
          disabled:     u.disabled,
        }));
        res.writeHead(200);
        res.end(JSON.stringify(users));

      // GET /admin/presence — list currently online users (from Firestore)
      } else if (req.method === 'GET' && req.url === '/admin/presence') {
        if (!adminReady) { res.writeHead(503); res.end(JSON.stringify({ error: 'Firebase Admin not ready' })); return; }
        const snap   = await admin.firestore().collection('presence').where('online', '==', true).get();
        const online = [];
        snap.forEach(d => online.push({ uid: d.id, ...d.data(), lastSeen: d.data().lastSeen?.toMillis?.() ?? null }));
        res.writeHead(200);
        res.end(JSON.stringify(online));

      // POST /admin/message — send a message to a specific user
      } else if (req.method === 'POST' && req.url === '/admin/message') {
        if (!adminReady) { res.writeHead(503); res.end(JSON.stringify({ error: 'Firebase Admin not ready' })); return; }
        const { targetUid, message } = await readBody(req);
        if (!targetUid || !message) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Missing targetUid or message' }));
          return;
        }
        await admin.firestore()
          .collection('admin_messages').doc(targetUid)
          .collection('inbox').add({
            message,
            from:   'admin',
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            read:   false,
          });
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));

      // GET /admin/messages/:uid — full thread for a user
      } else if (req.method === 'GET' && req.url.startsWith('/admin/messages/')) {
        if (!adminReady) { res.writeHead(503); res.end(JSON.stringify({ error: 'Firebase Admin not ready' })); return; }
        const targetUid = decodeURIComponent(req.url.slice('/admin/messages/'.length));
        if (!targetUid) { res.writeHead(400); res.end(JSON.stringify({ error: 'Missing uid' })); return; }
        const snap = await admin.firestore()
          .collection('admin_messages').doc(targetUid)
          .collection('inbox')
          .orderBy('sentAt', 'asc')
          .get();
        const messages = [];
        snap.forEach(d => messages.push({
          id:      d.id,
          message: d.data().message,
          from:    d.data().from || 'admin',
          sentAt:  d.data().sentAt?.toMillis?.() ?? null,
          read:    d.data().read,
        }));
        res.writeHead(200);
        res.end(JSON.stringify(messages));

      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Unknown admin route' }));
      }
      return;
    }

    // GET /todos
    if (req.method === 'GET' && req.url === '/todos') {
      res.writeHead(200);
      res.end(JSON.stringify(readData(uid).calendar || []));

    // POST /todos
    } else if (req.method === 'POST' && req.url === '/todos') {
      const todos = await readBody(req);
      const data  = readData(uid);
      data.calendar = todos;
      writeData(uid, data);
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));

    // GET /backup
    } else if (req.method === 'GET' && req.url === '/backup') {
      res.writeHead(200);
      res.end(JSON.stringify(readData(uid)));

    // POST /backup
    } else if (req.method === 'POST' && req.url === '/backup') {
      writeData(uid, await readBody(req));
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));

    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    }

  } catch (err) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
}).listen(API_PORT, () => {
  console.log(`  API  → http://localhost:${API_PORT}  (GET|POST /todos, GET|POST /backup)`);
  console.log(`  Data → ${DATA_DIR}/data-{uid}.json`);
});

// ── Static file server (:3000) ───────────────────────────
const MIME = {
  '.html': 'text/html',
  '.js':   'text/javascript',
  '.css':  'text/css',
  '.svg':  'image/svg+xml',
  '.json': 'application/json',
  '.ico':  'image/x-icon',
};

http.createServer((req, res) => {
  let filePath = path.join(APP_DIR, req.url === '/' ? 'index.html' : req.url);
  if (!filePath.startsWith(APP_DIR)) { res.writeHead(403); res.end(); return; }
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(APP_PORT, () => {
  console.log(`  App  → http://localhost:${APP_PORT}`);
});

console.log('\nTodo server started:');
