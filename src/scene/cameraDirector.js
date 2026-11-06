/**
 * Cinematic camera director with three modes:
 *  - overview: slow drifting establishing shot of the whole chamber
 *  - focus:    auto-cuts to whoever is speaking (inner 3/4 close-ups, over-the-
 *              shoulder from the person being addressed, occasional wide two-shots)
 *  - free:     OrbitControls; the player drives
 * Transitions interpolate in cylindrical coordinates around the table so the
 * camera arcs around the room instead of flying through people or the hologram.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { polar } from './room.js';

const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

function toCyl(v) { return { r: Math.hypot(v.x, v.z), a: Math.atan2(v.x, v.z), y: v.y }; }
function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export class CameraDirector {
  constructor(camera, dom) {
    this.camera = camera;
    this.controls = new OrbitControls(camera, dom);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 1.1, 0);
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 15;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.enabled = false;
    this.mode = 'overview';
    this.target = new THREE.Vector3(0, 1.1, -0.4);
    this.from = null;
    this.to = null;
    this.t = 1;
    this.duration = 1.6;
    this.hold = null; // the shot currently held (for subtle push-in)
    this.holdT = 0;
    this.shakeAmt = 0;
    this.time = 0;
    this.shotCount = 0;
    this.listeners = new Set();
    camera.position.set(0, 5.2, 10.5);
    camera.lookAt(this.target);
  }

  onMode(fn) { this.listeners.add(fn); }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.controls.enabled = mode === 'free';
    if (mode === 'free') {
      this.controls.target.copy(this.target);
      this.t = 1;
      this.to = null;
    } else if (mode === 'overview') {
      this.goOverview();
    }
    for (const fn of this.listeners) fn(mode);
  }

  overviewShot(time = this.time) {
    const a = Math.sin(time * 0.06) * 0.16;
    return {
      pos: new THREE.Vector3(Math.sin(a) * 8.4, 4.25 + Math.sin(time * 0.09) * 0.12, Math.cos(a) * 8.4),
      target: new THREE.Vector3(0, 1.05, -0.5),
      fov: 44,
      drift: true,
    };
  }

  goOverview(duration = 2.0) { this.transition(this.overviewShot(this.time + duration), duration); }

  chairShot() {
    return { pos: new THREE.Vector3(0, 1.72, 4.25), target: new THREE.Vector3(0, 1.25, -1.2), fov: 52 };
  }

  carrierShot() {
    return { pos: new THREE.Vector3(0, 3.8, 3.8), target: new THREE.Vector3(0, 2.6, 0.3), fov: 48 };
  }

  debateDualShot(chA, chB) {
    const headA = chA.headWorld();
    const headB = chB.headWorld();
    const mid = headA.clone().add(headB).multiplyScalar(0.5);
    return {
      pos: new THREE.Vector3(0, 2.4, 5.2),
      target: new THREE.Vector3(mid.x, 1.35, mid.z),
      fov: 54,
    };
  }

  /** Pick a speaker framing. `addressee` is another Character or null. */
  speakerShot(ch, addressee, kind = 'auto') {
    const head = ch.headWorld();
    this.shotCount++;
    let type = kind;
    if (type === 'auto') {
      if (addressee && Math.random() < 0.55) type = 'ots';
      else if (this.shotCount % 5 === 0) type = 'wide';
      else type = 'inner';
    }
    if (type === 'ots' && addressee) {
      const ah = addressee.headWorld();
      const away = ah.clone().sub(head).setY(0).normalize();
      const side = new THREE.Vector3(-away.z, 0, away.x).multiplyScalar(0.38 * (this.shotCount % 2 ? 1 : -1));
      const pos = ah.clone().add(away.multiplyScalar(0.72)).add(side).add(new THREE.Vector3(0, 0.26, 0));
      return { pos, target: head.clone().add(new THREE.Vector3(0, -0.16, 0)), fov: 38 };
    }
    if (type === 'wide') {
      const mid = addressee ? ch.angle + angleDiff(ch.angle, addressee.angle) / 2 : ch.angle;
      return { pos: polar(mid + Math.PI, 6.2, 2.7), target: polar(mid, 1.4, 1.2), fov: 40 };
    }
    // Inner 3/4: from the hologram side, offset laterally, looking out at the face.
    const off = (this.shotCount % 2 ? 1 : -1) * (0.55 + Math.random() * 0.15);
    const pos = polar(ch.angle + off, 1.05, 1.62);
    return { pos, target: head.clone().add(new THREE.Vector3(0, -0.2, 0)), fov: 42 };
  }

  focusSpeaker(ch, addressee, opts = {}) {
    if (this.mode !== 'focus' && !opts.force) return;
    const shot = this.speakerShot(ch, addressee, opts.kind);
    shot.close = true;
    // Close shot to close shot: hard cut. Gliding between seats sends the camera
    // through heads and the hologram; from a wide/establishing shot we still glide.
    const cut = this.to?.close && this.camera.position.distanceTo(shot.pos) > 0.8;
    this.transition(shot, opts.duration ?? 1.35, { cut });
  }

  focusChair() {
    if (this.mode !== 'focus') return;
    this.transition(this.chairShot(), 1.1);
  }

  /** A one-off look at a member (double-click), honoured in any mode. */
  inspect(ch) {
    if (this.mode === 'free') {
      const head = ch.headWorld();
      this.controls.target.copy(head);
      const pos = polar(ch.angle, 1.1, 1.55);
      this.camera.position.copy(pos);
      return;
    }
    this.transition(this.speakerShot(ch, null, 'inner'), 1.2);
  }

  crisisShot() {
    if (this.mode === 'free') { this.shake(0.5); return; }
    this.transition({ pos: new THREE.Vector3(0, 3.0, 6.0), target: new THREE.Vector3(0, 1.45, 0), fov: 50 }, 0.9);
    this.shake(0.6);
  }

  transition(shot, duration = 1.5, { cut = false } = {}) {
    if (this.mode === 'free') return;
    if (cut) {
      this.camera.position.copy(shot.pos);
      this.target.copy(shot.target);
      this.camera.fov = shot.fov;
      this.camera.updateProjectionMatrix();
      this.from = null;
      this.to = shot;
      this.t = 1;
      this.holdT = 0;
      this.onCut?.();
      return;
    }
    this.from = { pos: this.camera.position.clone(), target: this.target.clone(), fov: this.camera.fov };
    this.to = shot;
    this.t = 0;
    this.duration = Math.max(0.05, duration);
    this.holdT = 0;
  }

  shake(amount) { this.shakeAmt = Math.max(this.shakeAmt, amount); }

  update(dt) {
    this.time += dt;
    if (this.mode === 'free') {
      this.controls.update();
      this.target.copy(this.controls.target);
      if (this.shakeAmt > 0) this.applyShake(dt);
      return;
    }
    if (this.to) {
      if (this.t < 1) {
        this.t = Math.min(1, this.t + dt / this.duration);
        const k = ease(this.t);
        const a = toCyl(this.from.pos);
        const b = toCyl(this.to.pos);
        if (a.r > 0.6 && b.r > 0.6) {
          const r = THREE.MathUtils.lerp(a.r, b.r, k);
          const ang = angleLerp(a.a, b.a, k);
          // Lift slightly mid-transition to clear heads.
          const y = THREE.MathUtils.lerp(a.y, b.y, k) + Math.sin(k * Math.PI) * 0.35 * Math.min(1, Math.abs(angleLerp(0, b.a - a.a, 1)));
          this.camera.position.set(Math.sin(ang) * r, y, Math.cos(ang) * r);
        } else {
          this.camera.position.lerpVectors(this.from.pos, this.to.pos, k);
        }
        this.target.lerpVectors(this.from.target, this.to.target, k);
        this.camera.fov = THREE.MathUtils.lerp(this.from.fov, this.to.fov, k);
        this.camera.updateProjectionMatrix();
      } else {
        // Held shot: overview keeps drifting; speaker shots push in very slowly.
        this.holdT += dt;
        if (this.to.drift) {
          const s = this.overviewShot(this.time);
          this.camera.position.lerp(s.pos, 1 - Math.exp(-dt * 0.8));
          this.target.lerp(s.target, 1 - Math.exp(-dt * 0.8));
        } else {
          const push = Math.min(this.holdT * 0.012, 0.12);
          const dir = this.to.target.clone().sub(this.to.pos).normalize();
          this.camera.position.copy(this.to.pos).addScaledVector(dir, push);
          this.camera.position.y += Math.sin(this.time * 0.7) * 0.006;
          this.camera.position.x += Math.sin(this.time * 0.53) * 0.006;
        }
      }
    }
    if (this.shakeAmt > 0) this.applyShake(dt);
    this.camera.lookAt(this.target);
  }

  applyShake(dt) {
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 0.9);
    const s = this.shakeAmt * this.shakeAmt * 0.06;
    this.camera.position.x += (Math.random() - 0.5) * s;
    this.camera.position.y += (Math.random() - 0.5) * s;
  }
}

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
