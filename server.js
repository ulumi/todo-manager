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

      // POST /admin/generate-quotes — generate celebrate quotes via Claude API
      } else if (req.method === 'POST' && req.url === '/admin/generate-quotes') {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          res.writeHead(503);
          res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set in .env' }));
          return;
        }
        const { prompt, count = 5, lang = 'fr' } = await readBody(req);
        const langLabel = lang === 'fr' ? 'français' : 'English';
        const systemPrompt = lang === 'fr'
          ? `Tu génères des messages de célébration courts pour une app de gestion de tâches. Chaque message doit être en MAJUSCULES, percutant, entre 3 et 15 mots. Utilise des emojis avec parcimonie (0 ou 1 par message). Réponds UNIQUEMENT avec un tableau JSON de strings, rien d'autre.`
          : `You generate short celebration messages for a task management app. Each message must be in ALL CAPS, punchy, between 3 and 15 words. Use emojis sparingly (0 or 1 per message). Reply ONLY with a JSON array of strings, nothing else.`;
        const userMsg = lang === 'fr'
          ? `Génère exactement ${count} messages de célébration en ${langLabel}. Style / thème demandé : ${prompt || 'varié et original'}`
          : `Generate exactly ${count} celebration messages in ${langLabel}. Requested style / theme: ${prompt || 'varied and original'}`;

        const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMsg }],
          }),
        });
        if (!apiRes.ok) {
          const err = await apiRes.text();
          res.writeHead(502);
          res.end(JSON.stringify({ error: `Anthropic API error: ${err}` }));
          return;
        }
        const data = await apiRes.json();
        let raw  = data.content?.[0]?.text || '[]';
        // Strip markdown code block if Claude wraps the response (```json...```)
        raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
        let quotes;
        try {
          quotes = JSON.parse(raw);
          if (!Array.isArray(quotes)) quotes = [];
        } catch {
          quotes = [];
        }
        res.writeHead(200);
        res.end(JSON.stringify({ quotes }));

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
