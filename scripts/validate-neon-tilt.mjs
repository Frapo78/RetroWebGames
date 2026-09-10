#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const publicRoot = fs.existsSync(path.join(process.cwd(), 'public', 'games')) ? 'public' : '.';
const asset = relative => path.join(publicRoot, relative);
const scoringPath = asset('games/neon-tilt/scoring.js');
const gamePath = asset('games/neon-tilt/game.js');
const htmlPath = asset('games/neon-tilt/index.html');
const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(scoringPath, 'utf8'), context, { filename: scoringPath });
const scoring = context.window.NeonTiltScoring;

assert.equal(scoring.VERSION, 2);
const result = (elapsedSeconds, livesLost = 0, level = 1) => scoring.calculateLevelScore({
  level, parSeconds: 45, elapsedSeconds, livesLost, falls: livesLost, pitFalls: livesLost, shardsCollected: 3
});
const fast = result(18), par = result(45), slow = result(110);
assert(fast.clearScore > par.clearScore && par.clearScore > slow.clearScore, 'time efficiency must be monotonic');
assert(result(45, 0).clearScore > result(45, 1).clearScore, 'one lost life must reduce clear score');
assert(result(45, 1).clearScore > result(45, 2).clearScore, 'life penalty must remain monotonic');
assert(result(45, 0, 13).clearScore > result(45, 0, 1).clearScore, 'later maze cycles must reward progression');
assert(scoring.calculateShardScore(1) < par.clearScore / 10, 'a shard must remain a small contribution');
for (let elapsed = 0; elapsed <= 600; elapsed += 5) {
  const current = result(elapsed, elapsed % 4, 1 + elapsed);
  assert(Number.isSafeInteger(current.clearScore) && current.clearScore > 0, 'score must be finite and positive');
  assert(current.timeFactor >= .45 && current.timeFactor <= 1.4, 'time factor outside clamp');
  assert(current.integrityFactor >= .58 && current.integrityFactor <= 1, 'integrity factor outside clamp');
}

const game = fs.readFileSync(gamePath, 'utf8');
const html = fs.readFileSync(htmlPath, 'utf8');
for (const marker of ['scoringVersion:state.scoringVersion', 'metrics:terminalMetrics()', 'levelLivesLost', 'levelShardsCollected', "s.scoringVersion===Scoring.VERSION", 'scoringMetrics:{...state.scoringMetrics}']) {
  assert(game.includes(marker), 'game integration marker missing: ' + marker);
}
assert(html.includes('scoring.js?v='), 'versioned scoring module is not loaded');
assert(html.indexOf('scoring.js?v=') < html.indexOf('game.js?v='), 'scoring must load before game');

console.log('Neon Tilt scoring validation OK');
console.log('  ✓ faster clears and intact lives score more');
console.log('  ✓ progression, shard weight, clamps and persistence contracts are guarded');
