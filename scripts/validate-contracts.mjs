#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

const root = process.cwd();
const failures = [];

function read(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    failures.push(`MISSING: ${rel}`);
    return '';
  }
  return fs.readFileSync(abs, 'utf8');
}

function must(condition, message) { if (!condition) failures.push(message); }
function walk(dir = root, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, out); else out.push(abs);
  }
  return out;
}

const gamePages = fs.readdirSync(path.join(root, 'games'), { withFileTypes: true })
  .filter(entry => entry.isDirectory() && fs.existsSync(path.join(root, 'games', entry.name, 'index.html')))
  .map(entry => `games/${entry.name}/index.html`)
  .filter(rel => /<body[^>]*data-rwg-game=["']true["']/i.test(read(rel)))
  .sort();

const terminalRuntimes = [
  ['Star Swarm', 'games/star-swarm/engine.js'],
  ['Bubble Burst', 'games/bubble-burst/game.js'],
  ['Block Drop', 'games/block-drop/game.js'],
  ['Maze Munch', 'games/maze-munch/engine.js'],
  ['Neon Rally', 'games/neon-rally/game.js'],
  ['Neon Snake', 'games/neon-snake/game.js'],
  ['Neon Tilt', 'games/neon-tilt/game.js'],
  ['Prism Breaker', 'games/prism-breaker/engine.js']
];
const continueRuntimes = [
  'games/star-swarm/engine.js','games/bubble-burst/game.js','games/block-drop/game.js','games/maze-munch/game.js','games/neon-rally/game.js','games/neon-snake/game.js','games/neon-tilt/game.js','games/prism-breaker/engine.js'
];
const lifecycleRuntimes = [...continueRuntimes];

for (const abs of walk().filter(file => /\.(?:m?js)$/.test(file))) {
  const result = spawnSync(process.execPath, ['--check', abs], { encoding: 'utf8' });
  if (result.status !== 0) failures.push(`${path.relative(root, abs)}: node --check failed: ${(result.stderr || result.stdout || '').trim()}`);
}

for (const rel of gamePages) {
  const html = read(rel);
  must(/<body[^>]*data-rwg-game=["']true["']/i.test(html), `${rel}: missing data-rwg-game="true"`);
  must(html.includes('../../game-hud.js'), `${rel}: shared game-hud.js must be loaded`);
  must(html.includes('../../orientation.js'), `${rel}: shared orientation.js must be loaded`);
  must(/https:\/\/www\.retrowebgames\.it\//.test(html), `${rel}: canonical production origin missing`);
  must(html.indexOf('../../game-hud.js') < html.indexOf('../../orientation.js'), `${rel}: game-hud.js must load before orientation.js`);
  const startIndex = html.indexOf('id="startBtn"'), menuIndex = html.indexOf('class="primary-btn rwg-intro-secondary"');
  must(startIndex >= 0, `${rel}: intro GIOCA button missing`);
  must(menuIndex > startIndex, `${rel}: intro return-to-menu action must immediately follow GIOCA`);
  must(/<a class="primary-btn rwg-intro-secondary" href="\/">TORNA AL MENU<\/a>/.test(html), `${rel}: intro return-to-menu action must target local-compatible root /`);
}

const sharedHudCss = read('game-hud.css');
must(sharedHudCss.includes('.rwg-intro-secondary'), 'game-hud.css: shared intro secondary action style missing');
const sharedHudJs = read('game-hud.js');
must(sharedHudJs.includes('introMenu.hidden = true'), 'game-hud.js: intro return-to-menu action must be dismissed when gameplay starts');
must(sharedHudJs.includes('rwg-session.js') && sharedHudJs.includes('rwg-session.css') && sharedHudJs.includes('loadSession();'), 'game-hud.js: shared resumable-session bootstrap must remain automatic for every game');

must(!fs.existsSync(path.join(root, 'game.js')), 'Obsolete root game.js must remain deleted; Star Swarm has one authoritative engine only');
const starHtml = read('games/star-swarm/index.html');
must(starHtml.includes('<script src="engine.js"></script>'), 'Star Swarm must load games/star-swarm/engine.js');
must(!starHtml.includes('<script src="../../game.js"></script>'), 'Star Swarm regression: root game.js must not be loaded');
must(starHtml.indexOf('engine.js') < starHtml.indexOf('../../game-hud.js'), 'Star Swarm engine must load before game-hud.js');

for (const [name, rel] of terminalRuntimes) {
  const source = read(rel);
  must(source.includes('rwg:game-ended'), `${name}: terminal runtime must emit rwg:game-ended`);
  must(/RWGGameOver\?\.open\?\.|RWGGameOver\.open/.test(source), `${name}: terminal runtime must explicitly request shared RWG Game Over`);
  must(!source.includes('rwg-game-over-layer'), `${name}: must not create a local copy of shared Game Over UI`);
}
for (const rel of continueRuntimes) {
  const source = read(rel);
  must(source.includes('rwg:continue-game'), `${rel}: must handle shared credit continue`);
  must(!/(?:score|playerScore|M\.score)\s*\*\s*\.5/.test(source), `${rel}: obsolete half-score continue fallback must not return`);
}
for (const rel of lifecycleRuntimes) {
  const source = read(rel);
  must(source.includes('visibilitychange'), `${rel}: must pause safely on visibilitychange`);
  must(source.includes('rwg:continue-game'), `${rel}: shared Continue listener missing`);
}

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(read('games/star-swarm/campaign.js'), sandbox, { filename: 'campaign.js' });
vm.runInContext(read('games/star-swarm/bosses.js'), sandbox, { filename: 'bosses.js' });
const campaign = sandbox.window.StarSwarmCampaign, bosses = sandbox.window.StarSwarmBosses;
must(Boolean(campaign?.getStage), 'Star Swarm campaign module did not initialize');
must(Boolean(bosses?.getBoss), 'Star Swarm boss module did not initialize');
if (campaign?.getStage) {
  const stages = Array.from({ length: 100 }, (_, index) => campaign.getStage(index + 1, 390, 844));
  must(new Set(stages.map(stage => stage.signature)).size === 100, 'Star Swarm: first 100 campaign signatures must be unique');
  must(stages.filter(stage => stage.bossEscort).map(stage => stage.level).join(',') === '10,20,30,40,50,60,70,80,90,100', 'Star Swarm: boss escort cadence must remain every ten levels');
}
if (bosses?.BOSSES) {
  must(bosses.BOSSES.length === 10, `Star Swarm must define exactly 10 base bosses; found ${bosses.BOSSES.length}`);
  for (const key of ['name', 'shape', 'ai', 'attack']) must(new Set(bosses.BOSSES.map(boss => boss[key])).size === 10, `Star Swarm bosses must have 10 distinct ${key} values`);
}

const star = read('games/star-swarm/engine.js');
const weaponSegmentCount = (star.match(/damageCoeff\s*:/g) || []).length;
must(weaponSegmentCount === 8, `Star Swarm Weapon progression must have exactly 8 firing forms; found ${weaponSegmentCount}`);
for (const name of ['SINGLE FIRE','DOUBLE FIRE','TRIPLE DIAGONAL FIRE','4 FIRE LINEAR','FIREBALLS 3 WAY','LASER','3 WAY LASERS','5 WAY LASERS']) must(star.includes(`name:'${name}'`), `Star Swarm Weapon form missing: ${name}`);
const powerDamageMatch = star.match(/const POWER_DAMAGE=\[([^\]]+)\]/), powerColorMatch = star.match(/const POWER_COLORS=\[([\s\S]*?)\];/);
const powerDamageSteps = powerDamageMatch ? powerDamageMatch[1].split(',').map(v => v.trim()).filter(Boolean) : [];
const powerColorSteps = powerColorMatch ? (powerColorMatch[1].match(/#[0-9a-fA-F]{6}/g) || []) : [];
must(powerDamageSteps.length === 20, `Star Swarm POWER damage progression must have exactly 20 levels; found ${powerDamageSteps.length}`);
must(powerColorSteps.length === 20, `Star Swarm POWER must have exactly 20 projectile colors; found ${powerColorSteps.length}`);
must(new Set(powerColorSteps).size === 20, 'Star Swarm POWER projectile colors must be distinct');
must(star.includes('player.power<20'), 'Star Swarm POWER pickup must cap at level 20');
must(star.includes('POWER_DAMAGE[player.power-1]'), 'Star Swarm projectile damage must use the 20-step POWER damage table');
must(/player\.weapon\s*=\s*Math\.max\(0,\s*player\.weapon\s*-\s*2\)/.test(star), 'Star Swarm: life loss must downgrade Weapon by two forms');
must(/player\.power\s*=\s*Math\.max\(1,\s*player\.power\s*-\s*2\)/.test(star), 'Star Swarm: life loss must downgrade POWER by two levels');
must(star.includes('drops.power<2'), 'Star Swarm: POWER drops must be capped at two per level');
must(star.includes('drops.shield<1'), 'Star Swarm: Shield drops must be capped at one per level');
must(star.includes('level%2===0') && star.includes('drops.tractor<1'), 'Star Swarm: Tractor Beam must be limited to one eligible drop every two levels');
must(star.includes("e.type===2?.0086:.0049"), 'Star Swarm: Weapon Upgrade rarity must remain at intended 0.86% / 0.49% baseline');
must(!star.includes("e.type===2?.0043:.00245"), 'Star Swarm regression: accidental extra Weapon Upgrade rarity halving reintroduced');
must(star.includes("probs.push(['power',.010*elite])"), 'Star Swarm: POWER rarity must remain at halved 1.0% baseline before elite multiplier');
must(!star.includes("probs.push(['power',.020*elite])"), 'Star Swarm regression: old 2.0% POWER drop baseline reintroduced');
must(!/b\.kind===['"]laser['"][^\n]{0,180}pierce--/.test(star), 'Star Swarm regression: laser must not be consumed by pierce decrement');
must(star.includes("if(b.kind==='laser')continue;"), 'Star Swarm: laser must continue through normal enemies after a hit');
must(/base\*\(WEAPONS\[player\.weapon\]\?\.damageCoeff\|\|1\)/.test(star), 'Star Swarm: Weapon damage coefficient must affect projectile damage');
must(star.includes('W${player.weapon+1}/8') && star.includes('POWER ${player.power}/20'), 'Star Swarm HUD must expose Weapon 1/8 and POWER 1/20 semantics');

const gameOver = read('game-over.js');
for (const marker of ['GAME OVER','Condividi il tuo risultato!','Continua con 1','Nuova partita','Scegli un altro gioco','rwg:continue-game','rwg:game-ended']) must(gameOver.includes(marker), `Shared game-over.js missing required marker: ${marker}`);
must(gameOver.includes('ensureSession'), 'Shared Game Over must recover a session when terminal lifecycle arrives late');
must(gameOver.includes('open: openSummary'), 'RWGGameOver.open must use the race-safe openSummary contract');
must(gameOver.includes('queueMicrotask(checkGameOver)'), 'Shared Game Over must perform an initial late-bootstrap terminal-state check');
must(!gameOver.includes('Mantieni punteggio e progresso'), 'Obsolete helper text must not reappear between equidistant Game Over actions');
must(!/rwg-back-games[^>]*style=/.test(gameOver), 'Game Over action styling must remain in CSS, not inline markup');
must(gameOver.includes("metric(hasMatchScore ? 'Best rally' : 'Record'"), 'Shared Game Over must preserve Neon Rally record semantics');

const hud = read('game-hud.js');
must(hud.includes('rwg-profile.js'), 'game-hud.js must bootstrap rwg-profile.js');
must(hud.includes('game-over.js'), 'game-hud.js must bootstrap game-over.js');
must(hud.includes('rwg-avatar.js'), 'game-hud.js must bootstrap rwg-avatar.js');
must(!hud.includes('loadAvatarThenGameOver'), 'Game Over must not be serially blocked behind avatar loading');
must(hud.includes('loadGameOver();') && hud.includes('loadAvatar();'), 'Shared extras must load Game Over and avatar independently');

const profile = read('rwg-profile.js');
must(profile.includes('RWGContinueProvider'), 'rwg-profile.js must expose RWGContinueProvider');
must(profile.includes('INITIAL_CREDITS = 10'), 'Profile initial credits contract changed unexpectedly');
must(profile.includes('globalThis.crypto'), 'Profile ID generation must use guarded globalThis.crypto');
must(!profile.includes('if (crypto?.'), 'Profile regression: bare crypto optional chaining can throw when crypto is undefined');
must(profile.includes('coinSeq'), 'Profile coin SVG must use unique internal IDs');
must(profile.includes('recordValue') && profile.includes('maxCombo') && profile.includes('maxRally'), 'Profile must retain generalized record/combo/rally statistics');
for (const field of ['attempts','gameOvers','continues','playTimeMs','bestScore','lastScore','maxLevel','maxLines','maxCombo','maxRally','recordValue','achievements']) must(profile.includes(`${field}:`), `Profile stats field missing: ${field}`);
must((profile.match(/document\.body\.appendChild\(badge\)/g) || []).length === 1, 'Profile badge mount must append badge exactly once');

const tiltPhysics = read('games/neon-tilt/physics.js');
must(tiltPhysics.includes('ball.x = bumper.x + nx * minD'), 'Neon Tilt bumper collision must resolve penetration to prevent repeat impulses');
const tiltGame = read('games/neon-tilt/game.js');
must(tiltGame.includes("if('ResizeObserver' in window)"), 'Neon Tilt must retain ResizeObserver feature detection');
must(tiltGame.includes('DeviceOrientationEvent.requestPermission'), 'Neon Tilt sensor permission must remain user-gesture driven');
must(tiltGame.includes('touchInput') && tiltGame.includes('keyInput'), 'Neon Tilt must retain touch and keyboard fallbacks');
must(tiltGame.includes('dead=1.25') && tiltGame.includes('smoothBeta'), 'Neon Tilt must retain dead-zone and sensor smoothing');

const manifest = JSON.parse(read('manifest.webmanifest') || '{}');
for (const icon of [['icons/icon-192.png','192x192','any'],['icons/icon-512.png','512x512','any'],['icons/icon-maskable-512.png','512x512','maskable']]) {
  const [rel,sizes,purpose]=icon;
  must(fs.existsSync(path.join(root, rel)), `PWA icon missing: ${rel}`);
  must(manifest.icons?.some(entry => entry.src.endsWith(`/${rel}`) && entry.sizes === sizes && entry.purpose === purpose), `manifest.webmanifest missing ${sizes} ${purpose} icon`);
}

const agents = read('AGENTS.md');
must(agents.includes('Game-over contract — CRITICAL'), 'AGENTS.md must retain critical Game Over regression contract');
must(agents.includes('exactly **8 firing forms**'), 'AGENTS.md must document Star Swarm 8-form Weapon progression');
must(agents.includes('POWER range: **1..20**'), 'AGENTS.md must document Star Swarm 20-level POWER progression');
must(agents.includes('Do not conflate these two systems'), 'AGENTS.md must retain Weapon vs POWER semantic guardrail');

for (const rel of ['scripts/validate-session.mjs','scripts/validate-bubble-burst.mjs','scripts/validate-solitaire.mjs','scripts/validate-prism-breaker.mjs','scripts/validate-social-sharing.mjs','scripts/validate-analytics.mjs','scripts/validate-icons.mjs']) {
  const result = spawnSync(process.execPath, [path.join(root, rel)], { encoding: 'utf8' });
  must(result.status === 0, `${rel}: specialized validator failed: ${(result.stderr || result.stdout || '').trim()}`);
}

if (failures.length) {
  console.error(`\nRetroWebGames contract validation FAILED (${failures.length})\n`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  console.error(''); process.exit(1);
}

console.log('RetroWebGames contract validation OK');
console.log('  ✓ all JavaScript sources pass node --check');
console.log(`  ✓ ${gamePages.length} discovered game pages use shared platform contracts`);
console.log(`  ✓ ${terminalRuntimes.length} terminal runtimes explicitly open shared Game Over`);
console.log(`  ✓ ${continueRuntimes.length} continue handlers preserve full score/progress contract`);
console.log(`  ✓ ${gamePages.length}/${gamePages.length} current games and future discovered games are subject to mandatory resume validation`);
console.log('  ✓ Star Swarm campaign/Weapon/POWER/drop/laser invariants are present');
console.log('  ✓ shared bootstrap/profile/Game Over/session resilience invariants are intact');
console.log('  ✓ Neon Tilt audited physics/compatibility guards are present');
console.log('  ✓ Session, social sharing, analytics, icons, Bubble Burst, Solitario and Prism Breaker specialized validators are green');
console.log('  ✓ campaign uniqueness, boss roster and lifecycle pause guards are intact');
console.log('  ✓ PWA install icons and complete profile statistics are present');
