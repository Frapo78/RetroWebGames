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
const matches = (source, regex, message) => must(regex.test(source), message);

for (const rel of ['games/bubble-burst/levels.js','games/bubble-burst/game.js']) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, rel)], { encoding: 'utf8' });
  must(result.status === 0, `${rel}: node --check failed: ${(result.stderr || result.stdout || '').trim()}`);
}

const html = read('games/bubble-burst/index.html');
must(html.includes('<script src="levels.js"></script>'), 'Bubble Burst must load levels.js');
must(/<script src="game\.js(?:\?v=[^"]+)?"><\/script>/.test(html), 'Bubble Burst must load its optionally cache-versioned game.js');
must(html.indexOf('levels.js') < html.indexOf('game.js'), 'levels.js must load before game.js');
must(html.indexOf('game.js') < html.indexOf('../../game-hud.js'), 'game.js must load before shared HUD');
must(html.includes('class="rwg-intro-leaderboard-slot"') && !html.includes('la struttura scende verso la linea di pericolo'), 'Intro caption must be replaced by the shared High Scores slot');
must(html.includes('id="levelTimer"'), 'Dedicated level timer missing');
for (const asset of ['assets/sprites/bubble-burst/operator-sheet.png','assets/sprites/bubble-burst/loader-sheet.png']) {
  const png = fs.readFileSync(path.join(root, asset));
  must(png.length > 100_000 && png.toString('ascii', 1, 4) === 'PNG', `Crew sprite invalid or unexpectedly tiny: ${asset}`);
  must(png.readUInt32BE(16) === 1024 && png.readUInt32BE(20) === 512, `Crew sprite sheet must remain 1024x512: ${asset}`);
  must(html.includes(`../../${asset}?v=20260831.5`), `Crew sprite must be preloaded with release version: ${asset}`);
}
for (const id of ['levelClear','levelClearTitle','clearPoints','clearTime','clearBonus','clearTotal']) must(html.includes(`id="${id}"`), `Level-clear UI missing #${id}`);
must(html.includes('LIVELLO 1 COMPLETATO!') && html.includes('TOCCA PER CONTINUARE'), 'Intermediate arcade level-clear presentation missing');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(read('games/bubble-burst/levels.js'), sandbox, { filename: 'bubble-burst/levels.js' });
const levels = sandbox.window.BubbleBurstLevels;
must(levels?.TOTAL_CONFIGS === 200, `Expected 200 base configurations; found ${levels?.TOTAL_CONFIGS}`);
if (levels?.getLevel) {
  const configs = Array.from({ length: 200 }, (_, index) => levels.getLevel(index + 1, 11));
  must(new Set(configs.map(config => config.signature)).size === 200, 'First 200 layout signatures must be unique');
  must(configs.every(config => config.cells.length > 0), 'Base layouts must never be empty');
  must(configs.every(config => Number.isFinite(config.optimalSeconds) && config.optimalSeconds >= 30), 'Every layout needs sane deterministic optimalSeconds');
  must(new Set(configs.map(config => config.optimalSeconds)).size > 10, 'Optimal time must vary materially by layout');
  must(configs[7].cells.some(cell => cell.special === 'armor'), 'Armor Bubble must be available from level 8');
  must(configs.slice(17).some(config => config.cells.some(cell => cell.special === 'star')), 'Star Bubble must appear from level 18 onward');
  must(configs.slice(34).some(config => config.cells.some(cell => cell.special === 'prism')), 'Prism Bubble must appear from level 35 onward');
}

const game = read('games/bubble-burst/game.js');
for (const marker of ['SHOT_BOMB','SHOT_COLOR_CLEAR','STATIC_ARMOR','STATIC_STAR','STATIC_PRISM','rwg:game-ended','rwg:continue-game','RWGResumeAdapter','RESUME_SCHEMA']) must(game.includes(marker), `Runtime missing required marker: ${marker}`);

