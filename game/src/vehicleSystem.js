// Sunset Syndicate vehicles: arcade physics plus sculpted showroom meshes.
// Forward for heading=0 is -Z: headlights and flares sit on the -Z nose,
// taillight bars, exhausts and the GT wing sit on the +Z tail.

import * as THREE from '../vendor/three.module.min.js';
import { VEHICLE_SPECS } from './cityConfig.js';

export class VehiclePhysicsController {
  constructor(spec) {
    this.spec = spec;
    this.speed = 0;
    this.heading = 0;
    this.x = 0;
    this.z = 0;
    this.nitro = 1;
    this.drifting = false;
  }

  static specById(id) {
    return VEHICLE_SPECS.find((v) => v.id === id) || VEHICLE_SPECS[0];
  }

  update(input, dt) {
    const top = this.spec.topSpeed * (input.nitro && this.nitro > 0 ? 1.35 : 0.62);
    const target = input.throttle * top;
    const rate = this.spec.accel * dt * (input.nitro && this.nitro > 0 ? 1.5 : 1);
    if (this.speed < target) this.speed = Math.min(target, this.speed + rate);
    else this.speed = Math.max(target, this.speed - this.spec.accel * 1.4 * dt);
    if (input.nitro && input.throttle > 0 && this.nitro > 0) {
      this.nitro = Math.max(0, this.nitro - dt * 0.35);
    } else {
      this.nitro = Math.min(1, this.nitro + dt * 0.08);
    }
    const steer = input.steer * this.spec.handling * (this.speed >= 0 ? 1 : -1);
    const grip = input.handbrake ? 2.6 : 1.4;
    this.heading += steer * grip * dt * Math.min(1, Math.abs(this.speed) / 12);
    this.drifting = input.handbrake && Math.abs(this.speed) > 10;
    // Heading 0 faces -Z.
    this.x += -Math.sin(this.heading) * this.speed * dt;
    this.z += -Math.cos(this.heading) * this.speed * dt;
    return this;
  }
}

function makeRadialSmokeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(128, 128);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const dx = (x - 64) / 64;
      const dy = (y - 64) / 64;
      const d2 = dx * dx + dy * dy;
      const alpha = Math.exp(-d2 * 4.5) * 255;
      const i = (y * 128 + x) * 4;
      img.data[i] = 235;
      img.data[i + 1] = 228;
      img.data[i + 2] = 220;
      img.data[i + 3] = alpha;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

let smokeTexture = null;
function sharedSmokeTexture() {
  if (!smokeTexture) smokeTexture = makeRadialSmokeTexture();
  return smokeTexture;
}

function makeFlareSprite(color, scale) {
  const mat = new THREE.SpriteMaterial({
    map: sharedSmokeTexture(),
    color,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.85,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scale, scale, 1);
  return sprite;
}

function makeHeadlightPair(width) {
  const group = new THREE.Group();
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0xfff6d8,
    emissive: 0xffedb8,
    emissiveIntensity: 2.2,
  });
  for (const side of [-1, 1]) {
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), lensMat);
    lens.position.set(side * width, 0.72, -2.02);
    lens.scale.z = 0.5;
    group.add(lens);
    const flare = makeFlareSprite(0xffe9b0, 1.6);
    flare.position.set(side * width, 0.72, -2.35);
    group.add(flare);
  }
  return group;
}

function makeTaillightBar(width) {
  const group = new THREE.Group();
  const barMat = new THREE.MeshStandardMaterial({
    color: 0x550000,
    emissive: 0xff1a1a,
    emissiveIntensity: 1.8,
  });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(width, 0.22, 0.12), barMat);
  bar.position.set(0, 0.82, 2.02);
  group.add(bar);
  for (const side of [-1, 1]) {
    const glow = makeFlareSprite(0xff2a2a, 0.9);
    glow.material.opacity = 0.5;
    glow.position.set(side * width * 0.4, 0.82, 2.2);
    group.add(glow);
  }
  return group;
}

function makeExhausts() {
  const group = new THREE.Group();
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x30323a, metalness: 0.9, roughness: 0.3 });
  for (const side of [-1, 1]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.7, 10), pipeMat);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(side * 0.55, 0.35, 2.1);
    group.add(pipe);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 1.4, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x66e0ff,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    cone.rotation.x = -Math.PI / 2;
    cone.position.set(side * 0.55, 0.35, 2.9);
    cone.userData.isNitroCone = true;
    group.add(cone);
    const gold = new THREE.Mesh(
      new THREE.ConeGeometry(0.13, 0.9, 8, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffd94d,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    gold.rotation.x = -Math.PI / 2;
    gold.position.set(side * 0.55, 0.35, 2.75);
    gold.userData.isNitroCone = true;
    group.add(gold);
  }
  return group;
}

