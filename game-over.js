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

  let sessionActive = false;
  let activeMs = 0;
  let lastTick = performance.now();
  let startingBest = 0;
  let maxCombo = 1;
  let maxRally = 0;
  let summaryShown = false;
  let continueCount = 0;

  const layer = document.createElement('section');
  layer.className = 'rwg-game-over-layer';
  layer.hidden = true;
  layer.setAttribute('role', 'dialog');
  layer.setAttribute('aria-modal', 'true');
  layer.setAttribute('aria-labelledby', 'rwgGameOverTitle');
  layer.innerHTML = `
    <div class="rwg-game-over-card">
      <div class="rwg-game-over-brand">RETROWEBGAMES</div>
      <p class="rwg-game-over-kicker">PARTITA TERMINATA</p>
      <h2 id="rwgGameOverTitle"></h2>
      <p class="rwg-game-over-scoreline"></p>

      <div class="rwg-game-over-stats" aria-label="Riepilogo partita"></div>

      <section class="rwg-achievements" hidden>
        <div class="rwg-section-title">ACHIEVEMENTS</div>
        <div class="rwg-achievement-list"></div>
      </section>

      <section class="rwg-challenge-box">
        <div class="rwg-section-title">SFIDA I TUOI AMICI</div>
        <p class="rwg-challenge-copy"></p>
        <div class="rwg-game-over-share">
          <a data-go-share="whatsapp" class="rwg-go-share rwg-go-whatsapp" target="_blank" rel="noopener noreferrer" aria-label="Condividi su WhatsApp">WhatsApp</a>
          <a data-go-share="facebook" class="rwg-go-share" target="_blank" rel="noopener noreferrer" aria-label="Condividi su Facebook">Facebook</a>
          <a data-go-share="x" class="rwg-go-share" target="_blank" rel="noopener noreferrer" aria-label="Condividi su X">X</a>
          <a data-go-share="telegram" class="rwg-go-share" target="_blank" rel="noopener noreferrer" aria-label="Condividi su Telegram">Telegram</a>
          <button data-go-share="more" class="rwg-go-share" type="button" aria-label="Altre opzioni di condivisione">Altro</button>
        </div>
      </section>

      <section class="rwg-credits-slot" data-rwg-credits-slot hidden aria-label="Continua con crediti"></section>

      <div class="rwg-continue-box">
        <button class="rwg-continue-free" type="button">Continua gratis</button>
        <span>Riparti da qui con il <strong>50% dei punti</strong></span>
      </div>

      <div class="rwg-game-over-actions">
        <button class="rwg-play-again" type="button">Gioca ancora</button>
        <a class="rwg-back-games" href="${HOME_URL}">Tutti i giochi</a>
      </div>
      <div class="rwg-game-over-credit">Made with 💙 by Francesco Poltero</div>
    </div>`;
  document.body.appendChild(layer);

  const titleEl = layer.querySelector('#rwgGameOverTitle');
  const scorelineEl = layer.querySelector('.rwg-game-over-scoreline');
  const statsEl = layer.querySelector('.rwg-game-over-stats');
  const achievementsSection = layer.querySelector('.rwg-achievements');
  const achievementsEl = layer.querySelector('.rwg-achievement-list');
  const challengeEl = layer.querySelector('.rwg-challenge-copy');
  const continueBtn = layer.querySelector('.rwg-continue-free');
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
  const orientationBlocked = () => document.body.classList.contains('rwg-landscape-blocked') ||
    !document.getElementById('rwgResumeCountdown')?.hidden;

  const canCountTime = () => sessionActive && !document.hidden && !isOverlayVisible() && !isPaused() && !orientationBlocked() && layer.hidden;

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

  const beginSession = () => {
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
    window.dispatchEvent(new CustomEvent('rwg:game-session-start', { detail: { game: gameName, url: canonical } }));
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
    const earned = achievementDefinitions(stats).filter(item => item.earned).map(item => ({ ...item, isNew: !unlockedSet.has(item.id) }));
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
    return { score, level, levelsCleared: level ? Math.max(0, level - 1) : null, lines, playerScore, cpuScore, best, activeMs };
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

  const showSummary = () => {
    if (!sessionActive || summaryShown) return;
    summaryShown = true;
    sessionActive = false;
    const stats = collectStats();
    const achievements = getAchievements(stats);
    const shareText = `Ho realizzato ${formatNumber(stats.score)} punti su ${gameName}! Tu riesci a fare di meglio?`;

    titleEl.textContent = gameName;
    scorelineEl.innerHTML = `<strong>${formatNumber(stats.score)}</strong> punti`;

    const metrics = [
      metric('Punti', formatNumber(stats.score), true),
      stats.levelsCleared !== null ? metric('Livelli superati', stats.levelsCleared) : '',
      stats.lines > 0 ? metric('Linee', stats.lines) : '',
      document.getElementById('playerScore') ? metric('Risultato', `${stats.playerScore}–${stats.cpuScore}`) : '',
      metric('Tempo di gioco', formatDuration(stats.activeMs)),
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

    challengeEl.textContent = `${shareText} ${canonical}`;
    setShareLinks(shareText);
    layer.hidden = false;
    document.body.classList.add('rwg-game-over-open');

    const detail = { game: gameName, url: canonical, continueCount, ...stats, achievements: achievements.map(({ id, label, isNew }) => ({ id, label, isNew })) };
    window.dispatchEvent(new CustomEvent('rwg:game-over-summary', { detail }));
  };

  const checkGameOver = () => {
    const label = startBtn.textContent.trim().toUpperCase();
    if (sessionActive && isOverlayVisible() && label === 'RIGIOCA') showSummary();
  };

  new MutationObserver(checkGameOver).observe(overlay, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(checkGameOver).observe(startBtn, { childList: true, characterData: true, subtree: true });

  continueBtn.addEventListener('click', () => {
    const stats = collectStats();
    const discountedScore = Math.floor(stats.score * .5);
    continueCount++;
    summaryShown = false;
    sessionActive = true;
    lastTick = performance.now();
    layer.hidden = true;
    document.body.classList.remove('rwg-game-over-open');
    window.dispatchEvent(new CustomEvent('rwg:continue-game', {
      detail: {
        game: gameName,
        url: canonical,
        mode: 'free',
        penalty: .5,
        continueCount,
        previousScore: stats.score,
        score: discountedScore
      }
    }));
  });

  playAgain.addEventListener('click', () => {
    layer.hidden = true;
    document.body.classList.remove('rwg-game-over-open');
    window.dispatchEvent(new CustomEvent('rwg:game-replay', { detail: { game: gameName, url: canonical } }));
    startBtn.click();
  });

  moreShare?.addEventListener('click', async () => {
    const stats = collectStats();
    const text = `Ho realizzato ${formatNumber(stats.score)} punti su ${gameName}! Tu riesci a fare di meglio?`;
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
      moreShare.textContent = 'Copiato!';
      setTimeout(() => { moreShare.textContent = 'Altro'; }, 1500);
    } catch (_) {
      window.location.href = `mailto:?subject=${q(`${gameName} — RetroWebGames`)}&body=${q(`${text}\n\n${canonical}`)}`;
    }
  });

  window.RWGGameOver = Object.freeze({
    open: showSummary,
    close: () => {
      layer.hidden = true;
      document.body.classList.remove('rwg-game-over-open');
    },
    getSession: () => ({ game: gameName, url: canonical, activeMs, active: sessionActive, continueCount }),
    getCreditsSlot: () => layer.querySelector('[data-rwg-credits-slot]')
  });
})();
