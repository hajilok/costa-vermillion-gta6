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

// Lock the camera explicitly behind a heading: dist back, height up, look-ahead.
function lockCamera(g, targetPos, heading, dist, height, lookAhead = 7, fov = 62) {
  const back = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
  g.camera.position.copy(targetPos).addScaledVector(back, dist);
  g.camera.position.y = Math.max(1.8, targetPos.y + height);
  const look = targetPos.clone().addScaledVector(back, -lookAhead);
  look.y = targetPos.y + 1.4;
  g.camera.lookAt(look);
  g.camera.fov = fov;
  g.camera.updateProjectionMatrix();
  g.camera.updateMatrixWorld(true);
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

// 'cover': Elena drifts a coral Veloce GT straight down the open westernmost
// coastal avenue (avenues[0], beside the beach), -Z vista: ocean + umbrellas
// left, Mariposa + pastel towers right, sun disc ahead, 2 strobing Interceptors
// 7m left-rear + 11m right-rear, 3 traffic cars ahead, drift smoke + cyan nitro,
// Hawk heli 15m up / 28m ahead with a bright road cone.
function stageCover(g) {
  g.story.startChapter(3);
  g.story.cash = 18450;
  g.story.respect = 210;
  // Dead-center of ROAD_NETWORK.avenues[0] (x=-440), physics heading straight
  // down the open avenue corridor (-Z => heading 0). Drift yaw lives on the MESH
  // only; physics/camera use heading 0 so the 900m vista stays building-free.
  const heading = 0;
  const car = g.driveVehicle('veloce_gt', -440, 190, heading, 0xff5a4e);
  warmup(g, 1.4);
  car.pos.set(-440, 0.35, 190);
  car.heading = heading;
  car.speed = 41; // ~148 KM/H
  car.gear = 5;
  car.nitro = 0.45;
  car.nitroActive = true;
  car.handbrake = true;
  car.steer = 0.45;
  g.player.pos.set(-440, 0, 190);
  g.player.heading = heading;
  g.player.mesh.visible = false;
  car.mesh.position.copy(car.pos);
  car.mesh.rotation.set(0, heading + 0.14, 0); // mesh-only drift yaw
  car.mesh.updateMatrixWorld(true);
  car.spawnDriftSmoke(1 / 60, true);
  car.spawnDriftSmoke(1 / 60, true);
  car.spawnDriftSmoke(1 / 60, false, 0x38e8ff); // cyan nitro exhaust flames
  car.spawnDriftSmoke(1 / 60, false, 0x38e8ff);
  // 2 strobing PVPD Interceptors visibly chasing 7m left-rear + 11m right-rear.
  g.police.heatValue = 4;
  g.police.heat = 4;
  g.police.cooldownTimer = 999;
  g.police.lastPlayer = g.player.pos.clone();
  g.police.pursuers.slice().forEach((p) => g.scene.remove(p.mesh));
  g.police.pursuers.length = 0;
  g.police.spawnPursuer(g.player.pos);
  g.police.spawnPursuer(g.player.pos);
  const fwd = forwardOf(heading);
  g.police.pursuers.forEach((p, i) => {
    const back = i === 0 ? 7 : 11;
    const lane = i === 0 ? -3.2 : 3.2;
    p.controller.pos.copy(car.pos).addScaledVector(fwd, -back);
    p.controller.pos.x += lane;
    p.controller.pos.y = 0.35;
    p.controller.heading = heading;
    p.controller.speed = 36;
    p.controller.gear = i === 0 ? 5 : 4;
    syncMesh(p.controller);
  });
  g.police.syncForces();
  // 3 traffic cars ahead in the lanes down the open avenue (no roadblocks ahead).
  const lanes = [
    { dx: -3.2, ahead: 26, spec: 'brisa_cabrio' },
    { dx: 3.2, ahead: 38, spec: 'dune_titan' },
    { dx: 0.4, ahead: 56, spec: 'sol_moto' },
  ];
  for (const L of lanes) {
    const v = g.traffic.spawnTrafficVehicle(true, L.spec, {
      x: car.pos.x + L.dx, z: car.pos.z, heading,
      road: { kind: 'avenue', id: 'ave_coral' }, dir: 1,
    });
    v.ai = null; // hold formation for the frame
    v.controller.pos.set(car.pos.x + L.dx, 0.35, car.pos.z).addScaledVector(fwd, L.ahead);
    v.controller.heading = heading;
    v.controller.speed = 18;
    syncMesh(v.controller);
  }
  // Hawk helicopter hovering 15m up + 28m ahead in open sky, cone onto the road.
  if (!g.police.heli) g.police.syncForces();
  if (g.police.heli) {
    const hp = car.pos.clone().addScaledVector(fwd, 28);
    hp.y = car.pos.y + 15;
    g.police.heliPos.copy(hp);
    g.police.heli.position.copy(hp);
    g.police.heli.rotation.y = Math.atan2(-(car.pos.x - hp.x), -(car.pos.z - hp.z));
    g.police.heli.userData.cone.material.opacity = 0.34;
    g.police.heli.userData.cone.scale.set(1.4, 1.4, 1.4);
    g.police.heli.updateMatrixWorld(true);
    // Beacon 120m ahead down ave_coral — never on top of the hero car.
    g.city.setBeaconPosition(-440, 70);
  }
  g.hud.showDialogue('MATEO CRUZ', 'Elena, the Keys run starts now — lose them on the Promenade!', 999);
  g.hud.setHint('Drift: SPACE · Nitro: SHIFT · Wanted ★★★★', 999);
  settle(g, 0.4);
  // Re-assert hero blocking after the settle (mesh-only drift yaw again),
  // then lock camera down the open avenue (no cameraRig overwrite).
  car.pos.set(-440, 0.35, 190);
  car.heading = heading;
  car.mesh.position.copy(car.pos);
  car.mesh.rotation.set(0, heading + 0.14, -0.06);
  car.mesh.updateMatrixWorld(true);
  car.spawnDriftSmoke(1 / 60, true);
  car.spawnDriftSmoke(1 / 60, false, 0x38e8ff);
  g.police.pursuers.forEach((p) => syncMesh(p.controller));
  g.scene.updateMatrixWorld(true);
  lockCamera(g, car.pos, heading, 9.5, 3.3, 9, 64);
  g.renderer.render(g.scene, g.camera);
  finish(g);
  return true;
}

// 'combat': over-shoulder SMG aim vs 4 guards by a Boveda truck (13m) + cruiser (19m).
function stageCombat(g) {
  g.story.startChapter(2);
  g.story.cash = 9200;
  g.story.respect = 120;
  // Busy paved downtown intersection (Central Ave x Vermillion Blvd).
  const ex = -60;
  const ez = -40;
  const heading = Math.PI * 0.85;
  g.player.teleport(ex, ez, heading);
  g.player.aiming = true;
  g.combat.selectWeapon('coral_smg');
  warmup(g, 1.2);
  g.player.pos.set(ex, 0, ez);
  g.player.heading = heading;
  g.player.mesh.position.copy(g.player.pos);
  g.player.mesh.rotation.set(0, heading, 0);
  // 4 syndicate guards in a visible arc 8–12m ahead of Elena.
  g.combat.guards.slice().forEach((gd) => g.scene.remove(gd.rig));
  g.combat.guards.length = 0;
  g.combat.spawnGuardSquad(ex + 6, ez - 14, 4, 6);
  const fwd = forwardOf(heading);
  g.combat.guards.forEach((gd, i) => {
    const off = (i - 1.5) * 3.2;
    gd.pos.copy(g.player.pos).addScaledVector(fwd, 9 + (i % 2) * 3);
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
  // Boveda armored truck broadside 13m ahead; strobing cruiser 19m ahead-left.
  const truck = g.traffic.vehicles.find((v) => v.specId === 'boveda_armored' && v.parked)
    || g.traffic.spawnTrafficVehicle(true, 'boveda_armored', { x: ex, z: ez, heading, road: { kind: 'boulevard', id: 'blvd_vermillion' }, dir: 1 });
  truck.ai = null;
  truck.controller.pos.copy(g.player.pos).addScaledVector(fwd, 13);
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
  cop.controller.pos.copy(g.player.pos).addScaledVector(fwd, 19);
  cop.controller.pos.x -= 4;
  cop.controller.pos.y = 0.35;
  cop.controller.heading = heading + Math.PI;
  syncMesh(cop.controller);
  g.city.setBeaconPosition(ex + 10, ez - 20);
  // 6 fleeing pedestrians with raised arms around the firefight.
  g.crowd.peds.slice(0, 6).forEach((ped, i) => {
    const a = (i / 6) * Math.PI * 2;
    ped.pos.set(ex + Math.cos(a) * 9, 0, ez + Math.sin(a) * 9);
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
  // Warm golden street light over the intersection: Elena + truck + cruiser
  // + guards all vividly lit for the frame.
  const keyLight = new THREE.PointLight(0xffc98a, 320, 70, 1.6);
  keyLight.position.set(ex + 4, 9, ez - 8);
  g.scene.add(keyLight);
  const rimLight = new THREE.PointLight(0xff9e5a, 140, 50, 1.6);
  rimLight.position.set(ex - 6, 5, ez - 16);
  g.scene.add(rimLight);
  // Re-assert Elena + fire a live burst LAST: muzzle flash + 4 thick hero
  // tracer beams + spark bursts flying at the guards, unmissable in frame.
  g.player.pos.set(ex, 0, ez);
  g.player.mesh.position.copy(g.player.pos);
  g.player.mesh.rotation.set(0, heading, 0);
  g.player.mesh.updateMatrixWorld(true);
  const burst = [g.player.fireWeapon(), g.player.fireWeapon(), g.player.fireWeapon(), g.player.fireWeapon()]
    .filter(Boolean);
  for (const s of burst) g.combat.fire(s.from, s.dir, 'player');
  // 4 sleek rifle tracers: thin emissive cores starting at the SMG muzzle in
  // front of Elena (never overlapping her torso), one per guard, + spark bursts.
  const muzzleBase = g.player.pos.clone().addScaledVector(fwd, 0.9);
  muzzleBase.y = 1.45;
  g.combat.guards.forEach((gd, i) => {
    const from = muzzleBase.clone();
    from.x += -fwd.z * (i - 1.5) * 0.35;
    from.z += fwd.x * (i - 1.5) * 0.35;
    const to = gd.pos.clone();
    to.y = 1.1;
    const len = Math.max(1, from.distanceTo(to));
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, len),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffb02e : 0xffe27a }),
    );
    beam.position.copy(from).lerp(to, 0.5);
    beam.lookAt(to);
    g.scene.add(beam);
    const halo = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.14, len),
      new THREE.MeshBasicMaterial({ color: 0xff7a1e, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    halo.position.copy(beam.position);
    halo.lookAt(to);
    g.scene.add(halo);
    g.combat.spawnSparks(to, 0xffc44d, 14);
    g.combat.spawnSparks(to, 0xfff3d6, 8);
  });
  g.scene.updateMatrixWorld(true);
  lockCamera(g, g.player.pos, heading, 4.2, 2.0, 10, 58);
  g.renderer.render(g.scene, g.camera);
  finish(g);
  return true;
}

// 'marina': 10m behind / 3.8m above the speedboat, causeway + beacon dead ahead.
function stageMarina(g) {
  g.story.startChapter(3);
  g.story.cash = 12600;
  g.story.respect = 168;
  // Vermillion Bay water (clear of ave_bahia x=300 and ave_torre x=120),
  // bow aimed under the Flamingo Causeway so the bridge fills the frame.
  const from = { x: 225, z: -85 };
  const aimX = 265;
  const aimZ = -185;
  const heading = Math.atan2(-(aimX - from.x), -(aimZ - from.z));
  const boat = g.driveVehicle('marea_speedboat', from.x, from.z, heading);
  warmup(g, 1.4);
  boat.pos.set(from.x, 0.35, from.z);
  boat.heading = heading;
  boat.speed = 30;
  boat.gear = 4;
  g.player.pos.copy(boat.pos);
  g.player.heading = heading;
  g.player.mesh.visible = false;
  syncMesh(boat);
  boat.mesh.position.y = 0.35;
  boat.mesh.updateMatrixWorld(true);
  // Bright white V-wake foam + tall glowing beacon dead ahead on the bay.
  boat.mesh.userData.wake.material.opacity = 0.9;
  boat.mesh.userData.wake.scale.set(1.2, 1.6, 1);
  const wake2 = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 9),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }),
  );
  wake2.rotation.x = -Math.PI / 2;
  wake2.position.set(from.x, 0.14, from.z).addScaledVector(forwardOf(heading), -7.5);
  g.scene.add(wake2);
  g.city.setBeaconPosition(aimX, aimZ);
  g.story.refreshRoute();
  g.police.clearHeat();
  settle(g, 0.4);
  syncMesh(boat);
  boat.mesh.position.y = 0.35;
  boat.mesh.userData.wake.material.opacity = 0.9;
  boat.mesh.updateMatrixWorld(true);
  wake2.position.set(boat.pos.x, 0.14, boat.pos.z).addScaledVector(forwardOf(boat.heading), -7.5);
  wake2.updateMatrixWorld(true);
  g.scene.updateMatrixWorld(true);
  lockCamera(g, boat.pos, heading, 10, 3.8, 16, 60);
  g.renderer.render(g.scene, g.camera);
  g.hud.showDialogue('ELENA VEGA', 'Tidebreaker Run — full throttle under the Causeway!', 999);
  g.hud.setHint('Marea Speedboat · SHIFT nitro · follow the gold GPS line', 999);
  finish(g);
  return true;
}

// 'map': elevated panoramic sunset skyline behind the open 2-column menu.
function stageMap(g) {
  g.story.startChapter(1);
  g.story.cash = 18450;
  g.story.respect = 210;
  g.story.chapterIndex = 3;
  g.story.objectiveIndex = 1;
  g.player.teleport(-300, 150, Math.PI * 1.2);
  g.city.setBeaconPosition(-330, 210);
  g.story.refreshRoute();
  try {
    g.saves.snapshot(1, g.story, g.player, { cover: true });
  } catch { /* menu still renders without storage */ }
  warmup(g, 1.0);
  g.scene.updateMatrixWorld(true);
  // Elevated panoramic camera: menu glass over a live golden-hour skyline.
  const eye = new THREE.Vector3(-380, 72, 300);
  g.camera.position.copy(eye);
  g.camera.lookAt(new THREE.Vector3(60, 28, -120));
  g.camera.fov = 55;
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
  if (badge) badge.textContent = 'Slot 1: Ch.4 · $18,450 · Saved';
  g.renderer.render(g.scene, g.camera);
  g.renderer.render(g.scene, g.camera);
  window.__SHOT_READY = true;
  return true;
}

export { createSeededRandom };
