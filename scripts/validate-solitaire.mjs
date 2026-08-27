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

for (const rel of ['games/solitaire/variants.js', 'games/solitaire/game.js']) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, rel)], { encoding: 'utf8' });
  must(result.status === 0, `${rel}: node --check failed: ${(result.stderr || result.stdout || '').trim()}`);
}

const html = read('games/solitaire/index.html');
must(html.includes('data-rwg-game="true"'), 'Solitaire page must use shared RWG game contract');
must(html.indexOf('variants.js') < html.indexOf('game.js'), 'Solitaire variants.js must load before game.js');
must(html.indexOf('game.js') < html.indexOf('../../game-hud.js'), 'Solitaire engine must load before shared HUD');
must(html.includes('id="pauseBtn"'), 'Solitaire must expose pauseBtn for shared orientation lifecycle');
must(html.includes('CLASSICO • KLONDIKE'), 'Solitaire intro must expose the classic Klondike variant');
must(html.includes('class="primary-btn rwg-intro-secondary" href="/">TORNA AL MENU'), 'Solitaire intro must retain shared return-to-menu action');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(read('games/solitaire/variants.js'), sandbox, { filename: 'solitaire/variants.js' });
const registry = sandbox.window.RWGSolitaireVariants;
const classic = registry?.get?.('klondike');
must(classic?.deckCount === 1, 'Klondike must use one standard deck');
must(classic?.drawCount === 1, 'Current classic Klondike variant must draw one card');
must(classic?.tableauColumns === 7, 'Klondike must use seven tableau columns');
must(classic?.foundationCount === 4, 'Klondike must use four foundations');
must(classic?.tableauBuild === 'alternating-descending', 'Klondike tableau must build descending with alternating colors');
must(classic?.emptyTableau === 'king-only', 'Only Kings may enter empty Klondike tableau columns');
must(classic?.foundationBuild === 'same-suit-ascending', 'Klondike foundations must build same-suit ascending');
must(Array.isArray(registry?.FUTURE) && registry.FUTURE.length >= 3, 'Solitaire variant registry must remain extensible for future variants');

const game = read('games/solitaire/game.js');
for (const marker of ['createDeck()', 'canMoveToTableau', 'canMoveToFoundation', 'drawStock', 'autoFoundation', 'pushHistory', 'undo()', 'findHint()', 'pointerdown', 'visibilitychange', 'checkWin()']) {
  must(game.includes(marker), `Solitaire runtime missing required marker: ${marker}`);
}
must(game.includes("return first.rank === 13"), 'Klondike empty-tableau rule must remain King-only');
must(game.includes("top.rank === first.rank + 1") && game.includes("cardColor(top) !== cardColor(first)"), 'Klondike tableau rule must remain descending alternating colors');
must(game.includes("card.rank === foundations[suit].length + 1"), 'Klondike foundation rule must remain Ace-to-King ascending by suit');
must(game.includes("stock = waste.reverse()"), 'Classic draw-one stock must remain recyclable');
must(game.includes('SUITS.reduce((sum, suit) => sum + foundations[suit].length, 0) !== 52'), 'Solitaire victory must require all 52 cards in foundations');
must(!game.includes('rwg:game-ended'), 'Solitaire victory must not incorrectly open the shared GAME OVER presentation');

if (failures.length) {
  console.error(`\nSolitaire validation FAILED (${failures.length})\n`);
  failures.forEach(failure => console.error(`  ✗ ${failure}`));
  process.exit(1);
}
console.log('Solitaire validation OK');
console.log('  ✓ extensible variant registry');
console.log('  ✓ classic Klondike draw-one rules');
console.log('  ✓ 52-card victory condition');
console.log('  ✓ touch drag/tap, undo, hint and pause lifecycle markers');
