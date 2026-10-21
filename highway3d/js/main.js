import { $, store } from './util.js';
import { MODES } from './data.js';
import { Snd } from './audio.js';
import * as UI from './ui.js';
import { G, fresh, start, startChapter, showChapterIntro, resultAction, campProgress, steer, firePulse, throttle, setPaused, showBest, keepDriving, startDemo, exitDemo, update } from './game.js';
import { startVersus, exitVersus, updateVersus, setVersusLayout, vsSteer, vsPulse } from './versus.js';
import { CHAPTERS, EDITION, useChapters } from './campaign.js';
import { createWorld } from './world.js';
import { createFx } from './fx.js';
import { pollGamepads, connectedPads } from './gamepad.js';
import { initPerpetual, tickPerpetual, startPerpetual, togglePerpetual } from './perpetual.js';

if(location.protocol==='file:') throw new Error('Opened from a file; the guard in index.html explains how to play.');

function fail(msg){ $('fatalText').textContent = msg; $('fatal').hidden = false; $('loading').classList.add('gone'); }

// One frame: the rules advance in small fixed sub-steps covering all the real time since the last frame,
// (up to half a second per frame), so game time keeps pace with the clock even when rendering is slow
// (a weak GPU, software WebGL, a busy tab).
// Previously each frame advanced at most 0.05 s, so at a few frames per second nothing ever reached the car.
const SUB_STEP = 1/60, MAX_FRAME = 0.5;
function simulate(dt){
  if(G.perpetual) tickPerpetual(dt);
  if(!G.S.paused) (G.S.versus ? updateVersus : update)(dt);
}
function tick(dt){
  const n = Math.max(1, Math.ceil(dt/SUB_STEP - 1e-6)), h = dt/n;
  for(let i=0;i<n;i++) simulate(h);
  const S = G.S, d = S.paused ? 0 : dt;
  G.world.render(G.S, d);
  if(G.S.versus){
    const { h } = G.fx.size, rects = G.world.splitRects(2).map(r=>({ x:r.x, y:h-r.y-r.h, w:r.w, h:r.h }));
    G.S.players.forEach((p, i)=>{
      const view = { calm:p.calm, sensors:p.sensors, running:G.S.running && !p.over, t:G.S.t };
      (i===0 ? G.fx : G.fx2).draw(view, d, rects[i], i===0);
    });
  } else G.fx.draw(G.S, d);
}

