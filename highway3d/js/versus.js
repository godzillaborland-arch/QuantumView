import { QUESTIONS, BILLBOARDS, MODES, ZMAX, CARZ } from './data.js';
import { CHAPTERS } from './campaign.js';
import { $, shuffle, pick, coarse } from './util.js';
import { Snd } from './audio.js';
import * as UI from './ui.js';
import { G, setPaused } from './game.js';

// Local two-player race. Both cars share one road: the same vṛttis, billboards and toll gates.
// Each player has their own lane, sensors, calm, drive stage, score and Awareness Pulse.
// Objects carry gone[pid] so a vṛtti you hit or pulse away vanishes only from your view.
export const VS_GOAL = 8;
export const NAMES = ['Player 1', 'Player 2'];

function buildOrder(){
  const ix=t=>shuffle(QUESTIONS.map((q,i)=>[q,i]).filter(([q])=>q.t===t).map(([,i])=>i));
  const t1=ix(1), t2=ix(2), t3=ix(3);
  return [...t1.splice(0,3), ...t2.splice(0,3), ...t3.splice(0,2), ...shuffle([...t1,...t2,...t3])];
}

function newPlayer(id, calm){
  return { id, lane:0, carX:0, from:0, tt:1, sensors:3, calm, calmTarget:calm, stage:1, score:0, streak:0,
    answered:0, mistakes:0, pulseCool:0, idle:0, shake:0, over:false, handsHint:false, toastT:0 };
}

const stageFor = n => n>=5 ? 3 : n>=2 ? 2 : 1;
const active = S => S.players.filter(p=>!p.over);

let lastRoad = 0;
export function startVersus(road=lastRoad){
  Snd.init(); lastRoad = road;
  const def = CHAPTERS[road];
  const S = { versus:true, def, road, running:true, paused:false, t:0, dist:0, speed:def.speed, maxSpeed:def.maxSpeed, v:7,
    objs:[], bb:[], quiz:null, quizT:4.5, spawnT:1.2, order:buildOrder(), qi:0, asked:0, goal:VS_GOAL, camp:null,
    players:[newPlayer(0, def.calm0), newPlayer(1, def.calm0)] };
  G.S = S;
  ['startOv','endOv','arriveOv','helpOv','pauseOv','campOv','chapOv','resultOv','vsOv','vsEndOv'].forEach(id=>$(id).hidden=true);
  UI.hidePrompts(); $('pads').hidden=true; $('demoTag').hidden=true;
  setPaused(false);
  G.world.setTheme(def.theme); G.world.reset(); G.fx.reset(); (G.fx2 && G.fx2.reset());
  setVersusLayout(true);
  S.players.forEach(p=>{ hudPlayer(S, p); vsToast(p.id, 'Ready', false, 1.4); });
}

export function setVersusLayout(on){
  $('stage').classList.toggle('vs', on);
  $('vsHud').hidden = !on; $('vsDivider').hidden = !on;
  $('stage').classList.toggle('vs-portrait', on && innerHeight > innerWidth);
}

// ---------- Per-player HUD ----------
function hudPlayer(S, p){
  const i=p.id;
  $(`vs${i}Score`).textContent = Math.floor(p.score).toLocaleString();
  $(`vs${i}Gates`).textContent = `${p.answered} / ${S.goal}`;
  const m=$(`vs${i}Mode`); m.classList.remove('assist','fsd','off');
  if(p.over){ m.textContent='DISENGAGED'; m.classList.add('off'); }
  else if(p.stage===3){ m.textContent='FSD'; m.classList.add('fsd'); }
  else if(p.stage===2){ m.textContent='LANE ASSIST'; m.classList.add('assist'); }
  else m.textContent='MANUAL';
  for(let k=0;k<3;k++) $(`vs${i}s${k}`).classList.toggle('off', k>=p.sensors);
  const spent = p.stage>=3 || p.over;
  $(`vs${i}Pulse`).classList.toggle('spent', spent);
  $(`vs${i}PulseFill`).style.transform = `scaleY(${spent ? 1 : Math.max(0, p.pulseCool/10)})`;
}
function vsToast(i, msg, warn=false, dur=1.1){
  const el=$(`vsToast${i}`); el.textContent=msg; el.classList.toggle('warn',warn); el.classList.toggle('show',!!msg);
  G.S.players[i].toastT = dur;
}

