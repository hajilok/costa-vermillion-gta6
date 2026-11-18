# Costa Vermillion: Sunset Syndicate

[![bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?ref=41fw6r6c)
[![rank](https://make.fun/badge/gta6-01/hajilok/costa-vermillion-gta6/rank.svg)](https://make.fun/bounty/gta6-01?ref=41fw6r6c)
[![reward](https://make.fun/badge/gta6-01/hajilok/costa-vermillion-gta6/reward.svg)](https://make.fun/bounty/gta6-01?ref=41fw6r6c)

An original 3D coastal open-world crime browser game built for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01?ref=41fw6r6c).
100% original city **Puerto Vermillion**, starring **Elena Vega** and
**Mateo Cruz** in *The Sunset Ledger* — a six-chapter story of heists,
getaways, and a harbor showdown at golden hour.

Fully offline: the only library is the vendored `game/vendor/three.module.min.js`.
Zero external URLs anywhere under `game/`.

## Play

Serve locally, then open the URL:

```sh
node serve.ts
# http://localhost:8080
```

Deterministic screenshot stages (used by `shots.json`):

- `?shot=cover&seed=7` — sunset chase over the Flamingo Causeway
- `?shot=combat&seed=7` — on-foot heist shootout downtown
- `?shot=marina&seed=7` — speedboat run under the bridge
- `?shot=map&seed=7` — city map, wanted stats, and saves

## Controls

| Input | Action |
| --- | --- |
| `W A S D` / arrows | Drive / sail / walk (context vehicle) |
| `E` | Enter / exit vehicle, talk, pick up |
| `Space` | Handbrake / dodge roll on foot |
| `Mouse` | Aim camera, click to shoot |
| `1 / 2 / 3 / 4` | Viper pistol / Coral SMG / Breacher shotgun / Pulse grenade |
| `M` | City map of Puerto Vermillion |
| `C` | Swap protagonist (Elena Vega / Mateo Cruz) |
| `P` / `Esc` | Pause |
| `Enter` | Confirm / start mission |

Gamepad: left stick moves, right stick aims, RT shoots, A enters vehicles.

## Architecture

```text
game/
  index.html              single page, canvas + HUD, module script only
  vendor/
    three.module.min.js   vendored three.js (offline, only external lib)
  src/
    cityConfig.js         seeded RNG, bounds, districts, bay, roads,
                          intersections, landmarks, vehicles, weapons,
                          The Sunset Ledger chapters (pure data, no DOM)
    cityBuilder.js        sunset sky-dome GLSL, ocean shader, roads,
                          130+ towers, palms, neon, garage, causeway bridge
    world.js              streaming city state, traffic, police, missions
    player.js             Elena / Mateo on-foot + vehicle controllers
    combat.js             weapons, projectiles, wanted system
    missions.js           six Sunset Ledger chapters + side jobs
    police.js             PVPD pursuit AI and roadblocks
    traffic.js            civilian cars, boats, pedestrians
    audio.js              WebAudio synth (engine, waves, radio, gunfire)
    ui.js                 HUD, map, pause, saves (localStorage)
    saves.js              save slots and stats persistence
    shots.js              deterministic ?shot= staging for screenshots
    main.js               boot, fixed-step loop, screen state machine
```

`cityConfig.js` is the single source of truth: every system (rendering,
traffic routing via `getWaypointRoute`, police pursuit, mission spawns, map UI)
reads bounds, road spans, and water tests from it, so dry land, road corridors,
and Vermillion Bay stay consistent everywhere.

## Screenshots

Rendered offline from the game itself at 1280x720:

1. `1-cover-sunset-chase.jpg` — chase across the causeway at sunset
2. `2-foot-combat-heist.jpg` — foot combat outside Vermillion Bank
3. `3-harbor-speedboat-bridge.jpg` — speedboat run in the marina
4. `4-city-map-and-saves.jpg` — full city map with saves and stats

## License

MIT — see `LICENSE`.
