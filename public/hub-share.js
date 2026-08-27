(() => {
  'use strict';

  const dock = document.querySelector('.share-dock');
  if (!dock) return;

  const title = 'RetroWebGames';
  const text = '🎮 Prova RetroWebGames: giochi arcade gratuiti direttamente nel browser!';
  const url = 'https://www.retrowebgames.it/';

  const canonical = document.querySelector('link[rel="canonical"]') || document.createElement('link');
  canonical.rel = 'canonical';
  canonical.href = url;
  if (!canonical.parentNode) document.head.appendChild(canonical);

  const ensureMeta = (property, content) => {
    let el = document.querySelector(`meta[property="${property}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('property', property);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  ensureMeta('og:url', url);
  ensureMeta('og:title', title);
  ensureMeta('og:description', 'Giochi arcade gratuiti ispirati ai grandi classici, direttamente nel browser.');
  ensureMeta('og:type', 'website');

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
