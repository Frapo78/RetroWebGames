import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const source = path.join(root, 'public');
const target = path.join(root, '.work/astro-poc-static');
const excluded = new Set(['index.html', 'games/block-drop/index.html', 'sitemap.xml']);

if (!fs.existsSync(path.join(source, 'index.html'))) throw new Error('Run from the RWG repository root');
fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
fs.cpSync(source, target, {
  recursive: true,
  filter(entry) {
    const relative = path.relative(source, entry).split(path.sep).join('/');
    return !excluded.has(relative);
  }
});
console.log(`Astro pilot assets prepared in ${path.relative(root, target)}`);
