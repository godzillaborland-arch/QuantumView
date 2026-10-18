import { $, store } from './util.js';
import { CARZ } from './data.js';
import { CHAPTERS } from './campaign.js';
import { G, start, startChapter, showChapterIntro, keepDriving, steer, firePulse, setPaused } from './game.js';
import { startVersus, exitVersus, vsSteer, vsPulse } from './versus.js';

// Secret perpetual demo: an attract loop for a kiosk, a booth screen or capturing footage.
// It cycles through the whole game forever, driven by bots that read, dodge, pulse and sometimes
// pick the wrong gate (so lessons and wrecks show too). Visitor input is ignored; only the secret exits.
// It never touches campaign stars or best scores.
const PLAN = [
  { kind:'chapter', ch:0 },
  { kind:'chapter', ch:1 },
  { kind:'versus' },
  { kind:'chapter', ch:2 },
  { kind:'free' },
];
const SEGMENT_MAX = 420;     // seconds: watchdog that skips a segment if anything ever stalls
const CRUISE = 40;           // seconds of calm FSD cruising after free drive reaches Dhyāna
const OUTRO = 7;             // seconds a result or arrival card stays up

let on = false, seg = -1, phase = '', t = 0, segT = 0, brains = [], savedMode = 'discovery', exitToMenu = () => {};
export const isPerpetual = () => on;
export function initPerpetual({ toMenu }){ exitToMenu = toMenu; }

const brain = accuracy => ({ accuracy, quiz:null, target:0, wait:0, step:0 });

function danger(objs, lane, reach, pid){
  return objs.some(o=>!o.hit && !(o.gone && o.gone[pid]) && o.z>CARZ && o.z<reach
    && (o.lane===lane || (o.kind==='drifter' && !o.shifted && o.to===lane)));
}

// A human-ish driver: reads the question for a moment, then commits to a lane; dodges what it sees coming.
function drive(S, p, pid, b, dt, steerFn, pulseFn){
  if(p.over || !S.running || S.paused) return;
  b.step -= dt;
  const Q = S.quiz;
  if(Q){
    if(b.quiz !== Q){
      b.quiz = Q; b.wait = 0.7 + Math.random()*0.9;
      b.target = (Q.endless || Math.random() < b.accuracy) ? Q.lanes[0] : Q.lanes[1 + (Math.random()*2|0)];
    }
    b.wait -= dt;
    if(b.wait<=0 && b.step<=0 && p.tt>=1 && p.lane!==b.target){ steerFn(b.target>p.lane ? 1 : -1); b.step = 0.3 + Math.random()*0.15; }
    return;
  }
  if(p.stage>=3 || b.step>0 || p.tt<1) return;
  if(danger(S.objs, p.lane, 14, pid)){
    if(p.pulseCool<=0 && Math.random()<0.2){ pulseFn(); b.step = 0.6; return; }
    const safe = [-1,0,1].filter(l=>!danger(S.objs, l, 22, pid)).sort((a,c)=>Math.abs(a-p.lane)-Math.abs(c-p.lane));
    if(safe.length && safe[0]!==p.lane){ steerFn(safe[0]>p.lane ? 1 : -1); b.step = 0.22 + Math.random()*0.12; }
    else b.step = 0.15;
  }
}

function next(){
  if(G.S.versus) exitVersus();
  seg = (seg+1) % PLAN.length; segT = 0; t = 0;
  G.mode = 'discovery'; // mistakes never end a run, so every segment always finishes
  const s = PLAN[seg];
  brains = [brain(0.85), brain(0.7)];
  if(s.kind==='chapter'){ showChapterIntro(s.ch); phase = 'intro'; t = 4.5; }
  else if(s.kind==='versus'){ startVersus(Math.random()*CHAPTERS.length|0); phase = 'run'; }
  else { brains[0] = brain(0.9); start(0); phase = 'run'; }
}

export function tickPerpetual(dt){
  if(!on) return;
  const S = G.S, s = PLAN[seg];
  segT += dt;
  if(S.paused) setPaused(false);
  if(segT > SEGMENT_MAX) return next();

  const driveAll = () => {
    if(S.versus) S.players.forEach((p,i)=>drive(S, p, i, brains[i], dt, d=>vsSteer(i,d), ()=>vsPulse(i)));
    else drive(S, S, 0, brains[0], dt, steer, firePulse);
  };

  // Result cards appear on short real-time delays; if one lands after its segment ended, clear it.
  if(phase==='intro' || phase==='run' || phase==='cruise')
    for(const id of ['resultOv','arriveOv','endOv','vsEndOv','pauseOv']) if(!$(id).hidden) $(id).hidden = true;

  switch(phase){
    case 'intro':
      if((t -= dt) <= 0){ startChapter(s.ch); phase = 'run'; }
      break;
    case 'run':
      if(S.running) driveAll();
      else { phase = 'outro'; t = OUTRO; }
      break;
    case 'outro':
      if((t -= dt) > 0) break;
      if(s.kind==='free'){ keepDriving(); phase = 'cruise'; t = CRUISE; }
      else next();
      break;
    case 'cruise':
      driveAll();
      if((t -= dt) <= 0) next();
      break;
  }
}

export function startPerpetual({ clean=false }={}){
  if(on) return;
  on = true; G.perpetual = true; G.demo = false; savedMode = G.mode;
  store.set('htd-perpetual', clean ? 'clean' : '1');
  $('stage').classList.add('perpetual'); $('demoTag').hidden = true;
  $('perpetualTag').hidden = clean;
  seg = -1; next();
}

export function stopPerpetual(){
  if(!on) return;
  on = false; G.perpetual = false;
  store.set('htd-perpetual', '0');
  $('stage').classList.remove('perpetual'); $('perpetualTag').hidden = true;
  G.mode = savedMode;
  exitToMenu();
  setTimeout(()=>{ if(!on) for(const id of ['resultOv','arriveOv','endOv','vsEndOv']) $(id).hidden = true; }, 1600);
}

export const togglePerpetual = opts => on ? stopPerpetual() : startPerpetual(opts);
