#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const root = process.cwd(), failures = [];
const read = rel => fs.existsSync(path.join(root, rel)) ? fs.readFileSync(path.join(root, rel), 'utf8') : (failures.push(`MISSING: ${rel}`), '');
const must = (ok, message) => { if (!ok) failures.push(message); };
for (const rel of ['rwg-leaderboard.js','game-hud.js','game-over.js','server/leaderboards/server.js','server/leaderboards/ranking.js']) {
  const checked = spawnSync(process.execPath, ['--check', path.join(root, rel)], { encoding: 'utf8' });
  must(checked.status === 0, `${rel}: syntax invalid`);
}
const hud = read('game-hud.js'), client = read('rwg-leaderboard.js'), css = read('rwg-leaderboard.css');
must(hud.includes('loadLeaderboard();') && hud.includes('rwg-leaderboard.js') && hud.includes('rwg-leaderboard.css'), 'game-hud must centrally bootstrap leaderboard assets');
for (const marker of ['TOP 10 GLOBALE','INSERISCI IL TUO NOME','REGISTRA RECORD','rwg:game-over-summary','rwg:leaderboard-result','continueCount','rwg.leaderboard.queue.v1']) must(client.includes(marker), `leaderboard client missing ${marker}`);
must(client.includes("if (Number(row.continueCount) > 0)"), 'Continue count must be shown only when positive');
must(css.includes('@media(max-width:360px)'), 'leaderboard must retain small-phone layout');
const solitaire = read('games/solitaire/game.js');
must(solitaire.includes("rwg:leaderboard-result"), 'Solitaire victory must emit leaderboard result');
must(!solitaire.includes("rwg:game-ended"), 'Solitaire must not emit terminal Game Over');
const schema = read('server/leaderboards/schema.sql'), server = read('server/leaderboards/server.js'), unit = read('ops/rwg-leaderboard.service');
must(!unit.includes('MemoryDenyWriteExecute=true'), 'systemd MemoryDenyWriteExecute breaks the Node/V8 JIT');
const installer = read('ops/install-rwg-leaderboards.sh'), nginxSnippet = read('ops/rwg-leaderboards.nginx.conf');
must(!installer.includes('/dev/stdin'), 'installer must not use /dev/stdin as an install source');
must(installer.includes('rwg-leaderboards.nginx.conf') && nginxSnippet.includes('proxy_pass http://127.0.0.1:3112/;'), 'versioned leaderboard Nginx snippet missing');
must(installer.includes('wait_for_health') && installer.includes('Health pubblica leaderboard'), 'installer must retry health after asynchronous Nginx reload');
for (const marker of ['leaderboard_view','leaderboard_entry_view','leaderboard_submit_queued','leaderboard_queue_flush','post_score']) must(client.includes(marker), `leaderboard analytics missing ${marker}`);
for (const marker of ['rwg_players','rwg_runs','continue_count','achievements','metrics','rank_primary']) must(schema.includes(marker), `schema missing ${marker}`);
for (const marker of ["app.get('/games/:slug'","app.post('/runs'",'ROW_NUMBER() OVER','ON DUPLICATE KEY UPDATE']) must(server.includes(marker), `API missing ${marker}`);
const tests = spawnSync(process.execPath, ['--test', path.join(root, 'server/leaderboards/test.mjs')], { encoding: 'utf8' });
must(tests.status === 0, `leaderboard tests failed: ${tests.stderr || tests.stdout}`);
if (failures.length) { console.error(`Leaderboard validation FAILED (${failures.length})`); failures.forEach(item => console.error(`  ✗ ${item}`)); process.exit(1); }
console.log('Leaderboard validation OK');
console.log('  ✓ shared top-10 and mandatory registration UI');
console.log('  ✓ idempotent run/Continue server contract');
console.log('  ✓ MariaDB schema and per-game ranking tests');
