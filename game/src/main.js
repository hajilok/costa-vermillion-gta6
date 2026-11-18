// Costa Vermillion: Sunset Syndicate — live entry point.
// Gameplay modules first, sceneShots.js last. Wires renderer, controllers,
// input, fixed-step simulation, HUD and the ?shot= staging hook.

import * as THREE from '../vendor/three.module.min.js';
import { createSeededRandom, streetNameAt, districtAt } from './cityConfig.js';
import { buildCoastalCityWorld } from './cityBuilder.js';
import { VehiclePhysicsController, createVehicleMesh } from './vehicleSystem.js';
import { WantedAndPoliceDirector } from './wantedAndPolice.js';
import { PlayerCharacterController, PedestrianCrowdManager } from './playerAndPeds.js';
import { CityTrafficManager } from './trafficSystem.js';
import { CombatAndWeaponsManager } from './combatSystem.js';
import { StoryCampaignManager, SaveGameManager } from './storyAndMissions.js';
import { HudAndRadarController } from './hudAndMap.js';
import { WebAudioEngineAndRadio } from './audioAndRadio.js';
import { DynamicCameraController } from './cameraRig.js';
import { stageScreenshotScenario } from './sceneShots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;
const rng = createSeededRandom(seed);

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.16;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth || 1280, window.innerHeight || 720);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1280 / 720, 0.1, 4000);
camera.position.set(-435.5, 2.45, 201.5);

const world = buildCoastalCityWorld(scene, rng);
const traffic = new CityTrafficManager(scene, rng);
traffic.spawnAll();
const police = new WantedAndPoliceDirector(scene);
const player = new PlayerCharacterController(scene, { jacket: 0xff5f6d, x: -415, z: 120 });
const peds = new PedestrianCrowdManager(scene, rng);
peds.spawn(24);
const combat = new CombatAndWeaponsManager(scene);
combat.setCamera(camera);
const story = new StoryCampaignManager();
const saves = new SaveGameManager();
const hud = new HudAndRadarController();
hud.grab();
const audio = new WebAudioEngineAndRadio();
const camRig = new DynamicCameraController(camera);

const game = {
  renderer,
  scene,
  camera,
  rng,
  world,
  traffic,
  police,
  player,
  peds,
  combat,
  story,
  saves,
  hud,
  audio,
  camRig,
  vehicle: null,
  vehicleMesh: null,
  vehiclePhys: null,
  mode: 'foot',
  health: 100,
  activeChar: 'ELENA VEGA',
  aiming: false,
  paused: false,
  clockMin: 18 * 60 + 42,
  weaponSlot: 0,
  dialogue: { speaker: 'ELENA VEGA', line: 'Welcome to Puerto Vermillion.' },
  driveVehicle,
  exitVehicle,
  stepFrame,
  renderHud,
};

function paintBody(mesh, hex) {
  if (hex === undefined || hex === null) return;
  const body = mesh.children[0];
  if (body && body.material && body.material.color) {
    body.material = body.material.clone();
    body.material.color.setHex(hex);
  }
}

function driveVehicle(specId, x, z, heading, paintHex) {
  if (game.vehicleMesh && game.scene) game.scene.remove(game.vehicleMesh);
  const mesh = createVehicleMesh(specId);
  paintBody(mesh, paintHex);
  const spec = VehiclePhysicsController.specById(specId);
  const phys = new VehiclePhysicsController(spec);
  phys.x = x;
  phys.z = z;
  phys.heading = heading || 0;
  phys.speed = 0;
  mesh.position.set(x, mesh.position.y, z);
  mesh.rotation.y = phys.heading;
  game.scene.add(mesh);
  game.vehicleMesh = mesh;
  game.vehiclePhys = phys;
  game.vehicle = spec;
  game.mode = spec.kind === 'boat' ? 'boat' : 'drive';
  player.rig.visible = false;
  player.x = x;
  player.z = z;
  player.heading = heading || 0;
  return mesh;
}

function exitVehicle() {
  if (!game.vehicleMesh) return;
  const px = player.x + Math.cos(player.heading) * 2.5;
  const pz = player.z - Math.sin(player.heading) * 2.5;
  player.x = px;
  player.z = pz;
  player.rig.visible = true;
  player.syncMesh(0);
  game.mode = 'foot';
}

