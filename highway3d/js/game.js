import { QUESTIONS, ENDLESS_PROMPTS, TIERED_VRITTIS, BILLBOARDS, GOAL, MODES, ZMAX, CARZ } from './data.js';
import { CHAPTERS, BOSS_GATES, BOSS_WINS, starsFor } from './campaign.js';
import { $, store, shuffle, pick, coarse } from './util.js';
import { Snd } from './audio.js';
import * as UI from './ui.js';

// Game rules. Renderer-agnostic: the 3D world reads G.S every frame and receives one-shot events
// (puff, passGate, boss…) through G.world; screen effects (flash, wiper) go through G.fx.
export const G = {
  S: null, mode: 'discovery', demo: false, world: null, fx: null,
  bestOf: m => +store.get('htd-best-'+m) || 0,
};

// ---------- Campaign progress (per difficulty) ----------
export function campProgress(mode=G.mode){
  try{ const p=JSON.parse(store.get('htd-camp-'+mode)); if(p && Array.isArray(p.stars)) return p; }catch(e){}
  return { unlocked:1, stars:CHAPTERS.map(()=>0) };
}
function saveCampProgress(ch, stars){
  const p=campProgress(); p.stars[ch]=Math.max(p.stars[ch]||0, stars); p.unlocked=Math.max(p.unlocked, Math.min(CHAPTERS.length, ch+2));
  store.set('htd-camp-'+G.mode, JSON.stringify(p)); return p;
}

let endlessBag = [];
function nextEndlessPrompt(){ if(!endlessBag.length) endlessBag=shuffle([...ENDLESS_PROMPTS]); return endlessBag.pop(); }
const tierIdx = t => QUESTIONS.map((q,i)=>[q,i]).filter(([q])=>q.t===t).map(([,i])=>i);

function buildOrder(){
  const ix=t=>shuffle(tierIdx(t)), t1=ix(1), t2=ix(2), t3=ix(3);
  const first=[...t1.splice(0,4), ...t2.splice(0,3), ...t3.splice(0,3)];
  return [...first, ...shuffle([...t1,...t2,...t3])];
}

export function fresh(loop=0){
  return { running:false, paused:false, t:0, dist:0, score:0, speed:9, maxSpeed:17, v:7, lane:0, carX:0, from:0, tt:1, sensors:3,
    calm:0, calmTarget:0, objs:[], spawnT:1.2, quizT:4.2, quiz:null, order:buildOrder(), qi:0,
    answered:0, mistakes:0, streak:0, loop, stage:1, shake:0, over:false, idle:0, handsHint:false,
    pulseCool:0, arrived:false, bb:[], demo:null, camp:null, throttle:1 };
}
G.S = fresh();

function stageFor(n){
  const S=G.S, C=S.camp;
  if(C){ if(C.boss) return C.def.stages[C.def.stages.length-1]; return C.def.stages[Math.min(C.correct, C.def.stages.length-1)]; }
  return S.loop ? 3 : (n>=6 ? 3 : n>=3 ? 2 : 1);
}

export function moveTo(n, auto){
  const S=G.S; n=Math.max(-1,Math.min(1,n)); if(n===S.lane) return;
  S.from=S.carX; S.tt=0; S.lane=n; S.idle=0;
  auto ? Snd.auto() : Snd.lane();
}

export function steer(d){
  const S=G.S; if(!S.running||S.paused) return;
  moveTo(S.lane+d, false);
  if(coarse && navigator.vibrate) try{ navigator.vibrate(20); }catch(e){}
  if(S.stage===3 && !S.quiz && !S.handsHint){ S.handsHint=true; UI.toast('Hands off. The car is driving.', false, 1.6); }
}

