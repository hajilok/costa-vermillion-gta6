// Deterministic screenshot staging for the four dossier shots.
// Each scene settles the world, locks the camera, then renders twice so
// window.__SHOT_READY flips only after the final pixels land.

import * as THREE from '../vendor/three.module.min.js';
import { createSeededRandom } from './cityConfig.js';
import { createVehicleMesh } from './vehicleSystem.js';

function purgeCoverTraffic(game) {
  game.traffic.cars = game.traffic.cars.filter((car) => {
    const inLane = car.phys.x > -462 && car.phys.x < -418 && car.phys.z > 180;
    if (inLane && game.scene) game.scene.remove(car.mesh);
    return !inLane;
  });
}

function settle(game, dt, n) {
  for (let i = 0; i < n; i++) game.stepFrame(dt, 100 + i * dt);
}

function stageCover(game) {
  purgeCoverTraffic(game);
  game.police.clearHeat();
  game.mode = 'drive';
  game.activeChar = 'ELENA VEGA';

  // Elena closest in the center-left hero foreground; interceptors flank
  // right and ahead-left so no cruiser ever sits between camera and hero.
  const mesh = game.driveVehicle('veloce_gt', -441.2, 193.8, 0, 0xff3355);
  mesh.position.y = 0.42;
  mesh.rotation.set(0, 0.34, -0.03);
  game.vehiclePhys.speed = 45.6;
  if (mesh.userData.setSmoke) mesh.userData.setSmoke(0.18);
  if (mesh.userData.setNitro) mesh.userData.setNitro(true);
  game.story.cash = 24850;
  game.police.stars = 4;
  game.police.heat = 85;
  game.story.refreshGps({ x: -441.2, z: 193.8 });

  purgeCoverTraffic(game);

  // Hero closest center-left; interceptors flank well clear of the
  // camera-to-hero sightline (camera sits near x=-435.5 looking north), so
  // Elena's Veloce reads 100% unobstructed in the foreground.
  for (const [px, pz, yaw] of [[-431.5, 191.5, -0.3], [-447.5, 186.0, 0.34]]) {
    const cop = game.police.spawnPursuer({ x: -441.2, z: 193.8 }, 'car');
    cop.x = px;
    cop.z = pz;
    const cruiser = createVehicleMesh('pvpd_interceptor');
    cruiser.position.set(px, 0.42, pz);
    cruiser.rotation.y = yaw;
    game.scene.add(cruiser);
    cop.mesh = cruiser;
  }
  // Roof strobes pulse on the pursuit cars.
  game.police.syncForces({ x: -441.2, z: 193.8 }, 0.5);

  const heliSpot = game.police.spawnPursuer({ x: -441.2, z: 193.8 }, 'heli');
  void heliSpot;
  game.police.heli.position.set(-453.0, 12.0, 158.0);
  game.police.heli.visible = true;

  settle(game, 1 / 60, 40);
  purgeCoverTraffic(game);
  game.vehiclePhys.speed = 45.6;
  mesh.position.set(-441.2, 0.42, 193.8);
  mesh.rotation.set(0, 0.34, -0.03);
  if (mesh.userData.setSmoke) mesh.userData.setSmoke(0.18);
  if (mesh.userData.setNitro) mesh.userData.setNitro(true);
  game.police.heli.position.set(-453.0, 12.0, 158.0);

  game.camera.fov = 60;
  game.camera.updateProjectionMatrix();
  game.camera.position.set(-435.5, 2.45, 201.5);
  game.camera.lookAt(new THREE.Vector3(-446.5, 2.5, 150));
  game.camRig.pos.copy(game.camera.position);
  game.camRig.look.set(-446.5, 2.5, 150);

  game.hud.setDialogue('MATEO CRUZ', 'Lose that PVPD Hawk before you bring the Veloce near the Keys!');
}

