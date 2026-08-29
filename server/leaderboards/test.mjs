import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLeaderboardPage, normalizeNickname, normalizeRun } from './ranking.js';

test('nickname arcade', () => {
  assert.equal(normalizeNickname('  Fra 78  '), 'Fra 78');
  assert.throws(() => normalizeNickname('<x>'));
  assert.throws(() => normalizeNickname('ab'));
});

test('leaderboard paging is bounded and deterministic', () => {
  assert.deepEqual(normalizeLeaderboardPage({}, { limit: 10 }), { limit: 10, offset: 0 });
  assert.deepEqual(normalizeLeaderboardPage({ limit: '20', offset: '40' }), { limit: 20, offset: 40 });
  assert.deepEqual(normalizeLeaderboardPage({ limit: 500, offset: -8 }), { limit: 50, offset: 0 });
  assert.deepEqual(normalizeLeaderboardPage({ limit: 'x', offset: 'x' }, { limit: 20 }), { limit: 1, offset: 0 });
});

test('arcade ranking uses score and level', () => {
  const run = normalizeRun({ runId:'12345678-1234-1234-1234-123456789012',gameSlug:'star-swarm',nickname:'FRA 78',score:1200,level:7,metrics:{maxCombo:4} });
  assert.deepEqual([run.primary,run.secondary,run.tertiary],[1200,7,4]);
});

test('rally and solitaire use game-specific ranking', () => {
  const rally = normalizeRun({ runId:'12345678-1234-1234-1234-123456789012',gameSlug:'neon-rally',nickname:'PLAYER',score:7,metrics:{playerScore:7,cpuScore:4,maxRally:18,result:'win'} });
  assert.deepEqual([rally.primary,rally.secondary,rally.tertiary,rally.resultLabel],[1,3,18,'7–4']);
  const solitaire = normalizeRun({ runId:'12345678-1234-1234-1234-123456789012',gameSlug:'solitaire',nickname:'PLAYER',score:900,metrics:{elapsed:120,moves:88} });
  assert.deepEqual([solitaire.primary,solitaire.secondary,solitaire.tertiary],[900,-120,-88]);
});
