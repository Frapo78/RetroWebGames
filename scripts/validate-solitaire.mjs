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

for (const rel of ['rwg-session.js','games/solitaire/variants.js','games/solitaire/card-art.js','games/solitaire/input-guard.js','games/solitaire/auto-move.js','games/solitaire/game.js','games/solitaire/session-adapter.js']) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, rel)], { encoding: 'utf8' });
  must(result.status === 0, `${rel}: node --check failed: ${(result.stderr || result.stdout || '').trim()}`);
}

const html = read('games/solitaire/index.html');
must(html.includes('data-rwg-game="true"'), 'Solitaire page must use shared RWG game contract');
must(html.includes('minimum-scale=1') && html.includes('maximum-scale=1') && html.includes('user-scalable=no'), 'Solitaire viewport must explicitly disable browser scaling');
must(html.indexOf('variants.js') < html.indexOf('card-art.js') && html.indexOf('card-art.js') < html.indexOf('input-guard.js') && html.indexOf('input-guard.js') < html.indexOf('auto-move.js') && html.indexOf('auto-move.js') < html.indexOf('game.js'), 'Solitaire variants/card-art/input-guard/auto-move/game load order is invalid');
must(html.indexOf('game.js') < html.indexOf('session-adapter.js') && html.indexOf('session-adapter.js') < html.indexOf('../../game-hud.js'), 'Solitaire versioning adapter must load after game.js and before shared HUD');
must(!html.includes('../../rwg-session.js') && !html.includes('../../rwg-session.css'), 'Solitaire must rely on centralized game-hud session bootstrap, not page-local shared-service preload');
must(html.includes('id="pauseBtn"'), 'Solitaire must expose pauseBtn for shared lifecycle');
must(html.includes('CLASSICO • KLONDIKE'), 'Solitaire intro must expose Klondike');
must(html.includes('class="primary-btn rwg-intro-secondary" href="/">TORNA AL MENU'), 'Solitaire intro must retain return-to-menu action');
must(html.includes('id="cardStyleSelect"') && html.includes('value="classic"') && html.includes('value="essential"'), 'Solitaire must expose both card sets');
must(html.includes('value="essential" selected'), 'Essential card set must remain markup default');
must(html.includes('doppio tap per mossa automatica'), 'Solitaire intro must explain the expanded automatic double-tap gesture');

