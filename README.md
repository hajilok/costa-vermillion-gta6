# Costa Vermillion: Sunset Syndicate

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/hajilok/costa-vermillion-gta6/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/hajilok/costa-vermillion-gta6/reward.svg)](https://make.fun/bounty/gta6-01)

An original 3D sun-soaked coastal open-world crime game for the **make.fun gta6-01** competition.
Play as **Elena Vega** (with **Mateo Cruz**) in **Puerto Vermillion**, outrunning the **PVPD** across
the Coral Promenade, Downtown Vermillion, Bahia Cargo Docks and the Starlight Keys.

Built with [make.fun](https://make.fun/?ref=41fw6r6c&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) — 100% original names, characters and story. Nothing from Rockstar/GTA.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

Fully offline: `game/index.html` loads the vendored `game/vendor/three.module.min.js` (Three.js r170)
through a single import map, plus `./styles/hud.css` and `./src/main.js`. No external URLs.

Screenshots: append `?shot=cover|combat|marina|map&seed=7` (see `shots.json`).

## Controls

- WASD / Arrows — move / drive · Mouse — look / aim (click canvas for pointer lock)
- E — talk / interact · F — enter / exit vehicle · R — reload (on foot) / radio next
- 1–4 — weapons · G — pulse grenade · Shift — sprint / nitro · Space — handbrake / drift
- Right mouse — aim · Left mouse — fire · M / Esc — city map & pause menu

## Architecture (`game/src/`)

| Module | Exports | Role |
|---|---|---|
| `cityConfig.js` | `createSeededRandom`, `WORLD_BOUNDS`, `DISTRICTS`, `ROAD_NETWORK`, `INTERSECTIONS`, `LANDMARKS`, `VEHICLE_SPECS` (7), `WEAPON_SPECS` (4), `STORY_CHAPTERS` (6), `getWaypointRoute`, `isWater`, `districtAt` | World data + GPS |
| `cityBuilder.js` | `buildCoastalCityWorld(scene, rng)` | Sunset sky dome + solar disc, shadowed sunlight, ocean/foam/beach, asphalt roads + Flamingo Causeway, 4-district architecture, palms, lamps, colliders, mission beacon, `updateWorldVisuals` |
| `vehicleSystem.js` | `createVehicleMesh`, `VehiclePhysicsController` | 7 detailed vehicles, gears/steer/drift/nitro, collisions, damage smoke, sirens, wake foam |
| `playerAndPeds.js` | `createCharacterRig`, `PlayerCharacterController`, `PedestrianCrowdManager` | Elena on-foot (sprint/aim/carjack/health/armor), 48-ped crowds with panic/flee |
| `trafficSystem.js` | `CityTrafficManager` | ~28 AI cars, lane-follow/turns/spacing, causeway runs, parked boats + hero cars, hijack hand-off |
| `wantedAndPolice.js` | `WantedAndPoliceDirector`, `createHawkHelicopter` | 0–5 star heat, Interceptor pursuit, officers, roadblocks, Hawk heli + searchlight |
| `combatSystem.js` | `CombatAndWeaponsManager` | 4 guns + grenades, tracers/sparks/shockwaves, guard squads, pickups, PVPD alerts |
| `storyAndMissions.js` | `StoryCampaignManager`, `SaveGameManager` | 6-chapter "Sunset Ledger", GPS, cash/respect ranks, garage/armory, 3 save slots |
| `cameraRig.js` | `DynamicCameraController` | Chase / over-shoulder aim / cinematic shots |
| `hudAndMap.js` | `HudAndRadarController` | 36-ID HUD, rotating 210px radar, 420×300 city map, menu wiring |
| `audioAndRadio.js` | `WebAudioEngineAndRadio` | Engine hum, drift, sirens, gunfire, 3 synth stations |
| `sceneShots.js` | `stageScreenshotScenario` | Deterministic cover/combat/marina/map staging |
| `main.js` | entrypoint | ACES + soft-shadow renderer, loop, input, `?shot=` handling |

## Gameplay

Steal any of 7 vehicles (Veloce GT, Brisa Cabrio, Dune Titan, PVPD Interceptor, Boveda Armored,
Sol Moto, Marea Speedboat), fight 4 guns + pulse grenades against syndicate guards, dodge 0–5 star
PVPD heat (pursuits, roadblocks, Hawk helicopter), run 6 story chapters of "The Sunset Ledger" with
live GPS, earn cash/respect ranks, use the Coral Mod Garage and Harbor Armory, and save to 3 slots.
