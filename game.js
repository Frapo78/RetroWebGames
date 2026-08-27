(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const levelEl = document.getElementById('level');
  const livesEl = document.getElementById('lives');
  const bestEl = document.getElementById('best');
  const overlay = document.getElementById('overlay');
  const overlayText = document.getElementById('overlayText');
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const muteBtn = document.getElementById('muteBtn');

  let W = 390, H = 844, DPR = 1;
  let running = false, paused = false, muted = false;
  let last = 0, score = 0, level = 1, lives = 3;
  let best = Number(localStorage.getItem('starSwarmBest') || 0);
  let fireClock = 0, enemyFireClock = 0, levelClock = 0, shake = 0;
  let pointerActive = false;

  const bullets = [], enemyBullets = [], enemies = [], particles = [], stars = [], powerups = [], wingmen = [];

  const WEAPONS = [
    { name: 'SINGLE FIRE', kind: 'bolt', shots: [{x:0,a:0}], interval: .19 },
    { name: 'DOUBLE FIRE', kind: 'bolt', shots: [{x:-7,a:0},{x:7,a:0}], interval: .19 },
    { name: 'TRIPLE DIAGONAL', kind: 'bolt', shots: [{x:0,a:0},{x:-5,a:-.16},{x:5,a:.16}], interval: .20 },
    { name: '4 FIRE LINEAR', kind: 'bolt', shots: [{x:-13,a:0},{x:-4,a:0},{x:4,a:0},{x:13,a:0}], interval: .21 },
    { name: 'FIREBALLS 3 WAY', kind: 'fireball', shots: [{x:0,a:0},{x:-4,a:-.23},{x:4,a:.23}], interval: .24 },
    { name: 'LASER', kind: 'laser', shots: [{x:0,a:0}], interval: .20 },
    { name: '3 WAY LASERS', kind: 'laser', shots: [{x:0,a:0},{x:-4,a:-.13},{x:4,a:.13}], interval: .23 },
    { name: '5 WAY LASERS', kind: 'laser', shots: [{x:0,a:0},{x:-5,a:-.22},{x:-2,a:-.11},{x:2,a:.11},{x:5,a:.22}], interval: .27 }
  ];

  const player = {
    x: W/2, y: H*.84, r: 15, targetX: W/2, targetY: H*.84,
    inv: 0, rapid: 0, weapon: 0, tractor: 0, captureCooldown: 0
  };

  const audio = new (window.AudioContext || window.webkitAudioContext)();
  function tone(freq, duration=.06, type='square', volume=.03, slide=0) {
    if (muted || audio.state === 'suspended') return;
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, audio.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), audio.currentTime + duration);
    g.gain.setValueAtTime(volume, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + duration);
    o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + duration);
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    player.y = Math.min(player.y, H - 75);
    if (!running) { player.x = W/2; player.y = H*.84; player.targetX = player.x; player.targetY = player.y; }
    seedStars();
  }

  function seedStars() {
    while (stars.length < 80) stars.push({ x: Math.random()*W, y: Math.random()*H, z: Math.random()*2+0.5, a: Math.random()*.7+.2 });
    stars.length = 80;
  }

  function resetGame() {
    score = 0; level = 1; lives = 3; fireClock = enemyFireClock = levelClock = 0; shake = 0;
    bullets.length = enemyBullets.length = enemies.length = particles.length = powerups.length = wingmen.length = 0;
    player.x = player.targetX = W/2; player.y = player.targetY = H*.84;
    player.inv = 1.5; player.rapid = 0; player.weapon = 0; player.tractor = 0; player.captureCooldown = 0;
    spawnFormation(); updateHud();
  }

  function spawnFormation() {
    enemies.length = 0;
    const cols = 7, rows = 5;
    const gapX = Math.min(42, W / 9), gapY = 38;
    const startX = W/2 - (cols-1)*gapX/2;
    const top = Math.max(108, H*.13);
    let i = 0;
    for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) {
      const type = r === 0 ? 2 : r < 3 ? 1 : 0;
      enemies.push({
        id: i++, type, hp: type===2?2:1,
        baseX: startX + c*gapX, baseY: top + r*gapY,
        x: startX + c*gapX, y: -40 - Math.random()*H*.45,
        phase: Math.random()*Math.PI*2, state:'forming', t:0,
        diveVX:0, diveAmp:0, diveSide:1, captureT:0
      });
    }
  }

  function updateHud() {
    scoreEl.textContent = score.toLocaleString('it-IT');
    levelEl.textContent = level;
    livesEl.textContent = lives;
    bestEl.textContent = best.toLocaleString('it-IT');
  }

  function projectileVelocity(angle, speed) {
    return { vx: Math.sin(angle) * speed, vy: -Math.cos(angle) * speed };
  }

  function addShot(x, y, kind, angle=0, owner='player') {
    if (kind === 'fireball') {
      const v = projectileVelocity(angle, 535);
      bullets.push({ x, y, vx:v.vx, vy:v.vy, r:6, kind, owner, damage:2, pierce:0, hitIds:null });
      return;
    }
    if (kind === 'laser') {
      const v = projectileVelocity(angle, 920);
      bullets.push({ x, y, vx:v.vx, vy:v.vy, r:4, kind, owner, damage:1, pierce:3, length:86, hitIds:new Set() });
      return;
    }
    const v = projectileVelocity(angle, 650);
    bullets.push({ x, y, vx:v.vx, vy:v.vy, r:3, kind:'bolt', owner, damage:1, pierce:0, hitIds:null });
  }

  function shoot() {
    const weapon = WEAPONS[player.weapon];
    for (const s of weapon.shots) addShot(player.x + s.x, player.y - 18, weapon.kind, s.a, 'player');
    for (const w of wingmen) addShot(w.x, w.y - 13, 'bolt', 0, 'wingman');
    const baseTone = weapon.kind === 'laser' ? 1040 : weapon.kind === 'fireball' ? 520 : 620 + player.weapon*35;
    tone(player.rapid > 0 ? baseTone*1.16 : baseTone, weapon.kind === 'laser' ? .055 : .035, weapon.kind === 'fireball' ? 'triangle' : 'square', .018, weapon.kind === 'laser' ? -90 : 160);
  }

  function enemyShoot(e) {
    const dx = player.x-e.x, dy = player.y-e.y, d = Math.hypot(dx,dy)||1;
    const sp = 220 + level*10;
    enemyBullets.push({x:e.x, y:e.y+10, vx:dx/d*sp*.45, vy:Math.max(120,dy/d*sp), r:4});
    tone(180,.05,'sawtooth',.012,-40);
  }

  function burst(x,y,color,count=12,speed=160) {
    for(let i=0;i<count;i++) {
      const a=Math.random()*Math.PI*2, s=Math.random()*speed;
      particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.35+Math.random()*.55,max:.9,color,size:1+Math.random()*3});
    }
  }

  function hitPlayer() {
    if (player.inv > 0) return;
    lives--; player.inv = 2.2; player.tractor = 0; shake = 10;
    for (const e of enemies) if (e.state === 'capturing') { e.state = 'return'; e.t = 0; e.captureT = 0; }
    burst(player.x,player.y,'#65e7ff',28,260);
    tone(90,.22,'sawtooth',.06,-50);
    updateHud();
    if (navigator.vibrate) navigator.vibrate([30,30,50]);
    if (lives <= 0) endGame();
  }

  function destroyWingman(index) {
    const w = wingmen[index];
    if (!w) return;
    burst(w.x,w.y,'#7cffb2',20,220);
    tone(125,.14,'sawtooth',.035,-60);
    wingmen.splice(index,1);
  }

  function endGame() {
    running = false; paused = false;
    best = Math.max(best, score); localStorage.setItem('starSwarmBest', String(best));
    updateHud();
    overlayText.innerHTML = `Missione terminata.<br>Punteggio <strong>${score.toLocaleString('it-IT')}</strong> • livello ${level}.`;
    startBtn.textContent = 'RIGIOCA'; overlay.classList.add('visible');
  }

  function nextLevel() {
    level++; levelClock = 0;
    enemyBullets.length = 0;
    player.inv = 1.2;
    score += 500;
    spawnFormation(); updateHud();
    tone(440,.18,'triangle',.04,440);
  }

  function collides(a,b,extra=0) { return Math.hypot(a.x-b.x,a.y-b.y) < (a.r||4)+(b.r||10)+extra; }

  function pointSegmentDistance(px,py,x1,y1,x2,y2) {
    const vx=x2-x1, vy=y2-y1, wx=px-x1, wy=py-y1;
    const vv=vx*vx+vy*vy || 1;
    const t=Math.max(0,Math.min(1,(wx*vx+wy*vy)/vv));
    const dx=px-(x1+vx*t),dy=py-(y1+vy*t);
    return Math.hypot(dx,dy);
  }

  function projectileHitsEnemy(b,e) {
    const er=e.type===2?15:12;
    if (b.kind !== 'laser') return collides(b,{x:e.x,y:e.y,r:er},0);
    const speed=Math.hypot(b.vx,b.vy)||1, ux=b.vx/speed, uy=b.vy/speed;
    const x2=b.x-ux*b.length, y2=b.y-uy*b.length;
    return pointSegmentDistance(e.x,e.y,b.x,b.y,x2,y2) < er + 3;
  }

  function dropPowerup(e) {
    const chance = e.type === 2 ? .15 : .085;
    if (Math.random() >= chance) return;
    const roll = Math.random();
    const type = roll < .32 ? 'rapid' : roll < .78 ? 'weapon' : 'tractor';
    powerups.push({x:e.x,y:e.y,vy:92,r:10,type,spin:0,pulse:Math.random()*Math.PI*2});
  }

  function applyPowerup(p) {
    if (p.type === 'rapid') {
      player.rapid = Math.max(player.rapid, 6);
      score += 100;
      burst(p.x,p.y,'#ffe66d',12,120);
      tone(700,.18,'triangle',.04,500);
    } else if (p.type === 'weapon') {
      if (player.weapon < WEAPONS.length-1) {
        player.weapon++;
        score += 180 + player.weapon*40;
      } else score += 500;
      burst(p.x,p.y,'#ff4f64',18,160);
      tone(430,.12,'square',.04,780);
      setFloatingText(`WEAPON ${WEAPONS[player.weapon].name}`);
    } else if (p.type === 'tractor') {
      if (wingmen.length < 2) {
        player.tractor = Math.max(player.tractor, 7.5);
        player.captureCooldown = 0;
        score += 150;
        setFloatingText('TRACTOR BEAM!');
      } else {
        score += 350;
        setFloatingText('WINGMEN MAX +350');
      }
      burst(p.x,p.y,'#7cff88',18,150);
      tone(330,.18,'triangle',.045,660);
    }
    updateHud();
  }

  let floatingText = '', floatingTextT = 0;
  function setFloatingText(text) { floatingText=text; floatingTextT=1.5; }

  function acquireCaptureTarget() {
    if (player.tractor <= 0 || wingmen.length >= 2 || player.captureCooldown > 0) return;
    if (enemies.some(e=>e.hp>0 && e.state==='capturing')) return;
    const candidates=enemies.filter(e=>e.hp>0 && ['formation','dive','return'].includes(e.state) && e.y < player.y-70);
    if (!candidates.length) return;
    candidates.sort((a,b)=>{
      const da=Math.abs(a.x-player.x)*1.5 + Math.abs((player.y-70)-a.y)*.18;
      const db=Math.abs(b.x-player.x)*1.5 + Math.abs((player.y-70)-b.y)*.18;
      return da-db;
    });
    const e=candidates[0];
    e.state='capturing'; e.captureT=0; e.t=0;
    tone(245,.11,'sine',.025,180);
  }

  function completeCapture(e) {
    e.hp=0; e.state='captured';
    const side = wingmen.length === 0 ? -1 : 1;
    wingmen.push({x:player.x+side*31,y:player.y+5,targetX:player.x+side*31,targetY:player.y+5,r:11,type:e.type,phase:Math.random()*6.2});
    player.captureCooldown=.42;
    score += 300 + e.type*120;
    burst(e.x,e.y,'#7cff88',24,190);
    tone(520,.15,'triangle',.045,720);
    if(navigator.vibrate) navigator.vibrate([16,22,16]);
    setFloatingText(`WINGMAN ${wingmen.length}/2`);
    updateHud();
  }

  function updateWingmen(dt) {
    const offsets = wingmen.length === 1 ? [-31] : [-31,31];
    wingmen.forEach((w,i)=>{
      w.targetX=Math.max(14,Math.min(W-14,player.x+(offsets[i]||31))); w.targetY=player.y+6;
      const follow=1-Math.pow(.00015,dt);
      w.x+=(w.targetX-w.x)*follow; w.y+=(w.targetY-w.y)*follow; w.phase+=dt*5;
    });
  }

  function update(dt) {
    if (!running || paused) return;
    levelClock += dt;
    player.inv = Math.max(0, player.inv-dt);
    player.rapid = Math.max(0, player.rapid-dt);
    player.tractor = Math.max(0, player.tractor-dt);
    player.captureCooldown = Math.max(0, player.captureCooldown-dt);
    floatingTextT = Math.max(0, floatingTextT-dt);

    for (const s of stars) { s.y += (18+s.z*24)*dt; if(s.y>H){s.y=-2;s.x=Math.random()*W;} }

    const follow = 1-Math.pow(.0008,dt);
    player.x += (player.targetX-player.x)*follow;
    player.y += (player.targetY-player.y)*follow;
    player.x = Math.max(22,Math.min(W-22,player.x));
    player.y = Math.max(H*.5,Math.min(H-54,player.y));
    updateWingmen(dt);

    acquireCaptureTarget();

    fireClock -= dt;
    if (fireClock <= 0) {
      shoot();
      const base=WEAPONS[player.weapon].interval;
      fireClock = player.rapid>0 ? Math.max(.075,base*.47) : base;
    }

    for (let i=bullets.length-1;i>=0;i--) {
      const b=bullets[i]; b.x += b.vx*dt; b.y += b.vy*dt;
      if(b.y<-120 || b.y>H+40 || b.x<-100 || b.x>W+100) bullets.splice(i,1);
    }

    for (let i=enemyBullets.length-1;i>=0;i--) {
      const b=enemyBullets[i]; b.x += b.vx*dt; b.y += b.vy*dt;
      if (b.y>H+30 || b.x<-30 || b.x>W+30) { enemyBullets.splice(i,1); continue; }
      let hitWing=-1;
      for(let wi=0;wi<wingmen.length;wi++) if(collides(b,wingmen[wi],0)){hitWing=wi;break;}
      if(hitWing>=0){enemyBullets.splice(i,1);destroyWingman(hitWing);continue;}
      if (collides(b,player,0)) { enemyBullets.splice(i,1); hitPlayer(); }
    }

    let alive = 0;
    for (const e of enemies) {
      if(e.hp<=0) continue; alive++; e.t += dt;
      if(e.state==='forming') {
        const k = Math.min(1,e.t/1.25);
        e.x += (e.baseX-e.x)*(1-Math.pow(.005,dt));
        e.y += (e.baseY-e.y)*(1-Math.pow(.005,dt));
        if(k>=1 && Math.abs(e.y-e.baseY)<3) e.state='formation';
      } else if(e.state==='formation') {
        e.x = e.baseX + Math.sin(levelClock*1.4 + e.phase)*8;
        e.y = e.baseY + Math.sin(levelClock*2 + e.phase)*3;
        const diveRate = Math.min(.22, .055 + level*.01);
        if (Math.random() < dt*diveRate && e.y < H*.45) {
          e.state='dive'; e.t=0; e.diveSide=Math.random()<.5?-1:1; e.diveAmp=60+Math.random()*80;
        }
      } else if(e.state==='dive') {
        e.y += (160+level*10)*dt;
        e.x += Math.sin(e.t*3.8)*e.diveAmp*dt*e.diveSide;
        let rammed=false;
        for(let wi=wingmen.length-1;wi>=0;wi--) if(collides(e,wingmen[wi],2)){destroyWingman(wi);e.hp=0;burst(e.x,e.y,'#ff5ecf',16,190);rammed=true;break;}
        if(!rammed && collides(e,player,2)){ e.hp=0; hitPlayer(); burst(e.x,e.y,'#ff5ecf',16,190); }
        if(e.hp>0 && e.y>H+40){ e.y=-25; e.x=e.baseX; e.state='return'; }
      } else if(e.state==='return') {
        e.x += (e.baseX-e.x)*(1-Math.pow(.02,dt));
        e.y += (e.baseY-e.y)*(1-Math.pow(.02,dt));
        if(Math.abs(e.y-e.baseY)<4){ e.state='formation'; e.t=0; }
      } else if(e.state==='capturing') {
        e.captureT += dt;
        const captureY=player.y-47;
        const pull=1-Math.pow(.002,dt);
        e.x += (player.x-e.x)*pull;
        e.y += (captureY-e.y)*pull;
        if(player.tractor<=0){e.state='return';e.t=0;e.captureT=0;}
        else if(Math.hypot(e.x-player.x,e.y-captureY)<9 || e.captureT>1.45) completeCapture(e);
      }
    }

    enemyFireClock -= dt;
    if(enemyFireClock<=0) {
      const candidates=enemies.filter(e=>e.hp>0 && (e.state==='formation'||e.state==='dive'));
      if(candidates.length) enemyShoot(candidates[Math.floor(Math.random()*candidates.length)]);
      enemyFireClock = Math.max(.32, 1.05-level*.055) * (.75+Math.random()*.55);
    }

    for(let bi=bullets.length-1;bi>=0;bi--) {
      const b=bullets[bi]; let remove=false;
      for(const e of enemies) {
        if(e.hp<=0 || e.state==='capturing') continue;
        if(b.hitIds?.has(e.id)) continue;
        if(!projectileHitsEnemy(b,e)) continue;
        if(b.hitIds) b.hitIds.add(e.id);
        e.hp-=b.damage; shake=b.kind==='fireball'?4:2;
        burst(b.x,b.y,e.type===2?'#ffe66d':e.type===1?'#ff5ecf':'#65e7ff',e.hp<=0?16:7,e.hp<=0?180:100);
        if(e.hp<=0){
          const base=[100,160,260][e.type]; score += base * (e.state==='dive'?2:1);
          dropPowerup(e);
          tone(e.type===2?260:330,.07,'square',.025, e.type===2?-100:120);
          updateHud();
        }
        if(b.kind==='laser' && b.pierce>0){b.pierce--; if(b.pierce<=0) remove=true;}
        else remove=true;
        if(remove) break;
      }
      if(remove) bullets.splice(bi,1);
    }

    for(let i=powerups.length-1;i>=0;i--) {
      const p=powerups[i]; p.y+=p.vy*dt; p.spin+=dt*5; p.pulse+=dt*5;
      if(p.y>H+20) powerups.splice(i,1);
      else if(collides(p,player,4)){ applyPowerup(p); powerups.splice(i,1); }
    }

    for(let i=particles.length-1;i>=0;i--) {
      const p=particles[i]; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=Math.pow(.05,dt); p.vy*=Math.pow(.05,dt); p.life-=dt;
      if(p.life<=0) particles.splice(i,1);
    }

    alive = enemies.reduce((n,e)=>n+(e.hp>0?1:0),0);
    if(alive===0 && running) nextLevel();
    shake *= Math.pow(.03,dt);
  }

  function polygon(points, fill, stroke=null) {
    ctx.beginPath(); ctx.moveTo(points[0][0],points[0][1]);
    for(let i=1;i<points.length;i++) ctx.lineTo(points[i][0],points[i][1]);
    ctx.closePath(); ctx.fillStyle=fill; ctx.fill(); if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}
  }

  function drawPlayerShip(x,y,scale=1,accent='#65e7ff',engine='#ff5ecf') {
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
    ctx.shadowBlur=18; ctx.shadowColor=accent;
    polygon([[0,-19],[-14,13],[-6,9],[-3,17],[3,17],[6,9],[14,13]],'#eafcff',accent);
    polygon([[0,-10],[-5,9],[5,9]],accent);
    ctx.shadowBlur=12; ctx.shadowColor=engine; ctx.fillStyle=engine; ctx.fillRect(-3,17,6,8+Math.random()*8);
    ctx.restore();
  }

  function drawPlayer() {
    if(player.inv>0 && Math.floor(player.inv*12)%2===0) return;
    drawPlayerShip(player.x,player.y,1,'#65e7ff','#ff5ecf');
  }

  function drawWingman(w) {
    const accent=w.type===2?'#ffe66d':w.type===1?'#ff8bdc':'#7cffb2';
    ctx.save();ctx.translate(w.x,w.y+Math.sin(w.phase)*1.2);ctx.scale(.72,.72);
    ctx.shadowBlur=12;ctx.shadowColor=accent;
    polygon([[0,-15],[-12,8],[-5,6],[-2,13],[2,13],[5,6],[12,8]],'#dfffe9',accent);
    polygon([[0,-8],[-4,6],[4,6]],accent);
    ctx.fillStyle='#7cff88';ctx.fillRect(-2,13,4,8+Math.random()*5);
    ctx.restore();
  }

  function drawEnemy(e) {
    if(e.hp<=0) return;
    ctx.save(); ctx.translate(e.x,e.y); const bob=Math.sin(e.t*7+e.phase)*1.5; ctx.translate(0,bob);
    if(e.state==='capturing'){ctx.globalAlpha=.68+.3*Math.sin(e.captureT*14);ctx.scale(.92,.92);}
    if(e.type===0){
      ctx.shadowBlur=10;ctx.shadowColor='#65e7ff';
      polygon([[0,-10],[-13,-2],[-9,10],[0,5],[9,10],[13,-2]],'#65e7ff');
      ctx.fillStyle='#071127';ctx.fillRect(-3,-4,6,7);
    } else if(e.type===1){
      ctx.shadowBlur=12;ctx.shadowColor='#ff5ecf';
      polygon([[0,-13],[-14,-5],[-10,10],[-3,6],[0,13],[3,6],[10,10],[14,-5]],'#ff5ecf');
      ctx.fillStyle='#ffe66d';ctx.fillRect(-3,-5,6,6);
    } else {
      ctx.shadowBlur=14;ctx.shadowColor='#ffe66d';
      polygon([[0,-15],[-15,-5],[-11,11],[0,6],[11,11],[15,-5]],'#ffe66d');
      ctx.fillStyle=e.hp>1?'#ff5ecf':'#ff9f43';ctx.beginPath();ctx.arc(0,-3,5,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }

  function drawPowerup(p) {
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.spin);
    if(p.type==='rapid'){
      ctx.shadowBlur=16;ctx.shadowColor='#ffe66d';ctx.strokeStyle='#ffe66d';ctx.lineWidth=2;ctx.strokeRect(-8,-8,16,16);ctx.fillStyle='#fff';ctx.fillRect(-2,-6,4,12);
    } else if(p.type==='weapon'){
      ctx.shadowBlur=18;ctx.shadowColor='#ff4f64';
      polygon([[0,-11],[11,0],[0,11],[-11,0]],'#ff4f64','#ffd0d5');
      ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(4,2);ctx.lineTo(1,2);ctx.lineTo(1,7);ctx.lineTo(-1,7);ctx.lineTo(-1,2);ctx.lineTo(-4,2);ctx.closePath();ctx.fill();
    } else {
      ctx.shadowBlur=18;ctx.shadowColor='#7cff88';ctx.strokeStyle='#7cff88';ctx.lineWidth=2.5;
      ctx.beginPath();ctx.arc(0,0,9,0,Math.PI*2);ctx.stroke();
      ctx.beginPath();ctx.moveTo(-7,-3);ctx.lineTo(-2,0);ctx.lineTo(-7,3);ctx.moveTo(7,-3);ctx.lineTo(2,0);ctx.lineTo(7,3);ctx.stroke();
      ctx.fillStyle='#eaffee';ctx.beginPath();ctx.arc(0,0,2.5,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }

  function drawTractorBeam() {
    if(player.tractor<=0 || wingmen.length>=2) return;
    const pulse=.16+.08*Math.sin(levelClock*8);
    const topY=Math.max(55,player.y-H*.62), halfTop=44+18*Math.sin(levelClock*2.2);
    const grad=ctx.createLinearGradient(0,topY,0,player.y);
    grad.addColorStop(0,'rgba(124,255,136,0)');grad.addColorStop(.72,`rgba(124,255,136,${pulse})`);grad.addColorStop(1,'rgba(210,255,218,.06)');
    ctx.save();ctx.globalCompositeOperation='screen';ctx.fillStyle=grad;
    ctx.beginPath();ctx.moveTo(player.x-halfTop,topY);ctx.lineTo(player.x+halfTop,topY);ctx.lineTo(player.x+16,player.y-17);ctx.lineTo(player.x-16,player.y-17);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(124,255,136,.38)';ctx.lineWidth=1;ctx.setLineDash([5,7]);ctx.stroke();ctx.restore();
  }

  function drawProjectile(b) {
    if(b.kind==='fireball'){
      ctx.save();ctx.shadowBlur=16;ctx.shadowColor='#ff9c3d';ctx.fillStyle='#fff2a6';ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ff5b2d';ctx.beginPath();ctx.arc(b.x,b.y,3,0,Math.PI*2);ctx.fill();ctx.restore();
      return;
    }
    if(b.kind==='laser'){
      const sp=Math.hypot(b.vx,b.vy)||1,ux=b.vx/sp,uy=b.vy/sp;
      ctx.save();ctx.shadowBlur=12;ctx.shadowColor='#8efcff';ctx.strokeStyle='#dfffff';ctx.lineWidth=3.5;ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.x-ux*b.length,b.y-uy*b.length);ctx.stroke();ctx.strokeStyle='#65e7ff';ctx.lineWidth=1.2;ctx.stroke();ctx.restore();
      return;
    }
    ctx.save();ctx.fillStyle=b.owner==='wingman'?'#b6ffd0':'#bdf7ff';ctx.shadowBlur=10;ctx.shadowColor=b.owner==='wingman'?'#7cff88':'#65e7ff';ctx.translate(b.x,b.y);const a=Math.atan2(b.vy,b.vx)+Math.PI/2;ctx.rotate(a);ctx.fillRect(-2,-9,4,14);ctx.restore();
  }

  function draw() {
    ctx.clearRect(0,0,W,H);
    ctx.save();
    if(shake>0) ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);

    const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#07142f'); g.addColorStop(.5,'#030916'); g.addColorStop(1,'#01030a'); ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    for(const s of stars){ ctx.globalAlpha=s.a; ctx.fillStyle='#d9f8ff'; ctx.fillRect(s.x,s.y,s.z>1.5?2:1,s.z>1.5?2:1); }
    ctx.globalAlpha=1;

    drawTractorBeam();

    for(const p of particles){ ctx.globalAlpha=Math.max(0,p.life/p.max); ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,p.size,p.size); }
    ctx.globalAlpha=1;

    for(const e of enemies) drawEnemy(e);
    for(const b of bullets) drawProjectile(b);

    ctx.shadowBlur=0;
    ctx.fillStyle='#ff796f'; for(const b of enemyBullets){ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();}

    for(const p of powerups) drawPowerup(p);
    for(const w of wingmen) drawWingman(w);
    drawPlayer();

    ctx.textAlign='center';ctx.font='bold 9px monospace';
    const status=[];
    if(player.rapid>0) status.push(`RAPID ${player.rapid.toFixed(1)}s`);
    if(player.tractor>0 && wingmen.length<2) status.push(`TRACTOR ${player.tractor.toFixed(1)}s`);
    status.push(WEAPONS[player.weapon].name);
    if(wingmen.length) status.push(`WINGMEN ${wingmen.length}/2`);
    ctx.fillStyle='rgba(210,245,255,.88)';ctx.shadowBlur=6;ctx.shadowColor='#65e7ff';
    ctx.fillText(status.join('  •  '),W/2,H-18);
    if(floatingTextT>0){ctx.globalAlpha=Math.min(1,floatingTextT*2);ctx.font='bold 13px monospace';ctx.fillStyle='#fff';ctx.shadowBlur=14;ctx.shadowColor='#ff5ecf';ctx.fillText(floatingText,W/2,H*.46-floatingTextT*8);ctx.globalAlpha=1;}
    ctx.restore();
  }

  function loop(t) {
    const dt=Math.min(.033,(t-last)/1000 || 0); last=t; update(dt); draw(); requestAnimationFrame(loop);
  }

  function setPointer(clientX,clientY) {
    const r=canvas.getBoundingClientRect(); player.targetX=clientX-r.left; player.targetY=clientY-r.top-22;
  }
  canvas.addEventListener('pointerdown', e=>{ pointerActive=true; canvas.setPointerCapture?.(e.pointerId); setPointer(e.clientX,e.clientY); if(audio.state==='suspended') audio.resume(); });
  canvas.addEventListener('pointermove', e=>{ if(pointerActive) setPointer(e.clientX,e.clientY); });
  canvas.addEventListener('pointerup', ()=>pointerActive=false);
  canvas.addEventListener('pointercancel', ()=>pointerActive=false);

  startBtn.addEventListener('click',()=>{
    if(audio.state==='suspended') audio.resume();
    if (running && paused) {
      paused=false; overlay.classList.remove('visible'); pauseBtn.textContent='Ⅱ'; last=performance.now();
      return;
    }
    overlay.classList.remove('visible'); resetGame(); running=true; paused=false; pauseBtn.textContent='Ⅱ'; last=performance.now();
  });
  pauseBtn.addEventListener('click',()=>{
    if(!running) return; paused=!paused; pauseBtn.textContent=paused?'▶':'Ⅱ';
    overlay.classList.toggle('visible',paused);
    if(paused){overlayText.textContent='Partita in pausa.';startBtn.textContent='RIPRENDI';}
    else overlay.classList.remove('visible');
  });
  muteBtn.addEventListener('click',()=>{ muted=!muted; muteBtn.textContent=muted?'🔇':'🔊'; });
  window.addEventListener('rwg:continue-game',e=>{
    score=Math.max(0,Math.floor(e.detail?.score??score*.5));lives=1;running=true;paused=false;
    bullets.length=0;enemyBullets.length=0;player.x=player.targetX=W/2;player.y=player.targetY=H*.84;player.inv=3;player.rapid=Math.max(player.rapid,1.5);player.tractor=0;
    for(const en of enemies)if(en.hp>0&&en.state==='capturing'){en.state='return';en.t=0;en.captureT=0;}
    overlay.classList.remove('visible');startBtn.textContent='RIGIOCA';pauseBtn.textContent='Ⅱ';last=performance.now();updateHud();tone(520,.16,'triangle',.035,900);
  });
  window.addEventListener('resize',resize);
  document.addEventListener('visibilitychange',()=>{ if(document.hidden && running && !paused){paused=true;overlayText.textContent='Partita in pausa.';startBtn.textContent='RIPRENDI';overlay.classList.add('visible');pauseBtn.textContent='▶';} });

  bestEl.textContent=best.toLocaleString('it-IT'); resize(); requestAnimationFrame(loop);
})();