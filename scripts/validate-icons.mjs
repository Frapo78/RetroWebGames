#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const failures = [];
const must = (condition, message) => { if (!condition) failures.push(message); };
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

function pngSize(rel) {
  const b = fs.readFileSync(path.join(root, rel));
  if (b.length < 24 || b.toString('ascii', 1, 4) !== 'PNG') return null;
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

const required = [
  ['icons/favicon-16.png',16,16],
  ['icons/favicon-32.png',32,32],
  ['icons/favicon-48.png',48,48],
  ['apple-touch-icon.png',180,180],
  ['icons/icon-192.png',192,192],
  ['icons/icon-512.png',512,512],
  ['icons/icon-maskable-192.png',192,192],
  ['icons/icon-maskable-512.png',512,512],
  ['icons/mstile-150x150.png',150,150]
];

must(fs.existsSync(path.join(root, 'favicon.ico')), 'favicon.ico missing');
must(fs.existsSync(path.join(root, 'favicon.svg')), 'favicon.svg missing');
for (const [rel,w,h] of required) {
  must(fs.existsSync(path.join(root, rel)), `${rel} missing`);
  if (!fs.existsSync(path.join(root, rel))) continue;
  const size = pngSize(rel);
  must(Boolean(size) && size[0] === w && size[1] === h, `${rel} must be ${w}x${h} PNG`);
}

const manifest = JSON.parse(read('manifest.webmanifest'));
for (const expected of [
  ['/icons/icon-192.png','192x192','any'],
  ['/icons/icon-512.png','512x512','any'],
  ['/icons/icon-maskable-192.png','192x192','maskable'],
  ['/icons/icon-maskable-512.png','512x512','maskable']
]) {
  const [src,sizes,purpose] = expected;
  must(manifest.icons?.some(i => i.src === src && i.sizes === sizes && i.purpose === purpose), `manifest missing ${src} ${sizes} ${purpose}`);
}

const pages = ['index.html','avatar/index.html'];
for (const entry of fs.readdirSync(path.join(root,'games'), {withFileTypes:true})) {
  if (entry.isDirectory() && fs.existsSync(path.join(root,'games',entry.name,'index.html'))) pages.push(`games/${entry.name}/index.html`);
}
for (const rel of pages) {
  const html = read(rel);
  must(html.includes('rel="icon"') && html.includes('/favicon.svg'), `${rel}: SVG favicon missing`);
  must(html.includes('/icons/favicon-32.png'), `${rel}: 32px PNG favicon missing`);
  must(html.includes('/favicon.ico'), `${rel}: .ico fallback missing`);
  must(html.includes('/apple-touch-icon.png'), `${rel}: Apple Touch icon missing`);
}

if (failures.length) {
  console.error(`\nRWG icon validation FAILED (${failures.length})\n`);
  failures.forEach(f => console.error(`  ✗ ${f}`));
  console.error('');
  process.exit(1);
}
console.log('RWG icon validation OK');
console.log('  ✓ favicon SVG/ICO + 16/32/48 PNG variants');
console.log('  ✓ Apple Touch 180 + Microsoft tile 150');
console.log('  ✓ PWA 192/512 any + maskable 192/512');
console.log(`  ✓ ${pages.length} public pages expose the shared icon family`);
