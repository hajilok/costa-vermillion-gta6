// Costa Vermillion: Sunset Syndicate — deterministic ?shot=cover|combat|marina|map scenes.
// Warm-up ticks run FIRST, then every hero mesh is explicitly positioned/oriented,
// scene.updateMatrixWorld(true) runs, the camera is locked directly (no cameraRig
// overwrite on the final render), and window.__SHOT_READY is set after rendering.
// 100% original content. Imports only 'three' and sibling ./ modules.
import * as THREE from 'three';
import { createSeededRandom } from './cityConfig.js';

// game: { scene, camera, renderer, rng, city, player, crowd, traffic, police, combat,
//         story, saves, hud, cam, audio, world:{ elapsed },
//         driveVehicle(specId,x,z,heading), stepFrame(dt), renderHud() }
export function stageScreenshotScenario(shotName, game) {
  const g = game;
  const shot = String(shotName || 'cover');
  g.hud.setMenuOpen(false);
  g.story.completed = false;

  if (shot === 'cover') return stageCover(g);
  if (shot === 'combat') return stageCombat(g);
  if (shot === 'marina') return stageMarina(g);
  if (shot === 'map') return stageMap(g);
  return stageCover(g);
}

function warmup(g, seconds = 1.2) {
  // Warm-up ticks FIRST so water/palms/lamps/particles/rotors are mid-animation.
  const dt = 1 / 60;
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i += 1) g.stepFrame(dt, true);
}

function settle(g, seconds = 0.5) {
  // Short post-blocking settle (no cameraRig influence afterwards).
  const dt = 1 / 60;
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i += 1) g.stepFrame(dt, true);
}

function syncMesh(ctrl) {
  ctrl.mesh.position.copy(ctrl.pos);
  ctrl.mesh.rotation.set(0, ctrl.heading, 0);
  ctrl.mesh.updateMatrixWorld(true);
}

function finish(g) {
  g.renderHud();
  g.scene.updateMatrixWorld(true);
  g.renderer.render(g.scene, g.camera);
  g.renderer.render(g.scene, g.camera);
  window.__SHOT_READY = true;
  return true;
}

function forwardOf(heading) {
  return new THREE.Vector3(-Math.sin(heading), 0, -Math.cos(heading));
}

