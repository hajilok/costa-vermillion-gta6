import * as THREE from '../vendor/three.module.min.js';
import { WORLD_BOUNDS, ROAD_NETWORK, VERMILLION_BAY, isWater } from './cityConfig.js';

export function buildCoastalCityWorld(scene, rng) {
  if (typeof scene === 'function' && rng === undefined) {
    rng = scene;
    scene = null;
  }
  const rand = typeof rng === 'function' ? rng : Math.random;
  const root = scene || new THREE.Scene();
  const colliders = [];

  const SUN_DIR = new THREE.Vector3(-0.48, 0.2, -0.85).normalize();

  root.fog = new THREE.FogExp2(0xf0b89e, 0.00072);
  root.background = new THREE.Color(0x2c2350);

  const hemi = new THREE.HemisphereLight(0xffe3d0, 0x5a4a7a, 0.85);
  root.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd9b0, 1.7);
  sun.position.copy(SUN_DIR).multiplyScalar(600);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -700;
  sun.shadow.camera.right = 700;
  sun.shadow.camera.top = 700;
  sun.shadow.camera.bottom = -700;
  sun.shadow.camera.far = 2000;
  root.add(sun);
  root.add(new THREE.AmbientLight(0x604a7a, 0.35));

  const skyUniforms = {
    topColor: { value: new THREE.Color(0x564c8e) },
    roseColor: { value: new THREE.Color(0xd982a6) },
    coralColor: { value: new THREE.Color(0xf9a97c) },
    goldColor: { value: new THREE.Color(0xffe3a8) },
    sunDir: { value: SUN_DIR.clone() },
    time: { value: 0 },
  };
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 topColor;
      uniform vec3 roseColor;
      uniform vec3 coralColor;
      uniform vec3 goldColor;
      uniform vec3 sunDir;
      uniform float time;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p *= 2.03;
          a *= 0.5;
        }
        return v;
      }
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.08, 1.0);
        vec3 col = mix(goldColor, coralColor, smoothstep(0.0, 0.18, h));
        col = mix(col, roseColor, smoothstep(0.14, 0.42, h));
        col = mix(col, topColor, smoothstep(0.38, 0.9, h));
        vec2 cuv = d.xz / max(0.12, d.y + 0.25);
        float cl = fbm(cuv * 1.6 + vec2(time * 0.004, 0.0));
        float band = smoothstep(0.02, 0.2, d.y) * (1.0 - smoothstep(0.25, 0.65, d.y));
        vec3 cloudTint = mix(coralColor, goldColor, cl);
        col = mix(col, cloudTint, band * smoothstep(0.35, 0.75, cl) * 0.75);
        col += vec3(1.0, 0.85, 0.7) * band * smoothstep(0.6, 0.95, cl) * 0.35;
        // Sun glow only: no hard white lens-flare orb on the horizon.
        float s = max(dot(d, normalize(sunDir)), 0.0);
        float mie = pow(s, 24.0) * 0.5 + pow(s, 90.0) * 0.5;
        col += vec3(1.0, 0.85, 0.6) * mie;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(1750, 32, 16), skyMat);
  skyDome.frustumCulled = false;
  root.add(skyDome);

  // Dry-land slab only: carve the bay + ocean out so no brown ground
  // ever renders under water. Shape (x, y) maps to world (x, 0, -y) after
  // rotation.x = -PI/2, so shape Y is negated world Z.
  function rectPath(PathClass, x0, z0, x1, z1) {
    const p = new PathClass();
    p.moveTo(x0, -z0);
    p.lineTo(x1, -z0);
    p.lineTo(x1, -z1);
    p.lineTo(x0, -z1);
    p.closePath();
    return p;
  }
  function groundShapeWithWaterCut() {
    const shape = new THREE.Shape();
    shape.moveTo(-700, -700);
    shape.lineTo(700, -700);
    shape.lineTo(700, 700);
    shape.lineTo(-700, 700);
    shape.closePath();
    shape.holes.push(rectPath(THREE.Path, -700, 590, 700, 700));
    shape.holes.push(rectPath(THREE.Path, -700, -700, -560, 700));
    shape.holes.push(rectPath(THREE.Path, VERMILLION_BAY.minX, VERMILLION_BAY.minZ, VERMILLION_BAY.maxX, VERMILLION_BAY.maxZ));
    return new THREE.ShapeGeometry(shape);
  }
  // Water geometry: ONLY the western ocean, southern ocean and the bay.
  // No water quad over dry land, so asphalt and sand stay crisp.
  function waterGeometry() {
    const west = rectPath(THREE.Shape, -760, -700, -560, 700);
    const south = rectPath(THREE.Shape, -760, 590, 760, 700);
    const bay = rectPath(
      THREE.Shape, VERMILLION_BAY.minX, VERMILLION_BAY.minZ, VERMILLION_BAY.maxX, VERMILLION_BAY.maxZ
    );
    return new THREE.ShapeGeometry([west, south, bay]);
  }
  const groundMat = new THREE.MeshStandardMaterial({ color: 0xc9b18a, roughness: 1 });
  const ground = new THREE.Mesh(groundShapeWithWaterCut(), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.15;
  ground.receiveShadow = true;
  root.add(ground);

  const waterUniforms = {
    time: { value: 0 },
    sunDir: { value: SUN_DIR.clone() },
    deepColor: { value: new THREE.Color(0x0a7896) },
    shallowColor: { value: new THREE.Color(0x1cd2e0) },
    sunsetColor: { value: new THREE.Color(0xffd98a) },
    goldColor: { value: new THREE.Color(0xffe9a8) },
    bayMin: { value: new THREE.Vector2(VERMILLION_BAY.minX, VERMILLION_BAY.minZ) },
    bayMax: { value: new THREE.Vector2(VERMILLION_BAY.maxX, VERMILLION_BAY.maxZ) },
  };
  const waterMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({}, THREE.UniformsUtils.clone(THREE.UniformsLib.fog), waterUniforms),
    transparent: false,
    depthWrite: true,
    fog: true,
    vertexShader: `
      varying vec3 vWorld;
      varying vec3 vNormalW;
      uniform float time;
      #include <fog_pars_vertex>
      void main() {
        vec3 p = position;
        vec4 w = modelMatrix * vec4(p, 1.0);
        w.y += sin(w.x * 0.05 + time * 1.2) * 0.12 + sin(w.z * 0.07 - time * 0.9) * 0.1;
        vWorld = w.xyz;
        vNormalW = vec3(0.0, 1.0, 0.0);
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      varying vec3 vWorld;
      varying vec3 vNormalW;
      uniform float time;
      uniform vec3 sunDir;
      uniform vec3 deepColor;
      uniform vec3 shallowColor;
      uniform vec3 sunsetColor;
      uniform vec3 goldColor;
      uniform vec2 bayMin;
      uniform vec2 bayMax;
      #include <fog_pars_fragment>
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec2 p = vWorld.xz;
        float w1 = sin(p.x * 0.35 + time * 1.4) * sin(p.y * 0.3 - time * 1.1);
        float w2 = sin((p.x + p.y) * 0.12 + time * 0.7);
        vec3 n = normalize(vec3(w1 * 0.18 + w2 * 0.1, 1.0, w1 * 0.12 - w2 * 0.14));
        vec3 viewDir = normalize(cameraPosition - vWorld);
        // Vivid coastal turquoise in the shallows, deep azure offshore.
        vec3 base = mix(deepColor, shallowColor, 0.35 + 0.4 * (0.5 + 0.5 * w2));
        float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 1.6);
        base = mix(base, sunsetColor, fres * 0.4);
        // Broad golden sun path plus hot mirror glints.
        vec3 hv = normalize(viewDir + normalize(sunDir));
        float sunPath = pow(max(dot(normalize(vec3(n.x * 0.4, 1.0, n.z * 0.4)), hv), 0.0), 60.0);
        float spec = pow(max(dot(n, hv), 0.0), 260.0);
        float sparkle = step(0.985, hash(floor(p * 3.0) + floor(time * 6.0) * 0.37));
        base += goldColor * (sunPath * 0.85 + spec * 2.4 + sparkle * 0.6 * max(dot(n, viewDir), 0.0));
        // White shoreline foam at the ocean edge, bay rim and south shore.
        float edgeWest = smoothstep(16.0, 0.0, abs(p.x + 560.0));
        float edgeSouth = smoothstep(16.0, 0.0, abs(p.y - 590.0));
        float edgeBayX = min(smoothstep(14.0, 0.0, abs(p.x - bayMin.x)), smoothstep(14.0, 0.0, abs(p.x - bayMax.x)));
        float edgeBayZ = min(smoothstep(14.0, 0.0, abs(p.y - bayMin.y)), smoothstep(14.0, 0.0, abs(p.y - bayMax.y)));
        float foamBand = max(max(edgeWest, edgeSouth), max(edgeBayX, edgeBayZ));
        float foamTex = smoothstep(0.35, 0.9, sin(p.x * 1.4 + time * 2.0) * sin(p.y * 1.2 - time * 1.6));
        base = mix(base, vec3(1.0, 0.98, 0.94), foamBand * (0.55 + 0.45 * foamTex));
        gl_FragColor = vec4(base, 1.0);
        #include <fog_fragment>
      }
    `,
  });
  const water = new THREE.Mesh(waterGeometry(), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.14;
  water.renderOrder = 1;
  root.add(water);

  // Dark-slate highway asphalt: double-yellow centerline, white lane dashes
  // and crosswalk bars. Roads render at y=0.16, above ground and water.
  function makeRoadTexture(vertical) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#262a33';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#2e333e';
    for (let i = 0; i < 500; i++) {
      ctx.fillRect(Math.floor(rand() * 256), Math.floor(rand() * 256), 2, 2);
    }
    ctx.fillStyle = '#3a3f4c';
    ctx.fillRect(0, 0, 10, 256);
    ctx.fillRect(246, 0, 10, 256);
    const along = (x, y, w, h) => (vertical ? ctx.fillRect(x, y, w, h) : ctx.fillRect(y, x, h, w));
    // Crisp double-yellow centerline.
    ctx.fillStyle = '#ffd94d';
    along(120, 0, 5, 256);
    along(131, 0, 5, 256);
    // White lane dashes.
    ctx.fillStyle = '#f5f0dc';
    for (let y = 0; y < 256; y += 42) {
      along(72, y, 6, 24);
      along(178, y, 6, 24);
    }
    // Crosswalk bars near the tile edges.
    ctx.fillStyle = '#f5f0dc';
    for (let x = 24; x < 232; x += 26) {
      along(x, 8, 15, 22);
      along(x, 226, 15, 22);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 4;
    return tex;
  }

  const roadTexV = makeRoadTexture(true);
  const roadTexH = makeRoadTexture(false);
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTexV, roughness: 0.95, metalness: 0 });
  const ROAD_W = 13;
  const ROAD_Y = 0.16;
  const roadGroup = new THREE.Group();
  root.add(roadGroup);

  // Skip road segments that would pave the bay or the western ocean.
  function clipAvenue(a) {
    const spans = [];
    let start = null;
    for (let z = a.minZ; z <= a.maxZ; z += 4) {
      const wet = isWater(a.x, z);
      if (!wet && start === null) start = z;
      if ((wet || z + 4 > a.maxZ) && start !== null) {
        const end = wet ? z - 4 : a.maxZ;
        if (end - start >= 8) spans.push([start, end]);
        start = null;
      }
    }
    return spans;
  }

  function clipBoulevard(b) {
    const spans = [];
    let start = null;
    for (let x = b.minX; x <= b.maxX; x += 4) {
      const wet = isWater(x, b.z);
      if (!wet && start === null) start = x;
      if ((wet || x + 4 > b.maxX) && start !== null) {
        const end = wet ? x - 4 : b.maxX;
        if (end - start >= 8) spans.push([start, end]);
        start = null;
      }
    }
    return spans;
  }

  function addRoadPlane(cx, cz, w, l, tex) {
    const geo = new THREE.PlaneGeometry(w, l);
    const mesh = new THREE.Mesh(geo, roadMat.clone());
    mesh.material.map = tex.clone();
    mesh.material.map.needsUpdate = true;
    mesh.material.map.wrapS = THREE.RepeatWrapping;
    mesh.material.map.wrapT = THREE.RepeatWrapping;
    mesh.material.map.repeat.set(Math.max(1, Math.round(w / 13)), Math.max(1, Math.round(l / 26)));
    mesh.material.map.minFilter = THREE.LinearMipmapLinearFilter;
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(cx, ROAD_Y, cz);
    mesh.receiveShadow = true;
    mesh.renderOrder = 2;
    roadGroup.add(mesh);
  }

  for (const a of ROAD_NETWORK.avenues) {
    for (const [z0, z1] of clipAvenue(a)) {
      addRoadPlane(a.x, (z0 + z1) / 2, ROAD_W, z1 - z0, roadTexV);
    }
  }
  for (const b of ROAD_NETWORK.boulevards) {
    for (const [x0, x1] of clipBoulevard(b)) {
      const len = x1 - x0;
      const geo = new THREE.PlaneGeometry(len, ROAD_W);
      const mesh = new THREE.Mesh(geo, roadMat.clone());
      mesh.material.map = roadTexH.clone();
      mesh.material.map.needsUpdate = true;
      mesh.material.map.wrapS = THREE.RepeatWrapping;
      mesh.material.map.wrapT = THREE.RepeatWrapping;
      mesh.material.map.repeat.set(Math.max(1, Math.round(len / 26)), 1);
      mesh.material.map.minFilter = THREE.LinearMipmapLinearFilter;
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set((x0 + x1) / 2, ROAD_Y, b.z);
      mesh.receiveShadow = true;
      mesh.renderOrder = 2;
      roadGroup.add(mesh);
    }
  }

  function distToBridge(x, z) {
    const b = ROAD_NETWORK.bridge;
    const dx = b.to.x - b.from.x;
    const dz = b.to.z - b.from.z;
    const lenSq = dx * dx + dz * dz;
    const t = Math.min(1, Math.max(0, ((x - b.from.x) * dx + (z - b.from.z) * dz) / lenSq));
    return Math.hypot(x - (b.from.x + dx * t), z - (b.from.z + dz * t));
  }

  function clearOfRoads(x, z, half) {
    for (const a of ROAD_NETWORK.avenues) {
      if (z >= a.minZ - 4 && z <= a.maxZ + 4 && Math.abs(x - a.x) < half + 8) return false;
    }
    for (const b of ROAD_NETWORK.boulevards) {
      if (x >= b.minX - 4 && x <= b.maxX + 4 && Math.abs(z - b.z) < half + 8) return false;
    }
    if (distToBridge(x, z) < half + 14) return false;
    if (isWater(x, z)) return false;
    if (x < WORLD_BOUNDS.minX + 30 || x > WORLD_BOUNDS.maxX - 30) return false;
    if (z < WORLD_BOUNDS.minZ + 30 || z > WORLD_BOUNDS.maxZ - 30) return false;
    return true;
  }

  const pastel = [0xffd9c0, 0xffc4d1, 0xffe3a8, 0xbfe3ff, 0xc9f2d8, 0xe6d4ff, 0xffb59e, 0xfdf6e3];
  const glass = [0x9fd8e8, 0x7fb6d9, 0xc4e8f0, 0xa8c8e8];
  const placed = [];

  function collides(x, z, half) {
    for (const p of placed) {
      if (Math.abs(x - p.x) < half + p.half + 6 && Math.abs(z - p.z) < half + p.half + 6) return true;
    }
    return false;
  }

  const towerGroup = new THREE.Group();
  root.add(towerGroup);
  let attempts = 0;
  let built = 0;
  while (built < 140 && attempts < 4000) {
    attempts += 1;
    const x = WORLD_BOUNDS.minX + 40 + rand() * (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX - 80);
    const z = WORLD_BOUNDS.minZ + 40 + rand() * (WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ - 80);
    const w = 14 + rand() * 16;
    const d = 14 + rand() * 16;
    const half = Math.max(w, d) / 2;
    if (!clearOfRoads(x, z, half)) continue;
    if (collides(x, z, half)) continue;
    const h = 22 + rand() * 78;
    const deco = rand() < 0.5;
    const color = deco ? pastel[Math.floor(rand() * pastel.length)] : glass[Math.floor(rand() * glass.length)];
    const mat = new THREE.MeshStandardMaterial({ color, roughness: deco ? 0.8 : 0.25, metalness: deco ? 0.05 : 0.55 });
    const tower = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    base.position.y = h / 2;
    base.castShadow = true;
    base.receiveShadow = true;
    tower.add(base);
    if (deco) {
      const step1 = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.78, h * 0.22, d * 0.78),
        new THREE.MeshStandardMaterial({ color: 0xfff2d9, roughness: 0.7 })
      );
      step1.position.y = h + h * 0.11;
      step1.castShadow = true;
      tower.add(step1);
      const step2 = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.5, h * 0.14, d * 0.5),
        new THREE.MeshStandardMaterial({ color: 0xff9e7d, roughness: 0.6 })
      );
      step2.position.y = h + h * 0.22 + h * 0.07;
      tower.add(step2);
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 10 + rand() * 10, 2.2),
        new THREE.MeshStandardMaterial({ color: 0xffe3a8, emissive: 0xff9e5e, emissiveIntensity: 0.7 })
      );
      fin.position.y = h + h * 0.29 + 6;
      tower.add(fin);
    } else {
      const crown = new THREE.Mesh(
        new THREE.BoxGeometry(w * 1.02, 2.4, d * 1.02),
        new THREE.MeshStandardMaterial({ color: 0x2c3e55, roughness: 0.4, metalness: 0.6 })
      );
      crown.position.y = h + 1.2;
      tower.add(crown);
    }
    const winMat = new THREE.MeshStandardMaterial({ color: 0x2c2a44, emissive: 0xffd98a, emissiveIntensity: 0.85 });
    for (let fy = 6; fy < h - 2; fy += 6) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 1.1, d + 0.4), winMat);
      strip.position.y = fy;
      tower.add(strip);
    }
    tower.position.set(x, 0, z);
    towerGroup.add(tower);
    placed.push({ x, z, half });
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    built += 1;
  }

  function makeNeonTexture(label, fg) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#14101f';
    ctx.fillRect(0, 0, 512, 128);
    ctx.font = 'bold 54px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = fg;
    ctx.shadowBlur = 26;
    ctx.fillStyle = fg;
    ctx.fillText(label, 256, 66);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = fg;
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, 500, 116);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    return tex;
  }

  const neonMats = [];
  function addNeon(label, color, x, y, z, w) {
    const tex = makeNeonTexture(label, color);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: false });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), mat);
    sign.position.set(x, y, z);
    root.add(sign);
    neonMats.push(mat);
    const back = sign.clone();
    back.rotation.y = Math.PI;
    back.position.z -= 0.4;
    root.add(back);
    return sign;
  }

  addNeon('HOTEL MARIPOSA', '#ff5fa2', -415, 34, 120, 46);
  addNeon('SOLAR CLUB', '#ffd94d', -205, 28, -75, 34);
  addNeon('CORAL MOD GARAGE', '#4df0ff', -40, 12, 60, 40);
  addNeon('VERMILLION BANK', '#7dff8a', -150, 30, 200, 40);

  const garage = new THREE.Group();
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0xff8a5e, roughness: 0.6 });
  for (const [px, pz] of [[-52, 48], [-28, 48], [-52, 72], [-28, 72]]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 9, 10), pillarMat);
    pillar.position.set(px, 4.5, pz);
    pillar.castShadow = true;
    garage.add(pillar);
    colliders.push({ minX: px - 1, maxX: px + 1, minZ: pz - 1, maxZ: pz + 1 });
  }
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(32, 1.4, 30),
    new THREE.MeshStandardMaterial({ color: 0x2dd4bf, roughness: 0.5 })
  );
  roof.position.set(-40, 9.6, 60);
  roof.castShadow = true;
  garage.add(roof);
  const lift = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 12), new THREE.MeshStandardMaterial({ color: 0x39415a }));
  lift.position.set(-40, 0.6, 60);
  garage.add(lift);
  root.add(garage);

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 1 });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2f9e5f, roughness: 0.9, side: THREE.DoubleSide });
  const palms = [];
  function makePalm(x, z, s) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * s, 0.9 * s, 11 * s, 7), trunkMat);
    trunk.position.y = 5.5 * s;
    trunk.rotation.z = 0.12;
    trunk.castShadow = true;
    g.add(trunk);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const frond = new THREE.Mesh(new THREE.PlaneGeometry(6.5 * s, 1.4 * s, 6, 1), frondMat);
      const pos = frond.geometry.attributes.position;
      for (let v = 0; v < pos.count; v++) {
        const px = pos.getX(v);
        pos.setY(v, pos.getY(v) - Math.pow(Math.abs(px) / (3.2 * s), 2) * 1.6 * s);
      }
      frond.geometry.computeVertexNormals();
      frond.position.set(Math.cos(a) * 2.6 * s, 11 * s, Math.sin(a) * 2.6 * s);
      frond.rotation.y = -a;
      frond.rotation.z = 0.35;
      frond.castShadow = true;
      g.add(frond);
    }
    g.position.set(x, 0, z);
    g.rotation.y = rand() * Math.PI * 2;
    root.add(g);
    palms.push(g);
    return g;
  }

  let palmsPlanted = 0;
  let palmTries = 0;
  while (palmsPlanted < 90 && palmTries < 2000) {
    palmTries += 1;
    const x = WORLD_BOUNDS.minX + 20 + rand() * (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX - 40);
    const z = WORLD_BOUNDS.minZ + 20 + rand() * (WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ - 40);
    if (isWater(x, z)) continue;
    if (!clearOfRoads(x, z, 2)) continue;
    if (collides(x, z, 2)) continue;
    makePalm(x, z, 0.8 + rand() * 0.7);
    palmsPlanted += 1;
  }

  const bridge = ROAD_NETWORK.bridge;
  const bridgeGroup = new THREE.Group();
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 0.75, roughness: 0.3, emissive: 0x6b3d00, emissiveIntensity: 0.25 });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.9 });
  const bdx = bridge.to.x - bridge.from.x;
  const bdz = bridge.to.z - bridge.from.z;
  const blen = Math.hypot(bdx, bdz);
  const bang = Math.atan2(bdx, bdz);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(12, 1.2, blen), deckMat);
  deck.position.set((bridge.from.x + bridge.to.x) / 2, bridge.deckY, (bridge.from.z + bridge.to.z) / 2);
  deck.rotation.y = bang;
  deck.castShadow = true;
  deck.receiveShadow = true;
  bridgeGroup.add(deck);
  for (const t of [0.3, 0.7]) {
    const tx = bridge.from.x + bdx * t;
    const tz = bridge.from.z + bdz * t;
    for (const side of [-7, 7]) {
      const px = tx + Math.cos(bang) * side;
      const pz = tz - Math.sin(bang) * side;
      const towerM = new THREE.Mesh(new THREE.BoxGeometry(2.4, 34, 2.4), goldMat);
      towerM.position.set(px, bridge.deckY + 15, pz);
      towerM.castShadow = true;
      bridgeGroup.add(towerM);
      colliders.push({ minX: px - 1.5, maxX: px + 1.5, minZ: pz - 1.5, maxZ: pz + 1.5 });
    }
    const cross = new THREE.Mesh(new THREE.BoxGeometry(17, 2, 2.4), goldMat);
    cross.position.set(tx, bridge.deckY + 30, tz);
    cross.rotation.y = bang;
    bridgeGroup.add(cross);
  }
  const cableMat = new THREE.LineBasicMaterial({ color: 0xffe3a8 });
  for (const side of [-6, 6]) {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const sag = Math.sin(t * Math.PI) * -8;
      pts.push(new THREE.Vector3(
        bridge.from.x + bdx * t + Math.cos(bang) * side,
        bridge.deckY + 30 - (1 - Math.sin(t * Math.PI)) * 0 - (t > 0.25 && t < 0.75 ? 0 : 22) + sag * 0.2,
        bridge.from.z + bdz * t - Math.sin(bang) * side
      ));
    }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), cableMat);
    bridgeGroup.add(line);
  }
  root.add(bridgeGroup);

  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd94d, transparent: true, opacity: 0.9 });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 30, 12, 1, true), beaconMat);
  beacon.position.set(0, 15, 0);
  beacon.visible = false;
  root.add(beacon);

  function setBeaconPosition(x, z) {
    if (x === null || x === undefined) {
      beacon.visible = false;
      return;
    }
    beacon.position.set(x, 15, z);
    beacon.visible = true;
  }

  function getBridgeHeight(x, z) {
    return distToBridge(x, z) < 9 ? bridge.deckY : 0;
  }

  const clock = { t: 0 };
  function updateWorldVisuals(t, dt) {
    const time = typeof t === 'number' ? t : clock.t + 0.016;
    clock.t = time;
    waterUniforms.time.value = time;
    skyUniforms.time.value = time;
    beacon.rotation.y = time * 1.4;
    beaconMat.opacity = 0.65 + Math.sin(time * 4) * 0.25;
    for (let i = 0; i < palms.length; i++) {
      palms[i].rotation.z = Math.sin(time * 0.9 + i) * 0.02;
    }
  }

  return { colliders, setBeaconPosition, updateWorldVisuals, getBridgeHeight };
}
