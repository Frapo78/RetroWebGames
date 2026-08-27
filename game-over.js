(() => {
  'use strict';

  if (!document.body?.hasAttribute('data-rwg-game')) return;
  if (document.querySelector('.rwg-game-over-layer')) return;

  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  if (!overlay || !startBtn) return;

  const canonical = document.querySelector('link[rel="canonical"]')?.href || window.location.href;
  const gameName = (document.title.split('—')[0] || 'RetroWebGames').trim();
  const gameSlug = new URL(canonical, window.location.href).pathname.split('/').filter(Boolean).pop() || 'game';
  const HOME_URL = 'https://www.retrowebgames.it/';
  const q = encodeURIComponent;

  const fallbackCoin = `
    <svg class="rwg-modal-coin" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="13.2" fill="#d98a10"/>
      <circle cx="16" cy="16" r="10.7" fill="#ffe45b" stroke="#9b5b08" stroke-width="1.2"/>
      <path d="M11 10.5h7.1c2.55 0 4.4 1.38 4.4 3.56 0 1.43-.78 2.5-2.02 3.04 1.48.48 2.42 1.67 2.42 3.23 0 2.55-2.12 4.17-5.2 4.17H11v-14Zm4.02 2.8v2.63h2.48c.9 0 1.45-.48 1.45-1.3 0-.84-.55-1.33-1.45-1.33h-2.48Zm0 5.25v3.08h2.82c1.02 0 1.62-.58 1.62-1.53 0-.97-.62-1.55-1.68-1.55h-2.76Z" fill="#6f3805"/>
    </svg>`;
  const coinSvg = () => window.RWGProfile?.coinSvg?.('rwg-modal-coin') || fallbackCoin;

  const icons = {
    whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.04 2a9.84 9.84 0 0 0-8.42 14.93L2.05 22l5.2-1.52A9.95 9.95 0 1 0 12.04 2Zm0 17.86a8.02 8.02 0 0 1-4.09-1.12l-.29-.17-3.08.9.92-3-.19-.31a7.9 7.9 0 1 1 6.73 3.7Zm4.4-5.92c-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.37-1.94-1.19a7.28 7.28 0 0 1-1.34-1.67c-.14-.24-.01-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.19-.47-.39-.41-.54-.42h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.1 3.62.57.25 1.02.39 1.37.5.58.18 1.1.16 1.51.1.46-.07 1.43-.58 1.63-1.15.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.7 22v-9h3l.45-3.5H13.7V7.26c0-1.01.28-1.7 1.74-1.7h1.86V2.43c-.32-.04-1.43-.13-2.72-.13-2.7 0-4.55 1.65-4.55 4.68V9.5H7v3.5h3.03v9h3.67Z"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.9 2H22l-6.77 7.74L23.2 22h-6.24l-4.89-6.39L6.48 22H3.36l7.26-8.3L2.98 2h6.4l4.42 5.84L18.9 2Zm-1.1 17.84h1.72L8.45 4.05H6.6L17.8 19.84Z"/></svg>',
    telegram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21.7 3.2-3.2 15.1c-.24 1.07-.87 1.33-1.76.83l-4.88-3.6-2.35 2.27c-.26.26-.48.48-.98.48l.35-4.97 9.04-8.17c.39-.35-.09-.55-.61-.2L6.14 11.97 1.32 10.46C.27 10.13.25 9.41 1.54 8.9L20.4 1.63c.87-.32 1.64.2 1.3 1.57Z"/></svg>',
    more: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 16a3 3 0 0 0-2.39 1.19l-6.7-3.35a3.1 3.1 0 0 0 0-1.68l6.7-3.35A3 3 0 1 0 15 7c0 .25.03.49.09.72l-6.7 3.35a3 3 0 1 0 0 3.86l6.7 3.35A3 3 0 1 0 18 16Z"/></svg>'
  };

  if (!window.RWGContinueProvider) {
    window.RWGContinueProvider = {
      mode: 'unavailable',
      async requestContinue() {
        window.RWGProfile?.showInsufficientCredits?.(1);
        return { granted: false, reason: 'provider-unavailable', costCredits: 1 };
      }
    };
  }

  let sessionActive = false;
  let activeMs = 0;
  let lastTick = performance.now();
  let startingBest = 0;
  let maxCombo = 1;
  let maxRally = 0;
  let summaryShown = false;
  let continueCount = 0;
  let introRunning = false;
  let introTimer = 0;
  let introSkipHandler = null;
  let achievementRaf = 0;

  const intro = document.createElement('section');
  intro.className = 'rwg-game-over-intro';
  intro.hidden = true;
  intro.setAttribute('aria-label', 'Game over');
  intro.innerHTML = `
    <div class="rwg-game-over-stamp" aria-hidden="true">GAME OVER</div>
    <div class="rwg-game-over-skip">TOCCA PER CONTINUARE</div>`;
  document.body.appendChild(intro);

  const layer = document.createElement('section');
  layer.className = 'rwg-game-over-layer';
  layer.hidden = true;
  layer.setAttribute('role', 'dialog');
  layer.setAttribute('aria-modal', 'true');
  layer.setAttribute('aria-labelledby', 'rwgGameOverTitle');
  layer.innerHTML = `
    <div class="rwg-game-over-card">
      <div class="rwg-game-over-topline">
        <div class="rwg-game-over-brand">RETROWEBGAMES</div>
        <p class="rwg-game-over-kicker">PARTITA TERMINATA</p>
      </div>
      <h2 id="rwgGameOverTitle"></h2>
      <p class="rwg-game-over-scoreline"></p>

      <div class="rwg-game-over-stats" aria-label="Riepilogo partita"></div>

      <section class="rwg-achievements" hidden>
        <div class="rwg-section-title">ACHIEVEMENTS</div>
        <div class="rwg-achievement-viewport" tabindex="0" aria-label="Achievement ottenuti">
          <div class="rwg-achievement-list"></div>
        </div>
      </section>

      <section class="rwg-challenge-box">
        <div class="rwg-share-prompt">Condividi il tuo risultato!</div>
        <div class="rwg-game-over-share">
          <a data-go-share="whatsapp" class="rwg-go-share rwg-go-whatsapp" target="_blank" rel="noopener noreferrer" aria-label="Condividi su WhatsApp">${icons.whatsapp}</a>
          <a data-go-share="facebook" class="rwg-go-share rwg-go-facebook" target="_blank" rel="noopener noreferrer" aria-label="Condividi su Facebook">${icons.facebook}</a>
          <a data-go-share="x" class="rwg-go-share rwg-go-x" target="_blank" rel="noopener noreferrer" aria-label="Condividi su X">${icons.x}</a>
          <a data-go-share="telegram" class="rwg-go-share rwg-go-telegram" target="_blank" rel="noopener noreferrer" aria-label="Condividi su Telegram">${icons.telegram}</a>
          <button data-go-share="more" class="rwg-go-share rwg-go-more" type="button" aria-label="Altre opzioni di condivisione">${icons.more}</button>
        </div>
      </section>

      <section class="rwg-credits-slot" data-rwg-credits-slot hidden aria-label="Acquista crediti"></section>

      <div class="rwg-continue-box">
        <button class="rwg-continue-credit" type="button">
          <span>Continua con 1</span>${coinSvg()}
        </button>
        <span>Mantieni punteggio e progresso</span>
      </div>

      <div class="rwg-game-over-actions">
        <button class="rwg-play-again" type="button">Nuova partita</button>
        <a class="rwg-back-games" href="${HOME_URL}">Tutti i giochi</a>
      </div>
      <div class="rwg-game-over-credit">Made with 💙 by Francesco Poltero</div>
    </div>`;
  document.body.appendChild(layer);

  const titleEl = layer.querySelector('#rwgGameOverTitle');
  const scorelineEl = layer.querySelector('.rwg-game-over-scoreline');
  const statsEl = layer.querySelector('.rwg-game-over-stats');
  const achievementsSection = layer.querySelector('.rwg-achievements');
  const achievementsViewport = layer.querySelector('.rwg-achievement-viewport');
  const achievementsEl = layer.querySelector('.rwg-achievement-list');
  const continueBtn = layer.querySelector('.rwg-continue-credit');
  const playAgain = layer.querySelector('.rwg-play-again');
  const moreShare = layer.querySelector('[data-go-share="more"]');

  const parseNumber = (el, fallback = 0) => {
    if (!el) return fallback;
    const raw = String(el.textContent || '').replace(/[^0-9-]/g, '');
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  };

  const formatNumber = n => Number(n || 0).toLocaleString('it-IT');
  const formatDuration = ms => {
    const total = Math.max(0, Math.round(ms / 1000));
    const min = Math.floor(total / 60);
    const sec = total % 60;
    return min ? `${min}:${String(sec).padStart(2, '0')}` : `${sec}s`;
  };

  const getScore = () => {
    const score = document.getElementById('score');
    if (score) return parseNumber(score);
    const playerScore = document.getElementById('playerScore');
    if (playerScore) return parseNumber(playerScore);
    return 0;
  };

  const isOverlayVisible = () => overlay.classList.contains('visible');
  const isPaused = () => pauseBtn && pauseBtn.textContent.trim() === '▶';
  const orientationBlocked = () => {
    const countdown = document.getElementById('rwgResumeCountdown');
    return document.body.classList.contains('rwg-landscape-blocked') || Boolean(countdown && !countdown.hidden);
  };

  const canCountTime = () =>
    sessionActive &&
    !document.hidden &&
    !isOverlayVisible() &&
    !isPaused() &&
    !orientationBlocked() &&
    layer.hidden &&
    intro.hidden;

  const tick = now => {
    const dt = Math.max(0, Math.min(1000, now - lastTick));
    if (canCountTime()) activeMs += dt;
    lastTick = now;

    const combo = parseNumber(document.getElementById('combo'), 1);
    if (combo > maxCombo) maxCombo = combo;
    const rally = parseNumber(document.getElementById('rally'));
    if (rally > maxRally) maxRally = rally;

    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  const stopAchievementMarquee = () => {
    cancelAnimationFrame(achievementRaf);
    achievementRaf = 0;
  };

  const startAchievementMarquee = () => {
    stopAchievementMarquee();
    achievementsViewport.scrollLeft = 0;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    requestAnimationFrame(() => {
      const maxScroll = achievementsViewport.scrollWidth - achievementsViewport.clientWidth;
      if (maxScroll <= 2) return;

      let direction = 1;
      let lastFrame = performance.now();
      let pauseUntil = lastFrame + 650;
      const speed = 28;

      const move = now => {
        if (layer.hidden) return;
        const max = achievementsViewport.scrollWidth - achievementsViewport.clientWidth;
        const dt = Math.min(50, now - lastFrame) / 1000;
        if (now >= pauseUntil) {
          achievementsViewport.scrollLeft += direction * speed * dt;
          if (achievementsViewport.scrollLeft >= max - 1) {
            achievementsViewport.scrollLeft = max;
            direction = -1;
            pauseUntil = now + 650;
          } else if (achievementsViewport.scrollLeft <= 1) {
            achievementsViewport.scrollLeft = 0;
            direction = 1;
            pauseUntil = now + 650;
          }
        }
        lastFrame = now;
        achievementRaf = requestAnimationFrame(move);
      };
      achievementRaf = requestAnimationFrame(move);
    });
  };

  const resetPresentation = () => {
    clearTimeout(introTimer);
    if (introSkipHandler) intro.removeEventListener('pointerdown', introSkipHandler);
    introSkipHandler = null;
    introRunning = false;
    intro.hidden = true;
    intro.classList.remove('is-active', 'is-exiting');
    layer.classList.remove('is-revealing');
    stopAchievementMarquee();
  };

  const beginSession = () => {
    resetPresentation();
    sessionActive = true;
    summaryShown = false;
    activeMs = 0;
    maxCombo = 1;
    maxRally = 0;
    continueCount = 0;
    startingBest = parseNumber(document.getElementById('best'));
    lastTick = performance.now();
    layer.hidden = true;
    document.body.classList.remove('rwg-game-over-open');
    window.dispatchEvent(new CustomEvent('rwg:game-session-start', {
      detail: { game: gameName, gameSlug, url: canonical }
    }));
  };

  startBtn.addEventListener('click', () => {
    const label = startBtn.textContent.trim().toUpperCase();
    if (label === 'GIOCA' || label === 'RIGIOCA') beginSession();
  }, true);

  const achievementDefinitions = stats => [
    { id: 'record', label: 'Nuovo record', icon: '★', earned: stats.score > startingBest && stats.score > 0 },
    { id: '1k', label: 'Quota 1.000', icon: '⚡', earned: stats.score >= 1000 },
    { id: '5k', label: 'Quota 5.000', icon: '◆', earned: stats.score >= 5000 },
    { id: 'level3', label: 'Livello 3+', icon: '▲', earned: stats.level >= 3 },
    { id: 'marathon', label: '3 minuti', icon: '◷', earned: stats.activeMs >= 180000 },
    { id: 'combo5', label: 'Combo ×5', icon: '✦', earned: maxCombo >= 5 },
    { id: 'lines10', label: '10 linee', icon: '▦', earned: stats.lines >= 10 },
    { id: 'rally10', label: 'Rally 10+', icon: '↔', earned: maxRally >= 10 }
  ];

  const getAchievements = stats => {
    const storageKey = `rwgAchievements:${gameSlug}`;
    let unlocked = [];
    try { unlocked = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch (_) {}
    const unlockedSet = new Set(Array.isArray(unlocked) ? unlocked : []);
    const earned = achievementDefinitions(stats)
      .filter(item => item.earned)
      .map(item => ({ ...item, isNew: !unlockedSet.has(item.id) }));
    earned.forEach(item => unlockedSet.add(item.id));
    try { localStorage.setItem(storageKey, JSON.stringify([...unlockedSet])); } catch (_) {}
    return earned;
  };

  const metric = (label, value, accent = false) => `
    <div class="rwg-go-stat${accent ? ' accent' : ''}">
      <span>${label}</span><strong>${value}</strong>
    </div>`;

  const collectStats = () => {
    const score = getScore();
    const levelNode = document.getElementById('level');
    const level = levelNode ? Math.max(1, parseNumber(levelNode, 1)) : 0;
    const lines = parseNumber(document.getElementById('lines'));
    const playerScore = parseNumber(document.getElementById('playerScore'));
    const cpuScore = parseNumber(document.getElementById('cpuScore'));
    const best = Math.max(startingBest, parseNumber(document.getElementById('best')), score);
    return {
      score,
      level,
      levelsCleared: level ? Math.max(0, level - 1) : null,
      lines,
      playerScore,
      cpuScore,
      best,
      activeMs,
      continueCount
    };
  };

  const shareTextFor = stats => {
    const base = `Ho realizzato ${formatNumber(stats.score)} punti su ${gameName}! Tu riesci a fare di meglio?`;
    if (!stats.continueCount) return base;
    const suffix = stats.continueCount === 1
      ? ' Ho usato 1 continuazione.'
      : ` Ho usato ${stats.continueCount} continuazioni.`;
    return base + suffix;
  };

  const setShareLinks = text => {
    const urls = {
      whatsapp: `https://wa.me/?text=${q(`${text} ${canonical}`)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${q(canonical)}`,
      x: `https://twitter.com/intent/tweet?text=${q(text)}&url=${q(canonical)}`,
      telegram: `https://t.me/share/url?url=${q(canonical)}&text=${q(text)}`
    };
    Object.entries(urls).forEach(([network, href]) => {
      const el = layer.querySelector(`[data-go-share="${network}"]`);
      if (el) el.href = href;
    });
  };

  const prepareSummary = () => {
    const stats = collectStats();
    const achievements = getAchievements(stats);
    const shareText = shareTextFor(stats);

    titleEl.textContent = gameName;
    scorelineEl.innerHTML = `<strong>${formatNumber(stats.score)}</strong> punti`;

    const metrics = [
      metric('Punti', formatNumber(stats.score), true),
      stats.levelsCleared !== null ? metric('Livelli superati', stats.levelsCleared) : '',
      stats.lines > 0 ? metric('Linee', stats.lines) : '',
      document.getElementById('playerScore') ? metric('Risultato', `${stats.playerScore}–${stats.cpuScore}`) : '',
      stats.continueCount > 0 ? metric('Continue usati', stats.continueCount) : '',
      metric('Tempo', formatDuration(stats.activeMs)),
      metric('Record', formatNumber(stats.best))
    ].filter(Boolean);
    statsEl.innerHTML = metrics.join('');

    achievementsEl.innerHTML = '';
    if (achievements.length) {
      achievementsSection.hidden = false;
      achievements.forEach(item => {
        const chip = document.createElement('span');
        chip.className = `rwg-achievement${item.isNew ? ' is-new' : ''}`;
        chip.innerHTML = `<i>${item.icon}</i><b>${item.label}</b>${item.isNew ? '<em>NEW</em>' : ''}`;
        achievementsEl.appendChild(chip);
      });
    } else {
      achievementsSection.hidden = true;
    }

    setShareLinks(shareText);

    const detail = {
      game: gameName,
      gameSlug,
      url: canonical,
      ...stats,
      achievements: achievements.map(({ id, label, isNew }) => ({ id, label, isNew }))
    };
    window.dispatchEvent(new CustomEvent('rwg:game-over-summary', { detail }));
  };

  const revealSummary = () => {
    if (!introRunning) return;
    introRunning = false;
    clearTimeout(introTimer);
    if (introSkipHandler) intro.removeEventListener('pointerdown', introSkipHandler);
    introSkipHandler = null;

    layer.hidden = false;
    layer.classList.add('is-revealing');
    intro.classList.add('is-exiting');
    document.body.classList.add('rwg-game-over-open');
    setTimeout(startAchievementMarquee, 80);

    setTimeout(() => {
      intro.hidden = true;
      intro.classList.remove('is-active', 'is-exiting');
      layer.classList.remove('is-revealing');
    }, 1000);
  };

  const showSummary = () => {
    if (!sessionActive || summaryShown || introRunning) return;
    summaryShown = true;
    sessionActive = false;
    prepareSummary();

    layer.hidden = true;
    introRunning = true;
    intro.hidden = false;
    intro.classList.remove('is-active', 'is-exiting');
    document.body.classList.add('rwg-game-over-open');

    requestAnimationFrame(() => requestAnimationFrame(() => intro.classList.add('is-active')));
    introSkipHandler = () => revealSummary();
    intro.addEventListener('pointerdown', introSkipHandler, { once: true });
    introTimer = setTimeout(revealSummary, 2000);
  };

  const checkGameOver = () => {
    const label = startBtn.textContent.trim().toUpperCase();
    if (sessionActive && isOverlayVisible() && label === 'RIGIOCA') showSummary();
  };

  new MutationObserver(checkGameOver).observe(overlay, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(checkGameOver).observe(startBtn, { childList: true, characterData: true, subtree: true });

  continueBtn.addEventListener('click', async () => {
    const stats = collectStats();
    continueBtn.disabled = true;
    try {
      const provider = window.RWGContinueProvider;
      const grant = await provider.requestContinue({
        game: gameName,
        gameSlug,
        url: canonical,
        score: stats.score,
        continueCount,
        creditsSlot: layer.querySelector('[data-rwg-credits-slot]')
      });

      if (!grant?.granted) return;

      continueCount++;
      summaryShown = false;
      sessionActive = true;
      lastTick = performance.now();
      layer.hidden = true;
      layer.classList.remove('is-revealing');
      stopAchievementMarquee();
      document.body.classList.remove('rwg-game-over-open');

      window.dispatchEvent(new CustomEvent('rwg:continue-game', {
        detail: {
          game: gameName,
          gameSlug,
          url: canonical,
          mode: grant.mode || provider.mode || 'credits',
          penalty: Number.isFinite(grant.penalty) ? grant.penalty : 1,
          costCredits: Number(grant.costCredits || 0),
          remainingCredits: Number(grant.remainingCredits ?? window.RWGProfile?.getCredits?.() ?? 0),
          continueCount,
          previousScore: stats.score,
          score: Number.isFinite(grant.score) ? Math.max(0, Math.floor(grant.score)) : stats.score
        }
      }));
    } finally {
      continueBtn.disabled = false;
    }
  });

  playAgain.addEventListener('click', () => {
    layer.hidden = true;
    layer.classList.remove('is-revealing');
    stopAchievementMarquee();
    document.body.classList.remove('rwg-game-over-open');
    window.dispatchEvent(new CustomEvent('rwg:game-replay', {
      detail: { game: gameName, gameSlug, url: canonical, previousContinues: continueCount }
    }));
    startBtn.click();
  });

  moreShare?.addEventListener('click', async () => {
    const stats = collectStats();
    const text = shareTextFor(stats);
    if (navigator.share) {
      try {
        await navigator.share({ title: `${gameName} — RetroWebGames`, text, url: canonical });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${canonical}`);
      moreShare.classList.add('is-copied');
      moreShare.setAttribute('aria-label', 'Link copiato');
      setTimeout(() => {
        moreShare.classList.remove('is-copied');
        moreShare.setAttribute('aria-label', 'Altre opzioni di condivisione');
      }, 1500);
    } catch (_) {
      window.location.href = `mailto:?subject=${q(`${gameName} — RetroWebGames`)}&body=${q(`${text}\n\n${canonical}`)}`;
    }
  });

  window.RWGGameOver = Object.freeze({
    open: showSummary,
    close: () => {
      resetPresentation();
      layer.hidden = true;
      document.body.classList.remove('rwg-game-over-open');
    },
    getSession: () => ({
      game: gameName,
      gameSlug,
      url: canonical,
      activeMs,
      active: sessionActive,
      continueCount
    }),
    getCreditsSlot: () => layer.querySelector('[data-rwg-credits-slot]')
  });
})();
