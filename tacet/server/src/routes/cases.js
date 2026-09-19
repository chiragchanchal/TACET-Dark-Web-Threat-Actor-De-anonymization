import { Router } from 'express';
import { requireAuth, requireRole } from '../auth.js';
import {
  nextId, listCases, getCase, insertCase, updateCaseStatus, listActors, listLinks, appendAudit,
} from '../db.js';

export default function casesRouter() {
  const r = Router();

  r.get('/', requireAuth, (req, res) => {
    const { status } = req.query;
    const actors = new Map(listActors().map((a) => [a.id, a]));
    res.json(listCases({ status }).map((c) => ({
      ...c,
      actors: (c.actorIds || []).map((id) => {
        const a = actors.get(id);
        return a ? { id: a.id, handle: a.primaryHandle, risk: a.risk, score: Math.round(a.attributionScore || 0) } : null;
      }).filter(Boolean),
    })));
  });

  r.post('/', requireAuth, requireRole('admin', 'analyst'), (req, res) => {
    const { title, description, actorIds = [], tags = [] } = req.body || {};
    if (!title) return res.status(400).json({ error: 'title required' });
    const known = new Set(listActors().map((a) => a.id));
    const validActors = (Array.isArray(actorIds) ? actorIds : []).filter((id) => known.has(id));

    const c = {
      id: nextId('case'),
      title,
      description: description || '',
      actorIds: validActors,
      tags: Array.isArray(tags) ? tags : [],
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.user?.username || 'system',
    };
    insertCase(c);
    appendAudit({ actor: req.user.username, action: 'CASE_CREATED', detail: `${title} (${validActors.length} identities)` });
    res.status(201).json(c);
  });

  r.get('/:id', requireAuth, (req, res) => {
    const c = getCase(req.params.id);
    if (!c) return res.status(404).json({ error: 'Case not found' });
    const ids = new Set(c.actorIds);
    res.json({ ...c, actors: listActors().filter((a) => ids.has(a.id)) });
  });

  r.post('/:id/status', requireAuth, requireRole('admin'), (req, res) => {
    const c = getCase(req.params.id);
    if (!c) return res.status(404).json({ error: 'Case not found' });
    const { status } = req.body || {};
    if (!['open', 'closed', 'escalated'].includes(status)) return res.status(400).json({ error: 'invalid status' });
    updateCaseStatus(c.id, status);
    appendAudit({ actor: req.user.username, action: 'CASE_STATUS', detail: `${c.title} → ${status}` });
    res.json({ ...getCase(c.id) });
  });

  // Evidence report: identities, artifacts, cross-links and integrity metadata.
  r.get('/:id/report', requireAuth, (req, res) => {
    const c = getCase(req.params.id);
    if (!c) return res.status(404).json({ error: 'Case not found' });

    const ids = new Set(c.actorIds);
    const members = listActors().filter((a) => ids.has(a.id));
    const handleById = new Map(members.map((a) => [a.id, a.primaryHandle]));

    const artifacts = members.map((a) => ({
      id: a.id,
      handle: a.primaryHandle,
      aliases: a.aliases,
      forums: a.forums,
      risk: a.risk,
      attributionScore: Math.round(a.attributionScore || 0),
      crypto: a.crypto,
      pgpKeys: a.pgpKeys,
      telegrams: a.telegrams,
      jabbers: a.jabbers,
      emails: a.emails,
      urls: a.urls,
      postCount: a.postCount,
    }));

    const evidence = listLinks()
      .filter((l) => ids.has(l.source) || ids.has(l.target))
      .map((l) => ({
        type: l.type,
        weight: l.weight,
        via: l.via,
        source: handleById.get(l.source) || l.source,
        target: handleById.get(l.target) || l.target,
        sourceInCase: ids.has(l.source),
        targetInCase: ids.has(l.target),
      }));

    res.json({
      case: c,
      generatedAt: new Date().toISOString(),
      generatedBy: req.user?.username,
      evidenceChain: {
        legalNote: 'Digital evidence collected from publicly available forum dumps and OSINT sources. For evidentiary use, preserve the original dump image, hash-chain the artifacts, and certify under IT Act §65B / Bharatiya Sakshya Adhiniyam 2023, consistent with NIST SP 800-86 guidance.',
        artifacts,
        crossLinks: evidence,
        counts: { identities: artifacts.length, crossLinks: evidence.length },
      },
    });
  });

  return r;
}