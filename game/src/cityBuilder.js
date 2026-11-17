// Costa Vermillion: Sunset Syndicate — golden-hour 3D Puerto Vermillion builder.
// 100% original content. Imports only 'three' and './cityConfig.js'.
import * as THREE from 'three';
import {
  DISTRICTS,
  INTERSECTIONS,
  LANDMARKS,
  ROAD_NETWORK,
  VERMILLION_BAY,
  WORLD_BOUNDS,
  isWater,
} from './cityConfig.js';

function makeCanvasTexture(w, h, painter) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  painter(canvas.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function litWindowTexture(base, litRatio, rng) {
  return makeCanvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (let y = 8; y < h - 8; y += 16) {
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
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = fg;
    ctx.font = '900 56px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = fg;
    ctx.shadowBlur = 22;
    ctx.fillText(text, w / 2, h / 2);
  });
}

function asphaltTexture(rng) {
  return makeCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#33324a';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i += 1) {
      ctx.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.16)';
      ctx.fillRect(rng() * w, rng() * h, 2, 2);
    }
    // Edge lines + center dashes + crosswalk stripes + sidewalk borders.
    ctx.fillStyle = '#e8e4da';
    ctx.fillRect(6, 0, 5, h);
    ctx.fillRect(w - 11, 0, 5, h);
    ctx.fillStyle = '#ffd44d';
    for (let y = 0; y < h; y += 42) ctx.fillRect(w / 2 - 3, y, 6, 22);
    ctx.fillStyle = 'rgba(240,238,230,0.9)';
    for (let x = 20; x < w - 20; x += 24) {
      ctx.fillRect(x, 8, 12, 26);
      ctx.fillRect(x, h - 34, 12, 26);
    }
    ctx.fillStyle = 'rgba(180,178,190,0.85)';
    ctx.fillRect(0, 0, 4, h);
    ctx.fillRect(w - 4, 0, 4, h);
  });
}

function addCollider(colliders, obj) {
  obj.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(obj);
  colliders.push(box);
  return box;
}

function buildPalm(rng) {
  const palm = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2fae5f, side: THREE.DoubleSide });
  const segs = 5;
  let x = 0;
  const curve = (rng() - 0.5) * 1.6;
  for (let i = 0; i < segs; i += 1) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.22 - i * 0.02, 0.28 - i * 0.02, 1.6, 7), trunkMat);
    x += curve * 0.14;
    seg.position.set(x, 0.8 + i * 1.45, 0);
    seg.rotation.z = -curve * 0.16;
    seg.castShadow = true;
    palm.add(seg);
  }
  const topY = 0.8 + segs * 1.45;
  for (let i = 0; i < 7; i += 1) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.9, 4, 1), leafMat);
    const a = (i / 7) * Math.PI * 2;
    leaf.position.set(x + Math.cos(a) * 1.4, topY, Math.sin(a) * 1.4);
    leaf.rotation.y = -a;
    leaf.rotation.z = -0.45;
    leaf.castShadow = true;
    palm.add(leaf);
  }
  const nut = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0x6b4a1f }),
  );
  nut.position.set(x, topY - 0.3, 0);
  palm.add(nut);
  return palm;
}

function buildStreetlamp() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x22242e, roughness: 0.6, metalness: 0.5 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 8), mat);
  pole.position.y = 3.5;
  pole.castShadow = true;
  g.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 0.14), mat);
  arm.position.set(0.7, 6.9, 0);
  g.add(arm);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd97a });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), bulbMat);
  bulb.position.set(1.4, 6.75, 0);
  g.add(bulb);
  const light = new THREE.PointLight(0xffbe5a, 18, 26, 1.8);
  light.position.copy(bulb.position);
  g.add(light);
  g.userData.bulb = bulb;
  return g;
}

function buildUmbrella(color) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6),
    new THREE.MeshLambertMaterial({ color: 0xf2ead8 }),
  );
  pole.position.y = 1.3;
  g.add(pole);
  const top = new THREE.Mesh(
    new THREE.ConeGeometry(1.7, 0.9, 10),
    new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }),
  );
  top.position.y = 2.7;
  top.castShadow = true;
  g.add(top);
  return g;
}

