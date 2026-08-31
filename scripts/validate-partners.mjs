#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const failures = [];
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const must = (condition, message) => { if (!condition) failures.push(message); };
const home = read('index.html');
const css = read('hub-partners.css');
const worker = read('sw.js');

must(home.includes('aria-labelledby="partnerSitesTitle"'), 'Home partner section must keep an accessible heading');
must(home.includes('>Siti Partner</h2>'), 'Home partner section title missing');
must(home.includes('data-partner-site="afelio"'), 'Afelio partner card missing');
must(/href="https:\/\/afelio\.space\/"[^>]*target="_blank"[^>]*rel="external noopener noreferrer"/.test(home), 'Afelio must open safely as an external partner');
const image = home.match(/<img[^>]+afelio-portrait-540\.webp[^>]*>/)?.[0] || '';
must(Boolean(image), 'Afelio planet image missing from partner card');
must(image.includes('data-rwg-src="/assets/partners/afelio-portrait-540.webp"'), 'Afelio image must use the shared lazy loader');
must(image.includes('/assets/partners/afelio-portrait.webp 1080w'), 'Afelio image must expose its full 9:16 master through responsive markup');
must(!/(?:^|\s)src=/.test(image), 'Afelio image must not load eagerly');
must(image.includes('width="540"') && image.includes('height="960"'), 'Afelio image must reserve its 9:16 intrinsic dimensions');
must(fs.existsSync(path.join(root, 'assets/partners/afelio-portrait-540.webp')), 'Afelio compact portrait asset missing');
must(fs.existsSync(path.join(root, 'assets/partners/afelio-portrait.webp')), 'Afelio full portrait asset missing');
must(css.includes('.partner-sites-list') && css.includes('.partner-site-card'), 'Reusable partner card styles missing');
must(css.includes('object-fit: contain') && css.includes('object-position: 50% 50%'), 'Partner portrait must remain centered and never crop its wordmark');
must(worker.includes("'/hub-partners.css'"), 'Partner styles must remain available in the PWA shell');

if (failures.length) {
  console.error('RWG partner validation FAILED');
  failures.forEach(failure => console.error(`  ✗ ${failure}`));
  process.exit(1);
}
console.log('RWG partner validation OK');
console.log('  ✓ Afelio uses a centered responsive 9:16 planet cover and shared lazy loading');
console.log('  ✓ external navigation is explicit, safe and reusable for future partners');
