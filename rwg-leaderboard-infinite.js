(() => {
  'use strict';

  if (!document.body?.hasAttribute('data-rwg-game') || window.RWGLeaderboardInfinite) return;

  const API_ROOT = '/api/leaderboards/v1';
  const PAGE_SIZE = 20;
  const canonical = document.querySelector('link[rel="canonical"]')?.href || location.href;
  const gameSlug = new URL(canonical, location.href).pathname.split('/').filter(Boolean).pop() || 'game';
  const formatNumber = value => Number(value || 0).toLocaleString('it-IT');
  let board = null;
  let list = null;
  let status = null;
  let rows = [];
  let pagination = { offset: 0, limit: PAGE_SIZE, total: 0, hasMore: true, nextOffset: 0 };
  let loading = false;
  let owned = false;
  let renderGuard = false;
  let controller = null;
  let retryButton = null;

  const track = (name, params = {}) => window.RWGAnalytics?.track?.(name, params);

  function resultText(row) {
    if (gameSlug === 'neon-rally' && row.resultLabel) return row.resultLabel;
    return formatNumber(row.score);
  }

  function appendRow(fragment, row) {
    const li = document.createElement('li');
    if (row.isCurrent) li.classList.add('is-current');
    li.dataset.runId = row.runId || '';
    const rank = document.createElement('span'); rank.className = 'rwg-lb-rank'; rank.textContent = `#${row.position}`;
    const name = document.createElement('strong'); name.className = 'rwg-lb-name'; name.textContent = row.nickname || 'PLAYER';
    const score = document.createElement('b'); score.className = 'rwg-lb-score'; score.textContent = resultText(row);
    li.append(rank, name, score);
    if (Number(row.continueCount) > 0) {
      const used = document.createElement('small'); used.textContent = `CONTINUE ×${row.continueCount}`; li.appendChild(used);
    }
    fragment.appendChild(li);
  }

  function render() {
    if (!list) return;
    renderGuard = true;
    const fragment = document.createDocumentFragment();
    for (const row of rows) appendRow(fragment, row);
    if (!rows.length && !loading) {
      const empty = document.createElement('li');
      empty.className = 'rwg-lb-loading';
      empty.textContent = 'NESSUN RECORD • INAUGURA LA CLASSIFICA!';
      fragment.appendChild(empty);
    }
    if (loading) {
      const more = document.createElement('li');
      more.className = 'rwg-lb-more';
      more.textContent = rows.length ? 'CARICAMENTO ALTRI RECORD…' : 'CONNESSIONE AL CABINATO…';
      fragment.appendChild(more);
    } else if (pagination.hasMore) {
      const more = document.createElement('li');
      more.className = 'rwg-lb-more';
      more.textContent = '↓ SCORRI PER ALTRI RECORD';
      fragment.appendChild(more);
    }
    list.replaceChildren(fragment);
    const shown = rows.length;
    const total = Math.max(shown, Number(pagination.total || 0));
    if (status) {
      status.textContent = total
        ? `${shown.toLocaleString('it-IT')} DI ${total.toLocaleString('it-IT')}${pagination.hasMore ? ' • SCORRI PER CONTINUARE' : ' • TUTTI I RECORD'}`
        : '';
    }
    setTimeout(() => { renderGuard = false; }, 0);
  }

  function mergeRows(nextRows, replace = false) {
    const map = new Map((replace ? [] : rows).map(row => [row.runId || `position:${row.position}`, row]));
    for (const row of nextRows || []) map.set(row.runId || `position:${row.position}`, row);
    rows = [...map.values()].sort((a, b) => Number(a.position) - Number(b.position));
  }

  async function fetchPage(offset, { replace = false } = {}) {
    if (loading || (!replace && !pagination.hasMore)) return;
    loading = true;
    render();
    if (replace) {
      controller?.abort();
      controller = new AbortController();
    }
    const signal = controller?.signal;
    try {
      const url = `${API_ROOT}/games/${encodeURIComponent(gameSlug)}?limit=${PAGE_SIZE}&offset=${Math.max(0, offset)}`;
      const response = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' }, signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      mergeRows(data.top || [], replace);
      pagination = {
        limit: Number(data.pagination?.limit || PAGE_SIZE),
        offset: Number(data.pagination?.offset || offset),
        total: Number(data.pagination?.total || rows.length),
        hasMore: Boolean(data.pagination?.hasMore),
        nextOffset: Number(data.pagination?.nextOffset ?? rows.length)
      };
      track('leaderboard_infinite_page', {
        leaderboard_page: Math.floor(pagination.offset / PAGE_SIZE) + 1,
        row_count: Number(data.top?.length || 0),
        loaded_count: rows.length,
        total_count: pagination.total,
        has_more: Number(pagination.hasMore)
      });
    } catch (error) {
      if (error?.name !== 'AbortError') {
        if (!rows.length && status) status.textContent = 'CLASSIFICA NON DISPONIBILE • RIPROVA';
        track('leaderboard_load_error', { error_type: 'infinite_page' });
      }
    } finally {
      loading = false;
      render();
    }
  }

  function reset() {
    pagination = { offset: 0, limit: PAGE_SIZE, total: 0, hasMore: true, nextOffset: 0 };
    rows = [];
    list?.scrollTo?.({ top: 0, behavior: 'auto' });
    return fetchPage(0, { replace: true });
  }

  function maybeLoadMore() {
    if (!list || loading || !pagination.hasMore) return;
    const remaining = list.scrollHeight - list.scrollTop - list.clientHeight;
    if (remaining <= 72) fetchPage(pagination.nextOffset || rows.length);
  }

  function ownBoard(found) {
    if (owned || !found) return;
    board = found;
    list = board.querySelector('.rwg-lb-list');
    status = board.querySelector('.rwg-lb-status');
    retryButton = board.querySelector('[data-rwg-lb-retry]');
    if (!list || !status) return;
    owned = true;
    board.dataset.rwgInfinite = 'true';
    const heading = board.querySelector('.rwg-lb-heading span');
    if (heading) heading.textContent = '🏆 CLASSIFICA GLOBALE';
    list.setAttribute('tabindex', '0');
    list.setAttribute('aria-label', 'Classifica globale scorrevole. Carica 20 posizioni alla volta.');
    list.addEventListener('scroll', maybeLoadMore, { passive: true });
    list.addEventListener('wheel', maybeLoadMore, { passive: true });
    list.addEventListener('touchend', () => requestAnimationFrame(maybeLoadMore), { passive: true });
    retryButton?.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      track('leaderboard_retry', { source: 'infinite_intro' });
      reset();
    }, true);

    const guard = new MutationObserver(() => {
      if (!renderGuard && rows.length) render();
    });
    guard.observe(list, { childList: true });

    window.addEventListener('online', reset);
    window.addEventListener('rwg:leaderboard-registered', () => setTimeout(reset, 80));
    reset();
  }

  function seekBoard() {
    const found = document.querySelector('.rwg-leaderboard-board');
    if (!found) return false;
    if (found.classList.contains('is-loading')) return false;
    ownBoard(found);
    return owned;
  }

  if (!seekBoard()) {
    const observer = new MutationObserver(() => {
      if (seekBoard()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    setTimeout(() => { if (!owned) ownBoard(document.querySelector('.rwg-leaderboard-board')); }, 1800);
  }

  window.RWGLeaderboardInfinite = Object.freeze({ reset, loadMore: maybeLoadMore, pageSize: PAGE_SIZE });
})();
