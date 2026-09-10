import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEADERBOARD_SCOPES, normalizeLeaderboardPage, normalizeNickname, normalizeRun,
  normalizeScoringScope, normalizeVariantSlug, scoringCatalog
} from './ranking.js';

test('nickname arcade', () => {
  assert.equal(normalizeNickname('  Fra 78  '), 'Fra 78');
  assert.throws(() => normalizeNickname('<x>'));
  assert.throws(() => normalizeNickname('ab'));
});

test('leaderboard paging is bounded and deterministic', () => {
  assert.deepEqual(normalizeLeaderboardPage({}, { limit: 10 }), { limit: 10, offset: 0 });
  assert.deepEqual(normalizeLeaderboardPage({ limit: '20', offset: '40' }), { limit: 20, offset: 40 });
  assert.deepEqual(normalizeLeaderboardPage({ limit: 500, offset: -8 }), { limit: 50, offset: 0 });
  assert.deepEqual(normalizeLeaderboardPage({ limit: 'x', offset: 'x' }, { limit: 20 }), { limit: 20, offset: 0 });
});

test('arcade ranking uses score and level', () => {
  const run = normalizeRun({ runId:'12345678-1234-1234-1234-123456789012',gameSlug:'star-swarm',nickname:'FRA 78',score:1200,level:7,metrics:{maxCombo:4} });
  assert.deepEqual([run.primary,run.secondary,run.tertiary],[1200,7,4]);
  assert.deepEqual([run.scoreVersion,run.seasonSlug],[1,'legacy-v1']);
});

test('scoring versions and seasons are explicit and bounded', () => {
  assert.deepEqual(normalizeScoringScope('star-swarm', 'default'), { scoreVersion: 1, seasonSlug: 'legacy-v1' });
  assert.deepEqual(normalizeScoringScope('neon-tilt', 'default'), { scoreVersion: 2, seasonSlug: 'scoring-v2' });
  assert.deepEqual(normalizeScoringScope('neon-tilt', 'default', 1), { scoreVersion: 1, seasonSlug: 'legacy-v1' });
  assert.deepEqual(normalizeScoringScope('solitaire', 'klondike'), { scoreVersion: 2, seasonSlug: 'scoring-v2' });
  assert.deepEqual(normalizeScoringScope('solitaire', 'freecell', 1), { scoreVersion: 1, seasonSlug: 'legacy-v1' });
  assert.throws(() => normalizeScoringScope('star-swarm', 'default', 2), /non registrata/);
  assert.throws(() => normalizeScoringScope('solitaire', 'klondike', 2, 'legacy-v1'), /non registrata/);
  const v2 = normalizeRun({ runId:'12345678-1234-1234-1234-123456789012',gameSlug:'solitaire',variantSlug:'freecell',nickname:'PLAYER',score:900,metrics:{elapsed:120,moves:88,scoringVersion:2} });
  assert.deepEqual([v2.scoreVersion,v2.seasonSlug],[2,'scoring-v2']);
  const tiltV2 = normalizeRun({ runId:'12345678-1234-1234-1234-123456789013',gameSlug:'neon-tilt',nickname:'PLAYER',score:1400,metrics:{scoringVersion:2,levelsCleared:1,livesLost:0} });
  assert.deepEqual([tiltV2.scoreVersion,tiltV2.seasonSlug],[2,'scoring-v2']);
  const tiltLegacy = normalizeRun({ runId:'12345678-1234-1234-1234-123456789014',gameSlug:'neon-tilt',nickname:'PLAYER',score:1400,metrics:{levelsCleared:1} });
  assert.deepEqual([tiltLegacy.scoreVersion,tiltLegacy.seasonSlug],[1,'legacy-v1']);
  const catalog = scoringCatalog();
  assert.equal(catalog.schemaVersion, 1);
  assert.equal(catalog.scopes.length, LEADERBOARD_SCOPES.length);
});

test('rally and solitaire use game-specific ranking', () => {
  const rally = normalizeRun({ runId:'12345678-1234-1234-1234-123456789012',gameSlug:'neon-rally',nickname:'PLAYER',score:7,metrics:{playerScore:7,cpuScore:4,maxRally:18,result:'win'} });
  assert.deepEqual([rally.primary,rally.secondary,rally.tertiary,rally.resultLabel],[1,3,18,'7–4']);
  const solitaire = normalizeRun({ runId:'12345678-1234-1234-1234-123456789012',gameSlug:'solitaire',nickname:'PLAYER',score:900,metrics:{elapsed:120,moves:88} });
  assert.deepEqual([solitaire.primary,solitaire.secondary,solitaire.tertiary],[900,-120,-88]);
  assert.deepEqual([solitaire.scoreVersion,solitaire.seasonSlug],[1,'legacy-v1']);
  assert.throws(() => normalizeRun({ runId:'12345678-1234-1234-1234-123456789012',gameSlug:'solitaire',nickname:'PLAYER',score:0,metrics:{elapsed:0,moves:0} }), /1 e 10\.000/);
  assert.throws(() => normalizeRun({ runId:'12345678-1234-1234-1234-123456789012',gameSlug:'solitaire',nickname:'PLAYER',score:10001,metrics:{elapsed:120,moves:88} }), /1 e 10\.000/);
});


test('leaderboard variants are explicit, bounded scopes', () => {
  assert.equal(normalizeVariantSlug('star-swarm'), 'default');
  assert.equal(normalizeVariantSlug('solitaire'), 'klondike');
  assert.equal(normalizeVariantSlug('solitaire', 'freecell'), 'freecell');
  assert.equal(normalizeVariantSlug('solitaire', '', { variant: 'freecell' }), 'freecell');
  assert.throws(() => normalizeVariantSlug('solitaire', 'invented'));
  assert.throws(() => normalizeVariantSlug('unknown', 'default'));
  assert(LEADERBOARD_SCOPES.some(scope => scope.gameSlug === 'solitaire' && scope.variantSlug === 'freecell'));
  const freecell = normalizeRun({ runId:'12345678-1234-1234-1234-123456789012',gameSlug:'solitaire',variantSlug:'freecell',nickname:'PLAYER',score:900,metrics:{elapsed:120,moves:88,variant:'freecell'} });
  assert.equal(freecell.variantSlug, 'freecell');
});
