(() => {
'use strict';
const d=n=>document.getElementById(n);
const M=window.MM={
  dom:{canvas:d('game'),score:d('score'),level:d('level'),lives:d('lives'),best:d('best'),status:d('statusPill'),overlay:d('overlay'),overlayText:d('overlayText'),start:d('startBtn'),pause:d('pauseBtn'),mute:d('muteBtn')},
  MAP:[
    '###################','#o.......#.......o#','#.###.##.#.##.###.#','#.....##...##.....#',
    '#.###.#.###.#.###.#','#.....#.....#.....#','#####.###.###.#####','#####.#.....#.#####',
    '#####.#.###.#.#####','#.......# #.......#','#.###.### ###.###.#','.......     .......',
    '#.###.##   ##.###.#','#.....#     #.....#','#####.#.###.#.#####','#####.#.....#.#####',
    '#####.#.###.#.#####','#........#........#','#.###.##.#.##.###.#','#o..#....P....#..o#',
    '###.#.###.###.#.###','#.....#.....#.....#','###################'
  ],
  DIR:{left:{x:-1,y:0,a:Math.PI},right:{x:1,y:0,a:0},up:{x:0,y:-1,a:-Math.PI/2},down:{x:0,y:1,a:Math.PI/2}},
  names:['left','right','up','down'],
  opp:{left:'right',right:'left',up:'down',down:'up'},
  map:[],pellets:new Set(),power:new Set(),running:false,paused:false,muted:false,last:0,
  score:0,level:1,lives:3,best:Number(localStorage.getItem('mazeMunchBest')||0),
  frightened:0,combo:0,eaten:0,total:0,bonus:null,bonusStage:0,ready:0,swipe:null,
  W:390,H:520,DPR:1,tile:20,ox:0,oy:0,audio:null
};
M.ROWS=M.MAP.length; M.COLS=M.MAP[0].length;
M.player={x:9.5,y:19.5,spawnX:9.5,spawnY:19.5,dir:'left',wanted:'left',speed:6.2,inv:0};
const defs=[
  ['#ff6680',9.5,11.5,17,1],['#65e7ff',8.5,12.5,1,1],
  ['#ff9d5c',10.5,12.5,17,21],['#c18cff',9.5,13.5,1,21]
];
M.hunters=defs.map((v,i)=>({i,color:v[0],spawnX:v[1],spawnY:v[2],x:v[1],y:v[2],corner:{x:v[3],y:v[4]},dir:i%2?'left':'right',speed:5,eyes:0,release:i*1.7}));
M.key=(x,y)=>`${x},${y}`;
M.tileAt=(x,y)=>{
  x=((x%M.COLS)+M.COLS)%M.COLS;
  if(y<0||y>=M.ROWS)return '#';
  return M.map[y][x];
};
M.walk=(x,y)=>M.tileAt(x,y)!=='#';
M.center=v=>Math.floor(v)+.5;
M.near=(v,e=.09)=>Math.abs(v-M.center(v))<e;
M.status=t=>{M.dom.status.textContent=t;};
M.hud=()=>{
  M.dom.score.textContent=M.score.toLocaleString('it-IT');
  M.dom.level.textContent=M.level; M.dom.lives.textContent=M.lives;
  M.dom.best.textContent=M.best.toLocaleString('it-IT');
};
M.ensureAudio=()=>{
  if(M.audio)return;
  const AC=window.AudioContext||window.webkitAudioContext;
  if(AC)M.audio=new AC();
};
M.tone=(f,dur=.055,type='square',vol=.025,end=null)=>{
  if(M.muted)return; M.ensureAudio(); if(!M.audio)return;
  if(M.audio.state==='suspended')M.audio.resume().catch(()=>{});
  const o=M.audio.createOscillator(),g=M.audio.createGain();
  o.type=type;o.frequency.setValueAtTime(f,M.audio.currentTime);
  if(end)o.frequency.exponentialRampToValueAtTime(Math.max(20,end),M.audio.currentTime+dur);
  g.gain.setValueAtTime(vol,M.audio.currentTime);g.gain.exponentialRampToValueAtTime(.0001,M.audio.currentTime+dur);
  o.connect(g).connect(M.audio.destination);o.start();o.stop(M.audio.currentTime+dur);
};
})();