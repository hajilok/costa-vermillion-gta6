// Costa Vermillion: Sunset Syndicate — golden-hour 3D Puerto Vermillion builder.
// 100% original content. Imports only 'three' and './cityConfig.js'.
import * as THREE from 'three';
import { DISTRICTS, INTERSECTIONS, LANDMARKS, ROAD_NETWORK, VERMILLION_BAY, WORLD_BOUNDS, isWater } from './cityConfig.js';

export function buildCoastalCityWorld(scene, rng) {
  const animated = { water: [], lamps: [], beacons: [], signs: [] };
  const colliders = [];
  const sunDir = new THREE.Vector3(-0.48, 0.20, -0.85).normalize();
  scene.fog = new THREE.FogExp2(0xf0b89e, 0.00072);
  scene.background = new THREE.Color(0x564c8e);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 18), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: { value: sunDir } },
    vertexShader: 'varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: [
      'varying vec3 vD;uniform vec3 uSun;',
      'float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
      'float nz(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);',
      'return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}',
      'float fbm(vec2 p){float v=0.0;float a=0.5;for(int i=0;i<4;i++){v+=a*nz(p);p*=2.03;a*=0.5;}return v;}',
      'void main(){vec3 d=normalize(vD);float h=clamp(d.y,-0.08,1.0);',
      'vec3 zen=vec3(0.337,0.298,0.557);vec3 up=vec3(0.851,0.510,0.651);',
      'vec3 lo=vec3(0.976,0.663,0.486);vec3 hor=vec3(1.0,0.890,0.659);',
      'vec3 c=mix(hor,lo,smoothstep(0.0,0.16,h));c=mix(c,up,smoothstep(0.14,0.42,h));c=mix(c,zen,smoothstep(0.40,0.9,h));',
      'vec2 cuv=d.xz/(abs(d.y)+0.22);',
      'float cl=fbm(cuv*2.6+vec2(3.1,1.7));float cl2=fbm(cuv*5.3+vec2(-2.0,4.2));',
      'float cm=smoothstep(0.42,0.78,cl*0.65+cl2*0.35)*smoothstep(-0.02,0.24,h)*smoothstep(0.9,0.35,h);',
      'float sd=max(dot(d,normalize(uSun)),0.0);',
      'vec3 lit=mix(vec3(1.0,0.62,0.38),vec3(1.0,0.85,0.6),sd);',
      'c=mix(c,lit,cm*0.75);c+=vec3(1.0,0.55,0.35)*pow(sd,5.0)*0.35*cm;',
      'float s=max(dot(d,normalize(uSun)),0.0);',
      'c+=vec3(1.0,0.82,0.55)*pow(s,900.0)*4.0; c+=vec3(1.0,0.75,0.5)*pow(s,90.0)*0.9;',
      'c+=vec3(1.0,0.5,0.25)*pow(s,7.0)*0.35;',
      'gl_FragColor=vec4(c,1.0);}'].join('\n'),
  }));
  scene.add(sky);
  scene.add(new THREE.HemisphereLight(0xaabfff, 0xe8a87c, 1.2));
  scene.add(new THREE.AmbientLight(0xffdcbf, 0.45));
  const sun = new THREE.DirectionalLight(0xffc488, 2.6);
  sun.position.set(-420, 170, 150);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -700, right: 700, top: 700, bottom: -700, far: 1600 });
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  const oceanUniforms = {
    uTime: { value: 0 },
    uSun: { value: sunDir },
    uBay: { value: new THREE.Vector4(VERMILLION_BAY.minX, VERMILLION_BAY.minZ, VERMILLION_BAY.maxX, VERMILLION_BAY.maxZ) },
  };
  const oceanMat = new THREE.ShaderMaterial({
    uniforms: oceanUniforms, transparent: true, fog: false,
    vertexShader: [
      'uniform float uTime;varying vec3 vW;',
      'void main(){vec3 p=position;vec4 w=modelMatrix*vec4(p,1.0);',
      'w.y+=sin(w.x*0.05+uTime*1.2)*0.12+sin(w.z*0.07-uTime*0.9)*0.12;',
      'vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}'].join('\n'),
    fragmentShader: [
      'uniform float uTime;uniform vec3 uSun;uniform vec4 uBay;varying vec3 vW;',
      'void main(){',
      'float n1=sin(vW.x*0.35+uTime*1.6)*sin(vW.z*0.31-uTime*1.3);',
      'float n2=sin(vW.x*0.13-uTime*0.7+vW.z*0.17);',
      'float n3=sin((vW.x+vW.z)*0.55+uTime*2.2);',
      'vec3 nx=normalize(vec3(n1*0.18+n2*0.12,-1.0,n3*0.16));',
      'vec3 deep=vec3(0.02,0.25,0.48);vec3 turq=vec3(0.08,0.83,0.85);',
      'vec3 c=mix(deep,turq,0.45+0.35*n2+0.2*n1);',
      'vec3 vv=normalize(cameraPosition-vW);vec3 sd=normalize(uSun);',
      'vec3 hv=normalize(vv+sd);float sp=pow(max(dot(nx,hv),0.0),180.0);',
      'float path=exp(-abs(vW.z+120.0)*0.004);',
      'c+=vec3(1.0,0.72,0.35)*(sp*2.2+path*0.25*max(sp*8.0,0.12));',
      'c+=vec3(1.0,0.95,0.85)*pow(max(dot(nx,hv),0.0),36.0)*0.25;',
      'float eD=min(abs(vW.x-(-560.0)),abs(vW.z-590.0));',
      'float eB=min(min(abs(vW.x-uBay.x),abs(vW.x-uBay.z)),min(abs(vW.z-uBay.y),abs(vW.z-uBay.w)));',
      'float inBay=step(uBay.x,vW.x)*step(vW.x,uBay.z)*step(uBay.y,vW.z)*step(vW.z,uBay.w);',
      'float foam=smoothstep(26.0,2.0,eD)+inBay*smoothstep(30.0,3.0,eB);',
      'foam*=0.6+0.4*sin(uTime*2.4+vW.x*0.4+vW.z*0.3);',
      'c=mix(c,vec3(1.0,0.98,0.94),clamp(foam,0.0,1.0)*0.85);',
      'gl_FragColor=vec4(c,0.96);}'].join('\n'),
  });
  function waterPlane(w, h, x, z) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 24, 24), oceanMat);
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.07, z); scene.add(m); animated.water.push(m);
  }
  waterPlane(320, 1400, -720, 0);
  waterPlane(1500, 180, 0, 680);
  waterPlane((VERMILLION_BAY.maxX - VERMILLION_BAY.minX) + 130, (VERMILLION_BAY.maxZ - VERMILLION_BAY.minZ) + 130,
    (VERMILLION_BAY.minX + VERMILLION_BAY.maxX) / 2, (VERMILLION_BAY.minZ + VERMILLION_BAY.maxZ) / 2);
  const urban = new THREE.Mesh(new THREE.PlaneGeometry(1240, 1240), new THREE.MeshLambertMaterial({ color: 0x3b3a52 }));
  urban.rotation.x = -Math.PI / 2; urban.position.set(0, -0.08, 0); urban.receiveShadow = true; scene.add(urban);
  for (const d of DISTRICTS) {
    const tint = d.id === 'coral_promenade' ? 0x8a6a55 : d.id === 'downtown_vermillion' ? 0x565a74 : d.id === 'bahia_cargo_docks' ? 0x5e563e : 0x3f7d55;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(d.size.x, d.size.z),
      new THREE.MeshLambertMaterial({ color: tint, transparent: true, opacity: 0.55 }));
    m.rotation.x = -Math.PI / 2; m.position.set(d.center.x, -0.04, d.center.z); m.receiveShadow = true; scene.add(m);
  }
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(80, 900), new THREE.MeshLambertMaterial({ color: 0xffdf9e }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(-520, 0.02, 60); sand.receiveShadow = true; scene.add(sand);
  const roadTex = asphaltTexture(rng);
  const roadGroup = new THREE.Group(); scene.add(roadGroup);
  const spanX = { min: WORLD_BOUNDS.minX, max: WORLD_BOUNDS.maxX };
  for (const ave of ROAD_NETWORK.avenues) {
    const z0 = ave.minZ ?? -640, z1 = ave.maxZ ?? 590;
    const tex = roadTex.clone(); tex.needsUpdate = true; tex.repeat.set(1, (z1 - z0) / 26);
    const r = new THREE.Mesh(new THREE.PlaneGeometry(ave.width, z1 - z0), new THREE.MeshLambertMaterial({ map: tex }));
    r.rotation.x = -Math.PI / 2; r.position.set(ave.x, ROAD_NETWORK.roadY, (z0 + z1) / 2);
    r.receiveShadow = true; roadGroup.add(r);
  }
  for (const blvd of ROAD_NETWORK.boulevards) {
    const x0 = blvd.minX ?? spanX.min, x1 = blvd.maxX ?? spanX.max;
    const tex = roadTex.clone(); tex.needsUpdate = true; tex.repeat.set((x1 - x0) / 26, 1);
    const r = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, blvd.width), new THREE.MeshLambertMaterial({ map: tex }));
    r.rotation.x = -Math.PI / 2; r.position.set((x0 + x1) / 2, ROAD_NETWORK.roadY, blvd.z);
    r.receiveShadow = true; roadGroup.add(r);
  }
  for (const n of INTERSECTIONS) {
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshLambertMaterial({ color: 0x3a3952 }));
    pad.rotation.x = -Math.PI / 2; pad.position.set(n.x, ROAD_NETWORK.roadY + 0.02, n.z); pad.receiveShadow = true; scene.add(pad);
  }
  const bridge = ROAD_NETWORK.bridge;
  const bFrom = new THREE.Vector3(bridge.from.x, bridge.deckY, bridge.from.z);
  const bTo = new THREE.Vector3(bridge.to.x, bridge.deckY, bridge.to.z);
  const bLen = bFrom.distanceTo(bTo);
  const bDir = new THREE.Vector3().subVectors(bTo, bFrom).normalize();
  const bN = new THREE.Vector3(-bDir.z, 0, bDir.x);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(bridge.width, 1.4, bLen),
    new THREE.MeshLambertMaterial({ map: roadTex }));
  deck.position.copy(bFrom).lerp(bTo, 0.5); deck.lookAt(bTo.x, bridge.deckY, bTo.z);
  deck.castShadow = true; deck.receiveShadow = true; scene.add(deck);
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xffc44d, emissive: 0xff7a3c, emissiveIntensity: 0.5, roughness: 0.4, metalness: 0.4 });
  for (const s of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, bLen), goldMat);
    rail.position.copy(deck.position).addScaledVector(bN, s * (bridge.width / 2));
    rail.position.y += 1.4; rail.rotation.y = deck.rotation.y; scene.add(rail);
  }
  const towerMat = new THREE.MeshStandardMaterial({ color: 0xf4f6ff, roughness: 0.35, metalness: 0.25, emissive: 0xffd97a, emissiveIntensity: 0.3 });
  const cableMat = new THREE.MeshBasicMaterial({ color: 0xfff3d6 });
  for (let i = 1; i <= 4; i += 1) {
    const t = i / 5;
    const base = new THREE.Vector3().copy(bFrom).lerp(bTo, t);
    for (const s of [-1, 1]) {
      const tw = new THREE.Mesh(new THREE.BoxGeometry(2.4, 44, 2.4), towerMat);
      tw.position.set(base.x + bN.x * s * (bridge.width / 2 + 1), bridge.deckY + 20, base.z + bN.z * s * (bridge.width / 2 + 1));
      tw.castShadow = true; scene.add(tw);
      const pts = [];
      for (let k = 0; k <= 10; k += 1) {
        const u = k / 10;
        pts.push(new THREE.Vector3(
          base.x + bDir.x * (u - 0.5) * (bLen / 4.4) + bN.x * s * (bridge.width / 2 + 1),
          bridge.deckY + 2 + Math.pow(Math.abs(u - 0.5) * 2, 1.6) * 38,
          base.z + bDir.z * (u - 0.5) * (bLen / 4.4) + bN.z * s * (bridge.width / 2 + 1)));
      }
      scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.22, 5, false), cableMat));
    }
  }
  function getBridgeHeight(t) {
    const c = Math.max(0, Math.min(1, t));
    return bridge.deckY + Math.sin(c * Math.PI) * 2 + 0.35;
  }
  const winTexA = litWindowTexture('#f7d9b8', 0.72, rng, true);
  const winTexB = litWindowTexture('#3f4a6e', 0.6, rng, true);
  const winTexC = litWindowTexture('#47245e', 0.8, rng, false);
  const palette = ['#ff9e7a', '#7ad9ff', '#ffd97a', '#ff7ad9', '#9dff9e', '#c2b3ff'];
  const blockTex = palette.map((c) => litWindowTexture(c, 0.62, rng, true));
  function clearOf(x, z, half) {
    if (isWater(x, z) || x < -556) return false;
    if (nearRoad(x, z, 20)) return false;
    for (const n of INTERSECTIONS) if (Math.abs(n.x - x) < 15 + half && Math.abs(n.z - z) < 15 + half) return false;
    for (const lm of LANDMARKS) if (Math.hypot(lm.pos.x - x, lm.pos.z - z) < 24) return false;
    return true;
  }
  let placed = 0;
  const deco = ['#ffd9c2', '#ffc2d4', '#bdf3ff', '#fff3c2'];
  for (let gx = -520; gx <= 560; gx += 56) {
    for (let gz = -560; gz <= 560; gz += 58) {
      const x = gx + (rng() - 0.5) * 18, z = gz + (rng() - 0.5) * 18;
      if (!clearOf(x, z, 12)) continue;
      const w = 16 + rng() * 10, d = 16 + rng() * 10, h = 14 + rng() * 54;
      const tex = (placed % 5 === 0) ? winTexA : (placed % 5 === 1) ? winTexB : blockTex[placed % blockTex.length];
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.25 }));
      b.position.set(x, h / 2, z); b.castShadow = true; b.receiveShadow = true;
      b.rotation.y = (rng() - 0.5) * 0.08; scene.add(b); addCollider(colliders, b);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.7, d + 0.6),
        new THREE.MeshBasicMaterial({ color: placed % 2 ? 0x38e8ff : 0xffc44d }));
      edge.position.set(x, h + 0.3, z); edge.rotation.y = b.rotation.y; scene.add(edge);
      if (placed % 3 === 0) {
        const rt = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 2.4), new THREE.MeshLambertMaterial({ color: 0x8f8fa5 }));
        rt.position.set(x + w * 0.2, h + 1, z); scene.add(rt);
      }
      if (placed % 4 === 0) {
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 3),
          new THREE.MeshBasicMaterial({ map: neonSignTexture(deco[placed % 4] ? 'VERMILLION' : 'COSTA', placed % 2 ? '#38e8ff' : '#ff3fa4', '#12081f'), side: THREE.DoubleSide }));
        sign.position.set(x, Math.min(h - 2, 12), z + d / 2 + 0.3); scene.add(sign); animated.signs.push(sign);
      }
      placed += 1;
    }
  }
  hotelTower(scene, colliders, -412, -75, 36, 30, 26, winTexA);
  hotelTower(scene, colliders, -330, 210, 30, 16, 24, winTexC);
  storeSign(scene, animated, 'HOTEL MARIPOSA', -412, 34, -75, '#ffd97a', 34);
  storeSign(scene, animated, 'SOLAR CLUB', -330, 20, 210, '#38e8ff', 26);
  storeSign(scene, animated, 'VERMILLION BANK', 60, 46, -120, '#ff3fa4', 40);
  storeSign(scene, animated, 'BAHIA PORT', 330, 18, 430, '#7dff9e', 30);
  storeSign(scene, animated, 'CORAL MOD GARAGE', -40, 12, 60, '#38e8ff', 30);
  buildGarageBay(scene, colliders, animated);
  buildBillboards(scene, colliders, rng);
  const craneC = [0xffc44d, 0x38e8ff, 0xff5a4e];
  for (let ci = 0; ci < 3; ci += 1) {
    const crane = buildCrane(craneC[ci % 3]);
    crane.position.set([150, 260, 380][ci], 0, 470); scene.add(crane); addCollider(colliders, crane);
  }
  const contC = [0xff5a4e, 0x38e8ff, 0xffc44d, 0x7fd6a4, 0xff3fa4, 0x4d7dff];
  for (let i = 0; i < 40; i += 1) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(12, 3, 3.2), new THREE.MeshLambertMaterial({ color: contC[i % 6] }));
    c.position.set(60 + rng() * 380, 1.5 + (i % 3) * 3.1, 330 + rng() * 160);
    c.rotation.y = (rng() - 0.5) * 0.3; c.castShadow = true; scene.add(c);
    if (i % 3 === 0) addCollider(colliders, c);
  }
  for (let i = 0; i < 10; i += 1) {
    const x = 330 + rng() * 220, z = -470 + rng() * 260;
    if (isWater(x, z)) continue;
    const villa = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(20, 7, 16), new THREE.MeshLambertMaterial({ color: 0xfff3d6 }));
    base.position.y = 3.5; base.castShadow = true; villa.add(base);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(10, 7), new THREE.MeshPhongMaterial({ color: 0x38e8ff, shininess: 140 }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(14, 0.2, 0); villa.add(pool);
    villa.position.set(x, 0, z); villa.rotation.y = rng() * Math.PI; scene.add(villa); addCollider(colliders, base);
  }
  for (const lm of LANDMARKS) {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 0.6, 24),
      new THREE.MeshStandardMaterial({ color: 0x141428, emissive: 0xffc44d, emissiveIntensity: 0.35 }));
    pad.position.set(lm.pos.x, 0.3, lm.pos.z); pad.receiveShadow = true; scene.add(pad);
  }
  for (const blvd of ROAD_NETWORK.boulevards) {
    for (let x = -540; x <= 580; x += 42) {
      if (x < -556 || isWater(x, blvd.z + 14)) continue;
      if (rng() < 0.25) continue;
      const palm = buildPalm(rng);
      palm.position.set(x + rng() * 8, 0, blvd.z + (blvd.width / 2 + 5)); palm.rotation.y = rng() * 6.28; scene.add(palm);
    }
  }
  for (let i = 0; i < 60; i += 1) {
    const x = WORLD_BOUNDS.minX + rng() * 1280, z = WORLD_BOUNDS.minZ + rng() * 1280;
    if (isWater(x, z) || x < -556 || nearRoad(x, z, 12)) continue;
    const palm = buildPalm(rng); palm.position.set(x, 0, z); palm.rotation.y = rng() * 6.28; scene.add(palm);
  }
  let lampN = 0;
  for (const n of INTERSECTIONS) {
    if ((lampN += 1) % 2 === 0) continue;
    const lamp = buildStreetlamp(); lamp.position.set(n.x + 9, 0, n.z + 9); scene.add(lamp); animated.lamps.push(lamp);
  }
  for (const ave of ROAD_NETWORK.avenues) {
    for (let z = -520; z <= 520; z += 160) {
      const lamp = buildStreetlamp(); lamp.position.set(ave.x + ave.width / 2 + 3, 0, z);
      scene.add(lamp); animated.lamps.push(lamp);
    }
  }
  const beacon = new THREE.Group();
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffc44d, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 60, 20, 1, true), beamMat);
  beam.position.y = 30; beacon.add(beam);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5, 0.55, 10, 40), new THREE.MeshBasicMaterial({ color: 0xffd97a }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.6; beacon.add(ring);
  beacon.position.set(-400, 0, 20); scene.add(beacon);
  animated.beacons.push({ group: beacon, beam, ring });
  function setBeaconPosition(x, z) { beacon.position.set(x, 0, z); }
  function updateWorldVisuals(dt, elapsed, targetPos) {
    oceanUniforms.uTime.value = elapsed;
    for (const lamp of animated.lamps) lamp.userData.bulb.scale.setScalar(1 + Math.sin(elapsed * 5 + lamp.position.x) * 0.08);
    for (const b of animated.beacons) {
      b.ring.scale.setScalar(1 + Math.sin(elapsed * 3.2) * 0.16);
      b.beam.material.opacity = 0.34 + Math.sin(elapsed * 3.2) * 0.14;
      b.beam.rotation.y += dt * 0.9;
    }
    for (const s of animated.signs) if (targetPos && s.position.distanceTo(targetPos) < 320) s.lookAt(targetPos.x, s.position.y, targetPos.z);
  }
  return { colliders, setBeaconPosition, updateWorldVisuals, getBridgeHeight };
}

