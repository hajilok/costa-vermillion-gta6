// Costa Vermillion: Sunset Syndicate — Elena Vega on-foot rig + pedestrian crowds.
// 100% original content. Imports only 'three' and './cityConfig.js'.
import * as THREE from 'three';
import { ROAD_NETWORK, WORLD_BOUNDS, isWater } from './cityConfig.js';

const SKIN = [0xf2c49b, 0xc98a5e, 0x8a5a34, 0x5e3a22];
const TOPS = [0xff5a4e, 0x38e8ff, 0xffc44d, 0xff3fa4, 0x7fd6a4, 0xffffff, 0x4d7dff];
const BOTTOMS = [0x274060, 0xf2ead8, 0xff7a3c, 0x1c2f55, 0x7a4a6e, 0x3f6b4f];

function limb(w, h, d, color) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  m.castShadow = true;
  return m;
}

// Articulated low-poly character rig with named joints for walk/aim/flee poses.
// options: { skin, top, bottom, hair, female, hat }
export function createCharacterRig(options = {}) {
  const skin = options.skin ?? SKIN[0];
  const top = options.top ?? TOPS[0];
  const bottom = options.bottom ?? BOTTOMS[0];
  const hairColor = options.hair ?? 0x2a1a12;
  const root = new THREE.Group();
  const joints = {};

  const hips = new THREE.Group();
  hips.position.y = 0.96;
  root.add(hips);
  joints.hips = hips;

  const torso = limb(0.52, 0.62, 0.3, top);
  torso.position.y = 0.36;
  hips.add(torso);
  joints.torso = torso;

  const headG = new THREE.Group();
  headG.position.y = 0.78;
  hips.add(headG);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 12, 10),
    new THREE.MeshLambertMaterial({ color: skin }),
  );
  head.castShadow = true;
  headG.add(head);
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.21, 12, 8, 0, Math.PI * 2, 0, 1.9),
    new THREE.MeshLambertMaterial({ color: hairColor }),
  );
  hair.position.y = 0.05;
  headG.add(hair);
  if (options.hat) {
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.06, 12),
      new THREE.MeshLambertMaterial({ color: 0xfff3d6 }),
    );
    brim.position.y = 0.16;
    headG.add(brim);
  }
  joints.head = headG;

  function makeArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.34 * side, 0.6, 0);
    hips.add(shoulder);
    const upper = limb(0.15, 0.34, 0.15, top);
    upper.position.y = -0.17;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.34;
    shoulder.add(elbow);
    const fore = limb(0.13, 0.32, 0.13, skin);
    fore.position.y = -0.16;
    elbow.add(fore);
    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 8, 6),
      new THREE.MeshLambertMaterial({ color: skin }),
    );
    hand.position.y = -0.34;
    elbow.add(hand);
    return { shoulder, elbow, hand };
  }

  function makeLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(0.15 * side, 0, 0);
    hips.add(hip);
    const thigh = limb(0.18, 0.46, 0.18, bottom);
    thigh.position.y = -0.24;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.48;
    hip.add(knee);
    const shin = limb(0.15, 0.44, 0.15, skin);
    shin.position.y = -0.22;
    knee.add(shin);
    return { hip, knee };
  }

  joints.armL = makeArm(-1);
  joints.armR = makeArm(1);
  joints.legL = makeLeg(-1);
  joints.legR = makeLeg(1);

  // Weapon mesh held in the right hand + frame-attached muzzle flash quad.
  const weapon = new THREE.Group();
  const grip = limb(0.09, 0.22, 0.12, 0x1a1a24);
  weapon.add(grip);
  const barrel = limb(0.07, 0.07, 0.5, 0x2c2c38);
  barrel.position.set(0, 0.06, -0.28);
  weapon.add(barrel);
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.4, 0.4),
    new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
  );
  flash.position.set(0, 0.06, -0.62);
  weapon.add(flash);
  weapon.position.set(0, -0.36, -0.08);
  weapon.rotation.x = -Math.PI / 2;
  joints.armR.hand.add(weapon);
  joints.weapon = weapon;
  joints.muzzleFlash = flash;
  joints.flashTimer = 0;

  root.userData.joints = joints;
  root.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return root;
}

