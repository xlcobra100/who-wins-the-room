/**
 * Procedural sound design (WebAudio, no samples): chamber ambience that
 * tightens with tension, gavel knocks, crisis siren, whisper shimmer, ballot
 * chimes and the verdict chord. The AudioContext is created on first use
 * (browsers require a user gesture).
 */
export class Sfx {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.6;
    this.tension = 40;
  }

  ensure() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? this.volume : 0;
      this.master.connect(this.ctx.destination);
      this.buildAmbience();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? this.volume : 0, this.ctx.currentTime, 0.1);
  }

  setVolume(v) {
    this.volume = v;
    if (this.master && this.enabled) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  noiseBuffer(seconds = 2, brown = false) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return buf;
  }

  buildAmbience() {
    const ctx = this.ctx;
    const amb = ctx.createGain();
    amb.gain.value = 0.0;
    amb.gain.setTargetAtTime(0.5, ctx.currentTime, 2.5);
    amb.connect(this.master);
    this.amb = amb;
    // Low reactor drone.
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 160;
    lp.connect(amb);
    for (const [f, g] of [[55, 0.05], [55.4, 0.05], [82.5, 0.02]]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = g;
      o.connect(og).connect(lp);
      o.start();
    }
    // Air handlers.
    const air = ctx.createBufferSource();
    air.buffer = this.noiseBuffer(4, true);
    air.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 420;
    bp.Q.value = 0.6;
    const ag = ctx.createGain();
    ag.gain.value = 0.05;
    air.connect(bp).connect(ag).connect(amb);
    air.start();
    // Tension layer: a slow low pulse that rises above 55. (There used to be a
    // 1244 Hz tone tremoloed at 5 Hz here too; players heard it as a fast,
    // nagging background beep, so it was removed. Don't bring back high tones.)
    this.tensionGain = ctx.createGain();
    this.tensionGain.gain.value = 0;
    this.tensionGain.connect(amb);
    const pulse = ctx.createOscillator();
    pulse.type = 'sine';
    pulse.frequency.value = 48;
    const pulseG = ctx.createGain();
    pulseG.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 1.1;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.09;
    lfo.connect(lfoG).connect(pulseG.gain);
    pulse.connect(pulseG).connect(this.tensionGain);
    pulse.start(); lfo.start();
    this.setTension(this.tension);
  }

  setTension(t) {
    this.tension = t;
    if (!this.ctx) return;
    const k = Math.max(0, (t - 55) / 45);
    this.tensionGain.gain.setTargetAtTime(k * 1.4, this.ctx.currentTime, 1.5);
  }

  env(node, t0, a, peak, d) {
    node.gain.setValueAtTime(0.0001, t0);
    node.gain.exponentialRampToValueAtTime(peak, t0 + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }

  tone(freq, { type = 'sine', at = 0, a = 0.01, d = 0.3, peak = 0.2, glide = null } = {}) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + at;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, t0 + a + d);
    const g = ctx.createGain();
    this.env(g, t0, a, peak, d);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + a + d + 0.05);
  }

  knock(at) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.2);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1100;
    bp.Q.value = 1.4;
    const g = ctx.createGain();
    this.env(g, t0, 0.002, 0.7, 0.09);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t0);
    this.tone(150, { at, a: 0.003, d: 0.16, peak: 0.55, glide: 70 });
  }

  gavel() { if (!this.ensure()) return; this.knock(0); this.knock(0.24); }

  alarm() {
    if (!this.ensure()) return;
    for (let i = 0; i < 3; i++) {
      this.tone(620, { type: 'triangle', at: i * 0.62, a: 0.02, d: 0.52, peak: 0.16, glide: 940 });
    }
    this.tone(62, { type: 'sine', at: 0, a: 0.01, d: 1.4, peak: 0.5, glide: 38 });
  }

  whisper() {
    if (!this.ensure()) return;
    [1318, 1760, 2637, 3520].forEach((f, i) => this.tone(f, { at: i * 0.07, a: 0.25, d: 1.3, peak: 0.035 }));
  }

  carrier() {
    if (!this.ensure()) return;
    // Sci-fi telemetry sweep + electronic transmission chirp
    this.tone(440, { type: 'sawtooth', at: 0, a: 0.05, d: 0.8, peak: 0.08, glide: 880 });
    [880, 1174, 1480, 1760].forEach((f, i) => this.tone(f, { type: 'sine', at: 0.15 + i * 0.08, a: 0.02, d: 0.6, peak: 0.05 }));
  }

  sway() {
    if (!this.ensure()) return;
    [523.25, 659.25, 783.99].forEach((f, i) => this.tone(f, { type: 'sine', at: i * 0.06, a: 0.02, d: 0.45, peak: 0.04 }));
  }

  blip() { this.tone(1480, { a: 0.004, d: 0.07, peak: 0.04 }); }

  click() { this.tone(2400, { a: 0.002, d: 0.03, peak: 0.03 }); }

  ballot(vote) {
    if (vote === 'AYE') { this.tone(660, { a: 0.01, d: 0.25, peak: 0.12 }); this.tone(990, { at: 0.11, a: 0.01, d: 0.4, peak: 0.12 }); }
    else if (vote === 'NAY') { this.tone(330, { type: 'triangle', a: 0.01, d: 0.25, peak: 0.13 }); this.tone(220, { type: 'triangle', at: 0.12, a: 0.01, d: 0.45, peak: 0.13 }); }
    else this.tone(440, { a: 0.01, d: 0.4, peak: 0.08 });
  }

  verdict(passed) {
    const chord = passed ? [261.6, 329.6, 392, 523.3] : [220, 261.6, 311.1, 415.3];
    chord.forEach((f, i) => this.tone(f, { type: 'sine', at: i * 0.05, a: 0.08, d: 2.4, peak: 0.07 }));
    this.tone(passed ? 65.4 : 55, { at: 0, a: 0.02, d: 2.2, peak: 0.25 });
  }
}
