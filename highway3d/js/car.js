import * as THREE from 'three';

// A low-poly fastback EV built from extruded side profiles. Forward is -z; the car is about 4.7 long.
function extrudeProfile(points, width, bevel){
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for(let i=1;i<points.length;i++){
    const p = points[i];
    if(p.length===4) s.quadraticCurveTo(p[0], p[1], p[2], p[3]); else s.lineTo(p[0], p[1]);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth:width, bevelEnabled:true, bevelThickness:bevel, bevelSize:bevel, bevelSegments:4, curveSegments:14 });
  // Shape x (front = +x) → world -z, extrusion → world x, centred.
  g.rotateY(Math.PI/2); g.translate(-width/2, 0, 0);
  return g;
}

// The car is either a loaded glTF model (Kenney Car Kit, CC0) or, if that failed to load, the procedural fallback.
// Either way the rig adds the light bar, headlights, mood under-glow, contact shadow and ghost mode around it.
const MODEL_LENGTH = 4.5; // world units the loaded model is scaled to (the lane is 3.2 wide)

export function buildCar(envMap, paintColor=0xb9c0ca, template=null){
  const group = new THREE.Group(), body = new THREE.Group(); group.add(body);
  const wheels = [];
  let wheelR = 0.36, spinSign = -1, box;

  if(template){
    const model = template.clone(true);
    model.traverse(n=>{
      if(!n.isMesh) return;
      n.material = n.material.clone(); // per-car copies, so ghosting one car never fades the other
      // The kit's colour atlas is bright and flat; tone it down so the moon light and bloom don't wash it out.
      n.material.color.multiplyScalar(0.72);
      n.material.envMap = envMap; n.material.envMapIntensity = 0.3;
      n.material.roughness = Math.max(n.material.roughness ?? 0.5, 0.45); n.material.metalness = Math.min(n.material.metalness ?? 0, 0.35);
      if(n.material.map) n.material.map.anisotropy = 4;
    });
    // Kenney cars face +z; ours drive toward -z.
    const raw = new THREE.Box3().setFromObject(model), size = raw.getSize(new THREE.Vector3());
    const s = MODEL_LENGTH / size.z;
    model.scale.setScalar(s); model.rotation.y = Math.PI;
    model.position.y = -raw.min.y*s;
    body.add(model);
    model.traverse(n=>{ if(/^wheel/.test(n.name)) wheels.push(n); });
    wheelR = 0.3*s; spinSign = 1; // rotated model: rolling forward is +x rotation in its own frame
    box = new THREE.Box3().setFromObject(group);
  } else {
    buildProcedural(body, group, wheels, envMap, paintColor);
    box = new THREE.Box3(new THREE.Vector3(-0.93,0,-2.4), new THREE.Vector3(0.93,1.45,2.45));
  }
  const W = box.max.x-box.min.x, L = box.max.z-box.min.z, Hh = box.max.y-box.min.y;

  // Lights: headlight slivers at the front, full-width light bar at the rear (that is what the chase cam sees).
  const headMat = new THREE.MeshBasicMaterial({ color:0xfff4dc });
  for(const s of [-1,1]){ const h=new THREE.Mesh(new THREE.BoxGeometry(W*0.22,0.07,0.06), headMat); h.position.set(s*W*0.3, Hh*0.45, box.min.z-0.02); h.rotation.y = s*0.25; body.add(h); }
  const tailMat = new THREE.MeshBasicMaterial({ color:0xff2a1e });
  const tail = new THREE.Mesh(new THREE.BoxGeometry(W*0.8, 0.07, 0.05), tailMat); tail.position.set(0, Hh*0.55, box.max.z+0.03); body.add(tail);
  for(const s of [-1,1]){ const t=new THREE.Mesh(new THREE.BoxGeometry(W*0.17,0.14,0.05), tailMat); t.position.set(s*W*0.37, Hh*0.53, box.max.z+0.03); body.add(t); }

  // Under-glow that carries the drive state: dim white (manual), gold (assist), mint-gold (FSD), ember (disengaged).
  const glowTex = (()=>{ const c=document.createElement('canvas'); c.width=c.height=128; const g=c.getContext('2d'); const r=g.createRadialGradient(64,64,0,64,64,64); r.addColorStop(0,'rgba(255,255,255,1)'); r.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=r; g.fillRect(0,0,128,128); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; })();
  const glowMat = new THREE.MeshBasicMaterial({ map:glowTex, color:0xd9a93e, transparent:true, opacity:0.3, blending:THREE.AdditiveBlending, depthWrite:false });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(W*2.2, L*1.6), glowMat); glow.rotation.x = -Math.PI/2; glow.position.y = 0.04; group.add(glow);
  // Contact darkening right under the car; the moon light casts the real shadow.
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(W*1.35, L*1.1), new THREE.MeshBasicMaterial({ map:glowTex, color:0x000000, transparent:true, opacity:0.4, depthWrite:false }));
  shadow.rotation.x = -Math.PI/2; shadow.position.y = 0.035; group.add(shadow);

  const moods = { 1:[0xe6e2d7,0.12], 2:[0xf2d58a,0.32], 3:[0x9fe0c0,0.5], over:[0xe0533d,0.55] };
  const target = new THREE.Color();
  // Ghost mode: the car's solid materials turn see-through (the rival car in split screen).
  // Glow and contact shadow (no depth write) keep their own opacity.
  const ghostMats = new Set();
  group.traverse(n=>{ if(n.isMesh && n.material.depthWrite!==false) ghostMats.add(n.material); });
  ghostMats.forEach(m=>{ m.transparent = true; m.userData.baseOpacity = m.opacity; });
  let ghost = false;
  return {
    group, body,
    setGhost(on){ if(on===ghost) return; ghost=on; ghostMats.forEach(m=>{ m.opacity = on ? m.userData.baseOpacity*0.32 : m.userData.baseOpacity; m.depthWrite = !on; }); },
    spin(dist){ for(const w of wheels) w.rotation.x += spinSign*dist/wheelR; },
    setMood(m, calm){
      const [c, a] = moods[m] || moods[1];
      target.set(c); glowMat.color.lerp(target, 0.08);
      glowMat.opacity += ((a + calm*0.1) - glowMat.opacity)*0.08;
      tailMat.color.setRGB(1, 0.16, 0.12).multiplyScalar(m==='over' ? 2.2 : 1.5);
    }
  };
}

