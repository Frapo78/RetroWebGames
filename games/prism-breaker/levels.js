(() => {
  'use strict';

  const COLS = 12;
  const ROWS = 18;
  const MAX_LEVEL = 100;
  const TYPES = Object.freeze(['normal','tough','armored','glass','explosive','prism','moving','steel']);

  function rngFor(seed) {
    let x = (seed >>> 0) || 0x9e3779b9;
    return () => {
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
      return (x >>> 0) / 4294967296;
    };
  }
  const clamp = (v,a,b) => Math.max(a, Math.min(b,v));
  const key = (r,c) => `${r},${c}`;

  function typeFor(level, rand, index) {
    const p = level / MAX_LEVEL;
    const roll = rand();
    if (level >= 38 && roll < .035 + p * .025) return 'steel';
    if (level >= 28 && roll < .085 + p * .035) return 'moving';
    if (level >= 20 && roll < .14 + p * .035) return 'prism';
    if (level >= 14 && roll < .205 + p * .04) return 'explosive';
    if (level >= 8 && roll < .30 + p * .04) return 'armored';
    if (level >= 5 && roll < .42 + p * .03) return 'tough';
    if ((index + level) % 11 === 0) return 'glass';
    return 'normal';
  }

  function hpFor(type, level) {
    if (type === 'steel') return 999;
    if (type === 'armored') return level >= 70 ? 4 : level >= 35 ? 3 : 2;
    if (type === 'tough') return level >= 55 ? 3 : 2;
    return 1;
  }

  function addCell(map, r, c, level, rand, forcedType = null) {
    r = Math.round(r); c = Math.round(c);
    if (r < 1 || r >= ROWS - 2 || c < 0 || c >= COLS) return;
    const k = key(r,c);
    if (map.has(k)) return;
    const type = forcedType || typeFor(level, rand, map.size);
    map.set(k, { id: `b-${r}-${c}`, r, c, type, hp: hpFor(type, level), phase: rand() * Math.PI * 2 });
  }

  function patternWave(map, level, rand) {
    const bands = 4 + (level % 3);
    for (let c=0;c<COLS;c++) for (let b=0;b<bands;b++) {
      const r = 2 + b*2 + Math.round(Math.sin(c*.8 + level*.31 + b) * 1.2);
      if ((c+b+level)%5 !== 0) addCell(map,r,c,level,rand);
    }
  }
  function patternRings(map, level, rand) {
    const cx=5.5, cy=7.2;
    for (let r=2;r<14;r++) for (let c=0;c<COLS;c++) {
      const dx=(c-cx)/5.3, dy=(r-cy)/5.5, d=Math.hypot(dx,dy);
      if ((d>.52&&d<.69)||(d>.9&&d<1.08)) addCell(map,r,c,level,rand);
    }
    if (level%2) for(let c=4;c<=7;c++) addCell(map,7,c,level,rand,'prism');
  }
  function patternTowers(map, level, rand) {
    const towers=[1,4,7,10];
    towers.forEach((c,ti)=>{ const top=2+(ti+level)%4; const bottom=12-((ti*2+level)%3); for(let r=top;r<=bottom;r++) if((r+ti)%4!==1) addCell(map,r,c,level,rand); });
    for(let c=1;c<=10;c++) if(c%3!==0) addCell(map,13-Math.abs(5.5-c)*.55,c,level,rand);
  }
  function patternCross(map, level, rand) {
    for(let i=0;i<11;i++){ addCell(map,2+i, i, level, rand); addCell(map,2+i, 11-i, level, rand); }
    for(let c=2;c<10;c++) addCell(map,7,c,level,rand, c===5||c===6?'prism':null);
  }
  function patternArch(map, level, rand) {
    for(let c=1;c<=10;c++){ const x=(c-5.5)/4.8; const r=3+Math.round(3.4*(x*x)); addCell(map,r,c,level,rand); addCell(map,r+1,c,level,rand); }
    for(let r=6;r<=13;r++){ addCell(map,r,1,level,rand); addCell(map,r,10,level,rand); }
    for(let c=3;c<=8;c++) if((c+level)%2===0) addCell(map,11,c,level,rand,'glass');
  }
  function patternIslands(map, level, rand) {
    const centers=[[2.2,4],[8.7,4.5],[5.5,10.5],[1.5,13],[9.5,12.5]];
    centers.forEach(([cx,cy],i)=>{ const radius=1.25+(i+level)%2*.45; for(let r=Math.floor(cy-2);r<=Math.ceil(cy+2);r++) for(let c=Math.floor(cx-2);c<=Math.ceil(cx+2);c++) if(Math.hypot(c-cx,(r-cy)*.82)<=radius) addCell(map,r,c,level,rand); });
  }
  function patternSpiral(map, level, rand) {
    const cx=5.5,cy=7.5;
    for(let i=0;i<54;i++){ const a=i*.43+level*.07, rad=.45+i*.085; addCell(map,cy+Math.sin(a)*rad,cx+Math.cos(a)*rad,level,rand); }
  }
  function patternCanyon(map, level, rand) {
    for(let r=2;r<=14;r++){
      const inset=Math.round(1.5+Math.sin(r*.65+level)*1.3);
      for(let c=0;c<inset+2;c++) addCell(map,r,c,level,rand);
      for(let c=COLS-1;c>=COLS-3-inset;c--) addCell(map,r,c,level,rand);
    }
    for(let c=4;c<=7;c++) addCell(map,5+(c%2)*4,c,level,rand,'prism');
  }
  function patternGlyph(map, level, rand) {
    const variant=level%4;
    if(variant===0){
      for(let r=2;r<=13;r++){ addCell(map,r,2+Math.floor((r-2)*.34),level,rand); addCell(map,r,9-Math.floor((r-2)*.34),level,rand); }
      for(let c=4;c<=7;c++) addCell(map,13,c,level,rand);
    } else if(variant===1){
      for(let c=1;c<=10;c++){ addCell(map,3,c,level,rand); addCell(map,12,c,level,rand); }
      for(let r=4;r<12;r++){ addCell(map,r,1,level,rand); addCell(map,r,10,level,rand); }
      for(let c=3;c<=8;c++) addCell(map,7,c,level,rand);
    } else if(variant===2){
      for(let r=2;r<=13;r++) for(let c=1;c<=10;c++) if((r+c)%4===0 || (r-c+24)%7===0) addCell(map,r,c,level,rand);
    } else {
      for(let c=0;c<COLS;c++){ addCell(map,3+Math.abs(5.5-c)*.8,c,level,rand); addCell(map,12-Math.abs(5.5-c)*.45,c,level,rand); }
      for(let r=6;r<=10;r++){ addCell(map,r,4,level,rand); addCell(map,r,7,level,rand); }
    }
  }

  const PATTERNS=[patternWave,patternRings,patternTowers,patternCross,patternArch,patternIslands,patternSpiral,patternCanyon,patternGlyph];

  function signature(level, cells, boss) {
    const body=cells.slice().sort((a,b)=>a.r-b.r||a.c-b.c).map(b=>`${b.r}:${b.c}:${b.type}:${b.hp}`).join('|');
    return `pb-l${level}-${boss?'boss':'field'}-${body}`;
  }

  function makeBossArena(level, rand) {
    const map=new Map();
    for(let r=3;r<=10;r+=2){ addCell(map,r,0,level,rand,r%4===1?'steel':'armored'); addCell(map,r,11,level,rand,r%4===1?'steel':'armored'); }
    for(let c=2;c<=9;c+=2) addCell(map,12,c,level,rand,c%4===0?'prism':'glass');
    return [...map.values()];
  }

  function getLevel(inputLevel) {
    const level=clamp(Math.floor(Number(inputLevel)||1),1,MAX_LEVEL);
    const rand=rngFor(0x51f15e ^ (level*0x9e3779b1));
    const boss=level%10===0;
    const cells=boss?makeBossArena(level,rand):(()=>{const map=new Map();PATTERNS[(level-1)%PATTERNS.length](map,level,rand);const target=clamp(30+Math.floor(level*.22),30,52);let guard=0;while(map.size<target&&guard++<600){const c=Math.floor(rand()*COLS),r=2+Math.floor(rand()*12);if(rand()<.58 || r>7) addCell(map,r,c,level,rand);}return [...map.values()];})();
    const destructible=cells.filter(b=>b.type!=='steel').length;
    return Object.freeze({
      level,boss,name:boss?`BOSS GATE ${level/10}`:`PRISM FIELD ${String(level).padStart(3,'0')}`,
      cols:COLS,rows:ROWS,cells:Object.freeze(cells.map(Object.freeze)),destructible,
      speed:clamp(285+level*2.05,285,485),
      dropChance:clamp(.105-level*.00022,.078,.105),
      signature:signature(level,cells,boss)
    });
  }

  const signatures=new Set();
  for(let level=1;level<=MAX_LEVEL;level++) signatures.add(getLevel(level).signature);
  if(signatures.size!==MAX_LEVEL) throw new Error(`Prism Breaker level signatures must be unique: ${signatures.size}/${MAX_LEVEL}`);

  window.PrismBreakerLevels=Object.freeze({COLS,ROWS,MAX_LEVEL,TYPES,getLevel});
})();
