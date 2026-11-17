// Costa Vermillion: Sunset Syndicate — HUD text, rotating radar, city map, menu wiring.
// 100% original content. Imports only './cityConfig.js'.
import {
  DISTRICTS,
  LANDMARKS,
  ROAD_NETWORK,
  STORY_CHAPTERS,
  VERMILLION_BAY,
  WORLD_BOUNDS,
  districtAt,
  isWater,
} from './cityConfig.js';

// All 36 DOM IDs in index.html (verified against the markup).
const IDS = [
  'game-canvas', 'hud-root', 'mission-banner', 'mission-chapter', 'mission-title',
  'mission-objective', 'mission-dist', 'status-cluster', 'wanted-stars', 'wanted-label',
  'cash-value', 'respect-value', 'weapon-name', 'weapon-ammo', 'radio-station',
  'radar-cluster', 'minimap-canvas', 'district-name', 'health-bar-fill', 'armor-bar-fill',
  'speedo-cluster', 'speed-num', 'speed-gear', 'vehicle-label', 'nitro-bar-fill',
  'aim-reticle', 'dialogue-box', 'dialogue-speaker', 'dialogue-line', 'context-hint',
  'menu-overlay', 'worldmap-canvas', 'chapter-list', 'controls-card', 'btn-resume', 'btn-newgame',
];

function worldToMap(x, z, size, span) {
  return [
    ((x - WORLD_BOUNDS.minX) / (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX)) * size,
    ((z - WORLD_BOUNDS.minZ) / (WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ)) * span,
  ];
}

// HUD text + 210px rotating radar + 420x300 city map + menu button wiring.
export class HudAndRadarController {
  constructor(opts = {}) {
    this.el = {};
    for (const id of IDS) this.el[id] = document.getElementById(id);
    this.mini = this.el['minimap-canvas'];
    this.miniCtx = this.mini?.getContext('2d') || null;
    this.world = this.el['worldmap-canvas'];
    this.worldCtx = this.world?.getContext('2d') || null;
    this.menuOpen = true;
    this.onResume = opts.onResume || null;
    this.onNewGame = opts.onNewGame || null;
    this.onSave = opts.onSave || null;
    this.onLoad = opts.onLoad || null;
    this.dialogueTimer = 0;
    this.hintTimer = 0;
    this.wireMenu();
  }

  wireMenu() {
    this.el['btn-resume']?.addEventListener('click', () => this.onResume?.());
    this.el['btn-newgame']?.addEventListener('click', () => this.onNewGame?.());
    document.querySelectorAll('[data-save]')?.forEach((b) => {
      b.addEventListener('click', () => this.onSave?.(Number(b.getAttribute('data-save'))));
    });
    document.querySelectorAll('[data-load]')?.forEach((b) => {
      b.addEventListener('click', () => this.onLoad?.(Number(b.getAttribute('data-load'))));
    });
  }

  setMenuOpen(open) {
    this.menuOpen = open;
    this.el['menu-overlay']?.classList.toggle('visible', open);
  }

  showDialogue(speaker, line, ttl = 6) {
    if (this.el['dialogue-speaker']) this.el['dialogue-speaker'].textContent = speaker;
    if (this.el['dialogue-line']) this.el['dialogue-line'].textContent = line;
    if (this.el['dialogue-box']) this.el['dialogue-box'].style.opacity = '1';
    this.dialogueTimer = ttl;
  }

  setHint(text, ttl = 4) {
    if (this.el['context-hint']) this.el['context-hint'].textContent = text;
    this.hintTimer = ttl;
  }

