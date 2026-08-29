(() => {
  'use strict';

  if (window.RWGLeaderboard || !document.body?.hasAttribute('data-rwg-game')) return;

  const API_ROOT = '/api/leaderboards/v1';
  const NAME_KEY = 'rwg.leaderboard.name.v1';
  const QUEUE_KEY = 'rwg.leaderboard.queue.v1';
  const canonical = document.querySelector('link[rel="canonical"]')?.href || location.href;
  const gameSlug = new URL(canonical, location.href).pathname.split('/').filter(Boolean).pop() || 'game';
  const RUN_KEY = `rwg.leaderboard.run.v1:${gameSlug}`;
  const CACHE_KEY = `rwg.leaderboard.cache.v1:${gameSlug}`;
  const startBtn = document.getElementById('startBtn');
  let introBoard = null;
  let latestBoard = null;
  let submitting = false;

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
  const gameLabel = () => (document.title.split('—')[0] || gameSlug).trim();

  function makeBoard() {
    const section = document.createElement('section');
    section.className = 'rwg-leaderboard-board';
    section.setAttribute('aria-label', `Classifica globale ${gameLabel()}`);
    section.innerHTML = `
      <div class="rwg-lb-heading"><span>🏆 TOP 10 GLOBALE</span><button type="button" data-rwg-lb-retry aria-label="Aggiorna classifica">↻</button></div>
      <ol class="rwg-lb-list"><li class="rwg-lb-loading">CONNESSIONE AL CABINATO…</li></ol>
      <p class="rwg-lb-status" aria-live="polite"></p>`;
    section.querySelector('[data-rwg-lb-retry]').addEventListener('click', loadBoard);
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
    if (!introBoard) return;
    introBoard.classList.add('is-loading');
    try {
      const response = await fetch(`${API_ROOT}/games/${encodeURIComponent(gameSlug)}`, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      storage.set(CACHE_KEY, JSON.stringify(data));
      renderBoard(data, false);
    } catch (_) {
      const cached = readJson(CACHE_KEY, null);
      if (cached) renderBoard(cached, true);
      else introBoard.querySelector('.rwg-lb-list').innerHTML = '<li class="rwg-lb-loading">CLASSIFICA NON DISPONIBILE • RIPROVA</li>';
    } finally { introBoard.classList.remove('is-loading'); }
  }

  function setGameOverLocked(locked) {
    document.documentElement.classList.toggle('rwg-leaderboard-required', locked);
    document.querySelectorAll('.rwg-continue-credit,.rwg-play-again').forEach(button => { button.disabled = locked; });
    document.querySelectorAll('.rwg-back-games').forEach(link => {
      link.classList.toggle('is-disabled', locked); link.setAttribute('aria-disabled', String(locked));
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
    const queue = readJson(QUEUE_KEY, []);
    if (!queue.length) return;
    const remaining = [];
    for (const payload of queue) {
      try { await postResult(payload); } catch (error) { if (!error.validation) remaining.push(payload); }
    }
    storage.set(QUEUE_KEY, JSON.stringify(remaining));
  }

  function showRegistration(detail, solitaire = false) {
    document.querySelector('.rwg-leaderboard-entry')?.remove();
    const payload = normalizeResult(detail);
    const section = document.createElement('section');
    section.className = `rwg-leaderboard-entry${solitaire ? ' is-solitaire' : ''}`;
    section.innerHTML = `
      <div class="rwg-lb-entry-kicker">🏆 HIGH SCORE</div>
      <h3>INSERISCI IL TUO NOME</h3>
      <p>Registra questa partita nella classifica globale.</p>
      <form novalidate>
        <input name="nickname" minlength="3" maxlength="12" autocomplete="nickname" spellcheck="false" aria-label="Nickname arcade" placeholder="IL TUO NOME" required>
        <button type="submit">REGISTRA RECORD</button>
      </form>
      <div class="rwg-lb-entry-status" aria-live="polite"></div>`;
    const host = solitaire ? document.body : document.querySelector('.rwg-game-over-card');
    const before = solitaire ? null : host?.querySelector('.rwg-challenge-box');
    if (!host) return;
    if (before) host.insertBefore(section, before); else host.appendChild(section);
    const input = section.querySelector('input');
    const status = section.querySelector('.rwg-lb-entry-status');
    input.value = storage.get(NAME_KEY);
    setGameOverLocked(true);
    setTimeout(() => input.focus({ preventScroll: true }), solitaire ? 150 : 2300);

    section.querySelector('form').addEventListener('submit', async event => {
      event.preventDefault();
      if (submitting) return;
      const nickname = input.value.normalize('NFC').trim().replace(/\s+/g, ' ');
      if (!/^[\p{L}\p{N}_ -]{3,12}$/u.test(nickname)) {
        status.textContent = 'USA 3–12 LETTERE, NUMERI, SPAZI, - O _'; input.focus(); return;
      }
      submitting = true; input.disabled = true; section.querySelector('button').disabled = true; status.textContent = 'REGISTRAZIONE…';
      payload.nickname = nickname; storage.set(NAME_KEY, nickname);
      try {
        const data = await postResult(payload);
        status.textContent = data.current ? `REGISTRATO • POSIZIONE #${data.current.position}` : 'RECORD REGISTRATO!';
        if (data.leaderboard) { storage.set(CACHE_KEY, JSON.stringify(data.leaderboard)); renderBoard(data.leaderboard); }
      } catch (error) {
        if (error.validation) {
          status.textContent = error.message || 'DATI NON VALIDI'; input.disabled = false; section.querySelector('button').disabled = false; submitting = false; return;
        }
        queueResult(payload); status.textContent = 'SALVATO • INVIO AUTOMATICO APPENA ONLINE';
      }
      section.classList.add('is-registered'); setGameOverLocked(false); submitting = false;
      window.dispatchEvent(new CustomEvent('rwg:leaderboard-registered', { detail: { runId: payload.runId, gameSlug } }));
      if (solitaire) setTimeout(() => section.remove(), 1100);
    });
  }

  window.addEventListener('rwg:game-session-start', startNewRun);
  window.addEventListener('rwg:game-over-summary', event => showRegistration(event.detail || {}, false));
  window.addEventListener('rwg:leaderboard-result', event => showRegistration(event.detail || {}, true));
  window.addEventListener('online', () => { retryQueue(); loadBoard(); });
  document.addEventListener('click', event => {
    if (!document.documentElement.classList.contains('rwg-leaderboard-required')) return;
    if (event.target.closest('.rwg-back-games')) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);

  mountIntroBoard();
  loadBoard();
  retryQueue();
  getRunId();
  window.RWGLeaderboard = Object.freeze({ load: loadBoard, getRunId, startNewRun, retryQueue });
})();