const boardStart = html.indexOf('<section id="board"');
const boardEnd = html.indexOf('</section>', boardStart);
const upperStart = html.indexOf('<div id="upperPiles"', boardStart);
const upperEnd = html.indexOf('</div>', upperStart);
const dockIndex = html.indexOf('id="drawPileDock"');
const stockIndex = html.indexOf('id="stock"');
const wasteIndex = html.indexOf('id="waste"');
must(boardStart >= 0 && boardEnd > boardStart && dockIndex > boardStart && dockIndex < boardEnd, 'Draw pile dock must remain inside #board so delegated card interaction still works');
must(upperStart >= 0 && upperEnd > upperStart && !(stockIndex > upperStart && stockIndex < upperEnd) && !(wasteIndex > upperStart && wasteIndex < upperEnd), 'Stock/waste must not return to the upper piles');
must(dockIndex >= 0 && stockIndex > dockIndex && wasteIndex > stockIndex, 'Bottom-right draw dock must order stock on the left and waste on the right');
must(/id="drawPileDock"[^>]*style="[^"]*position:fixed[^"]*right:/i.test(html), 'Draw pile dock must remain viewport-anchored at the lower-right edge');

const style = read('games/solitaire/style.css');
must(style.includes('touch-action:none!important') && style.includes('-ms-touch-action:none!important'), 'Solitaire CSS must keep touch zoom/pan disabled on the game surface');
must(style.includes('#drawPileDock') && style.includes('grid-template-columns:repeat(2,var(--draw-slot-w))'), 'Draw pile dock must remain a two-slot horizontal layout');
must(style.includes('bottom:calc(env(safe-area-inset-bottom) + 62px)'), 'Draw pile dock must remain immediately above the lower game controls');
must(style.includes('#drawPileDock #waste .playing-card'), 'Waste card must retain dock-local card sizing');

const inputGuard = read('games/solitaire/input-guard.js');
for (const marker of ['gesturestart','gesturechange','gestureend','dblclick','touchstart','touchmove','touchend','wheel','preventDefault','passive: false','document.documentElement.style.touchAction']) {
  must(inputGuard.includes(marker), `Solitaire no-zoom input guard missing: ${marker}`);
}
must(inputGuard.includes('event.touches?.length > 1'), 'Solitaire input guard must explicitly suppress multi-touch pinch gestures');
must(inputGuard.includes('closeInTime') && inputGuard.includes('closeInSpace'), 'Solitaire input guard must suppress same-area rapid double taps without blocking unrelated taps');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(read('games/solitaire/variants.js'), sandbox, { filename: 'solitaire/variants.js' });
const registry = sandbox.window.RWGSolitaireVariants;
const classic = registry?.get?.('klondike');
must(classic?.deckCount === 1, 'Klondike must use one standard deck');
must(classic?.drawCount === 1, 'Klondike must draw one card');
must(classic?.tableauColumns === 7, 'Klondike must use seven tableau columns');
must(classic?.foundationCount === 4, 'Klondike must use four foundations');
must(classic?.tableauBuild === 'alternating-descending', 'Klondike tableau rule changed');
must(classic?.emptyTableau === 'king-only', 'Only Kings may enter empty tableau columns');
must(classic?.foundationBuild === 'same-suit-ascending', 'Foundation rule changed');
must(Array.isArray(registry?.FUTURE) && registry.FUTURE.length >= 3, 'Variant registry must remain extensible');

const autoSandbox = { window: {} };
vm.createContext(autoSandbox);
vm.runInContext(read('games/solitaire/auto-move.js'), autoSandbox, { filename: 'solitaire/auto-move.js' });
const autoMove = autoSandbox.window.RWGSolitaireAutoMove;
must(typeof autoMove?.chooseNext === 'function', 'Solitaire auto-move resolver missing');
const redThree = { id: 'h3', suit: 'h', rank: 3 };
const firstChoice = autoMove?.chooseNext?.({ card: redThree, tableauColumns: 4, cursor: null, isLegal: target => target.type === 'tableau' && (target.col === 0 || target.col === 2) });
const secondChoice = autoMove?.chooseNext?.({ card: redThree, tableauColumns: 4, cursor: firstChoice?.cursor, isLegal: target => target.type === 'tableau' && (target.col === 0 || target.col === 2) });
const wrappedChoice = autoMove?.chooseNext?.({ card: redThree, tableauColumns: 4, cursor: secondChoice?.cursor, isLegal: target => target.type === 'tableau' && (target.col === 0 || target.col === 2) });
must(firstChoice?.target?.col === 0 && secondChoice?.target?.col === 2 && wrappedChoice?.target?.col === 0, 'Repeated double taps must cycle through multiple legal tableau destinations');
const foundationChoice = autoMove?.chooseNext?.({ card: redThree, tableauColumns: 4, cursor: null, isLegal: target => target.type === 'foundation' || target.col === 0 });
must(foundationChoice?.target?.type === 'foundation', 'Automatic move must retain foundation-first ordering when legal');
must(autoMove?.chooseNext?.({ card: redThree, tableauColumns: 4, cursor: null, isLegal: () => false }) === null, 'Automatic move must be a no-op when no legal destination exists');

const artSandbox = { window: {} };
vm.createContext(artSandbox);
vm.runInContext(read('games/solitaire/card-art.js'), artSandbox, { filename: 'solitaire/card-art.js' });
const art = artSandbox.window.RWGSolitaireCardArt;
must(typeof art?.getCardFaceSvg === 'function' && typeof art?.getCardBackSvg === 'function', 'Solitaire card-art API missing');
for (let rank = 1; rank <= 10; rank++) must(art?.getPipLayout?.(rank)?.length === rank, `Rank ${rank} must expose exactly ${rank} pips`);
for (const rank of [11,12,13]) {
  const court = art?.getCourtFaceSvg?.(rank, 's') || '';
  must(court.includes('court-portrait') && court.includes('translate(100 141) rotate(180)'), `Court ${rank} must remain mirrored`);
}
must(art?.getCardFaceSvg?.({ rank:1, suit:'s' }).includes('ace-of-spades'), 'Ace of Spades artwork missing');
must(art?.getCardBackSvg?.().includes('back-medallion'), 'Card back medallion missing');
const essentialRankLabels = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
for (let rank = 1; rank <= 13; rank++) {
  const essential = art?.getCardFaceSvg?.({ rank, suit: rank % 2 ? 'h' : 's' }, 'essential') || '';
  must(essential.includes('card-style-essential') && essential.includes('essential-rank'), `Essential rank ${rank} template missing`);
  must((essential.match(/essential-corner/g) || []).length === 1, `Essential rank ${rank} must expose only the upper-left suit`);
  must(!essential.includes('rotate(180 50 71)'), `Essential rank ${rank} must not retain the lower-right suit`);
  const cornerSize = essential.match(/class="essential-corner"[^>]*font-size="([^"]+)"/)?.[1];
  const topRank = essential.match(/class="essential-top-rank"[^>]*font-size="([^"]+)"[^>]*>([^<]+)<\/text>/);
  const hiddenRank = essential.match(/class="essential-rank"[^>]*y="([^"]+)"[^>]*font-size="([^"]+)"[^>]*>([^<]+)<\/text>/);
  must(topRank?.[2] === essentialRankLabels[rank - 1], `Essential rank ${rank} must expose its canonical upper-right label`);
  must(Boolean(cornerSize) && topRank?.[1] === cornerSize, `Essential rank ${rank} upper-right label must match the upper-left suit size`);
  must(hiddenRank?.[1] === '96' && hiddenRank?.[3] === essentialRankLabels[rank - 1], `Essential rank ${rank} must be centered in the stacked-card hidden region`);
  if (rank === 10) {
    must((essential.match(/textLength="38"/g) || []).length === 2 && (essential.match(/lengthAdjust="spacingAndGlyphs"/g) || []).length === 2, 'Both Essential 10 labels must use identical horizontal fitting');
    must(hiddenRank?.[2] === topRank?.[1], 'Both Essential 10 labels must use identical font sizing');
  }
  must(!essential.includes('court-portrait') && !essential.includes('ace-of-spades'), `Essential rank ${rank} must contain no classic drawing`);
}

