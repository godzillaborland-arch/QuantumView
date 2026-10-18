import { reduceMotion } from './util.js';

// Screen-space overlay drawn on a 2D canvas above the 3D view:
// windshield smudge per lost sensor, golden wiper sweep, mental static, and colour flashes.
export function createFx(canvas){
  const ctx=canvas.getContext('2d');
  let W=0, H=0, flashA=0, flashCol='217,169,62', wiperT=0;
  const noise=[]; for(let i=0;i<70;i++) noise.push([Math.random(),Math.random(),Math.random()*360,Math.random()*3+2]);

  function resize(){
    const r=canvas.getBoundingClientRect(), dpr=Math.min(2, devicePixelRatio||1);
    W=r.width; H=r.height; canvas.width=Math.round(W*dpr); canvas.height=Math.round(H*dpr); ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  // rect (CSS px, top-left origin) limits drawing to one player's half in split screen;
  // clear=false lets a second instance draw onto the same canvas after the first.
  function draw(S, dt, rect=null, clear=true){
    flashA=Math.max(0, flashA-dt*1.6); if(wiperT>0) wiperT-=dt;
    if(clear) ctx.clearRect(0,0,W,H);
    const fullW=W, fullH=H;
    ctx.save();
    if(rect){ ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip(); ctx.translate(rect.x, rect.y); W=rect.w; H=rect.h; }
    try { paint(S); } finally { ctx.restore(); W=fullW; H=fullH; }
  }
  function paint(S){
    const c=S.calm;

    if(S.sensors<3){
      const a=(3-S.sensors)*0.2;
      for(const [x0,x1] of [[0,W*0.28],[W,W*0.72]]){
        const g=ctx.createRadialGradient(x0,0,0,x0,0,H*0.5);
        g.addColorStop(0,`rgba(52,44,40,${a})`); g.addColorStop(1,'rgba(52,44,40,0)');
        ctx.fillStyle=g; ctx.beginPath(); ctx.moveTo(x0,0); ctx.lineTo(x1,0); ctx.lineTo(x0,H*0.45); ctx.closePath(); ctx.fill();
      }
    }
    if(wiperT>0){
      // A golden wiper blade sweeps left to right from a pivot under the windshield, leaving a fading clean wedge.
      const p=1-wiperT/0.8, e=p*p*(3-2*p), a=Math.PI+e*Math.PI, R=Math.hypot(W,H), px=W/2, py=H*1.05;
      const trail=0.55, a0=Math.max(Math.PI, a-trail);
      const g=ctx.createRadialGradient(px,py,0,px,py,R);
      g.addColorStop(0,'rgba(242,213,138,0)'); g.addColorStop(0.35,`rgba(242,213,138,${0.16*Math.sin(p*Math.PI)})`); g.addColorStop(1,'rgba(242,213,138,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.moveTo(px,py); ctx.arc(px,py,R,a0,a); ctx.closePath(); ctx.fill();
      ctx.strokeStyle=`rgba(255,236,180,${0.75*Math.sin(p*Math.PI)})`; ctx.lineWidth=3; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(px+Math.cos(a)*H*0.25, py+Math.sin(a)*H*0.25); ctx.lineTo(px+Math.cos(a)*R, py+Math.sin(a)*R); ctx.stroke();
    }
    if(c<0.8 && !reduceMotion && S.running){
      const a=0.2*(1-c), k=Math.floor(S.t*12), n=Math.floor((W<600?25:70)*(1-c));
      for(let i=0;i<n;i++){
        const p=noise[(i+k)%noise.length];
        ctx.fillStyle=`hsla(${p[2]},80%,65%,${a})`;
        ctx.fillRect(((p[0]+i*0.137+k*0.071)%1)*W, ((p[1]+i*0.291+k*0.053)%1)*H, p[3], 1.5);
      }
    }
    if(flashA>0){ ctx.fillStyle=`rgba(${flashCol},${0.24*flashA})`; ctx.fillRect(0,0,W,H); }
  }

  return {
    resize, draw,
    get size(){ return { w:W, h:H }; },
    flash(col, a=1){ flashCol=col; flashA=a; },
    wipe(){ wiperT=0.8; },
    reset(){ flashA=0; wiperT=0; }
  };
}
