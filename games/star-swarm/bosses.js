(() => {
  'use strict';

  const BOSSES = [
    {name:'SENTINEL CORE', shape:'core', hp:240, r:46, ai:'patrol', attack:'aimed-triad', color:'#ffe66d', accent:'#ff6b6b', speed:.72, tagline:'LOCK-ON PROTOCOL'},
    {name:'TWIN FANG', shape:'fang', hp:330, r:49, ai:'zigzag', attack:'fan-five', color:'#ff6bcb', accent:'#65e7ff', speed:.86, tagline:'CROSSFIRE PREDATOR'},
    {name:'PRISM EYE', shape:'eye', hp:430, r:47, ai:'blink', attack:'radial', color:'#9b8cff', accent:'#ffe66d', speed:.92, tagline:'REFRACTION MATRIX'},
    {name:'IRON MANTA', shape:'manta', hp:560, r:55, ai:'dash', attack:'mines', color:'#65e7ff', accent:'#ff795f', speed:1.02, attackCadence:.78, tagline:'HEAVY STRIKE WING'},
    {name:'NOVA QUEEN', shape:'queen', hp:720, r:54, ai:'orbit', attack:'homing', color:'#ff8bdc', accent:'#7cffb2', speed:1.08, tagline:'ROYAL HIVE MIND'},
    {name:'HYDRA GRID', shape:'hydra', hp:900, r:58, ai:'anchor', attack:'triple-turret', color:'#7cffb2', accent:'#ffe66d', speed:1.12, tagline:'THREE-HEAD BARRAGE'},
    {name:'VOID SERPENT', shape:'serpent', hp:1120, r:56, ai:'serpent', attack:'trail-ring', color:'#8f7cff', accent:'#ff5e73', speed:1.18, tagline:'DARK-WAVE HUNTER'},
    {name:'ECLIPSE FORGE', shape:'forge', hp:1380, r:62, ai:'shield', attack:'sweep-beam', color:'#ffb04d', accent:'#65e7ff', speed:1.22, tagline:'ARMORED SOLAR ENGINE'},
    {name:'CHRONO WARDEN', shape:'chrono', hp:1700, r:58, ai:'phase', attack:'chrono-ring', color:'#8fffe3', accent:'#ff7bd5', speed:1.28, tagline:'TIME-DISTORTION UNIT'},
    {name:'OMEGA SWARM', shape:'omega', hp:2200, r:66, ai:'omega', attack:'omega-cycle', color:'#ffffff', accent:'#ff4f64', speed:1.36, tagline:'FINAL ADAPTIVE INTELLIGENCE'}
  ];

  function getBoss(level){
    const ordinal=Math.max(1,Math.floor(level/10));
    const index=(ordinal-1)%BOSSES.length;
    const cycle=Math.floor((ordinal-1)/BOSSES.length);
    const src=BOSSES[index], scale=1+cycle*.72;
    return {
      ...src,index,ordinal,cycle,
      maxHp:Math.round(src.hp*scale),
      hp:Math.round(src.hp*scale),
      damageScale:1+index*.075+cycle*.18,
      attackScale:(1+index*.055+cycle*.13)*(src.attackCadence??1),
      shieldDropEvery:ordinal>=4?.10:0,
      title:cycle?`${src.name} // OVERDRIVE ${cycle}`:src.name
    };
  }

  window.StarSwarmBosses=Object.freeze({BOSSES:BOSSES.map(x=>({...x})),getBoss});
})();