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
for (const marker of ['TOP 10 GLOBALE','TOP 3 GLOBALE','INSERISCI IL TUO NOME','REGISTRA RECORD','rwg:game-over-summary','rwg:game-over-revealed','rwg:leaderboard-result','continueCount','rwg.leaderboard.queue.v1','leaderboard_auto_submit_start','leaderboard_auto_submit','leaderboard_name_saved','leaderboard_home_top3','leaderboard_pause_view','leaderboard_rank_card_view']) must(client.includes(marker), `leaderboard client missing ${marker}`);
must(client.includes("if (Number(row.continueCount) > 0)"), 'Continue count must be shown only when positive');
must(client.includes('validNickname(savedNickname)') && client.includes('automatic: true'), 'saved nickname must trigger silent automatic registration');
must(client.includes('rwg-leaderboard-name-modal') && css.includes('.rwg-leaderboard-name-modal{position:fixed'), 'first-use nickname must use a dedicated modal above Game Over');
must(!client.includes("document.querySelector('.rwg-game-over-card')"), 'nickname form must not be embedded in the Game Over card');
must(client.includes("document.querySelectorAll('.game-card") && client.includes("slice(0, 3)") && css.includes('.rwg-home-top3{'), 'home must render a Top 3 below every discovered game card');
must(client.includes("classList.contains('rwg-resume-open')") && client.includes("pauseBtn?.textContent.trim() === '▶'") && css.includes('.rwg-leaderboard-pause-board{position:fixed'), 'resume and pause states must show the compact in-game Top 3');
must(client.includes('SEI NELLA TOP TEN!') && client.includes("rank <= 10") && css.includes('.rwg-leaderboard-rank-card.is-top-ten'), 'Game Over must highlight authoritative Top Ten positions in gold');
must(client.includes('POSIZIONE IN AGGIORNAMENTO') && client.includes('pending: true'), 'offline Game Over rank must remain explicitly pending');

for (const marker of ['const PAGE_SIZE = 20', '?limit=${PAGE_SIZE}&offset=', 'pagination.hasMore', 'pagination.nextOffset', 'maybeLoadMore', "addEventListener('scroll'", 'leaderboard_infinite_page', 'CLASSIFICA GLOBALE', 'SCORRI PER ALTRI RECORD']) {
  must(infinite.includes(marker), `endless intro leaderboard missing ${marker}`);
}
must(infinite.includes('remaining <= 72') && infinite.includes('fetchPage(pagination.nextOffset || rows.length)'), 'endless leaderboard must request the next page near the internal scroll edge');
must(infinite.includes("board.dataset.rwgInfinite = 'true'"), 'endless leaderboard must mark ownership of the shared intro board');
must(infinite.includes('MutationObserver') && infinite.includes('renderGuard'), 'endless enhancement must remain resilient to the legacy shared client refreshing the same board');

must(css.includes('height:clamp(104px,14dvh,132px)') && css.includes('grid-template-rows:auto minmax(0,1fr) auto') && css.includes('overflow:hidden'), 'intro leaderboard must have a bounded responsive height instead of expanding the intro');
must(css.includes('overflow-y:auto') && css.includes('touch-action:pan-y!important') && css.includes('-webkit-overflow-scrolling:touch'), 'leaderboard rows must scroll internally on touch/mobile browsers');
must(css.includes('height:92px') && css.includes('@media(max-width:360px), (max-height:620px)'), 'short-phone intro leaderboard must reserve even less vertical space');
must(css.includes('.rwg-lb-more'), 'endless leaderboard load-more/status row styling missing');

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
must(server.includes("normalizeLeaderboardPage(request.query || {}, { limit: 10 })"), 'GET leaderboard endpoint must retain bounded backward-compatible query paging');
must(server.includes("{ limit: 20, offset: 0 }"), 'post-result leaderboard response must return the first 20-row page');
must(ranking.includes('normalizeLeaderboardPage') && ranking.includes('Math.min(max') && ranking.includes('defaultLimit'), 'leaderboard paging input must be normalized and bounded');
const tests = spawnSync(process.execPath, ['--test', path.join(root, 'server/leaderboards/test.mjs')], { encoding: 'utf8' });
must(tests.status === 0, `leaderboard tests failed: ${tests.stderr || tests.stdout}`);
if (failures.length) { console.error(`Leaderboard validation FAILED (${failures.length})`); failures.forEach(item => console.error(`  ✗ ${item}`)); process.exit(1); }
console.log('Leaderboard validation OK');
console.log('  ✓ bounded internally scrollable intro leaderboard');
console.log('  ✓ 20-row API paging with endless-scroll continuation');
console.log('  ✓ shared Top 3 pause/home and Top Ten result treatment');
console.log('  ✓ idempotent run/Continue server contract');
console.log('  ✓ MariaDB schema and per-game ranking tests');
