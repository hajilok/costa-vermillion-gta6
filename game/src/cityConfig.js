// Costa Vermillion: Sunset Syndicate — original world data for Puerto Vermillion.
// 100% original names and characters. No Rockstar / GTA content.
// Coordinate system: +X east, +Z south, Y up. Ground units are metres.

export function createSeededRandom(seed = 123456789) {
  let state = seed >>> 0;
  if (state === 0) state = 0x6d2b79f5;
  return function random() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const WORLD_BOUNDS = {
  minX: -640,
  maxX: 640,
  minZ: -640,
  maxZ: 640,
  groundY: 0,
  waterY: -1.6,
  name: 'Puerto Vermillion',
};

// Four hand-authored districts covering mainland, bay shore, docks and island keys.
export const DISTRICTS = [
  {
    id: 'coral_promenade',
    name: 'Coral Promenade',
    center: { x: -380, z: 120 },
    size: { x: 420, z: 700 },
    groundColor: 0xf2c49b,
    roadColor: 0x3d3a55,
    description: 'Sun-soaked beachfront: Hotel Mariposa, Solar Club and Palm Paradise.',
    ambient: 'gulls',
    wantedHeat: 0.4,
  },
  {
    id: 'downtown_vermillion',
    name: 'Downtown Vermillion',
    center: { x: 40, z: -40 },
    size: { x: 520, z: 560 },
    groundColor: 0x9aa0b5,
    roadColor: 0x2e2c44,
    description: 'Neon towers around Vermillion Tower and the Coral Mod Garage.',
    ambient: 'traffic',
    wantedHeat: 1.0,
  },
  {
    id: 'bahia_cargo_docks',
    name: 'Bahia Cargo Docks',
    center: { x: 180, z: 430 },
    size: { x: 560, z: 300 },
    groundColor: 0x8f8a72,
    roadColor: 0x35334a,
    description: 'Industrial harbor: Bahia Container Terminal and Harbor Armory.',
    ambient: 'cranes',
    wantedHeat: 0.8,
  },
  {
    id: 'starlight_keys',
    name: 'Starlight Keys',
    center: { x: 430, z: -330 },
    size: { x: 320, z: 360 },
    groundColor: 0x7fd6a4,
    roadColor: 0x3d3a55,
    description: 'Private island keys across the bay, home to the Starlight Villa Safehouse.',
    ambient: 'waves',
    wantedHeat: 0.3,
  },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (
      x >= d.center.x - d.size.x / 2 &&
      x <= d.center.x + d.size.x / 2 &&
      z >= d.center.z - d.size.z / 2 &&
      z <= d.center.z + d.size.z / 2
    ) {
      return d;
    }
  }
  return null;
}

// Bay water rectangle between downtown and the Starlight Keys.
export const VERMILLION_BAY = {
  minX: 180,
  maxX: 400,
  minZ: -520,
  maxZ: 140,
};

export function isWater(x, z) {
  // Ocean west of the promenade and south of the docks, plus the bay channel.
  if (x < -560) return true;
  if (z > 590) return true;
  if (x >= VERMILLION_BAY.minX && x <= VERMILLION_BAY.maxX && z >= VERMILLION_BAY.minZ && z <= VERMILLION_BAY.maxZ) {
    return true;
  }
  return false;
}

// Grid roads. Avenues run north-south (constant X), boulevards run east-west (constant Z).
// Explicit spans keep asphalt off VERMILLION_BAY water: the causeway alone bridges it.
export const ROAD_NETWORK = {
  avenues: [
    { id: 'ave_coral', name: 'Coral Avenue', x: -440, width: 12, minZ: -640, maxZ: 590 },
    { id: 'ave_mariposa', name: 'Mariposa Avenue', x: -260, width: 12, minZ: -640, maxZ: 590 },
    { id: 'ave_central', name: 'Central Avenida', x: -60, width: 16, minZ: -640, maxZ: 590 },
    { id: 'ave_torre', name: 'Torre Avenue', x: 120, width: 16, minZ: -640, maxZ: 590 },
    { id: 'ave_bahia', name: 'Bahia Avenue', x: 300, width: 12, minZ: 150, maxZ: 560 },
    { id: 'ave_keys', name: 'Keys Palm Avenue', x: 450, width: 10, minZ: -520, maxZ: -150 },
  ],
  boulevards: [
    { id: 'blvd_sol', name: 'Sol Boulevard', z: -420, width: 14, minX: -560, maxX: 176 },
    { id: 'blvd_neon', name: 'Neon Boulevard', z: -220, width: 12, minX: -560, maxX: 176 },
    { id: 'blvd_vermillion', name: 'Vermillion Boulevard', z: -40, width: 18, minX: -560, maxX: 176 },
    { id: 'blvd_palmera', name: 'Palmera Boulevard', z: 160, width: 12, minX: -560, maxX: 176 },
    { id: 'blvd_carga', name: 'Carga Boulevard', z: 360, width: 14, minX: -560, maxX: 560 },
    { id: 'blvd_keys', name: 'Starlight Boulevard', z: -330, width: 10, minX: 402, maxX: 565 },
  ],
  // Flamingo Causeway carries Vermillion Boulevard over the bay to the Keys.
  bridge: {
    id: 'flamingo_causeway',
    name: 'Flamingo Causeway',
    from: { x: 120, z: -40 },
    to: { x: 450, z: -330 },
    width: 14,
    deckY: 6,
  },
  laneOffset: 3.2,
  roadY: 0.15,
};

