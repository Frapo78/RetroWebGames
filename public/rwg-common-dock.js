(() => {
  'use strict';
  if (!document.body?.hasAttribute('data-rwg-game') || window.RWGCommonDock) return;
  const dock = document.createElement('nav');
  dock.className = 'rwg-common-dock';
  dock.setAttribute('aria-label', 'Controlli globali di gioco');
  document.body.appendChild(dock);

  const move = () => {
    const tools = document.querySelector('.rwg-game-tools');
    const mute = document.getElementById('muteBtn');
    const pause = document.getElementById('pauseBtn');
    const credits = document.querySelector('.rwg-credit-badge');
    const avatar = document.querySelector('.rwg-avatar-link');
    for (const el of [tools, mute, pause, credits, avatar]) {
      if (el && el.parentElement !== dock) dock.appendChild(el);
    }
    if (credits) credits.classList.add('rwg-credit-badge-inline');
    if (avatar) avatar.classList.add('rwg-avatar-link-inline');
  };

  move();
  const observer = new MutationObserver(move);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('rwg:profile-ready', move);
  window.addEventListener('rwg:avatar-ready', move);
  window.RWGCommonDock = Object.freeze({ element: dock, sync: move });
})();
