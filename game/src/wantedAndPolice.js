// Costa Vermillion: Sunset Syndicate — PVPD wanted heat, pursuit units, Hawk helicopter.
// 100% original content. Imports only 'three', './cityConfig.js',
// './vehicleSystem.js', './playerAndPeds.js'.
import * as THREE from 'three';
import { ROAD_NETWORK } from './cityConfig.js';
import { VehiclePhysicsController, createVehicleMesh } from './vehicleSystem.js';
import { createCharacterRig } from './playerAndPeds.js';

function buildOfficerRig() {
  const rig = createCharacterRig({
    skin: 0xc98a5e,
    top: 0x10233a,
    bottom: 0x10233a,
    hair: 0x111111,
    hat: true,
  });
  const badge = new THREE.Mesh(
    new THREE.CircleGeometry(0.06, 10),
    new THREE.MeshBasicMaterial({ color: 0xffd97a }),
  );
  badge.position.set(0.14, 0.45, -0.17);
  badge.rotation.y = Math.PI;
  rig.userData.joints.torso.add(badge);
  return rig;
}

function buildRoadblock() {
  const g = new THREE.Group();
  for (const sx of [-3.4, 0, 3.4]) {
    const car = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.4, 4.6),
      new THREE.MeshStandardMaterial({ color: 0x10233a, roughness: 0.4, metalness: 0.3 }),
    );
    car.position.set(sx, 1.0, 0);
    car.castShadow = true;
    g.add(car);
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.25, 0.25),
      new THREE.MeshBasicMaterial({ color: sx === 0 ? 0xff2222 : 0x2255ff }),
    );
    bar.position.set(sx, 1.9, 0);
    g.add(bar);
  }
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(10, 0.12, 1.2),
    new THREE.MeshLambertMaterial({ color: 0xd8d8e2 }),
  );
  strip.position.set(0, 0.1, 3.5);
  g.add(strip);
  const flash = new THREE.PointLight(0xff3333, 30, 40, 1.8);
  flash.position.set(0, 4, 0);
  g.add(flash);
  g.userData.flash = flash;
  return g;
}

