// Costa Vermillion: Sunset Syndicate — gunplay, grenades, syndicate guards, pickups.
// 100% original content. Imports only 'three', './cityConfig.js', './playerAndPeds.js'.
import * as THREE from 'three';
import { WEAPON_IDS, WEAPON_SPECS } from './cityConfig.js';
import { createCharacterRig, triggerMuzzleFlash } from './playerAndPeds.js';

export class CombatAndWeaponsManager {
  constructor(scene, rng, opts = {}) {
    this.scene = scene;
    this.rng = rng;
    this.player = opts.player || null;
    this.crowd = opts.crowd || null;
    this.police = opts.police || null;
    this.traffic = opts.traffic || null;
    this.colliders = opts.colliders || [];
    this.current = 'viper_pistol';
    // Per-weapon live state cloned from WEAPON_SPECS.
    this.arms = {};
    for (const id of WEAPON_IDS) {
      const s = WEAPON_SPECS[id];
      this.arms[id] = { spec: s, mag: s.magazine, reserve: s.reserve, cooldown: 0, triggerHeld: false };
    }
    this.tracers = [];
    this.sparks = [];
    this.grenades = [];
    this.shockwaves = [];
    this.flashes = [];
    this.guards = []; // { rig, pos, heading, hp, maxHp, state, patrolA, patrolB, t, fireTimer, bar... }
    this.pickups = []; // { mesh, kind: 'cash' | 'armor' | 'ammo', amount, pos, spin }
    this.onShoot = opts.onShoot || null;
    this.onExplosion = opts.onExplosion || null;
    this.onGuardDown = opts.onGuardDown || null;
    this.onVehicleHit = opts.onVehicleHit || null;
    this.time = 0;
    this.camera = opts.camera || null;
  }

  setCamera(camera) {
    this.camera = camera;
  }

  setContext(ctx = {}) {
    if (ctx.player !== undefined) this.player = ctx.player;
    if (ctx.crowd !== undefined) this.crowd = ctx.crowd;
    if (ctx.police !== undefined) this.police = ctx.police;
    if (ctx.traffic !== undefined) this.traffic = ctx.traffic;
  }

  selectWeapon(id) {
    if (this.arms[id]) this.current = id;
    return this.current;
  }

  cycleWeapon(dir = 1) {
    const i = WEAPON_IDS.indexOf(this.current);
    const n = WEAPON_IDS[(i + dir + WEAPON_IDS.length) % WEAPON_IDS.length];
    return this.selectWeapon(n);
  }

  ammoStatus() {
    const a = this.arms[this.current];
    return { id: this.current, mag: a.mag, reserve: a.reserve, spec: a.spec };
  }

  reload() {
    const a = this.arms[this.current];
    if (a.mag >= a.spec.magazine || a.reserve <= 0) return false;
    const need = a.spec.magazine - a.mag;
    const take = Math.min(need, a.reserve);
    a.mag += take;
    a.reserve -= take;
    return true;
  }

  addAmmo(id, amount) {
    if (this.arms[id]) this.arms[id].reserve += amount;
  }

  // origin: Vector3 muzzle, dir: normalized Vector3, shooterPos for alert radius.
  fire(origin, dir, shooter = 'player') {
    const a = this.arms[this.current];
    const s = a.spec;
    if (a.cooldown > 0 || a.mag <= 0) return null;
    a.cooldown = 60 / s.rpm;
    a.mag -= 1;
    if (shooter === 'player' && this.player?.mesh) triggerMuzzleFlash(this.player.mesh);
    this.spawnMuzzleSprite(origin);
    const pellets = s.pellets || 1;
    const hits = [];
    for (let i = 0; i < pellets; i += 1) {
      const d = dir.clone();
      if (s.spread) {
        d.x += (Math.random() - 0.5) * s.spread * 2;
        d.y += (Math.random() - 0.5) * s.spread;
        d.z += (Math.random() - 0.5) * s.spread * 2;
        d.normalize();
      }
      const end = origin.clone().addScaledVector(d, s.range);
      const hitGuard = this.rayHitGuards(origin, d, s.range);
      const hitCop = this.rayHitOfficers(origin, d, s.range);
      const hitVehicle = this.rayHitVehicles(origin, d, s.range);
      let stop = end;
      let kind = 'world';
      if (hitGuard && (!hitVehicle || hitGuard.dist < hitVehicle.dist)) {
        hitGuard.guard.hp -= s.damage;
        stop = hitGuard.point;
        kind = 'guard';
        hits.push({ kind, guard: hitGuard.guard });
        if (hitGuard.guard.hp <= 0) this.killGuard(hitGuard.guard);
      } else if (hitCop && (!hitVehicle || hitCop.dist < hitVehicle.dist)) {
        stop = hitCop.point;
        kind = 'cop';
        hits.push({ kind });
        if (this.police) this.police.addHeat(0.4);
      } else if (hitVehicle) {
        stop = hitVehicle.point;
        kind = 'vehicle';
        hits.push({ kind, vehicle: hitVehicle.vehicle, damage: s.damage });
        if (this.onVehicleHit) this.onVehicleHit(hitVehicle.vehicle, s.damage);
      }
      this.spawnTracer(origin, stop);
      this.spawnSparks(stop, kind === 'guard' || kind === 'cop' ? 0xff5a5a : 0xffd97a);
    }
    // Loud gunfire scares peds and raises heat.
    if (this.crowd && origin) this.crowd.panicAt(origin.x, origin.z, 42);
    if (shooter === 'player' && this.police) this.police.addHeat(0.25);
    if (this.onShoot) this.onShoot({ weapon: this.current, hits });
    return { hits };
  }

