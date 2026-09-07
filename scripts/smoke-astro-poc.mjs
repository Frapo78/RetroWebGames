import { chromium } from '/apps/preview-tools/lib/node/node_modules/playwright/index.mjs';

const base = process.env.RWG_ASTRO_BASE || 'http://127.0.0.1:4328';
const browser = await chromium.launch({ headless: true });
const viewports = [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1366, height: 768 }];
const routes = ['/', '/en/', '/games/block-drop/', '/en/games/block-drop/'];
const failures = [];
for (const viewport of viewports) {
  for (const route of routes) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
    page.on('response', response => { if (response.status() >= 400 && !response.url().includes('/api/')) errors.push(); });
    await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
    const metrics = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      canonical: document.querySelector('link[rel="canonical"]')?.href,
      scripts: [...document.scripts].map(script => script.src).filter(Boolean)
    }));
    if (metrics.scrollWidth > metrics.clientWidth + 1) errors.push(`horizontal overflow ${metrics.scrollWidth}/${metrics.clientWidth}`);
    if (route.includes('/games/block-drop/')) {
      const start = page.locator('#startBtn');
      if (!await start.isVisible()) errors.push('start button not visible');
      const scripts = metrics.scripts.join('\n');
      for (const required of ['/games/block-drop/game.js', '/game-hud.js', '/orientation.js']) if (!scripts.includes(required)) errors.push(`missing script ${required}`);
    }
    if (errors.length) failures.push(`${viewport.width}x${viewport.height} ${route}: ${errors.join('; ')}`);
    await page.close();
  }
}
await browser.close();
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Astro browser smoke OK (${viewports.length * routes.length} page/viewport combinations)`);