// Player speed control: 0.6× to 1.6× of the road's pace. Faster scores more per second; slower gives more reading time.
export const THROTTLE_MIN = 0.6, THROTTLE_MAX = 1.6;
export function throttle(d){
  const S=G.S; if(!S.running || S.paused || S.versus) return;
  const t = Math.round(Math.min(THROTTLE_MAX, Math.max(THROTTLE_MIN, S.throttle + d*0.2))*10)/10;
  if(t===S.throttle){ UI.toast(d>0 ? 'Top speed' : 'Slowest speed', false, 0.8); return; }
  S.throttle = t; Snd.tone(d>0 ? 520 : 330, 0.12, 'triangle', 0.06, 0, d>0 ? 700 : 240);
  UI.toast(`${d>0 ? 'Faster' : 'Slower'} · ×${t.toFixed(1)}`, false, 0.8);
}

export function firePulse(){
  const S=G.S; if(!S.running || S.paused || S.pulseCool>0 || S.stage>=3) return;
  S.pulseCool=10; Snd.pulse(); G.world.pulse();
  for(let i=S.objs.length-1;i>=0;i--){ const o=S.objs[i]; if(o.z<=25){ G.world.puff(o.x, o.z, 'shard', 1); S.objs.splice(i,1); } }
  UI.toast('Awareness Pulse', false, 1.2);
}

export function setPaused(p, why){
  const S=G.S; S.paused=p;
  $('pauseBtn').innerHTML=p?UI.ICON.play:UI.ICON.pause; $('pauseBtn').setAttribute('aria-label', p?'Resume':'Pause');
  const show = p && !!why; $('pauseOv').hidden=!show;
  if(show){ $('pauseWhy').textContent=why; $('resumeBtn').focus({preventScroll:true}); }
}

export function showBest(){
  const b=G.bestOf(G.mode);
  $('bestLine').textContent = b ? `Best ${MODES[G.mode].name} free-drive score on this device: ${b.toLocaleString()}` : `${QUESTIONS.length} questions from the book. Three chapters, three bosses.`;
}

const OVERLAYS = ['startOv','endOv','arriveOv','helpOv','pauseOv','campOv','chapOv','resultOv'];
function begin(S){
  G.S=S; S.running=true;
  OVERLAYS.forEach(id=>$(id).hidden=true);
  UI.hidePrompts(); $('pads').hidden=false;
  setPaused(false); if(!G.demo) $('demoTag').hidden=true;
  G.world.reset(); G.fx.reset();
  UI.hudSensors(S); UI.hudMode(S); UI.updateHud(S);
}

// Free drive: the original endless game.
export function start(loop=0){
  Snd.init();
  const S=fresh(loop); S.speed=9+loop*2.5; S.maxSpeed=17+loop*3;
  G.world.setTheme('free');
  begin(S); S.stage=stageFor(0); UI.hudMode(S);
  if(!loop) UI.toast('Manual mode. You are driving.', false, 1.8);
}

// Campaign chapter.
export function startChapter(ch){
  Snd.init();
  const def=CHAPTERS[ch], S=fresh(0);
  S.camp={ ch, def, correct:0, misses:0, pool:shuffle(tierIdx(def.tier)), missed:[], boss:null };
  S.speed=def.speed; S.maxSpeed=def.maxSpeed; S.calm=S.calmTarget=def.calm0; S.quizT=4.5;
  G.world.setTheme(def.theme);
  begin(S); S.stage=stageFor(0); UI.hudMode(S);
  UI.toast(`Chapter ${ch+1} · ${def.title}`, false, 2.4);
}

function saveBest(){ const sc=Math.floor(G.S.score), k='htd-best-'+G.mode; if(!G.demo && !G.perpetual && !G.S.camp && sc>G.bestOf(G.mode)) store.set(k,String(sc)); return sc; }

function gameOver(reason, q){
  const S=G.S;
  if(S.camp) return chapterFail(reason, q);
  S.running=false; S.over=true; UI.hudMode(S); UI.hidePrompts(); $('pads').hidden=true;
  Snd.wrong(); const sc=saveBest();
  $('endTitle').textContent = q ? 'Wrong gate. Back in manual mode.' : 'Sensors muddied. Autopilot disengaged.';
  $('endReason').textContent=reason; $('endAnswer').hidden=!q;
  if(q){ $('endCorrect').textContent=q.a[0]; $('endWhy').textContent=q.why; }
  $('endScore').textContent=sc.toLocaleString(); $('endQ').textContent=S.answered; $('endBest').textContent=G.bestOf(G.mode).toLocaleString();
  setTimeout(()=>{ $('endOv').hidden=false; $('againBtn').focus(); }, 900);
  showBest();
}

