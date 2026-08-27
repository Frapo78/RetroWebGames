(() => {
  'use strict';

  const Campaign=window.StarSwarmCampaign, Bosses=window.StarSwarmBosses;
  if(!Campaign||!Bosses) throw new Error('Star Swarm campaign modules missing');

  const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
  const scoreEl=document.getElementById('score'),levelEl=document.getElementById('level'),livesEl=document.getElementById('lives'),bestEl=document.getElementById('best');
  const overlay=document.getElementById('overlay'),overlayText=document.getElementById('overlayText'),startBtn=document.getElementById('startBtn'),pauseBtn=document.getElementById('pauseBtn'),muteBtn=document.getElementById('muteBtn');
  const bossHud=document.getElementById('bossHud'),bossNameEl=document.getElementById('bossName'),bossEnergyEl=document.getElementById('bossEnergy'),bossEnergyText=document.getElementById('bossEnergyText');
  const bossClear=document.getElementById('bossClear'),bossClearTitle=document.getElementById('bossClearTitle'),bossClearName=document.getElementById('bossClearName'),bossClearStats=document.getElementById('bossClearStats'),bossClearPhrase=document.getElementById('bossClearPhrase');

  let W=390,H=844,DPR=1,running=false,paused=false,muted=false,last=0,score=0,level=1,lives=3,best=Number(localStorage.getItem('starSwarmBest')||0);
  let fireClock=0,enemyFireClock=0,levelClock=0,shake=0,pointerActive=false,stagePhase='wave',stage=null,boss=null,transitionTimer=0;
  let floatingText='',floatingTextT=0,runTime=0;
  const bullets=[],enemyBullets=[],enemies=[],particles=[],stars=[],powerups=[],wingmen=[],bossHazards=[];

  const WEAPONS=[
    {name:'SINGLE FIRE',kind:'bolt',shots:[{x:0,a:0}],interval:.19},
    {name:'DOUBLE FIRE',kind:'bolt',shots:[{x:-7,a:0},{x:7,a:0}],interval:.19},
    {name:'TRIPLE DIAGONAL',kind:'bolt',shots:[{x:0,a:0},{x:-5,a:-.16},{x:5,a:.16}],interval:.20},
    {name:'4 FIRE LINEAR',kind:'bolt',shots:[{x:-13,a:0},{x:-4,a:0},{x:4,a:0},{x:13,a:0}],interval:.21},
    {name:'FIREBALLS 3 WAY',kind:'fireball',shots:[{x:0,a:0},{x:-4,a:-.23},{x:4,a:.23}],interval:.24},
    {name:'LASER',kind:'laser',shots:[{x:0,a:0}],interval:.20},
    {name:'3 WAY LASERS',kind:'laser',shots:[{x:0,a:0},{x:-4,a:-.13},{x:4,a:.13}],interval:.23},
    {name:'5 WAY LASERS',kind:'laser',shots:[{x:0,a:0},{x:-5,a:-.22},{x:-2,a:-.11},{x:2,a:.11},{x:5,a:.22}],interval:.27}
  ];

  const player={x:W/2,y:H*.84,r:15,targetX:W/2,targetY:H*.84,inv:0,rapid:0,weapon:0,tractor:0,captureCooldown:0};
  const audio=new(window.AudioContext||window.webkitAudioContext)();

  function tone(freq,duration=.06,type='square',volume=.03,slide=0){
    if(muted||audio.state==='suspended')return;
    try{
      const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,audio.currentTime);
      if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,freq+slide),audio.currentTime+duration);
      g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+duration);
      o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+duration);
    }catch(_){}
  }
  const vibrate=p=>{try{navigator.vibrate?.(p);}catch(_){}};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const collides=(a,b,extra=0)=>Math.hypot(a.x-b.x,a.y-b.y)<(a.r||4)+(b.r||10)+extra;
  const fmt=n=>Number(n||0).toLocaleString('it-IT');

  function seedStars(){
    while(stars.length<105)stars.push({x:Math.random()*W,y:Math.random()*H,z:Math.random()*2.3+.4,a:Math.random()*.72+.18});
    stars.length=105;
  }
  function resize(){
    const r=canvas.getBoundingClientRect();DPR=Math.min(window.devicePixelRatio||1,2);W=r.width;H=r.height;
    canvas.width=Math.floor(W*DPR);canvas.height=Math.floor(H*DPR);ctx.setTransform(DPR,0,0,DPR,0,0);
    player.y=Math.min(player.y,H-75);if(!running){player.x=player.targetX=W/2;player.y=player.targetY=H*.84;}seedStars();
  }
  function updateHud(){scoreEl.textContent=fmt(score);levelEl.textContent=level;livesEl.textContent=lives;bestEl.textContent=fmt(best);}
  function setFloatingText(text,time=1.5){floatingText=text;floatingTextT=time;}

  function resetGame(){
    clearTimeout(transitionTimer);score=0;level=1;lives=3;runTime=0;fireClock=enemyFireClock=levelClock=shake=0;
    bullets.length=enemyBullets.length=enemies.length=particles.length=powerups.length=wingmen.length=bossHazards.length=0;
    boss=null;stage=null;stagePhase='wave';hideBossHud();hideBossClear();
    player.x=player.targetX=W/2;player.y=player.targetY=H*.84;player.inv=1.5;player.rapid=0;player.weapon=0;player.tractor=0;player.captureCooldown=0;
    startWave(1,false);updateHud();
  }

  function startWave(targetLevel=level,awardIntro=true){
    level=targetLevel;levelClock=0;stagePhase='wave';boss=null;hideBossHud();
    bullets.length=0;enemyBullets.length=0;powerups.length=0;bossHazards.length=0;enemies.length=0;
    player.inv=Math.max(player.inv,1.15);
    stage=Campaign.getStage(level,W,H);
    stage.slots.forEach((slot,i)=>{
      const hpBase=slot.type===2?2:1, hp=hpBase+(level>=55&&slot.type===2?1:0);
      enemies.push({
        id:level*1000+i,type:slot.type,hp,maxHp:hp,baseX:slot.x,baseY:slot.y,x:slot.entry.startX,y:slot.entry.startY,
        phase:(i*.73+level*.19)%6.283,state:'entry',t:0,entryClock:-slot.entry.delay,entry:slot.entry,
        diveAmp:55+(i%5)*13,diveSide:(i%2?1:-1),captureT:0
      });
    });
    enemyFireClock=.8;
    if(awardIntro)setFloatingText(`LEVEL ${String(level).padStart(3,'0')} • ${stage.name}`,1.8);
    tone(430,.10,'triangle',.025,250);updateHud();
  }

  function finishWave(){
    if(stagePhase!=='wave')return;
    stagePhase='transition';running=false;score+=stage.stageBonus;updateHud();
    setFloatingText(level%10===0?'WARNING • BOSS INCOMING':`WAVE CLEAR +${fmt(stage.stageBonus)}`,1.5);
    tone(level%10===0?150:480,.16,level%10===0?'sawtooth':'triangle',.04,level%10===0?-55:360);
    transitionTimer=setTimeout(()=>{
      if(overlay.classList.contains('visible')&&startBtn.textContent.trim().toUpperCase()==='RIGIOCA')return;
      if(level%10===0)spawnBoss();else{startWave(level+1);running=true;last=performance.now();}
    },level%10===0?1050:700);
  }

  function spawnBoss(){
    stagePhase='boss';enemies.length=0;bullets.length=0;enemyBullets.length=0;powerups.length=0;bossHazards.length=0;
    const cfg=Bosses.getBoss(level);
    boss={...cfg,x:W/2,y:-100,targetY:Math.max(125,H*.19),t:0,state:'enter',attackClock:1.2,attackCount:0,aiClock:0,flash:0,shield:false,fightTime:0};
    player.inv=Math.max(player.inv,1.7);showBossHud();updateBossHud();
    setFloatingText(`⚠ BOSS ${cfg.ordinal} • ${cfg.title}`,2.1);tone(105,.4,'sawtooth',.06,70);vibrate([30,40,30,40,70]);running=true;last=performance.now();
  }

  function showBossHud(){if(bossHud)bossHud.hidden=false;}
  function hideBossHud(){if(bossHud)bossHud.hidden=true;}
  function updateBossHud(){
    if(!boss||!bossHud)return;
    bossNameEl.textContent=`BOSS ${boss.ordinal} • ${boss.title}`;
    const ratio=clamp(boss.hp/boss.maxHp,0,1);bossEnergyEl.style.transform=`scaleX(${ratio})`;bossEnergyText.textContent=`${Math.ceil(ratio*100)}%`;
    bossHud.classList.toggle('is-danger',ratio<.25);bossHud.classList.toggle('is-shielded',!!boss.shield);
  }

  function projectileVelocity(angle,speed){return{vx:Math.sin(angle)*speed,vy:-Math.cos(angle)*speed};}
  function addShot(x,y,kind,angle=0,owner='player'){
    if(kind==='fireball'){const v=projectileVelocity(angle,535);bullets.push({x,y,vx:v.vx,vy:v.vy,r:6,kind,owner,damage:2,pierce:0,hitIds:null});return;}
    if(kind==='laser'){const v=projectileVelocity(angle,920);bullets.push({x,y,vx:v.vx,vy:v.vy,r:4,kind,owner,damage:1,pierce:3,length:86,hitIds:new Set()});return;}
    const v=projectileVelocity(angle,650);bullets.push({x,y,vx:v.vx,vy:v.vy,r:3,kind:'bolt',owner,damage:1,pierce:0,hitIds:null});
  }
  function shoot(){
    const weapon=WEAPONS[player.weapon];for(const s of weapon.shots)addShot(player.x+s.x,player.y-18,weapon.kind,s.a,'player');
    for(const w of wingmen)addShot(w.x,w.y-13,'bolt',0,'wingman');
    const f=weapon.kind==='laser'?1040:weapon.kind==='fireball'?520:620+player.weapon*35;
    tone(player.rapid>0?f*1.16:f,weapon.kind==='laser'?.055:.035,weapon.kind==='fireball'?'triangle':'square',.018,weapon.kind==='laser'?-90:160);
  }

  function addEnemyBullet(x,y,vx,vy,r=4,color='#ff796f',kind='normal',extra={}){enemyBullets.push({x,y,vx,vy,r,color,kind,life:extra.life??8,turn:extra.turn??0,age:0,...extra});}
  function aimVector(x,y,speed,offset=0){const a=Math.atan2(player.y-y,player.x-x)+offset;return{vx:Math.cos(a)*speed,vy:Math.sin(a)*speed};}
  function aimedSpread(x,y,count,spread,speed,color='#ff796f'){for(let i=0;i<count;i++){const off=(i-(count-1)/2)*spread,v=aimVector(x,y,speed,off);addEnemyBullet(x,y,v.vx,v.vy,4,color);}}
  function radialBurst(x,y,count,speed,color='#ff796f',phase=0){for(let i=0;i<count;i++){const a=phase+i*Math.PI*2/count;addEnemyBullet(x,y,Math.cos(a)*speed,Math.sin(a)*speed,4,color);}}

  function bossAttack(){
    if(!boss||boss.state!=='active')return;
    boss.attackCount++;const s=220+boss.index*13+boss.cycle*18,c=boss.accent;
    switch(boss.attack){
      case 'aimed-triad': aimedSpread(boss.x,boss.y+18,3,.16,s,c);break;
      case 'fan-five': aimedSpread(boss.x,boss.y+20,5,.18,s+18,c);break;
      case 'radial': radialBurst(boss.x,boss.y,12+boss.index,s*.78,c,boss.t*.55);if(boss.attackCount%2===0)aimedSpread(boss.x,boss.y,3,.11,s+35,boss.color);break;
      case 'mines':
        for(let i=-1;i<=1;i++)addEnemyBullet(boss.x+i*28,boss.y+22,i*26,95+Math.abs(i)*18,7,c,'mine',{life:1.55+Math.random()*.55});
        if(boss.attackCount%2===0)aimedSpread(boss.x,boss.y,3,.12,s,c);break;
      case 'homing':
        for(let i=-2;i<=2;i++){const v=aimVector(boss.x+i*9,boss.y+18,s*.72,i*.08);addEnemyBullet(boss.x+i*9,boss.y+18,v.vx,v.vy,5,c,'homing',{turn:1.25,life:6});}
        break;
      case 'triple-turret':
        [-30,0,30].forEach((ox,i)=>{const v=aimVector(boss.x+ox,boss.y+15,s+25,i*.055-.055);addEnemyBullet(boss.x+ox,boss.y+15,v.vx,v.vy,4,i===1?boss.color:c);});
        if(boss.attackCount%3===0)bossHazards.push({kind:'lane',x:player.x,width:24,warmup:.62,active:.42,life:1.04,color:boss.color});break;
      case 'trail-ring': radialBurst(boss.x,boss.y,10,s*.72,c,boss.t);aimedSpread(boss.x,boss.y,2,.22,s+50,boss.color);break;
      case 'sweep-beam':
        if(boss.attackCount%2===1)bossHazards.push({kind:'sweep',x:boss.x,y:boss.y,angle:-.58,speed:.76,warmup:.72,active:1.35,life:2.07,width:13,color:boss.color});
        else aimedSpread(boss.x,boss.y,7,.13,s,c);break;
      case 'chrono-ring':
        for(let i=0;i<14;i++){const a=boss.t*.7+i*Math.PI*2/14,sp=i%2?s*.58:s*1.12;addEnemyBullet(boss.x,boss.y,Math.cos(a)*sp,Math.sin(a)*sp,4,i%2?boss.color:c);}
        if(boss.attackCount%2===0)aimedSpread(boss.x,boss.y,5,.09,s+65,'#fff');break;
      case 'omega-cycle': {
        const mode=boss.attackCount%5;
        if(mode===0)aimedSpread(boss.x,boss.y,7,.12,s+70,'#ff4f64');
        else if(mode===1)radialBurst(boss.x,boss.y,18,s*.8,'#fff',boss.t);
        else if(mode===2)for(let i=-2;i<=2;i++){const v=aimVector(boss.x,boss.y,s*.78,i*.1);addEnemyBullet(boss.x,boss.y,v.vx,v.vy,5,'#7cffb2','homing',{turn:1.1,life:5});}
        else if(mode===3)bossHazards.push({kind:'sweep',x:boss.x,y:boss.y,angle:-.65,speed:1.08,warmup:.55,active:1.2,life:1.75,width:15,color:'#ffe66d'});
        else{bossHazards.push({kind:'lane',x:player.x,width:28,warmup:.48,active:.55,life:1.03,color:'#65e7ff'});aimedSpread(boss.x,boss.y,3,.18,s+90,'#ff7bd5');}
        break;
      }
    }
    tone(150+boss.index*18,.055,'sawtooth',.016,-35);
  }

  function updateBoss(dt){
    if(!boss)return;boss.t+=dt;boss.flash=Math.max(0,boss.flash-dt);boss.fightTime+=dt;
    if(boss.state==='enter'){
      boss.y+=(boss.targetY-boss.y)*(1-Math.pow(.002,dt));boss.x=W/2+Math.sin(boss.t*2)*18;
      if(Math.abs(boss.y-boss.targetY)<3){boss.state='active';boss.t=0;boss.attackClock=.8;}
      return;
    }
    const span=Math.max(35,W/2-boss.r-14),center=W/2;
    switch(boss.ai){
      case 'patrol': boss.x=center+Math.sin(boss.t*boss.speed)*span*.72;boss.y=boss.targetY+Math.sin(boss.t*1.7)*13;break;
      case 'zigzag': boss.x=center+Math.sin(boss.t*1.7*boss.speed)*span*.85;boss.y=boss.targetY+Math.sin(boss.t*3.1)*24;break;
      case 'blink': boss.aiClock-=dt;if(boss.aiClock<=0){boss.x=clamp(45+Math.random()*(W-90),boss.r,W-boss.r);boss.y=boss.targetY+Math.random()*70-20;boss.aiClock=1.45;burst(boss.x,boss.y,boss.color,14,130);}break;
      case 'dash': boss.x=center+Math.sin(boss.t*.78)*span*.86+Math.sin(boss.t*3.1)*34;boss.y=boss.targetY+Math.abs(Math.sin(boss.t*.9))*62;break;
      case 'orbit': boss.x=center+Math.cos(boss.t*.82)*span*.64;boss.y=boss.targetY+38+Math.sin(boss.t*.82)*42;break;
      case 'anchor': boss.x+=(center-boss.x)*(1-Math.pow(.02,dt));boss.y=boss.targetY+Math.sin(boss.t*1.1)*10;break;
      case 'serpent': boss.x=center+Math.sin(boss.t*1.25)*span*.87;boss.y=boss.targetY+36+Math.sin(boss.t*2.5+1.2)*48;break;
      case 'shield': boss.x=center+Math.sin(boss.t*.65)*span*.68;boss.y=boss.targetY+Math.cos(boss.t*1.3)*20;boss.shield=Math.sin(boss.t*1.18)>0.72;break;
      case 'phase': boss.aiClock-=dt;if(boss.aiClock<=0){boss.x=clamp(center+(Math.random()-.5)*span*1.5,boss.r,W-boss.r);boss.y=boss.targetY+Math.random()*55;boss.aiClock=.95+Math.random()*.45;}break;
      case 'omega': boss.x=center+Math.sin(boss.t*1.21)*span*.78+Math.sin(boss.t*3.7)*24;boss.y=boss.targetY+32+Math.cos(boss.t*1.67)*44;boss.shield=false;break;
    }
    boss.attackClock-=dt;
    if(boss.attackClock<=0){bossAttack();boss.attackClock=Math.max(.34,(1.18-boss.index*.045)/(boss.attackScale||1))*(.83+Math.random()*.3);}
    updateBossHud();
  }

  function pointSegmentDistance(px,py,x1,y1,x2,y2){const vx=x2-x1,vy=y2-y1,wx=px-x1,wy=py-y1,vv=vx*vx+vy*vy||1,t=clamp((wx*vx+wy*vy)/vv,0,1);return Math.hypot(px-(x1+vx*t),py-(y1+vy*t));}
  function updateBossHazards(dt){
    for(let i=bossHazards.length-1;i>=0;i--){
      const h=bossHazards[i];h.life-=dt;h.warmup=Math.max(0,h.warmup-dt);if(h.kind==='sweep'&&h.warmup<=0)h.angle+=h.speed*dt;
      if(h.life<=0){bossHazards.splice(i,1);continue;}if(h.warmup>0)continue;
      if(h.kind==='lane'){if(Math.abs(player.x-h.x)<h.width+player.r)hitPlayer();}
      else{const len=H*1.25,x2=h.x+Math.sin(h.angle)*len,y2=h.y+Math.cos(h.angle)*len;if(pointSegmentDistance(player.x,player.y,h.x,h.y,x2,y2)<h.width+player.r*.7)hitPlayer();}
    }
  }
  function hitBoss(damage,x,y){if(!boss||boss.state!=='active'||boss.shield)return false;boss.hp=Math.max(0,boss.hp-damage);boss.flash=.07;shake=Math.max(shake,damage>1?4:2);burst(x,y,boss.accent,damage>1?8:4,90);updateBossHud();if(boss.hp<=0)defeatBoss();return true;}
  function projectileHitsBoss(b){if(!boss)return false;if(b.kind!=='laser')return collides(b,boss,2);const speed=Math.hypot(b.vx,b.vy)||1,ux=b.vx/speed,uy=b.vy/speed;return pointSegmentDistance(boss.x,boss.y,b.x,b.y,b.x-ux*b.length,b.y-uy*b.length)<boss.r+3;}

  function defeatBoss(){
    if(!boss||stagePhase!=='boss')return;stagePhase='boss-clear';running=false;
    const defeated={...boss};score+=5000*defeated.ordinal+Math.round(defeated.maxHp*2);best=Math.max(best,score);localStorage.setItem('starSwarmBest',String(best));
    bullets.length=enemyBullets.length=powerups.length=bossHazards.length=0;hideBossHud();updateHud();
    burst(defeated.x,defeated.y,defeated.color,70,330);shake=18;tone(90,.28,'sawtooth',.065,650);setTimeout(()=>tone(740,.3,'triangle',.045,500),180);vibrate([40,35,60,40,100]);showBossClear(defeated);
  }

  const clearPhrases=['SECTOR CLEAN! KEEP FIRING!','PERFECT HIT! THE CABINET IS SHAKING!','NO MERCY IN DEEP SPACE!','ONE MORE COIN? NOT TODAY!','HIGH VOLTAGE VICTORY!','THE SWARM IS RETREATING!','HYPER DRIVE ENGAGED!','ARCADE PILOT STATUS: ELITE!','THE VOID BLINKED FIRST!','100% PURE CABINET POWER!'];
  function showBossClear(defeated){
    if(!bossClear)return;const campaignDone=level===100;
    bossClearTitle.textContent=campaignDone?'CAMPAGNA COMPLETATA!!':`BOSS N. ${defeated.ordinal} SCONFITTO!!`;
    bossClearName.textContent=`${defeated.title} // ${defeated.tagline}`;
    bossClearStats.innerHTML=`<span>PUNTI <b>${fmt(score)}</b></span><span>VITE <b>${lives}</b></span><span>ARMA <b>${WEAPONS[player.weapon].name}</b></span><span>WINGMEN <b>${wingmen.length}/2</b></span><span>BOSS TIME <b>${defeated.fightTime.toFixed(1)}s</b></span>`;
    bossClearPhrase.textContent=campaignDone?'OMEGA SWARM ANNIHILATO • OVERDRIVE SBLOCCATO!':clearPhrases[defeated.index%clearPhrases.length];
    bossClear.hidden=false;bossClear.classList.remove('is-visible');requestAnimationFrame(()=>requestAnimationFrame(()=>bossClear.classList.add('is-visible')));
  }
  function hideBossClear(){if(bossClear){bossClear.hidden=true;bossClear.classList.remove('is-visible');}}
  function resumeAfterBoss(){if(!bossClear||bossClear.hidden)return;hideBossClear();boss=null;level++;startWave(level);running=true;last=performance.now();}
  bossClear?.addEventListener('pointerdown',e=>{e.preventDefault();resumeAfterBoss();},{passive:false});

  function burst(x,y,color,count=12,speed=160){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=Math.random()*speed;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.35+Math.random()*.55,max:.9,color,size:1+Math.random()*3});}}
  function hitPlayer(){if(player.inv>0||stagePhase==='boss-clear')return;lives--;player.inv=2.2;player.tractor=0;shake=10;for(const e of enemies)if(e.state==='capturing'){e.state='return';e.t=0;e.captureT=0;}burst(player.x,player.y,'#65e7ff',28,260);tone(90,.22,'sawtooth',.06,-50);updateHud();vibrate([30,30,50]);if(lives<=0)endGame();}
  function destroyWingman(index){const w=wingmen[index];if(!w)return;burst(w.x,w.y,'#7cffb2',20,220);tone(125,.14,'sawtooth',.035,-60);wingmen.splice(index,1);}
  function endGame(){running=false;paused=false;clearTimeout(transitionTimer);best=Math.max(best,score);localStorage.setItem('starSwarmBest',String(best));updateHud();overlayText.innerHTML=`Missione terminata.<br>Punteggio <strong>${fmt(score)}</strong> • livello ${level}.`;startBtn.textContent='RIGIOCA';overlay.classList.add('visible');}

  function dropPowerup(e){const chance=e.type===2?.15:.085;if(Math.random()>=chance)return;const roll=Math.random(),type=roll<.32?'rapid':roll<.78?'weapon':'tractor';powerups.push({x:e.x,y:e.y,vy:92,r:10,type,spin:0,pulse:Math.random()*6.28});}
  function applyPowerup(p){
    if(p.type==='rapid'){player.rapid=Math.max(player.rapid,6);score+=100;burst(p.x,p.y,'#ffe66d',12,120);tone(700,.18,'triangle',.04,500);}
    else if(p.type==='weapon'){if(player.weapon<WEAPONS.length-1){player.weapon++;score+=180+player.weapon*40;}else score+=500;burst(p.x,p.y,'#ff4f64',18,160);tone(430,.12,'square',.04,780);setFloatingText(`WEAPON ${WEAPONS[player.weapon].name}`);}
    else{if(wingmen.length<2){player.tractor=Math.max(player.tractor,7.5);player.captureCooldown=0;score+=150;setFloatingText('TRACTOR BEAM!');}else{score+=350;setFloatingText('WINGMEN MAX +350');}burst(p.x,p.y,'#7cff88',18,150);tone(330,.18,'triangle',.045,660);}
    updateHud();
  }
  function acquireCaptureTarget(){if(stagePhase!=='wave'||player.tractor<=0||wingmen.length>=2||player.captureCooldown>0||enemies.some(e=>e.hp>0&&e.state==='capturing'))return;const candidates=enemies.filter(e=>e.hp>0&&['formation','dive','return'].includes(e.state)&&e.y<player.y-70);if(!candidates.length)return;candidates.sort((a,b)=>(Math.abs(a.x-player.x)*1.5+Math.abs(player.y-70-a.y)*.18)-(Math.abs(b.x-player.x)*1.5+Math.abs(player.y-70-b.y)*.18));const e=candidates[0];e.state='capturing';e.captureT=0;e.t=0;tone(245,.11,'sine',.025,180);}
  function completeCapture(e){e.hp=0;e.state='captured';const side=wingmen.length===0?-1:1;wingmen.push({x:player.x+side*31,y:player.y+5,targetX:player.x+side*31,targetY:player.y+5,r:11,type:e.type,phase:Math.random()*6.2});player.captureCooldown=.42;score+=300+e.type*120;burst(e.x,e.y,'#7cff88',24,190);tone(520,.15,'triangle',.045,720);vibrate([16,22,16]);setFloatingText(`WINGMAN ${wingmen.length}/2`);updateHud();}
  function updateWingmen(dt){const offsets=wingmen.length===1?[-31]:[-31,31];wingmen.forEach((w,i)=>{w.targetX=clamp(player.x+(offsets[i]||31),14,W-14);w.targetY=player.y+6;const f=1-Math.pow(.00015,dt);w.x+=(w.targetX-w.x)*f;w.y+=(w.targetY-w.y)*f;w.phase+=dt*5;});}

  function updateEnemies(dt){
    let alive=0;
    for(const e of enemies){
      if(e.hp<=0)continue;alive++;e.t+=dt;
      if(e.state==='entry'){e.entryClock+=dt;const p=Campaign.entryPosition(e,e.entryClock,W,H);e.x=p.x;e.y=p.y;if(p.done){e.state='formation';e.t=0;}}
      else if(e.state==='formation'){e.x=e.baseX+Math.sin(levelClock*1.35+e.phase)*stage.drift;e.y=e.baseY+Math.sin(levelClock*1.9+e.phase)*3.5;if(Math.random()<dt*stage.diveRate&&e.y<H*.45){e.state='dive';e.t=0;e.diveSide=Math.random()<.5?-1:1;e.diveAmp=55+Math.random()*95;}}
      else if(e.state==='dive'){e.y+=stage.enemySpeed*dt;e.x+=Math.sin(e.t*(3.1+(level%5)*.18))*e.diveAmp*dt*e.diveSide;let rammed=false;for(let wi=wingmen.length-1;wi>=0;wi--)if(collides(e,wingmen[wi],2)){destroyWingman(wi);e.hp=0;burst(e.x,e.y,'#ff5ecf',16,190);rammed=true;break;}if(!rammed&&collides(e,player,2)){e.hp=0;hitPlayer();burst(e.x,e.y,'#ff5ecf',16,190);}if(e.hp>0&&e.y>H+40){e.y=-30;e.x=e.baseX;e.state='return';}}
      else if(e.state==='return'){const f=1-Math.pow(.02,dt);e.x+=(e.baseX-e.x)*f;e.y+=(e.baseY-e.y)*f;if(Math.abs(e.y-e.baseY)<4){e.state='formation';e.t=0;}}
      else if(e.state==='capturing'){e.captureT+=dt;const captureY=player.y-47,pull=1-Math.pow(.002,dt);e.x+=(player.x-e.x)*pull;e.y+=(captureY-e.y)*pull;if(player.tractor<=0){e.state='return';e.t=0;e.captureT=0;}else if(Math.hypot(e.x-player.x,e.y-captureY)<9||e.captureT>1.45)completeCapture(e);}
    }
    return alive;
  }

  function enemyShoot(e){const dx=player.x-e.x,dy=player.y-e.y,d=Math.hypot(dx,dy)||1,sp=220+Math.min(280,level*3.2);addEnemyBullet(e.x,e.y+10,dx/d*sp*.46,Math.max(120,dy/d*sp),4,e.type===2?'#ffe66d':'#ff796f');}
  function projectileHitsEnemy(b,e){const er=e.type===2?15:12;if(b.kind!=='laser')return collides(b,{x:e.x,y:e.y,r:er},0);const speed=Math.hypot(b.vx,b.vy)||1,ux=b.vx/speed,uy=b.vy/speed;return pointSegmentDistance(e.x,e.y,b.x,b.y,b.x-ux*b.length,b.y-uy*b.length)<er+3;}

  function updateEnemyBullets(dt){
    for(let i=enemyBullets.length-1;i>=0;i--){
      const b=enemyBullets[i];b.age+=dt;b.life-=dt;
      if(b.kind==='homing'&&b.turn>0&&b.age<2.2){const sp=Math.hypot(b.vx,b.vy)||1,target=aimVector(b.x,b.y,sp),f=clamp(b.turn*dt,0,.12);b.vx+=(target.vx-b.vx)*f;b.vy+=(target.vy-b.vy)*f;}
      b.x+=b.vx*dt;b.y+=b.vy*dt;
      if(b.kind==='mine'&&b.life<=0){const x=b.x,y=b.y,c=b.color;enemyBullets.splice(i,1);radialBurst(x,y,8,155+level*1.1,c,b.age);tone(125,.06,'square',.018,80);continue;}
      if(b.life<=0||b.y>H+60||b.y<-80||b.x<-80||b.x>W+80){enemyBullets.splice(i,1);continue;}
      let hitWing=-1;for(let wi=0;wi<wingmen.length;wi++)if(collides(b,wingmen[wi],0)){hitWing=wi;break;}
      if(hitWing>=0){enemyBullets.splice(i,1);destroyWingman(hitWing);continue;}if(collides(b,player,0)){enemyBullets.splice(i,1);hitPlayer();}
    }
  }

  function updateProjectiles(dt){
    for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];b.x+=b.vx*dt;b.y+=b.vy*dt;if(b.y<-130||b.y>H+50||b.x<-110||b.x>W+110)bullets.splice(i,1);}
    for(let bi=bullets.length-1;bi>=0;bi--){
      const b=bullets[bi];let remove=false;
      if(stagePhase==='boss'&&boss&&projectileHitsBoss(b)){const hit=hitBoss(b.damage,b.x,b.y);remove=true;if(!hit&&boss?.shield){burst(b.x,b.y,boss.color,4,70);tone(980,.025,'square',.008,-120);}}
      else if(stagePhase==='wave'){
        for(const e of enemies){
          if(e.hp<=0||e.state==='capturing'||b.hitIds?.has(e.id)||!projectileHitsEnemy(b,e))continue;
          if(b.hitIds)b.hitIds.add(e.id);e.hp-=b.damage;shake=b.kind==='fireball'?4:2;burst(b.x,b.y,e.type===2?'#ffe66d':e.type===1?'#ff5ecf':'#65e7ff',e.hp<=0?16:7,e.hp<=0?180:100);
          if(e.hp<=0){score+=[100,160,260][e.type]*(e.state==='dive'?2:1);dropPowerup(e);tone(e.type===2?260:330,.07,'square',.025,e.type===2?-100:120);updateHud();}
          if(b.kind==='laser'&&b.pierce>0){b.pierce--;if(b.pierce<=0)remove=true;}else remove=true;if(remove)break;
        }
      }
      if(remove&&bullets[bi]===b)bullets.splice(bi,1);
    }
  }

  function update(dt){
    if(!running||paused||stagePhase==='boss-clear')return;
    runTime+=dt;levelClock+=dt;player.inv=Math.max(0,player.inv-dt);player.rapid=Math.max(0,player.rapid-dt);player.tractor=Math.max(0,player.tractor-dt);player.captureCooldown=Math.max(0,player.captureCooldown-dt);floatingTextT=Math.max(0,floatingTextT-dt);
    for(const s of stars){s.y+=(18+s.z*24)*dt;if(s.y>H){s.y=-2;s.x=Math.random()*W;}}
    const follow=1-Math.pow(.0008,dt);player.x+=(player.targetX-player.x)*follow;player.y+=(player.targetY-player.y)*follow;player.x=clamp(player.x,22,W-22);player.y=clamp(player.y,H*.5,H-54);updateWingmen(dt);
    if(stagePhase==='wave')acquireCaptureTarget();
    fireClock-=dt;if(fireClock<=0){shoot();const base=WEAPONS[player.weapon].interval;fireClock=player.rapid>0?Math.max(.075,base*.47):base;}
    updateProjectiles(dt);updateEnemyBullets(dt);if(stagePhase==='boss'){updateBoss(dt);updateBossHazards(dt);}
    if(stagePhase==='wave'){
      const alive=updateEnemies(dt);enemyFireClock-=dt;
      if(enemyFireClock<=0){const candidates=enemies.filter(e=>e.hp>0&&(e.state==='formation'||e.state==='dive'));if(candidates.length)enemyShoot(candidates[Math.floor(Math.random()*candidates.length)]);enemyFireClock=stage.fireGap*(.72+Math.random()*.58);}
      if(alive===0)finishWave();
    }
    for(let i=powerups.length-1;i>=0;i--){const p=powerups[i];p.y+=p.vy*dt;p.spin+=dt*5;p.pulse+=dt*5;if(p.y>H+20)powerups.splice(i,1);else if(collides(p,player,4)){applyPowerup(p);powerups.splice(i,1);}}
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.05,dt);p.vy*=Math.pow(.05,dt);p.life-=dt;if(p.life<=0)particles.splice(i,1);}shake*=Math.pow(.03,dt);
  }

  function polygon(points,fill,stroke=null){ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
  function drawPlayerShip(x,y,scale=1,accent='#65e7ff',engine='#ff5ecf'){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.shadowBlur=18;ctx.shadowColor=accent;polygon([[0,-19],[-14,13],[-6,9],[-3,17],[3,17],[6,9],[14,13]],'#eafcff',accent);polygon([[0,-10],[-5,9],[5,9]],accent);ctx.shadowBlur=12;ctx.shadowColor=engine;ctx.fillStyle=engine;ctx.fillRect(-3,17,6,8+Math.random()*8);ctx.restore();}
  function drawPlayer(){if(player.inv>0&&Math.floor(player.inv*12)%2===0)return;drawPlayerShip(player.x,player.y);}
  function drawWingman(w){const accent=w.type===2?'#ffe66d':w.type===1?'#ff8bdc':'#7cffb2';ctx.save();ctx.translate(w.x,w.y+Math.sin(w.phase)*1.2);ctx.scale(.72,.72);ctx.shadowBlur=12;ctx.shadowColor=accent;polygon([[0,-15],[-12,8],[-5,6],[-2,13],[2,13],[5,6],[12,8]],'#dfffe9',accent);polygon([[0,-8],[-4,6],[4,6]],accent);ctx.fillStyle='#7cff88';ctx.fillRect(-2,13,4,8+Math.random()*5);ctx.restore();}
  function drawEnemy(e){
    if(e.hp<=0)return;ctx.save();ctx.translate(e.x,e.y);ctx.translate(0,Math.sin(e.t*7+e.phase)*1.5);if(e.state==='capturing'){ctx.globalAlpha=.68+.3*Math.sin(e.captureT*14);ctx.scale(.92,.92);}
    if(e.type===0){ctx.shadowBlur=10;ctx.shadowColor='#65e7ff';polygon([[0,-10],[-13,-2],[-9,10],[0,5],[9,10],[13,-2]],'#65e7ff');ctx.fillStyle='#071127';ctx.fillRect(-3,-4,6,7);}
    else if(e.type===1){ctx.shadowBlur=12;ctx.shadowColor='#ff5ecf';polygon([[0,-13],[-14,-5],[-10,10],[-3,6],[0,13],[3,6],[10,10],[14,-5]],'#ff5ecf');ctx.fillStyle='#ffe66d';ctx.fillRect(-3,-5,6,6);}
    else{ctx.shadowBlur=14;ctx.shadowColor='#ffe66d';polygon([[0,-15],[-15,-5],[-11,11],[0,6],[11,11],[15,-5]],'#ffe66d');ctx.fillStyle=e.hp>1?'#ff5ecf':'#ff9f43';ctx.beginPath();ctx.arc(0,-3,5,0,Math.PI*2);ctx.fill();}ctx.restore();
  }
  function drawPowerup(p){
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.spin);
    if(p.type==='rapid'){ctx.shadowBlur=16;ctx.shadowColor='#ffe66d';ctx.strokeStyle='#ffe66d';ctx.lineWidth=2;ctx.strokeRect(-8,-8,16,16);ctx.fillStyle='#fff';ctx.fillRect(-2,-6,4,12);}
    else if(p.type==='weapon'){ctx.shadowBlur=18;ctx.shadowColor='#ff4f64';polygon([[0,-11],[11,0],[0,11],[-11,0]],'#ff4f64','#ffd0d5');ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(4,2);ctx.lineTo(1,2);ctx.lineTo(1,7);ctx.lineTo(-1,7);ctx.lineTo(-1,2);ctx.lineTo(-4,2);ctx.closePath();ctx.fill();}
    else{ctx.shadowBlur=18;ctx.shadowColor='#7cff88';ctx.strokeStyle='#7cff88';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(0,0,9,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(-7,-3);ctx.lineTo(-2,0);ctx.lineTo(-7,3);ctx.moveTo(7,-3);ctx.lineTo(2,0);ctx.lineTo(7,3);ctx.stroke();ctx.fillStyle='#eaffee';ctx.beginPath();ctx.arc(0,0,2.5,0,Math.PI*2);ctx.fill();}ctx.restore();
  }
  function drawTractorBeam(){if(player.tractor<=0||wingmen.length>=2||stagePhase!=='wave')return;const pulse=.16+.08*Math.sin(levelClock*8),topY=Math.max(55,player.y-H*.62),halfTop=44+18*Math.sin(levelClock*2.2),grad=ctx.createLinearGradient(0,topY,0,player.y);grad.addColorStop(0,'rgba(124,255,136,0)');grad.addColorStop(.72,`rgba(124,255,136,${pulse})`);grad.addColorStop(1,'rgba(210,255,218,.06)');ctx.save();ctx.globalCompositeOperation='screen';ctx.fillStyle=grad;ctx.beginPath();ctx.moveTo(player.x-halfTop,topY);ctx.lineTo(player.x+halfTop,topY);ctx.lineTo(player.x+16,player.y-17);ctx.lineTo(player.x-16,player.y-17);ctx.closePath();ctx.fill();ctx.strokeStyle='rgba(124,255,136,.38)';ctx.lineWidth=1;ctx.setLineDash([5,7]);ctx.stroke();ctx.restore();}
  function drawProjectile(b){if(b.kind==='fireball'){ctx.save();ctx.shadowBlur=16;ctx.shadowColor='#ff9c3d';ctx.fillStyle='#fff2a6';ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ff5b2d';ctx.beginPath();ctx.arc(b.x,b.y,3,0,Math.PI*2);ctx.fill();ctx.restore();return;}if(b.kind==='laser'){const sp=Math.hypot(b.vx,b.vy)||1,ux=b.vx/sp,uy=b.vy/sp;ctx.save();ctx.shadowBlur=12;ctx.shadowColor='#8efcff';ctx.strokeStyle='#dfffff';ctx.lineWidth=3.5;ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.x-ux*b.length,b.y-uy*b.length);ctx.stroke();ctx.strokeStyle='#65e7ff';ctx.lineWidth=1.2;ctx.stroke();ctx.restore();return;}ctx.save();ctx.fillStyle=b.owner==='wingman'?'#b6ffd0':'#bdf7ff';ctx.shadowBlur=10;ctx.shadowColor=b.owner==='wingman'?'#7cff88':'#65e7ff';ctx.translate(b.x,b.y);ctx.rotate(Math.atan2(b.vy,b.vx)+Math.PI/2);ctx.fillRect(-2,-9,4,14);ctx.restore();}

  function drawBoss(){
    if(!boss)return;const b=boss,s=b.r/50;ctx.save();ctx.translate(b.x,b.y);ctx.scale(s,s);if(b.flash>0){ctx.globalCompositeOperation='screen';ctx.globalAlpha=.7;}ctx.shadowBlur=26;ctx.shadowColor=b.color;
    switch(b.shape){
      case 'core': polygon([[0,-42],[-36,-18],[-44,18],[-18,38],[0,26],[18,38],[44,18],[36,-18]],b.color,b.accent);ctx.fillStyle=b.accent;ctx.beginPath();ctx.arc(0,0,15,0,Math.PI*2);ctx.fill();break;
      case 'fang': polygon([[-8,-40],[-45,-12],[-28,34],[-4,18],[0,40],[5,18],[30,34],[45,-12],[8,-40]],b.color,b.accent);ctx.fillStyle=b.accent;ctx.fillRect(-18,-6,36,12);break;
      case 'eye': ctx.fillStyle=b.color;ctx.beginPath();ctx.ellipse(0,0,46,30,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#071127';ctx.beginPath();ctx.arc(0,0,19,0,Math.PI*2);ctx.fill();ctx.fillStyle=b.accent;ctx.beginPath();ctx.arc(0,0,9,0,Math.PI*2);ctx.fill();break;
      case 'manta': polygon([[0,-30],[-48,-18],[-34,25],[-10,12],[0,40],[10,12],[34,25],[48,-18]],b.color,b.accent);ctx.fillStyle=b.accent;ctx.fillRect(-5,-22,10,28);break;
      case 'queen': polygon([[0,-45],[-18,-24],[-45,-10],[-28,12],[-38,35],[-8,26],[0,43],[8,26],[38,35],[28,12],[45,-10],[18,-24]],b.color,b.accent);ctx.fillStyle=b.accent;ctx.beginPath();ctx.arc(0,-4,12,0,Math.PI*2);ctx.fill();break;
      case 'hydra': polygon([[0,-35],[-18,-18],[-42,-28],[-34,4],[-50,24],[-18,22],[0,42],[18,22],[50,24],[34,4],[42,-28],[18,-18]],b.color,b.accent);[-28,0,28].forEach(x=>{ctx.fillStyle=b.accent;ctx.beginPath();ctx.arc(x,-8,7,0,Math.PI*2);ctx.fill();});break;
      case 'serpent': for(let i=0;i<6;i++){ctx.fillStyle=i%2?b.accent:b.color;ctx.beginPath();ctx.ellipse((i-2.5)*13,Math.sin(i*1.4+b.t*3)*10,14,19,0,0,Math.PI*2);ctx.fill();}break;
      case 'forge': polygon([[0,-44],[-36,-34],[-49,0],[-34,36],[0,46],[34,36],[49,0],[36,-34]],b.color,b.accent);ctx.strokeStyle=b.accent;ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,24,0,Math.PI*2);ctx.stroke();if(b.shield){ctx.strokeStyle='rgba(101,231,255,.8)';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,55,0,Math.PI*2);ctx.stroke();}break;
      case 'chrono': ctx.strokeStyle=b.color;ctx.lineWidth=9;ctx.beginPath();ctx.arc(0,0,38,0,Math.PI*2);ctx.stroke();ctx.save();ctx.rotate(b.t*1.5);ctx.strokeStyle=b.accent;ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,25,0,Math.PI*1.55);ctx.stroke();ctx.restore();ctx.fillStyle='#fff';ctx.fillRect(-4,-32,8,64);break;
      case 'omega': polygon([[0,-50],[-20,-34],[-49,-38],[-36,-8],[-52,18],[-24,22],[-16,46],[0,30],[16,46],[24,22],[52,18],[36,-8],[49,-38],[20,-34]],b.color,b.accent);ctx.fillStyle=b.accent;ctx.beginPath();ctx.arc(0,-2,18,0,Math.PI*2);ctx.fill();ctx.fillStyle='#071127';ctx.beginPath();ctx.arc(0,-2,8,0,Math.PI*2);ctx.fill();break;
    }ctx.restore();
  }
  function drawEnemyBullet(b){ctx.save();ctx.shadowBlur=b.kind==='homing'?14:8;ctx.shadowColor=b.color;ctx.fillStyle=b.color;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();if(b.kind==='mine'){ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();}ctx.restore();}
  function drawBossHazards(){for(const h of bossHazards){const active=h.warmup<=0,alpha=active?.52:.18;ctx.save();ctx.globalCompositeOperation='screen';ctx.strokeStyle=h.color;ctx.fillStyle=h.color;ctx.globalAlpha=alpha;if(h.kind==='lane'){ctx.fillRect(h.x-h.width,0,h.width*2,H);ctx.globalAlpha=.7;ctx.fillRect(h.x-1,0,2,H);}else{const len=H*1.3,x2=h.x+Math.sin(h.angle)*len,y2=h.y+Math.cos(h.angle)*len;ctx.lineWidth=active?h.width*2:2;ctx.beginPath();ctx.moveTo(h.x,h.y);ctx.lineTo(x2,y2);ctx.stroke();}ctx.restore();}}

  function draw(){
    ctx.clearRect(0,0,W,H);ctx.save();if(shake>0)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
    const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#07142f');g.addColorStop(.5,'#030916');g.addColorStop(1,'#01030a');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    for(const s of stars){ctx.globalAlpha=s.a;ctx.fillStyle='#d9f8ff';ctx.fillRect(s.x,s.y,s.z>1.5?2:1,s.z>1.5?2:1);}ctx.globalAlpha=1;
    drawTractorBeam();drawBossHazards();for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);}ctx.globalAlpha=1;
    for(const e of enemies)drawEnemy(e);drawBoss();for(const b of bullets)drawProjectile(b);for(const b of enemyBullets)drawEnemyBullet(b);for(const p of powerups)drawPowerup(p);for(const w of wingmen)drawWingman(w);drawPlayer();
    ctx.textAlign='center';ctx.font='bold 9px monospace';const status=[];if(player.rapid>0)status.push(`RAPID ${player.rapid.toFixed(1)}s`);if(player.tractor>0&&wingmen.length<2)status.push(`TRACTOR ${player.tractor.toFixed(1)}s`);status.push(WEAPONS[player.weapon].name);if(wingmen.length)status.push(`WINGMEN ${wingmen.length}/2`);
    ctx.fillStyle='rgba(210,245,255,.88)';ctx.shadowBlur=6;ctx.shadowColor='#65e7ff';ctx.fillText(status.join('  •  '),W/2,H-18);
    if(floatingTextT>0){ctx.globalAlpha=Math.min(1,floatingTextT*2);ctx.font='bold 13px monospace';ctx.fillStyle='#fff';ctx.shadowBlur=14;ctx.shadowColor='#ff5ecf';ctx.fillText(floatingText,W/2,H*.46-floatingTextT*8);ctx.globalAlpha=1;}ctx.restore();
  }

  function loop(t){const dt=Math.min(.033,(t-last)/1000||0);last=t;update(dt);draw();requestAnimationFrame(loop);}
  function setPointer(clientX,clientY){const r=canvas.getBoundingClientRect();player.targetX=clientX-r.left;player.targetY=clientY-r.top-22;}
  canvas.addEventListener('pointerdown',e=>{pointerActive=true;canvas.setPointerCapture?.(e.pointerId);setPointer(e.clientX,e.clientY);if(audio.state==='suspended')audio.resume();});
  canvas.addEventListener('pointermove',e=>{if(pointerActive)setPointer(e.clientX,e.clientY);});canvas.addEventListener('pointerup',()=>pointerActive=false);canvas.addEventListener('pointercancel',()=>pointerActive=false);

  startBtn.addEventListener('click',()=>{
    if(audio.state==='suspended')audio.resume();
    if(running&&paused){paused=false;overlay.classList.remove('visible');pauseBtn.textContent='Ⅱ';last=performance.now();return;}
    overlay.classList.remove('visible');resetGame();running=true;paused=false;pauseBtn.textContent='Ⅱ';last=performance.now();
  });
  pauseBtn.addEventListener('click',()=>{if(!running||stagePhase==='boss-clear')return;paused=!paused;pauseBtn.textContent=paused?'▶':'Ⅱ';overlay.classList.toggle('visible',paused);if(paused){overlayText.textContent='Partita in pausa.';startBtn.textContent='RIPRENDI';}else overlay.classList.remove('visible');});
  muteBtn.addEventListener('click',()=>{muted=!muted;muteBtn.textContent=muted?'🔇':'🔊';});
  window.addEventListener('rwg:continue-game',e=>{score=Math.max(0,Math.floor(e.detail?.score??score));lives=1;running=true;paused=false;clearTimeout(transitionTimer);bullets.length=0;enemyBullets.length=0;bossHazards.length=0;player.x=player.targetX=W/2;player.y=player.targetY=H*.84;player.inv=3;player.rapid=Math.max(player.rapid,1.5);player.tractor=0;for(const en of enemies)if(en.hp>0&&en.state==='capturing'){en.state='return';en.t=0;en.captureT=0;}overlay.classList.remove('visible');startBtn.textContent='RIGIOCA';pauseBtn.textContent='Ⅱ';last=performance.now();updateHud();tone(520,.16,'triangle',.035,900);});
  window.addEventListener('resize',resize);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&running&&!paused&&stagePhase!=='boss-clear'){paused=true;overlayText.textContent='Partita in pausa.';startBtn.textContent='RIPRENDI';overlay.classList.add('visible');pauseBtn.textContent='▶';}});

  bestEl.textContent=fmt(best);resize();requestAnimationFrame(loop);
})();