#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

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

const gamePages = [
  'games/star-swarm/index.html',
  'games/bubble-burst/index.html',
  'games/block-drop/index.html',
  'games/maze-munch/index.html',
  'games/neon-rally/index.html',
  'games/neon-snake/index.html',
  'games/neon-tilt/index.html'
];

for (const rel of gamePages) {
  const html = read(rel);
  must(/<body[^>]*data-rwg-game=["']true["']/i.test(html), `${rel}: missing data-rwg-game="true"`);
  must(html.includes('../../game-hud.js'), `${rel}: shared game-hud.js must be loaded`);
  must(html.includes('../../orientation.js'), `${rel}: shared orientation.js must be loaded`);
}

const starHtml = read('games/star-swarm/index.html');
must(starHtml.includes('<script src="engine.js"></script>'), 'Star Swarm must load games/star-swarm/engine.js');
must(!starHtml.includes('<script src="../../game.js"></script>'), 'Star Swarm regression: root game.js must not be loaded');
must(starHtml.indexOf('engine.js') < starHtml.indexOf('../../game-hud.js'), 'Star Swarm engine must load before game-hud.js');

const star = read('games/star-swarm/engine.js');
must(star.includes("new CustomEvent('rwg:game-ended'"), 'Star Swarm must emit rwg:game-ended on terminal death');
must(/RWGGameOver\?\.open\?\.\(\)/.test(star) || /RWGGameOver\.open\(/.test(star), 'Star Swarm must explicitly open the shared RWG Game Over');
must(star.includes("window.addEventListener('rwg:continue-game'"), 'Star Swarm must handle shared credit continue');
must(!star.includes('rwg-game-over-layer'), 'Star Swarm engine must not create a local copy of shared Game Over UI');

const weaponSegmentCount = (star.match(/damageCoeff\s*:/g) || []).length;
must(weaponSegmentCount === 20, `Star Swarm weapon progression must have exactly 20 damageCoeff segments; found ${weaponSegmentCount}`);
must(star.includes('player.weapon=Math.max(0,player.weapon-2)') || /player\.weapon\s*=\s*Math\.max\(0,\s*player\.weapon\s*-\s*2\)/.test(star), 'Life loss must downgrade weapon by two segments');
must(star.includes('player.power=Math.max(1,player.power-2)') || /player\.power\s*=\s*Math\.max\(1,\s*player\.power\s*-\s*2\)/.test(star), 'Life loss must downgrade POWER by two levels');
must(star.includes('drops.power<2'), 'POWER drops must be capped at two per level');
must(star.includes('drops.shield<1'), 'Shield drops must be capped at one per level');
must(star.includes('level%2===0') && star.includes('drops.tractor<1'), 'Tractor Beam must be limited to one eligible drop every two levels');
must(star.includes("e.type===2?.0043:.00245"), 'Weapon Upgrade rarity must remain at the reduced 0.43% / 0.245% baseline');
must(!star.includes("e.type===2?.0086:.0049"), 'Weapon Upgrade regression: old higher drop rate reintroduced');
must(!/b\.kind===['"]laser['"][^\n]{0,160}pierce--/.test(star), 'Laser regression: laser must not be consumed by pierce decrement');
must(star.includes("if(b.kind==='laser')continue;"), 'Laser must continue through normal enemies after a hit');

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
must(gameOver.includes('ensureSession'), 'Shared Game Over must be able to recover a session when terminal lifecycle arrives late');
must(gameOver.includes('open: openSummary'), 'RWGGameOver.open must use the race-safe openSummary contract');

const hud = read('game-hud.js');
must(hud.includes('rwg-profile.js'), 'game-hud.js must bootstrap rwg-profile.js');
must(hud.includes('game-over.js'), 'game-hud.js must bootstrap game-over.js');

const profile = read('rwg-profile.js');
must(profile.includes('RWGContinueProvider'), 'rwg-profile.js must expose RWGContinueProvider');
must(profile.includes('INITIAL_CREDITS = 10'), 'Profile initial credits contract changed unexpectedly');

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
console.log(`  ✓ ${gamePages.length} game pages use shared platform contracts`);
console.log('  ✓ Star Swarm uses its authoritative engine and shared Game Over');
console.log('  ✓ Star Swarm weapon/power/drop invariants are present');
console.log('  ✓ shared credit/profile/game-over markers are intact');