function nearRoad(x, z, margin) {
  for (const ave of ROAD_NETWORK.avenues) if (Math.abs(x - ave.x) < ave.width / 2 + margin && z >= (ave.minZ ?? -640) - margin && z <= (ave.maxZ ?? 590) + margin) return true;
  for (const blvd of ROAD_NETWORK.boulevards) if (Math.abs(z - blvd.z) < blvd.width / 2 + margin && x >= (blvd.minX ?? -640) - margin && x <= (blvd.maxX ?? 640) + margin) return true;
  const b = ROAD_NETWORK.bridge;
  const abx = b.to.x - b.from.x, abz = b.to.z - b.from.z;
  const t = Math.max(0, Math.min(1, ((x - b.from.x) * abx + (z - b.from.z) * abz) / (abx * abx + abz * abz)));
  if (Math.hypot(x - (b.from.x + abx * t), z - (b.from.z + abz * t)) < b.width / 2 + margin) return true;
  return false;
}

function makeCanvasTexture(w, h, painter) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  painter(canvas.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

function litWindowTexture(base, litRatio, rng, balconies) {
  return makeCanvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    for (let y = 8; y < h - 8; y += 16) {
      if (balconies && (y / 16) % 3 === 0) { ctx.fillStyle = 'rgba(10,10,24,0.9)'; ctx.fillRect(4, y + 10, w - 8, 4); }
      for (let x = 8; x < w - 8; x += 14) {
        const lit = rng() < litRatio;
        ctx.fillStyle = lit ? (rng() < 0.75 ? '#ffd97a' : '#7df3ff') : 'rgba(8,12,28,0.85)';
        ctx.fillRect(x, y, 9, 10);
      }
    }
  });
}

