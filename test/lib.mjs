// Shared helpers: serve the app and open it in headless Chrome as a touch phone.
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
export function serve() {
  return new Promise(res => {
    const s = http.createServer((q, r) => {
      const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0] === '/' ? '/index.html' : q.url.split('?')[0]));
      if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
    }).listen(0, () => res({ url: `http://localhost:${s.address().port}/`, close: () => s.close() }));
  });
}
export async function open(url, viewport = { width: 390, height: 844 }) {
  const opts = { headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] };
  if (fs.existsSync('/usr/bin/google-chrome')) opts.executablePath = '/usr/bin/google-chrome';
  const browser = await chromium.launch(opts);
  const ctx = await browser.newContext({ viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url); await page.waitForFunction(() => window.__app);
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(p => ({ x: p.x, y: p.y, id: 1 })) });
  const T = {
    page, browser, errors,
    ev: fn => page.evaluate(fn),
    wait: ms => page.waitForTimeout(ms),
    until: (fn, timeout = 20000) => page.waitForFunction(fn, null, { timeout }),
    tap: async p => { await touch('touchStart', [p]); await page.waitForTimeout(40); await touch('touchEnd', []); await page.waitForTimeout(60); },
    drag: async (a, b, steps = 14, hold = 30) => {
      await touch('touchStart', [a]);
      for (let i = 1; i <= steps; i++) { await touch('touchMove', [{ x: a.x + (b.x - a.x) * i / steps, y: a.y + (b.y - a.y) * i / steps }]); await page.waitForTimeout(hold); }
      await touch('touchEnd', []); await page.waitForTimeout(60);
    },
    tapSel: async sel => { const b = await page.locator(sel).boundingBox(); await T.tap({ x: b.x + b.width / 2, y: b.y + b.height / 2 }); },
    shot: name => page.screenshot({ path: path.join(ROOT, 'test', 'shots', name + '.png') }),
  };
  fs.mkdirSync(path.join(ROOT, 'test', 'shots'), { recursive: true });
  return T;
}
