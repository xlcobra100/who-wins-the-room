/**
 * Holographic centerpiece above the council table.
 *
 * - glyph: a scenario-specific wireframe emblem (planet / signal / spore / treaty / mind)
 * - colour follows tension: cyan → amber → red
 * - stance arcs: one arc per seat, facing that member, coloured by their current
 *   option and brightened by conviction; during a vote they show the ballots
 * - pulses: crisis shockwave, gavel flash, whisper shimmer
 */
import * as THREE from 'three';
import { TABLE_TOP } from './room.js';

const CALM = new THREE.Color('#5fe1ff');
const TENSE = new THREE.Color('#ffb547');
const DANGER = new THREE.Color('#ff4b5c');

function additive(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
}

export class Hologram {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.position.y = TABLE_TOP;
    scene.add(this.group);
    this.color = CALM.clone();
    this.targetColor = CALM.clone();
    this.flash = 0;
    this.shock = 0;
    this.time = 0;
    this.mats = [];

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 0.07, 64), new THREE.MeshStandardMaterial({ color: '#10141c', metalness: 0.8, roughness: 0.3 }));
    base.position.y = 0.035;
    this.group.add(base);
    this.baseRing = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.014, 8, 96), this.track(additive(CALM, 1)));
    this.baseRing.rotation.x = Math.PI / 2;
    this.baseRing.position.y = 0.075;
    this.group.add(this.baseRing);

    // Light cone.
    this.coneMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: this.color }, uTime: { value: 0 }, uBoost: { value: 0 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide, toneMapped: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform vec3 uColor; uniform float uTime; uniform float uBoost; varying vec2 vUv;
        void main(){
          float fade = pow(1.0 - vUv.y, 1.6);
          float scan = 0.75 + 0.25 * sin(vUv.y * 70.0 - uTime * 3.0);
          float streak = 0.6 + 0.4 * sin(vUv.x * 6.2831 * 9.0 + uTime * 0.7);
          gl_FragColor = vec4(uColor * (0.8 + uBoost * 0.6), fade * scan * streak * (0.04 + uBoost * 0.09));
        }`,
    });
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.52, 1.45, 64, 1, true), this.coneMat);
    cone.position.y = 0.8;
    this.group.add(cone);

    // Orbit rings around the emblem.
    this.core = new THREE.Group();
    this.core.position.y = 1.08;
    this.group.add(this.core);
    this.orbits = [0.5, 0.62, 0.74].map((r, i) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.005, 6, 128), this.track(additive(CALM, 0.55 - i * 0.12)));
      m.rotation.set(Math.PI / 2 + (i - 1) * 0.5, i * 0.7, 0);
      this.core.add(m);
      return m;
    });
    this.glyph = new THREE.Group();
    this.core.add(this.glyph);

    // Rising motes.
    const n = 240;
    this.motes = new Float32Array(n * 3);
    this.moteSpeed = new Float32Array(n);
    for (let i = 0; i < n; i++) this.resetMote(i, true);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.motes, 3));
    this.moteMat = new THREE.PointsMaterial({ color: CALM, size: 0.018, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.points = new THREE.Points(g, this.moteMat);
    this.group.add(this.points);

    // Stance arcs (one per seat), built by setSeats().
    this.arcs = [];

    // Shockwave.
    this.shockMat = additive(DANGER, 0);
    this.shockRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 96), this.shockMat);
    this.shockRing.rotation.x = -Math.PI / 2;
    this.shockRing.position.y = 0.01;
    this.group.add(this.shockRing);

    this.light = new THREE.PointLight(CALM, 2.2, 6, 1.6);
    this.light.position.y = 1.1;
    this.group.add(this.light);
  }

  track(mat) { this.mats.push(mat); return mat; }

  resetMote(i, anywhere = false) {
    const r = Math.sqrt(Math.random()) * 0.55;
    const t = Math.random() * Math.PI * 2;
    this.motes[i * 3] = Math.cos(t) * r;
    this.motes[i * 3 + 1] = anywhere ? 0.1 + Math.random() * 1.4 : 0.1;
    this.motes[i * 3 + 2] = Math.sin(t) * r;
    this.moteSpeed[i] = 0.08 + Math.random() * 0.22;
  }

  setGlyph(kind) {
    this.glyph.clear();
    const mat = () => this.track(additive(CALM, 0.9));
    const wire = (geo, opacity = 0.9) => {
      const m = new THREE.LineSegments(new THREE.WireframeGeometry(geo), new THREE.LineBasicMaterial({ color: CALM, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      this.mats.push(m.material);
      return m;
    };
    switch (kind) {
      case 'signal': {
        const obj = wire(new THREE.OctahedronGeometry(0.3, 0));
        obj.scale.set(0.55, 1.35, 0.55);
        this.glyph.add(obj);
        for (let i = 0; i < 3; i++) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2 + i * 0.12, 0.004, 4, 64), mat());
          ring.userData.pulse = i;
          ring.rotation.x = Math.PI / 2;
          this.glyph.add(ring);
        }
        break;
      }
      case 'spore': {
        for (let i = 0; i < 9; i++) {
          const s = wire(new THREE.IcosahedronGeometry(0.06 + Math.random() * 0.07, 1), 0.8);
          s.position.set((Math.random() - 0.5) * 0.45, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.45);
          s.userData.bob = Math.random() * 6;
          this.glyph.add(s);
        }
        break;
      }
      case 'treaty': {
        const a = wire(new THREE.TorusGeometry(0.2, 0.05, 8, 32));
        const b = wire(new THREE.TorusGeometry(0.2, 0.05, 8, 32));
        a.position.x = -0.1;
        b.position.x = 0.1;
        b.rotation.y = Math.PI / 2;
        this.glyph.add(a, b);
        break;
      }
      case 'mind': {
        this.glyph.add(wire(new THREE.TorusKnotGeometry(0.2, 0.05, 96, 8, 2, 3), 0.75));
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), mat());
        this.glyph.add(eye);
        break;
      }
      default: {
        this.glyph.add(wire(new THREE.IcosahedronGeometry(0.3, 2), 0.7));
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.012, 4, 96), mat());
        band.rotation.x = Math.PI / 2 - 0.35;
        this.glyph.add(band);
      }
    }
  }

  /** Build stance arcs facing each seat. seats = [{ angle }] */
  setSeats(seats) {
    for (const a of this.arcs) this.group.remove(a.mesh);
    const len = 0.62;
    this.arcs = seats.map((s) => {
      const phi = s.angle - Math.PI / 2; // RingGeometry XY angle → seat angle after laying flat
      const mat = additive(new THREE.Color('#8b93a7'), 0.7);
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.8, 0.9, 32, 1, phi - len / 2, len), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.012;
      this.group.add(mesh);
      return { mesh, mat, color: new THREE.Color('#8b93a7'), strength: 0.5, flare: 0 };
    });
  }

  setStance(i, colorHex, conviction) {
    const a = this.arcs[i];
    if (!a) return;
    a.color.set(colorHex);
    a.strength = 0.25 + (conviction / 100) * 0.95;
  }

  flareArc(i) { if (this.arcs[i]) this.arcs[i].flare = 1; }

  setTension(t) {
    const k = t / 100;
    if (k < 0.55) this.targetColor.copy(CALM).lerp(TENSE, k / 0.55);
    else this.targetColor.copy(TENSE).lerp(DANGER, Math.min(1, (k - 0.55) / 0.35));
  }

  pulse(kind) {
    if (kind === 'crisis') { this.shock = 1; this.flash = 1.4; this.shockMat.color.copy(DANGER); }
    else if (kind === 'gavel') { this.flash = 0.9; this.shock = 0.6; this.shockMat.color.set('#ffe6bf'); }
    else if (kind === 'whisper') { this.flash = 0.5; }
    else if (kind === 'carrier') { this.flash = 1.2; this.shock = 0.7; this.shockMat.color.set('#5fe1ff'); }
    else if (kind === 'vote') { this.flash = 1.0; this.shock = 0.8; this.shockMat.color.set('#e9e4ff'); }
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    this.color.lerp(this.targetColor, 1 - Math.exp(-dt * 1.6));
    this.flash = Math.max(0, this.flash - dt * 1.4);
    const boost = this.flash;
    const c = this.color.clone().multiplyScalar(0.85 + boost * 0.7);
    for (const m of this.mats) m.color.copy(c);
    this.coneMat.uniforms.uColor.value.copy(this.color);
    this.coneMat.uniforms.uTime.value = t;
    this.coneMat.uniforms.uBoost.value = boost;
    this.moteMat.color.copy(c);
    this.light.color.copy(this.color);
    this.light.intensity = 2 + boost * 5 + Math.sin(t * 2.3) * 0.2;

    this.core.rotation.y += dt * 0.35;
    this.glyph.rotation.y += dt * 0.25;
    this.glyph.position.y = Math.sin(t * 0.9) * 0.03;
    this.orbits.forEach((o, i) => { o.rotation.z += dt * (0.25 + i * 0.12) * (i % 2 ? -1 : 1); });
    for (const child of this.glyph.children) {
      if (child.userData.pulse !== undefined) {
        const s = 1 + ((t * 0.6 + child.userData.pulse / 3) % 1) * 1.4;
        child.scale.setScalar(s);
        child.material.opacity = 1.2 - (s - 1) / 1.4;
      }
      if (child.userData.bob !== undefined) child.position.y += Math.sin(t * 2 + child.userData.bob) * dt * 0.05;
    }

    const arr = this.points.geometry.attributes.position.array;
    for (let i = 0; i < this.moteSpeed.length; i++) {
      arr[i * 3 + 1] += this.moteSpeed[i] * dt * (1 + boost);
      if (arr[i * 3 + 1] > 1.55) this.resetMote(i);
    }
    this.points.geometry.attributes.position.needsUpdate = true;

    for (const a of this.arcs) {
      a.flare = Math.max(0, a.flare - dt * 0.8);
      a.mat.color.copy(a.color).multiplyScalar(a.strength * (1.1 + a.flare * 2.2));
    }

    if (this.shock > 0) {
      this.shock = Math.max(0, this.shock - dt * 0.7);
      const s = 1 + (1 - this.shock) * 2.2;
      this.shockRing.scale.setScalar(s);
      this.shockMat.opacity = this.shock * 0.9;
    }
  }
}