const game = read('games/solitaire/game.js');
for (const marker of ['createDeck()','canMoveToTableau','canMoveToFoundation','drawStock','autoMoveCard','animateAutoMove','captureCardRects','pushHistory','undo()','findHint()','pointerdown','visibilitychange','checkWin()']) must(game.includes(marker), `Solitaire runtime missing: ${marker}`);
must(game.includes('return first.rank === 13'), 'Empty-tableau rule must remain King-only');
must(game.includes('top.rank === first.rank + 1') && game.includes('cardColor(top) !== cardColor(first)'), 'Tableau rule changed');
must(game.includes('card.rank === foundations[suit].length + 1'), 'Foundation rule changed');
must(game.includes('stock = waste.reverse()'), 'Draw-one stock recycling missing');
must(game.includes('SUITS.reduce((sum, suit) => sum + foundations[suit].length, 0) !== 52'), 'Victory must require all 52 cards');
must(!game.includes('rwg:game-ended'), 'Solitaire victory must not open terminal GAME OVER');
must(game.includes('CardArt.getCardFaceSvg(card, cardStyle)') && game.includes('CardArt.getCardBackSvg()'), 'Selected card art must drive runtime rendering');
must(game.includes("CARD_STYLE_KEY = 'rwg.solitaire.card-style.v1'"), 'Card style persistence key changed');
must(game.includes("localStorage.getItem(CARD_STYLE_KEY) === 'classic' ? 'classic' : 'essential'"), 'Essential card set must remain runtime default');
must(game.includes("board.addEventListener('pointerdown'"), 'Card pointer delegation must remain rooted at #board so the fixed draw dock stays interactive');
must(game.includes('AutoMove.chooseNext') && game.includes('preserveAutoCycle: true'), 'Double tap must resolve and preserve cyclic legal destinations through the shared move transaction');
must(game.includes('data-card-id=') && game.includes('AUTO_MOVE_DURATION_MS = 210'), 'Automatic moves must retain stable card identity and fast FLIP animation timing');
must(game.includes("matchMedia('(prefers-reduced-motion: reduce)').matches"), 'Automatic card movement must respect reduced-motion preference');

