// Costa Vermillion: Sunset Syndicate — 'The Sunset Ledger' campaign + save slots.
// 100% original content. Imports only './cityConfig.js'.
import {
  LANDMARKS,
  SAVE_SLOTS,
  STORY_CHAPTERS,
  WEAPON_SPECS,
  getWaypointRoute,
  landmarkById,
} from './cityConfig.js';

const RESPECT_RANKS = ['Nobody', 'Runner', 'Hustler', 'Player', 'Shot Caller', 'Syndicate', 'Sunset Legend'];

function rankFor(respect) {
  if (respect >= 600) return RESPECT_RANKS[6];
  if (respect >= 420) return RESPECT_RANKS[5];
  if (respect >= 300) return RESPECT_RANKS[4];
  if (respect >= 190) return RESPECT_RANKS[3];
  if (respect >= 100) return RESPECT_RANKS[2];
  if (respect >= 40) return RESPECT_RANKS[1];
  return RESPECT_RANKS[0];
}

// Elena Vega & Mateo Cruz comms lines per chapter stage.
const COMMS = {
  ch1_salt_neon: [
    ['MATEO CRUZ', 'Elena! You made it back. My crew is waiting at Hotel Mariposa.'],
    ['ELENA VEGA', 'The coast smells the same. Salt, neon, trouble. Show me the streets.'],
    ['MATEO CRUZ', 'That Brisa Cabrio is ours. Take it back, and shake the PVPD tail!'],
  ],
  ch2_mariposa_deal: [
    ['ELENA VEGA', 'A Solar Club buyer pays double for a Veloce GT. No questions.'],
    ['MATEO CRUZ', 'Grab one and ghost the Interceptors. Garage crew will handle the rest.'],
  ],
  ch3_engines_bahia: [
    ['MATEO CRUZ', 'The Boveda truck at Bahia Terminal is stuffed with cargo. Crack it.'],
    ['ELENA VEGA', 'Guards, cranes, heat. Fine. Deliver it to the Harbor Armory after.'],
  ],
  ch4_starlight_debts: [
    ['ELENA VEGA', 'Debts across the bay, hermana. The Causeway is our only road out.'],
    ['MATEO CRUZ', 'Safehouse first, then vanish by speedboat. The Keys hide everyone.'],
  ],
  ch5_tower_run: [
    ['MATEO CRUZ', 'A ledger page sits atop Vermillion Tower. Four stars on your tail.'],
    ['ELENA VEGA', 'Then I climb fast and leave faster. Keep the engine running.'],
  ],
  ch6_sunset_ledger: [
    ['ELENA VEGA', 'One last run. Coral, Downtown, Bahia, the Keys — all of it.'],
    ['MATEO CRUZ', 'Outrun the blockade at Palm Paradise and the ledger is ours. Forever.'],
  ],
};

const SERVICE_ZONES = [
  { kind: 'garage', id: 'coral_mod_garage', radius: 16, title: 'Coral Mod Garage' },
  { kind: 'armory', id: 'harbor_armory', radius: 16, title: 'Harbor Armory' },
];

// Drives all 6 chapters: objectives, dialogue, GPS, cash/respect, services.
export class StoryCampaignManager {
  constructor(opts = {}) {
    this.chapterIndex = 0;
    this.objectiveIndex = 0;
    this.cash = opts.cash ?? 1250;
    this.respect = opts.respect ?? 10;
    this.playerPos = { x: -400, z: 20 };
    this.route = null;
    this.routeTargetId = null;
    this.dialogueQueue = [];
    this.pendingRewards = null;
    this.completed = false;
    this.onDialogue = opts.onDialogue || null;
    this.city = opts.city || null; // { setBeaconPosition } from buildCoastalCityWorld
  }

  get chapter() {
    return STORY_CHAPTERS[Math.min(this.chapterIndex, STORY_CHAPTERS.length - 1)];
  }

  get missionTarget() {
    const lm = landmarkById(this.chapter.locationId);
    return lm ? { x: lm.pos.x, z: lm.pos.z, name: lm.name } : { x: 0, z: 0, name: 'Puerto Vermillion' };
  }

  objectiveText() {
    return this.chapter.objectives[Math.min(this.objectiveIndex, this.chapter.objectives.length - 1)];
  }

  // Fresh GPS polyline from the player to the current mission target.
  refreshRoute() {
    const t = this.missionTarget;
    this.route = getWaypointRoute({ x: this.playerPos.x, z: this.playerPos.z }, { x: t.x, z: t.z });
    this.routeTargetId = this.chapter.locationId;
    if (this.city?.setBeaconPosition) this.city.setBeaconPosition(t.x, t.z);
    return this.route;
  }

  startChapter(index) {
    this.chapterIndex = Math.max(0, Math.min(STORY_CHAPTERS.length - 1, index));
    this.objectiveIndex = 0;
    this.completed = false;
    this.pendingRewards = null;
    this.dialogueQueue = [...(COMMS[this.chapter.id] || [])];
    this.pumpDialogue();
    return this.refreshRoute();
  }

  pumpDialogue() {
    const next = this.dialogueQueue.shift();
    if (next && this.onDialogue) this.onDialogue(next[0], next[1]);
    return next || null;
  }