// Avenue/boulevard crossings, clipped to explicit spans so no node floats on bay water.
export const INTERSECTIONS = (() => {
  const list = [];
  for (const ave of ROAD_NETWORK.avenues) {
    for (const blvd of ROAD_NETWORK.boulevards) {
      // Keys roads only meet the Keys boulevard; mainland roads skip it.
      const keysRoad = ave.id === 'ave_keys' || blvd.id === 'blvd_keys';
      const mainlandOk = ave.id !== 'ave_keys' && blvd.id !== 'blvd_keys';
      if (keysRoad && !mainlandOk && !(ave.id === 'ave_keys' && blvd.id === 'blvd_keys')) continue;
      // Span clip: the asphalt segment must actually exist at this crossing.
      const aMinZ = ave.minZ ?? WORLD_BOUNDS.minZ;
      const aMaxZ = ave.maxZ ?? 590;
      const bMinX = blvd.minX ?? WORLD_BOUNDS.minX;
      const bMaxX = blvd.maxX ?? WORLD_BOUNDS.maxX;
      if (blvd.z < aMinZ || blvd.z > aMaxZ) continue;
      if (ave.x < bMinX || ave.x > bMaxX) continue;
      list.push({ x: ave.x, z: blvd.z, avenueId: ave.id, boulevardId: blvd.z !== undefined ? blvd.id : blvd.id });
    }
  }
  list.push({ x: ROAD_NETWORK.bridge.from.x, z: ROAD_NETWORK.bridge.from.z, avenueId: 'ave_torre', boulevardId: 'blvd_vermillion', bridge: true });
  list.push({ x: ROAD_NETWORK.bridge.to.x, z: ROAD_NETWORK.bridge.to.z, avenueId: 'ave_keys', boulevardId: 'blvd_keys', bridge: true });
  return list;
})();

function nearestRoadPoint(x, z) {
  let best = null;
  let bestD = Infinity;
  for (const ave of ROAD_NETWORK.avenues) {
    if (z < (ave.minZ ?? -640) || z > (ave.maxZ ?? 590)) continue;
    const d = Math.abs(x - ave.x);
    if (d < bestD) { bestD = d; best = { x: ave.x, z, roadId: ave.id }; }
  }
  for (const blvd of ROAD_NETWORK.boulevards) {
    if (x < (blvd.minX ?? -640) || x > (blvd.maxX ?? 640)) continue;
    const d = Math.abs(z - blvd.z);
    if (d < bestD) { bestD = d; best = { x, z: blvd.z, roadId: blvd.id }; }
  }
  return best;
}

// Closest named street: nearest span-clipped avenue/boulevard, or the causeway.
export function streetNameAt(x, z) {
  const b = ROAD_NETWORK.bridge;
  const abx = b.to.x - b.from.x;
  const abz = b.to.z - b.from.z;
  const t = Math.max(0, Math.min(1, ((x - b.from.x) * abx + (z - b.from.z) * abz) / (abx * abx + abz * abz)));
  let name = b.name;
  let bd = Math.hypot(x - (b.from.x + abx * t), z - (b.from.z + abz * t));
  for (const ave of ROAD_NETWORK.avenues) {
    if (z < (ave.minZ ?? -640) - 12 || z > (ave.maxZ ?? 590) + 12) continue;
    const d = Math.abs(x - ave.x);
    if (d < bd && d <= ave.width / 2 + 10) { bd = d; name = ave.name; }
  }
  for (const blvd of ROAD_NETWORK.boulevards) {
    if (x < (blvd.minX ?? -640) - 12 || x > (blvd.maxX ?? 640) + 12) continue;
    const d = Math.abs(z - blvd.z);
    if (d < bd && d <= blvd.width / 2 + 10) { bd = d; name = blvd.name; }
  }
  if (bd <= 40) return name;
  let fd = bd;
  for (const ave of ROAD_NETWORK.avenues) {
    const d = Math.abs(x - ave.x);
    if (d < fd) { fd = d; name = ave.name; }
  }
  for (const blvd of ROAD_NETWORK.boulevards) {
    const d = Math.abs(z - blvd.z);
    if (d < fd) { fd = d; name = blvd.name; }
  }
  return name;
}