function stageCombat(game) {
  game.police.clearHeat();
  if (game.vehicleMesh) {
    game.scene.remove(game.vehicleMesh);
    game.vehicleMesh = null;
    game.vehiclePhys = null;
    game.vehicle = null;
  }
  game.mode = 'foot';
  game.player.rig.visible = true;
  game.player.x = -60;
  game.player.z = -40;
  // Face AWAY from the camera: back + ponytail to the lens, gun forward.
  game.player.heading = 0.28 + Math.PI;
  game.player.aiming = true;
  game.player.syncMesh(3.2);
  game.combat.switchTo(1);
  game.weaponSlot = 1;
  game.combat.mag.coral_smg = 32;
  game.story.cash = 8600;
  game.story.startChapter(2);

  const fwd = new THREE.Vector3(Math.sin(0.28), 0, Math.cos(0.28));
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const eye = new THREE.Vector3(-60, 0, -40)
    .addScaledVector(fwd, -3.3)
    .addScaledVector(right, 0.95)
    .add(new THREE.Vector3(0, 1.65, 0));
  const look = new THREE.Vector3(-60, 0, -40)
    .addScaledVector(fwd, 13)
    .addScaledVector(right, 0.95)
    .add(new THREE.Vector3(0, 1.35, 0));
  game.camera.fov = 55;
  game.camera.updateProjectionMatrix();
  game.camera.position.copy(eye);
  game.camera.lookAt(look);
  game.camRig.pos.copy(eye);
  game.camRig.look.copy(look);

  // Boveda Armored truck 13.5m ahead as the bullet backdrop.
  const truck = game.driveVehicle('boveda_armored', -60 + fwd.x * 13.5, -40 + fwd.z * 13.5, Math.PI, null);
  game.scene.remove(truck);
  game.vehicleMesh = null;
  game.vehiclePhys = null;
  game.vehicle = null;
  game.mode = 'foot';
  game.player.rig.visible = true;
  truck.position.set(-60 + fwd.x * 13.5, 0, -40 + fwd.z * 13.5);
  truck.rotation.y = Math.PI;
  game.scene.add(truck);
  game.player.x = -60;
  game.player.z = -40;
  game.player.heading = 0.28 + Math.PI;

  game.combat.guards.length = 0;
  game.combat.spawnGuardSquad({ x: -60 + fwd.x * 11, z: -40 + fwd.z * 11 }, 4, { hp: 60 });
  game.combat.guards.forEach((guard, i) => {
    guard.x = -60 + fwd.x * (9 + i) + right.x * (i % 2 === 0 ? 1.5 : -1.5);
    guard.z = -40 + fwd.z * (9 + i) + right.z * (i % 2 === 0 ? 1.5 : -1.5);
    guard.mesh.position.set(guard.x, 0, guard.z);
  });

  // Elena's back faces the camera (heading +PI), so her fireWeapon dir points
  // at the lens: override with the true forward (+fwd) toward guards/truck.
  game.player.rig.userData.gunMesh.visible = true;
  const muzzle = new THREE.Vector3(
    -60 + fwd.x * 0.85 + right.x * 0.25,
    1.38,
    -40 + fwd.z * 0.85 + right.z * 0.25
  );
  for (let i = 0; i < 3; i++) {
    const jitter = new THREE.Vector3((i - 1) * 0.06, (i - 1) * 0.02, 0);
    game.combat.spawnTracer(muzzle, fwd.clone().add(jitter), { id: 'breacher_shotgun' });
  }
  game.combat.spawnMuzzleFlash(muzzle);
  game.combat.spawnSparks(muzzle, fwd, 10);
  game.combat.spawnPickups({ x: -60 + fwd.x * 6, z: -40 + fwd.z * 6 });

  const cop = game.police.spawnPursuer({ x: -60, z: -40 }, 'car');
  cop.x = -60 + right.x * 10 + fwd.x * 15;
  cop.z = -40 + right.z * 10 + fwd.z * 15;
  game.police.stars = 2;
  game.police.heat = 45;
  game.peds.spawn(4);
  for (const ped of game.peds.peds.slice(-4)) {
    ped.mesh.userData.armL.rotation.x = -2.7;
    ped.mesh.userData.armR.rotation.x = -2.7;
  }
  game.hud.setDialogue('ELENA VEGA', 'Vault crew on me — keep the guards pinned!');
}

