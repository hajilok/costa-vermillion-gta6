// Puerto Vermillion: single source of truth for the Sunset Syndicate city.
// Pure data and math only: no DOM, no three.js, no network. Every system
// (world streaming, traffic, police, missions, map UI) reads bounds, roads,
// water and landmarks from here so they always agree.

export function createSeededRandom(seed) {
  let s = (seed >>> 0) || 1;
  return function next() {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

export const WORLD_BOUNDS = { minX: -640, maxX: 640, minZ: -640, maxZ: 640 };

export const DISTRICTS = [
  { id: 'coral_promenade', name: 'Coral Promenade', minX: -640, maxX: -300, minZ: -640, maxZ: 640, blurb: 'Beachfront hotels and neon clubs along the western shore.' },
  { id: 'downtown_vermillion', name: 'Downtown Vermillion', minX: -300, maxX: 176, minZ: -640, maxZ: 640, blurb: 'Art-Deco towers, the bank, and the tower at the city heart.' },
  { id: 'starlight_keys', name: 'Starlight Keys', minX: 176, maxX: 640, minZ: -640, maxZ: 140, blurb: 'Bridged keys, villas, and the marina under golden light.' },
  { id: 'bahia_cargo', name: 'Bahia Cargo Docks', minX: 176, maxX: 640, minZ: 140, maxZ: 640, blurb: 'Container yards, freight roads, and the armory south of the bay.' },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.minX && x <= d.maxX && z >= d.minZ && z <= d.maxZ) return d;
  }
  return DISTRICTS[1];
}

export const VERMILLION_BAY = { minX: 180, maxX: 400, minZ: -520, maxZ: 140 };

export function isWater(x, z) {
  if (x < -560) return true;
  if (z > 590) return true;
  return x >= VERMILLION_BAY.minX && x <= VERMILLION_BAY.maxX &&
    z >= VERMILLION_BAY.minZ && z <= VERMILLION_BAY.maxZ;
}

export const ROAD_NETWORK = {
  avenues: [
    { id: 'ave_coral', name: 'Ave Coral', x: -440, minZ: -560, maxZ: 585 },
    { id: 'ave_mariposa', name: 'Ave Mariposa', x: -260, minZ: -560, maxZ: 585 },
    { id: 'ave_central', name: 'Ave Central', x: -60, minZ: -560, maxZ: 585 },
    { id: 'ave_torre', name: 'Ave Torre', x: 120, minZ: -560, maxZ: 585 },
    { id: 'ave_bahia', name: 'Ave Bahia', x: 300, minZ: 150, maxZ: 560 },
    { id: 'ave_keys', name: 'Ave Keys', x: 450, minZ: -520, maxZ: -150 },
  ],
  boulevards: [
    { id: 'blvd_sol', name: 'Blvd Sol', z: -420, minX: -560, maxX: 176 },
    { id: 'blvd_neon', name: 'Blvd Neon', z: -220, minX: -560, maxX: 176 },
    { id: 'blvd_vermillion', name: 'Blvd Vermillion', z: -40, minX: -560, maxX: 176 },
    { id: 'blvd_palmera', name: 'Blvd Palmera', z: 160, minX: -560, maxX: 176 },
    { id: 'blvd_carga', name: 'Blvd Carga', z: 360, minX: -560, maxX: 560 },
    { id: 'blvd_keys', name: 'Blvd Keys', z: -330, minX: 402, maxX: 565 },
  ],
  bridge: {
    id: 'flamingo_causeway',
    name: 'Flamingo Causeway',
    from: { x: 120, z: -40 },
    to: { x: 450, z: -330 },
    deckY: 6,
  },
};

function avenueSpanContains(a, z) {
  return z >= a.minZ && z <= a.maxZ;
}

function boulevardSpanContains(b, x) {
  return x >= b.minX && x <= b.maxX;
}

export const INTERSECTIONS = (() => {
  const list = [];
  for (const a of ROAD_NETWORK.avenues) {
    for (const b of ROAD_NETWORK.boulevards) {
      if (avenueSpanContains(a, b.z) && boulevardSpanContains(b, a.x)) {
        list.push({ x: a.x, z: b.z, avenueId: a.id, boulevardId: b.id, name: `${a.name} & ${b.name}` });
      }
    }
  }
  return list;
})();

function distanceToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  let t = 0;
  if (lenSq > 0) t = Math.min(1, Math.max(0, ((px - ax) * dx + (pz - az) * dz) / lenSq));
  const cx = ax + dx * t;
  const cz = az + dz * t;
  return { dist: Math.hypot(px - cx, pz - cz), t };
}

