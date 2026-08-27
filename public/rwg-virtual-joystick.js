(() => {
  'use strict';

  if (window.RWGVirtualJoystick) return;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const slug = () => {
    const canonical = document.querySelector('link[rel="canonical"]')?.href || location.href;
    return new URL(canonical, location.href).pathname.split('/').filter(Boolean).pop() || '';
  };

  class VirtualJoystick {
    constructor({ host, allowed = ['up', 'down', 'left', 'right'], label = 'MOVIMENTO', deadZone = 0.18, onVector = null, onDirection = null } = {}) {
      if (!host) throw new Error('RWGVirtualJoystick host missing');
      this.host = host;
      this.allowed = new Set(allowed);
      this.deadZone = clamp(Number(deadZone) || 0.18, 0.05, 0.6);
      this.onVector = typeof onVector === 'function' ? onVector : null;
      this.onDirection = typeof onDirection === 'function' ? onDirection : null;
      this.pointerId = null;
      this.direction = null;
      this.vector = { x: 0, y: 0, active: false };

      const root = document.createElement('div');
      root.className = 'rwg-vjoy';
      root.setAttribute('role', 'group');
      root.setAttribute('aria-label', label);
      root.innerHTML = `
        <span class="rwg-vjoy-label" aria-hidden="true">${label}</span>
        <div class="rwg-vjoy-base" data-rwg-vjoy-base>
          <i class="rwg-vjoy-axis rwg-vjoy-axis-x" aria-hidden="true"></i>
          <i class="rwg-vjoy-axis rwg-vjoy-axis-y" aria-hidden="true"></i>
          <b class="rwg-vjoy-knob" data-rwg-vjoy-knob aria-hidden="true"></b>
        </div>`;
      host.appendChild(root);
      this.root = root;
      this.base = root.querySelector('[data-rwg-vjoy-base]');
      this.knob = root.querySelector('[data-rwg-vjoy-knob]');

      this.handleDown = event => {
        if (this.pointerId !== null) return;
        event.preventDefault();
        this.pointerId = event.pointerId;
        this.base.setPointerCapture?.(event.pointerId);
        this.root.classList.add('is-active');
        this.updateFromPointer(event, true);
      };
      this.handleMove = event => {
        if (event.pointerId !== this.pointerId) return;
        event.preventDefault();
        this.updateFromPointer(event, true);
      };
      this.handleRelease = event => {
        if (this.pointerId === null || (event && event.pointerId !== this.pointerId)) return;
        this.pointerId = null;
        this.root.classList.remove('is-active');
        this.setVector(0, 0, false);
      };

      this.base.addEventListener('pointerdown', this.handleDown, { passive: false });
      this.base.addEventListener('pointermove', this.handleMove, { passive: false });
      for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) this.base.addEventListener(name, this.handleRelease);
    }

    directionFor(x, y, active) {
      if (!active || Math.hypot(x, y) < this.deadZone) return null;
      const horizontal = Math.abs(x) >= Math.abs(y);
      const primary = horizontal ? (x < 0 ? 'left' : 'right') : (y < 0 ? 'up' : 'down');
      if (this.allowed.has(primary)) return primary;
      const secondaryMagnitude = horizontal ? Math.abs(y) : Math.abs(x);
      if (secondaryMagnitude < this.deadZone) return null;
      const secondary = horizontal ? (y < 0 ? 'up' : 'down') : (x < 0 ? 'left' : 'right');
      return this.allowed.has(secondary) ? secondary : null;
    }

    updateFromPointer(event, active) {
      const rect = this.base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const radius = Math.max(1, Math.min(rect.width, rect.height) * 0.34);
      let dx = event.clientX - cx;
      let dy = event.clientY - cy;
      const distance = Math.hypot(dx, dy);
      if (distance > radius) {
        dx = dx / distance * radius;
        dy = dy / distance * radius;
      }
      this.setVector(dx / radius, dy / radius, active);
    }

    setVector(x, y, active) {
      const magnitude = Math.hypot(x, y);
      if (magnitude > 1) { x /= magnitude; y /= magnitude; }
      if (!active || magnitude < this.deadZone) { x = 0; y = 0; }
      this.vector = { x, y, active: Boolean(active && (x || y)) };
      const travel = 34;
      this.knob.style.transform = `translate(${x * travel}px, ${y * travel}px)`;
      const nextDirection = this.directionFor(x, y, this.vector.active);
      if (nextDirection !== this.direction) {
        const previous = this.direction;
        this.direction = nextDirection;
        this.onDirection?.(nextDirection, previous, this.vector);
      }
      this.onVector?.(this.vector);
      window.dispatchEvent(new CustomEvent('rwg:joystick-input', { detail: { ...this.vector, direction: nextDirection, gameSlug: slug() } }));
    }

    destroy() {
      this.handleRelease();
      this.root.remove();
    }
  }

  const firePointer = (element, type) => {
    if (!element) return;
    const EventCtor = window.PointerEvent || window.MouseEvent;
    element.dispatchEvent(new EventCtor(type, { bubbles: true, cancelable: true, pointerId: 987, pointerType: 'touch', buttons: type === 'pointerdown' ? 1 : 0 }));
  };

  const bindDirectionButtons = (host, buttons, options = {}) => {
    const byDirection = new Map(buttons.map(button => [button.dataset.dir || button.dataset.action, button]));
    let pressed = null;
    const allowed = options.allowed || ['up', 'down', 'left', 'right'];
    buttons.forEach(button => button.classList.add('rwg-vjoy-legacy-direction'));
    host.classList.add('rwg-vjoy-host');
    return new VirtualJoystick({
      host,
      allowed,
      label: options.label || 'MOVIMENTO',
      onDirection(direction) {
        if (pressed && pressed !== direction) firePointer(byDirection.get(pressed), 'pointerup');
        if (direction && direction !== pressed) firePointer(byDirection.get(direction), 'pointerdown');
        if (!direction && pressed) firePointer(byDirection.get(pressed), 'pointerup');
        pressed = direction;
      }
    });
  };

  const syncHelp = gameSlug => {
    const hint = document.querySelector('.gesture-hint');
    if (hint && gameSlug === 'maze-munch') hint.textContent = 'Usa il joystick, scorri sul labirinto oppure usa frecce / WASD. Raccogli tutti i punti e attiva i surge nodes.';
    if (hint && gameSlug === 'neon-snake') hint.textContent = 'Joystick, swipe o frecce / WASD per muoverti. Tieni premuto TURBO per andare a velocità doppia.';
    if (gameSlug === 'neon-tilt') {
      const fallback = document.querySelector('.sensor-help span:last-child');
      if (fallback) fallback.textContent = 'Joystick e frecce restano sempre disponibili.';
    }
  };

  const autoMount = () => {
    if (!document.body?.hasAttribute('data-rwg-game') || document.documentElement.dataset.rwgVjoyMounted === 'true') return;
    const gameSlug = slug();
    let instance = null;

    const dirButtons = [...document.querySelectorAll('#controls [data-dir]')];
    if (dirButtons.length >= 3) {
      const host = document.getElementById('controls');
      if (host) instance = bindDirectionButtons(host, dirButtons);
    } else {
      const actionButtons = [...document.querySelectorAll('#controls [data-action]')];
      const directions = actionButtons.filter(button => ['left', 'right', 'down'].includes(button.dataset.action));
      if (directions.length === 3) {
        const host = document.getElementById('controls');
        directions.forEach(button => button.classList.add('rwg-vjoy-legacy-direction'));
        actionButtons.filter(button => !directions.includes(button)).forEach(button => button.classList.add('rwg-vjoy-action'));
        host?.classList.add('rwg-vjoy-host', 'rwg-vjoy-host-actions');
        instance = bindDirectionButtons(host, directions, { allowed: ['left', 'right', 'down'] });
      }
    }

    if (!instance && gameSlug === 'neon-tilt') {
      const wrap = document.getElementById('gameWrap');
      const section = document.createElement('section');
      section.className = 'rwg-vjoy-external-host';
      section.setAttribute('aria-label', 'Controllo analogico');
      wrap?.insertAdjacentElement('afterend', section);
      instance = new VirtualJoystick({ host: section, label: 'MOVIMENTO' });
      document.body.classList.add('rwg-vjoy-neon-tilt');
    }

    if (instance) {
      document.documentElement.dataset.rwgVjoyMounted = 'true';
      document.body.classList.add('rwg-vjoy-enabled');
      window.RWGVirtualJoystickInstance = instance;
      syncHelp(gameSlug);
    }
  };

  window.RWGVirtualJoystick = Object.freeze({
    mount: options => new VirtualJoystick(options),
    autoMount,
    get active() { return window.RWGVirtualJoystickInstance || null; }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount, { once: true });
  else queueMicrotask(autoMount);
})();
