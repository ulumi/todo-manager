// ════════════════════════════════════════════════════════
//  TODO LOCAL API SERVER
//  API  → http://localhost:3333
//  App  → http://localhost:3000
// ════════════════════════════════════════════════════════

const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const admin = require('firebase-admin');

const API_PORT  = 3333;
const APP_PORT  = 3000;
const DATA_DIR  = path.join(os.homedir(), '.todo-hugues');
const APP_DIR   = __dirname;
const SA_PATH   = path.join(APP_DIR, 'firebase-service-account.json');

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
