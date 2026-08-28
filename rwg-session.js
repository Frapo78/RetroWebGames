(() => {
  'use strict';

  if (window.RWGSession) return;

  const STORAGE_PREFIX = 'rwg.session.v1:';
  const ENVELOPE_SCHEMA = 1;
  const DIRTY_DEBOUNCE_MS = 900;
  const HEARTBEAT_MS = 7000;
  const MAX_SNAPSHOT_BYTES = 256 * 1024;
  const FORCE_WRITE_REASONS = new Set(['hidden', 'pagehide', 'beforeunload', 'freeze', 'navigation', 'resumed']);

  let adapter = null;
  let saveTimer = 0;
  let heartbeatTimer = 0;
  let dirty = false;
  let modal = null;
  let promptOpen = false;
  let lastPayloadJson = '';

  const safeId = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  const storageKeyFor = gameId => `${STORAGE_PREFIX}${safeId(gameId)}`;

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (_) { return false; }
  }

  function storageRemove(key) {
    try { localStorage.removeItem(key); } catch (_) {}
  }

  function currentKey() {
    return adapter ? storageKeyFor(adapter.id) : '';
  }

  function readSaved() {
    if (!adapter) return null;
    const raw = storageGet(currentKey());
    if (!raw) return null;
    try {
      const envelope = JSON.parse(raw);
      if (
        !envelope ||
        envelope.schema !== ENVELOPE_SCHEMA ||
        envelope.gameId !== adapter.id ||
        envelope.adapterVersion !== adapter.version ||
        !envelope.payload ||
        typeof envelope.payload !== 'object'
      ) {
        storageRemove(currentKey());
        return null;
      }
      return envelope;
    } catch (_) {
      storageRemove(currentKey());
      return null;
    }
  }

  function isInProgress() {
    try { return Boolean(adapter?.isInProgress?.()); } catch (_) { return false; }
  }

  function serializeEnvelope(reason = 'autosave') {
    if (!adapter || !isInProgress()) return null;
    try {
      const payload = adapter.serialize();
      if (!payload || typeof payload !== 'object') return null;
      return {
        schema: ENVELOPE_SCHEMA,
        gameId: adapter.id,
        adapterVersion: adapter.version,
        savedAt: Date.now(),
        reason,
        payload
      };
    } catch (_) {
      return null;
    }
  }

  function saveNow(reason = 'manual') {
    clearTimeout(saveTimer);
    saveTimer = 0;
    if (!adapter || !isInProgress()) return false;
    const envelope = serializeEnvelope(reason);
    if (!envelope) return false;
    let payloadJson = '';
    let encoded = '';
    try {
      payloadJson = JSON.stringify(envelope.payload);
      encoded = JSON.stringify(envelope);
    } catch (_) {
      return false;
    }
    if (encoded.length > MAX_SNAPSHOT_BYTES) return false;
    if (payloadJson === lastPayloadJson && !FORCE_WRITE_REASONS.has(reason)) {
      dirty = false;
      return true;
    }
    const ok = storageSet(currentKey(), encoded);
    if (ok) {
      lastPayloadJson = payloadJson;
      dirty = false;
    }
    return ok;
  }

  function scheduleSave(reason = 'dirty') {
    if (!adapter || !isInProgress()) return;
    dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveNow(reason), DIRTY_DEBOUNCE_MS);
  }

  function clearSaved() {
    clearTimeout(saveTimer);
    saveTimer = 0;
    dirty = false;
    lastPayloadJson = '';
    if (adapter) storageRemove(currentKey());
  }

  function ensureModal() {
    if (modal?.isConnected) return modal;
    modal = document.createElement('section');
    modal.className = 'rwg-resume-layer';
    modal.hidden = true;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'rwgResumeQuestion');
    modal.innerHTML = `
      <div class="rwg-resume-card">
        <div class="rwg-resume-kicker">PARTITA SALVATA</div>
        <h2 id="rwgResumeQuestion">Vuoi continuare la partita precedente?</h2>
        <p class="rwg-resume-meta" data-rwg-resume-meta></p>
        <div class="rwg-resume-actions">
          <button type="button" class="rwg-resume-no" data-rwg-resume-no>No</button>
          <button type="button" class="rwg-resume-yes" data-rwg-resume-yes>Sì</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    return modal;
  }

  function hidePrompt() {
    promptOpen = false;
    if (modal) modal.hidden = true;
    document.documentElement.classList.remove('rwg-resume-open');
  }

  function startFresh() {
    try {
      if (typeof adapter?.startFresh === 'function') adapter.startFresh();
      else document.getElementById('startBtn')?.click();
    } catch (_) {}
  }

  function showPrompt(envelope) {
    if (!adapter || !envelope || promptOpen) return;
    const layer = ensureModal();
    const meta = layer.querySelector('[data-rwg-resume-meta]');
    let description = '';
    try { description = String(adapter.describe?.(envelope.payload, envelope) || ''); } catch (_) {}
    meta.textContent = description;
    meta.hidden = !description;
    promptOpen = true;
    layer.hidden = false;
    document.documentElement.classList.add('rwg-resume-open');

    const no = layer.querySelector('[data-rwg-resume-no]');
    const yes = layer.querySelector('[data-rwg-resume-yes]');

    no.onclick = () => {
      clearSaved();
      hidePrompt();
      startFresh();
      window.dispatchEvent(new CustomEvent('rwg:session-declined', { detail: { gameId: adapter.id } }));
    };

    yes.onclick = () => {
      let restored = false;
      try { restored = adapter.restore(envelope.payload, envelope) !== false; } catch (_) { restored = false; }
      if (!restored) {
        clearSaved();
        hidePrompt();
        startFresh();
        window.dispatchEvent(new CustomEvent('rwg:session-restore-failed', { detail: { gameId: adapter.id } }));
        return;
      }
      hidePrompt();
      dirty = true;
      saveNow('resumed');
      window.dispatchEvent(new CustomEvent('rwg:session-restored', { detail: { gameId: adapter.id, savedAt: envelope.savedAt } }));
    };

    requestAnimationFrame(() => yes.focus({ preventScroll: true }));
  }

  function register(nextAdapter) {
    if (!nextAdapter || typeof nextAdapter !== 'object') return false;
    const id = safeId(nextAdapter.id);
    const version = Number(nextAdapter.version);
    if (!id || !Number.isInteger(version) || version < 1) return false;
    if (typeof nextAdapter.serialize !== 'function' || typeof nextAdapter.restore !== 'function' || typeof nextAdapter.isInProgress !== 'function') return false;

    adapter = { ...nextAdapter, id, version };
    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (!document.hidden && isInProgress()) saveNow('heartbeat');
    }, HEARTBEAT_MS);

    const saved = readSaved();
    if (saved) {
      try {
        if (typeof adapter.validate === 'function' && adapter.validate(saved.payload) === false) {
          clearSaved();
        } else {
          requestAnimationFrame(() => showPrompt(saved));
          return true;
        }
      } catch (_) {
        clearSaved();
      }
    }

    if (isInProgress()) scheduleSave('register');
    return true;
  }

  function forceLifecycleSave(reason) {
    if (promptOpen) return;
    saveNow(reason);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) forceLifecycleSave('hidden');
  });
  window.addEventListener('pagehide', () => forceLifecycleSave('pagehide'), { capture: true });
  window.addEventListener('beforeunload', () => forceLifecycleSave('beforeunload'), { capture: true });
  document.addEventListener('freeze', () => forceLifecycleSave('freeze'), { capture: true });
  document.addEventListener('click', event => {
    const anchor = event.target?.closest?.('a[href]');
    if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
    forceLifecycleSave('navigation');
  }, true);

  window.RWGSession = Object.freeze({
    register,
    markDirty: scheduleSave,
    saveNow,
    clear: clearSaved,
    hasSaved: () => Boolean(readSaved()),
    storageKey: () => currentKey(),
    config: Object.freeze({ dirtyDebounceMs: DIRTY_DEBOUNCE_MS, heartbeatMs: HEARTBEAT_MS, maxSnapshotBytes: MAX_SNAPSHOT_BYTES })
  });

  if (window.RWGResumeAdapter) register(window.RWGResumeAdapter);
  window.dispatchEvent(new CustomEvent('rwg:session-ready'));
})();
