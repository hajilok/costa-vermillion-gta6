// Costa Vermillion: Sunset Syndicate — a gta6-01 entry (Node 22, standard library only).
// The game is this directory's game/ folder: plain static files a desktop browser loads
// offline (game/index.html plus its ES modules, Three.js vendored under game/vendor/, no
// network requests). This program validates game/ and screenshots/, copies them to
// MAKEFUN_OUTPUT_DIR ?? '/output', and writes /output/dossier.json via buildDossier from
// ./vendor/makefun-game.ts with the starter caps.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function fail(message) {
  console.error(`entry validation failed: ${message}`);
  process.exit(1);
}

// game/index.html must exist and stay fully offline (no http(s) URLs anywhere).
const indexPath = join(here, 'game', 'index.html');
if (!existsSync(indexPath)) fail('game/index.html is missing');
const { readFileSync } = await import('node:fs');
const indexHtml = readFileSync(indexPath, 'utf8');
if (!indexHtml.includes('game-canvas')) fail('game/index.html must contain #game-canvas');
if (!indexHtml.includes('./vendor/three.module.min.js')) fail('game/index.html must load the vendored three.js');
if (/https?:\/\//.test(indexHtml)) fail('game/index.html must not reference remote URLs');

// Every game/src/*.js module the entrypoint wires must exist.
for (const f of [
  'cityConfig.js', 'cityBuilder.js', 'vehicleSystem.js', 'playerAndPeds.js',
  'trafficSystem.js', 'wantedAndPolice.js', 'combatSystem.js', 'storyAndMissions.js',
  'cameraRig.js', 'hudAndMap.js', 'audioAndRadio.js', 'sceneShots.js', 'main.js',
]) {
  if (!existsSync(join(here, 'game', 'src', f))) fail(`game/src/${f} is missing`);
}

// screenshots/: 3 or 4 JPEG/PNG renders, first by name is the cover.
const shotsDir = join(here, 'screenshots');
if (!existsSync(shotsDir)) fail('screenshots/ is missing');
const shots = readdirSync(shotsDir)
  .filter((f) => /\.(png|jpe?g)$/i.test(f))
  .sort();
if (shots.length < 3 || shots.length > 4) fail(`screenshots/ must hold 3 or 4 images (found ${shots.length})`);
for (const s of shots) {
  const bytes = statSync(join(shotsDir, s)).size;
  if (bytes > 262144) fail(`screenshots/${s} is ${bytes} bytes (cap 262144)`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`entry packed: ${shots.length} screenshots (${shots.join(', ')}) -> ${out}`);
