(() => {
  'use strict';

  const prevent = event => {
    if (event.cancelable) event.preventDefault();
  };

  // Standards path: CSS touch-action:none handles modern Pointer Events browsers.
  // These listeners cover browser-specific zoom gestures that bypass touch-action,
  // especially iOS/WebKit gesture events and double-tap zoom fallbacks.
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, prevent, { capture: true, passive: false });
  }

  document.addEventListener('dblclick', prevent, { capture: true, passive: false });

  document.addEventListener('wheel', event => {
    if (event.ctrlKey || event.metaKey) prevent(event);
  }, { capture: true, passive: false });

  document.addEventListener('touchstart', event => {
    if (event.touches?.length > 1) prevent(event);
  }, { capture: true, passive: false });

  document.addEventListener('touchmove', event => {
    if (event.touches?.length > 1) prevent(event);
  }, { capture: true, passive: false });

  let lastTouchEndAt = 0;
  let lastTouchX = 0;
  let lastTouchY = 0;

  document.addEventListener('touchend', event => {
    const touch = event.changedTouches?.[0];
    if (!touch || event.changedTouches.length !== 1) return;

    const now = performance.now();
    const closeInTime = now - lastTouchEndAt < 360;
    const closeInSpace = Math.hypot(touch.clientX - lastTouchX, touch.clientY - lastTouchY) < 42;

    if (closeInTime && closeInSpace) prevent(event);

    lastTouchEndAt = now;
    lastTouchX = touch.clientX;
    lastTouchY = touch.clientY;
  }, { capture: true, passive: false });

  document.documentElement.style.touchAction = 'none';
  document.body.style.touchAction = 'none';
})();
