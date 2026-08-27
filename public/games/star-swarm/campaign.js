(() => {
  'use strict';

  const FORMATIONS = [
    'grid','chevron','diamond','ring','hourglass','wave','shield','crown','spiral','double-v',
    'arrow','arc','columns','wings','zigzag','trident','fortress','comet','butterfly','cross'
  ];
  const ENTRANCES = [
    'top-ribbon','left-sweep','right-sweep','twin-spiral','diagonal-rain','bottom-loop',
    'crossfire','fan-dive','wave-train','orbit-drop','snake-column','four-corners'
  ];
  const NAMES = [
    'ORBITAL GATE','CYAN FRONT','RUBY LATTICE','NEBULA V','ION CROWN','VOID WAVE','STAR SHIELD','NOVA RING',
    'COSMIC SPIRAL','TWIN VECTOR','SOLAR ARROW','LUNAR ARC','PHOTON COLUMNS','AURORA WINGS','PLASMA ZIGZAG',
    'TRIDENT RUN','FORTRESS LINE','COMET SWARM','BUTTERFLY LOCK','CROSS VECTOR'
  ];

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const ease=t=>1-Math.pow(1-clamp(t,0,1),3);
  const rng=seed=>{let s=seed>>>0;return()=>((s=Math.imul(1664525,s)+1013904223>>>0)/4294967296);};

  function formationPoints(kind, count, W, H, level, rand) {
    const cx=W/2, top=Math.max(112,H*.13), width=Math.min(W*.78,330), height=Math.min(H*.26,210);
    const pts=[];
    const rows=Math.max(4,Math.min(7,Math.round(Math.sqrt(count*.72))));
    const cols=Math.ceil(count/rows);
    for(let i=0;i<count;i++){
      const row=Math.floor(i/cols), col=i%cols, u=cols===1?0:(col/(cols-1))*2-1, v=rows===1?0:row/(rows-1);
      let x=cx+u*width*.48, y=top+v*height;
      const a=(i/count)*Math.PI*2, r0=Math.min(width,height)*(.25+.18*((i%5)/4));
      switch(kind){
        case 'chevron': x=cx+u*width*.46; y=top+Math.abs(u)*height*.58+row*11; break;
        case 'diamond': x=cx+u*width*.42*(1-Math.abs(v-.5)*.55); y=top+v*height; break;
        case 'ring': x=cx+Math.cos(a)*width*.37; y=top+height*.48+Math.sin(a)*height*.42; break;
        case 'hourglass': x=cx+u*width*(.18+Math.abs(v-.5)*.55); y=top+v*height; break;
        case 'wave': x=cx+u*width*.47; y=top+v*height*.72+Math.sin(u*Math.PI*2+level*.37)*27; break;
        case 'shield': x=cx+u*width*(.28+.24*v); y=top+v*height+Math.cos(u*Math.PI)*18; break;
        case 'crown': x=cx+u*width*.47; y=top+v*height*.72-Math.abs(Math.sin((u+1)*Math.PI*1.5))*32; break;
        case 'spiral': {const rr=22+(i/count)*Math.min(width,height)*.58; const aa=a*1.75+level*.13; x=cx+Math.cos(aa)*rr; y=top+height*.48+Math.sin(aa)*rr*.62;} break;
        case 'double-v': x=cx+u*width*.47; y=top+((i%2)?Math.abs(u):1-Math.abs(u))*height*.55+row*9; break;
        case 'arrow': x=cx+u*width*.43; y=top+Math.abs(u)*height*.46+v*height*.35; break;
        case 'arc': x=cx+u*width*.48; y=top+v*height*.5+(1-u*u)*48; break;
        case 'columns': x=cx+u*width*.43+Math.sin(row*1.7)*8; y=top+v*height; break;
        case 'wings': x=cx+u*width*.47; y=top+v*height*.58+Math.abs(u)*43-Math.cos(v*Math.PI)*12; break;
        case 'zigzag': x=cx+u*width*.46+(row%2?18:-18); y=top+v*height; break;
        case 'trident': x=cx+(col%3-1)*width*.25+(row%2?8:-8); y=top+v*height; break;
        case 'fortress': x=cx+u*width*.46; y=top+v*height; if(row===0||row===rows-1||col===0||col===cols-1){x+=Math.sign(u||1)*8;} break;
        case 'comet': x=cx+u*width*.38+v*55; y=top+v*height+Math.sin(i*.9)*11; break;
        case 'butterfly': x=cx+Math.sign(u||1)*(22+Math.abs(u)*width*.38); y=top+v*height+Math.sin(v*Math.PI)*36; break;
        case 'cross': x=(i%2===0)?cx+u*width*.45:cx+Math.sin(a)*22; y=(i%2===0)?top+height*.48:top+v*height; break;
        default: break;
      }
      const warp=1+((level-1)%10)*.006;
      x=cx+(x-cx)*warp + (rand()-.5)*5;
      y+= (rand()-.5)*4;
      pts.push({x:clamp(x,28,W-28),y:clamp(y,88,H*.43)});
    }
    return pts;
  }

  function entryPosition(enemy, t, W, H) {
    const e=enemy.entry, targetX=enemy.baseX, targetY=enemy.baseY;
    if(t<=0) return {x:e.startX,y:e.startY,done:false};
    const p=clamp(t/e.duration,0,1), q=ease(p), cx=W/2, cy=H*.26;
    let x=lerp(e.startX,targetX,q), y=lerp(e.startY,targetY,q);
    const s=Math.sin(p*Math.PI), w=e.wave;
    switch(e.mode){
      case 'top-ribbon': x+=Math.sin(p*Math.PI*2+e.phase)*w*s; y-=Math.sin(p*Math.PI)*28; break;
      case 'left-sweep': x+=Math.sin(p*Math.PI*2+e.phase)*25*s; y+=Math.sin(p*Math.PI*3+e.phase)*w*s; break;
      case 'right-sweep': x-=Math.sin(p*Math.PI*2+e.phase)*25*s; y+=Math.sin(p*Math.PI*3+e.phase)*w*s; break;
      case 'twin-spiral': {const rr=(1-p)*(W*.34); const aa=e.phase+p*Math.PI*3*e.side; x=lerp(cx+Math.cos(aa)*rr,targetX,q); y=lerp(cy+Math.sin(aa)*rr*.62,targetY,q);} break;
      case 'diagonal-rain': x+=e.side*(1-p)*W*.16; y+=Math.sin(p*Math.PI*2+e.phase)*18*s; break;
      case 'bottom-loop': {const loop=Math.sin(p*Math.PI); x+=e.side*loop*W*.22; y+=loop*H*.16;} break;
      case 'crossfire': x+=Math.sin(p*Math.PI*2)*e.side*W*.11*s; y-=Math.sin(p*Math.PI)*46; break;
      case 'fan-dive': x=lerp(cx+(e.index%7-3)*10,targetX,q)+Math.sin(p*Math.PI)*e.side*w; y=lerp(-45,targetY,q)+Math.sin(p*Math.PI)*H*.12; break;
      case 'wave-train': x+=Math.sin(p*Math.PI*4+e.phase)*w*s; y+=Math.cos(p*Math.PI*3+e.phase)*18*s; break;
      case 'orbit-drop': {const rr=(1-p)*(70+e.index%5*8); const aa=e.phase+p*Math.PI*2.4*e.side; x=lerp(cx+Math.cos(aa)*rr,targetX,q); y=lerp(cy+Math.sin(aa)*rr,targetY,q);} break;
      case 'snake-column': x+=Math.sin(p*Math.PI*5+e.phase)*w*(1-p); break;
      case 'four-corners': x+=Math.sin(p*Math.PI)*e.side*w; y+=Math.cos(p*Math.PI*2+e.phase)*24*s; break;
    }
    return {x,y,done:p>=1};
  }

  function getStage(level, W, H) {
    const seed=0x51f15e + level*7919, rand=rng(seed);
    const n=level-1;
    const formationIndex=n%FORMATIONS.length;
    const entranceIndex=(n+2*Math.floor(n/FORMATIONS.length))%ENTRANCES.length;
    const kind=FORMATIONS[formationIndex], entrance=ENTRANCES[entranceIndex];
    const bossEscort=level%10===0;
    const count=bossEscort ? 24+((level/10)%3)*2 : Math.min(42,28+((level*3)%11)+Math.floor(level/25)*2);
    const pts=formationPoints(kind,count,W,H,level,rand);
    const slots=pts.map((p,i)=>{
      const type=bossEscort ? (i%5===0?2:i%2) : ((i+level)%11===0?2:((i+level)%3===0?1:0));
      const side=((i+level)%2)?1:-1;
      let startX, startY;
      switch(entrance){
        case 'left-sweep': startX=-50-(i%4)*18; startY=55+(i%12)*34; break;
        case 'right-sweep': startX=W+50+(i%4)*18; startY=55+(i%12)*34; break;
        case 'bottom-loop': startX=W*.18+(i%8)*(W*.64/7); startY=H+55+(i%3)*25; break;
        case 'crossfire': startX=side<0?-55:W+55; startY=70+(i%10)*31; break;
        case 'four-corners': startX=(i%4<2?-55:W+55); startY=(i%2?-55:H+55); break;
        case 'fan-dive': startX=W/2+(i%7-3)*9; startY=-70-(i%5)*20; break;
        case 'diagonal-rain': startX=side<0?-20+(i%5)*22:W+20-(i%5)*22; startY=-70-(i%6)*25; break;
        default: startX=W*.08+(i%9)*(W*.84/8); startY=-60-(i%7)*28; break;
      }
      return {
        x:p.x,y:p.y,type,
        entry:{
          mode:entrance,index:i,side,phase:rand()*Math.PI*2,wave:28+rand()*54,
          startX,startY,delay:(i%7)*.055+Math.floor(i/7)*.12+(level%4)*.018,
          duration:1.15+rand()*.62+Math.min(.35,level*.002)
        }
      };
    });
    return {
      level, seed, kind, entrance, bossEscort, slots,
      name:`${NAMES[formationIndex]} ${String(level).padStart(2,'0')}`,
      signature:`${kind}:${entrance}:${level}`,
      diveRate:Math.min(.32,.052+level*.00225),
      enemySpeed:155+Math.min(170,level*1.45),
      fireGap:Math.max(.24,1.05-level*.0063),
      drift:7+Math.min(12,level*.07),
      stageBonus:450+level*35
    };
  }

  window.StarSwarmCampaign=Object.freeze({
    FORMATIONS:[...FORMATIONS], ENTRANCES:[...ENTRANCES], getStage, entryPosition
  });
})();