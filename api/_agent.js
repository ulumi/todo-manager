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
import { parseAgentConfig, agentEligible, isRunRequestPending } from '../js/modules/claudeAgent.js';

const DOCS = 'https://todo.hugues.app/api/docs';

// Réglages (écrits par Hugues) + exécution (écrite ici). Les seconds vivent
// HORS de `config` : le navigateur remplace `config` à chaque push, donc tout
// ce que le serveur y écrirait serait effacé quelques secondes plus tard.
function readConfig(data) {
  const settings = parseAgentConfig(data?.config?.claudeAgent);
  const runtime  = (data?.agentRuntime && typeof data.agentRuntime === 'object') ? data.agentRuntime : {};
  return parseAgentConfig({ ...settings, ...runtime });
}

// N'écrit QUE data.agentRuntime — jamais data.config, qui appartient au client.
function writeRuntime(data, cfg, patch) {
  const cur = (data.agentRuntime && typeof data.agentRuntime === 'object') ? data.agentRuntime : {};
  const next = { ...cur, ...patch };
  for (const k of Object.keys(next)) if (next[k] == null) delete next[k];
  data.agentRuntime = next;
  return next;
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
        trigger:  cfg.trigger,
        lastRun:  cfg.lastRun,
        // Une demande périmée est renvoyée comme absente : le runner ne doit
        // pas exécuter au réveil du Mac un clic qui date d'hier soir.
        runRequested: isRunRequestPending(cfg),
        progress: cfg.progress,
        count:    tasks.length,
        tasks:    tasks.slice(0, cfg.maxPerRun).map(t => serializeTask(t, null)),
      });
      return;
    }

    if (req.method === 'POST') {
      const body = await readBody(req);

      // Demande de passage immédiat, déposée par le bouton du panneau. Une
      // page web ne peut pas démarrer un processus sur la machine : elle pose
      // un drapeau, le runner local le ramasse à son prochain réveil.
      if (body.requestRun === true) {
        const at = Date.now();
        writeRuntime(data, cfg, { runRequest: { at } });
        await commitTodos(uid, data, todosOf(data));
        res.status(200).json({ ok: true, requested: true, at });
        return;
      }

      // Ligne de progression publiée par l'agent pendant qu'il travaille
      // (notify.sh l'envoie en même temps qu'à Telegram). Le panneau de
      // l'Inbox l'affiche en direct via Realtime. Une écriture par étape, pas
      // un battement de cœur périodique : chaque écriture retéléverse la ligne
      // entière (cf. l'egress dans Sync flow), donc elle doit correspondre à
      // un événement réel, jamais à un minuteur.
      if (typeof body.progress === 'string' && body.progress.trim()) {
        const progress = { at: Date.now(), text: body.progress.trim().slice(0, 300) };
        writeRuntime(data, cfg, { progress });
        await commitTodos(uid, data, todosOf(data));
        res.status(200).json({ ok: true, progress });
        return;
      }

      // Le runner réclame la demande AVANT de travailler, jamais après : si le
      // passage échoue, le drapeau est déjà consommé et rien ne repart en
      // boucle sur la même demande.
      if (body.claimRun === true) {
        const claimed = isRunRequestPending(cfg);
        if (cfg.runRequest) {
          writeRuntime(data, cfg, { runRequest: null });
          await commitTodos(uid, data, todosOf(data));
        }
        res.status(200).json({ ok: true, claimed });
        return;
      }

      const lastRun = {
        at:      Date.now(),
        done:    Number(body.done)    || 0,
        skipped: Number(body.skipped) || 0,
        note:    String(body.note ?? '').slice(0, 500),
      };
      // Fin du passage : plus de demande en cours, plus rien « en cours ».
      writeRuntime(data, cfg, { runRequest: null, progress: null, lastRun });
      await commitTodos(uid, data, todosOf(data));
      res.status(200).json({ ok: true, lastRun });
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
