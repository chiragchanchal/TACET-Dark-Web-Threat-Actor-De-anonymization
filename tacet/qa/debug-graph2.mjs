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
await page.waitForURL('http://127.0.0.1:4000/', { timeout: 10000 });
await page.goto('http://127.0.0.1:4000/graph', { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);
const info = await page.evaluate(() => ({
  svg: !!document.querySelector('.graph-canvas svg'),
  circles: document.querySelectorAll('.graph-canvas svg circle').length,
  lines: document.querySelectorAll('.graph-canvas svg line').length,
  text: document.body.innerText.slice(0, 160),
  dataText: document.body.innerText.includes('Knowledge graph'),
}));
console.log(JSON.stringify(info, null, 1));
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await b.close();
