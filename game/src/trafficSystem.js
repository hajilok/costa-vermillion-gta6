// Costa Vermillion: Sunset Syndicate — ambient + hijackable city traffic.
// 100% original content. Imports only 'three', './cityConfig.js', './vehicleSystem.js'.
import * as THREE from 'three';
import { LANDMARKS, ROAD_NETWORK, VEHICLE_IDS, VEHICLE_SPECS, WORLD_BOUNDS, isWater } from './cityConfig.js';
import { VehiclePhysicsController, createVehicleMesh } from './vehicleSystem.js';

export class CityTrafficManager {
  constructor(scene, rng, colliders = [], movingCount = 28) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = colliders;
    this.vehicles = []; // { mesh, controller, specId, ai: {...} | null, parked, hijacked }
    this.spawnTimer = 0;

    for (let i = 0; i < movingCount; i += 1) {
      this.spawnTrafficVehicle(true);
    }
    this.spawnParkedBoats();
    this.spawnHeroCars();
  }

  roadById(kind, id) {
    const list = kind === 'avenue' ? ROAD_NETWORK.avenues : ROAD_NETWORK.boulevards;
    return list.find((r) => r.id === id) || null;
  }

  clampToRoad(x, z) {
    // Pull a point back inside the nearest span-clipped, dry road segment.
    let best = null;
    let bestD = Infinity;
    for (const ave of ROAD_NETWORK.avenues) {
      const zMin = ave.minZ ?? WORLD_BOUNDS.minZ;
      const zMax = ave.maxZ ?? 590;
      const cz = Math.max(zMin, Math.min(zMax, z));
      const d = Math.hypot(x - ave.x, z - cz);
      if (d < bestD) {
        bestD = d;
        best = { x: ave.x, z: cz };
      }
    }
    for (const blvd of ROAD_NETWORK.boulevards) {
      const xMin = blvd.minX ?? WORLD_BOUNDS.minX;
      const xMax = blvd.maxX ?? WORLD_BOUNDS.maxX;
      const cx = Math.max(xMin, Math.min(xMax, x));
      const d = Math.hypot(x - cx, z - blvd.z);
      if (d < bestD) {
        bestD = d;
        best = { x: cx, z: blvd.z };
      }
    }
    return best || { x, z };
  }

  pickLanePoint() {
    const r = this.rng;
    // Land traffic only: sample span-clipped dry asphalt, never bay/ocean water.
    for (let tries = 0; tries < 16; tries += 1) {
      if (r() < 0.42) {
        const ave = ROAD_NETWORK.avenues[Math.floor(r() * ROAD_NETWORK.avenues.length)];
        const dir = r() < 0.5 ? 1 : -1;
        const zMin = ave.minZ ?? WORLD_BOUNDS.minZ;
        const zMax = ave.maxZ ?? 590;
        const z = zMin + 8 + r() * Math.max(1, zMax - zMin - 16);
        const x = ave.x + dir * ROAD_NETWORK.laneOffset;
        if (isWater(x, z)) continue;
        return {
          x, z,
          heading: dir > 0 ? Math.PI : 0,
          road: { kind: 'avenue', id: ave.id },
          dir,
        };
      }
      const blvd = ROAD_NETWORK.boulevards[Math.floor(r() * ROAD_NETWORK.boulevards.length)];
      const dir = r() < 0.5 ? 1 : -1;
      const xMin = blvd.minX ?? WORLD_BOUNDS.minX;
      const xMax = blvd.maxX ?? WORLD_BOUNDS.maxX;
      const x = xMin + 8 + r() * Math.max(1, xMax - xMin - 16);
      const z = blvd.z + dir * ROAD_NETWORK.laneOffset;
      if (isWater(x, z)) continue;
      return {
        x, z,
        heading: dir > 0 ? -Math.PI / 2 : Math.PI / 2,
        road: { kind: 'boulevard', id: blvd.id },
        dir,
      };
    }
    return {
      x: ROAD_NETWORK.avenues[0].x + ROAD_NETWORK.laneOffset,
      z: 0,
      heading: 0,
      road: { kind: 'avenue', id: 'ave_coral' },
      dir: 1,
    };
  }

  spawnTrafficVehicle(anywhere = false, specId = null, at = null) {
    const spec = specId ?? TRAFFIC_SPECS[Math.floor(this.rng() * TRAFFIC_SPECS.length)];
    const mesh = createVehicleMesh(spec, undefined);
    const controller = new VehiclePhysicsController(mesh, spec, this.colliders);
    controller.ensureParticlePool(this.scene);
    const spot = at ?? this.pickLanePoint();
    controller.reset(spot.x, spot.z, spot.heading);
    controller.speed = 8 + this.rng() * 8;
    this.scene.add(mesh);
    const v = {
      mesh,
      controller,
      specId: spec,
      parked: false,
      hijacked: false,
      aiLocked: false,
      ai: {
        road: spot.road ?? { kind: 'avenue', id: 'ave_central' },
        dir: spot.dir ?? 1,
        cruise: 9 + this.rng() * 7,
        turnCooldown: 2 + this.rng() * 6,
        bridgeT: -1, // 0..1 while crossing the Flamingo Causeway
      },
    };
    this.vehicles.push(v);
    return v;
  }

  parkCar(spec, x, z, heading, color) {
    // Showcase / hero parking: only on dry land.
    if (isWater(x, z)) {
      const safe = this.clampToRoad(x, z);
      x = safe.x;
      z = safe.z;
    }
    const mesh = createVehicleMesh(spec, color);
    const controller = new VehiclePhysicsController(mesh, spec, this.colliders);
    controller.ensureParticlePool(this.scene);
    controller.reset(x, z, heading);
    controller.speed = 0;
    this.scene.add(mesh);
    this.vehicles.push({ mesh, controller, specId: spec, parked: true, hijacked: false, aiLocked: false, ai: null });
  }

  spawnParkedBoats() {
    // Marina slips off the promenade piers + bay moorings (wet by design).
    const slips = [
      { x: -600, z: -170 }, { x: -600, z: -110 }, { x: -600, z: 60 },
      { x: -600, z: 120 }, { x: -600, z: 280 }, { x: -600, z: 340 },
      { x: 215, z: 60 }, { x: 365, z: -80 },
    ];
    for (const s of slips) {
      if (!isWater(s.x, s.z)) continue;
      const mesh = createVehicleMesh('marea_speedboat', undefined);
      const controller = new VehiclePhysicsController(mesh, 'marea_speedboat', this.colliders);
      controller.ensureParticlePool(this.scene);
      controller.reset(s.x, s.z, this.rng() * Math.PI * 2);
      this.scene.add(mesh);
      this.vehicles.push({ mesh, controller, specId: 'marea_speedboat', parked: true, hijacked: false, aiLocked: false, ai: null });
    }
  }

  spawnHeroCars() {
    const spots = [
      { spec: 'brisa_cabrio', near: 'hotel_mariposa', dx: 18, dz: 12 },
      { spec: 'veloce_gt', near: 'solar_club', dx: -16, dz: 10 },
      { spec: 'dune_titan', near: 'coral_mod_garage', dx: 14, dz: -10 },
      { spec: 'boveda_armored', near: 'bahia_terminal', dx: -20, dz: -8 },
      { spec: 'sol_moto', near: 'harbor_armory', dx: 12, dz: 14 },
      { spec: 'veloce_gt', near: 'starlight_villa', dx: -14, dz: 12 },
    ];
    for (const s of spots) {
      const lm = LANDMARKS.find((l) => l.id === s.near);
      if (!lm) continue;
      this.parkCar(s.spec, lm.pos.x + s.dx, lm.pos.z + s.dz, this.rng() * Math.PI * 2, undefined);
    }
    // Showroom pair staged beside the Coral Mod Garage landmark (-40, 60).
    this.parkCar('brisa_cabrio', -40 + 16, 60 + 8, Math.PI / 2, 0x38e8ff);
    this.parkCar('veloce_gt', -40 - 16, 60 - 8, -Math.PI / 2, 0xffc44d);
  }

  nearestStealable(pos, maxDist = 5.5) {
    let best = null;
    let bestD = maxDist;
    for (const v of this.vehicles) {
      if (v.hijacked || v.aiLocked) continue;
      if (!VEHICLE_SPECS[v.specId]?.stealable) continue;
      const d = Math.hypot(v.controller.pos.x - pos.x, v.controller.pos.z - pos.z);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  // Seamless hand-off: AI driver "flees" (ped removed abstractly), player takes over.
  hijack(vehicle) {
    if (!vehicle || vehicle.hijacked) return null;
    vehicle.hijacked = true;
    vehicle.ai = null;
    vehicle.parked = false;
    vehicle.controller.speed = 0;
    return vehicle.controller;
  }

  release(vehicle) {
    if (!vehicle) return;
    vehicle.hijacked = false;
    if (!vehicle.parked && !vehicle.ai) {
      vehicle.ai = {
        road: { kind: 'avenue', id: 'ave_central' },
        dir: this.rng() < 0.5 ? 1 : -1,
        cruise: 9 + this.rng() * 7,
        turnCooldown: 3,
        bridgeT: -1,
      };
    }
  }

  removeVehicle(vehicle) {
    const i = this.vehicles.indexOf(vehicle);
    if (i >= 0) this.vehicles.splice(i, 1);
    this.scene.remove(vehicle.mesh);
  }

  update(dt, playerPos, playerController) {
    for (const v of this.vehicles) {
      if (v.hijacked || !v.ai) continue;
      const c = v.controller;
      const ai = v.ai;

      // Bridge run: hop onto the Flamingo Causeway when close to an endpoint.
      const b = ROAD_NETWORK.bridge;
      if (ai.bridgeT < 0) {
        const dFrom = Math.hypot(c.pos.x - b.from.x, c.pos.z - b.from.z);
        const dTo = Math.hypot(c.pos.x - b.to.x, c.pos.z - b.to.z);
        if (dFrom < 26) {
          ai.bridgeT = 0;
          ai.bridgeFrom = b.from;
          ai.bridgeTo = b.to;
        } else if (dTo < 26) {
          ai.bridgeT = 0;
          ai.bridgeFrom = b.to;
          ai.bridgeTo = b.from;
        }
      }
      if (ai.bridgeT >= 0) {
        ai.bridgeT += (dt * 14) / Math.hypot(b.to.x - b.from.x, b.to.z - b.from.z);
        const t = Math.min(1, ai.bridgeT);
        c.pos.x = ai.bridgeFrom.x + (ai.bridgeTo.x - ai.bridgeFrom.x) * t;
        c.pos.z = ai.bridgeFrom.z + (ai.bridgeTo.z - ai.bridgeFrom.z) * t;
        c.pos.y = b.deckY + 0.35;
        c.heading = Math.atan2(-(ai.bridgeTo.x - ai.bridgeFrom.x), -(ai.bridgeTo.z - ai.bridgeFrom.z));
        c.speed = 14;
        if (t >= 1) {
          ai.bridgeT = -1;
          c.pos.y = 0.35;
        }
        c.mesh.position.copy(c.pos);
        c.mesh.rotation.set(0, c.heading, 0);
        continue;
      }

      // Spacing check: brake for the vehicle ahead.
      let ahead = Infinity;
      const fx = -Math.sin(c.heading);
      const fz = -Math.cos(c.heading);
      for (const o of this.vehicles) {
        if (o === v) continue;
        const dx = o.controller.pos.x - c.pos.x;
        const dz = o.controller.pos.z - c.pos.z;
        const along = dx * fx + dz * fz;
        const side = Math.abs(dx * fz - dz * fx);
        if (along > 0 && along < 14 && side < 3.4) ahead = Math.min(ahead, along);
      }
      if (playerController?.inVehicle) {
        const p = playerController.inVehicle;
        const dx = p.pos.x - c.pos.x;
        const dz = p.pos.z - c.pos.z;
        const along = dx * fx + dz * fz;
        const side = Math.abs(dx * fz - dz * fx);
        if (along > 0 && along < 14 && side < 3.4) ahead = Math.min(ahead, along);
      }

      const want = ahead < 12 ? 0 : ai.cruise;
      c.speed += (want - c.speed) * Math.min(1, dt * 1.6);

      // Intersection turns: at crossings, sometimes rotate onto the cross street.
      ai.turnCooldown -= dt;
      const onAve = ai.road.kind === 'avenue';
      const coord = onAve ? c.pos.z : c.pos.x;
      const roads = onAve ? ROAD_NETWORK.boulevards : ROAD_NETWORK.avenues;
      if (ai.turnCooldown <= 0) {
        let near = null;
        for (const r of roads) {
          const at = onAve ? r.z : r.x;
          if (Math.abs(coord - at) < 4) {
            near = r;
            break;
          }
        }
        if (near && this.rng() < 0.4) {
          const ndir = this.rng() < 0.5 ? 1 : -1;
          if (onAve) {
            c.pos.z = near.z + ndir * ROAD_NETWORK.laneOffset;
            c.heading = ndir > 0 ? -Math.PI / 2 : Math.PI / 2;
            ai.road = { kind: 'boulevard', id: near.id };
          } else {
            c.pos.x = near.x + ndir * ROAD_NETWORK.laneOffset;
            c.heading = ndir > 0 ? Math.PI : 0;
            ai.road = { kind: 'avenue', id: near.id };
          }
          ai.dir = ndir;
          ai.turnCooldown = 6 + this.rng() * 8;
        } else {
          ai.turnCooldown = 2;
        }
      }

      // Lane-following: ease back to lane center, roll along heading.
      if (onAve) {
        const ave = this.roadById('avenue', ai.road.id);
        if (ave) c.pos.x += (ave.x + ai.dir * ROAD_NETWORK.laneOffset - c.pos.x) * Math.min(1, dt * 2);
        c.heading += ((ai.dir > 0 ? Math.PI : 0) - c.heading) * Math.min(1, dt * 2);
      } else {
        const blvd = this.roadById('boulevard', ai.road.id);
        if (blvd) c.pos.z += (blvd.z + ai.dir * ROAD_NETWORK.laneOffset - c.pos.z) * Math.min(1, dt * 2);
        c.heading += ((ai.dir > 0 ? -Math.PI / 2 : Math.PI / 2) - c.heading) * Math.min(1, dt * 2);
      }
      // Advance along the lane heading:
      {
        const fwd = new THREE.Vector3(-Math.sin(c.heading), 0, -Math.cos(c.heading));
        c.pos.addScaledVector(fwd, c.speed * dt);
      }

      // Stay on span-clipped dry asphalt: reverse/turn at bay/island endpoints.
      const road = this.roadById(ai.road.kind, ai.road.id);
      let outOfSpan = false;
      if (road) {
        if (onAve) {
          const zMin = road.minZ ?? WORLD_BOUNDS.minZ;
          const zMax = road.maxZ ?? 590;
          if (c.pos.z < zMin + 4 || c.pos.z > zMax - 4) outOfSpan = true;
        } else {
          const xMin = road.minX ?? WORLD_BOUNDS.minX;
          const xMax = road.maxX ?? WORLD_BOUNDS.maxX;
          if (c.pos.x < xMin + 4 || c.pos.x > xMax - 4) outOfSpan = true;
        }
      }
      if (outOfSpan || isWater(c.pos.x, c.pos.z)) {
        // U-turn away from the water endpoint and nudge back on-span.
        ai.dir = -ai.dir;
        const safe = this.clampToRoad(c.pos.x, c.pos.z);
        c.pos.x = safe.x + (this.rng() - 0.5) * 2;
        c.pos.z = safe.z + (this.rng() - 0.5) * 2;
        c.heading += Math.PI;
        c.speed = Math.min(c.speed, 6);
        ai.turnCooldown = 4 + this.rng() * 4;
      }
      // Wrap around outer world edges (clamped back to spans) so traffic never runs dry.
      if (c.pos.x < WORLD_BOUNDS.minX - 20 || c.pos.x > WORLD_BOUNDS.maxX + 20
        || c.pos.z < WORLD_BOUNDS.minZ - 20 || c.pos.z > WORLD_BOUNDS.maxZ + 20) {
        const fix = this.pickLanePoint();
        c.reset(fix.x, fix.z, fix.heading);
      }
      c.pos.y = 0.35;
      c.mesh.position.copy(c.pos);
      c.mesh.rotation.set(0, c.heading, 0);
      const spin = (c.speed / 0.44) * dt;
      for (const w of c.mesh.userData.wheels || []) w.rotation.x += spin;
    }

    // Keep the fleet topped up.
    this.spawnTimer -= dt;
    const moving = this.vehicles.filter((v) => !v.parked && !v.hijacked).length;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 2;
      if (moving < 24) this.spawnTrafficVehicle();
    }
  }
}

const TRAFFIC_SPECS = ['veloce_gt', 'brisa_cabrio', 'dune_titan', 'sol_moto', 'boveda_armored'];

export { TRAFFIC_SPECS, VEHICLE_IDS };