// PVPD Hawk helicopter: fuselage, spinning main/tail rotors, volumetric searchlight cone.
export function createHawkHelicopter() {
  const root = new THREE.Group();
  const navy = new THREE.MeshStandardMaterial({ color: 0x10233a, roughness: 0.4, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.6, 14, 10), navy);
  body.scale.set(1, 0.85, 1.9);
  body.castShadow = true;
  root.add(body);
  const glass = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 12, 8),
    new THREE.MeshPhongMaterial({ color: 0x9be9ff, shininess: 140, transparent: true, opacity: 0.8 }),
  );
  glass.position.set(0, 0.3, -1.4);
  glass.scale.set(0.8, 0.7, 0.8);
  root.add(glass);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 6, 8), navy);
  tail.rotation.x = Math.PI / 2;
  tail.position.set(0, 0.5, 4.6);
  root.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.6, 1.0), navy);
  fin.position.set(0, 1.3, 7.2);
  root.add(fin);
  const mainRotor = new THREE.Group();
  for (let i = 0; i < 2; i += 1) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.5), new THREE.MeshLambertMaterial({ color: 0x1a1a24 }));
    blade.rotation.y = (i * Math.PI) / 2;
    mainRotor.add(blade);
  }
  mainRotor.position.y = 1.7;
  root.add(mainRotor);
  const tailRotor = new THREE.Group();
  for (let i = 0; i < 2; i += 1) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.18), new THREE.MeshLambertMaterial({ color: 0x1a1a24 }));
    blade.rotation.z = (i * Math.PI) / 2;
    tailRotor.add(blade);
  }
  tailRotor.position.set(0.4, 1.3, 7.2);
  root.add(tailRotor);
  for (const sx of [-1.2, 1.2]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 3.4), new THREE.MeshLambertMaterial({ color: 0x33333f }));
    skid.position.set(sx, -1.5, 0);
    root.add(skid);
  }
  // Dramatic semi-transparent volumetric searchlight cone tracking the player.
  const coneGeo = new THREE.ConeGeometry(7, 42, 20, 1, true);
  const cone = new THREE.Mesh(
    coneGeo,
    new THREE.MeshBasicMaterial({
      color: 0xfff6c8,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  cone.position.y = -22;
  root.add(cone);
  const spot = new THREE.SpotLight(0xfff2b0, 900, 120, 0.22, 0.4, 1.2);
  spot.position.set(0, -1, 0);
  root.add(spot);
  root.add(spot.target);
  spot.target.position.set(0, -44, 0);
  const strobe = new THREE.PointLight(0xff2222, 20, 30, 1.8);
  strobe.position.set(0, 2.2, 0);
  root.add(strobe);
  root.userData.mainRotor = mainRotor;
  root.userData.tailRotor = tailRotor;
  root.userData.cone = cone;
  root.userData.strobe = strobe;
  return root;
}

// 0-5 star wanted heat with escalation/cooldown, pursuit cruisers, roadblocks,
// dismounted officers and the 3-5 star PVPD Hawk helicopter.
export class WantedAndPoliceDirector {
  constructor(scene, rng, colliders = []) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = colliders;
    this.heat = 0; // 0..5 stars
    this.heatValue = 0; // continuous 0..5
    this.cooldownTimer = 0;
    this.escalationTimer = 0;
    this.pursuers = []; // { mesh, controller, siren }
    this.officers = []; // { rig, pos, heading, fireTimer }
    this.roadblocks = [];
    this.heli = null;
    this.heliPos = new THREE.Vector3();
    this.busted = false;
    this.sirenPhase = 0;
  }

  get stars() {
    return Math.round(this.heatValue);
  }

  addHeat(amount) {
    if (this.busted) return;
    this.heatValue = Math.min(5, this.heatValue + amount);
    this.heat = this.stars;
    this.cooldownTimer = 12 + this.heatValue * 6;
    this.escalationTimer = 0;
  }

  clearHeat() {
    this.heatValue = 0;
    this.heat = 0;
    this.cooldownTimer = 0;
    this.syncForces();
  }

  wantedLabel() {
    return this.heat <= 0 ? 'PVPD: CLEAR' : `PVPD: ${'★'.repeat(this.heat)}${'☆'.repeat(5 - this.heat)}`;
  }

  spawnPursuer(nearPos) {
    const mesh = createVehicleMesh('pvpd_interceptor', 0x10233a);
    const controller = new VehiclePhysicsController(mesh, 'pvpd_interceptor', this.colliders);
    controller.ensureParticlePool(this.scene);
    const a = this.rng() * Math.PI * 2;
    controller.reset(nearPos.x + Math.cos(a) * 60, nearPos.z + Math.sin(a) * 60, a);
    this.scene.add(mesh);
    const siren = new THREE.PointLight(0xff3333, 26, 34, 1.8);
    mesh.add(siren);
    siren.position.set(0, 2.6, 0);
    this.pursuers.push({ mesh, controller, siren });
  }

  spawnOfficer(x, z) {
    const rig = buildOfficerRig();
    rig.position.set(x, 0, z);
    this.scene.add(rig);
    this.officers.push({ rig, pos: rig.position, heading: 0, fireTimer: 1 + this.rng() * 2, phase: this.rng() * 10 });
  }

  spawnRoadblock(at) {
    const g = buildRoadblock();
    // Place across the nearest boulevard ahead of the player.
    let blvd = ROAD_NETWORK.boulevards[0];
    let best = Infinity;
    for (const b of ROAD_NETWORK.boulevards) {
      const d = Math.abs(b.z - at.z);
      if (d < best) {
        best = d;
        blvd = b;
      }
    }
    g.position.set(at.x, 0, blvd.z + 40);
    this.scene.add(g);
    this.roadblocks.push(g);
    for (const sx of [-4, 4]) this.spawnOfficer(g.position.x + sx, g.position.z + 5);
  }

  syncForces() {
    const wantCars = this.heat <= 0 ? 0 : this.heat <= 1 ? 1 : this.heat <= 2 ? 2 : this.heat <= 3 ? 3 : 4;
    while (this.pursuers.length < wantCars && this.lastPlayer) this.spawnPursuer(this.lastPlayer);
    while (this.officers.length > wantCars * 2) {
      const o = this.officers.pop();
      this.scene.remove(o.rig);
    }
    if (this.heat >= 3 && !this.heli) {
      this.heli = createHawkHelicopter();
      this.scene.add(this.heli);
      this.heliPos.set(this.lastPlayer.x + 40, 55, this.lastPlayer.z - 40);
      this.heli.position.copy(this.heliPos);
    }
    if (this.heat < 3 && this.heli) {
      this.scene.remove(this.heli);
      this.heli = null;
    }
    const wantBlocks = this.heat >= 3 ? Math.min(3, this.heat - 2) : 0;
    while (this.roadblocks.length < wantBlocks && this.lastPlayer) this.spawnRoadblock(this.lastPlayer);
    while (this.roadblocks.length > wantBlocks) {
      const rb = this.roadblocks.pop();
      this.scene.remove(rb);
    }
  }

  update(dt, playerPos, playerController, elapsed = 0) {
    this.lastPlayer = playerPos.clone();
    this.sirenPhase += dt * 9;

    // Escalation under pressure, cooldown when hidden.
    if (this.heatValue > 0 && !this.busted) {
      this.escalationTimer += dt;
      this.cooldownTimer -= dt * (playerController?.inVehicle && Math.abs(playerController.inVehicle.speed) > 30 ? -0.5 : 1);
      if (this.escalationTimer > 25 && this.heatValue < 5) {
        this.heatValue = Math.min(5, this.heatValue + 1);
        this.escalationTimer = 0;
        this.cooldownTimer = 14 + this.heatValue * 6;
      }
      if (this.cooldownTimer <= 0) {
        this.heatValue = Math.max(0, this.heatValue - 1);
        this.cooldownTimer = this.heatValue > 0 ? 12 : 0;
      }
      this.heat = this.stars;
      this.syncForces();
    } else if (this.heatValue === 0 && (this.pursuers.length || this.heli || this.roadblocks.length)) {
      this.syncForces();
    }

    // Pursuit units: chase, ram, strobe red/blue.
    const sirenOn = Math.sin(this.sirenPhase) > 0;
    for (const p of this.pursuers) {
      const c = p.controller;
      const to = new THREE.Vector3().subVectors(playerPos, c.pos);
      to.y = 0;
      const dist = to.length();
      const wantHeading = Math.atan2(-to.x, -to.z);
      let dh = wantHeading - c.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const throttle = dist > 7 ? 1 : 0.25;
      c.update(dt, {
        throttle,
        steer: Math.max(-1, Math.min(1, dh * 2)),
        handbrake: Math.abs(dh) > 1.1,
        nitro: dist > 60,
      });
      // Light nudge damage when a cruiser connects.
      if (dist < 4.5 && playerController && !playerController.dead) {
        playerController.damage(dt * 6);
      }
      p.siren.color.setHex(sirenOn ? 0xff2222 : 0x2255ff);
    }

    // Dismounted officers: hold near cars/roadblocks, fire slow inaccurate shots.
    for (const o of this.officers) {
      const to = new THREE.Vector3().subVectors(playerPos, o.pos);
      to.y = 0;
      const dist = to.length();
      o.heading = Math.atan2(-to.x, -to.z);
      o.rig.rotation.y = o.heading;
      o.phase += dt * 6;
      const j = o.rig.userData.joints;
      j.armR.shoulder.rotation.x = -Math.PI / 2;
      j.armL.shoulder.rotation.x = -Math.PI / 2 + 0.3;
      j.legL.hip.rotation.x = Math.sin(o.phase) * 0.08;
      j.legR.hip.rotation.x = -Math.sin(o.phase) * 0.08;
      o.fireTimer -= dt;
      if (o.fireTimer <= 0 && dist < 70 && playerController && !playerController.dead) {
        o.fireTimer = 1.4 + this.rng() * 1.6;
        if (this.rng() < 0.45) playerController.damage(4 + this.rng() * 7);
        if (j) j.flashTimer = 0.06;
      }
      if (j && j.flashTimer > 0) {
        j.flashTimer -= dt;
        j.muzzleFlash.material.opacity = 0.9;
      } else if (j) {
        j.muzzleFlash.material.opacity = 0;
      }
    }

    // Roadblock strobes.
    for (const rb of this.roadblocks) {
      rb.userData.flash.color.setHex(Math.sin(elapsed * 10 + rb.position.x) > 0 ? 0xff3333 : 0x2255ff);
    }

    // Hawk helicopter: orbit the player, spin rotors, track the searchlight.
    if (this.heli) {
      const want = new THREE.Vector3(
        playerPos.x + Math.cos(elapsed * 0.25) * 46,
        52 + Math.sin(elapsed * 0.6) * 4,
        playerPos.z + Math.sin(elapsed * 0.25) * 46,
      );
      this.heliPos.lerp(want, Math.min(1, dt * 1.4));
      this.heli.position.copy(this.heliPos);
      this.heli.rotation.y = Math.atan2(
        -(playerPos.x - this.heliPos.x),
        -(playerPos.z - this.heliPos.z),
      );
      this.heli.userData.mainRotor.rotation.y += dt * 28;
      this.heli.userData.tailRotor.rotation.x += dt * 34;
      this.heli.userData.strobe.intensity = 10 + Math.sin(elapsed * 12) * 10;
      // Aim the cone + spotlight from the heli down at the player.
      const cone = this.heli.userData.cone;
      const dx = playerPos.x - this.heliPos.x;
      const dz = playerPos.z - this.heliPos.z;
      const tilt = Math.min(0.45, Math.hypot(dx, dz) / 120);
      cone.rotation.set(tilt, 0, 0);
      cone.material.opacity = 0.13 + Math.sin(elapsed * 7) * 0.04;
    }
    return { stars: this.heat, busted: this.busted };
  }
}
