import { chromium } from 'playwright-core';

const BASE = 'http://127.0.0.1:4000';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const TITLE = `QA Test Case ${Date.now().toString(36)}`;

const b = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

try {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[autocomplete="username"]', 'admin');
  await page.fill('input[autocomplete="current-password"]', 'tac3t-admin');
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 10000 });

  // go to new case form
  await page.goto(`${BASE}/cases/new`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#newcase-title', { timeout: 10000 });
  await page.fill('#newcase-title', TITLE);
  await page.fill('#newcase-desc', 'End-to-end QA test case.');
  await page.fill('#newcase-tags', 'qa, e2e');

  // wait for actors to load, select first two rows
  await page.waitForSelector('button[type="button"]:has-text("%")', { timeout: 10000 });
  const rows = page.locator('div.max-h-64 > button');
  const count = await rows.count();
  console.log('identity rows:', count);
  await rows.nth(0).click();
  await rows.nth(1).click();

  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/cases`, { timeout: 10000 });
  await page.waitForTimeout(1200);

  const text = await page.evaluate(() => document.body.innerText);
  const found = text.includes(TITLE);
  console.log(found ? 'PASS case created and visible in list' : 'FAIL case not visible');
  console.log('page errors:', errors.length ? errors.join(' | ') : 'none');
  process.exit(found ? 0 : 1);
} finally {
  await b.close();
}