function neonSignTexture(text, fg, bg) {
  return makeCanvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = fg; ctx.lineWidth = 6; ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = fg; ctx.font = '900 52px Verdana, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = fg; ctx.shadowBlur = 22; ctx.fillText(text, w / 2, h / 2);
  });
}

function asphaltTexture(rng) {
  const tex = makeCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#33324a'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i += 1) {
      ctx.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.16)';
      ctx.fillRect(rng() * w, rng() * h, 2, 2);
    }
    ctx.fillStyle = '#8f8fa5'; ctx.fillRect(0, 0, 26, h); ctx.fillRect(w - 26, 0, 26, h);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    for (let y = 0; y < h; y += 16) { ctx.fillRect(28, y, 3, 8); ctx.fillRect(w - 31, y, 3, 8); }
    ctx.fillStyle = '#c23b3b'; ctx.fillRect(0, 0, 6, h); ctx.fillRect(w - 6, 0, 6, h);
    ctx.fillStyle = '#e8e4da';
    for (let y = 10; y < h - 10; y += 22) { ctx.fillRect(26, y, 5, 12); ctx.fillRect(w - 31, y, 5, 12); }
    ctx.fillStyle = '#d8b93a'; ctx.fillRect(w / 2 - 6, 0, 3, h); ctx.fillRect(w / 2 + 3, 0, 3, h);
    ctx.fillStyle = '#e8e4da';
    for (let x = 34; x < w - 34; x += 24) { ctx.fillRect(x, 8, 12, 26); ctx.fillRect(x, h - 34, 12, 26); }
    ctx.fillStyle = '#f2eee2';
    for (let y = 40; y < h - 30; y += 64) for (let x = 60; x < w - 60; x += 22) ctx.fillRect(x, y, 10, 4);
  });
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  return tex;
}

