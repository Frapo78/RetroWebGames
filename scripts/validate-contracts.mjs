#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

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

function must(condition, message) {
  if (!condition) failures.push(message);
}

function walk(dir = root, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, out);
    else out.push(abs);
  }
  return out;
}

const gamePages = [
  'games/star-swarm/index.html',
  'games/bubble-burst/index.html',
  'games/block-drop/index.html',
  'games/maze-munch/index.html',
  'games/neon-rally/index.html',
  'games/neon-snake/index.html',
  'games/neon-tilt/index.html'
];

const terminalRuntimes = [
  ['Star Swarm', 'games/star-swarm/engine.js'],
  ['Bubble Burst', 'games/bubble-burst/game.js'],
  ['Block Drop', 'games/block-drop/game.js'],
  ['Maze Munch', 'games/maze-munch/engine.js'],
  ['Neon Rally', 'games/neon-rally/game.js'],
  ['Neon Snake', 'games/neon-snake/game.js'],
  ['Neon Tilt', 'games/neon-tilt/game.js']
];

const continueRuntimes = [
  'games/star-swarm/engine.js',
  'games/bubble-burst/game.js',
  'games/block-drop/game.js',
  'games/maze-munch/game.js',
  'games/neon-rally/game.js',
  'games/neon-snake/game.js',
  'games/neon-tilt/game.js'
];

// Syntax is a repository-wide guardrail: every JS/MJS source must parse in Node.
for (const abs of walk().filter(file => /\.(?:m?js)$/.test(file))) {
  const result = spawnSync(process.execPath, ['--check', abs], { encoding: 'utf8' });
  if (result.status !== 0) {
    const rel = path.relative(root, abs);
    failures.push(`${rel}: node --check failed: ${(result.stderr || result.stdout || '').trim()}`);
  }
}

for (const rel of gamePages) {
  const html = read(rel);
  must(/<body[^>]*data-rwg-game=["']true["']/i.test(html), `${rel}: missing data-rwg-game="true"`);
  must(html.includes('../../game-hud.js'), `${rel}: shared game-hud.js must be loaded`);
  must(html.includes('../../orientation.js'), `${rel}: shared orientation.js must be loaded`);
  must(/https:\/\/www\.retrowebgames\.it\//.test(html), `${rel}: canonical production origin missing`);
  must(html.indexOf('../../game-hud.js') < html.indexOf('../../orientation.js'), `${rel}: game-hud.js must load before orientation.js`);
}

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

const star = read('games/star-swarm/engine.js');
const weaponSegmentCount = (star.match(/damageCoeff\s*:/g) || []).length;
must(weaponSegmentCount === 20, `Star Swarm weapon progression must have exactly 20 damageCoeff segments; found ${weaponSegmentCount}`);
must(star.includes('player.weapon=Math.max(0,player.weapon-2)') || /player\.weapon\s*=\s*Math\.max\(0,\s*player\.weapon\s*-\s*2\)/.test(star), 'Star Swarm: life loss must downgrade weapon by two segments');
must(star.includes('player.power=Math.max(1,player.power-2)') || /player\.power\s*=\s*Math\.max\(1,\s*player\.power\s*-\s*2\)/.test(star), 'Star Swarm: life loss must downgrade POWER by two levels');
must(star.includes('drops.power<2'), 'Star Swarm: POWER drops must be capped at two per level');
must(star.includes('drops.shield<1'), 'Star Swarm: Shield drops must be capped at one per level');
must(star.includes('level%2===0') && star.includes('drops.tractor<1'), 'Star Swarm: Tractor Beam must be limited to one eligible drop every two levels');
must(star.includes("e.type===2?.0043:.00245"), 'Star Swarm: Weapon Upgrade rarity must remain at the reduced 0.43% / 0.245% baseline');
must(!star.includes("e.type===2?.0086:.0049"), 'Star Swarm regression: old higher Weapon Upgrade drop rate reintroduced');
must(!/b\.kind===['"]laser['"][^\n]{0,180}pierce--/.test(star), 'Star Swarm regression: laser must not be consumed by pierce decrement');
must(star.includes("if(b.kind==='laser')continue;"), 'Star Swarm: laser must continue through normal enemies after a hit');
must(/base\*\(WEAPONS\[player\.weapon\]\?\.damageCoeff\|\|1\)/.test(star), 'Star Swarm: weapon damage coefficient must actually affect projectile damage');

const gameOver = read('game-over.js');
for (const marker of [
  'GAME OVER',
  'Condividi il tuo risultato!',
  'Continua con 1',
  'Nuova partita',
  'Scegli un altro gioco',
  'rwg:continue-game',
  'rwg:game-ended'
]) {
  must(gameOver.includes(marker), `Shared game-over.js missing required marker: ${marker}`);
}
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

const tiltPhysics = read('games/neon-tilt/physics.js');
must(tiltPhysics.includes('ball.x = bumper.x + nx * minD'), 'Neon Tilt bumper collision must resolve penetration to prevent repeat impulses');
const tiltGame = read('games/neon-tilt/game.js');
must(tiltGame.includes("if('ResizeObserver' in window)"), 'Neon Tilt must retain ResizeObserver feature detection');

const agents = read('AGENTS.md');
must(agents.includes('Game-over contract — CRITICAL'), 'AGENTS.md must retain the critical Game Over regression contract');
must(agents.includes('20 segments'), 'AGENTS.md must document Star Swarm 20-segment weapon progression');

if (failures.length) {
  console.error(`\nRetroWebGames contract validation FAILED (${failures.length})\n`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  console.error('');
  process.exit(1);
}

console.log('RetroWebGames contract validation OK');
console.log(`  ✓ all JavaScript sources pass node --check`);
console.log(`  ✓ ${gamePages.length} game pages use shared platform contracts`);
console.log(`  ✓ ${terminalRuntimes.length} terminal runtimes explicitly open shared Game Over`);
console.log(`  ✓ ${continueRuntimes.length} continue handlers preserve full score/progress contract`);
console.log('  ✓ Star Swarm campaign/weapon/drop/laser invariants are present');
console.log('  ✓ shared bootstrap/profile/Game Over resilience invariants are intact');
console.log('  ✓ Neon Tilt audited physics/compatibility guards are present');