// ---------- Controls ----------
function moveTo(p, n, auto){
  n=Math.max(-1,Math.min(1,n)); if(n===p.lane) return;
  p.from=p.carX; p.tt=0; p.lane=n; p.idle=0;
  auto ? Snd.auto() : Snd.lane();
}
export function vsSteer(pid, d){
  const S=G.S; if(!S.versus || !S.running || S.paused) return;
  const p=S.players[pid]; if(!p || p.over) return;
  moveTo(p, p.lane+d, false);
  if(p.stage===3 && !S.quiz && !p.handsHint){ p.handsHint=true; vsToast(pid, 'Hands off. FSD is driving.', false, 1.4); }
}
export function vsPulse(pid){
  const S=G.S; if(!S.versus || !S.running || S.paused) return;
  const p=S.players[pid]; if(!p || p.over || p.pulseCool>0 || p.stage>=3) return;
  p.pulseCool=10; Snd.pulse(); G.world.pulse(pid);
  for(const o of S.objs){ if(o.z<=25 && !o.gone[pid]){ o.gone[pid]=true; G.world.puff(o.x, o.z, 'shard', 0.8); } }
  vsToast(pid, 'Awareness Pulse', false, 1);
}

// ---------- Rules ----------
function danger(S, lane, reach){
  return S.objs.some(o=>o.z>CARZ && o.z<reach
    && (o.lane===lane || (o.kind==='drifter' && !o.shifted && o.to===lane))
    && !(o.kind==='mirage' && o.z>8));
}
function autopilot(S, p, dt){
  if(p.over || p.stage<2 || S.quiz || p.tt<1) return;
  // Each player's autopilot only cares about vṛttis still present in their own view.
  const objs = S.objs; S.objs = objs.filter(o=>!o.gone[p.id]);
  const reach = p.stage===3 ? 16 : 3.6;
  if(danger(S, p.lane, reach)){
    const opts=[p.lane-1,p.lane+1].filter(l=>l>=-1&&l<=1&&!danger(S,l,reach+4));
    if(opts.length){ moveTo(p, opts.length>1 ? pick(opts) : opts[0], true); if(p.stage===2) vsToast(p.id, 'Lane assist', false, 0.6); }
  } else if(p.stage===3){ p.idle+=dt; if(p.idle>1.6 && p.lane!==0 && !danger(S, 0, reach+6)) moveTo(p, p.lane>0?p.lane-1:p.lane+1, true); }
  S.objs = objs;
}

function spawnVrittis(S){
  const def=S.def, lanes=shuffle([-1,0,1]), calm=Math.min(...active(S).map(p=>p.calm));
  const n=(calm<0.45 && Math.random()<0.45) ? 2 : 1, mix=def.mix;
  for(let i=0;i<n;i++){
    const lane=lanes[i], o={ lane, x:lane, z:ZMAX, label:pick(def.vrittis), hue:pick([330,20,280,190]), kind:'vritti', gone:[false,false] };
    const r=Math.random();
    if(n===1 && r<mix.drifter){ o.kind='drifter'; o.to = lane===0 ? pick([-1,1]) : 0; o.driftAt = 16+Math.random()*14; o.hue=38; }
    else if(r<mix.drifter+mix.puddle){ o.kind='puddle'; o.label=pick(def.puddles); o.hue=28; }
    else if(r<mix.drifter+mix.puddle+mix.mirage){ o.kind='mirage'; o.hue=275; }
    S.objs.push(o);
  }
}

