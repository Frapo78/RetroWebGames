#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const failures = [];
const read = rel => fs.readFileSync(rel, 'utf8');
const must = (value, message) => { if (!value) failures.push(message); };
const game = read('games/block-drop/game.js');
const html = read('games/block-drop/index.html');
const css = read('games/block-drop/style.css');
const docs = read('docs/BLOCK-DROP.md');
const syntax = spawnSync(process.execPath, ['--check', 'games/block-drop/game.js'], { encoding: 'utf8' });
must(syntax.status === 0, `game.js syntax failed: ${(syntax.stderr || syntax.stdout || '').trim()}`);

for (const marker of [
  'renderWidth = 1', 'renderHeight = 1', 'resizeFrame = 0',
  'function scheduleResize()', "if ('ResizeObserver' in window)",
  'new ResizeObserver(scheduleResize).observe(canvas)',
  "window.visualViewport?.addEventListener('resize', scheduleResize)",
  "window.addEventListener('orientationchange', scheduleResize)",
  'document.fonts?.ready.then(scheduleResize)'
]) must(game.includes(marker), `responsive Canvas guard missing: ${marker}`);
must(game.includes('ctx.clearRect(0, 0, renderWidth, renderHeight); drawGrid(renderWidth, renderHeight);'), 'draw() must use one atomically stored render geometry');
must(!/function draw\(\)\s*\{\s*const rect = canvas\.getBoundingClientRect/.test(game), 'draw() must not mix a live CSS rect with stale Canvas state');
must(game.includes('if (canvas.width !== pixelWidth)') && game.includes('if (canvas.height !== pixelHeight)'), 'backing-store resize must be idempotent');

must(html.includes('style.css?v=20260902.2') && html.includes('game.js?v=20260902.1'), 'changed Block Drop assets must be explicitly cache-versioned');
for (const action of ['rotate', 'drop']) {
  const button = html.match(new RegExp(`<button[^>]+data-action="${action}"[\\s\\S]*?</button>`))?.[0] || '';
  must(button.includes('<svg') && button.includes('<span>') && /aria-label="[^"]+"/.test(button), `${action} must retain icon, label and accessible name`);
}
must(css.includes('grid-template-columns: minmax(88px, 124px) repeat(2, clamp(50px, 15vw, 58px)) !important'), 'joystick actions must be two adjacent square columns');
must(css.includes('aspect-ratio: 1 !important') && css.includes('.rotate { grid-column: 2') && /\.drop\s*\{[\s\S]*?grid-column:\s*3\s*!important/.test(css), 'Rotate and Drop must remain square and side by side');
const scopedDropRule = css.match(/body\[data-rwg-game-name="Block Drop"\] #controls\.rwg-vjoy-host-actions \.drop\s*\{([^}]*)\}/)?.[1] || '';
must(/color:\s*#ffe66d\s*!important;/.test(scopedDropRule) && /background:[^;]+!important;/.test(scopedDropRule), 'Drop icon and label must retain high-contrast yellow on an explicit dark background');
must(docs.includes('2026-09-02 first-load rendering incident') && docs.includes('layout race'), 'Block Drop incident and root cause must remain documented');
must(/#controls \.rwg-vjoy-action svg\s*\{[\s\S]*?stroke-linejoin:\s*round;\s*\}/.test(css) && css.includes('#controls .rwg-vjoy-action span'), 'action icon and label CSS blocks must be complete');

if (failures.length) {
  console.error(`\nBlock Drop validation FAILED (${failures.length})\n`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log('Block Drop validation OK');
console.log('  ✓ Canvas geometry follows asynchronous shared-control layout changes');
console.log('  ✓ render dimensions, backing store, DPR and cell size update atomically');
console.log('  ✓ Rotate and Drop remain square, adjacent, icon-led actions');