// Simple L-shaped GPS route: snap to roads, drive along X then Z (or use bridge).
export function getWaypointRoute(from, to) {
  const points = [{ x: from.x, z: from.z }];
  const crossesBay =
    (from.x < VERMILLION_BAY.minX && to.x > VERMILLION_BAY.maxX) ||
    (from.x > VERMILLION_BAY.maxX && to.x < VERMILLION_BAY.minX);
  if (crossesBay) {
    const b = ROAD_NETWORK.bridge;
    const entry = from.x < to.x ? b.from : b.to;
    const exit = from.x < to.x ? b.to : b.from;
    points.push({ x: entry.x, z: entry.z });
    points.push({ x: exit.x, z: exit.z });
  } else {
    const snapped = nearestRoadPoint(from.x, from.z) || { x: from.x, z: from.z };
    points.push({ x: snapped.x, z: snapped.z });
    points.push({ x: snapped.x, z: to.z });
  }
  points.push({ x: to.x, z: to.z });
  let distance = 0;
  for (let i = 1; i < points.length; i += 1) {
    distance += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
  }
  return { points, distance, usesBridge: crossesBay };
}

export const LANDMARKS = [
  { id: 'hotel_mariposa', name: 'Hotel Mariposa', district: 'Coral Promenade', pos: { x: -412, z: -75 }, kind: 'hotel', mission: true },
  { id: 'solar_club', name: 'Solar Club', district: 'Coral Promenade', pos: { x: -330, z: 210 }, kind: 'club', mission: true },
  { id: 'palm_paradise', name: 'Palm Paradise', district: 'Coral Promenade', pos: { x: -470, z: 330 }, kind: 'beach', mission: false },
  { id: 'vermillion_tower', name: 'Vermillion Tower', district: 'Downtown Vermillion', pos: { x: 60, z: -120 }, kind: 'tower', mission: true },
  { id: 'coral_mod_garage', name: 'Coral Mod Garage', district: 'Downtown Vermillion', pos: { x: -40, z: 60 }, kind: 'garage', mission: true },
  { id: 'harbor_armory', name: 'Harbor Armory', district: 'Bahia Cargo Docks', pos: { x: 90, z: 380 }, kind: 'shop', mission: true },
  { id: 'bahia_terminal', name: 'Bahia Container Terminal', district: 'Bahia Cargo Docks', pos: { x: 330, z: 430 }, kind: 'port', mission: true },
  { id: 'starlight_villa', name: 'Starlight Villa Safehouse', district: 'Starlight Keys', pos: { x: 460, z: -360 }, kind: 'safehouse', mission: true },
];

export function landmarkById(id) {
  return LANDMARKS.find((l) => l.id === id) || null;
}

// Seven stealable vehicles: 4 street cars, PVPD cruiser, armored truck, bike + speedboat.
export const VEHICLE_SPECS = {
  veloce_gt: {
    id: 'veloce_gt', label: 'Veloce GT', kind: 'coupe',
    topSpeed: 62, acceleration: 24, handling: 0.9, seats: 2,
    colors: [0xff3fa4, 0xffc44d, 0x38e8ff], stealable: true, land: true, water: false,
  },
  brisa_cabrio: {
    id: 'brisa_cabrio', label: 'Brisa Cabrio', kind: 'convertible',
    topSpeed: 48, acceleration: 17, handling: 0.8, seats: 2,
    colors: [0x7fd6a4, 0xfff3d6, 0xff7a3c], stealable: true, land: true, water: false,
  },
  dune_titan: {
    id: 'dune_titan', label: 'Dune Titan', kind: 'suv',
    topSpeed: 44, acceleration: 15, handling: 0.62, seats: 4,
    colors: [0xc98a3d, 0x6b7c8c, 0x3f6b4f], stealable: true, land: true, water: false, offroad: true,
  },
  pvpd_interceptor: {
    id: 'pvpd_interceptor', label: 'PVPD Interceptor', kind: 'cruiser',
    topSpeed: 58, acceleration: 22, handling: 0.85, seats: 2,
    colors: [0x10233a], police: true, stealable: true, land: true, water: false,
    siren: true, wantedHeat: 2,
  },
  boveda_armored: {
    id: 'boveda_armored', label: 'Boveda Armored', kind: 'truck',
    topSpeed: 38, acceleration: 11, handling: 0.5, seats: 2,
    colors: [0x4c4c58], stealable: true, land: true, water: false,
    armor: 200, cashReward: 2500,
  },
  sol_moto: {
    id: 'sol_moto', label: 'Sol Moto', kind: 'moto',
    topSpeed: 55, acceleration: 26, handling: 1.0, seats: 1,
    colors: [0xff5a4e, 0x38e8ff], stealable: true, land: true, water: false, narrow: true,
  },
  marea_speedboat: {
    id: 'marea_speedboat', label: 'Marea Speedboat', kind: 'boat',
    topSpeed: 52, acceleration: 19, handling: 0.7, seats: 4,
    colors: [0xffffff, 0xff5a4e], stealable: true, land: false, water: true,
  },
};

