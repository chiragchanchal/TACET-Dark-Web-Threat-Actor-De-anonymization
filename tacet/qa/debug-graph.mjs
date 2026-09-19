import { chromium } from 'playwright-core';

const b = await chromium.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
const page = await b.newPage();
await page.goto('http://127.0.0.1:4000/login', { waitUntil: 'networkidle' });
await page.fill('input[autocomplete="username"]', 'analyst');
await page.fill('input[autocomplete="current-password"]', 'tac3t-demo');
await page.click('button[type="submit"]');
await page.waitForURL('http://127.0.0.1:4000/');
const out = await page.evaluate(async () => {
  const token = localStorage.getItem('tacet_token');
  const res = await fetch('/api/graph?minScore=0.05&limit=140', { headers: { Authorization: 'Bearer ' + token } });
  const j = await res.json();
  const kinds = {};
  for (const n of j.nodes) kinds[n.kind] = (kinds[n.kind] || 0) + 1;
  const dangling = j.edges.filter((e) => !j.nodes.some((n) => n.id === e.source) || !j.nodes.some((n) => n.id === e.target)).length;
  return { status: res.status, nodes: j.nodes.length, edges: j.edges.length, totalEdges: j.totalEdges, dangling, kinds, edgeSample: j.edges.slice(0, 3) };
});
console.log(JSON.stringify(out, null, 1));

// now load the actual graph page and inspect its DOM/react state
await page.goto('http://127.0.0.1:4000/graph', { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
const dom = await page.evaluate(() => {
  const svg = document.querySelector('.graph-stage svg');
  return {
    svg: !!svg,
    lines: svg?.querySelectorAll('line').length || 0,
    circles: svg?.querySelectorAll('circle').length || 0,
    texts: svg?.querySelectorAll('text').length || 0,
    svgHtml: svg?.innerHTML.slice(0, 300) || 'NO SVG',
  };
});
console.log(JSON.stringify(dom, null, 1));
await b.close();
