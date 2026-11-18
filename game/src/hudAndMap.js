// HUD, rotating radar and world map. Minimap is a full-color topographic
// disc; the world map is unclipped with right-edge label alignment.

import { WORLD_BOUNDS, DISTRICTS, ROAD_NETWORK, VERMILLION_BAY, LANDMARKS, isWater, districtAt } from './cityConfig.js';

const AVATARS = {
  ELENA: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 56'><circle cx='28' cy='28' r='28' fill='%23ff5f6d'/><circle cx='28' cy='22' r='10' fill='%23f2c49b'/><path d='M14 24 Q28 8 42 24 L40 34 Q28 24 16 34 Z' fill='%232a1a12'/><rect x='18' y='38' width='20' height='14' rx='4' fill='%2327324a'/></svg>",
  MATEO: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 56'><circle cx='28' cy='28' r='28' fill='%2322d3ee'/><circle cx='28' cy='22' r='10' fill='%23d9a077'/><path d='M16 20 Q28 12 40 20 L39 26 Q28 20 17 26 Z' fill='%23111111'/><rect x='18' y='38' width='20' height='14' rx='4' fill='%23382a1a'/></svg>",
};

export function avatarFor(name) {
  return String(name || '').toUpperCase().includes('MATEO') ? AVATARS.MATEO : AVATARS.ELENA;
}

function worldToMap(x, z, size) {
  const span = WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX;
  const px = ((x - WORLD_BOUNDS.minX) / span) * size;
  const pz = ((z - WORLD_BOUNDS.minZ) / span) * size;
  return { x: px, y: pz };
}

export class HudAndRadarController {
  constructor() {
    this.el = {};
    this.menuOpen = false;
  }

