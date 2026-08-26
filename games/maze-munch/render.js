(() => {
'use strict';const M=window.MM,ctx=M.dom.canvas.getContext('2d');
M.resize=()=>{
  const r=M.dom.canvas.getBoundingClientRect();M.DPR=Math.min(window.devicePixelRatio||1,2);M.W=Math.max(1,r.width);M.H=Math.max(1,r.height);
  M.dom.canvas.width=Math.floor(M.W*M.DPR);M.dom.canvas.height=Math.floor(M.H*M.DPR);ctx.setTransform(M.DPR,0,0,M.DPR,0,0);
  M.tile=Math.max(10,Math.floor(Math.min((M.W-8)/M.COLS,(M.H-8)/M.ROWS)));M.ox=(M.W-M.tile*M.COLS)/2;M.oy=(M.H-M.tile*M.ROWS)/2;
};
const X=v=>M.ox+v*M.tile,Y=v=>M.oy+v*M.tile;
function maze(){
  ctx.fillStyle='#020611';ctx.fillRect(M.ox,M.oy,M.COLS*M.tile,M.ROWS*M.tile);
  for(let y=0;y<M.ROWS;y++)for(let x=0;x<M.COLS;x++)if(M.map[y][x]==='#'){
    const a=X(x),b=Y(y),i=Math.max(1.5,M.tile*.12);ctx.fillStyle='#0c1c46';ctx.fillRect(a+1,b+1,M.tile-2,M.tile-2);
    ctx.strokeStyle='#4b6cff';ctx.lineWidth=Math.max(1,M.tile*.07);ctx.strokeRect(a+i,b+i,M.tile-i*2,M.tile-i*2);
  }
  ctx.fillStyle='#d9f8ff';for(const k of M.pellets){const[a,b]=k.split(',').map(Number);ctx.beginPath();ctx.arc(X(a+.5),Y(b+.5),Math.max(1.1,M.tile*.09),0,Math.PI*2);ctx.fill();}
  const p=.78+Math.sin(performance.now()*.008)*.18;ctx.fillStyle='#7cffb2';ctx.shadowBlur=M.tile*.6;ctx.shadowColor='#7cffb2';
  for(const k of M.power){const[a,b]=k.split(',').map(Number);ctx.beginPath();ctx.arc(X(a+.5),Y(b+.5),M.tile*.2*p,0,Math.PI*2);ctx.fill();}ctx.shadowBlur=0;
  if(M.bonus){ctx.save();ctx.translate(X(M.bonus.x),Y(M.bonus.y));ctx.rotate(performance.now()*.002);ctx.fillStyle='#ffe66d';ctx.shadowBlur=M.tile*.8;ctx.shadowColor='#ffe66d';ctx.beginPath();
    for(let i=0;i<8;i++){const a=i*Math.PI/4,r=i%2?M.tile*.2:M.tile*.38,x=Math.cos(a)*r,y=Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fill();ctx.restore();ctx.shadowBlur=0;}
}
function player(){
  const p=M.player;if(p.inv>0&&Math.floor(p.inv*10)%2===0)return;const r=M.tile*.38,a=M.DIR[p.dir].a,m=.22+Math.abs(Math.sin(performance.now()*.014))*.24;
  ctx.save();ctx.translate(X(p.x),Y(p.y));ctx.rotate(a);ctx.fillStyle='#7cffb2';ctx.shadowBlur=M.tile*.65;ctx.shadowColor='#7cffb2';
  ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,r,m,Math.PI*2-m);ctx.closePath();ctx.fill();ctx.fillStyle='#06100b';ctx.beginPath();ctx.arc(r*.08,-r*.52,Math.max(1.2,r*.13),0,Math.PI*2);ctx.fill();ctx.restore();ctx.shadowBlur=0;
}
function hunter(h){
  const r=M.tile*.35;ctx.save();ctx.translate(X(h.x),Y(h.y));
  if(h.eyes){const d=M.DIR[h.dir];ctx.fillStyle='#f7fbff';ctx.beginPath();ctx.ellipse(-r*.35,0,r*.22,r*.3,0,0,Math.PI*2);ctx.ellipse(r*.35,0,r*.22,r*.3,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#65e7ff';ctx.beginPath();ctx.arc(-r*.35+d.x*r*.09,d.y*r*.09,r*.09,0,Math.PI*2);ctx.arc(r*.35+d.x*r*.09,d.y*r*.09,r*.09,0,Math.PI*2);ctx.fill();ctx.restore();return;}
  const v=M.frightened>0,f=M.frightened<1.6&&Math.floor(M.frightened*7)%2===0,c=v?(f?'#f7fbff':'#355d7c'):h.color,s=r*1.85;
  ctx.fillStyle=c;ctx.shadowBlur=M.tile*.45;ctx.shadowColor=c;ctx.fillRect(-s/2,-s/2,s,s);ctx.fillStyle='#071126';ctx.beginPath();ctx.arc(-r*.28,-r*.08,r*.12,0,Math.PI*2);ctx.arc(r*.28,-r*.08,r*.12,0,Math.PI*2);ctx.fill();
  if(v){ctx.strokeStyle='#dffaff';ctx.lineWidth=Math.max(1,M.tile*.07);ctx.beginPath();ctx.moveTo(-r*.38,r*.28);ctx.lineTo(-r*.12,r*.12);ctx.lineTo(r*.12,r*.28);ctx.lineTo(r*.38,r*.12);ctx.stroke();}ctx.restore();ctx.shadowBlur=0;
}
M.draw=()=>{ctx.clearRect(0,0,M.W,M.H);const g=ctx.createLinearGradient(0,0,0,M.H);g.addColorStop(0,'#08142b');g.addColorStop(1,'#02050d');ctx.fillStyle=g;ctx.fillRect(0,0,M.W,M.H);maze();player();M.hunters.forEach(hunter);};
})();