export function streetNameAt(x, z) {
  const bridge = ROAD_NETWORK.bridge;
  const nearBridge = distanceToSegment(x, z, bridge.from.x, bridge.from.z, bridge.to.x, bridge.to.z);
  const ROAD_HALF = 7;
  let avenue = null;
  for (const a of ROAD_NETWORK.avenues) {
    if (Math.abs(x - a.x) <= ROAD_HALF && avenueSpanContains(a, z)) avenue = a;
  }
  let boulevard = null;
  for (const b of ROAD_NETWORK.boulevards) {
    if (Math.abs(z - b.z) <= ROAD_HALF && boulevardSpanContains(b, x)) boulevard = b;
  }
  if (nearBridge.dist < 12) return bridge.name;
  if (avenue && boulevard) return `${avenue.name} & ${boulevard.name}`;
  if (avenue) return avenue.name;
  if (boulevard) return boulevard.name;
  return `${districtAt(x, z).name} (off-road)`;
}

function nearestAvenue(x, z) {
  let best = null;
  let bestScore = Infinity;
  for (const a of ROAD_NETWORK.avenues) {
    const spanning = avenueSpanContains(a, z);
    const score = Math.abs(x - a.x) + (spanning ? 0 : 10000);
    if (score < bestScore) {
      bestScore = score;
      best = a;
    }
  }
  return best;
}

function nearestBoulevard(x, z) {
  let best = null;
  let bestScore = Infinity;
  for (const b of ROAD_NETWORK.boulevards) {
    const spanning = boulevardSpanContains(b, x);
    const score = Math.abs(z - b.z) + (spanning ? 0 : 10000);
    if (score < bestScore) {
      bestScore = score;
      best = b;
    }
  }
  return best;
}

export function getWaypointRoute(from, to) {
  const bay = VERMILLION_BAY;
  const inBayZ = (z) => z >= bay.minZ && z <= bay.maxZ;
  const west = (p) => p.x < bay.minX;
  const east = (p) => p.x > bay.maxX;
  if (inBayZ(from.z) && inBayZ(to.z) && ((west(from) && east(to)) || (east(from) && west(to)))) {
    const b = ROAD_NETWORK.bridge;
    return [
      { x: from.x, z: from.z },
      { x: b.from.x, z: b.from.z },
      { x: b.to.x, z: b.to.z },
      { x: to.x, z: to.z },
    ];
  }
  const avenue = nearestAvenue(from.x, from.z);
  const boulevard = nearestBoulevard(to.x, to.z);
  const ax = avenue ? avenue.x : from.x;
  const bz = boulevard ? boulevard.z : to.z;
  const raw = [
    { x: from.x, z: from.z },
    { x: ax, z: from.z },
    { x: ax, z: bz },
    { x: to.x, z: bz },
    { x: to.x, z: to.z },
  ];
  const route = [raw[0]];
  for (let i = 1; i < raw.length; i++) {
    const prev = route[route.length - 1];
    if (Math.hypot(raw[i].x - prev.x, raw[i].z - prev.z) > 0.5) route.push(raw[i]);
  }
  return route;
}

export const LANDMARKS = [
  { id: 'hotel_mariposa', name: 'Hotel Mariposa', x: -415, z: 120, district: 'coral_promenade', kind: 'hotel', blurb: 'Butterfly-signed grand hotel where Elena scouts the first score.' },
  { id: 'coral_mod_garage', name: 'Coral Mod Garage', x: -40, z: 60, district: 'downtown_vermillion', kind: 'garage', blurb: 'Open-air mod shop: repairs, resprays, and getaway tuning.' },
  { id: 'harbor_armory', name: 'Harbor Armory', x: 250, z: 300, district: 'bahia_cargo', kind: 'shop', blurb: 'Dockside lockers selling serious hardware, no questions asked.' },
  { id: 'bahia_container_terminal', name: 'Bahia Container Terminal', x: 80, z: 430, district: 'bahia_cargo', kind: 'terminal', blurb: 'Stacked containers hide the syndicate payroll shipment.' },
  { id: 'vermillion_tower', name: 'Vermillion Tower', x: 10, z: -120, district: 'downtown_vermillion', kind: 'tower', blurb: 'The tallest spire downtown, watching every getaway.' },
  { id: 'starlight_villa_safehouse', name: 'Starlight Villa Safehouse', x: 505, z: -420, district: 'starlight_keys', kind: 'safehouse', blurb: 'Keys villa with a pool: save, swap crew, lay low.' },
  { id: 'solar_club', name: 'Solar Club', x: -205, z: -75, district: 'coral_promenade', kind: 'club', blurb: 'Rooftop club where the ledger crew trades names and debts.' },
  { id: 'vermillion_bank', name: 'Vermillion Bank', x: -150, z: 200, district: 'downtown_vermillion', kind: 'bank', blurb: 'Marble, cameras, and chapter three\u2019s loudest forty seconds.' },
];

export function landmarkById(id) {
  return LANDMARKS.find((l) => l.id === id) || null;
}

