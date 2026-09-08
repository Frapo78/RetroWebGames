import { chromium } from '/apps/preview-tools/lib/node/node_modules/playwright/index.mjs';

const base = process.env.RWG_I18N_BASE || 'http://127.0.0.1:4330';
const routes = ['/', '/avatar/', '/games/block-drop/', '/games/bubble-burst/', '/games/maze-munch/', '/games/neon-rally/', '/games/neon-snake/', '/games/neon-tilt/', '/games/prism-breaker/', '/games/solitaire/', '/games/star-swarm/', '/games/the-great-empire/'];
const viewports = [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1366, height: 768 }];
const browser = await chromium.launch({ headless: true });
const failures = [];
const bootstrapSamples = [];

for (const viewport of viewports) {
  for (const route of routes) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
    page.on('response', response => {
      if (response.status() >= 400 && !response.url().includes('/api/')) errors.push(`HTTP ${response.status()} ${response.url()}`);
    });
    await page.goto(base + route, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(150);
    const state = await page.evaluate(currentRoute => ({
      lang: document.documentElement.lang,
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      locale: window.RWGI18n?.locale,
      bootstrapMs: window.RWGI18n?.bootstrapMs,
      key: window.RWGI18n?.t('session.question'),
      missingBindings: [...document.querySelectorAll('[data-rwg-i18n]')].filter(node => !node.textContent.trim()).length,
      localeScript: [...document.scripts].findIndex(script => script.src.includes('/rwg-i18n.js')),
      hudScript: [...document.scripts].findIndex(script => script.src.includes('/game-hud.js')),
      titleVisible: Boolean(document.querySelector('h1, .rwg-intro-cover-title')),
      startVisible: currentRoute.startsWith('/games/') ? Boolean(document.querySelector('#startBtn, [data-rwg-start]')) : true
    }), route);
    if (state.lang !== 'it' || state.locale !== 'it') errors.push(`locale mismatch ${state.lang}/${state.locale}`);
    if (state.key !== 'Vuoi continuare la partita precedente?') errors.push('catalog lookup mismatch');
    if (!Number.isFinite(state.bootstrapMs) || state.bootstrapMs > 15) errors.push(`bootstrap ${state.bootstrapMs}ms exceeds 15ms`);
    else bootstrapSamples.push(state.bootstrapMs);
    if (state.scrollWidth > state.width + 1) errors.push(`horizontal overflow ${state.scrollWidth}/${state.width}`);
    if (state.missingBindings) errors.push(`${state.missingBindings} empty localized bindings`);
    if (state.localeScript < 0 || (state.hudScript >= 0 && state.localeScript > state.hudScript)) errors.push('locale script order invalid');
    if (!state.titleVisible) errors.push('semantic title missing');
    if (!state.startVisible) errors.push('game start action missing');
    if (errors.length) failures.push(`${viewport.width}x${viewport.height} ${route}: ${errors.join('; ')}`);
    await page.close();
  }
}
await browser.close();
if (failures.length) {
  console.error(`Shared Italian I18N smoke FAILED (${failures.length})`);
  failures.forEach(failure => console.error('  ✗ ' + failure));
  process.exit(1);
}
bootstrapSamples.sort((a,b) => a-b);
const p95 = bootstrapSamples[Math.ceil(bootstrapSamples.length * .95) - 1] || 0;
console.log(`Shared Italian I18N smoke OK (${routes.length * viewports.length} page/viewport combinations; bootstrap p95 ${p95.toFixed(2)}ms)`);
