import * as THREE from 'three';
import { ZMAX, CARZ, FONTS } from './data.js';
import { lerp, clamp, rng, fitText, coarse, reduceMotion } from './util.js';
import { buildCar } from './car.js';

// Logical track (lane -1..1, z ahead) → world units. The car sits at world z = 0, forward is -z.
export const LANE_W = 3.2, ZS = 2.4, ROAD_HALF = LANE_W*1.5 + 0.7;
const wz = z => -(z - CARZ) * ZS;
const smooth = (a,b,x) => { const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };

// Chapter looks. Each palette pair is [restless, calm]; calm (0..1) blends between them.
// city: how much of the noisy city stands at calm 0. nature: how far lamps and trees have risen at calm 0.
// ridges: mountain opacity at calm 0.
const DASH = [[225,220,205],[242,213,138]];
export const THEMES = {
  free: { skyTop:[[46,24,40],[6,12,30]], horizon:[[150,78,60],[30,48,86]], ground:[[44,34,36],[8,14,26]], road:[[78,74,78],[22,28,44]],
          city:1, nature:0, ridges:0, rain:false, trees:0x16323a, wet:false },
  city: { skyTop:[[52,26,44],[14,14,34]], horizon:[[168,84,58],[70,56,80]], ground:[[44,34,36],[18,18,28]], road:[[78,74,78],[34,34,48]],
          city:1, nature:0, ridges:0, rain:false, trees:0x16323a, wet:false },
  monsoon: { skyTop:[[28,32,42],[10,16,32]], horizon:[[84,94,104],[36,54,86]], ground:[[28,36,32],[10,18,24]], road:[[52,56,62],[22,30,44]],
          city:0.3, nature:0.55, ridges:0.35, rain:true, trees:0x1d3a2c, wet:true },
  desert: { skyTop:[[64,30,54],[6,10,30]], horizon:[[210,112,66],[40,52,92]], ground:[[100,64,44],[22,22,32]], road:[[74,64,60],[24,28,44]],
          city:0, nature:1, ridges:1, rain:false, trees:0x4a3326, wet:false },
};
let PAL = { ...THEMES.free, dash:DASH };
function setPal(color, key, t){
  const [a,b]=PAL[key];
  return color.setRGB(lerp(a[0],b[0],t)/255, lerp(a[1],b[1],t)/255, lerp(a[2],b[2],t)/255, THREE.SRGBColorSpace);
}

function canvasTex(w, h, draw){
  const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d'); draw(g,w,h);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return t;
}
// Shared textures and geometries are tagged so dispose() leaves them alone.
const shared = x => { x.userData.shared = true; return x; };
const softDot = canvasTex(64,64,(g,w,h)=>{ const r=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2); r.addColorStop(0,'rgba(255,255,255,1)'); r.addColorStop(0.4,'rgba(255,255,255,.55)'); r.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=r; g.fillRect(0,0,w,h); });
shared(softDot);