function addCollider(colliders, obj) {
  obj.updateWorldMatrix(true, true);
  colliders.push(new THREE.Box3().setFromObject(obj));
}

function hotelTower(scene, colliders, x, z, w, h, d, tex) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ map: tex }));
  body.position.y = h / 2; body.castShadow = true; body.receiveShadow = true; g.add(body);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 1.4, d + 1), new THREE.MeshBasicMaterial({ color: 0x38e8ff }));
  trim.position.y = h - 2; g.add(trim);
  g.position.set(x, 0, z); scene.add(g); addCollider(colliders, body);
}

function storeSign(scene, animated, text, x, y, z, color, w) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4),
    new THREE.MeshBasicMaterial({ map: neonSignTexture(text, color, '#12081f'), side: THREE.DoubleSide }));
  mesh.position.set(x, y, z); scene.add(mesh); animated.signs.push(mesh);
}

function buildGarageBay(scene, colliders, animated) {
  const g = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a3a55, roughness: 0.6 });
  const neon = new THREE.MeshBasicMaterial({ color: 0x38e8ff });
  for (const sx of [-9, 9]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(1.2, 7, 16), wallMat);
    wall.position.set(sx, 3.5, 0); wall.castShadow = true; g.add(wall);
  }
  const back = new THREE.Mesh(new THREE.BoxGeometry(19, 7, 1.2), wallMat);
  back.position.set(0, 3.5, -8); g.add(back);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(19, 0.8, 17), wallMat);
  roof.position.set(0, 7.2, 0); roof.castShadow = true; g.add(roof);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(19, 0.5, 0.5), neon);
  strip.position.set(0, 6.4, 8); g.add(strip);
  const glow = new THREE.PointLight(0x38e8ff, 30, 34, 1.8);
  glow.position.set(0, 5, 0); g.add(glow);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(20, 5),
    new THREE.MeshBasicMaterial({ map: neonSignTexture('CORAL MOD GARAGE', '#38e8ff', '#0a1420'), side: THREE.DoubleSide }));
  sign.position.set(0, 10, 0); g.add(sign); animated.signs.push(sign);
  g.position.set(-40, 0, 60); scene.add(g); addCollider(colliders, back);
}

