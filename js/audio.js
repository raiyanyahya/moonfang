// WebAudio chiptune engine: SFX synthesis + a step-sequenced music loop.
const AudioSys = {
  ac: null,
  master: null,
  musicGain: null,
  musicOn: true,
  running: false,
  step: 0,
  nextTime: 0,
  timer: null,
  tempoMul: 1,

  init() {
    if (this.ac) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ac = new AC();
    this.master = this.ac.createGain();
    let vol = 0.5;
    try { vol = parseFloat(localStorage.getItem('moonfang-vol')) || 0.5; } catch (e) {}
    this.master.gain.value = Math.max(0, Math.min(1, vol));
    this.master.connect(this.ac.destination);
    this.musicGain = this.ac.createGain();
    this.musicGain.gain.value = 1;
    this.musicGain.connect(this.master);
    // shared noise buffer
    const len = this.ac.sampleRate * 0.5;
    this.noiseBuf = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  },

  resume() {
    this.init();
    if (this.ac && this.ac.state === 'suspended') this.ac.resume();
  },

  setVolume(delta) {
    this.init();
    if (!this.master) return 0.5;
    const v = Math.max(0, Math.min(1, Math.round((this.master.gain.value + delta) * 10) / 10));
    this.master.gain.value = v;
    try { localStorage.setItem('moonfang-vol', String(v)); } catch (e) {}
    return v;
  },

  // ---------------------------------------------------------------- helpers
  tone(type, f0, f1, t0, dur, vol, dest) {
    if (!this.ac) return;
    const t = this.ac.currentTime + (t0 || 0);
    const o = this.ac.createOscillator();
    const g = this.ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest || this.master);
    o.start(t); o.stop(t + dur + 0.02);
  },

  noise(t0, dur, vol, hp, dest) {
    if (!this.ac) return;
    const t = this.ac.currentTime + (t0 || 0);
    const src = this.ac.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ac.createBiquadFilter();
    f.type = hp ? 'highpass' : 'lowpass';
    f.frequency.value = hp || 900;
    const g = this.ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest || this.master);
    src.start(t); src.stop(t + dur + 0.02);
  },

  // ---------------------------------------------------------------- sfx
  sfxWhip() {
    this.noise(0, 0.08, 0.35, 2500);
    this.tone('square', 900, 200, 0, 0.06, 0.08);
  },
  sfxHit() {
    this.noise(0, 0.1, 0.3, 500);
    this.tone('square', 160, 60, 0, 0.1, 0.2);
  },
  sfxCandle() {
    this.tone('square', 1800, 2400, 0, 0.05, 0.12);
    this.tone('square', 2600, 3200, 0.04, 0.06, 0.08);
  },
  sfxPickup() {
    this.tone('square', 880, 880, 0, 0.05, 0.12);
    this.tone('square', 1320, 1320, 0.06, 0.08, 0.12);
  },
  sfxOrb() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone('square', f, f, i * 0.07, 0.12, 0.12));
  },
  sfxHurt() {
    this.tone('sawtooth', 300, 80, 0, 0.18, 0.25);
    this.noise(0, 0.12, 0.2, 300);
  },
  sfxEnemyDie() {
    this.noise(0, 0.25, 0.3, 700);
    this.tone('triangle', 400, 50, 0, 0.25, 0.25);
  },
  sfxJump() {
    this.tone('square', 250, 500, 0, 0.07, 0.05);
  },
  sfxDash() {
    this.noise(0, 0.1, 0.15, 1600);
  },
  sfxRoar() {
    this.tone('sawtooth', 90, 45, 0, 0.55, 0.35);
    this.tone('sawtooth', 140, 60, 0.05, 0.5, 0.25);
    this.noise(0, 0.5, 0.2, 250);
  },
  sfxDeath() {
    [660, 550, 440, 330, 220, 110].forEach((f, i) =>
      this.tone('square', f, f * 0.9, i * 0.09, 0.12, 0.15));
  },
  sfxThrow() {
    this.noise(0, 0.06, 0.12, 1800);
    this.tone('square', 620, 340, 0, 0.07, 0.07);
  },
  sfxItem() {
    [660, 880, 1320].forEach((f, i) => this.tone('square', f, f, i * 0.07, 0.12, 0.11));
    this.tone('triangle', 330, 330, 0, 0.3, 0.12);
  },
  sfxSoul() {
    this.tone('sine', 520, 780, 0, 0.35, 0.14);
    this.tone('sine', 780, 1170, 0.08, 0.35, 0.1);
    this.noise(0, 0.3, 0.05, 4000);
  },
  sfxPetrify() {
    this.tone('square', 220, 70, 0, 0.14, 0.18);
    this.noise(0, 0.06, 0.2, 500);
    this.tone('square', 90, 60, 0.1, 0.1, 0.1);
  },
  sfxThunder() {
    if (!this.ac) return;
    const t = this.ac.currentTime;
    const src = this.ac.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(420, t);
    f.frequency.exponentialRampToValueAtTime(60, t + 1.6);
    const g = this.ac.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.55, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 1.9);
    this.tone('sine', 52, 28, 0.05, 1.4, 0.25);
  },
  sfxCrash() {
    this.tone('triangle', 98, 98, 0, 1.4, 0.3);
    this.noise(0, 0.4, 0.4, 900);
    [880, 1175, 1568, 2093].forEach((f, i) => this.tone('square', f, f, 0.05 + i * 0.06, 0.14, 0.1));
    this.tone('sawtooth', 120, 50, 0, 0.5, 0.2);
  },
  sfxWind() {
    if (!this.ac) return;
    const t = this.ac.currentTime;
    const src = this.ac.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(220, t);
    f.frequency.linearRampToValueAtTime(480, t + 1.1);
    f.frequency.linearRampToValueAtTime(180, t + 2.4);
    const g = this.ac.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.9);
    g.gain.linearRampToValueAtTime(0.001, t + 2.5);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 2.6);
  },
  sfxBell() {
    this.tone('triangle', 98, 98, 0, 2.2, 0.4);
    this.tone('triangle', 147, 147, 0, 1.8, 0.16);
    this.tone('sine', 264, 262, 0, 1.2, 0.07);   // slightly inharmonic partial
    this.noise(0, 0.05, 0.2, 2500);
  },
  sfxClear() {
    const seq = [523, 659, 784, 1047, 784, 1047, 1319, 1568];
    seq.forEach((f, i) => this.tone('square', f, f, i * 0.11, 0.15, 0.12));
    seq.forEach((f, i) => this.tone('triangle', f / 2, f / 2, i * 0.11, 0.18, 0.15));
  },

  // ---------------------------------------------------------------- music
  // 8 bars of 8 eighth-notes, A minor. null = rest, '-' = tie handled by rest.
  LEAD: [
    'A4', null, 'C5', null, 'E5', null, 'D5', 'C5',
    'E5', null, 'C5', 'A4', 'B4', null, null, null,
    'A4', null, 'C5', null, 'F5', null, 'E5', 'D5',
    'B4', null, 'D5', null, 'G4', null, 'A4', 'B4',
    'C5', null, 'A4', null, 'E5', null, 'D5', 'C5',
    'F5', 'E5', 'D5', 'C5', 'D5', null, 'A4', null,
    'D5', null, 'F5', null, 'A5', null, 'G5', 'F5',
    'G#4', 'B4', 'E5', null, 'G#4', null, 'B4', null,
  ],
  BASS: [
    'A2', null, 'A2', 'E2', 'A2', null, 'E2', null,
    'A2', null, 'A2', 'E2', 'A2', null, 'G2', null,
    'F2', null, 'F2', 'C3', 'F2', null, 'C3', null,
    'G2', null, 'G2', 'D3', 'G2', null, 'B2', null,
    'A2', null, 'A2', 'E2', 'A2', null, 'E2', null,
    'F2', null, 'F2', 'C3', 'F2', null, 'F2', null,
    'D2', null, 'D2', 'A2', 'D2', null, 'D2', null,
    'E2', null, 'E2', 'B2', 'E2', 'E2', 'E2', null,
  ],
  HAT: [1, 0, 1, 0, 1, 0, 1, 1],

  // second movement in D minor for even-numbered stages
  LEAD2: [
    'D5', null, 'F5', null, 'A5', 'G5', 'F5', 'E5',
    'F5', null, 'D5', null, 'A4', null, 'D5', null,
    'A#4', null, 'D5', null, 'G5', 'F5', 'E5', 'D5',
    'C5', null, 'E5', null, 'G4', null, 'C5', 'E5',
    'D5', null, 'A4', null, 'F5', null, 'E5', 'D5',
    'A#4', 'C5', 'D5', 'F5', 'E5', null, 'C5', null,
    'G4', null, 'A#4', null, 'D5', null, 'C5', 'A#4',
    'A4', null, 'C#5', null, 'E5', null, 'A4', null,
  ],
  BASS2: [
    'D2', null, 'D2', 'A2', 'D2', null, 'A2', null,
    'D2', null, 'D2', 'A2', 'D2', null, 'C3', null,
    'A#2', null, 'A#2', 'F2', 'A#2', null, 'F2', null,
    'C3', null, 'C3', 'G2', 'C3', null, 'E2', null,
    'D2', null, 'D2', 'A2', 'D2', null, 'A2', null,
    'A#2', null, 'A#2', 'F2', 'A#2', null, 'A#2', null,
    'G2', null, 'G2', 'D2', 'G2', null, 'G2', null,
    'A2', null, 'A2', 'E2', 'A2', 'A2', 'A2', null,
  ],

  noteFreq(n) {
    const NAMES = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
    const m = n.match(/^([A-G]#?)(\d)$/);
    const semis = NAMES[m[1]] + (parseInt(m[2]) + 1) * 12;
    return 440 * Math.pow(2, (semis - 69) / 12);
  },

  startMusic() {
    this.init();
    if (!this.ac || this.running) return;
    this.running = true;
    this.step = 0;
    this.nextTime = this.ac.currentTime + 0.06;
    this.timer = setInterval(() => this.schedule(), 30);
  },

  stopMusic() {
    this.running = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  },

  schedule() {
    if (!this.running || !this.musicOn) { return; }
    const stepDur = (60 / 152 / 2) / this.tempoMul; // eighth notes at 152 bpm
    // re-sync after mute or tab suspend so we don't burst queued notes
    if (this.nextTime < this.ac.currentTime - 0.05) this.nextTime = this.ac.currentTime + 0.02;
    while (this.nextTime < this.ac.currentTime + 0.12) {
      const s = this.step % 64;
      const dt = this.nextTime - this.ac.currentTime;
      const second = typeof game !== 'undefined' && game.stage % 2 === 0;
      const lead = (second ? this.LEAD2 : this.LEAD)[s];
      if (lead) {
        const f = this.noteFreq(lead);
        this.tone('square', f, 0, dt, stepDur * 0.9, 0.055, this.musicGain);
        // cathedral echo one step behind
        this.tone('square', f, 0, dt + stepDur, stepDur * 0.8, 0.018, this.musicGain);
      }
      const bass = (second ? this.BASS2 : this.BASS)[s];
      if (bass) this.tone('triangle', this.noteFreq(bass), 0, dt, stepDur * 0.95, 0.14, this.musicGain);
      if (this.HAT[s % 8]) this.noise(dt, 0.03, 0.03, 6000, this.musicGain);
      if (s % 8 === 0) this.noise(dt, 0.08, 0.1, 150, this.musicGain);
      this.nextTime += stepDur;
      this.step++;
    }
  },

  toggleMusic() {
    this.musicOn = !this.musicOn;
    return this.musicOn;
  },

  setBossTempo(on) { this.tempoMul = on ? 1.18 : 1; },
};
