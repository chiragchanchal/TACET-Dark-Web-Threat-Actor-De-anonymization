import { chromium } from 'playwright-core';

const b = await chromium.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto('http://127.0.0.1:4000/login', { waitUntil: 'networkidle' });
await page.fill('input[autocomplete="username"]', 'analyst');
await page.fill('input[autocomplete="current-password"]', 'tac3t-demo');
await page.click('button[type="submit"]');
await page.waitForURL('http://127.0.0.1:4000/');
await page.goto('http://127.0.0.1:4000/actors', { waitUntil: 'networkidle' });
await page.waitForSelector('tbody tr');
await page.click('tbody tr >> nth=0');
await page.waitForTimeout(2500);
console.log('URL:', page.url());
const text = await page.evaluate(() => document.body.innerText.slice(0, 600));
console.log('TEXT:', JSON.stringify(text));
console.log('ERRORS:', JSON.stringify(errors));
await b.close();