  throwPulseGrenade(origin, dir) {
    const a = this.arms.pulse_grenade;
    if (!a || a.mag <= 0) return null;
    a.mag -= 1;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0x38e8ff }),
    );
    mesh.position.copy(origin);
    this.scene.add(mesh);
    const g = {
      mesh,
      vel: dir.clone().multiplyScalar(16).add(new THREE.Vector3(0, 7, 0)),
      fuse: WEAPON_SPECS.pulse_grenade.fuse,
    };
    this.grenades.push(g);
    if (this.player?.mesh) triggerMuzzleFlash(this.player.mesh);
    return g;
  }

  explode(at) {
    const s = WEAPON_SPECS.pulse_grenade;
    const ring = new THREE.Mesh(
      new THREE.SphereGeometry(1, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0x7df3ff, transparent: true, opacity: 0.55, depthWrite: false }),
    );
    ring.position.copy(at);
    this.scene.add(ring);
    this.shockwaves.push({ mesh: ring, t: 0, max: s.blastRadius });
    this.spawnSparks(at, 0x7df3ff, 26);
    for (const gd of [...this.guards]) {
      if (gd.pos.distanceTo(at) < s.blastRadius) {
        gd.hp -= s.damage;
        if (gd.hp <= 0) this.killGuard(gd);
      }
    }
    if (this.player && this.player.pos.distanceTo(at) < s.blastRadius * 0.8) {
      this.player.damage(s.damage * 0.4);
    }
    if (this.traffic) {
      for (const v of this.traffic.vehicles) {
        if (v.controller.pos.distanceTo(at) < s.blastRadius) {
          v.controller.damage = Math.min(1, v.controller.damage + 0.5);
          if (this.onVehicleHit) this.onVehicleHit(v, 60);
        }
      }
    }
    if (this.crowd) this.crowd.panicAt(at.x, at.z, 70);
    if (this.police) this.police.addHeat(1.2);
    if (this.onExplosion) this.onExplosion(at);
  }

  spawnTracer(from, to) {
    // Crisp 1.4m glowing bolt near the muzzle, fading fast.
    const dir = to.clone().sub(from);
    const len = dir.length();
    if (len <= 0.01) return;
    dir.normalize();
    const boltLen = Math.min(1.4, len);
    const start = from.clone();
    const end = from.clone().addScaledVector(dir, boltLen);
    const geo = new THREE.CylinderGeometry(0.035, 0.035, boltLen, 6, 1, true);
    geo.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(geo, glowMaterial(0xffe27a));
    mesh.position.copy(start).lerp(end, 0.5);
    mesh.lookAt(end);
    this.scene.add(mesh);
    this.tracers.push({ mesh, life: 0.07, max: 0.07 });
  }

  spawnMuzzleSprite(at) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({
      map: flashTexture(), color: 0xffe9a8, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    m.position.copy(at);
    m.scale.setScalar(0.9 + Math.random() * 0.5);
    m.userData.life = 0.06;
    m.userData.max = 0.06;
    this.scene.add(m);
    this.flashes.push(m);
  }

  spawnSparks(at, color = 0xffd97a, n = 8) {
    for (let i = 0; i < n; i += 1) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({
        map: sparkTexture(), color, transparent: true, opacity: 0.95,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      m.position.copy(at);
      m.scale.setScalar(0.2 + Math.random() * 0.25);
      m.userData.vel = new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        Math.random() * 7,
        (Math.random() - 0.5) * 10,
      );
      m.userData.life = 0.45;
      this.scene.add(m);
      this.sparks.push(m);
    }
  }

  // Syndicate enemy guard squads: patrol waypoints, aim at the player, shoot back.
  spawnGuardSquad(x, z, count = 3, patrolRadius = 26) {
    const squad = [];
    for (let i = 0; i < count; i += 1) {
      const rig = createCharacterRig({
        skin: 0x8a5a34,
        top: 0x3a1030,
        bottom: 0x1a1a24,
        hair: 0x111111,
      });
      rig.position.set(x + (this.rng() - 0.5) * 12, 0, z + (this.rng() - 0.5) * 12);
      // Guards carry a visible 3D gun while on duty.
      if (rig.userData.gunMesh) rig.userData.gunMesh.visible = true;
      this.scene.add(rig);
      const gd = {
        rig,
        pos: rig.position,
        heading: this.rng() * Math.PI * 2,
        hp: 55,
        maxHp: 55,
        state: 'patrol',
        patrolA: new THREE.Vector3(x - patrolRadius, 0, z),
        patrolB: new THREE.Vector3(x + patrolRadius, 0, z + 10),
        t: this.rng(),
        fireTimer: 1 + this.rng() * 2,
        phase: this.rng() * 10,
        bar: null,
      };
      gd.bar = makeHealthBar();
      gd.bar.position.set(gd.pos.x, 2.4, gd.pos.z);
      this.scene.add(gd.bar);
      this.guards.push(gd);
      squad.push(gd);
    }
    return squad;
  }

  killGuard(gd) {
    const i = this.guards.indexOf(gd);
    if (i >= 0) this.guards.splice(i, 1);
    if (gd.bar) this.scene.remove(gd.bar);
    gd.rig.rotation.x = Math.PI / 2;
    const kind = this.rng() < 0.6 ? 'cash' : 'armor';
    this.spawnPickup(gd.pos.x, gd.pos.z, kind, kind === 'cash' ? 150 + Math.floor(this.rng() * 250) : 25);
    setTimeout(() => this.scene.remove(gd.rig), 4000);
    if (this.onGuardDown) this.onGuardDown(gd);
  }

  spawnPickup(x, z, kind, amount) {
    let mesh;
    if (kind === 'cash') {
      // Emerald cash stack: banded bills.
      const g = new THREE.Group();
      for (let i = 0; i < 5; i += 1) {
        const bill = new THREE.Mesh(
          new THREE.BoxGeometry(0.7, 0.07, 0.45),
          new THREE.MeshLambertMaterial({ color: i % 2 ? 0x2fae5f : 0x52ff8c }),
        );
        bill.position.y = i * 0.075;
        bill.rotation.y = (Math.random() - 0.5) * 0.2;
        g.add(bill);
      }
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(0.74, 0.4, 0.16),
        new THREE.MeshLambertMaterial({ color: 0xf2ead8 }),
      );
      band.position.y = 0.15;
      g.add(band);
      mesh = g;
    } else if (kind === 'armor') {
      // Cyan armor vest pickup.
      const g = new THREE.Group();
      const vest = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.65, 0.25),
        new THREE.MeshStandardMaterial({ color: 0x38e8ff, emissive: 0x0a4a66, emissiveIntensity: 0.6, roughness: 0.4 }),
      );
      g.add(vest);
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.45, 0.28),
        new THREE.MeshBasicMaterial({ color: 0x9be9ff }),
      );
      g.add(plate);
      mesh = g;
    } else {
      mesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.45),
        new THREE.MeshBasicMaterial({ color: 0xffd97a }),
      );
    }
    mesh.position.set(x, 0.9, z);
    this.scene.add(mesh);
    const p = { mesh, kind, amount, pos: mesh.position, spin: Math.random() * 6 };
    this.pickups.push(p);
    return p;
  }

  collectPickups(playerPos, player) {
    let cash = 0;
    for (let i = this.pickups.length - 1; i >= 0; i -= 1) {
      const p = this.pickups[i];
      if (Math.hypot(p.pos.x - playerPos.x, p.pos.z - playerPos.z) < 2.4) {
        if (p.kind === 'cash') cash += p.amount;
        else if (p.kind === 'armor' && player) player.armor = Math.min(100, player.armor + p.amount);
        else if (p.kind === 'ammo') this.addAmmo(this.current, p.amount);
        this.scene.remove(p.mesh);
        this.pickups.splice(i, 1);
      }
    }
    return cash;
  }

  rayHitGuards(origin, dir, range) {
    let best = null;
    for (const gd of this.guards) {
      const to = new THREE.Vector3(gd.pos.x - origin.x, 0, gd.pos.z - origin.z);
      const along = to.dot(dir);
      if (along < 0 || along > range) continue;
      const perp = to.addScaledVector(dir, -along).length();
      if (perp < 1.2 && (!best || along < best.dist)) {
        best = { guard: gd, dist: along, point: origin.clone().addScaledVector(dir, along) };
      }
    }
    return best;
  }

  rayHitOfficers(origin, dir, range) {
    if (!this.police) return null;
    let best = null;
    for (const o of this.police.officers || []) {
      const to = new THREE.Vector3(o.pos.x - origin.x, 0, o.pos.z - origin.z);
      const along = to.dot(dir);
      if (along < 0 || along > range) continue;
      const perp = to.addScaledVector(dir, -along).length();
      if (perp < 1.2 && (!best || along < best.dist)) {
        best = { officer: o, dist: along, point: origin.clone().addScaledVector(dir, along) };
      }
    }
    return best;
  }

  rayHitVehicles(origin, dir, range) {
    const fleets = [];
    if (this.traffic) fleets.push(...this.traffic.vehicles);
    if (this.police) fleets.push(...(this.police.pursuers || []).map((p) => ({ controller: p.controller })));
    let best = null;
    for (const v of fleets) {
      const c = v.controller || v;
      if (!c?.pos) continue;
      const to = new THREE.Vector3(c.pos.x - origin.x, 0, c.pos.z - origin.z);
      const along = to.dot(dir);
      if (along < 0 || along > range) continue;
      const perp = to.addScaledVector(dir, -along).length();
      if (perp < 2.2 && (!best || along < best.dist)) {
        best = { vehicle: v, dist: along, point: origin.clone().addScaledVector(dir, along) };
      }
    }
    return best;
  }

  update(dt) {
    this.time += dt;
    for (const id of WEAPON_IDS) {
      this.arms[id].cooldown = Math.max(0, this.arms[id].cooldown - dt);
    }
    for (let i = this.tracers.length - 1; i >= 0; i -= 1) {
      const t = this.tracers[i];
      t.life -= dt;
      t.mesh.material.opacity = Math.max(0, t.life / t.max);
      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        this.tracers.splice(i, 1);
      }
    }
    for (let i = this.flashes.length - 1; i >= 0; i -= 1) {
      const m = this.flashes[i];
      m.userData.life -= dt;
      m.material.opacity = Math.max(0, m.userData.life / m.userData.max);
      m.scale.multiplyScalar(1 + dt * 4);
      if (m.userData.life <= 0) {
        this.scene.remove(m);
        this.flashes.splice(i, 1);
      }
    }
    for (let i = this.sparks.length - 1; i >= 0; i -= 1) {
      const m = this.sparks[i];
      m.userData.life -= dt;
      m.userData.vel.y -= 18 * dt;
      m.position.addScaledVector(m.userData.vel, dt);
      if (m.position.y < 0.05) m.position.y = 0.05;
      m.material.opacity = Math.max(0, m.userData.life * 2);
      m.scale.setScalar(Math.max(0.05, 0.25 * m.userData.life * 2));
      if (m.userData.life <= 0) {
        this.scene.remove(m);
        this.sparks.splice(i, 1);
      }
    }
    for (let i = this.grenades.length - 1; i >= 0; i -= 1) {
      const g = this.grenades[i];
      g.fuse -= dt;
      g.vel.y -= 16 * dt;
      g.mesh.position.addScaledVector(g.vel, dt);
      if (g.mesh.position.y < 0.3) {
        g.mesh.position.y = 0.3;
        g.vel.multiplyScalar(0.6);
        g.vel.y = Math.abs(g.vel.y) * 0.4;
      }
      g.mesh.material.color.setHex(Math.sin(this.time * 20) > 0 ? 0x38e8ff : 0xffffff);
      if (g.fuse <= 0) {
        this.explode(g.mesh.position.clone());
        this.scene.remove(g.mesh);
        this.grenades.splice(i, 1);
      }
    }
    for (let i = this.shockwaves.length - 1; i >= 0; i -= 1) {
      const s = this.shockwaves[i];
      s.t += dt * 2.4;
      const r = Math.max(0.1, s.max * s.t);
      s.mesh.scale.setScalar(r);
      s.mesh.material.opacity = Math.max(0, 0.55 * (1 - s.t));
      if (s.t >= 1) {
        this.scene.remove(s.mesh);
        this.shockwaves.splice(i, 1);
      }
    }
    for (const p of this.pickups) {
      p.spin += dt * 3;
      p.mesh.rotation.y = p.spin;
      p.mesh.position.y = 0.9 + Math.sin(this.time * 3 + p.spin) * 0.12;
    }

    // Guard AI: patrol between waypoints, chase/aim/shoot the player in range.
    const pp = this.player?.pos;
    for (const gd of this.guards) {
      gd.phase += dt * 7;
      let moveTarget = null;
      if (pp && !this.player.dead && gd.pos.distanceTo(pp) < 55) {
        gd.state = 'combat';
        const to = new THREE.Vector3().subVectors(pp, gd.pos);
        to.y = 0;
        const dist = to.length();
        gd.heading = Math.atan2(-to.x, -to.z);
        if (dist > 14) moveTarget = pp;
        gd.fireTimer -= dt;
        if (gd.fireTimer <= 0 && dist < 48) {
          gd.fireTimer = 1.1 + this.rng() * 1.4;
          const j = gd.rig.userData.joints;
          if (j) {
            j.flashTimer = 0.06;
            j.muzzleFlash.material.opacity = 0.9;
          }
          this.spawnMuzzleSprite(gd.pos.clone().setY(1.38));
          if (dist < 42 && this.rng() < 0.5) this.player.damage(3 + this.rng() * 6);
        }
      } else {
        gd.state = 'patrol';
        gd.t += dt * 0.08 * (this.rng() < 0.5 ? 1 : -1);
        if (gd.t > 1 || gd.t < 0) gd.t = Math.max(0, Math.min(1, gd.t));
        moveTarget = gd.patrolA.clone().lerp(gd.patrolB, gd.t);
        const to = new THREE.Vector3().subVectors(moveTarget, gd.pos);
        if (to.length() > 1) gd.heading = Math.atan2(-to.x, -to.z);
      }
      if (moveTarget) {
        const to = new THREE.Vector3().subVectors(moveTarget, gd.pos);
        to.y = 0;
        if (to.length() > 1.2) {
          to.normalize();
          gd.pos.addScaledVector(to, dt * (gd.state === 'combat' ? 3.4 : 1.6));
        }
      }
      gd.rig.position.copy(gd.pos);
      gd.rig.rotation.y = gd.heading;
      // Floating overhead health bar always faces the camera.
      if (gd.bar) {
        const frac = Math.max(0, gd.hp / gd.maxHp);
        gd.bar.userData.fill.scale.x = Math.max(0.001, frac);
        gd.bar.userData.fill.position.x = -(1 - frac) * 0.55;
        gd.bar.position.set(gd.pos.x, 2.4, gd.pos.z);
        const cam = this.camera || this.scene?.camera;
        if (cam) gd.bar.lookAt(cam.position);
      }
      const j = gd.rig.userData.joints;
      if (j) {
        const swing = Math.sin(gd.phase) * 0.5;
        j.legL.hip.rotation.x = swing;
        j.legR.hip.rotation.x = -swing;
        if (gd.state === 'combat') {
          j.armR.shoulder.rotation.x = -Math.PI / 2;
          j.armL.shoulder.rotation.x = -Math.PI / 2 + 0.3;
        } else {
          j.armR.shoulder.rotation.x = -swing * 0.6;
          j.armL.shoulder.rotation.x = swing * 0.6;
        }
        if (j.flashTimer > 0) {
          j.flashTimer -= dt;
          j.muzzleFlash.material.opacity = 0.9;
        } else if (gd.state !== 'combat') {
          j.muzzleFlash.material.opacity = 0;
        }
      }
    }
  }
}

function glowMaterial(color) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false });
}

function makeHealthBar() {
  const g = new THREE.Group();
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 0.14),
    new THREE.MeshBasicMaterial({ color: 0x11131c, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }),
  );
  g.add(back);
  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.09),
    new THREE.MeshBasicMaterial({ color: 0x52ff8c, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }),
  );
  fill.position.z = 0.01;
  g.add(fill);
  g.userData.fill = fill;
  return g;
}

let _flashTex = null;
function flashTexture() {
  if (_flashTex) return _flashTex;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,240,180,0.8)');
  g.addColorStop(0.6, 'rgba(255,200,90,0.25)');
  g.addColorStop(1, 'rgba(255,180,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  _flashTex = new THREE.CanvasTexture(c);
  _flashTex.minFilter = THREE.LinearFilter;
  _flashTex.magFilter = THREE.LinearFilter;
  return _flashTex;
}

let _sparkTex = null;
function sparkTexture() {
  if (_sparkTex) return _sparkTex;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  _sparkTex = new THREE.CanvasTexture(c);
  _sparkTex.minFilter = THREE.LinearFilter;
  _sparkTex.magFilter = THREE.LinearFilter;
  return _sparkTex;
}