async function boot(){
  try {
    await Promise.race([document.fonts.ready, new Promise(r=>setTimeout(r,1500))]);
    await Promise.all(['700 64px "JetBrains Mono"', '64px "Marcellus"'].map(f=>document.fonts.load(f).catch(()=>{})));
  } catch(e){}

  try { G.world = await createWorld($('gl')); }
  catch(e){ console.error(e); fail('This browser could not start 3D graphics (WebGL). Try an up-to-date Chrome, Edge, Safari or Firefox.'); return; }
  G.fx = createFx($('fx')); G.fx2 = createFx($('fx'));

  const resize = () => { G.world.resize(); G.fx.resize(); G.fx2.resize(); if(G.S.versus) setVersusLayout(true); };
  addEventListener('resize', resize); resize();

  bindUI();
  // Fade the loading screen, then remove it so screen readers and page-text tools stop reporting it.
  const loading = $('loading'); loading.classList.add('gone'); loading.setAttribute('aria-hidden', 'true');
  setTimeout(()=>loading.remove(), 800);

  // Perpetual demo resumes by itself after a reload or a kiosk reboot; ?perpetual (optionally &clean) starts it from a link.
  const q = new URLSearchParams(location.search), saved = store.get('htd-perpetual');
  if(q.has('perpetual') || saved==='1' || saved==='clean') startPerpetual({ clean: q.has('clean') || (!q.has('perpetual') && saved==='clean') });

  let last = performance.now(), errCount = 0;
  // Quality steps down automatically if frames stay slow: 0 = full, 1 = no bloom + lower resolution, 2 = also no shadows.
  const forced = { high:0, medium:1, low:2 }[q.get('quality')];
  let quality = forced ?? 0, slowSum = 0, slowN = 0, lastDrop = performance.now();
  if(quality) G.world.setQuality(quality);
  function watchQuality(dt, now){
    if(forced!==undefined || quality>=2 || document.hidden) return;
    slowSum += dt; slowN++;
    if(slowN < 45) return;
    const avg = slowSum/slowN; slowSum = 0; slowN = 0;
    if(avg > 0.045 && now-lastDrop > 2500){ quality++; lastDrop = now; G.world.setQuality(quality); console.info('Highway to Dhyāna: lowering graphics quality to', quality, `(${Math.round(avg*1000)} ms per frame)`); }
  }
  function frame(now){
    const raw = Math.max(0, (now-last)/1000), dt = Math.min(MAX_FRAME, raw); last = now;
    try { if(!G.perpetual) pollPads(); tick(dt); watchQuality(raw, now); }
    catch(err){
      if(++errCount < 5) console.error('Highway to Dhyāna frame error', err);
      if(G.perpetual && errCount > 30) location.reload(); // unattended screen: recover rather than freeze
    }
  }
  const loop = now => { requestAnimationFrame(loop); frame(now); };
  requestAnimationFrame(loop);
  // Backup clock: some browsers stop or heavily throttle animation frames for a visible but unfocused or
  // occluded window. If no frame has run for a while, drive one from a timer so the road never freezes.
  setInterval(()=>{ const now = performance.now(); if(!document.hidden && now-last > 300) frame(now); }, 250);

  // ?debug exposes a manual stepper for testing without relying on requestAnimationFrame.
  if(new URLSearchParams(location.search).has('debug')){
    window.__htd = {
      G, start, startChapter, startVersus, steer, firePulse, vsSteer, vsPulse, pollPads,
      step(frames=60, dt=1/60){
        for(let i=0;i<frames;i++) tick(dt);
        const S=G.S;
        return S.versus
          ? { asked:S.asked, running:S.running, quiz:!!S.quiz, objs:S.objs.length, players:S.players.map(p=>({ lane:p.lane, answered:p.answered, sensors:p.sensors, stage:p.stage, score:Math.floor(p.score), over:p.over })) }
          : { score:Math.floor(S.score), stage:S.stage, answered:S.answered, sensors:S.sensors, quiz:!!S.quiz, objs:S.objs.length, running:S.running };
      },
    };
  }
}

// ---------- Gamepads ----------
const visibleOverlay = () => [...document.querySelectorAll('.overlay')].find(o=>!o.hidden);
function focusables(ov){ return [...ov.querySelectorAll('button:not(:disabled), input[type=radio], a[href]')].filter(el=>el.offsetParent!==null || el.type==='radio'); }
function pollPads(){
  pollGamepads({
    steer(slot, d){ if(visibleOverlay()) return; G.S.versus ? vsSteer(slot, d) : (slot===0 && steer(d)); },
    pulse(slot){ if(visibleOverlay()) return; G.S.versus ? vsPulse(slot) : (slot===0 && firePulse()); },
    pause(){ if(G.S.running && $('helpOv').hidden) setPaused(!G.S.paused, 'Paused from the gamepad. The road will wait for you.'); },
    confirm(){
      const ov = visibleOverlay(); if(!ov) return;
      const el = document.activeElement && ov.contains(document.activeElement) ? document.activeElement : ov.querySelector('.btn');
      if(el) el.click();
    },
    back(){ const ov = visibleOverlay(); if(!ov) return; const b = ov.querySelector('[data-back]'); if(b) b.click(); },
    nav(slot, dir){
      const ov = visibleOverlay();
      if(!ov){ if(slot===0 && !G.S.versus && (dir==='up' || dir==='down')) throttle(dir==='up' ? 1 : -1); return; }
      const list = focusables(ov); if(!list.length) return;
      const i = list.indexOf(document.activeElement), step = (dir==='up'||dir==='left') ? -1 : 1;
      list[(i<0 ? 0 : (i+step+list.length)%list.length)].focus();
    },
  });
}

