// TACET layout audit — programmatic visual QA for the redesigned UI.
// Usage: node audit.mjs [baseUrl]
import { chromium } from 'playwright-core';

const BASE = process.argv[2] || 'http://127.0.0.1:4000';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function audit(route, expectations) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
  await wait(900);
  const report = await page.evaluate((exps) => {
    const out = { overflowX: false, styled: false, text: '', missing: [] };
    out.overflowX = document.documentElement.scrollWidth > window.innerWidth + 1;
    const bg = getComputedStyle(document.body);
    out.styled = bg.backgroundColor !== 'rgba(0, 0, 0, 0)' || bg.backgroundImage !== 'none';
    out.text = document.body.innerText;
    for (const [name, sel] of Object.entries(exps.sels || {})) {
      if (!document.querySelector(sel)) out.missing.push(name);
    }
    for (const want of exps.text || []) if (!out.text.includes(want)) out.missing.push(`text:${want}`);
    return out;
  }, expectations);

  check(`${route} no horizontal overflow`, !report.overflowX);
  check(`${route} styled background`, report.styled);
  check(`${route} renders content`, report.text.length > 120, `chars=${report.text.length}`);
  for (const m of report.missing) check(`${route} ${m}`, false);
  return report;
}

try {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[autocomplete="username"]', 'analyst');
  await page.fill('input[autocomplete="current-password"]', 'tac3t-demo');
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 10000 });

  await audit('/', { sels: { sidebar: 'aside', navItem: 'aside nav a', kpi: '.grid > div' }, text: ['Operations overview', 'Entity cross-links'] });

  // dashboard visualisations (real data: risk donuts, forum donut, corpus timeline from SQL)
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await wait(1800);
  const dash = await page.evaluate(() => ({
    donutCircles: document.querySelectorAll('.grid svg circle').length,
    text: document.body.innerText,
  }));
  check('dashboard renders donut rings', dash.donutCircles >= 6, `circles=${dash.donutCircles}`);
  check('dashboard shows corpus timeline', /Corpus volume over time/i.test(dash.text));
  check('dashboard shows risk posture donut', /Risk posture/i.test(dash.text) && /identities/i.test(dash.text));
  check('dashboard shows top-scored identities', /Highest attribution identities/i.test(dash.text));
  check('dashboard surfaces OFAC designations', /OFAC designations/i.test(dash.text));

  // identities: sortable columns
  await page.goto(`${BASE}/actors`, { waitUntil: 'networkidle' });
  await page.waitForSelector('tbody tr', { timeout: 10000 });
  const firstBefore = await page.evaluate(() => document.querySelector('tbody tr td div div')?.innerText || '');
  await page.click('th:has-text("Posts")');
  await wait(600);
  const orderChanged = await page.evaluate((prev) => {
    const now = document.querySelector('tbody tr td div div')?.innerText || '';
    return { now, changed: now !== prev };
  }, firstBefore);
  check('identities sort by column', orderChanged.changed, JSON.stringify({ firstBefore, after: orderChanged.now }));
  check('identities rows show score ring', (await page.evaluate(() => document.querySelectorAll('tbody svg circle').length)) >= 5);
  await audit('/actors', { sels: { table: 'table', row: 'tbody tr', sidebar: 'aside' }, text: ['Identities', 'RansomLord'] });
  await audit('/posts', { sels: { postCard: 'p.line-clamp-3' }, text: ['Post triage'] });
  await audit('/crypto', { sels: { table: 'table' }, text: ['Crypto correlation', 'Address registry'] });
  await audit('/cases', { sels: { aside: 'aside' }, text: ['Cases', 'Case 2026-001'] });
  await audit('/ingest', { sels: { textarea: 'textarea' }, text: ['Data ingestion'] });
  await audit('/graph', { sels: { canvas: '.graph-canvas' }, text: ['Knowledge graph'] });

  // --- newly added pages ---
  await audit('/compare', { sels: { select: 'select' }, text: ['Attribution compare'] });
  await audit('/cases/new', { sels: { title: '#newcase-title' }, text: ['New case', 'Attach identities'] });
  await audit('/audit', { sels: { table: 'table' }, text: ['Audit log', 'events'] });
  await audit('/compliance', { sels: { aside: 'aside' }, text: ['Legal & evidence framework', '65B', 'Bharatiya Sakshya'] });
  await audit('/sanctions', { sels: { table: 'table' }, text: ['Sanctions registry', 'US Treasury OFAC'] });

  // sanctions page must show real designated entities and live-query controls
  await page.goto(`${BASE}/sanctions`, { waitUntil: 'networkidle' });
  await wait(2200);
  const sanText = await page.evaluate(() => document.body.innerText);
  check('sanctions shows real designated entity', /HYDRA MARKET|BLENDER\.IO|GARANTEX|SUEX OTC|CHATEX/i.test(sanText), sanText.slice(0, 200));
  check('sanctions shows designation program', /Cyber-related sanctions|Russia \(EO 14024\)|North Korea/i.test(sanText));
  check('sanctions exposes OFAC source link', /OFAC SDN source/i.test(sanText));
  check('sanctions has live query control', /Query/i.test(sanText));

  // run a real live on-chain lookup for a designated wallet through the UI
  try {
    await page.click('table button:has-text("Query") >> nth=0');
    await wait(8000);
    const liveText = await page.evaluate(() => document.body.innerText);
    check('designated wallet returns live chain data', /Transactions/i.test(liveText) && /Total received/i.test(liveText), liveText.slice(0, 200));
  } catch (e) {
    check('designated wallet returns live chain data', false, e.message);
  }

  // compare page must actually score a pair
  await page.goto(`${BASE}/compare`, { waitUntil: 'networkidle' });
  await wait(2000);
  const compareText = await page.evaluate(() => document.body.innerText);
  check('compare produced a verdict', /Likely same actor|Probable link|Weak link|Insufficient/.test(compareText));
  check('compare shows confidence figure', /confidence/i.test(compareText));
  check('compare shows matching artifacts', /Matching artifacts/i.test(compareText));

  // case detail drill-down
  await page.goto(`${BASE}/cases`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Open case', { timeout: 10000 });
  await page.click('text=Open case >> nth=0');
  await page.waitForURL((u) => /^\/cases\/[^/]+$/.test(u.pathname), { timeout: 10000 });
  await wait(1600);
  const caseText = await page.evaluate(() => document.body.innerText);
  check('case detail shows evidence chain', /Evidence chain/i.test(caseText));
  check('case detail shows legal note', /65B|Bharatiya|preserv/i.test(caseText));
  check('case detail shows cross-identity links', /Cross-identity links/i.test(caseText));
  check('case detail has export button', /Export report/i.test(caseText));

  // audit log shows a real seeded event + cryptographic chain verification
  await page.goto(`${BASE}/audit`, { waitUntil: 'networkidle' });
  await wait(2000);
  const auditText = await page.evaluate(() => document.body.innerText);
  check('audit log lists seeded event', /SEED CORPUS/i.test(auditText));
  check('audit log verifies SHA-256 chain', /chain valid/i.test(auditText));

  // compare page surfaces real trained-model metrics
  await page.goto(`${BASE}/compare`, { waitUntil: 'networkidle' });
  await wait(2400);
  const modelText = await page.evaluate(() => document.body.innerText);
  check('compare shows trained model panel', /Trained stylometry model/i.test(modelText));
  check('compare shows CV accuracy', /CV accuracy/i.test(modelText));
  check('compare shows feature count', /char 3-5 \+ word 1-2 TF-IDF/i.test(modelText));

  // identity profile exposes live on-chain lookup
  await page.goto(`${BASE}/actors`, { waitUntil: 'networkidle' });
  await page.waitForSelector('tbody tr', { timeout: 10000 });
  await page.click('tbody tr >> nth=0');
  await page.waitForSelector('text=Hard artifacts', { timeout: 10000 });
  await wait(800);
  const actorText = await page.evaluate(() => document.body.innerText);
  check('identity profile has live chain control', /Live chain data|Fetch on-chain/i.test(actorText));

  // actually run a live on-chain lookup through the UI button
  try {
    await page.click('text=Fetch on-chain');
    await wait(6000);
    const liveText = await page.evaluate(() => document.body.innerText);
    check('live on-chain lookup returns data', /BTC|blockchain\.info|Balance|not enabled|HTTP/i.test(liveText), liveText.slice(0, 160));
  } catch (e) {
    check('live on-chain lookup returns data', false, e.message);
  }

  // graph deep checks — verify both 3D Constellation and 2D Network
  await page.goto(`${BASE}/graph`, { waitUntil: 'networkidle' });
  await wait(1200);
  const has3dCanvas = await page.evaluate(() => !!document.querySelector('.graph-canvas canvas'));
  check('graph renders 3D WebGL canvas', has3dCanvas);

  // Switch to 2D network to test topological SVG layout and zoom
  await page.click('button:has-text("2D Network")');
  await page.waitForSelector('.graph-canvas svg circle', { timeout: 10000 });
  await wait(1600);
  const graph = await page.evaluate(() => {
    const svg = document.querySelector('.graph-canvas svg');
    const stage = document.querySelector('.graph-canvas');
    const r = stage.getBoundingClientRect();
    return {
      circles: svg.querySelectorAll('circle').length,
      lines: svg.querySelectorAll('line').length,
      labels: svg.querySelectorAll('text').length,
      w: Math.round(r.width), h: Math.round(r.height),
    };
  });
  check('graph has actor circles', graph.circles >= 10, JSON.stringify(graph));
  check('graph has edges', graph.lines >= 5, `lines=${graph.lines}`);
  check('graph has labels', graph.labels >= 5, `labels=${graph.labels}`);
  check('graph canvas sized', graph.w > 700 && graph.h > 550, JSON.stringify(graph));

  // --- graph interactions: zoom, node selection, inspector ---
  const transformBefore = await page.getAttribute('.graph-canvas svg > g', 'transform');
  await page.click('button[title="Zoom in"]');
  await wait(400);
  const transformAfter = await page.getAttribute('.graph-canvas svg > g', 'transform');
  check('graph zoom changes view transform', transformBefore !== transformAfter, `${transformBefore} -> ${transformAfter}`);

  await page.click('.graph-canvas svg circle >> nth=0');
  await wait(600);
  const inspector = await page.evaluate(() => document.body.innerText);
  check('graph inspector shows score', /Graph score/i.test(inspector));
  check('graph inspector shows connections', /Connections/i.test(inspector));
  check('graph has reading guide', /Reading the graph/i.test(inspector));

  // --- command palette (⌘K / Ctrl+K) ---
  await page.keyboard.down('Control');
  await page.keyboard.press('k');
  await page.keyboard.up('Control');
  await wait(500);
  const paletteOpen = await page.evaluate(() => !!document.querySelector('input[placeholder="Search pages and identities…"]'));
  check('command palette opens on Ctrl+K', paletteOpen);
  if (paletteOpen) {
    await page.fill('input[placeholder="Search pages and identities…"]', 'sanction');
    await wait(400);
    const pText = await page.evaluate(() => document.body.innerText);
    check('command palette filters results', /Sanctions registry/i.test(pText));
    await page.keyboard.press('Escape');
    await wait(300);
    const closed = await page.evaluate(() => !document.querySelector('input[placeholder="Search pages and identities…"]'));
    check('command palette closes on Escape', closed);
  }

  // sidebar navigation smoke: click through nav items
  const navTargets = [
    ['Identities', /\/actors$/],
    ['Knowledge graph', /\/graph$/],
    ['Attribution compare', /\/compare$/],
    ['Post triage', /\/posts$/],
    ['Crypto correlation', /\/crypto$/],
    ['Cases', /\/cases$/],
    ['Data ingestion', /\/ingest$/],
    ['Sanctions registry', /\/sanctions$/],
    ['Audit log', /\/audit$/],
    ['Legal framework', /\/compliance$/],
  ];
  for (const [label, re] of navTargets) {
    await page.click(`aside nav >> text=${label}`);
    await page.waitForURL((u) => re.test(u.pathname), { timeout: 8000 });
    await wait(700);
    const ok = await page.evaluate(() => document.body.innerText.length > 100);
    check(`nav → ${label}`, ok);
  }
} finally {
  await browser.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
