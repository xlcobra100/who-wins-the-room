/**
 * Procedural seated council member: body, face, signature headwear and chair,
 * plus the life layer (breathing, blinking, head-tracking, speaking gestures,
 * emotion posture, vote poses, whisper motes) and an HTML nameplate.
 *
 * Local frame: the character faces +z (toward the table centre after the root
 * is rotated by θ + π). Head yaw/pitch are solved in that frame.
 */
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { polar } from './room.js';
import { EMOTION_ICONS, lookFor } from '../data/personas.js';

const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();

function std(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.05, ...opts });
}

function damp(current, target, k, dt) {
  return current + (target - current) * (1 - Math.exp(-k * dt));
}

// Smooth pseudo-noise from layered sines (cheap and deterministic per seed).
function wobble(t, seed) {
  return Math.sin(t * 1.7 + seed) * 0.5 + Math.sin(t * 2.9 + seed * 1.3) * 0.3 + Math.sin(t * 5.3 + seed * 2.1) * 0.2;
}

// 1900s wardrobe pieces handled by buildPeriodOutfit().
const PERIOD_OUTFITS = new Set(['tunic', 'frock', 'workvest', 'workman', 'blouse', 'gown']);

export class Character {
  constructor(persona, seat, angle, theme = 'scifi') {
    this.persona = persona;
    this.id = persona.id;
    this.seat = seat;
    this.angle = angle;
    this.theme = theme;
    // Wardrobe follows the room: the 1900s boardroom dresses everyone in period clothes.
    const dress = lookFor(persona, theme);
    this.look = dress.look;
    this.hairColor = dress.hairColor;
    this.roleLabel = dress.role;
    this.seed = seat * 1.913 + 0.37;
    this.root = new THREE.Group();
    this.root.position.copy(polar(angle, 2.75));
    this.root.rotation.y = angle + Math.PI;
    this.root.userData.characterId = persona.id;

    this.state = {
      speaking: false, thinking: false, emotion: 'calm', vote: null, voteT: 0,
      yaw: 0, pitch: 0, mouth: 0, blink: 0, nextBlink: 1 + Math.random() * 3, highlight: 0,
      gesture: 0, whisperT: 0, selected: false, lean: 0, saccade: new THREE.Vector3(), nextSaccade: 1,
    };
    this.lookTarget = new THREE.Vector3(0, 1.4, 0);
    this.color = new THREE.Color(persona.color);

    this.buildChair();
    this.buildBody();
    this.buildPlate();
    this.buildWhisperMotes();
    this.root.traverse((o) => { if (o.isMesh) o.userData.characterId = persona.id; });
  }