let demoTimer=null;
function arrive(campaign=false){
  const S=G.S; S.running=false; UI.hidePrompts(); $('pads').hidden=true; Snd.arrive();
  const sc=saveBest(), name=MODES[G.mode].name;
  $('arrTitle').textContent = campaign ? 'Campaign complete. The car has always been self-driving.' : 'The car has always been self-driving.';
  $('arrText').textContent = campaign
    ? 'Three chapters, three bosses. The restless city, the muddy lens and the last mirage of pride are behind you. The fuel was always infinite and the destination always set.'
    : 'Ten gates, cleared. The fuel has always been infinite, and the destination has always been set. You just needed to understand the system well enough to let go of the wheel.';
  $('arrScore').textContent=sc.toLocaleString(); $('arrSens').textContent=S.sensors; $('arrMode').textContent=name;
  const stars = campaign ? campProgress().stars.reduce((a,b)=>a+b,0) : 0;
  $('shareText').textContent = campaign
    ? `I finished the Highway to Dhyāna campaign in ${name} mode with ${stars} of ${CHAPTERS.length*3} stars. Can you? https://theselfdrivingmind.com/highway3d/`
    : `I reached Dhyāna on Highway to Dhyāna: ${sc.toLocaleString()} points in ${name} mode. Can you? https://theselfdrivingmind.com/highway3d/`;
  $('shareNote').textContent='';
  setTimeout(()=>{ $('arriveOv').hidden=false; if(!G.demo) $('shareBtn').focus(); }, 1400);
  if(G.demo){ clearTimeout(demoTimer); demoTimer=setTimeout(()=>{ if(G.demo) keepDriving(); }, 5000); }
  showBest();
}

export function keepDriving(){
  const S=G.S; $('arriveOv').hidden=true; S.running=true; S.stage=3; S.calmTarget=1; S.over=false; $('pads').hidden=false;
  if(S.camp){ S.camp=null; S.qi=QUESTIONS.length; S.quizT=4; G.world.hideBoss(); } // endless reflection portals
  UI.hudMode(S); UI.updateHud(S);
}

// ---------- Chapter results ----------
function showResult({ cleared, title, text, q }){
  const S=G.S, C=S.camp, last = C.ch===CHAPTERS.length-1;
  $('resEyebrow').textContent = cleared ? `Chapter ${C.ch+1} cleared` : `Chapter ${C.ch+1} · disengaged`;
  $('resEyebrow').classList.toggle('ember', !cleared);
  $('resTitle').textContent = title; $('resText').textContent = text;
  $('resAnswer').hidden = !q; if(q){ $('resCorrect').textContent=q.a[0]; $('resWhy').textContent=q.why; }
  const stars = cleared ? starsFor(C.misses) : 0;
  $('resStars').hidden = !cleared; $('resStars').textContent = '★'.repeat(stars)+'☆'.repeat(3-stars);
  $('resStars').setAttribute('aria-label', `${stars} of 3 stars`);
  $('resScore').textContent=Math.floor(S.score).toLocaleString(); $('resGates').textContent=S.answered; $('resMiss').textContent=C.misses;
  $('resNext').textContent = cleared ? (last ? 'Finish' : 'Next chapter') : 'Retry chapter';
  $('resNext').dataset.action = cleared ? 'next' : 'retry';
  setTimeout(()=>{ $('resultOv').hidden=false; $('resNext').focus(); }, 1400);
}

