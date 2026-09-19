import { Router } from 'express';
import { requireAuth, requireRole } from '../auth.js';
import { listRuns, appendAudit, stats } from '../db.js';
import { parseDump, runPipeline } from '../services/ingest.js';
import { seedDemo } from '../seed.js';

export default function ingestRouter() {
  const r = Router();

  r.get('/runs', requireAuth, (req, res) => {
    res.json(listRuns(50));
  });

  // Accepts a raw dump as text, JSON ({text} / {posts} / {content}) or a body.
  r.post('/upload', requireAuth, (req, res, next) => {
    try {
      const forum = req.headers['x-forum'] || req.query.forum || 'breached';
      const userLabel = req.user?.username || 'system';
      const fileName = req.query.filename || 'upload.txt';

      let text = '';
      if (req.is('json')) {
        text = req.body?.text || req.body?.content || JSON.stringify(req.body?.posts || []);
      } else if (typeof req.body === 'string') {
        text = req.body;
      } else {
        text = req.body?.text || req.body?.content || '';
      }
      if (!text || !String(text).trim()) {
        return res.status(400).json({ error: 'Empty upload — send raw text or { "text": "…" }' });
      }

      const { posts, format } = parseDump(fileName, String(text));
      if (!posts || !posts.length) return res.status(422).json({ error: 'No posts could be parsed from the payload', format });

      const result = runPipeline(posts, { sourceForum: forum, format, user: userLabel });
      res.status(201).json({ ...result, format, preview: posts.slice(0, 2) });
    } catch (e) {
      console.error('[INGEST ERROR]', e);
      res.status(400).json({ error: `Ingestion failed: ${e.message}` });
    }
  });

  // Regenerate the deterministic corpus and reset the database.
  r.post('/seed', requireAuth, requireRole('admin'), (req, res) => {
    const out = seedDemo();
    appendAudit({ actor: req.user.username, action: 'SEED_RESET', detail: 'Corpus regenerated deterministically' });
    res.json({ ok: true, ...out, stats: stats() });
  });

  return r;
}