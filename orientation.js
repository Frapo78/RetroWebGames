(() => {
  'use strict';

  if (!document.body || !document.body.hasAttribute('data-rwg-game')) return;

  const selfSrc = document.currentScript?.src;
  if (selfSrc) {
    const base = new URL('.', selfSrc);
    if (!document.querySelector('link[data-rwg-controls-style]')) {
      const controlsStyle = document.createElement('link');
      controlsStyle.rel = 'stylesheet';
      controlsStyle.href = new URL('rwg-controls.css', base).href;
      controlsStyle.dataset.rwgControlsStyle = 'true';
      document.head.appendChild(controlsStyle);
    }
    if (!document.querySelector('link[data-rwg-vjoy-style]')) {
      const joystickStyle = document.createElement('link');
      joystickStyle.rel = 'stylesheet';
      joystickStyle.href = new URL('rwg-virtual-joystick.css', base).href;
      joystickStyle.dataset.rwgVjoyStyle = 'true';
      document.head.appendChild(joystickStyle);
    }
    if (!window.RWGVirtualJoystick && !document.querySelector('script[data-rwg-vjoy-script]')) {
      const joystickScript = document.createElement('script');
      joystickScript.src = new URL('rwg-virtual-joystick.js', base).href;
      joystickScript.dataset.rwgVjoyScript = 'true';
      document.body.appendChild(joystickScript);
    }
    if (!document.querySelector('link[data-rwg-pause-style]')) {
      const pauseStyle = document.createElement('link');
      pauseStyle.rel = 'stylesheet';
      pauseStyle.href = new URL('rwg-pause-menu.css', base).href;
      pauseStyle.dataset.rwgPauseStyle = 'true';
      document.head.appendChild(pauseStyle);
    }
    if (!window.RWGPauseMenu && !document.querySelector('script[data-rwg-pause-script]')) {
      const pauseScript = document.createElement('script');
      pauseScript.src = new URL('rwg-pause-menu.js', base).href;
      pauseScript.dataset.rwgPauseScript = 'true';
      document.body.appendChild(pauseScript);
    }
  }

  const touchCapable = navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;
  const mobileLike = window.matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const shortestSide = Math.min(screen.width || innerWidth, screen.height || innerHeight);
  const handheld = touchCapable && mobileLike && shortestSide <= 900;
  if (!handheld) return;

  const pauseBtn = document.getElementById('pauseBtn');
  const gameOverlay = document.getElementById('overlay');
  let orientationPaused = false;
  let landscapeShown = false;
  let countdownRun = 0;

  const gate = document.createElement('section');
  gate.className = 'rwg-orientation-layer';
  gate.id = 'rwgOrientationGate';
  gate.hidden = true;
  gate.setAttribute('role', 'alertdialog');
  gate.setAttribute('aria-modal', 'true');
  gate.setAttribute('aria-labelledby', 'rwgOrientationTitle');
  gate.innerHTML = `
    <div class="rwg-orientation-card">
      <div class="rwg-orientation-brand">RETROWEBGAMES</div>
      <div class="rwg-phone-stage" aria-hidden="true">
        <div class="rwg-phone"><div class="rwg-phone-screen"></div></div>
        <div class="rwg-turn-arrow"></div>
      </div>
      <h2 id="rwgOrientationTitle">Gira il telefono <span>in verticale</span></h2>
      <p>Questo gioco è progettato per la modalità portrait. Ruota lo smartphone per continuare la partita.</p>
      <span class="rwg-orientation-hint">PARTITA IN PAUSA • NESSUN PROGRESSO PERSO</span>
    </div>`;

  const countdown = document.createElement('section');
  countdown.className = 'rwg-countdown-layer';
  countdown.id = 'rwgResumeCountdown';
  countdown.hidden = true;
  countdown.setAttribute('aria-live', 'assertive');
  countdown.setAttribute('aria-atomic', 'true');
  countdown.innerHTML = `
    <div class="rwg-countdown-core">
      <div class="rwg-countdown-ring" aria-hidden="true"></div>
      <div class="rwg-countdown-value">3</div>
    </div>`;

  document.body.append(gate, countdown);
  const countdownValue = countdown.querySelector('.rwg-countdown-value');

  const isLandscape = () => window.matchMedia('(orientation: landscape)').matches || innerWidth > innerHeight;

  const isGameActivelyPlaying = () => {
    if (!pauseBtn) return false;
    if (pauseBtn.textContent.trim() === '▶') return false;
    if (gameOverlay && gameOverlay.classList.contains('visible')) return false;
    return true;
  };

  const pauseForOrientation = () => {
    if (orientationPaused || !isGameActivelyPlaying()) return;
    pauseBtn.click();
    if (pauseBtn.textContent.trim() === '▶') orientationPaused = true;
  };

  const cancelCountdown = () => {
    countdownRun++;
    countdown.hidden = true;
  };

  const setCountToken = token => {
    countdownValue.textContent = token;
    countdownValue.classList.toggle('rwg-go', token === 'GO!');
    countdownValue.style.animation = 'none';
    void countdownValue.offsetWidth;
    countdownValue.style.animation = '';
  };

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  const resumeWithCountdown = async () => {
    if (!orientationPaused || document.hidden || isLandscape()) return;
    const run = ++countdownRun;
    gate.hidden = true;
    countdown.hidden = false;

    for (const token of ['3', '2', '1', 'GO!']) {
      if (run !== countdownRun || document.hidden || isLandscape()) return;
      setCountToken(token);
      await delay(token === 'GO!' ? 700 : 650);
    }

    if (run !== countdownRun || document.hidden || isLandscape()) return;
    countdown.hidden = true;
    if (orientationPaused && pauseBtn && pauseBtn.textContent.trim() === '▶') pauseBtn.click();
    orientationPaused = false;
  };

  const showLandscapeGate = () => {
    cancelCountdown();
    pauseForOrientation();
    landscapeShown = true;
    gate.hidden = false;
    document.body.classList.add('rwg-landscape-blocked');
  };

  const showPortrait = () => {
    gate.hidden = true;
    document.body.classList.remove('rwg-landscape-blocked');
    if (landscapeShown) {
      landscapeShown = false;
      if (orientationPaused) resumeWithCountdown();
    }
  };

  const syncOrientation = () => {
    if (isLandscape()) showLandscapeGate();
    else showPortrait();
  };

  const tryNativeLock = () => {
    try {
      const result = screen.orientation && screen.orientation.lock ? screen.orientation.lock('portrait-primary') : null;
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch (_) {}
  };

  window.addEventListener('resize', syncOrientation, { passive: true });
  window.addEventListener('orientationchange', syncOrientation, { passive: true });
  if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', syncOrientation);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelCountdown();
    else syncOrientation();
  });
  document.addEventListener('pointerup', tryNativeLock, { once: true, capture: true });

  syncOrientation();
})();