function chapterClear(){
  const S=G.S, C=S.camp; S.running=false; UI.hidePrompts(); $('pads').hidden=true;
  G.world.bossDefeated(); Snd.arrive(); S.calmTarget=Math.min(1, S.calmTarget+0.2);
  const stars=starsFor(C.misses); if(!G.perpetual) saveCampProgress(C.ch, stars);
  UI.toast(`${C.def.boss.name} dissolves`, false, 2.2);
  if(C.ch===CHAPTERS.length-1){ S.arrived=true; setStageNow(3); return arrive(true); }
  showResult({ cleared:true, title:C.def.title+' · complete', text:`${C.def.boss.name} is behind you. ${stars===3?'A flawless drive.':stars===2?'One wrong gate. Close to flawless.':'Cleared. Replay for more stars.'}` });
}

function chapterFail(reason, q){
  const S=G.S, C=S.camp; S.running=false; S.over=true; UI.hudMode(S); UI.hidePrompts(); $('pads').hidden=true;
  Snd.wrong(); if(C.boss) G.world.bossWins();
  showResult({ cleared:false, title: C.boss ? `${C.def.boss.name} held the road` : 'Back in manual mode', text:reason, q });
}

export function resultAction(){
  const S=G.S, C=S.camp; if(!C) return;
  if($('resNext').dataset.action==='retry') return showChapterIntro(C.ch);
  showChapterIntro(Math.min(CHAPTERS.length-1, C.ch+1));
}

export function showChapterIntro(ch){
  const def=CHAPTERS[ch];
  OVERLAYS.forEach(id=>$(id).hidden=true);
  $('chapEyebrow').textContent=`Chapter ${ch+1} of ${CHAPTERS.length} · ${def.place}`;
  $('chapTitle').textContent=def.title; $('chapBlurb').textContent=def.blurb; $('chapHazards').textContent=def.hazards;
  $('chapGoal').textContent=`Clear ${def.goal} toll gates, then face the boss, ${def.boss.name}: win ${BOSS_WINS} of its ${BOSS_GATES} gates.`;
  $('chapBegin').dataset.ch=ch; $('chapOv').hidden=false; $('chapBegin').focus();
  G.world.setTheme(def.theme); // preview the chapter's world behind the card
}

// ---------- Demo ----------
export function startDemo(){
  G.demo=true; G.mode='discovery'; start(0); G.S.demo={ missAt:3, step:0 }; G.S.quizT=3.5;
  $('demoTag').hidden=false; $('pads').hidden=true;
}
export function exitDemo(){
  if(!G.demo) return; G.demo=false; clearTimeout(demoTimer); $('demoTag').hidden=true;
  G.S=fresh(); G.world.reset(); G.fx.reset();
  OVERLAYS.forEach(id=>$(id).hidden=true); UI.hidePrompts(); $('pads').hidden=true;
  G.mode=(document.querySelector('input[name=mode]:checked')||{}).value||'discovery';
  $('startOv').hidden=false; UI.hudMode(G.S); UI.hudSensors(G.S); UI.updateHud(G.S); UI.toast('',false,0.01);
}

// Autopilot sees a drifter's destination lane before it moves, but cannot see a mirage until it is close.
function danger(lane, reach, autopilot=false){
  return G.S.objs.some(o=>!o.hit && o.z>CARZ && o.z<reach
    && (o.lane===lane || (o.kind==='drifter' && !o.shifted && o.to===lane))
    && !(autopilot && o.kind==='mirage' && o.z>8));
}

function demoBot(dt){
  const S=G.S, D=S.demo; if(!D) return;
  D.step-=dt;
  if(S.quiz){
    S.quiz.botT=(S.quiz.botT||0)+dt;
    if(S.quiz.botT>1.1 && D.step<=0){
      const asked=S.answered+S.mistakes+1;
      const target = asked===D.missAt ? S.quiz.lanes[1] : S.quiz.lanes[0];
      if(S.lane!==target){ moveTo(S.lane+(target>S.lane?1:-1), false); D.step=0.32; }
    }
    return;
  }
  if(S.stage<3 && D.step<=0 && danger(S.lane,15)){
    if(S.pulseCool<=0 && Math.random()<0.2){ firePulse(); D.step=0.5; }
    else {
      const safe=[-1,0,1].filter(l=>!danger(l,22));
      if(safe.length){ const target=pick(safe); if(S.lane!==target){ moveTo(S.lane+(target>S.lane?1:-1), false); D.step=0.25; } }
    }
  }
}

