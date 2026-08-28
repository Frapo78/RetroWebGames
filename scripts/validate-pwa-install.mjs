#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const failures = [];
const must = (condition, message) => { if (!condition) failures.push(message); };

const home = read('index.html');
const script = read('pwa-install.js');
const css = read('pwa-install.css');
const worker = read('sw.js');
const manifest = JSON.parse(read('manifest.webmanifest'));
const brandCss = read('brand.css');
const brandGenerator = read('scripts/generate-brand-wordmark.py');
const wordmarkPng = fs.readFileSync(path.join(root, 'assets/brand/retrowebgames-wordmark.png'));

must(home.includes('href="pwa-install.css"'), 'home must load pwa-install.css');
must(home.includes('src="/pwa-install.js"'), 'home must load pwa-install.js');
must(home.includes('id="pwaInstallNotice"') && home.includes('id="pwaInstallCard"'), 'home must expose the first-visit notice and persistent install card');
must((home.match(/data-pwa-install/g) || []).length >= 2, 'both PWA install CTAs must use the shared controller');
must(home.indexOf('id="pwaInstallCard"') > home.indexOf('</section>'), 'PWA install card must follow the game list');
must(script.includes("setTimeout(() =>") && script.includes('}, 2000)'), 'first-visit notice must wait 2 seconds');
must(script.includes("setTimeout(dismissNotice, 10000)"), "first-visit notice must auto-dismiss non-invasively");
for (const marker of ['beforeinstallprompt', 'event.preventDefault()', 'promptEvent.prompt()', 'promptEvent.userChoice', 'appinstalled', 'display-mode: standalone', 'navigator.standalone', 'serviceWorker.register']) {
  must(script.includes(marker), 'PWA controller missing: ' + marker);
}
must(script.includes('rwg.pwa.install.notice.v1') && script.includes('localStorage.setItem'), 'notice-once persistence contract is missing');
must(script.includes('Aggiungi alla schermata Home'), 'iOS/browser installation fallback guidance is missing');
must(script.includes('/macintosh/i.test(ua)') && script.includes('navigator.maxTouchPoints > 1'), 'modern iPadOS desktop-user-agent detection is missing');
must(script.includes('configureIosInstallUi()') && script.includes('button.hidden = true') && script.includes('setGuidance(IOS_GUIDANCE)'), 'iOS/iPadOS must show instructions directly and hide install buttons');
must(css.includes('.pwa-install-action[hidden]'), 'hidden iOS install actions need an explicit CSS guard');
must(css.includes('position: fixed') && css.includes('translate(-50%, calc(-100% - 30px))'), 'notice must slide in from the top');
must(css.includes('@media (max-width: 380px)') && css.includes('width: calc(100% - 16px)'), 'small-mobile overflow guard is missing');
for (const marker of ["addEventListener('install'", "addEventListener('activate'", "addEventListener('fetch'", 'caches.open', "request.mode === 'navigate'"]) {
  must(worker.includes(marker), 'service worker missing: ' + marker);
}
must(manifest.display === 'standalone', 'manifest must remain installable in standalone mode');
must(brandCss.includes('object-fit: contain') && brandCss.includes('object-position: center') && brandCss.includes('overflow: visible'), 'wordmark CSS must never crop the transparent asset');
must(home.includes('width="1600" height="250"'), 'home wordmark intrinsic dimensions must remain stable');
must(wordmarkPng.readUInt32BE(16) === 1600 && wordmarkPng.readUInt32BE(20) === 250, 'wordmark PNG must retain its 1600x250 safety canvas');
must(brandGenerator.includes('720x150+405+245') && brandGenerator.includes('1450x220!') && brandGenerator.includes('1600x250'), 'wordmark generator must retain the complete crop and transparent safety margins');

if (failures.length) {
  console.error('PWA install validation FAILED');
  failures.forEach(failure => console.error('  ✗ ' + failure));
  process.exit(1);
}
console.log('PWA install validation OK');
console.log('  ✓ native install prompt, iOS fallback, notice-once and end-of-list CTA are covered');
