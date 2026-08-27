(() => {
  'use strict';

  const dock = document.querySelector('.share-dock');
  if (!dock) return;

  const title = 'RetroWebGames';
  const text = '🎮 Prova RetroWebGames: giochi arcade gratuiti direttamente nel browser!';
  const pageUrl = new URL(window.location.href);
  pageUrl.hash = '';
  pageUrl.search = '';
  const url = pageUrl.toString();

  const q = encodeURIComponent;
  const links = {
    whatsapp: `https://wa.me/?text=${q(`${text} ${url}`)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${q(url)}`,
    x: `https://twitter.com/intent/tweet?text=${q(text)}&url=${q(url)}`,
    telegram: `https://t.me/share/url?url=${q(url)}&text=${q(text)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${q(url)}`
  };

  Object.entries(links).forEach(([name, href]) => {
    const el = dock.querySelector(`[data-share="${name}"]`);
    if (el) el.href = href;
  });

  const more = dock.querySelector('[data-share="more"]');
  if (more) {
    more.addEventListener('click', async () => {
      if (navigator.share) {
        try {
          await navigator.share({ title, text, url });
          return;
        } catch (err) {
          if (err && err.name === 'AbortError') return;
        }
      }
      window.location.href = `mailto:?subject=${q(title)}&body=${q(`${text}\n\n${url}`)}`;
    });
  }
})();
