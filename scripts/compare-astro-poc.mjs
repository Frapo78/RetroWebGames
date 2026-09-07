import fs from 'node:fs';
import { chromium } from '/apps/preview-tools/lib/node/node_modules/playwright/index.mjs';

const browser = await chromium.launch({ headless: true });
const contexts = [
  { route: '/', selectors: ['.shell', '.hero', '.game-list', '.game-card', '.share-dock'] },
  { route: '/games/block-drop/', selectors: ['#app', '#hud', '#stage', '#overlay .panel', '#startBtn'] }
];
const viewports = [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1366, height: 768 }];
const failures = [];
fs.mkdirSync('.work/astro-poc/screenshots', { recursive: true });

async function inspect(base, spec, viewport, label) {
  const page = await browser.newPage({ viewport });
  await page.goto(`${base}${spec.route}`, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}.pwa-install-notice{display:none!important}' });
  const boxes = {};
  for (const selector of spec.selectors) {
    const box = await page.locator(selector).first().boundingBox();
    boxes[selector] = box && Object.fromEntries(Object.entries(box).map(([key, value]) => [key, Math.round(value * 10) / 10]));
  }
  const slug = spec.route === '/' ? 'home' : 'block-drop';
  await page.screenshot({ path: `.work/astro-poc/screenshots/${slug}-${viewport.width}x${viewport.height}-${label}.png`, fullPage: false });
  await page.close();
  return boxes;
}

for (const viewport of viewports) {
  for (const spec of contexts) {
    const before = await inspect('http://127.0.0.1:4329', spec, viewport, 'source');
    const after = await inspect('http://127.0.0.1:4328', spec, viewport, 'astro');
    for (const selector of spec.selectors) {
      if (!before[selector] || !after[selector]) failures.push(`${spec.route} ${viewport.width}: missing ${selector}`);
      else for (const key of ['x', 'y', 'width', 'height']) if (Math.abs(before[selector][key] - after[selector][key]) > 0.6) failures.push(`${spec.route} ${viewport.width} ${selector}.${key}: ${before[selector][key]} != ${after[selector][key]}`);
    }
  }
}
await browser.close();
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Astro visual geometry comparison OK (6 source/pilot pairs; screenshots retained under .work)');