function bindUI(){
  // Difficulty picker (applies to every mode)
  let m = store.get('htd-mode'); if(!MODES[m]) m = 'discovery'; G.mode = m;
  $('m-'+m).checked = true;
  document.querySelectorAll('input[name=mode]').forEach(i=>i.addEventListener('change', ()=>{ G.mode=i.value; store.set('htd-mode', G.mode); showBest(); }));
  showBest();

  // Tool buttons
  const soundBtn = $('soundBtn');
  const drawSound = () => { soundBtn.innerHTML = Snd.muted?UI.ICON.off:UI.ICON.on; soundBtn.setAttribute('aria-label', Snd.muted?'Sound off':'Sound on'); soundBtn.setAttribute('aria-pressed', String(!Snd.muted)); };
  drawSound();
  soundBtn.addEventListener('click', e=>{ e.stopPropagation(); Snd.init(); Snd.setMuted(!Snd.muted); drawSound(); });
  $('pauseBtn').innerHTML = UI.ICON.pause;
  const togglePause = () => { if(G.S.running && $('helpOv').hidden) setPaused(!G.S.paused, 'You pressed pause. The road will wait for you.'); };
  $('pauseBtn').addEventListener('click', e=>{ e.stopPropagation(); togglePause(); });
  $('vsPauseBtn').addEventListener('click', e=>{ e.stopPropagation(); togglePause(); });
  $('resumeBtn').addEventListener('click', e=>{ e.stopPropagation(); setPaused(false); });
  $('pauseOv').addEventListener('pointerdown', e=>{ if(e.target===e.currentTarget){ e.stopPropagation(); setPaused(false); } });
  $('pulseBtn').addEventListener('click', e=>{ e.stopPropagation(); firePulse(); });
  for(const i of [0,1]) $(`vs${i}Pulse`).addEventListener('click', e=>{ e.stopPropagation(); vsPulse(i); });

  // Help
  let helpFrom = null;
  const openHelp = () => {
    helpFrom = !$('startOv').hidden ? 'start' : (G.S.running ? 'game' : null);
    if(helpFrom==='start') $('startOv').hidden = true;
    if(helpFrom==='game' && !G.S.paused) setPaused(true);
    $('helpOv').hidden = false; $('helpOv').querySelector('.card').scrollTop = 0; $('helpClose').focus({preventScroll:true});
  };
  const closeHelp = () => { $('helpOv').hidden = true; if(helpFrom==='start'){ $('startOv').hidden=false; $('campBtn').focus(); } else if(helpFrom==='game') setPaused(false); helpFrom=null; };
  $('howBtn').onclick = openHelp;
  $('helpBtn').addEventListener('click', e=>{ e.stopPropagation(); $('helpOv').hidden ? openHelp() : closeHelp(); });
  $('helpClose').onclick = closeHelp;

  const toMenu = () => {
    if(G.S.versus) exitVersus();
    G.S = fresh(); G.world.reset(); G.world.setTheme('free'); UI.hidePrompts(); $('pads').hidden = true; useChapters();
    ['endOv','arriveOv','campOv','chapOv','resultOv','vsOv','vsEndOv','pauseOv','readersOv'].forEach(id=>$(id).hidden=true);
    UI.hudMode(G.S); UI.hudSensors(G.S); UI.updateHud(G.S);
    $('startOv').hidden = false; showBest(); $('campBtn').focus();
  };

  initPerpetual({ toMenu });

  // Pause menu: restart whatever is being played, or leave to the main menu.
  $('restartBtn').addEventListener('click', e=>{
    e.stopPropagation(); const S = G.S;
    if(S.versus) startVersus(); else if(S.camp) startChapter(S.camp.ch); else start(S.loop||0);
  });
  $('quitBtn').addEventListener('click', e=>{ e.stopPropagation(); toMenu(); });

  // Campaign flow
  const showCampaign = () => {
    ['startOv','chapOv','resultOv','endOv','arriveOv'].forEach(id=>$(id).hidden=true);
    const p = campProgress(), list = $('chapterList'); list.innerHTML = '';
    $('campMode').textContent = MODES[G.mode].name;
    const readers = EDITION==='readers';
    $('campName').textContent = readers ? "Reader's Edition" : 'Campaign';
    $('campTitle').textContent = readers ? 'Three new chapters, three new bosses' : 'Three chapters, three bosses';
    CHAPTERS.forEach((ch, i) => {
      const locked = i+1 > p.unlocked, b = document.createElement('button');
      b.type='button'; b.className='chapter'; b.disabled=locked;
      const stars = p.stars[i]||0;
      b.innerHTML = `<span class="num">${i+1}</span><span class="ct"></span><span class="cs${locked?' locked':''}"></span><span class="cp"></span>`;
      b.querySelector('.ct').textContent = ch.title;
      b.querySelector('.cp').textContent = locked ? `Clear chapter ${i} to unlock` : `${ch.place} · boss: ${ch.boss.name}`;
      b.querySelector('.cs').textContent = locked ? 'LOCKED' : '★'.repeat(stars)+'☆'.repeat(3-stars);
      b.setAttribute('aria-label', `Chapter ${i+1}, ${ch.title}${locked ? ', locked' : `, ${stars} of 3 stars`}`);
      b.onclick = () => showChapterIntro(i);
      list.appendChild(b);
    });
    $('campOv').hidden = false; (list.querySelector('button:not(:disabled):last-of-type') || $('campBack')).focus();
  };
  $('campBtn').onclick = showCampaign;
  $('campBack').onclick = () => { $('campOv').hidden=true; G.world.setTheme('free'); $('startOv').hidden=false; (EDITION==='readers' ? $('readersBtn') : $('campBtn')).focus(); useChapters(); };

  // Reader's Edition: a pre-order bonus. A link with ?edition=<code>, or the code typed on its card, unlocks it
  // on this device. Its questions live in readers.js, which only loads once it is unlocked.
  const READERS_CODE = 'lifetime';
  const readersUnlocked = () => store.get('htd3d-readers')==='1';
  const tryCode = c => { if(String(c||'').trim().toLowerCase()!==READERS_CODE) return false; store.set('htd3d-readers','1'); return true; };
  const openReaders = async () => {
    if(!readersUnlocked()){ $('startOv').hidden=true; $('codeNote').textContent=''; $('readersOv').hidden=false; $('codeIn').focus(); return; }
    try { const { READERS_CHAPTERS } = await import('./readers.js'); useChapters(READERS_CHAPTERS, 'readers'); }
    catch(e){ console.error(e); $('codeNote').textContent="The Reader's Edition didn't load. Check your connection and try again."; return; }
    $('readersOv').hidden=true; showCampaign();
  };
  $('readersBtn').onclick = openReaders;
  $('readersBack').onclick = () => { $('readersOv').hidden=true; $('startOv').hidden=false; $('readersBtn').focus(); };
  $('codeForm').addEventListener('submit', e=>{
    e.preventDefault();
    if(tryCode($('codeIn').value)){ $('codeIn').value=''; openReaders(); }
    else { $('codeNote').textContent="That code didn't work. Check the spelling and try again."; $('codeIn').select(); }
  });
  { const qp = new URLSearchParams(location.search);
    if(qp.has('edition')){
      const ok = tryCode(qp.get('edition')); qp.delete('edition');
      history.replaceState(null, '', location.pathname+(qp.toString() ? '?'+qp : '')+location.hash); // don't leave the code in the address bar
      if(ok) setTimeout(()=>UI.toast("Reader's Edition unlocked. Thank you for pre-ordering.", false, 4), 700);
    } }
  $('chapBegin').onclick = () => startChapter(+$('chapBegin').dataset.ch);
  $('chapBack').onclick = showCampaign;
  $('resNext').onclick = resultAction;
  $('resChapters').onclick = showCampaign;

  // Free drive flow
  $('startBtn').onclick = () => start(0);
  $('againBtn').onclick = () => start(0);
  $('menuBtn').onclick = toMenu;
  $('keepBtn').onclick = keepDriving;

  // Two-player flow
  const roads = $('vsRoads');
  CHAPTERS.forEach((ch, i)=>{
    const l = document.createElement('label');
    l.innerHTML = `<input type="radio" name="vsroad" value="${i}"${i===0?' checked':''}><b></b><span></span>`;
    l.querySelector('b').textContent = ch.title; l.querySelector('span').textContent = ch.place;
    l.querySelector('input').addEventListener('change', ()=>G.world.setTheme(ch.theme));
    roads.appendChild(l);
  });
  const padStatus = () => {
    const n = connectedPads().length;
    $('padStatus').textContent = n===0 ? 'No gamepads detected. Press a button on a connected pad to wake it.'
      : n===1 ? '1 gamepad connected: it drives Player 1. Player 2 uses the keyboard.' : `${n} gamepads connected: pad 1 is Player 1, pad 2 is Player 2.`;
  };
  addEventListener('gamepadconnected', padStatus); addEventListener('gamepaddisconnected', padStatus);
  const showVersus = () => {
    if(G.S.versus) exitVersus();
    ['startOv','vsEndOv'].forEach(id=>$(id).hidden=true);
    $('vsModeName').textContent = MODES[G.mode].name;
    const sel = document.querySelector('input[name=vsroad]:checked'); G.world.setTheme(CHAPTERS[+sel.value].theme);
    padStatus(); $('vsOv').hidden = false; $('vsStart').focus();
  };
  $('vsBtn').onclick = showVersus;
  $('vsBack').onclick = () => { $('vsOv').hidden = true; G.world.setTheme('free'); $('startOv').hidden = false; $('vsBtn').focus(); };
  $('vsStart').onclick = () => startVersus(+document.querySelector('input[name=vsroad]:checked').value);
  $('vsRematch').onclick = () => startVersus();
  $('vsChangeRoad').onclick = showVersus;
  $('vsMenu').onclick = toMenu;

  // Share
  const copyShare = () => {
    const t=$('shareText').textContent, note=$('shareNote');
    const fallback=()=>{ const r=document.createRange(); r.selectNodeContents($('shareText')); const s=getSelection(); s.removeAllRanges(); s.addRange(r); note.textContent='Selected. Press copy on your device to copy it.'; };
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(()=>{ note.textContent='Copied. Paste it into WhatsApp, LinkedIn or anywhere.'; }, fallback); else fallback();
  };
  $('copyBtn').onclick = copyShare;
  $('shareBtn').onclick = () => { const t=$('shareText').textContent; if(navigator.share) navigator.share({ title:'Highway to Dhyāna', text:t }).catch(e=>{ if(!e || e.name!=='AbortError') copyShare(); }); else copyShare(); };

  // Keyboard. Single player: arrows or A/D, Space pulse. Two players: P1 A/D + W, P2 ←/→ + ↑.
  // Secret: typing "dhyana" anywhere toggles the perpetual demo. While it runs, every other key is ignored.
  let secret = '';
  window.addEventListener('keydown', e=>{
    if(e.target.id==='codeIn') return; // typing a code is not steering or a secret word
    if(e.key.length===1){
      secret = (secret + e.key.toLowerCase()).slice(-6);
      if(secret==='dhyana'){ secret=''; e.preventDefault(); Snd.init(); togglePerpetual(); return; }
    }
    if(G.perpetual){ e.preventDefault(); return; }
    if(G.demo){ e.preventDefault(); e.stopImmediatePropagation(); exitDemo(); return; }
    const k = e.key, S = G.S;
    if((k==='p' || k==='P' || k==='Escape') && S.running && $('helpOv').hidden){ setPaused(!S.paused, 'You pressed pause. The road will wait for you.'); return; }
    if((k===' ' || k==='Enter') && S.paused && !$('pauseOv').hidden){ setPaused(false); e.preventDefault(); return; }
    if(S.versus){
      if(!S.running || S.paused) return;
      const map = { a:[0,-1], A:[0,-1], d:[0,1], D:[0,1], ArrowLeft:[1,-1], ArrowRight:[1,1] };
      if(map[k]){ vsSteer(map[k][0], map[k][1]); e.preventDefault(); }
      else if(k==='w' || k==='W'){ vsPulse(0); e.preventDefault(); }
      else if(k==='ArrowUp'){ vsPulse(1); e.preventDefault(); }
      return;
    }
    // The old one-shot demo now needs the word "demo", so typing "dhyana" never trips it on the way.
    if(!$('startOv').hidden && secret.endsWith('demo')){ Snd.init(); startDemo(); return; }
    // On menus, leave keys to the page: arrows move between the difficulty and road options, Space/Enter press buttons.
    if(visibleOverlay() || !S.running) return;
    if(k==='ArrowLeft' || k==='a' || k==='A'){ steer(-1); e.preventDefault(); }
    else if(k==='ArrowRight' || k==='d' || k==='D'){ steer(1); e.preventDefault(); }
    else if(k===' ' && S.running && !S.paused){ firePulse(); e.preventDefault(); }
    else if(k==='ArrowUp' || k==='w' || k==='W'){ throttle(1); e.preventDefault(); }
    else if(k==='ArrowDown' || k==='s' || k==='S'){ throttle(-1); e.preventDefault(); }
  });

  // Touch and mouse: swipe to change lanes, tap left/right side. In split screen each half steers its own car.
  const stage = $('stage');
  const sideOf = (x, y) => {
    const r = stage.getBoundingClientRect(), lx = x-r.left, ly = y-r.top;
    if(!G.S.versus) return { pid:0, dir: lx < r.width/2 ? -1 : 1 };
    const portrait = r.height > r.width;
    const pid = portrait ? (ly < r.height/2 ? 0 : 1) : (lx < r.width/2 ? 0 : 1);
    const cx = portrait ? r.width/2 : (pid===0 ? r.width/4 : r.width*3/4);
    return { pid, dir: lx < cx ? -1 : 1 };
  };
  const steerFor = (pid, d) => G.S.versus ? vsSteer(pid, d) : steer(d);
  // Secret on touch screens: hold the title for 3 seconds to start; during the demo, hold the top-left corner to stop.
  let holdT=0, holdX=0, holdY=0, holdOnTitle=false;
  stage.addEventListener('pointerdown', e=>{
    holdT=performance.now(); const r=stage.getBoundingClientRect(); holdX=e.clientX-r.left; holdY=e.clientY-r.top;
    holdOnTitle=!!e.target.closest('#title');
  }, true);
  stage.addEventListener('pointerup', e=>{
    if(performance.now()-holdT < 3000) return;
    if(G.perpetual ? (holdX<90 && holdY<90) : (holdOnTitle && !$('startOv').hidden)){ Snd.init(); togglePerpetual(); }
  }, true);

  let px=null, py=null, moved=false, sx=0, ptrPid=0;
  stage.addEventListener('pointerdown', e=>{ if(G.perpetual) return; if(G.demo){ e.stopPropagation(); exitDemo(); return; } if(e.target.closest('.card,.pad,.icon')) return; px=e.clientX; py=e.clientY; sx=e.clientX; moved=false; ptrPid=sideOf(e.clientX, e.clientY).pid; }, true);
  stage.addEventListener('pointermove', e=>{
    if(px===null) return; const dx=e.clientX-px, dy=e.clientY-py;
    if(Math.abs(dx)>22 && Math.abs(dx)>Math.abs(dy)*1.1){ steerFor(ptrPid, dx>0?1:-1); px=e.clientX; py=e.clientY; moved=true; }
  });
  stage.addEventListener('pointerup', e=>{
    if(px===null) return; const dx=e.clientX-sx, dy=e.clientY-py; px=null;
    if(!moved && Math.abs(dx)<14 && Math.abs(dy)<14){ const s=sideOf(e.clientX, e.clientY); steerFor(s.pid, s.dir); }
    else if(!moved && Math.abs(dx)>45) steerFor(ptrPid, dx>0?1:-1);
    else if(!moved && !G.S.versus && Math.abs(e.clientY-py)>45 && Math.abs(e.clientY-py)>Math.abs(dx)*1.3) throttle(e.clientY<py ? 1 : -1); // swipe up = faster
  });
  stage.addEventListener('pointercancel', ()=>{ px=null; });
  for(const [id,d] of [['padL',-1],['padR',1]]) $(id).addEventListener('pointerdown', e=>{ e.preventDefault(); e.stopPropagation(); steer(d); });

  // Five taps on the title also starts the attract-mode demo
  let taps=0, tapT=0;
  $('title').addEventListener('click', ()=>{ const n=performance.now(); taps = n-tapT<700 ? taps+1 : 1; tapT=n; if(taps>=5){ taps=0; Snd.init(); startDemo(); } });

  // Auto-pause when the tab loses focus
  const autoPause = () => { if(!G.perpetual && G.S.running && !G.S.paused) setPaused(true, 'The game paused itself because the screen lost focus. Nothing was lost.'); };
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden) autoPause(); if(Snd.ctx){ document.hidden ? Snd.ctx.suspend() : Snd.ctx.resume(); } });
  addEventListener('pagehide', autoPause);
}

boot();
