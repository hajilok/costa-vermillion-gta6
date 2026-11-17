// Costa Vermillion: Sunset Syndicate — 3D vehicles + driving/boating physics.
// 100% original content. Imports only 'three' and './cityConfig.js'.
import * as THREE from 'three';
import { VEHICLE_SPECS, isWater } from './cityConfig.js';

function pickColor(spec, override) {
  if (override !== undefined) return override;
  return spec.colors[Math.floor(Math.random() * spec.colors.length)];
}

function makeWheel(radius, width, spin) {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, width, 14),
    new THREE.MeshLambertMaterial({ color: 0x14141c }),
  );
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  g.add(tire);
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.5, radius * 0.5, width + 0.04, 8),
    new THREE.MeshStandardMaterial({ color: 0xd8d8e2, metalness: 0.7, roughness: 0.3 }),
  );
  hub.rotation.z = Math.PI / 2;
  g.add(hub);
  if (spin) g.userData.spin = true;
  return g;
}

function box(w, h, d, color, opts = {}) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.45,
      metalness: opts.metalness ?? 0.25,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.emissiveIntensity ?? 0,
    }),
  );
  mesh.castShadow = true;
  return mesh;
}

function lampMesh(color, w = 0.5, h = 0.32) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(w, h, 0.12),
    new THREE.MeshBasicMaterial({ color }),
  );
}

