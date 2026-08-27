(function () {
  'use strict';

  const SELECTOR = 'img[data-rwg-src]';
  const observed = new WeakSet();

  function markLoaded(image) {
    image.classList.add('rwg-lazy-loaded');
    image.classList.remove('rwg-lazy-pending');
  }

  function loadImage(image) {
    if (!(image instanceof HTMLImageElement) || !image.dataset.rwgSrc) return;
    image.classList.add('rwg-lazy-pending');

    if (image.dataset.rwgSrcset) {
      image.srcset = image.dataset.rwgSrcset;
      delete image.dataset.rwgSrcset;
    }
    if (image.dataset.rwgSizes) {
      image.sizes = image.dataset.rwgSizes;
      delete image.dataset.rwgSizes;
    }

    image.src = image.dataset.rwgSrc;
    delete image.dataset.rwgSrc;
    observer?.unobserve(image);

    if (image.complete) {
      markLoaded(image);
    } else {
      image.addEventListener('load', () => markLoaded(image), { once: true });
      image.addEventListener('error', () => image.classList.add('rwg-lazy-error'), { once: true });
    }
  }

  const observer = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting || entry.intersectionRatio > 0) loadImage(entry.target);
        });
      }, { rootMargin: '280px 0px', threshold: 0.01 })
    : null;

  function observeImage(image) {
    if (!(image instanceof HTMLImageElement) || !image.dataset.rwgSrc || observed.has(image)) return;
    observed.add(image);
    image.loading = 'lazy';
    image.decoding = 'async';
    if (observer) observer.observe(image);
    else loadImage(image);
  }

  function observe(root) {
    if (root instanceof HTMLImageElement) observeImage(root);
    root.querySelectorAll?.(SELECTOR).forEach(observeImage);
  }

  function boot() {
    observe(document);
    new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(node => {
        if (node instanceof Element) observe(node);
      }));
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  window.RWGLazyImages = Object.freeze({
    observe,
    load: loadImage
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
