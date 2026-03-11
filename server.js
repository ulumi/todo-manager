// ════════════════════════════════════════════════════════
//  TODO LOCAL API SERVER
//  API  → http://localhost:3333
//  App  → http://localhost:3000
// ════════════════════════════════════════════════════════

const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const API_PORT  = 3333;
const APP_PORT  = 3000;
const DATA_DIR  = path.join(os.homedir(), '.todo-hugues');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const APP_DIR   = __dirname;

// ── Data helpers ────────────────────────────────────────
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readData() {
  if (!fs.existsSync(DATA_FILE)) return { calendar: [], categories: null, templates: null, suggestedTasks: null, taskOrder: null, config: null };
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return { calendar: [] }; }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', c => s += c);
    req.on('end', () => { try { resolve(JSON.parse(s)); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

// ── CORS headers ────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ── API server (:3333) ───────────────────────────────────
http.createServer(async (req, res) => {
  Object.entries({ ...CORS, 'Content-Type': 'application/json' }).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  try {
    // GET /todos
    if (req.method === 'GET' && req.url === '/todos') {
      res.writeHead(200);
      res.end(JSON.stringify(readData().calendar || []));

    // POST /todos
    } else if (req.method === 'POST' && req.url === '/todos') {
      const todos = await readBody(req);
      const data  = readData();
      data.calendar = todos;
      writeData(data);
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));

    // GET /backup
    } else if (req.method === 'GET' && req.url === '/backup') {
      res.writeHead(200);
      res.end(JSON.stringify(readData()));

    // POST /backup
    } else if (req.method === 'POST' && req.url === '/backup') {
      writeData(await readBody(req));
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
  console.log(`  Data → ${DATA_FILE}`);
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
  // prevent directory traversal
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
