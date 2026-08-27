(() => {
  'use strict';

  const TOTAL_CONFIGS = 200;
  const MOTIFS = [
    'AURORA BANDS','NEON CROWN','TWIN PEAKS','PIXEL WAVE','DIAMOND SKY',
    'ARCADE STEPS','COSMIC BOWL','DOUBLE ARC','STAR RIDGE','CASCADE',
    'PORTAL RIM','ZIGZAG FIELD','COMET TAIL','BUTTERFLY','FORTRESS',
    'HYPER WAVE','CRYSTAL FAN','ECHO VALLEY','NOVA TEETH','MOSAIC SKY'
  ];

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fract = n => n - Math.floor(n);
  const hash01 = (a, b, c = 0) => fract(Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453123);

  function heightFor(motif, c, cols, rows, variant) {
    const x = cols <= 1 ? 0 : c / (cols - 1);
    const center = Math.abs(x - .5) * 2;
    const wave = Math.sin((x * Math.PI * 2) + variant * .43);
    const wave2 = Math.sin((x * Math.PI * 4) + variant * .31);
    const stair = Math.floor(x * 5) / 5;
    let h;
    switch (motif) {
      case 0: h = rows * (.58 + .18 * Math.sin(x * Math.PI + variant * .2)); break;
      case 1: h = rows * (.42 + .48 * center); break;
      case 2: h = rows * (.4 + .42 * Math.abs(Math.sin(x * Math.PI * 2))); break;
      case 3: h = rows * (.58 + .24 * wave); break;
      case 4: h = rows * (.38 + .58 * (1 - center)); break;
      case 5: h = rows * (.38 + .48 * stair); break;
      case 6: h = rows * (.42 + .5 * center * center); break;
      case 7: h = rows * (.52 + .25 * Math.cos(x * Math.PI * 2)); break;
      case 8: h = rows * (.5 + .22 * Math.cos(x * Math.PI * 4)); break;
      case 9: h = rows * (.35 + .55 * x); break;
      case 10: h = rows * (.48 + .3 * Math.abs(Math.cos(x * Math.PI))); break;
      case 11: h = rows * (.52 + .23 * (c % 2 ? -1 : 1)); break;
      case 12: h = rows * (.35 + .52 * (1 - x) + .13 * wave2); break;
      case 13: h = rows * (.4 + .45 * Math.abs(Math.sin(x * Math.PI))); break;
      case 14: h = rows * (.6 + .2 * (c === 0 || c === cols - 1 ? 1 : c % 3 === 0 ? .6 : -.35)); break;
      case 15: h = rows * (.55 + .2 * wave + .1 * wave2); break;
      case 16: h = rows * (.4 + .48 * Math.pow(1 - center, .55)); break;
      case 17: h = rows * (.43 + .43 * center + .08 * wave2); break;
      case 18: h = rows * (.48 + .28 * (c % 3 === 1 ? 1 : -.2)); break;
      default: h = rows * (.5 + .18 * wave + .14 * Math.cos(x * Math.PI * 6 + variant)); break;
    }
    const variantNudge = ((variant % 5) - 2) * .09 * rows;
    return clamp(Math.round(h + variantNudge), 2, rows);
  }

  function colorFor(motif, r, c, colorCount, variant) {
    switch (motif % 8) {
      case 0: return (r + Math.floor(c / 3) + variant) % colorCount;
      case 1: return (c + variant) % colorCount;
      case 2: return (r + c + variant) % colorCount;
      case 3: return (Math.floor(r / 2) + Math.floor(c / 2) + variant) % colorCount;
      case 4: return (Math.abs(c - 5) + r + variant) % colorCount;
      case 5: return (Math.floor((r + c) / 2) + variant * 2) % colorCount;
      case 6: return (r * 2 + c + variant) % colorCount;
      default: return (c * 2 + r * 3 + variant) % colorCount;
    }
  }

  function specialFor(level, r, c, seed) {
    const cycleBoost = Math.floor((level - 1) / TOTAL_CONFIGS);
    const t = level + cycleBoost * 18;
    const roll = hash01(seed + r * 13, c * 17, t);
    if (t >= 35 && roll < Math.min(.055, .012 + (t - 35) * .00018)) return 'prism';
    if (t >= 18 && roll < Math.min(.105, .035 + (t - 18) * .00025)) return 'star';
    if (t >= 8 && roll < Math.min(.22, .08 + (t - 8) * .00055)) return 'armor';
    return 'normal';
  }

  function optimalSecondsFor(cells, colorCount, rows, level) {
    let specialWeight = 0;
    for (const cell of cells) {
      if (cell.special === 'armor') specialWeight += .35;
      else if (cell.special === 'star') specialWeight += .6;
      else if (cell.special === 'prism') specialWeight += .8;
    }
    const complexity = cells.length * .28 + colorCount * 2.5 + rows * 1.1 + specialWeight;
    const masteryAdjustment = Math.min(8, Math.log2(Math.max(1, level)) * 1.15);
    return clamp(Math.round((28 + complexity - masteryAdjustment) * 2) / 2, 38, 82);
  }

  function getLevel(level, cols = 11) {
    const safeLevel = Math.max(1, Math.floor(level || 1));
    const id = ((safeLevel - 1) % TOTAL_CONFIGS) + 1;
    const cycle = Math.floor((safeLevel - 1) / TOTAL_CONFIGS);
    const motif = (id - 1) % MOTIFS.length;
    const variant = Math.floor((id - 1) / MOTIFS.length);
    const rows = clamp(5 + Math.floor((id - 1) / 34) + Math.min(2, cycle), 5, 12);
    const colorCount = clamp(4 + Math.floor((id - 1) / 72) + Math.min(1, cycle), 4, 6);
    const seed = id * 97 + variant * 541 + motif * 31 + cycle * 10007;
    const heights = [];
    const cells = [];

    for (let c = 0; c < cols; c++) {
      const h = heightFor(motif, c, cols, rows, variant);
      heights.push(h);
      for (let r = 0; r < h; r++) {
        if (r % 2 === 1 && c === cols - 1) continue;
        const special = specialFor(safeLevel, r, c, seed);
        cells.push({ r, c, colorIndex: colorFor(motif, r, c, colorCount, variant), special });
      }
    }

    const optimalSeconds = optimalSecondsFor(cells, colorCount, rows, safeLevel);
    const signature = `${id}:${motif}:${variant}:${rows}:${colorCount}:${heights.join('.')}`;
    return { id, cycle, motif, variant, name: MOTIFS[motif], rows, colorCount, cells, optimalSeconds, signature };
  }

  window.BubbleBurstLevels = Object.freeze({ TOTAL_CONFIGS, MOTIFS: [...MOTIFS], getLevel });
})();
