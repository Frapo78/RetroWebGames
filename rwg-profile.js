(() => {
  'use strict';

  if (window.RWGProfile) return;

  const STORAGE_KEY = 'rwg.profile.v1';
  const FREE_GRANT_VERSION = 1;
  const INITIAL_CREDITS = 10;
  const HISTORY_LIMIT = 200;
  const nowIso = () => new Date().toISOString();

  let coinSeq = 0;
  const coinSvg = (className = 'rwg-coin-icon') => {
    const suffix = ++coinSeq;
    const fillId = `rwgCoinFill${suffix}`;
    const rimId = `rwgCoinRim${suffix}`;
    return `
      <svg class="${className}" viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id="${fillId}" x1="5" y1="3" x2="27" y2="29" gradientUnits="userSpaceOnUse">
            <stop stop-color="#fff7a8"/>
            <stop offset=".34" stop-color="#ffe454"/>
            <stop offset=".72" stop-color="#f6ad22"/>
            <stop offset="1" stop-color="#d9780e"/>
          </linearGradient>
          <linearGradient id="${rimId}" x1="6" y1="5" x2="27" y2="27" gradientUnits="userSpaceOnUse">
            <stop stop-color="#fff278"/>
            <stop offset="1" stop-color="#c96809"/>
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="13.2" fill="url(#${rimId})" />
        <circle cx="16" cy="16" r="10.7" fill="url(#${fillId})" stroke="rgba(91,49,2,.42)" stroke-width="1.2"/>
        <path d="M11 10.5h7.1c2.55 0 4.4 1.38 4.4 3.56 0 1.43-.78 2.5-2.02 3.04 1.48.48 2.42 1.67 2.42 3.23 0 2.55-2.12 4.17-5.2 4.17H11v-14Zm4.02 2.8v2.63h2.48c.9 0 1.45-.48 1.45-1.3 0-.84-.55-1.33-1.45-1.33h-2.48Zm0 5.25v3.08h2.82c1.02 0 1.62-.58 1.62-1.53 0-.97-.62-1.55-1.68-1.55h-2.76Z" fill="#7c3d05" opacity=".86"/>
        <path d="M9.1 8.5c2.6-2.7 8.15-4.18 12.35-1.45" fill="none" stroke="rgba(255,255,255,.62)" stroke-width="1.35" stroke-linecap="round"/>
      </svg>`;
  };

  const makeId = () => {
    const secureCrypto = globalThis.crypto;
    if (secureCrypto?.randomUUID) return `rwg_${secureCrypto.randomUUID()}`;
    if (secureCrypto?.getRandomValues) {
      const bytes = new Uint8Array(16);
      secureCrypto.getRandomValues(bytes);
      return `rwg_${[...bytes].map(v => v.toString(16).padStart(2, '0')).join('')}`;
    }
    return `rwg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
  };

  const gameDefaults = () => ({
    attempts: 0,
    gameOvers: 0,
    continues: 0,
    playTimeMs: 0,
    bestScore: 0,
    recordValue: 0,
    lastScore: 0,
    maxLevel: 0,
    maxLines: 0,
    maxCombo: 1,
    maxRally: 0,
    achievements: [],
    lastPlayedAt: null
  });

  const defaultProfile = () => ({
    version: 1,
    fingerprint: makeId(),
    createdAt: nowIso(),
    lastSeenAt: nowIso(),
    freeGrantVersion: FREE_GRANT_VERSION,
    credits: INITIAL_CREDITS,
    totals: {
      attempts: 0,
      gameOvers: 0,
      continues: 0,
      playTimeMs: 0,
      creditsSpent: 0,
      shares: 0
    },
    games: {},
    history: [{
      type: 'welcome-credit',
      at: nowIso(),
      amount: INITIAL_CREDITS,
      balance: INITIAL_CREDITS
    }]
  });

  let storageAvailable = true;

  const safeParse = value => {
    try { return JSON.parse(value); } catch (_) { return null; }
  };

  const normalize = raw => {
    if (!raw || typeof raw !== 'object') return defaultProfile();

    const profile = raw;
    profile.version = 1;
    profile.fingerprint = typeof profile.fingerprint === 'string' && profile.fingerprint ? profile.fingerprint : makeId();
    profile.createdAt = profile.createdAt || nowIso();
    profile.lastSeenAt = nowIso();
    profile.freeGrantVersion = Number(profile.freeGrantVersion || 0);
    profile.credits = Math.max(0, Math.floor(Number(profile.credits || 0)));
    profile.totals = {
      attempts: Math.max(0, Number(profile.totals?.attempts || 0)),
      gameOvers: Math.max(0, Number(profile.totals?.gameOvers || 0)),
      continues: Math.max(0, Number(profile.totals?.continues || 0)),
      playTimeMs: Math.max(0, Number(profile.totals?.playTimeMs || 0)),
      creditsSpent: Math.max(0, Number(profile.totals?.creditsSpent || 0)),
      shares: Math.max(0, Number(profile.totals?.shares || 0))
    };
    profile.games = profile.games && typeof profile.games === 'object' ? profile.games : {};
    profile.history = Array.isArray(profile.history) ? profile.history.slice(-HISTORY_LIMIT) : [];

    if (profile.freeGrantVersion < FREE_GRANT_VERSION) {
      profile.credits += INITIAL_CREDITS;
      profile.freeGrantVersion = FREE_GRANT_VERSION;
      profile.history.push({
        type: 'welcome-credit',
        at: nowIso(),
        amount: INITIAL_CREDITS,
        balance: profile.credits
      });
    }

    return profile;
  };

  const load = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return normalize(raw ? safeParse(raw) : null);
    } catch (_) {
      storageAvailable = false;
      return defaultProfile();
    }
  };

  let profile = load();
  const transient = new Map();

  const save = () => {
    profile.lastSeenAt = nowIso();
    profile.history = profile.history.slice(-HISTORY_LIMIT);
    if (storageAvailable) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); }
      catch (_) { storageAvailable = false; }
    }
    renderCredits();
  };

  const clone = value => {
    try { return structuredClone(value); }
    catch (_) { return JSON.parse(JSON.stringify(value)); }
  };

  const pushHistory = entry => {
    profile.history.push({ at: nowIso(), ...entry });
    if (profile.history.length > HISTORY_LIMIT) profile.history.splice(0, profile.history.length - HISTORY_LIMIT);
  };

  const slugFrom = detail => {
    if (detail?.gameSlug) return detail.gameSlug;
    try {
      const url = new URL(detail?.url || location.href, location.href);
      return url.pathname.split('/').filter(Boolean).pop() || 'home';
    } catch (_) {
      return 'game';
    }
  };

  const ensureGame = slug => {
    if (!profile.games[slug] || typeof profile.games[slug] !== 'object') profile.games[slug] = gameDefaults();
    const g = profile.games[slug];
    Object.assign(g, { ...gameDefaults(), ...g });
    if (!Array.isArray(g.achievements)) g.achievements = [];
    return g;
  };

  const changeCredits = (delta, meta = {}) => {
    const amount = Math.trunc(Number(delta || 0));
    if (!amount) return { ok: true, balance: profile.credits };
    if (amount < 0 && profile.credits < Math.abs(amount)) return { ok: false, balance: profile.credits };

    profile.credits = Math.max(0, profile.credits + amount);
    if (amount < 0) profile.totals.creditsSpent += Math.abs(amount);
    pushHistory({
      type: amount > 0 ? 'credit-grant' : 'credit-spend',
      amount,
      balance: profile.credits,
      ...meta
    });
    save();
    flashBadge();
    return { ok: true, balance: profile.credits };
  };

  let badge = null;
  let badgeTimer = 0;

  const mountBadge = () => {
    if (badge?.isConnected) return badge;

    badge = document.createElement('div');
    badge.className = 'rwg-credit-badge';
    badge.setAttribute('role', 'status');
    badge.innerHTML = `${coinSvg()}<span data-rwg-credit-count>${profile.credits}</span>`;
    badge.title = 'Crediti disponibili';

    const gamePage = document.body?.hasAttribute('data-rwg-game');
    const topbar = gamePage ? document.getElementById('topbar') : null;
    const blockHud = gamePage && !topbar ? document.getElementById('hud') : null;
    const host = topbar || blockHud;

    if (host) {
      badge.classList.add('rwg-credit-badge-inline');
      host.appendChild(badge);
    } else {
      document.body.appendChild(badge);
    }
    return badge;
  };

  const renderCredits = () => {
    if (!document.body) return;
    const el = mountBadge();
    const count = el.querySelector('[data-rwg-credit-count]');
    if (count) count.textContent = String(profile.credits);
    el.setAttribute('aria-label', `Crediti disponibili: ${profile.credits}`);
  };

  const flashBadge = () => {
    const el = mountBadge();
    el.classList.remove('rwg-credit-flash');
    requestAnimationFrame(() => el.classList.add('rwg-credit-flash'));
    clearTimeout(badgeTimer);
    badgeTimer = setTimeout(() => el.classList.remove('rwg-credit-flash'), 700);
  };

  let insufficientLayer = null;
  const showInsufficientCredits = (required = 1) => {
    if (!insufficientLayer) {
      insufficientLayer = document.createElement('section');
      insufficientLayer.className = 'rwg-insufficient-layer';
      insufficientLayer.hidden = true;
      insufficientLayer.setAttribute('role', 'dialog');
      insufficientLayer.setAttribute('aria-modal', 'true');
      insufficientLayer.innerHTML = `
        <div class="rwg-insufficient-card">
          <div class="rwg-insufficient-burst" aria-hidden="true">
            ${coinSvg('rwg-insufficient-coin')}
            <i></i><i></i><i></i><i></i><i></i><i></i>
          </div>
          <p class="rwg-insufficient-kicker">INSERT COIN?</p>
          <h2>Crediti insufficienti</h2>
          <p class="rwg-insufficient-copy"></p>
          <div class="rwg-insufficient-balance"></div>
          <button type="button" class="rwg-insufficient-close">OK</button>
        </div>`;
      document.body.appendChild(insufficientLayer);
      insufficientLayer.querySelector('.rwg-insufficient-close').addEventListener('click', () => {
        insufficientLayer.hidden = true;
      });
      insufficientLayer.addEventListener('click', e => {
        if (e.target === insufficientLayer) insufficientLayer.hidden = true;
      });
    }

    insufficientLayer.querySelector('.rwg-insufficient-copy').textContent =
      `Servono ${required} ${required === 1 ? 'credito' : 'crediti'} per continuare questa partita.`;
    insufficientLayer.querySelector('.rwg-insufficient-balance').innerHTML =
      `${coinSvg('rwg-inline-coin')} <strong>${profile.credits}</strong> disponibili`;
    insufficientLayer.hidden = false;
  };

  const recordSessionStart = detail => {
    const slug = slugFrom(detail);
    const g = ensureGame(slug);
    g.attempts++;
    g.lastPlayedAt = nowIso();
    profile.totals.attempts++;
    transient.set(slug, { accountedPlayMs: 0 });
    pushHistory({ type: 'attempt', game: slug, title: detail?.game || null });
    save();
  };

  const recordGameOver = detail => {
    const slug = slugFrom(detail);
    const g = ensureGame(slug);
    const t = transient.get(slug) || { accountedPlayMs: 0 };
    const activeMs = Math.max(0, Number(detail?.activeMs || 0));
    const deltaMs = Math.max(0, activeMs - Number(t.accountedPlayMs || 0));
    t.accountedPlayMs = activeMs;
    transient.set(slug, t);

    const score = Math.max(0, Number(detail?.score || 0));
    const recordValue = Math.max(0, Number(detail?.best || score));
    const level = Math.max(0, Number(detail?.level || 0));
    const lines = Math.max(0, Number(detail?.lines || 0));
    const maxCombo = Math.max(1, Number(detail?.maxCombo || 1));
    const maxRally = Math.max(0, Number(detail?.maxRally || 0));

    g.gameOvers++;
    g.playTimeMs += deltaMs;
    g.lastScore = score;
    g.bestScore = Math.max(g.bestScore, score);
    g.recordValue = Math.max(g.recordValue, recordValue);
    g.maxLevel = Math.max(g.maxLevel, level);
    g.maxLines = Math.max(g.maxLines, lines);
    g.maxCombo = Math.max(g.maxCombo, maxCombo);
    g.maxRally = Math.max(g.maxRally, maxRally);
    g.lastPlayedAt = nowIso();

    const earned = Array.isArray(detail?.achievements) ? detail.achievements : [];
    const ids = new Set(g.achievements.map(a => typeof a === 'string' ? a : a.id));
    earned.forEach(a => {
      if (a?.id && !ids.has(a.id)) {
        g.achievements.push({ id: a.id, label: a.label || a.id, unlockedAt: nowIso() });
        ids.add(a.id);
      }
    });

    profile.totals.gameOvers++;
    profile.totals.playTimeMs += deltaMs;
    pushHistory({
      type: 'game-over',
      game: slug,
      score,
      recordValue,
      level,
      lines,
      maxCombo,
      maxRally,
      activeMs,
      continues: Math.max(0, Number(detail?.continueCount || 0))
    });
    save();
  };

  const recordContinue = detail => {
    const slug = slugFrom(detail);
    const g = ensureGame(slug);
    g.continues++;
    g.lastPlayedAt = nowIso();
    profile.totals.continues++;
    pushHistory({
      type: 'continue',
      game: slug,
      costCredits: Math.max(0, Number(detail?.costCredits || 0)),
      score: Math.max(0, Number(detail?.score || 0)),
      continueCount: Math.max(0, Number(detail?.continueCount || 0))
    });
    save();
  };

  const recordShare = target => {
    const slug = location.pathname.split('/').filter(Boolean).pop() || 'home';
    if (slug !== 'home') ensureGame(slug);
    profile.totals.shares++;
    pushHistory({ type: 'share', game: slug, network: target || 'native' });
    save();
  };

  window.addEventListener('rwg:game-session-start', e => recordSessionStart(e.detail || {}));
  window.addEventListener('rwg:game-over-summary', e => recordGameOver(e.detail || {}));
  window.addEventListener('rwg:continue-game', e => recordContinue(e.detail || {}));

  document.addEventListener('click', e => {
    const target = e.target.closest?.('[data-network], [data-go-share], [data-share]');
    if (!target) return;
    const network = target.dataset.network || target.dataset.goShare || target.dataset.share;
    if (network) recordShare(network);
  }, true);

  const API = {
    getFingerprint: () => profile.fingerprint,
    getCredits: () => profile.credits,
    getSnapshot: () => clone(profile),
    getGameStats: slug => clone(ensureGame(slug)),
    grantCredits: (amount, meta = {}) => changeCredits(Math.max(0, Math.floor(Number(amount || 0))), meta),
    spendCredits: (amount, meta = {}) => changeCredits(-Math.max(0, Math.floor(Number(amount || 0))), meta),
    showInsufficientCredits,
    coinSvg,
    storageMode: () => storageAvailable ? 'localStorage' : 'memory'
  };

  window.RWGProfile = Object.freeze(API);

  window.RWGContinueProvider = {
    mode: 'credits-local-v1',
    costCredits: 1,
    async requestContinue(context = {}) {
      const cost = 1;
      const result = API.spendCredits(cost, {
        reason: 'continue',
        game: context.gameSlug || slugFrom(context),
        title: context.game || null
      });

      if (!result.ok) {
        showInsufficientCredits(cost);
        return {
          granted: false,
          mode: 'credits',
          reason: 'insufficient-credits',
          costCredits: cost,
          remainingCredits: result.balance
        };
      }

      return {
        granted: true,
        mode: 'credits',
        penalty: 1,
        score: Math.max(0, Math.floor(Number(context.score || 0))),
        costCredits: cost,
        remainingCredits: result.balance
      };
    }
  };

  const selfSrc = document.currentScript?.src;
  if (selfSrc && !document.querySelector('link[data-rwg-profile-style]')) {
    const base = new URL('.', selfSrc);
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = new URL('rwg-profile.css', base).href;
    style.dataset.rwgProfileStyle = 'true';
    document.head.appendChild(style);
  }

  const ready = () => {
    renderCredits();
    save();
    window.dispatchEvent(new CustomEvent('rwg:profile-ready', {
      detail: { fingerprint: profile.fingerprint, credits: profile.credits, storage: API.storageMode() }
    }));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true });
  else ready();
})();