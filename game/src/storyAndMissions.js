// The Sunset Ledger campaign, respect ranks, shops and 3-slot saves.
// GPS routes always refresh through getWaypointRoute so the line on the
// radar matches the roads the traffic actually drives.

import { STORY_CHAPTERS, LANDMARKS, getWaypointRoute, landmarkById } from './cityConfig.js';

const RESPECT_TITLES = [
  { min: 0, title: 'NOBODY' },
  { min: 200, title: 'RUNNER' },
  { min: 600, title: 'HUSTLER' },
  { min: 1200, title: 'SHOT CALLER' },
  { min: 2200, title: 'SUNSET ROYALTY' },
];

export class StoryCampaignManager {
  constructor() {
    this.chapterIndex = 0;
    this.stage = 0;
    this.cash = 400;
    this.respect = 0;
    this.armor = 0;
    this.gpsRoute = [];
    this.banner = '';
    this.bannerT = 0;
    this.objective = STORY_CHAPTERS[0].brief;
  }

  currentChapter() {
    return STORY_CHAPTERS[this.chapterIndex] || STORY_CHAPTERS[STORY_CHAPTERS.length - 1];
  }

  chapterLocation(chapter) {
    const mark = landmarkById(chapter.location);
    if (mark) return { x: mark.x, z: mark.z };
    return { x: 0, z: 0 };
  }

  startChapter(index) {
    this.chapterIndex = Math.max(0, Math.min(STORY_CHAPTERS.length - 1, index));
    this.stage = 0;
    const chapter = this.currentChapter();
    this.objective = chapter.brief;
    this.setBanner(`CHAPTER ${chapter.no}: ${chapter.title.toUpperCase()}`);
    return chapter;
  }

  setBanner(text) {
    this.banner = text;
    this.bannerT = 6;
  }

  refreshGps(from) {
    const target = this.chapterLocation(this.currentChapter());
    this.gpsRoute = getWaypointRoute(from, target);
    return this.gpsRoute;
  }

  advanceStage(playerPos) {
    this.stage += 1;
    this.respect += 120;
    this.cash += 250;
    this.setBanner(`STAGE ${this.stage} CLEAR  +$250`);
    if (this.stage >= 3) this.completeChapter(playerPos);
    else if (playerPos) this.refreshGps(playerPos);
  }

  completeChapter(playerPos) {
    const done = this.currentChapter();
    this.respect += 300;
    this.cash += 1000;
    if (this.chapterIndex < STORY_CHAPTERS.length - 1) {
      this.startChapter(this.chapterIndex + 1);
    } else {
      this.setBanner('THE SUNSET LEDGER: SETTLED');
    }
    return done;
  }

  respectTitle() {
    let title = RESPECT_TITLES[0].title;
    for (const row of RESPECT_TITLES) {
      if (this.respect >= row.min) title = row.title;
    }
    return title;
  }

  visitCoralModGarage() {
    this.armor = Math.min(100, this.armor + 25);
    if (this.cash >= 150) this.cash -= 150;
    return { armor: this.armor, cash: this.cash, cleared: true };
  }

  visitHarborArmory() {
    return { coral_smg: 128, breacher_shotgun: 24, pulse_grenade: 3, viper_pistol: 48 };
  }

  landmarkBlurb(id) {
    const mark = LANDMARKS.find((l) => l.id === id);
    return mark ? mark.blurb : '';
  }

  update(dt) {
    if (this.bannerT > 0) this.bannerT = Math.max(0, this.bannerT - dt);
  }

  snapshot(activeChar) {
    return {
      chapterIndex: this.chapterIndex,
      stage: this.stage,
      cash: this.cash,
      respect: this.respect,
      armor: this.armor,
      activeChar,
    };
  }

  restore(data) {
    if (!data) return;
    if (Number.isInteger(data.chapterIndex)) this.chapterIndex = data.chapterIndex;
    if (Number.isInteger(data.stage)) this.stage = data.stage;
    if (typeof data.cash === 'number') this.cash = data.cash;
    if (typeof data.respect === 'number') this.respect = data.respect;
    if (typeof data.armor === 'number') this.armor = data.armor;
    this.objective = this.currentChapter().brief;
  }
}

const SAVE_KEY = 'sunset-syndicate-save-';

export class SaveGameManager {
  constructor() {
    this.lastBadge = '';
  }

  slotKey(slot) {
    return `${SAVE_KEY}${slot}`;
  }

  save(slot, data) {
    try {
      window.localStorage.setItem(this.slotKey(slot), JSON.stringify({ ...data, savedAt: Date.now() }));
      this.lastBadge = `SAVED SLOT ${slot} ${new Date().toLocaleTimeString()}`;
      return true;
    } catch {
      this.lastBadge = 'SAVE FAILED';
      return false;
    }
  }

  load(slot) {
    try {
      const raw = window.localStorage.getItem(this.slotKey(slot));
      if (!raw) {
        this.lastBadge = `SLOT ${slot} EMPTY`;
        return null;
      }
      const data = JSON.parse(raw);
      this.lastBadge = `LOADED SLOT ${slot}`;
      return data;
    } catch {
      this.lastBadge = 'LOAD FAILED';
      return null;
    }
  }

  slotLabel(slot) {
    try {
      const raw = window.localStorage.getItem(this.slotKey(slot));
      if (!raw) return `SLOT ${slot}: EMPTY`;
      const data = JSON.parse(raw);
      const when = data.savedAt ? new Date(data.savedAt).toLocaleString() : 'unknown time';
      return `SLOT ${slot}: CH${(data.chapterIndex ?? 0) + 1} $${data.cash ?? 0} ${when}`;
    } catch {
      return `SLOT ${slot}: EMPTY`;
    }
  }
}