function buildBillboards(scene, colliders, rng) {
  const spots = [
    { x: -260, z: -300, t: 'VELOCE GT' }, { x: 120, z: 240, t: 'SOLAR CLUB' },
    { x: 300, z: 420, t: 'BAHIA PORT' }, { x: -440, z: 160, t: 'HOTEL MARIPOSA' },
  ];
  for (const s of spots) {
    if (isWater(s.x, s.z)) continue;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 12, 8), new THREE.MeshLambertMaterial({ color: 0x22242e }));
    pole.position.set(s.x, 6, s.z); scene.add(pole);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(18, 6),
      new THREE.MeshBasicMaterial({ map: neonSignTexture(s.t, rng() < 0.5 ? '#ffc44d' : '#38e8ff', '#12081f'), side: THREE.DoubleSide }));
    board.position.set(s.x, 14, s.z); board.rotation.y = rng() * 3.14; scene.add(board);
    addCollider(colliders, pole);
  }
}

function buildPalm(rng) {
  const palm = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2fae5f, side: THREE.DoubleSide });
  const curve = (rng() - 0.5) * 1.6;
  let x = 0;
  for (let i = 0; i < 5; i += 1) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.22 - i * 0.02, 0.28 - i * 0.02, 1.6, 7), trunkMat);
    x += curve * 0.14; seg.position.set(x, 0.8 + i * 1.45, 0); seg.rotation.z = -curve * 0.16;
    seg.castShadow = true; palm.add(seg);
  }
  const topY = 0.8 + 5 * 1.45;
  for (let i = 0; i < 10; i += 1) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.8, 4, 1), leafMat);
    const a = (i / 10) * Math.PI * 2;
    leaf.position.set(x + Math.cos(a) * 1.9, topY - 0.3 - (i % 2) * 0.35, Math.sin(a) * 1.9);
    leaf.rotation.y = -a; leaf.rotation.z = -0.5; leaf.castShadow = true; palm.add(leaf);
  }
  const nut = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), new THREE.MeshLambertMaterial({ color: 0x6b4a1f }));
  nut.position.set(x, topY - 0.3, 0); palm.add(nut);
  return palm;
}

