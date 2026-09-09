(() => {
  'use strict';

  const VERSION = 2;
  const MIN_SCORE = 1;
  const MAX_SCORE = 10000;
  const MAX_FACTOR = 1.20;
  const MAX_MULTIPLIER = MAX_FACTOR * MAX_FACTOR;
  const PROFILES = Object.freeze({
    klondike: Object.freeze({ targetSeconds: 300, targetMoves: 115 }),
    freecell: Object.freeze({ targetSeconds: 240, targetMoves: 95 })
  });
  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  const count = value => Math.max(0, Math.floor(Number(value) || 0));

  function efficiency(target, actual, exponent) {
    const numeric = Number(actual);
    const safeActual = Number.isFinite(numeric) && numeric > 0 ? numeric : target;
    return Math.min(MAX_FACTOR, (target / safeActual) ** exponent);
  }

  function calculateVictoryScore({ variantId, elapsed, moves, hintsUsed = 0, undosUsed = 0 } = {}) {
    const profile = PROFILES[variantId] || PROFILES.klondike;
    const timeFactor = efficiency(profile.targetSeconds, elapsed, 0.45);
    const moveFactor = efficiency(profile.targetMoves, moves, 0.70);
    const hintCount = count(hintsUsed);
    const undoCount = count(undosUsed);
    const disciplineFactor = (0.88 ** hintCount) * (0.94 ** undoCount);
    const performanceMultiplier = timeFactor * moveFactor * disciplineFactor;
    const normalizedPerformance = clamp(performanceMultiplier / MAX_MULTIPLIER, 0, 1);
    return Object.freeze({
      version: VERSION,
      score: clamp(MIN_SCORE + Math.round((MAX_SCORE - MIN_SCORE) * normalizedPerformance), MIN_SCORE, MAX_SCORE),
      timeFactor,
      moveFactor,
      disciplineFactor,
      performanceMultiplier,
      normalizedPerformance,
      hintsUsed: hintCount,
      undosUsed: undoCount
    });
  }

  window.RWGSolitaireScoring = Object.freeze({ VERSION, MIN_SCORE, MAX_SCORE, PROFILES, calculateVictoryScore });
})();
