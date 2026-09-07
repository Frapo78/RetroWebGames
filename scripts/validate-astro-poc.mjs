import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, '.work/astro-poc/public');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const built = relative => fs.readFileSync(path.join(out, relative), 'utf8');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const pages = [
  { file: 'index.html', locale: 'it', canonical: 'https://www.retrowebgames.it/', peer: 'https://www.retrowebgames.it/en/' },
  { file: 'en/index.html', locale: 'en', canonical: 'https://www.retrowebgames.it/en/', peer: 'https://www.retrowebgames.it/' },
  { file: 'games/block-drop/index.html', locale: 'it', canonical: 'https://www.retrowebgames.it/games/block-drop/', peer: 'https://www.retrowebgames.it/en/games/block-drop/' },
  { file: 'en/games/block-drop/index.html', locale: 'en', canonical: 'https://www.retrowebgames.it/en/games/block-drop/', peer: 'https://www.retrowebgames.it/games/block-drop/' }
];

for (const page of pages) {
  const html = built(page.file);
  assert.match(html, new RegExp(`<html lang="${page.locale}"`), `${page.file}: wrong lang`);
  assert.ok(html.includes(`<link rel="canonical" href="${page.canonical}"`), `${page.file}: wrong canonical`);
  assert.ok(html.includes(`hreflang="${page.locale}" href="${page.canonical}"`), `${page.file}: missing self alternate`);
  assert.ok(html.includes(`href="${page.peer}"`), `${page.file}: missing reciprocal alternate`);
  assert.ok(html.includes('hreflang="x-default"'), `${page.file}: missing x-default`);
  assert.ok(!html.includes('/_astro/'), `${page.file}: runtime Astro asset injected`);
  assert.ok(html.includes(`"inLanguage": "${page.locale === 'it' ? 'it-IT' : 'en'}"`), `${page.file}: JSON-LD language mismatch`);
}

const itGame = built('games/block-drop/index.html');
const enGame = built('en/games/block-drop/index.html');
for (const html of [itGame, enGame]) {
  const order = ['/games/block-drop/game.js', '/game-hud.js', '/orientation.js'].map(item => html.indexOf(item));
  assert.ok(order.every(index => index >= 0) && order[0] < order[1] && order[1] < order[2], 'Block Drop bootstrap order changed');
}
assert.equal(sha(path.join(root, 'public/games/block-drop/game.js')), sha(path.join(out, 'games/block-drop/game.js')), 'game runtime bytes changed');
for (const asset of ['game-hud.js', 'rwg-session.js', 'rwg-leaderboard.js', 'games/block-drop/style.css']) {
  assert.equal(sha(path.join(root, 'public', asset)), sha(path.join(out, asset)), `${asset} bytes changed`);
}
assert.ok(enGame.includes('>PLAY</button>') && enGame.includes('>BACK TO MENU</a>'), 'English game static UI was not rendered');
assert.ok(built('en/index.html').includes('MOBILE ARCADE • ZERO INSTALLS'), 'English home static UI was not rendered');

const enHomeGameLinks = built("en/index.html").split("href=\"https://www.retrowebgames.it/en/games/").slice(1).map(value => value.split("\"")[0]);
assert.deepEqual(enHomeGameLinks, ['block-drop/'], 'English Home must not link to unpublished localized games');
const sitemap = built('sitemap-0.xml');
for (const page of pages) assert.ok(sitemap.includes(`<loc>${page.canonical}</loc>`), `sitemap missing ${page.canonical}`);
assert.equal((sitemap.match(/<url>/g) || []).length, 4, 'pilot sitemap must contain exactly four canonical URLs');
assert.equal((sitemap.match(/hreflang="x-default"/g) || []).length, 4, 'each sitemap URL needs x-default');

const sourceBytes = fs.statSync(path.join(root, 'public/index.html')).size + fs.statSync(path.join(root, 'public/games/block-drop/index.html')).size;
const itBytes = Buffer.byteLength(built('index.html')) + Buffer.byteLength(itGame);
const delta = ((itBytes - sourceBytes) / sourceBytes) * 100;
assert.ok(delta < 3, `Italian HTML byte delta too high: ${delta.toFixed(2)}%`);

assert.ok(read('astro.config.mjs').includes("output: 'static'") && read('astro.config.mjs').includes("prefixDefaultLocale: false"), 'Astro static/i18n contract missing');
console.log('Astro I18N-1 validation OK');
console.log(`  ✓ four IT/EN pages, reciprocal SEO metadata and sitemap (${delta.toFixed(2)}% Italian HTML delta)`);
console.log('  ✓ Block Drop runtime/shared bytes and bootstrap order unchanged; no Astro client runtime');