  buildChair() {
    const p = this.persona;
    if (this.theme === 'boardroom1900') {
      // 1900s Gilded Age Chesterfield / Director's Armchair
      const darkMahogany = std('#241108', { roughness: 0.35, metalness: 0.08 });
      const leather = std('#3b1713', { roughness: 0.65 }); // Deep tufted burgundy leather
      const brass = std('#cfad4e', { roughness: 0.25, metalness: 0.85 });

      const chair = new THREE.Group();
      // Thick plush leather cushion
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.12, 0.58), leather);
      seat.position.set(0, 0.46, -0.02);
      // High curved tufted wingback
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.98, 0.1), leather);
      back.position.set(0, 0.96, -0.31);
      back.rotation.x = -0.10;
      // Mahogany back framing
      const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.02, 0.12), darkMahogany);
      frameL.position.set(-0.33, 0.96, -0.31);
      frameL.rotation.x = -0.10;
      const frameR = frameL.clone();
      frameR.position.x = 0.33;
      const frameTop = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 16), darkMahogany);
      frameTop.rotation.z = Math.PI / 2;
      frameTop.position.set(0, 1.46, -0.38);

      // Four turned mahogany legs with brass casters
      for (const lx of [-0.26, 0.26]) {
        for (const lz of [-0.25, 0.22]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.02, 0.4, 12), darkMahogany);
          leg.position.set(lx, 0.2, lz);
          const caster = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), brass);
          caster.position.set(lx, 0.02, lz);
          chair.add(leg, caster);
        }
      }

      // Curved carved armrests
      for (const s of [-1, 1]) {
        const armSupport = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.24, 12), darkMahogany);
        armSupport.position.set(s * 0.33, 0.60, 0.12);
        const armRest = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.045, 0.48), darkMahogany);
        armRest.position.set(s * 0.33, 0.71, -0.02);
        const leatherPad = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.015, 0.32), leather);
        leatherPad.position.set(s * 0.33, 0.74, -0.02);
        chair.add(armSupport, armRest, leatherPad);
      }

      chair.add(seat, back, frameL, frameR, frameTop);
      this.root.add(chair);

      this.accentMat = new THREE.MeshStandardMaterial({ color: '#2a1508', emissive: '#000000', roughness: 0.8 });
      this.consoleMat = new THREE.MeshStandardMaterial({ color: '#1a100a', emissive: '#000000', roughness: 0.8 });
      this.haloMat = new THREE.MeshBasicMaterial({ color: '#f59e0b', transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false });
      const halo = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.62, 64), this.haloMat);
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 0.01;
      this.root.add(halo);
      return;
    }

    const shell = std('#1b1f29', { roughness: 0.5, metalness: 0.4 });
    const cushion = std('#272b36', { roughness: 0.85 });
    const chair = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.09, 0.56), cushion);
    seat.position.set(0, 0.46, -0.02);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.64, 1.05, 0.09), shell);
    back.position.set(0, 1.0, -0.33);
    back.rotation.x = -0.12;
    this.accentMat = new THREE.MeshStandardMaterial({ color: '#000', emissive: p.color, emissiveIntensity: 0.9 });
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.025, 0.02), this.accentMat);
    strip.position.set(0, 1.5, -0.39);
    strip.rotation.x = -0.12;
    const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.9, 0.02), this.accentMat);
    sideL.position.set(-0.32, 1.0, -0.4);
    sideL.rotation.x = -0.12;
    const sideR = sideL.clone();
    sideR.position.x = 0.32;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.42, 12), shell);
    stem.position.y = 0.22;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.04, 24), shell);
    foot.position.y = 0.02;
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.44), shell);
      arm.position.set(s * 0.34, 0.68, -0.02);
      chair.add(arm);
    }
    chair.add(seat, back, strip, sideL, sideR, stem, foot);
    this.root.add(chair);

    // Desk console in front of the seat (glows when this member speaks).
    this.consoleMat = new THREE.MeshStandardMaterial({ color: '#05070b', emissive: p.color, emissiveIntensity: 0.35, roughness: 0.3 });
    const console = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.012, 0.22), this.consoleMat);
    console.position.set(0, 0.787, 0.62);
    this.root.add(console);

    // Floor halo (speaking / selected).
    this.haloMat = new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.62, 64), this.haloMat);
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.01;
    this.root.add(halo);
  }

  buildBody() {
    const p = this.persona;
    const b = p.build;
    const skin = std(p.skin, { roughness: 0.55 });
    const look = this.look;
    // Period outfits use sober wool (look.coat); the persona colour survives as the tie.
    const coatColor = look.coat || p.color;
    const cloth = std(coatColor, { roughness: look.coat ? 0.88 : 0.7 });
    const clothDark = std(new THREE.Color(coatColor).multiplyScalar(look.coat ? 0.62 : 0.35), { roughness: 0.85 });
    const trim = std('#d8d2c4', { roughness: 0.5 });
    const hair = std(this.hairColor, { roughness: 0.8 });
    this.mats = { skin, cloth, clothDark, hair };

    // Legs (mostly under the table).
    for (const s of [-1, 1]) {
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.34, 4, 10), clothDark);
      thigh.rotation.x = Math.PI / 2;
      thigh.position.set(s * 0.11, 0.56, 0.16);
      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.34, 4, 10), clothDark);
      shin.position.set(s * 0.11, 0.3, 0.38);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.2), std('#111318'));
      shoe.position.set(s * 0.11, 0.04, 0.43);
      this.root.add(thigh, shin, shoe);
    }

    // Torso (pivot at the hips).
    this.torso = new THREE.Group();
    this.torso.position.set(0, 0.55, -0.05);
    this.root.add(this.torso);
    // Torso = pelvis + rounded chest + a distinct shoulder line, so the silhouette
    // reads as a seated person from the high overview and in close-ups alike.
    const chest = new THREE.Group();
    this.torso.add(chest);
    this.chest = chest;
    const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 16), clothDark);
    pelvis.scale.set(1.08 * b.girth, 0.62, 0.86 * b.girth);
    pelvis.position.y = 0.06;
    const ribs = new THREE.Mesh(new THREE.CapsuleGeometry(0.155, 0.26, 8, 20), cloth);
    ribs.scale.set(1.12 * b.shoulders * b.girth, b.height, 0.74 * b.girth);
    ribs.position.y = 0.34 * b.height;
    const shoulderW = 0.205 * b.shoulders * b.girth;
    const yoke = new THREE.Mesh(new THREE.CapsuleGeometry(0.078, shoulderW * 2 - 0.1, 6, 16), cloth);
    yoke.rotation.z = Math.PI / 2;
    yoke.scale.set(1, 1, 0.9);
    yoke.position.y = 0.575 * b.height;
    chest.add(pelvis, ribs, yoke);

    if (look.shirt) trim.color.set(look.shirt); // shirt cuffs match the collar linen
    this.buildCollar(look, cloth, clothDark, trim);

    if (look.pads) {
      for (const s of [-1, 1]) {
        if (look.asym && s === 1) continue;
        const pad = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), look.asym ? std('#222', { metalness: 0.6, roughness: 0.3 }) : cloth);
        pad.scale.set(1.15, 0.6, 1.1);
        pad.position.set(s * (0.205 * b.shoulders * b.girth + 0.01), 0.6 * b.height, 0);
        this.torso.add(pad);
      }
    }

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 12), skin);
    neck.position.set(0, 0.71 * b.height, 0.0);
    this.torso.add(neck);

    // Head.
    this.head = new THREE.Group();
    this.head.position.set(0, 0.75 * b.height, 0.01);
    this.head.rotation.order = 'YXZ';
    this.torso.add(this.head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.135, 32, 24), skin);
    skull.scale.set(0.92, 1.12, 1.0);
    skull.position.y = 0.14;
    this.head.add(skull);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.017, 0.05, 8), std(new THREE.Color(p.skin).multiplyScalar(0.88)));
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.135, 0.135);
    this.head.add(nose);
    const eyeMat = std('#0b0b10', { roughness: 0.15, metalness: 0.2 });
    this.eyes = [-1, 1].map((s) => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.021, 14, 10), eyeMat);
      e.position.set(s * 0.047, 0.163, 0.121);
      this.head.add(e);
      return e;
    });
    this.brows = [-1, 1].map((s) => {
      const br = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.009, 0.012), hair);
      br.position.set(s * 0.048, 0.199, 0.124);
      br.userData.side = s;
      this.head.add(br);
      return br;
    });
    this.mouth = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.008, 0.012), std('#3a1519', { roughness: 0.4 }));
    this.mouth.position.set(0, 0.083, look.beard || look.hair === 'long' ? 0.137 : 0.129);
    this.head.add(this.mouth);

    this.buildHair(p, hair, skin, cloth);

    // Arms: shoulder → elbow → hand chains that rest on the table edge.
    // Waistcoat-only outfits show shirt sleeves.
    const sleeve = look.sleeves ? std(look.sleeves, { roughness: 0.8 }) : cloth;
    this.arms = [-1, 1].map((s) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(s * (0.205 * b.shoulders * b.girth + 0.025), 0.58 * b.height, 0);
      this.torso.add(shoulder);
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.05 * b.girth, 0.22, 4, 10), sleeve);
      upper.position.y = -0.15;
      shoulder.add(upper);
      const elbow = new THREE.Group();
      elbow.position.y = -0.3;
      shoulder.add(elbow);
      const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.044, 0.2, 4, 10), sleeve);
      fore.position.y = -0.13;
      elbow.add(fore);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.03, 12), trim);
      cuff.position.y = -0.245;
      elbow.add(cuff);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.046, 12, 10), skin);
      hand.scale.set(0.95, 0.62, 1.25);
      hand.position.y = -0.29;
      elbow.add(hand);
      return { s, shoulder, elbow, rx: -0.45, rz: s * 0.08, ex: -1.0 };
    });
  }

  buildCollar(look, cloth, clothDark, trim) {
    if (PERIOD_OUTFITS.has(look.collar)) { this.buildPeriodOutfit(look, cloth, clothDark, trim); return; }
    const t = this.torso;
    const h = this.persona.build.height;
    switch (look.collar) {
      case 'uniform': {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.06, 16), clothDark);
        c.position.y = 0.68 * h;
        const sash = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.5, 0.01), std('#c9a45c', { metalness: 0.8, roughness: 0.3 }));
        sash.position.set(0.05, 0.4 * h, 0.155);
        sash.rotation.z = 0.5;
        const medal = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.006, 12), std('#e8c766', { metalness: 0.9, roughness: 0.2 }));
        medal.rotation.x = Math.PI / 2;
        medal.position.set(-0.08, 0.5 * h, 0.16);
        t.add(c, sash, medal);
        break;
      }
      case 'coat': {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.1, 18, 1, true), std('#e9eef0', { side: THREE.DoubleSide }));
        c.position.y = 0.68 * h;
        const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.01), std('#eef2f3'));
        lapel.position.set(0, 0.4 * h, 0.15);
        const cross = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.012, 0.012), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#2ec4b6', emissiveIntensity: 2 }));
        cross.position.set(-0.07, 0.52 * h, 0.158);
        const cross2 = cross.clone();
        cross2.rotation.z = Math.PI / 2;
        t.add(c, lapel, cross, cross2);
        break;
      }
      case 'harness': {
        const strapMat = std('#3a2d22', { roughness: 0.9 });
        for (const s of [-1, 1]) {
          const strap = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.6, 0.01), strapMat);
          strap.position.set(s * 0.07, 0.38 * h, 0.15);
          strap.rotation.z = s * 0.35;
          t.add(strap);
        }
        const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.02), std('#9aa0a6', { metalness: 0.9, roughness: 0.3 }));
        buckle.position.set(0, 0.36 * h, 0.16);
        const tool = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.02), std('#ff8a3d', { metalness: 0.3 }));
        tool.position.set(0.12, 0.3 * h, 0.15);
        t.add(buckle, tool);
        break;
      }
      case 'high': {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.12, 0.1, 20, 1, true, Math.PI * 0.2, Math.PI * 1.6), std('#3a2357', { side: THREE.DoubleSide }));
        c.position.y = 0.69 * h;
        c.rotation.y = Math.PI;
        const pin = new THREE.Mesh(new THREE.OctahedronGeometry(0.02), std('#e8c766', { metalness: 1, roughness: 0.15 }));
        pin.position.set(0.09, 0.5 * h, 0.15);
        t.add(c, pin);
        break;
      }
      case 'robe': {
        const mantle = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.32), std('#e7dfcc', { side: THREE.DoubleSide, roughness: 0.9 }));
        mantle.scale.set(1.0, 0.8, 0.75);
        mantle.position.y = 0.48 * h;
        const chain = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.006, 6, 24, Math.PI), std('#c9a45c', { metalness: 0.9, roughness: 0.3 }));
        chain.rotation.z = Math.PI;
        chain.position.set(0, 0.55 * h, 0.14);
        t.add(mantle, chain);
        break;
      }
      case 'jacket': {
        const zip = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.5, 0.012), std('#d9d9d9', { metalness: 0.8 }));
        zip.position.set(0.03, 0.38 * h, 0.155);
        const patch = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.01), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#f2d04a', emissiveIntensity: 1.4 }));
        patch.position.set(-0.09, 0.5 * h, 0.156);
        t.add(zip, patch);
        break;
      }
      default: break;
    }
  }

  /**
   * Edwardian wardrobe: shirt fronts, lapels, collars, ties, waistcoats and
   * trimmings laid onto the chest. Panels follow the torso's capsule profile
   * (see chestZ) so they hug the body instead of floating in front of it.
   */
  buildPeriodOutfit(look, cloth, clothDark, trim) {
    const t = this.torso;
    const b = this.persona.build;
    const H = b.height;
    const accentColor = look.accent || this.persona.color;
    const linen = std(look.shirt || '#efe9dc', { roughness: 0.7 });
    const accent = std(accentColor, { roughness: 0.55 });
    const gold = std('#c9a24e', { metalness: 0.85, roughness: 0.3 });
    const lapelMat = std(new THREE.Color(look.coat || '#222').multiplyScalar(0.78), { roughness: 0.8 });
    const xr = 0.155 * 1.12 * b.shoulders * b.girth;
    // Depth of the chest surface at height y (torso units) and sideways offset x.
    const chestZ = (y, x = 0) => {
      const R = 0.155;
      const zr = 0.74 * b.girth;
      const top = 0.34 * H + 0.13 * H;
      let ribs = R * zr;
      if (y > top) { const k = (y - top) / (R * H); ribs = k >= 1 ? 0 : R * zr * Math.sqrt(1 - k * k); }
      ribs *= Math.sqrt(Math.max(0, 1 - (x / xr) ** 2));
      const ky = (y - 0.575 * H) / 0.078;
      const yoke = Math.abs(ky) < 1 ? 0.0702 * Math.sqrt(1 - ky * ky) : 0;
      const neck = y > 0.6 * H && Math.abs(x) < 0.06 ? 0.05 : 0;
      return Math.max(ribs, yoke, neck);
    };
    // A strip lying on the chest from height y0 to y1 (fractions of H) at sideways
    // offset x, tilted rz in the chest plane. Built from short segments so it
    // bends over the chest's curve instead of cutting through it.
    const up = new THREE.Vector3(0, 1, 0);
    const panel = (w, y0, y1, mat, { x = 0, lift = 0.004, rz = 0, depth = 0.008 } = {}) => {
      const half = ((y1 - y0) * H) / 2;
      const ym = ((y0 + y1) / 2) * H;
      const n = Math.max(1, Math.ceil((y1 - y0) / 0.05));
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const f = (i / n - 0.5) * 2 * half;
        const px = x - Math.sin(rz) * f;
        const py = ym + Math.cos(rz) * f;
        pts.push(new THREE.Vector3(px, py, chestZ(py, px) + lift));
      }
      for (let i = 0; i < n; i++) {
        const dir = new THREE.Vector3().subVectors(pts[i + 1], pts[i]);
        const len = dir.length();
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, len + 0.003, depth), mat);
        m.position.addVectors(pts[i], pts[i + 1]).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(up, dir.normalize());
        t.add(m);
      }
    };
    const button = (x, y, mat = gold, r = 0.009) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat);
      m.position.set(x, y * H, chestZ(y * H, x) + 0.005);
      t.add(m);
    };
    const collarRing = (r0, r1, y, height, mat) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, height, 20), mat);
      c.position.set(0, y * H, 0.004);
      t.add(c);
      return c;
    };
    const watchChain = (y) => {
      const chain = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.0035, 5, 18, Math.PI), gold);
      chain.rotation.z = Math.PI;
      chain.position.set(0.035, y * H, chestZ(y * H, 0.035) + 0.008);
      t.add(chain);
    };

    switch (look.collar) {
      case 'tunic': {
        // Army officer's tunic: stand collar with coloured tabs, brass buttons, Sam Browne belt, ribbons.
        collarRing(0.072, 0.09, 0.675, 0.055, cloth);
        for (const s of [-1, 1]) {
          const tab = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.008), accent);
          tab.position.set(s * 0.045, 0.675 * H, 0.072);
          tab.rotation.y = s * 0.5;
          t.add(tab);
        }
        for (let i = 0; i < 5; i++) button(0, 0.24 + i * 0.085);
        const leather = std('#5a3a22', { roughness: 0.5 });
        panel(0.03, 0.17, 0.6, leather, { x: -0.03, rz: -0.42, lift: 0.009 });
        const belt = new THREE.Mesh(new THREE.TorusGeometry(1, 0.02, 6, 32), leather);
        belt.scale.set(1.12 * b.shoulders * b.girth * 0.158, 0.74 * b.girth * 0.158, 1);
        belt.rotation.x = Math.PI / 2;
        belt.position.y = 0.2 * H;
        t.add(belt);
        ['#b0302c', '#2f5aa8', '#e0c050'].forEach((c, i) => panel(0.022, 0.5, 0.525, std(c), { x: -0.095 + i * 0.024, lift: 0.006 }));
        break;
      }
      case 'frock':
      case 'workvest':
      case 'workman': {
        const coat = look.collar === 'frock';
        // Shirt front and collar.
        panel(coat ? 0.07 : 0.11, 0.3, 0.66, linen);
        collarRing(0.066, 0.072, 0.69, 0.04, linen);
        if (look.collar === 'workman') {
          // Knotted neckerchief.
          collarRing(0.07, 0.08, 0.665, 0.035, accent);
          const knot = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), accent);
          knot.position.set(0, 0.63 * H, chestZ(0.63 * H) + 0.01);
          t.add(knot);
          panel(0.035, 0.53, 0.62, accent, { x: 0.012, rz: 0.25, lift: 0.009 });
        } else {
          // Tie or cravat.
          panel(0.034, 0.44, 0.65, accent, { lift: 0.008 });
          const knot = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.02), accent);
          knot.position.set(0, 0.66 * H, chestZ(0.66 * H) + 0.012);
          t.add(knot);
        }
        // Waistcoat: two fronts meeting in a V, with buttons.
        const vest = look.collar === 'frock' ? std('#3b3a3f', { roughness: 0.8 }) : clothDark;
        for (const s of [-1, 1]) panel(0.085, 0.16, 0.56, vest, { x: s * 0.06, rz: s * 0.12, lift: 0.007 });
        for (let i = 0; i < 4; i++) button(0, 0.22 + i * 0.07, gold, 0.007);
        watchChain(0.33);
        if (coat) {
          // Frock-coat lapels over the waistcoat.
          for (const s of [-1, 1]) panel(0.06, 0.2, 0.64, lapelMat, { x: s * 0.105, rz: s * 0.28, lift: 0.011 });
        }
        break;
      }
      case 'blouse':
      case 'gown': {
        // High-necked Edwardian blouse under a tailored jacket or bodice.
        collarRing(0.058, 0.066, 0.71, 0.075, linen);
        if (look.collar === 'blouse') {
          panel(0.12, 0.22, 0.66, linen);
          for (let i = 0; i < 3; i++) panel(0.006, 0.26, 0.62, std('#d9d2c2'), { x: -0.03 + i * 0.03, lift: 0.007 });
          for (const s of [-1, 1]) panel(0.06, 0.18, 0.6, lapelMat, { x: s * 0.095, rz: s * 0.22, lift: 0.009 });
        } else {
          // Gown: lace yoke, pearls, jewelled brooch.
          panel(0.2, 0.5, 0.665, linen, { lift: 0.003 });
          const pearls = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.006, 6, 24, Math.PI), std('#f4efe6', { roughness: 0.25, metalness: 0.2 }));
          pearls.rotation.set(-0.5, 0, Math.PI);
          pearls.position.set(0, 0.6 * H, 0.06);
          t.add(pearls);
        }
        const brooch = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.008, 14), look.collar === 'gown' ? accent : gold);
        brooch.rotation.x = Math.PI / 2;
        brooch.position.set(0, 0.69 * H, 0.066);
        t.add(brooch);
        break;
      }
      default: break;
    }
  }

  buildHair(p, hair, skin, cloth) {
    const h = this.head;
    // Hair = a crown that stops above the brows, plus (for longer styles) a
    // side-and-back shell with the face cut out, so hair never covers the eyes.
    const TOP = Math.PI * 0.36;
    const cap = (thetaLen, sx = 1.0, sy = 1.0, sz = 1.0, mat = hair) => {
      const mk = (geo) => {
        const m = new THREE.Mesh(geo, mat);
        m.scale.set(0.93 * sx, 1.13 * sy, 1.02 * sz);
        m.position.y = 0.145;
        h.add(m);
        return m;
      };
      const parts = [mk(new THREE.SphereGeometry(0.14, 28, 10, 0, Math.PI * 2, 0, Math.min(thetaLen, TOP)))];
      if (thetaLen > TOP) parts.push(mk(new THREE.SphereGeometry(0.14, 28, 10, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, TOP - 0.02, thetaLen - TOP + 0.02)));
      return parts;
    };
    const look = this.look;
    switch (look.hair) {
      case 'buzz': cap(Math.PI * 0.42); break;
      case 'bun': {
        cap(Math.PI * 0.5);
        const bun = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), hair);
        bun.position.set(0, 0.24, -0.11);
        h.add(bun);
        break;
      }
      case 'shaggy': {
        cap(Math.PI * 0.56, 1.06, 1.04, 1.06);
        break;
      }
      case 'bob': {
        cap(Math.PI * 0.62, 1.12, 1.04, 1.1).forEach((c) => { c.position.y = 0.14; });
        const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.04), hair);
        fringe.position.set(0.02, 0.235, 0.105);
        fringe.rotation.z = -0.25;
        h.add(fringe);
        break;
      }
      case 'long': {
        cap(Math.PI * 0.5, 1.04, 1.02, 1.04);
        const fall = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.16, 4, 10), hair);
        fall.position.set(0, 0.06, -0.08);
        fall.scale.set(1.2, 1, 0.6);
        h.add(fall);
        const beard = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), hair);
        beard.position.set(0, 0.11, 0.035);
        beard.scale.set(0.95, 1.1, 1.05);
        h.add(beard);
        break;
      }
      case 'updo': {
        // Edwardian pompadour: full crown swept up into a soft bun.
        cap(Math.PI * 0.5, 1.08, 1.06, 1.06);
        const roll = new THREE.Mesh(new THREE.SphereGeometry(0.1, 18, 12), hair);
        roll.scale.set(1.25, 0.62, 1.05);
        roll.position.set(0, 0.27, -0.02);
        const bun = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 10), hair);
        bun.position.set(0, 0.31, -0.07);
        h.add(roll, bun);
        break;
      }
      case 'mohawk': {
        cap(Math.PI * 0.45, 1, 1, 1, std(new THREE.Color(p.skin).multiplyScalar(0.55), { roughness: 0.9 }));
        const crest = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.08, 0.24), hair);
        crest.position.set(0, 0.29, -0.01);
        h.add(crest);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.004, 6, 12), std('#d9d9d9', { metalness: 1, roughness: 0.2 }));
        ring.position.set(0.128, 0.12, 0.01);
        ring.rotation.y = Math.PI / 2;
        h.add(ring);
        break;
      }
      default: cap(Math.PI * 0.45);
    }
    if (look.beard) {
      const beard = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 10, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.48), hair);
      beard.position.set(0, 0.125, 0.03);
      beard.scale.set(0.98, 1.05, 1.08);
      h.add(beard);
    }
    if (look.mustache) {
      for (const s of [-1, 1]) {
        const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.03, 3, 8), hair);
        m.rotation.z = Math.PI / 2 + s * 0.35;
        m.position.set(s * 0.019, 0.101, 0.139);
        h.add(m);
      }
    }
    switch (look.headwear) {
      case 'cap': {
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.135, 0.075, 24), std('#1b2a4a'));
        crown.position.y = 0.285;
        crown.scale.z = 1.08;
        const brim = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.1), std('#0d1018', { roughness: 0.3, metalness: 0.4 }));
        brim.position.set(0, 0.252, 0.12);
        brim.rotation.x = 0.18;
        const badge = new THREE.Mesh(new THREE.OctahedronGeometry(0.018), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#e8c766', emissiveIntensity: 2.2 }));
        badge.position.set(0, 0.29, 0.14);
        h.add(crown, brim, badge);
        break;
      }
      case 'goggles': {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.013, 6, 32), std('#2a2420'));
        band.rotation.x = Math.PI / 2 + 0.25;
        band.position.y = 0.235;
        h.add(band);
        for (const s of [-1, 1]) {
          const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.027, 0.028, 16), new THREE.MeshStandardMaterial({ color: '#2a1608', emissive: '#ff8a3d', emissiveIntensity: 0.25, metalness: 0.7, roughness: 0.2 }));
          lens.rotation.x = Math.PI / 2 - 0.9;
          lens.position.set(s * 0.045, 0.285, 0.085);
          h.add(lens);
        }
        break;
      }
      case 'flatcap': {
        const tweed = std('#5b5546', { roughness: 0.95 });
        const crown = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), tweed);
        crown.scale.set(1.0, 0.42, 1.12);
        crown.position.set(0, 0.25, 0.01);
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.142, 0.142, 0.03, 24, 1, true), tweed);
        band.position.y = 0.245;
        const brim = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.012, 0.08), tweed);
        brim.position.set(0, 0.245, 0.15);
        brim.rotation.x = 0.22;
        const button = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), tweed);
        button.position.set(0, 0.315, 0.02);
        h.add(crown, band, brim, button);
        break;
      }
      case 'hood': {
        const hood = new THREE.Mesh(new THREE.SphereGeometry(0.19, 28, 18, Math.PI / 2 + 0.85, Math.PI * 2 - 1.7, 0, Math.PI * 0.6),
          std('#2f4a35', { side: THREE.DoubleSide, roughness: 0.95 }));
        hood.position.set(0, 0.13, -0.02);
        hood.scale.set(1, 1.1, 1.05);
        h.add(hood);
        break;
      }
      default: break;
    }
    if (look.earpiece) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.03), std('#d8dde0', { metalness: 0.5 }));
      ear.position.set(0.128, 0.15, 0.0);
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#2ec4b6', emissiveIntensity: 3 }));
      led.position.set(0.14, 0.16, 0.012);
      h.add(ear, led);
    }
    if (look.earrings) {
      for (const s of [-1, 1]) {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), std('#e8c766', { metalness: 1, roughness: 0.15 }));
        e.position.set(s * 0.124, 0.085, 0.0);
        h.add(e);
      }
    }
    if (look.spectacles) {
      const wire = std('#b89a4a', { metalness: 0.9, roughness: 0.25 });
      for (const sx of [-1, 1]) {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.0028, 6, 18), wire);
        rim.position.set(sx * 0.047, 0.163, 0.149);
        h.add(rim);
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.004, 0.004), wire);
      bridge.position.set(0, 0.168, 0.151);
      h.add(bridge);
    }
  }

  buildPlate() {
    const p = this.persona;
    const el = document.createElement('div');
    el.className = 'plate';
    el.dataset.id = p.id;
    el.style.setProperty('--c', p.color);
    el.innerHTML = `
      <div class="plate-row"><span class="plate-dot"></span><span class="plate-name">${p.short}</span><span class="plate-emo" title="mood"></span></div>
      <div class="plate-role">${this.roleLabel}</div>
      <div class="plate-stance"><span class="plate-chip">?</span><span class="plate-bar"><i></i></span></div>
      <div class="plate-status"></div>`;
    this.plateEl = el;
    this.plate = new CSS2DObject(el);
    this.plate.position.set(0, 2.02, 0.05);
    this.root.add(this.plate);
    this.plateParts = {
      emo: el.querySelector('.plate-emo'),
      chip: el.querySelector('.plate-chip'),
      bar: el.querySelector('.plate-bar i'),
      status: el.querySelector('.plate-status'),
    };
  }

  buildWhisperMotes() {
    const n = 46;
    this.motePhase = new Float32Array(n).map(() => Math.random() * Math.PI * 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.moteMat = new THREE.PointsMaterial({ color: '#c79bff', size: 0.03, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.whisperMotes = new THREE.Points(g, this.moteMat);
    this.whisperMotes.frustumCulled = false;
    this.head.add(this.whisperMotes);
  }

  dispose() {
    if (this.plateEl && this.plateEl.parentNode) {
      this.plateEl.parentNode.removeChild(this.plateEl);
    }
    this.plateEl = null;
    this.root.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
  }

  // ------------------------------------------------------------ state setters
  setSpeaking(on) {
    this.state.speaking = on;
    this.plateEl.classList.toggle('is-speaking', on);
    if (on) this.setThinking(false);
  }

  setThinking(on) {
    this.state.thinking = on;
    this.plateEl.classList.toggle('is-thinking', on);
    this.refreshStatus();
  }

  setEmotion(emotion) {
    this.state.emotion = emotion || 'calm';
    this.plateParts.emo.textContent = EMOTION_ICONS[this.state.emotion] || '';
    this.plateParts.emo.title = this.state.emotion;
  }

  setStance(optionId, color, conviction) {
    this.plateParts.chip.textContent = optionId === 'undecided' ? '?' : optionId;
    this.plateParts.chip.style.background = color;
    this.plateParts.bar.style.width = `${conviction}%`;
    this.plateParts.bar.style.background = color;
  }

  setWhispers(count, latent) {
    this.whisperCount = count;
    this.whisperLatent = latent;
    this.refreshStatus();
  }

  setBallot(vote) {
    this.state.vote = vote;
    this.state.voteT = 0;
    this.plateEl.classList.toggle('has-ballot', !!vote);
    this.plateEl.dataset.ballot = vote || '';
    this.refreshStatus();
  }

  setSelected(on) {
    this.state.selected = on;
    this.plateEl.classList.toggle('is-selected', on);
  }

  setVoting(on) {
    this.voting = on;
    this.refreshStatus();
  }

  refreshStatus() {
    const s = this.plateParts.status;
    if (this.state.vote) s.innerHTML = `<b class="ballot ballot-${this.state.vote.toLowerCase()}">${this.state.vote}</b>`;
    else if (this.voting) s.innerHTML = '<span class="dots">deliberating</span>';
    else if (this.state.thinking) s.innerHTML = '<span class="dots">thinking</span>';
    else if (this.whisperLatent) s.innerHTML = '<span class="whisper-tag" title="An implanted idea not yet voiced">✶ seeded</span>';
    else s.innerHTML = '';
  }

  whisperFx() { this.state.whisperT = 2.8; }

  /** World-space head position (for camera shots and others' gaze). */
  headWorld(out = new THREE.Vector3()) {
    return this.head.getWorldPosition(out).add(tmpV2.set(0, 0.14, 0));
  }

  lookAt(worldPoint) { this.lookTarget.copy(worldPoint); }

  // ------------------------------------------------------------ animation
  update(dt, t) {
    const st = this.state;
    const p = this.persona;
    const emo = st.emotion;

    // Breathing and idle sway tied directly to emotion.
    const breathRate = emo === 'anxious' ? 3.0 : emo === 'angry' ? 2.4 : emo === 'grieved' ? 1.0 : emo === 'defiant' ? 1.8 : 1.4;
    const breathDepth = emo === 'grieved' ? 0.022 : emo === 'anxious' ? 0.008 : emo === 'resolute' ? 0.014 : 0.012;
    const breath = Math.sin(t * breathRate + this.seed);
    this.chest.scale.y = 1 + breath * breathDepth;

    // Muscular tension / jitter for angry and anxious states.
    const jitter = emo === 'angry' ? Math.sin(t * 34 + this.seed) * 0.005 : emo === 'anxious' ? Math.sin(t * 26 + this.seed) * 0.004 : 0;

    let leanTarget = 0.05;
    let rollTarget = 0;
    if (st.speaking) leanTarget = 0.12;
    if (emo === 'angry') leanTarget += 0.16; // aggressive forward lean over table
    if (emo === 'resolute') leanTarget += 0.08; // firm square command posture
    if (emo === 'defiant') leanTarget -= 0.10; // proud lean back against chair
    if (emo === 'grieved') leanTarget += 0.13; // slumped forward in sorrow
    if (emo === 'anxious') leanTarget -= 0.04; // shrinking backward
    if (emo === 'hopeful') leanTarget += 0.02; // tall upright chest
    if (emo === 'wry') { leanTarget += 0.03; rollTarget = 0.06; } // cynical asymmetrical slouch
    if (st.vote === 'NAY') leanTarget -= 0.04;

    st.lean = damp(st.lean, leanTarget, 3.2, dt);
    this.torso.rotation.x = st.lean + breath * 0.007 + jitter;
    this.torso.rotation.z = damp(this.torso.rotation.z, rollTarget + wobble(t * 0.35, this.seed) * 0.015, 3.5, dt);

    // Head tracking: yaw/pitch toward the look target, in the seat frame.
    // Anxious agents saccade and dart their eyes frequently; resolute agents hold gaze steadily.
    st.nextSaccade -= dt;
    if (st.nextSaccade <= 0) {
      const saccadeMag = emo === 'anxious' ? 0.28 : emo === 'resolute' ? 0.08 : 0.16;
      st.saccade.set((Math.random() - 0.5) * saccadeMag, (Math.random() - 0.5) * saccadeMag * 0.5, (Math.random() - 0.5) * saccadeMag);
      st.nextSaccade = emo === 'anxious' ? (0.4 + Math.random() * 1.1) : emo === 'resolute' ? (2.2 + Math.random() * 3.0) : (0.8 + Math.random() * 2.4);
    }
    const headPos = this.head.getWorldPosition(tmpV);
    const local = this.root.worldToLocal(tmpV2.copy(this.lookTarget).add(st.saccade));
    const headLocal = this.root.worldToLocal(headPos.clone());
    local.sub(headLocal);
    let yaw = Math.atan2(local.x, local.z);
    let pitch = Math.atan2(local.y - 0.12, Math.hypot(local.x, local.z));
    yaw = THREE.MathUtils.clamp(yaw, -1.3, 1.3);
    pitch = THREE.MathUtils.clamp(pitch, -0.5, 0.4);

    if (st.thinking) { pitch -= 0.18; }
    if (emo === 'defiant') pitch += 0.14; // chin held proud and high
    if (emo === 'grieved') pitch -= 0.20; // bowed sorrowful head
    if (emo === 'angry') pitch -= 0.10; // menacing furrowed chin thrust
    if (emo === 'hopeful') pitch += 0.08; // upward optimistic gaze

    const k = st.speaking ? 3.2 : 4.5;
    st.yaw = damp(st.yaw, yaw, k, dt);
    st.pitch = damp(st.pitch, pitch, k, dt);
    this.torso.rotation.y = st.yaw * 0.22;

    let nod = 0;
    let shake = 0;
    if (st.speaking) {
      const nodSpeed = emo === 'angry' ? 2.6 : emo === 'hopeful' ? 1.6 : 1.4;
      const nodAmp = emo === 'angry' ? 0.08 : emo === 'hopeful' ? 0.06 : 0.04;
      nod = wobble(t * nodSpeed, this.seed) * nodAmp;
    }
    if (emo === 'defiant' && !st.speaking && Math.sin(t * 0.8 + this.seed) > 0.85) {
      shake = Math.sin(t * 8) * 0.06; // subtle skeptical head shake
    }
    if (st.vote === 'NAY' && st.voteT < 1.6) shake = Math.sin(st.voteT * 14) * 0.18 * (1 - st.voteT / 1.6);
    if (st.vote === 'AYE' && st.voteT < 1.0) nod += Math.sin(st.voteT * 10) * 0.08 * (1 - st.voteT);
    this.head.rotation.y = st.yaw * 0.78 + shake;
    this.head.rotation.x = -st.pitch + nod;
    this.head.rotation.z = st.thinking ? 0.12 : emo === 'wry' ? 0.12 : emo === 'defiant' ? -0.05 : 0;

    // Blink.
    st.nextBlink -= dt;
    if (st.nextBlink <= 0) {
      st.blink = 0.16;
      st.nextBlink = emo === 'anxious' ? (1.0 + Math.random() * 2.2) : (2.2 + Math.random() * 4.5);
    }
    if (st.blink > 0) st.blink -= dt;
    const lid = st.blink > 0 ? 0.12 : 1;
    for (const e of this.eyes) e.scale.y = damp(e.scale.y, lid, 40, dt);

    // Brows by emotion.
    const browTilt = { angry: 0.42, resolute: 0.16, anxious: -0.34, grieved: -0.32, hopeful: -0.14, defiant: 0.24, wry: 0.05, calm: 0 }[emo] ?? 0;
    const browLift = { hopeful: 0.014, anxious: 0.012, wry: 0.002, angry: -0.010, defiant: -0.006, grieved: 0.008 }[emo] ?? 0;
    for (const br of this.brows) {
      const wryLift = emo === 'wry' && br.userData.side === 1 ? 0.018 : 0;
      br.rotation.z = damp(br.rotation.z, browTilt * br.userData.side, 6, dt);
      br.position.y = damp(br.position.y, 0.199 + browLift + wryLift, 6, dt);
    }

    // Mouth: layered syllable rhythm while speaking.
    const talk = st.speaking ? Math.max(0, Math.sin(t * 13 + this.seed) * 0.6 + Math.sin(t * 7.3) * 0.4 + 0.2) : 0;
    st.mouth = damp(st.mouth, talk, 18, dt);
    this.mouth.scale.set(1 - st.mouth * 0.15, 1 + st.mouth * 4.5, 1);

    // Arms: highly expressive body language matching each emotion (listening and speaking)
    st.voteT += dt;
    for (const arm of this.arms) {
      const s = arm.s;
      let rx = -0.45;
      let rz = s * 0.08;
      let ex = -1.0;

      if (st.speaking) {
        const lead = s === 1 ? 1 : 0.45;
        if (emo === 'angry') {
          // Sharp, aggressive chopping hand thrusts pointing at opponent
          const chop = Math.sin(t * 9 + this.seed + s * 2);
          rx = -0.72 - 0.28 * lead + chop * 0.24 * lead;
          rz = s * (0.16 + 0.12 * lead);
          ex = -1.45 - 0.35 * lead + chop * 0.30 * lead;
        } else if (emo === 'resolute') {
          // Authoritative downward palm presses, steady and measured
          const press = Math.sin(t * 2.2 + this.seed + s);
          rx = -0.58 - 0.18 * lead + press * 0.12 * lead;
          rz = s * (0.14 + 0.10 * lead);
          ex = -1.20 - 0.20 * lead + press * 0.15 * lead;
        } else if (emo === 'anxious') {
          // Tentative, hesitant fluttering motions close to chest
          const flutter = Math.sin(t * 6.5 + this.seed + s * 4);
          rx = -0.70 - 0.12 * lead + flutter * 0.08 * lead;
          rz = -s * (0.05 + flutter * 0.06);
          ex = -1.80 + flutter * 0.16 * lead;
        } else if (emo === 'hopeful') {
          // Open upward palms, reaching forward
          const reach = Math.sin(t * 1.8 + this.seed + s);
          rx = -0.55 - 0.26 * lead + reach * 0.16 * lead;
          rz = s * (0.24 + 0.14 * lead);
          ex = -1.0 + reach * 0.18 * lead;
        } else if (emo === 'defiant') {
          // Bold sweeping outward gestures
          const sweep = Math.sin(t * 2.8 + this.seed + s * 2);
          rx = -0.65 - 0.22 * lead + sweep * 0.18 * lead;
          rz = s * (0.32 + 0.20 * lead + sweep * 0.12);
          ex = -1.30 + sweep * 0.22 * lead;
        } else if (emo === 'wry') {
          // Asymmetric casual shrug: right arm gestures loosely, left arm rests
          if (s === 1) {
            const shrug = Math.sin(t * 2.4 + this.seed);
            rx = -0.52 + shrug * 0.16;
            rz = 0.25 + shrug * 0.10;
            ex = -1.15 + shrug * 0.20;
          } else {
            rx = -0.40; rz = -0.10; ex = -0.85;
          }
        } else if (emo === 'grieved') {
          // Weary, drooping hand gesture falling heavily onto desk
          const weary = Math.sin(t * 1.2 + this.seed + s);
          rx = -0.50 - 0.12 * lead + Math.max(0, weary) * 0.10 * lead;
          rz = s * 0.08;
          ex = -1.15;
        } else {
          // Calm / standard speaking gesture
          const g = wobble(t * 1.1, this.seed + s * 3);
          rx = -0.62 - 0.22 * lead + g * 0.16 * lead;
          rz = s * (0.12 + 0.14 * lead + wobble(t * 0.8, this.seed + s) * 0.08 * lead);
          ex = -1.25 - 0.35 * lead + wobble(t * 1.6, this.seed + s * 5) * 0.32 * lead;
        }
      } else if (st.thinking && s === 1) {
        // Hand to chin / thinking pose
        rx = -0.75; rz = 0.25; ex = -2.1;
      } else {
        // Expressive Idle / Listening body language matching emotion!
        if (emo === 'angry') {
          // Clenched fists leaning onto table, elbows flared
          rx = -0.58; rz = s * 0.16; ex = -1.35;
        } else if (emo === 'defiant') {
          // Crossed arms over chest
          rx = -0.82; rz = -s * 0.36; ex = -2.05;
        } else if (emo === 'anxious') {
          // Hands nervously clasped together in lap/chest
          rx = -0.66; rz = -s * 0.14; ex = -1.72 + Math.sin(t * 4 + this.seed) * 0.04;
        } else if (emo === 'resolute') {
          // Palms flat on table/console, square command shoulders
          rx = -0.50; rz = s * 0.14; ex = -1.12;
        } else if (emo === 'grieved') {
          // One hand supporting temple, other resting limp
          if (s === 1) { rx = -0.88; rz = -0.12; ex = -2.3; }
          else { rx = -0.38; rz = -0.06; ex = -0.85; }
        } else if (emo === 'wry') {
          // Casual lean: one arm resting on chair armrest, other on table
          if (s === 1) { rx = -0.36; rz = 0.22; ex = -0.82; }
          else { rx = -0.48; rz = -0.08; ex = -1.15; }
        } else if (emo === 'hopeful') {
          // Hands open and relaxed on console
          rx = -0.46; rz = s * 0.09; ex = -1.04;
        } else {
          // Calm default
          rx = -0.45; rz = s * 0.08; ex = -1.0;
        }
      }

      if (st.vote === 'AYE' && s === 1) { rx = -2.75; rz = 0.18; ex = -0.25; }
      else if (st.vote === 'NAY') { rx = -0.7; rz = -s * 0.38; ex = -1.95; }
      else if (st.vote === 'ABSTAIN') { rx = -0.62; rz = s * 0.42; ex = -1.75 + Math.sin(Math.min(st.voteT, 1) * Math.PI) * 0.2; }

      arm.rx = damp(arm.rx, rx, 5.5, dt);
      arm.rz = damp(arm.rz, rz, 5.5, dt);
      arm.ex = damp(arm.ex, ex, 5.5, dt);
      arm.shoulder.rotation.set(arm.rx, 0, arm.rz);
      arm.elbow.rotation.set(arm.ex, 0, 0);
    }

    // Glows.
    const hl = st.speaking ? 1 : st.thinking ? 0.45 : st.selected ? 0.35 : 0;
    st.highlight = damp(st.highlight, hl, 5, dt);
    this.accentMat.emissiveIntensity = 0.7 + st.highlight * 3.2;
    this.consoleMat.emissiveIntensity = 0.3 + st.highlight * 2.6 + (st.thinking ? Math.sin(t * 6) * 0.3 : 0);
    this.haloMat.opacity = st.highlight * 0.85 + (st.selected ? 0.25 : 0);
    if (st.selected && !st.speaking) this.haloMat.color.set('#ffffff'); else this.haloMat.color.copy(this.color);

    // Whisper motes spiral into the head.
    if (st.whisperT > 0) {
      st.whisperT -= dt;
      const k2 = Math.max(0, st.whisperT / 2.8);
      this.moteMat.opacity = Math.min(1, k2 * 2.2) * 0.95;
      const arr = this.whisperMotes.geometry.attributes.position.array;
      for (let i = 0; i < this.motePhase.length; i++) {
        const ph = this.motePhase[i];
        const r = 0.08 + k2 * 0.32 + Math.sin(ph * 3) * 0.04;
        const a = ph + t * (2.2 + (i % 5) * 0.3);
        arr[i * 3] = Math.cos(a) * r;
        arr[i * 3 + 1] = 0.16 + Math.sin(ph * 7 + t * 2) * 0.12 * k2 + (i / this.motePhase.length - 0.5) * 0.3 * k2;
        arr[i * 3 + 2] = Math.sin(a) * r;
      }
      this.whisperMotes.geometry.attributes.position.needsUpdate = true;
    } else if (this.moteMat.opacity > 0) this.moteMat.opacity = 0;
  }
}