function buildCrane(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.35 });
  const legG = new THREE.BoxGeometry(1.2, 22, 1.2);
  for (const [lx, lz] of [[-5, -4], [5, -4], [-5, 4], [5, 4]]) {
    const leg = new THREE.Mesh(legG, mat);
    leg.position.set(lx, 11, lz);
    leg.castShadow = true;
    g.add(leg);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(30, 2, 2.4), mat);
  beam.position.set(4, 23, 0);
  beam.castShadow = true;
  g.add(beam);
  const cable = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 9, 0.25),
    new THREE.MeshBasicMaterial({ color: 0x11131c }),
  );
  cable.position.set(12, 18, 0);
  g.add(cable);
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(4, 2.4, 2.6),
    new THREE.MeshLambertMaterial({ color: 0xff5a4e }),
  );
  box.position.set(12, 12.5, 0);
  box.castShadow = true;
  g.add(box);
  return g;
}

function buildDriveInArch(label, color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x141428,
    emissive: color,
    emissiveIntensity: 0.9,
    roughness: 0.4,
  });
  for (const sx of [-6, 6]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.9, 7, 0.9), mat);
    post.position.set(sx, 3.5, 0);
    post.castShadow = true;
    g.add(post);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(13.5, 1.4, 1), mat);
  lintel.position.y = 7.4;
  g.add(lintel);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(11, 2.6),
    new THREE.MeshBasicMaterial({ map: neonSignTexture(label, '#ffd97a', '#140a26'), side: THREE.DoubleSide }),
  );
  sign.position.y = 7.4;
  g.add(sign);
  return g;
}