export async function createWorld(canvas){
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse, powerPreference:'high-performance' });
  const basePixelRatio = Math.min(devicePixelRatio||1, coarse?1.5:2);
  renderer.setPixelRatio(basePixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Real-time shadows from one "moon" light. Rendered once per frame (even in split screen), not once per view.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);
  scene.fog = new THREE.Fog(0x000000, 40, 230);

  // Optional extras: reflections for the car paint, bloom for neon and gold. The game runs without either.
  let envMap = null, composer = null, bloom = null;
  // A slow CDN must never stall the start: give each optional download a few seconds, then go without it.
  const soon = (p, ms=6000) => Promise.race([p, new Promise((_, no)=>setTimeout(()=>no(new Error('timed out')), ms))]);
  try {
    const { RoomEnvironment } = await soon(import('three/addons/environments/RoomEnvironment.js'));
    const pm = new THREE.PMREMGenerator(renderer); envMap = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  } catch(e){ console.warn('No environment map', e); }
  if(!coarse){
    try {
      const [{EffectComposer},{RenderPass},{UnrealBloomPass},{OutputPass}] = await soon(Promise.all([
        import('three/addons/postprocessing/EffectComposer.js'), import('three/addons/postprocessing/RenderPass.js'),
        import('three/addons/postprocessing/UnrealBloomPass.js'), import('three/addons/postprocessing/OutputPass.js')]));
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      bloom = new UnrealBloomPass(new THREE.Vector2(256,256), 0.75, 0.5, 0.88); composer.addPass(bloom);
      composer.addPass(new OutputPass());
    } catch(e){ console.warn('Bloom unavailable', e); composer=null; }
  }

  // ---------- Sky, stars, horizon glow, mountains ----------
  const skyU = { top:{value:new THREE.Color()}, horizon:{value:new THREE.Color()}, glow:{value:new THREE.Color(0xd9a93e)}, glowAmt:{value:0.2} };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 top, horizon, glow; uniform float glowAmt; varying vec3 vDir;
      void main(){ vec3 d=normalize(vDir); vec3 c=mix(horizon, top, smoothstep(-0.04, 0.42, d.y));
        float k=max(0., dot(d, normalize(vec3(0.,0.02,-1.))));
        float g=pow(k, 40.)*0.9 + pow(k, 8.)*0.18; g*=1.-smoothstep(0.0, 0.35, d.y); c+=glow*g*glowAmt;
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  }));
  sky.renderOrder = -10; scene.add(sky);

  const starGeo = new THREE.BufferGeometry(), sp = [];
  for(let i=0;i<900;i++){ const th=Math.random()*Math.PI*2, ph=Math.random()*Math.PI*0.45; sp.push(Math.cos(th)*Math.cos(ph)*560, Math.sin(ph)*560+8, Math.sin(th)*Math.cos(ph)*560); }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp,3));
  const starMat = new THREE.PointsMaterial({ color:0xf2d58a, size:1.6, sizeAttenuation:false, transparent:true, opacity:0, fog:false, depthWrite:false });
  const stars = new THREE.Points(starGeo, starMat); scene.add(stars);

  const sunMat = new THREE.SpriteMaterial({ map:softDot, color:0xd9a93e, transparent:true, opacity:0.3, blending:THREE.AdditiveBlending, depthWrite:false, fog:false });
  const sun = new THREE.Sprite(sunMat); sun.scale.set(260,120,1); sun.position.set(0,6,-520); scene.add(sun);

  const ridges = [];
  const ridgeRand = rng(108);
  for(const [z, amp, base, color] of [[-470, 46, 6, 0x1c242c], [-420, 26, 0, 0x12161c]]){
    const s = new THREE.Shape(); s.moveTo(-900, -20);
    for(let x=-900; x<=900; x+=18){ s.lineTo(x, base + amp*(0.5+0.5*Math.sin(x/140 + ridgeRand()*0.6)) + amp*0.35*ridgeRand()); }
    s.lineTo(900,-20); s.closePath();
    const m = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0, fog:false, depthWrite:false }));
    m.position.set(0, -2, z); scene.add(m); ridges.push(m);
  }

  // ---------- Lights ----------
  const hemi = new THREE.HemisphereLight(0xb8c6ff, 0x30241e, 0.9); scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xffd2a4, 1.1); scene.add(moon); scene.add(moon.target);
  // The light sits up and to the front-left, so shadows fall back toward the chase camera where you can see them.
  // Its shadow box only covers the stretch of road near the cars, which keeps shadows sharp and cheap.
  const MOON_OFFSET = new THREE.Vector3(-26, 38, -22);
  moon.castShadow = true;
  moon.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
  Object.assign(moon.shadow.camera, { left:-22, right:22, top:30, bottom:-30, near:1, far:120 });
  moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.03;
  moon.shadow.camera.updateProjectionMatrix();
  // Marks every solid mesh in an object as a shadow caster; glows, decals and sprites are skipped.
  const casts = obj => { obj.traverse(n=>{ if(n.isMesh && !(n.material && (n.material.blending===THREE.AdditiveBlending || n.material.depthWrite===false))) n.castShadow = true; }); return obj; };

  // ---------- Ground and road ----------
  const groundMat = new THREE.MeshLambertMaterial({ color:0x222222 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), groundMat); ground.receiveShadow = true;
  ground.rotation.x = -Math.PI/2; ground.position.set(0,-0.03,-400); scene.add(ground);

  const asphalt = canvasTex(256,256,(g,w,h)=>{ g.fillStyle='#8a8a8a'; g.fillRect(0,0,w,h); for(let i=0;i<5000;i++){ const v=110+Math.random()*90|0; g.fillStyle=`rgba(${v},${v},${v},.35)`; g.fillRect(Math.random()*w,Math.random()*h,1.5,1.5); } });
  asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping; asphalt.repeat.set(2, 70);
  const roadMat = new THREE.MeshStandardMaterial({ map:asphalt, color:0x555555, roughness:0.82, metalness:0.05 });
  const ROAD_LEN = 420;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF*2, ROAD_LEN), roadMat); road.receiveShadow = true;
  road.rotation.x = -Math.PI/2; road.position.set(0, 0, 30-ROAD_LEN/2); scene.add(road);

  const edgeMat = new THREE.MeshBasicMaterial({ color:0xd9a93e, transparent:true, opacity:0.3 });
  const edges = [-1,1].map(s=>{ const e=new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, ROAD_LEN), edgeMat); e.position.set(s*(ROAD_HALF-0.3), 0.02, 30-ROAD_LEN/2); scene.add(e); return e; });

  const DASH_P = 4*ZS, DASH_N = 46;
  const dashMat = new THREE.MeshBasicMaterial({ color:0xffffff });
  const dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.03, 1.6*ZS), dashMat, DASH_N*2);
  scene.add(dashes);
  const dm = new THREE.Matrix4();

  // ---------- Scenery: the noisy city sinks as calm rises; lamps and trees rise in its place ----------
  const SPAN = 300, recyclers = [];
  const addRecycled = (obj) => { recyclers.push(obj); scene.add(obj); };
  const r = rng(1978);

  const windowMats = [];
  for(let k=0;k<6;k++){
    const tex = canvasTex(128,256,(g,w,h)=>{
      const hue=10+r()*25; g.fillStyle=`hsl(${hue},18%,${10+r()*6}%)`; g.fillRect(0,0,w,h);
      for(let y=10;y<h-8;y+=14) for(let x=8;x<w-10;x+=16){
        if(r()<0.32){ const warm=r()<0.7; g.fillStyle = warm?`rgba(255,${200+r()*40|0},${120+r()*60|0},${0.6+r()*0.4})`:`rgba(${150+r()*60|0},${200+r()*40|0},255,${0.55+r()*0.4})`; }
        else g.fillStyle='rgba(0,0,0,.35)';
        g.fillRect(x,y,8,9);
      }
    });
    windowMats.push(new THREE.MeshStandardMaterial({ map:tex, emissiveMap:tex, emissive:0xffffff, emissiveIntensity:0.9, roughness:0.9 }));
  }
  const boxGeo = new THREE.BoxGeometry(1,1,1);
  const neonGeo = new THREE.BoxGeometry(1,0.35,0.2);
  const neonMats = [330,20,280,190,50].map(h=>{ const m = new THREE.MeshBasicMaterial({ color:new THREE.Color().setHSL(h/360,0.95,0.6) }); m.userData.base = m.color.clone(); return m; });
  const buildings = [];
  for(const side of [-1,1]){
    let z = 25;
    while(z > 25-SPAN){
      const w = 6+r()*10, d = 6+r()*10, h = 10+r()*38;
      const grp = new THREE.Group();
      const body = new THREE.Mesh(boxGeo, windowMats[r()*windowMats.length|0]);
      body.scale.set(w,h,d); body.position.y = h/2; grp.add(body);
      if(r()<0.45){ const n=new THREE.Mesh(neonGeo, neonMats[r()*neonMats.length|0]); n.scale.x=w*0.8; n.position.set(0, h*(0.55+r()*0.4), d/2+0.08); n.rotation.y = 0; grp.add(n); grp.userData.neon=n; grp.userData.ph=r()*10; }
      // Rotated so the local +z face (windows, neon) looks at the road: depth runs across, width runs along it.
      grp.position.set(side*(ROAD_HALF + 5 + d/2 + r()*14), 0, z - w/2);
      grp.rotation.y = side>0 ? -Math.PI/2 : Math.PI/2;
      grp.userData.h = h; buildings.push(grp); addRecycled(grp);
      z -= w + 2 + r()*6;
    }
  }

  const poleMat = new THREE.MeshStandardMaterial({ color:0x3a4250, roughness:0.6, metalness:0.5 });
  const bulbMat = new THREE.MeshBasicMaterial({ color:0xffe2a8 });
  const poolMat = new THREE.MeshBasicMaterial({ map:softDot, color:0xffcf80, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false });
  const poleGeo = new THREE.CylinderGeometry(0.09,0.12,7,8), armGeo = new THREE.BoxGeometry(1.6,0.1,0.1), bulbGeo = new THREE.SphereGeometry(0.22,10,8), poolGeo = new THREE.PlaneGeometry(7,7);
  const lamps = [];
  for(const side of [-1,1]) for(let i=0;i<15;i++){
    const g = new THREE.Group();
    const pole = new THREE.Mesh(poleGeo, poleMat); pole.position.y=3.5; g.add(pole);
    const arm = new THREE.Mesh(armGeo, poleMat); arm.position.set(-side*0.75, 6.95, 0); g.add(arm);
    const bulb = new THREE.Mesh(bulbGeo, bulbMat); bulb.position.set(-side*1.45, 6.8, 0); g.add(bulb);
    const pool = new THREE.Mesh(poolGeo, poolMat); pool.rotation.x=-Math.PI/2; pool.position.set(-side*2.2, 0.03, 0); g.add(pool);
    g.position.set(side*(ROAD_HALF+1.1), 0, 25 - i*20 - (side>0?10:0)); casts(g); lamps.push(g); addRecycled(g);
  }

  const treeMat = new THREE.MeshLambertMaterial({ color:0x16323a });
  const treeGeo = new THREE.ConeGeometry(1.6, 6, 7); treeGeo.translate(0,3,0);
  const trees = [];
  for(let i=0;i<70;i++){
    const t = new THREE.Mesh(treeGeo, treeMat), side = r()<0.5?-1:1, s = 0.7+r()*1.2;
    t.scale.set(s, s*(0.8+r()*0.6), s); t.position.set(side*(ROAD_HALF+4+r()*40), 0, 25 - r()*SPAN); t.userData.s=t.scale.y;
    t.castShadow = true; trees.push(t); addRecycled(t);
  }

  // ---------- Weather (monsoon chapter) ----------
  const RAIN_N = coarse ? 450 : 900, rainPos = new Float32Array(RAIN_N*6);
  const rainSeed = () => [ (Math.random()-.5)*60, Math.random()*30, -Math.random()*80+10 ];
  for(let i=0;i<RAIN_N;i++){ const [x,y,z]=rainSeed(); rainPos.set([x,y,z, x+0.05,y+1.4,z-0.4], i*6); }
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos,3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color:0xcfe0ff, transparent:true, opacity:0.6, depthWrite:false }));
  rain.frustumCulled = false; rain.visible = false; scene.add(rain);
  let lightning = 0, lightningT = 6;

  let theme = THEMES.free;
  function setTheme(name){
    theme = THEMES[name] || THEMES.free;
    PAL = { ...theme, dash:DASH };
    treeMat.color.set(theme.trees);
    roadMat.roughness = theme.wet ? 0.32 : 0.82; roadMat.metalness = theme.wet ? 0.35 : 0.05;
    rain.visible = theme.rain; lightning = 0; lightningT = 5+Math.random()*6;
  }

  // ---------- Cars: one rig per player (car, headlight, pulse ring, chase camera) ----------
  const PAINTS = [0xb9c0ca, 0x2f5f9e];
  // Player cars from the Kenney Car Kit (CC0, models/LICENSE-kenney-car-kit.txt). P1 and P2 get different models
  // so they are easy to tell apart in split screen. If loading fails or is slow, the procedural car is used instead.
  const CAR_MODELS = ['models/sedan-sports.glb', 'models/race-future.glb'];
  let carTemplates = [];
  try {
    const { GLTFLoader } = await soon(import('three/addons/loaders/GLTFLoader.js'));
    const loader = new GLTFLoader();
    carTemplates = await Promise.all(CAR_MODELS.map(u => soon(loader.loadAsync(u), 8000).then(g=>g.scene).catch(e=>{ console.warn('Car model failed, using fallback', u, e); return null; })));
  } catch(e){ console.warn('Car models unavailable, using fallback', e); }
  const ringGeo = new THREE.RingGeometry(0.92, 1, 64);
  function makeRig(i){
    const car = buildCar(envMap, PAINTS[i], carTemplates[i] || carTemplates[0] || null); casts(car.group); scene.add(car.group);
    const headlight = new THREE.SpotLight(0xfff1d6, 80, 90, 0.42, 0.6, 1.2);
    headlight.position.set(0, 1.1, -2.2); headlight.target.position.set(0, 0, -30);
    car.group.add(headlight); car.group.add(headlight.target);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color:0xf2d58a, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide }));
    ring.rotation.x = -Math.PI/2; ring.position.y = 0.08; scene.add(ring);
    const cam = i===0 ? camera : new THREE.PerspectiveCamera(62, 1, 0.1, 900);
    return { car, headlight, ring, pulseT:-1, cam };
  }
  const rigs = [makeRig(0)];
  function useRigs(n){
    while(rigs.length < n) rigs.push(makeRig(rigs.length));
    rigs.forEach((r,i)=>{ const on = i<n; r.car.group.visible = on; r.headlight.visible = on; r.ring.visible = on; });
  }
  let rigCount = 1;

  // FSD / lane-assist guidance ribbon painted on the road.
  const pathSegs = 24;
  const pathGeo = new THREE.PlaneGeometry(1, 1, 1, pathSegs);
  const pathAlpha = canvasTex(4, 64, (g,w,h)=>{ const gr=g.createLinearGradient(0,0,0,h); gr.addColorStop(0,'#000'); gr.addColorStop(1,'#fff'); g.fillStyle=gr; g.fillRect(0,0,w,h); });
  const pathMat = new THREE.MeshBasicMaterial({ color:0xf2d58a, alphaMap:pathAlpha, transparent:true, opacity:0.55, blending:THREE.AdditiveBlending, depthWrite:false });
  const path = new THREE.Mesh(pathGeo, pathMat); path.frustumCulled = false; scene.add(path);

  // ---------- Text textures ----------
  const labelCache = new Map();
  function vrittiLabel(text){
    if(labelCache.has(text)) return labelCache.get(text);
    const t = canvasTex(512, 128, (g,w,h)=>{
      g.font=`700 64px ${FONTS.mono}`; let fs=64; while(g.measureText(text).width > w-40 && fs>20){ fs-=2; g.font=`700 ${fs}px ${FONTS.mono}`; }
      g.textAlign='center'; g.textBaseline='middle'; g.lineWidth=10; g.strokeStyle='rgba(10,8,14,.85)'; g.strokeText(text,w/2,h/2);
      g.fillStyle='#fff6ea'; g.fillText(text,w/2,h/2);
    });
    labelCache.set(text, shared(t)); return t;
  }
  const bbCache = new Map();
  function billboardTex(text, hue){
    const key=text+hue; if(bbCache.has(key)) return bbCache.get(key);
    const t = canvasTex(512, 230, (g,w,h)=>{
      g.fillStyle=`hsl(${hue},75%,50%)`; g.fillRect(0,0,w,h); g.strokeStyle='rgba(0,0,0,.4)'; g.lineWidth=10; g.strokeRect(5,5,w-10,h-10);
      let fs=96; g.font=`700 ${fs}px ${FONTS.mono}`; while(g.measureText(text).width > w*0.86 && fs>24){ fs-=2; g.font=`700 ${fs}px ${FONTS.mono}`; }
      g.fillStyle='#120d10'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(text,w/2,h/2+4);
    });
    bbCache.set(key, shared(t)); return t;
  }
  function answerTex(text){
    return canvasTex(512, 420, (g,w,h)=>{
      g.fillStyle='rgba(14,26,50,.96)'; g.fillRect(0,0,w,h);
      g.strokeStyle='rgba(242,213,138,.85)'; g.lineWidth=8; g.strokeRect(10,10,w-20,h-20);
      const L = fitText(g, text, w*0.82, h*0.78, 84, FONTS.display);
      g.font=`${L.fs}px ${FONTS.display}`; g.fillStyle='#F4ECD8'; g.textAlign='center'; g.textBaseline='middle';
      const lh=L.fs*1.15, y0=h/2-(L.lines.length-1)*lh/2; L.lines.forEach((ln,i)=>g.fillText(ln, w/2, y0+i*lh));
    });
  }
  const header = (text, bg, fg) => canvasTex(1024, 96, (g,w,h)=>{ g.fillStyle=bg; g.fillRect(0,0,w,h); let fs=44; g.font=`700 ${fs}px ${FONTS.mono}`; while(g.measureText(text).width>w-40){ fs-=2; g.font=`700 ${fs}px ${FONTS.mono}`; } g.fillStyle=fg; g.textAlign='center'; g.textBaseline='middle'; g.fillText(text, w/2, h/2+2); });
  const headerTex = shared(header('◆  TOLL GATE · STEER INTO THE ANSWER  ◆', '#0b1426', '#d9a93e'));
  const bossHeaders = new Map();
  const bossHeader = name => { if(!bossHeaders.has(name)) bossHeaders.set(name, shared(header(`✦  BOSS GATE · ${name}  ✦`, '#2a0c10', '#ff8a6a'))); return bossHeaders.get(name); };

  // ---------- Dynamic views keyed by game objects ----------
  const views = new Map(); let stamp = 0;
  const outgoing = [];
  const blobGeo = (()=>{ const g=new THREE.IcosahedronGeometry(1,1), p=g.attributes.position, v=new THREE.Vector3(); for(let i=0;i<p.count;i++){ v.fromBufferAttribute(p,i); const k=0.75+0.5*Math.abs(Math.sin(v.x*7.1+v.y*5.3+v.z*3.7)); v.multiplyScalar(k); p.setXYZ(i,v.x,v.y,v.z);} g.computeVertexNormals(); return g; })();
  // Soft contact darkening under each vṛtti; the real cast shadow comes from the moon light.
  const shadowMat = new THREE.MeshBasicMaterial({ map:softDot, color:0x000000, transparent:true, opacity:0.25, depthWrite:false });
  const shadowGeo = new THREE.PlaneGeometry(2.6,2.6);
  const boxEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(2.8,3.4,2.8));
  const bbPanelGeo = new THREE.PlaneGeometry(7, 3.15);
  [blobGeo, shadowGeo, boxEdges, bbPanelGeo, boxGeo].forEach(shared);

  const puddleGeo = shared(new THREE.CircleGeometry(1.35, 28));
  const arrowGeo = shared((()=>{ const s=new THREE.Shape(); s.moveTo(0.6,0); s.lineTo(-0.3,0.45); s.lineTo(-0.1,0); s.lineTo(-0.3,-0.45); s.closePath(); return new THREE.ShapeGeometry(s); })());
  function makeVritti(o){
    const g = new THREE.Group(), u = { spin:(Math.random()-.5)*2, kind:o.kind };
    const c = new THREE.Color().setHSL(o.hue/360, 0.7, 0.42), e = new THREE.Color().setHSL(o.hue/360, 0.9, 0.45);
    if(o.kind==='puddle'){
      // A flat, glossy pool of mud on the asphalt.
      const m = new THREE.MeshStandardMaterial({ color:0x3a2616, roughness:0.08, metalness:0.6, transparent:true, opacity:0.95 });
      const p = new THREE.Mesh(puddleGeo, m); p.rotation.x=-Math.PI/2; p.scale.set(1, 1.5, 1); p.position.y=0.03; p.receiveShadow = true; g.add(p);
      u.blob = p;
    } else {
      const m = new THREE.MeshStandardMaterial({ color:c, emissive:e, emissiveIntensity:0.7, roughness:0.4, flatShading:true, transparent:true });
      if(o.kind==='mirage'){ m.emissiveIntensity=1.1; m.opacity=0.6; }
      const blob = new THREE.Mesh(blobGeo, m); blob.position.y = 1.3; g.add(blob); u.blob = blob;
      const sh = new THREE.Mesh(shadowGeo, shadowMat); sh.rotation.x=-Math.PI/2; sh.position.y=0.04; g.add(sh);
    }
    if(o.kind==='drifter'){
      // Arrow on the road showing which lane this worry is about to wander into.
      const am = new THREE.MeshBasicMaterial({ color:0xffb347, transparent:true, opacity:0, depthWrite:false, side:THREE.DoubleSide });
      const a = new THREE.Mesh(arrowGeo, am); a.rotation.x=-Math.PI/2; if(o.to < o.lane) a.rotation.z = Math.PI;
      a.position.set((o.to-o.lane)*LANE_W*0.5, 0.06, 0); a.scale.setScalar(1.3); g.add(a); u.arrow = a;
    }
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map:vrittiLabel(o.label), transparent:true, depthWrite:false }));
    label.scale.set(4.2, 1.05, 1); label.position.y = o.kind==='puddle' ? 1.3 : 3.2; g.add(label); u.label = label;
    const box = new THREE.LineSegments(boxEdges, new THREE.LineBasicMaterial({ color:0x7fc8a9, transparent:true, opacity:0 }));
    box.position.y = 1.6; g.add(box); u.box = box;
    g.userData = u;
    if(o.kind!=='puddle') casts(g);
    g.position.x = o.x*LANE_W; scene.add(g); return g;
  }
  function makeBillboard(b){
    const g = new THREE.Group(), h = 3.5 + b.h*4;
    const post = new THREE.Mesh(boxGeo, poleMat); post.scale.set(0.25, h, 0.25); post.position.y = h/2; g.add(post);
    const mat = new THREE.MeshBasicMaterial({ map:billboardTex(b.txt, b.hue), transparent:true, side:THREE.DoubleSide });
    const panel = new THREE.Mesh(bbPanelGeo, mat); panel.position.y = h+1.5; g.add(panel);
    g.position.x = b.side*(ROAD_HALF + 4.5 + b.off*9); g.rotation.y = b.side*-0.35;
    g.userData = { mat, post }; casts(g); scene.add(g); return g;
  }
  const goldMat = new THREE.MeshStandardMaterial({ color:0xd9a93e, emissive:0xb07a20, emissiveIntensity:0.6, metalness:0.7, roughness:0.35 });
  const crimsonMat = new THREE.MeshStandardMaterial({ color:0xb8323a, emissive:0x9a1a22, emissiveIntensity:0.9, metalness:0.6, roughness:0.3 });
  function makeGate(Q){
    const g = new THREE.Group(), mats = [], frame = Q.boss ? crimsonMat : goldMat;
    const hdr = new THREE.MeshBasicMaterial({ map: Q.boss ? bossHeader(Q.bossName) : headerTex, transparent:true });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(ROAD_HALF*2+0.6, Q.boss?1.2:0.9, 0.5), [frame,frame,frame,frame,hdr,frame]);
    bar.position.y = Q.boss ? 6.5 : 6.3; g.add(bar); mats.push(hdr);
    if(Q.boss){ for(const s of [-1,1]){ const t=new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.6, 4), crimsonMat); t.position.set(s*(ROAD_HALF+0.1), 7.9, 0); g.add(t); } }
    const panels = [];
    for(let k=0;k<3;k++){
      const x = Q.lanes[k]*LANE_W;
      for(const s of [-1,1]){ const p=new THREE.Mesh(new THREE.BoxGeometry(Q.boss?0.26:0.18, 6.3, Q.boss?0.26:0.18), frame); p.position.set(x+s*1.5, 3.15, 0); g.add(p); }
      const m = new THREE.MeshBasicMaterial({ map:answerTex(Q.q.a[k]), transparent:true, side:THREE.DoubleSide });
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.3), m); panel.position.set(x, 4.6, 0); g.add(panel);
      const glowM = new THREE.MeshBasicMaterial({ map:softDot, color:0xd9a93e, transparent:true, opacity:0.5, blending:THREE.AdditiveBlending, depthWrite:false });
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 5), glowM); glow.rotation.x=-Math.PI/2; glow.position.set(x, 0.05, 0); g.add(glow);
      panels.push(panel); mats.push(m, glowM);
    }
    g.userData = { panels, mats }; casts(g); scene.add(g); return g;
  }
  function dispose(obj){
    obj.traverse(n=>{
      if(n.geometry && !n.geometry.userData.shared) n.geometry.dispose();
      const ms = n.material ? (Array.isArray(n.material)?n.material:[n.material]) : [];
      for(const m of ms){ if(m===goldMat || m===crimsonMat || m===poleMat || m===shadowMat) continue; if(m.map && !m.map.userData.shared) m.map.dispose(); m.dispose(); }
    });
    scene.remove(obj);
  }

  function syncList(list, make){
    for(const item of list){
      let v = views.get(item);
      if(!v){ v = make(item); views.set(item, v); }
      v.userData.stamp = stamp;
    }
  }

  // ---------- Particles ----------
  const parts = [];
  const shardMat = new THREE.SpriteMaterial({ map:softDot, color:0xf2d58a, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false });
  // anchored: particles stay with the car instead of scrolling past with the road.
  function puffAt(x, y, z, kind, scale=1, anchored=false, owner=null){
    const n = kind==='smoke' ? 18 : 26;
    for(let i=0;i<n;i++){
      const mat = kind==='smoke'
        ? new THREE.SpriteMaterial({ map:softDot, color: Math.random()<0.3?0xa04632:0x8c8c96, transparent:true, opacity:0.5, depthWrite:false })
        : shardMat.clone();
      const s = new THREE.Sprite(mat);
      const a = Math.random()*Math.PI*2, el = Math.random()*Math.PI*0.5, sp = (kind==='smoke'?3:9)*(0.4+Math.random())*scale;
      s.position.set(x, y, z);
      const size = kind==='smoke' ? 1.2+Math.random()*1.4 : 0.25+Math.random()*0.35;
      s.scale.setScalar(size*scale);
      parts.push({ s, kind, vx:Math.cos(a)*Math.cos(el)*sp, vy:Math.sin(el)*sp+(kind==='smoke'?1.5:3), vz:Math.sin(a)*Math.cos(el)*sp, life:0, max: kind==='smoke'?0.9+Math.random()*0.5:0.5+Math.random()*0.4, size:size*scale, anchored, owner });
      scene.add(s);
    }
  }

  // ---------- Resize ----------
  let W = 1, H = 1;
  // Graphics quality for slow devices: 0 = full, 1 = no bloom and at most 1× resolution, 2 = also no shadows.
  let useComposer = true;
  function setQuality(level){
    useComposer = level < 1;
    renderer.setPixelRatio(level >= 1 ? Math.min(1, basePixelRatio) : basePixelRatio);
    if(composer) composer.setPixelRatio(renderer.getPixelRatio());
    moon.castShadow = level < 2;
    resize();
  }

  function resize(){
    const w = canvas.clientWidth, h = canvas.clientHeight; if(!w || !h) return;
    W = w; H = h;
    renderer.setSize(w, h, false); if(composer){ composer.setSize(w, h); }
  }
  // Keep at least ~64° horizontal FOV so all three lanes fit in a narrow (portrait or split) view.
  const baseFovFor = aspect => clamp(Math.max(58, THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(64)/2)/aspect))), 58, 100);

  // ---------- Boss: a giant vṛtti that looms over the road for the whole boss phase ----------
  let boss = null;
  const BOSS_Z = wz(46);
  function hideBoss(){ if(boss){ dispose(boss.g); boss=null; } }
  function showBoss(name){
    hideBoss();
    const g = new THREE.Group();
    // fog:false on all three parts so the boss reads clearly through the haze.
    const mat = new THREE.MeshStandardMaterial({ color:0x7a1620, emissive:0xc0303a, emissiveIntensity:0.9, roughness:0.35, flatShading:true, transparent:true, opacity:0, fog:false });
    const body = new THREE.Mesh(blobGeo, mat); body.scale.setScalar(11); g.add(body);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map:softDot, color:0xff5a3c, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false, fog:false }));
    halo.scale.setScalar(34); g.add(halo);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map:vrittiLabel(name), transparent:true, opacity:0, depthWrite:false, fog:false }));
    label.scale.set(22, 5.5, 1); label.position.y = 12; g.add(label);
    g.position.set(0, 17, BOSS_Z); scene.add(g);
    boss = { g, body, halo, label, mat, size:11, target:11, appear:0, dying:-1, flash:0 };
  }
  const bossBurst = (kind, scale) => { if(boss) puffAt(0, boss.g.position.y, BOSS_Z+4, kind, scale, true); };

  let time = 0, roadScroll = 0, frameDt = 0;

  // ---------- Shared simulation of the scene (once per frame, whatever the number of views) ----------
  function step(S, dt){
    time += dt; stamp++; frameDt = dt;
    const v = S.v, dz = v*ZS*dt, players = S.players || [S];
    if(players.length !== rigCount){ rigCount = players.length; useRigs(rigCount); }

    // Monsoon rain and lightning
    if(rain.visible){
      const p = rainGeo.attributes.position.array, fall = (reduceMotion ? 14 : 34)*dt, drift = dz*0.6;
      for(let i=0;i<RAIN_N;i++){
        const o=i*6; let y=p[o+1]-fall, z=p[o+2]+drift;
        if(y<0 || z>14){ const s=rainSeed(); p[o]=s[0]; y=s[1]; z=s[2]-20; p[o+3]=p[o]+0.05; }
        p[o+1]=y; p[o+2]=z; p[o+4]=y+1.4; p[o+5]=z-0.4;
      }
      rainGeo.attributes.position.needsUpdate = true;
      lightningT -= dt;
      if(lightningT<=0){ lightning=1; lightningT=7+Math.random()*8; }
    }
    lightning = Math.max(0, lightning-dt*3.5);

    // Keep the shadow box centred just ahead of the cars, then redraw the shadow map once for this frame.
    const focusX = players.reduce((a,P)=>a+P.carX, 0)/players.length*LANE_W*0.5;
    moon.target.position.set(focusX, 0, -14);
    moon.position.copy(moon.target.position).add(MOON_OFFSET);
    renderer.shadowMap.needsUpdate = true;

    // Road motion
    roadScroll += dz;
    asphalt.offset.y = (roadScroll / (ROAD_LEN/asphalt.repeat.y)) % 1;
    const off = roadScroll % DASH_P;
    for(let i=0;i<DASH_N;i++){
      const z = 30 - i*DASH_P + off - DASH_P;
      dm.makeTranslation(-LANE_W/2, 0.02, z); dashes.setMatrixAt(i, dm);
      dm.makeTranslation(LANE_W/2, 0.02, z); dashes.setMatrixAt(DASH_N+i, dm);
    }
    dashes.instanceMatrix.needsUpdate = true;

    for(const o of recyclers){ o.position.z += dz; if(o.position.z > 30) o.position.z -= SPAN; }
    // Neon signs glow steadily with a slow breathing pulse (fast on/off blinking read as rendering glitches).
    neonMats.forEach((m,i)=>{ m.color.copy(m.userData.base).multiplyScalar(reduceMotion ? 0.9 : 0.78 + 0.22*Math.sin(time*1.6 + i*1.3)); });

    // Cars and their pulse rings
    players.forEach((P, i)=>{
      const r = rigs[i], car = r.car, carX = P.carX*LANE_W, steerD = P.lane - P.carX;
      car.group.position.x = carX;
      car.group.rotation.y = -steerD*0.28;
      car.body.rotation.z = steerD*0.05;
      car.body.position.y = reduceMotion ? 0 : Math.sin(time*9+i)*0.012*Math.min(1,v/9);
      car.spin(dz);
      car.setMood(P.over ? 'over' : P.stage, P.calm);
      if(r.pulseT>=0){ r.pulseT += dt; const p = r.pulseT/0.7; r.ring.position.x = carX; r.ring.scale.setScalar(1 + p*55); r.ring.material.opacity = Math.max(0, 0.9*(1-p)); if(p>=1){ r.pulseT=-1; r.ring.material.opacity=0; } }
    });

    // Vrittis
    syncList(S.objs, makeVritti);
    for(const o of S.objs){
      const g = views.get(o), u = g.userData;
      let fade = clamp((ZMAX-o.z)/6, 0, 1);
      // Mirages only materialise late, and shimmer while they do.
      if(o.kind==='mirage') fade = clamp((24-o.z)/7, 0, 1) * (reduceMotion ? 0.8 : 0.65+0.35*Math.sin(time*23+o.z));
      g.position.z = wz(o.z);
      let x = o.x*LANE_W;
      if(o.kind==='drifter' && !o.shifted && o.z < o.driftAt+10 && !reduceMotion) x += Math.sin(time*14)*0.18; // nervous telegraph
      g.position.x = x;
      if(u.arrow) u.arrow.material.opacity = (!o.shifted && o.z < o.driftAt+14) ? 0.85*fade*(0.6+0.4*Math.sin(time*10)) : 0;
      if(o.kind!=='puddle'){
        u.blob.rotation.y += dt*(1.2+u.spin); u.blob.rotation.x += dt*0.7*u.spin;
        u.blob.scale.setScalar(1 + (reduceMotion?0:0.06*Math.sin(time*7+o.lane)));
        u.blob.material.opacity = o.kind==='mirage' ? fade*0.75 : fade;
      } else u.blob.material.opacity = 0.95*fade;
      u.label.material.opacity = fade;
    }

    // Billboards
    syncList(S.bb, makeBillboard);
    for(const b of S.bb){ const g = views.get(b); g.position.z = wz(b.z); g.userData.flicker = 0.8 + 0.2*Math.sin(time*6+b.z); }

    // Gate
    const gate = S.quiz && S.quiz.gate ? S.quiz : null;
    if(gate){
      syncList([gate], makeGate);
      const g = views.get(gate), a = clamp((ZMAX-gate.gate.z)/5, 0, 1);
      g.position.z = wz(gate.gate.z);
      for(const m of g.userData.mats) m.opacity = a * (m.blending===THREE.AdditiveBlending ? 0.5 : 1);
    }

    // Drop views whose game object is gone
    for(const [k, g] of views){ if(g.userData.stamp !== stamp){ views.delete(k); dispose(g); } }

    // Gates just driven through: correct panels dissolve in gold, wrong ones are wrecked
    for(let i=outgoing.length-1;i>=0;i--){
      const o = outgoing[i]; o.t += dt; o.g.position.z += dz;
      const fade = clamp(1 - o.t/0.35, 0, 1); // gone before the crossbar sweeps over the camera
      o.g.userData.mats.forEach(m=>m.opacity = fade*(m.blending===THREE.AdditiveBlending?0.5:1));
      for(const { k, ok } of o.results){
        const p = o.g.userData.panels[k]; if(!p) continue;
        if(ok){ p.scale.setScalar(1 + o.t*0.8); p.material.color.setRGB(1.6, 1.3, 0.7); }
        else if(!reduceMotion){ const d=Math.max(0,1-o.t/0.7); p.rotation.z = Math.sin(o.t*48)*0.25*d + o.t*1.4; p.position.y = 4.6 - o.t*o.t*6; p.material.color.setRGB(1.4, 0.5, 0.4); }
      }
      if(o.t > 0.4){ dispose(o.g); outgoing.splice(i,1); }
    }

    // Boss
    if(boss){
      const b = boss; b.appear += dt; b.flash = Math.max(0, b.flash-dt*2.5);
      let a = Math.min(1, b.appear/1.4);
      if(b.dying>=0){ b.dying += dt; a = Math.max(0, 1-b.dying/1.2); b.target = 11*(1+b.dying*1.5); }
      b.size = lerp(b.size, b.target, Math.min(1, dt*4));
      b.body.scale.setScalar(b.size); b.body.rotation.y += dt*0.5; b.body.rotation.x += dt*0.21;
      b.g.position.y = 17 + (reduceMotion ? 0 : Math.sin(time*1.3)*1.2);
      b.mat.opacity = a; b.mat.emissiveIntensity = 0.9 + b.flash*3;
      b.halo.material.opacity = a*(0.35 + b.flash*0.5); b.halo.scale.setScalar(b.size*4.8);
      b.label.material.opacity = a; b.label.position.y = b.size + 5;
      if(b.dying > 1.2) hideBoss();
    }

    // Particles
    for(let i=parts.length-1;i>=0;i--){
      const p = parts[i]; p.life += dt;
      p.s.position.x += p.vx*dt; p.s.position.y += p.vy*dt; p.s.position.z += p.vz*dt + (p.anchored ? 0 : dz);
      p.vy += (p.kind==='smoke' ? 0.6 : -16)*dt; p.vx *= 0.98; p.vz *= 0.98;
      const a = 1 - p.life/p.max;
      p.s.material.opacity = p.kind==='smoke' ? 0.5*a : a;
      if(p.kind==='smoke') p.s.scale.setScalar(p.size*(1+p.life*1.8));
      if(p.s.position.y < 0.05){ p.s.position.y=0.05; p.vy*=-0.3; }
      if(p.life >= p.max){ scene.remove(p.s); p.s.material.dispose(); parts.splice(i,1); }
    }
  }

  // ---------- One player's view: their calm palette, their guidance ribbon, their camera ----------
  function drawView(S, P, pid, rect, multi){
    const c = P.calm, v = S.v, dt = frameDt;

    setPal(skyU.top.value, 'skyTop', c); setPal(skyU.horizon.value, 'horizon', c);
    skyU.glowAmt.value = 0.3 + 0.5*c;
    setPal(groundMat.color, 'ground', c); setPal(roadMat.color, 'road', c);
    setPal(dashMat.color, 'dash', c); dashMat.color.multiplyScalar(lerp(0.75, 1.25, c));
    edgeMat.opacity = 0.3 + 0.65*c; edgeMat.color.setRGB(0.85, 0.66, 0.24, THREE.SRGBColorSpace).multiplyScalar(1+c*0.8);
    starMat.opacity = clamp((c-0.2)*1.1, 0, 0.9);
    sunMat.opacity = 0.15 + 0.2*c;
    for(const m of ridges) m.material.opacity = clamp(Math.max(theme.ridges, c*1.3), 0, 1);
    hemi.intensity = lerp(0.55, 0.38, c); moon.intensity = lerp(2.6, 1.5, c); // moon is the key light so its shadows read
    if(bloom) bloom.strength = 0.6 + 0.35*c;
    if(lightning>0){ const f = lightning*(0.6+0.4*Math.sin(time*60)); hemi.intensity += f*3; skyU.horizon.value.offsetHSL(0, 0, f*0.25); }
    scene.fog.color.copy(skyU.horizon.value); scene.fog.near = lerp(30, 60, c); scene.fog.far = lerp(200, 300, c);

    const cityDown = 1 - theme.city*(1 - smooth(0.05, 0.85, c)), natureUp = Math.max(theme.nature, smooth(0.15, 0.85, c));
    for(const b of buildings) b.position.y = -b.userData.h*1.02*cityDown;
    for(const m of windowMats) m.emissiveIntensity = 0.9*(1-cityDown*0.6);
    for(const l of lamps) l.position.y = -7.5*(1-natureUp);
    poolMat.opacity = 0.35*natureUp;
    for(const t of trees) t.scale.y = Math.max(0.001, t.userData.s*natureUp);

    // In split screen the rival's car is a ghost, so it never hides your own.
    for(let i=0;i<rigCount;i++) rigs[i].car.setGhost(multi && i!==pid);
    // A player's pulse ring and their own sparks/splashes belong to their view only (one shared scene, two screens).
    for(let i=0;i<rigCount;i++) rigs[i].ring.visible = !multi || i===pid;
    for(const p of parts) p.s.visible = !multi || p.owner===null || p.owner===pid;

    const carX = P.carX*LANE_W;
    path.visible = P.stage>=2 && !P.over && S.running;
    if(path.visible){
      const zEnd = wz(P.stage===3 ? 20 : 9), x1 = P.lane*LANE_W, pos = pathGeo.attributes.position;
      pathMat.color.set(P.stage===3 ? 0x7fc8a9 : 0xf2d58a);
      for(let row=0; row<=pathSegs; row++){
        const t = 1 - row/pathSegs, e = t*t*(3-2*t), x = lerp(carX, x1, e), z = lerp(-2.6, zEnd, t), hw = lerp(0.85, 0.5, t);
        pos.setXYZ(row*2, x-hw, 0.05, z); pos.setXYZ(row*2+1, x+hw, 0.05, z);
      }
      pos.needsUpdate = true; pathGeo.computeBoundingSphere();
    }

    for(const o of S.objs){
      const g = views.get(o); if(!g) continue;
      g.visible = !(o.gone && o.gone[pid]); // hit or pulsed away by this player
      g.userData.box.material.opacity = (P.stage===3 && o.z<18 && o.z>CARZ) ? 0.8*clamp((18-o.z)/6,0,1) : 0;
    }
    for(const b of S.bb){
      const g = views.get(b); if(!g) continue;
      g.userData.mat.opacity = clamp((1-c)*1.2, 0, 1) * clamp((ZMAX-b.z)/8, 0, 1) * clamp((b.z-1)/7, 0, 1);
      g.userData.mat.color.setScalar(g.userData.flicker || 1);
      g.visible = g.userData.mat.opacity > 0.01;
    }

    // Chase camera: slight lag toward the car, FOV opens with speed, shake on hits
    const cam = rigs[pid].cam, shake = reduceMotion ? 0 : (P.shake||0);
    cam.position.x = lerp(cam.position.x, carX*0.62, Math.min(1, dt*6)) + (Math.random()-.5)*0.35*shake;
    cam.position.y = 3.9 + (Math.random()-.5)*0.2*shake;
    cam.position.z = 8.8;
    cam.lookAt(carX*0.32, 1.1, -18);
    if(!S.running && !P.over){ cam.position.y += Math.sin(time*0.4)*0.25; }
    const aspect = rect.w/rect.h;
    if(Math.abs(cam.aspect-aspect) > 1e-3){ cam.aspect = aspect; cam.updateProjectionMatrix(); }
    const fov = baseFovFor(aspect) + Math.max(0, v-7)*0.45;
    if(Math.abs(cam.fov-fov) > 0.01){ cam.fov = lerp(cam.fov, fov, Math.min(1, dt*3 || 1)); cam.updateProjectionMatrix(); }
    sky.position.copy(cam.position); stars.position.copy(cam.position);

    if(!multi && composer && useComposer){ composer.render(dt); return; }
    renderer.setViewport(rect.x, rect.y, rect.w, rect.h); renderer.setScissor(rect.x, rect.y, rect.w, rect.h);
    renderer.render(scene, cam);
  }

  // Side by side in landscape, stacked in portrait. Rects are in CSS pixels with a bottom-left origin (WebGL).
  function splitRects(n){
    if(n<2) return [{ x:0, y:0, w:W, h:H }];
    return W >= H
      ? [{ x:0, y:0, w:Math.floor(W/2)-1, h:H }, { x:Math.ceil(W/2)+1, y:0, w:Math.floor(W/2)-1, h:H }]
      : [{ x:0, y:Math.ceil(H/2)+1, w:W, h:Math.floor(H/2)-1 }, { x:0, y:0, w:W, h:Math.floor(H/2)-1 }];
  }

  function render(S, dt){
    step(S, dt);
    const players = S.players || [S], rects = splitRects(players.length), multi = players.length > 1;
    renderer.setScissorTest(multi);
    if(multi){ renderer.setClearColor(0x05080f); renderer.clear(); }
    players.forEach((P, i) => drawView(S, P, i, rects[i], multi));
    if(multi){ renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H); }
  }

  function reset(){
    for(const [k,g] of views){ dispose(g); } views.clear();
    for(const o of outgoing) dispose(o.g); outgoing.length = 0;
    for(const p of parts){ scene.remove(p.s); p.s.material.dispose(); } parts.length = 0;
    for(const r of rigs){ r.pulseT = -1; r.ring.material.opacity = 0; }
    hideBoss();
  }

  return {
    render, resize, reset, setTheme, setQuality, showBoss, hideBoss, splitRects,
    bossHit(){ if(!boss) return; boss.target *= 0.72; boss.flash = 1; bossBurst('shard', 3); },
    bossTaunt(){ if(!boss) return; boss.target *= 1.18; boss.flash = 1; bossBurst('smoke', 2.5); },
    bossWins(){ if(!boss) return; boss.target *= 1.4; boss.flash = 1; },
    bossDefeated(){ if(!boss || boss.dying>=0) return; boss.dying = 0; boss.flash = 1; bossBurst('shard', 4); bossBurst('shard', 3); bossBurst('smoke', 3); },
    pulse(pid=0){ if(rigs[pid]) rigs[pid].pulseT = 0; },
    puff(lane, z, kind, scale=1, owner=null){ const atCar = z < CARZ+2; puffAt(lane*LANE_W, 1.4, atCar ? -2.5 : wz(z), kind, scale, atCar, owner); },
    // results: one {k, ok} per player who drove through (single player may pass k, ok directly).
    passGate(Q, k, ok){
      const results = Array.isArray(k) ? k : [{ k, ok }];
      const g = views.get(Q); if(!g) return;
      views.delete(Q); outgoing.push({ g, results, t:0 });
      for(const r of results) if(!r.ok){ const x=Q.lanes[r.k]*LANE_W, z=g.position.z; puffAt(x, 4.6, z, 'smoke', 1.3); puffAt(x, 4.6, z, 'shard', 0.9); }
    },
    renderer,
  };
}
