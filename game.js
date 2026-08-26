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

  const bullets = [], enemyBullets = [], enemies = [], particles = [], stars = [], powerups = [];

  const player = { x: W/2, y: H*.84, r: 15, targetX: W/2, targetY: H*.84, inv: 0, rapid: 0 };

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
    bullets.length = enemyBullets.length = enemies.length = particles.length = powerups.length = 0;
    player.x = player.targetX = W/2; player.y = player.targetY = H*.84; player.inv = 1.5; player.rapid = 0;
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
        diveVX:0, diveAmp:0, diveSide:1
      });
    }
  }

  function updateHud() {
    scoreEl.textContent = score.toLocaleString('it-IT');
    levelEl.textContent = level;
    livesEl.textContent = lives;
    bestEl.textContent = best.toLocaleString('it-IT');
  }

  function shoot() {
    bullets.push({x:player.x, y:player.y-18, vy:-650, r:3});
    tone(player.rapid > 0 ? 800 : 620, .035, 'square', .018, 160);
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
    lives--; player.inv = 2.2; shake = 10;
    burst(player.x,player.y,'#65e7ff',28,260);
    tone(90,.22,'sawtooth',.06,-50);
    updateHud();
    if (navigator.vibrate) navigator.vibrate([30,30,50]);
    if (lives <= 0) endGame();
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

  function update(dt) {
    if (!running || paused) return;
    levelClock += dt;
    player.inv = Math.max(0, player.inv-dt); player.rapid = Math.max(0, player.rapid-dt);

    for (const s of stars) { s.y += (18+s.z*24)*dt; if(s.y>H){s.y=-2;s.x=Math.random()*W;} }

    const follow = 1-Math.pow(.0008,dt);
    player.x += (player.targetX-player.x)*follow;
    player.y += (player.targetY-player.y)*follow;
    player.x = Math.max(22,Math.min(W-22,player.x));
    player.y = Math.max(H*.5,Math.min(H-54,player.y));

    fireClock -= dt;
    if (fireClock <= 0) { shoot(); fireClock = player.rapid>0 ? .09 : .19; }

    for (let i=bullets.length-1;i>=0;i--) { const b=bullets[i]; b.y += b.vy*dt; if(b.y<-20) bullets.splice(i,1); }
    for (let i=enemyBullets.length-1;i>=0;i--) {
      const b=enemyBullets[i]; b.x += b.vx*dt; b.y += b.vy*dt;
      if (b.y>H+30 || b.x<-30 || b.x>W+30) enemyBullets.splice(i,1);
      else if (collides(b,player,0)) { enemyBullets.splice(i,1); hitPlayer(); }
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
        if(collides(e,player,2)){ e.hp=0; hitPlayer(); burst(e.x,e.y,'#ff5ecf',16,190); }
        if(e.y>H+40){ e.y=-25; e.x=e.baseX; e.state='return'; }
      } else if(e.state==='return') {
        e.x += (e.baseX-e.x)*(1-Math.pow(.02,dt));
        e.y += (e.baseY-e.y)*(1-Math.pow(.02,dt));
        if(Math.abs(e.y-e.baseY)<4){ e.state='formation'; e.t=0; }
      }
    }

    enemyFireClock -= dt;
    if(enemyFireClock<=0) {
      const candidates=enemies.filter(e=>e.hp>0 && (e.state==='formation'||e.state==='dive'));
      if(candidates.length) enemyShoot(candidates[Math.floor(Math.random()*candidates.length)]);
      enemyFireClock = Math.max(.32, 1.05-level*.055) * (.75+Math.random()*.55);
    }

    for(let bi=bullets.length-1;bi>=0;bi--) {
      const b=bullets[bi]; let consumed=false;
      for(const e of enemies) if(e.hp>0 && collides(b,{x:e.x,y:e.y,r:e.type===2?15:12},0)) {
        bullets.splice(bi,1); consumed=true; e.hp--; shake=2;
        burst(b.x,b.y,e.type===2?'#ffe66d':e.type===1?'#ff5ecf':'#65e7ff',e.hp<=0?16:7,e.hp<=0?180:100);
        if(e.hp<=0){
          const base=[100,160,260][e.type]; score += base * (e.state==='dive'?2:1);
          if(Math.random()<.055) powerups.push({x:e.x,y:e.y,vy:95,r:9,type:'rapid',spin:0});
          tone(e.type===2?260:330,.07,'square',.025, e.type===2?-100:120);
          updateHud();
        }
        break;
      }
      if(consumed) continue;
    }

    for(let i=powerups.length-1;i>=0;i--) {
      const p=powerups[i]; p.y+=p.vy*dt; p.spin+=dt*5;
      if(p.y>H+20) powerups.splice(i,1);
      else if(collides(p,player,4)){ player.rapid=6; score+=100; powerups.splice(i,1); tone(700,.18,'triangle',.04,500); updateHud(); }
    }

    for(let i=particles.length-1;i>=0;i--) {
      const p=particles[i]; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=Math.pow(.05,dt); p.vy*=Math.pow(.05,dt); p.life-=dt;
      if(p.life<=0) particles.splice(i,1);
    }

    if(alive===0 && running) nextLevel();
    shake *= Math.pow(.03,dt);
  }

  function polygon(points, fill, stroke=null) {
    ctx.beginPath(); ctx.moveTo(points[0][0],points[0][1]);
    for(let i=1;i<points.length;i++) ctx.lineTo(points[i][0],points[i][1]);
    ctx.closePath(); ctx.fillStyle=fill; ctx.fill(); if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}
  }

  function drawPlayer() {
    if(player.inv>0 && Math.floor(player.inv*12)%2===0) return;
    ctx.save(); ctx.translate(player.x,player.y);
    ctx.shadowBlur=18; ctx.shadowColor='#65e7ff';
    polygon([[0,-19],[-14,13],[-6,9],[-3,17],[3,17],[6,9],[14,13]],'#eafcff','#65e7ff');
    polygon([[0,-10],[-5,9],[5,9]],'#65e7ff');
    ctx.shadowBlur=12; ctx.shadowColor='#ff5ecf'; ctx.fillStyle='#ff5ecf'; ctx.fillRect(-3,17,6,8+Math.random()*8);
    ctx.restore();
  }

  function drawEnemy(e) {
    if(e.hp<=0) return;
    ctx.save(); ctx.translate(e.x,e.y); const bob=Math.sin(e.t*7+e.phase)*1.5; ctx.translate(0,bob);
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

  function draw() {
    ctx.clearRect(0,0,W,H);
    ctx.save();
    if(shake>0) ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);

    const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#07142f'); g.addColorStop(.5,'#030916'); g.addColorStop(1,'#01030a'); ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    for(const s of stars){ ctx.globalAlpha=s.a; ctx.fillStyle='#d9f8ff'; ctx.fillRect(s.x,s.y,s.z>1.5?2:1,s.z>1.5?2:1); }
    ctx.globalAlpha=1;

    for(const p of particles){ ctx.globalAlpha=Math.max(0,p.life/p.max); ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,p.size,p.size); }
    ctx.globalAlpha=1;

    for(const e of enemies) drawEnemy(e);

    ctx.fillStyle='#bdf7ff'; ctx.shadowBlur=10; ctx.shadowColor='#65e7ff';
    for(const b of bullets) ctx.fillRect(b.x-2,b.y-10,4,14);
    ctx.shadowBlur=0;
    ctx.fillStyle='#ff796f'; for(const b of enemyBullets){ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();}

    for(const p of powerups){
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.spin);ctx.shadowBlur=16;ctx.shadowColor='#ffe66d';ctx.strokeStyle='#ffe66d';ctx.lineWidth=2;ctx.strokeRect(-8,-8,16,16);ctx.fillStyle='#fff';ctx.fillRect(-2,-6,4,12);ctx.restore();
    }

    drawPlayer();

    if(player.rapid>0){ ctx.fillStyle='rgba(255,230,109,.9)'; ctx.font='10px monospace'; ctx.textAlign='center'; ctx.fillText(`RAPID ${player.rapid.toFixed(1)}s`,player.x,player.y+34); }
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
  window.addEventListener('resize',resize);
  document.addEventListener('visibilitychange',()=>{ if(document.hidden && running && !paused){paused=true;overlayText.textContent='Partita in pausa.';startBtn.textContent='RIPRENDI';overlay.classList.add('visible');pauseBtn.textContent='▶';} });

  bestEl.textContent=best.toLocaleString('it-IT'); resize(); requestAnimationFrame(loop);
})();
