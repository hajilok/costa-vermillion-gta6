// Chase and over-the-shoulder camera. On foot while aiming the camera
// slides to a parallel right-shoulder offset: right = (-fwd.z, 0, fwd.x).

import * as THREE from '../vendor/three.module.min.js';

export class DynamicCameraController {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3(0, 8, 14);
    this.look = new THREE.Vector3(0, 1, 0);
    this.shake = 0;
  }

  update(focus, opts) {
    const o = opts || {};
    const mode = o.mode || 'chase';
    const aiming = !!o.aiming;
    const fx = Math.sin(focus.heading);
    const fz = Math.cos(focus.heading);
    // Forward on the ground plane; heading 0 faces -Z so negate for look dir.
    const fwd = new THREE.Vector3(-Math.sin(focus.heading), 0, -Math.cos(focus.heading));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);

    let desired;
    let lookAt;
    if (mode === 'foot' && aiming) {
      const base = new THREE.Vector3(focus.x, 0, focus.z);
      desired = base
        .clone()
        .addScaledVector(right, 1.05)
        .add(new THREE.Vector3(0, 1.68, 0))
        .addScaledVector(fwd, 3.3);
      lookAt = base.clone().addScaledVector(fwd, -8).add(new THREE.Vector3(0, 1.4, 0));
    } else if (mode === 'boat' || mode === 'drive') {
      const dist = mode === 'boat' ? 13 : 9.5;
      const height = mode === 'boat' ? 5.5 : 3.6;
      desired = new THREE.Vector3(
        focus.x + Math.sin(focus.heading) * dist,
        height,
        focus.z + Math.cos(focus.heading) * dist
      );
      lookAt = new THREE.Vector3(focus.x - Math.sin(focus.heading) * 8, 1.4, focus.z - Math.cos(focus.heading) * 8);
    } else if (mode === 'heli') {
      desired = new THREE.Vector3(focus.x + 10, 7, focus.z + 12);
      lookAt = new THREE.Vector3(focus.x, 1.5, focus.z);
    } else {
      desired = new THREE.Vector3(
        focus.x + Math.sin(focus.heading) * 7.5,
        3.2,
        focus.z + Math.cos(focus.heading) * 7.5
      );
      lookAt = new THREE.Vector3(focus.x - Math.sin(focus.heading) * 9, 1.5, focus.z - Math.cos(focus.heading) * 9);
    }

    if (this.shake > 0) {
      desired.x += (Math.random() - 0.5) * this.shake;
      desired.y += (Math.random() - 0.5) * this.shake * 0.5;
      this.shake = Math.max(0, this.shake - 0.06);
    }

    const k = 1 - Math.pow(0.0001, 1 / 60);
    this.pos.lerp(desired, Math.min(1, k * 1.4));
    this.look.lerp(lookAt, Math.min(1, k * 1.8));
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }

  addShake(amount) {
    this.shake = Math.min(1.2, this.shake + amount);
  }
}