export function buildCoastalCityWorld(scene, rng) {
  const animated = { water: [], foam: [], lamps: [], beacons: [], signs: [], smoke: null };
  const colliders = [];

  scene.fog = new THREE.Fog(0xff8a4d, 320, 1500);
  scene.background = new THREE.Color(0x2a1145);

  // Sunset sky dome with glowing solar disc low over the western horizon.
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x2c1658) },
      midColor: { value: new THREE.Color(0xff5a6e) },
      lowColor: { value: new THREE.Color(0xffa63d) },
      sunDir: { value: new THREE.Vector3(-0.82, 0.1, 0.28).normalize() },
    },
    vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'varying vec3 vDir;',
      'uniform vec3 topColor; uniform vec3 midColor; uniform vec3 lowColor; uniform vec3 sunDir;',
      'void main() {',
      '  float h = clamp(vDir.y, -0.1, 1.0);',
      '  vec3 col = mix(lowColor, midColor, smoothstep(-0.05, 0.28, h));',
      '  col = mix(col, topColor, smoothstep(0.25, 0.85, h));',
      '  float sun = pow(max(dot(normalize(vDir), sunDir), 0.0), 220.0);',
      '  float glow = pow(max(dot(normalize(vDir), sunDir), 0.0), 8.0);',
      '  col += vec3(1.0, 0.85, 0.55) * sun * 2.4 + vec3(1.0, 0.45, 0.2) * glow * 0.7;',
      '  gl_FragColor = vec4(col, 1.0);',
      '}',
    ].join('\n'),
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1900, 24, 16), skyMat));

  // Warm directional golden-hour sunlight (shadow casting) + hemisphere fill.
  const sun = new THREE.DirectionalLight(0xffb066, 2.6);
  sun.position.set(-420, 170, 150);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -700;
  sun.shadow.camera.right = 700;
  sun.shadow.camera.top = 700;
  sun.shadow.camera.bottom = -700;
  sun.shadow.camera.far = 1600;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xff9d7a, 0x1c2f55, 0.85));
  const bounce = new THREE.AmbientLight(0x59356e, 0.5);
  scene.add(bounce);

  // Ground districts: dark slate/concrete urban base (sand lives ONLY on the beach strip).
  const urbanMat = new THREE.MeshLambertMaterial({ color: 0x3b3a52 });
  const urbanBase = new THREE.Mesh(new THREE.PlaneGeometry(1240, 1240), urbanMat);
  urbanBase.rotation.x = -Math.PI / 2;
  urbanBase.position.set(0, -0.08, 0);
  urbanBase.receiveShadow = true;
  scene.add(urbanBase);
  for (const d of DISTRICTS) {
    // Tint each district over the concrete base (kept subtle so streets read as city).
    const tint = d.id === 'coral_promenade' ? 0x8a6a55
      : d.id === 'downtown_vermillion' ? 0x565a74
      : d.id === 'bahia_cargo_docks' ? 0x5e563e : 0x3f7d55;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(d.size.x, d.size.z),
      new THREE.MeshLambertMaterial({ color: tint, transparent: true, opacity: 0.55 }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(d.center.x, -0.04, d.center.z);
    m.receiveShadow = true;
    scene.add(m);
  }
  // Green grass park plazas + paved courtyards scattered through the urban grid.
  const parkMat = new THREE.MeshLambertMaterial({ color: 0x3f9e57 });
  const courtMat = new THREE.MeshLambertMaterial({ color: 0x8f8fa5 });
  const parkSpots = [
    { x: -180, z: -140, w: 70, h: 54 }, { x: 40, z: 120, w: 84, h: 60 },
    { x: -360, z: 20, w: 60, h: 70 }, { x: 200, z: -160, w: 76, h: 52 },
    { x: 200, z: 240, w: 90, h: 56 }, { x: -120, z: 300, w: 70, h: 48 },
    { x: 420, z: -260, w: 64, h: 52 },
  ];
  for (const p of parkSpots) {
    if (isWater(p.x, p.z)) continue;
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), parkMat);
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(p.x, 0.02, p.z);
    lawn.receiveShadow = true;
    scene.add(lawn);
    const court = new THREE.Mesh(new THREE.PlaneGeometry(p.w * 0.45, p.h * 0.45), courtMat);
    court.rotation.x = -Math.PI / 2;
    court.position.set(p.x, 0.04, p.z);
    court.receiveShadow = true;
    scene.add(court);
  }

  // Animated vivid cyan-turquoise specular ocean + shoreline foam.
  // Rich tropical emissive glow so the water reads bright turquoise at any angle.
  const waterMat = new THREE.MeshPhongMaterial({
    color: 0x14d4ea,
    emissive: 0x0b7a99,
    emissiveIntensity: 0.62,
    specular: 0xf2ffff,
    shininess: 180,
    transparent: true,
    opacity: 0.96,
  });
  const oceanWest = new THREE.Mesh(new THREE.PlaneGeometry(320, 1400), waterMat);
  oceanWest.rotation.x = -Math.PI / 2;
  oceanWest.position.set(-720, 0.07, 0);
  scene.add(oceanWest);
  const oceanSouth = new THREE.Mesh(new THREE.PlaneGeometry(1500, 180), waterMat);
  oceanSouth.rotation.x = -Math.PI / 2;
  oceanSouth.position.set(0, 0.07, 680);
  scene.add(oceanSouth);
  const bay = new THREE.Mesh(
    new THREE.PlaneGeometry(
      (VERMILLION_BAY.maxX - VERMILLION_BAY.minX) + 130,
      (VERMILLION_BAY.maxZ - VERMILLION_BAY.minZ) + 130,
    ),
    waterMat.clone(),
  );
  bay.rotation.x = -Math.PI / 2;
  bay.position.set(
    (VERMILLION_BAY.minX + VERMILLION_BAY.maxX) / 2,
    0.07,
    (VERMILLION_BAY.minZ + VERMILLION_BAY.maxZ) / 2,
  );
  scene.add(bay);
  animated.water.push(oceanWest, oceanSouth, bay);
  // Bright cyan-white wave/foam strips across the bay so the surface pops at
  // shallow viewing angles (speedboat runs, causeway crossings).
  const bayFoamMat = new THREE.MeshBasicMaterial({ color: 0xd8fbff, transparent: true, opacity: 0.5 });
  for (let fz = VERMILLION_BAY.minZ + 40; fz < VERMILLION_BAY.maxZ; fz += 80) {
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry((VERMILLION_BAY.maxX - VERMILLION_BAY.minX) + 120, 7),
      bayFoamMat,
    );
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(
      (VERMILLION_BAY.minX + VERMILLION_BAY.maxX) / 2,
      0.10,
      fz,
    );
    scene.add(strip);
    animated.foam.push(strip);
  }

  const foamMat = new THREE.MeshBasicMaterial({ color: 0xfff6e2, transparent: true, opacity: 0.65 });
  const foamWest = new THREE.Mesh(new THREE.PlaneGeometry(10, 1300), foamMat);
  foamWest.rotation.x = -Math.PI / 2;
  foamWest.position.set(-556, 0.10, 0);
  scene.add(foamWest);
  const foamSouth = new THREE.Mesh(new THREE.PlaneGeometry(1400, 10), foamMat.clone());
  foamSouth.rotation.x = -Math.PI / 2;
  foamSouth.position.set(0, 0.10, 586);
  scene.add(foamSouth);
  animated.foam.push(foamWest, foamSouth);

  // Golden Coral Promenade sand beach + umbrellas + lifeguard stand + marina piers.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 900),
    new THREE.MeshLambertMaterial({ color: 0xffdf9e }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(-520, 0.02, 60);
  sand.receiveShadow = true;
  scene.add(sand);
  const umbrellaColors = [0xff5a4e, 0x38e8ff, 0xffc44d, 0xff3fa4, 0x7fd6a4];
  for (let i = 0; i < 22; i += 1) {
    const u = buildUmbrella(umbrellaColors[i % umbrellaColors.length]);
    u.position.set(-548 + rng() * 56, 0, -320 + rng() * 740);
    scene.add(u);
  }
  const stand = new THREE.Group();
  const standMat = new THREE.MeshLambertMaterial({ color: 0xff5a4e });
  const hut = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), standMat);
  hut.position.y = 4;
  hut.castShadow = true;
  stand.add(hut);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 1.6, 4), new THREE.MeshLambertMaterial({ color: 0xfff3d6 }));
  roof.position.y = 6.2;
  roof.rotation.y = Math.PI / 4;
  stand.add(roof);
  for (const [lx, lz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.4, 0.4), new THREE.MeshLambertMaterial({ color: 0x7a5230 }));
    leg.position.set(lx, 1.7, lz);
    stand.add(leg);
  }
  stand.position.set(-530, 0, 330);
  scene.add(stand);
  addCollider(colliders, hut);
  for (let p = 0; p < 3; p += 1) {
    const pier = new THREE.Mesh(
      new THREE.BoxGeometry(60, 1, 6),
      new THREE.MeshLambertMaterial({ color: 0x6e4a2c }),
    );
    pier.position.set(-600, 0.4, -140 + p * 220);
    pier.castShadow = true;
    pier.receiveShadow = true;
    scene.add(pier);
  }

  // Procedural asphalt roads matching ROAD_NETWORK.
  const roadTex = asphaltTexture(rng);
  roadTex.wrapS = THREE.RepeatWrapping;
  roadTex.wrapT = THREE.RepeatWrapping;
  const roadGroup = new THREE.Group();
  const span = 1320;
  for (const ave of ROAD_NETWORK.avenues) {
    const tex = roadTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(1, span / 26);
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(ave.width, span),
      new THREE.MeshLambertMaterial({ map: tex }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(ave.x, ROAD_NETWORK.roadY, 0);
    road.receiveShadow = true;
    roadGroup.add(road);
  }
  for (const blvd of ROAD_NETWORK.boulevards) {
    const tex = roadTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(span / 26, 1);
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(span, blvd.width),
      new THREE.MeshLambertMaterial({ map: tex }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, ROAD_NETWORK.roadY, blvd.z);
    road.receiveShadow = true;
    roadGroup.add(road);
  }
  scene.add(roadGroup);
  for (const n of INTERSECTIONS) {
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshLambertMaterial({ color: 0x3a3952 }),
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(n.x, ROAD_NETWORK.roadY + 0.02, n.z);
    pad.receiveShadow = true;
    scene.add(pad);
  }

  // Flamingo Causeway: white suspension towers + cables over the bay to Starlight Keys.
  const bridge = ROAD_NETWORK.bridge;
  const from = new THREE.Vector3(bridge.from.x, bridge.deckY, bridge.from.z);
  const to = new THREE.Vector3(bridge.to.x, bridge.deckY, bridge.to.z);
  const length = from.distanceTo(to);
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(bridge.width, 1.4, length),
    new THREE.MeshLambertMaterial({ map: roadTex }),
  );
  deck.position.copy(from).lerp(to, 0.5);
  deck.lookAt(to.x, bridge.deckY, to.z);
  deck.castShadow = true;
  deck.receiveShadow = true;
  scene.add(deck);
  const railMat = new THREE.MeshStandardMaterial({ color: 0xffc44d, emissive: 0xff7a3c, emissiveIntensity: 0.35 });
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, length), railMat);
    rail.position.copy(deck.position);
    const dir = new THREE.Vector3().subVectors(to, from).normalize();
    const normal = new THREE.Vector3(-dir.z, 0, dir.x);
    rail.position.addScaledVector(normal, side * (bridge.width / 2));
    rail.position.y += 1.4;
    rail.rotation.y = deck.rotation.y;
    scene.add(rail);
  }
  const suspMat = new THREE.MeshStandardMaterial({ color: 0xf4f6ff, roughness: 0.35, metalness: 0.25, emissive: 0xffd97a, emissiveIntensity: 0.25 });
  const cableMat = new THREE.MeshBasicMaterial({ color: 0xfff3d6 });
  const suspDir = new THREE.Vector3().subVectors(to, from).normalize();
  const suspNormal = new THREE.Vector3(-suspDir.z, 0, suspDir.x);
  for (let i = 1; i <= 4; i += 1) {
    const t = i / 5;
    const base = new THREE.Vector3().copy(from).lerp(to, t);
    for (const side of [-1, 1]) {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(2.4, 44, 2.4), suspMat);
      tower.position.set(
        base.x + suspNormal.x * side * (bridge.width / 2 + 1),
        bridge.deckY + 20,
        base.z + suspNormal.z * side * (bridge.width / 2 + 1),
      );
      tower.castShadow = true;
      scene.add(tower);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 3.4), new THREE.MeshBasicMaterial({ color: 0xffc44d }));
      cap.position.set(tower.position.x, bridge.deckY + 42, tower.position.z);
      scene.add(cap);
      // Main suspension cable: catenary-ish curve from deck up over the tower.
      const cPts = [];
      for (let k = 0; k <= 12; k += 1) {
        const u = k / 12;
        const px = base.x + suspDir.x * (u - 0.5) * (length / 4.4) + suspNormal.x * side * (bridge.width / 2 + 1);
        const pz = base.z + suspDir.z * (u - 0.5) * (length / 4.4) + suspNormal.z * side * (bridge.width / 2 + 1);
        const py = bridge.deckY + 2 + Math.pow(Math.abs(u - 0.5) * 2, 1.6) * 38;
        cPts.push(new THREE.Vector3(px, py, pz));
      }
      const cable = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cPts), 16, 0.22, 5, false),
        cableMat,
      );
      scene.add(cable);
    }
  }

  // District architecture.
  const hotelTex = litWindowTexture('#f7d9b8', 0.72, rng);
  const downtownTex = litWindowTexture('#3f4a6e', 0.55, rng);
  const clubTex = litWindowTexture('#47245e', 0.8, rng);

  // Keep asphalt + the open ave_coral corridor clear: no building may sit on or
  // beside any road, and nothing may sit west of x=-432 (open beach & ocean).
  function isNearAnyRoad(x, z, margin = 20) {
    for (const ave of ROAD_NETWORK.avenues) {
      if (Math.abs(x - ave.x) < ave.width / 2 + margin) return true;
    }
    for (const blvd of ROAD_NETWORK.boulevards) {
      if (Math.abs(z - blvd.z) < blvd.width / 2 + margin) return true;
    }
    // Distance from (x,z) to the Flamingo Causeway bridge segment.
    const b = ROAD_NETWORK.bridge;
    const abx = b.to.x - b.from.x;
    const abz = b.to.z - b.from.z;
    const t = Math.max(0, Math.min(1, ((x - b.from.x) * abx + (z - b.from.z) * abz) / (abx * abx + abz * abz)));
    const dx = x - (b.from.x + abx * t);
    const dz = z - (b.from.z + abz * t);
    if (Math.hypot(dx, dz) < b.width / 2 + margin) return true;
    return false;
  }

  function avenueClear(x, z, margin = 20) {
    return !isNearAnyRoad(x, z, margin) && x > -432;
  }
  const signs = [
    { text: 'HOTEL MARIPOSA', pos: { x: -412, z: -75 }, color: '#ffd97a', w: 34, y: 30 },
    { text: 'SOLAR CLUB', pos: { x: -330, z: 210 }, color: '#38e8ff', w: 26, y: 16 },
    { text: 'VERMILLION TOWER', pos: { x: 60, z: -120 }, color: '#ff3fa4', w: 40, y: 120 },
  ];
  for (const s of signs) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(s.w, s.w / 4),
      new THREE.MeshBasicMaterial({ map: neonSignTexture(s.text, s.color, '#12081f') }),
    );
    mesh.position.set(s.pos.x, s.y, s.pos.z);
    scene.add(mesh);
    animated.signs.push(mesh);
  }

  function hotelTower(x, z, w, h, d, tex) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ map: tex }),
    );
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(w + 1, 1.4, d + 1),
      new THREE.MeshBasicMaterial({ color: 0x38e8ff }),
    );
    trim.position.y = h - 2;
    g.add(trim);
    g.position.set(x, 0, z);
    scene.add(g);
    addCollider(colliders, body);
  }

  // Coral Promenade pastel Art-Deco hotels.
  const pastel = ['#ffd9c2', '#ffc2d4', '#bdf3ff', '#fff3c2'];
  for (let i = 0; i < 14; i += 1) {
    const x = -500 + (i % 4) * 62 + rng() * 14;
    const z = -280 + Math.floor(i / 4) * 150 + rng() * 30;
    if (isWater(x, z)) continue;
    if (!avenueClear(x, z, 20)) continue;
    hotelTower(x, z, 26 + rng() * 10, 22 + rng() * 14, 22, litWindowTexture(pastel[i % pastel.length], 0.7, rng));
  }
  hotelTower(-412, -75, 36, 30, 26, hotelTex);
  hotelTower(-330, 210, 30, 16, 24, clubTex);

  // Downtown glass skyscrapers incl. VERMILLION TOWER.
  const tower = new THREE.Mesh(
    new THREE.BoxGeometry(44, 120, 44),
    new THREE.MeshStandardMaterial({ map: downtownTex, roughness: 0.25, metalness: 0.55, emissive: 0x1a1440, emissiveIntensity: 0.5 }),
  );
  tower.position.set(60, 60, -120);
  tower.castShadow = true;
  scene.add(tower);
  addCollider(colliders, tower);
  const crown = new THREE.Mesh(
    new THREE.BoxGeometry(46, 4, 46),
    new THREE.MeshBasicMaterial({ color: 0xff3fa4 }),
  );
  crown.position.set(60, 121, -120);
  scene.add(crown);
  const blockPalette = ['#ff9e7a', '#7ad9ff', '#ffd97a', '#ff7ad9', '#9dff9e', '#c2b3ff', '#ffb36b', '#8ef3e3'];
  const blockTexes = blockPalette.map((c) => litWindowTexture(c, 0.62, rng));
  for (let i = 0; i < 16; i += 1) {
    const x = -180 + rng() * 380;
    const z = -300 + rng() * 420;
    if (isWater(x, z) || Math.hypot(x - 60, z + 120) < 60) continue;
    if (!avenueClear(x, z, 20)) continue;
    const h = 34 + rng() * 60;
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(24, h, 24),
      new THREE.MeshStandardMaterial({ map: downtownTex, roughness: 0.35, metalness: 0.5 }),
    );
    b.position.set(x, h / 2, z);
    b.castShadow = true;
    scene.add(b);
    addCollider(colliders, b);
  }
  // Dense mid-rise/high-rise blocks lining BOTH sides of every avenue + boulevard.
  // (Set back from the asphalt, outside intersections/pads, never on water or the beach.)
  function roadsideClear(x, z, half = 12) {
    if (isWater(x, z)) return false;
    if (x < -560) return false; // keep golden sand exclusively on the western beach strip
    if (!avenueClear(x, z, 20)) return false; // never on/beside asphalt or west of ave_coral
    for (const n of INTERSECTIONS) {
      if (Math.abs(n.x - x) < 16 + half * 0.4 && Math.abs(n.z - z) < 16 + half * 0.4) return false;
    }
    for (const lm of LANDMARKS) {
      if (Math.hypot(lm.pos.x - x, lm.pos.z - z) < 22) return false;
    }
    for (const p of parkSpots) {
      if (Math.abs(p.x - x) < p.w / 2 + half && Math.abs(p.z - z) < p.h / 2 + half) return false;
    }
    return true;
  }
  function roadsideBlock(x, z) {
    const w = 16 + rng() * 10;
    const d = 16 + rng() * 10;
    const h = 14 + rng() * 52;
    const tex = blockTexes[Math.floor(rng() * blockTexes.length)];
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.25 }),
    );
    b.position.set(x, h / 2, z);
    b.castShadow = true;
    b.receiveShadow = true;
    b.rotation.y = (rng() - 0.5) * 0.08;
    scene.add(b);
    addCollider(colliders, b);
    // Rooftop neon edge so blocks read at golden hour.
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.6, 0.7, d + 0.6),
      new THREE.MeshBasicMaterial({ color: rng() < 0.5 ? 0x38e8ff : 0xffc44d }),
    );
    edge.position.set(x, h + 0.3, z);
    edge.rotation.y = b.rotation.y;
    scene.add(edge);
  }
  for (const ave of ROAD_NETWORK.avenues) {
    for (let z = -560; z <= 560; z += 44) {
      for (const side of [-1, 1]) {
        const x = ave.x + side * (ave.width / 2 + 20 + rng() * 6);
        if (roadsideClear(x, z)) roadsideBlock(x, z);
      }
    }
  }
  for (const blvd of ROAD_NETWORK.boulevards) {
    if (blvd.id === 'blvd_keys') continue; // Keys villas already cover Starlight
    for (let x = -520; x <= 560; x += 46) {
      for (const side of [-1, 1]) {
        const z = blvd.z + side * (blvd.width / 2 + 20 + rng() * 6);
        if (roadsideClear(x, z)) roadsideBlock(x, z);
      }
    }
  }

  // Bahia Cargo Docks: gantry cranes + colorful containers.
  const containerColors = [0xff5a4e, 0x38e8ff, 0xffc44d, 0x7fd6a4, 0xff3fa4, 0x4d7dff];
  for (const cx of [150, 260, 380]) {
    const crane = buildCrane(0xffc44d);
    crane.position.set(cx, 0, 470);
    scene.add(crane);
    addCollider(colliders, crane);
  }
  for (let i = 0; i < 46; i += 1) {
    const c = new THREE.Mesh(
      new THREE.BoxGeometry(12, 3, 3.2),
      new THREE.MeshLambertMaterial({ color: containerColors[i % containerColors.length] }),
    );
    c.position.set(60 + rng() * 380, 1.5 + (i % 3) * 3.1, 330 + rng() * 160);
    c.rotation.y = (rng() - 0.5) * 0.3;
    c.castShadow = true;
    scene.add(c);
    if (i % 3 === 0) addCollider(colliders, c);
  }

  // Starlight Keys luxury villas.
  for (let i = 0; i < 10; i += 1) {
    const x = 330 + rng() * 220;
    const z = -470 + rng() * 260;
    if (isWater(x, z)) continue;
    const villa = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(20, 7, 16),
      new THREE.MeshLambertMaterial({ color: 0xfff3d6 }),
    );
    base.position.y = 3.5;
    base.castShadow = true;
    villa.add(base);
    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 7),
      new THREE.MeshPhongMaterial({ color: 0x38e8ff, shininess: 140 }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(14, 0.2, 0);
    villa.add(pool);
    villa.position.set(x, 0, z);
    villa.rotation.y = rng() * Math.PI;
    scene.add(villa);
    addCollider(colliders, base);
  }

  // Landmark pads for key locations.
  for (const lm of LANDMARKS) {
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(9, 9, 0.6, 24),
      new THREE.MeshStandardMaterial({ color: 0x141428, emissive: 0xffc44d, emissiveIntensity: 0.35 }),
    );
    pad.position.set(lm.pos.x, 0.3, lm.pos.z);
    pad.receiveShadow = true;
    scene.add(pad);
  }

  // Glowing drive-in arches for garage / armory / safehouse.
  const arches = [
    { label: 'CORAL MOD GARAGE', pos: { x: -40, z: 60 }, color: 0x38e8ff },
    { label: 'HARBOR ARMORY', pos: { x: 90, z: 380 }, color: 0xff5a4e },
    { label: 'STARLIGHT SAFEHOUSE', pos: { x: 460, z: -360 }, color: 0xffc44d },
  ];
  for (const a of arches) {
    const arch = buildDriveInArch(a.label, a.color);
    arch.position.set(a.pos.x, 0, a.pos.z);
    scene.add(arch);
  }

  // Palm rows along boulevards + scattered palms, lamps at every intersection + mid-block.
  for (const blvd of ROAD_NETWORK.boulevards) {
    for (let x = -540; x <= 580; x += 36) {
      if (x < -556 || isWater(x, blvd.z + 14)) continue;
      for (const side of [-1, 1]) {
        if (rng() < 0.25) continue;
        const palm = buildPalm(rng);
        palm.position.set(x + rng() * 8, 0, blvd.z + side * (blvd.width / 2 + 5));
        palm.rotation.y = rng() * Math.PI * 2;
        scene.add(palm);
      }
    }
  }
  for (let i = 0; i < 110; i += 1) {
    const x = WORLD_BOUNDS.minX + rng() * (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX);
    const z = WORLD_BOUNDS.minZ + rng() * (WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ);
    if (isWater(x, z) || x < -556) continue;
    const palm = buildPalm(rng);
    palm.position.set(x, 0, z);
    palm.rotation.y = rng() * Math.PI * 2;
    scene.add(palm);
  }
  for (const n of INTERSECTIONS) {
    const lamp = buildStreetlamp();
    lamp.position.set(n.x + 9, 0, n.z + 9);
    scene.add(lamp);
    animated.lamps.push(lamp);
    if ((n.x + n.z) % 2 === 0) {
      const lamp2 = buildStreetlamp();
      lamp2.position.set(n.x - 9, 0, n.z - 9);
      scene.add(lamp2);
      animated.lamps.push(lamp2);
    }
  }
  for (const ave of ROAD_NETWORK.avenues) {
    for (let z = -520; z <= 520; z += 130) {
      const lamp = buildStreetlamp();
      lamp.position.set(ave.x + ave.width / 2 + 3, 0, z);
      scene.add(lamp);
      animated.lamps.push(lamp);
    }
  }

  // Pulsing golden 3D mission beacon (cylinder + ring).
  const beacon = new THREE.Group();
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffc44d, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 60, 20, 1, true), beamMat);
  beam.position.y = 30;
  beacon.add(beam);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(5, 0.55, 10, 40),
    new THREE.MeshBasicMaterial({ color: 0xffd97a }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.6;
  beacon.add(ring);
  beacon.position.set(-420, 0, -40);
  scene.add(beacon);
  animated.beacons.push({ group: beacon, beam, ring });

  function setBeaconPosition(x, z) {
    beacon.position.set(x, 0, z);
  }

  function updateWorldVisuals(dt, elapsed, targetPos) {
    for (const w of animated.water) {
      // Water rides above urbanBase (-0.08) / district tint (-0.04): +0.07 +/- 0.02.
      w.position.y = 0.07 + Math.sin(elapsed * 1.1 + w.position.x * 0.01) * 0.02;
    }
    for (const f of animated.foam) {
      f.material.opacity = 0.45 + Math.sin(elapsed * 2.2) * 0.2;
    }
    for (const lamp of animated.lamps) {
      lamp.userData.bulb.scale.setScalar(1 + Math.sin(elapsed * 5 + lamp.position.x) * 0.08);
    }
    for (const b of animated.beacons) {
      b.ring.scale.setScalar(1 + Math.sin(elapsed * 3.2) * 0.16);
      b.beam.material.opacity = 0.34 + Math.sin(elapsed * 3.2) * 0.14;
      b.beam.rotation.y += dt * 0.9;
    }
    for (const s of animated.signs) {
      if (targetPos && s.position.distanceTo(targetPos) < 320) s.lookAt(targetPos.x, s.position.y, targetPos.z);
    }
  }

  return { colliders, setBeaconPosition, updateWorldVisuals, beaconPos: beacon.position };
}
