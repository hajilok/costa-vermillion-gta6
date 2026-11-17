// Costa Vermillion: Sunset Syndicate — browser entrypoint: renderer, systems, loop.
// Offline: imports only 'three' + sibling ./ modules via the index.html import map.
// 100% original content. No Rockstar / GTA content.
// ?shot=cover|combat|marina|map (&seed=N) stages a deterministic screenshot scene.
import * as THREE from 'three';
import { createSeededRandom, districtAt, isWater, landmarkById } from './cityConfig.js';
import { buildCoastalCityWorld } from './cityBuilder.js';
import { VehiclePhysicsController, createVehicleMesh } from './vehicleSystem.js';
import { PedestrianCrowdManager, PlayerCharacterController, createCharacterRig } from './playerAndPeds.js';
import { CityTrafficManager } from './trafficSystem.js';
import { WantedAndPoliceDirector } from './wantedAndPolice.js';
import { CombatAndWeaponsManager } from './combatSystem.js';
import { SaveGameManager, StoryCampaignManager } from './storyAndMissions.js';
import { DynamicCameraController } from './cameraRig.js';
import { HudAndRadarController } from './hudAndMap.js';
import { WebAudioEngineAndRadio } from './audioAndRadio.js';
import { stageScreenshotScenario } from './sceneShots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const rng = createSeededRandom(seed);

// Renderer: golden-hour ACES tone mapping + soft shadows.
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 4000);
const city = buildCoastalCityWorld(scene, rng);

// Elena Vega on foot.
const elenaRig = createCharacterRig({ skin: 0xf2c49b, top: 0xff5a4e, bottom: 0x274060, hair: 0x2a1a12, female: true });
const player = new PlayerCharacterController(scene, elenaRig);
player.teleport(-400, 20, Math.PI);

// Living city: crowds, traffic, police, combat, story, HUD, radio.
const crowd = new PedestrianCrowdManager(scene, rng, 48);
const traffic = new CityTrafficManager(scene, rng, city.colliders, 28);
const police = new WantedAndPoliceDirector(scene, rng, city.colliders);
const combat = new CombatAndWeaponsManager(scene, rng, {
  player, crowd, police, traffic, colliders: city.colliders,
  onVehicleHit: (v, dmg) => {
    const c = v.controller || v;
    if (c && typeof c.damage === 'number') c.damage = Math.min(1, c.damage + dmg * 0.01);
    crowd.panicAt(c.pos.x, c.pos.z, 36);
    police.addHeat(0.35);
  },
});
const story = new StoryCampaignManager({ city });
const saves = new SaveGameManager('sunset');
const hud = new HudAndRadarController({
  onResume: () => hud.setMenuOpen(false),
  onNewGame: () => {
    story.startChapter(0);
    story.cash = 1250;
    story.respect = 10;
    player.teleport(-400, 20, Math.PI);
    police.clearHeat();
    hud.setMenuOpen(false);
  },
  onSave: (slot) => {
    saves.snapshot(slot, story, player);
    hud.setHint(`Progress saved to Slot ${slot}`, 3);
  },
  onLoad: (slot) => {
    const data = saves.load(slot);
    if (data?.story) story.setState(data.story);
    if (data?.player) {
      player.teleport(data.player.x, data.player.z, data.player.heading || 0);
      player.health = data.player.health ?? 100;
      player.armor = data.player.armor ?? 50;
    }
    hud.setMenuOpen(false);
    hud.setHint(`Slot ${slot} loaded`, 3);
  },
});
const cam = new DynamicCameraController(camera);
const audio = new WebAudioEngineAndRadio();
story.onDialogue = (speaker, line) => hud.showDialogue(speaker, line, 7);
story.startChapter(0);
story.refreshRoute();

