(() => {
  'use strict';

  if (window.RWGAvatar) return;

  const VERSION = 2;
  const PROFILE = window.RWGProfile;
  const fingerprint = PROFILE?.getFingerprint?.() || 'guest';
  const STORAGE_KEY = `rwg.avatar.v${VERSION}:${fingerprint}`;
  const LEGACY_KEY = `rwg.avatar.v1:${fingerprint}`;
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
    eyewear: ['none','glasses','visor'],
    headgear: ['none','cap','headphones','crown'],
    emblem: ['none','bolt','star','pixel','shield'],
    aura: ['cyan','magenta','gold','green','violet']
  });

  const AURA = Object.freeze({
    cyan:'#65e7ff',
    magenta:'#ff5ecf',
    gold:'#ffe45b',
    green:'#7cffb2',
    violet:'#9a78ff'
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

  const pick = (list, rng) => list[Math.floor(rng() * list.length)];

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
      eyewear: pick(OPTIONS.eyewear, rng),
      headgear: pick(OPTIONS.headgear, rng),
      emblem: pick(OPTIONS.emblem, rng),
      aura: pick(OPTIONS.aura, rng)
    };
  }

  function migrateLegacy(value) {
    if (!value || typeof value !== 'object') return value;
    const next = { ...value };
    if (!next.eyewear) next.eyewear = ['glasses','visor'].includes(next.accessory) ? next.accessory : 'none';
    if (!next.headgear) next.headgear = ['cap','headphones'].includes(next.accessory) ? next.accessory : 'none';
    if (!next.emblem) next.emblem = 'none';
    if (!next.aura) next.aura = 'cyan';
    delete next.accessory;
    return next;
  }

  function normalize(value) {
    const base = randomAvatar(`${fingerprint}:default`);
    const a = value && typeof value === 'object' ? { ...base, ...migrateLegacy(value) } : base;
    for (const key of ['skin','hairColor','eyeColor','shirtColor','pantsColor','shoeColor']) {
      if (!OPTIONS[key].includes(a[key])) a[key] = base[key];
    }
    for (const key of ['hairStyle','faceStyle','topStyle','bottomStyle','bodyStyle','eyewear','headgear','emblem','aura']) {
      if (!OPTIONS[key].includes(a[key])) a[key] = base[key];
    }
    a.version = VERSION;
    return a;
  }

  function persist(value) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch (_) {}
  }

  function load() {
    try {
      const current = localStorage.getItem(STORAGE_KEY);
      if (current) return normalize(JSON.parse(current));
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        const migrated = normalize(JSON.parse(legacy));
        persist(migrated);
        return migrated;
      }
    } catch (_) {}
    const initial = randomAvatar(`${fingerprint}:initial`);
    persist(initial);
    return initial;
  }

  let avatar = load();
  let renderSeq = 0;

  function save(next, meta = {}) {
    avatar = normalize(next);
    persist(avatar);
    window.dispatchEvent(new CustomEvent('rwg:avatar-change', { detail: { avatar: get(), ...meta } }));
    refreshMounted();
    return get();
  }

  function get() { return JSON.parse(JSON.stringify(avatar)); }

  function hairMarkup(style, hair) {
    const common = `fill="${hair}" stroke="#09101e" stroke-width="3" stroke-linejoin="round"`;
    if (style === 'spikes') return `<path ${common} d="M77 59 83 30 93 43 103 22 112 42 124 20 131 45 145 31 143 62Q110 43 77 59Z"/>`;
    if (style === 'bob') return `<path ${common} d="M76 52Q81 24 110 23Q142 24 147 54L143 91 132 82 128 55Q110 43 91 55L87 84 76 93Z"/>`;
    if (style === 'mohawk') return `<path ${common} d="M99 39 110 10 121 39 128 28 130 52Q110 42 90 52L92 30Z"/>`;
    if (style === 'buzz') return `<path ${common} d="M79 54Q85 27 110 27Q137 28 142 55Q110 42 79 54Z"/>`;
    if (style === 'curly') return `<g ${common}><circle cx="84" cy="48" r="15"/><circle cx="99" cy="35" r="16"/><circle cx="118" cy="34" r="17"/><circle cx="136" cy="47" r="15"/><circle cx="109" cy="50" r="18"/></g>`;
    return `<path ${common} d="M78 57Q82 25 110 24Q139 25 143 58Q127 46 110 47Q92 46 78 57Z"/>`;
  }

  function faceMarkup(face, eyes) {
    const brow = face === 'focus'
      ? '<path d="M88 65l14 4M132 65l-14 4" class="rwg-av-brow"/>'
      : '<path d="M87 67h14M119 67h14" class="rwg-av-brow"/>';
    const mouth = {
      grin: '<path d="M98 91Q110 101 122 91Z" fill="#fff" stroke="#6e3b35" stroke-width="2"/>',
      cool: '<path d="M101 93h18" class="rwg-av-mouth"/>',
      serious: '<path d="M101 96Q110 88 119 96" class="rwg-av-mouth"/>',
      cheeky: '<path d="M103 91q9 7 17 1" class="rwg-av-mouth"/>',
      focus: '<path d="M102 94h16" class="rwg-av-mouth"/>',
      smile: '<path d="M100 90q10 12 20 0" class="rwg-av-mouth"/>'
    }[face] || '';
    return `${brow}
      <ellipse cx="95" cy="77" rx="7" ry="8" fill="#f7fbff"/><circle cx="96" cy="78" r="4.5" fill="${eyes}"/><circle cx="97" cy="78" r="2" fill="#08101c"/><circle cx="94.5" cy="75.5" r="1.3" fill="#fff"/>
      <ellipse cx="125" cy="77" rx="7" ry="8" fill="#f7fbff"/><circle cx="124" cy="78" r="4.5" fill="${eyes}"/><circle cx="123" cy="78" r="2" fill="#08101c"/><circle cx="125.5" cy="75.5" r="1.3" fill="#fff"/>
      <path d="M110 78v8l4 2" fill="none" stroke="#a7644b" stroke-width="2" stroke-linecap="round"/>${mouth}`;
  }

  function topDetails(style) {
    if (style === 'hoodie') return '<path d="M89 132Q110 151 131 132" class="rwg-av-detail"/><path d="M106 142v18M114 142v18" class="rwg-av-detail thin"/><path d="M95 184q15-8 30 0v10H95Z" class="rwg-av-detail soft"/>';
    if (style === 'jacket') return '<path d="M110 130v72" class="rwg-av-detail"/><path d="m89 138 15 13M131 138l-15 13" class="rwg-av-detail"/><path d="M86 177h17M117 177h17" class="rwg-av-detail thin"/>';
    if (style === 'jersey') return '<text x="110" y="178" text-anchor="middle" class="rwg-av-jersey">88</text><path d="M88 137h44" class="rwg-av-detail thin"/>';
    return '<path d="M89 139q21 11 42 0" class="rwg-av-detail thin"/>';
  }

  function emblemMarkup(style) {
    if (style === 'bolt') return '<path d="m113 151-12 17h9l-4 18 14-22h-9Z" class="rwg-av-emblem"/>';
    if (style === 'star') return '<path d="m110 151 4 9 10 1-8 7 2 10-8-5-9 5 3-10-8-7 10-1Z" class="rwg-av-emblem"/>';
    if (style === 'pixel') return '<path d="M99 157h6v-6h10v6h6v6h5v11h-7v-6h-18v6h-7v-11h5Z" class="rwg-av-emblem"/>';
    if (style === 'shield') return '<path d="M110 151 123 156v10q0 10-13 16-13-6-13-16v-10Z" class="rwg-av-emblem" fill="none"/>';
    return '';
  }

  function headgearMarkup(style, shirt) {
    if (style === 'cap') return `<path d="M77 53Q84 24 111 25Q137 26 144 53Z" fill="${shirt}" stroke="#07101e" stroke-width="4"/><path d="M111 50q26-3 40 7-18 4-34 1Z" fill="${shirt}" stroke="#07101e" stroke-width="4"/>`;
    if (style === 'headphones') return '<path d="M76 61Q78 29 110 27Q142 29 144 61" fill="none" stroke="#202a3d" stroke-width="9"/><rect x="69" y="59" width="14" height="28" rx="6" fill="#ff5ecf"/><rect x="137" y="59" width="14" height="28" rx="6" fill="#65e7ff"/>';
    if (style === 'crown') return '<path d="M86 39 94 20 108 35 122 18 134 39l-5 12H91Z" fill="#ffe45b" stroke="#7e5310" stroke-width="3"/><circle cx="95" cy="42" r="3" fill="#65e7ff"/><circle cx="111" cy="39" r="3" fill="#ff5ecf"/><circle cx="127" cy="42" r="3" fill="#7cffb2"/>';
    return '';
  }

  function eyewearMarkup(style) {
    if (style === 'glasses') return '<g fill="rgba(101,231,255,.10)" stroke="#18243a" stroke-width="4"><rect x="83" y="68" width="24" height="18" rx="7"/><rect x="113" y="68" width="24" height="18" rx="7"/><path d="M107 76h6"/></g>';
    if (style === 'visor') return '<rect x="81" y="67" width="58" height="20" rx="9" fill="rgba(101,231,255,.28)" stroke="#65e7ff" stroke-width="3" filter="url(#rwgAvGlow)"/>';
    return '';
  }

  function bottomDetails(style, pants) {
    if (style === 'shorts') return `<path d="M88 199h44l-3 43-19-5-19 5Z" fill="${pants}" stroke="#07101e" stroke-width="5" stroke-linejoin="round"/>`;
    if (style === 'cargo') return `<g fill="${pants}" stroke="#07101e" stroke-width="3"><rect x="72" y="236" width="22" height="19" rx="4"/><rect x="126" y="236" width="22" height="19" rx="4"/></g>`;
    if (style === 'joggers') return '<path d="M78 295h15M127 295h15" stroke="#f5f7fb" stroke-width="4" opacity=".55"/>';
    return '';
  }

  function markup(input = avatar, mode = 'full') {
    const a = normalize(input);
    const uid = `rwgAv${++renderSeq}`;
    const torsoScale = a.bodyStyle === 'slim' ? .84 : a.bodyStyle === 'strong' ? 1.16 : 1;
    const limbWidth = a.bodyStyle === 'strong' ? 16 : a.bodyStyle === 'slim' ? 11 : 13;
    const fullSleeve = a.topStyle !== 'tee';
    const shorts = a.bottomStyle === 'shorts';
    const aura = AURA[a.aura] || AURA.cyan;
    const style = `--skin:${a.skin};--hair:${a.hairColor};--eyes:${a.eyeColor};--shirt:${a.shirtColor};--pants:${a.pantsColor};--shoes:${a.shoeColor};--aura:${aura};`;
    return `
      <div class="rwg-avatar rwg-avatar-${mode} body-${a.bodyStyle} top-${a.topStyle} bottom-${a.bottomStyle} aura-${a.aura}" style="${style}" aria-hidden="true">
        <span class="rwg-avatar-aura"></span>
        <span class="rwg-avatar-platform"></span>
        <div class="rwg-avatar-person">
          <svg class="rwg-avatar-svg" viewBox="0 0 220 340" role="presentation" focusable="false">
            <defs>
              <filter id="${uid}Glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              <filter id="rwgAvGlow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              <linearGradient id="${uid}Shirt" x1="0" x2="1"><stop stop-color="${a.shirtColor}"/><stop offset=".55" stop-color="${a.shirtColor}"/><stop offset="1" stop-color="#08101c" stop-opacity=".38"/></linearGradient>
              <linearGradient id="${uid}Pants" x1="0" x2="1"><stop stop-color="${a.pantsColor}"/><stop offset=".6" stop-color="${a.pantsColor}"/><stop offset="1" stop-color="#02050b" stop-opacity=".44"/></linearGradient>
            </defs>
            <g class="rwg-av-skeleton" fill="none" stroke="#65e7ff" stroke-opacity=".18" stroke-width="3">
              <path d="M110 104v107M77 135h66M91 207h38"/>
              <circle cx="110" cy="70" r="36"/><circle cx="77" cy="135" r="4"/><circle cx="143" cy="135" r="4"/><circle cx="91" cy="207" r="4"/><circle cx="129" cy="207" r="4"/>
            </g>

            <ellipse cx="110" cy="326" rx="62" ry="10" fill="${aura}" opacity=".16" filter="url(#${uid}Glow)"/>

            <g class="rwg-av-legs" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M94 206 84 260 75 307M126 206 136 260 145 307" stroke="#07101e" stroke-width="${limbWidth + 11}"/>
              ${shorts
                ? `<path d="M94 207 89 241M126 207 131 241" stroke="url(#${uid}Pants)" stroke-width="${limbWidth + 1}"/><path d="M89 241 80 270 75 307M131 241 140 270 145 307" stroke="${a.skin}" stroke-width="${Math.max(9, limbWidth - 1)}"/>`
                : `<path d="M94 207 84 260 75 307M126 207 136 260 145 307" stroke="url(#${uid}Pants)" stroke-width="${limbWidth + 2}"/>`}
              <path d="M64 311h22M134 311h24" stroke="#07101e" stroke-width="18"/>
              <path d="M65 307h20M135 307h22" stroke="${a.shoeColor}" stroke-width="11"/>
            </g>
            ${bottomDetails(a.bottomStyle, a.pantsColor)}

            <g class="rwg-av-arms" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M78 137 55 181 48 226M142 137 165 181 172 226" stroke="#07101e" stroke-width="${limbWidth + 10}"/>
              ${fullSleeve
                ? `<path d="M78 137 55 181 48 226M142 137 165 181 172 226" stroke="${a.shirtColor}" stroke-width="${limbWidth + 1}"/>`
                : `<path d="M78 137 66 160M142 137 154 160" stroke="${a.shirtColor}" stroke-width="${limbWidth + 2}"/><path d="M66 160 55 181 48 226M154 160 165 181 172 226" stroke="${a.skin}" stroke-width="${Math.max(9, limbWidth - 1)}"/>`}
              <circle cx="48" cy="228" r="9" fill="${a.skin}" stroke="#07101e" stroke-width="4"/>
              <circle cx="172" cy="228" r="9" fill="${a.skin}" stroke="#07101e" stroke-width="4"/>
            </g>

            <g class="rwg-av-torso-wrap" transform="translate(110 0) scale(${torsoScale} 1) translate(-110 0)">
              <path d="M78 134Q110 121 142 134L135 202Q110 211 85 202Z" fill="url(#${uid}Shirt)" stroke="#07101e" stroke-width="6" stroke-linejoin="round"/>
              ${topDetails(a.topStyle)}
              ${emblemMarkup(a.emblem)}
            </g>

            <path d="M110 104v24" stroke="#07101e" stroke-width="16" stroke-linecap="round"/>
            <path d="M110 105v24" stroke="${a.skin}" stroke-width="9" stroke-linecap="round"/>

            <g class="rwg-av-head">
              <circle cx="110" cy="71" r="36" fill="${a.skin}" stroke="#07101e" stroke-width="6"/>
              <circle cx="78" cy="75" r="7" fill="${a.skin}" stroke="#07101e" stroke-width="3"/>
              <circle cx="142" cy="75" r="7" fill="${a.skin}" stroke="#07101e" stroke-width="3"/>
              ${hairMarkup(a.hairStyle, a.hairColor)}
              ${faceMarkup(a.faceStyle, a.eyeColor)}
              ${eyewearMarkup(a.eyewear)}
              ${headgearMarkup(a.headgear, a.shirtColor)}
            </g>

            <g class="rwg-av-joints" fill="${aura}" filter="url(#${uid}Glow)">
              <circle cx="78" cy="136" r="3"/><circle cx="142" cy="136" r="3"/><circle cx="94" cy="207" r="3"/><circle cx="126" cy="207" r="3"/>
            </g>
          </svg>
        </div>
      </div>`;
  }

  const mounted = new Set();

  function renderInto(host, opts = {}) {
    if (!host) return null;
    host.dataset.rwgAvatarMode = opts.mode || host.dataset.rwgAvatarMode || 'full';
    host.innerHTML = markup(opts.avatar || avatar, host.dataset.rwgAvatarMode);
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
    link.title = 'Player avatar';
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
    normalize,
    renderInto,
    markup,
    options: OPTIONS,
    version: VERSION,
    storageKey: STORAGE_KEY,
    legacyStorageKey: LEGACY_KEY,
    editorUrl: EDITOR_URL
  });

  const ready = () => {
    mountQuickLink();
    window.dispatchEvent(new CustomEvent('rwg:avatar-ready', { detail: { avatar: get() } }));
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true });
  else ready();
})();