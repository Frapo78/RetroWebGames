(() => {
'use strict'; const M=window.MM;
M.resetBoard=()=>{
  M.map=M.MAP.map(r=>r.replace('P',' ').split(''));M.pellets=new Set();M.power=new Set();
  for(let y=0;y<M.ROWS;y++)for(let x=0;x<M.COLS;x++){
    const c=M.MAP[y][x];if(c==='.')M.pellets.add(M.key(x,y));if(c==='o')M.power.add(M.key(x,y));
  }
  M.total=M.pellets.size+M.power.size;M.eaten=0;M.bonusStage=0;M.bonus=null;
};
M.resetActors=(inv=1.4)=>{
  const p=M.player;p.x=p.spawnX;p.y=p.spawnY;p.dir=p.wanted='left';p.inv=inv;
  M.frightened=0;M.combo=0;M.hunters.forEach((h,i)=>{
    h.x=h.spawnX;h.y=h.spawnY;h.dir=i%2?'left':'right';h.eyes=0;h.release=i*Math.max(.75,1.6-M.level*.07);
  });
  M.ready=.85;M.status('PRONTO');
};
M.resetGame=()=>{M.score=0;M.level=1;M.lives=3;M.resetBoard();M.resetActors();M.hud();};
M.canMove=(e,dir)=>{
  const d=M.DIR[dir];return M.walk(Math.floor(e.x)+d.x,Math.floor(e.y)+d.y);
};
M.move=(e,dt,isPlayer=false)=>{
  if(M.near(e.x,.12)&&M.near(e.y,.12)){
    e.x=M.center(e.x);e.y=M.center(e.y);
    if(isPlayer&&e.wanted&&M.canMove(e,e.wanted))e.dir=e.wanted;
    if(!M.canMove(e,e.dir))return;
  }
  const d=M.DIR[e.dir];e.x+=d.x*e.speed*dt;e.y+=d.y*e.speed*dt;
  if(d.x)e.y+=(M.center(e.y)-e.y)*Math.min(1,dt*22);
  if(d.y)e.x+=(M.center(e.x)-e.x)*Math.min(1,dt*22);
  if(e.x<-.2)e.x=M.COLS+.2;else if(e.x>M.COLS+.2)e.x=-.2;
};
M.setDir=dir=>{if(!M.DIR[dir])return;M.player.wanted=dir;if(M.opp[M.player.dir]===dir)M.player.dir=dir;};
function bonusCheck(){
  const ratio=M.eaten/Math.max(1,M.total),due=M.bonusStage===0?ratio>=.38:M.bonusStage===1?ratio>=.72:false;
  if(due&&!M.bonus){M.bonusStage++;M.bonus={x:9.5,y:13.5,life:8,value:350+M.level*150};M.tone(520,.09,'triangle',.025,760);}
}
function nextLevel(){
  M.running=false;M.score+=1000*M.level;M.level++;M.hud();M.tone(440,.28,'triangle',.04,880);M.status('LIVELLO COMPLETO');
  setTimeout(()=>{if(M.dom.overlay.classList.contains('visible'))return;M.resetBoard();M.resetActors();M.running=true;},650);
}
function eat(){
  const k=M.key(Math.floor(M.player.x),Math.floor(M.player.y));
  if(M.pellets.delete(k)){M.score+=10;M.eaten++;if(M.eaten%2===0)M.tone(330+(M.eaten%4)*45,.022,'square',.008);bonusCheck();M.hud();}
  else if(M.power.delete(k)){
    M.score+=50;M.eaten++;M.frightened=Math.max(3.7,7.2-M.level*.28);M.combo=0;
    M.hunters.forEach(h=>{if(!h.eyes)h.dir=M.opp[h.dir];});M.tone(180,.16,'sawtooth',.035,650);
    if(navigator.vibrate)navigator.vibrate(25);M.status('SURGE!');bonusCheck();M.hud();
  }
  if(M.pellets.size+M.power.size===0)nextLevel();
}
function endGame(){
  M.running=false;M.paused=false;M.best=Math.max(M.best,M.score);localStorage.setItem('mazeMunchBest',String(M.best));M.hud();
  M.dom.overlayText.innerHTML=`Caccia terminata.<br>Punteggio <strong>${M.score.toLocaleString('it-IT')}</strong> • livello ${M.level}.`;
  M.dom.start.textContent='RIGIOCA';M.dom.overlay.classList.add('visible');
}
function hit(){
  if(M.player.inv>0||M.ready>0)return;M.lives--;M.hud();M.tone(105,.3,'sawtooth',.05,45);
  if(navigator.vibrate)navigator.vibrate([50,45,80]);if(M.lives<=0)endGame();else M.resetActors(2);
}
function capture(h){
  M.combo++;const pts=200*Math.pow(2,Math.min(3,M.combo-1));M.score+=pts;h.eyes=1;h.release=0;h.speed=8.2;
  M.tone(700+M.combo*100,.09,'square',.025,1100);if(navigator.vibrate)navigator.vibrate(18);M.status(`COMBO +${pts}`);M.hud();
}
function dirs(h){
  let a=M.names.filter(n=>M.canMove(h,n));if(a.length>1&&!h.eyes){const r=M.opp[h.dir],f=a.filter(n=>n!==r);if(f.length)a=f;}return a;
}
function target(h){
  if(h.eyes)return{x:Math.floor(h.spawnX),y:Math.floor(h.spawnY)};
  if((performance.now()/1000)%18>14&&M.frightened<=0)return h.corner;
  const p=M.player,px=Math.floor(p.x),py=Math.floor(p.y),d=M.DIR[p.dir];
  if(h.i===0)return{x:px,y:py};if(h.i===1)return{x:px+d.x*4,y:py+d.y*4};
  if(h.i===2)return{x:px+d.x*2+(px-Math.floor(M.hunters[0].x)),y:py+d.y*2+(py-Math.floor(M.hunters[0].y))};
  return Math.hypot(h.x-p.x,h.y-p.y)>7?{x:px,y:py}:h.corner;
}
function nearest(t){
  let b={x:9,y:11},bd=1e9;for(let y=0;y<M.ROWS;y++)for(let x=0;x<M.COLS;x++)if(M.walk(x,y)){
    const d=Math.hypot(x-t.x,y-t.y);if(d<bd){bd=d;b={x,y};}
  }return b;
}
function path(sx,sy,t){
  t=nearest(t);sx=((sx%M.COLS)+M.COLS)%M.COLS;const q=[[sx,sy,0]],seen=new Set([M.key(sx,sy)]);let n=0;
  while(n<q.length){const[x,y,d]=q[n++];if(x===t.x&&y===t.y)return d;
    for(const k of M.names){const v=M.DIR[k],nx=((x+v.x)%M.COLS+M.COLS)%M.COLS,ny=y+v.y,z=M.key(nx,ny);
      if(ny>=0&&ny<M.ROWS&&M.walk(nx,ny)&&!seen.has(z)){seen.add(z);q.push([nx,ny,d+1]);}
    }
  }return 9999;
}
function choose(h){
  const a=dirs(h);if(!a.length)return;if(M.frightened>0&&!h.eyes){h.dir=a[Math.floor(Math.random()*a.length)];return;}
  const t=target(h);let bd=1e9,b=a[0];for(const n of a){const v=M.DIR[n],x=((Math.floor(h.x)+v.x)%M.COLS+M.COLS)%M.COLS,y=Math.floor(h.y)+v.y,d=path(x,y,t);if(d<bd||(d===bd&&Math.random()<.25)){bd=d;b=n;}}h.dir=b;
}
function hunter(h,dt){
  if(h.release>0){h.release-=dt;return;}if(M.near(h.x,.11)&&M.near(h.y,.11)){h.x=M.center(h.x);h.y=M.center(h.y);choose(h);}
  h.speed=h.eyes?8.4:M.frightened>0?Math.max(3.5,4.35+M.level*.08):Math.min(7.15,4.95+M.level*.16);M.move(h,dt);
  if(h.eyes&&Math.hypot(h.x-h.spawnX,h.y-h.spawnY)<.45){h.x=h.spawnX;h.y=h.spawnY;h.eyes=0;h.release=.9;h.dir='up';}
}
M.update=dt=>{
  if(!M.running||M.paused)return;if(M.ready>0){M.ready-=dt;M.player.inv=Math.max(0,M.player.inv-dt);if(M.ready<=0)M.status('VAI!');return;}
  M.player.inv=Math.max(0,M.player.inv-dt);M.frightened=Math.max(0,M.frightened-dt);M.player.speed=Math.min(7.2,6.05+M.level*.08);
  M.move(M.player,dt,true);eat();
  if(M.bonus){M.bonus.life-=dt;if(Math.hypot(M.player.x-M.bonus.x,M.player.y-M.bonus.y)<.58){M.score+=M.bonus.value;M.tone(760,.13,'triangle',.035,1280);M.status(`BONUS +${M.bonus.value}`);M.bonus=null;M.hud();}else if(M.bonus.life<=0)M.bonus=null;}
  for(const h of M.hunters){hunter(h,dt);if(h.release>0)continue;if(Math.hypot(M.player.x-h.x,M.player.y-h.y)<.58){if(h.eyes)continue;if(M.frightened>0)capture(h);else hit();}}
};
})();