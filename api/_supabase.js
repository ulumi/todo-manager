// ════════════════════════════════════════════════════════
//  Shared Supabase client + helpers for API endpoints
//  Prefix with _ so Vercel doesn't expose it as a route.
// ════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

// ⚠ La clé service_role ne doit JAMAIS être écrite en dur ici. Elle contourne
// entièrement RLS (lecture/écriture sur les données de TOUS les comptes), et
// une valeur de repli dans ce fichier est une valeur de repli dans un dépôt
// PUBLIC : la précédente y est restée 143 jours et était toujours active au
// moment de son retrait. Une variable d'environnement absente doit faire
// échouer l'API bruyamment, jamais la faire retomber sur un secret commité.
//
// L'URL, elle, n'est pas un secret : elle est déjà servie à chaque navigateur
// dans js/modules/supabase.js. Elle garde donc une valeur par défaut.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ztibrrmebnpzmflzghjb.supabase.co';
// SUPABASE_SECRET_KEY (sb_secret_…, nouveau schéma) est essayée AVANT
// SUPABASE_SERVICE_ROLE_KEY (JWT legacy). L'intégration Vercel de Supabase
// pose les deux, comme elle pose SUPABASE_PUBLISHABLE_KEY à côté de
// SUPABASE_ANON_KEY. Désactiver les clés legacy tue la seconde d'un coup :
// la préférer aurait fait tomber toute l'API serveur au moment même où on
// ferme la fuite. La clé nouveau schéma est aussi révocable individuellement,
// donc sans effet de bord sur le client navigateur.
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || '';

export const supabaseConfigured = Boolean(SUPABASE_KEY);

if (!supabaseConfigured) {
  console.error('[api] CONFIGURATION MANQUANTE : ni SUPABASE_SERVICE_ROLE_KEY ni SUPABASE_SECRET_KEY dans l\u2019environnement. Tout endpoint touchant Supabase va échouer. À poser dans les variables d\u2019environnement du projet Vercel.');
}

// createClient() lève si la clé est vide ; on lui passe un marqueur pour que
// l'échec soit un 401 traçable par appel plutôt qu'un crash du module qui
// ferait tomber TOUS les endpoints, y compris ceux qui n'en ont pas besoin.
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY || 'unconfigured-service-role-key');

export const ADMIN_UIDS = (process.env.ADMIN_UIDS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

export const APP_URL = 'https://todo.hugues.app';

export async function verifyToken(req) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export async function verifyAdmin(req) {
  const user = await verifyToken(req);
  if (!user) return null;
  return ADMIN_UIDS.includes(user.id) ? user : null;
}

export function corsHeaders(req, res) {
  const origin = req.headers.origin || '';
  const allowed = [APP_URL, 'http://localhost:5500', 'http://localhost:3000', 'http://127.0.0.1:5500'];
  res.setHeader('Access-Control-Allow-Origin', allowed.includes(origin) ? origin : APP_URL);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
}

export async function parseBody(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  let body = '';
  await new Promise(r => { req.on('data', c => body += c); req.on('end', r); });
  return JSON.parse(body);
}
