// Elena and Mateo on foot plus sidewalk crowds. Every ped spawn and step is
// clamped to road spans and rejected on water so crowds never touch the bay.

import * as THREE from '../vendor/three.module.min.js';
import { ROAD_NETWORK, isWater } from './cityConfig.js';

export function createCharacterRig(options) {
  const opts = options || {};
  const skin = opts.skin || 0xd9a077;
  const jacket = opts.jacket || 0xff5f6d;
  const pants = opts.pants || 0x27324a;
  const hairColor = opts.hair || 0x2a1a12;

  const rig = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });
  const jacketMat = new THREE.MeshStandardMaterial({ color: jacket, roughness: 0.6 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.75 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.55 });

  const hips = new THREE.Group();
  hips.position.y = 0.95;
  rig.add(hips);

  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.26), pantsMat);
  pelvis.position.y = 0;
  pelvis.castShadow = true;
  hips.add(pelvis);

  function makeLeg(side) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.13, -0.1, 0);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.18), pantsMat);
    thigh.position.y = -0.22;
    thigh.castShadow = true;
    leg.add(thigh);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.12, 0.34), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 }));
    shoe.position.set(0, -0.48, -0.05);
    leg.add(shoe);
    hips.add(leg);
    return leg;
  }

  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  const torso = new THREE.Group();
  torso.position.y = 0.18;
  hips.add(torso);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.55, 0.28), jacketMat);
  chest.position.y = 0.28;
  chest.castShadow = true;
  torso.add(chest);
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.32), jacketMat);
  collar.position.y = 0.58;
  torso.add(collar);

  const head = new THREE.Group();
  head.position.y = 0.66;
  torso.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 12), skinMat);
  skull.castShadow = true;
  head.add(skull);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), hairMat);
  hair.scale.set(1, 0.85, 1);
  hair.position.set(0, 0.07, 0.03);
  head.add(hair);
  if (opts.ponytail !== false) {
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.42, 8), hairMat);
    tail.position.set(0, -0.02, 0.22);
    tail.rotation.x = 0.5;
    head.add(tail);
  }

  function makeArm(side) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.3, 0.48, 0);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.36, 0.15), jacketMat);
    upper.position.y = -0.18;
    upper.castShadow = true;
    arm.add(upper);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), skinMat);
    hand.position.y = -0.42;
    arm.add(hand);
    torso.add(arm);
    return arm;
  }

  const armL = makeArm(-1);
  const armR = makeArm(1);

  // Compact handheld gun parented directly to the right hand joint at x=0 so
  // the SMG grip stays glued to the palm while aiming.
  const gunMesh = new THREE.Group();
  const gunBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.14, 0.55),
    new THREE.MeshStandardMaterial({ color: 0x23262e, metalness: 0.75, roughness: 0.35 })
  );
  gunMesh.add(gunBody);
  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.2, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x5a3d2b, roughness: 0.7 })
  );
  grip.position.set(0, -0.14, 0.12);
  grip.rotation.x = 0.3;
  gunMesh.add(grip);
  const muzzleTip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.12, 8),
    new THREE.MeshStandardMaterial({ color: 0x101216, metalness: 0.8, roughness: 0.3 })
  );
  muzzleTip.rotation.x = Math.PI / 2;
  muzzleTip.position.set(0, 0.02, -0.32);
  gunMesh.add(muzzleTip);
  gunMesh.position.set(0, -0.42, -0.12);
  gunMesh.visible = false;
  armR.add(gunMesh);

  rig.userData = {
    hips,
    torso,
    head,
    armL,
    armR,
    legL,
    legR,
    gunMesh,
    walkPhase: Math.random() * Math.PI * 2,
  };
  return rig;
}

function clampToRoadSpan(x, z) {
  let cx = x;
  let cz = z;
  let best = null;
  let bestDist = Infinity;
  for (const a of ROAD_NETWORK.avenues) {
    if (cz < a.minZ || cz > a.maxZ) continue;
    const d = Math.abs(cx - a.x);
    if (d < bestDist) {
      bestDist = d;
      best = { x: a.x + (cx > a.x ? 9 : -9), z: cz };
    }
  }
  for (const b of ROAD_NETWORK.boulevards) {
    if (cx < b.minX || cx > b.maxX) continue;
    const d = Math.abs(cz - b.z);
    if (d < bestDist) {
      bestDist = d;
      best = { x: cx, z: b.z + (cz > b.z ? 9 : -9) };
    }
  }
  if (best) {
    cx = best.x;
    cz = best.z;
  }
  return { x: cx, z: cz };
}