function autopilot(dt){
  const S=G.S; if(S.stage<2 || S.quiz || S.tt<1) return;
  const reach = S.stage===3 ? 16 : 3.6;
  if(danger(S.lane, reach, true)){
    const opts=[S.lane-1,S.lane+1].filter(l=>l>=-1&&l<=1&&!danger(l,reach+4,true));
    if(opts.length){ moveTo(opts.length>1 ? pick(opts) : opts[0], true); if(S.stage===2) UI.toast('Lane assist', false, 0.7); }
    return;
  }
  if(S.stage===3){ S.idle+=dt; if(S.idle>1.6 && S.lane!==0 && !danger(0, reach+6, true)) moveTo(S.lane>0?S.lane-1:S.lane+1, true); }
}

function spawnVrittis(){
  const S=G.S, C=S.camp, lanes=shuffle([-1,0,1]);
  const n=(!G.demo && S.calm<0.45 && Math.random()<0.45) ? 2 : 1;
  const list = C ? C.def.vrittis : (TIERED_VRITTIS[S.stage] || TIERED_VRITTIS[1]);
  const mix = C ? C.def.mix : { drifter:0, puddle:0, mirage:0 };
  for(let i=0;i<n;i++){
    const lane=lanes[i], o={ lane, x:lane, z:ZMAX, label:pick(list), hue:pick([330,20,280,190]), kind:'vritti' };
    const r=Math.random();
    // A drifter only spawns alone, so a free lane always remains.
    if(n===1 && r<mix.drifter){ o.kind='drifter'; o.to = lane===0 ? pick([-1,1]) : 0; o.driftAt = 16+Math.random()*14; o.hue=38; }
    else if(r<mix.drifter+mix.puddle){ o.kind='puddle'; o.label=pick(C.def.puddles); o.hue=28; }
    else if(r<mix.drifter+mix.puddle+mix.mirage){ o.kind='mirage'; o.hue=275; }
    S.objs.push(o);
  }
}

function nextCampQuestion(){
  const C=G.S.camp;
  if(!C.pool.length) C.pool=shuffle(C.missed.splice(0));
  if(!C.pool.length) C.pool=shuffle(tierIdx(C.def.tier));
  return C.pool.pop();
}

function spawnQuiz(){
  const S=G.S, C=S.camp;
  if(!C && S.qi>=QUESTIONS.length){
    const prompt=nextEndlessPrompt();
    S.quiz={ q:{q:prompt, a:[prompt,prompt,prompt], why:'The journey continues in stillness.'}, lanes:[-1,0,1], phase:'read', t:2, gate:null, endless:true };
    UI.showQuiz(prompt, ['STEER HERE','STEER HERE','STEER HERE']);
  } else {
    const idx = C ? nextCampQuestion() : S.order[S.qi++], q=QUESTIONS[idx], pos=shuffle([-1,0,1]);
    const words=(q.q+' '+q.a.join(' ')).split(/\s+/).length;
    const boss = !!(C && C.boss);
    S.quiz={ q, idx, lanes:pos, phase:'read', t:(MODES[G.mode].read+words*0.07)*(boss?0.9:1), gate:null, boss, bossName: boss ? C.def.boss.name : '' };
    UI.showQuiz(q.q, [-1,0,1].map(ln=>q.a[pos.indexOf(ln)]), boss ? `Boss gate · ${C.def.boss.name} · ${C.boss.hits+C.boss.misses+1} of ${BOSS_GATES}` : null);
  }
  for(let i=S.objs.length-1;i>=0;i--) if(S.objs[i].z<9) S.objs.splice(i,1);
}

