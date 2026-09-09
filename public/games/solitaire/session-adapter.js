(() => {
  'use strict';
  const t = (key, params = {}) => window.RWGI18n.t(key, params);

  const base = window.RWGResumeAdapter;
  if (!base) throw new Error('Solitaire resume adapter missing');

  window.RWGResumeAdapter = Object.freeze({
    ...base,
    version: 3,
    compatibility: 'solitaire-state-v3-klondike-freecell'
  });

  const confirmBtn = document.getElementById('newDealConfirmBtn');
  const cancelBtn = document.getElementById('newDealCancelBtn');
  let registeringAbandonedDeal = false;
  let allowConfirmedRestart = false;

  function abandonedResult(state) {
    const elapsed = Math.max(0, Number(state?.elapsed) || 0);
    const moves = Math.max(0, Math.floor(Number(state?.moves) || 0));
    const progressScore = Math.max(0, Math.floor(Number(state?.score) || 0));
    const score = moves === 0 ? 0 : Math.max(1, Math.min(10000, progressScore));
    const hintsUsed = Math.max(0, Math.floor(Number(state?.hintsUsed) || 0));
    const undosUsed = Math.max(0, Math.floor(Number(state?.undosUsed) || 0));
    const variantId = String(state?.variantId || 'klondike');
    const cardStyle = document.getElementById('cardStyleSelect')?.value || 'essential';
    return {
      game: t('games.solitaire.title'),
      gameSlug: 'solitaire',
      variantSlug: variantId,
      outcome: 'game-over',
      score,
      level: 1,
      activeMs: Math.round(elapsed * 1000),
      continueCount: 0,
      achievements: [],
      metrics: { moves, elapsed, hintsUsed, undosUsed, scoringVersion: 2, variant: variantId, cardStyle, terminalReason: 'new-deal' }
    };
  }

  function finishRestart() {
    registeringAbandonedDeal = false;
    allowConfirmedRestart = true;
    if (confirmBtn) confirmBtn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = false;
    confirmBtn?.click();
  }

  confirmBtn?.addEventListener('click', event => {
    if (allowConfirmedRestart) {
      allowConfirmedRestart = false;
      return;
    }
    if (registeringAbandonedDeal) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    const state = base.serialize?.();
    const currentMoves = Math.max(0, Math.floor(Number(state?.moves) || 0));
    if (currentMoves === 0 || !window.RWGLeaderboard?.getRunId) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    registeringAbandonedDeal = true;
    confirmBtn.disabled = true;
    if (cancelBtn) cancelBtn.disabled = true;

    const variantSlug = String(state?.variantId || 'klondike');
    const runId = window.RWGLeaderboard.getRunId(variantSlug);
    const onRegistered = registeredEvent => {
      if (registeredEvent.detail?.gameSlug !== 'solitaire' || registeredEvent.detail?.runId !== runId || registeredEvent.detail?.variantSlug !== variantSlug) return;
      window.removeEventListener('rwg:leaderboard-registered', onRegistered);
      finishRestart();
    };
    window.addEventListener('rwg:leaderboard-registered', onRegistered);
    window.dispatchEvent(new CustomEvent('rwg:leaderboard-result', { detail: abandonedResult(state) }));
  }, true);
})();
