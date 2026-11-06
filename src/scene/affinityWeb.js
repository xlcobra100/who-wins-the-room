/**
 * Affinity web: glowing arcs over the table between every pair of members.
 * Colour = mutual trust (red hostile → grey neutral → green allied), thickness
 * and brightness = strength. Rebuilt when trust changes (15 tubes; cheap).
 */
import * as THREE from 'three';

const HOSTILE = new THREE.Color('#ff3d5e');
const NEUTRAL = new THREE.Color('#7d8799');
const ALLIED = new THREE.Color('#3dffa8');

export class AffinityWeb {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.time = 0;
  }

  set visible(v) { this.group.visible = v; }
  get visible() { return this.group.visible; }

  rebuild(characters, trustOf) {
    for (const c of this.group.children) { c.geometry.dispose(); c.material.dispose(); }
    this.group.clear();
    for (let i = 0; i < characters.length; i++) {
      for (let j = i + 1; j < characters.length; j++) {
        const a = characters[i];
        const b = characters[j];
        const v = (trustOf(a.id, b.id) + trustOf(b.id, a.id)) / 2;
        const k = Math.abs(v) / 100;
        const pa = a.headWorld().add(new THREE.Vector3(0, 0.28, 0));
        const pb = b.headWorld().add(new THREE.Vector3(0, 0.28, 0));
        const mid = pa.clone().add(pb).multiplyScalar(0.5).multiplyScalar(0.35);
        mid.y = 2.35 + k * 0.4;
        const curve = new THREE.QuadraticBezierCurve3(pa, mid, pb);
        const color = v >= 0 ? NEUTRAL.clone().lerp(ALLIED, Math.min(1, k * 1.4)) : NEUTRAL.clone().lerp(HOSTILE, Math.min(1, k * 1.4));
        const mat = new THREE.MeshBasicMaterial({
          color: color.multiplyScalar(1.4), transparent: true, opacity: 0.08 + k * 0.7,
          blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
        });
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.003 + k * 0.011, 6, false), mat);
        tube.userData.base = mat.opacity;
        tube.userData.phase = i * 1.7 + j;
        this.group.add(tube);
      }
    }
  }

  update(dt) {
    if (!this.group.visible) return;
    this.time += dt;
    for (const t of this.group.children) {
      t.material.opacity = t.userData.base * (0.8 + 0.2 * Math.sin(this.time * 1.8 + t.userData.phase));
    }
  }
}
