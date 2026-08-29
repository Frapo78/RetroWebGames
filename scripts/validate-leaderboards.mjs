#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const root = process.cwd(), failures = [];
const read = rel => fs.existsSync(path.join(root, rel)) ? fs.readFileSync(path.join(root, rel), 'utf8') : (failures.push(`MISSING: ${rel}`), '');
const must = (ok, message) => { if (!ok) failures.push(message); };
for (const rel of ['rwg-leaderboard.js','rwg-leaderboard-infinite.js','game-hud.js','game-over.js','server/leaderboards/server.js','server/leaderboards/ranking.js']) {
  const checked = spawnSync(process.execPath, ['--check', path.join(root, rel)], { encoding: 'utf8' });
  must(checked.status === 0, `${rel}: syntax invalid`);
}
const hud = read('game-hud.js'), client = read('rwg-leaderboard.js'), infinite = read('rwg-leaderboard-infinite.js'), css = read('rwg-leaderboard.css');
const hub = read('index.html');
must(hud.includes('loadLeaderboard();') && hud.includes('rwg-leaderboard.js') && hud.includes('rwg-leaderboard.css'), 'game-hud must centrally bootstrap leaderboard assets');
must(hud.includes('rwg-leaderboard-infinite.js') && hud.includes('data-rwg-leaderboard-infinite-script'), 'game-hud must centrally bootstrap the endless intro leaderboard for every game');
must(hub.includes('rwg-leaderboard.js') && hub.includes('rwg-leaderboard.css'), 'home must load the shared leaderboard client and styles');
for (const marker of ['HIGH SCORES','TOP 3 GLOBALE','INSERISCI IL TUO NOME','REGISTRA RECORD','rwg:game-over-summary','rwg:game-over-revealed','rwg:leaderboard-result','continueCount','rwg.leaderboard.queue.v1','leaderboard_auto_submit_start','leaderboard_auto_submit','leaderboard_name_saved','leaderboard_home_top3','leaderboard_pause_view','leaderboard_rank_card_view']) must(client.includes(marker), `leaderboard client missing ${marker}`);
must(client.includes("if (Number(row.continueCount) > 0)"), 'Continue count must be shown only when positive');
must(client.includes('validNickname(savedNickname)') && client.includes('automatic: true'), 'saved nickname must trigger silent automatic registration');
must(client.includes('rwg-leaderboard-name-modal') && css.includes('.rwg-leaderboard-name-modal{position:fixed'), 'first-use nickname must use a dedicated modal above Game Over');
must(!client.includes("document.querySelector('.rwg-game-over-card')"), 'nickname form must not be embedded in the Game Over card');
must(client.includes("document.querySelectorAll('.game-card") && client.includes("slice(0, 3)") && css.includes('.rwg-home-top3{'), 'home must render a Top 3 below every discovered game card');
must(client.includes("classList.contains('rwg-resume-open')") && client.includes("pauseBtn?.textContent.trim() === '▶'") && css.includes('.rwg-leaderboard-pause-board{position:fixed'), 'resume and pause states must show the compact in-game Top 3');
must(client.includes('SEI NELLA TOP TEN!') && client.includes("rank <= 10") && css.includes('.rwg-leaderboard-rank-card.is-top-ten'), 'Game Over must highlight authoritative Top Ten positions in gold');
must(client.includes('POSIZIONE IN AGGIORNAMENTO') && client.includes('pending: true'), 'offline Game Over rank must remain explicitly pending');

for (const marker of ['const PAGE_SIZE = 10', 'const EDGE_THRESHOLD_PX = 24', '?limit=${PAGE_SIZE}&offset=', 'pagination.hasMore', 'pagination.nextOffset', 'maybeLoadMore', 'leaderboard_infinite_page', '🏆 HIGH SCORES', 'SCORRI PER ALTRI HIGH SCORES']) {
  must(infinite.includes(marker), `endless intro High Scores missing ${marker}`);
}
must(infinite.includes('remaining <= EDGE_THRESHOLD_PX') && infinite.includes('fetchPage(pagination.nextOffset || rows.length)'), 'endless High Scores must request the next ten-row page at the internal scroll edge');
must(infinite.includes("board.dataset.rwgInfinite = 'true'"), 'endless High Scores must mark ownership of the shared intro board');
must(infinite.includes('MutationObserver') && infinite.includes('renderGuard'), 'endless enhancement must remain resilient to the legacy shared client refreshing the same board');
must(infinite.includes('pageRows.length === PAGE_SIZE') && infinite.includes('backendHasMore && pageIsFull && advances && beforeKnownEnd'), 'endless High Scores must defensively stop on a short/final/non-advancing page');
must(infinite.includes('function disableEndless()') && infinite.includes("removeEventListener('scroll', onScroll)") && infinite.includes("removeEventListener('wheel', onWheel)") && infinite.includes("removeEventListener('touchend', onTouchEnd)"), 'final High Scores page must detach endless-scroll listeners');
must(infinite.includes("data-rwg-infinite-complete") && infinite.includes('function enableEndless()'), 'High Scores reset must be able to re-enable endless scrolling after completion');
must(infinite.includes('Carica 10 posizioni alla volta'), 'High Scores accessibility copy must expose ten-row pagination');

