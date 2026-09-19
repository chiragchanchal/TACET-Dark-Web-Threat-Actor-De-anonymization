import { Router } from 'express';
import { requireAuth, requireRole } from '../auth.js';
import { listAudit, verifyAuditChain } from '../db.js';

export default function auditRouter() {
  const r = Router();

  r.get('/', requireAuth, requireRole('admin', 'analyst'), (req, res) => {
    const { limit = 100, action } = req.query;
    res.json(listAudit(Math.min(Number(limit) || 100, 500), action || null));
  });

  // Cryptographic integrity check of the whole audit chain.
  r.get('/verify', requireAuth, requireRole('admin', 'analyst'), (req, res) => {
    res.json(verifyAuditChain());
  });

  return r;
}