function spawnQuiz(S){
  const q=QUESTIONS[S.order[S.qi++ % S.order.length]], pos=shuffle([-1,0,1]);
  const words=(q.q+' '+q.a.join(' ')).split(/\s+/).length;
  S.quiz={ q, lanes:pos, phase:'read', t:MODES[G.mode].read+words*0.07, gate:null };
  UI.showQuiz(q.q, [-1,0,1].map(ln=>q.a[pos.indexOf(ln)]), `Gate ${S.asked+1} of ${S.goal} · steer into the answer`);
  for(let i=S.objs.length-1;i>=0;i--) if(S.objs[i].z<9) S.objs.splice(i,1);
}

function knockOut(S, p, why){
  p.over=true; p.toastT=0; vsToast(p.id, why, true, 2.2); Snd.wrong(); hudPlayer(S, p);
  if(!active(S).length) finish(S);
}

function resolveGate(S, Q){
  S.quiz=null; $('quiz').hidden=true;
  const results=[], marks=[];
  let best=0, anyWrong=false;
  for(const p of S.players){
    if(p.over){ marks.push(`P${p.id+1} —`); continue; }
    const k=Q.lanes.indexOf(p.lane), ok=k===0;
    results.push({ k, ok });
    const fx = p.id===0 ? G.fx : G.fx2;
    if(ok){
      p.answered++; p.streak++; p.score+=100*p.streak; best=Math.max(best, p.streak);
      if(p.sensors<3) fx.wipe();
      p.sensors=Math.min(3,p.sensors+1);
      p.calmTarget=Math.min(1, S.def.calm0 + p.answered*(1-S.def.calm0)/S.goal);
      fx.flash('217,169,62'); G.world.puff(p.lane, CARZ+0.6, 'shard', 1);
      const st=stageFor(p.answered); if(st!==p.stage){ p.stage=st; vsToast(p.id, st===3?'FSD engaged':'Lane assist engaged', false, 1.6); }
      marks.push(`P${p.id+1} ✓`);
    } else {
      anyWrong=true; p.streak=0; p.mistakes++; p.shake=1; fx.flash('224,83,61');
      p.calmTarget=Math.max(S.def.calm0, p.calmTarget-0.08);
      marks.push(`P${p.id+1} ✕`);
      if(G.mode==='mastery' || (G.mode==='challenge' && p.mistakes>=3)) knockOut(S, p, G.mode==='mastery' ? 'Wrong gate · out' : 'Third wrong gate · out');
    }
    hudPlayer(S, p);
  }
  G.world.passGate(Q, results);
  if(best) Snd.correct(best); if(anyWrong){ Snd.rattle(); if(!best) Snd.miss(); }
  UI.lesson(!anyWrong, Q.q, 0, marks.join('   ·   ')+'   ·   the right gate was');
  S.asked++;
  if(S.running && (S.asked>=S.goal || !active(S).length)) return finish(S);
  S.quizT=6;
}

function hit(S, p, o){
  o.gone[p.id]=true;
  p.sensors--; p.shake=0.6; p.streak=0; Snd.hit();
  (p.id===0 ? G.fx : G.fx2).flash(o.kind==='puddle'?'120,90,60':'224,83,61', 0.7);
  G.world.puff(o.x, CARZ+1.2, 'smoke', 0.5);
  vsToast(p.id, o.kind==='puddle' ? `Splash · ${o.label.toLowerCase()}` : `Mud · ${o.label.toLowerCase()}`, true);
  if(p.sensors<=0){
    if(G.mode==='discovery'){ p.sensors=3; p.score=Math.max(0,p.score-150); (p.id===0 ? G.fx : G.fx2).wipe(); vsToast(p.id, 'Sensors wiped. Keep driving.', false, 1.4); }
    else knockOut(S, p, 'Sensors muddied · out');
  }
  hudPlayer(S, p);
}

