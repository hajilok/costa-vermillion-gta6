// Costa Vermillion: Sunset Syndicate — chase / aim / cinematic camera rig.
// 100% original content. Imports only 'three'.
import * as THREE from 'three';

// Smooth vehicle/boat chase cam, over-shoulder foot aim cam, mouse orbit,
// snapImmediate for teleports, setCinematicOverride for staged shots.
export class DynamicCameraController {
  constructor(camera, opts = {}) {
    this.camera = camera;
    this.yaw = opts.yaw ?? Math.PI;
    this.pitch = opts.pitch ?? 0.32;
    this.dist = opts.dist ?? 9;
    this.mouseYaw = 0;
    this.mousePitch = 0;
    this.useMouse = true;
    this.cinematic = null; // { pos, look, fov, ttl }
    this.pos = new THREE.Vector3(0, 8, 14);
    this.look = new THREE.Vector3();
    this.fovKick = 0;
    this.shake = 0;
    camera.fov = 62;
    camera.updateProjectionMatrix();
  }

  addMouse(dx, dy) {
    if (!this.useMouse || this.cinematic) return;
    this.mouseYaw -= dx * 0.0032;
    this.mousePitch = Math.max(-0.9, Math.min(0.9, this.mousePitch + dy * 0.0026));
  }

  snapImmediate(targetPos, heading = 0) {
    const back = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    this.pos.copy(targetPos).addScaledVector(back, this.dist).add(new THREE.Vector3(0, 4.5, 0));
    this.look.copy(targetPos);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
    this.yaw = heading;
    this.mouseYaw = 0;
    this.mousePitch = 0;
  }

  setCinematicOverride(shot) {
    // shot: { pos, look, fov } or null to release.
    this.cinematic = shot;
    if (shot?.fov) {
      this.camera.fov = shot.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  addShake(amount) {
    this.shake = Math.min(1.5, this.shake + amount);
  }

  // focus: { pos, heading, speed, aiming, driving, boat }
  update(dt, focus) {
    if (this.cinematic) {
      this.camera.position.lerp(this.cinematic.pos, Math.min(1, dt * 2));
      this.look.lerp(this.cinematic.look, Math.min(1, dt * 2.5));
      this.camera.lookAt(this.look);
      if (this.cinematic.ttl !== undefined) {
        this.cinematic.ttl -= dt;
        if (this.cinematic.ttl <= 0) this.cinematic = null;
      }
      return;
    }
    const speed = Math.abs(focus.speed || 0);
    this.yaw += (focus.heading - this.yaw) * Math.min(1, dt * (focus.driving ? 2.2 : 8));
    const yaw = this.yaw + this.mouseYaw;
    const wantFov = 62 + Math.min(16, speed * 0.32) + (focus.nitro ? 5 : 0);
    this.camera.fov += (wantFov - this.camera.fov) * Math.min(1, dt * 3);
    this.camera.updateProjectionMatrix();

    let dist = this.dist;
    let height = 4.2;
    let side = 0;
    if (!focus.driving && focus.aiming) {
      // Right-shoulder aim cam: 1.05m right, 1.68m up, 3.3m back, so the
      // #aim-reticle sits in open space ahead of Elena, never on her head.
      dist = 3.3;
      height = 1.68;
      side = 1.05;
    } else if (!focus.driving) {
      dist = 6.4;
      height = 3.2;
    } else if (focus.boat) {
      dist = 13;
      height = 6;
    } else {
      dist = 9.5 + Math.min(3, speed * 0.05);
      height = 4.4;
    }
    const back = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new THREE.Vector3(-back.z, 0, back.x);
    const wantPos = focus.pos.clone().addScaledVector(back, dist).add(new THREE.Vector3(0, 0, 0));
    wantPos.y = Math.max(1.6, focus.pos.y + height + this.mousePitch * 4);
    wantPos.addScaledVector(right, side);
    const k = Math.min(1, dt * (focus.aiming && !focus.driving ? 14 : 6));
    this.pos.lerp(wantPos, k);
    const wantLook = focus.pos.clone();
    wantLook.y += focus.driving ? 1.6 : 1.45;
    wantLook.addScaledVector(right, side * 0.6);
    if (focus.aiming && !focus.driving) {
      wantLook.addScaledVector(back, -8);
    } else {
      wantLook.addScaledVector(back, -4);
    }
    this.look.lerp(wantLook, Math.min(1, dt * 9));
    this.camera.position.copy(this.pos);
    if (this.shake > 0.01) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.5;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.4;
      this.shake *= 1 - Math.min(1, dt * 5);
    }
    this.camera.lookAt(this.look);
  }
}
