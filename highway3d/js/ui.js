import { $ } from './util.js';
import { GOAL } from './data.js';

// DOM-only HUD helpers. They read game state but never change it.
export const ICON = {
  on:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12"/></svg>',
  off:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  pause:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
  play:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l11 7-11 7z"/></svg>',
};

let toastTimer = 0;
export function toast(msg, warn=false, dur=1.1){
  const el=$('toast'); el.textContent=msg; el.classList.toggle('warn',warn); el.classList.toggle('show',!!msg); toastTimer=dur;
}
export function tickToast(dt){ if(toastTimer>0){ toastTimer-=dt; if(toastTimer<=0) $('toast').classList.remove('show'); } }

export function hudSensors(S){ for(let i=0;i<3;i++) $('s'+i).classList.toggle('off', i>=S.sensors); }

function apb(S){
  $('apbA').classList.toggle('active', S.answered>=3 || S.stage>=2);
  $('apbP').classList.toggle('active', S.answered>=6 || S.stage>=3);
  $('apbB').classList.toggle('active', S.arrived || S.answered>=GOAL);
}

export function hudMode(S){
  const m=$('mode'); m.classList.remove('assist','fsd','off');
  if(S.over){ m.textContent='DISENGAGED'; m.classList.add('off'); return; }
  if(S.stage===3){ m.textContent='FSD ENGAGED'; m.classList.add('fsd'); }
  else if(S.stage===2){ m.textContent='LANE ASSIST'; m.classList.add('assist'); }
  else m.textContent='MANUAL MODE';
  apb(S);
}

let lastHud = '';
export function updateHud(S){
  const score=Math.floor(S.score).toLocaleString(), speed=Math.round((S.running?S.v:0)*6.2)+' mph'+(S.throttle && S.throttle!==1 ? ` ×${S.throttle.toFixed(1)}` : '');
  const C=S.camp;
  let label='Answered', q = S.loop ? `${S.answered} total` : `${S.answered} / ${GOAL}`;
  // After reaching Dhyāna the goal is met, so count onward instead of showing 14 / 10.
  if(S.arrived && !C){ label='Beyond Dhyāna'; q=`${Math.max(0, S.answered-(S.arrivedAt ?? GOAL))} more`; }
  if(C){
    label=`Chapter ${C.ch+1}`;
    q = C.boss ? `BOSS ${'●'.repeat(C.boss.hits)}${'✕'.repeat(C.boss.misses)}${'○'.repeat(Math.max(0,3-C.boss.hits-C.boss.misses))}` : `${C.correct} / ${C.def.goal} gates`;
  }
  const key = score+speed+q+label;
  if(key!==lastHud){ lastHud=key; $('score').textContent=score; $('speed').textContent=speed; $('qcount').textContent=q; $('qlabel').textContent=label; $('qcount').classList.toggle('boss', !!(C&&C.boss)); }
  const spent = S.stage>=3;
  $('pulseBtn').classList.toggle('spent', spent);
  $('pulseFill').style.transform = `scaleY(${spent ? 1 : Math.max(0, S.pulseCool/10)})`;
  apb(S);
}

export function showQuiz(text, chips, eyebrow=null, boss=false){
  $('qtext').textContent=text;
  $('qeyebrow').textContent = eyebrow || 'Toll gate ahead · steer into the answer';
  $('quiz').classList.toggle('boss', boss); // red styling only for boss gates (not race or reflection headings)
  [...$('qchips').children].forEach((c,i)=>c.textContent=chips[i]);
  $('lesson').hidden=true; $('quiz').hidden=false;
}

let lessonT = 0;
export function lesson(ok, q, streak, eyebrow=null){
  const el=$('lesson'); el.classList.toggle('miss',!ok);
  $('lEyebrow').textContent = eyebrow || (ok ? (streak>1?`Correct · streak ×${streak}`:'Correct') : 'Not quite · the right gate was');
  $('lTitle').textContent=q.a[0]; $('lWhy').textContent=q.why;
  el.hidden=false; lessonT = ok ? 3.6 : 4.6;
}
export function tickLesson(dt){ if(lessonT>0){ lessonT-=dt; if(lessonT<=0) $('lesson').hidden=true; } }
export function hidePrompts(){ $('quiz').hidden=true; $('lesson').hidden=true; lessonT=0; hideBanner(); }

// Big stage-change banner. kind 'fsd' (mint, headline) or 'assist' (gold, shorter). seconds = how long it stays.
let bannerTimer = null;
export function stageBanner(kind, eyebrow, title, sub, seconds){
  const el=$('stageBanner'); if(!el) return;
  $('sbEyebrow').textContent=eyebrow; $('sbTitle').textContent=title; $('sbSub').textContent=sub;
  el.classList.toggle('assist', kind==='assist');
  el.style.setProperty('--sb-dur', seconds+'s');
  el.hidden=true; void el.offsetWidth; el.hidden=false; // restart the animation
  clearTimeout(bannerTimer); bannerTimer=setTimeout(hideBanner, seconds*1000);
}
export function hideBanner(){ clearTimeout(bannerTimer); const el=$('stageBanner'); if(el) el.hidden=true; }
