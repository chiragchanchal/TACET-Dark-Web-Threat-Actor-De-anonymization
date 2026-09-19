// TACET visual QA — screenshots every page using the system Edge browser.
// Usage: node screenshot.mjs [baseUrl]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] || 'http://127.0.0.1:4000';
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const shot = async (name) => { await page.screenshot({ path: path.join(OUT, `${name}.png`) }); console.log('shot:', name); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

try {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await wait(500);
  await shot('01-login');

  await page.fill('input[autocomplete="username"]', 'analyst');
  await page.fill('input[autocomplete="current-password"]', 'tac3t-demo');
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 10000 });
  await page.waitForSelector('h1:has-text("Operations overview")', { timeout: 10000 });
  await wait(700);
  await shot('02-dashboard');

  await page.goto(`${BASE}/actors`, { waitUntil: 'networkidle' });
  await page.waitForSelector('tbody tr', { timeout: 10000 });
  await wait(500);
  await shot('03-actors');

  await page.click('tbody tr >> nth=0');
  await page.waitForSelector('text=Hard artifacts', { timeout: 10000 });
  await wait(600);
  await shot('04-actor-detail');

  await page.goto(`${BASE}/graph`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.graph-canvas svg circle', { timeout: 10000 });
  await wait(1500);
  await shot('05-graph');

  await page.goto(`${BASE}/posts`, { waitUntil: 'networkidle' });
  await page.waitForSelector('textarea, h1:has-text("Post triage")', { timeout: 10000 });
  await page.waitForSelector('p.line-clamp-3', { timeout: 10000 });
  await wait(500);
  await shot('06-posts');

  await page.goto(`${BASE}/crypto`, { waitUntil: 'networkidle' });
  await page.waitForSelector('h1:has-text("Crypto correlation")', { timeout: 10000 });
  await page.waitForSelector('tbody tr', { timeout: 10000 });
  await wait(500);
  await shot('07-crypto');

  await page.goto(`${BASE}/cases`, { waitUntil: 'networkidle' });
  await page.waitForSelector('h1:has-text("Cases")', { timeout: 10000 });
  await page.waitForTimeout(600);
  await shot('08-cases');

  await page.goto(`${BASE}/ingest`, { waitUntil: 'networkidle' });
  await page.waitForSelector('textarea', { timeout: 10000 });
  await wait(500);
  await shot('09-ingest');

  // newly added pages
  await page.goto(`${BASE}/compare`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await shot('10-compare');

  await page.goto(`${BASE}/cases`, { waitUntil: 'networkidle' });
  await page.click('text=Open case >> nth=0');
  await page.waitForURL((u) => /^\/cases\/[^/]+$/.test(u.pathname), { timeout: 10000 });
  await page.waitForTimeout(1600);
  await shot('11-case-detail');

  await page.goto(`${BASE}/cases/new`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#newcase-title', { timeout: 10000 });
  await page.waitForTimeout(600);
  await shot('12-new-case');

  await page.goto(`${BASE}/audit`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);
  await shot('13-audit');

  await page.goto(`${BASE}/compliance`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await shot('14-compliance');

  await page.goto(`${BASE}/sanctions`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await shot('15-sanctions');

  const unique = [...new Set(errors)];
  console.log('\nconsole/page errors:', unique.length ? unique.join('\n') : 'none');
  fs.writeFileSync(path.join(OUT, 'errors.txt'), unique.join('\n') || 'none');
} finally {
  await browser.close();
}
