// ════════════════════════════════════════════════════════
//  TODO LOCAL API SERVER
//  API  → http://localhost:3333
//  App  → http://localhost:3000
// ════════════════════════════════════════════════════════

import http  from 'http';
import fs    from 'fs';
import path  from 'path';
import os    from 'os';
import { createClient } from '@supabase/supabase-js';
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

// UIDs that have super-admin access (comma-separated env var)
const ADMIN_UIDS = (process.env.ADMIN_UIDS || '').split(',').map(s => s.trim()).filter(Boolean);

// ── Supabase init ────────────────────────────────────────
const SUPABASE_URL  = process.env.SUPABASE_URL  || 'https://ztibrrmebnpzmflzghjb.supabase.co';
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
let supabase = null;
if (SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log('  Auth → Supabase ready');
} else {
  console.warn('  Auth → No SUPABASE_SERVICE_ROLE_KEY — auth disabled (dev mode)');
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

const GLOBAL_QUOTES_FILE = path.join(DATA_DIR, 'global-quotes.json');
function readGlobalQuotes() {
  if (!fs.existsSync(GLOBAL_QUOTES_FILE)) return { customFR: [], customEN: [], banned: [] };
  try { return JSON.parse(fs.readFileSync(GLOBAL_QUOTES_FILE, 'utf8')); }
  catch { return { customFR: [], customEN: [], banned: [] }; }
}
function writeGlobalQuotes(data) {
  fs.writeFileSync(GLOBAL_QUOTES_FILE, JSON.stringify(data, null, 2), 'utf8');
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
// Verifies the Supabase access token from Authorization: Bearer <token>.
// Returns the uid, or null if auth is disabled / token invalid.
async function verifyToken(req) {
  if (!supabase) return 'dev-user'; // no Supabase key → single dev user

  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user.id;
  } catch {
    return null;
  }
}

// ── Admin auth middleware ────────────────────────────────
// Returns uid if the request comes from a super-admin, null otherwise.
async function verifyAdmin(req) {
  if (!supabase) return 'dev-admin';

  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    if (ADMIN_UIDS.includes(user.id)) return user.id;
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
  if (req.method === 'GET' && req.url === '/health') { res.writeHead(200); res.end('ok'); return; }

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

      // GET /admin/users — list all auth accounts
      if (req.method === 'GET' && req.url === '/admin/users') {
        if (!supabase) { res.writeHead(503); res.end(JSON.stringify({ error: 'Supabase not ready' })); return; }
        const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        const users = (authData?.users || []).map(u => ({
          uid:          u.id,
          email:        u.email || null,
          displayName:  u.user_metadata?.display_name || u.user_metadata?.full_name || null,
          isAnonymous:  u.is_anonymous ?? (!u.email),
          creationTime: u.created_at,
          lastSignIn:   u.last_sign_in_at,
          disabled:     u.banned_until != null,
        }));
        res.writeHead(200);
        res.end(JSON.stringify(users));

      // GET /admin/presence — list currently online users
      } else if (req.method === 'GET' && req.url === '/admin/presence') {
        if (!supabase) { res.writeHead(503); res.end(JSON.stringify({ error: 'Supabase not ready' })); return; }
        const { data } = await supabase.from('presence').select('*').eq('online', true);
        const online = (data || []).map(d => ({
          uid: d.user_id, ...d,
          lastSeen: d.last_seen ? new Date(d.last_seen).getTime() : null,
        }));
        res.writeHead(200);
        res.end(JSON.stringify(online));

      // POST /admin/message — send a message to a specific user
      } else if (req.method === 'POST' && req.url === '/admin/message') {
        if (!supabase) { res.writeHead(503); res.end(JSON.stringify({ error: 'Supabase not ready' })); return; }
        const { targetUid, message } = await readBody(req);
        if (!targetUid || !message) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Missing targetUid or message' }));
          return;
        }
        await supabase.from('admin_messages').insert({
          user_id: targetUid, message, sender: 'admin',
          sent_at: new Date().toISOString(), read: false,
        });
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));

      // GET /admin/messages/:uid — full thread for a user
      } else if (req.method === 'GET' && req.url.startsWith('/admin/messages/')) {
        if (!supabase) { res.writeHead(503); res.end(JSON.stringify({ error: 'Supabase not ready' })); return; }
        const targetUid = decodeURIComponent(req.url.slice('/admin/messages/'.length));
        if (!targetUid) { res.writeHead(400); res.end(JSON.stringify({ error: 'Missing uid' })); return; }
        const { data } = await supabase
          .from('admin_messages')
          .select('*')
          .eq('user_id', targetUid)
          .order('sent_at', { ascending: true });
        const messages = (data || []).map(m => ({
          id: m.id, message: m.message, from: m.sender,
          sentAt: new Date(m.sent_at).getTime(), read: m.read,
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

    // GET /global-quotes — public read (all authenticated users)
    } else if (req.method === 'GET' && req.url === '/global-quotes') {
      res.writeHead(200);
      res.end(JSON.stringify(readGlobalQuotes()));

    // POST /global-quotes — superadmin write only
    } else if (req.method === 'POST' && req.url === '/global-quotes') {
      if (!ADMIN_UIDS.includes(uid)) { res.writeHead(403); res.end(JSON.stringify({ error: 'Forbidden' })); return; }
      writeGlobalQuotes(await readBody(req));
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
  '.map':  'application/json',
  '.ico':  'image/x-icon',
};

http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0]; // strip query string
  let filePath = path.join(APP_DIR, urlPath === '/' ? 'index.html' : urlPath);
  if (!filePath.startsWith(APP_DIR)) { res.writeHead(403); res.end(); return; }

  function serveFile(fp) {
    const ext = path.extname(fp);
    fs.readFile(fp, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
  }

  // If path has no extension and no trailing slash, check if directory → redirect
  if (!path.extname(filePath) && !urlPath.endsWith('/')) {
    const indexPath = path.join(filePath, 'index.html');
    fs.access(indexPath, fs.constants.F_OK, err => {
      if (!err) {
        res.writeHead(302, { Location: urlPath + '/' });
        res.end();
      } else {
        serveFile(filePath);
      }
    });
  } else if (!path.extname(filePath) && urlPath.endsWith('/')) {
    serveFile(path.join(filePath, 'index.html'));
  } else {
    serveFile(filePath);
  }
}).listen(APP_PORT, () => {
  console.log(`  App  → http://localhost:${APP_PORT}`);
});

console.log('\nTodo server started:');