function nearestCar(x, z, maxDist) {
  let best = null;
  let bestDist = maxDist;
  for (const car of traffic.cars) {
    const d = Math.hypot(car.phys.x - x, car.phys.z - z);
    if (d < bestDist) {
      bestDist = d;
      best = car;
    }
  }
  return best;
}

const keys = Object.create(null);

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  audio.ensure();
  if (e.code === 'Digit1') { combat.switchTo(0); game.weaponSlot = 0; }
  if (e.code === 'Digit2') { combat.switchTo(1); game.weaponSlot = 1; }
  if (e.code === 'Digit3') { combat.switchTo(2); game.weaponSlot = 2; }
  if (e.code === 'Digit4') { combat.switchTo(3); game.weaponSlot = 3; }
  if (e.code === 'KeyM') hud.setMenuOpen(!hud.menuOpen);
  if (e.code === 'KeyC') swapCrew();
  if (e.code === 'KeyP' || e.code === 'Escape') game.paused = !game.paused;
  if (e.code === 'KeyR') audio.nextStation();
  if (e.code === 'Enter' && hud.menuOpen) hud.setMenuOpen(false);
  if (e.code === 'KeyE') {
    if (game.mode === 'foot') {
      const car = nearestCar(player.x, player.z, 5);
      if (car) {
        traffic.cars.splice(traffic.cars.indexOf(car), 1);
        if (game.scene) game.scene.remove(car.mesh);
        driveVehicle(car.phys.spec.id, car.phys.x, car.phys.z, car.phys.heading);
      }
    } else {
      exitVehicle();
    }
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

let mouseAim = false;
let mouseFire = false;
canvas.addEventListener('mousedown', (e) => {
  audio.ensure();
  if (e.button === 2) mouseAim = true;
  if (e.button === 0) mouseFire = true;
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 2) mouseAim = false;
  if (e.button === 0) mouseFire = false;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function swapCrew() {
  game.activeChar = game.activeChar === 'ELENA VEGA' ? 'MATEO CRUZ' : 'ELENA VEGA';
  hud.setDialogue(game.activeChar, game.activeChar === 'ELENA VEGA' ? 'My city now. Follow my line.' : 'Watch and learn, Vega.');
}

function readDriveInput() {
  const throttle = (keys.KeyW || keys.ArrowUp ? 1 : 0) + (keys.KeyS || keys.ArrowDown ? -0.6 : 0);
  const steer = (keys.KeyA || keys.ArrowLeft ? 1 : 0) + (keys.KeyD || keys.ArrowRight ? -1 : 0);
  return {
    throttle,
    steer,
    nitro: !!keys.ShiftLeft || !!keys.ShiftRight,
    handbrake: !!keys.Space,
  };
}

function readFootInput() {
  let mx = 0;
  let mz = 0;
  if (keys.KeyW || keys.ArrowUp) mz += 1;
  if (keys.KeyS || keys.ArrowDown) mz -= 1;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1;
  if (keys.KeyD || keys.ArrowRight) mx += 1;
  const len = Math.hypot(mx, mz) || 1;
  return {
    moveX: (mx / len) * (mx || mz ? 1 : 0),
    moveZ: (mz / len) * (mx || mz ? 1 : 0),
    sprint: !!keys.ShiftLeft || !!keys.ShiftRight,
    aim: mouseAim || !!keys.KeyF,
  };
}

function stepFrame(dt, t) {
  if (game.mode === 'foot') {
    const input = readFootInput();
    player.step(input, dt, t);
    game.aiming = input.aim;
    if (mouseFire && input.aim && game.health > 0) {
      const shot = player.fireWeapon();
      const res = combat.fire(shot.origin, shot.dir);
      if (res) {
        audio.gunfire(combat.currentSpec().kind === 'pellet' ? 'pellet' : 'auto');
        camRig.addShake(0.15);
      }
      mouseFire = false;
    }
  } else if (game.vehiclePhys && game.vehicleMesh) {
    const input = readDriveInput();
    game.vehiclePhys.update(input, dt);
    game.vehicleMesh.position.set(game.vehiclePhys.x, game.vehicleMesh.position.y, game.vehiclePhys.z);
    game.vehicleMesh.rotation.y = game.vehiclePhys.heading;
    if (game.vehicleMesh.userData.setSmoke) {
      game.vehicleMesh.userData.setSmoke(game.vehiclePhys.drifting ? 0.2 : 0);
    }
    if (game.vehicleMesh.userData.setNitro) {
      game.vehicleMesh.userData.setNitro(input.nitro && input.throttle > 0);
    }
    player.x = game.vehiclePhys.x;
    player.z = game.vehiclePhys.z;
    player.heading = game.vehiclePhys.heading;
    audio.engine(Math.abs(game.vehiclePhys.speed) / game.vehiclePhys.spec.topSpeed, input.nitro);
    if (game.vehiclePhys.drifting) audio.driftScreech(0.6);
  }
  traffic.update(dt);
  peds.update(dt);
  police.syncForces({ x: player.x, z: player.z }, dt);
  combat.update(dt, { x: player.x, z: player.z });
  story.update(dt);
  world.updateWorldVisuals(t, dt);
  audio.updateRadio(dt);
  audio.siren(police.stars > 0 && Math.floor(t) % 4 === 0);
  if (!shotName) game.clockMin += dt * 0.5;

  const focus = { x: player.x, z: player.z, heading: player.heading };
  const mode = game.mode === 'foot' ? (game.aiming ? 'foot' : 'foot') : game.mode;
  camRig.update(focus, { mode: game.mode === 'foot' ? 'foot' : game.mode, aiming: game.aiming });
  void mode;
}

function clockString() {
  const h = Math.floor(game.clockMin / 60) % 24;
  const m = Math.floor(game.clockMin % 60);
  return `FRI ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function renderHud() {
  const playerPos = { x: player.x, z: player.z };
  const chapter = story.currentChapter();
  hud.setBanner(
    `CHAPTER ${chapter.no}: ${chapter.title.toUpperCase()}`,
    `STAGE ${story.stage + 1} / 3 — ${chapter.title}`,
    story.stage / 3
  );
  const rows = police.tacticalUnits(playerPos);
  hud.setPursuit(rows);
  const spec = combat.currentSpec();
  hud.setStatus({
    clock: clockString(),
    cash: story.cash,
    stars: police.stars,
    wantedLabel: police.wantedLabel(),
    respect: story.respectTitle(),
    weaponName: spec.name.toUpperCase(),
    weaponAmmo: `${combat.mag[spec.id]} / ${combat.ammo[spec.id]}`,
    radio: audio.currentStation(),
    district: districtAt(player.x, player.z).name,
    street: streetNameAt(player.x, player.z),
    health: game.health,
    armor: story.armor,
    speed: game.mode === 'foot' ? Math.abs(player.speed) * 2.2 : Math.abs((game.vehiclePhys ? game.vehiclePhys.speed : 0) * 3.6),
    vehicle: game.mode === 'foot' ? 'ON FOOT' : game.vehicle.name.toUpperCase(),
    aiming: game.aiming,
  });
  const cops = police.pursuers.map((p) => ({ x: p.x ?? player.x, z: p.z ?? player.z, kind: p.kind || 'car' }));
  if (police.heli && police.heli.visible) {
    cops.push({ x: police.heli.position.x, z: police.heli.position.z, kind: 'heli' });
  }
  const target = story.chapterLocation(chapter);
  hud.drawMinimap(playerPos, player.heading, story.gpsRoute, cops, target);
  if (hud.menuOpen) {
    hud.drawWorldMap(playerPos, story.gpsRoute, cops, target, null, story.chapterIndex);
  }
}

function runGame() {
  story.refreshGps({ x: player.x, z: player.z });
  hud.setDialogue(game.dialogue.speaker, game.dialogue.line);
  let last = performance.now();
  let acc = 0;
  const STEP = 1 / 60;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    if (!game.paused && !hud.menuOpen) {
      acc += dt;
      while (acc >= STEP) {
        stepFrame(STEP, now / 1000);
        acc -= STEP;
      }
    }
    renderHud();
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}

window.__SHOT_READY = false;
window.__game = game;

if (shotName) {
  story.refreshGps({ x: player.x, z: player.z });
  stageScreenshotScenario(shotName, game);
  renderHud();
  let painted = 0;
  function paintShot() {
    renderHud();
    renderer.render(scene, camera);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paintShot);
    else window.__SHOT_READY = true;
  }
  requestAnimationFrame(paintShot);
} else {
  runGame();
}