// Detailed multi-part mesh for every vehicle in VEHICLE_SPECS.
export function createVehicleMesh(specId, colorOverride) {
  const spec = VEHICLE_SPECS[specId];
  if (!spec) throw new Error(`Unknown vehicle spec: ${specId}`);
  const color = pickColor(spec, colorOverride);
  const root = new THREE.Group();
  root.userData.specId = specId;
  const wheels = [];
  let brakeLights = [];
  let headlights = [];
  let lightbar = null;

  if (spec.kind === 'moto') {
    const frame = box(0.5, 0.5, 2.4, color);
    frame.position.y = 0.8;
    root.add(frame);
    const seat = box(0.45, 0.25, 1.0, 0x1a1a24);
    seat.position.set(0, 1.1, -0.4);
    root.add(seat);
    const shield = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.7),
      new THREE.MeshPhongMaterial({ color: 0x9be9ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    );
    shield.position.set(0, 1.5, 1.0);
    shield.rotation.x = -0.4;
    root.add(shield);
    const lamp = lampMesh(0xfff2b0, 0.3, 0.24);
    lamp.position.set(0, 1.0, 1.28);
    root.add(lamp);
    headlights = [lamp];
    const brake = lampMesh(0xff2222, 0.3, 0.24);
    brake.position.set(0, 1.0, -1.26);
    root.add(brake);
    brakeLights = [brake];
    for (const [x, z, r] of [[0, 1.15, 0.42], [0, -1.05, 0.42]]) {
      const wheel = makeWheel(r, 0.28, true);
      wheel.position.set(x, r, z);
      root.add(wheel);
      wheels.push(wheel);
    }
    root.userData.size = new THREE.Vector3(1.1, 1.8, 2.8);
  } else if (spec.kind === 'boat') {
    const hullMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.15 });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 6.4), hullMat);
    hull.position.y = 0.7;
    hull.castShadow = true;
    root.add(hull);
    const bow = new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.2, 4), hullMat);
    bow.rotation.x = Math.PI / 2;
    bow.rotation.y = Math.PI / 4;
    bow.position.set(0, 0.7, 4.2);
    root.add(bow);
    const deck = box(2.2, 0.25, 4.4, 0x273142);
    deck.position.set(0, 1.3, -0.4);
    root.add(deck);
    const wind = new THREE.Mesh(
      new THREE.PlaneGeometry(2.0, 1.0),
      new THREE.MeshPhongMaterial({ color: 0x9be9ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
    );
    wind.position.set(0, 2.0, 1.2);
    wind.rotation.x = -0.35;
    root.add(wind);
    const stripe = box(2.66, 0.3, 5.6, 0xff5a4e);
    stripe.position.y = 1.05;
    root.add(stripe);
    // Wake foam ribbon trailing behind the hull.
    const wake = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 7),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }),
    );
    wake.rotation.x = -Math.PI / 2;
    wake.position.set(0, 0.12, -6.2);
    root.add(wake);
    root.userData.wake = wake;
    root.userData.size = new THREE.Vector3(2.8, 1.8, 7.4);
  } else {
    const isTruck = spec.kind === 'truck';
    const isCruiser = !!spec.police;
    const bodyLen = isTruck ? 6.6 : spec.kind === 'suv' ? 5.2 : 4.6;
    const bodyH = isTruck ? 1.6 : spec.kind === 'suv' ? 1.15 : 0.85;
    const bodyW = isTruck ? 2.6 : 2.15;
    const body = box(bodyW, bodyH, bodyLen, isCruiser ? 0x10233a : color, { metalness: 0.35, roughness: 0.35 });
    body.position.y = isTruck ? 1.5 : 0.85;
    root.add(body);

    if (specId === 'boveda_armored') {
      // Riveted armored hull + bullbar + roof hatch.
      const hull = box(bodyW + 0.25, 0.9, bodyLen * 0.62, 0x3a3a46, { metalness: 0.6, roughness: 0.5 });
      hull.position.set(0, 1.35, -0.6);
      root.add(hull);
      const bar = box(bodyW * 0.8, 0.5, 0.3, 0x22222c, { metalness: 0.6 });
      bar.position.set(0, 1.0, bodyLen / 2 + 0.1);
      root.add(bar);
      const hatch = box(1.1, 0.25, 1.1, 0x2c2c38, { metalness: 0.6 });
      hatch.position.set(0, 2.5, -0.6);
      root.add(hatch);
    }

    if (specId === 'brisa_cabrio') {
      // Open interior: seats + windshield frame, no roof.
      for (const sx of [-0.5, 0.5]) {
        const seat = box(0.75, 0.7, 0.7, 0x7a2c3a);
        seat.position.set(sx, 1.15, -0.5);
        root.add(seat);
      }
      const dash = box(1.9, 0.4, 0.6, 0x1a1a24);
      dash.position.set(0, 1.25, 1.1);
      root.add(dash);
    } else if (!isTruck) {
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(bodyW * 0.82, 0.7, bodyLen * 0.45),
        new THREE.MeshPhongMaterial({ color: 0x0e1c30, shininess: 120, specular: 0xffc46a }),
      );
      cabin.position.set(0, body.position.y + bodyH / 2 + 0.3, -0.25);
      cabin.castShadow = true;
      root.add(cabin);
    } else {
      const cab = new THREE.Mesh(
        new THREE.BoxGeometry(bodyW * 0.95, 1.0, 1.6),
        new THREE.MeshPhongMaterial({ color: 0x0e1c30, shininess: 90 }),
      );
      cab.position.set(0, 2.0, bodyLen / 2 - 0.9);
      root.add(cab);
    }

    if (specId === 'veloce_gt') {
      const wing = box(2.0, 0.12, 0.55, 0x14141c, { metalness: 0.5 });
      wing.position.set(0, 1.75, -bodyLen / 2 + 0.2);
      root.add(wing);
      for (const sx of [-0.8, 0.8]) {
        const strut = box(0.12, 0.5, 0.12, 0x14141c);
        strut.position.set(sx, 1.45, -bodyLen / 2 + 0.2);
        root.add(strut);
      }
    }

    // Glowing headlights + brake lights.
    for (const sx of [-0.7, 0.7]) {
      const head = lampMesh(0xfff2b0);
      head.position.set(sx, body.position.y, bodyLen / 2 + 0.05);
      root.add(head);
      headlights.push(head);
      const brake = lampMesh(0xff2222);
      brake.position.set(sx, body.position.y, -bodyLen / 2 - 0.05);
      root.add(brake);
      brakeLights.push(brake);
    }

    if (isCruiser) {
      // Red/blue roof lightbar + door shield.
      lightbar = new THREE.Group();
      const barBase = box(1.6, 0.18, 0.5, 0x0a0a12);
      barBase.position.y = 0;
      lightbar.add(barBase);
      const red = lampMesh(0xff2222, 0.7, 0.34);
      red.position.set(-0.4, 0.2, 0);
      lightbar.add(red);
      const blue = lampMesh(0x2255ff, 0.7, 0.34);
      blue.position.set(0.4, 0.2, 0);
      lightbar.add(blue);
      lightbar.userData.red = red;
      lightbar.userData.blue = blue;
      lightbar.position.set(0, body.position.y + bodyH / 2 + (specId === 'brisa_cabrio' ? 0.4 : 0.95), -0.25);
      root.add(lightbar);
      const shield = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 1.0),
        new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
      );
      shield.position.set(0, body.position.y, 0.2);
      shield.rotation.y = Math.PI / 2;
      root.add(shield);
    }

    const wheelR = isTruck ? 0.62 : spec.kind === 'suv' ? 0.55 : 0.44;
    const wheelW = isTruck ? 0.5 : 0.38;
    const trackX = bodyW / 2;
    const axleZ = bodyLen / 2 - 0.95;
    const fl = makeWheel(wheelR, wheelW, true); fl.position.set(-trackX, wheelR, axleZ);
    const fr = makeWheel(wheelR, wheelW, true); fr.position.set(trackX, wheelR, axleZ);
    const rl = makeWheel(wheelR, wheelW, true); rl.position.set(-trackX, wheelR, -axleZ);
    const rr = makeWheel(wheelR, wheelW, true); rr.position.set(trackX, wheelR, -axleZ);
    root.add(fl, fr, rl, rr);
    wheels.push(fl, fr, rl, rr);
    root.userData.frontWheels = [fl, fr];
    root.userData.size = new THREE.Vector3(bodyW + 0.6, 2.4, bodyLen + 0.6);
  }

  root.userData.wheels = wheels;
  root.userData.brakeLights = brakeLights;
  root.userData.headlights = headlights;
  root.userData.lightbar = lightbar;
  root.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return root;
}

