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
const image = home.match(/<img[^>]+afelio-planet\.webp[^>]*>/)?.[0] || '';
must(Boolean(image), 'Afelio planet image missing from partner card');
must(image.includes('data-rwg-src="/assets/partners/afelio-planet.webp"'), 'Afelio image must use the shared lazy loader');
must(!/(?:^|\s)src=/.test(image), 'Afelio image must not load eagerly');
must(image.includes('width="512"') && image.includes('height="512"'), 'Afelio image must reserve its intrinsic dimensions');
must(fs.existsSync(path.join(root, 'assets/partners/afelio-planet.webp')), 'Afelio planet asset missing');
must(css.includes('.partner-sites-list') && css.includes('.partner-site-card'), 'Reusable partner card styles missing');
must(worker.includes("'/hub-partners.css'"), 'Partner styles must remain available in the PWA shell');

if (failures.length) {
  console.error('RWG partner validation FAILED');
  failures.forEach(failure => console.error(`  ✗ ${failure}`));
  process.exit(1);
}
console.log('RWG partner validation OK');
console.log('  ✓ Afelio uses the derived official planet artwork and shared lazy loading');
console.log('  ✓ external navigation is explicit, safe and reusable for future partners');
