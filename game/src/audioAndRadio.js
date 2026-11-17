// Costa Vermillion: Sunset Syndicate — offline WebAudio engine hum, SFX, radio.
// 100% original synthesized content. Imports nothing (pure WebAudio, no URLs).
const STATIONS = [
  { id: 'sol', name: 'RADIO SOL 88.4', desc: 'Latin synth-pop', bass: 131, lead: [523, 659, 784, 880], tempo: 0.24 },
  { id: 'neon', name: 'NEON TIDE 101.9', desc: 'Night-synthwave drive', bass: 98, lead: [440, 554, 659, 880], tempo: 0.3 },
  { id: 'palma', name: 'PALMA 96.2', desc: 'Beach reggaeton groove', bass: 147, lead: [392, 494, 587, 784], tempo: 0.21 },
];

// Graceful offline engine hum, drift screech, siren, gunfire + 3 synth stations.
export class WebAudioEngineAndRadio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.driftSrc = null;
    this.driftGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenLfo = null;
    this.musicGain = null;
    this.stationIndex = 0;
    this.seqTimer = 0;
    this.seqStep = 0;
    this.muted = false;
    this.started = false;
  }

  get station() {
    return STATIONS[this.stationIndex];
  }

  // Browsers require a user gesture; main.js calls this on first input/click.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      this.buildEngine();
      this.buildDrift();
      this.buildSiren();
      this.buildMusicBus();
      this.started = true;
      return true;
    } catch {
      return false;
    }
  }

  buildEngine() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter).connect(this.engineGain).connect(this.master);
    this.engineOsc.start();
  }

  buildDrift() {
    const len = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    this.driftSrc = this.ctx.createBufferSource();
    this.driftSrc.buffer = buf;
    this.driftSrc.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 1.4;
    this.driftGain = this.ctx.createGain();
    this.driftGain.gain.value = 0;
    this.driftSrc.connect(bp).connect(this.driftGain).connect(this.master);
    this.driftSrc.start();
  }

  buildSiren() {
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 700;
    this.sirenLfo = this.ctx.createOscillator();
    this.sirenLfo.type = 'square';
    this.sirenLfo.frequency.value = 1.1;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 160;
    this.sirenLfo.connect(lfoGain).connect(this.sirenOsc.frequency);
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain).connect(this.master);
    this.sirenOsc.start();
    this.sirenLfo.start();
  }

  buildMusicBus() {
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);
  }

  blip(freq, dur, type = 'square', vol = 0.2, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  gunfire(weaponId = 'viper_pistol') {
    if (!this.ctx) return;
    if (weaponId === 'breacher_shotgun') this.blip(160, 0.28, 'sawtooth', 0.5, 40);
    else if (weaponId === 'coral_smg') this.blip(880, 0.07, 'square', 0.22, 220);
    else if (weaponId === 'pulse_grenade') this.blip(320, 0.4, 'sine', 0.4, 60);
    else this.blip(660, 0.12, 'square', 0.3, 140);
  }

  explosion() {
    this.blip(90, 0.9, 'sawtooth', 0.55, 28);
    this.blip(55, 1.1, 'sine', 0.5, 24);
  }

  pickup() {
    this.blip(880, 0.12, 'sine', 0.25, 1320);
  }

  uiClick() {
    this.blip(520, 0.07, 'sine', 0.18);
  }

  // Per-frame: engine rpm hum, drift screech, siren wail, music sequencer.
  update(dt, opts = {}) {
    if (!this.ctx || this.muted) return;
    const { speed = 0, drifting = false, wanted = 0 } = opts;
    if (this.engineGain) {
      const target = Math.min(0.14, 0.02 + Math.abs(speed) * 0.003);
      this.engineGain.gain.value += (target - this.engineGain.gain.value) * Math.min(1, dt * 6);
      this.engineOsc.frequency.value = 48 + Math.abs(speed) * 2.4;
      this.engineFilter.frequency.value = 320 + Math.abs(speed) * 26;
    }
    if (this.driftGain) {
      const target = drifting ? 0.12 : 0;
      this.driftGain.gain.value += (target - this.driftGain.gain.value) * Math.min(1, dt * 10);
    }
    if (this.sirenGain) {
      const target = wanted > 0 ? 0.035 + wanted * 0.008 : 0;
      this.sirenGain.gain.value += (target - this.sirenGain.gain.value) * Math.min(1, dt * 3);
    }
    // Tiny procedural synthwave/Latin sequencer for the current station.
    this.seqTimer -= dt;
    if (this.seqTimer <= 0 && this.musicGain) {
      const st = this.station;
      this.seqTimer = st.tempo;
      const step = this.seqStep % 8;
      this.seqStep += 1;
      const t = this.ctx.currentTime;
      const bass = this.ctx.createOscillator();
      bass.type = 'triangle';
      bass.frequency.value = step % 4 === 0 ? st.bass : st.bass * 1.5;
      const bg = this.ctx.createGain();
      bg.gain.setValueAtTime(0.5, t);
      bg.gain.exponentialRampToValueAtTime(0.001, t + st.tempo * 0.95);
      bass.connect(bg).connect(this.musicGain);
      bass.start(t);
      bass.stop(t + st.tempo);
      if (step % 2 === 0) {
        const lead = this.ctx.createOscillator();
        lead.type = 'square';
        lead.frequency.value = st.lead[(step / 2) % st.lead.length];
        const lg = this.ctx.createGain();
        lg.gain.setValueAtTime(0.12, t);
        lg.gain.exponentialRampToValueAtTime(0.001, t + st.tempo * 0.9);
        lead.connect(lg).connect(this.musicGain);
        lead.start(t);
        lead.stop(t + st.tempo);
      }
    }
  }

  nextStation() {
    this.stationIndex = (this.stationIndex + 1) % STATIONS.length;
    this.seqStep = 0;
    return this.station;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master && this.ctx) this.master.gain.value = this.muted ? 0 : 0.55;
    return this.muted;
  }
}

export { STATIONS };
