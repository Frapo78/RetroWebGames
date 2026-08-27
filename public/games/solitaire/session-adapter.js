(() => {
  'use strict';

  const base = window.RWGResumeAdapter;
  if (!base) throw new Error('Solitaire resume adapter missing');

  window.RWGResumeAdapter = Object.freeze({
    ...base,
    version: 2,
    compatibility: 'solitaire-klondike-state-v2-52cards-draw1'
  });

  const confirmBtn = document.getElementById('newDealConfirmBtn');
  const cancelBtn = document.getElementById('newDealCancelBtn');
  let registeringAbandonedDeal = false;
  let allowConfirmedRestart = false;

  function abandonedResult(state) {
    const elapsed = Math.max(0, Number(state?.elapsed) || 0);
    const moves = Math.max(0, Math.floor(Number(state?.moves) || 0));
    const score = Math.max(0, Math.floor(Number(state?.score) || 0));
    const variantId = String(state?.variantId || 'klondike');
    const cardStyle = document.getElementById('cardStyleSelect')?.value || 'essential';
    return {
      game: 'Solitario',
      gameSlug: 'solitaire',
      outcome: 'game-over',
      score,
      level: 1,
      activeMs: Math.round(elapsed * 1000),
      continueCount: 0,
      achievements: [],
      metrics: { moves, elapsed, variant: variantId, cardStyle, terminalReason: 'new-deal' }
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
    const currentScore = Math.max(0, Math.floor(Number(state?.score) || 0));
    if (currentScore <= 10 || !window.RWGLeaderboard?.getRunId) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    registeringAbandonedDeal = true;
    confirmBtn.disabled = true;
    if (cancelBtn) cancelBtn.disabled = true;

    const runId = window.RWGLeaderboard.getRunId();
    const onRegistered = registeredEvent => {
      if (registeredEvent.detail?.gameSlug !== 'solitaire' || registeredEvent.detail?.runId !== runId) return;
      window.removeEventListener('rwg:leaderboard-registered', onRegistered);
      finishRestart();
    };
    window.addEventListener('rwg:leaderboard-registered', onRegistered);
    window.dispatchEvent(new CustomEvent('rwg:leaderboard-result', { detail: abandonedResult(state) }));
  }, true);
})();