function setStageNow(n){ const S=G.S; S.stage=n; UI.hudMode(S); }
function setStage(n){
  const S=G.S; if(n===S.stage) return; setStageNow(n); Snd.stage();
  if(n===2) UI.toast('Lane assist engaged. The car begins to help.', false, 2.2);
  if(n===3) UI.toast('Full Self-Driving engaged. Let go of the wheel.', false, 2.6);
}

function startBoss(){
  const S=G.S, C=S.camp; C.boss={ hits:0, misses:0 };
  G.world.showBoss(C.def.boss.name); Snd.boss(); setStage(stageFor(S.answered));
  UI.toast(`Boss ahead · ${C.def.boss.name}`, true, 2.4);
  UI.lesson(true, { a:[C.def.boss.name], why:C.def.boss.line }, 0, 'Boss');
  S.quizT=4.5;
}

function resolveGate(Q){
  const S=G.S, C=S.camp, k=Q.lanes.indexOf(S.lane);
  S.quiz=null; $('quiz').hidden=true;
  if(Q.endless){
    S.answered++; S.score+=100; setStage(3); S.quizT=5; Snd.correct(2);
    G.world.passGate(Q, k, true);
    return;
  }
  if(k===0){
    S.answered++; S.streak++; S.score+=100*S.streak*(Q.boss?2:1);
    if(S.sensors<3) G.fx.wipe();
    S.sensors=Math.min(3,S.sensors+1); UI.hudSensors(S);
    S.calmTarget = C ? Math.min(1, S.calmTarget+C.def.calmGain) : Math.min(1,S.answered/8);
    G.fx.flash('217,169,62'); Snd.correct(S.streak); UI.lesson(true, Q.q, S.streak);
    G.world.passGate(Q, k, true); G.world.puff(S.lane, CARZ+0.6, 'shard', 1.2);
    if(C){
      if(C.boss){
        C.boss.hits++; G.world.bossHit();
        if(C.boss.hits>=BOSS_WINS) return chapterClear();
        S.quizT=3;
      } else {
        C.correct++; setStage(stageFor(S.answered));
        if(C.correct>=C.def.goal) startBoss(); else S.quizT=7.5-Math.min(2, C.correct*0.4);
      }
      return;
    }
    S.quizT=8.5-Math.min(3, S.answered*0.2);
    setStage(stageFor(S.answered));
    if(!S.arrived && S.answered>=GOAL){ S.arrived=true; UI.updateHud(S); arrive(); }
    return;
  }

  // Wrong gate
  S.streak=0; G.fx.flash('224,83,61'); G.world.passGate(Q, k, false); Snd.rattle(); S.shake=1;
  const chose=`You steered into “${Q.q.a[k]}”.`;
  if(C){
    C.misses++; S.mistakes++; C.missed.push(Q.idx);
    if(C.boss){
      C.boss.misses++; G.world.bossTaunt();
      if(C.boss.misses > BOSS_GATES-BOSS_WINS){
        if(G.mode==='discovery'){ C.boss.hits=0; C.boss.misses=0; UI.toast(`${C.def.boss.name} regathers. Try again.`, true, 2); UI.lesson(false, Q.q, 0); S.quizT=4; return; }
        return chapterFail(`${chose} ${C.def.boss.name} won ${C.boss.misses} of its gates.`, Q.q);
      }
    } else if(G.mode==='mastery' || (G.mode==='challenge' && C.misses>=3)){
      return chapterFail(chose+(G.mode==='challenge'?' That was your third wrong gate this chapter.':''), Q.q);
    }
    Snd.miss(); UI.lesson(false, Q.q, 0);
    S.calmTarget=Math.max(C.def.calm0, S.calmTarget-0.08); S.quizT = C.boss ? 3.5 : 7;
    return;
  }
  if(G.mode==='mastery' || (G.mode==='challenge' && S.mistakes+1>=3)){
    S.mistakes++; UI.updateHud(S);
    gameOver(chose+(G.mode==='challenge'?' That was your third wrong gate.':''), Q.q); return;
  }
  S.mistakes++; Snd.miss(); UI.lesson(false, Q.q, 0);
  S.calmTarget=Math.max(0, S.calmTarget-0.12); S.quizT=7.5;
}