// Fallback car: a low-poly fastback built from extruded side profiles.
function buildProcedural(body, group, wheels, envMap, paintColor){
  const paint = new THREE.MeshPhysicalMaterial({ color:paintColor, metalness:0.45, roughness:0.3, clearcoat:1, clearcoatRoughness:0.1, envMap, envMapIntensity:0.45 });
  const glass = new THREE.MeshPhysicalMaterial({ color:0x0b1220, metalness:0.9, roughness:0.06, envMap, envMapIntensity:1.2 });
  const trim  = new THREE.MeshStandardMaterial({ color:0x12151b, roughness:0.7, metalness:0.2 });

  const lower = extrudeProfile([
    [-2.28, 0.30], [-2.38, 0.72], [-2.36, 0.95, -2.05, 1.0], [0.95, 0.98],
    [1.6, 0.92, 2.1, 0.78], [2.36, 0.68, 2.34, 0.42], [2.22, 0.30]
  ], 1.62, 0.12);
  body.add(new THREE.Mesh(lower, paint));

  const cabin = extrudeProfile([
    [-1.98, 0.96], [-1.25, 1.42, -0.25, 1.43], [0.5, 1.42, 1.02, 0.97]
  ], 1.34, 0.08);
  const cab = new THREE.Mesh(cabin, glass); cab.position.y = 0.01; body.add(cab);

  const skirt = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.16, 4.3), trim); skirt.position.y = 0.34; body.add(skirt);

  // Wheels
  const tyreGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 22); tyreGeo.rotateZ(Math.PI/2);
  const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.27, 10); rimGeo.rotateZ(Math.PI/2);
  const tyreMat = new THREE.MeshStandardMaterial({ color:0x0c0d10, roughness:0.9 });
  const rimMat = new THREE.MeshStandardMaterial({ color:0x9aa3b0, metalness:0.9, roughness:0.3, envMap });
  for(const [x,z] of [[-0.86,-1.42],[0.86,-1.42],[-0.86,1.45],[0.86,1.45]]){
    const w = new THREE.Group(); w.position.set(x, 0.36, z);
    w.add(new THREE.Mesh(tyreGeo, tyreMat)); w.add(new THREE.Mesh(rimGeo, rimMat));
    group.add(w); wheels.push(w);
  }
}
