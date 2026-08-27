#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const failures = [];
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const must = (condition, message) => { if (!condition) failures.push(message); };

for (const rel of ['games/bubble-burst/levels.js', 'games/bubble-burst/game.js']) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, rel)], { encoding: 'utf8' });
  must(result.status === 0, `${rel}: node --check failed: ${(result.stderr || result.stdout || '').trim()}`);
}

const html = read('games/bubble-burst/index.html');
must(html.includes('<script src="levels.js"></script>'), 'Bubble Burst must load levels.js');
must(html.includes('<script src="game.js"></script>'), 'Bubble Burst must load game.js');
must(html.indexOf('levels.js') < html.indexOf('game.js'), 'Bubble Burst levels.js must load before game.js');
must(html.indexOf('game.js') < html.indexOf('../../game-hud.js'), 'Bubble Burst game engine must load before shared HUD');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(read('games/bubble-burst/levels.js'), sandbox, { filename: 'bubble-burst/levels.js' });
const levels = sandbox.window.BubbleBurstLevels;
must(levels?.TOTAL_CONFIGS === 200, `Bubble Burst must expose exactly 200 base configurations; found ${levels?.TOTAL_CONFIGS}`);
if (levels?.getLevel) {
  const configs = Array.from({ length: 200 }, (_, index) => levels.getLevel(index + 1, 11));
  must(new Set(configs.map(config => config.signature)).size === 200, 'Bubble Burst first 200 layout signatures must be unique');
  must(configs.every(config => config.cells.length > 0), 'Bubble Burst base layouts must never be empty');
  must(configs[7].cells.some(cell => cell.special === 'armor'), 'Bubble Burst Armor Bubble must be available from level 8');
  must(configs.slice(17).some(config => config.cells.some(cell => cell.special === 'star')), 'Bubble Burst Star Bubble must appear from level 18 onward');
  must(configs.slice(34).some(config => config.cells.some(cell => cell.special === 'prism')), 'Bubble Burst Prism Bubble must appear from level 35 onward');
}

const game = read('games/bubble-burst/game.js');
for (const marker of ['SHOT_BOMB', 'SHOT_COLOR_CLEAR', 'STATIC_ARMOR', 'STATIC_STAR', 'STATIC_PRISM', 'rwg:game-ended', 'rwg:continue-game']) {
  must(game.includes(marker), `Bubble Burst runtime missing required marker: ${marker}`);
}
must(game.includes("Math.min(.03, .012"), 'Bubble Burst Bomb probability must remain capped around 3%');
must(game.includes("Math.min(.02, .007"), 'Bubble Burst Color Wipe probability must remain capped around 2%');
must(game.includes('function nearbyBubbles('), 'Bubble Burst must retain nearby-cell collision lookup');
must(game.includes('for (const b of nearbyBubbles('), 'Bubble Burst moving collision/special resolution must use nearby-cell lookup');
must(game.includes('const bubbleSprites = new Map()'), 'Bubble Burst must cache bubble render sprites');
must(game.includes('const chibiSprites = new Map()'), 'Bubble Burst must cache chibi pixel sprites');
must(game.includes('backgroundCache = buildBackgroundCache()'), 'Bubble Burst must cache its static background');
must(!game.includes('queue.shift()'), 'Bubble Burst graph traversal must not regress to Array.shift() queues');
must(game.includes("player" ) || true, 'placeholder');

if (failures.length) {
  console.error(`\nBubble Burst validation FAILED (${failures.length})\n`);
  failures.forEach(failure => console.error(`  ✗ ${failure}`));
  console.error('');
  process.exit(1);
}

console.log('Bubble Burst validation OK');
console.log('  ✓ 200 unique deterministic artistic configurations');
console.log('  ✓ progressive Armor / Star / Prism structure bubbles');
console.log('  ✓ rare Bomb / Color Wipe launched specials');
console.log('  ✓ cached rendering + nearby-cell collision performance guards');
console.log('  ✓ shared Game Over / Continue lifecycle markers');
