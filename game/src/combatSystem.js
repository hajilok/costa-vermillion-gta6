// Combat, tracers, guards, grenades and pickups for Puerto Vermillion.
// Hitscan pistols/SMG/shotgun plus the thrown pulse grenade.

import * as THREE from '../vendor/three.module.min.js';
import { WEAPON_SPECS } from './cityConfig.js';
import { createCharacterRig } from './playerAndPeds.js';

function makeRadialSprite(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,240,200,0.85)');
  grad.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

let flashTexture = null;

export class CombatAndWeaponsManager {
  constructor(scene) {
    this.scene = scene;
    this.camera = null;
    this.slots = ['viper_pistol', 'coral_smg', 'breacher_shotgun', 'pulse_grenade'];
    this.current = 0;
    this.ammo = { viper_pistol: 48, coral_smg: 128, breacher_shotgun: 24, pulse_grenade: 3 };
    this.mag = { viper_pistol: 12, coral_smg: 32, breacher_shotgun: 6, pulse_grenade: 1 };
    this.cooldown = 0;
    this.reloadT = 0;
    this.guards = [];
    this.tracers = [];
    this.sparks = [];
    this.grenades = [];
    this.pickups = [];
    if (!flashTexture) flashTexture = makeRadialSprite(64);
  }

  setCamera(camera) {
    this.camera = camera;
  }

  currentSpec() {
    return WEAPON_SPECS.find((w) => w.id === this.slots[this.current]);
  }

  switchTo(index) {
    if (index >= 0 && index < this.slots.length) {
      this.current = index;
      this.reloadT = 0;
    }
  }