  // state: { chapter, title, objective, dist, stars, wantedLabel, cash, respect, rank,
  //          weapon, ammo, radio, district, health, armor, speedMph, gear, vehicle, nitro,
  //          aiming, hint? }
  updateHud(state) {
    const set = (id, text) => {
      if (this.el[id] && this.el[id].textContent !== text) this.el[id].textContent = text;
    };
    set('mission-chapter', state.chapter || '');
    set('mission-title', state.title || '');
    set('mission-objective', state.objective || '');
    set('mission-dist', `${Math.max(0, Math.round(state.dist || 0))} m`);
    set('wanted-label', state.wantedLabel || 'PVPD: CLEAR');
    set('cash-value', `$${Math.round(state.cash || 0).toLocaleString('en-US')}`);
    set('respect-value', `RESPECT ${Math.round(state.respect || 0)} · ${state.rank || ''}`);
    set('weapon-name', state.weapon || '');
    set('weapon-ammo', state.ammo || '');
    set('radio-station', state.radio || '');
    set('district-name', state.district || '');
    set('speed-num', String(Math.round(state.speedMph || 0)));
    // Gear badge: derive from speed so high-MPH shots never read 'P'.
    // 148 MPH -> '5', 108 MPH -> '4', rolling on foot -> 'D', stopped -> 'P'.
    if (state.gear !== undefined && state.gear !== null && state.gear !== '' && state.gear !== 'P') {
      set('gear', String(state.gear));
    } else {
      const mph = Number(state.speedMph || 0);
      const driving = state.vehicle && state.vehicle !== 'ON FOOT';
      set('gear', !driving ? (mph > 0.5 ? 'D' : 'P') : mph >= 130 ? '5' : mph >= 70 ? '4' : mph > 5 ? '3' : String(state.gear ?? 'P'));
    }
    set('vehicle-label', state.vehicle || 'ON FOOT');
    if (this.el['health-bar-fill']) this.el['health-bar-fill'].style.width = `${Math.max(0, Math.min(100, state.health ?? 100))}%`;
    if (this.el['armor-bar-fill']) this.el['armor-bar-fill'].style.width = `${Math.max(0, Math.min(100, state.armor ?? 0))}%`;
    if (this.el['nitro-bar-fill']) this.el['nitro-bar-fill'].style.width = `${Math.max(0, Math.min(100, (state.nitro ?? 0) * 100))}%`;
    if (this.el['aim-reticle']) this.el['aim-reticle'].style.opacity = state.aiming ? '1' : '0.55';
    const stars = this.el['wanted-stars']?.children;
    if (stars) {
      for (let i = 0; i < stars.length; i += 1) {
        stars[i].className = i < (state.stars || 0) ? (state.stars >= 3 ? 'hot' : 'lit') : '';
      }
    }
    if (state.hint) this.setHint(state.hint);
  }