// Responsive arcade driving/boating physics with drift, nitro, collisions, damage smoke.
export class VehiclePhysicsController {
  constructor(mesh, specId, colliders = []) {
    this.mesh = mesh;
    this.spec = VEHICLE_SPECS[specId];
    if (!this.spec) throw new Error(`Unknown vehicle spec: ${specId}`);
    this.specId = specId;
    this.colliders = colliders;
    this.pos = mesh.position.clone();
    this.heading = 0;
    this.speed = 0; // m/s, signed
    this.steer = 0;
    this.gear = 1;
    this.nitro = 1; // 0..1 charge
    this.nitroActive = false;
    this.handbrake = false;
    this.damage = 0; // 0..1
    this.airborne = false;
    this.particles = [];
    this.smokeTimer = 0;
    this.sirenPhase = 0;
    const size = mesh.userData.size || new THREE.Vector3(2.4, 2, 5);
    this.halfExtents = new THREE.Vector3(size.x / 2, size.y / 2, size.z / 2);
  }

  get topSpeedMs() {
    return this.spec.topSpeed * 0.9;
  }

  get isBoat() {
    return !!this.spec.water && !this.spec.land;
  }

  reset(x, z, heading = 0) {
    this.pos.set(x, this.isBoat ? -0.6 : 0.35, z);
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.gear = 1;
    this.nitro = 1;
    this.damage = 0;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.set(0, heading, 0);
  }