// Player-driven vehicle controllers (carjacked or staged), with particle pools.
const driven = new Set();
function driveVehicle(specId, x, z, heading = 0, colorOverride) {
  let entry = traffic.vehicles.find((v) => v.specId === specId && v.hijacked && v.controller.specId === specId);
  if (entry) traffic.removeVehicle(entry);
  const mesh = createVehicleMesh(specId, colorOverride);
  const controller = new VehiclePhysicsController(mesh, specId, city.colliders);
  controller.ensureParticlePool(scene);
  controller.reset(x, z, heading);
  scene.add(mesh);
  driven.add(controller);
  entry = { mesh, controller, specId, parked: false, hijacked: true, aiLocked: false, ai: null };
  traffic.vehicles.push(entry);
  player.inVehicle = controller;
  player.mesh.visible = false;
  player.enterCooldown = 0;
  return controller;
}

// Shared keyboard/mouse gameplay state.
const keys = new Set();
let mouseDown = false;
let paused = false;
let elapsed = 0;
window.addEventListener('keydown', (e) => {
  audio.ensure();
  keys.add(e.code);
  if (e.code === 'Escape') {
    hud.setMenuOpen(!hud.menuOpen);
    paused = hud.menuOpen;
  }
  if (e.code === 'KeyM') hud.setMenuOpen(!hud.menuOpen);
  if (e.code === 'KeyR' && !player.onFoot) audio.nextStation();
  if (e.code === 'KeyT') audio.nextStation();
  if (e.code === 'Digit1') combat.selectWeapon('viper_pistol');
  if (e.code === 'Digit2') combat.selectWeapon('coral_smg');
  if (e.code === 'Digit3') combat.selectWeapon('breacher_shotgun');
  if (e.code === 'Digit4') combat.selectWeapon('pulse_grenade');
  if (e.code === 'KeyF' && !shotName) toggleVehicle();
  if (e.code === 'KeyE' && !shotName) interact();
  if (e.code === 'KeyG' && !shotName) throwGrenade();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('mousedown', (e) => {
  audio.ensure();
  if (e.button === 0) mouseDown = true;
  if (e.button === 2) player.aiming = true;
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouseDown = false;
  if (e.button === 2) player.aiming = false;
});
window.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas) cam.addMouse(e.movementX, e.movementY);
});
canvas.addEventListener('click', () => {
  audio.ensure();
  if (!shotName && !hud.menuOpen && canvas.requestPointerLock) {
    try { canvas.requestPointerLock(); } catch { /* pointer lock optional */ }
  }
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function toggleVehicle() {
  if (!player.onFoot) {
    const ctrl = player.inVehicle;
    if (player.exitVehicle() && ctrl) {
      const entry = traffic.vehicles.find((v) => v.controller === ctrl);
      if (entry) traffic.release(entry);
    }
    return;
  }
  const near = traffic.nearestStealable(player.pos, 6);
  if (near) {
    const ctrl = traffic.hijack(near);
    if (ctrl && player.tryEnterVehicle({ controller: ctrl })) {
      driven.add(ctrl);
      player.inVehicle = ctrl;
      player.mesh.visible = false;
      hud.setHint(`${ctrl.spec.label || ctrl.specId} hijacked — drive!`, 3);
      police.addHeat(ctrl.spec.police ? 1.5 : 0.6);
      crowd.panicAt(player.pos.x, player.pos.z, 30);
    }
  }
}

function interact() {
  const svc = story.serviceAt(player.pos.x, player.pos.z);
  if (svc?.kind === 'garage') {
    const r = story.garageService(player, police);
    hud.setHint(r.ok ? 'Coral Mod Garage: respray + repair + heat cleared' : r.reason, 3);
  } else if (svc?.kind === 'armory') {
    const r = story.armoryService(player, combat);
    hud.setHint(r.ok ? 'Harbor Armory: armor + ammo restocked' : r.reason, 3);
  } else {
    const done = story.pumpDialogue();
    if (!done) hud.setHint('Elena Vega: follow the gold GPS line', 3);
  }
}

function throwGrenade() {
  if (player.onFoot && !player.dead) {
    const s = player.fireWeapon();
    if (s) {
      const prev = combat.current;
      combat.selectWeapon('pulse_grenade');
      combat.throwPulseGrenade(s.from, s.dir);
      combat.selectWeapon(prev);
      audio.gunfire('pulse_grenade');
    }
  }
}

// Fixed-step frame used by both the live loop and deterministic ?shot= staging.
function stepFrame(dt, silent = false) {
  elapsed += dt;
  const driving = !player.onFoot && player.inVehicle;
  // Mission beacon + water + lamps follow the player.
  city.updateWorldVisuals(dt, elapsed, player.pos);
  crowd.update(dt, player.pos);
  traffic.update(dt, player.pos, player);
  police.update(dt, player.pos, player, elapsed);
  combat.update(dt);
  if (!silent) {
    const speed = driving ? Math.abs(player.inVehicle.speed) : 0;
    audio.update(dt, {
      speed,
      drifting: !!(driving && player.inVehicle.handbrake && speed > 8),
      wanted: police.heat,
    });
  }
  // Cash pickups flow into the story wallet.
  const got = combat.collectPickups(player.pos, player);
  if (got > 0) {
    story.cash += got;
    if (!silent) audio.pickup();
  }
  story.syncPlayerPos(player.pos.x, player.pos.z);
}

// HUD text + rotating radar, called every frame and once per staged shot.
// Also toggles body.driving so CSS hides #aim-reticle while driving/boating.
function renderHud() {
  const driving = !player.onFoot && player.inVehicle;
  const ctrl = driving ? player.inVehicle : null;
  document.body.classList.toggle('driving', !!driving);
  const ammo = combat.ammoStatus();
  story.refreshRoute();
  const target = story.missionTarget;
  hud.updateHud({
    chapter: `Chapter ${story.chapter.chapter} — ${story.chapter.title}`,
    title: target.name,
    objective: story.objectiveText(),
    dist: story.missionDistance(),
    stars: police.heat,
    wantedLabel: police.wantedLabel(),
    cash: story.cash,
    respect: story.respect,
    rank: StoryCampaignManager.rankFor(story.respect),
    weapon: ammo.spec.label,
    ammo: `${ammo.mag} / ${ammo.reserve}`,
    radio: audio.station.name,
    district: hud.districtNameAt(player.pos.x, player.pos.z),
    health: player.health,
    armor: player.armor,
    speedMph: driving ? Math.abs(ctrl.speed) * 3.6 : Math.abs(player.speed) * 3.6,
    // Staged hero cars hold explicit .gear; live driving recomputes it in
    // VehiclePhysicsController.update. Never show 'P' (or '1') while moving.
    gear: driving
      ? (Math.abs(ctrl.speed) > 5
        ? (ctrl.gear === 1 || ctrl.gear === 'P' ? (ctrl.isBoat ? 4 : 5) : ctrl.gear)
        : ctrl.gear)
      : (Math.abs(player.speed) > 0.5 ? 'D' : 'P'),
    vehicle: driving ? (ctrl.spec.label || ctrl.specId) : 'ON FOOT',
    nitro: driving ? ctrl.nitro : 1,
    aiming: player.aiming && player.onFoot,
  });
  hud.tick(1 / 60);
  hud.chapterListState(story.chapterIndex);
  hud.drawMinimap({
    x: player.pos.x,
    z: player.pos.z,
    heading: driving ? ctrl.heading : player.heading,
    route: story.route,
    target,
    elapsed,
    traffic: traffic.vehicles.filter((v) => !v.hijacked).map((v) => ({ x: v.controller.pos.x, z: v.controller.pos.z })),
    cops: police.pursuers.map((p) => ({ x: p.controller.pos.x, z: p.controller.pos.z })),
    guards: combat.guards.map((g) => ({ x: g.pos.x, z: g.pos.z })),
  });
}

// Live gameplay loop.
function runGame() {
  hud.setMenuOpen(true);
  let last = performance.now();
  cam.snapImmediate(player.pos, player.heading);

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (paused || hud.menuOpen) {
      hud.tick(dt);
      hud.drawWorldMap({ x: player.pos.x, z: player.pos.z, route: story.route, target: story.missionTarget });
      renderer.render(scene, camera);
      return;
    }
    // Camera-space movement input (WASD/arrows + mouse aim).
    const fwd = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    const strafe = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    const yaw = cam.yaw + cam.mouseYaw;
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const driving = !player.onFoot && player.inVehicle;
    if (driving) {
      const ctrl = player.inVehicle;
      ctrl.update(dt, {
        throttle: fwd,
        steer: -strafe,
        handbrake: keys.has('Space'),
        nitro: keys.has('ShiftLeft') || keys.has('ShiftRight'),
      });
      player.update(dt, {});
      player.aiming = false;
      if (mouseDown) {
        const s = player.fireWeapon();
        if (s) {
          combat.fire(s.from, s.dir, 'player');
          audio.gunfire(combat.current);
        }
      }
    } else {
      // On-foot: camera-relative WASD, Shift sprint, right-mouse aim,
      // click fire (R reload, T radio — R no longer changes station on foot).
      const mx = -sin * fwd + -cos * strafe;
      const mz = -cos * fwd + sin * strafe;
      player.update(dt, {
        moveX: mx,
        moveZ: mz,
        sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'),
        aim: player.aiming || mouseDown,
      });
      if (keys.has('KeyR') && !keys.has('_reloadLock')) {
        keys.add('_reloadLock');
        if (combat.reload()) {
          hud.setHint(`${combat.ammoStatus().spec.label} reloaded`, 2);
          audio.uiClick();
        } else if (combat.ammoStatus().mag === 0) {
          hud.setHint('Out of ammo — Harbor Armory restocks', 2);
        }
        setTimeout(() => keys.delete('_reloadLock'), 250);
      }
      if ((mouseDown || keys.has('KeyG')) && combat.current !== 'pulse_grenade') {
        const arm = combat.arms[combat.current];
        const allow = arm.spec.automatic ? arm.cooldown <= 0 : !keys.has('_shotLock');
        if (allow) {
          if (arm.mag <= 0) {
            if (combat.reload()) hud.setHint('Reloaded', 1.5);
          } else {
            const s = player.fireWeapon();
            if (s) {
              combat.fire(s.from, s.dir, 'player');
              audio.gunfire(combat.current);
              cam.addShake(0.12);
            }
          }
          if (!arm.spec.automatic) {
            keys.add('_shotLock');
            setTimeout(() => keys.delete('_shotLock'), 220);
          }
        }
      }
    }
    stepFrame(dt);
    // Camera focus follows Elena on foot or in vehicle/boat.
    const ctrl = player.inVehicle;
    cam.update(dt, {
      pos: player.pos.clone().setY(player.pos.y + (driving ? 1 : 0)),
      heading: driving ? ctrl.heading : player.heading,
      speed: driving ? ctrl.speed : player.speed,
      driving,
      boat: driving ? ctrl.isBoat : false,
      aiming: player.aiming && !driving,
      nitro: driving ? ctrl.nitroActive : false,
    });
    renderHud();
    renderer.render(scene, camera);
    // WASTED state.
    if (player.dead && !hud.menuOpen) {
      hud.setHint('WASTED — open the menu (M) and press New Game', 5);
    }
  }
  requestAnimationFrame(frame);
}

const game = {
  scene, camera, renderer, rng, city, player, crowd, traffic, police,
  combat, story, saves, hud, cam, audio,
  world: { get elapsed() { return elapsed; } },
  driveVehicle, stepFrame, renderHud,
};

if (shotName) {
  stageScreenshotScenario(shotName, game);
} else {
  runGame();
}

export { game };