  spawnGuardSquad(center, count, opts) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const rig = createCharacterRig({
        jacket: 0x2b2f3a,
        pants: 0x1a1d24,
        skin: 0xc98e62,
        hair: 0x111111,
        ponytail: false,
      });
      const angle = (i / Math.max(1, count)) * Math.PI * 2;
      const x = center.x + Math.cos(angle) * (6 + i * 2);
      const z = center.z + Math.sin(angle) * (6 + i * 2);
      rig.position.set(x, 0, z);
      rig.userData.gunMesh.visible = true;
      const hp = (opts && opts.hp) || 60;
      const barCanvas = document.createElement('canvas');
      barCanvas.width = 64;
      barCanvas.height = 8;
      const barTex = new THREE.CanvasTexture(barCanvas);
      const bar = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: barTex, depthWrite: false, transparent: true })
      );
      bar.scale.set(1.4, 0.22, 1);
      bar.position.y = 2.1;
      rig.add(bar);
      if (this.scene) this.scene.add(rig);
      const guard = { mesh: rig, bar, barCanvas, barTex, hp, maxHp: hp, x, z, cooldown: 1 + i * 0.4 };
      this.drawGuardBar(guard);
      this.guards.push(guard);
      out.push(guard);
    }
    return out;
  }

  drawGuardBar(guard) {
    const ctx = guard.barCanvas.getContext('2d');
    ctx.fillStyle = '#101018';
    ctx.fillRect(0, 0, 64, 8);
    const frac = Math.max(0, guard.hp / guard.maxHp);
    ctx.fillStyle = frac > 0.5 ? '#35e06a' : frac > 0.25 ? '#e0b635' : '#e03535';
    ctx.fillRect(1, 1, Math.round(62 * frac), 6);
    guard.barTex.needsUpdate = true;
  }

  fire(origin, dir) {
    if (this.cooldown > 0 || this.reloadT > 0) return null;
    const spec = this.currentSpec();
    if (this.mag[spec.id] <= 0) {
      this.startReload();
      return null;
    }
    this.mag[spec.id] -= 1;
    this.cooldown = spec.fireInterval;
    if (spec.id === 'pulse_grenade') {
      this.throwPulseGrenade(origin, dir);
      return { kind: 'thrown' };
    }
    const pellets = spec.pellets || 1;
    for (let i = 0; i < pellets; i++) this.spawnTracer(origin, dir, spec);
    this.spawnMuzzleFlash(origin);
    this.spawnSparks(origin, dir, 6);
    return { kind: spec.kind, pellets };
  }

  spawnTracer(origin, dir, spec) {
    const length = 1.3;
    const geo = new THREE.CylinderGeometry(0.03, 0.03, length, 6, 1, true);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, -length / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: spec.id === 'coral_smg' ? 0x7dfcff : 0xffe9a8,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const bolt = new THREE.Mesh(geo, mat);
    bolt.position.copy(origin);
    bolt.lookAt(origin.clone().add(dir));
    if (this.scene) this.scene.add(bolt);
    this.tracers.push({ mesh: bolt, life: 0.09, vel: dir.clone().multiplyScalar(160) });
  }

  spawnMuzzleFlash(origin) {
    const mat = new THREE.SpriteMaterial({
      map: flashTexture,
      color: 0xffe9a8,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const flash = new THREE.Sprite(mat);
    flash.scale.set(0.9, 0.9, 1);
    flash.position.copy(origin);
    if (this.scene) this.scene.add(flash);
    this.sparks.push({ mesh: flash, life: 0.07, kind: 'flash' });
  }

  spawnSparks(pos, dir, n) {
    for (let i = 0; i < n; i++) {
      const mat = new THREE.SpriteMaterial({
        map: flashTexture,
        color: 0xffd070,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      });
      const s = new THREE.Sprite(mat);
      s.scale.set(0.28, 0.28, 1);
      s.position.copy(pos);
      if (this.scene) this.scene.add(s);
      const v = new THREE.Vector3(
        dir.x + (Math.random() - 0.5) * 1.4,
        Math.random() * 0.9,
        dir.z + (Math.random() - 0.5) * 1.4
      ).multiplyScalar(7);
      this.sparks.push({ mesh: s, life: 0.4, vel: v, kind: 'spark' });
    }
  }

  throwPulseGrenade(origin, dir) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x39e6c3, emissive: 0x1affd4, emissiveIntensity: 1.6 })
    );
    mesh.position.copy(origin);
    if (this.scene) this.scene.add(mesh);
    this.grenades.push({ mesh, vel: dir.clone().multiplyScalar(16).add(new THREE.Vector3(0, 6, 0)), fuse: 1.6 });
  }

  detonateGrenade(g) {
    const spec = WEAPON_SPECS.find((w) => w.id === 'pulse_grenade');
    const geo = new THREE.SphereGeometry(spec.blastRadius, 18, 14);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x7dfcff,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const blast = new THREE.Mesh(geo, mat);
    blast.position.copy(g.mesh.position);
    if (this.scene) this.scene.add(blast);
    this.sparks.push({ mesh: blast, life: 0.45, kind: 'blast', grow: true });
    for (const guard of this.guards) {
      const d = Math.hypot(guard.x - g.mesh.position.x, guard.z - g.mesh.position.z);
      if (d < spec.blastRadius) {
        guard.hp -= spec.damage * (1 - d / (spec.blastRadius * 1.4));
        this.drawGuardBar(guard);
      }
    }
    if (this.scene) this.scene.remove(g.mesh);
  }

  spawnPickups(center) {
    const cash = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const bill = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.1 + i * 0.05, 0.34),
        new THREE.MeshStandardMaterial({ color: 0x2fbf71, emissive: 0x0d5c2f, emissiveIntensity: 0.5 })
      );
      bill.position.y = i * 0.08;
      bill.rotation.y = i * 0.2;
      cash.add(bill);
    }
    cash.position.set(center.x + 2, 0.3, center.z);
    if (this.scene) this.scene.add(cash);
    const vest = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.6, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0e7490, emissiveIntensity: 0.8 })
    );
    vest.position.set(center.x - 2, 0.6, center.z + 1);
    if (this.scene) this.scene.add(vest);
    this.pickups.push({ mesh: cash, kind: 'cash' }, { mesh: vest, kind: 'armor' });
  }

  startReload() {
    const spec = this.currentSpec();
    if (this.reloadT > 0) return;
    const need = spec.magazine - this.mag[spec.id];
    if (need <= 0 || this.ammo[spec.id] <= 0) return;
    this.reloadT = spec.reloadTime;
  }

  update(dt, playerPos) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        const spec = this.currentSpec();
        const need = spec.magazine - this.mag[spec.id];
        const take = Math.min(need, this.ammo[spec.id]);
        this.mag[spec.id] += take;
        this.ammo[spec.id] -= take;
      }
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      t.mesh.position.addScaledVector(t.vel, dt);
      if (t.life <= 0) {
        if (this.scene) this.scene.remove(t.mesh);
        this.tracers.splice(i, 1);
      }
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= dt;
      if (s.vel) s.mesh.position.addScaledVector(s.vel, dt);
      if (s.grow) s.mesh.scale.multiplyScalar(1 + dt * 6);
      if (s.mesh.material) s.mesh.material.opacity = Math.max(0, s.life * 2);
      if (s.life <= 0) {
        if (this.scene) this.scene.remove(s.mesh);
        this.sparks.splice(i, 1);
      }
    }
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.fuse -= dt;
      g.vel.y -= 14 * dt;
      g.mesh.position.addScaledVector(g.vel, dt);
      if (g.mesh.position.y < 0.2) {
        g.mesh.position.y = 0.2;
        g.vel.multiplyScalar(0.5);
        g.vel.y = Math.abs(g.vel.y) * 0.4;
      }
      if (g.fuse <= 0) {
        this.detonateGrenade(g);
        this.grenades.splice(i, 1);
      }
    }
    for (const guard of this.guards) {
      guard.bar.quaternion.copy(this.camera ? this.camera.quaternion : new THREE.Quaternion());
      guard.cooldown -= dt;
    }
    for (const p of this.pickups) {
      p.mesh.rotation.y += dt * 1.2;
    }
  }
}