// 'cover': coral-crimson Veloce GT power-slide drift down Coral Avenue at 164 MPH,
// 3/4 left-offset cinematic chase into the sunset, Hawk heli in the upper sky.
function stageCover(g) {
  g.story.startChapter(3);
  g.story.cash = 24850;
  g.story.respect = 210;
  const heading = 0;
  const car = g.driveVehicle('veloce_gt', -441.2, 189.5, heading, 0xff3355);
  warmup(g, 1.4);
  car.pos.set(-441.2, 0.35, 189.5);
  car.heading = heading;
  car.speed = 45.6; // 164 MPH
  car.gear = 5;
  car.nitro = 0.6;
  car.nitroActive = true;
  car.handbrake = true;
  car.steer = 0.52;
  g.player.pos.set(-441.2, 0, 189.5);
  g.player.heading = heading;
  g.player.mesh.visible = false;
  car.mesh.position.copy(car.pos);
  car.mesh.rotation.set(0, 0.52, -0.04);
  car.mesh.updateMatrixWorld(true);
  // Clear any ambient traffic photobombing the bottom-left lens near Coral Ave.
  for (const v of [...g.traffic.vehicles]) {
    if (v.controller !== car && v.controller.pos.z > 192 && Math.abs(v.controller.pos.x + 440) < 30) {
      g.traffic.removeVehicle(v);
    }
  }
  // 2 gentle wispy puffs + cyan nitro (never obscuring the hero car).
  car.spawnDriftSmoke(1 / 60, false);
  car.spawnDriftSmoke(1 / 60, false);
  car.spawnDriftSmoke(1 / 60, false, 0x38e8ff);
  g.police.heatValue = 4;
  g.police.heat = 4;
  g.police.cooldownTimer = 999;
  g.police.lastPlayer = g.player.pos.clone();
  g.police.pursuers.slice().forEach((p) => g.scene.remove(p.mesh));
  g.police.pursuers.length = 0;
  g.police.spawnPursuer(g.player.pos);
  g.police.spawnPursuer(g.player.pos);
  // Both Interceptors chase forward down the avenue (heading 0, never backward).
  const spots = [
    { x: -437.2, z: 195.8 },
    { x: -443.8, z: 197.2 },
  ];
  g.police.pursuers.forEach((p, i) => {
    p.controller.pos.set(spots[i].x, 0.35, spots[i].z);
    p.controller.heading = 0;
    p.controller.speed = 38;
    p.controller.gear = 5;
    syncMesh(p.controller);
  });
  g.police.syncForces();
  // 3D PVPD Hawk left in the open pink-gold sunset sky, clear of the sign.
  if (!g.police.heli) g.police.syncForces();
  if (g.police.heli) {
    g.police.heliPos.set(-452.5, 11.8, 158.0);
    g.police.heli.position.copy(g.police.heliPos);
    g.police.heli.rotation.y = Math.PI;
    g.police.heli.userData.cone.material.opacity = 0.34;
    g.police.heli.userData.cone.scale.set(1.4, 1.4, 1.4);
    g.police.heli.updateMatrixWorld(true);
    g.city.setBeaconPosition(-440, 70);
  }
  g.hud.showDialogue('MATEO CRUZ', 'Lose that PVPD Hawk before you bring the Veloce near the Keys!', 999);
  g.hud.setHint('Drift: SPACE · Nitro: SHIFT · Wanted ★★★★', 999);
  settle(g, 0.4);
  // Re-assert the side-profile drift pose after the settle.
  car.pos.set(-441.2, 0.35, 189.5);
  car.heading = heading;
  car.mesh.position.copy(car.pos);
  car.mesh.rotation.set(0, 0.52, -0.04);
  car.mesh.updateMatrixWorld(true);
  for (const v of [...g.traffic.vehicles]) {
    if (v.controller !== car && v.controller.pos.z > 192 && Math.abs(v.controller.pos.x + 440) < 30) {
      g.traffic.removeVehicle(v);
    }
  }
  car.spawnDriftSmoke(1 / 60, false);
  car.spawnDriftSmoke(1 / 60, false, 0x38e8ff);
  g.police.pursuers.forEach((p) => { p.controller.heading = 0; syncMesh(p.controller); });
  if (g.police.heli) {
    g.police.heliPos.set(-452.5, 11.8, 158.0);
    g.police.heli.position.copy(g.police.heliPos);
    g.police.heli.rotation.y = Math.PI;
    g.police.heli.updateMatrixWorld(true);
  }
  g.scene.updateMatrixWorld(true);
  // Right/east-side camera: beach + ocean left, hotels right, sunset ahead.
  g.camera.position.set(-435.5, 2.45, 201.5);
  g.camera.lookAt(new THREE.Vector3(-446.5, 2.5, 150));
  g.camera.fov = 60;
  g.camera.updateProjectionMatrix();
  g.camera.updateMatrixWorld(true);
  g.renderer.render(g.scene, g.camera);
  finish(g);
  return true;
}

