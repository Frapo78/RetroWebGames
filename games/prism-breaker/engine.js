(() => {
  'use strict';

  const Levels=window.PrismBreakerLevels, Bosses=window.PrismBreakerBosses;
  if(!Levels?.getLevel||!Bosses?.getBoss) throw new Error('Prism Breaker modules missing');
  const $=id=>document.getElementById(id);
  const canvas=$('game'), ctx=canvas.getContext('2d',{alpha:false});
  const scoreEl=$('score'),levelEl=$('level'),livesEl=$('lives'),bestEl=$('best'),statusEl=$('statusPill');
  const overlay=$('overlay'),overlayText=$('overlayText'),startBtn=$('startBtn'),pauseBtn=$('pauseBtn'),muteBtn=$('muteBtn');
  const bossHud=$('bossHud'),bossNameEl=$('bossName'),bossEnergyEl=$('bossEnergy'),bossEnergyText=$('bossEnergyText');

  const RESUME_SCHEMA=1, BEST_KEY='rwgPrismBreakerBest';
  const POWER_TYPES=['expand','multi','slow','laser','catch','life'];
  const POWER_LABEL={expand:'E',multi:'M',slow:'S',laser:'L',catch:'C',life:'+'};
  const POWER_COLOR={expand:'#65e7ff',multi:'#ff5ecf',slow:'#8d7cff',laser:'#ff6680',catch:'#7cffb2',life:'#ffe66d'};
  const BRICK_COLOR={normal:'#52d4ff',tough:'#8d7cff',armored:'#ff934f',glass:'#bdf8ff',explosive:'#ff6680',prism:'#f3e8ff',moving:'#7cffb2',steel:'#91a2b7'};
  const BRICK_POINTS={normal:100,tough:180,armored:260,glass:150,explosive:220,prism:320,moving:240,steel:0};

  let W=390,H=844,DPR=1,running=false,paused=false,muted=false,started=false,last=performance.now(),accumulator=0;
  let score=0,level=1,cycle=1,lives=3,best=Number(localStorage.getItem(BEST_KEY)||0),elapsed=0,phase='intro',clearT=0,combo=1;
  let stage=null,boss=null,banner='',bannerT=0,shake=0,pointer=false,laserClock=0;
  const paddle={x:195,targetX:195,y:760,w:92,h:12,baseW:92};
  const balls=[],bricks=[],powerups=[],lasers=[],enemyBullets=[],particles=[];
  const effects={expand:0,laser:0,catch:0};
  let audioCtx=null;

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const fmt=n=>Number(n||0).toLocaleString('it-IT');
  const markSessionDirty=reason=>window.RWGSession?.markDirty?.(reason);
  const cycleScale=()=>1+Math.max(0,cycle-1)*.12;
  const bossIdentity=()=>boss?`${boss.ordinal}:${boss.name}:${boss.shape}:${boss.move}:${boss.attack}`:'';

  function ensureAudio(){if(audioCtx)return;const AC=window.AudioContext||window.webkitAudioContext;if(AC)audioCtx=new AC();}
  function tone(freq,d=.05,type='square',vol=.022,end=freq){if(muted)return;ensureAudio();if(!audioCtx)return;if(audioCtx.state==='suspended')audioCtx.resume().catch(()=>{});try{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.setValueAtTime(freq,audioCtx.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(24,end),audioCtx.currentTime+d);g.gain.setValueAtTime(vol,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+d);o.connect(g).connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+d);}catch(_){}}
  function vibrate(pattern){try{navigator.vibrate?.(pattern);}catch(_){}}
  function burst(x,y,color,count=10,speed=130){const room=Math.max(0,360-particles.length);for(let i=0;i<Math.min(room,count);i++){const a=Math.random()*Math.PI*2,s=25+Math.random()*speed;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.35+Math.random()*.35,max:.7,color,size:1+Math.random()*2.5});}}
  function announce(text,time=1.05){banner=text;bannerT=time;statusEl.textContent=text;statusEl.classList.add('show');clearTimeout(announce.t);announce.t=setTimeout(()=>statusEl.classList.remove('show'),Math.max(450,time*850));}

  function resize(){
    const r=canvas.getBoundingClientRect();DPR=Math.min(devicePixelRatio||1,2);W=Math.max(280,r.width);H=Math.max(480,r.height);canvas.width=Math.floor(W*DPR);canvas.height=Math.floor(H*DPR);ctx.setTransform(DPR,0,0,DPR,0,0);
    paddle.y=H-Math.max(72,H*.09);paddle.baseW=clamp(W*.235,78,104);paddle.w=effects.expand>0?clamp(paddle.baseW*1.42,108,145):paddle.baseW;paddle.x=clamp(paddle.x,paddle.w/2+8,W-paddle.w/2-8);paddle.targetX=clamp(paddle.targetX,paddle.w/2+8,W-paddle.w/2-8);
    for(const b of balls) if(b.stuck){b.x=paddle.x+(b.offset||0);b.y=paddle.y-paddle.h/2-b.r-2;}
  }

  function brickRect(brick){
    const fieldW=W-24,cellW=fieldW/Levels.COLS,rowH=clamp(H*.032,20,27),top=Math.max(92,H*.11),motion=brick.type==='moving'?Math.sin(elapsed*1.75+brick.phase)*cellW*.28:0;
    return{x:12+brick.c*cellW+cellW*.07+motion,y:top+brick.r*rowH,w:cellW*.86,h:rowH*.68};
  }

  function updateHud(){scoreEl.textContent=fmt(score);levelEl.textContent=cycle>1?`${level} • C${cycle}`:String(level);livesEl.textContent=lives;bestEl.textContent=fmt(best);if(boss)updateBossHud();}
  function showBossHud(){bossHud.hidden=false;} function hideBossHud(){bossHud.hidden=true;bossHud.classList.remove('danger');}
  function updateBossHud(){if(!boss)return;const ratio=clamp(boss.hp/boss.maxHp,0,1);bossNameEl.textContent=`BOSS ${boss.ordinal} • ${boss.name}`;bossEnergyEl.style.transform=`scaleX(${ratio})`;bossEnergyText.textContent=`${Math.ceil(ratio*100)}%`;bossHud.classList.toggle('danger',ratio<.25);}

  function makeBall(stuck=true,offset=0){const speed=stage?stage.speed*cycleScale():300;const angle=(Math.random()*.34-.17);return{x:paddle.x+offset,y:paddle.y-18,vx:Math.sin(angle)*speed,vy:-Math.cos(angle)*speed,r:6,stuck,offset,bossCooldown:0};}
  function resetBall(){balls.length=0;balls.push(makeBall(true,0));}
  function launchStuck(){let launched=false;for(const b of balls)if(b.stuck){b.stuck=false;const speed=stage.speed*cycleScale();const rel=clamp((b.offset||0)/(paddle.w*.5),-.7,.7);b.vx=rel*speed*.7+(Math.random()-.5)*35;b.vy=-Math.sqrt(Math.max(speed*speed-b.vx*b.vx,speed*speed*.55));launched=true;}if(launched){tone(390,.04,'square',.018,640);markSessionDirty('launch');}}

  function buildStage(targetLevel=level,targetCycle=cycle){
    level=targetLevel;cycle=targetCycle;stage=Levels.getLevel(level);bricks.length=0;for(const cell of stage.cells)bricks.push({...cell,maxHp:cell.hp});
    powerups.length=lasers.length=enemyBullets.length=particles.length=0;combo=1;clearT=0;phase='playing';
    if(stage.boss){const cfg=Bosses.getBoss(level,cycle);boss={...cfg,hp:cfg.maxHp,maxHp:cfg.maxHp,x:W/2,y:Math.max(145,H*.18),t:0,fireClock:1.1,flash:0};showBossHud();announce(`BOSS ${cfg.ordinal} • ${cfg.name}`,1.8);}else{boss=null;hideBossHud();announce(`${stage.name}${cycle>1?` • CYCLE ${cycle}`:''}`,1.3);}
    resetBall();updateHud();markSessionDirty('level-start');
  }

  function startGame(){window.RWGSession?.clear?.();ensureAudio();score=0;level=1;cycle=1;lives=3;elapsed=0;started=true;running=true;paused=false;phase='playing';effects.expand=effects.laser=effects.catch=0;laserClock=0;paddle.x=paddle.targetX=W/2;overlay.classList.remove('visible');startBtn.textContent='RIGIOCA';pauseBtn.textContent='Ⅱ';buildStage(1,1);last=performance.now();accumulator=0;}

  function nextLevel(){
    if(level>=Levels.MAX_LEVEL){level=1;cycle++;announce(`CYCLE ${cycle} • VELOCITÀ +12%`,1.8);}else level++;
    buildStage(level,cycle);running=true;paused=false;last=performance.now();accumulator=0;
  }
  function completeLevel(){if(phase!=='playing')return;phase='clear';clearT=1.05;running=true;score+=1000+level*35+Math.max(0,lives-1)*120;updateHud();announce(stage.boss?`BOSS ${boss?.ordinal||level/10} DOWN!`:`LEVEL ${level} CLEAR!`,1.1);tone(660,.12,'triangle',.04,1080);vibrate([15,18,35]);window.RWGSession?.saveNow?.('level-clear');}

  function loseLife(reason='PALLINA PERSA'){
    if(phase!=='playing'||!started)return;lives--;combo=1;effects.catch=0;enemyBullets.length=0;lasers.length=0;shake=7;vibrate([25,25,45]);tone(120,.2,'sawtooth',.04,55);updateHud();
    if(lives<=0){gameOver();return;}resetBall();announce(`${reason} • ${lives} ${lives===1?'VITA':'VITE'}`,1.1);markSessionDirty('life-lost');
  }
  function gameOver(){phase='game-over';running=false;paused=false;started=false;best=Math.max(best,score);localStorage.setItem(BEST_KEY,String(best));updateHud();hideBossHud();overlayText.innerHTML=`Run terminata.<br>Punteggio <strong>${fmt(score)}</strong> • livello ${level}${cycle>1?` • ciclo ${cycle}`:''}.`;startBtn.textContent='RIGIOCA';overlay.classList.add('visible');pauseBtn.textContent='Ⅱ';const detail={game:'Prism Breaker',score,level,best,cycle,lives:0};window.dispatchEvent(new CustomEvent('rwg:game-ended',{detail}));requestAnimationFrame(()=>window.RWGGameOver?.open?.(detail));}

  function remainingDestructible(){let count=0;for(const b of bricks)if(b.hp>0&&b.type!=='steel')count++;return count;}
  function dropPowerup(brick,rect){const chance=brick.type==='prism'?.42:stage.dropChance;if(Math.random()>chance)return;const weights=level<8?['expand','multi','slow','catch','life']:['expand','multi','slow','laser','catch','life'];const type=weights[Math.floor(Math.random()*weights.length)];powerups.push({x:rect.x+rect.w/2,y:rect.y+rect.h/2,vy:105+level*.5,type,r:9,spin:0});}

  function destroyBrick(brick,rect,fromExplosion=false){
    if(brick.hp<=0||brick.type==='steel')return;brick.hp=0;combo=clamp(combo+(fromExplosion?.15:.3),1,5);score+=Math.round((BRICK_POINTS[brick.type]||100)*combo);burst(rect.x+rect.w/2,rect.y+rect.h/2,BRICK_COLOR[brick.type],brick.type==='explosive'?20:10,brick.type==='explosive'?210:120);dropPowerup(brick,rect);tone(250+Math.min(520,combo*75),.035,'square',.018,420);
    if(brick.type==='explosive'){
      const cx=rect.x+rect.w/2,cy=rect.y+rect.h/2,range=Math.max(rect.w,rect.h)*1.9;
      for(const other of bricks){if(other===brick||other.hp<=0||other.type==='steel')continue;const or=brickRect(other),ox=or.x+or.w/2,oy=or.y+or.h/2;if(Math.hypot(ox-cx,oy-cy)<range){other.hp=0;score+=Math.round((BRICK_POINTS[other.type]||100)*.7);burst(ox,oy,BRICK_COLOR[other.type],7,130);}}
      shake=Math.max(shake,7);vibrate(12);
    }
    updateHud();markSessionDirty('brick');if(remainingDestructible()===0&&!boss)completeLevel();
  }

  function hitBrick(brick,rect,damage=1){if(brick.type==='steel'){tone(1000,.025,'square',.008,780);return false;}brick.hp=Math.max(0,brick.hp-damage);if(brick.hp<=0)destroyBrick(brick,rect);else{score+=30;burst(rect.x+rect.w/2,rect.y+rect.h/2,'#ffffff',4,55);tone(420,.025,'square',.012,340);markSessionDirty('brick-damage');}return true;}

  function circleRectHit(ball,rect){const nx=clamp(ball.x,rect.x,rect.x+rect.w),ny=clamp(ball.y,rect.y,rect.y+rect.h),dx=ball.x-nx,dy=ball.y-ny;return dx*dx+dy*dy<ball.r*ball.r;}
  function reflectFromRect(ball,rect){const cx=rect.x+rect.w/2,cy=rect.y+rect.h/2,dx=(ball.x-cx)/(rect.w/2+ball.r),dy=(ball.y-cy)/(rect.h/2+ball.r);if(Math.abs(dx)>Math.abs(dy)){ball.vx=Math.abs(ball.vx)*(dx>=0?1:-1);ball.x=dx>=0?rect.x+rect.w+ball.r:rect.x-ball.r;}else{ball.vy=Math.abs(ball.vy)*(dy>=0?1:-1);ball.y=dy>=0?rect.y+rect.h+ball.r:rect.y-ball.r;}}

  function bossRect(){if(!boss)return null;const bw=clamp(W*.25,82,112),bh=clamp(H*.052,34,46);return{x:boss.x-bw/2,y:boss.y-bh/2,w:bw,h:bh};}
  function hitBoss(ball,damage=1){if(!boss||boss.hp<=0||ball.bossCooldown>0)return false;boss.hp=Math.max(0,boss.hp-damage);boss.flash=.08;ball.bossCooldown=.09;score+=Math.round(140*damage);shake=Math.max(shake,3);updateBossHud();burst(ball.x,ball.y,boss.accent,7,100);tone(170+boss.ordinal*24,.04,'square',.02,300);markSessionDirty('boss-hit');if(boss.hp<=0){score+=4000*boss.ordinal+cycle*1000;updateHud();completeLevel();}return true;}

  function paddleBounce(ball){
    const rect={x:paddle.x-paddle.w/2,y:paddle.y-paddle.h/2,w:paddle.w,h:paddle.h};if(ball.vy<=0||!circleRectHit(ball,rect))return false;
    const rel=clamp((ball.x-paddle.x)/(paddle.w/2),-1,1),speed=clamp(Math.hypot(ball.vx,ball.vy)*1.012,stage.speed*cycleScale()*.92,620+Math.min(90,cycle*15));const angle=rel*1.05;ball.vx=Math.sin(angle)*speed;ball.vy=-Math.max(speed*.46,Math.cos(angle)*speed);ball.y=rect.y-ball.r-1;combo=1;tone(330,.028,'square',.014,520);
    if(effects.catch>0){ball.stuck=true;ball.offset=clamp(ball.x-paddle.x,-paddle.w*.38,paddle.w*.38);ball.vx=0;ball.vy=0;announce('CATCH • TAP PER LANCIARE',.55);}return true;
  }

  function simulateBall(ball,dt){
    if(ball.stuck){ball.x=paddle.x+(ball.offset||0);ball.y=paddle.y-paddle.h/2-ball.r-2;return;}
    ball.bossCooldown=Math.max(0,ball.bossCooldown-dt);const distance=Math.hypot(ball.vx,ball.vy)*dt,steps=Math.max(1,Math.ceil(distance/Math.max(3,ball.r*.7))),step=dt/steps;
    for(let s=0;s<steps;s++){
      ball.x+=ball.vx*step;ball.y+=ball.vy*step;
      if(ball.x-ball.r<7&&ball.vx<0){ball.x=7+ball.r;ball.vx=Math.abs(ball.vx);tone(260,.018,'square',.007,300);}if(ball.x+ball.r>W-7&&ball.vx>0){ball.x=W-7-ball.r;ball.vx=-Math.abs(ball.vx);tone(260,.018,'square',.007,300);}if(ball.y-ball.r<7&&ball.vy<0){ball.y=7+ball.r;ball.vy=Math.abs(ball.vy);tone(260,.018,'square',.007,300);}
      paddleBounce(ball);
      let hit=false;
      for(const brick of bricks){if(brick.hp<=0)continue;const rect=brickRect(brick);if(!circleRectHit(ball,rect))continue;reflectFromRect(ball,rect);hitBrick(brick,rect,1);hit=true;break;}
      if(hit)continue;
      if(boss&&boss.hp>0){const rect=bossRect();if(circleRectHit(ball,rect)){reflectFromRect(ball,rect);hitBoss(ball,1);}}
    }
  }

  function applyPower(type){
    if(type==='expand'){effects.expand=14;paddle.w=clamp(paddle.baseW*1.42,108,145);announce('EXPAND!',.8);}
    else if(type==='multi'){const source=balls.filter(b=>!b.stuck).slice(0,3);for(const b of source){if(balls.length>=6)break;const speed=Math.hypot(b.vx,b.vy)||stage.speed;const a=Math.atan2(b.vy,b.vx)+.34;balls.push({...b,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,stuck:false,offset:0,bossCooldown:.05});}announce('MULTIBALL!',.8);}
    else if(type==='slow'){for(const b of balls){b.vx*=.78;b.vy*=.78;}announce('SLOW!',.8);}
    else if(type==='laser'){effects.laser=12;laserClock=0;announce('LASER!',.8);}
    else if(type==='catch'){effects.catch=12;announce('CATCH!',.8);}
    else if(type==='life'){lives=Math.min(9,lives+1);announce('EXTRA LIFE!',.9);}
    score+=250;updateHud();tone(720,.1,'triangle',.035,1100);vibrate(10);markSessionDirty('powerup');
  }

  function fireLasers(){if(effects.laser<=0)return;lasers.push({x:paddle.x-paddle.w*.3,y:paddle.y-9,vy:-640,r:2},{x:paddle.x+paddle.w*.3,y:paddle.y-9,vy:-640,r:2});tone(880,.035,'square',.012,1080);}
  function updateLasers(dt){
    for(let i=lasers.length-1;i>=0;i--){const l=lasers[i];l.y+=l.vy*dt;if(l.y<-15){lasers.splice(i,1);continue;}let remove=false;for(const b of bricks){if(b.hp<=0)continue;const r=brickRect(b);if(l.x>=r.x&&l.x<=r.x+r.w&&l.y>=r.y&&l.y<=r.y+r.h){hitBrick(b,r,1);remove=true;break;}}if(!remove&&boss&&boss.hp>0){const r=bossRect();if(l.x>=r.x&&l.x<=r.x+r.w&&l.y>=r.y&&l.y<=r.y+r.h){const fake={...l,bossCooldown:0};hitBoss(fake,.5);remove=true;}}if(remove)lasers.splice(i,1);}
  }

  function updatePowerups(dt){for(let i=powerups.length-1;i>=0;i--){const p=powerups[i];p.y+=p.vy*dt;p.spin+=dt*4;if(p.y>H+20){powerups.splice(i,1);continue;}if(p.y+p.r>=paddle.y-paddle.h&&Math.abs(p.x-paddle.x)<paddle.w/2+p.r){applyPower(p.type);powerups.splice(i,1);}}}

  function updateBoss(dt){if(!boss||boss.hp<=0)return;boss.t+=dt;boss.flash=Math.max(0,boss.flash-dt);const span=Math.max(40,W*.34),center=W/2,baseY=Math.max(145,H*.18);
    switch(boss.move){case'sine':boss.x=center+Math.sin(boss.t*.85)*span;boss.y=baseY+Math.sin(boss.t*1.7)*12;break;case'zigzag':boss.x=center+Math.sin(boss.t*1.35)*span;boss.y=baseY+Math.abs(Math.sin(boss.t*.9))*35;break;case'arc':boss.x=center+Math.sin(boss.t*.72)*span*.9;boss.y=baseY+38+Math.cos(boss.t*.72)*35;break;case'anchor':boss.x+=(center-boss.x)*(1-Math.pow(.02,dt));boss.y=baseY+Math.sin(boss.t)*12;break;case'serpent':boss.x=center+Math.sin(boss.t*1.05)*span;boss.y=baseY+25+Math.sin(boss.t*2.1)*30;break;case'dash':boss.x=center+Math.sin(boss.t*1.8)*span;boss.y=baseY+Math.sin(boss.t*.7)*22;break;case'blink':if(Math.floor((boss.t-dt)/1.4)!==Math.floor(boss.t/1.4)){boss.x=clamp(55+Math.random()*(W-110),55,W-55);burst(boss.x,boss.y,boss.color,12,100);}break;case'orbit':boss.x=center+Math.cos(boss.t*.8)*span*.78;boss.y=baseY+40+Math.sin(boss.t*.8)*42;break;case'phase':boss.x=center+Math.sin(boss.t*.55)*span+Math.sin(boss.t*2.8)*28;boss.y=baseY+20+Math.cos(boss.t*1.3)*30;break;case'omega':boss.x=center+Math.sin(boss.t*1.2)*span*.88;boss.y=baseY+34+Math.cos(boss.t*1.65)*38;break;}
    boss.fireClock-=dt;if(boss.fireClock<=0){bossAttack();boss.fireClock=boss.fireGap*(.82+Math.random()*.32);}
  }
  function enemyShot(x,y,vx,vy,r=5,color=boss?.color||'#ff6680'){enemyBullets.push({x,y,vx,vy,r,color,life:7});}
  function aimShot(offset=0,speed=195){const dx=paddle.x-boss.x,dy=paddle.y-boss.y,a=Math.atan2(dy,dx)+offset;enemyShot(boss.x,boss.y,Math.cos(a)*speed,Math.sin(a)*speed,5,boss.accent);}
  function bossAttack(){if(!boss)return;const speed=(180+boss.ordinal*9)*Math.min(1.35,cycleScale());switch(boss.attack){case'aimed':aimShot(0,speed);break;case'double':aimShot(-.12,speed);aimShot(.12,speed);break;case'fan':for(let i=-2;i<=2;i++)aimShot(i*.14,speed);break;case'mines':for(let i=-1;i<=1;i++)enemyShot(boss.x+i*28,boss.y, i*18,125+boss.ordinal*5,7,boss.color);break;case'triple':for(let i=-1;i<=1;i++)aimShot(i*.18,speed+25);break;case'omega':{const mode=Math.floor(boss.t)%3;if(mode===0)for(let i=-3;i<=3;i++)aimShot(i*.12,speed+35);else if(mode===1)for(let i=0;i<10;i++){const a=i*Math.PI*2/10;enemyShot(boss.x,boss.y,Math.cos(a)*speed*.72,Math.sin(a)*speed*.72,4,i%2?boss.color:boss.accent);}else{aimShot(-.08,speed+65);aimShot(0,speed+65);aimShot(.08,speed+65);}break;}}tone(150,.04,'sawtooth',.012,90);}
  function updateEnemyBullets(dt){for(let i=enemyBullets.length-1;i>=0;i--){const b=enemyBullets[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.life<=0||b.y>H+30||b.x<-30||b.x>W+30){enemyBullets.splice(i,1);continue;}if(b.y+b.r>=paddle.y-paddle.h/2&&b.y-b.r<=paddle.y+paddle.h/2&&Math.abs(b.x-paddle.x)<paddle.w/2+b.r){enemyBullets.length=0;loseLife('COLPO DEL BOSS');return;}}}

  function updateEffects(dt){if(effects.expand>0){effects.expand=Math.max(0,effects.expand-dt);if(effects.expand===0)paddle.w=paddle.baseW;}if(effects.laser>0){effects.laser=Math.max(0,effects.laser-dt);laserClock-=dt;if(laserClock<=0){fireLasers();laserClock=.42;}}if(effects.catch>0)effects.catch=Math.max(0,effects.catch-dt);}
  function updateParticles(dt){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.06,dt);p.vy*=Math.pow(.06,dt);p.life-=dt;if(p.life<=0)particles.splice(i,1);}shake*=Math.pow(.025,dt);}

  function fixedUpdate(dt){
    if(!running||paused||phase==='game-over')return;elapsed+=dt;updateEffects(dt);updateParticles(dt);
    const f=1-Math.pow(.0007,dt);paddle.x+=(paddle.targetX-paddle.x)*f;paddle.x=clamp(paddle.x,paddle.w/2+8,W-paddle.w/2-8);
    if(phase==='clear'){clearT-=dt;if(clearT<=0)nextLevel();return;}
    updateBoss(dt);for(const b of balls)simulateBall(b,dt);for(let i=balls.length-1;i>=0;i--)if(!balls[i].stuck&&balls[i].y-balls[i].r>H+10)balls.splice(i,1);if(!balls.length){loseLife();return;}
    updatePowerups(dt);updateLasers(dt);updateEnemyBullets(dt);bannerT=Math.max(0,bannerT-dt);
  }

  function rounded(x,y,w,h,r,fill,stroke=null){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
  function drawBackground(){const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#101b48');g.addColorStop(.45,'#080d25');g.addColorStop(1,'#02040d');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.strokeStyle='rgba(101,231,255,.055)';ctx.lineWidth=1;for(let y=70;y<H;y+=34){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}for(let x=12;x<W;x+=42){ctx.beginPath();ctx.moveTo(x,70);ctx.lineTo(x,H);ctx.stroke();}}
  function drawBrick(b){if(b.hp<=0)return;const r=brickRect(b),color=BRICK_COLOR[b.type]||'#65e7ff';ctx.save();ctx.shadowBlur=b.type==='prism'?13:6;ctx.shadowColor=color;let fill=color;if(b.type==='glass')fill='rgba(210,250,255,.38)';if(b.type==='steel')fill='#657386';rounded(r.x,r.y,r.w,r.h,4,fill,'rgba(255,255,255,.38)');ctx.shadowBlur=0;ctx.globalAlpha=.32;ctx.fillStyle='#fff';ctx.fillRect(r.x+3,r.y+2,r.w-6,2);ctx.globalAlpha=1;if(b.type==='armored'||b.type==='tough'){ctx.fillStyle='rgba(5,8,20,.72)';ctx.font='900 8px ui-monospace';ctx.textAlign='center';ctx.fillText(String(Math.min(9,b.hp)),r.x+r.w/2,r.y+r.h*.68);}if(b.type==='explosive'){ctx.fillStyle='#fff0ba';ctx.beginPath();ctx.arc(r.x+r.w/2,r.y+r.h/2,3,0,Math.PI*2);ctx.fill();}if(b.type==='prism'){ctx.strokeStyle='#fff';ctx.beginPath();ctx.moveTo(r.x+r.w*.5,r.y+3);ctx.lineTo(r.x+r.w*.72,r.y+r.h*.5);ctx.lineTo(r.x+r.w*.5,r.y+r.h-3);ctx.lineTo(r.x+r.w*.28,r.y+r.h*.5);ctx.closePath();ctx.stroke();}if(b.type==='moving'){ctx.fillStyle='rgba(3,30,22,.72)';ctx.fillRect(r.x+r.w*.25,r.y+r.h*.42,r.w*.5,2);}ctx.restore();}
  function drawPaddle(){ctx.save();ctx.shadowBlur=16;ctx.shadowColor=effects.laser>0?'#ff6680':effects.catch>0?'#7cffb2':'#65e7ff';const g=ctx.createLinearGradient(paddle.x-paddle.w/2,0,paddle.x+paddle.w/2,0);g.addColorStop(0,'#2a4e73');g.addColorStop(.45,'#e8fbff');g.addColorStop(.55,'#fff');g.addColorStop(1,'#2a4e73');rounded(paddle.x-paddle.w/2,paddle.y-paddle.h/2,paddle.w,paddle.h,7,g);ctx.shadowBlur=0;if(effects.laser>0){ctx.fillStyle='#ff6680';ctx.fillRect(paddle.x-paddle.w*.34,paddle.y-8,5,7);ctx.fillRect(paddle.x+paddle.w*.34-5,paddle.y-8,5,7);}ctx.restore();}
  function drawBall(b){ctx.save();ctx.shadowBlur=12;ctx.shadowColor='#ffe66d';const g=ctx.createRadialGradient(b.x-2,b.y-2,1,b.x,b.y,b.r);g.addColorStop(0,'#fff');g.addColorStop(.42,'#fff6b8');g.addColorStop(1,'#e89c34');ctx.fillStyle=g;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.restore();}
  function drawBoss(){if(!boss||boss.hp<=0)return;const r=bossRect();ctx.save();ctx.translate(boss.x,boss.y);ctx.shadowBlur=22;ctx.shadowColor=boss.color;ctx.fillStyle=boss.flash>0?'#fff':boss.color;ctx.strokeStyle=boss.accent;ctx.lineWidth=2;const w=r.w,h=r.h;switch(boss.shape){case'orb':ctx.beginPath();ctx.ellipse(0,0,w*.46,h*.48,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#071126';ctx.beginPath();ctx.arc(0,0,h*.2,0,Math.PI*2);ctx.fill();break;case'fang':ctx.beginPath();ctx.moveTo(-w*.48,-h*.35);ctx.lineTo(-w*.1,h*.45);ctx.lineTo(0,h*.12);ctx.lineTo(w*.1,h*.45);ctx.lineTo(w*.48,-h*.35);ctx.lineTo(0,-h*.1);ctx.closePath();ctx.fill();ctx.stroke();break;case'manta':ctx.beginPath();ctx.moveTo(0,-h*.42);ctx.lineTo(-w*.5,h*.05);ctx.lineTo(-w*.28,h*.45);ctx.lineTo(0,h*.18);ctx.lineTo(w*.28,h*.45);ctx.lineTo(w*.5,h*.05);ctx.closePath();ctx.fill();ctx.stroke();break;case'core':ctx.fillRect(-w*.42,-h*.38,w*.84,h*.76);ctx.strokeRect(-w*.42,-h*.38,w*.84,h*.76);ctx.fillStyle=boss.accent;ctx.beginPath();ctx.arc(0,0,h*.22,0,Math.PI*2);ctx.fill();break;case'hydra':for(const x of[-.32,0,.32]){ctx.beginPath();ctx.arc(w*x,-h*.06,h*.27,0,Math.PI*2);ctx.fill();ctx.stroke();}ctx.fillRect(-w*.42,h*.08,w*.84,h*.28);break;case'kraken':ctx.beginPath();ctx.arc(0,-h*.08,h*.34,Math.PI,0);ctx.lineTo(w*.42,h*.3);ctx.lineTo(w*.18,h*.1);ctx.lineTo(0,h*.42);ctx.lineTo(-w*.18,h*.1);ctx.lineTo(-w*.42,h*.3);ctx.closePath();ctx.fill();ctx.stroke();break;case'crown':ctx.beginPath();ctx.moveTo(-w*.46,h*.32);ctx.lineTo(-w*.36,-h*.36);ctx.lineTo(-w*.12,h*.02);ctx.lineTo(0,-h*.48);ctx.lineTo(w*.12,h*.02);ctx.lineTo(w*.36,-h*.36);ctx.lineTo(w*.46,h*.32);ctx.closePath();ctx.fill();ctx.stroke();break;case'reactor':ctx.beginPath();ctx.arc(0,0,h*.45,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.strokeStyle=boss.accent;ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,h*.25,0,Math.PI*2);ctx.stroke();break;case'warden':ctx.beginPath();ctx.moveTo(0,-h*.48);ctx.lineTo(w*.46,0);ctx.lineTo(0,h*.48);ctx.lineTo(-w*.46,0);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#061020';ctx.fillRect(-w*.05,-h*.34,w*.1,h*.68);break;default:ctx.beginPath();ctx.moveTo(0,-h*.5);ctx.lineTo(w*.18,-h*.12);ctx.lineTo(w*.48,-h*.36);ctx.lineTo(w*.36,h*.18);ctx.lineTo(w*.12,h*.42);ctx.lineTo(0,h*.2);ctx.lineTo(-w*.12,h*.42);ctx.lineTo(-w*.36,h*.18);ctx.lineTo(-w*.48,-h*.36);ctx.lineTo(-w*.18,-h*.12);ctx.closePath();ctx.fill();ctx.stroke();}
    ctx.restore();}
  function drawPowerup(p){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.spin);ctx.shadowBlur=14;ctx.shadowColor=POWER_COLOR[p.type];ctx.fillStyle=POWER_COLOR[p.type];rounded(-10,-8,20,16,5,POWER_COLOR[p.type],'rgba(255,255,255,.7)');ctx.shadowBlur=0;ctx.fillStyle='#061020';ctx.font='900 10px ui-monospace';ctx.textAlign='center';ctx.fillText(POWER_LABEL[p.type],0,4);ctx.restore();}
  function draw(){ctx.save();if(shake>0)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);drawBackground();for(const b of bricks)drawBrick(b);drawBoss();for(const p of powerups)drawPowerup(p);ctx.strokeStyle='#ff6680';ctx.lineWidth=2.5;ctx.shadowBlur=9;ctx.shadowColor='#ff6680';for(const l of lasers){ctx.beginPath();ctx.moveTo(l.x,l.y+8);ctx.lineTo(l.x,l.y-8);ctx.stroke();}ctx.shadowBlur=0;for(const b of enemyBullets){ctx.fillStyle=b.color;ctx.shadowBlur=10;ctx.shadowColor=b.color;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();}ctx.shadowBlur=0;for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);}ctx.globalAlpha=1;drawPaddle();for(const b of balls)drawBall(b);if(paused&&started){ctx.fillStyle='rgba(2,4,13,.62)';ctx.fillRect(0,0,W,H);ctx.fillStyle='#fff';ctx.font='900 24px ui-monospace';ctx.textAlign='center';ctx.fillText('PAUSA',W/2,H/2);}if(bannerT>0){ctx.globalAlpha=Math.min(1,bannerT*2);ctx.fillStyle='#fff';ctx.font='900 16px ui-monospace';ctx.textAlign='center';ctx.shadowBlur=14;ctx.shadowColor='#65e7ff';ctx.fillText(banner,W/2,H*.55);ctx.shadowBlur=0;ctx.globalAlpha=1;}ctx.restore();}

  function frame(now){const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;accumulator=Math.min(.12,accumulator+dt);const step=1/120;while(accumulator>=step){fixedUpdate(step);accumulator-=step;}draw();requestAnimationFrame(frame);}
  function setPointer(clientX){const r=canvas.getBoundingClientRect();paddle.targetX=clientX-r.left;}

  function finite(o,keys){return o&&keys.every(k=>Number.isFinite(o[k]));}
  function serializeResumeState(){return{schema:RESUME_SCHEMA,viewport:{w:W,h:H},stageSignature:stage?.signature||'',score,level,cycle,lives,elapsed,phase,clearT,combo,paddle:{x:paddle.x,targetX:paddle.targetX},effects:{...effects},balls:balls.map(b=>({...b})),brickState:bricks.map(b=>({id:b.id,hp:b.hp})),boss:boss?{identity:bossIdentity(),hp:boss.hp,maxHp:boss.maxHp,x:boss.x,y:boss.y,t:boss.t,fireClock:boss.fireClock}:null,powerups:powerups.map(p=>({...p})),lasers:lasers.map(l=>({...l})),enemyBullets:enemyBullets.map(b=>({...b}))};}
  function validateResumeState(s){
    if(!s||s.schema!==RESUME_SCHEMA||!Number.isInteger(s.level)||s.level<1||s.level>Levels.MAX_LEVEL||!Number.isInteger(s.cycle)||s.cycle<1||!Number.isInteger(s.lives)||s.lives<1||s.lives>9)return false;
    if(![s.score,s.elapsed,s.clearT,s.combo].every(Number.isFinite)||s.score<0||s.elapsed<0||s.clearT<0||s.combo<1||s.combo>6)return false;if(!['playing','clear'].includes(s.phase)||!finite(s.viewport,['w','h'])||s.viewport.w<240||s.viewport.h<420)return false;
    const blueprint=Levels.getLevel(s.level);if(s.stageSignature!==blueprint.signature)return false;if(!finite(s.paddle,['x','targetX'])||!s.effects||!['expand','laser','catch'].every(k=>Number.isFinite(s.effects[k])&&s.effects[k]>=0))return false;
    if(!Array.isArray(s.balls)||s.balls.length<1||s.balls.length>6||s.balls.some(b=>!finite(b,['x','y','vx','vy','r','offset','bossCooldown'])||typeof b.stuck!=='boolean'||b.r<3||b.r>12))return false;
    if(!Array.isArray(s.brickState)||s.brickState.length!==blueprint.cells.length||new Set(s.brickState.map(b=>b.id)).size!==s.brickState.length)return false;const ids=new Map(blueprint.cells.map(b=>[b.id,b]));for(const b of s.brickState){const base=ids.get(b.id);if(!base||!Number.isFinite(b.hp)||b.hp<0||b.hp>base.hp)return false;if(base.type==='steel'&&b.hp!==base.hp)return false;}
    const remaining=s.brickState.some(b=>{const base=ids.get(b.id);return base.type!=='steel'&&b.hp>0;});if(s.phase==='clear'&&remaining)return false;
    if(blueprint.boss){const cfg=Bosses.getBoss(s.level,s.cycle),identity=`${cfg.ordinal}:${cfg.name}:${cfg.shape}:${cfg.move}:${cfg.attack}`;if(!s.boss||s.boss.identity!==identity||!finite(s.boss,['hp','maxHp','x','y','t','fireClock'])||s.boss.maxHp!==cfg.maxHp||s.boss.hp<0||s.boss.hp>s.boss.maxHp)return false;}else if(s.boss!==null)return false;
    if(!Array.isArray(s.powerups)||s.powerups.some(p=>!finite(p,['x','y','vy','r','spin'])||!POWER_TYPES.includes(p.type)))return false;if(!Array.isArray(s.lasers)||s.lasers.some(l=>!finite(l,['x','y','vy','r'])))return false;if(!Array.isArray(s.enemyBullets)||s.enemyBullets.some(b=>!finite(b,['x','y','vx','vy','r','life'])))return false;
    return true;
  }
  function scalePoint(o,sx,sy){const n={...o};if(Number.isFinite(n.x))n.x*=sx;if(Number.isFinite(n.y))n.y*=sy;if(Number.isFinite(n.vx))n.vx*=sx;if(Number.isFinite(n.vy))n.vy*=sy;if(Number.isFinite(n.targetX))n.targetX*=sx;if(Number.isFinite(n.offset))n.offset*=sx;return n;}
  function restoreResumeState(s){if(!validateResumeState(s))return false;const sx=W/s.viewport.w,sy=H/s.viewport.h;score=Math.floor(s.score);level=s.level;cycle=s.cycle;lives=s.lives;elapsed=s.elapsed;phase=s.phase;clearT=s.clearT;combo=s.combo;effects.expand=s.effects.expand;effects.laser=s.effects.laser;effects.catch=s.effects.catch;started=true;running=true;paused=false;stage=Levels.getLevel(level);bricks.length=0;const hpMap=new Map(s.brickState.map(b=>[b.id,b.hp]));for(const cell of stage.cells)bricks.push({...cell,maxHp:cell.hp,hp:hpMap.get(cell.id)});Object.assign(paddle,scalePoint(s.paddle,sx,sy));paddle.w=effects.expand>0?clamp(paddle.baseW*1.42,108,145):paddle.baseW;balls.length=0;balls.push(...s.balls.map(b=>scalePoint(b,sx,sy)));powerups.length=0;powerups.push(...s.powerups.map(p=>scalePoint(p,sx,sy)));lasers.length=0;lasers.push(...s.lasers.map(l=>scalePoint(l,sx,sy)));enemyBullets.length=0;enemyBullets.push(...s.enemyBullets.map(b=>scalePoint(b,sx,sy)));particles.length=0;
    if(stage.boss){const cfg=Bosses.getBoss(level,cycle);boss={...cfg,hp:s.boss.hp,maxHp:s.boss.maxHp,x:s.boss.x*sx,y:s.boss.y*sy,t:s.boss.t,fireClock:s.boss.fireClock,flash:0};showBossHud();updateBossHud();}else{boss=null;hideBossHud();}
    overlay.classList.remove('visible');startBtn.textContent='RIGIOCA';pauseBtn.textContent='Ⅱ';last=performance.now();accumulator=0;updateHud();announce('PARTITA RIPRESA',.8);return true;}
  const resumeAdapter=Object.freeze({id:'prism-breaker',version:1,compatibility:'prism-breaker-state-v1-levels100-boss10-physics120hz',isInProgress:()=>started&&phase!=='game-over',serialize:serializeResumeState,validate:validateResumeState,restore:restoreResumeState,startFresh:startGame,describe:s=>`livello ${s.level}${s.cycle>1?` • ciclo ${s.cycle}`:''} • ${Math.floor(s.score||0).toLocaleString('it-IT')} punti`});
  window.RWGResumeAdapter=resumeAdapter;window.RWGSession?.register?.(resumeAdapter);

  canvas.addEventListener('pointerdown',e=>{pointer=true;canvas.setPointerCapture?.(e.pointerId);setPointer(e.clientX);launchStuck();ensureAudio();e.preventDefault();});canvas.addEventListener('pointermove',e=>{if(pointer){setPointer(e.clientX);e.preventDefault();}},{passive:false});canvas.addEventListener('pointerup',()=>{pointer=false;});canvas.addEventListener('pointercancel',()=>{pointer=false;});
  window.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Space','KeyA','KeyD','KeyP'].includes(e.code))e.preventDefault();if(e.code==='ArrowLeft'||e.code==='KeyA')paddle.targetX-=42;if(e.code==='ArrowRight'||e.code==='KeyD')paddle.targetX+=42;if(e.code==='Space')launchStuck();if(e.code==='KeyP')pauseBtn.click();},{passive:false});
  startBtn.addEventListener('click',startGame);pauseBtn.addEventListener('click',()=>{if(!started||phase==='game-over')return;paused=!paused;pauseBtn.textContent=paused?'▶':'Ⅱ';if(paused)window.RWGSession?.saveNow?.('pause');else{last=performance.now();accumulator=0;}});muteBtn.addEventListener('click',()=>{muted=!muted;muteBtn.textContent=muted?'🔇':'🔊';if(!muted)ensureAudio();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&started&&!paused&&phase!=='game-over'){paused=true;pauseBtn.textContent='▶';}});
  window.addEventListener('rwg:continue-game',e=>{score=Math.max(0,Math.floor(e.detail?.score??score));lives=1;phase='playing';started=true;running=true;paused=false;enemyBullets.length=0;lasers.length=0;effects.catch=0;resetBall();overlay.classList.remove('visible');startBtn.textContent='RIGIOCA';pauseBtn.textContent='Ⅱ';last=performance.now();accumulator=0;updateHud();announce('CONTINUA!',1);markSessionDirty('credit-continue');});
  window.addEventListener('resize',resize);window.addEventListener('orientationchange',resize);bestEl.textContent=fmt(best);resize();requestAnimationFrame(frame);
})();
