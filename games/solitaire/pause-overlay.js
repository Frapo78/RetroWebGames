(() => {
  'use strict';

  const app = document.getElementById('app');
  const pauseBtn = document.getElementById('pauseBtn');
  if (!app || !pauseBtn || document.getElementById('solitairePauseOverlay')) return;

  const intro = document.getElementById('overlay');
  const win = document.getElementById('winScreen');
  const newDealConfirm = document.getElementById('newDealConfirm');

  const overlay = document.createElement('section');
  overlay.id = 'solitairePauseOverlay';
  overlay.className = 'solitaire-pause-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('aria-label', 'Gioco in pausa');
  overlay.innerHTML = `
    <div class="solitaire-pause-panel">
      <div class="solitaire-pause-kicker" aria-hidden="true">RETROWEBGAMES • SOLITARIO</div>
      <div class="solitaire-pause-title">GIOCO IN PAUSA</div>
      <button id="solitairePauseResume" class="solitaire-pause-resume" type="button" aria-label="Riprendi il gioco">
        <span aria-hidden="true">| |</span>
      </button>
    </div>`;
  app.appendChild(overlay);

  const resumeBtn = overlay.querySelector('#solitairePauseResume');
  let wasVisible = false;

  function isPaused() {
    return pauseBtn.getAttribute('aria-label') === 'Riprendi';
  }

  function otherModalVisible() {
    return Boolean(
      intro?.classList.contains('visible') ||
      win?.classList.contains('visible') ||
      newDealConfirm?.classList.contains('visible')
    );
  }

  function sync() {
    const visible = isPaused() && !otherModalVisible();
    overlay.classList.toggle('visible', visible);
    overlay.setAttribute('aria-hidden', String(!visible));

    if (visible && !wasVisible) {
      window.RWGAnalytics?.track?.('solitaire_pause_overlay', { phase: 'show' });
    }
    wasVisible = visible;
  }

  resumeBtn.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    if (!isPaused()) return sync();
    window.RWGAnalytics?.track?.('solitaire_pause_overlay', { phase: 'resume' });
    pauseBtn.click();
    requestAnimationFrame(sync);
  });

  const pauseObserver = new MutationObserver(sync);
  pauseObserver.observe(pauseBtn, { attributes: true, attributeFilter: ['aria-label'], childList: true, subtree: true });

  const modalObserver = new MutationObserver(sync);
  for (const node of [intro, win, newDealConfirm]) {
    if (node) modalObserver.observe(node, { attributes: true, attributeFilter: ['class', 'aria-hidden'] });
  }

  document.addEventListener('visibilitychange', () => requestAnimationFrame(sync));
  window.addEventListener('rwg:game-session-start', () => requestAnimationFrame(sync));
  window.addEventListener('rwg:continue-game', () => requestAnimationFrame(sync));

  sync();
})();