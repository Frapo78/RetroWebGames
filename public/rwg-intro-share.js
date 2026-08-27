(() => {
  'use strict';

  if (!document.body?.hasAttribute('data-rwg-game')) return;
  if (document.querySelector('.rwg-intro-share')) return;

  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('startBtn');
  const panel = overlay?.querySelector('.panel, .intro-panel');
  if (!overlay || !startBtn || !panel) return;

  const canonical = document.querySelector('link[rel="canonical"]')?.href || window.location.href;
  const gameName = (document.title.split('—')[0] || 'RetroWebGames').trim();
  const shareText = `🎮 Sto giocando a ${gameName} su RetroWebGames. Provalo anche tu!`;
  const q = encodeURIComponent;

  const icons = Object.freeze({
    whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.04 2a9.84 9.84 0 0 0-8.42 14.93L2.05 22l5.2-1.52A9.95 9.95 0 1 0 12.04 2Zm0 17.86a8.02 8.02 0 0 1-4.09-1.12l-.29-.17-3.08.9.92-3-.19-.31a7.9 7.9 0 1 1 6.73 3.7Zm4.4-5.92c-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.37-1.94-1.19a7.28 7.28 0 0 1-1.34-1.67c-.14-.24-.01-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.19-.47-.39-.41-.54-.42h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.1 3.62.57.25 1.02.39 1.37.5.58.18 1.1.16 1.51.1.46-.07 1.43-.58 1.63-1.15.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.7 22v-9h3l.45-3.5H13.7V7.26c0-1.01.28-1.7 1.74-1.7h1.86V2.43c-.32-.04-1.43-.13-2.72-.13-2.7 0-4.55 1.65-4.55 4.68V9.5H7v3.5h3.03v9h3.67Z"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.9 2H22l-6.77 7.74L23.2 22h-6.24l-4.89-6.39L6.48 22H3.36l7.26-8.3L2.98 2h6.4l4.42 5.84L18.9 2Zm-1.1 17.84h1.72L8.45 4.05H6.6L17.8 19.84Z"/></svg>',
    telegram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21.7 3.2-3.2 15.1c-.24 1.07-.87 1.33-1.76.83l-4.88-3.6-2.35 2.27c-.26.26-.48.48-.98.48l.35-4.97 9.04-8.17c.39-.35-.09-.55-.61-.2L6.14 11.97 1.32 10.46C.27 10.13.25 9.41 1.54 8.9L20.4 1.63c.87-.32 1.64.2 1.3 1.57Z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.32 7.43A2.07 2.07 0 1 1 5.32 3.3a2.07 2.07 0 0 1 0 4.13ZM7.1 20.45H3.54V9H7.1v11.45Z"/></svg>'
  });

  const links = Object.freeze({
    whatsapp: `https://wa.me/?text=${q(`${shareText} ${canonical}`)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${q(canonical)}`,
    x: `https://twitter.com/intent/tweet?text=${q(shareText)}&url=${q(canonical)}`,
    telegram: `https://t.me/share/url?url=${q(canonical)}&text=${q(shareText)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${q(canonical)}`
  });

  const labels = Object.freeze({
    whatsapp: 'Condividi su WhatsApp',
    facebook: 'Condividi su Facebook',
    x: 'Condividi su X',
    telegram: 'Condividi su Telegram',
    linkedin: 'Condividi su LinkedIn'
  });

  const row = document.createElement('nav');
  row.className = 'rwg-intro-share';
  row.setAttribute('aria-label', `Condividi ${gameName}`);

  for (const network of ['whatsapp', 'facebook', 'x', 'telegram', 'linkedin']) {
    const link = document.createElement('a');
    link.className = 'rwg-intro-share-btn';
    link.dataset.network = network;
    link.href = links[network];
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', labels[network]);
    link.innerHTML = icons[network];
    row.appendChild(link);
  }

  const hint = panel.querySelector('.hint');
  if (hint?.parentNode === panel) hint.after(row);
  else panel.appendChild(row);

  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    row.hidden = true;
    observer.disconnect();
  };

  startBtn.addEventListener('click', dismiss, { once: true });

  const observer = new MutationObserver(() => {
    if (!overlay.classList.contains('visible')) dismiss();
  });
  observer.observe(overlay, { attributes: true, attributeFilter: ['class', 'hidden', 'style'] });

  if (!overlay.classList.contains('visible')) dismiss();
})();
