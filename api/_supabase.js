// ════════════════════════════════════════════════════════
//  Shared Supabase client + helpers for API endpoints
//  Prefix with _ so Vercel doesn't expose it as a route.
// ════════════════════════════════════════════════════════

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ztibrrmebnpzmflzghjb.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_SECRET_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0aWJycm1lYm5wem1mbHpnaGpiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjY3NzE4MCwiZXhwIjoyMDg4MjUzMTgwfQ.VkgQULfdcqY1S6x8UF6CPNDy3vOh5AwUUkMh-B-zFJs';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ADMIN_UIDS = (process.env.ADMIN_UIDS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

const APP_URL = 'https://todo.hugues.app';

async function verifyToken(req) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

async function verifyAdmin(req) {
  const user = await verifyToken(req);
  if (!user) return null;
  return ADMIN_UIDS.includes(user.id) ? user : null;
}

function corsHeaders(req, res) {
  const origin = req.headers.origin || '';
  const allowed = [APP_URL, 'http://localhost:5500', 'http://localhost:3000', 'http://127.0.0.1:5500'];
  res.setHeader('Access-Control-Allow-Origin', allowed.includes(origin) ? origin : APP_URL);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
}

async function parseBody(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  let body = '';
  await new Promise(r => { req.on('data', c => body += c); req.on('end', r); });
  return JSON.parse(body);
}

module.exports = { supabase, ADMIN_UIDS, APP_URL, verifyToken, verifyAdmin, corsHeaders, parseBody };
