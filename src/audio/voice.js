/**
 * Browser text-to-speech casting: gives each council member a distinct system
 * voice (gender-matched where possible, natural/online voices preferred) with
 * persona pitch and rate. speak() resolves when the line ends, errors, is
 * cancelled, or a safety timeout passes, so the debate can never stall on TTS.
 */
const FEMALE = /(aria|jenny|sonia|libby|zira|hazel|susan|emma|ava|michelle|female|samantha|karen|moira|tessa|fiona|victoria|natasha|clara|jane|nancy|sara|elizabeth|catherine|linda|leah|maisie|mia|emily|olivia|ana\b|heera|neerja|google us english|google uk english female)/i;
const MALE = /(guy|ryan|davis|andrew|brian|christopher|eric|roger|steffan|david|mark|george|\bmale\b|daniel|alex\b|fred|tom\b|james|william|thomas|liam|connor|mitchell|ravi|sean|tony|jason|prabhat|google uk english male)/i;

export class Voices {
  constructor() {
    this.supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
    this.enabled = this.supported;
    this.voices = [];
    this.cast = new Map();
    this.current = null;
    this.personas = [];
    if (this.supported) {
      this.load();
      window.speechSynthesis.addEventListener?.('voiceschanged', () => this.load());
    }
  }

  load() {
    const all = window.speechSynthesis.getVoices();
    this.voices = all.filter((v) => /^en(-|_|$)/i.test(v.lang));
    if (!this.voices.length) this.voices = all;
    this.cast.clear();
    if (this.personas.length) this.castFor(this.personas);
  }

  setPersonas(list) {
    this.personas = list;
    this.castFor(list);
  }

  quality(v) {
    let q = 0;
    if (/natural|neural|online/i.test(v.name)) q += 3;
    if (/google/i.test(v.name)) q += 2;
    if (/en-us|en-gb/i.test(v.lang)) q += 1;
    return q;
  }

  castFor(personas) {
    if (!this.voices.length) return;
    const used = new Set();
    const pick = (gender) => {
      const re = gender === 'female' ? FEMALE : MALE;
      const pool = this.voices.filter((v) => re.test(v.name) && !(gender === 'female' ? MALE : FEMALE).test(v.name.replace(re, '')));
      const ranked = (pool.length ? pool : this.voices).slice().sort((a, b) => this.quality(b) - this.quality(a));
      const fresh = ranked.find((v) => !used.has(v.name));
      const v = fresh || ranked[used.size % ranked.length];
      used.add(v.name);
      return v;
    };
    for (const p of personas) this.cast.set(p.id, pick(p.voice.gender));
  }

  speak(text, persona, rateScale = 1, onBoundary = null) {
    if (!this.enabled || !this.supported || !text) return Promise.resolve(false);
    if (!this.cast.has(persona.id)) this.castFor(this.personas.length ? this.personas : [persona]);
    const synth = window.speechSynthesis;
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      const v = this.cast.get(persona.id);
      if (v) u.voice = v;
      u.pitch = persona.voice.pitch;
      u.rate = Math.min(2, persona.voice.rate * rateScale);
      u.volume = 1;
      let done = false;
      const finish = (ok) => { if (done) return; done = true; clearTimeout(timer); if (this.current === u) this.current = null; resolve(ok); };
      u.onend = () => finish(true);
      u.onerror = () => finish(false);
      if (onBoundary) u.onboundary = (e) => onBoundary(e.charIndex + (e.charLength || 0));
      const timer = setTimeout(() => finish(false), 4000 + text.split(/\s+/).length * 600 / Math.max(0.5, u.rate));
      this.current = u;
      this.currentFinish = finish;
      synth.speak(u);
    });
  }

  cancel() {
    if (!this.supported) return;
    window.speechSynthesis.cancel();
    this.currentFinish?.(false);
  }
}