matches(game, /Math\.min\(\s*\.03\s*,\s*\.012/, 'Bomb probability must remain capped around 3%');
matches(game, /Math\.min\(\s*\.02\s*,\s*\.007/, 'Color Wipe probability must remain capped around 2%');
matches(game, /function\s+nearbyBubbles\s*\(/, 'Nearby-cell collision lookup missing');
matches(game, /for\s*\(const\s+b\s+of\s+nearbyBubbles\s*\(/, 'Collision/special resolution must use nearby-cell lookup');
matches(game, /speed\s*=\s*baseSpeed\s*\*\s*3\b/, 'Launched bubbles must move at exactly 3x baseline speed');
matches(game, /Math\.ceil\(\s*distance\s*\/\s*Math\.max\(\s*4\s*,\s*R\s*\*\s*\.75\s*\)\s*\)/, '3x movement must retain sub-step anti-tunneling checks');
matches(game, /function\s+drawMovingBubble\s*\(/, 'Moving-bubble renderer missing');
matches(game, /globalCompositeOperation\s*=\s*['"]lighter['"]/, 'Projectile trail must retain additive rendering');
matches(game, /const\s+bubbleSprites\s*=\s*new\s+Map\s*\(/, 'Bubble sprite cache missing');
matches(game, /const\s+CREW_POSES\s*=\s*Object\.freeze\s*\(/, 'Raster crew pose atlas missing');
matches(game, /const\s+crewSheets\s*=\s*Object\.create\s*\(/, 'Decoded raster crew sheet cache missing');
matches(game, /new\s+Image\s*\(\s*\)/, 'Crew sprite preload missing');
must(!game.includes('makeMangaChibiSprite') && !game.includes('mangaChibiSprites'), 'Procedural crew renderer must not return');
matches(game, /function\s+drawMangaChibiCrew\s*\(/, 'Manga crew renderer missing');
matches(game, /function\s+drawTrackedEyes\s*\(/, 'Dynamic eye tracking missing');
for (const mood of ["'joy'", "'fear'", "'sad'"]) must(game.includes(`setCrewMood(${mood}`), `Crew reaction missing: ${mood}`);
matches(game, /Math\.sin\(now\s*\*\s*\.0035/, 'Continuous breathing animation missing');
matches(game, /crewSheetsReady\s*===\s*2/, 'Renderer must avoid drawing undecoded crew sheets');
matches(game, /image\.decode\(\)\.then/, 'Crew atlases must be decoded before first raster draw');
matches(game, /function\s+predictAimTrajectory\s*\(/, 'Aim trajectory predictor missing');
matches(game, /function\s+predictAimFocusPoint\s*\(/, 'Aim focus predictor missing');
must(game.includes('traceAim(aimPrediction)') && game.includes('predictAimFocusPoint(aimPrediction)'), 'Aim preview and crew gaze must share one prediction');
must(!game.includes('makeChibiSprite(') && !/imageSmoothingEnabled\s*=\s*false/.test(game), 'Removed pixel-art chibi renderer must not return');
matches(game, /backgroundCache\s*=\s*buildBackgroundCache\s*\(\s*\)/, 'Static background must be cached');
must(!game.includes('queue.shift()'), 'Graph traversal must not regress to Array.shift() queues');

const pressureStart = Number(game.match(/PRESSURE_START_SECONDS\s*=\s*([0-9.]+)/)?.[1]);
const pressureMin = Number(game.match(/PRESSURE_MIN_SECONDS\s*=\s*([0-9.]+)/)?.[1]);
const pressureDecay = Number(game.match(/PRESSURE_DECAY\s*=\s*([0-9.]+)/)?.[1]);
const pressureStartRows = Number(game.match(/PRESSURE_START_ROWS\s*=\s*([0-9.]+)/)?.[1]);
const pressureMaxRows = Number(game.match(/PRESSURE_MAX_ROWS\s*=\s*([0-9.]+)/)?.[1]);
must(Number.isFinite(pressureStart) && pressureStart >= 60, `Level-1 pressure must not begin before 60s; found ${pressureStart}`);
must(Number.isFinite(pressureMin) && pressureMin >= 12 && pressureMin < pressureStart, `Pressure floor must remain progressive/playable; found ${pressureMin}`);
must(Number.isFinite(pressureDecay) && pressureDecay > 0 && pressureDecay < 1, `Pressure interval must decrease progressively; found ${pressureDecay}`);
must(Number.isFinite(pressureStartRows) && pressureStartRows > 0 && pressureStartRows <= .6, `Initial pressure step should stay near half-row; found ${pressureStartRows}`);
must(Number.isFinite(pressureMaxRows) && pressureMaxRows >= pressureStartRows && pressureMaxRows <= 1, `Pressure step cap must be <= one row; found ${pressureMaxRows}`);
matches(game, /y\s*:\s*ceilingY\(\)\s*\+\s*R\s*\+\s*r\s*\*\s*ROW_H/, 'Cell geometry must include descending ceiling offset');
matches(game, /function\s+updatePressure\s*\(\s*dt\s*\)/, 'Timed ceiling-pressure update missing');
matches(game, /if\s*\(\s*pressureDue\s*&&\s*!moving\s*\)\s*applyPressureDrop\s*\(\s*\)/, 'Pressure drop must wait for in-flight projectile');
matches(game, /banner\s*=\s*['"]↓ STRUTTURA IN DISCESA!['"]/, 'Pressure drop arcade feedback missing');
matches(game, /remaining\s*>\s*6\s*&&\s*pressurePulse\s*<=\s*0/, 'Final six-second pressure warning missing');
matches(game, /pressureElapsed\s*=\s*0\s*;\s*pressureDue\s*=\s*false\s*;\s*pressurePulse\s*=\s*0/, 'Credit Continue must reset only next pressure countdown');

const orangeMultiplier = Number(game.match(/ORANGE_DEADLINE_MULTIPLIER\s*=\s*([0-9.]+)/)?.[1]);
const fastBonus = Number(game.match(/LEVEL_BONUS_FAST\s*=\s*([0-9.]+)/)?.[1]);
const goodBonus = Number(game.match(/LEVEL_BONUS_GOOD\s*=\s*([0-9.]+)/)?.[1]);
must(orangeMultiplier === 3.5, `Orange deadline must be 3.5T; found ${orangeMultiplier}`);
must(fastBonus === .5, `Green clear bonus must be +50%; found ${fastBonus}`);
must(goodBonus === .25, `Orange clear bonus must be +25%; found ${goodBonus}`);
matches(game, /Math\.floor\(\s*seconds\s*\*\s*100\s*\)/, 'Timer must render centisecond precision');
must(game.includes("return 'green'") && game.includes("return 'orange'") && game.includes("return 'red'"), 'Timer must retain green/orange/red tiers');
matches(game, /levelElapsed\s*\+=\s*dt/, 'Gameplay timer must advance from active time');
matches(game, /levelStartScore\s*=\s*score/, 'Per-level score baseline missing');
matches(game, /function\s+completeLevel\s*\(/, 'Intermediate level-complete calculation phase missing');
matches(game, /levelClearTitleEl\.textContent\s*=\s*`LIVELLO \$\{level\} COMPLETATO!`/, 'Level-clear title must identify completed level');
matches(game, /Math\.round\(\s*levelPoints\s*\*\s*bonusRate\s*\)/, "Completion bonus must use level points");
const celebrationMs = Number(game.match(/LEVEL_CLEAR_CELEBRATION_MS\s*=\s*([0-9.]+)/)?.[1]);
must(celebrationMs === 2000, "Level-clear celebration must last 2000ms before summary; found " + celebrationMs);
matches(game, /function\s+drawLevelClearCelebration\s*\(/, "Dedicated Canvas level-clear celebration missing");
matches(game, /function\s+drawStarEye\s*\(/, "Operator star-eye celebration overlay missing");
matches(game, /function\s+drawHeartEye\s*\(/, "Loader heart-eye celebration overlay missing");
const jumpBlock = game.match(/const\s+LEVEL_CLEAR_JUMP_FRAMES[\s\S]*?const\s+CREW_EYES/)?.[0] || "";
must((jumpBlock.match(/Object\.freeze\(\[/g) || []).length >= 14, "Both characters require seven manga jump keyframes");
must(game.includes("showLevelClearPanel()") && game.includes("levelClearPanelShown"), "Summary must remain hidden until celebration completes");
matches(game, /levelClearReadyAt\s*=\s*levelClearCelebrationStartedAt\s*\+\s*LEVEL_CLEAR_CELEBRATION_MS\s*\+\s*2200/, "Level-clear summary must remain readable after the two-second celebration");
matches(game, /function\s+startNextLevel\s*\(/, 'Level-clear tap path missing');
matches(game, /function\s+registerPoppingShot\s*\(/, 'Consecutive-pop reward function missing');
matches(game, /if\s*\(\s*!popped\s*\)\s*\{\s*poppingShotStreak\s*=\s*0\s*;\s*return\s*;\s*\}/, 'Non-popping shot must reset streak');
matches(game, /if\s*\(\s*poppingShotStreak\s*<\s*5\s*\)\s*return/, 'Bomb reward must require five consecutive popping shots');
matches(game, /banner\s*=\s*['"]COMBO ×5 • BOMBA PRONTA!['"]/, 'Five-shot Bomb reward feedback missing');
matches(game, /function\s+applyPendingBombReward\s*\(/, 'Deferred Bomb reward logic missing');

// Resume contract: logical board state + deterministic layout signature + shared v2 service.
matches(game, /id\s*:\s*['"]bubble-burst['"]/, 'Bubble Burst resume adapter id missing');
matches(game, /version\s*:\s*1/, 'Bubble Burst adapter version missing');
matches(game, /compatibility\s*:\s*['"]bubble-burst-state-v1-layouts200-pressure2-specials1['"]/, 'Bubble Burst compatibility token changed unexpectedly');
matches(game, /layoutSignature\s*:\s*boardMeta\?\.signature/, 'Snapshot must persist deterministic layout signature');
matches(game, /s\.layoutSignature\s*!==\s*meta\.signature/, 'Restore validation must reject changed level layouts');
matches(game, /serializeResumeState\s*\(/, 'Resume serializer missing');
matches(game, /validateResumeState\s*\(/, 'Resume validator missing');
matches(game, /restoreResumeState\s*\(/, 'Resume restore path missing');
matches(game, /markSessionDirty\(['"]shot-resolved['"]\)/, 'Resolved shots must mark state dirty');
matches(game, /saveNow\?\.\(['"]level-clear['"]\)/, 'Level clear must checkpoint resumable state');

const css = read('games/bubble-burst/style.css');
must(css.includes('#levelTimer.is-green') && css.includes('#levelTimer.is-orange') && css.includes('#levelTimer.is-red'), 'Timer color tiers missing from CSS');
must(css.includes('@keyframes bubbleClearPanel') && css.includes('@keyframes bubbleClearTotal'), 'Arcade clear animations missing');

if (failures.length) {
  console.error(`\nBubble Burst validation FAILED (${failures.length})\n`);
  failures.forEach(failure => console.error(`  ✗ ${failure}`));
  console.error('');
  process.exit(1);
}

console.log('Bubble Burst validation OK');
console.log('  ✓ 200 deterministic configurations + timing/bonus/pressure contracts');
console.log('  ✓ special bubbles, rare shots and cached rendering guards');
console.log('  ✓ semantic checks are formatting-independent');
console.log('  ✓ deterministic layout-aware resumable session adapter');
