import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { DEFAULT_LOCALE, DEFAULT_LOCALE_PREFIXED, I18N_NAMESPACES, LOCALE_META, SUPPORTED_LOCALES, localeFromPathname, localizedPath } from '../src/i18n/config.mjs';
import { BRAND_TERMS, CONTROLLED_TERMS, MACHINE_VALUES } from '../src/i18n/glossary.mjs';
import { compareCatalogShape, flattenCatalog, validateCatalog } from '../src/i18n/schema.mjs';
import italianShared from '../src/i18n/it/shared.mjs';
import englishShared from '../src/i18n/en/shared.mjs';
import italianGames from '../src/i18n/it/games.mjs';
import englishGames from '../src/i18n/en/games.mjs';

const root = process.cwd();
const failures = [];
const must = (condition, message) => { if (!condition) failures.push(message); };
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

must(SUPPORTED_LOCALES.join(',') === 'it,en,de,fr,es', 'supported locale order/contract changed');
must(DEFAULT_LOCALE === 'it' && DEFAULT_LOCALE_PREFIXED === false, 'Italian must remain the unprefixed default');
must(Object.keys(LOCALE_META).join(',') === SUPPORTED_LOCALES.join(','), 'locale metadata must cover every supported locale');
for (const namespace of ['core', 'home', 'pause', 'session', 'gameOver', 'leaderboard', 'pwa', 'games']) must(I18N_NAMESPACES.includes(namespace), `missing namespace ${namespace}`);
must(localeFromPathname('/games/block-drop/') === 'it', 'unprefixed route must resolve to Italian');
must(localeFromPathname('/en/games/block-drop/') === 'en', 'prefixed route locale resolution failed');
must(localizedPath('/fr/games/block-drop/', 'it') === '/games/block-drop/', 'Italian equivalent route failed');
must(localizedPath('/games/block-drop/', 'de') === '/de/games/block-drop/', 'localized equivalent route failed');
must(BRAND_TERMS.RetroWebGames === 'never-translate' && MACHINE_VALUES.includes('runId'), 'brand/machine glossary contract missing');
for (const locale of SUPPORTED_LOCALES) must(Boolean(CONTROLLED_TERMS.solitaire[locale]), `Solitario display name decision missing for ${locale}`);

const source = { core: { greeting: 'Ciao {name}' }, pause: { credits: '{count} crediti' } };
const matching = { core: { greeting: 'Hello {name}' }, pause: { credits: '{count} credits' } };
const mismatch = { core: { greeting: 'Hello {player}' }, pause: { credits: '{count} credits' } };
must(validateCatalog('it', source).ok, 'valid source catalog rejected');
must(compareCatalogShape(source, matching).ok, 'matching catalog shape rejected');
must(!compareCatalogShape(source, mismatch).ok, 'placeholder mismatch not detected');
must(!validateCatalog('en', { core: { unsafe: '<script>alert(1)</script>' } }).ok, 'unsafe catalog markup not rejected');

for (const relative of ['docs/I18N-ARCHITECTURE.md', 'docs/I18N-INVENTORY.md', 'docs/I18N-BASELINE.md', 'scripts/audit-i18n.mjs']) {
  must(fs.existsSync(path.join(root, relative)), `missing I18N-0 artifact: ${relative}`);
}
const adr = read('docs/I18N-ARCHITECTURE.md');
for (const marker of ['Status: Accepted', 'Astro static output', 'Rollback', 'Italiano senza prefisso', 'language-neutral']) must(adr.includes(marker), `ADR missing: ${marker}`);
const inventory = read('docs/I18N-INVENTORY.md');
for (const marker of ['HTML e metadata', 'Shared runtime', 'Game runtime', 'CSS generated content', 'Manifest/PWA', 'API errors', 'Analytics e debug', 'it-IT', 'toLocaleString']) must(inventory.includes(marker), `inventory missing category: ${marker}`);

