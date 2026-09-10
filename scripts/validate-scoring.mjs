#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  LEADERBOARD_SCOPES,
  SCORING_SCOPES,
  normalizeRun,
  normalizeScoringScope,
  scoringCatalog
} from '../server/leaderboards/ranking.js';

const repoRoot = process.cwd();
const publicRoot = fs.existsSync(path.join(repoRoot, 'public', 'games')) ? path.join(repoRoot, 'public') : repoRoot;
const failures = [];
const resolve = rel => {
  const publicFile = path.join(publicRoot, rel);
  return fs.existsSync(publicFile) ? publicFile : path.join(repoRoot, rel);
};
const read = rel => fs.existsSync(resolve(rel))
  ? fs.readFileSync(resolve(rel), 'utf8')
  : (failures.push('MISSING: ' + rel), '');
const must = (condition, message) => { if (!condition) failures.push(message); };
const seasonPattern = /^[a-z0-9][a-z0-9-]{0,39}$/;

const catalog = scoringCatalog();
must(catalog.schemaVersion === 1, 'scoring catalog schema must be version 1');
must(catalog.scopes.length === LEADERBOARD_SCOPES.length, 'every leaderboard scope needs a scoring scope');

for (const { gameSlug, variantSlug } of LEADERBOARD_SCOPES) {
  const key = gameSlug + ':' + variantSlug;
  const scope = SCORING_SCOPES[key];
  must(Boolean(scope), key + ': missing scoring scope');
  if (!scope) continue;
  must(Number.isInteger(scope.current.scoreVersion) && scope.current.scoreVersion >= 1, key + ': invalid current score version');
  must(seasonPattern.test(scope.current.seasonSlug), key + ': invalid current season slug');
  must(scope.seasons.some(item =>
    item.scoreVersion === scope.current.scoreVersion && item.seasonSlug === scope.current.seasonSlug
  ), key + ': current scoring scope must be registered');
  must(scope.seasons.some(item => item.scoreVersion === 1 && item.seasonSlug === 'legacy-v1'), key + ': legacy-v1 archive missing');
  const pairs = scope.seasons.map(item => item.scoreVersion + ':' + item.seasonSlug);
  must(new Set(pairs).size === pairs.length, key + ': duplicate score-version/season pair');
}

for (const variantSlug of ['klondike', 'freecell']) {
  const current = normalizeScoringScope('solitaire', variantSlug);
  must(current.scoreVersion === 2 && current.seasonSlug === 'scoring-v2', 'solitaire/' + variantSlug + ': scoring-v2 must be current');
}
const tiltCurrent = normalizeScoringScope('neon-tilt', 'default');
must(tiltCurrent.scoreVersion === 2 && tiltCurrent.seasonSlug === 'scoring-v2', 'neon-tilt: scoring-v2 must be current');
for (const { gameSlug, variantSlug } of LEADERBOARD_SCOPES.filter(scope => !['neon-tilt','solitaire'].includes(scope.gameSlug))) {
  const current = normalizeScoringScope(gameSlug, variantSlug);
  must(current.scoreVersion === 1 && current.seasonSlug === 'legacy-v1', gameSlug + ': v2 must not activate before its game rollout');
}

try {
  normalizeScoringScope('star-swarm', 'default', 2, 'scoring-v2');
  failures.push('unregistered Star Swarm v2 scope was accepted');
} catch (_) {}

const solitaireRun = normalizeRun({
  runId: '12345678-1234-1234-1234-123456789012',
  gameSlug: 'solitaire',
  variantSlug: 'klondike',
  nickname: 'PLAYER',
  score: 10000,
  metrics: { elapsed: 1, moves: 1, scoringVersion: 2 }
});
must(solitaireRun.scoreVersion === 2 && solitaireRun.seasonSlug === 'scoring-v2', 'Solitaire v2 run was not scoped correctly');
const tiltRun = normalizeRun({
  runId: '12345678-1234-1234-1234-123456789013',
  gameSlug: 'neon-tilt',
  nickname: 'PLAYER',
  score: 1400,
  metrics: { scoringVersion: 2, levelsCleared: 1, livesLost: 0 }
});
must(tiltRun.scoreVersion === 2 && tiltRun.seasonSlug === 'scoring-v2', 'Neon Tilt v2 run was not scoped correctly');
const tiltLegacyRun = normalizeRun({
  runId: '12345678-1234-1234-1234-123456789014',
  gameSlug: 'neon-tilt',
  nickname: 'PLAYER',
  score: 1400,
  metrics: { levelsCleared: 1 }
});
must(tiltLegacyRun.scoreVersion === 1 && tiltLegacyRun.seasonSlug === 'legacy-v1', 'unversioned Neon Tilt run must remain legacy-v1');

const schema = read('server/leaderboards/schema.sql');
const server = read('server/leaderboards/server.js');
const client = read('rwg-leaderboard.js');
const infinite = read('rwg-leaderboard-infinite.js');
for (const marker of ['score_version', 'season_slug', 'legacy-v1', 'scoring-v2', 'idx_rwg_game_variant_season_rank']) {
  must(schema.includes(marker), 'schema missing scoring marker: ' + marker);
}
must(server.includes("app.get('/catalog'"), 'leaderboard scoring catalog endpoint missing');
must(server.includes('seasonFilters') && server.includes('season_slug=?'), 'ranking queries are not season scoped');
must(server.includes('La partita appartiene a una stagione diversa.'), 'run id season immutability guard missing');
for (const marker of ['/catalog', 'scoreVersion', 'seasonSlug', 'rwg.leaderboard.run.v3:', 'rwg.leaderboard.cache.v3:', 'rwg.leaderboard.queue.v2']) {
  must(client.includes(marker), 'client missing scoring scope marker: ' + marker);
}
must(infinite.includes('getScoringScope') && infinite.includes('&season='), 'endless leaderboard is not season scoped');
must(read('games/solitaire/session-adapter.js').includes('scoringVersion: 2'), 'interrupted Solitaire results must remain in scoring-v2');

if (failures.length) {
  console.error('Scoring foundation validation FAILED (' + failures.length + ')');
  failures.forEach(failure => console.error('  ✗ ' + failure));
  process.exit(1);
}

console.log('Scoring foundation validation OK');
console.log('  ✓ every game/variant has an explicit current and legacy scoring scope');
console.log('  ✓ Solitario and Neon Tilt v2 are isolated while unversioned runs remain legacy-v1');
console.log('  ✓ API, persistence, browser cache/run/queue and endless paging are season scoped');