export const VEHICLE_IDS = Object.keys(VEHICLE_SPECS);

export const WEAPON_SPECS = {
  viper_pistol: {
    id: 'viper_pistol', label: 'Viper Pistol', slot: 1,
    damage: 18, rpm: 260, magazine: 12, reserve: 48, range: 90, automatic: false,
  },
  coral_smg: {
    id: 'coral_smg', label: 'Coral SMG', slot: 2,
    damage: 11, rpm: 720, magazine: 32, reserve: 128, range: 70, automatic: true,
  },
  breacher_shotgun: {
    id: 'breacher_shotgun', label: 'Breacher Shotgun', slot: 3,
    damage: 9, pellets: 7, rpm: 70, magazine: 6, reserve: 24, range: 30, automatic: false, spread: 0.09,
  },
  pulse_grenade: {
    id: 'pulse_grenade', label: 'Pulse Grenade', slot: 4,
    damage: 95, rpm: 40, magazine: 1, reserve: 3, range: 40, automatic: false,
    throwable: true, fuse: 1.6, blastRadius: 12,
  },
};

export const WEAPON_IDS = Object.keys(WEAPON_SPECS);

// Six chapters of the original story "The Sunset Ledger".
export const STORY_CHAPTERS = [
  {
    id: 'ch1_salt_neon',
    chapter: 1,
    title: 'Salt & Neon',
    ledger: 'The Sunset Ledger, page 1',
    briefing: 'Elena Vega returns to Puerto Vermillion. Meet Mateo Cruz at Hotel Mariposa and learn the streets.',
    giver: 'Mateo Cruz',
    locationId: 'hotel_mariposa',
    objectives: ['Reach Hotel Mariposa', 'Repossess the Brisa Cabrio', 'Lose the PVPD tail'],
  },
  {
    id: 'ch2_mariposa_deal',
    chapter: 2,
    title: 'The Mariposa Deal',
    ledger: 'The Sunset Ledger, page 2',
    briefing: 'A Solar Club buyer wants a Veloce GT. Steal one and deliver it to the Coral Mod Garage.',
    giver: 'Elena Vega',
    locationId: 'solar_club',
    objectives: ['Steal a Veloce GT', 'Dodge the PVPD Interceptors', 'Deliver it to the Coral Mod Garage'],
  },
  {
    id: 'ch3_engines_bahia',
    chapter: 3,
    title: 'Engines of Bahia',
    giver: 'Mateo Cruz',
    ledger: 'The Sunset Ledger, page 3',
    briefing: 'The Harbor Armory needs muscle. Crack the Boveda Armored truck at Bahia Container Terminal.',
    locationId: 'bahia_terminal',
    objectives: ['Enter Bahia Container Terminal', 'Crack the Boveda Armored truck', 'Bring the cargo to Harbor Armory'],
  },
  {
    id: 'ch4_starlight_debts',
    chapter: 4,
    title: 'Starlight Debts',
    giver: 'Elena Vega',
    ledger: 'The Sunset Ledger, page 4',
    briefing: 'Take the Flamingo Causeway to the Starlight Villa Safehouse and settle an old debt by speedboat.',
    locationId: 'starlight_villa',
    objectives: ['Cross the Flamingo Causeway', 'Reach the Starlight Villa Safehouse', 'Escape by Marea Speedboat'],
  },
  {
    id: 'ch5_tower_run',
    chapter: 5,
    title: 'Vermillion Tower Run',
    giver: 'Mateo Cruz',
    ledger: 'The Sunset Ledger, page 5',
    briefing: 'A ledger page is held atop Vermillion Tower. Climb downtown with a 4-star PVPD pursuit on your tail.',
    locationId: 'vermillion_tower',
    objectives: ['Reach Vermillion Tower', 'Survive the PVPD pursuit', 'Recover the ledger page'],
  },
  {
    id: 'ch6_sunset_ledger',
    chapter: 6,
    title: 'The Sunset Ledger',
    giver: 'Elena Vega',
    ledger: 'The Sunset Ledger, final page',
    briefing: 'The syndicate ledger is complete. Unite the districts and leave Puerto Vermillion on your own terms.',
    locationId: 'palm_paradise',
    objectives: ['Unite Coral, Downtown, Bahia and the Keys', 'Outrun the final PVPD blockade', 'Close the Sunset Ledger'],
  },
];

export const SAVE_SLOTS = ['sunset_save_1', 'sunset_save_2', 'sunset_save_3'];
