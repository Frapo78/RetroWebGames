(() => {
  'use strict';

  if (window.RWGAnalytics) return;

  const MEASUREMENT_ID = 'G-ZSWLC4L8GW';
  const isGame = document.body?.hasAttribute('data-rwg-game');
  const canonical = document.querySelector('link[rel="canonical"]')?.href || window.location.href;
  const pathname = new URL(canonical, window.location.href).pathname;
  const gameId = isGame ? (pathname.split('/').filter(Boolean).pop() || 'game') : '';
  const gameName = isGame ? ((document.title.split('—')[0] || gameId).trim()) : '';
  const pageKind = isGame ? 'game' : pathname.startsWith('/avatar') ? 'avatar' : 'hub';

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag(){ window.dataLayer.push(arguments); };

  if (!document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}"]`)) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    script.dataset.rwgGtag = 'true';
    document.head.appendChild(script);
  }

  window.gtag('js', new Date());
  window.gtag('config', MEASUREMENT_ID);

  const finite = value => Number.isFinite(Number(value));
  const number = value => finite(value) ? Number(value) : undefined;
  const bool = value => value ? 1 : 0;
  const clean = value => String(value ?? '').slice(0, 100);
  const base = () => ({ page_kind: pageKind, ...(isGame ? { game_id: gameId, game_name: gameName } : {}) });

  function compact(params = {}) {
    const out = {};
    for (const [key, value] of Object.entries({ ...base(), ...params })) {
      if (value === undefined || value === null || value === '') continue;
      out[key] = typeof value === 'string' ? clean(value) : value;
    }
    return out;
  }

  function track(name, params = {}) {
    try { window.gtag('event', name, compact(params)); } catch (_) {}
  }

  let gameStarted = false;
  let gameEnded = false;
  let gameplayActive = false;
  let gameplayPaused = false;
  let visibleStartedAt = 0;
  let accumulatedVisibleMs = 0;
  const engagementMilestones = new Set();
  const milestones = [30, 120, 300, 600, 1200];

  function variantName() {
    const select = document.getElementById('variantSelect');
    if (!select) return '';
    return select.options?.[select.selectedIndex]?.textContent?.trim() || select.value || '';
  }

  function resetEngagementClock() {
    accumulatedVisibleMs = 0;
    visibleStartedAt = 0;
    gameplayPaused = false;
    engagementMilestones.clear();
  }

  function startVisibleClock() {
    if (!gameplayActive || gameplayPaused || document.hidden || visibleStartedAt) return;
    visibleStartedAt = performance.now();
  }

  function stopVisibleClock() {
    if (!visibleStartedAt) return;
    accumulatedVisibleMs += Math.max(0, performance.now() - visibleStartedAt);
    visibleStartedAt = 0;
  }

  function beginEngagement(reason) {
    gameplayActive = true;
    gameplayPaused = false;
    startVisibleClock();
    if (reason) track('gameplay_begin', { start_type: reason, variant: variantName() });
  }

  function setGameplayPaused(paused) {
    gameplayPaused = Boolean(paused);
    if (gameplayPaused) stopVisibleClock();
    else startVisibleClock();
  }

  function stopEngagement() {
    stopVisibleClock();
    gameplayActive = false;
    gameplayPaused = false;
  }

  function activeSeconds() {
    const current = visibleStartedAt ? Math.max(0, performance.now() - visibleStartedAt) : 0;
    return Math.floor((accumulatedVisibleMs + current) / 1000);
  }

  function emitMilestones() {
    if (!gameplayActive || gameplayPaused || document.hidden) return;
    const seconds = activeSeconds();
    for (const milestone of milestones) {
      if (seconds < milestone || engagementMilestones.has(milestone)) continue;
      engagementMilestones.add(milestone);
      track('game_engagement', { milestone_seconds: milestone, current_level: number(document.getElementById('level')?.textContent) });
    }
  }
  setInterval(emitMilestones, 5000);

  function currentInProgress() {
    try { return Boolean(window.RWGResumeAdapter?.isInProgress?.()); } catch (_) { return gameplayActive; }
  }

  function startFreshTracked(startType, eventName = 'game_start') {
    gameStarted = true;
    gameEnded = false;
    resetEngagementClock();
    track(eventName, { variant: variantName(), start_type: startType });
    beginEngagement(startType);
  }

  function onReady() {
    track('rwg_page_context', { page_pathname: pathname });

    if (isGame) {
      track('game_intro_view', { variant: variantName() });

      const startBtn = document.getElementById('startBtn');
      startBtn?.addEventListener('click', () => {
        const label = startBtn.textContent.trim().toUpperCase();
        if (gameStarted && !gameEnded && (label.includes('RIPRENDI') || label === 'CONTINUA')) {
          setGameplayPaused(false);
          track('game_pause_toggle', { paused: 0, via: 'start_button' });
          return;
        }
        const restart = gameEnded || (gameStarted && (label.includes('RIGIOCA') || label.includes('NUOVA')));
        startFreshTracked(restart ? 'restart' : 'new', restart ? 'game_restart' : 'game_start');
      }, true);

      const levelEl = document.getElementById('level');
      if (levelEl) {
        let lastLevel = Number(String(levelEl.textContent).replace(/[^0-9.-]/g, '')) || 1;
        const observer = new MutationObserver(() => {
          const value = Number(String(levelEl.textContent).replace(/[^0-9.-]/g, ''));
          if (!Number.isFinite(value) || value === lastLevel || value < 1) return;
          lastLevel = value;
          track('level_reached', { level: value, active_seconds: activeSeconds() });
        });
        observer.observe(levelEl, { childList: true, characterData: true, subtree: true });
      }
    }
  }

  document.addEventListener('click', event => {
    const target = event.target?.closest?.('a,button');
    if (!target) return;

    const share = target.closest?.('[data-share],[data-network],[data-go-share]');
    if (share) {
      const method = share.dataset.share || share.dataset.network || share.dataset.goShare || 'native';
      track('share', { method, content_type: isGame ? 'game' : 'site', item_id: isGame ? gameId : 'retrowebgames' });
    }

    const card = target.closest?.('.game-card');
    if (card) {
      let selected = '';
      try { selected = new URL(card.href, window.location.href).pathname.split('/').filter(Boolean).pop() || ''; } catch (_) {}
      track('select_content', { content_type: 'game', item_id: selected });
    }

    if (isGame && target.matches?.('a[href="/"], .rwg-home-action, .rwg-back-games, a[aria-label*="Torna a RetroWebGames"]')) {
      track('game_exit', { in_progress: bool(currentInProgress()), active_seconds: activeSeconds() });
    }

    if (target.id === 'pauseBtn') {
      queueMicrotask(() => {
        const paused = target.textContent.trim() === '▶';
        setGameplayPaused(paused);
        track('game_pause_toggle', { paused: bool(paused), via: 'pause_button' });
      });
    }

    const controlMap = { undoBtn: 'undo', hintBtn: 'hint', newDealBtn: 'new_deal', calibrateBtn: 'calibrate', muteBtn: 'mute' };
    if (controlMap[target.id]) track('game_control', { control: controlMap[target.id] });
    if (target.closest?.('[href*="/avatar/"]')) track('profile_open', { source: pageKind });
  }, true);

  document.addEventListener('change', event => {
    const target = event.target;
    if (target?.id === 'variantSelect') track('game_variant_select', { variant: variantName() });
    if (target?.id === 'cardStyleSelect') track('game_control', { control: 'card_style', value: target.value });
  }, true);

  document.addEventListener('visibilitychange', () => {
    if (!gameplayActive) return;
    if (document.hidden) {
      stopVisibleClock();
      track('game_background', { active_seconds: activeSeconds() });
    } else {
      startVisibleClock();
    }
  });

  window.addEventListener('rwg:session-restored', event => {
    gameStarted = true;
    gameEnded = false;
    resetEngagementClock();
    track('game_resume', { saved_age_seconds: event.detail?.savedAt ? Math.max(0, Math.round((Date.now() - event.detail.savedAt) / 1000)) : undefined });
    beginEngagement('resume');
  });

  window.addEventListener('rwg:session-declined', () => {
    track('game_resume_declined');
    startFreshTracked('resume_declined');
  });

  window.addEventListener('rwg:session-restore-failed', () => {
    track('game_resume_failed');
    startFreshTracked('restore_failed');
  });

  window.addEventListener('rwg:continue-game', event => {
    gameStarted = true;
    gameEnded = false;
    track('game_continue', { score: number(event.detail?.score), active_seconds: activeSeconds() });
    beginEngagement('continue');
  });

  window.addEventListener('rwg:game-ended', event => {
    const d = event.detail || {};
    gameEnded = true;
    stopEngagement();
    track('game_end', {
      score: number(d.score), level: number(d.level), best: number(d.best), lines: number(d.lines),
      result: d.result, phase: d.phase, max_combo: number(d.maxCombo), max_rally: number(d.maxRally),
      continues: number(d.continues), active_seconds: activeSeconds()
    });
  });

  window.addEventListener('rwg:session-completed', event => {
    gameEnded = true;
    stopEngagement();
    track('game_complete', { score: number(event.detail?.score), level: number(event.detail?.level), active_seconds: activeSeconds() });
  });

  window.addEventListener('beforeinstallprompt', () => track('pwa_install_prompt'));
  window.addEventListener('appinstalled', () => track('pwa_install'));
  window.addEventListener('pagehide', () => {
    if (isGame && currentInProgress()) track('game_leave_in_progress', { active_seconds: activeSeconds() });
  }, { capture: true });

  window.RWGAnalytics = Object.freeze({ track, measurementId: MEASUREMENT_ID, pageKind, gameId, activeSeconds });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady, { once: true });
  else onReady();
})();
