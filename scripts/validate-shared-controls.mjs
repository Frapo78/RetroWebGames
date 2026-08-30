#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const failures = [];
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const must = (condition, message) => { if (!condition) failures.push(message); };

for (const rel of ['rwg-virtual-joystick.js','orientation.js','games/neon-tilt/game.js']) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, rel)], { encoding: 'utf8' });
  must(result.status === 0, `${rel}: node --check failed: ${(result.stderr || result.stdout || '').trim()}`);
}

const joystick = read('rwg-virtual-joystick.js');
const joystickCss = read('rwg-virtual-joystick.css');
const controlsCss = read('rwg-controls.css');
const orientation = read('orientation.js');
const docs = read('docs/SHARED-HUD-CONTROLS.md');
const tilt = read('games/neon-tilt/game.js');
const maze = read('games/maze-munch/index.html');
const snake = read('games/neon-snake/index.html');
const blocks = read('games/block-drop/index.html');

for (const marker of ['window.RWGVirtualJoystick','rwg:joystick-input','deadZone','setPointerCapture','lostpointercapture','allowed']) {
  must(joystick.includes(marker), `Shared joystick missing contract marker: ${marker}`);
}
must(joystick.includes("['left', 'right', 'down']"), 'Block Drop joystick must explicitly disallow Up movement');
must(joystick.includes('secondaryMagnitude < this.deadZone'), 'Unsupported primary joystick direction must remain neutral without a meaningful secondary axis');
must(joystick.includes("gameSlug === 'neon-tilt'"), 'Neon Tilt must auto-mount the shared analog joystick');
must(joystick.includes("document.querySelectorAll('#controls [data-dir]')"), 'Legacy four-way directional clusters must be adapted centrally');
must(joystick.includes("document.querySelectorAll('#controls [data-action]')"), 'Block Drop directional/action split must be adapted centrally');

must(joystickCss.includes('.rwg-vjoy-legacy-direction') && joystickCss.includes('clip-path: inset(50%)'), 'Legacy direction controls must be visually replaced, not duplicated');
must(joystickCss.includes('.rwg-vjoy-host > .dpad') && joystickCss.includes('display: none !important'), 'Legacy Neon Snake D-pad container must not consume layout space');
must(controlsCss.includes('body[data-rwg-game-name="Solitario"] #gameControls'), 'Solitario common command row adaptation missing');
must(controlsCss.includes('body[data-rwg-game-name="Block Drop"] #controls.rwg-vjoy-host'), 'Block Drop joystick/action spacing adaptation missing');
must(controlsCss.includes('body[data-rwg-game-name="Neon Snake"] #controls.rwg-vjoy-host'), 'Neon Snake joystick/Turbo adaptation missing');
must(controlsCss.includes('body[data-rwg-game-name="Neon Tilt"].rwg-vjoy-enabled #gameWrap'), 'Neon Tilt canvas must reserve space for the shared analog joystick');

for (const marker of ['rwg-controls.css','rwg-virtual-joystick.css','rwg-virtual-joystick.js']) {
  must(orientation.includes(marker), `Shared controls bootstrap missing from mandatory orientation layer: ${marker}`);
}
must(orientation.indexOf('rwg-virtual-joystick.js') < orientation.indexOf('const touchCapable'), 'Shared joystick bootstrap must run before handheld-only orientation early return');
must(tilt.includes("window.addEventListener('rwg:joystick-input'"), 'Neon Tilt must consume shared analog joystick vectors');
must(tilt.includes("d.gameSlug!=='neon-tilt'"), 'Neon Tilt must ignore joystick events belonging to other games');

must(maze.includes('data-dir="up"') && maze.includes('data-dir="left"') && maze.includes('data-dir="down"') && maze.includes('data-dir="right"'), 'Maze Munch legacy direction adapter targets changed unexpectedly');
must(snake.includes('class="dpad"') && snake.includes('id="boostBtn"'), 'Neon Snake must retain legacy handler targets plus separate Turbo action');
for (const action of ['left','right','down','rotate','drop']) must(blocks.includes(`data-action="${action}"`), `Block Drop adapter target missing: ${action}`);

must(docs.includes('Metrics HUD') && docs.includes('System controls') && docs.includes('Virtual joystick'), 'Shared HUD/control source of truth is incomplete');
must(docs.includes('Star Swarm, Bubble Burst, Neon Rally, Prism Breaker and Solitario'), 'Pointer-native games must remain explicitly outside automatic joystick mounting');

if (failures.length) {
  console.error(`\nShared controls validation FAILED (${failures.length})\n`);
  failures.forEach(failure => console.error(`  ✗ ${failure}`));
  console.error('');
  process.exit(1);
}

console.log('Shared controls validation OK');
console.log('  ✓ common HUD/system control styling is centralized');
console.log('  ✓ Maze Munch, Neon Snake and Block Drop replace visible direction clusters with the shared joystick');
console.log('  ✓ Neon Tilt consumes the shared full analog vector');
console.log('  ✓ pointer-native games are not forced into joystick controls');
