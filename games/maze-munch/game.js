(() => {
'use strict';const M=window.MM,c=M.dom.canvas;
M.dom.start.addEventListener('click',()=>{M.ensureAudio();if(M.audio&&M.audio.state==='suspended')M.audio.resume().catch(()=>{});M.resetGame();M.running=true;M.paused=false;M.dom.pause.textContent='Ⅱ';M.dom.overlay.classList.remove('visible');});
M.dom.pause.addEventListener('click',()=>{if(!M.running)return;M.paused=!M.paused;M.dom.pause.textContent=M.paused?'▶':'Ⅱ';M.status(M.paused?'PAUSA':'IN CACCIA');});
M.dom.mute.addEventListener('click',()=>{M.muted=!M.muted;M.dom.mute.textContent=M.muted?'🔇':'🔊';});
document.querySelectorAll('.dir').forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();M.setDir(b.dataset.dir);}));
c.addEventListener('pointerdown',e=>{M.swipe={x:e.clientX,y:e.clientY};c.setPointerCapture?.(e.pointerId);});
c.addEventListener('pointerup',e=>{if(!M.swipe)return;const x=e.clientX-M.swipe.x,y=e.clientY-M.swipe.y;M.swipe=null;if(Math.hypot(x,y)<16)return;M.setDir(Math.abs(x)>Math.abs(y)?(x<0?'left':'right'):(y<0?'up':'down'));});
c.addEventListener('pointercancel',()=>M.swipe=null);
window.addEventListener('keydown',e=>{const k=e.key.toLowerCase(),d=k==='arrowleft'||k==='a'?'left':k==='arrowright'||k==='d'?'right':k==='arrowup'||k==='w'?'up':k==='arrowdown'||k==='s'?'down':null;if(d){e.preventDefault();M.setDir(d);}else if(k==='p'||k===' '){e.preventDefault();M.dom.pause.click();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&M.running&&!M.paused){M.paused=true;M.dom.pause.textContent='▶';M.status('PAUSA');}});
window.addEventListener('rwg:continue-game',e=>{M.score=Math.max(0,Math.floor(e.detail?.score??M.score*.5));M.lives=1;M.running=true;M.paused=false;M.dom.pause.textContent='Ⅱ';M.dom.start.textContent='RIGIOCA';M.dom.overlay.classList.remove('visible');M.resetActors(2.8);M.hud();M.last=performance.now();M.status('CONTINUA!');M.tone(520,.16,'triangle',.035,900);});
window.addEventListener('resize',M.resize);
M.resetBoard();M.resetActors(0);M.hud();M.resize();
function loop(t){const dt=Math.min(.035,(t-M.last)/1000||0);M.last=t;M.update(dt);M.draw();requestAnimationFrame(loop);}requestAnimationFrame(loop);
})();