// 'combat': TRUE over-the-shoulder right-offset view, Elena in the left third,
// reticle on the Boveda truck, 4 armed guards with health bars, short tracers.
function stageCombat(g) {
  g.story.startChapter(2);
  g.story.cash = 9200;
  g.story.respect = 120;
  const ex = -60;
  const ez = -40;
  const heading = 0.28;
  g.combat.setCamera(g.camera);
  g.player.teleport(ex, ez, heading);
  g.player.aiming = true;
  g.player.update(1 / 60, { moveX: 0, moveZ: 0, sprint: false, aim: true });
  g.combat.selectWeapon('coral_smg');
  warmup(g, 1.2);
  g.player.pos.set(ex, 0, ez);
  g.player.heading = heading;
  g.player.mesh.position.copy(g.player.pos);
  g.player.mesh.rotation.set(0, heading, 0);
  if (g.player.mesh.userData.gunMesh) g.player.mesh.userData.gunMesh.visible = true;
  const j0 = g.player.mesh.userData.joints;
  if (j0) {
    j0.armR.shoulder.rotation.x = -Math.PI / 2 + 0.12;
    j0.armR.elbow.rotation.x = 0;
    j0.armL.shoulder.rotation.x = -Math.PI / 2 + 0.3;
  }
  g.player.mesh.updateMatrixWorld(true);
  // Re-seat the SMG in Elena's right palm (never floating beside the arm).
  g.player.mesh.updateMatrixWorld(true);
  if (g.player.mesh.userData.gunMesh) {
    const palm = new THREE.Vector3();
    g.player.mesh.userData.joints.armR.hand.getWorldPosition(palm);
    g.player.mesh.worldToLocal(palm);
    g.player.mesh.userData.gunMesh.position.copy(palm).add(new THREE.Vector3(0, -0.06, -0.1));
  }
  for (const gd of g.combat.guards) { if (gd.bar) g.scene.remove(gd.bar); g.scene.remove(gd.rig); }
  g.combat.guards.length = 0;
  g.combat.spawnGuardSquad(ex + 2, ez - 16, 4, 6);
  const fwd = forwardOf(heading);
  g.combat.guards.forEach((gd, i) => {
    const off = (i - 1.5) * 2.6;
    gd.pos.copy(g.player.pos).addScaledVector(fwd, 9 + (i % 2) * 4);
    gd.pos.x += -fwd.z * off;
    gd.pos.z += fwd.x * off;
    gd.pos.y = 0;
    gd.heading = Math.atan2(-(g.player.pos.x - gd.pos.x), -(g.player.pos.z - gd.pos.z));
    gd.rig.position.copy(gd.pos);
    gd.rig.rotation.y = gd.heading;
    const j = gd.rig.userData.joints;
    if (j) {
      j.armR.shoulder.rotation.x = -Math.PI / 2;
      j.armL.shoulder.rotation.x = -Math.PI / 2 + 0.3;
    }
    gd.rig.updateMatrixWorld(true);
  });
  const truck = g.traffic.vehicles.find((v) => v.specId === 'boveda_armored' && v.parked)
    || g.traffic.spawnTrafficVehicle(true, 'boveda_armored', { x: ex, z: ez, heading, road: { kind: 'boulevard', id: 'blvd_vermillion' }, dir: 1 });
  truck.ai = null;
  truck.controller.pos.copy(g.player.pos).addScaledVector(fwd, 13.5);
  truck.controller.pos.y = 0.35;
  truck.controller.heading = heading + Math.PI / 2;
  truck.controller.speed = 0;
  syncMesh(truck.controller);
  g.police.heatValue = 2;
  g.police.heat = 2;
  g.police.cooldownTimer = 999;
  g.police.lastPlayer = g.player.pos.clone();
  g.police.pursuers.slice().forEach((p) => g.scene.remove(p.mesh));
  g.police.pursuers.length = 0;
  g.police.spawnPursuer(g.player.pos);
  const cop = g.police.pursuers[0];
  cop.controller.pos.copy(g.player.pos).addScaledVector(fwd, 18);
  cop.controller.pos.x += 6;
  cop.controller.pos.y = 0.35;
  cop.controller.heading = heading + Math.PI;
  syncMesh(cop.controller);
  g.city.setBeaconPosition(ex + 10, ez - 20);
  // Fleeing hands-up peds kept on dry sidewalks beside the road.
  g.crowd.peds.slice(0, 6).forEach((ped, i) => {
    const a = (i / 6) * Math.PI * 2;
    ped.pos.set(ex + Math.cos(a) * 10 + 24, 0, ez + Math.sin(a) * 10);
    ped.state = 'flee';
    ped.fleeTimer = 99;
    const j = ped.rig.userData.joints;
    if (j) {
      j.armL.shoulder.rotation.set(-2.6, 0, -0.5);
      j.armR.shoulder.rotation.set(-2.6, 0, 0.5);
    }
    ped.rig.position.copy(ped.pos);
    ped.rig.updateMatrixWorld(true);
  });
  g.hud.showDialogue('ELENA VEGA', 'Bahia crew, stand down — this cargo rides with us now.', 999);
  g.hud.setHint('[F] Hijack Boveda Armored · 1-4 weapons · G grenade', 999);
  settle(g, 0.35);
  const keyLight = new THREE.PointLight(0xffc98a, 320, 70, 1.6);
  keyLight.position.set(ex + 4, 9, ez - 8);
  g.scene.add(keyLight);
  const rimLight = new THREE.PointLight(0xff9e5a, 140, 50, 1.6);
  rimLight.position.set(ex - 6, 5, ez - 16);
  g.scene.add(rimLight);
  // Re-assert Elena's aim pose; muzzle flash + guard muzzle flashes last.
  g.player.pos.set(ex, 0, ez);
  g.player.mesh.position.copy(g.player.pos);
  g.player.mesh.rotation.set(0, heading, 0);
  if (g.player.mesh.userData.gunMesh) g.player.mesh.userData.gunMesh.visible = true;
  g.player.mesh.updateMatrixWorld(true);
  const shot = g.player.fireWeapon();
  if (shot) g.combat.fire(shot.from, shot.dir, 'player');
  // 3 crisp SHORT 1.3m tracer bolts mid-air ahead of Elena's barrel + sparks.
  const muzzle = g.player.pos.clone().addScaledVector(fwd, 1.2);
  muzzle.y = 1.38;
  for (let i = 0; i < 3; i += 1) {
    const from = muzzle.clone().addScaledVector(fwd, i * 1.5);
    const to = from.clone().addScaledVector(fwd, 1.3);
    g.combat.spawnTracer(from, to);
    g.combat.spawnSparks(to, 0xffe27a, 6);
  }
  for (const gd of g.combat.guards) {
    const hit = gd.pos.clone();
    hit.y = 1.2;
    g.combat.spawnSparks(hit, 0xffc44d, 6);
  }
  // 2 emerald cash stacks + cyan armor pickup staged on the road.
  g.combat.spawnPickup(ex + 4, ez - 12, 'cash', 250);
  g.combat.spawnPickup(ex - 3, ez - 14, 'cash', 180);
  g.combat.spawnPickup(ex + 1, ez - 11, 'armor', 25);
  g.scene.updateMatrixWorld(true);
  // TRUE parallel right-shoulder OTS: right = fwd x up = (-fwd.z, 0, fwd.x).
  const back = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const eye = g.player.pos.clone().addScaledVector(back, 3.3).addScaledVector(right, 0.95);
  eye.y = g.player.pos.y + 1.65;
  const look = g.player.pos.clone().addScaledVector(fwd, 13).addScaledVector(right, 0.95);
  look.y = g.player.pos.y + 1.35;
  g.camera.position.copy(eye);
  g.camera.lookAt(look);
  g.camera.fov = 55;
  g.camera.updateProjectionMatrix();
  g.camera.updateMatrixWorld(true);
  g.renderer.render(g.scene, g.camera);
  finish(g);
  return true;
}

