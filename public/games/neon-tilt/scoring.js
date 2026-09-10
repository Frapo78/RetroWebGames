(() => {
  'use strict';

  const VERSION = 2;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const integer = (value, min = 0, max = 1_000_000) => Math.trunc(clamp(finite(value), min, max));

  function normalizeLevelMetrics(input = {}) {
    const parSeconds = clamp(finite(input.parSeconds, 60), 5, 600);
    return Object.freeze({
      level: integer(input.level, 1, 100_000),
      parSeconds,
      elapsedSeconds: clamp(finite(input.elapsedSeconds, parSeconds), 0, 86_400),
      livesLost: integer(input.livesLost, 0, 100),
      falls: integer(input.falls, 0, 100),
      pitFalls: integer(input.pitFalls, 0, 100),
      shardsCollected: integer(input.shardsCollected, 0, 100)
    });
  }

  function calculateShardScore(level) {
    return 36 + integer(level, 1, 100_000) * 4;
  }

  function calculateLevelScore(input = {}) {
    const metrics = normalizeLevelMetrics(input);
    const floorSeconds = Math.max(4, metrics.parSeconds * .3);
    const timeFactor = clamp((metrics.parSeconds / Math.max(metrics.elapsedSeconds, floorSeconds)) ** .6, .45, 1.4);
    const integrityFactor = clamp(1 - metrics.livesLost * .14 - Math.max(0, metrics.falls - metrics.livesLost) * .03, .58, 1);
    const levelBase = 820 + metrics.level * 145;
    const clearScore = Math.round(levelBase * timeFactor * integrityFactor);
    const shardScore = metrics.shardsCollected * calculateShardScore(metrics.level);
    return Object.freeze({
      total: Math.max(1, clearScore),
      clearScore: Math.max(1, clearScore),
      shardScore,
      levelBase,
      timeFactor,
      integrityFactor,
      metrics
    });
  }

  window.NeonTiltScoring = Object.freeze({
    VERSION,
    normalizeLevelMetrics,
    calculateShardScore,
    calculateLevelScore
  });
})();