function hitVritti(o){
  const S=G.S; o.hit=true;
  S.sensors--; UI.hudSensors(S); S.shake=0.6; S.streak=0; Snd.hit(); G.fx.flash(o.kind==='puddle'?'120,90,60':'224,83,61', 0.7);
  G.world.puff(o.x, CARZ+1.2, 'smoke', 0.6);
  if(coarse && navigator.vibrate) try{ navigator.vibrate(40); }catch(e){}
  UI.toast(o.kind==='puddle' ? `Splash · ${o.label.toLowerCase()}` : `Mud on the lens · ${o.label.toLowerCase()}`, true);
  if(S.sensors<=0){
    if(G.mode==='discovery'){ S.sensors=3; UI.hudSensors(S); S.score=Math.max(0,S.score-150); G.fx.wipe(); UI.toast('Sensors wiped clean. Keep driving.', false, 1.6); }
    else { gameOver('Three vṛttis landed on the windshield. With the sensors covered, the autopilot cannot see the road.'); return true; }
  }
  return false;
}

export function update(dt){
  const S=G.S;
  UI.tickToast(dt); UI.tickLesson(dt);
  if(S.pulseCool>0) S.pulseCool=Math.max(0, S.pulseCool-dt);

  S.calm += (S.calmTarget-S.calm)*Math.min(1,dt*0.8);
  S.tt=Math.min(1,S.tt+dt/0.24); { const e=S.tt*S.tt*(3-2*S.tt); S.carX=S.from+(S.lane-S.from)*e; }
  S.shake=Math.max(0,S.shake-dt*4);
  const idle=!S.running;
  const v = S.v = idle ? 7 : S.speed*S.throttle*(S.quiz && !S.quiz.endless ? MODES[G.mode].slow : 1);
  S.dist+=v*dt; S.t+=dt;
  Snd.engine(!idle, v, S.calm);

  if(Math.random() < dt*(3.2*(1-S.calm)+0.15))
    S.bb.push({ z:ZMAX, side:Math.random()<.5?-1:1, off:Math.random(), txt:pick(BILLBOARDS), hue:pick([300,25,200,50,0]), h:0.6+Math.random()*0.9 });
  for(let i=S.bb.length-1;i>=0;i--){ S.bb[i].z-=v*dt; if(S.bb[i].z<=-2) S.bb.splice(i,1); }

  if(idle) return;

  S.speed=Math.min(S.maxSpeed, S.speed+dt*0.07);
  S.score+=v*dt*1.5;

  if(S.quiz){
    const Q=S.quiz;
    if(Q.phase==='read'){ Q.t-=dt; if(Q.t<=0){ Q.phase='gate'; Q.gate={z:ZMAX}; Q.boss ? Snd.bossGate() : Snd.gate(); } }
    else { Q.gate.z-=v*dt; if(Q.gate.z<=CARZ){ resolveGate(Q); if(!S.running) return; } }
  } else { S.quizT-=dt; if(S.quizT<=0) spawnQuiz(); }

  if(!S.quiz){ S.spawnT-=dt; if(S.spawnT<=0){ spawnVrittis(); S.spawnT=0.85+S.calm*1.4+Math.random()*0.5; } }
  autopilot(dt);
  if(G.demo) demoBot(dt);

  for(let i=S.objs.length-1;i>=0;i--){
    const o=S.objs[i], prev=o.z; o.z-=v*dt;
    if(o.kind==='drifter' && !o.shifted && o.z<o.driftAt){ o.shifted=true; o.lane=o.to; }
    o.x += (o.lane-o.x)*Math.min(1, dt*4.5);
    if(!o.hit && prev>CARZ && o.z<=CARZ && Math.abs(o.x-S.carX)<0.55){ if(hitVritti(o)) return; }
    if(o.z<=0.15 || o.hit) S.objs.splice(i,1);
  }
  UI.updateHud(S);
}
