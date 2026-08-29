(() => {
  'use strict';

  const API_ROOT = '/api/leaderboards/v1';
  const isGamePage = document.body?.hasAttribute('data-rwg-game');

  function track(name, params = {}) {
    const send = () => window.RWGAnalytics?.track?.(name, params);
    if (window.RWGAnalytics?.track) send();
    else window.addEventListener('rwg:analytics-ready', send, { once: true });
  }

  function mountHubLeaderboards() {
    if (window.RWGHomeLeaderboards) return;
    const cards = [...document.querySelectorAll('.game-card[href*="/games/"]')];
    if (!cards.length) return;
    const safeGet = key => { try { return localStorage.getItem(key) || ''; } catch (_) { return ''; } };
    const safeSet = (key, value) => { try { localStorage.setItem(key, value); } catch (_) {} };
    const number = value => Number(value || 0).toLocaleString('it-IT');
    const panels = new Map();

    function resultText(slug, row) {
      return slug === 'neon-rally' && row.resultLabel ? row.resultLabel : number(row.score);
    }

    function render(panel, slug, data, stale = false) {
      const list = panel.querySelector('.rwg-home-top3-list');
      list.replaceChildren();
      for (const row of (data.top || []).slice(0, 3)) {
        const item = document.createElement('li');
        const rank = document.createElement('span'); rank.textContent = `#${row.position}`;
        const name = document.createElement('strong'); name.textContent = row.nickname;
        const score = document.createElement('b'); score.textContent = resultText(slug, row);
        item.append(rank, name, score); list.appendChild(item);
      }
      if (!list.children.length) {
        const empty = document.createElement('li'); empty.className = 'is-empty'; empty.textContent = 'NESSUN RECORD • IL PODIO TI ASPETTA'; list.appendChild(empty);
      }
      panel.querySelector('.rwg-home-top3-status').textContent = stale ? 'ULTIMI DATI SALVATI' : '';
    }

    async function load(slug, panel) {
      panel.classList.add('is-loading');
      try {
        const response = await fetch(`${API_ROOT}/games/${encodeURIComponent(slug)}`, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        safeSet(`rwg.leaderboard.cache.v1:${slug}`, JSON.stringify(data));
        render(panel, slug, data, false);
        return 'network';
      } catch (_) {
        let cached = null;
        try { cached = JSON.parse(safeGet(`rwg.leaderboard.cache.v1:${slug}`)); } catch (_) {}
        if (cached) { render(panel, slug, cached, true); return 'cache'; }
        panel.querySelector('.rwg-home-top3-list').innerHTML = '<li class="is-empty">CLASSIFICA NON DISPONIBILE</li>';
        return 'error';
      } finally { panel.classList.remove('is-loading'); }
    }

    for (const card of cards) {
      const slug = new URL(card.href, location.href).pathname.split('/').filter(Boolean).pop();
      if (!slug) continue;
      const title = card.querySelector('h2')?.textContent?.trim() || slug;
      const stack = document.createElement('div'); stack.className = 'game-card-stack';
      const panel = document.createElement('section'); panel.className = 'rwg-home-top3'; panel.dataset.gameSlug = slug;
      panel.setAttribute('aria-label', `Top 3 globale ${title}`);
      panel.innerHTML = `<div class="rwg-home-top3-heading"><span>🏆 TOP 3 GLOBALE</span><button type="button" aria-label="Aggiorna Top 3 ${title}">↻</button></div><ol class="rwg-home-top3-list"><li class="is-empty">CONNESSIONE AL CABINATO…</li></ol><p class="rwg-home-top3-status" aria-live="polite"></p>`;
      card.before(stack); stack.append(card, panel); panels.set(slug, panel);
      panel.querySelector('button').addEventListener('click', () => { track('leaderboard_home_retry', { leaderboard_game: slug }); load(slug, panel); });
    }

    Promise.all([...panels].map(([slug, panel]) => load(slug, panel))).then(results => {
      track('leaderboard_home_top3', {
        leaderboard_count: results.length,
        network_count: results.filter(value => value === 'network').length,
        cache_count: results.filter(value => value === 'cache').length,
        error_count: results.filter(value => value === 'error').length
      });
    });
    window.RWGHomeLeaderboards = Object.freeze({ reload: () => Promise.all([...panels].map(([slug, panel]) => load(slug, panel))) });
  }

  if (!isGamePage) {
    mountHubLeaderboards();
    return;
  }
  if (window.RWGLeaderboard) return;

  const NAME_KEY = 'rwg.leaderboard.name.v1';
  const QUEUE_KEY = 'rwg.leaderboard.queue.v1';
  const canonical = document.querySelector('link[rel="canonical"]')?.href || location.href;
  const gameSlug = new URL(canonical, location.href).pathname.split('/').filter(Boolean).pop() || 'game';
  const RUN_KEY = `rwg.leaderboard.run.v1:${gameSlug}`;
  const CACHE_KEY = `rwg.leaderboard.cache.v1:${gameSlug}`;
  const startBtn = document.getElementById('startBtn');
  let introBoard = null;
  let pauseBoard = null;
  let pauseBoardVisible = false;
  let latestBoard = null;
  let submitting = false;
  let retryingQueue = false;
  let pendingGameOverDetail = null;

  const storage = {
    get(key, fallback = '') { try { return localStorage.getItem(key) ?? fallback; } catch (_) { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, value); return true; } catch (_) { return false; } }
  };
  const uuid = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  const getRunId = () => {
    let value = storage.get(RUN_KEY);
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(value)) { value = uuid(); storage.set(RUN_KEY, value); }
    return value;
  };
  const startNewRun = () => storage.set(RUN_KEY, uuid());
  const formatNumber = value => Number(value || 0).toLocaleString('it-IT');
  const readJson = (key, fallback) => { try { return JSON.parse(storage.get(key, '')) || fallback; } catch (_) { return fallback; } };
  const gameLabel = () => (document.body.dataset.rwgGameName || gameSlug).trim();

  function makeBoard() {
    const section = document.createElement('section');
    section.className = 'rwg-leaderboard-board';
    section.setAttribute('aria-label', `High Scores ${gameLabel()}`);
    section.innerHTML = `
      <div class="rwg-lb-heading"><span>🏆 HIGH SCORES</span><button type="button" data-rwg-lb-retry aria-label="Aggiorna classifica">↻</button></div>
      <ol class="rwg-lb-list"><li class="rwg-lb-loading">CONNESSIONE AL CABINATO…</li></ol>
      <p class="rwg-lb-status" aria-live="polite"></p>`;
    section.querySelector('[data-rwg-lb-retry]').addEventListener('click', () => {
      track('leaderboard_retry');
      loadBoard();
    });
    return section;
  }

  function makePauseBoard() {
    const section = document.createElement('aside');
    section.className = 'rwg-leaderboard-pause-board';
    section.hidden = true;
    section.setAttribute('aria-label', `Podio globale ${gameLabel()}`);
    section.innerHTML = `
      <div class="rwg-lb-pause-heading">🏆 TOP 3 GLOBALE</div>
      <ol class="rwg-lb-pause-list"><li class="rwg-lb-loading">CONNESSIONE…</li></ol>`;
    return section;
  }

  function mountIntroBoard() {
    const panel = document.querySelector('#overlay .panel, #overlay .overlay-card, #overlay > div');
    const menu = document.querySelector('.rwg-intro-secondary');
    if (!panel || !menu) return;
    introBoard = makeBoard();
    menu.insertAdjacentElement('afterend', introBoard);
    const cached = readJson(CACHE_KEY, null);
    if (cached) renderBoard(cached, true);
  }

  function mountPauseBoard() {
    pauseBoard = makePauseBoard();
    document.body.appendChild(pauseBoard);
  }

  function renderPauseBoard(data) {
    if (!pauseBoard) return;
    const list = pauseBoard.querySelector('.rwg-lb-pause-list');
    list.replaceChildren();
    for (const row of (data.top || []).slice(0, 3)) appendRow(list, row);
    if (!list.children.length) {
      const empty = document.createElement('li'); empty.className = 'rwg-lb-loading'; empty.textContent = 'IL PODIO TI ASPETTA'; list.appendChild(empty);
    }
  }

  function syncPauseBoardVisibility() {
    if (!pauseBoard) return;
    const resumeOpen = document.documentElement.classList.contains('rwg-resume-open');
    const paused = pauseBtn?.textContent.trim() === '▶';
    const blocked = document.body.classList.contains('rwg-game-over-open');
    const visible = !blocked && (resumeOpen || paused);
    pauseBoard.hidden = !visible;
    if (visible && !pauseBoardVisible) {
      track('leaderboard_pause_view', {
        visibility_reason: resumeOpen ? 'resume_prompt' : 'pause',
        row_count: Number(latestBoard?.top?.slice(0, 3).length || 0)
      });
    }
    pauseBoardVisible = visible;
  }

  function resultText(row) {
    if (gameSlug === 'neon-rally' && row.resultLabel) return row.resultLabel;
    return formatNumber(row.score);
  }

  function appendRow(list, row, extraClass = '') {
    const li = document.createElement('li');
    li.className = `${row.isCurrent ? 'is-current ' : ''}${extraClass}`.trim();
    const rank = document.createElement('span'); rank.className = 'rwg-lb-rank'; rank.textContent = `#${row.position}`;
    const name = document.createElement('strong'); name.className = 'rwg-lb-name'; name.textContent = row.nickname;
    const score = document.createElement('b'); score.className = 'rwg-lb-score'; score.textContent = resultText(row);
    li.append(rank, name, score);
    if (Number(row.continueCount) > 0) {
      const used = document.createElement('small'); used.textContent = `CONTINUE ×${row.continueCount}`; li.appendChild(used);
    }
    list.appendChild(li);
  }

  function renderBoard(data, stale = false) {
    latestBoard = data;
    renderPauseBoard(data);
    if (!introBoard) return;
    const list = introBoard.querySelector('.rwg-lb-list');
    const status = introBoard.querySelector('.rwg-lb-status');
    list.replaceChildren();
    for (const row of data.top || []) appendRow(list, row);
    if (!(data.top || []).length) {
      const empty = document.createElement('li'); empty.className = 'rwg-lb-loading'; empty.textContent = 'NESSUN RECORD • INAUGURA LA CLASSIFICA!'; list.appendChild(empty);
    }
    if (data.current && !(data.top || []).some(row => row.runId === data.current.runId)) {
      const dots = document.createElement('li'); dots.className = 'rwg-lb-dots'; dots.textContent = '…'; list.appendChild(dots);
      appendRow(list, { ...data.current, isCurrent: true }, 'rwg-lb-personal');
    }
    status.textContent = stale ? 'ULTIMO AGGIORNAMENTO SALVATO' : '';
    if (data.lastName && !storage.get(NAME_KEY)) storage.set(NAME_KEY, data.lastName);
  }

  async function loadBoard() {
    introBoard?.classList.add('is-loading');
    try {
      const response = await fetch(`${API_ROOT}/games/${encodeURIComponent(gameSlug)}`, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      storage.set(CACHE_KEY, JSON.stringify(data));
      renderBoard(data, false);
      track('leaderboard_view', {
        delivery: 'network', row_count: Number(data.top?.length || 0),
        has_personal_rank: Number(Boolean(data.current)),
        personal_in_top_10: Number(Boolean(data.current && data.top?.some(row => row.runId === data.current.runId)))
      });
    } catch (_) {
      const cached = readJson(CACHE_KEY, null);
      if (cached) {
        renderBoard(cached, true);
        track('leaderboard_view', { delivery: 'cache', row_count: Number(cached.top?.length || 0) });
      } else {
        if (introBoard) introBoard.querySelector('.rwg-lb-list').innerHTML = '<li class="rwg-lb-loading">CLASSIFICA NON DISPONIBILE • RIPROVA</li>';
        if (pauseBoard) pauseBoard.querySelector('.rwg-lb-pause-list').innerHTML = '<li class="rwg-lb-loading">CLASSIFICA NON DISPONIBILE</li>';
        track('leaderboard_load_error', { error_type: 'unavailable' });
      }
    } finally { introBoard?.classList.remove('is-loading'); }
  }

  function setGameOverLocked(locked) {
    document.documentElement.classList.toggle('rwg-leaderboard-required', locked);
    document.querySelectorAll('.rwg-continue-credit,.rwg-play-again').forEach(button => { button.disabled = locked; });
    document.querySelectorAll('.rwg-back-games').forEach(link => {
      link.classList.toggle('is-disabled', locked); link.setAttribute('aria-disabled', String(locked));
    });
  }

  function clearRankCard() {
    document.querySelector('.rwg-leaderboard-rank-card')?.remove();
  }

  function showRankCard(position = 0, { pending = false, solitaire = false } = {}) {
    if (solitaire) return;
    const gameOver = document.querySelector('.rwg-game-over-layer');
    const host = gameOver?.querySelector('.rwg-game-over-card');
    if (!host || gameOver.hidden) return;
    clearRankCard();
    const rank = Math.max(0, Math.floor(Number(position) || 0));
    const topTen = rank > 0 && rank <= 10;
    const card = document.createElement('section');
    card.className = `rwg-leaderboard-rank-card${topTen ? ' is-top-ten' : ''}${pending ? ' is-pending' : ''}`;
    card.setAttribute('aria-live', 'polite');
    const label = pending ? 'POSIZIONE IN AGGIORNAMENTO' : topTen ? 'SEI NELLA TOP TEN!' : 'POSIZIONE GLOBALE';
    const value = pending ? '…' : rank ? `#${rank}` : '—';
    const copy = pending ? 'Record salvato: aggiorneremo il piazzamento appena torni online.' : topTen ? 'Grande! Il tuo record brilla tra i migliori.' : 'Nuova sfida? La vetta è più vicina.';
    card.innerHTML = `<div class="rwg-lb-rank-icon">🏆</div><div><strong>${label}</strong><span>${copy}</span></div><b>${value}</b>`;
    host.insertBefore(card, host.querySelector('.rwg-challenge-box'));
    track('leaderboard_rank_card_view', {
      leaderboard_position: rank,
      top_ten: Number(topTen),
      rank_status: pending ? 'pending' : 'known'
    });
  }

  function normalizeResult(detail) {
    const metrics = { ...(detail.metrics || {}), ...detail };
    delete metrics.achievements;
    delete metrics.metrics;
    return {
      runId: getRunId(), gameSlug, nickname: storage.get(NAME_KEY), outcome: detail.outcome || 'game-over',
      score: Number(detail.score || 0), level: Number(detail.level || 0), activeMs: Number(detail.activeMs || 0),
      continueCount: Number(detail.continueCount || 0), achievements: Array.isArray(detail.achievements) ? detail.achievements : [],
      metrics, clientEndedAt: new Date().toISOString(), locale: navigator.language || '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      deviceClass: matchMedia('(pointer:coarse)').matches ? 'touch' : 'desktop'
    };
  }

  function queueResult(payload) {
    const queue = readJson(QUEUE_KEY, []);
    const next = queue.filter(item => item.runId !== payload.runId);
    next.push(payload);
    storage.set(QUEUE_KEY, JSON.stringify(next.slice(-30)));
    return next.slice(-30).length;
  }

  async function postResult(payload) {
    const response = await fetch(`${API_ROOT}/runs`, {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.message || `HTTP ${response.status}`), { validation: response.status >= 400 && response.status < 500 });
    return data;
  }

  async function retryQueue() {
    if (retryingQueue) return;
    const queue = readJson(QUEUE_KEY, []);
    if (!queue.length) return;
    retryingQueue = true;
    const remaining = [];
    let delivered = 0;
    let discarded = 0;
    try {
      for (const payload of queue) {
        try {
          const data = await postResult(payload);
          delivered += 1;
          track('post_score', {
            score: Number(payload.score || 0), level: Number(payload.level || 0),
            leaderboard_position: Number(data.current?.position || 0), continues: Number(payload.continueCount || 0), delivery: 'queue_retry'
          });
        } catch (error) {
          if (error.validation) discarded += 1;
          else remaining.push(payload);
        }
      }
      storage.set(QUEUE_KEY, JSON.stringify(remaining));
      track('leaderboard_queue_flush', { delivered_count: delivered, remaining_count: remaining.length, discarded_count: discarded });
    } finally { retryingQueue = false; }
  }

  const normalizeNickname = value => String(value || '').normalize('NFC').trim().replace(/\s+/g, ' ');
  const validNickname = value => /^[\p{L}\p{N}_ -]{3,12}$/u.test(value);

  async function submitRegistration(payload, { section = null, input = null, button = null, status = null, solitaire = false, automatic = false } = {}) {
    if (submitting) return;
    submitting = true;
    if (input) input.disabled = true;
    if (button) button.disabled = true;
    if (status) status.textContent = 'REGISTRAZIONE…';
    let delivery = 'live';
    let position = 0;
    try {
      const data = await postResult(payload);
      position = Number(data.current?.position || 0);
      showRankCard(position, { solitaire });
      if (status) status.textContent = data.current ? `REGISTRATO • POSIZIONE #${data.current.position}` : 'RECORD REGISTRATO!';
      if (data.leaderboard) { storage.set(CACHE_KEY, JSON.stringify(data.leaderboard)); renderBoard(data.leaderboard); }
      track('post_score', {
        score: Number(payload.score || 0), level: Number(payload.level || 0),
        leaderboard_position: position, continues: Number(payload.continueCount || 0), delivery
      });
    } catch (error) {
      if (error.validation) {
        track('leaderboard_submit_error', { error_type: 'server_validation', automatic: Number(automatic) });
        if (status) status.textContent = error.message || 'DATI NON VALIDI';
        if (input) input.disabled = false;
        if (button) button.disabled = false;
        submitting = false;
        return;
      }
      delivery = 'queue';
      const queueSize = queueResult(payload);
      showRankCard(0, { pending: true, solitaire });
      track('leaderboard_submit_queued', { queue_size: queueSize, outcome: payload.outcome, automatic: Number(automatic) });
      if (status) status.textContent = 'SALVATO • INVIO AUTOMATICO APPENA ONLINE';
    }
    track(automatic ? 'leaderboard_auto_submit' : 'leaderboard_name_saved', {
      outcome: payload.outcome, solitaire: Number(Boolean(solitaire)), delivery, leaderboard_position: position
    });
    section?.classList.add('is-registered');
    setGameOverLocked(false);
    submitting = false;
    window.dispatchEvent(new CustomEvent('rwg:leaderboard-registered', { detail: { runId: payload.runId, gameSlug } }));
    if (section) setTimeout(() => section.remove(), 450);
  }

  function showRegistration(detail, solitaire = false) {
    document.querySelector('.rwg-leaderboard-entry')?.remove();
    const payload = normalizeResult(detail);
    const savedNickname = normalizeNickname(storage.get(NAME_KEY));
    if (validNickname(savedNickname)) {
      payload.nickname = savedNickname;
      track('leaderboard_auto_submit_start', { outcome: payload.outcome, solitaire: Number(Boolean(solitaire)) });
      submitRegistration(payload, { solitaire, automatic: true });
      return;
    }

    const section = document.createElement('section');
    section.className = `rwg-leaderboard-entry rwg-leaderboard-name-modal${solitaire ? ' is-solitaire' : ''}`;
    section.setAttribute('role', 'dialog');
    section.setAttribute('aria-modal', 'true');
    section.setAttribute('aria-labelledby', 'rwgLeaderboardNameTitle');
    section.innerHTML = `
      <div class="rwg-lb-entry-kicker">🏆 HIGH SCORE</div>
      <h3 id="rwgLeaderboardNameTitle">INSERISCI IL TUO NOME</h3>
      <p>Firma il record: dalle prossime partite faremo tutto noi.</p>
      <form novalidate>
        <input name="nickname" minlength="3" maxlength="12" autocomplete="nickname" spellcheck="false" aria-label="Nickname arcade" placeholder="IL TUO NOME" required>
        <button type="submit">REGISTRA RECORD</button>
      </form>
      <div class="rwg-lb-entry-status" aria-live="polite"></div>`;
    document.body.appendChild(section);
    const input = section.querySelector('input');
    const button = section.querySelector('button');
    const status = section.querySelector('.rwg-lb-entry-status');
    track('leaderboard_entry_view', { outcome: payload.outcome, name_prefilled: 0, solitaire: Number(Boolean(solitaire)) });
    setGameOverLocked(true);
    setTimeout(() => input.focus({ preventScroll: true }), 180);

    section.querySelector('form').addEventListener('submit', async event => {
      event.preventDefault();
      if (submitting) return;
      const nickname = normalizeNickname(input.value);
      if (!validNickname(nickname)) {
        status.textContent = 'USA 3–12 LETTERE, NUMERI, SPAZI, - O _';
        track('leaderboard_submit_error', { error_type: 'nickname_format' });
        input.focus(); return;
      }
      payload.nickname = nickname; storage.set(NAME_KEY, nickname);
      submitRegistration(payload, { section, input, button, status, solitaire, automatic: false });
    });
  }

  window.addEventListener('rwg:game-session-start', () => { pendingGameOverDetail = null; clearRankCard(); startNewRun(); });
  window.addEventListener('rwg:game-over-summary', event => { clearRankCard(); pendingGameOverDetail = event.detail || {}; });
  window.addEventListener('rwg:game-over-revealed', () => {
    if (!pendingGameOverDetail) return;
    const detail = pendingGameOverDetail;
    pendingGameOverDetail = null;
    showRegistration(detail, false);
  });
  window.addEventListener('rwg:leaderboard-result', event => showRegistration(event.detail || {}, true));
  window.addEventListener('online', () => { retryQueue(); loadBoard(); });
  document.addEventListener('click', event => {
    if (!document.documentElement.classList.contains('rwg-leaderboard-required')) return;
    if (event.target.closest('.rwg-back-games')) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);

  mountIntroBoard();
  mountPauseBoard();
  new MutationObserver(syncPauseBoardVisibility).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(syncPauseBoardVisibility).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  if (pauseBtn) new MutationObserver(syncPauseBoardVisibility).observe(pauseBtn, { childList: true, characterData: true, subtree: true });
  window.addEventListener('rwg:game-over-revealed', syncPauseBoardVisibility);
  window.addEventListener('rwg:session-restored', syncPauseBoardVisibility);
  window.addEventListener('rwg:session-declined', syncPauseBoardVisibility);
  queueMicrotask(syncPauseBoardVisibility);
  loadBoard();
  retryQueue();
  getRunId();
  window.RWGLeaderboard = Object.freeze({ load: loadBoard, getRunId, startNewRun, retryQueue });
})();
