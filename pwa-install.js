(function () {
  'use strict';

  const NOTICE_KEY = 'rwg.pwa.install.notice.v1';
  const INSTALL_SELECTOR = '[data-pwa-install]';
  const IOS_GUIDANCE = 'Su iPhone o iPad: tocca Condividi ⤴︎, poi “Aggiungi alla schermata Home”.';
  let deferredPrompt = null;

  function isStandalone() {
    return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function isIos() {
    const ua = navigator.userAgent || '';
    return /iphone|ipad|ipod/i.test(ua)
      || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  }

  function wasNoticeSeen() {
    try {
      return localStorage.getItem(NOTICE_KEY) === '1';
    } catch (_) {
      return document.cookie.split(';').some(part => part.trim() === NOTICE_KEY + '=1');
    }
  }

  function rememberNotice() {
    try {
      localStorage.setItem(NOTICE_KEY, '1');
    } catch (_) {
      document.cookie = NOTICE_KEY + '=1; Max-Age=31536000; Path=/; SameSite=Lax';
    }
  }

  function track(method, result) {
    window.RWGAnalytics?.track?.('pwa_install_cta', { method, result });
  }

  function setGuidance(message) {
    document.querySelectorAll('[data-pwa-guidance]').forEach(node => {
      node.textContent = message;
      node.hidden = false;
    });
  }

  function configureIosInstallUi() {
    if (!isIos()) return false;
    document.body.classList.add('rwg-ios-install');
    document.querySelectorAll(INSTALL_SELECTOR).forEach(button => { button.hidden = true; });
    setGuidance(IOS_GUIDANCE);
    return true;
  }

  function dismissNotice() {
    const notice = document.getElementById('pwaInstallNotice');
    if (!notice || notice.hidden) return;
    notice.classList.remove('is-visible');
    window.setTimeout(() => { notice.hidden = true; }, 280);
  }

  function hideInstallUi() {
    dismissNotice();
    const card = document.getElementById('pwaInstallCard');
    if (card) card.hidden = true;
  }

  async function requestInstall() {
    if (isStandalone()) {
      hideInstallUi();
      return;
    }

    if (deferredPrompt) {
      const promptEvent = deferredPrompt;
      deferredPrompt = null;
      promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      track('native', choice?.outcome || 'unknown');
      if (choice?.outcome === 'accepted') hideInstallUi();
      return;
    }

    if (isIos()) {
      setGuidance(IOS_GUIDANCE);
      track('ios_guidance', 'shown');
      return;
    }

    setGuidance('Apri il menu del browser e scegli “Installa app” o “Aggiungi alla schermata Home”.');
    track('browser_guidance', 'shown');
  }

  function bindUi() {
    document.querySelectorAll(INSTALL_SELECTOR).forEach(button => {
      button.addEventListener('click', requestInstall);
    });
    document.querySelectorAll('[data-pwa-dismiss]').forEach(button => {
      button.addEventListener('click', dismissNotice);
    });

    if (isStandalone()) {
      hideInstallUi();
      return;
    }

    configureIosInstallUi();

    window.setTimeout(() => {
      const notice = document.getElementById('pwaInstallNotice');
      if (!notice || wasNoticeSeen()) return;
      rememberNotice();
      notice.hidden = false;
      requestAnimationFrame(() => notice.classList.add('is-visible'));
      window.setTimeout(dismissNotice, 10000);
    }, 2000);
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    document.querySelectorAll(INSTALL_SELECTOR).forEach(button => {
      button.disabled = false;
      button.removeAttribute('aria-disabled');
    });
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    rememberNotice();
    hideInstallUi();
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindUi, { once: true });
  } else {
    bindUi();
  }
})();