  // input: { throttle: -1..1, steer: -1..1, handbrake: bool, nitro: bool }
  update(dt, input = {}) {
    const s = this.spec;
    const throttle = Math.max(-1, Math.min(1, input.throttle ?? 0));
    const steerIn = Math.max(-1, Math.min(1, input.steer ?? 0));
    this.handbrake = !!input.handbrake;
    this.nitroActive = !!input.nitro && this.nitro > 0.05 && throttle > 0;

    const top = this.topSpeedMs * (1 - this.damage * 0.4);
    const accel = s.acceleration * (this.nitroActive ? 1.9 : 1) * (1 - this.damage * 0.35);
    if (throttle > 0) this.speed += accel * throttle * dt;
    else if (throttle < 0) {
      this.speed += (this.speed > 1 ? s.acceleration * 2.2 : accel * 0.7) * throttle * dt;
    } else {
      const drag = this.isBoat ? 1.4 : this.handbrake ? 6.0 : 2.2;
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), drag * dt);
    }
    this.speed = Math.max(-top * 0.35, Math.min(top, this.speed));

    // Gears 1..5 from speed fraction.
    const frac = Math.min(1, Math.abs(this.speed) / Math.max(1, top));
    this.gear = this.speed < -0.5 ? 'R' : 1 + Math.min(4, Math.floor(frac * 5));

    // Steering (boats slide wider, handbrake kicks the tail out).
    const grip = this.handbrake ? 0.35 : 1;
    const steerTarget = steerIn * (0.55 + s.handling * 0.75) * grip;
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * (this.handbrake ? 5 : 9));
    const dirSign = this.speed >= 0 ? 1 : -1;
    this.heading -= this.steer * dirSign * Math.min(1, Math.abs(this.speed) / 8) * dt * (this.isBoat ? 1.1 : 1.6);

    const forward = new THREE.Vector3(-Math.sin(this.heading), 0, -Math.cos(this.heading));
    if (this.handbrake && Math.abs(this.speed) > 8) {
      // Drift: keep momentum while heading rotates, bleed speed, puff tire smoke.
      this.pos.addScaledVector(forward, this.speed * dt * 0.92);
      const side = new THREE.Vector3(-forward.z, 0, forward.x);
      this.pos.addScaledVector(side, this.steer * this.speed * dt * 0.28);
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 9 * dt);
      this.spawnDriftSmoke(dt, true);
    } else {
      this.pos.addScaledVector(forward, this.speed * dt);
      if (Math.abs(this.speed) > top * 0.85) this.spawnDriftSmoke(dt, false);
    }

    if (this.nitroActive) {
      this.nitro = Math.max(0, this.nitro - dt * 0.35);
      this.spawnDriftSmoke(dt, false, 0x38e8ff);
    } else {
      this.nitro = Math.min(1, this.nitro + dt * 0.06);
    }

    if (this.isBoat) {
      this.pos.y = -0.6 + Math.sin(performance.now() * 0.002) * 0.15;
      if (!isWater(this.pos.x, this.pos.z)) {
        // Beached: hard slowdown + scrape damage.
        this.speed *= 1 - Math.min(1, dt * 4);
        this.damage = Math.min(1, this.damage + dt * 0.05);
      }
    } else {
      this.pos.y = 0.35;
      this.resolveBuildingCollisions(forward);
    }

    this.mesh.position.copy(this.pos);
    this.mesh.rotation.set(0, this.heading, this.handbrake && Math.abs(this.speed) > 8 ? -this.steer * 0.18 : -this.steer * 0.05);

    // Rolling wheels + steering pose.
    const spin = (this.speed / 0.44) * dt;
    for (const w of this.mesh.userData.wheels || []) w.rotation.x += spin;
    for (const w of this.mesh.userData.frontWheels || []) w.rotation.y = this.steer * 0.5;

    // Brake-light glow + PVPD lightbar strobe.
    const braking = throttle < 0 || this.handbrake;
    for (const b of this.mesh.userData.brakeLights || []) {
      b.material.color.setHex(braking ? 0xff4444 : 0x881111);
    }
    if (this.mesh.userData.lightbar) {
      this.sirenPhase += dt * 10;
      const on = Math.sin(this.sirenPhase) > 0;
      this.mesh.userData.lightbar.userData.red.material.color.setHex(on ? 0xff2222 : 0x550000);
      this.mesh.userData.lightbar.userData.blue.material.color.setHex(on ? 0x001155 : 0x3355ff);
    }
    if (this.mesh.userData.wake) {
      this.mesh.userData.wake.material.opacity = Math.min(0.75, 0.2 + Math.abs(this.speed) / 40);
      this.mesh.userData.wake.scale.y = 1 + Math.abs(this.speed) / 60;
    }

    // Damage smoke once beaten up.
    if (this.damage > 0.35) {
      this.smokeTimer -= dt;
      if (this.smokeTimer <= 0) {
        this.smokeTimer = 0.08;
        this.spawnDamageSmoke();
      }
    }
    this.updateParticles(dt);
    return { speed: this.speed, gear: this.gear, nitro: this.nitro, damage: this.damage };
  }

  resolveBuildingCollisions(forward) {
    if (!this.colliders.length) return;
    const min = new THREE.Vector3(
      this.pos.x - this.halfExtents.x,
      0,
      this.pos.z - this.halfExtents.z,
    );
    const max = new THREE.Vector3(
      this.pos.x + this.halfExtents.x,
      4,
      this.pos.z + this.halfExtents.z,
    );
    const me = new THREE.Box3(min, max);
    for (const box of this.colliders) {
      if (!me.intersectsBox(box)) continue;
      // Push out along the smallest horizontal penetration axis.
      const overlapX = Math.min(me.max.x, box.max.x) - Math.max(me.min.x, box.min.x);
      const overlapZ = Math.min(me.max.z, box.max.z) - Math.max(me.min.z, box.min.z);
      const impact = Math.abs(this.speed);
      if (overlapX < overlapZ) {
        const side = this.pos.x < (box.min.x + box.max.x) / 2 ? -1 : 1;
        this.pos.x += side * (overlapX + 0.05);
      } else {
        const side = this.pos.z < (box.min.z + box.max.z) / 2 ? -1 : 1;
        this.pos.z += side * (overlapZ + 0.05);
      }
      if (impact > 10) this.damage = Math.min(1, this.damage + impact * 0.008);
      this.speed *= impact > 18 ? -0.25 : 0.3;
      me.setFromCenterAndSize(
        new THREE.Vector3(this.pos.x, 2, this.pos.z),
        new THREE.Vector3(this.halfExtents.x * 2, 4, this.halfExtents.z * 2),
      );
    }
  }

  ensureParticlePool(scene) {
    if (this.particleParent) return;
    const geo = new THREE.PlaneGeometry(0.9, 0.9);
    const mat = new THREE.MeshBasicMaterial({ color: 0xcfc8bd, transparent: true, opacity: 0.5, depthWrite: false });
    this.particleParent = new THREE.Group();
    this.particlePool = [];
    for (let i = 0; i < 60; i += 1) {
      const m = new THREE.Mesh(geo, mat.clone());
      m.visible = false;
      this.particleParent.add(m);
      this.particlePool.push(m);
    }
    scene.add(this.particleParent);
  }

  puff(worldPos, color = 0xcfc8bd, big = false) {
    const m = this.particlePool?.find((p) => !p.visible);
    if (!m) return;
    m.visible = true;
    m.material.color.setHex(color);
    m.material.opacity = 0.55;
    m.position.copy(worldPos);
    m.scale.setScalar(big ? 1.6 : 0.9);
    m.userData.life = 0.7;
    this.particles.push(m);
  }

  spawnDriftSmoke(dt, handbrake, color = 0xcfc8bd) {
    if (!this.particleParent) return;
    const back = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    for (let i = 0; i < (handbrake ? 3 : 1); i += 1) {
      const p = this.pos.clone().addScaledVector(back, 2.2);
      p.y = 0.4;
      p.x += (Math.random() - 0.5) * 1.6;
      this.puff(p, color, handbrake);
    }
  }

  spawnDamageSmoke() {
    if (!this.particleParent) return;
    const p = this.pos.clone();
    p.y = 1.6;
    p.x += Math.sin(this.heading) * -1.5;
    p.z += Math.cos(this.heading) * -1.5;
    this.puff(p, this.damage > 0.7 ? 0x2a2a2a : 0x8a8a8a, true);
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const m = this.particles[i];
      m.userData.life -= dt;
      m.position.y += dt * 1.6;
      m.scale.multiplyScalar(1 + dt * 1.8);
      m.material.opacity = Math.max(0, m.userData.life * 0.8);
      if (m.userData.life <= 0) {
        m.visible = false;
        this.particles.splice(i, 1);
      }
    }
  }
}
