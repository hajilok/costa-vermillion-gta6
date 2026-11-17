// Costa Vermillion: Sunset Syndicate — 3D vehicles + driving/boating physics.
import * as THREE from 'three';
import { VEHICLE_SPECS, isWater } from './cityConfig.js';
const T = THREE;
export class VehiclePhysicsController {
  constructor(mesh, specId, colliders = []) {
    this.mesh = mesh; this.spec = VEHICLE_SPECS[specId];
    if (!this.spec) throw new Error(`Unknown vehicle spec: ${specId}`);
    this.specId = specId; this.colliders = colliders; this.pos = mesh.position.clone();
    this.heading = 0; this.speed = 0; this.steer = 0; this.gear = 1; this.nitro = 1;
    this.nitroActive = false; this.handbrake = false; this.damage = 0; this.airborne = false;
    this.particles = []; this.smokeTimer = 0; this.sirenPhase = 0;
    const s = mesh.userData.size || new T.Vector3(2.4, 2, 5);
    this.halfExtents = new T.Vector3(s.x / 2, s.y / 2, s.z / 2);
  }
  get topSpeedMs() { return this.spec.topSpeed * 0.9; }
  get isBoat() { return !!this.spec.water && !this.spec.land; }
  reset(x, z, h = 0) {
    this.pos.set(x, this.isBoat ? 0.22 : 0.35, z);
    this.heading = h; this.speed = 0; this.steer = 0; this.gear = 1; this.nitro = 1; this.damage = 0;
    this.mesh.position.copy(this.pos); this.mesh.rotation.set(0, h, 0);
  }
  update(dt, input = {}) {
    const s = this.spec, th = Math.max(-1, Math.min(1, input.throttle ?? 0)), si = Math.max(-1, Math.min(1, input.steer ?? 0));
    this.handbrake = !!input.handbrake; this.nitroActive = !!input.nitro && this.nitro > 0.05 && th > 0;
    const top = this.topSpeedMs * (1 - this.damage * 0.4), ac = s.acceleration * (this.nitroActive ? 1.9 : 1) * (1 - this.damage * 0.35);
    if (th > 0) this.speed += ac * th * dt;
    else if (th < 0) this.speed += (this.speed > 1 ? s.acceleration * 2.2 : ac * 0.7) * th * dt;
    else { const d = this.isBoat ? 1.4 : this.handbrake ? 6 : 2.2; this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), d * dt); }
    this.speed = Math.max(-top * 0.35, Math.min(top, this.speed));
    const fr = Math.min(1, Math.abs(this.speed) / Math.max(1, top));
    this.gear = this.speed < -0.5 ? 'R' : 1 + Math.min(4, Math.floor(fr * 5));
    this.steer += (si * (0.55 + s.handling * 0.75) * (this.handbrake ? 0.35 : 1) - this.steer) * Math.min(1, dt * (this.handbrake ? 5 : 9));
    this.heading -= this.steer * (this.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(this.speed) / 8) * dt * (this.isBoat ? 1.1 : 1.6);
    const fw = new T.Vector3(-Math.sin(this.heading), 0, -Math.cos(this.heading));
    if (this.handbrake && Math.abs(this.speed) > 8) {
      this.pos.addScaledVector(fw, this.speed * dt * 0.92);
      this.pos.addScaledVector(new T.Vector3(-fw.z, 0, fw.x), this.steer * this.speed * dt * 0.28);
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 9 * dt); this.spawnDriftSmoke(dt, true);
    } else { this.pos.addScaledVector(fw, this.speed * dt); if (Math.abs(this.speed) > top * 0.85) this.spawnDriftSmoke(dt, false); }
    if (this.nitroActive) { this.nitro = Math.max(0, this.nitro - dt * 0.35); this.spawnDriftSmoke(dt, false, 0x38e8ff); }
    else this.nitro = Math.min(1, this.nitro + dt * 0.06);
    if (this.isBoat) {
      this.pos.y = 0.22 + Math.sin(performance.now() * 0.002) * 0.15;
      if (!isWater(this.pos.x, this.pos.z)) { this.speed *= 1 - Math.min(1, dt * 4); this.damage = Math.min(1, this.damage + dt * 0.05); }
    } else { this.pos.y = 0.35; this.resolveBuildingCollisions(); }
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.set(0, this.heading, this.handbrake && Math.abs(this.speed) > 8 ? -this.steer * 0.18 : -this.steer * 0.05);
    const sp = (this.speed / 0.44) * dt, u = this.mesh.userData;
    for (const w of u.wheels || []) w.rotation.x += sp;
    for (const w of u.frontWheels || []) w.rotation.y = this.steer * 0.5;
    const br = th < 0 || this.handbrake;
    for (const b of u.brakeLights || []) b.material.color.setHex(br ? 0xff4444 : 0x881111);
    const lb = u.lightbar;
    if (lb) {
      this.sirenPhase += dt * 10; const on = Math.sin(this.sirenPhase) > 0;
      lb.userData.red.material.color.setHex(on ? 0xff2222 : 0x550000);
      lb.userData.blue.material.color.setHex(on ? 0x001155 : 0x3355ff);
      if (lb.userData.redGlow) lb.userData.redGlow.material.opacity = on ? 0.85 : 0.08;
      if (lb.userData.blueGlow) lb.userData.blueGlow.material.opacity = on ? 0.08 : 0.85;
    }
    if (u.flames) for (const f of u.flames) { f.visible = this.nitroActive; if (this.nitroActive) f.scale.set(1, 1 + Math.random() * 1.4, 1); }
    if (u.wake) { u.wake.material.opacity = Math.min(0.75, 0.2 + Math.abs(this.speed) / 40); u.wake.scale.y = 1 + Math.abs(this.speed) / 60; }
    if (this.damage > 0.35) { this.smokeTimer -= dt; if (this.smokeTimer <= 0) { this.smokeTimer = 0.08; this.spawnDamageSmoke(); } }
    this.updateParticles(dt);
    return { speed: this.speed, gear: this.gear, nitro: this.nitro, damage: this.damage };
  }
  resolveBuildingCollisions() {
    if (!this.colliders.length) return;
    const me = new T.Box3(new T.Vector3(this.pos.x - this.halfExtents.x, 0, this.pos.z - this.halfExtents.z), new T.Vector3(this.pos.x + this.halfExtents.x, 4, this.pos.z + this.halfExtents.z));
    for (const b of this.colliders) {
      if (!me.intersectsBox(b)) continue;
      const ox = Math.min(me.max.x, b.max.x) - Math.max(me.min.x, b.min.x), oz = Math.min(me.max.z, b.max.z) - Math.max(me.min.z, b.min.z), im = Math.abs(this.speed);
      if (ox < oz) this.pos.x += (this.pos.x < (b.min.x + b.max.x) / 2 ? -1 : 1) * (ox + 0.05); else this.pos.z += (this.pos.z < (b.min.z + b.max.z) / 2 ? -1 : 1) * (oz + 0.05);
      if (im > 10) this.damage = Math.min(1, this.damage + im * 0.008);
      this.speed *= im > 18 ? -0.25 : 0.3;
      me.setFromCenterAndSize(new T.Vector3(this.pos.x, 2, this.pos.z), new T.Vector3(this.halfExtents.x * 2, 4, this.halfExtents.z * 2));
    }
  }
  ensureParticlePool(scene) {
    if (this.particleParent) return;
    this.particleParent = new T.Group(); this.particlePool = [];
    for (let i = 0; i < 60; i += 1) {
      const m = new T.Sprite(new T.SpriteMaterial({ map: smokeTex(), transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false; this.particleParent.add(m); this.particlePool.push(m);
    }
    scene.add(this.particleParent);
  }
  puff(p, color = 0xcfc8bd, big = false) {
    const m = this.particlePool?.find((q) => !q.visible);
    if (!m) return;
    const ni = color === 0x38e8ff || color === 0xffc44d;
    m.visible = true; m.material.map = ni ? glowTex() : smokeTex();
    m.material.blending = ni ? T.AdditiveBlending : T.NormalBlending;
    m.material.color.setHex(color); m.material.opacity = ni ? 0.5 : 0.22; m.position.copy(p);
    const r = big ? 1.0 + Math.random() * 0.3 : 0.5 + Math.random() * 0.8;
    m.scale.set(r, r, 1); m.userData.life = ni ? 0.35 : 0.7; m.userData.nitro = ni; this.particles.push(m);
  }
  spawnDriftSmoke(dt, hb, color = 0xcfc8bd) {
    if (!this.particleParent) return;
    const bk = new T.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    for (let i = 0; i < (hb ? 3 : 1); i += 1) { const p = this.pos.clone().addScaledVector(bk, 2.2); p.y = 0.4; p.x += (Math.random() - 0.5) * 1.6; this.puff(p, color, hb); }
  }
  spawnDamageSmoke() {
    if (!this.particleParent) return;
    const p = this.pos.clone(); p.y = 1.6; p.x += Math.sin(this.heading) * -1.5; p.z += Math.cos(this.heading) * -1.5;
    this.puff(p, this.damage > 0.7 ? 0x2a2a2a : 0x8a8a8a, true);
  }
  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const m = this.particles[i]; m.userData.life -= dt;
      m.position.y += dt * (m.userData.nitro ? 0.6 : 1.6);
      m.scale.multiplyScalar(1 + dt * (m.userData.nitro ? 3.2 : 1.8));
      m.material.opacity = Math.max(0, Math.min(0.24, m.userData.life * (m.userData.nitro ? 1.4 : 0.34)));
      if (m.userData.life <= 0) { m.visible = false; this.particles.splice(i, 1); }
    }
  }
}
export function createVehicleMesh(specId, colorOverride) {
  const spec = VEHICLE_SPECS[specId];
  if (!spec) throw new Error(`Unknown vehicle spec: ${specId}`);
  const color = colorOverride ?? spec.colors[(Math.random() * spec.colors.length) | 0];
  const R = new T.Group(); R.userData.specId = specId;
  const U = R.userData, wheels = []; let brakes = [], heads = [], bar = null;
  const K = spec.kind, ID = specId;
  if (K === 'moto') {
    P(R, B(0.5, 0.5, 2.4, color), 0, 0.8, 0);
    P(R, B(0.46, 0.32, 0.9, color, 0.6, 0.25), 0, 1.1, 0.5);
    P(R, B(0.45, 0.25, 1.0, 0x1a1a24), 0, 1.1, -0.4);
    const sh = new T.Mesh(new T.PlaneGeometry(0.6, 0.7), G(0x9be9ff, 0.55));
    P(R, sh, 0, 1.5, 1.0); sh.rotation.x = -0.4;
    heads = [L(R, 0xfff2b0, 0, 1.0, 1.28, 0.3)]; brakes = [L(R, 0xff2222, 0, 1.0, -1.26, 0.3)]; F(R, 0, 1.0, 1.45, 0xfff2b0, 1.4);
    for (const [x, z, r] of [[0, 1.15, 0.42], [0, -1.05, 0.42]]) wheels.push(P(R, W(r, 0.28), x, r, z));
    U.size = new T.Vector3(1.1, 1.8, 2.8);
  } else if (K === 'boat') {
    const hm = new T.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.15 });
    P(R, new T.Mesh(new T.BoxGeometry(2.6, 1.1, 6.4), hm), 0, 0.7, 0);
    const ve = new T.Mesh(new T.BoxGeometry(2.2, 0.7, 6.0), hm); ve.rotation.y = Math.PI / 4; ve.scale.set(0.72, 1, 1); P(R, ve, 0, 0.25, 0);
    const bw = new T.Mesh(new T.ConeGeometry(1.3, 2.2, 4), hm); bw.rotation.x = Math.PI / 2; bw.rotation.y = Math.PI / 4; P(R, bw, 0, 0.7, 4.2);
    P(R, B(2.66, 0.3, 5.6, 0xff5a4e), 0, 1.05, 0);
    P(R, B(2.2, 0.25, 4.4, 0x273142), 0, 1.3, -0.4);
    const wm = G(0x0a1a2e, 0.85), wn = new T.Mesh(new T.PlaneGeometry(2.0, 1.0), wm);
    P(R, wn, 0, 2.0, 1.2); wn.rotation.x = -0.35;
    for (const sx of [-0.8, 0.8]) { const sd = new T.Mesh(new T.PlaneGeometry(0.9, 0.9), wm); P(R, sd, sx, 1.95, 0.8); sd.rotation.y = sx > 0 ? -0.7 : 0.7; }
    P(R, new T.Mesh(new T.CapsuleGeometry(0.32, 0.7, 4, 8), new T.MeshLambertMaterial({ color: 0xff5a4e })), 0, 1.9, -0.6);
    P(R, new T.Mesh(new T.SphereGeometry(0.24, 10, 8), new T.MeshLambertMaterial({ color: 0xfff3d6 })), 0, 2.6, -0.6);
    for (const sx of [-0.7, 0.7]) { P(R, B(0.5, 0.9, 0.5, 0x1a1a24, 0.5, 0.4), sx, 0.7, -3.4); P(R, B(0.1, 0.5, 0.3, 0x888892, 0.7, 0.4), sx, 0.2, -3.6); }
    const wk = new T.Mesh(new T.PlaneGeometry(3.4, 7), new T.MeshBasicMaterial({ map: wakeTex(), transparent: true, opacity: 0.4, depthWrite: false }));
    wk.rotation.x = -Math.PI / 2; P(R, wk, 0, 0.12, -6.2); U.wake = wk;
    U.size = new T.Vector3(2.8, 1.8, 7.4);
  } else {
    const tr = K === 'truck', cop = !!spec.police, gt = ID === 'veloce_gt';
    const Ln = tr ? 6.6 : K === 'suv' ? 5.2 : 4.6, H = tr ? 1.6 : K === 'suv' ? 1.15 : 0.85, Wd = tr ? 2.6 : 2.15;
    const bd = P(R, B(Wd, H, Ln, cop ? 0x10233a : color, 0.35, 0.35), 0, tr ? 1.5 : 0.85, 0);
    if (gt) {
      const no = P(R, B(Wd * 0.94, 0.5, 1.2, color, 0.5, 0.3), 0, 0.62, Ln / 2 + 0.4); no.rotation.x = 0.12;
      for (const sx of [-0.5, 0.5]) P(R, B(0.5, 0.08, 0.7, 0x0a0a12), sx, 0.9, Ln / 2 - 0.1);
      for (const sx of [-1, 1]) { P(R, B(0.18, 0.3, Ln * 0.7, 0x14141c), sx * (Wd / 2), 0.42, 0); P(R, B(0.3, 0.14, 0.2, 0x14141c), sx * (Wd / 2 + 0.15), 1.35, 1.2); }
      P(R, B(2.0, 0.12, 0.55, 0x14141c, 0.5, 0.4), 0, 1.75, -Ln / 2 + 0.2);
      for (const sx of [-0.8, 0.8]) P(R, B(0.12, 0.5, 0.12, 0x14141c), sx, 1.45, -Ln / 2 + 0.2);
      U.flames = [];
      for (const sx of [-0.35, 0.35]) {
        const pi = new T.Mesh(new T.CylinderGeometry(0.11, 0.11, 0.4, 10), new T.MeshStandardMaterial({ color: 0x888892, metalness: 0.8, roughness: 0.3 }));
        pi.rotation.x = Math.PI / 2; P(R, pi, sx, 0.55, -Ln / 2 - 0.15);
        for (const [r, ln, c] of [[0.16, 1.1, 0x38e8ff], [0.08, 0.7, 0xffc44d]]) {
          const fm = new T.Mesh(new T.ConeGeometry(r, ln, 10), new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false }));
          fm.rotation.x = -Math.PI / 2; fm.visible = false; P(R, fm, sx, 0.55, -Ln / 2 - 0.75); U.flames.push(fm);
        }
      }
      brakes = [L(R, 0xff2244, 0, 0.95, -Ln / 2 - 0.05, 1.9, 0.22)];
    }
    if (ID === 'boveda_armored') {
      P(R, B(Wd + 0.25, 0.9, Ln * 0.62, 0x3a3a46, 0.6, 0.5), 0, 1.35, -0.6);
      P(R, B(Wd * 0.8, 0.5, 0.3, 0x22222c, 0.6, 0.5), 0, 1.0, Ln / 2 + 0.1);
      P(R, B(1.1, 0.25, 1.1, 0x2c2c38, 0.6, 0.5), 0, 2.5, -0.6);
    }
    if (ID === 'brisa_cabrio') {
      for (const sx of [-0.5, 0.5]) P(R, B(0.75, 0.7, 0.7, 0x7a2c3a), sx, 1.15, -0.5);
      P(R, B(1.9, 0.4, 0.6, 0x1a1a24), 0, 1.25, 1.1);
      P(R, B(1.9, 0.12, 0.12, color, 0.5, 0.4), 0, 1.7, 1.35);
    } else if (ID === 'dune_titan') {
      P(R, B(1.6, 0.12, 3.0, 0x22222c), 0, bd.position.y + H / 2 + 0.85, -0.2);
      const sp = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 0.3, 12), new T.MeshLambertMaterial({ color: 0x14141c }));
      sp.rotation.x = Math.PI / 2; P(R, sp, 0, bd.position.y + H / 2 + 0.5, -2.0);
    }
    if (!tr && ID !== 'brisa_cabrio') {
      const cb = new T.Mesh(new T.BoxGeometry(Wd * 0.8, gt ? 0.55 : 0.7, Ln * 0.44), gt ? new T.MeshStandardMaterial({ color: 0x101c2e, metalness: 0.88, roughness: 0.12 }) : G(0x0e1c30, 1));
      if (gt) cb.rotation.x = 0.06;
      P(R, cb, 0, bd.position.y + H / 2 + (gt ? 0.22 : 0.3), -0.28); cb.castShadow = true;
    } else if (tr) P(R, new T.Mesh(new T.BoxGeometry(Wd * 0.95, 1.0, 1.6), G(0x0e1c30, 1)), 0, 2.0, Ln / 2 - 0.9);
    if (!gt) for (const sx of [-0.7, 0.7]) {
      heads.push(L(R, 0xfff2b0, sx, bd.position.y, Ln / 2 + 0.05)); brakes.push(L(R, 0xff2222, sx, bd.position.y, -Ln / 2 - 0.05)); F(R, sx, bd.position.y, Ln / 2 + 0.25, 0xfff2b0, 1.4);
    } else for (const sx of [-0.7, 0.7]) { heads.push(L(R, 0xfff6d8, sx, 0.72, Ln / 2 + 0.42, 0.6)); F(R, sx, 0.72, Ln / 2 + 0.6, 0xfff2b0, 1.8); }
    if (cop) {
      for (const sx of [-1, 1]) P(R, B(0.06, 0.8, 2.2, 0xf2f2f5, 0.3, 0.4), sx * (Wd / 2 + 0.01), bd.position.y, 0);
      P(R, B(Wd * 0.9, 0.06, 1.2, 0xf2f2f5, 0.3, 0.4), 0, bd.position.y + H / 2 + 0.02, Ln / 2 - 1.0);
      for (const sx of [-0.7, 0.7]) P(R, B(0.14, 0.9, 0.14, 0x22222c, 0.6, 0.5), sx, 0.9, Ln / 2 + 0.25);
      P(R, B(1.9, 0.18, 0.14, 0x22222c, 0.6, 0.5), 0, 1.1, Ln / 2 + 0.25);
      bar = new T.Group(); bar.add(B(1.6, 0.18, 0.5, 0x0a0a12));
      const rd = LM(0xff2222, 0.7, 0.34); P(bar, rd, -0.4, 0.2, 0);
      const bl = LM(0x2255ff, 0.7, 0.34); P(bar, bl, 0.4, 0.2, 0);
      bar.userData.red = rd; bar.userData.blue = bl;
      const rg = C(0xff2222); P(bar, rg, -0.4, 0.2, 0); bar.userData.redGlow = rg;
      const bg = C(0x3355ff); P(bar, bg, 0.4, 0.2, 0); bar.userData.blueGlow = bg;
      P(R, bar, 0, bd.position.y + H / 2 + 0.95, -0.25);
    }
    const rr = tr ? 0.62 : K === 'suv' ? 0.55 : 0.44, ww = tr ? 0.5 : 0.38, az = Ln / 2 - 0.95;
    if (gt) for (const sx of [-1, 1]) for (const q of [az, -az]) P(R, B(0.3, 0.3, rr * 2.6, 0x0a0a10), sx * (Wd / 2), rr + 0.35, q);
    wheels.push(P(R, W(rr, ww), -Wd / 2, rr, az), P(R, W(rr, ww), Wd / 2, rr, az), P(R, W(rr, ww), -Wd / 2, rr, -az), P(R, W(rr, ww), Wd / 2, rr, -az));
    U.frontWheels = [wheels[0], wheels[1]]; U.size = new T.Vector3(Wd + 0.6, 2.4, Ln + 0.6);
  }
  U.wheels = wheels; U.brakeLights = brakes; U.headlights = heads; U.lightbar = bar;
  R.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return R;
}
function P(parent, m, x, y, z) { m.position.set(x, y, z); parent.add(m); return m; }
function B(w, h, d, c, mt = 0.25, ro = 0.45) {
  const m = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshStandardMaterial({ color: c, metalness: mt, roughness: ro }));
  m.castShadow = true; return m;
}
function LM(c, w = 0.5, h = 0.32) { return new T.Mesh(new T.BoxGeometry(w, h, 0.12), new T.MeshBasicMaterial({ color: c })); }
function L(R2, c, x, y, z, w = 0.5, h = 0.32) { return P(R2, LM(c, w, h), x, y, z); }
function G(c, op = 1) { return new T.MeshPhongMaterial({ color: c, shininess: 120, specular: 0xffc46a, transparent: op < 1, opacity: op }); }
function W(r, w) {
  const g = new T.Group();
  const t = new T.Mesh(new T.CylinderGeometry(r, r, w, 14), new T.MeshLambertMaterial({ color: 0x14141c }));
  t.rotation.z = Math.PI / 2; t.castShadow = true; g.add(t);
  const ch = new T.MeshStandardMaterial({ color: 0xe8e8f2, metalness: 0.9, roughness: 0.2 });
  for (let i = 0; i < 5; i += 1) { const s = new T.Mesh(new T.BoxGeometry(w + 0.06, r * 0.32, r * 0.9), ch); s.rotation.x = (i / 5) * Math.PI * 2; g.add(s); }
  const hb = new T.Mesh(new T.CylinderGeometry(r * 0.22, r * 0.22, w + 0.08, 10), ch); hb.rotation.z = Math.PI / 2; g.add(hb);
  g.userData.spin = true; return g;
}
function F(R2, x, y, z, c, s) {
  const sp = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color: c, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false }));
  return P(R2, sp, x, y, z).scale.set(s, s, 1);
}
function C(c) {
  const sp = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color: c, transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false }));
  sp.scale.set(2.4, 2.4, 1); return sp;
}
function canvasTex(painter) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  painter(c.getContext('2d'));
  const t = new T.CanvasTexture(c); t.minFilter = T.LinearFilter; t.magFilter = T.LinearFilter; t.generateMipmaps = false;
  return t;
}
let _s = null;
function smokeTex() {
  if (_s) return _s;
  return (_s = canvasTex((x) => {
    const g = x.createRadialGradient(64, 64, 2, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,255,255,0.85)'); g.addColorStop(0.35, 'rgba(255,255,255,0.38)'); g.addColorStop(0.7, 'rgba(255,255,255,0.10)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  }));
}
let _g = null;
function glowTex() {
  if (_g) return _g;
  return (_g = canvasTex((x) => {
    const g = x.createRadialGradient(64, 64, 1, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  }));
}
let _w = null;
function wakeTex() {
  if (_w) return _w;
  return (_w = canvasTex((x) => {
    for (let i = 0; i < 26; i += 1) {
      const t = i / 26, y = 8 + t * 112, w = 10 + t * 50, g = x.createRadialGradient(64, y, 1, 64, y, w);
      g.addColorStop(0, `rgba(255,255,255,${(0.5 * (1 - t)).toFixed(3)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    }
  }));
}
