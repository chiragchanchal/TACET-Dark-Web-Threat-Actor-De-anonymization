import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { openDb, ensureDataDir, stats, countUsers, verifyAuditChain, DB_PATH } from './db.js';
import { seedUsers } from './auth.js';
import { seedDemo } from './seed.js';
import { loadSanctions } from './services/sanctions.js';

import authRouter from './routes/auth.js';
import dashboardRouter from './routes/dashboard.js';
import actorsRouter from './routes/actors.js';
import postsRouter from './routes/posts.js';
import graphRouter from './routes/graph.js';
import cryptoRouter from './routes/crypto.js';
import ingestRouter from './routes/ingest.js';
import casesRouter from './routes/cases.js';
import auditRouter from './routes/audit.js';
import analysisRouter from './routes/analysis.js';
import sanctionsRouter from './routes/sanctions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- bootstrap ----
ensureDataDir();
openDb();

if (countUsers() === 0) {
  seedUsers();
  seedDemo();
  console.log('First boot: database created, users + corpus seeded.');
}

// real sanctions registry (idempotent, safe on every boot)
loadSanctions();

console.log(`  SQLite database    → ${DB_PATH}`);
const bootStats = stats();
console.log(`  Rows: ${bootStats.actors} actors · ${bootStats.posts} posts · ${bootStats.addresses} addresses · ${bootStats.links} links · ${bootStats.cases} cases · ${bootStats.sanctions} sanctioned addrs`);

// ---- Express app ----
const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.text({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ---- API routes ----
app.use('/api/auth', authRouter());
app.use('/api/dashboard', dashboardRouter());
app.use('/api/actors', actorsRouter());
app.use('/api/posts', postsRouter());
app.use('/api/graph', graphRouter());
app.use('/api/crypto', cryptoRouter());
app.use('/api/ingest', ingestRouter());
app.use('/api/cases', casesRouter());
app.use('/api/audit', auditRouter());
app.use('/api/analysis', analysisRouter());
app.use('/api/sanctions', sanctionsRouter());

// Health check — real database stats + audit-chain integrity
app.get('/api/health', (req, res) => {
  const s = stats();
  const chain = verifyAuditChain();
  res.json({
    ok: true,
    database: 'sqlite',
    engine: 'node:sqlite',
    actors: s.actors,
    posts: s.posts,
    addresses: s.addresses,
    links: s.links,
    ingestionRuns: s.ingestRuns,
    cases: s.cases,
    auditEntries: s.audit,
    auditChainValid: chain.valid,
    sanctionedAddresses: s.sanctions,
  });
});

// ---- static frontend (built Vite output) ----
const staticDir = path.resolve(__dirname, '../../web/dist');
app.use(express.static(staticDir));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Endpoint not found' });
  const indexPath = path.join(staticDir, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err && !res.headersSent) {
      res.status(200).send('<!DOCTYPE html><html><head><title>TACET</title></head><body>TACET Backend API active. Web frontend building...</body></html>');
    }
  });
});

// Express global error handling middleware
app.use((err, req, res, next) => {
  console.error('[API ERROR]', err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({
    ok: false,
    error: err.message || 'Internal server error',
  });
});

// Process safety guards
process.on('unhandledRejection', (reason) => {
  console.warn('[SERVER WARNING] Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[SERVER ERROR] Uncaught exception:', err);
});

// ---- start ----
app.listen(config.port, config.host, () => {
  console.log(`\n  TACET API running → http://${config.host}:${config.port}/api/health`);
  console.log(`  Frontend           → http://${config.host}:${config.port}\n`);
});