  grab() {
    const ids = [
      'mission-title', 'mission-stage', 'mission-progress-fill', 'pursuit-panel', 'pursuit-list',
      'clock-badge', 'cash-value', 'wanted-stars', 'wanted-label', 'respect-value', 'weapon-strip',
      'weapon-name', 'weapon-ammo', 'radio-station', 'minimap-canvas', 'district-name', 'street-name',
      'health-fill', 'health-num', 'armor-fill', 'armor-num', 'speed-value', 'vehicle-name',
      'aim-reticle', 'dialogue-box', 'dialogue-avatar', 'dialogue-speaker', 'dialogue-line',
      'context-hint', 'menu-overlay', 'worldmap-canvas', 'save-badge', 'chapter-list',
    ];
    for (const id of ids) this.el[id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = document.getElementById(id);
    this.minimap = this.el.minimapCanvas ? this.el.minimapCanvas.getContext('2d') : null;
    this.worldmap = this.el.worldmapCanvas ? this.el.worldmapCanvas.getContext('2d') : null;
  }

  setMenuOpen(open) {
    this.menuOpen = open;
    document.body.classList.toggle('menu-open', open);
  }

  setBanner(title, stageText, frac) {
    if (this.el.missionTitle) this.el.missionTitle.textContent = title;
    if (this.el.missionStage) this.el.missionStage.textContent = stageText;
    if (this.el.missionProgressFill) this.el.missionProgressFill.style.width = `${Math.round(frac * 100)}%`;
  }

  setStatus(opts) {
    if (this.el.clockBadge) this.el.clockBadge.textContent = opts.clock;
    if (this.el.cashValue) this.el.cashValue.textContent = `$${opts.cash}`;
    if (this.el.respectValue) this.el.respectValue.textContent = opts.respect;
    if (this.el.wantedLabel) this.el.wantedLabel.textContent = opts.wantedLabel;
    if (this.el.wantedStars) {
      const spans = this.el.wantedStars.querySelectorAll('span');
      spans.forEach((s, i) => s.classList.toggle('lit', i < opts.stars));
    }
    if (this.el.weaponName) this.el.weaponName.textContent = opts.weaponName;
    if (this.el.weaponAmmo) this.el.weaponAmmo.textContent = opts.weaponAmmo;
    if (this.el.radioStation) this.el.radioStation.textContent = opts.radio;
    if (this.el.districtName) this.el.districtName.textContent = opts.district;
    if (this.el.streetName) this.el.streetName.textContent = opts.street;
    if (this.el.healthFill) this.el.healthFill.style.width = `${opts.health}%`;
    if (this.el.healthNum) this.el.healthNum.textContent = String(Math.round(opts.health));
    if (this.el.armorFill) this.el.armorFill.style.width = `${opts.armor}%`;
    if (this.el.armorNum) this.el.armorNum.textContent = String(Math.round(opts.armor));
    if (this.el.speedValue) this.el.speedValue.textContent = String(Math.round(opts.speed));
    if (this.el.vehicleName) this.el.vehicleName.textContent = opts.vehicle;
    if (this.el.aimReticle) this.el.aimReticle.style.display = opts.aiming ? 'block' : 'none';
  }

  setDialogue(speaker, line) {
    if (this.el.dialogueSpeaker) this.el.dialogueSpeaker.textContent = speaker;
    if (this.el.dialogueLine) this.el.dialogueLine.textContent = line;
    if (this.el.dialogueAvatar) {
      this.el.dialogueAvatar.style.backgroundImage = `url("${avatarFor(speaker)}")`;
      this.el.dialogueAvatar.style.backgroundSize = 'cover';
    }
    if (this.el.dialogueBox) this.el.dialogueBox.style.display = line ? 'flex' : 'none';
  }

  setPursuit(rows) {
    if (!this.el.pursuitList || !this.el.pursuitPanel) return;
    this.el.pursuitList.innerHTML = '';
    for (const row of rows.slice(0, 4)) {
      const li = document.createElement('li');
      li.textContent = `${row.callsign} ${row.distMeters}m ${row.action}`;
      this.el.pursuitList.appendChild(li);
    }
    this.el.pursuitPanel.style.display = rows.length ? 'block' : 'none';
  }

  drawMinimap(player, heading, gpsRoute, cops, target) {
    if (!this.minimap) return;
    const ctx = this.minimap;
    const S = 216;
    const RANGE = 420;
    ctx.save();
    ctx.clearRect(0, 0, S, S);
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#1ea8ba';
    ctx.fillRect(0, 0, S, S);
    ctx.translate(S / 2, S / 2);
    ctx.rotate(heading);
    const k = (S / 2) / RANGE;
    const px = player.x;
    const pz = player.z;
    // Landmass with beach rim.
    ctx.fillStyle = '#ecc796';
    ctx.fillRect(-RANGE * k, -RANGE * k, RANGE * 2 * k, RANGE * 2 * k);
    ctx.fillStyle = '#46435a';
    const beach = 14 * k;
    ctx.fillRect(-RANGE * k + beach, -RANGE * k + beach, RANGE * 2 * k - beach * 2, RANGE * 2 * k - beach * 2);
    // Water cutouts move with the player.
    ctx.fillStyle = '#1ea8ba';
    const bay = VERMILLION_BAY;
    const bayX = (bay.minX - px) * k;
    const bayZ = (bay.minZ - pz) * k;
    const bayW = (bay.maxX - bay.minX) * k;
    const bayH = (bay.maxZ - bay.minZ) * k;
    ctx.fillRect(bayX, bayZ, bayW, bayH);
    // Ocean west + south edges.
    if (px - RANGE < -560) ctx.fillRect((-560 - px) * k - RANGE * k, -RANGE * k, RANGE * 2 * k, RANGE * 2 * k);
    // Parks.
    ctx.fillStyle = '#3f9e4d';
    ctx.fillRect((60 - px) * k - 20 * k, (-140 - pz) * k - 14 * k, 40 * k, 28 * k);
    ctx.fillRect((-320 - px) * k - 16 * k, (300 - pz) * k - 12 * k, 32 * k, 24 * k);
    // Roads: slate with yellow centerlines.
    for (const a of ROAD_NETWORK.avenues) {
      const x = (a.x - px) * k;
      const z0 = (a.minZ - pz) * k;
      const z1 = (a.maxZ - pz) * k;
      ctx.strokeStyle = '#7d7a92';
      ctx.lineWidth = Math.max(2, 10 * k);
      ctx.beginPath();
      ctx.moveTo(x, z0);
      ctx.lineTo(x, z1);
      ctx.stroke();
      ctx.strokeStyle = '#ffd94d';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, z0);
      ctx.lineTo(x, z1);
      ctx.stroke();
    }
    for (const b of ROAD_NETWORK.boulevards) {
      const z = (b.z - pz) * k;
      const x0 = (b.minX - px) * k;
      const x1 = (b.maxX - px) * k;
      ctx.strokeStyle = '#7d7a92';
      ctx.lineWidth = Math.max(2, 10 * k);
      ctx.beginPath();
      ctx.moveTo(x0, z);
      ctx.lineTo(x1, z);
      ctx.stroke();
      ctx.strokeStyle = '#ffd94d';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, z);
      ctx.lineTo(x1, z);
      ctx.stroke();
    }
    // GPS route in gold.
    if (gpsRoute && gpsRoute.length > 1) {
      ctx.strokeStyle = '#ffd94d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      gpsRoute.forEach((p, i) => {
        const gx = (p.x - px) * k;
        const gz = (p.z - pz) * k;
        if (i === 0) ctx.moveTo(gx, gz);
        else ctx.lineTo(gx, gz);
      });
      ctx.stroke();
    }
    // Cops: red/blue blips.
    for (const cop of cops || []) {
      ctx.fillStyle = cop.kind === 'heli' ? '#ff4444' : '#4499ff';
      ctx.beginPath();
      ctx.arc((cop.x - px) * k, (cop.z - pz) * k, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Target star.
    if (target) {
      ctx.fillStyle = '#ffd94d';
      const tx = (target.x - px) * k;
      const tz = (target.z - pz) * k;
      ctx.save();
      ctx.translate(tx, tz);
      ctx.fillRect(-5, -1.5, 10, 3);
      ctx.fillRect(-1.5, -5, 3, 10);
      ctx.restore();
    }
    // Player arrow with white border, pointing up (rotated frame).
    ctx.rotate(-heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(8, 8);
    ctx.lineTo(0, 4);
    ctx.lineTo(-8, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff5f6d';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5.5, 6);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-5.5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // North badge.
    ctx.fillStyle = 'rgba(10,10,20,0.7)';
    ctx.fillRect(S - 30, 8, 22, 22);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px Arial';
    ctx.fillText('N', S - 24, 24);
  }

  drawWorldMap(player, gpsRoute, cops, target, chapters, activeChapter) {
    if (!this.worldmap) return;
    const ctx = this.worldmap;
    const W = 560;
    const H = 380;
    const M = 34;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#1ea8ba';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ecc796';
    ctx.fillRect(M - 6, M - 6, W - (M - 6) * 2, H - (M - 6) * 2);
    ctx.fillStyle = '#46435a';
    ctx.fillRect(M, M, W - M * 2, H - M * 2);
    const bay = VERMILLION_BAY;
    const mx = (x) => M + ((x - WORLD_BOUNDS.minX) / (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX)) * (W - M * 2);
    const mz = (z) => M + ((z - WORLD_BOUNDS.minZ) / (WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ)) * (H - M * 2);
    ctx.fillStyle = '#1ea8ba';
    ctx.fillRect(mx(bay.minX), mz(bay.minZ), mx(bay.maxX) - mx(bay.minX), mz(bay.maxZ) - mz(bay.minZ));
    ctx.fillStyle = '#1ea8ba';
    ctx.fillRect(0, 0, M - 6, H);
    for (const d of DISTRICTS) {
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.strokeRect(mx(d.minX), mz(d.minZ), mx(d.maxX) - mx(d.minX), mz(d.maxZ) - mz(d.minZ));
    }
    for (const a of ROAD_NETWORK.avenues) {
      ctx.strokeStyle = '#7d7a92';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(mx(a.x), mz(a.minZ));
      ctx.lineTo(mx(a.x), mz(a.maxZ));
      ctx.stroke();
    }
    for (const b of ROAD_NETWORK.boulevards) {
      ctx.strokeStyle = '#7d7a92';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(mx(b.minX), mz(b.z));
      ctx.lineTo(mx(b.maxX), mz(b.z));
      ctx.stroke();
    }
    if (gpsRoute && gpsRoute.length > 1) {
      ctx.strokeStyle = '#ffd94d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      gpsRoute.forEach((p, i) => {
        if (i === 0) ctx.moveTo(mx(p.x), mz(p.z));
        else ctx.lineTo(mx(p.x), mz(p.z));
      });
      ctx.stroke();
    }
    ctx.font = '11px Arial';
    for (const d of DISTRICTS) {
      const cx = mx((d.minX + d.maxX) / 2);
      const cy = mz((d.minZ + d.maxZ) / 2);
      const nearRight = cx > W - 110;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const w = ctx.measureText(d.name).width + 10;
      const lx = nearRight ? cx - w : cx;
      ctx.fillRect(lx - 5, cy - 12, w, 16);
      ctx.fillStyle = '#fff';
      ctx.fillText(d.name, lx, cy);
    }
    for (const cop of cops || []) {
      ctx.fillStyle = cop.kind === 'heli' ? '#ff4444' : '#4499ff';
      ctx.beginPath();
      ctx.arc(mx(cop.x), mz(cop.z), 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (target) {
      ctx.fillStyle = '#ffd94d';
      ctx.fillRect(mx(target.x) - 5, mz(target.z) - 1.5, 10, 3);
      ctx.fillRect(mx(target.x) - 1.5, mz(target.z) - 5, 3, 10);
    }
    // Gold GPS route polyline across the world map.
    if (gpsRoute && gpsRoute.length > 1) {
      ctx.strokeStyle = '#ffd94d';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      gpsRoute.forEach((p, i) => {
        if (i === 0) ctx.moveTo(mx(p.x), mz(p.z));
        else ctx.lineTo(mx(p.x), mz(p.z));
      });
      ctx.stroke();
      const end = gpsRoute[gpsRoute.length - 1];
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.arc(mx(end.x), mz(end.z), 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Named landmark stars: five key story locations.
    const STAR_SPOTS = [
      { x: -415, z: 120, label: 'Hotel Mariposa' },
      { x: 10, z: -120, label: 'Vermillion Tower' },
      { x: -40, z: 60, label: 'Coral Mod Garage' },
      { x: 505, z: -420, label: 'Starlight Villa' },
      { x: 250, z: 300, label: 'Harbor Armory' },
    ];
    ctx.font = 'bold 10px Arial';
    for (const spot of STAR_SPOTS) {
      const sx = mx(spot.x);
      const sy = mz(spot.z);
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 6 : 2.8;
        const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
        const vx = sx + Math.cos(a) * r;
        const vy = sy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(vx, vy);
        else ctx.lineTo(vx, vy);
      }
      ctx.closePath();
      ctx.fill();
      const w = ctx.measureText(spot.label).width + 8;
      let lx = sx + 9;
      if (lx + w > 560) lx = sx - 9 - w;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(lx, sy - 9, w, 14);
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText(spot.label, lx + 4, sy + 2);
    }
    void LANDMARKS;
    const list = this.el.chapterList;
    if (list) {
      const items = list.querySelectorAll('li');
      items.forEach((li, i) => {
        li.style.fontWeight = i === activeChapter ? '800' : '400';
        li.style.color = i === activeChapter ? '#ffd94d' : '#f2ecff';
      });
    }
    void chapters;
    // Player marker.
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(mx(player.x), mz(player.z), 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff5f6d';
    ctx.beginPath();
    ctx.arc(mx(player.x), mz(player.z), 3.5, 0, Math.PI * 2);
    ctx.fill();
    void isWater;
    void districtAt;
  }
}
