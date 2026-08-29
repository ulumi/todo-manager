// Vercel Serverless Function — the public task surfaces, behind ONE function.
//
//   /api/mcp    → MCP connector for the Claude apps   (_mcp.js)
//   /api/tasks  → REST for Shortcuts / curl / scripts (_tasks.js)
//   /api/docs   → public reference, no token          (_docs.js)
//   /api/agent  → réglages + file de travail de l'agent (_agent.js)
//
// Those pretty paths are rewrites onto this dynamic route (vercel.json).
// They are NOT separate files because the Hobby plan caps a deployment at 12
// Serverless Functions and the project was already at exactly 12 — a dynamic
// route counts as one. The handlers themselves stay in separate _-prefixed
// modules (underscore = not a route of its own); this file only dispatches.

import mcp   from '../_mcp.js';
import tasks from '../_tasks.js';
import docs  from '../_docs.js';
import agent from '../_agent.js';

const SURFACES = { mcp, tasks, docs, agent };

export default async function handler(req, res) {
  const fn = SURFACES[String(req.query.surface || '').toLowerCase()];
  if (!fn) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(404).json({ error: 'Unknown surface.', available: Object.keys(SURFACES), docs: 'https://todo.hugues.app/api/docs' });
    return;
  }
  return fn(req, res);
}