function buildStreetlamp() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x22242e, roughness: 0.6, metalness: 0.5 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 8), mat);
  pole.position.y = 3.5; pole.castShadow = true; g.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 0.14), mat);
  arm.position.set(0.7, 6.9, 0); g.add(arm);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd97a }));
  bulb.position.set(1.4, 6.75, 0); g.add(bulb);
  const light = new THREE.PointLight(0xffbe5a, 18, 26, 1.8);
  light.position.copy(bulb.position); g.add(light);
  g.userData.bulb = bulb;
  return g;
}

function buildCrane(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.35 });
  const legG = new THREE.BoxGeometry(1.2, 22, 1.2);
  for (const [lx, lz] of [[-5, -4], [5, -4], [-5, 4], [5, 4]]) {
    const leg = new THREE.Mesh(legG, mat);
    leg.position.set(lx, 11, lz); leg.castShadow = true; g.add(leg);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(30, 2, 2.4), mat);
  beam.position.set(4, 23, 0); beam.castShadow = true; g.add(beam);
  const box = new THREE.Mesh(new THREE.BoxGeometry(4, 2.4, 2.6), new THREE.MeshLambertMaterial({ color: 0xff5a4e }));
  box.position.set(12, 12.5, 0); box.castShadow = true; g.add(box);
  return g;
}
