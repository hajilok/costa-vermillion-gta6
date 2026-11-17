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
  streetNameAt,
} from './cityConfig.js';

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
    this.clockMinutes = 18 * 60 + 42;
    this.wireMenu();
    this.paintAvatars();
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
    document.body.classList.toggle('menu-open', open);
  }

  showDialogue(speaker, line, ttl = 6) {
    if (this.el['dialogue-speaker']) this.el['dialogue-speaker'].textContent = speaker;
    if (this.el['dialogue-line']) this.el['dialogue-line'].textContent = line;
    if (this.el['dialogue-box']) this.el['dialogue-box'].style.opacity = '1';
    this.setAvatar(speaker);
    this.dialogueTimer = ttl;
  }

  setAvatar(speaker) {
    const box = this.el['dialogue-avatar'];
    if (!box) return;
    const key = String(speaker || '').toUpperCase();
    box.innerHTML = key.includes('MATEO') ? MATEO_SVG : ELENA_SVG;
  }

  paintAvatars() {
    this.setAvatar('ELENA VEGA');
  }

  setHint(text, ttl = 4) {
    if (this.el['context-hint']) this.el['context-hint'].textContent = text;
    this.hintTimer = ttl;
  }

  setClock(totalMinutes) {
    const mins = Math.floor(totalMinutes ?? this.clockMinutes);
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const label = `${days[Math.floor(mins / 1440) % 7]} ${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    if (this.el['clock-badge'] && this.el['clock-badge'].textContent !== label) {
      this.el['clock-badge'].textContent = label;
    }
  }

  setPursuit(rows, stars) {
    const panel = this.el['pursuit-panel'];
    const list = this.el['pursuit-list'];
    if (!panel || !list) return;
    const active = (stars || 0) > 0 && rows && rows.length > 0;
    panel.classList.toggle('on', !!active);
    if (!active) {
      list.innerHTML = '';
      return;
    }
    const html = rows.slice(0, 4).map((r) => {
      const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
      return `<li><span class="pcall">${esc(r.callsign)}</span><span class="pdist">${esc(r.distMeters)}m</span><span class="pact">${esc(r.action)}</span></li>`;
    }).join('');
    if (list.dataset.cache !== html) {
      list.innerHTML = html;
      list.dataset.cache = html;
    }
  }

  setWeaponStrip(slot, ammoBySlot) {
    document.querySelectorAll('#weapon-strip .wslot').forEach((el) => {
      const n = Number(el.getAttribute('data-slot'));
      el.classList.toggle('active', n === slot);
    });
    if (ammoBySlot) {
      for (const [k, v] of Object.entries(ammoBySlot)) {
        const cell = document.querySelector(`#weapon-strip .wammo[data-ammo="${k}"]`);
        if (cell && cell.textContent !== v) cell.textContent = v;
      }
    }
  }

  // state: { chapter, title, objective, dist, progress, stars, wantedLabel, cash, respect, rank,
  //          weapon, weaponSlot, weaponAmmo, ammo, radio, district, street, health, armor,
  //          speedMph, gear, vehicle, nitro, aiming, pursuit, clockMinutes, hint? }
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
    set('radio-station', `♪ ${state.radio || ''}`);
    set('district-name', state.district || '');
    set('street-name', state.street || '');
    set('speed-num', String(Math.round(state.speedMph || 0)));
    // Gear badge: derive from speed so high-MPH shots never read 'P'.
    if (state.gear !== undefined && state.gear !== null && state.gear !== '' && state.gear !== 'P') {
      set('speed-gear', String(state.gear));
    } else {
      const mph = Number(state.speedMph || 0);
      const driving = state.vehicle && state.vehicle !== 'ON FOOT';
      set('speed-gear', !driving ? (mph > 0.5 ? 'D' : 'P') : mph >= 130 ? '5' : mph >= 70 ? '4' : mph > 5 ? '3' : String(state.gear ?? 'P'));
    }
    set('vehicle-label', state.vehicle || 'ON FOOT');
    set('health-num', String(Math.round(state.health ?? 100)));
    set('armor-num', String(Math.round(state.armor ?? 0)));
    if (this.el['health-bar-fill']) this.el['health-bar-fill'].style.width = `${Math.max(0, Math.min(100, state.health ?? 100))}%`;
    if (this.el['armor-bar-fill']) this.el['armor-bar-fill'].style.width = `${Math.max(0, Math.min(100, state.armor ?? 0))}%`;
    if (this.el['nitro-bar-fill']) this.el['nitro-bar-fill'].style.width = `${Math.max(0, Math.min(100, (state.nitro ?? 0) * 100))}%`;
    if (this.el['mission-progress-fill']) this.el['mission-progress-fill'].style.width = `${Math.max(0, Math.min(100, (state.progress ?? 0) * 100))}%`;
    if (this.el['aim-reticle']) this.el['aim-reticle'].style.opacity = state.aiming ? '1' : '0.55';
    this.setClock(state.clockMinutes ?? (this.clockMinutes += 1 / 360));
    this.setPursuit(state.pursuit || [], state.stars || 0);
    if (state.weaponSlot) this.setWeaponStrip(state.weaponSlot, state.weaponAmmo);
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
    ctx.fillStyle = '#46435a';
    ctx.fillRect(0, 0, size, size);
    for (const d of DISTRICTS) {
      const [x, y] = worldToMap(d.center.x - d.size.x / 2, d.center.z - d.size.z / 2, size, size);
      const w = (d.size.x / spanX) * size;
      const h = (d.size.z / spanZ) * size;
      ctx.fillStyle = d.id === 'coral_promenade' ? '#4a4560'
        : d.id === 'downtown_vermillion' ? '#46435a'
        : d.id === 'bahia_cargo_docks' ? '#4c4660' : '#4e4a5a';
      ctx.fillRect(x, y, w, h);
    }
    ctx.fillStyle = '#ecc796';
    ctx.fillRect(worldToMap(-560, 0, size, size)[0], 0, 14, size);
    ctx.fillStyle = '#1ea8ba';
    const [bx, by] = worldToMap(VERMILLION_BAY.minX, VERMILLION_BAY.minZ, size, size);
    ctx.fillRect(bx, by, ((VERMILLION_BAY.maxX - VERMILLION_BAY.minX) / spanX) * size, ((VERMILLION_BAY.maxZ - VERMILLION_BAY.minZ) / spanZ) * size);
    ctx.fillRect(0, 0, ((WORLD_BOUNDS.minX + 560 - WORLD_BOUNDS.minX) / spanX) * size, size);
    ctx.fillRect(0, worldToMap(0, 590, size, size)[1], size, size);
    ctx.fillStyle = '#3f9e57';
    for (const [gx, gz] of [[-180, -140], [40, 120], [-360, 20], [200, -160], [200, 240], [-120, 300]]) {
      const [px, py] = worldToMap(gx, gz, size, size);
      ctx.fillRect(px - 4, py - 3, 8, 6);
    }
    ctx.strokeStyle = '#7d7a92';
    ctx.lineWidth = Math.max(2, size / 70);
    for (const a of ROAD_NETWORK.avenues) {
      const [x] = worldToMap(a.x, 0, size, size);
      ctx.beginPath();
      ctx.moveTo(x, worldToMap(0, a.minZ ?? WORLD_BOUNDS.minZ, size, size)[1]);
      ctx.lineTo(x, worldToMap(0, a.maxZ ?? 590, size, size)[1]);
      ctx.stroke();
      ctx.strokeStyle = '#ffd44d';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, worldToMap(0, a.minZ ?? WORLD_BOUNDS.minZ, size, size)[1]);
      ctx.lineTo(x, worldToMap(0, a.maxZ ?? 590, size, size)[1]);
      ctx.stroke();
      ctx.strokeStyle = '#7d7a92';
      ctx.lineWidth = Math.max(2, size / 70);
    }
    for (const b of ROAD_NETWORK.boulevards) {
      const [, y] = worldToMap(0, b.z, size, size);
      ctx.beginPath();
      ctx.moveTo(worldToMap(b.minX ?? WORLD_BOUNDS.minX, 0, size, size)[0], y);
      ctx.lineTo(worldToMap(b.maxX ?? WORLD_BOUNDS.maxX, 0, size, size)[0], y);
      ctx.stroke();
    }
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

  // Rotating 216x216 topographic radar: 420m span, player-up, cops, guards, star.
  drawMinimap(view) {
    const ctx = this.miniCtx;
    if (!ctx) return;
    const S = 216;
    const range = 420;
    const scale = S / range;
    ctx.save();
    ctx.clearRect(0, 0, S, S);
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#46435a';
    ctx.fillRect(0, 0, S, S);
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
        d.id === 'coral_promenade' ? '#4a4560' : '#46435a');
    }
    rect(-560, view.z - half, 40, range, '#ecc796');
    ctx.fillStyle = '#1ea8ba';
    ctx.fillRect(
      px(VERMILLION_BAY.minX), pz(VERMILLION_BAY.minZ),
      ((VERMILLION_BAY.maxX - VERMILLION_BAY.minX) / spanX) * range,
      ((VERMILLION_BAY.maxZ - VERMILLION_BAY.minZ) / spanZ) * range,
    );
    if (view.x - half < -560) ctx.fillRect(px(-640), pz(view.z - half), (80 / spanX) * range, range);
    if (view.z + half > 590) ctx.fillRect(px(view.x - half), pz(590), range, (50 / spanZ) * range);
    ctx.fillStyle = '#3f9e57';
    for (const [gx, gz] of [[-180, -140], [40, 120], [-360, 20], [200, -160], [200, 240]]) {
      if (Math.abs(gx - view.x) > half + 30 || Math.abs(gz - view.z) > half + 30) continue;
      ctx.fillRect(px(gx) - 3, pz(gz) - 2, 6, 4);
    }
    const roadSeg = (x0, z0, x1, z1) => {
      ctx.strokeStyle = '#7d7a92';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(px(x0), pz(z0));
      ctx.lineTo(px(x1), pz(z1));
      ctx.stroke();
      ctx.strokeStyle = '#ffd44d';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(px(x0), pz(z0));
      ctx.lineTo(px(x1), pz(z1));
      ctx.stroke();
    };
    for (const a of ROAD_NETWORK.avenues) {
      if (Math.abs(a.x - view.x) > half + 20) continue;
      roadSeg(a.x, Math.max(a.minZ ?? -640, view.z - half), a.x, Math.min(a.maxZ ?? 590, view.z + half));
    }
    for (const b of ROAD_NETWORK.boulevards) {
      if (Math.abs(b.z - view.z) > half + 20) continue;
      roadSeg(Math.max(b.minX ?? -640, view.x - half), b.z, Math.min(b.maxX ?? 640, view.x + half), b.z);
    }
    {
      const b = ROAD_NETWORK.bridge;
      const midX = (b.from.x + b.to.x) / 2;
      const midZ = (b.from.z + b.to.z) / 2;
      if (Math.abs(midX - view.x) < half + 230 && Math.abs(midZ - view.z) < half + 230) {
        ctx.strokeStyle = '#ffc44d';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(px(b.from.x), pz(b.from.z));
        ctx.lineTo(px(b.to.x), pz(b.to.z));
        ctx.stroke();
      }
    }
    if (view.route?.points?.length) {
      ctx.strokeStyle = 'rgba(255,225,77,0.45)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      view.route.points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(px(p.x), pz(p.z));
        else ctx.lineTo(px(p.x), pz(p.z));
      });
      ctx.stroke();
      ctx.strokeStyle = '#ffe14d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      view.route.points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(px(p.x), pz(p.z));
        else ctx.lineTo(px(p.x), pz(p.z));
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
    const pulse = 0.6 + 0.4 * Math.sin((view.elapsed || 0) * 6);
    for (const c of view.cops || []) {
      dot(c.x, c.z, 3.2, (view.elapsed || 0) % 1 < 0.5 ? '#ff3b3b' : '#4da3ff');
      ctx.strokeStyle = `rgba(77,163,255,${pulse})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(px(c.x), pz(c.z), 6, 0, Math.PI * 2);
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
    if (view.target) {
      const pr = 6 + Math.sin((view.elapsed || 0) * 4) * 2;
      ctx.fillStyle = '#ffd97a';
      ctx.beginPath();
      ctx.arc(px(view.target.x), pz(view.target.z), pr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a2400';
      ctx.font = 'bold 10px Verdana';
      ctx.fillText('★', px(view.target.x) - 4, pz(view.target.z) + 4);
    }
    ctx.restore();
    ctx.fillStyle = '#38e8ff';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(S / 2, S / 2 - 9);
    ctx.lineTo(S / 2 - 6, S / 2 + 7);
    ctx.lineTo(S / 2 + 6, S / 2 + 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();
    // North badge pinned on the rim (counter-rotated so N stays sky-north).
    const nx = S / 2 + Math.sin(-(view.heading || 0)) * (S / 2 - 12);
    const ny = S / 2 - Math.cos(-(view.heading || 0)) * (S / 2 - 12);
    ctx.fillStyle = '#0c0a18';
    ctx.beginPath();
    ctx.arc(nx, ny, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Verdana';
    ctx.textAlign = 'center';
    ctx.fillText('N', nx, ny + 4);
    ctx.textAlign = 'left';
  }

  // World map with 34px safe margins: labels flip to textAlign='right' past 64% width.
  drawWorldMap(view) {
    const ctx = this.worldCtx;
    if (!ctx) return;
    const W = 420;
    const H = 300;
    const M = 34;
    ctx.clearRect(0, 0, W, H);
    const scaleX = (W - M * 1.4) / (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX);
    const scaleZ = (H - M * 1.4) / (WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ);
    const X = (x) => M * 0.7 + (x - WORLD_BOUNDS.minX) * scaleX;
    const Z = (z) => M * 0.7 + (z - WORLD_BOUNDS.minZ) * scaleZ;
    ctx.fillStyle = '#06121f';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#46435a';
    ctx.fillRect(M * 0.5, M * 0.5, W - M, H - M);
    for (const d of DISTRICTS) {
      ctx.fillStyle = d.id === 'coral_promenade' ? '#4a4560' : '#46435a';
      ctx.fillRect(X(d.center.x - d.size.x / 2), Z(d.center.z - d.size.z / 2), d.size.x * scaleX, d.size.z * scaleZ);
      this.edgeLabel(ctx, W, d.name, X(d.center.x - d.size.x / 2) + 3, Z(d.center.z - d.size.z / 2) + 11, '#ffe9b8');
    }
    ctx.fillStyle = '#ecc796';
    ctx.fillRect(X(-560), M * 0.5, 8, H - M);
    ctx.fillStyle = '#1ea8ba';
    ctx.fillRect(X(VERMILLION_BAY.minX), Z(VERMILLION_BAY.minZ), (VERMILLION_BAY.maxX - VERMILLION_BAY.minX) * scaleX, (VERMILLION_BAY.maxZ - VERMILLION_BAY.minZ) * scaleZ);
    ctx.strokeStyle = '#7d7a92';
    ctx.lineWidth = 2.5;
    for (const a of ROAD_NETWORK.avenues) {
      ctx.beginPath();
      ctx.moveTo(X(a.x), Z(a.minZ ?? WORLD_BOUNDS.minZ));
      ctx.lineTo(X(a.x), Z(a.maxZ ?? 590));
      ctx.stroke();
    }
    for (const b of ROAD_NETWORK.boulevards) {
      ctx.beginPath();
      ctx.moveTo(X(b.minX ?? WORLD_BOUNDS.minX), Z(b.z));
      ctx.lineTo(X(b.maxX ?? WORLD_BOUNDS.maxX), Z(b.z));
      ctx.stroke();
    }
    ctx.strokeStyle = '#ffc44d';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(X(ROAD_NETWORK.bridge.from.x), Z(ROAD_NETWORK.bridge.from.z));
    ctx.lineTo(X(ROAD_NETWORK.bridge.to.x), Z(ROAD_NETWORK.bridge.to.z));
    ctx.stroke();
    ctx.font = 'bold 10px Verdana';
    const placed = [];
    for (const lm of LANDMARKS) {
      ctx.fillStyle = lm.mission ? '#ffd97a' : '#9fd8ff';
      let ly = Z(lm.pos.z);
      for (const py of placed) {
        if (Math.abs(py - ly) < 13) ly += 13;
      }
      placed.push(ly);
      this.edgeLabel(ctx, W, `★ ${lm.name}`, X(lm.pos.x) + 5, ly, ctx.fillStyle);
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

  edgeLabel(ctx, width, text, x, y, color) {
    const prev = ctx.textAlign;
    ctx.fillStyle = color;
    if (x > width * 0.64) {
      ctx.textAlign = 'right';
      ctx.fillText(text, Math.min(x, width - 8), y);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(text, x, y);
    }
    ctx.textAlign = prev;
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

  streetNameAt(x, z) {
    return streetNameAt(x, z);
  }
}

// All DOM IDs in index.html (verified against the markup).
const IDS = [
  'game-canvas', 'hud-root', 'mission-banner', 'mission-chapter', 'mission-title',
  'mission-objective', 'mission-dist', 'mission-progress-shell', 'mission-progress-fill',
  'pursuit-panel', 'pursuit-header', 'pursuit-list',
  'status-cluster', 'clock-badge', 'wanted-block', 'wanted-stars', 'wanted-label',
  'cash-value', 'respect-value', 'weapon-block', 'weapon-strip', 'weapon-name', 'weapon-ammo',
  'radio-station', 'radar-cluster', 'minimap-canvas', 'district-name', 'street-name',
  'health-bar-fill', 'armor-bar-fill', 'health-num', 'armor-num',
  'speedo-cluster', 'speed-num', 'speed-gear', 'vehicle-label', 'nitro-bar-fill',
  'aim-reticle', 'dialogue-box', 'dialogue-avatar', 'dialogue-text', 'dialogue-speaker', 'dialogue-line', 'context-hint',
  'menu-overlay', 'worldmap-canvas', 'chapter-list', 'controls-card', 'btn-resume', 'btn-newgame',
];

const ELENA_SVG = `<svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Elena Vega portrait"><rect width="56" height="56" fill="#2a1a3e"/><circle cx="28" cy="24" r="11" fill="#f2c49b"/><path d="M17 22 Q28 6 39 22 L39 16 Q28 2 17 16 Z" fill="#2a1a12"/><path d="M36 18 Q44 26 40 40 Q38 30 32 24 Z" fill="#2a1a12"/><rect x="8" y="38" width="40" height="18" rx="4" fill="#ff5a4e"/><path d="M24 38 L28 48 L32 38" fill="#7a1f18"/><circle cx="17" cy="30" r="2.4" fill="none" stroke="#ffc44d" stroke-width="1.6"/><circle cx="39" cy="30" r="2.4" fill="none" stroke="#ffc44d" stroke-width="1.6"/><circle cx="24" cy="24" r="1.4" fill="#1a1a24"/><circle cx="32" cy="24" r="1.4" fill="#1a1a24"/><path d="M24 31 Q28 34 32 31" stroke="#7a3a22" stroke-width="1.6" fill="none"/></svg>`;

const MATEO_SVG = `<svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mateo Cruz portrait"><rect width="56" height="56" fill="#0e2a3a"/><circle cx="28" cy="23" r="11" fill="#c98a5e"/><path d="M18 18 Q28 8 38 18 L38 14 Q28 4 18 14 Z" fill="#111111"/><rect x="8" y="38" width="40" height="18" rx="4" fill="#1a7a8c"/><path d="M20 38 l4 8 4-8 M28 38 l4 8 4-8" stroke="#7df3ff" stroke-width="1.6" fill="none"/><rect x="18" y="20" width="20" height="7" rx="3.5" fill="#0c0a18"/><rect x="20" y="21" width="7" height="5" rx="2" fill="#7df3ff"/><rect x="29" y="21" width="7" height="5" rx="2" fill="#7df3ff"/><path d="M24 33 Q28 36 32 33" stroke="#3a2415" stroke-width="2.4" fill="none"/><circle cx="28" cy="36" r="1.6" fill="#3a2415"/></svg>`;

function worldToMap(x, z, size, span) {
  return [
    ((x - WORLD_BOUNDS.minX) / (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX)) * size,
    ((z - WORLD_BOUNDS.minZ) / (WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ)) * span,
  ];
}

export { DISTRICTS, IDS };
