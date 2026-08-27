(() => {
  'use strict';

  const BOSSES = Object.freeze([
    {name:'SENTINEL ORB',shape:'orb',move:'sine',attack:'aimed',color:'#65e7ff',accent:'#dffbff',baseHp:22,fireGap:1.65},
    {name:'TWIN FANG',shape:'fang',move:'zigzag',attack:'double',color:'#ff5ecf',accent:'#ffd3f2',baseHp:30,fireGap:1.45},
    {name:'PRISM MANTA',shape:'manta',move:'arc',attack:'fan',color:'#8d7cff',accent:'#eee9ff',baseHp:38,fireGap:1.32},
    {name:'FORGE CORE',shape:'core',move:'anchor',attack:'mines',color:'#ff934f',accent:'#ffe1c2',baseHp:48,fireGap:1.2},
    {name:'HYDRA GRID',shape:'hydra',move:'serpent',attack:'triple',color:'#7cffb2',accent:'#e0ffea',baseHp:60,fireGap:1.08},
    {name:'NEON KRAKEN',shape:'kraken',move:'dash',attack:'fan',color:'#4b6cff',accent:'#dce3ff',baseHp:74,fireGap:.98},
    {name:'MIRROR CROWN',shape:'crown',move:'blink',attack:'double',color:'#ffe66d',accent:'#fff8c7',baseHp:90,fireGap:.9},
    {name:'REACTOR PRIME',shape:'reactor',move:'orbit',attack:'mines',color:'#ff6680',accent:'#ffd8df',baseHp:110,fireGap:.83},
    {name:'TIME WARDEN',shape:'warden',move:'phase',attack:'triple',color:'#52d4ff',accent:'#e6faff',baseHp:132,fireGap:.76},
    {name:'OMEGA PRISM',shape:'omega',move:'omega',attack:'omega',color:'#ffffff',accent:'#ff5ecf',baseHp:160,fireGap:.68}
  ].map((boss,index)=>Object.freeze({...boss,index,ordinal:index+1})));

  function getBoss(level, cycle=1) {
    const ordinal=Math.max(1,Math.min(10,Math.floor(level/10)));
    const base=BOSSES[ordinal-1];
    const cycleScale=1+Math.max(0,cycle-1)*.2;
    return Object.freeze({...base,maxHp:Math.round(base.baseHp*cycleScale),fireGap:Math.max(.38,base.fireGap/(1+Math.max(0,cycle-1)*.08))});
  }

  window.PrismBreakerBosses=Object.freeze({BOSSES,getBoss});
})();
