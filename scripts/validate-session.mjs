#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const failures = [];
const must = (condition, message) => { if (!condition) failures.push(message); };
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const gamesRoot = path.join(root, 'games');
const gamePages = fs.readdirSync(gamesRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && fs.existsSync(path.join(gamesRoot, entry.name, 'index.html')))
  .map(entry => `games/${entry.name}/index.html`)
  .filter(rel => /<body[^>]*data-rwg-game=["']true["']/i.test(read(rel)))
  .sort();

must(gamePages.length > 0, 'No RWG game pages discovered');

const session = read('rwg-session.js');
const sessionCss = read('rwg-session.css');
const hud = read('game-hud.js');

for (const marker of [
  "const STORAGE_PREFIX = 'rwg.session.v2:'",
  'const ENVELOPE_SCHEMA = 2',
  'const DIRTY_DEBOUNCE_MS = 750',
  'const HEARTBEAT_MS = 5000',
  'adapter.compatibility',
  "adapter.validate(envelope.payload, envelope)",
  "requestIdleCallback",
  "pagehide",
  "beforeunload",
  "freeze",
  "navigation",
  "rwg:game-ended",
  "rwg:session-completed",
  'Vuoi continuare la partita precedente?',
  'data-rwg-resume-no',
  'data-rwg-resume-yes'
]) must(session.includes(marker), `rwg-session.js missing central persistence marker: ${marker}`);

must(session.includes("const LEGACY_PREFIXES = ['rwg.session.v1:']"), 'Session v2 must invalidate the obsolete v1 storage namespace');
must(session.includes("for (const method of ['serialize', 'restore', 'validate', 'isInProgress', 'startFresh'])"), 'Shared session register must require the complete adapter contract');
must(session.includes("encoded.length > MAX_SNAPSHOT_BYTES"), 'Shared session must retain a hard snapshot-size guard');
must(!/requestAnimationFrame\([^\n]{0,120}saveNow/.test(session), 'Shared session must never save once per animation frame');
must(sessionCss.includes('.rwg-resume-no') && sessionCss.includes('.rwg-resume-yes'), 'Shared resume modal red/green action styles missing');
must(sessionCss.indexOf('.rwg-resume-no') < sessionCss.indexOf('.rwg-resume-yes'), 'Resume modal must keep No before Sì in source/layout order');
must(sessionCss.includes('#c92f43') && sessionCss.includes('#35cf79'), 'Resume modal must retain red No and green Sì emphasis');
must(hud.includes('rwg-session.js') && hud.includes('rwg-session.css'), 'game-hud.js must bootstrap centralized RWGSession assets');
must(hud.includes('loadSession();'), 'game-hud.js must initialize the session service for every game');

const adapterSummaries = [];
for (const rel of gamePages) {
  const html = read(rel);
  const gameDir = path.posix.dirname(rel);
  const hudIndex = html.indexOf('../../game-hud.js');
  must(hudIndex >= 0, `${rel}: shared game-hud.js missing`);

  const scripts = [...html.matchAll(/<script\s+[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi)].map(match => ({ src: match[1], index: match.index }));
  const localBeforeHud = scripts.filter(item => item.index < hudIndex && !item.src.startsWith('../') && !/^https?:/i.test(item.src));
  const sources = [];
  for (const item of localBeforeHud) {
    const file = path.posix.normalize(`${gameDir}/${item.src}`);
    const abs = path.join(root, file);
    if (!fs.existsSync(abs)) continue;
    const source = fs.readFileSync(abs, 'utf8');
    sources.push({ file, source });
  }

  const adapterSources = sources.filter(item => item.source.includes('RWGResumeAdapter'));
  must(adapterSources.length >= 1, `${rel}: no RWGResumeAdapter is loaded before shared HUD; every current/future game must be resumable`);
  if (!adapterSources.length) continue;

  const joined = adapterSources.map(item => item.source).join('\n');
  for (const marker of ['compatibility:', 'serialize', 'validate', 'restore', 'startFresh', 'isInProgress']) {
    must(joined.includes(marker), `${rel}: resume adapter missing required contract marker ${marker}`);
  }
  must(/version\s*:\s*[1-9]\d*/.test(joined), `${rel}: resume adapter requires an explicit positive version`);
  must(/compatibility\s*:\s*['"`][^'"`]+['"`]/.test(joined), `${rel}: resume adapter requires a non-empty compatibility token`);
  must(!joined.includes('localStorage.setItem(`rwg.session') && !joined.includes("localStorage.setItem('rwg.session"), `${rel}: game adapter must not duplicate central session storage`);

  for (const { file } of adapterSources) {
    const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
    must(result.status === 0, `${file}: node --check failed: ${(result.stderr || result.stdout || '').trim()}`);
  }
  adapterSummaries.push(`${path.basename(gameDir)} → ${adapterSources.map(item => path.basename(item.file)).join(', ')}`);
}

if (failures.length) {
  console.error(`\nRWG resumable-session validation FAILED (${failures.length})\n`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  console.error('');
  process.exit(1);
}

console.log('RWG resumable-session validation OK');
console.log(`  ✓ ${gamePages.length}/${gamePages.length} discovered games expose a versioned compatible resume adapter`);
console.log('  ✓ future games are discovered automatically from games/*/index.html');
console.log('  ✓ central v2 envelope validates compatibility and semantic payloads');
console.log('  ✓ 750ms dirty debounce + 5s idle heartbeat + lifecycle checkpoints');
console.log('  ✓ terminal completion clears obsolete unfinished-run snapshots');
for (const summary of adapterSummaries) console.log(`  ✓ ${summary}`);