function stageMarina(game) {
  game.police.clearHeat();
  if (game.vehicleMesh) game.scene.remove(game.vehicleMesh);
  game.mode = 'boat';
  const mesh = game.driveVehicle('marea_speedboat', 232, -92, 0, null);
  const tx = 272;
  const tz = -195;
  const heading = Math.atan2(-(tx - 232), -(tz - (-92)));
  game.vehiclePhys.heading = heading;
  game.vehiclePhys.speed = 32.8;
  mesh.rotation.y = heading;
  mesh.position.y = 0.24;
  if (mesh.userData.wake) mesh.userData.wake.material.opacity = 0.78;
  game.player.x = 232;
  game.player.z = -92;
  game.player.heading = heading;
  game.police.stars = 3;
  game.police.heat = 65;
  const hawk = game.police.spawnPursuer({ x: 232, z: -92 }, 'heli');
  void hawk;
  game.police.heli.visible = true;
  game.police.heli.position.set(256, 13.5, -142);
  settle(game, 1 / 60, 24);
  game.vehiclePhys.speed = 32.8;
  mesh.position.set(232, 0.24, -92);
  if (mesh.userData.wake) mesh.userData.wake.material.opacity = 0.78;
  game.police.heli.position.set(256, 13.5, -142);
  // Chase cam: 9.2m back, 2.1m left, 3.3m up.
  const fwd = new THREE.Vector3(-Math.sin(heading), 0, -Math.cos(heading));
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const eye = new THREE.Vector3(232, 0.24, -92)
    .addScaledVector(fwd, -9.2)
    .addScaledVector(right, -2.1)
    .add(new THREE.Vector3(0, 3.3, 0));
  const look = new THREE.Vector3(232, 1.2, -92).addScaledVector(fwd, 12);
  game.camera.fov = 58;
  game.camera.updateProjectionMatrix();
  game.camera.position.copy(eye);
  game.camera.lookAt(look);
  game.camRig.pos.copy(eye);
  game.camRig.look.copy(look);
  game.hud.setDialogue('MATEO CRUZ', 'Thread the causeway towers — do not scratch the paint!');
}

function stageMap(game) {
  game.police.clearHeat();
  if (game.vehicleMesh) game.scene.remove(game.vehicleMesh);
  game.vehicleMesh = null;
  game.vehiclePhys = null;
  game.mode = 'foot';
  game.story.startChapter(3);
  game.story.stage = 1;
  game.story.cash = 9850;
  game.story.respect = 640;
  game.story.refreshGps({ x: -433, z: 166 });

  const paints = [0xffd94d, 0x4df0ff, 0xff6f61];
  const ids = ['veloce_gt', 'brisa_cabrio', 'veloce_gt'];
  for (const mesh of game.traffic.showcase) game.scene.remove(mesh);
  game.traffic.showcase.length = 0;
  ids.forEach((id, i) => {
    const mesh = createVehicleMesh(id);
    const body = mesh.children[0];
    if (body && body.material && body.material.color) {
      body.material = body.material.clone();
      body.material.color.setHex(paints[i]);
    }
    // Parked showcase row on the beach road, right half of the cover frame.
    mesh.position.set(-438 + i * 3.4, 0, 176 - i * 2.2);
    mesh.rotation.y = Math.PI * 0.9;
    game.scene.add(mesh);
    game.traffic.showcase.push(mesh);
  });
  game.player.x = -433;
  game.player.z = 166;
  game.player.heading = Math.PI * 0.9;
  game.player.rig.visible = true;
  game.player.aiming = false;
  game.player.syncMesh(9.4);

  game.camera.fov = 58;
  game.camera.updateProjectionMatrix();
  game.camera.position.set(-446, 2.5, 184);
  game.camera.lookAt(new THREE.Vector3(-431, 2.8, 154));
  game.camRig.pos.copy(game.camera.position);
  game.camRig.look.set(-431, 2.8, 154);

  game.hud.setMenuOpen(true);
  const badge = document.getElementById('save-badge');
  if (badge) badge.textContent = 'Slot 1: Ch.4 · $9,850 · Saved';
  game.hud.setDialogue('', '');
}

export function stageScreenshotScenario(shotName, game) {
  const rand = createSeededRandom(7);
  game.rng = rand;
  if (shotName === 'cover') stageCover(game);
  else if (shotName === 'combat') stageCombat(game);
  else if (shotName === 'marina') stageMarina(game);
  else if (shotName === 'map') stageMap(game);
  else stageCover(game);
  // Settle physics + rotor + water before the two final renders.
  game.renderHud();
  game.renderer.render(game.scene, game.camera);
  game.renderHud();
  game.renderer.render(game.scene, game.camera);
  game.renderHud();
  game.renderer.render(game.scene, game.camera);
  window.__SHOT_READY = true;
}
