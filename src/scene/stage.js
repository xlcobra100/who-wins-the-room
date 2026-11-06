/**
 * Stage: owns the WebGL renderer, post-processing, the chamber, the six
 * characters, the hologram, the camera director and all world-space effects
 * (speaker spotlight, gaze choreography, crisis alarm, gavel strike, ballots).
 * The HUD and the game layer talk to it only through the methods below.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildRoom, buildSky } from './room.js';
import { Hologram } from './hologram.js';
import { Character } from './character.js';
import { CameraDirector } from './cameraDirector.js';
import { AffinityWeb } from './affinityWeb.js';
import { CarrierDrone } from './carrier.js';

export function getSeatAngles(count, mode = 'council') {
  if (mode === 'debate' && count >= 2) {
    // Debater 1 and Debater 2 on stage facing inward/audience; audience in arc
    const d1Angle = THREE.MathUtils.degToRad(-30);
    const d2Angle = THREE.MathUtils.degToRad(30);
    const audienceCount = count - 2;
    const audienceAngles = Array.from({ length: audienceCount }, (_, i) =>
      THREE.MathUtils.degToRad(95 + (i / Math.max(1, audienceCount - 1)) * 170)
    );
    return [d1Angle, d2Angle, ...audienceAngles];
  }
  return Array.from({ length: count }, (_, i) =>
    THREE.MathUtils.degToRad(50 + (i / Math.max(1, count - 1)) * 260)
  );
}

export const SEAT_ANGLES = getSeatAngles(6);
const RED = new THREE.Color('#ff2e3f');
const BALLOT_COLORS = { AYE: '#4dffa6', NAY: '#ff4d6a', ABSTAIN: '#a7adbd' };

const FinishShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAlarm: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform float uAlarm; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      float v = smoothstep(0.86, 0.22, length(d * vec2(1.12, 1.0)));
      c.rgb *= mix(0.5, 1.0, v);
      c.rgb = mix(c.rgb, c.rgb * vec3(1.35, 0.55, 0.55) + vec3(0.12, 0.0, 0.0), uAlarm * (1.0 - v));
      float g = fract(sin(dot(vUv * vec2(1931.0, 1087.0) + fract(uTime) * 91.0, vec2(12.9898, 78.233))) * 43758.5453);
      c.rgb += (g - 0.5) * 0.022;
      gl_FragColor = c;
    }`,
};

export class Stage {
  constructor(container) {
    this.container = container;
    this.onSelect = () => {};
    this.onInspect = () => {};
    this.quality = 'high';

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    renderer.domElement.className = 'gl';
    this.renderer = renderer;

    this.labels = new CSS2DRenderer();
    this.labels.domElement.className = 'labels';
    container.appendChild(this.labels.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#020308');
    scene.fog = new THREE.FogExp2('#05070d', 0.022);
    this.scene = scene;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.28;

    this.camera = new THREE.PerspectiveCamera(44, 1, 0.05, 900);
    this.cam = new CameraDirector(this.camera, renderer.domElement);
    this.cutFade = document.createElement('div');
    this.cutFade.className = 'cut-fade';
    container.appendChild(this.cutFade);
    this.cam.onCut = () => this.cutFade.animate([{ opacity: 0.75 }, { opacity: 0 }], { duration: 340, easing: 'ease-out' });

    this.currentTheme = 'scifi';
    this.hemiLight = new THREE.HemisphereLight('#8597c9', '#140e0b', 0.75);
    scene.add(this.hemiLight);
    this.windowLight = new THREE.DirectionalLight('#a9c1ff', 1.9);
    this.windowLight.position.set(-10, 9, -16);
    scene.add(this.windowLight);
    this.keyLight = new THREE.DirectionalLight('#ffcf9a', 1.25);
    this.keyLight.position.set(6, 10, 12);
    scene.add(this.keyLight);
    this.spot = new THREE.SpotLight('#fff0d8', 0, 12, 0.3, 0.6, 1.0);
    this.spot.position.set(0, 6.2, 0);
    scene.add(this.spot, this.spot.target);
    this.spotTarget = new THREE.Vector3(0, 1.2, 0);
    this.spotPos = new THREE.Vector3(0, 6.2, 0);

    const room = buildRoom(scene, 'scifi');
    this.roomGroup = room.root;
    this.accents = room.accents;
    this.gavel = room.gavel;
    this.chairEye = room.chairEye;
    this.sky = buildSky(scene, 'scifi');
    this.skyGroup = this.sky.root;
    this.hologram = new Hologram(scene);
    this.hologram.setGlyph('planet');
    this.hologram.setSeats(SEAT_ANGLES.map((angle) => ({ angle })));
    this.web = new AffinityWeb(scene);
    this.carrier = new CarrierDrone(scene);

    this.characters = [];
    this.byId = new Map();
    this.speakerId = null;
    this.addresseeId = null;
    this.thinkingId = null;
    this.chairGazeT = 0;
    this.alarmT = 0;
    this.gavelT = 0;
    this.gazeTimer = 0;

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.5, 0.5, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.finish = new ShaderPass(FinishShader);
    this.composer.addPass(this.finish);

    this.timer = new THREE.Timer();
    this.raycaster = new THREE.Raycaster();
    this.bindPointer();
    window.addEventListener('resize', () => this.resize());
    this.resize();
    renderer.setAnimationLoop(() => this.frame());
  }

  // ------------------------------------------------------------ cast
  setCast(personas, mode = 'council', debaters = null) {
    this.lastCastArgs = { personas, mode, debaters };
    for (const c of this.characters) {
      this.scene.remove(c.root);
      c.dispose();
    }
    if (this.labels?.domElement) {
      this.labels.domElement.replaceChildren();
    }

    let castList = [...personas];
    if (mode === 'debate' && debaters && debaters.length === 2) {
      const d1 = castList.find((p) => p.id === debaters[0]);
      const d2 = castList.find((p) => p.id === debaters[1]);
      const audience = castList.filter((p) => !debaters.includes(p.id));
      castList = [d1, d2, ...audience].filter(Boolean);
    }

    const angles = getSeatAngles(castList.length, mode);
    this.hologram.setSeats(angles.map((angle) => ({ angle })));

    this.characters = castList.map((p, i) => {
      const ch = new Character(p, i, angles[i], this.currentTheme);
      if (mode === 'debate') {
        if (i === 0) ch.plateParts.status.innerHTML = '<span class="whisper-tag" style="background:#4fc3f722;color:#4fc3f7">STAGE · PRO</span>';
        else if (i === 1) ch.plateParts.status.innerHTML = '<span class="whisper-tag" style="background:#ffb74d22;color:#ffb74d">STAGE · CON</span>';
        else ch.plateParts.status.innerHTML = '<span class="whisper-tag" style="color:var(--dim)">JURY</span>';
      }
      return ch;
    });

    this.byId = new Map(this.characters.map((c) => [c.id, c]));
    for (const c of this.characters) {
      this.scene.add(c.root);
      c.plateEl.addEventListener('click', (e) => { e.stopPropagation(); this.onSelect(c.id); });
      c.plateEl.addEventListener('dblclick', (e) => { e.stopPropagation(); this.onInspect(c.id); });
    }
  }

  char(id) { return this.byId.get(id); }

  setGlyph(kind) { this.hologram.setGlyph(kind); }

  deployCarrier(entry) {
    this.carrier.dispatch(entry);
    this.hologram.pulse('carrier');
    if (this.cam.mode === 'focus') this.cam.transition(this.cam.carrierShot(), 1.8);
  }

  // ------------------------------------------------------------ choreography
  setSpeaker(id, addresseeId = null, { shot = true, kind = 'auto' } = {}) {
    this.speakerId = id;
    this.addresseeId = addresseeId && addresseeId !== 'chair' ? addresseeId : null;
    this.addressChair = addresseeId === 'chair';
    for (const c of this.characters) c.setSpeaking(c.id === id);
    const ch = this.char(id);
    if (ch && shot) this.cam.focusSpeaker(ch, this.char(this.addresseeId), { kind });
    if (ch) this.hologram.flareArc(ch.seat);
    this.gazeTimer = 0;
  }

  clearSpeaker() {
    if (this.speakerId) this.char(this.speakerId)?.setSpeaking(false);
    this.speakerId = null;
    this.addresseeId = null;
  }

  setThinking(id, on) {
    const ch = this.char(id);
    if (!ch) return;
    ch.setThinking(on);
    this.thinkingId = on ? id : this.thinkingId === id ? null : this.thinkingId;
  }

  chairSpeaks() {
    this.chairGazeT = 3.2;
    this.strikeGavel();
    this.hologram.pulse('gavel');
    this.cam.focusChair();
  }

  strikeGavel() { this.gavelT = 0.75; }

  crisis() {
    this.alarmT = 6;
    this.hologram.pulse('crisis');
    this.cam.crisisShot();
  }

  whisper(id) {
    this.char(id)?.whisperFx();
    this.hologram.pulse('whisper');
  }

  voteStart() {
    this.hologram.pulse('vote');
    for (const c of this.characters) { c.setBallot(null); c.setVoting(true); }
    if (this.cam.mode === 'focus') this.cam.goOverview(1.4);
  }

  showBallot(id, vote) {
    const ch = this.char(id);
    if (!ch) return;
    ch.setVoting(false);
    ch.setBallot(vote);
    this.hologram.setStance(ch.seat, BALLOT_COLORS[vote], 100);
    this.hologram.flareArc(ch.seat);
  }

  clearBallots() {
    for (const c of this.characters) { c.setBallot(null); c.setVoting(false); }
  }

  setStance(id, optionId, color, conviction) {
    const ch = this.char(id);
    if (!ch) return;
    ch.setStance(optionId, color, conviction);
    if (!ch.state.vote) this.hologram.setStance(ch.seat, color, conviction);
  }

  setTension(t) { this.hologram.setTension(t); this.tension = t; }

  setSelected(id) { for (const c of this.characters) c.setSelected(c.id === id); }

  setWebVisible(v) { this.web.visible = v; }

  rebuildWeb(trustOf) { if (this.characters.length) this.web.rebuild(this.characters, trustOf); }

  setQuality(q) {
    this.quality = q;
    this.bloom.enabled = q !== 'low';
    this.renderer.setPixelRatio(q === 'low' ? 1 : Math.min(window.devicePixelRatio, 1.75));
    this.resize();
  }

  setTheme(theme = 'scifi') {
    if (this.currentTheme === theme) return;
    this.currentTheme = theme;
    if (this.roomGroup) {
      this.scene.remove(this.roomGroup);
      this.roomGroup.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    }
    if (this.skyGroup) {
      this.scene.remove(this.skyGroup);
      this.skyGroup.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    }

    const room = buildRoom(this.scene, theme);
    this.roomGroup = room.root;
    this.accents = room.accents;
    this.gavel = room.gavel;
    this.chairEye = room.chairEye;

    this.sky = buildSky(this.scene, theme);
    this.skyGroup = this.sky.root;

    const is1900 = theme === 'boardroom1900';
    if (this.hologram?.group) this.hologram.group.visible = !is1900;
    if (this.web?.group) this.web.group.visible = !is1900;
    if (this.carrier?.group) this.carrier.group.visible = !is1900;

    if (is1900) {
      this.hemiLight.color.set('#ffe1b8');
      this.hemiLight.groundColor.set('#24150c');
      this.hemiLight.intensity = 0.95;
      this.windowLight.color.set('#a6bccc');
      this.windowLight.intensity = 1.35;
      this.keyLight.color.set('#ffb868');
      this.keyLight.intensity = 1.85;
      this.scene.fog.color.set('#0f0d0b');
    } else {
      this.hemiLight.color.set('#8597c9');
      this.hemiLight.groundColor.set('#140e0b');
      this.hemiLight.intensity = 0.75;
      this.windowLight.color.set('#a9c1ff');
      this.windowLight.intensity = 1.9;
      this.keyLight.color.set('#ffcf9a');
      this.keyLight.intensity = 1.25;
      this.scene.fog.color.set('#05070d');
    }

    if (this.lastCastArgs) {
      this.setCast(this.lastCastArgs.personas, this.lastCastArgs.mode, this.lastCastArgs.debaters);
    }
  }

  // ------------------------------------------------------------ internals
  bindPointer() {
    const el = this.renderer.domElement;
    let down = null;
    el.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      const id = this.pick(e);
      if (id) this.onSelect(id);
    });
    el.addEventListener('dblclick', (e) => {
      const id = this.pick(e);
      if (id) this.onInspect(id);
    });
  }

  pick(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.characters.map((c) => c.root), true);
    for (const h of hits) if (h.object.userData.characterId) return h.object.userData.characterId;
    return null;
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / 2, h / 2);
    this.labels.setSize(w, h);
  }

  updateGaze(dt) {
    this.gazeTimer -= dt;
    this.chairGazeT = Math.max(0, this.chairGazeT - dt);
    const speaker = this.char(this.speakerId);
    const centre = new THREE.Vector3(0, 1.75, 0);
    for (const c of this.characters) {
      if (this.chairGazeT > 0 && !(speaker && c === speaker && !this.addressChair)) { c.lookAt(this.chairEye); continue; }
      if (speaker && c === speaker) {
        if (this.addressChair) c.lookAt(this.chairEye);
        else if (this.addresseeId) c.lookAt(this.char(this.addresseeId).headWorld());
        else {
          if (!c.sweep || this.gazeTimer <= 0) {
            const others = this.characters.filter((o) => o !== c);
            c.sweep = others[Math.floor(Math.random() * others.length)];
          }
          c.lookAt(c.sweep.headWorld());
        }
        continue;
      }
      if (speaker) { c.lookAt(speaker.headWorld()); continue; }
      if (this.thinkingId) {
        const th = this.char(this.thinkingId);
        if (c === th) c.lookAt(new THREE.Vector3(0, 1.0, 0)); else c.lookAt(th.headWorld());
        continue;
      }
      if (!c.idleLook || this.gazeTimer <= 0) {
        const r = Math.random();
        c.idleLook = r < 0.35 ? centre.clone() : r < 0.55 ? this.chairEye.clone() : this.characters[Math.floor(Math.random() * this.characters.length)].headWorld();
      }
      c.lookAt(c.idleLook);
    }
    if (this.gazeTimer <= 0) this.gazeTimer = 2.2 + Math.random() * 2.2;
  }

  frame() {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.05);
    const t = this.timer.getElapsed();
    this.updateGaze(dt);
    for (const c of this.characters) c.update(dt, t);
    this.hologram.update(dt);
    this.web.update(dt);
    this.cam.update(dt);
    this.carrier.update(dt, t);

    // Speaker spotlight glides to whoever holds the floor.
    const speaker = this.char(this.speakerId);
    if (speaker) {
      const head = speaker.headWorld();
      this.spotTarget.lerp(head, 1 - Math.exp(-dt * 6));
      this.spotPos.lerp(new THREE.Vector3(head.x * 0.82, 6.2, head.z * 0.82), 1 - Math.exp(-dt * 6));
      this.spot.intensity += (5 - this.spot.intensity) * (1 - Math.exp(-dt * 4));
      this.spot.color.set(speaker.persona.color).lerp(new THREE.Color('#fff0d8'), 0.7);
    } else {
      this.spot.intensity += (0 - this.spot.intensity) * (1 - Math.exp(-dt * 3));
    }
    this.spot.position.copy(this.spotPos);
    this.spot.target.position.copy(this.spotTarget);

    // Table rim follows the hologram's tension colour.
    if (this.currentTheme === 'scifi' && this.accents?.tableRing?.material?.emissive) {
      this.accents.tableRing.material.emissive.copy(this.hologram.color);
    }

    // Crisis alarm: room strips strobe red.
    let alarm = 0;
    if (this.alarmT > 0) {
      this.alarmT -= dt;
      alarm = (Math.sin(t * 7.5) * 0.5 + 0.5) * Math.min(1, this.alarmT / 1.5);
    }
    const tense = Math.max(0, ((this.tension ?? 40) - 70) / 30) * (Math.sin(t * 2.2) * 0.5 + 0.5) * 0.35;
    const red = Math.max(alarm, tense);
    if (this.accents?.strips) {
      for (const s of this.accents.strips) {
        if (s.userData?.baseColor && s.material?.emissive) {
          s.material.emissive.copy(s.userData.baseColor).lerp(RED, red);
          s.material.emissiveIntensity = (s.userData.baseIntensity || 1) * (1 + red * 1.4);
        }
      }
    }
    if (this.accents?.seamMat?.userData?.baseColor && this.accents.seamMat.emissive) {
      this.accents.seamMat.emissive.copy(this.accents.seamMat.userData.baseColor).lerp(RED, red);
    }
    this.finish.uniforms.uAlarm.value = alarm * 0.75;
    this.finish.uniforms.uTime.value = t;

    // Gavel: two quick strikes.
    if (this.gavelT > 0 && this.gavel) {
      this.gavelT = Math.max(0, this.gavelT - dt);
      const p = 1 - this.gavelT / 0.75;
      this.gavel.rotation.x = -Math.abs(Math.sin(p * Math.PI * 2)) * 0.9;
    }

    if (this.sky?.planet?.material?.uniforms?.uTime) {
      this.sky.planet.material.uniforms.uTime.value = t;
      this.sky.planet.rotation.y += dt * 0.004;
    }

    this.composer.render();
    this.labels.render(this.scene, this.camera);
  }
}