function finish(S){
  if(!S.running) return;
  S.running=false; UI.hidePrompts(); Snd.arrive();
  const [a,b]=S.players;
  const cmp = (b.answered-a.answered) || (b.score-a.score);
  const winner = cmp>0 ? 1 : cmp<0 ? 0 : -1;
  $('vsEndTitle').textContent = winner<0 ? 'A perfect draw' : `${NAMES[winner]} reaches Dhyāna first`;
  $('vsEndText').textContent = winner<0
    ? 'Same gates, same score. Two minds, one road.'
    : `${NAMES[winner]} cleared more gates${a.answered===b.answered ? ' and drove a cleaner line' : ''}. ${S.def.title} road, ${MODES[G.mode].name} mode.`;
  S.players.forEach(p=>{
    $(`vsEnd${p.id}Gates`).textContent = `${p.answered} / ${S.goal}`;
    $(`vsEnd${p.id}Score`).textContent = Math.floor(p.score).toLocaleString();
    $(`vsEnd${p.id}Miss`).textContent = p.mistakes;
    $(`vsEnd${p.id}`).classList.toggle('win', p.id===winner);
  });
  setTimeout(()=>{ $('vsEndOv').hidden=false; $('vsRematch').focus(); }, 1300);
}

export function exitVersus(){ setVersusLayout(false); G.world.setTheme('free'); }

export function updateVersus(dt){
  const S=G.S;
  UI.tickToast(dt); UI.tickLesson(dt);
  const ps=S.players;
  let calmSum=0;
  for(const p of ps){
    if(p.toastT>0){ p.toastT-=dt; if(p.toastT<=0) $(`vsToast${p.id}`).classList.remove('show'); }
    if(p.pulseCool>0) p.pulseCool=Math.max(0, p.pulseCool-dt);
    p.calm += (p.calmTarget-p.calm)*Math.min(1,dt*0.8); calmSum+=p.calm;
    p.tt=Math.min(1,p.tt+dt/0.24); { const e=p.tt*p.tt*(3-2*p.tt); p.carX=p.from+(p.lane-p.from)*e; }
    p.shake=Math.max(0,p.shake-dt*4);
  }
  const calm=calmSum/ps.length;
  const idle=!S.running;
  const v = S.v = idle ? 7 : S.speed*(S.quiz ? MODES[G.mode].slow : 1);
  S.dist+=v*dt; S.t+=dt;
  Snd.engine(!idle, v, calm);

  if(Math.random() < dt*(3.2*(1-calm)+0.15))
    S.bb.push({ z:ZMAX, side:Math.random()<.5?-1:1, off:Math.random(), txt:pick(BILLBOARDS), hue:pick([300,25,200,50,0]), h:0.6+Math.random()*0.9 });
  for(let i=S.bb.length-1;i>=0;i--){ S.bb[i].z-=v*dt; if(S.bb[i].z<=-2) S.bb.splice(i,1); }

  if(idle) return;
  S.speed=Math.min(S.maxSpeed, S.speed+dt*0.07);
  for(const p of active(S)) p.score+=v*dt*1.5;

  if(S.quiz){
    const Q=S.quiz;
    if(Q.phase==='read'){ Q.t-=dt; if(Q.t<=0){ Q.phase='gate'; Q.gate={z:ZMAX}; Snd.gate(); } }
    else { Q.gate.z-=v*dt; if(Q.gate.z<=CARZ){ resolveGate(S, Q); if(!S.running) return; } }
  } else { S.quizT-=dt; if(S.quizT<=0) spawnQuiz(S); }

  if(!S.quiz){ S.spawnT-=dt; if(S.spawnT<=0){ spawnVrittis(S); S.spawnT=0.85+calm*1.4+Math.random()*0.5; } }
  for(const p of ps) autopilot(S, p, dt);

  for(let i=S.objs.length-1;i>=0;i--){
    const o=S.objs[i], prev=o.z; o.z-=v*dt;
    if(o.kind==='drifter' && !o.shifted && o.z<o.driftAt){ o.shifted=true; o.lane=o.to; }
    o.x += (o.lane-o.x)*Math.min(1, dt*4.5);
    if(prev>CARZ && o.z<=CARZ){
      for(const p of ps){ if(!p.over && !o.gone[p.id] && Math.abs(o.x-p.carX)<0.55){ hit(S, p, o); if(!S.running) return; } }
    }
    if(o.z<=0.15 || o.gone.every(Boolean)) S.objs.splice(i,1);
  }
  for(const p of ps) hudPlayer(S, p);
}
