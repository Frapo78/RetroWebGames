(() => {
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),len=(x,y)=>Math.hypot(x,y);
  function resolveCircleRect(ball,rect,restitution=.42){
    const cx=clamp(ball.x,rect.x,rect.x+rect.w),cy=clamp(ball.y,rect.y,rect.y+rect.h);let dx=ball.x-cx,dy=ball.y-cy,dist=len(dx,dy);if(dist>=ball.r)return false;
    if(dist<1e-6){const left=Math.abs(ball.x-rect.x),right=Math.abs(rect.x+rect.w-ball.x),top=Math.abs(ball.y-rect.y),bottom=Math.abs(rect.y+rect.h-ball.y),min=Math.min(left,right,top,bottom);if(min===left){dx=-1;dy=0;dist=1;}else if(min===right){dx=1;dy=0;dist=1;}else if(min===top){dx=0;dy=-1;dist=1;}else{dx=0;dy=1;dist=1;}}
    const nx=dx/dist,ny=dy/dist,penetration=ball.r-dist;ball.x+=nx*penetration;ball.y+=ny*penetration;const vn=ball.vx*nx+ball.vy*ny;if(vn<0){ball.vx-=(1+restitution)*vn*nx;ball.vy-=(1+restitution)*vn*ny;}return true;
  }
  function resolveBumper(ball,bumper){let dx=ball.x-bumper.x,dy=ball.y-bumper.y,d=len(dx,dy);const minD=ball.r+bumper.r;if(d>=minD)return false;if(d<1e-5){dx=1;dy=0;d=1;}const nx=dx/d,ny=dy/d;ball.x+=nx*(minD-d);ball.y+=ny*(minD-d);const speed=Math.max(3.8,len(ball.vx,ball.vy)*1.04);ball.vx=nx*speed;ball.vy=ny*speed;return true;}
  function circleHit(a,b,extra=0){const rr=a.r+b.r+extra,dx=a.x-b.x,dy=a.y-b.y;return dx*dx+dy*dy<=rr*rr;}
  function pointInRect(x,y,rect){return x>=rect.x&&x<=rect.x+rect.w&&y>=rect.y&&y<=rect.y+rect.h;}
  function step(ball,world,input,dt,difficulty=1){
    const chunks=Math.max(1,Math.ceil(dt/(1/45))),sub=dt/chunks;let wallHit=false,bumperHit=null;
    for(let n=0;n<chunks;n++){
      let friction=3.15,accelScale=11.3*Math.min(1.22,difficulty);const tile=world.surfaceAt(ball.x,ball.y);if(tile==='~')friction=.72;
      let ax=input.x*accelScale,ay=input.y*accelScale;const boost=world.boostAt(ball.x,ball.y);if(boost){ax+=boost.x*15.5;ay+=boost.y*15.5;}
      ball.vx+=ax*sub;ball.vy+=ay*sub;const damping=Math.exp(-friction*sub);ball.vx*=damping;ball.vy*=damping;
      const maxSpeed=tile==='~'?8:6.6+Math.min(1.2,difficulty*.25),speed=len(ball.vx,ball.vy);if(speed>maxSpeed){const scale=maxSpeed/speed;ball.vx*=scale;ball.vy*=scale;}
      ball.x+=ball.vx*sub;ball.y+=ball.vy*sub;for(const wall of world.walls)if(resolveCircleRect(ball,wall))wallHit=true;for(const bumper of world.bumpers)if(resolveBumper(ball,bumper))bumperHit=bumper;
    }
    return{wallHit,bumperHit};
  }
  window.NeonTiltPhysics=Object.freeze({clamp,step,circleHit,pointInRect});
})();
