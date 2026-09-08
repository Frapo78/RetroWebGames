#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { GAMES, SITE } from './seo-catalog.mjs';

const root = process.cwd();
const failures = [];
const localizedPages=locale=>{
  const prefix=locale==='it'?'':`${locale}/`,urlPrefix=locale==='it'?'':`${locale}/`;
  return [{rel:`${prefix}index.html`,url:`${SITE.origin}/${urlPrefix}`,kind:'home',locale},...GAMES.map(game=>({rel:`${prefix}games/${game.slug}/index.html`,url:`${SITE.origin}/${urlPrefix}games/${game.slug}/`,kind:'game',game,locale})),{rel:`${prefix}avatar/index.html`,url:`${SITE.origin}/${urlPrefix}avatar/`,kind:'utility',locale}];
};
const pages=[...localizedPages('it'),...localizedPages('en'),...localizedPages('es')];
const titles = new Map();
const descriptions = new Map();

function fail(message) { failures.push(message); }
function must(condition, message) { if (!condition) fail(message); }
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function match(html, pattern) { return html.match(pattern)?.[1]?.trim() || ''; }
function nodeOf(graph, type) { return graph.find(node => node['@type'] === type); }

for (const page of pages) {
  const html = read(page.rel);
  const title = match(html, /<title>([^<]+)<\/title>/i);
  const description = match(html, /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  const canonical = match(html, /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  const robots = match(html, /<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i);
  const scripts = [...html.matchAll(/<script\s+id=["']rwg-seo-graph["']\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi)];

  must(title.length >= 25 && title.length <= 65, page.rel + ': title must be useful and 25–65 characters');
  must(description.length >= 100 && description.length <= 170, page.rel + ': description must be useful and 100–170 characters');
  must(canonical === page.url, page.rel + ': canonical URL mismatch');
  const expectedOgLocale={it:'it_IT',en:'en_US',es:'es_ES'}[page.locale];
  must(new RegExp(`<meta\\s+property=["']og:locale["']\\s+content=["']${expectedOgLocale}["']`,'i').test(html), page.rel + ': og:locale mismatch');
  must(html.includes('hreflang="it"')&&html.includes('hreflang="en"')&&html.includes('hreflang="es"')&&html.includes('hreflang="x-default"'),page.rel+': reciprocal hreflang set missing');
  must(!/<meta\s+name=["']keywords["']/i.test(html), page.rel + ': obsolete meta keywords must not be added');
  must(scripts.length === 1, page.rel + ': exactly one rwg-seo-graph JSON-LD block required');
  if (page.kind === 'utility') must(/^noindex,follow/.test(robots), page.rel + ': thin utility must remain noindex,follow');
  else must(robots.includes('index,follow') && robots.includes('max-image-preview:large') && robots.includes('max-snippet:-1'), page.rel + ': complete index/preview robots directives missing');

  if (titles.has(title)) fail(page.rel + ': duplicate title with ' + titles.get(title)); else titles.set(title, page.rel);
  if (descriptions.has(description)) fail(page.rel + ': duplicate description with ' + descriptions.get(description)); else descriptions.set(description, page.rel);

  if (scripts.length === 1) {
    let parsed;
    try { parsed = JSON.parse(scripts[0][1]); } catch (error) { fail(page.rel + ': invalid JSON-LD: ' + error.message); }
    const graph = parsed?.['@graph'];
    must(parsed?.['@context'] === 'https://schema.org' && Array.isArray(graph), page.rel + ': Schema.org @graph required');
    if (Array.isArray(graph)) {
      const website = nodeOf(graph, 'WebSite');
      const webPage = nodeOf(graph, 'WebPage');
      must(website?.name === SITE.name && website?.alternateName === SITE.alternateName, page.rel + ': WebSite identity missing');
      must(webPage?.url === page.url && webPage?.inLanguage === (page.locale==='it'?SITE.language:page.locale), page.rel + ': WebPage URL/language mismatch');
      if (page.kind === 'home') {
        const list = nodeOf(graph, 'ItemList');
        must(list?.numberOfItems === GAMES.length && list?.itemListElement?.length === GAMES.length, page.rel + ': home ItemList must contain every current game');
        const titleIntent=page.locale==='it'?(/videogame gratis/i.test(title)&&/retrogame/i.test(title)):page.locale==='en'?(/free videogames/i.test(title)&&/retrogame/i.test(title)):(/videojuegos gratis/i.test(title)&&/retrogame/i.test(title));
        const discoveryIntent=page.locale==='it'?html.includes('Snake gratis online')&&html.includes('Solitario Klondike (Solitaire)'):page.locale==='en'?html.includes('free online Snake')&&html.includes('Klondike Solitaire'):html.includes('Snake gratis online')&&html.includes('Solitario Klondike');
        must(titleIntent, page.rel + ': primary discovery intent missing from home title');
        must(html.includes('class="seo-discovery"') && discoveryIntent, page.rel + ': useful visible discovery content missing');
      }
      if (page.kind === 'game') {
        const game = nodeOf(graph, 'VideoGame');
        const breadcrumbs = nodeOf(graph, 'BreadcrumbList');
        const expectedName=page.locale==='en'&&page.game.slug==='solitaire'?'Solitaire':page.game.name;
        must(game?.name === expectedName && game?.url === page.url, page.rel + ': VideoGame identity mismatch');
        must(game?.isAccessibleForFree === true && game?.playMode === 'SinglePlayer', page.rel + ': VideoGame access/play mode facts missing');
        must(Array.isArray(game?.gamePlatform) && game.gamePlatform.includes('Web browser'), page.rel + ': web game platform missing');
        must(breadcrumbs?.itemListElement?.length === 2, page.rel + ': BreadcrumbList missing');
      }
    }
  }
}

must(!fs.existsSync(path.join(root, 'llms.txt')), 'Do not add an unnecessary llms.txt as a GEO shortcut');
must(GAMES.length === 10, 'SEO catalog must track all ten current games');

const sitemap = read('sitemap.xml');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
const sitemapDates = [...sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map(match => match[1]);
const expectedUrls = pages.filter(page => page.kind !== 'utility').map(page => page.url).sort();
must(/<urlset\s+[^>]*xmlns=["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["'][^>]*>/.test(sitemap), 'sitemap.xml: standard urlset namespace missing');
must(JSON.stringify(sitemapUrls.slice().sort()) === JSON.stringify(expectedUrls), 'sitemap.xml: must contain exactly all indexable canonical routes');
must(sitemapDates.length === sitemapUrls.length && sitemapDates.every(date => /^\d{4}-\d{2}-\d{2}$/.test(date)), 'sitemap.xml: every URL needs a valid lastmod date');
must(!sitemap.includes('<priority>') && !sitemap.includes('<changefreq>'), 'sitemap.xml: omit ignored priority/changefreq noise');
must(!sitemap.includes('/avatar/'), 'sitemap.xml: noindex avatar utility must be excluded');

const robotsTxt = read('robots.txt');
must(robotsTxt.includes('User-agent: *\nAllow: /'), 'robots.txt: public crawl policy missing');
must(robotsTxt.includes('User-agent: OAI-SearchBot\nAllow: /'), 'robots.txt: ChatGPT Search crawler policy missing');
must(robotsTxt.includes('Sitemap: https://www.retrowebgames.it/sitemap.xml'), 'robots.txt: absolute sitemap declaration missing');

if (failures.length) {
  console.error('\nSEO/GEO validation FAILED (' + failures.length + ')\n');
  failures.forEach(message => console.error('  ✗ ' + message));
  console.error('');
  process.exit(1);
}

console.log('SEO/GEO validation OK');
console.log('  ✓ ' + pages.length + ' public routes have unique metadata and canonical URLs');
console.log('  ✓ home and all games expose truthful Schema.org graphs');
console.log('  ✓ utility indexing policy and rich-preview directives are enforced');