  tick(dt) {
    if (this.dialogueTimer > 0) {
      this.dialogueTimer -= dt;
      if (this.dialogueTimer <= 0 && this.el['dialogue-box']) this.el['dialogue-box'].style.opacity = '0.85';
    }
    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0 && this.el['context-hint']) this.el['context-hint'].textContent = '';
    }
  }

  paintGround(ctx, size) {
    const spanX = WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX;
    const spanZ = WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ;
    ctx.fillStyle = '#06121f';
    ctx.fillRect(0, 0, size, size);
    for (const d of DISTRICTS) {
      const [x, y] = worldToMap(d.center.x - d.size.x / 2, d.center.z - d.size.z / 2, size, size);
      const w = (d.size.x / spanX) * size;
      const h = (d.size.z / spanZ) * size;
      ctx.fillStyle = d.id === 'coral_promenade' ? '#8a6a4a'
        : d.id === 'downtown_vermillion' ? '#3d4a63'
        : d.id === 'bahia_cargo_docks' ? '#5e563e' : '#2f6b4a';
      ctx.fillRect(x, y, w, h);
    }
    // Water: ocean west/south + Vermillion Bay.
    ctx.fillStyle = '#0e7f96';
    const [bx, by] = worldToMap(VERMILLION_BAY.minX, VERMILLION_BAY.minZ, size, size);
    ctx.fillRect(bx, by, ((VERMILLION_BAY.maxX - VERMILLION_BAY.minX) / spanX) * size, ((VERMILLION_BAY.maxZ - VERMILLION_BAY.minZ) / spanZ) * size);
    ctx.fillRect(0, 0, ((WORLD_BOUNDS.minX + 560 - WORLD_BOUNDS.minX) / spanX) * size, size);
    ctx.fillRect(0, worldToMap(0, 590, size, size)[1], size, size);
    // Beach strip.
    ctx.fillStyle = '#c9a05e';
    ctx.fillRect(worldToMap(-560, 0, size, size)[0], 0, 14, size);
    // Roads.
    ctx.strokeStyle = '#c8c4d8';
    ctx.lineWidth = Math.max(1, size / 140);
    for (const a of ROAD_NETWORK.avenues) {
      const [x] = worldToMap(a.x, 0, size, size);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
    for (const b of ROAD_NETWORK.boulevards) {
      const [, y] = worldToMap(0, b.z, size, size);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }
    // Flamingo Causeway bridge.
    ctx.strokeStyle = '#ffc44d';
    ctx.lineWidth = Math.max(2, size / 90);
    const [fx, fy] = worldToMap(ROAD_NETWORK.bridge.from.x, ROAD_NETWORK.bridge.from.z, size, size);
    const [tx, ty] = worldToMap(ROAD_NETWORK.bridge.to.x, ROAD_NETWORK.bridge.to.z, size, size);
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    return { spanX, spanZ };
  }

  // Rotating 210x210 radar: player-up, GPS polyline, cops, traffic, guards, star.
  drawMinimap(view) {
    const ctx = this.miniCtx;
    if (!ctx) return;
    const S = 210;
    const range = 190; // world metres visible across the radar
    const scale = S / range;
    ctx.save();
    ctx.clearRect(0, 0, S, S);
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#06121f';
    ctx.fillRect(0, 0, S, S);
    // Rotate so the player heading points up; draw the local neighbourhood.
    ctx.translate(S / 2, S / 2);
    ctx.rotate(view.heading || 0);
    const px = (x) => (x - view.x) * scale;
    const pz = (z) => (z - view.z) * scale;
    const half = range / 2;
    const spanX = WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX;
    const spanZ = WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ;
    const rect = (minX, minZ, w, h, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(px(minX), pz(minZ), (w / spanX) * range, (h / spanZ) * range);
    };
    for (const d of DISTRICTS) {
      if (Math.abs(d.center.x - view.x) > d.size.x / 2 + half + 60) continue;
      if (Math.abs(d.center.z - view.z) > d.size.z / 2 + half + 60) continue;
      rect(d.center.x - d.size.x / 2, d.center.z - d.size.z / 2, d.size.x, d.size.z,
        d.id === 'coral_promenade' ? '#8a6a4a'
          : d.id === 'downtown_vermillion' ? '#3d4a63'
          : d.id === 'bahia_cargo_docks' ? '#5e563e' : '#2f6b4a');
    }
    // Water near the player (bay rect + ocean edges when in range).
    ctx.fillStyle = '#0e7f96';
    ctx.fillRect(
      px(VERMILLION_BAY.minX), pz(VERMILLION_BAY.minZ),
      ((VERMILLION_BAY.maxX - VERMILLION_BAY.minX) / spanX) * range,
      ((VERMILLION_BAY.maxZ - VERMILLION_BAY.minZ) / spanZ) * range,
    );
    if (view.x - half < -560) ctx.fillRect(px(-640), pz(view.z - half), ((80) / spanX) * range, range);
    if (view.z + half > 590) ctx.fillRect(px(view.x - half), pz(590), range, ((50) / spanZ) * range);
    // Nearby roads + Flamingo Causeway (only segments near the player).
    ctx.strokeStyle = '#c8c4d8';
    ctx.lineWidth = 1.6;
    for (const a of ROAD_NETWORK.avenues) {
      if (Math.abs(a.x - view.x) > half + 20) continue;
      ctx.beginPath();
      ctx.moveTo(px(a.x), pz(view.z - half));
      ctx.lineTo(px(a.x), pz(view.z + half));
      ctx.stroke();
    }
    for (const b of ROAD_NETWORK.boulevards) {
      if (Math.abs(b.z - view.z) > half + 20) continue;
      ctx.beginPath();
      ctx.moveTo(px(view.x - half), pz(b.z));
      ctx.lineTo(px(view.x + half), pz(b.z));
      ctx.stroke();
    }
    {
      const b = ROAD_NETWORK.bridge;
      const midX = (b.from.x + b.to.x) / 2;
      const midZ = (b.from.z + b.to.z) / 2;
      if (Math.abs(midX - view.x) < half + 230 && Math.abs(midZ - view.z) < half + 230) {
        ctx.strokeStyle = '#ffc44d';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(px(b.from.x), pz(b.from.z));
        ctx.lineTo(px(b.to.x), pz(b.to.z));
        ctx.stroke();
      }
    }
    // GPS route polyline (yellow).
    if (view.route?.points?.length) {
      ctx.strokeStyle = '#ffe14d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      view.route.points.forEach((p, i) => {
        const [rx, ry] = [px(p.x), pz(p.z)];
        if (i === 0) ctx.moveTo(rx, ry);
        else ctx.lineTo(rx, ry);
      });
      ctx.stroke();
    }
    const dot = (x, z, r, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px(x), pz(z), r, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const t of view.traffic || []) dot(t.x, t.z, 2.4, '#e8e8f2');
    for (const c of view.cops || []) {
      dot(c.x, c.z, 3.4, '#4da3ff');
      ctx.strokeStyle = 'rgba(77,163,255,0.8)';
      ctx.beginPath();
      ctx.arc(px(c.x), pz(c.z), 5.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const g of view.guards || []) dot(g.x, g.z, 3, '#ff3b3b');
    for (const lm of LANDMARKS) {
      if (lm.mission) {
        ctx.fillStyle = '#ffd97a';
        ctx.font = 'bold 11px Verdana';
        ctx.fillText('★', px(lm.pos.x) - 4, pz(lm.pos.z) + 4);
      }
    }
    // Mission star target.
    if (view.target) {
      const pulse = 6 + Math.sin((view.elapsed || 0) * 4) * 2;
      ctx.fillStyle = '#ffd97a';
      ctx.beginPath();
      ctx.arc(px(view.target.x), pz(view.target.z), pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a2400';
      ctx.font = 'bold 10px Verdana';
      ctx.fillText('★', px(view.target.x) - 4, pz(view.target.z) + 4);
    }
    ctx.restore();
    // Player chevron (screen-stable, points up).
    ctx.fillStyle = '#38e8ff';
    ctx.strokeStyle = '#062a33';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(S / 2, S / 2 - 9);
    ctx.lineTo(S / 2 - 6, S / 2 + 7);
    ctx.lineTo(S / 2 + 6, S / 2 + 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 420x300 city map: 4 districts, landmarks, GPS route, player marker.
  drawWorldMap(view) {
    const ctx = this.worldCtx;
    if (!ctx) return;
    const W = 420;
    const H = 300;
    ctx.clearRect(0, 0, W, H);
    const scaleX = W / (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX);
    const scaleZ = H / (WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ);
    const X = (x) => (x - WORLD_BOUNDS.minX) * scaleX;
    const Z = (z) => (z - WORLD_BOUNDS.minZ) * scaleZ;
    ctx.fillStyle = '#06121f';
    ctx.fillRect(0, 0, W, H);
    for (const d of DISTRICTS) {
      ctx.fillStyle = d.id === 'coral_promenade' ? '#8a6a4a'
        : d.id === 'downtown_vermillion' ? '#3d4a63'
        : d.id === 'bahia_cargo_docks' ? '#5e563e' : '#2f6b4a';
      ctx.fillRect(X(d.center.x - d.size.x / 2), Z(d.center.z - d.size.z / 2), d.size.x * scaleX, d.size.z * scaleZ);
      ctx.fillStyle = '#ffe9b8';
      ctx.font = 'bold 9px Verdana';
      ctx.fillText(d.name, X(d.center.x - d.size.x / 2) + 3, Z(d.center.z - d.size.z / 2) + 11);
    }
    ctx.fillStyle = '#0e7f96';
    ctx.fillRect(X(VERMILLION_BAY.minX), Z(VERMILLION_BAY.minZ), (VERMILLION_BAY.maxX - VERMILLION_BAY.minX) * scaleX, (VERMILLION_BAY.maxZ - VERMILLION_BAY.minZ) * scaleZ);
    ctx.strokeStyle = '#c8c4d8';
    ctx.lineWidth = 1.5;
    for (const a of ROAD_NETWORK.avenues) {
      ctx.beginPath();
      ctx.moveTo(X(a.x), 0);
      ctx.lineTo(X(a.x), H);
      ctx.stroke();
    }
    for (const b of ROAD_NETWORK.boulevards) {
      ctx.beginPath();
      ctx.moveTo(0, Z(b.z));
      ctx.lineTo(W, Z(b.z));
      ctx.stroke();
    }
    ctx.strokeStyle = '#ffc44d';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(X(ROAD_NETWORK.bridge.from.x), Z(ROAD_NETWORK.bridge.from.z));
    ctx.lineTo(X(ROAD_NETWORK.bridge.to.x), Z(ROAD_NETWORK.bridge.to.z));
    ctx.stroke();
    ctx.font = 'bold 9px Verdana';
    for (const lm of LANDMARKS) {
      ctx.fillStyle = lm.mission ? '#ffd97a' : '#9fd8ff';
      ctx.fillText(`★ ${lm.name}`, X(lm.pos.x) + 3, Z(lm.pos.z));
    }
    if (view?.route?.points?.length) {
      ctx.strokeStyle = '#ffe14d';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      view.route.points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(X(p.x), Z(p.z));
        else ctx.lineTo(X(p.x), Z(p.z));
      });
      ctx.stroke();
    }
    if (view) {
      ctx.fillStyle = '#38e8ff';
      ctx.beginPath();
      ctx.arc(X(view.x), Z(view.z), 5, 0, Math.PI * 2);
      ctx.fill();
      if (view.target) {
        ctx.fillStyle = '#ff5a4e';
        ctx.beginPath();
        ctx.arc(X(view.target.x), Z(view.target.z), 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  chapterListState(activeIndex) {
    const list = this.el['chapter-list'];
    if (!list) return;
    [...list.children].forEach((li, i) => {
      li.style.color = i === activeIndex ? '#ffc44d' : i < activeIndex ? '#7fd6a4' : '#fff8ee';
      li.textContent = `${i < activeIndex ? '✔ ' : ''}${STORY_CHAPTERS[i]?.title || li.textContent}`;
    });
  }

  districtNameAt(x, z) {
    return districtAt(x, z)?.name || (isWater(x, z) ? 'Vermillion Bay' : 'Puerto Vermillion');
  }
}

export { DISTRICTS, IDS };
