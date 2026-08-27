(() => {
  'use strict';
  const NAMES = ['FIRST ROLL','DOUBLE DROP','ICE CIRCUIT','BUMPER BAY','BOOST LANE','CROSSWIND','THREE PITS','FROZEN SWITCH','PINBALL GRID','VELOCITY','NEON GAUNTLET','MASTER TILT'];
  const SEEDS = [191,347,521,809,1061,1327,1597,1871,2153,2437,2741,3019];
  const CX=6,CY=9,W=CX*2+1,H=CY*2+1;
  const rngFor=seed=>{let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};};
  function shuffle(list,rng){for(let i=list.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[list[i],list[j]]=[list[j],list[i]];}return list;}
  function maze(seed){
    const rng=rngFor(seed),map=Array.from({length:H},()=>Array(W).fill('#')),visited=Array.from({length:CY},()=>Array(CX).fill(false)),stack=[[0,0]],dirs=[[1,0],[-1,0],[0,1],[0,-1]];
    visited[0][0]=true;map[1][1]='.';
    while(stack.length){
      const [x,y]=stack[stack.length-1];
      const choices=shuffle([...dirs],rng).filter(([dx,dy])=>{const nx=x+dx,ny=y+dy;return nx>=0&&nx<CX&&ny>=0&&ny<CY&&!visited[ny][nx];});
      if(!choices.length){stack.pop();continue;}
      const [dx,dy]=choices[0],nx=x+dx,ny=y+dy,gx=x*2+1,gy=y*2+1,ngx=nx*2+1,ngy=ny*2+1;
      map[gy+dy][gx+dx]='.';map[ngy][ngx]='.';visited[ny][nx]=true;stack.push([nx,ny]);
    }
    return{map,rng};
  }
  function buildLevel(index){
    const{map,rng}=maze(SEEDS[index]),start=[1,1],goal=[W-2,H-2];map[start[1]][start[0]]='S';map[goal[1]][goal[0]]='G';
    const free=[];
    for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){if(map[y][x]!=='.')continue;const ds=Math.abs(x-start[0])+Math.abs(y-start[1]),dg=Math.abs(x-goal[0])+Math.abs(y-goal[1]);if(ds>3&&dg>3)free.push([x,y]);}
    shuffle(free,rng);const take=ch=>{const p=free.shift();if(p)map[p[1]][p[0]]=ch;return p;};
    const shardCount=index<4?2:index<8?3:4;for(let i=0;i<shardCount;i++)take('*');
    const pitCount=index===0?0:Math.min(4,1+Math.floor(index/3));for(let i=0;i<pitCount;i++)take('O');
    const bumperCount=index<3?0:Math.min(4,1+Math.floor((index-3)/2));for(let i=0;i<bumperCount;i++)take('B');
    const iceCount=index<2?0:Math.min(7,2+Math.floor(index/2));for(let i=0;i<iceCount;i++)take('~');
    if(index>=4){const arrows=['>','<','^','v'],boostCount=Math.min(5,1+Math.floor((index-4)/2));for(let i=0;i<boostCount;i++)take(arrows[Math.floor(rng()*arrows.length)]);}
    return Object.freeze({name:NAMES[index],par:38+index*5,map:Object.freeze(map.map(row=>row.join('')))});
  }
  const levels=Array.from({length:12},(_,i)=>buildLevel(i));
  levels.forEach((level,index)=>{if(level.map.length!==H||level.map.some(row=>row.length!==W))throw new Error(`Neon Tilt: level ${index+1} has invalid dimensions`);const flat=level.map.join('');if((flat.match(/S/g)||[]).length!==1||(flat.match(/G/g)||[]).length!==1)throw new Error(`Neon Tilt: level ${index+1} needs exactly one S and G`);});
  window.NeonTiltLevels=Object.freeze(levels);
})();
