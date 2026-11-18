// Procedural WebAudio: engine RPM synth, screeches, sirens, gunfire, chimes
// plus three synthwave radio stations. No audio files, no network.

export class WebAudioEngineAndRadio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.stationIndex = 0;
    this.stations = ['RADIO SOL 88.4', 'BAHIA BASS 96.2', 'STARLIGHT FM 104.9'];
    this.musicTimer = 0;
    this.step = 0;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 60;
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 600;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  engine(speedRatio, nitro) {
    if (!this.ctx || this.muted) return;
    const rpm = 55 + speedRatio * 220 + (nitro ? 60 : 0);
    this.engineOsc.frequency.setTargetAtTime(rpm, this.ctx.currentTime, 0.08);
    this.engineFilter.frequency.setTargetAtTime(400 + speedRatio * 2200, this.ctx.currentTime, 0.1);
    this.engineGain.gain.setTargetAtTime(0.05 + speedRatio * 0.1, this.ctx.currentTime, 0.1);
  }

  driftScreech(amount) {
    if (!this.ctx || this.muted || amount < 0.15) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 2400 + Math.random() * 800;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.05 * amount, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2800;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  siren(on) {
    if (!this.ctx || this.muted) return;
    if (!on || this.sirenOsc) {
      if (!on && this.sirenOsc) {
        this.sirenOsc.stop();
        this.sirenOsc = null;
      }
      return;
    }
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(700, t);
    osc.frequency.linearRampToValueAtTime(950, t + 0.5);
    osc.frequency.linearRampToValueAtTime(700, t + 1.0);
    const gain = this.ctx.createGain();
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 1.05);
    this.sirenOsc = null;
  }

  gunfire(kind) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const dur = kind === 'pellet' ? 0.22 : 0.1;
    const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = kind === 'pellet' ? 1400 : 3200;
    const gain = this.ctx.createGain();
    gain.gain.value = kind === 'thrown' ? 0.25 : 0.32;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
  }

  pickupChime() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    [660, 990].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.18, t + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.25);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t + i * 0.09);
      osc.stop(t + i * 0.09 + 0.3);
    });
  }

  nextStation() {
    this.stationIndex = (this.stationIndex + 1) % this.stations.length;
    return this.currentStation();
  }

  currentStation() {
    return this.stations[this.stationIndex];
  }

  updateRadio(dt) {
    if (!this.ctx || this.muted) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = 0.24;
    const roots = [110, 98, 123.5];
    const root = roots[this.stationIndex];
    const scale = [0, 3, 5, 7, 10, 12];
    const note = root * Math.pow(2, scale[this.step % scale.length] / 12);
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = this.stationIndex === 1 ? 'square' : 'sawtooth';
    osc.frequency.value = note * 2;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900 + (this.step % 8) * 160;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.24);
    if (this.step % 4 === 0) {
      const kick = this.ctx.createOscillator();
      kick.type = 'sine';
      kick.frequency.setValueAtTime(120, t);
      kick.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      const kg = this.ctx.createGain();
      kg.gain.setValueAtTime(0.22, t);
      kg.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      kick.connect(kg);
      kg.connect(this.master);
      kick.start(t);
      kick.stop(t + 0.16);
    }
    this.step += 1;
  }
}