function makeWheel(radius, width) {
  const group = new THREE.Group();
  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, width, 18),
    new THREE.MeshStandardMaterial({ color: 0x14151a, roughness: 0.95 })
  );
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  group.add(tire);
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xd8dee8, metalness: 0.95, roughness: 0.2 });
  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(width + 0.06, 0.14, radius * 1.7), rimMat);
    spoke.rotation.x = (i / 5) * Math.PI;
    group.add(spoke);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, width + 0.1, 10), rimMat);
  hub.rotation.z = Math.PI / 2;
  group.add(hub);
  const well = new THREE.Mesh(
    new THREE.TorusGeometry(radius + 0.12, 0.18, 8, 18, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x0c0d12, roughness: 1 })
  );
  well.rotation.y = Math.PI / 2;
  well.position.y = 0.1;
  group.add(well);
  group.userData.tire = tire;
  return group;
}

function paintBody(color, metalness, roughness) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}

export function createVehicleMesh(specId) {
  const spec = VehiclePhysicsController.specById(specId);
  const root = new THREE.Group();
  root.userData.specId = spec.id;
  const wheels = [];
  const smokePuffs = [];

  function addWheel(x, y, z, r, w) {
    const wheel = makeWheel(r, w);
    wheel.position.set(x, y, z);
    root.add(wheel);
    wheels.push(wheel);
    return wheel;
  }

  function addSmokeEmitters() {
    for (const w of wheels) {
      const mat = new THREE.SpriteMaterial({
        map: sharedSmokeTexture(),
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const puff = new THREE.Sprite(mat);
      puff.scale.set(2.2, 2.2, 1);
      puff.position.copy(w.position).add(new THREE.Vector3(0, 0.2, 0.6));
      root.add(puff);
      smokePuffs.push(puff);
    }
  }

  if (spec.id === 'veloce_gt') {
    const bodyMat = paintBody(0xff5f3d, 0.88, 0.12);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 4.4), bodyMat);
    nose.position.y = 0.62;
    nose.castShadow = true;
    root.add(nose);
    const wedge = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.4, 1.6), bodyMat);
    wedge.position.set(0, 0.5, -2.2);
    wedge.rotation.x = 0.18;
    root.add(wedge);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.25, 0.5, 1.9),
      new THREE.MeshStandardMaterial({ color: 0x18242f, metalness: 0.88, roughness: 0.12 })
    );
    cabin.position.set(0, 1.1, 0.25);
    cabin.castShadow = true;
    root.add(cabin);
    for (const side of [-1, 1]) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 1.3), paintBody(0x1a1c22, 0.6, 0.5));
      vent.position.set(side * 0.98, 0.66, 0.5);
      root.add(vent);
    }
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 0.5), paintBody(0x23262e, 0.7, 0.35));
    wing.position.set(0, 1.25, 2.15);
    wing.castShadow = true;
    root.add(wing);
    for (const side of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.3), paintBody(0x23262e, 0.7, 0.35));
      strut.position.set(side * 0.7, 1.0, 2.15);
      root.add(strut);
    }
    addWheel(-0.95, 0.42, -1.35, 0.42, 0.34);
    addWheel(0.95, 0.42, -1.35, 0.42, 0.34);
    addWheel(-0.95, 0.42, 1.35, 0.42, 0.38);
    addWheel(0.95, 0.42, 1.35, 0.42, 0.38);
  } else if (spec.id === 'pvpd_interceptor') {
    const black = paintBody(0x14161c, 0.6, 0.35);
    const white = paintBody(0xf2f4f6, 0.5, 0.4);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.7, 4.3), black);
    body.position.y = 0.72;
    body.castShadow = true;
    root.add(body);
    const doors = new THREE.Mesh(new THREE.BoxGeometry(1.97, 0.34, 1.8), white);
    doors.position.set(0, 0.72, 0.2);
    root.add(doors);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.55, 2.0),
      new THREE.MeshStandardMaterial({ color: 0x1b2a3a, metalness: 0.7, roughness: 0.2 })
    );
    cabin.position.set(0, 1.3, 0.1);
    root.add(cabin);
    const pushbarMat = paintBody(0x2a2e36, 0.8, 0.4);
    for (const side of [-0.5, 0, 0.5]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.12), pushbarMat);
      bar.position.set(side, 0.65, -2.35);
      root.add(bar);
    }
    const cross = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 0.12), pushbarMat);
    cross.position.set(0, 0.85, -2.35);
    root.add(cross);
    const lightbar = new THREE.Group();
    const housing = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.18, 0.4), black);
    lightbar.add(housing);
    // Twin offset beacons: LEFT red dome, RIGHT blue dome — never centered.
    const redLens = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff2222, emissiveIntensity: 3.0 })
    );
    redLens.scale.y = 0.7;
    redLens.position.x = -0.35;
    lightbar.add(redLens);
    const blueLens = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x000055, emissive: 0x2266ff, emissiveIntensity: 3.0 })
    );
    blueLens.scale.y = 0.7;
    blueLens.position.x = 0.35;
    lightbar.add(blueLens);
    const redCorona = makeFlareSprite(0xff3333, 2.6);
    redCorona.position.x = -0.35;
    lightbar.add(redCorona);
    const blueCorona = makeFlareSprite(0x3388ff, 2.6);
    blueCorona.position.x = 0.35;
    lightbar.add(blueCorona);
    lightbar.position.set(0, 1.68, 0.1);
    lightbar.userData.redCorona = redCorona;
    lightbar.userData.blueCorona = blueCorona;
    root.add(lightbar);
    root.userData.lightbar = lightbar;
    addWheel(-0.95, 0.42, -1.35, 0.42, 0.34);
    addWheel(0.95, 0.42, -1.35, 0.42, 0.34);
    addWheel(-0.95, 0.42, 1.35, 0.42, 0.34);
    addWheel(0.95, 0.42, 1.35, 0.42, 0.34);
  } else if (spec.id === 'brisa_cabrio') {
    const bodyMat = paintBody(0x4dd6c6, 0.55, 0.3);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.6, 4.2), bodyMat);
    body.position.y = 0.66;
    body.castShadow = true;
    root.add(body);
    const tub = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 2.0), paintBody(0x3a2c22, 0.2, 0.8));
    tub.position.set(0, 0.85, 0.1);
    root.add(tub);
    for (const side of [-1, 1]) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.6), paintBody(0xfff2d9, 0.1, 0.7));
      seat.position.set(side * 0.38, 1.0, 0.45);
      root.add(seat);
    }
    const shield = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.5, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xbfe8f0, transparent: true, opacity: 0.45, roughness: 0.1 })
    );
    shield.position.set(0, 1.15, -0.95);
    shield.rotation.x = -0.25;
    root.add(shield);
    addWheel(-0.95, 0.4, -1.3, 0.4, 0.32);
    addWheel(0.95, 0.4, -1.3, 0.4, 0.32);
    addWheel(-0.95, 0.4, 1.3, 0.4, 0.32);
    addWheel(0.95, 0.4, 1.3, 0.4, 0.32);
  } else if (spec.id === 'boveda_armored') {
    const armor = paintBody(0x5a6470, 0.75, 0.45);
    const vault = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.9, 4.6), armor);
    vault.position.y = 1.35;
    vault.castShadow = true;
    root.add(vault);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.9, 1.4), paintBody(0x3c434e, 0.7, 0.4));
    cab.position.set(0, 0.85, -2.6);
    root.add(cab);
    const slit = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.25, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x10151c, metalness: 0.6, roughness: 0.3 })
    );
    slit.position.set(0, 1.05, -3.32);
    root.add(slit);
    for (const side of [-1, 1]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 4.6), paintBody(0xffd94d, 0.4, 0.5));
      stripe.position.set(side * 1.12, 1.3, 0);
      root.add(stripe);
    }
    addWheel(-1.0, 0.5, -1.6, 0.5, 0.4);
    addWheel(1.0, 0.5, -1.6, 0.5, 0.4);
    addWheel(-1.0, 0.5, 1.5, 0.5, 0.4);
    addWheel(1.0, 0.5, 1.5, 0.5, 0.4);
  } else if (spec.id === 'dune_titan') {
    const bodyMat = paintBody(0xc96b2c, 0.4, 0.55);
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.8, 4.2), bodyMat);
    body.position.y = 1.05;
    body.castShadow = true;
    root.add(body);
    const glasshouse = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.65, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x20303c, metalness: 0.7, roughness: 0.25 })
    );
    glasshouse.position.set(0, 1.75, 0.2);
    root.add(glasshouse);
    const rack = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 2.0), paintBody(0x2a2e36, 0.7, 0.5));
    rack.position.set(0, 2.15, 0.2);
    root.add(rack);
    const bull = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.35, 0.25), paintBody(0x2a2e36, 0.7, 0.5));
    bull.position.set(0, 0.9, -2.25);
    root.add(bull);
    addWheel(-1.0, 0.55, -1.4, 0.55, 0.42);
    addWheel(1.0, 0.55, -1.4, 0.55, 0.42);
    addWheel(-1.0, 0.55, 1.4, 0.55, 0.42);
    addWheel(1.0, 0.55, 1.4, 0.55, 0.42);
  } else if (spec.id === 'sol_moto') {
    const frameMat = paintBody(0xffb300, 0.7, 0.3);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 2.1), frameMat);
    frame.position.y = 0.75;
    frame.castShadow = true;
    root.add(frame);
    const tank = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), frameMat);
    tank.scale.set(1, 0.8, 1.6);
    tank.position.set(0, 0.95, -0.2);
    root.add(tank);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.9), paintBody(0x1a1c22, 0.2, 0.8));
    seat.position.set(0, 0.95, 0.65);
    root.add(seat);
    const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 8), paintBody(0xc8ccd4, 0.9, 0.25));
    fork.position.set(0, 0.7, -1.05);
    fork.rotation.x = 0.4;
    root.add(fork);
    const rider = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.6, 0.5), paintBody(0x27324a, 0.3, 0.7));
    rider.position.set(0, 1.25, 0.45);
    root.add(rider);
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xff5f3d, metalness: 0.6, roughness: 0.25 })
    );
    helmet.position.set(0, 1.7, 0.35);
    root.add(helmet);
    addWheel(0, 0.35, -1.05, 0.35, 0.22);
    addWheel(0, 0.35, 1.0, 0.35, 0.28);
  } else {
    const hullMat = paintBody(0xfff2e6, 0.45, 0.35);
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 5.4), hullMat);
    hull.position.y = 0.45;
    hull.scale.x = 1;
    hull.castShadow = true;
    root.add(hull);
    const stripeMat = paintBody(0xff6f61, 0.5, 0.35);
    for (const side of [-1, 1]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 5.0), stripeMat);
      stripe.position.set(side * 1.12, 0.55, 0);
      root.add(stripe);
    }
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.25, 4.2), paintBody(0x8a5a3b, 0.2, 0.8));
    deck.position.y = 0.95;
    root.add(deck);
    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.7, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x16303c, metalness: 0.8, roughness: 0.15, transparent: true, opacity: 0.85 })
    );
    windshield.position.set(0, 1.4, -0.9);
    windshield.rotation.x = -0.35;
    root.add(windshield);
    const helm = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.35), paintBody(0x2b6f6a, 0.3, 0.7));
    torso.position.y = 0.3;
    helm.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), paintBody(0xd9a077, 0.1, 0.7));
    head.position.y = 0.75;
    helm.add(head);
    helm.position.set(0, 1.05, 0.1);
    root.add(helm);
    for (const side of [-1, 1]) {
      const motor = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.7, 0.4), paintBody(0x23262e, 0.7, 0.4));
      motor.position.set(side * 0.55, 0.35, 2.85);
      root.add(motor);
    }
    const wakeCanvas = document.createElement('canvas');
    wakeCanvas.width = 128;
    wakeCanvas.height = 128;
    const wctx = wakeCanvas.getContext('2d');
    const grad = wctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, 'rgba(255,255,255,0.85)');
    grad.addColorStop(0.55, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    wctx.fillStyle = grad;
    for (let i = 0; i < 260; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 8 + Math.random() * 50;
      wctx.beginPath();
      wctx.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r * 1.8, 2 + Math.random() * 4, 0, Math.PI * 2);
      wctx.fill();
    }
    const wakeTex = new THREE.CanvasTexture(wakeCanvas);
    const wake = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 14),
      new THREE.MeshBasicMaterial({ map: wakeTex, transparent: true, opacity: 0.7, depthWrite: false })
    );
    wake.rotation.x = -Math.PI / 2;
    wake.position.set(0, -0.05, 4.5);
    root.add(wake);
    root.userData.wake = wake;
    root.position.y = 0.24;
  }

  if (spec.kind !== 'boat') {
    root.add(makeHeadlightPair(0.62));
    root.add(makeTaillightBar(1.5));
    root.add(makeExhausts());
    addSmokeEmitters();
  } else {
    const stern = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.18, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1a1a, emissiveIntensity: 1.5 })
    );
    stern.position.set(0, 0.7, 2.72);
    root.add(stern);
  }

  root.userData.wheels = wheels;
  root.userData.smokePuffs = smokePuffs;
  root.userData.setNitro = (on) => {
    root.traverse((o) => {
      if (o.userData && o.userData.isNitroCone) o.material.opacity = on ? 0.75 : 0;
    });
  };
  root.userData.setSmoke = (amount) => {
    for (const puff of smokePuffs) {
      puff.material.opacity = Math.min(0.22, Math.max(0, amount));
      const s = 2.2 + amount * 4;
      puff.scale.set(s, s, 1);
    }
  };

  return root;
}
