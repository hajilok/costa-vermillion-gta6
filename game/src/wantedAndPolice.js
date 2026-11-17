// Costa Vermillion: Sunset Syndicate — PVPD wanted heat, pursuit units, Hawk helicopter.
import * as THREE from 'three';
import { ROAD_NETWORK } from './cityConfig.js';
import { VehiclePhysicsController, createVehicleMesh } from './vehicleSystem.js';
import { createCharacterRig } from './playerAndPeds.js';
const T = THREE;
export class WantedAndPoliceDirector {
  constructor(scene, rng, colliders = []) {
    this.scene = scene; this.rng = rng; this.colliders = colliders;
    this.heat = 0; this.heatValue = 0; this.cooldownTimer = 0; this.escalationTimer = 0;
    this.pursuers = []; this.officers = []; this.roadblocks = [];
    this.heli = null; this.heliPos = new T.Vector3(); this.busted = false; this.sirenPhase = 0;
  }
  get stars() { return Math.round(this.heatValue); }
  addHeat(a) {
    if (this.busted) return;
    this.heatValue = Math.min(5, this.heatValue + a); this.heat = this.stars;
    this.cooldownTimer = 12 + this.heatValue * 6; this.escalationTimer = 0;
  }
  clearHeat() { this.heatValue = 0; this.heat = 0; this.cooldownTimer = 0; this.syncForces(); }
  wantedLabel() { return this.heat <= 0 ? 'PVPD: CLEAR' : `PVPD: ${'★'.repeat(this.heat)}${'☆'.repeat(5 - this.heat)}`; }
  tacticalUnits(p) {
    const r = [];
    if (this.heli) r.push({ callsign: 'HAWKEYE-1', distMeters: Math.round(this.heliPos.distanceTo(new T.Vector3(p.x, this.heliPos.y, p.z))), action: 'SPOTLIGHT ON YOU', kind: 'heli' });
    this.pursuers.slice(0, 3).forEach((u, i) => {
      const d = Math.round(u.controller.pos.distanceTo(new T.Vector3(p.x, u.controller.pos.y, p.z)));
      r.push({ callsign: `INTERCEPTOR-${11 + i * 13}`, distMeters: d, action: d < 45 ? 'RAMMING' : 'PURSUIT', kind: 'cruiser' });
    });
    return r.slice(0, 4);
  }
  spawnPursuer(n) {
    const m = createVehicleMesh('pvpd_interceptor', 0x10233a);
    const c = new VehiclePhysicsController(m, 'pvpd_interceptor', this.colliders);
    c.ensureParticlePool(this.scene);
    const a = this.rng() * Math.PI * 2;
    c.reset(n.x + Math.cos(a) * 60, n.z + Math.sin(a) * 60, a); this.scene.add(m);
    const s = new T.PointLight(0xff3333, 26, 34, 1.8); m.add(s); s.position.set(0, 2.6, 0);
    this.pursuers.push({ mesh: m, controller: c, siren: s });
  }
  spawnOfficer(x, z) {
    const r = buildOfficerRig(); r.position.set(x, 0, z); this.scene.add(r);
    this.officers.push({ rig: r, pos: r.position, heading: 0, fireTimer: 1 + this.rng() * 2, phase: this.rng() * 10 });
  }
  spawnRoadblock(at) {
    const g = buildRoadblock();
    let b = ROAD_NETWORK.boulevards[0], best = Infinity;
    for (const q of ROAD_NETWORK.boulevards) { const d = Math.abs(q.z - at.z); if (d < best) { best = d; b = q; } }
    g.position.set(at.x, 0, b.z + 40); this.scene.add(g); this.roadblocks.push(g);
    for (const sx of [-4, 4]) this.spawnOfficer(g.position.x + sx, g.position.z + 5);
  }
  syncForces() {
    const w = this.heat <= 0 ? 0 : this.heat <= 1 ? 1 : this.heat <= 2 ? 2 : this.heat <= 3 ? 3 : 4;
    while (this.pursuers.length < w && this.lastPlayer) this.spawnPursuer(this.lastPlayer);
    while (this.officers.length > w * 2) this.scene.remove(this.officers.pop().rig);
    if (this.heat >= 3 && !this.heli) {
      this.heli = createHawkHelicopter(); this.scene.add(this.heli);
      this.heliPos.set(this.lastPlayer.x + 40, 55, this.lastPlayer.z - 40); this.heli.position.copy(this.heliPos);
    }
    if (this.heat < 3 && this.heli) { this.scene.remove(this.heli); this.heli = null; }
    const wb = this.heat >= 3 ? Math.min(3, this.heat - 2) : 0;
    while (this.roadblocks.length < wb && this.lastPlayer) this.spawnRoadblock(this.lastPlayer);
    while (this.roadblocks.length > wb) this.scene.remove(this.roadblocks.pop());
  }
  update(dt, pp, pc, el = 0) {
    this.lastPlayer = pp.clone(); this.sirenPhase += dt * 9;
    if (this.heatValue > 0 && !this.busted) {
      this.escalationTimer += dt;
      this.cooldownTimer -= dt * (pc?.inVehicle && Math.abs(pc.inVehicle.speed) > 30 ? -0.5 : 1);
      if (this.escalationTimer > 25 && this.heatValue < 5) { this.heatValue = Math.min(5, this.heatValue + 1); this.escalationTimer = 0; this.cooldownTimer = 14 + this.heatValue * 6; }
      if (this.cooldownTimer <= 0) { this.heatValue = Math.max(0, this.heatValue - 1); this.cooldownTimer = this.heatValue > 0 ? 12 : 0; }
      this.heat = this.stars; this.syncForces();
    } else if (this.heatValue === 0 && (this.pursuers.length || this.heli || this.roadblocks.length)) this.syncForces();
    const on = Math.sin(this.sirenPhase) > 0;
    for (const p of this.pursuers) {
      const c = p.controller, to = new T.Vector3().subVectors(pp, c.pos); to.y = 0;
      const dist = to.length;
      let dh = Math.atan2(-to.x, -to.z) - c.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      c.update(dt, { throttle: dist > 7 ? 1 : 0.25, steer: Math.max(-1, Math.min(1, dh * 2)), handbrake: Math.abs(dh) > 1.1, nitro: dist > 60 });
      if (dist < 4.5 && pc && !pc.dead) pc.damage(dt * 6);
      p.siren.color.setHex(on ? 0xff2222 : 0x2255ff);
    }
    for (const o of this.officers) {
      const to = new T.Vector3().subVectors(pp, o.pos); to.y = 0;
      const dist = to.length, j = o.rig.userData.joints;
      o.heading = Math.atan2(-to.x, -to.z); o.rig.rotation.y = o.heading; o.phase += dt * 6;
      j.armR.shoulder.rotation.x = -Math.PI / 2; j.armL.shoulder.rotation.x = -Math.PI / 2 + 0.3;
      j.legL.hip.rotation.x = Math.sin(o.phase) * 0.08; j.legR.hip.rotation.x = -Math.sin(o.phase) * 0.08;
      o.fireTimer -= dt;
      if (o.fireTimer <= 0 && dist < 70 && pc && !pc.dead) {
        o.fireTimer = 1.4 + this.rng() * 1.6;
        if (this.rng() < 0.45) pc.damage(4 + this.rng() * 7);
        if (j) j.flashTimer = 0.06;
      }
      if (j?.flashTimer > 0) { j.flashTimer -= dt; j.muzzleFlash.material.opacity = 0.9; }
      else if (j) j.muzzleFlash.material.opacity = 0;
    }
    for (const rb of this.roadblocks) rb.userData.flash.color.setHex(Math.sin(el * 10 + rb.position.x) > 0 ? 0xff3333 : 0x2255ff);
    if (this.heli) {
      this.heliPos.lerp(new T.Vector3(pp.x + Math.cos(el * 0.25) * 46, 52 + Math.sin(el * 0.6) * 4, pp.z + Math.sin(el * 0.25) * 46), Math.min(1, dt * 1.4));
      this.heli.position.copy(this.heliPos);
      this.heli.rotation.y = Math.atan2(-(pp.x - this.heliPos.x), -(pp.z - this.heliPos.z));
      const u = this.heli.userData, rs = Math.sin(el * 14) > 0;
      u.mainRotor.rotation.y += dt * 28; u.tailRotor.rotation.x += dt * 34;
      u.strobe.intensity = 10 + Math.sin(el * 12) * 10;
      u.cone.rotation.set(Math.min(0.45, Math.hypot(pp.x - this.heliPos.x, pp.z - this.heliPos.z) / 120), 0, 0);
      u.cone.material.opacity = 0.13 + Math.sin(el * 7) * 0.04;
      u.strobeRed.material.opacity = rs ? 0.9 : 0.1; u.strobeBlue.material.opacity = rs ? 0.1 : 0.9;
    }
    return { stars: this.heat, busted: this.busted };
  }
}
export function createHawkHelicopter() {
  const R = new T.Group(), nv = new T.MeshStandardMaterial({ color: 0x10233a, roughness: 0.4, metalness: 0.4 });
  const bd = new T.Mesh(new T.SphereGeometry(1.6, 18, 12), nv);
  bd.scale.set(1, 0.85, 1.9); bd.castShadow = true; R.add(bd);
  const be = new T.Mesh(new T.SphereGeometry(1.45, 14, 10), new T.MeshStandardMaterial({ color: 0xf2f2f5, roughness: 0.5 }));
  be.scale.set(0.9, 0.55, 1.6); be.position.y = -0.7; R.add(be);
  const no = new T.Mesh(new T.SphereGeometry(1.0, 14, 10), new T.MeshPhongMaterial({ color: 0x0a1626, shininess: 180, specular: 0x9be9ff, transparent: true, opacity: 0.92 }));
  no.position.set(0, 0.35, -1.7); no.scale.set(0.85, 0.65, 0.7); R.add(no);
  const ta = new T.Mesh(new T.CylinderGeometry(0.35, 0.5, 6, 8), nv); ta.rotation.x = Math.PI / 2; P2(R, ta, 0, 0.5, 4.6);
  P2(R, new T.Mesh(new T.BoxGeometry(0.2, 1.6, 1.0), nv), 0, 1.3, 7.2);
  P2(R, new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 0.8, 8), nv), 0, 1.9, 0);
  const mn = new T.Group();
  for (let i = 0; i < 4; i += 1) { const b = new T.Mesh(new T.BoxGeometry(11, 0.08, 0.45), new T.MeshLambertMaterial({ color: 0x1a1a24 })); b.rotation.y = (i * Math.PI) / 4; mn.add(b); }
  P2(R, mn, 0, 2.3, 0);
  const dc = new T.Mesh(new T.CircleGeometry(5.5, 28), new T.MeshBasicMaterial({ color: 0xcfd8ff, transparent: true, opacity: 0.10, side: T.DoubleSide, depthWrite: false }));
  dc.rotation.x = -Math.PI / 2; P2(R, dc, 0, 2.32, 0);
  const tr = new T.Group();
  for (let i = 0; i < 2; i += 1) { const b = new T.Mesh(new T.BoxGeometry(0.12, 2.2, 0.18), new T.MeshLambertMaterial({ color: 0x1a1a24 })); b.rotation.z = (i * Math.PI) / 2; tr.add(b); }
  P2(R, tr, 0.4, 1.3, 7.2);
  for (const sx of [-1.2, 1.2]) {
    P2(R, new T.Mesh(new T.BoxGeometry(0.18, 0.18, 3.4), new T.MeshLambertMaterial({ color: 0x33333f })), sx, -1.5, 0);
    for (const sz of [-1.2, 1.2]) P2(R, new T.Mesh(new T.BoxGeometry(0.18, 0.9, 0.18), nv), sx, -1.1, sz);
  }
  P2(R, new T.Mesh(new T.BoxGeometry(3.24, 0.22, 1.2), new T.MeshBasicMaterial({ color: 0xf2f2f5 })), 0, 0.1, -0.6);
  const sh = new T.Mesh(new T.PlaneGeometry(1.5, 0.7), new T.MeshBasicMaterial({ color: 0xffd97a }));
  P2(R, sh, 0, 0.1, -1.85); sh.rotation.y = Math.PI;
  const co = new T.Mesh(new T.ConeGeometry(7, 42, 20, 1, true), new T.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.16, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending }));
  P2(R, co, 0, -22, 0);
  const sp = new T.SpotLight(0xfff2b0, 900, 120, 0.22, 0.4, 1.2);
  P2(R, sp, 0, -1, 0); R.add(sp.target); sp.target.position.set(0, -44, 0);
  const st = new T.PointLight(0xff2222, 20, 30, 1.8); P2(R, st, 0, 2.2, 0);
  const sr = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color: 0xff2222, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false }));
  sr.scale.set(2.2, 2.2, 1); P2(R, sr, -1.0, 2.3, 0);
  const sb = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color: 0x3355ff, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false }));
  sb.scale.set(2.2, 2.2, 1); P2(R, sb, 1.0, 2.3, 0);
  Object.assign(R.userData, { mainRotor: mn, tailRotor: tr, cone: co, strobe: st, strobeRed: sr, strobeBlue: sb });
  return R;
}
function P2(p, m, x, y, z) { m.position.set(x, y, z); p.add(m); return m; }
function buildOfficerRig() {
  const r = createCharacterRig({ skin: 0xc98a5e, top: 0x10233a, bottom: 0x10233a, hair: 0x111111, hat: true });
  const b = new T.Mesh(new T.CircleGeometry(0.06, 10), new T.MeshBasicMaterial({ color: 0xffd97a }));
  P2(r.userData.joints.torso, b, 0.14, 0.45, -0.17); b.rotation.y = Math.PI;
  return r;
}
function buildRoadblock() {
  const g = new T.Group();
  for (const sx of [-3.4, 0, 3.4]) {
    P2(g, new T.Mesh(new T.BoxGeometry(2.4, 1.4, 4.6), new T.MeshStandardMaterial({ color: 0x10233a, roughness: 0.4, metalness: 0.3 })), sx, 1.0, 0).castShadow = true;
    P2(g, new T.Mesh(new T.BoxGeometry(1.4, 0.25, 0.25), new T.MeshBasicMaterial({ color: sx === 0 ? 0xff2222 : 0x2255ff })), sx, 1.9, 0);
  }
  P2(g, new T.Mesh(new T.BoxGeometry(10, 0.12, 1.2), new T.MeshLambertMaterial({ color: 0xd8d8e2 })), 0, 0.1, 3.5);
  const f = new T.PointLight(0xff3333, 30, 40, 1.8); P2(g, f, 0, 4, 0); g.userData.flash = f;
  return g;
}
let _g = null;
function glowTex() {
  if (_g) return _g;
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 1, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  _g = new T.CanvasTexture(c); _g.minFilter = T.LinearFilter; _g.magFilter = T.LinearFilter; _g.generateMipmaps = false;
  return _g;
}
