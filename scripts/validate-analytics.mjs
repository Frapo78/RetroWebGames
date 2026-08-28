#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const failures = [];
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const must = (condition, message) => { if (!condition) failures.push(message); };

const analytics = read('rwg-analytics.js');
const hud = read('game-hud.js');
const hub = read('index.html');
const avatar = read('avatar/index.html');

for (const marker of [
  "const MEASUREMENT_ID = 'G-ZSWLC4L8GW'",
  'window.dataLayer = window.dataLayer || []',
  "window.gtag('js', new Date())",
  "window.gtag('config', MEASUREMENT_ID)",
  'googletagmanager.com/gtag/js',
  "track('game_intro_view'",
  "'game_restart' : 'game_start'",
  "track('game_resume'",
  "track('game_resume_declined'",
  "track('game_continue'",
  "track('level_reached'",
  "track('game_engagement'",
  "track('game_end'",
  "track('game_exit'",
  "track('share'",
  "track('select_content'",
  "track('pwa_install'"
]) must(analytics.includes(marker), `rwg-analytics.js missing required marker: ${marker}`);

must(!analytics.includes('email'), 'Analytics shared module must not collect/send email data');
must(!analytics.includes('fingerprint'), 'Analytics shared module must not send profile fingerprints');
must(analytics.includes('milestones = [30, 120, 300, 600, 1200]'), 'Gameplay engagement milestones contract changed unexpectedly');
must(analytics.includes('RWGResumeAdapter?.isInProgress'), 'Intentional exits must retain in-progress context');
must(analytics.includes('gameplayPaused') && analytics.includes('setGameplayPaused'), 'Engagement timer must exclude explicit pause time');
must(analytics.includes("label.includes('RIPRENDI')"), 'RIPRENDI must not be counted as a game restart');
must(analytics.includes("startFreshTracked('resume_declined')"), 'Declining a saved game must begin a tracked fresh run');
must(analytics.includes("startFreshTracked('restore_failed')"), 'Safe fallback after failed restore must begin a tracked fresh run');

must(hud.includes('rwg-analytics.js'), 'game-hud.js must bootstrap centralized analytics for every game');
must(hud.includes('loadAnalytics();'), 'game-hud.js must initialize analytics as a platform contract');
must(hub.includes('/rwg-analytics.js'), 'Hub must load centralized rwg-analytics.js');
must(avatar.includes('/rwg-analytics.js'), 'Avatar page must load centralized rwg-analytics.js');

const gameDirs = fs.readdirSync(path.join(root, 'games'), { withFileTypes: true }).filter(e => e.isDirectory());
for (const entry of gameDirs) {
  const rel = `games/${entry.name}/index.html`;
  if (!fs.existsSync(path.join(root, rel))) continue;
  const html = read(rel);
  if (!/data-rwg-game=["']true["']/.test(html)) continue;
  must(html.includes('../../game-hud.js'), `${rel}: game must retain shared HUD analytics bootstrap`);
  must(!html.includes('googletagmanager.com/gtag/js'), `${rel}: Google tag must not be duplicated inside game HTML`);
  must(!html.includes("gtag('config'"), `${rel}: game HTML must not configure GA locally`);
}

for (const rel of ['index.html', 'avatar/index.html', ...gameDirs.map(e => `games/${e.name}/index.html`).filter(rel => fs.existsSync(path.join(root, rel)))]) {
  const html = read(rel);
  must(!html.includes("gtag('config'"), `${rel}: GA config must remain centralized in rwg-analytics.js`);
}

if (failures.length) {
  console.error(`\nRWG analytics validation FAILED (${failures.length})\n`);
  failures.forEach(f => console.error(`  ✗ ${f}`));
  console.error('');
  process.exit(1);
}

console.log('RWG analytics validation OK');
console.log('  ✓ GA4 measurement G-ZSWLC4L8GW is centralized');
console.log('  ✓ hub/avatar direct load + automatic game-hud bootstrap');
console.log('  ✓ gameplay funnel, resume, pause-aware engagement, share and install events present');
console.log('  ✓ no game-local Google tag duplication');
