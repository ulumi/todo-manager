// Vercel Serverless Function — /api/agent
//
//   GET  /api/agent?token=…   → les réglages + la liste de travail de l'agent
//   POST /api/agent?token=…   → le compte rendu de son passage
//
// Servi par api/todo/[surface].js (aucune fonction supplémentaire : le plan
// Hobby plafonne à 12, cf. CLAUDE.md).
//
// Existe parce que l'agent tourne HORS de l'app — un Claude Code headless sur
// la machine de Hugues — et doit pourtant obéir à l'interrupteur affiché dans
// l'Inbox. Sans ce point d'entrée, couper l'agent depuis le téléphone
// n'aurait aucun effet sur ce qui tourne sur le Mac.
//
// Le GET renvoie config ET liste de travail en UN aller-retour : le filtrage
// d'éligibilité vit dans js/modules/claudeAgent.js, importé ici comme
// _todo-store.js importe calendar.js, donc « ce que le panneau annonce » et
// « ce que l'agent ramasse » sont littéralement le même code.

import { ApiError, authenticate, todosOf, commitTodos, todayDS, serializeTask } from './_todo-store.js';
import { parseAgentConfig, serializeAgentConfig, agentEligible } from '../js/modules/claudeAgent.js';

const DOCS = 'https://todo.hugues.app/api/docs';

function readConfig(data) {
  return parseAgentConfig(data?.config?.claudeAgent);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  try {
    const { uid, data } = await authenticate(req);
    const cfg  = readConfig(data);
    const cats = Array.isArray(data.categories) ? data.categories : [];

    if (req.method === 'GET') {
      const { category, tasks } = agentEligible(todosOf(data), cats, cfg);
      // `enabled` et `category` sont renvoyés même quand ils bloquent tout :
      // l'agent doit pouvoir DIRE pourquoi il ne fait rien, pas juste ne rien
      // faire — un agent silencieux est indistinguable d'un agent en panne.
      res.status(200).json({
        enabled:  cfg.enabled,
        autonomy: cfg.autonomy,
        maxPerRun: cfg.maxPerRun,
        categoryName: cfg.categoryName,
        category: category ? { id: category.id, name: category.name } : null,
        today:    todayDS(data),
        lastRun:  cfg.lastRun,
        count:    tasks.length,
        tasks:    tasks.slice(0, cfg.maxPerRun).map(t => serializeTask(t, null)),
      });
      return;
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const next = {
        ...cfg,
        lastRun: {
          at:      Date.now(),
          done:    Number(body.done)    || 0,
          skipped: Number(body.skipped) || 0,
          note:    String(body.note ?? '').slice(0, 500),
        },
      };
      // La config est une CHAÎNE JSON dans data.config, comme agendaPrefs :
      // c'est ce que getAppConfig() (storage.js) téléverse et ce que
      // _applyBackup() réécrit tel quel en localStorage. Y ranger un objet
      // ferait échouer le parse côté navigateur au rechargement suivant.
      data.config = { ...(data.config || {}), claudeAgent: serializeAgentConfig(next) };
      await commitTodos(uid, data, todosOf(data));
      res.status(200).json({ ok: true, lastRun: next.lastRun });
      return;
    }

    res.setHeader('Allow', 'GET, POST, OPTIONS');
    res.status(405).json({ error: `Method ${req.method} not allowed.`, docs: DOCS });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    if (status === 500) console.error('[api/agent]', err);
    res.status(status).json({ error: status === 500 ? 'Internal error.' : err.message, docs: DOCS });
  }
}

async function readBody(req) {
  let body = req.body;
  if (body === undefined || body === null || body === '') {
    body = await new Promise((resolve, reject) => {
      let buf = '';
      req.on('data', c => { buf += c; if (buf.length > 1e6) reject(new ApiError(413, 'Body too large.')); });
      req.on('end', () => resolve(buf));
      req.on('error', reject);
    });
  }
  if (typeof body === 'string') {
    if (!body.trim()) return {};
    try { return JSON.parse(body); }
    catch { throw new ApiError(400, 'Body is not valid JSON.'); }
  }
  if (typeof body !== 'object') throw new ApiError(400, 'Body must be a JSON object.');
  return body;
}
