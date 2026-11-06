/**
 * Procedural station carrier drone: delivers public dispatches and breaking
 * intelligence directly into the council chamber for everyone to see.
 */
import * as THREE from 'three';

export class CarrierDrone {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);

    this.active = false;
    this.timer = 0;
    this.duration = 6.5; // flight cycle in seconds
    this.startPos = new THREE.Vector3(0, 7.5, 6.0);
    this.hoverPos = new THREE.Vector3(0, 2.7, 0.4);
    this.exitPos = new THREE.Vector3(0, 8.0, -5.5);

    this.buildMesh();
  }

  buildMesh() {
    const metal = new THREE.MeshStandardMaterial({ color: '#1f2430', metalness: 0.85, roughness: 0.3 });
    const dark = new THREE.MeshStandardMaterial({ color: '#0d1017', metalness: 0.9, roughness: 0.2 });
    const glowMat = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#5fe1ff', emissiveIntensity: 2.8 });
    this.glowMat = glowMat;

    // Aerodynamic probe body
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.65, 16), metal);
    body.rotation.x = -Math.PI / 2;
    this.group.add(body);

    const core = new THREE.Mesh(new THREE.SphereGeometry(0.19, 18, 14), dark);
    core.scale.set(1.0, 0.7, 1.4);
    core.position.z = 0.05;
    this.group.add(core);

    // Glowing sensor eye
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), glowMat);
    eye.position.set(0, 0, 0.36);
    this.group.add(eye);

    // Lateral stabilizer fins
    for (const s of [-1, 1]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.02, 0.28), metal);
      fin.position.set(s * 0.24, 0, -0.05);
      fin.rotation.z = s * 0.2;
      this.group.add(fin);

      // Thruster pod
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.22, 12), dark);
      pod.rotation.x = Math.PI / 2;
      pod.position.set(s * 0.32, -0.02, -0.12);
      this.group.add(pod);

      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.18, 8), glowMat);
      flame.rotation.x = Math.PI / 2;
      flame.position.set(s * 0.32, -0.02, -0.25);
      this.group.add(flame);
    }

    // Rotating holographic projector ring
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.015, 8, 36), glowMat);
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.y = -0.12;
    this.group.add(this.ring);

    // Downward holographic data beam
    this.beamMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uIntensity: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uTime; uniform float uIntensity; varying vec2 vUv;
        void main(){
          float alpha = (1.0 - vUv.y) * uIntensity * 0.7;
          float bands = 0.5 + 0.5 * sin(vUv.y * 40.0 - uTime * 6.0);
          vec3 col = mix(vec3(0.3, 0.85, 1.0), vec3(1.0, 0.8, 0.3), bands * 0.3);
          gl_FragColor = vec4(col, alpha * bands);
        }`,
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.9, 1.8, 32, 1, true), this.beamMat);
    beam.position.y = -1.02;
    this.group.add(beam);

    // Point light that illuminates the table and members
    this.light = new THREE.PointLight('#5fe1ff', 0, 8, 1.2);
    this.light.position.y = -0.2;
    this.group.add(this.light);
  }

  dispatch(entry) {
    this.active = true;
    this.timer = 0;
    this.group.visible = true;
    this.group.position.copy(this.startPos);
    this.light.intensity = 0;
  }

  update(dt, t) {
    if (!this.active) return;
    this.timer += dt;
    const p = Math.min(1, this.timer / this.duration);

    // Spline / segment flight path:
    // 0.0 - 0.35: Swoop in from high ceiling down to hover
    // 0.35 - 0.75: Hover above table, rotate ring, project beam
    // 0.75 - 1.0: Climb up and exit into opposite ceiling
    let pos = new THREE.Vector3();
    let beamPower = 0;

    if (p < 0.35) {
      const u = p / 0.35;
      const ease = u * u * (3 - 2 * u);
      pos.lerpVectors(this.startPos, this.hoverPos, ease);
      this.group.rotation.x = -0.3 * (1 - ease);
      this.group.rotation.y = ease * Math.PI * 0.2;
      this.group.rotation.z = Math.sin(t * 8) * 0.08 * (1 - ease);
      this.light.intensity = ease * 3.5;
      beamPower = ease * 0.5;
    } else if (p < 0.75) {
      const u = (p - 0.35) / 0.40;
      pos.copy(this.hoverPos);
      pos.y += Math.sin(t * 2.8) * 0.06;
      pos.x += Math.cos(t * 1.5) * 0.04;
      this.group.rotation.x = Math.sin(t * 2.0) * 0.04;
      this.group.rotation.y = t * 0.4;
      this.group.rotation.z = Math.sin(t * 3.0) * 0.04;
      this.light.intensity = 3.5 + Math.sin(t * 6) * 1.2;
      beamPower = 1.0;
    } else {
      const u = (p - 0.75) / 0.25;
      const ease = u * u;
      pos.lerpVectors(this.hoverPos, this.exitPos, ease);
      this.group.rotation.x = 0.4 * ease;
      this.group.rotation.y = t * 0.4;
      this.light.intensity = (1 - ease) * 3.5;
      beamPower = 1 - ease;
    }

    this.group.position.copy(pos);
    this.ring.rotation.z += dt * 3.5;
    this.beamMat.uniforms.uTime.value = t;
    this.beamMat.uniforms.uIntensity.value = beamPower;

    if (p >= 1.0) {
      this.active = false;
      this.group.visible = false;
    }
  }
}
