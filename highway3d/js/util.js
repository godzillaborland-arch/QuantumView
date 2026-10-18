export const store = {
  get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
  set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
};
export const $ = id => document.getElementById(id);
export const lerp = (a,b,t) => a+(b-a)*t;
export const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
export function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.random()*(i+1)|0; [a[i],a[j]]=[a[j],a[i]]; } return a; }
export const pick = a => a[Math.random()*a.length|0];
export function rng(seed){ return ()=>{ seed=(seed*16807)%2147483647; return (seed-1)/2147483646; }; }
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const coarse = matchMedia('(pointer: coarse)').matches;

// Word-wraps text to fit a box, shrinking the font until it does. Returns { fs, lines }.
export function fitText(g, text, maxW, maxH, startFs, family, weight=''){
  for(let fs=startFs; fs>=8; fs-=1){
    g.font=`${weight}${fs}px ${family}`; const lines=wrap(g,text,maxW);
    if(lines.length*fs*1.15<=maxH && lines.every(l=>g.measureText(l).width<=maxW)) return {fs,lines};
  }
  g.font=`${weight}8px ${family}`; return {fs:8, lines:wrap(g,text,maxW)};
}
function wrap(g,text,maxW){
  const words=text.split(' '), lines=[]; let cur='';
  for(const w of words){ const t=cur?cur+' '+w:w; if(g.measureText(t).width>maxW && cur){ lines.push(cur); cur=w; } else cur=t; }
  if(cur) lines.push(cur); return lines;
}
