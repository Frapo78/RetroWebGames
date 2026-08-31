#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { GAMES, SITE, getGameSocial } from './seo-catalog.mjs';

const root = process.cwd();
const robots = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';

function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function write(rel, value) { fs.writeFileSync(path.join(root, rel), value); }
function escapeHtml(value) { return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }
function replaceTitle(html, value) { return html.replace(/<title>[^<]*<\/title>/i, '<title>' + escapeHtml(value) + '</title>'); }
function replaceMeta(html, attribute, key, value) {
  const pattern = new RegExp('(<meta\\s+' + attribute + '=["\\\']' + key + '["\\\']\\s+content=["\\\'])[^"\\\']*(["\\\'][^>]*>)', 'i');
  if (!pattern.test(html)) throw new Error('Missing meta ' + attribute + '=' + key);
  return html.replace(pattern, '$1' + escapeHtml(value) + '$2');
}
function upsertHead(html, id, markup) {
  const pattern = new RegExp('\\n?\\s*<script id=["\\\']' + id + '["\\\'][\\s\\S]*?<\\/script>', 'i');
  html = html.replace(pattern, '');
  return html.replace('</head>', '  ' + markup + '\n</head>');
}
function ensureMeta(html, markup, matcher) {
  if (matcher.test(html)) return html;
  return html.replace('<meta name="description"', markup + '\n  <meta name="description"');
}
function graphMarkup(graph) {
  return '<script id="rwg-seo-graph" type="application/ld+json">\n' + JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2) + '\n  </script>';
}
function websiteNode() {
  return { '@type': 'WebSite', '@id': SITE.origin + '/#website', url: SITE.origin + '/', name: SITE.name, alternateName: SITE.alternateName, inLanguage: SITE.language };
}
function organizationNode() {
  return { '@type': 'Organization', '@id': SITE.origin + '/#organization', name: SITE.name, alternateName: SITE.alternateName, url: SITE.origin + '/', logo: SITE.origin + '/icons/icon-512.png' };
}
function commonMeta(html, title, description, pageRobots = robots) {
  html = replaceTitle(html, title);
  html = replaceMeta(html, 'name', 'description', description);
  html = replaceMeta(html, 'property', 'og:title', title);
  html = replaceMeta(html, 'property', 'og:description', description);
  html = replaceMeta(html, 'name', 'twitter:title', title);
  html = replaceMeta(html, 'name', 'twitter:description', description);
  html = ensureMeta(html, '  <meta name="robots" content="' + pageRobots + '" />', /<meta\s+name=["']robots["']/i);
  html = ensureMeta(html, '  <meta property="og:locale" content="it_IT" />', /<meta\s+property=["']og:locale["']/i);
  return html;
}
function gameSocialMeta(html, social) {
  for (const key of ['og:image', 'og:image:secure_url']) html = replaceMeta(html, 'property', key, social.image);
  html = replaceMeta(html, 'property', 'og:image:width', '1200');
  html = replaceMeta(html, 'property', 'og:image:height', '630');
  html = replaceMeta(html, 'property', 'og:image:alt', social.alt);
  html = replaceMeta(html, 'name', 'twitter:image', social.image);
  html = replaceMeta(html, 'name', 'twitter:image:width', '1200');
  html = replaceMeta(html, 'name', 'twitter:image:height', '630');
  html = replaceMeta(html, 'name', 'twitter:image:alt', social.alt);
  return html;
}

const homeTitle = 'Videogame gratis e retrogame online | RetroWebGames';
const homeDescription = 'Gioca gratis online a videogame e retrogame originali: arcade, Snake, Solitario, puzzle, shooter e web game ottimizzati per smartphone.';
let home = commonMeta(read('index.html'), homeTitle, homeDescription);
home = home.replace('aria-label="RetroWebGames"', 'aria-label="RetroWebGames: videogame gratis e retrogame online"');
home = home.replace(/<p class="intro">[\s\S]*?<\/p>/, '<p class="intro">Videogame gratis e retrogame originali da giocare subito nel browser. Scegli un web game e parti: controlli touch, sessioni veloci e record salvati sul dispositivo.</p>');
const discovery = [
  '    <section class="seo-discovery" aria-labelledby="seoDiscoveryTitle">',
  '      <p class="seo-kicker">ARCADE NEL BROWSER</p>',
  '      <h2 id="seoDiscoveryTitle">Videogame gratis e retrogame online</h2>',
  '      <p>RetroWebGames raccoglie videogame originali ispirati ai generi arcade classici, pronti da giocare senza download. Trovi shooter, puzzle, <a href="/games/neon-snake/">Snake gratis online</a>, <a href="/games/solitaire/">Solitario Klondike (Solitaire)</a>, maze game e brick breaker.</p>',
  '      <details><summary>I giochi sono davvero gratis?</summary><p>Sì. Tutti i web game disponibili si avviano gratuitamente dal browser, senza account o pagamenti.</p></details>',
  '      <details><summary>Sono copie dei videogame classici?</summary><p>No. Codice, nomi e grafica sono originali; ogni gioco è un tributo al proprio genere arcade o retrogame.</p></details>',
  '      <details><summary>Devo installare qualcosa?</summary><p>No. Puoi giocare subito sul web; l’installazione della scorciatoia è facoltativa e rende più rapido l’accesso dalla Home.</p></details>',
  '    </section>'
].join('\n');
if (!home.includes('class="seo-discovery"')) home = home.replace('    <section id="pwaInstallCard"', discovery + '\n\n    <section id="pwaInstallCard"');
const homeItems = GAMES.map((game, index) => ({ '@type': 'ListItem', position: index + 1, item: { '@type': 'VideoGame', name: game.name, url: SITE.origin + '/games/' + game.slug + '/', genre: game.genres, gamePlatform: ['Web browser', 'Mobile web'], playMode: 'SinglePlayer', isAccessibleForFree: true } }));
home = upsertHead(home, 'rwg-seo-graph', graphMarkup([
  organizationNode(), websiteNode(),
  { '@type': 'WebPage', '@id': SITE.origin + '/#webpage', url: SITE.origin + '/', name: homeTitle, description: homeDescription, isPartOf: { '@id': SITE.origin + '/#website' }, about: { '@id': SITE.origin + '/#games' }, inLanguage: SITE.language, primaryImageOfPage: { '@type': 'ImageObject', url: SITE.image, width: 1280, height: 672 } },
  { '@type': 'ItemList', '@id': SITE.origin + '/#games', name: 'Videogame gratis e retrogame online', numberOfItems: GAMES.length, itemListElement: homeItems }
]));
write('index.html', home);

for (const game of GAMES) {
  const rel = 'games/' + game.slug + '/index.html';
  const url = SITE.origin + '/games/' + game.slug + '/';
  const social = getGameSocial(game);
  let html = gameSocialMeta(commonMeta(read(rel), game.title, game.description), social);
  const videoGame = { '@type': 'VideoGame', '@id': url + '#game', name: game.name, url, description: game.description, image: social.image, genre: game.genres, keywords: ['videogame gratis', 'web game', 'retrogame', ...game.genres], gamePlatform: ['Web browser', 'Mobile web'], playMode: 'SinglePlayer', applicationCategory: 'Game', operatingSystem: 'Qualsiasi sistema con browser moderno', inLanguage: SITE.language, isAccessibleForFree: true, publisher: { '@id': SITE.origin + '/#organization' } };
  if (game.alternateName) videoGame.alternateName = game.alternateName;
  html = upsertHead(html, 'rwg-seo-graph', graphMarkup([
    organizationNode(), websiteNode(),
    { '@type': 'WebPage', '@id': url + '#webpage', url, name: game.title, description: game.description, isPartOf: { '@id': SITE.origin + '/#website' }, mainEntity: { '@id': url + '#game' }, inLanguage: SITE.language, primaryImageOfPage: { '@type': 'ImageObject', url: social.image, width: 1200, height: 630 } },
    videoGame,
    { '@type': 'BreadcrumbList', '@id': url + '#breadcrumb', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'RetroWebGames', item: SITE.origin + '/' }, { '@type': 'ListItem', position: 2, name: game.name, item: url }] }
  ]));
  write(rel, html);
}

const avatarRel = 'avatar/index.html';
const avatarTitle = 'Crea il tuo avatar | RetroWebGames';
const avatarDescription = 'Personalizza l’avatar locale usato nei videogame di RetroWebGames e ritrovalo accanto ai crediti durante le partite.';
let avatar = commonMeta(read(avatarRel), avatarTitle, avatarDescription, 'noindex,follow,max-image-preview:large');
avatar = upsertHead(avatar, 'rwg-seo-graph', graphMarkup([organizationNode(), websiteNode(), { '@type': 'WebPage', '@id': SITE.origin + '/avatar/#webpage', url: SITE.origin + '/avatar/', name: avatarTitle, description: avatarDescription, isPartOf: { '@id': SITE.origin + '/#website' }, inLanguage: SITE.language }]));
write(avatarRel, avatar);

console.log('SEO/GEO metadata and structured data applied to home, avatar and ' + GAMES.length + ' games.');
