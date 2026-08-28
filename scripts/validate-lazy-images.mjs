#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const failures = [];
const must = (condition, message) => { if (!condition) failures.push(message); };

const home = read('index.html');
const loader = read('rwg-lazy-images.js');
const worker = read('sw.js');
const images = home.match(/<img\b[^>]*>/gi) || [];

must(home.includes('src="/rwg-lazy-images.js"'), 'home must load the shared lazy-image controller');
must(images.length > 0, 'home image inventory unexpectedly empty');
images.forEach((tag, index) => {
  must(/\sdata-rwg-src=["'][^"']+["']/.test(tag), 'home image ' + (index + 1) + ' must use data-rwg-src');
  must(!/(?:^|\s)src=["']/.test(tag), 'home image ' + (index + 1) + ' must not expose an eager src');
  must(/\sloading=["']lazy["']/.test(tag), 'home image ' + (index + 1) + ' must retain native loading=lazy');
  must(/\sdecoding=["']async["']/.test(tag), 'home image ' + (index + 1) + ' must decode asynchronously');
  must(/\swidth=["']\d+["']/.test(tag) && /\sheight=["']\d+["']/.test(tag), 'home image ' + (index + 1) + ' must reserve intrinsic layout space');
});
for (const marker of ['IntersectionObserver', "rootMargin: '280px 0px'", 'MutationObserver', 'window.RWGLazyImages', 'Object.freeze', 'image.dataset.rwgSrc', 'image.src = image.dataset.rwgSrc']) {
  must(loader.includes(marker), 'shared lazy-image controller missing: ' + marker);
}
must(loader.includes("'IntersectionObserver' in window") && loader.includes('else loadImage(image)'), 'legacy fallback must load images without IntersectionObserver');
must(worker.includes("'/rwg-lazy-images.js'"), 'service-worker shell must include the shared lazy-image controller');

if (failures.length) {
  console.error('RWG lazy-image validation FAILED');
  failures.forEach(failure => console.error('  ✗ ' + failure));
  process.exit(1);
}

console.log('RWG lazy-image validation OK');
console.log('  ✓ ' + images.length + ' home images use shared viewport loading with reusable dynamic-content support');
