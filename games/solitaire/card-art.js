(() => {
  'use strict';

  const SUITS = Object.freeze({
    s: { symbol: '♠', color: '#171717', accent: '#263d70' },
    h: { symbol: '♥', color: '#b51f2e', accent: '#b51f2e' },
    d: { symbol: '♦', color: '#b51f2e', accent: '#b51f2e' },
    c: { symbol: '♣', color: '#171717', accent: '#2f5639' }
  });
  const RANK_LABEL = Object.freeze({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' });
  const FACE_CACHE = new Map();
  let backCache = '';

  const PIP_LAYOUTS = Object.freeze({
    1: [[50, 71, 0]],
    2: [[50, 31, 0], [50, 111, 1]],
    3: [[50, 27, 0], [50, 71, 0], [50, 115, 1]],
    4: [[31, 31, 0], [69, 31, 0], [31, 111, 1], [69, 111, 1]],
    5: [[31, 29, 0], [69, 29, 0], [50, 71, 0], [31, 113, 1], [69, 113, 1]],
    6: [[31, 27, 0], [69, 27, 0], [31, 71, 0], [69, 71, 0], [31, 115, 1], [69, 115, 1]],
    7: [[31, 25, 0], [69, 25, 0], [50, 48, 0], [31, 71, 0], [69, 71, 0], [31, 117, 1], [69, 117, 1]],
    8: [[31, 24, 0], [69, 24, 0], [50, 47, 0], [31, 69, 0], [69, 69, 0], [50, 95, 1], [31, 118, 1], [69, 118, 1]],
    9: [[31, 23, 0], [69, 23, 0], [31, 54, 0], [69, 54, 0], [50, 71, 0], [31, 88, 1], [69, 88, 1], [31, 119, 1], [69, 119, 1]],
    10: [[31, 22, 0], [69, 22, 0], [50, 40, 0], [31, 54, 0], [69, 54, 0], [31, 88, 1], [69, 88, 1], [50, 102, 1], [31, 120, 1], [69, 120, 1]]
  });

  function rankLabel(rank) { return RANK_LABEL[rank] || String(rank); }

  function getPipLayout(rank) {
    const layout = PIP_LAYOUTS[rank];
    return layout ? layout.map(pip => pip.slice()) : [];
  }

  function indexArtwork(rank, suit) {
    const { symbol, color } = SUITS[suit];
    const label = rankLabel(rank);
    const valueSize = label === '10' ? 14 : 17;
    const corner = `
      <text x="12" y="17" text-anchor="middle" font-size="${valueSize}" font-weight="700">${label}</text>
      <text x="12" y="31" text-anchor="middle" font-size="14">${symbol}</text>`;
    return `
      <g fill="${color}" font-family="'Times New Roman',Georgia,serif">
        ${corner}
        <g transform="rotate(180 50 71)">${corner}</g>
      </g>`;
  }

  function pipArtwork(rank, suit) {
    const { symbol, color } = SUITS[suit];
    return getPipLayout(rank).map(([x, y, flip]) => {
      const transform = flip ? ` transform="rotate(180 ${x} ${y})"` : '';
      const size = rank === 1 ? 37 : 25;
      return `<text x="${x}" y="${y}"${transform} fill="${color}" text-anchor="middle" dominant-baseline="central" font-family="'Times New Roman',Georgia,serif" font-size="${size}">${symbol}</text>`;
    }).join('');
  }

  function ornateAceOfSpades() {
    return `
      <g class="ace-of-spades" fill="#151515" stroke="#151515">
        <text x="50" y="79" text-anchor="middle" dominant-baseline="central" font-family="'Times New Roman',Georgia,serif" font-size="51">♠</text>
        <path d="M50 84 C47 96 43 104 36 112 C43 109 47 109 50 114 C53 109 57 109 64 112 C57 104 53 96 50 84Z" stroke-width="1.2"/>
        <path d="M27 82 C31 74 35 71 41 70 M73 82 C69 74 65 71 59 70 M30 91 C37 88 40 88 44 91 M70 91 C63 88 60 88 56 91" fill="none" stroke-width="1.3" stroke-linecap="round"/>
        <circle cx="27" cy="82" r="1.8"/><circle cx="73" cy="82" r="1.8"/>
      </g>`;
  }

  function courtHalf(rank, suit) {
    const { symbol, color } = SUITS[suit];
    const isKing = rank === 13, isQueen = rank === 12;
    const robe = isKing ? '#b3262f' : isQueen ? '#245b91' : '#b77a20';
    const trim = isKing ? '#31558a' : isQueen ? '#a82e39' : '#284f80';
    const hair = isKing ? '#65432d' : isQueen ? '#a8752f' : '#563426';
    const headwear = isKing
      ? '<path d="M39 32 L41 20 L48 27 L54 18 L59 28 L66 22 L63 34Z" fill="#d5a62e" stroke="#29231b" stroke-width="1.2"/><circle cx="42" cy="22" r="1.5" fill="#b51f2e"/><circle cx="55" cy="20" r="1.5" fill="#245b91"/><circle cx="64" cy="23" r="1.5" fill="#b51f2e"/>'
      : isQueen
        ? '<path d="M39 31 L43 20 L50 27 L56 19 L63 31Z" fill="#d8b243" stroke="#29231b" stroke-width="1.2"/><circle cx="43" cy="21" r="2" fill="#b51f2e"/><circle cx="56" cy="20" r="2" fill="#245b91"/>'
        : '<path d="M36 31 Q46 18 63 25 L66 34 Q51 28 38 38Z" fill="#284f80" stroke="#29231b" stroke-width="1.2"/><path d="M61 25 Q71 16 72 24 Q68 29 64 31" fill="#b3262f" stroke="#29231b" stroke-width="1.1"/><circle cx="72" cy="23" r="2.2" fill="#d8b243"/>';
    const accessory = isKing
      ? '<path d="M31 36 L36 63 M29 36 L33 30 L37 36 L33 40Z" fill="#d8b243" stroke="#29231b" stroke-width="1"/><path d="M34 39 L31 65" stroke="#c9c7bd" stroke-width="2"/>'
      : isQueen
        ? '<path d="M67 39 Q77 33 75 45 Q68 47 65 53 M72 38 L68 59" fill="none" stroke="#2f673e" stroke-width="2"/><circle cx="75" cy="39" r="4" fill="#b51f2e" stroke="#d8b243"/>'
        : '<path d="M31 31 L34 65 M28 33 L34 25 L40 33Z" fill="#d8b243" stroke="#29231b" stroke-width="1"/>';
    return `
      <g class="court-portrait">
        <path d="M27 70 L32 50 Q39 44 43 43 L57 43 Q65 45 70 50 L74 70Z" fill="${robe}" stroke="#27231f" stroke-width="1.2"/>
        <path d="M31 68 L40 47 L50 58 L60 47 L70 68" fill="${trim}" stroke="#e1b94d" stroke-width="1"/>
        <path d="M42 45 L50 54 L58 45 L61 70 L39 70Z" fill="#f0e4c9" opacity=".94"/>
        <path d="M36 68 L42 55 L47 63 L50 57 L54 63 L60 55 L66 68 M33 61 L40 66 M67 61 L60 66" fill="none" stroke="#d8b243" stroke-width="1"/>
        <path d="M38 39 Q37 25 50 23 Q64 24 63 40 L58 48 L57 34 Q50 29 43 34 L42 48Z" fill="${hair}" stroke="#4c3427" stroke-width="1"/>
        <circle cx="50" cy="37" r="11.5" fill="#edc9a5" stroke="#5b3d2d" stroke-width="1"/>
        ${headwear}
        <path d="M44 35 Q47 33 49 35 M53 35 Q56 33 58 35 M51 36 L49 40 L52 40 M47 44 Q51 45 55 43" fill="none" stroke="#3b2b25" stroke-width="1" stroke-linecap="round"/>
        <circle cx="47" cy="36" r=".75" fill="#26211f"/><circle cx="55" cy="36" r=".75" fill="#26211f"/>
        ${isKing ? '<path d="M42 43 Q50 54 59 43 Q58 53 50 55 Q42 52 42 43Z" fill="#7a4b2d"/>' : ''}
        ${accessory}
        <text x="50" y="67" fill="${color}" text-anchor="middle" font-family="'Times New Roman',Georgia,serif" font-size="12">${symbol}</text>
        <path d="M28 69 H72" stroke="#d8b243" stroke-width="2"/>
      </g>`;
  }

  function courtArtwork(rank, suit) {
    const half = courtHalf(rank, suit);
    const rankColor = rank === 13 ? '#a5222d' : rank === 12 ? '#245b91' : '#a96f1e';
    return `
      <g class="court-frame">
        <rect x="22" y="12" width="56" height="118" rx="3" fill="#f5edda" stroke="#b59a62" stroke-width="1"/>
        <rect x="25" y="15" width="50" height="112" rx="2" fill="none" stroke="${rankColor}" stroke-width="1.2"/>
        <path d="M27 18 H73 M27 124 H73" stroke="#d2ad47" stroke-width="2"/>
      </g>
      <g transform="translate(0 1)">${half}</g>
      <g transform="translate(100 141) rotate(180)">${half}</g>
      <path d="M28 71 H72" stroke="#2b2824" stroke-width=".8" opacity=".7"/>`;
  }

  function faceSvg(rank, suit, center) {
    return `<svg class="card-art" viewBox="0 0 100 142" preserveAspectRatio="none" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
      <rect x=".7" y=".7" width="98.6" height="140.6" rx="7.5" fill="#fffdf7" stroke="#b9b4a9" stroke-width="1.4"/>
      <rect x="2.5" y="2.5" width="95" height="137" rx="6" fill="none" stroke="#eee9de" stroke-width=".8"/>
      ${center}
      ${indexArtwork(rank, suit)}
    </svg>`;
  }

  function getCourtFaceSvg(rank, suit) {
    if (![11, 12, 13].includes(rank) || !SUITS[suit]) return '';
    return faceSvg(rank, suit, courtArtwork(rank, suit));
  }

  function essentialFaceSvg(rank, suit) {
    const { symbol, color } = SUITS[suit];
    const label = rankLabel(rank), valueSize = label === '10' ? 45 : 59;
    const corner = `<text class="essential-corner" x="14" y="24" text-anchor="middle" font-size="23">${symbol}</text>`;
    return `<svg class="card-art card-style-essential" viewBox="0 0 100 142" preserveAspectRatio="none" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
      <rect x=".7" y=".7" width="98.6" height="140.6" rx="7.5" fill="#fffdf7" stroke="#b9b4a9" stroke-width="1.4"/>
      <rect x="2.5" y="2.5" width="95" height="137" rx="6" fill="none" stroke="#eee9de" stroke-width=".8"/>
      <g fill="${color}" font-family="'Times New Roman',Georgia,serif" font-weight="700">
        ${corner}
        <g transform="rotate(180 50 71)">${corner}</g>
        <text class="essential-rank" x="50" y="74" text-anchor="middle" dominant-baseline="central" font-size="${valueSize}">${label}</text>
      </g>
    </svg>`;
  }

  function getCardFaceSvg(card, style = 'classic') {
    const rank = Number(card?.rank), suit = card?.suit;
    if (!Number.isInteger(rank) || rank < 1 || rank > 13 || !SUITS[suit]) return '';
    const normalizedStyle = style === 'essential' ? 'essential' : 'classic';
    const key = `${normalizedStyle}|${suit}${rank}`;
    if (!FACE_CACHE.has(key)) {
      if (normalizedStyle === 'essential') FACE_CACHE.set(key, essentialFaceSvg(rank, suit));
      else {
        const center = rank >= 11 ? courtArtwork(rank, suit) : rank === 1 && suit === 's' ? ornateAceOfSpades() : pipArtwork(rank, suit);
        FACE_CACHE.set(key, faceSvg(rank, suit, center));
      }
    }
    return FACE_CACHE.get(key);
  }

  function getCardBackSvg() {
    if (backCache) return backCache;
    let lattice = '';
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 7; col++) {
        const x = 13 + col * 12 + (row % 2 ? 6 : 0), y = 13 + row * 12;
        if (x > 88 || y > 126) continue;
        lattice += `<path d="M${x} ${y - 3} L${x + 3} ${y} L${x} ${y + 3} L${x - 3} ${y}Z"/>`;
      }
    }
    backCache = `<svg class="card-back-art" viewBox="0 0 100 142" preserveAspectRatio="none" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
      <rect x=".7" y=".7" width="98.6" height="140.6" rx="7.5" fill="#faf7ef" stroke="#aaa59b" stroke-width="1.4"/>
      <rect x="5" y="5" width="90" height="132" rx="5" fill="#831d28" stroke="#d3b45e" stroke-width="2"/>
      <rect x="8" y="8" width="84" height="126" rx="3.5" fill="#163d6b" stroke="#f1e5bd" stroke-width="1.2"/>
      <g fill="none" stroke="#d7bf76" stroke-width=".75" opacity=".75">${lattice}</g>
      <g class="back-medallion">
        <ellipse cx="50" cy="71" rx="27" ry="39" fill="#8d202b" stroke="#f1e5bd" stroke-width="2"/>
        <ellipse cx="50" cy="71" rx="21" ry="32" fill="#163d6b" stroke="#d7bf76" stroke-width="1.2"/>
        <path d="M50 42 C61 51 65 60 65 71 C65 82 61 91 50 100 C39 91 35 82 35 71 C35 60 39 51 50 42Z" fill="none" stroke="#f1e5bd" stroke-width="1.5"/>
        <path d="M50 48 C45 57 41 63 41 71 C41 79 45 85 50 94 C55 85 59 79 59 71 C59 63 55 57 50 48Z" fill="#9a2630" stroke="#d7bf76"/>
        <circle cx="50" cy="71" r="8" fill="#163d6b" stroke="#f1e5bd" stroke-width="1.2"/>
        <path d="M46 71 L50 65 L54 71 L50 77Z" fill="#d7bf76"/>
      </g>
      <path d="M12 18 Q50 2 88 18 M12 124 Q50 140 88 124 M18 12 Q3 71 18 130 M82 12 Q97 71 82 130" fill="none" stroke="#f1e5bd" stroke-width="1.2"/>
      <circle cx="14" cy="14" r="2" fill="#d7bf76"/><circle cx="86" cy="14" r="2" fill="#d7bf76"/><circle cx="14" cy="128" r="2" fill="#d7bf76"/><circle cx="86" cy="128" r="2" fill="#d7bf76"/>
    </svg>`;
    return backCache;
  }

  window.RWGSolitaireCardArt = Object.freeze({
    getCardFaceSvg,
    getPipLayout,
    getCourtFaceSvg,
    getCardBackSvg
  });
})();
