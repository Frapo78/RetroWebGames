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
must(html.includes('la struttura scende verso la linea di pericolo'), 'Bubble Burst intro must explain timed descending-board pressure');
must(html.includes('id="levelTimer"'), 'Bubble Burst must expose a dedicated level timer below the upper HUD');
for (const id of ['levelClear', 'clearPoints', 'clearTime', 'clearBonus', 'clearTotal']) {
  must(html.includes(`id="${id}"`), `Bubble Burst level-clear UI missing #${id}`);
}
must(html.includes('LIVELLO COMPLETATO!') && html.includes('TOCCA PER CONTINUARE'), 'Bubble Burst must retain the arcade intermediate level-clear presentation');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(read('games/bubble-burst/levels.js'), sandbox, { filename: 'bubble-burst/levels.js' });
const levels = sandbox.window.BubbleBurstLevels;
must(levels?.TOTAL_CONFIGS === 200, `Bubble Burst must expose exactly 200 base configurations; found ${levels?.TOTAL_CONFIGS}`);
if (levels?.getLevel) {
  const configs = Array.from({ length: 200 }, (_, index) => levels.getLevel(index + 1, 11));
  must(new Set(configs.map(config => config.signature)).size === 200, 'Bubble Burst first 200 layout signatures must be unique');
  must(configs.every(config => config.cells.length > 0), 'Bubble Burst base layouts must never be empty');
  must(configs.every(config => Number.isFinite(config.optimalSeconds) && config.optimalSeconds >= 30), 'Bubble Burst every layout must expose a sane deterministic optimalSeconds');
  must(new Set(configs.map(config => config.optimalSeconds)).size > 10, 'Bubble Burst optimal time should vary materially with layout complexity');
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

const pressureStart = Number(game.match(/PRESSURE_START_SECONDS\s*=\s*([0-9.]+)/)?.[1]);
const pressureMin = Number(game.match(/PRESSURE_MIN_SECONDS\s*=\s*([0-9.]+)/)?.[1]);
const pressureDecay = Number(game.match(/PRESSURE_DECAY\s*=\s*([0-9.]+)/)?.[1]);
const pressureStartRows = Number(game.match(/PRESSURE_START_ROWS\s*=\s*([0-9.]+)/)?.[1]);
const pressureMaxRows = Number(game.match(/PRESSURE_MAX_ROWS\s*=\s*([0-9.]+)/)?.[1]);
must(Number.isFinite(pressureStart) && pressureStart >= 60, `Bubble Burst level-1 pressure must not begin before 60 seconds; found ${pressureStart}`);
must(Number.isFinite(pressureMin) && pressureMin >= 12 && pressureMin < pressureStart, `Bubble Burst pressure floor must remain progressive and playable; found ${pressureMin}`);
must(Number.isFinite(pressureDecay) && pressureDecay > 0 && pressureDecay < 1, `Bubble Burst pressure interval must decrease progressively by level; found decay ${pressureDecay}`);
must(Number.isFinite(pressureStartRows) && pressureStartRows > 0 && pressureStartRows <= .6, `Bubble Burst initial pressure step should stay around half a row; found ${pressureStartRows}`);
must(Number.isFinite(pressureMaxRows) && pressureMaxRows >= pressureStartRows && pressureMaxRows <= 1, `Bubble Burst max pressure step must stay at or below one row; found ${pressureMaxRows}`);
must(game.includes('y: ceilingY() + R + r * ROW_H'), 'Bubble Burst cell geometry must include the descending ceiling offset');
must(game.includes('function updatePressure(dt)'), 'Bubble Burst timed ceiling pressure update missing');
must(game.includes('if (pressureDue && !moving) applyPressureDrop();'), 'Bubble Burst pressure drop must wait for an in-flight projectile to resolve');
must(game.includes('if (!running || paused || levelClearActive) return;') && game.includes('updatePressure(dt);'), 'Bubble Burst pressure/timer clocks must only advance during active unpaused gameplay');
must(game.includes("banner = '↓ STRUTTURA IN DISCESA!'"), 'Bubble Burst pressure drop must provide arcade feedback');
must(game.includes('remaining > 6 && pressurePulse <= 0'), 'Bubble Burst should warn during the final six seconds before descent');
must(game.includes('pressureElapsed = 0; pressureDue = false; pressurePulse = 0;'), 'Bubble Burst credit Continue must reset the pressure countdown without resetting score/level');

const orangeMultiplier = Number(game.match(/ORANGE_DEADLINE_MULTIPLIER\s*=\s*([0-9.]+)/)?.[1]);
const fastBonus = Number(game.match(/LEVEL_BONUS_FAST\s*=\s*([0-9.]+)/)?.[1]);
const goodBonus = Number(game.match(/LEVEL_BONUS_GOOD\s*=\s*([0-9.]+)/)?.[1]);
must(orangeMultiplier === 3.5, `Bubble Burst orange deadline must be T + 2.5T = 3.5T; found ${orangeMultiplier}`);
must(fastBonus === .5, `Bubble Burst green clear bonus must remain +50%; found ${fastBonus}`);
must(goodBonus === .25, `Bubble Burst orange clear bonus must remain +25%; found ${goodBonus}`);
must(game.includes('Math.floor(seconds * 100)'), 'Bubble Burst level timer must render centisecond precision');
must(game.includes("return 'green'") && game.includes("return 'orange'") && game.includes("return 'red'"), 'Bubble Burst timer must retain green/orange/red timing tiers');
must(game.includes('levelElapsed += dt;') && game.includes('updateLevelTimer();'), 'Bubble Burst timer must advance from active gameplay time');
must(game.includes('levelStartScore = score'), 'Bubble Burst must track per-level score independently from run total');
must(game.includes('function completeLevel()'), 'Bubble Burst must retain an intermediate level-complete calculation phase');
must(game.includes('Math.round(levelPoints * bonusRate)'), 'Bubble Burst completion bonus must be calculated from points generated in the level');
must(game.includes('levelClearReadyAt = performance.now() + 2200'), 'Bubble Burst level-clear animation must remain readable before tap-to-continue');
must(game.includes('startNextLevel()'), 'Bubble Burst level-clear tap must advance to the next level without terminal Game Over');

const css = read('games/bubble-burst/style.css');
must(css.includes('#levelTimer.is-green') && css.includes('#levelTimer.is-orange') && css.includes('#levelTimer.is-red'), 'Bubble Burst timer color tiers missing from CSS');
must(css.includes('@keyframes bubbleClearPanel') && css.includes('@keyframes bubbleClearTotal'), 'Bubble Burst arcade clear animations missing');

if (failures.length) {
  console.error(`\nBubble Burst validation FAILED (${failures.length})\n`);
  failures.forEach(failure => console.error(`  ✗ ${failure}`));
  console.error('');
  process.exit(1);
}

console.log('Bubble Burst validation OK');
console.log('  ✓ 200 unique deterministic artistic configurations');
console.log('  ✓ every layout exposes a complexity-derived optimal clear time');
console.log('  ✓ green/orange/red centisecond timer tiers and +50%/+25% bonuses');
console.log('  ✓ arcade intermediate level-clear calculation presentation');
console.log('  ✓ progressive Armor / Star / Prism structure bubbles');
console.log('  ✓ rare Bomb / Color Wipe launched specials');
console.log('  ✓ progressive timed ceiling pressure starts after >=60s at level 1');
console.log('  ✓ pressure pauses with gameplay and intensifies by interval/step');
console.log('  ✓ cached rendering + nearby-cell collision performance guards');
console.log('  ✓ shared Game Over / Continue lifecycle markers');