function drySidewalk(rand) {
  for (let i = 0; i < 24; i++) {
    const avenue = ROAD_NETWORK.avenues[Math.floor(rand() * ROAD_NETWORK.avenues.length)];
    const z = avenue.minZ + rand() * (avenue.maxZ - avenue.minZ);
    const x = avenue.x + (rand() < 0.5 ? -9 : 9);
    if (!isWater(x, z)) return { x, z };
    const boulevard = ROAD_NETWORK.boulevards[Math.floor(rand() * ROAD_NETWORK.boulevards.length)];
    const bx = boulevard.minX + rand() * (boulevard.maxX - boulevard.minX);
    const bz = boulevard.z + (rand() < 0.5 ? -9 : 9);
    if (!isWater(bx, bz)) return { x: bx, z: bz };
  }
  return { x: -260, z: -211 };
}

export class PlayerCharacterController {
  constructor(scene, options) {
    this.scene = scene;
    this.rig = createCharacterRig(options || { jacket: 0xff5f6d });
    this.x = options?.x ?? -415;
    this.z = options?.z ?? 120;
    this.heading = 0;
    this.speed = 0;
    this.aiming = false;
    if (scene) scene.add(this.rig);
    this.syncMesh(0);
  }

  syncMesh(t) {
    this.rig.position.set(this.x, 0, this.z);
    this.rig.rotation.y = this.heading;
    const u = this.rig.userData;
    const swing = Math.min(1, Math.abs(this.speed) / 4) * Math.sin((t || 0) * 9 + u.walkPhase);
    u.legL.rotation.x = swing * 0.7;
    u.legR.rotation.x = -swing * 0.7;
    u.armL.rotation.x = -swing * 0.5;
    if (this.aiming) {
      u.armR.rotation.x = -Math.PI / 2 + 0.08;
      u.gunMesh.visible = true;
    } else {
      u.armR.rotation.x = swing * 0.5;
      u.gunMesh.visible = false;
    }
  }

  step(input, dt, t) {
    const run = input.sprint ? 7.2 : 4.4;
    const tx = input.moveX * run;
    const tz = input.moveZ * run;
    this.speed += (Math.hypot(tx, tz) - this.speed) * Math.min(1, dt * 8);
    if (Math.hypot(tx, tz) > 0.2) this.heading = Math.atan2(tx, tz);
    const nx = this.x + (tx * dt);
    const nz = this.z + (tz * dt);
    if (!isWater(nx, nz)) {
      this.x = nx;
      this.z = nz;
    }
    this.aiming = !!input.aim;
    this.syncMesh(t);
    return this;
  }

  fireWeapon() {
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    const rx = Math.cos(this.heading);
    const rz = -Math.sin(this.heading);
    const origin = new THREE.Vector3(
      this.x + fx * 0.85 + rx * 0.25,
      1.38,
      this.z + fz * 0.85 + rz * 0.25
    );
    const dir = new THREE.Vector3(fx, 0, fz);
    this.rig.userData.gunMesh.visible = true;
    return { origin, dir };
  }
}

export class PedestrianCrowdManager {
  constructor(scene, rand) {
    this.scene = scene;
    this.rand = rand || Math.random;
    this.peds = [];
  }

  spawn(count) {
    for (let i = 0; i < count; i++) {
      const palettes = [0x4dd6c6, 0xffd94d, 0x7fb6d9, 0xff9e7d, 0xc9f2d8];
      const rig = createCharacterRig({
        jacket: palettes[Math.floor(this.rand() * palettes.length)],
        ponytail: this.rand() < 0.5,
        hair: [0x2a1a12, 0x6b4a2a, 0x111111, 0xd9c08a][Math.floor(this.rand() * 4)],
      });
      const spot = drySidewalk(this.rand);
      const clamped = clampToRoadSpan(spot.x, spot.z);
      const ped = {
        mesh: rig,
        x: isWater(clamped.x, clamped.z) ? -260 : clamped.x,
        z: isWater(clamped.x, clamped.z) ? -211 : clamped.z,
        heading: this.rand() * Math.PI * 2,
        speed: 0.8 + this.rand() * 1.2,
        t: this.rand() * 10,
      };
      if (this.scene) this.scene.add(rig);
      this.peds.push(ped);
    }
    return this.peds.length;
  }

  update(dt) {
    for (const ped of this.peds) {
      ped.t += dt;
      const nx = ped.x + Math.sin(ped.heading) * ped.speed * dt;
      const nz = ped.z + Math.cos(ped.heading) * ped.speed * dt;
      const clamped = clampToRoadSpan(nx, nz);
      if (!isWater(clamped.x, clamped.z)) {
        ped.x = clamped.x;
        ped.z = clamped.z;
      } else {
        ped.heading += Math.PI * (0.5 + this.rand() * 0.5);
      }
      if (this.rand() < dt * 0.05) ped.heading += (this.rand() - 0.5) * 1.2;
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
      const swing = Math.sin(ped.t * 7) * 0.55;
      ped.mesh.userData.legL.rotation.x = swing;
      ped.mesh.userData.legR.rotation.x = -swing;
      ped.mesh.userData.armL.rotation.x = -swing * 0.6;
      ped.mesh.userData.armR.rotation.x = swing * 0.6;
    }
  }
}
