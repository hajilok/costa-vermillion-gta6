// PVPD heat and pursuit: 0-5 star wanted level, ground pursuers plus the
// Hawk helicopter with its tracking spotlight cone.

import * as THREE from '../vendor/three.module.min.js';

export class WantedAndPoliceDirector {
  constructor(scene) {
    this.scene = scene;
    this.stars = 0;
    this.heat = 0;
    this.pursuers = [];
    this.spawnTimer = 0;
    this.heli = this.buildHawkHelicopter();
    this.heli.visible = false;
    if (scene) scene.add(this.heli);
  }

  buildHawkHelicopter() {
    const heli = new THREE.Group();
    const navy = new THREE.MeshStandardMaterial({ color: 0x1b2a4a, metalness: 0.6, roughness: 0.35 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, metalness: 0.4, roughness: 0.4 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 4.2), navy);
    body.position.y = 0;
    body.castShadow = true;
    heli.add(body);
    const belly = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 3.4), white);
    belly.position.y = -0.8;
    heli.add(belly);
    const cockpit = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 14, 12),
      new THREE.MeshStandardMaterial({ color: 0x9fd8e8, metalness: 0.85, roughness: 0.12 })
    );
    cockpit.scale.set(1, 0.75, 1.25);
    cockpit.position.set(0, 0.25, -1.7);
    heli.add(cockpit);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.28, 3.0), white);
    stripe.position.set(0, 0.1, 0.3);
    heli.add(stripe);

    const skidMat = new THREE.MeshStandardMaterial({ color: 0x2a2e36, metalness: 0.8, roughness: 0.4 });
    for (const side of [-1, 1]) {
      const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.6, 8), skidMat);
      skid.rotation.x = Math.PI / 2;
      skid.position.set(side * 1.15, -1.5, -0.2);
      heli.add(skid);
      for (const dz of [-1.2, 0.8]) {
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 8), skidMat);
        strut.position.set(side * 1.0, -1.1, dz);
        strut.rotation.z = side * 0.3;
        heli.add(strut);
      }
    }

    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.5, 5.2, 10), navy);
    boom.rotation.x = Math.PI / 2;
    boom.position.set(0, 0.35, 4.4);
    heli.add(boom);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.6, 0.8), white);
    fin.position.set(0, 1.1, 6.8);
    heli.add(fin);
    const tailRotor = new THREE.Group();
    for (let i = 0; i < 2; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.7, 0.1), skidMat);
      blade.rotation.z = (i / 2) * Math.PI;
      tailRotor.add(blade);
    }
    tailRotor.position.set(0.25, 1.0, 6.8);
    tailRotor.rotation.y = Math.PI / 2;
    heli.add(tailRotor);
    heli.userData.tailRotor = tailRotor;

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.0, 8), skidMat);
    mast.position.y = 1.1;
    heli.add(mast);
    const rotor = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.08, 0.5), skidMat);
      blade.rotation.y = (i / 4) * Math.PI;
      rotor.add(blade);
    }
    rotor.position.y = 1.6;
    heli.add(rotor);
    heli.userData.rotor = rotor;
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(4.9, 28),
      new THREE.MeshBasicMaterial({ color: 0xcfd8e3, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 1.62;
    heli.add(disc);

    const strobe = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff3333 })
    );
    strobe.position.set(0, -1.1, 0.5);
    heli.add(strobe);
    heli.userData.strobe = strobe;

    const coneGeo = new THREE.ConeGeometry(7, 26, 20, 1, true);
    coneGeo.translate(0, -13, 0);
    const cone = new THREE.Mesh(
      coneGeo,
      new THREE.MeshBasicMaterial({
        color: 0xfff2c0,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    cone.position.set(0, -1.0, -0.5);
    heli.add(cone);
    heli.userData.cone = cone;

    heli.userData.update = (t, dt) => {
      rotor.rotation.y += dt * 22;
      tailRotor.rotation.x += dt * 30;
      const blink = Math.sin(t * 9) > 0.2;
      strobe.material.color.setHex(blink ? 0xffffff : 0xff3333);
      strobe.scale.setScalar(blink ? 1.7 : 1);
      cone.material.opacity = 0.18 + Math.sin(t * 3.1) * 0.05;
    };

    return heli;
  }

  wantedLabel() {
    if (this.stars <= 0) return 'CLEAN';
    return `${this.stars} STAR${this.stars > 1 ? 'S' : ''}`;
  }

  addHeat(amount) {
    this.heat = Math.min(100, this.heat + amount);
    const next = Math.min(5, Math.floor(this.heat / 20));
    if (next > this.stars) this.stars = next;
  }

  clearHeat() {
    this.stars = 0;
    this.heat = 0;
    for (const p of this.pursuers) {
      if (p.mesh && this.scene) this.scene.remove(p.mesh);
    }
    this.pursuers.length = 0;
    if (this.heli) this.heli.visible = false;
  }

  spawnPursuer(playerPos, kind) {
    const useHeli = kind === 'heli' || (this.stars >= 3 && this.pursuers.length >= 2 && !this.heli.visible);
    if (useHeli) {
      this.heli.visible = true;
      this.heli.position.set(playerPos.x + 30, 46, playerPos.z - 40);
      return { kind: 'heli', mesh: this.heli, callsign: 'HAWKEYE-1' };
    }
    const id = this.pursuers.length + 11;
    const pursuer = {
      kind: 'car',
      callsign: `INTERCEPTOR-${id}`,
      x: playerPos.x + (Math.random() - 0.5) * 120,
      z: playerPos.z + 60 + Math.random() * 60,
      speed: 30 + this.stars * 5,
      mesh: null,
    };
    this.pursuers.push(pursuer);
    return pursuer;
  }

  syncForces(playerPos, dt) {
    this.spawnTimer -= dt;
    const want = Math.min(4, this.stars);
    if (this.stars > 0 && this.pursuers.length < want && this.spawnTimer <= 0) {
      this.spawnPursuer(playerPos, this.stars >= 3 ? 'heli' : 'car');
      this.spawnTimer = 4;
    }
    if (this.stars >= 3 && !this.heli.visible) this.spawnPursuer(playerPos, 'heli');
    if (this.stars < 3 && this.heli.visible) this.heli.visible = false;
    if (this.heli.visible) {
      const hx = playerPos.x + 18;
      const hz = playerPos.z - 26;
      this.heli.position.x += (hx - this.heli.position.x) * Math.min(1, dt * 0.8);
      this.heli.position.z += (hz - this.heli.position.z) * Math.min(1, dt * 0.8);
      this.heli.position.y = 44 + Math.sin(performance.now() / 900) * 2;
      this.heli.userData.update(performance.now() / 1000, dt);
      this.heli.userData.cone.lookAt(playerPos.x, 0, playerPos.z);
    }
    if (this.stars === 0 && this.heli.visible) this.heli.visible = false;
  }

  tacticalUnits(playerPos) {
    const rows = [];
    if (this.stars >= 3) {
      rows.push({
        callsign: 'HAWKEYE-1',
        distMeters: Math.round(this.heli.visible ? Math.hypot(this.heli.position.x - playerPos.x, this.heli.position.z - playerPos.z) : 120),
        action: 'SPOTLIGHT ON YOU',
        kind: 'heli',
      });
    }
    const count = Math.min(3, Math.max(0, this.pursuers.length));
    for (let i = 0; i < count && rows.length < 4; i++) {
      const p = this.pursuers[i];
      const dist = Math.round(Math.hypot((p.x ?? playerPos.x) - playerPos.x, (p.z ?? playerPos.z) - playerPos.z));
      const action = i === 0 && this.stars >= 2 ? 'RAMMING' : this.stars >= 4 ? 'BOXING IN' : 'IN PURSUIT';
      rows.push({ callsign: p.callsign || `INTERCEPTOR-1${i}`, distMeters: dist, action, kind: 'car' });
    }
    while (rows.length < Math.min(4, this.stars) && rows.length < 4) {
      rows.push({
        callsign: `INTERCEPTOR-2${rows.length}`,
        distMeters: 80 + rows.length * 25,
        action: 'RESPONDING',
        kind: 'car',
      });
    }
    return rows.slice(0, 4);
  }
}