// 'marina': 118 MPH speedboat run under the Flamingo Causeway, feathered wake only.
function stageMarina(g) {
  g.story.startChapter(3);
  g.story.cash = 12600;
  g.story.respect = 168;
  const from = { x: 232, z: -92 };
  const aimX = 272;
  const aimZ = -195;
  const heading = Math.atan2(-(aimX - from.x), -(aimZ - from.z));
  const boat = g.driveVehicle('marea_speedboat', from.x, from.z, heading);
  warmup(g, 1.4);
  boat.pos.set(from.x, 0.24, from.z);
  boat.heading = heading;
  boat.speed = 32.8; // 118 MPH
  boat.gear = 4;
  g.player.pos.copy(boat.pos);
  g.player.heading = heading;
  g.player.mesh.visible = false;
  syncMesh(boat);
  boat.mesh.position.y = 0.24;
  boat.mesh.updateMatrixWorld(true);
  // Feathered radial canvas wake only (the hull's own wake texture, boosted).
  boat.mesh.userData.wake.material.opacity = 0.78;
  boat.mesh.userData.wake.scale.set(1.2, 1.6, 1);
  g.city.setBeaconPosition(aimX, aimZ);
  g.story.refreshRoute();
  g.police.clearHeat();
  // PVPD Hawk low beside the causeway towers, fully in-frame with its beam.
  g.police.heatValue = 3;
  g.police.heat = 3;
  g.police.cooldownTimer = 999;
  g.police.lastPlayer = g.player.pos.clone();
  g.police.syncForces();
  if (g.police.heli) {
    g.police.heliPos.set(256, 13.5, -142);
    g.police.heli.position.copy(g.police.heliPos);
    g.police.heli.userData.cone.material.opacity = 0.3;
    g.police.heli.updateMatrixWorld(true);
  }
  settle(g, 0.4);
  syncMesh(boat);
  boat.mesh.position.y = 0.24;
  boat.mesh.userData.wake.material.opacity = 0.78;
  if (g.police.heli) {
    g.police.heliPos.set(256, 13.5, -142);
    g.police.heli.position.copy(g.police.heliPos);
    g.police.heli.updateMatrixWorld(true);
  }
  g.scene.updateMatrixWorld(true);
  // 9.2m back, 2.1m left, 3.3m up chase cam under the causeway.
  const back = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
  const right = new THREE.Vector3(-back.z, 0, back.x);
  const eye = boat.pos.clone().addScaledVector(back, 9.2).addScaledVector(right, -2.1);
  eye.y = boat.pos.y + 3.3;
  const look = boat.pos.clone().addScaledVector(forwardOf(heading), 14);
  look.y = 0.6;
  g.camera.position.copy(eye);
  g.camera.lookAt(look);
  g.camera.fov = 58;
  g.camera.updateProjectionMatrix();
  g.camera.updateMatrixWorld(true);
  g.renderer.render(g.scene, g.camera);
  g.hud.showDialogue('ELENA VEGA', 'Tidebreaker Run — full throttle under the Causeway!', 999);
  g.hud.setHint('Marea Speedboat · SHIFT nitro · follow the gold GPS line', 999);
  finish(g);
  return true;
}

