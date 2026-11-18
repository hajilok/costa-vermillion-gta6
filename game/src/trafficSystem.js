// Ambient city life: span-clipped land traffic, marina boats, and the
// Coral Mod Garage showcase row. Cars U-turn at bay and island endpoints.

import * as THREE from '../vendor/three.module.min.js';
import { ROAD_NETWORK, isWater, landmarkById } from './cityConfig.js';
import { createVehicleMesh, VehiclePhysicsController } from './vehicleSystem.js';

const LAND_IDS = ['veloce_gt', 'brisa_cabrio', 'boveda_armored', 'dune_titan', 'sol_moto', 'pvpd_interceptor'];

function avenueById(id) {
  return ROAD_NETWORK.avenues.find((a) => a.id === id);
}

function boulevardById(id) {
  return ROAD_NETWORK.boulevards.find((b) => b.id === id);
}

export class CityTrafficManager {
  constructor(scene, rand) {
    this.scene = scene;
    this.rand = rand || Math.random;
    this.cars = [];
    this.boats = [];
    this.showcase = [];
    this.t = 0;
  }

  spawnLandTraffic() {
    const avenues = ROAD_NETWORK.avenues.filter((a) => !['ave_bahia', 'ave_keys'].includes(a.id));
    const boulevards = ROAD_NETWORK.boulevards.filter((b) => !['blvd_keys'].includes(b.id));
    for (let i = 0; i < 26; i++) {
      const specId = LAND_IDS[Math.floor(this.rand() * LAND_IDS.length)];
      const mesh = createVehicleMesh(specId);
      const phys = new VehiclePhysicsController(VehiclePhysicsController.specById(specId));
      const vertical = this.rand() < 0.55;
      let x;
      let z;
      let heading;
      if (vertical) {
        const a = avenues[Math.floor(this.rand() * avenues.length)];
        x = a.x + (this.rand() < 0.5 ? -3 : 3);
        z = a.minZ + this.rand() * (a.maxZ - a.minZ);
        heading = this.rand() < 0.5 ? 0 : Math.PI;
      } else {
        const b = boulevards[Math.floor(this.rand() * boulevards.length)];
        x = b.minX + this.rand() * (b.maxX - b.minX);
        z = b.z + (this.rand() < 0.5 ? -3 : 3);
        heading = this.rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      }
      if (isWater(x, z)) {
        x = avenueById('ave_central').x - 3;
        z = 0;
      }
      phys.x = x;
      phys.z = z;
      phys.heading = heading;
      phys.speed = 8 + this.rand() * 10;
      mesh.position.set(x, 0, z);
      mesh.rotation.y = heading;
      if (this.scene) this.scene.add(mesh);
      this.cars.push({ mesh, phys, vertical, speed: phys.speed, lane: vertical ? x : z });
    }
    return this.cars.length;
  }

  spawnMarinaBoats() {
    const spots = [
      { x: 230, z: -300 },
      { x: 290, z: -180 },
      { x: 250, z: -60 },
      { x: 340, z: -260 },
      { x: 220, z: -420 },
    ];
    for (const s of spots) {
      const mesh = createVehicleMesh('marea_speedboat');
      mesh.position.set(s.x, 0.24, s.z);
      mesh.rotation.y = this.rand() * Math.PI * 2;
      if (this.scene) this.scene.add(mesh);
      this.boats.push({ mesh, x: s.x, z: s.z, heading: mesh.rotation.y, speed: 4 + this.rand() * 4, t: this.rand() * 10 });
    }
    return this.boats.length;
  }

  spawnShowcase() {
    const garage = landmarkById('coral_mod_garage');
    const gx = garage ? garage.x : -40;
    const gz = garage ? garage.z : 60;
    const ids = ['veloce_gt', 'brisa_cabrio', 'dune_titan'];
    ids.forEach((id, i) => {
      const mesh = createVehicleMesh(id);
      mesh.position.set(gx - 8 + i * 8, 0, gz - 10);
      mesh.rotation.y = Math.PI;
      if (this.scene) this.scene.add(mesh);
      this.showcase.push(mesh);
    });
    return this.showcase.length;
  }

  spawnAll() {
    this.spawnLandTraffic();
    this.spawnMarinaBoats();
    this.spawnShowcase();
    return this;
  }

  update(dt) {
    this.t += dt;
    for (const car of this.cars) {
      const step = car.speed * dt;
      car.phys.x += -Math.sin(car.phys.heading) * step;
      car.phys.z += -Math.cos(car.phys.heading) * step;
      let blocked = isWater(car.phys.x, car.phys.z);
      if (car.vertical) {
        const runners = ROAD_NETWORK.avenues.filter((a) => Math.abs(a.x - car.lane) < 5);
        const a = runners[0];
        if (a && (car.phys.z < a.minZ + 4 || car.phys.z > a.maxZ - 4)) blocked = true;
        const keys = boulevardById('blvd_keys');
        if (keys && car.lane > 400 && (car.phys.z < -520 || car.phys.z < keys.z - 60)) blocked = blocked || false;
      } else {
        const runners = ROAD_NETWORK.boulevards.filter((b) => Math.abs(b.z - car.lane) < 5);
        const b = runners[0];
        if (b && (car.phys.x < b.minX + 4 || car.phys.x > b.maxX - 4)) blocked = true;
      }
      if (blocked) {
        car.phys.heading += Math.PI;
        car.phys.x += -Math.sin(car.phys.heading) * step * 2;
        car.phys.z += -Math.cos(car.phys.heading) * step * 2;
      }
      car.mesh.position.set(car.phys.x, 0, car.phys.z);
      car.mesh.rotation.y = car.phys.heading;
      const wheels = car.mesh.userData.wheels || [];
      for (const w of wheels) {
        if (w.userData.tire) w.userData.tire.rotation.x += (car.speed * dt) / 0.42;
      }
    }
    for (const boat of this.boats) {
      boat.t += dt;
      boat.heading += Math.sin(boat.t * 0.3) * dt * 0.25;
      const nx = boat.x + -Math.sin(boat.heading) * boat.speed * dt;
      const nz = boat.z + -Math.cos(boat.heading) * boat.speed * dt;
      if (isWater(nx, nz)) {
        boat.x = nx;
        boat.z = nz;
      } else {
        boat.heading += Math.PI / 2;
      }
      boat.mesh.position.set(boat.x, 0.24 + Math.sin(boat.t * 1.8) * 0.08, boat.z);
      boat.mesh.rotation.y = boat.heading;
      if (boat.mesh.userData.wake) {
        boat.mesh.userData.wake.material.opacity = 0.45 + Math.sin(boat.t * 2.4) * 0.15;
      }
    }
  }
}