for (const marker of ['RESUME_SCHEMA = 1','serializeResumeState()','validateResumeState(state)','restoreResumeState(state)','window.RWGResumeAdapter',"id: 'solitaire'",'markSessionDirty','window.RWGSession?.clear?.()']) must(game.includes(marker), `Solitaire logical resume contract missing: ${marker}`);
must(game.includes('allCards.length !== 52') && game.includes('new Set(allCards.map(card => card.id)).size !== 52'), 'Resume validation must require exactly 52 unique cards');
must(game.includes('state.stock.some(card => card.faceUp)') && game.includes('state.waste.some(card => !card.faceUp)'), 'Resume validation must reject impossible stock/waste visibility');
must(game.includes('card.suit !== suit || card.rank !== i + 1'), 'Resume validation must verify foundations');
must(game.includes("markSessionDirty('move')") && game.includes("markSessionDirty('stock')") && game.includes("markSessionDirty('undo')"), 'Discrete card mutations must dirty-save');
must(game.includes("showToast('PARTITA PRECEDENTE RIPRESA')"), 'Restore path must visibly confirm successful resume');

const adapter = read('games/solitaire/session-adapter.js');
must(adapter.includes('window.RWGResumeAdapter'), 'Solitaire compatibility adapter missing');
must(/version\s*:\s*2/.test(adapter), 'Solitaire adapter must expose persistence version 2');
must(/compatibility\s*:\s*['"]solitaire-klondike-state-v2-52cards-draw1['"]/.test(adapter), 'Solitaire compatibility token missing or changed unexpectedly');

const session = read('rwg-session.js'), sessionCss = read('rwg-session.css'), hud = read('game-hud.js');
for (const marker of ["rwg.session.v2:",'ENVELOPE_SCHEMA = 2','adapter.compatibility','adapter.validate(envelope.payload, envelope)','Vuoi continuare la partita precedente?','pagehide','beforeunload','visibilitychange',"forceLifecycleSave('navigation')",'MAX_SNAPSHOT_BYTES']) must(session.includes(marker), `Shared session v2 missing: ${marker}`);
const debounce = Number(session.match(/DIRTY_DEBOUNCE_MS\s*=\s*(\d+)/)?.[1]);
const heartbeat = Number(session.match(/HEARTBEAT_MS\s*=\s*(\d+)/)?.[1]);
must(debounce === 750, `Shared session debounce must be 750ms; found ${debounce}`);
must(heartbeat === 5000, `Shared session heartbeat must be 5000ms; found ${heartbeat}`);
must(session.includes('payloadJson === lastPayloadJson && !FORCE_WRITE_REASONS.has(reason)'), 'Unchanged autosave writes must be suppressed');
must(session.indexOf('data-rwg-resume-no>No</button>') < session.indexOf('data-rwg-resume-yes>Sì</button>'), 'Resume modal must keep No left and Sì right');
must(sessionCss.includes('.rwg-resume-no') && sessionCss.includes('#c92f43'), 'Resume No button must remain red');
must(sessionCss.includes('.rwg-resume-yes') && sessionCss.includes('#35cf79'), 'Resume Sì button must remain green');
must(hud.includes('loadSession') && hud.includes("new URL('rwg-session.js', base)"), 'Shared HUD must bootstrap sessions for every game');

if (failures.length) {
  console.error(`\nSolitaire validation FAILED (${failures.length})\n`);
  failures.forEach(failure => console.error(`  ✗ ${failure}`));
  process.exit(1);
}
console.log('Solitaire validation OK');
console.log('  ✓ classic Klondike rules and card artwork');
console.log('  ✓ browser zoom gestures blocked by viewport + CSS + JS guard');
console.log('  ✓ stock/waste docked bottom-right as left/right pair');
console.log('  ✓ cyclic double-tap auto-move with reduced-motion-safe FLIP animation');
console.log('  ✓ validated 52-card logical snapshot');
console.log('  ✓ centralized RWGSession v2 bootstrap and compatibility token');
console.log('  ✓ dirty moves + 5s heartbeat + safe restore semantics');