const audit = spawnSync(process.execPath, [path.join(root, 'scripts/audit-i18n.mjs'), '--summary'], { cwd: root, encoding: 'utf8' });
must(audit.status === 0, `inventory scanner failed: ${audit.stderr || audit.stdout}`);
if (audit.status === 0) {
  const report = JSON.parse(audit.stdout);
  must(report.filesScanned >= 30, 'inventory scanner coverage unexpectedly low');
  must(report.occurrences >= 100, 'inventory scanner found implausibly few candidates');
  for (const kind of ['html-visible-copy', 'html-attribute-or-meta', 'js-ui-or-api-copy', 'css-generated-copy', 'locale-or-formatter']) must(report.counts[kind] > 0, `inventory scanner missing ${kind}`);
  for (const concern of ['accessibility', 'analytics', 'debug-only', 'seo', 'brand', 'shared', 'gameplay']) must(report.counts[`concern:${concern}`] > 0, `inventory scanner missing concern ${concern}`);
}

const htmlFiles = [];
function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(target);
    else if (entry.name === 'index.html') htmlFiles.push(target);
  }
}
collect(path.join(root, fs.existsSync(path.join(root, 'public', 'index.html')) ? 'public' : '.'));
must(htmlFiles.length === 24, `expected 12 Italian + 12 English pages, found ${htmlFiles.length}`);
const italianHtmlFiles=htmlFiles.filter(file=>!path.relative(root,file).split(path.sep).includes('en'));
const englishHtmlFiles=htmlFiles.filter(file=>path.relative(root,file).split(path.sep).includes('en'));
must(italianHtmlFiles.length===12&&englishHtmlFiles.length===12,'localized page set must be symmetrical');
for (const file of italianHtmlFiles) must(/<html\s+lang="it"/.test(fs.readFileSync(file, 'utf8')), `${path.relative(root, file)} lang must remain it`);
for (const file of englishHtmlFiles) must(/<html\s+lang="en"/.test(fs.readFileSync(file, 'utf8')), `${path.relative(root, file)} lang must be en`);


for (const relative of [
  'astro.config.mjs', 'package.json', 'package-lock.json', 'docs/I18N-ASTRO-POC.md',
  'astro-poc/src/components/PilotDocument.astro', 'astro-poc/src/lib/render-pilot-page.mjs',
  'astro-poc/src/pages/index.astro', 'astro-poc/src/pages/en/index.astro',
  'astro-poc/src/pages/games/block-drop/index.astro', 'astro-poc/src/pages/en/games/block-drop/index.astro',
  'scripts/prepare-astro-poc.mjs', 'scripts/finalize-astro-poc.mjs',
  'scripts/validate-astro-poc.mjs', 'scripts/smoke-astro-poc.mjs', 'scripts/compare-astro-poc.mjs'
]) must(fs.existsSync(path.join(root, relative)), `missing I18N-1 artifact: ${relative}`);
const astroConfig = read('astro.config.mjs');
must(astroConfig.includes("output: 'static'") && astroConfig.includes("prefixDefaultLocale: false"), 'Astro pilot must remain static with unprefixed Italian');
const packageJson = JSON.parse(read('package.json'));
must(packageJson.devDependencies?.astro === '7.3.1', 'Astro pilot version must remain pinned');
must(packageJson.devDependencies?.['@astrojs/sitemap'] === '3.7.4', 'Astro sitemap version must remain pinned');
const pocDoc = read('docs/I18N-ASTRO-POC.md');
for (const marker of ['Status: **PASS', 'Astro: YES', '0 vulnerabilities', 'rollback', '12/12 PASS']) must(pocDoc.includes(marker), `I18N-1 evidence missing: ${marker}`);

// I18N-2/3: complete IT/EN catalogs boot before any shared or game runtime.
const sharedValidation = validateCatalog('it', italianShared);
must(sharedValidation.ok, `Italian shared catalog invalid: ${sharedValidation.errors.join('; ')}`);
const englishValidation = validateCatalog('en', englishShared);
must(englishValidation.ok, `English shared catalog invalid: ${englishValidation.errors.join('; ')}`);
must(compareCatalogShape(italianShared,englishShared).ok,'English shared catalog shape/placeholders differ from Italian');
must(compareCatalogShape(italianGames,englishGames).ok,'English game catalog shape/placeholders differ from Italian');
const sharedFlat = flattenCatalog(italianShared);
for (const namespace of ['core','share','session','pause','gameOver','leaderboard','profile','orientation','avatar','pwa','home']) {
  must([...sharedFlat.keys()].some(key => key.startsWith(namespace + '.')), `Italian shared catalog namespace empty: ${namespace}`);
}