for (const marker of ['INTRO_BOARD_MIN_PX = 64','INTRO_BOARD_MAX_PX = 420','INTRO_SHARE_RESERVE_PX = 54','fitIntroBoardHeight','setupIntroFit','--rwg-lb-fit-height','window.visualViewport?.height','window.visualViewport?.addEventListener','ResizeObserver','fitMutationObserver.observe(panel']) {
  must(infinite.includes(marker), `dynamic intro High Scores viewport fitting missing ${marker}`);
}
must(infinite.includes("panel.querySelector('.rwg-intro-share')") && infinite.includes('share ? 0 : INTRO_SHARE_RESERVE_PX'), 'dynamic High Scores must reserve space for social sharing until the share row is mounted');
must(infinite.includes('usableHeight - nonBoardHeight - shareReserve - INTRO_VERTICAL_SAFETY_PX'), 'dynamic High Scores must consume only the remaining intro viewport budget');
must(infinite.includes("board.dataset.rwgViewportFit = 'true'"), 'dynamic High Scores board must expose its fitted-layout state');

must(css.includes('height:var(--rwg-lb-fit-height,clamp(88px,15dvh,156px))') && css.includes('min-height:64px') && css.includes('max-height:min(420px,55dvh)') && css.includes('grid-template-rows:auto minmax(0,1fr) auto') && css.includes('contain:layout paint'), 'intro High Scores must use the dynamic shared viewport budget with a safe compact fallback');
must(css.includes('overflow-y:auto') && css.includes('touch-action:pan-y!important') && css.includes('-webkit-overflow-scrolling:touch'), 'High Scores rows must scroll internally on touch/mobile browsers');
must(css.includes('min-height:60px') && css.includes('max-height:min(300px,48dvh)') && css.includes('@media(max-width:360px), (max-height:700px)') && css.includes('.rwg-lb-status{display:none}'), 'short-phone High Scores must retain a compact lower bound while remaining dynamically expandable');
must(css.includes('[data-rwg-viewport-fit="true"]') && css.includes('transition:height .16s ease'), 'dynamic High Scores resizing should remain visually stable when motion is allowed');
must(css.includes('.rwg-lb-more') && css.includes('[data-rwg-infinite-complete="true"]'), 'High Scores endless/final-state styling missing');

const gameOver = read('game-over.js');
must(gameOver.includes('document.body.dataset.rwgGameName') && !gameOver.includes("document.title.split"), 'Game Over title must use the short game identity, never the SEO title');
must(gameOver.includes("rwg:game-over-revealed"), 'Game Over must announce when the summary is ready for the first-use nickname modal');
for (const rel of fs.readdirSync(path.join(root, 'games')).map(slug => `games/${slug}/index.html`).filter(rel => fs.existsSync(path.join(root, rel)))) {
  const html = read(rel);
  if (html.includes('data-rwg-game="true"')) must(/data-rwg-game-name="[^"]+"/.test(html), `${rel}: missing short data-rwg-game-name`);
}
const solitaire = read('games/solitaire/game.js');
must(solitaire.includes("rwg:leaderboard-result"), 'Solitaire victory must emit leaderboard result');
must(!solitaire.includes("rwg:game-ended"), 'Solitaire must not emit terminal Game Over');
const schema = read('server/leaderboards/schema.sql'), server = read('server/leaderboards/server.js'), ranking = read('server/leaderboards/ranking.js'), unit = read('ops/rwg-leaderboard.service');
must(!unit.includes('MemoryDenyWriteExecute=true'), 'systemd MemoryDenyWriteExecute breaks the Node/V8 JIT');
const installer = read('ops/install-rwg-leaderboards.sh'), nginxSnippet = read('ops/rwg-leaderboards.nginx.conf');
must(!installer.includes('/dev/stdin'), 'installer must not use /dev/stdin as an install source');
must(installer.includes('rwg-leaderboards.nginx.conf') && nginxSnippet.includes('proxy_pass http://127.0.0.1:3112/;'), 'versioned leaderboard Nginx snippet missing');
must(installer.includes('wait_for_health') && installer.includes('Health pubblica leaderboard'), 'installer must retry health after asynchronous Nginx reload');
for (const marker of ['leaderboard_view','leaderboard_entry_view','leaderboard_submit_queued','leaderboard_queue_flush','post_score']) must(client.includes(marker), `leaderboard analytics missing ${marker}`);
for (const marker of ['rwg_players','rwg_runs','continue_count','achievements','metrics','rank_primary']) must(schema.includes(marker), `schema missing ${marker}`);
for (const marker of ["app.get('/games/:slug'","app.post('/runs'",'ROW_NUMBER() OVER','COUNT(*) OVER () total_count','ON DUPLICATE KEY UPDATE','pagination:','hasMore:','nextOffset:']) must(server.includes(marker), `API pagination/ranking missing ${marker}`);
must(server.includes("normalizeLeaderboardPage(request.query || {}, { limit: 10 })"), 'GET leaderboard endpoint must retain bounded ten-row default paging');
must(ranking.includes('normalizeLeaderboardPage') && ranking.includes('Math.min(max') && ranking.includes('defaultLimit'), 'leaderboard paging input must be normalized and bounded');
const tests = spawnSync(process.execPath, ['--test', path.join(root, 'server/leaderboards/test.mjs')], { encoding: 'utf8' });
must(tests.status === 0, `leaderboard tests failed: ${tests.stderr || tests.stdout}`);
if (failures.length) { console.error(`Leaderboard validation FAILED (${failures.length})`); failures.forEach(item => console.error(`  ✗ ${item}`)); process.exit(1); }
console.log('Leaderboard validation OK');
console.log('  ✓ dynamically fitted internally scrollable HIGH SCORES intro component');
console.log('  ✓ social share row remains inside the measured intro viewport budget');
console.log('  ✓ 10-row API paging with defensive endless-scroll completion');
console.log('  ✓ final page detaches endless-load listeners and retry can re-enable them');
console.log('  ✓ shared Top 3 pause/home and Top Ten result treatment');
console.log('  ✓ idempotent run/Continue server contract');
console.log('  ✓ MariaDB schema and per-game ranking tests');