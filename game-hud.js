(() => {
  'use strict';

  if (!document.body || !document.body.hasAttribute('data-rwg-game')) return;

  const selfSrc = document.currentScript?.src;
  if (selfSrc) {
    const base = new URL('.', selfSrc);

    const loadAnalytics = () => {
      if (window.RWGAnalytics || document.querySelector('script[data-rwg-analytics-script], script[src$="/rwg-analytics.js"]')) return;
      const script = document.createElement('script');
      script.src = new URL('rwg-analytics.js', base).href;
      script.dataset.rwgAnalyticsScript = 'true';
      document.head.appendChild(script);
    };

    const loadSession = () => {
      if (!document.querySelector('link[data-rwg-session-style]')) {
        const style = document.createElement('link');
        style.rel = 'stylesheet';
        style.href = new URL('rwg-session.css', base).href;
        style.dataset.rwgSessionStyle = 'true';
        document.head.appendChild(style);
      }
      if (!window.RWGSession && !document.querySelector('script[data-rwg-session-script]')) {
        const script = document.createElement('script');
        script.src = new URL('rwg-session.js', base).href;
        script.dataset.rwgSessionScript = 'true';
        document.body.appendChild(script);
      }
    };

    const loadIntroShare = () => {
      if (!document.querySelector('link[data-rwg-intro-share-style]')) {
        const style = document.createElement('link');
        style.rel = 'stylesheet';
        style.href = new URL('rwg-intro-share.css', base).href;
        style.dataset.rwgIntroShareStyle = 'true';
        document.head.appendChild(style);
      }
      if (!document.querySelector('script[data-rwg-intro-share-script]')) {
        const script = document.createElement('script');
        script.src = new URL('rwg-intro-share.js', base).href;
        script.dataset.rwgIntroShareScript = 'true';
        document.body.appendChild(script);
      }
    };

    const loadLeaderboard = () => {
      if (!document.querySelector('link[data-rwg-leaderboard-style]')) {
        const style = document.createElement('link');
        style.rel = 'stylesheet';
        style.href = new URL('rwg-leaderboard.css', base).href;
        style.dataset.rwgLeaderboardStyle = 'true';
        document.head.appendChild(style);
      }
      if (!window.RWGLeaderboard && !document.querySelector('script[data-rwg-leaderboard-script]')) {
        const script = document.createElement('script');
        script.src = new URL('rwg-leaderboard.js', base).href;
        script.dataset.rwgLeaderboardScript = 'true';
        document.body.appendChild(script);
      }
    };

    const loadGameOver = () => {
      if (!document.querySelector('link[data-rwg-game-over-style]')) {
        const style = document.createElement('link');
        style.rel = 'stylesheet';
        style.href = new URL('game-over.css', base).href;
        style.dataset.rwgGameOverStyle = 'true';
        document.head.appendChild(style);
      }
      if (!window.RWGGameOver && !document.querySelector('script[data-rwg-game-over-script]')) {
        const script = document.createElement('script');
        script.src = new URL('game-over.js', base).href;
        script.dataset.rwgGameOverScript = 'true';
        document.body.appendChild(script);
      }
    };

    const loadAvatar = () => {
      if (window.RWGAvatar || document.querySelector('script[data-rwg-avatar-script], script[src$="/rwg-avatar.js"], script[src="rwg-avatar.js"]')) return;
      const script = document.createElement('script');
      script.src = new URL('rwg-avatar.js', base).href;
      script.dataset.rwgAvatarScript = 'true';
      document.body.appendChild(script);
    };

    const loadExtras = () => {
      // Game Over is critical lifecycle infrastructure. Avatar is cosmetic/identity UI.
      // Load them independently so an avatar delay/failure can never postpone terminal UI.
      loadGameOver();
      loadAvatar();
    };

    const ensureProfileThenExtras = () => {
      if (window.RWGProfile) {
        loadExtras();
        return;
      }

      const existing = document.querySelector('script[data-rwg-profile-script], script[src$="/rwg-profile.js"], script[src="rwg-profile.js"]');
      if (existing) {
        existing.addEventListener('load', loadExtras, { once: true });
        existing.addEventListener('error', loadExtras, { once: true });
        queueMicrotask(() => { if (window.RWGProfile) loadExtras(); });
        return;
      }

      const profileScript = document.createElement('script');
      profileScript.src = new URL('rwg-profile.js', base).href;
      profileScript.dataset.rwgProfileScript = 'true';
      profileScript.addEventListener('load', loadExtras, { once: true });
      profileScript.addEventListener('error', loadExtras, { once: true });
      document.body.appendChild(profileScript);
    };

    // Analytics, resumable sessions and intro sharing are platform-level contracts and bootstrap immediately.
    loadAnalytics();
    loadSession();
    loadIntroShare();
    loadLeaderboard();
    ensureProfileThenExtras();
  }

  const introMenu = document.querySelector('.rwg-intro-secondary');
  document.getElementById('startBtn')?.addEventListener('click', () => {
    if (introMenu) introMenu.hidden = true;
  }, { once: true });

  if (document.querySelector('.rwg-game-tools')) return;

  const HOME_URL = 'https://www.retrowebgames.it/';
  const home = document.querySelector('a[aria-label*="Torna a RetroWebGames"]');
  if (!home || !home.parentNode) return;

  const canonical = document.querySelector('link[rel="canonical"]')?.href || window.location.href;
  const gameName = (document.title.split('—')[0] || 'RetroWebGames').trim();
  const shareText = `🎮 Sto giocando a ${gameName} su RetroWebGames. Provalo anche tu!`;
  const q = encodeURIComponent;

  const host = document.createElement('div');
  host.className = 'rwg-game-tools';
  home.parentNode.insertBefore(host, home);
  host.appendChild(home);

  home.href = HOME_URL;
  home.classList.add('rwg-home-action');
  home.setAttribute('aria-label', 'Torna a tutti i giochi di RetroWebGames');
  home.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2 2.8 10.7a1 1 0 0 0 .64 1.77h1.3v7.03A1.5 1.5 0 0 0 6.24 21h4.02v-5.1h3.48V21h4.02a1.5 1.5 0 0 0 1.5-1.5v-7.03h1.3a1 1 0 0 0 .64-1.77L12 3.2Z"/></svg>
    <span class="rwg-tool-label">Giochi</span>`;

  const shareToggle = document.createElement('button');
  shareToggle.type = 'button';
  shareToggle.className = 'rwg-share-toggle';
  shareToggle.setAttribute('aria-label', `Condividi ${gameName}`);
  shareToggle.setAttribute('aria-expanded', 'false');
  shareToggle.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 16a3 3 0 0 0-2.39 1.19l-6.7-3.35a3.1 3.1 0 0 0 0-1.68l6.7-3.35A3 3 0 1 0 15 7c0 .25.03.49.09.72l-6.7 3.35a3 3 0 1 0 0 3.86l6.7 3.35A3 3 0 1 0 18 16Z"/></svg>
    <span class="rwg-tool-label">Condividi</span>`;
  host.appendChild(shareToggle);

  const tray = document.createElement('div');
  tray.className = 'rwg-share-tray';
  tray.hidden = true;
  tray.setAttribute('aria-label', 'Condividi questo gioco');
  tray.innerHTML = `
    <a class="rwg-share-option" data-network="whatsapp" target="_blank" rel="noopener noreferrer" aria-label="Condividi su WhatsApp"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.04 2a9.84 9.84 0 0 0-8.42 14.93L2.05 22l5.2-1.52A9.95 9.95 0 1 0 12.04 2Zm0 17.86a8.02 8.02 0 0 1-4.09-1.12l-.29-.17-3.08.9.92-3-.19-.31a7.9 7.9 0 1 1 6.73 3.7Zm4.4-5.92c-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.37-1.94-1.19a7.28 7.28 0 0 1-1.34-1.67c-.14-.24-.01-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.19-.47-.39-.41-.54-.42h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.1 3.62.57.25 1.02.39 1.37.5.58.18 1.1.16 1.51.1.46-.07 1.43-.58 1.63-1.15.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z"/></svg></a>
    <a class="rwg-share-option" data-network="facebook" target="_blank" rel="noopener noreferrer" aria-label="Condividi su Facebook"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.7 22v-9h3l.45-3.5H13.7V7.26c0-1.01.28-1.7 1.74-1.7h1.86V2.43c-.32-.04-1.43-.13-2.72-.13-2.7 0-4.55 1.65-4.55 4.68V9.5H7v3.5h3.03v9h3.67Z"/></svg></a>
    <a class="rwg-share-option" data-network="x" target="_blank" rel="noopener noreferrer" aria-label="Condividi su X"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.9 2H22l-6.77 7.74L23.2 22h-6.24l-4.89-6.39L6.48 22H3.36l7.26-8.3L2.98 2h6.4l4.42 5.84L18.9 2Zm-1.1 17.84h1.72L8.45 4.05H6.6L17.8 19.84Z"/></svg></a>
    <a class="rwg-share-option" data-network="telegram" target="_blank" rel="noopener noreferrer" aria-label="Condividi su Telegram"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21.7 3.2-3.2 15.1c-.24 1.07-.87 1.33-1.76.83l-4.88-3.6-2.35 2.27c-.26.26-.48.48-.98.48l.35-4.97 9.04-8.17c.39-.35-.09-.55-.61-.2L6.14 11.97 1.32 10.46C.27 10.13.25 9.41 1.54 8.9L20.4 1.63c.87-.32 1.64.2 1.3 1.57Z"/></svg></a>
    <button class="rwg-share-option" data-network="more" type="button" aria-label="Altre opzioni di condivisione"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm0 8a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm0 8a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z"/></svg></button>`;
  host.appendChild(tray);

  const links = {
    whatsapp: `https://wa.me/?text=${q(`${shareText} ${canonical}`)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${q(canonical)}`,
    x: `https://twitter.com/intent/tweet?text=${q(shareText)}&url=${q(canonical)}`,
    telegram: `https://t.me/share/url?url=${q(canonical)}&text=${q(shareText)}`
  };

  Object.entries(links).forEach(([network, href]) => {
    const el = tray.querySelector(`[data-network="${network}"]`);
    if (el) el.href = href;
  });

  const toast = document.createElement('div');
  toast.className = 'rwg-share-toast';
  toast.setAttribute('role', 'status');
  document.body.appendChild(toast);
  let toastTimer = 0;

  const showToast = message => {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
  };

  const setOpen = open => {
    tray.hidden = !open;
    shareToggle.setAttribute('aria-expanded', String(open));
  };

  shareToggle.addEventListener('click', event => {
    event.stopPropagation();
    setOpen(tray.hidden);
  });

  tray.addEventListener('click', event => event.stopPropagation());
  document.addEventListener('pointerdown', event => {
    if (!host.contains(event.target)) setOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') setOpen(false);
  });

  const more = tray.querySelector('[data-network="more"]');
  more?.addEventListener('click', async () => {
    setOpen(false);
    if (navigator.share) {
      try {
        await navigator.share({ title: `${gameName} — RetroWebGames`, text: shareText, url: canonical });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(canonical);
      showToast('Link copiato');
    } catch (_) {
      window.location.href = `mailto:?subject=${q(`${gameName} — RetroWebGames`)}&body=${q(`${shareText}\n\n${canonical}`)}`;
    }
  });
})();