  // Called by main.js when a staged goal finishes; returns reward info or null.
  advanceObjective(extra = {}) {
    const ch = this.chapter;
    this.objectiveIndex += 1;
    if (this.objectiveIndex < ch.objectives.length) {
      const more = this.dialogueQueue.shift();
      if (more && this.onDialogue) this.onDialogue(more[0], more[1]);
      return { chapterComplete: false, objective: this.objectiveText() };
    }
    // Chapter complete: cash + respect progression.
    const rewardCash = 800 + ch.chapter * 450 + (extra.bonus || 0);
    const rewardRespect = 45 + ch.chapter * 22;
    this.cash += rewardCash;
    this.respect += rewardRespect;
    this.pendingRewards = { cash: rewardCash, respect: rewardRespect };
    if (this.chapterIndex >= STORY_CHAPTERS.length - 1) {
      this.completed = true;
      if (this.onDialogue) this.onDialogue('ELENA VEGA', 'The Sunset Ledger is closed. Puerto Vermillion is ours.');
      return { chapterComplete: true, campaignComplete: true, ...this.pendingRewards };
    }
    this.chapterIndex += 1;
    this.objectiveIndex = 0;
    this.dialogueQueue = [...(COMMS[this.chapter.id] || [])];
    this.pumpDialogue();
    this.refreshRoute();
    return { chapterComplete: true, campaignComplete: false, ...this.pendingRewards, next: this.chapter.title };
  }

  syncPlayerPos(x, z) {
    this.playerPos.x = x;
    this.playerPos.z = z;
  }

  missionDistance() {
    const t = this.missionTarget;
    return Math.hypot(t.x - this.playerPos.x, t.z - this.playerPos.z);
  }

  // Coral Mod Garage: respray + repair + heat clear for cash.
  garageService(player, police) {
    if (this.cash < 350) return { ok: false, reason: 'Need $350' };
    this.cash -= 350;
    if (police) police.clearHeat();
    const ctrl = player?.inVehicle;
    if (ctrl) {
      ctrl.damage = 0;
      ctrl.nitro = 1;
      const mesh = ctrl.mesh;
      mesh.traverse((o) => {
        if (o.isMesh && o.material?.color && o.material.color.getHex() !== 0x14141c) {
          o.material.color.offsetHSL(0.08, 0, 0);
        }
      });
    }
    if (player) {
      player.health = 100;
      player.armor = Math.max(player.armor, 50);
    }
    return { ok: true, service: 'Respray + repair + heat cleared' };
  }

  // Harbor Armory: armor + ammo refill for cash.
  armoryService(player, combat) {
    if (this.cash < 250) return { ok: false, reason: 'Need $250' };
    this.cash -= 250;
    if (player) {
      player.armor = 100;
      player.health = Math.min(100, player.health + 25);
    }
    if (combat) {
      for (const id of Object.keys(WEAPON_SPECS)) combat.addAmmo(id, WEAPON_SPECS[id].magazine);
    }
    return { ok: true, service: 'Armor + ammo restocked' };
  }

  serviceAt(x, z) {
    for (const s of SERVICE_ZONES) {
      const lm = landmarkById(s.id);
      if (lm && Math.hypot(lm.pos.x - x, lm.pos.z - z) < s.radius) return s;
    }
    return null;
  }

  getState() {
    return {
      chapterIndex: this.chapterIndex,
      objectiveIndex: this.objectiveIndex,
      cash: this.cash,
      respect: this.respect,
      rank: rankFor(this.respect),
      completed: this.completed,
    };
  }

  setState(s = {}) {
    if (Number.isInteger(s.chapterIndex)) this.chapterIndex = Math.max(0, Math.min(STORY_CHAPTERS.length - 1, s.chapterIndex));
    if (Number.isInteger(s.objectiveIndex)) this.objectiveIndex = Math.max(0, s.objectiveIndex);
    if (Number.isFinite(s.cash)) this.cash = s.cash;
    if (Number.isFinite(s.respect)) this.respect = s.respect;
    this.completed = !!s.completed;
    this.refreshRoute();
  }

  static rankFor = rankFor;
  static landmarks = LANDMARKS;
  static serviceZones = SERVICE_ZONES;
}

// 3-slot localStorage Save/Load for campaign + player state.
export class SaveGameManager {
  constructor(prefix = 'sunset') {
    this.prefix = prefix;
    this.slots = SAVE_SLOTS;
  }

  key(slot) {
    return `${this.prefix}_save_${slot}`;
  }

  save(slot, data) {
    try {
      window.localStorage.setItem(this.key(slot), JSON.stringify({ ...data, savedAt: Date.now() }));
      return true;
    } catch {
      return false;
    }
  }

  load(slot) {
    try {
      const raw = window.localStorage.getItem(this.key(slot));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  has(slot) {
    try {
      return window.localStorage.getItem(this.key(slot)) !== null;
    } catch {
      return false;
    }
  }

  snapshot(slot, story, player, extra = {}) {
    return this.save(slot, {
      story: story.getState(),
      player: {
        x: player.pos.x,
        z: player.pos.z,
        heading: player.heading,
        health: player.health,
        armor: player.armor,
      },
      ...extra,
    });
  }
}