export function triggerMuzzleFlash(rig) {
  const j = rig.userData.joints;
  if (j) j.flashTimer = 0.06;
}

// Elena Vega on-foot controller: walk/sprint, aim pose, enter/exit vehicles, health/armor.
export class PlayerCharacterController {
  constructor(scene, rig, opts = {}) {
    this.scene = scene;
    this.mesh = rig;
    this.pos = rig.position.clone();
    this.heading = 0;
    this.speed = 0;
    this.sprinting = false;
    this.aiming = false;
    this.health = 100;
    this.armor = opts.armor ?? 50;
    this.dead = false;
    this.inVehicle = null; // VehiclePhysicsController when driving
    this.walkPhase = 0;
    this.muzzleTimer = 0;
    this.enterCooldown = 0;
    scene.add(rig);
  }

  get onFoot() {
    return !this.inVehicle;
  }

  teleport(x, z, heading = 0) {
    this.pos.set(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.set(0, heading, 0);
  }

  damage(amount) {
    if (this.dead) return;
    let rest = amount;
    if (this.armor > 0) {
      const soak = Math.min(this.armor, rest * 0.6);
      this.armor -= soak;
      rest -= soak;
    }
    this.health -= rest;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
  }

  heal(amount) {
    this.health = Math.min(100, this.health + amount);
  }

  fireWeapon() {
    if (!this.onFoot || this.dead) return null;
    triggerMuzzleFlash(this.mesh);
    this.muzzleTimer = 0.06;
    const dir = new THREE.Vector3(-Math.sin(this.heading), 0, -Math.cos(this.heading));
    const from = this.pos.clone();
    from.y = 1.35;
    return { from, dir };
  }

  // Smooth F-key carjack: hides the rig, attaches to any traffic/parked vehicle.
  tryEnterVehicle(vehicle) {
    if (!this.onFoot || this.enterCooldown > 0 || !vehicle || vehicle.aiLocked) return false;
    this.inVehicle = vehicle.controller || vehicle;
    this.enterCooldown = 0.6;
    this.mesh.visible = false;
    return true;
  }

  exitVehicle() {
    if (this.onFoot || this.enterCooldown > 0) return false;
    const ctrl = this.inVehicle;
    const side = new THREE.Vector3(-Math.cos(ctrl.heading), 0, Math.sin(ctrl.heading));
    const out = ctrl.pos.clone().addScaledVector(side, 2.2);
    if (isWater(out.x, out.z) && !ctrl.isBoat) out.addScaledVector(side, 2.4);
    this.inVehicle = null;
    this.enterCooldown = 0.6;
    this.mesh.visible = true;
    this.teleport(out.x, out.z, ctrl.heading);
    return true;
  }

  // input: { moveX, moveZ (camera-space), sprint, aim }
  update(dt, input = {}) {
    this.enterCooldown = Math.max(0, this.enterCooldown - dt);
    const j = this.mesh.userData.joints;
    if (this.inVehicle) {
      // Ride along: keep rig synced inside the driven vehicle.
      this.pos.copy(this.inVehicle.pos);
      this.heading = this.inVehicle.heading;
      this.mesh.position.copy(this.pos);
      this.mesh.rotation.set(0, this.heading, 0);
      return { speed: Math.abs(this.inVehicle.speed), driving: true };
    }
    if (this.dead) {
      this.mesh.rotation.x += (Math.PI / 2 - this.mesh.rotation.x) * Math.min(1, dt * 4);
      return { speed: 0, driving: false };
    }
    const mx = input.moveX ?? 0;
    const mz = input.moveZ ?? 0;
    const mag = Math.min(1, Math.hypot(mx, mz));
    this.sprinting = !!input.sprint && mag > 0.1;
    this.aiming = !!input.aim;
    const top = this.sprinting ? 7.4 : 4.4;
    this.speed += (top * mag - this.speed) * Math.min(1, dt * 10);
    if (mag > 0.05) {
      this.heading = Math.atan2(-mx, -mz);
      this.pos.x += mx * this.speed * dt;
      this.pos.z += mz * this.speed * dt;
    }
    this.pos.x = Math.max(WORLD_BOUNDS.minX, Math.min(WORLD_BOUNDS.maxX, this.pos.x));
    this.pos.z = Math.max(WORLD_BOUNDS.minZ, Math.min(WORLD_BOUNDS.maxZ, this.pos.z));
    if (isWater(this.pos.x, this.pos.z)) {
      // Shallow wade: slow down, never sink the rig.
      this.speed *= 1 - Math.min(1, dt * 2);
    }
    this.pos.y = 0;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.set(0, this.heading, 0);

    // Walk-cycle swing, sprint lean, over-the-shoulder aim pose.
    this.walkPhase += dt * (3 + this.speed * 1.8);
    const swing = Math.min(0.8, this.speed * 0.12) * Math.sin(this.walkPhase * 3);
    j.legL.hip.rotation.x = swing;
    j.legR.hip.rotation.x = -swing;
    j.legL.knee.rotation.x = Math.max(0, -swing) * 0.8;
    j.legR.knee.rotation.x = Math.max(0, swing) * 0.8;
    if (this.aiming) {
      j.armR.shoulder.rotation.x = -Math.PI / 2 + 0.12;
      j.armR.elbow.rotation.x = 0;
      j.armL.shoulder.rotation.x = -Math.PI / 2 + 0.3;
      j.armL.shoulder.rotation.y = 0.5;
      j.armL.elbow.rotation.x = -0.5;
      j.armL.shoulder.rotation.z = 0;
      j.armR.shoulder.rotation.z = 0;
    } else {
      j.armR.shoulder.rotation.x = -swing * 0.7;
      j.armL.shoulder.rotation.x = swing * 0.7;
      j.armL.shoulder.rotation.y = 0;
      j.armR.shoulder.rotation.z = 0.12;
      j.armL.shoulder.rotation.z = -0.12;
      j.armR.elbow.rotation.x = -0.25;
      j.armL.elbow.rotation.x = -0.25;
    }
    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt;
      j.muzzleFlash.material.opacity = 0.95;
      j.muzzleFlash.rotation.z = Math.random() * Math.PI;
    } else {
      j.muzzleFlash.material.opacity = 0;
    }
    return { speed: this.speed, driving: false };
  }
}

