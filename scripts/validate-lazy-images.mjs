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
const gameCoverImages = images.filter(tag => /\sclass=["'][^"']*\bgame-cover-img\b/.test(tag));
const jpegSize = buffer => {
  if (buffer.readUInt16BE(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset++; continue; }
    const marker = buffer[offset + 1];
    if ([0xc0, 0xc1, 0xc2].includes(marker)) return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) break;
    offset += 2 + length;
  }
  return null;
};

must(home.includes('src="/rwg-lazy-images.js"'), 'home must load the shared lazy-image controller');
must(images.length > 0, 'home image inventory unexpectedly empty');
images.forEach((tag, index) => {
  must(/\sdata-rwg-src=["'][^"']+["']/.test(tag), 'home image ' + (index + 1) + ' must use data-rwg-src');
  must(!/(?:^|\s)src=["']/.test(tag), 'home image ' + (index + 1) + ' must not expose an eager src');
  must(/\sloading=["']lazy["']/.test(tag), 'home image ' + (index + 1) + ' must retain native loading=lazy');
  must(/\sdecoding=["']async["']/.test(tag), 'home image ' + (index + 1) + ' must decode asynchronously');
  must(/\swidth=["']\d+["']/.test(tag) && /\sheight=["']\d+["']/.test(tag), 'home image ' + (index + 1) + ' must reserve intrinsic layout space');
});
must(gameCoverImages.length === 9, 'home must expose exactly nine raster game covers');
for (const tag of gameCoverImages) {
  const compact = tag.match(/data-rwg-src=["']([^"']+-portrait-540\.jpg)["']/)?.[1];
  const full = tag.match(/data-rwg-srcset=["'][^"']*,\s*([^\s"']+-portrait\.jpg)\s+1080w["']/)?.[1];
  must(Boolean(compact && full), 'every game cover must expose 540w and 1080w portrait sources');
  for (const [source, width, height] of [[compact, 540, 960], [full, 1080, 1920]]) {
    if (!source) continue;
    const file = path.join(root, source.replace(/^\//, ''));
    must(fs.existsSync(file), 'missing game cover asset: ' + source);
    if (fs.existsSync(file)) {
      const size = jpegSize(fs.readFileSync(file));
      must(size?.width === width && size?.height === height, source + ' must be exactly ' + width + 'x' + height);
    }
  }
}
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
console.log('  ✓ nine game cards use responsive 9:16 JPEG covers at 540x960 and 1080x1920');
