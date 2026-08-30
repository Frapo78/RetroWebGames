(() => {
  'use strict';

  if (!document.body?.hasAttribute('data-rwg-game') || window.RWGPauseMenu) return;

  const pauseBtn = document.getElementById('pauseBtn');
  if (!pauseBtn) return;

  const canonical = document.querySelector('link[rel="canonical"]')?.href || location.href;
  const gameSlug = new URL(canonical, location.href).pathname.split('/').filter(Boolean).pop() || 'game';
  const gameName = (document.body.dataset.rwgGameName || gameSlug).trim();
  const MIN_ACTIVE_MS = 45_000;
  const POLICIES = Object.freeze({
    'block-drop': { minScoreExclusive: 100 },
    'bubble-burst': { minScoreExclusive: 100 },
    'maze-munch': { minScoreExclusive: 100 },
    'neon-rally': { minScoreExclusive: 0 },
    'neon-snake': { minScoreExclusive: 100 },
    'neon-tilt': { minScoreExclusive: 150 },
    'prism-breaker': { minScoreExclusive: 250 },
    'solitaire': { minScoreExclusive: 10 },
    'star-swarm': { minScoreExclusive: 500 }
  });
  const policy = POLICIES[gameSlug] || { minScoreExclusive: 100 };

  const numberFromText = value => {
    const raw = String(value ?? '').replace(/[^\d-]/g, '');
    return Number.isFinite(Number(raw)) ? Number(raw) : 0;
  };
  const snapshot = () => {
    try { return window.RWGResumeAdapter?.serialize?.() || {}; }
    catch (_) { return {}; }
  };
  const scoreFrom = state => {
    if (gameSlug === 'neon-rally') return Math.max(0, Math.floor(Number(state.playerScore) || 0));
    if (Number.isFinite(Number(state.score))) return Math.max(0, Math.floor(Number(state.score)));
    return Math.max(0, Math.floor(numberFromText(document.getElementById('score')?.textContent)));
  };
  const levelFrom = state => {
    if (Number.isFinite(Number(state.level))) return Math.max(1, Math.floor(Number(state.level)));
    return Math.max(1, Math.floor(numberFromText(document.getElementById('level')?.textContent) || 1));
  };
  const isPaused = () => pauseBtn.textContent.trim() === '▶' || /riprendi/i.test(pauseBtn.getAttribute('aria-label') || '');
  const inProgress = () => {
    try { return Boolean(window.RWGResumeAdapter?.isInProgress?.()); }
    catch (_) { return false; }
  };

  const runId = () => {
    try { return window.RWGLeaderboard?.getRunId?.() || ''; }
    catch (_) { return ''; }
  };
  let trackedRun = '';
  let activeMs = 0;
  let lastTick = performance.now();
  let lastPersist = 0;

  const storageKey = id => `rwg.pause.active.v1:${gameSlug}:${id || 'pending'}`;
  const loadTrackedTime = id => {
    try { return Math.max(0, Number(localStorage.getItem(storageKey(id))) || 0); }
    catch (_) { return 0; }
  };
  const persistTrackedTime = () => {
    if (!trackedRun) return;
    try { localStorage.setItem(storageKey(trackedRun), String(Math.round(activeMs))); } catch (_) {}
  };
  const resetTrackedTime = id => {
    trackedRun = id || runId();
    activeMs = 0;
    lastTick = performance.now();
    lastPersist = lastTick;
    if (trackedRun) {
      try { localStorage.removeItem(storageKey(trackedRun)); } catch (_) {}
    }
  };
  const syncRun = () => {
    const current = runId();
    if (!current || current === trackedRun) return;
    trackedRun = current;
    activeMs = loadTrackedTime(current);
    lastTick = performance.now();
    lastPersist = lastTick;
  };
  const stateDurationMs = state => {
    const seconds = Math.max(
      Number.isFinite(Number(state.elapsed)) ? Number(state.elapsed) : 0,
      Number.isFinite(Number(state.totalTime)) ? Number(state.totalTime) : 0
    );
    return Math.max(0, seconds * 1000);
  };
  const tick = () => {
    syncRun();
    const now = performance.now();
    const delta = Math.min(1500, Math.max(0, now - lastTick));
    lastTick = now;
    if (!document.hidden && inProgress() && !isPaused()) activeMs += delta;
    if (now - lastPersist >= 5000) {
      persistTrackedTime();
      lastPersist = now;
    }
  };
  setInterval(tick, 500);

  document.getElementById('solitairePauseOverlay')?.remove();

  const overlay = document.createElement('section');
  overlay.id = 'rwgPauseMenu';
  overlay.className = 'rwg-pause-menu';
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'rwgPauseTitle');
  overlay.innerHTML = `
    <div class="rwg-pause-card">
      <div class="rwg-pause-kicker">RETROWEBGAMES • ${gameName.toUpperCase()}</div>
      <h2 id="rwgPauseTitle">GIOCO IN PAUSA</h2>
      <p class="rwg-pause-copy" data-rwg-pause-copy>La partita è al sicuro. Puoi riprendere quando vuoi.</p>
      <div class="rwg-pause-stats" data-rwg-pause-stats></div>
      <div class="rwg-pause-actions" data-rwg-pause-actions>
        <button type="button" class="rwg-pause-resume" data-rwg-pause-resume>▶ <span>RIPRENDI</span></button>
        <button type="button" class="rwg-pause-end" data-rwg-pause-end>■ <span>TERMINA PARTITA</span></button>
      </div>
      <div class="rwg-pause-confirm" data-rwg-pause-confirm hidden></div>
    </div>`;
  document.body.appendChild(overlay);

  const copy = overlay.querySelector('[data-rwg-pause-copy]');
  const stats = overlay.querySelector('[data-rwg-pause-stats]');
  const actions = overlay.querySelector('[data-rwg-pause-actions]');
  const confirm = overlay.querySelector('[data-rwg-pause-confirm]');
  const resumeBtn = overlay.querySelector('[data-rwg-pause-resume]');
  const endBtn = overlay.querySelector('[data-rwg-pause-end]');
  let confirmStage = 0;
  let terminating = false;

  const eligibility = () => {
    const state = snapshot();
    const score = scoreFrom(state);
    const duration = Math.max(activeMs, stateDurationMs(state));
    return {
      state,
      score,
      level: levelFrom(state),
      activeMs: duration,
      eligible: score > policy.minScoreExclusive && duration >= MIN_ACTIVE_MS
    };
  };
  const formatDuration = ms => {
    const seconds = Math.floor(ms / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  };
  const renderStats = () => {
    const info = eligibility();
    stats.innerHTML = `
      <div><span>PUNTEGGIO</span><strong>${info.score.toLocaleString('it-IT')}</strong></div>
      <div><span>TEMPO ATTIVO</span><strong>${formatDuration(info.activeMs)}</strong></div>`;
  };
  const resetConfirm = () => {
    confirmStage = 0;
    confirm.hidden = true;
    confirm.replaceChildren();
    actions.hidden = false;
    copy.textContent = 'La partita è al sicuro. Puoi riprendere quando vuoi.';
  };
  const sync = () => {
    const visible = isPaused() && inProgress() && !document.body.classList.contains('rwg-game-over-open');
    overlay.hidden = !visible;
    document.documentElement.classList.toggle('rwg-shared-pause-open', visible);
    if (visible) renderStats();
    else if (!terminating) resetConfirm();
  };

  const terminalDetail = info => {
    const state = info.state || {};
    const metrics = { terminalReason: 'pause-terminate', interrupted: true };
    for (const key of ['moves','lines','foods','combo','playerScore','cpuScore','rally']) {
      if (Number.isFinite(Number(state[key]))) metrics[key] = Number(state[key]);
    }
    return {
      game: gameName,
      gameSlug,
      outcome: 'game-over',
      score: info.score,
      level: info.level,
      activeMs: Math.round(info.activeMs),
      continueCount: 0,
      achievements: [],
      terminalReason: 'pause-terminate',
      metrics
    };
  };
  const clearAndReload = () => {
    persistTrackedTime();
    if (trackedRun) {
      try { localStorage.removeItem(storageKey(trackedRun)); } catch (_) {}
    }
    window.RWGSession?.clear?.();
    window.dispatchEvent(new CustomEvent('rwg:game-ended', { detail: { terminalReason: 'pause-terminate' } }));
    location.reload();
  };
  const finalizeTermination = () => {
    if (terminating) return;
    terminating = true;
    const info = eligibility();
    const detail = terminalDetail(info);
    actions.hidden = true;
    confirm.hidden = false;
    confirm.innerHTML = `<p class="rwg-pause-finalizing">${info.eligible ? 'REGISTRAZIONE PUNTEGGIO…' : 'PARTITA TERMINATA'}</p>`;

    window.RWGAnalytics?.track?.('pause_terminate', {
      game: gameSlug,
      eligible: Number(info.eligible),
      score: info.score,
      active_seconds: Math.floor(info.activeMs / 1000)
    });

    if (!info.eligible) {
      setTimeout(clearAndReload, 350);
      return;
    }

    const expectedRun = runId();
    const onRegistered = event => {
      const d = event.detail || {};
      if (d.gameSlug !== gameSlug || (expectedRun && d.runId !== expectedRun)) return;
      window.removeEventListener('rwg:leaderboard-registered', onRegistered);
      clearAndReload();
    };
    window.addEventListener('rwg:leaderboard-registered', onRegistered);
    window.dispatchEvent(new CustomEvent('rwg:leaderboard-result', { detail }));
  };

  const showConfirmation = stage => {
    confirmStage = stage;
    actions.hidden = true;
    confirm.hidden = false;
    const info = eligibility();
    const eligibilityCopy = info.eligible
      ? `Il punteggio sarà registrato negli High Scores (${info.score.toLocaleString('it-IT')} punti, ${formatDuration(info.activeMs)} di gioco attivo).`
      : `Il risultato non entrerà negli High Scores: servono più di ${policy.minScoreExclusive.toLocaleString('it-IT')} punti e almeno 0:45 di gioco attivo.`;

    if (stage === 1) {
      copy.textContent = 'Terminare significa chiudere definitivamente la partita in corso.';
      confirm.innerHTML = `
        <p>${eligibilityCopy}</p>
        <div class="rwg-pause-confirm-actions">
          <button type="button" data-rwg-cancel>ANNULLA</button>
          <button type="button" class="danger" data-rwg-next>SÌ, TERMINA</button>
        </div>`;
      confirm.querySelector('[data-rwg-cancel]').addEventListener('click', resetConfirm);
      confirm.querySelector('[data-rwg-next]').addEventListener('click', () => showConfirmation(2));
    } else {
      copy.textContent = 'Ultima conferma: questa operazione non può essere annullata.';
      confirm.innerHTML = `
        <p>La partita corrente verrà chiusa e il salvataggio eliminato.</p>
        <div class="rwg-pause-confirm-actions">
          <button type="button" data-rwg-back>INDIETRO</button>
          <button type="button" class="danger strong" data-rwg-final>CONFERMA DEFINITIVA</button>
        </div>`;
      confirm.querySelector('[data-rwg-back]').addEventListener('click', () => showConfirmation(1));
      confirm.querySelector('[data-rwg-final]').addEventListener('click', finalizeTermination);
    }
  };

  resumeBtn.addEventListener('click', () => {
    resetConfirm();
    pauseBtn.click();
    requestAnimationFrame(sync);
  });
  endBtn.addEventListener('click', () => showConfirmation(1));

  const observer = new MutationObserver(() => requestAnimationFrame(sync));
  observer.observe(pauseBtn, { attributes: true, attributeFilter: ['aria-label'], childList: true, subtree: true });
  document.addEventListener('visibilitychange', () => requestAnimationFrame(sync));
  window.addEventListener('rwg:continue-game', () => { terminating = false; resetConfirm(); requestAnimationFrame(sync); });
  window.addEventListener('rwg:game-session-start', () => {
    terminating = false;
    resetTrackedTime('');
    queueMicrotask(() => { syncRun(); sync(); });
  });
  window.addEventListener('rwg:game-ended', () => {
    if (trackedRun) {
      try { localStorage.removeItem(storageKey(trackedRun)); } catch (_) {}
    }
    overlay.hidden = true;
    document.documentElement.classList.remove('rwg-shared-pause-open');
  });

  syncRun();
  sync();

  window.RWGPauseMenu = Object.freeze({
    minActiveMs: MIN_ACTIVE_MS,
    policy: Object.freeze({ ...policy }),
    eligibility,
    sync
  });
})();