const siteFile = relative => fs.existsSync(path.join(root, relative)) ? relative : relative.replace(/^public\//, '');
const runtimePath = siteFile('public/rwg-i18n.js');
must(fs.existsSync(path.join(root, runtimePath)), 'missing generated Italian runtime: ' + runtimePath);
const runtime = fs.existsSync(path.join(root, runtimePath)) ? read(runtimePath) : '';
for (const marker of ['window.RWGI18n','Intl.NumberFormat','Intl.DateTimeFormat','Intl.PluralRules','rwg:i18n-ready','bootstrapMs',"document.documentElement.lang === 'it'"]) must(runtime.includes(marker), `Italian runtime missing: ${marker}`);
must(runtime.includes('const catalog = Object.freeze(' + JSON.stringify(italianShared) + ');'), 'generated Italian runtime is stale; run npm run build:i18n');
must(Buffer.byteLength(runtime) < 24 * 1024, 'Italian bootstrap exceeds the 24 KiB uncompressed guardrail');
const englishRuntimePath=siteFile('public/rwg-i18n.en.js');
const englishRuntime=fs.existsSync(path.join(root,englishRuntimePath))?read(englishRuntimePath):'';
must(englishRuntime.includes('const catalog = Object.freeze(' + JSON.stringify(englishShared) + ');'),'generated English runtime is stale; run npm run build:i18n');
must(Buffer.byteLength(englishRuntime)<24*1024,'English bootstrap exceeds the 24 KiB uncompressed guardrail');

const sharedTargets = ['public/game-over.js','public/rwg-common-dock.js','public/rwg-pause-menu.js','public/rwg-session.js','public/rwg-leaderboard.js','public/rwg-leaderboard-infinite.js','public/game-hud.js','public/rwg-profile.js','public/rwg-avatar.js','public/orientation.js','public/rwg-intro-share.js','public/avatar/avatar-editor.js','public/hub-share.js','public/pwa-install.js'];
for (const relative of sharedTargets) {
  const targetSource = read(siteFile(relative));
  must(targetSource.includes('window.RWGI18n'), `${relative}: shared locale runtime is not used`);
  for (const match of targetSource.matchAll(/\bt\(['"]([^'"]+)['"]/g)) must(sharedFlat.has(match[1]), `${relative}: unresolved locale key ${match[1]}`);
}
const forbiddenSharedLiterals = ['Vuoi continuare la partita precedente?','CONFERMA DEFINITIVA','INSERISCI IL TUO NOME','REGISTRA RECORD','SCORRI PER ALTRI HIGH SCORES','Condividi il tuo risultato!','Scegli un altro gioco'];
for (const literal of forbiddenSharedLiterals) for (const relative of sharedTargets) must(!read(siteFile(relative)).includes(literal), `${relative}: untranslated shared UI literal remains: ${literal}`);

for (const file of italianHtmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file);
  const gameSlug=relative.match(/games[\\/]([^\\/]+)[\\/]index\.html$/)?.[1];
  const localeAsset=gameSlug?`/i18n/it/games/${gameSlug}.js?v=20260908.2`:'/rwg-i18n.js?v=20260908.2';
  const localeIndex = html.indexOf(localeAsset);
  must(localeIndex >= 0, `${relative}: versioned synchronous Italian bootstrap missing`);
  const firstRuntime = [html.indexOf('game-hud.js'),html.indexOf('orientation.js'),html.indexOf('rwg-profile.js'),html.indexOf('pwa-install.js')].filter(index => index >= 0).sort((a,b) => a-b)[0];
  if (firstRuntime !== undefined) must(localeIndex < firstRuntime, `${relative}: locale bootstrap must precede shared/game runtime`);
  must((html.match(gameSlug?/\/i18n\/it\/games\/[a-z-]+\.js/g:/\/rwg-i18n\.js/g) || []).length === 1, `${relative}: locale bootstrap must appear exactly once`);
}
for(const file of englishHtmlFiles){
  const html=fs.readFileSync(file,'utf8'),relative=path.relative(root,file),gameSlug=relative.match(/games[\\/]([^\\/]+)[\\/]index\.html$/)?.[1],localeAsset=gameSlug?`/i18n/en/games/${gameSlug}.js?v=20260908.2`:'/rwg-i18n.en.js?v=20260908.2',localeIndex=html.indexOf(localeAsset);
  must(localeIndex>=0,`${relative}: versioned synchronous English bootstrap missing`);
  must((html.match(gameSlug?/\/i18n\/en\/games\/[a-z-]+\.js/g:/\/rwg-i18n\.en\.js/g)||[]).length===1,`${relative}: English locale bootstrap must appear exactly once`);
  must(html.includes('hreflang="it"')&&html.includes('hreflang="en"')&&html.includes('hreflang="x-default"'),`${relative}: reciprocal hreflang set missing`);
  must(html.includes('og:locale" content="en_US"'),`${relative}: English Open Graph locale missing`);
  must(html.includes(`href="/en${relative.includes('/games/')?'/games/'+relative.split('/games/')[1].split('/')[0]+'/':relative.includes('/avatar/')?'/avatar/':'/'}" data-rwg-language="en" aria-current="page"`),`${relative}: equivalent language selector missing`);
}
const homeHtml = read(siteFile('public/index.html'));
for (const key of ['pwa.title','pwa.copy','pwa.install','home.eyebrow','home.intro','home.gamesAria','pwa.cardTitle','pwa.cardCopy','pwa.installWebApp']) must(homeHtml.includes(key), `home shell missing declarative locale binding: ${key}`);
const avatarHtml = read(siteFile('public/avatar/index.html'));
for (const key of ['avatar.identity','avatar.pageIntro','avatar.livePreview','avatar.rotateHint','avatar.randomLoadout','avatar.undoChanges','avatar.savePlayer','avatar.profileNote']) must(avatarHtml.includes(key), `avatar shell missing declarative locale binding: ${key}`);
for (const [relative, marker] of [['public/rwg-profile.js','rwg.profile.v1'],['public/rwg-session.js','rwg.session.v2:'],['public/rwg-avatar.js','rwg.avatar.v${VERSION}:'],['public/rwg-leaderboard.js','rwg.leaderboard.queue.v1']]) must(read(siteFile(relative)).includes(marker), `${relative}: language-neutral persisted identity changed`);
must(packageJson.scripts?.['build:i18n'] === 'node scripts/build-i18n.mjs', 'package must expose deterministic build:i18n');
must(packageJson.scripts?.['build:astro-poc']?.startsWith('npm run build:i18n &&'), 'Astro pilot build must regenerate locale runtime first');
const worker = read(siteFile('public/sw.js'));
must(worker.includes("CACHE_NAME = 'rwg-shell-v5'") && worker.includes("'/rwg-i18n.js'") && worker.includes("'/rwg-i18n.en.js'") && worker.includes("'/en/'"), 'PWA shell cache must rotate and include both complete locale bootstraps');

const gameSlugs=Object.keys(italianGames);
for(const locale of ['it','en'])for(const slug of gameSlugs){
  const bundle=siteFile(`public/i18n/${locale}/games/${slug.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())}.js`);
  must(fs.existsSync(path.join(root,bundle)),`missing ${locale} game bundle: ${bundle}`);
}
const sitemap=read(siteFile('public/sitemap.xml'));
must((sitemap.match(/<url>/g)||[]).length===22,'localized sitemap must contain exactly 22 indexable URLs');
const siteRoot=fs.existsSync(path.join(root,'public','index.html'))?path.join(root,'public'):root;
for(const page of englishHtmlFiles.filter(file=>!file.includes(`${path.sep}avatar${path.sep}`))){const relative=path.relative(siteRoot,page).split(path.sep).join('/').replace(/index\.html$/,'');must(sitemap.includes(`https://www.retrowebgames.it/${relative}`),`${relative}: missing from sitemap`);}

if (failures.length) {
  console.error(`I18N validation FAILED (${failures.length})`);
  failures.forEach(item => console.error(`  ✗ ${item}`));
  process.exit(1);
}
console.log('I18N-3 validation OK');
console.log('  ✓ five-locale route, namespace, schema, glossary and placeholder contracts');
console.log('  ✓ repository-wide string/formatter inventory scanner coverage');
console.log('  ✓ 12 Italian and 12 English routes are symmetrical and localized');
console.log("  ✓ Astro static production generator, pinned toolchain, metadata and sitemap gate");
console.log('  ✓ complete Italian and English shared/game catalogs, synchronous bootstraps and resolved routes');
console.log('  ✓ language-neutral persisted identities, deterministic generation and rotated PWA cache');
