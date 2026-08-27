(() => {
  'use strict';

  if (window.RWGAvatar) return;

  const VERSION = 1;
  const PROFILE = window.RWGProfile;
  const fingerprint = PROFILE?.getFingerprint?.() || 'guest';
  const STORAGE_KEY = `rwg.avatar.v${VERSION}:${fingerprint}`;
  const EDITOR_URL = 'https://www.retrowebgames.it/avatar/';

  const OPTIONS = Object.freeze({
    skin: ['#f6d0b1','#eab995','#d99a72','#c47d55','#a96343','#84452f','#633522','#f0c7a7'],
    hairColor: ['#17120f','#3b2418','#6b3f22','#9a6335','#d0a15b','#e8d8b5','#6c2630','#2d3b61','#d9dce5','#0d0d0f'],
    eyeColor: ['#2f2118','#4a7a4f','#3f6e93','#7087a2','#6d4a2f','#263246','#7a5a86','#1f1f24'],
    shirtColor: ['#65e7ff','#ff5ecf','#7cffb2','#ffe66d','#ff765f','#8d7cff','#ffffff','#1c2438','#ff9e4a','#36a6ff','#4fd17c','#d64c62'],
    pantsColor: ['#101827','#25334e','#405375','#151515','#44515e','#6d5747','#7b2f45','#2f5a43','#5a4d7a','#b5b9c5'],
    shoeColor: ['#f5f7fb','#11141c','#ff5f73','#65e7ff','#ffe66d','#4c5870','#7cffb2','#d1d5df'],
    hairStyle: ['short','spikes','bob','mohawk','buzz','curly'],
    faceStyle: ['smile','grin','cool','serious','cheeky','focus'],
    topStyle: ['tee','hoodie','jacket','jersey'],
    bottomStyle: ['jeans','shorts','joggers','cargo'],
    bodyStyle: ['classic','slim','strong'],
    accessory: ['none','glasses','visor','cap','headphones']
  });

  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    return () => {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(list, rng) { return list[Math.floor(rng() * list.length)]; }

  function randomAvatar(seed = `${fingerprint}:${Date.now()}:${Math.random()}`) {
    const rng = mulberry32(hashString(seed));
    return {
      version: VERSION,
      skin: pick(OPTIONS.skin, rng),
      hairColor: pick(OPTIONS.hairColor, rng),
      eyeColor: pick(OPTIONS.eyeColor, rng),
      shirtColor: pick(OPTIONS.shirtColor, rng),
      pantsColor: pick(OPTIONS.pantsColor, rng),
      shoeColor: pick(OPTIONS.shoeColor, rng),
      hairStyle: pick(OPTIONS.hairStyle, rng),
      faceStyle: pick(OPTIONS.faceStyle, rng),
      topStyle: pick(OPTIONS.topStyle, rng),
      bottomStyle: pick(OPTIONS.bottomStyle, rng),
      bodyStyle: pick(OPTIONS.bodyStyle, rng),
      accessory: pick(OPTIONS.accessory, rng)
    };
  }

  function normalize(value) {
    const base = randomAvatar(`${fingerprint}:default`);
    const a = value && typeof value === 'object' ? { ...base, ...value } : base;
    for (const key of ['skin','hairColor','eyeColor','shirtColor','pantsColor','shoeColor']) {
      if (!OPTIONS[key].includes(a[key])) a[key] = base[key];
    }
    for (const key of ['hairStyle','faceStyle','topStyle','bottomStyle','bodyStyle','accessory']) {
      if (!OPTIONS[key].includes(a[key])) a[key] = base[key];
    }
    a.version = VERSION;
    return a;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch (_) {}
    const initial = randomAvatar(`${fingerprint}:initial`);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(initial)); } catch (_) {}
    return initial;
  }

  let avatar = load();

  function save(next, meta = {}) {
    avatar = normalize(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(avatar)); } catch (_) {}
    window.dispatchEvent(new CustomEvent('rwg:avatar-change', { detail: { avatar: get(), ...meta } }));
    refreshMounted();
    return get();
  }

  function get() { return JSON.parse(JSON.stringify(avatar)); }

  function markup(a = avatar, mode = 'full') {
    const style = `--skin:${a.skin};--hair:${a.hairColor};--eyes:${a.eyeColor};--shirt:${a.shirtColor};--pants:${a.pantsColor};--shoes:${a.shoeColor};`;
    return `
      <div class="rwg-avatar rwg-avatar-${mode} body-${a.bodyStyle} hair-${a.hairStyle} face-${a.faceStyle} top-${a.topStyle} bottom-${a.bottomStyle} acc-${a.accessory}" style="${style}" aria-hidden="true">
        <div class="rwg-avatar-shadow"></div>
        <div class="rwg-avatar-person">
          <div class="rwg-av-head">
            <div class="rwg-av-ear left"></div><div class="rwg-av-ear right"></div>
            <div class="rwg-av-hair"><i></i><i></i><i></i><i></i><i></i></div>
            <div class="rwg-av-face">
              <span class="rwg-av-eye left"></span><span class="rwg-av-eye right"></span>
              <span class="rwg-av-brow left"></span><span class="rwg-av-brow right"></span>
              <span class="rwg-av-nose"></span><span class="rwg-av-mouth"></span>
              <span class="rwg-av-freckles"></span>
            </div>
            <div class="rwg-av-accessory"><i></i><b></b><em></em></div>
          </div>
          <div class="rwg-av-neck"></div>
          <div class="rwg-av-torso"><span class="rwg-av-top-detail"></span></div>
          <div class="rwg-av-arm left"><i class="upper"></i><i class="hand"></i></div>
          <div class="rwg-av-arm right"><i class="upper"></i><i class="hand"></i></div>
          <div class="rwg-av-leg left"><i class="thigh"></i><i class="shoe"></i></div>
          <div class="rwg-av-leg right"><i class="thigh"></i><i class="shoe"></i></div>
        </div>
      </div>`;
  }

  const mounted = new Set();
  function renderInto(host, opts = {}) {
    if (!host) return null;
    host.innerHTML = markup(opts.avatar || avatar, opts.mode || 'full');
    mounted.add(host);
    return host.querySelector('.rwg-avatar');
  }

  function refreshMounted() {
    for (const host of [...mounted]) {
      if (!host?.isConnected) { mounted.delete(host); continue; }
      const mode = host.dataset.rwgAvatarMode || 'full';
      host.innerHTML = markup(avatar, mode);
    }
  }

  function mountQuickLink() {
    if (!document.body || document.querySelector('.rwg-avatar-link')) return;
    const credits = document.querySelector('.rwg-credit-badge');
    if (!credits) return;
    const link = document.createElement('a');
    link.href = EDITOR_URL;
    link.className = 'rwg-avatar-link';
    link.setAttribute('aria-label', 'Personalizza il tuo avatar');
    link.title = 'Il mio avatar';
    link.dataset.rwgAvatarMode = 'mini';
    link.innerHTML = markup(avatar, 'mini');
    mounted.add(link);
    if (credits.classList.contains('rwg-credit-badge-inline')) link.classList.add('rwg-avatar-link-inline');
    credits.insertAdjacentElement('afterend', link);
  }

  window.addEventListener('rwg:profile-ready', () => setTimeout(mountQuickLink, 0));
  window.addEventListener('rwg:avatar-change', () => setTimeout(mountQuickLink, 0));

  const selfSrc = document.currentScript?.src;
  if (selfSrc && !document.querySelector('link[data-rwg-avatar-style]')) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = new URL('rwg-avatar.css', new URL('.', selfSrc)).href;
    style.dataset.rwgAvatarStyle = 'true';
    document.head.appendChild(style);
  }

  window.RWGAvatar = Object.freeze({
    get,
    save,
    randomize: seed => save(randomAvatar(seed), { reason: 'randomize' }),
    randomAvatar,
    renderInto,
    markup,
    options: OPTIONS,
    storageKey: STORAGE_KEY,
    editorUrl: EDITOR_URL
  });

  const ready = () => {
    mountQuickLink();
    window.dispatchEvent(new CustomEvent('rwg:avatar-ready', { detail: { avatar: get() } }));
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true });
  else ready();
})();
