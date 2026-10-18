import { store } from './util.js';

// Procedural Web Audio: engine drone, tanpura fifth that swells with calm, and one-shot cues.
export const Snd = {
  ctx:null, master:null, eng:null, tanpura:null, muted: store.get('htd-muted')==='1',
  init(){
    if(this.ctx){ if(this.ctx.state==='suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.muted?0:0.7; this.master.connect(c.destination);

    const o1=c.createOscillator(), o2=c.createOscillator(), f=c.createBiquadFilter(), g=c.createGain();
    o1.type='sawtooth'; o2.type='triangle'; o1.frequency.value=48; o2.frequency.value=96; f.type='lowpass'; f.frequency.value=320; g.gain.value=0;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.master); o1.start(); o2.start(); this.eng={o1,o2,f,g};

    const tp1=c.createOscillator(), tp2=c.createOscillator(), tpg=c.createGain();
    tp1.type='sine'; tp1.frequency.value=108; tp2.type='sine'; tp2.frequency.value=162; tpg.gain.value=0;
    tp1.connect(tpg); tp2.connect(tpg); tpg.connect(this.master); tp1.start(); tp2.start();
    this.tanpura={tp1,tp2,tpg};

    const nb=c.createBuffer(1,c.sampleRate*0.6,c.sampleRate), d=nb.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    this.noiseBuf=nb;
  },
  setMuted(m){ this.muted=m; store.set('htd-muted', m?'1':'0'); if(this.master) this.master.gain.setTargetAtTime(m?0:0.7, this.ctx.currentTime, 0.05); },
  engine(on, speed, calm){
    if(!this.eng) return; const t=this.ctx.currentTime;
    this.eng.g.gain.setTargetAtTime(on ? Math.max(0, 0.05-0.045*calm) : 0, t, 0.3);
    this.eng.o1.frequency.setTargetAtTime(40+speed*2.2, t, 0.4);
    this.eng.o2.frequency.setTargetAtTime(80+speed*4.4, t, 0.4);
    this.eng.f.frequency.setTargetAtTime(260+speed*12-calm*120, t, 0.4);
    this.tanpura.tpg.gain.setTargetAtTime(on ? calm*0.07 : 0, t, 0.5);
  },
  tone(freq, dur, type='sine', vol=0.2, when=0, glideTo=null){
    if(!this.ctx) return; const c=this.ctx, t=c.currentTime+when, o=c.createOscillator(), g=c.createGain();
    o.type=type; o.frequency.setValueAtTime(freq,t); if(glideTo) o.frequency.exponentialRampToValueAtTime(glideTo,t+dur);
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t+dur+0.05);
  },
  noise(dur, freq, q=1, vol=0.2, sweepTo=null, type='bandpass'){
    if(!this.ctx) return; const c=this.ctx, t=c.currentTime, s=c.createBufferSource(), f=c.createBiquadFilter(), g=c.createGain();
    s.buffer=this.noiseBuf; f.type=type; f.frequency.setValueAtTime(freq,t); f.Q.value=q; if(sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo,t+dur);
    g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t+dur+0.05);
  },
  pulse(){ this.tone(880,0.4,'sine',0.15,0,220); },
  lane(){ this.noise(0.14,700,1.4,0.12,2200); },
  auto(){ this.noise(0.18,1200,2,0.06,2600); },
  hit(){ this.noise(0.3,500,0.7,0.35,120,'lowpass'); this.tone(110,0.28,'square',0.1,0,45); },
  gate(){ this.tone(660,0.35,'sine',0.08); this.tone(990,0.5,'sine',0.05,0.08); },
  bell(f0, when=0, vol=0.16){ [1,2.01,2.76,4.07].forEach((m,i)=>this.tone(f0*m, 2.2/(i+1), 'sine', vol/(i+1.2), when)); },
  correct(streak){ const base=523*Math.pow(1.0595, Math.min(7,streak-1)*2); this.bell(base,0,0.18); this.bell(base*1.5,0.12,0.12); },
  miss(){ this.tone(392,0.45,'triangle',0.12,0,262); },
  rattle(){ [0,0.045,0.09,0.15,0.22].forEach((w,i)=>setTimeout(()=>this.noise(0.06,2400-i*300,3,0.16-i*0.02,900),w*1000)); this.tone(90,0.35,'square',0.12,0,50); this.noise(0.6,600,0.5,0.12,150,'lowpass'); },
  wrong(){ this.tone(330,0.7,'sawtooth',0.12,0,90); this.tone(220,0.7,'sawtooth',0.08,0.05,70); this.noise(0.5,300,0.6,0.15,80,'lowpass'); },
  boss(){ this.tone(55,1.8,'sawtooth',0.12,0,48); this.tone(82,1.8,'triangle',0.08,0.1,73); this.noise(1.4,180,0.8,0.12,60,'lowpass'); this.bell(196,0.5,0.1); },
  bossGate(){ this.tone(330,0.4,'square',0.05); this.tone(247,0.6,'sawtooth',0.05,0.12); },
  stage(){ [392,523,659,784].forEach((f,i)=>this.bell(f,i*0.11,0.1)); },
  arrive(){ [262,392,523,659,784].forEach((f,i)=>this.bell(f,i*0.18,0.14)); }
};