// 'map': Split Command Deck + live Coral Avenue sunset showroom on the right.
function stageMap(g) {
  g.story.startChapter(1);
  g.story.cash = 24850;
  g.story.respect = 210;
  g.story.chapterIndex = 3;
  g.story.objectiveIndex = 1;
  // Showcase trio + Elena on the RIGHT half: open Coral Avenue, palms + Mariposa behind.
  g.traffic.parkCar('veloce_gt', -431, 170, Math.PI / 8, 0xffc44d);
  g.traffic.parkCar('brisa_cabrio', -433, 166, Math.PI / 8, 0x38e8ff);
  g.traffic.parkCar('veloce_gt', -435, 162, Math.PI / 8, 0xff5a4e);
  g.player.teleport(-433, 174, Math.PI);
  g.player.mesh.visible = true;
  g.player.mesh.position.copy(g.player.pos);
  g.player.mesh.rotation.set(0, Math.PI, 0);
  g.player.mesh.updateMatrixWorld(true);
  g.city.setBeaconPosition(-330, 210);
  g.story.refreshRoute();
  try {
    g.saves.snapshot(1, g.story, g.player, { cover: true });
  } catch { /* menu still renders without storage */ }
  warmup(g, 1.0);
  g.scene.updateMatrixWorld(true);
  // Wide open avenue: palms, Hotel Mariposa + sunset skyline behind the trio.
  g.camera.position.set(-446, 2.5, 184);
  g.camera.lookAt(new THREE.Vector3(-431, 2.8, 154));
  g.camera.fov = 58;
  g.camera.updateProjectionMatrix();
  g.camera.updateMatrixWorld(true);
  g.renderer.render(g.scene, g.camera);
  g.hud.setMenuOpen(true);
  g.hud.chapterListState(g.story.chapterIndex);
  g.renderHud();
  g.hud.drawWorldMap({
    x: g.player.pos.x, z: g.player.pos.z,
    route: g.story.route, target: g.story.missionTarget,
  });
  const badge = document.getElementById('save-badge');
  if (badge) badge.textContent = 'Slot 1: Ch.4 · $24,850 · Saved';
  g.renderer.render(g.scene, g.camera);
  g.renderer.render(g.scene, g.camera);
  window.__SHOT_READY = true;
  return true;
}

export { createSeededRandom };