// 45+ varied summer-outfit pedestrians on sidewalks/boardwalks; flee with raised arms.
export class PedestrianCrowdManager {
  constructor(scene, rng, count = 48) {
    this.scene = scene;
    this.rng = rng;
    this.peds = [];
    this.panicEvents = [];
    for (let i = 0; i < count; i += 1) {
      const rig = createCharacterRig({
        skin: SKIN[Math.floor(rng() * SKIN.length)],
        top: TOPS[Math.floor(rng() * TOPS.length)],
        bottom: BOTTOMS[Math.floor(rng() * BOTTOMS.length)],
        hair: [0x2a1a12, 0x6b4a1f, 0xd8b25a, 0x111111, 0xff7a3c][Math.floor(rng() * 5)],
        female: rng() < 0.5,
        hat: rng() < 0.3,
      });
      scene.add(rig);
      const ped = {
        rig,
        pos: new THREE.Vector3(),
        heading: rng() * Math.PI * 2,
        speed: 0.9 + rng() * 1.1,
        state: 'walk', // walk | flee
        phase: rng() * 10,
        target: new THREE.Vector3(),
        fleeTimer: 0,
      };
      this.respawn(ped, true);
      this.peds.push(ped);
    }
  }

  randomStrollPoint(center, spread = 60) {
    const x = center.x + (this.rng() - 0.5) * spread * 2;
    const z = center.z + (this.rng() - 0.5) * spread * 2;
    return new THREE.Vector3(x, 0, z);
  }