export const VEHICLE_SPECS = [
  { id: 'veloce_gt', name: 'Veloce GT', kind: 'car', topSpeed: 62, accel: 24, handling: 1.0, seats: 2, durability: 100, blurb: 'Low sunset coupe, Mateo\u2019s getaway favorite.' },
  { id: 'brisa_cabrio', name: 'Brisa Cabrio', kind: 'car', topSpeed: 55, accel: 19, handling: 0.95, seats: 2, durability: 90, blurb: 'Breezy convertible built for the promenade cruise.' },
  { id: 'pvpd_interceptor', name: 'PVPD Interceptor', kind: 'car', topSpeed: 64, accel: 26, handling: 1.05, seats: 2, durability: 130, blurb: 'Puerto Vermillion PD pursuit unit. Fast and furious.' },
  { id: 'boveda_armored', name: 'Boveda Armored', kind: 'car', topSpeed: 44, accel: 13, handling: 0.7, seats: 4, durability: 220, blurb: 'Vault-like van for the whole crew and the loot.' },
  { id: 'dune_titan', name: 'Dune Titan', kind: 'car', topSpeed: 48, accel: 16, handling: 0.85, seats: 4, durability: 160, blurb: 'High-riding 4x4 that ignores curbs and sand.' },
  { id: 'sol_moto', name: 'Sol Moto', kind: 'bike', topSpeed: 58, accel: 27, handling: 1.25, seats: 1, durability: 60, blurb: 'Nimble bike for threading noon traffic at midnight speed.' },
  { id: 'marea_speedboat', name: 'Marea Speedboat', kind: 'boat', topSpeed: 52, accel: 18, handling: 0.9, seats: 4, durability: 120, waterOnly: true, blurb: 'Harbor rocket for bay escapes under the causeway.' },
];

export const WEAPON_SPECS = [
  { id: 'viper_pistol', name: 'Viper Pistol', kind: 'hitscan', damage: 18, fireInterval: 0.22, magazine: 12, reloadTime: 1.1, range: 90, spread: 0.012, auto: false, blurb: 'Elena\u2019s reliable sidearm: quiet, quick, exact.' },
  { id: 'coral_smg', name: 'Coral SMG', kind: 'hitscan', damage: 11, fireInterval: 0.085, magazine: 32, reloadTime: 1.6, range: 70, spread: 0.03, auto: true, blurb: 'Room-clearing chatter for the bank job.' },
  { id: 'breacher_shotgun', name: 'Breacher Shotgun', kind: 'pellet', damage: 9, pellets: 8, fireInterval: 0.9, magazine: 6, reloadTime: 2.2, range: 35, spread: 0.07, auto: false, blurb: 'Opens doors, locks, and arguments at close range.' },
  { id: 'pulse_grenade', name: 'Pulse Grenade', kind: 'thrown', damage: 120, fuse: 1.6, blastRadius: 9, magazine: 1, reloadTime: 1.0, range: 26, spread: 0, auto: false, blurb: 'Sunset-charged pulse that ends pursuits politely.' },
];

export const STORY_CHAPTERS = [
  { no: 1, id: 'golden-hour-arrival', title: 'Golden Hour Arrival', protagonists: ['Elena Vega', 'Mateo Cruz'], location: 'hotel_mariposa', brief: 'Elena and Mateo roll into Puerto Vermillion at dusk, steal a Veloce GT from the Mariposa valet row, and outrun their first PVPD tail over the promenade.' },
  { no: 2, id: 'coral-mod-run', title: 'The Coral Mod Run', protagonists: ['Mateo Cruz'], location: 'coral_mod_garage', brief: 'Mateo tunes the getaway coupe at the Coral Mod Garage, then road-tests it through a downtown checkpoint gauntlet before the paint dries.' },
  { no: 3, id: 'vermillion-bank-job', title: 'The Vermillion Bank Job', protagonists: ['Elena Vega', 'Mateo Cruz'], location: 'vermillion_bank', brief: 'The ledger crew hits Vermillion Bank in forty loud seconds: breacher on the vault, Coral SMG on the alarms, and a four-star exit into noon traffic.' },
  { no: 4, id: 'bahia-breakout', title: 'Bahia Breakout', protagonists: ['Elena Vega'], location: 'bahia_container_terminal', brief: 'Elena raids the syndicate payroll shipment between container stacks at Bahia terminal and escapes by armored van as the docks lock down.' },
  { no: 5, id: 'causeway-run', title: 'The Causeway Run', protagonists: ['Elena Vega', 'Mateo Cruz'], location: 'flamingo_causeway', brief: 'Both crews torch across the Flamingo Causeway at sunset, trading paint with interceptors and threading the suspension towers to the Keys.' },
  { no: 6, id: 'sunset-ledger', title: 'The Sunset Ledger', protagonists: ['Elena Vega', 'Mateo Cruz'], location: 'starlight_villa_safehouse', brief: 'At the Starlight Villa the ledger is settled: one last harbor showdown by speedboat, then the syndicate answers to the Sunset Syndicate.' },
];