  respawn(ped, anywhere = false) {
    // Sidewalk edges beside random roads, or the beach boardwalk.
    const useBoardwalk = this.rng() < 0.35;
    if (useBoardwalk) {
      ped.pos.set(-500 + this.rng() * 40, 0, -300 + this.rng() * 640);
    } else if (anywhere) {
      ped.pos.set(-560 + this.rng() * 1100, 0, -560 + this.rng() * 1100);
    } else {
      const ave = ROAD_NETWORK.avenues[Math.floor(this.rng() * ROAD_NETWORK.avenues.length)];
      const blvd = ROAD_NETWORK.boulevards[Math.floor(this.rng() * ROAD_NETWORK.boulevards.length)];
      ped.pos.set(this.rng() < 0.5 ? ave.x + 8 + this.rng() * 4 : -560 + this.rng() * 1100, 0, this.rng() < 0.5 ? -560 + this.rng() * 1100 : blvd.z + 8 + this.rng() * 4);
    }
    if (isWater(ped.pos.x, ped.pos.z)) ped.pos.x += 40;
    ped.target.copy(this.randomStrollPoint({ x: ped.pos.x, z: ped.pos.z }, 50));
    ped.rig.position.copy(ped.pos);
    ped.state = 'walk';
    ped.fleeTimer = 0;
  }

  // Gunfire / reckless driving scares everyone nearby: raised arms, sprint away.
  panicAt(x, z, radius = 40) {
    this.panicEvents.push({ x, z, radius, ttl: 0.2 });
    for (const ped of this.peds) {
      const d = Math.hypot(ped.pos.x - x, ped.pos.z - z);
      if (d < radius) {
        ped.state = 'flee';
        ped.fleeTimer = 4 + this.rng() * 3;
        const away = new THREE.Vector3(ped.pos.x - x, 0, ped.pos.z - z).normalize();
        ped.target.copy(ped.pos).addScaledVector(away, 60 + this.rng() * 40);
      }
    }
  }

  update(dt, playerPos) {
    for (const ped of this.peds) {
      const to = new THREE.Vector3().subVectors(ped.target, ped.pos);
      to.y = 0;
      const dist = to.length();
      if (dist < 3 || (ped.state === 'walk' && dist < 1.5)) {
        ped.target.copy(this.randomStrollPoint({ x: ped.pos.x, z: ped.pos.z }, ped.state === 'flee' ? 70 : 50));
      } else {
        to.normalize();
        const want = Math.atan2(-to.x, -to.z);
        let dh = want - ped.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        ped.heading += dh * Math.min(1, dt * 5);
        const sp = ped.state === 'flee' ? ped.speed * 3.2 : ped.speed;
        ped.pos.addScaledVector(to, Math.min(dist, sp * dt));
      }
      if (ped.state === 'flee') {
        ped.fleeTimer -= dt;
        if (ped.fleeTimer <= 0) ped.state = 'walk';
      }
      if (isWater(ped.pos.x, ped.pos.z)) {
        ped.target.copy(ped.pos).add(new THREE.Vector3(30, 0, 0));
      }
      ped.pos.y = 0;
      ped.rig.position.copy(ped.pos);
      ped.rig.rotation.set(0, ped.heading, 0);

      // Animate: relaxed swing while strolling, raised trembling arms while fleeing.
      ped.phase += dt * (ped.state === 'flee' ? 14 : 6);
      const j = ped.rig.userData.joints;
      const swing = Math.sin(ped.phase) * (ped.state === 'flee' ? 0.9 : 0.45);
      j.legL.hip.rotation.x = swing;
      j.legR.hip.rotation.x = -swing;
      if (ped.state === 'flee') {
        j.armL.shoulder.rotation.set(-2.6 + Math.sin(ped.phase * 1.7) * 0.25, 0, -0.5);
        j.armR.shoulder.rotation.set(-2.6 - Math.sin(ped.phase * 1.7) * 0.25, 0, 0.5);
        j.armL.elbow.rotation.x = -0.2;
        j.armR.elbow.rotation.x = -0.2;
      } else {
        j.armL.shoulder.rotation.set(-swing * 0.7, 0, -0.12);
        j.armR.shoulder.rotation.set(swing * 0.7, 0, 0.12);
      }

      // Recycle far-off peds near the player so streets stay alive.
      if (playerPos && ped.pos.distanceTo(playerPos) > 320) {
        ped.pos.set(playerPos.x + (this.rng() - 0.5) * 220, 0, playerPos.z + (this.rng() - 0.5) * 220);
        if (isWater(ped.pos.x, ped.pos.z)) ped.pos.x = playerPos.x + 30;
        ped.target.copy(this.randomStrollPoint({ x: ped.pos.x, z: ped.pos.z }, 50));
      }
    }
  }
}
