/**
 * Halcyon Council — Room and Chamber environments.
 *
 * Supports two distinct aesthetic eras:
 *  1. 'scifi': Orbital habitat chamber overlooking gas giant Tethys-Var with glowing telemetry rings.
 *  2. 'boardroom1900': Grand Gilded Age / Edwardian executive boardroom with rich English oak parquet,
 *     carved walnut wainscoting, Persian carpet, brass banker's lamps, antique terrestrial globe,
 *     grandfather clock, framed maritime oils, and arched windows over a misty, lamplit 1900s skyline.
 *
 * All procedural Three.js geometry with zero external asset dependencies.
 */
import * as THREE from 'three';

export const ROOM_RADIUS = 12;
export const WALL_HEIGHT = 6.6;
export const TABLE_RADIUS = 2.3;
export const TABLE_TOP = 0.78;
export const SEAT_RADIUS = 2.75;
const WINDOW_START = THREE.MathUtils.degToRad(112);
const WINDOW_LENGTH = THREE.MathUtils.degToRad(136);
const SILL = 1.05;
const HEADER = 5.7;

export function polar(theta, r, y = 0) {
  return new THREE.Vector3(Math.sin(theta) * r, y, Math.cos(theta) * r);
}

// ============================================================================
// SCIFI ORBITAL CHAMBER
// ============================================================================
function buildSciFiRoom(scene, root) {
  const accents = { strips: [], floorRings: [], tableRing: null, consoles: [], theme: 'scifi' };
  const metal = new THREE.MeshStandardMaterial({ color: '#1a1f2b', metalness: 0.75, roughness: 0.38 });
  const panel = new THREE.MeshStandardMaterial({ color: '#2a2622', metalness: 0.25, roughness: 0.72, side: THREE.BackSide });
  const dark = new THREE.MeshStandardMaterial({ color: '#0d1017', metalness: 0.6, roughness: 0.5 });

  // Floor: polished dark composite with inlaid light rings.
  const floor = new THREE.Mesh(new THREE.CircleGeometry(ROOM_RADIUS, 128),
    new THREE.MeshStandardMaterial({ color: '#0a0d14', metalness: 0.82, roughness: 0.26 }));
  floor.rotation.x = -Math.PI / 2;
  floor.name = 'floor';
  root.add(floor);

  for (const [r, w, color, intensity] of [[3.75, 0.035, '#ffb45c', 1.6], [5.6, 0.02, '#6fd8ff', 1.2], [8.6, 0.03, '#ffb45c', 0.8]]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - w, r + w, 160),
      new THREE.MeshStandardMaterial({ color: '#000', emissive: color, emissiveIntensity: intensity }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.004;
    ring.userData.baseIntensity = intensity;
    root.add(ring);
    accents.floorRings.push(ring);
  }

  // Radial inlays.
  const inlayMat = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#3a4a66', emissiveIntensity: 0.6 });
  for (let i = 0; i < 24; i++) {
    const t = (i / 24) * Math.PI * 2;
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.018, 7.2), inlayMat);
    strip.rotation.x = -Math.PI / 2;
    strip.rotation.z = t;
    strip.position.copy(polar(t, 7.6, 0.003));
    root.add(strip);
  }

  // Walls (everything except the window arc), with pillars and light bands.
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(ROOM_RADIUS, ROOM_RADIUS, WALL_HEIGHT, 96, 1, true,
    WINDOW_START + WINDOW_LENGTH, Math.PI * 2 - WINDOW_LENGTH), panel);
  wall.position.y = WALL_HEIGHT / 2;
  root.add(wall);
  const under = new THREE.Mesh(new THREE.CylinderGeometry(ROOM_RADIUS, ROOM_RADIUS, SILL, 64, 1, true, WINDOW_START, WINDOW_LENGTH), panel);
  under.position.y = SILL / 2;
  root.add(under);
  const header = new THREE.Mesh(new THREE.CylinderGeometry(ROOM_RADIUS, ROOM_RADIUS, WALL_HEIGHT - HEADER, 64, 1, true, WINDOW_START, WINDOW_LENGTH), panel);
  header.position.y = (HEADER + WALL_HEIGHT) / 2;
  root.add(header);

  // Sill
  const sill = new THREE.Mesh(new THREE.CylinderGeometry(ROOM_RADIUS - 0.45, ROOM_RADIUS - 0.45, 0.08, 64, 1, true, WINDOW_START, WINDOW_LENGTH),
    new THREE.MeshStandardMaterial({ color: '#1a1f2b', metalness: 0.75, roughness: 0.38, side: THREE.DoubleSide }));
  sill.position.y = SILL;
  root.add(sill);
  const ledge = new THREE.Mesh(new THREE.RingGeometry(ROOM_RADIUS - 0.45, ROOM_RADIUS, 64, 1, WINDOW_START - Math.PI / 2, WINDOW_LENGTH), metal);
  ledge.rotation.x = -Math.PI / 2;
  ledge.position.y = SILL + 0.04;
  root.add(ledge);

  const bandMat = (color, intensity) => new THREE.MeshStandardMaterial({ color: '#000', emissive: color, emissiveIntensity: intensity, side: THREE.BackSide });
  for (const [y, h, color, intensity] of [[0.32, 0.035, '#ffb45c', 2.2], [3.4, 0.02, '#6fd8ff', 1.1], [WALL_HEIGHT - 0.4, 0.03, '#ffb45c', 1.4]]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(ROOM_RADIUS - 0.03, ROOM_RADIUS - 0.03, h, 128, 1, true,
      WINDOW_START + WINDOW_LENGTH, Math.PI * 2 - WINDOW_LENGTH), bandMat(color, intensity));
    band.position.y = y;
    band.userData.baseColor = new THREE.Color(color);
    band.userData.baseIntensity = intensity;
    root.add(band);
    accents.strips.push(band);
  }

  // Pillars with glowing seams.
  const pillarGeo = new THREE.BoxGeometry(0.55, WALL_HEIGHT, 0.5);
  const seamGeo = new THREE.BoxGeometry(0.05, WALL_HEIGHT - 1.2, 0.02);
  const seamMat = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffb45c', emissiveIntensity: 2.4 });
  seamMat.userData.baseColor = new THREE.Color('#ffb45c');
  accents.seamMat = seamMat;
  for (let deg = 0; deg < 360; deg += 22.5) {
    const t = THREE.MathUtils.degToRad(deg);
    const inWindow = t > WINDOW_START && t < WINDOW_START + WINDOW_LENGTH;
    if (inWindow) continue;
    const p = new THREE.Mesh(pillarGeo, metal);
    p.position.copy(polar(t, ROOM_RADIUS - 0.25, WALL_HEIGHT / 2));
    p.rotation.y = t;
    root.add(p);
    const seam = new THREE.Mesh(seamGeo, seamMat);
    seam.position.copy(polar(t, ROOM_RADIUS - 0.52, WALL_HEIGHT / 2));
    seam.rotation.y = t;
    root.add(seam);
  }

  // Window mullions.
  const mullion = new THREE.BoxGeometry(0.16, HEADER - SILL, 0.3);
  for (let i = 0; i <= 8; i++) {
    const t = WINDOW_START + (i / 8) * WINDOW_LENGTH;
    const m = new THREE.Mesh(mullion, dark);
    m.position.copy(polar(t, ROOM_RADIUS - 0.1, (SILL + HEADER) / 2));
    m.rotation.y = t;
    root.add(m);
  }

  // Glass reflection
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(ROOM_RADIUS - 0.05, ROOM_RADIUS - 0.05, HEADER - SILL, 64, 1, true, WINDOW_START, WINDOW_LENGTH),
    new THREE.MeshBasicMaterial({ color: '#88aaff', transparent: true, opacity: 0.035, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  glass.position.y = (SILL + HEADER) / 2;
  root.add(glass);

  // Ceiling
  const ceiling = new THREE.Mesh(new THREE.CircleGeometry(ROOM_RADIUS, 96), new THREE.MeshStandardMaterial({ color: '#07090e', metalness: 0.5, roughness: 0.7, side: THREE.DoubleSide }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = WALL_HEIGHT;
  root.add(ceiling);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.05, 12, 160), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffe2c0', emissiveIntensity: 2.0 }));
  halo.rotation.x = Math.PI / 2;
  halo.position.y = WALL_HEIGHT - 0.35;
  root.add(halo);
  accents.halo = halo;

  // The council table
  const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(TABLE_RADIUS, TABLE_RADIUS - 0.04, 0.08, 128),
    new THREE.MeshStandardMaterial({ color: '#141821', metalness: 0.55, roughness: 0.42 }));
  tableTop.position.y = TABLE_TOP - 0.04;
  root.add(tableTop);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.35, TABLE_TOP - 0.08, 64), metal);
  ped.position.y = (TABLE_TOP - 0.08) / 2;
  root.add(ped);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(TABLE_RADIUS, 0.022, 8, 192),
    new THREE.MeshStandardMaterial({ color: '#000', emissive: '#6fe3ff', emissiveIntensity: 2.2 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = TABLE_TOP;
  root.add(rim);
  accents.tableRing = rim;
  const inlay = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.215, 128), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffb45c', emissiveIntensity: 1.2 }));
  inlay.rotation.x = -Math.PI / 2;
  inlay.position.y = TABLE_TOP + 0.002;
  root.add(inlay);

  // The Chair's podium at θ = 0
  const podium = new THREE.Group();
  podium.position.copy(polar(0, 3.35));
  const podBase = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.05, 0.45), metal);
  podBase.position.y = 0.52;
  podium.add(podBase);
  const podTop = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.55), dark);
  podTop.position.set(0, 1.07, 0.02);
  podTop.rotation.x = -0.18;
  podium.add(podTop);
  const podEdge = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.02, 0.02), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffb45c', emissiveIntensity: 2.5 }));
  podEdge.position.set(0, 1.04, -0.25);
  podium.add(podEdge);
  const gavel = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.55 });
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.2, 16), wood);
  head.rotation.z = Math.PI / 2;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.28, 8), wood);
  handle.rotation.x = Math.PI / 2;
  handle.position.z = 0.15;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.03, 16), new THREE.MeshStandardMaterial({ color: '#c9a45c', metalness: 0.9, roughness: 0.25 }));
  band.rotation.z = Math.PI / 2;
  gavel.add(head, handle, band);
  gavel.position.set(0.18, 1.16, -0.05);
  podium.add(gavel);
  const block = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.03, 24), wood);
  block.position.set(0.18, 1.105, -0.05);
  podium.add(block);
  podium.rotation.y = Math.PI;
  root.add(podium);

  return { root, accents, gavel, podium, chairEye: polar(0, 3.35, 1.62) };
}

// ============================================================================
// 1900s GRAND BOARDROOM
// ============================================================================
function buildBoardroom1900(scene, root) {
  const accents = { strips: [], floorRings: [], tableRing: null, consoles: [], theme: 'boardroom1900' };

  // Materials: Oak, Mahogany, Brass, Leather, Velvet, Green Glass
  const oakParquet = new THREE.MeshStandardMaterial({ color: '#27170e', roughness: 0.32, metalness: 0.05 });
  const mahogany = new THREE.MeshStandardMaterial({ color: '#38160c', roughness: 0.22, metalness: 0.08 });
  const darkWalnut = new THREE.MeshStandardMaterial({ color: '#1f1109', roughness: 0.42, metalness: 0.04 });
  const brass = new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 0.88, roughness: 0.22 });
  const antiqueGold = new THREE.MeshStandardMaterial({ color: '#c59a38', metalness: 0.75, roughness: 0.32 });
  const greenWall = new THREE.MeshStandardMaterial({ color: '#14251b', roughness: 0.78, side: THREE.BackSide });
  const wainscotPanel = new THREE.MeshStandardMaterial({ color: '#2a150b', roughness: 0.38, side: THREE.BackSide });
  const persianBurgundy = new THREE.MeshStandardMaterial({ color: '#56131c', roughness: 0.78 });
  const persianNavy = new THREE.MeshStandardMaterial({ color: '#162236', roughness: 0.75 });
  const leatherGreen = new THREE.MeshStandardMaterial({ color: '#122a1c', roughness: 0.52 });
  const parchmentMat = new THREE.MeshStandardMaterial({ color: '#ede3ce', roughness: 0.8 });
  const bankerGreen = new THREE.MeshStandardMaterial({ color: '#034522', emissive: '#0a6335', emissiveIntensity: 1.1, roughness: 0.18 });

  // 1. Floor: High-gloss English Oak Parquet
  const floor = new THREE.Mesh(new THREE.CircleGeometry(ROOM_RADIUS, 96), oakParquet);
  floor.rotation.x = -Math.PI / 2;
  floor.name = 'floor';
  root.add(floor);

  // Parquet outer border ring
  const parquetBorder = new THREE.Mesh(new THREE.RingGeometry(8.5, 9.2, 96), darkWalnut);
  parquetBorder.rotation.x = -Math.PI / 2;
  parquetBorder.position.y = 0.002;
  root.add(parquetBorder);

  // 2. Persian Boardroom Rug under the conference table
  const rugRadius = 4.8;
  const rugBase = new THREE.Mesh(new THREE.CircleGeometry(rugRadius, 80), persianBurgundy);
  rugBase.rotation.x = -Math.PI / 2;
  rugBase.position.y = 0.005;
  root.add(rugBase);

  // Intricate multi-band rug borders
  const rugOuterGold = new THREE.Mesh(new THREE.RingGeometry(rugRadius - 0.18, rugRadius, 80), antiqueGold);
  rugOuterGold.rotation.x = -Math.PI / 2;
  rugOuterGold.position.y = 0.007;
  root.add(rugOuterGold);

  const rugNavyBand = new THREE.Mesh(new THREE.RingGeometry(rugRadius - 0.55, rugRadius - 0.22, 80), persianNavy);
  rugNavyBand.rotation.x = -Math.PI / 2;
  rugNavyBand.position.y = 0.007;
  root.add(rugNavyBand);

  const rugInnerMedallion = new THREE.Mesh(new THREE.RingGeometry(1.6, 1.72, 64), antiqueGold);
  rugInnerMedallion.rotation.x = -Math.PI / 2;
  rugInnerMedallion.position.y = 0.007;
  root.add(rugInnerMedallion);
  accents.floorRings.push(rugInnerMedallion);

  // 3. Walls: Dark Wainscoting below + Heritage Green above
  const wainscotHeight = 2.4;
  const wainscot = new THREE.Mesh(new THREE.CylinderGeometry(ROOM_RADIUS, ROOM_RADIUS, wainscotHeight, 96, 1, true,
    WINDOW_START + WINDOW_LENGTH, Math.PI * 2 - WINDOW_LENGTH), wainscotPanel);
  wainscot.position.y = wainscotHeight / 2;
  root.add(wainscot);

  const upperWall = new THREE.Mesh(new THREE.CylinderGeometry(ROOM_RADIUS, ROOM_RADIUS, WALL_HEIGHT - wainscotHeight, 96, 1, true,
    WINDOW_START + WINDOW_LENGTH, Math.PI * 2 - WINDOW_LENGTH), greenWall);
  upperWall.position.y = wainscotHeight + (WALL_HEIGHT - wainscotHeight) / 2;
  root.add(upperWall);

  // Wainscoting chair-rail molding & brass picture rail
  const chairRail = new THREE.Mesh(new THREE.CylinderGeometry(ROOM_RADIUS - 0.02, ROOM_RADIUS - 0.02, 0.08, 96, 1, true,
    WINDOW_START + WINDOW_LENGTH, Math.PI * 2 - WINDOW_LENGTH), mahogany);
  chairRail.position.y = wainscotHeight;
  root.add(chairRail);

  const pictureRail = new THREE.Mesh(new THREE.CylinderGeometry(ROOM_RADIUS - 0.04, ROOM_RADIUS - 0.04, 0.04, 96, 1, true,
    WINDOW_START + WINDOW_LENGTH, Math.PI * 2 - WINDOW_LENGTH), brass);
  pictureRail.position.y = 4.8;
  root.add(pictureRail);
  accents.strips.push(pictureRail);

  // Carved Walnut Pilasters along the walls
  const pilasterGeo = new THREE.BoxGeometry(0.48, WALL_HEIGHT, 0.35);
  const capitalGeo = new THREE.BoxGeometry(0.58, 0.16, 0.42);
  for (let deg = 0; deg < 360; deg += 30) {
    const t = THREE.MathUtils.degToRad(deg);
    const inWindow = t > WINDOW_START && t < WINDOW_START + WINDOW_LENGTH;
    if (inWindow) continue;
    const p = new THREE.Mesh(pilasterGeo, darkWalnut);
    p.position.copy(polar(t, ROOM_RADIUS - 0.18, WALL_HEIGHT / 2));
    p.rotation.y = t;
    root.add(p);

    const cap = new THREE.Mesh(capitalGeo, antiqueGold);
    cap.position.copy(polar(t, ROOM_RADIUS - 0.2, WALL_HEIGHT - 0.15));
    cap.rotation.y = t;
    root.add(cap);

    // Warm brass wall sconce
    const sconceArm = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.28, 8), brass);
    sconceArm.rotation.x = Math.PI / 3;
    sconceArm.position.copy(polar(t, ROOM_RADIUS - 0.38, 2.9));
    sconceArm.rotation.y = t;
    const sconceGlobe = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12),
      new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#ffb55c', emissiveIntensity: 2.2 }));
    sconceGlobe.position.copy(polar(t, ROOM_RADIUS - 0.48, 3.02));
    root.add(sconceArm, sconceGlobe);
  }

  // 4. Framed Oil Paintings & Maritime Charts on the walls
  const frameGeo = new THREE.BoxGeometry(1.6, 1.1, 0.06);
  const canvasGeo = new THREE.PlaneGeometry(1.4, 0.9);
  const paintingAngles = [
    { deg: 45, col: '#223447' },
    { deg: 80, col: '#3b2f21' },
    { deg: 280, col: '#1e382b' },
    { deg: 315, col: '#45291b' },
  ];
  for (const item of paintingAngles) {
    const t = THREE.MathUtils.degToRad(item.deg);
    const frame = new THREE.Mesh(frameGeo, antiqueGold);
    frame.position.copy(polar(t, ROOM_RADIUS - 0.28, 3.5));
    frame.rotation.y = t + Math.PI;
    const canvas = new THREE.Mesh(canvasGeo, new THREE.MeshStandardMaterial({ color: item.col, roughness: 0.85 }));
    canvas.position.copy(polar(t, ROOM_RADIUS - 0.32, 3.5));
    canvas.rotation.y = t + Math.PI;
    root.add(frame, canvas);
  }

  // 5. Arched Edwardian Bay Windows overlooking 1900s skyline
  const under = new THREE.Mesh(new THREE.CylinderGeometry(ROOM_RADIUS, ROOM_RADIUS, SILL, 64, 1, true, WINDOW_START, WINDOW_LENGTH), wainscotPanel);
  under.position.y = SILL / 2;
  root.add(under);
  const header = new THREE.Mesh(new THREE.CylinderGeometry(ROOM_RADIUS, ROOM_RADIUS, WALL_HEIGHT - HEADER, 64, 1, true, WINDOW_START, WINDOW_LENGTH), darkWalnut);
  header.position.y = (HEADER + WALL_HEIGHT) / 2;
  root.add(header);

  // Polished mahogany window sill
  const sill = new THREE.Mesh(new THREE.CylinderGeometry(ROOM_RADIUS - 0.5, ROOM_RADIUS - 0.5, 0.1, 64, 1, true, WINDOW_START, WINDOW_LENGTH), mahogany);
  sill.position.y = SILL;
  root.add(sill);

  // Arched mullions
  const mullion = new THREE.BoxGeometry(0.14, HEADER - SILL, 0.35);
  for (let i = 0; i <= 8; i++) {
    const t = WINDOW_START + (i / 8) * WINDOW_LENGTH;
    const m = new THREE.Mesh(mullion, darkWalnut);
    m.position.copy(polar(t, ROOM_RADIUS - 0.15, (SILL + HEADER) / 2));
    m.rotation.y = t;
    root.add(m);
  }

  // Velvet drapery framing the window alcove
  const drapeGeo = new THREE.CylinderGeometry(0.35, 0.42, HEADER - SILL + 0.6, 16);
  const drapeMat = new THREE.MeshStandardMaterial({ color: '#4a1017', roughness: 0.85 });
  const drapeL = new THREE.Mesh(drapeGeo, drapeMat);
  drapeL.position.copy(polar(WINDOW_START - 0.05, ROOM_RADIUS - 0.4, (SILL + HEADER) / 2));
  const drapeR = new THREE.Mesh(drapeGeo, drapeMat);
  drapeR.position.copy(polar(WINDOW_START + WINDOW_LENGTH + 0.05, ROOM_RADIUS - 0.4, (SILL + HEADER) / 2));
  root.add(drapeL, drapeR);

  // 6. Ceiling: Coffered Dark Oak with central brass chandelier
  const ceiling = new THREE.Mesh(new THREE.CircleGeometry(ROOM_RADIUS, 80), darkWalnut);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = WALL_HEIGHT;
  root.add(ceiling);

  // Grand Edwardian Chandelier / Gasolier
  const chanStem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 12), brass);
  chanStem.position.set(0, WALL_HEIGHT - 0.9, 0);
  const chanRing = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.05, 12, 48), brass);
  chanRing.rotation.x = Math.PI / 2;
  chanRing.position.set(0, WALL_HEIGHT - 1.8, 0);
  root.add(chanStem, chanRing);

  // Chandelier lights with warm amber glow
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.06, 0.16, 12),
      new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#ffb350', emissiveIntensity: 2.8, transparent: true, opacity: 0.9 }));
    shade.position.set(Math.sin(a) * 1.6, WALL_HEIGHT - 1.75, Math.cos(a) * 1.6);
    root.add(shade);
  }

  // 7. Executive Boardroom Table: Hand-Polished Carved Mahogany
  const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(TABLE_RADIUS, TABLE_RADIUS - 0.05, 0.09, 96), mahogany);
  tableTop.position.y = TABLE_TOP - 0.045;
  root.add(tableTop);

  // Polished Brass perimeter edge band
  const brassTableRim = new THREE.Mesh(new THREE.TorusGeometry(TABLE_RADIUS, 0.02, 10, 128), brass);
  brassTableRim.rotation.x = Math.PI / 2;
  brassTableRim.position.y = TABLE_TOP;
  root.add(brassTableRim);
  accents.tableRing = brassTableRim;

  // Carved fluted pedestal base
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.25, TABLE_TOP - 0.09, 48), darkWalnut);
  pedestal.position.y = (TABLE_TOP - 0.09) / 2;
  root.add(pedestal);

  // 8. Individual Executive Desk Blotters & Folios at each seat
  const seatAngles = [
    THREE.MathUtils.degToRad(35),
    THREE.MathUtils.degToRad(85),
    THREE.MathUtils.degToRad(140),
    THREE.MathUtils.degToRad(220),
    THREE.MathUtils.degToRad(275),
    THREE.MathUtils.degToRad(325),
    THREE.MathUtils.degToRad(180),
  ];
  for (const ang of seatAngles) {
    const blotter = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.008, 0.38), leatherGreen);
    blotter.position.copy(polar(ang, TABLE_RADIUS - 0.38, TABLE_TOP + 0.004));
    blotter.rotation.y = ang + Math.PI;
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.28), parchmentMat);
    paper.rotation.x = -Math.PI / 2;
    paper.rotation.z = ang + Math.PI;
    paper.position.copy(polar(ang, TABLE_RADIUS - 0.38, TABLE_TOP + 0.01));
    // Brass fountain pen
    const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.18, 8), brass);
    pen.rotation.z = Math.PI / 2;
    pen.position.copy(polar(ang, TABLE_RADIUS - 0.58, TABLE_TOP + 0.012));
    root.add(blotter, paper, pen);
  }

  // 9. Two Classic Emerald Banker's Lamps on the Table
  for (const sign of [-1, 1]) {
    const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.36, 12), brass);
    lampStem.position.set(sign * 1.15, TABLE_TOP + 0.18, 0.2);
    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.03, 16), brass);
    lampBase.position.set(sign * 1.15, TABLE_TOP + 0.015, 0.2);
    const lampShade = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.22, 16, 1, false, 0, Math.PI), bankerGreen);
    lampShade.rotation.z = Math.PI / 2;
    lampShade.position.set(sign * 1.15, TABLE_TOP + 0.36, 0.2);
    root.add(lampStem, lampBase, lampShade);
  }

  // 10. Centerpiece: Antique Brass Terrestrial Globe on turned stand
  const globeStand = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.44, 0.18, 24), mahogany);
  globeStand.position.set(0, TABLE_TOP + 0.09, 0);
  const globeMeridian = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.016, 12, 48), brass);
  globeMeridian.position.set(0, TABLE_TOP + 0.48, 0);
  globeMeridian.rotation.y = Math.PI / 4;
  const globeSphere = new THREE.Mesh(new THREE.SphereGeometry(0.32, 32, 24),
    new THREE.MeshStandardMaterial({ color: '#cfb895', roughness: 0.65 }));
  globeSphere.position.set(0, TABLE_TOP + 0.48, 0);
  root.add(globeStand, globeMeridian, globeSphere);

  // 11. Stately 1900s Grandfather Clock against the wall
  const clockGroup = new THREE.Group();
  clockGroup.position.copy(polar(THREE.MathUtils.degToRad(245), ROOM_RADIUS - 0.7));
  clockGroup.rotation.y = THREE.MathUtils.degToRad(65);
  const clockCase = new THREE.Mesh(new THREE.BoxGeometry(0.7, 3.2, 0.45), darkWalnut);
  clockCase.position.y = 1.6;
  const clockDial = new THREE.Mesh(new THREE.CircleGeometry(0.24, 32),
    new THREE.MeshStandardMaterial({ color: '#fbf8ee', roughness: 0.3 }));
  clockDial.position.set(0, 2.7, 0.23);
  const clockPendulum = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.2, 8), brass);
  clockPendulum.position.set(0, 1.5, 0.15);
  const clockBob = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 24), brass);
  clockBob.position.set(0, 0.9, 0.15);
  clockBob.rotation.x = Math.PI / 2;
  clockGroup.add(clockCase, clockDial, clockPendulum, clockBob);
  root.add(clockGroup);

  // 12. Parliamentary Oak Podium & Solid Rosewood Gavel at θ = 0
  const podium = new THREE.Group();
  podium.position.copy(polar(0, 3.35));
  const podBase = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.05, 0.48), darkWalnut);
  podBase.position.y = 0.52;
  podium.add(podBase);
  const podTop = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.06, 0.58), mahogany);
  podTop.position.set(0, 1.07, 0.02);
  podTop.rotation.x = -0.18;
  podium.add(podTop);
  const podRail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.98, 12), brass);
  podRail.rotation.z = Math.PI / 2;
  podRail.position.set(0, 1.12, 0.26);
  podium.add(podRail);

  // Turned rosewood gavel with heavy brass band
  const gavel = new THREE.Group();
  const rosewood = new THREE.MeshStandardMaterial({ color: '#42160d', roughness: 0.38 });
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.22, 18), rosewood);
  head.rotation.z = Math.PI / 2;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.016, 0.29, 12), rosewood);
  handle.rotation.x = Math.PI / 2;
  handle.position.z = 0.15;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 18), brass);
  band.rotation.z = Math.PI / 2;
  gavel.add(head, handle, band);
  gavel.position.set(0.18, 1.16, -0.05);
  podium.add(gavel);

  const block = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.035, 24), darkWalnut);
  block.position.set(0.18, 1.105, -0.05);
  podium.add(block);

  podium.rotation.y = Math.PI;
  root.add(podium);

  return { root, accents, gavel, podium, chairEye: polar(0, 3.35, 1.62) };
}

export function buildRoom(scene, theme = 'scifi') {
  const root = new THREE.Group();
  root.name = 'roomRoot';
  scene.add(root);

  if (theme === 'boardroom1900') {
    return buildBoardroom1900(scene, root);
  }
  return buildSciFiRoom(scene, root);
}

// ============================================================================
// SKY / VISTA ENVIRONMENTS
// ============================================================================
export function buildSky(scene, theme = 'scifi') {
  const root = new THREE.Group();
  root.name = 'skyRoot';
  scene.add(root);

  if (theme === 'boardroom1900') {
    // Foggy 1900s Victorian / Edwardian River Skyline
    const skyMat = new THREE.MeshBasicMaterial({
      color: '#0b111a',
      side: THREE.BackSide,
      fog: false,
    });
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 24), skyMat);
    root.add(skyDome);

    // Glowing Silver Moon
    const moon = new THREE.Mesh(new THREE.SphereGeometry(14, 32, 32),
      new THREE.MeshBasicMaterial({ color: '#f7f4ea', fog: false }));
    moon.position.set(-60, 48, -260);
    root.add(moon);

    // Misty river horizon band
    const fogPlane = new THREE.Mesh(new THREE.CylinderGeometry(180, 180, 45, 64, 1, true, WINDOW_START, WINDOW_LENGTH),
      new THREE.MeshBasicMaterial({ color: '#161c24', transparent: true, opacity: 0.85, side: THREE.BackSide, depthWrite: false }));
    fogPlane.position.y = 8;
    root.add(fogPlane);

    // Silhouetted industrial skyline: Brick warehouses, chimneys, and gas lanterns
    const skylineGroup = new THREE.Group();
    const silMat = new THREE.MeshBasicMaterial({ color: '#090d14', fog: false });
    const gaslampMat = new THREE.MeshBasicMaterial({ color: '#ffb347', fog: false });

    for (let i = 0; i < 36; i++) {
      const ang = WINDOW_START + (i / 36) * WINDOW_LENGTH;
      const dist = 140 + (i % 5) * 15;
      const h = 12 + ((i * 17) % 28);
      const w = 6 + ((i * 7) % 12);
      const bldg = new THREE.Mesh(new THREE.BoxGeometry(w, h, 8), silMat);
      bldg.position.copy(polar(ang, dist, h / 2 - 2));
      bldg.rotation.y = ang;
      skylineGroup.add(bldg);

      // Smokestacks with faint plumes
      if (i % 4 === 0) {
        const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, h + 16, 8), silMat);
        stack.position.copy(polar(ang + 0.02, dist - 5, (h + 16) / 2));
        skylineGroup.add(stack);
      }

      // Distant warm gaslamps along waterfront
      if (i % 2 === 0) {
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 6, 6), gaslampMat);
        lamp.position.copy(polar(ang, dist - 25, 2.5 + (i % 3)));
        skylineGroup.add(lamp);
      }
    }
    root.add(skylineGroup);

    return { root, moon, skyline: skylineGroup, theme: 'boardroom1900' };
  }

  // Default: Gas giant Tethys-Var, rings, moon, starfield
  const sun = new THREE.Vector3(0.75, 0.32, 0.45).normalize();

  const planet = new THREE.Mesh(new THREE.SphereGeometry(70, 96, 64), new THREE.ShaderMaterial({
    uniforms: { uSun: { value: sun }, uTime: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vP; varying vec3 vObj; void main(){ vObj = position; vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position, 1.0); vP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform vec3 uSun; uniform float uTime; varying vec3 vN; varying vec3 vP; varying vec3 vObj;
      float hash(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      float noise(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f); return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y), mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
      float fbm(vec3 p){ float v=0.0; float a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=0.5; } return v; }
      void main(){
        vec3 n = normalize(vN); vec3 o = normalize(vObj); float lat = o.y;
        float swirl = fbm(vec3(o.x*3.0 + uTime*0.004, lat*14.0, o.z*3.0)) * 1.6;
        float bands = sin(lat*26.0 + swirl*2.2) * 0.5 + 0.5;
        float fine = sin(lat*71.0 + swirl*4.0) * 0.5 + 0.5;
        vec3 deep = vec3(0.07, 0.17, 0.27); vec3 teal = vec3(0.24, 0.52, 0.62); vec3 pale = vec3(0.78, 0.86, 0.82);
        vec3 col = mix(deep, teal, bands); col = mix(col, pale, smoothstep(0.62, 0.95, fine) * 0.45);
        float storm = smoothstep(0.86, 0.93, 1.0 - length(vec2(o.x - 0.35, (lat + 0.22) * 2.2)));
        col = mix(col, vec3(0.92, 0.62, 0.42), storm * 0.8);
        float d = dot(n, uSun); float light = smoothstep(-0.18, 0.55, d); col *= light * 1.25 + 0.015;
        vec3 v = normalize(cameraPosition - vP); float fres = pow(1.0 - max(dot(n, v), 0.0), 2.5);
        col += vec3(0.35, 0.65, 1.0) * fres * (smoothstep(-0.3, 0.6, d) * 0.9 + 0.05);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
    fog: false,
  }));
  planet.position.set(-38, -6, -215);
  planet.rotation.z = 0.32;
  root.add(planet);

  const rings = new THREE.Mesh(new THREE.RingGeometry(88, 150, 256, 1), new THREE.ShaderMaterial({
    uniforms: { uSun: { value: sun } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec3 vL; varying vec3 vN; void main(){ vL = position; vN = normalize(mat3(modelMatrix)*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uSun; varying vec3 vL; varying vec3 vN;
      float h(float x){ return fract(sin(x*127.1)*43758.5453); }
      void main(){
        float r = length(vL.xy); float t = (r - 88.0) / 62.0;
        float b = h(floor(r*1.7)) * 0.6 + h(floor(r*0.37)) * 0.4;
        float gap = smoothstep(0.43, 0.45, t) * (1.0 - smoothstep(0.5, 0.52, t));
        float a = b * smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.92, 1.0, t)) * (1.0 - gap*0.85) * 0.55;
        vec3 col = mix(vec3(0.55,0.62,0.7), vec3(0.92,0.83,0.68), b) * (0.35 + 0.75*abs(dot(normalize(vN), uSun)));
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }`,
    fog: false,
  }));
  rings.position.copy(planet.position);
  rings.rotation.set(-1.32, 0.18, 0.3);
  root.add(rings);

  const moon = new THREE.Mesh(new THREE.SphereGeometry(5, 48, 32), new THREE.MeshStandardMaterial({ color: '#b8b2a8', roughness: 0.95, fog: false }));
  moon.position.set(70, 30, -260);
  root.add(moon);

  const count = 4200;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const u = Math.random() * 2 - 1;
    const th = Math.random() * Math.PI * 2;
    const r = 420 + Math.random() * 200;
    const s = Math.sqrt(1 - u * u);
    pos.set([s * Math.cos(th) * r, u * r, s * Math.sin(th) * r], i * 3);
    c.setHSL(0.55 + Math.random() * 0.15 - (Math.random() < 0.2 ? 0.45 : 0), 0.5, 0.65 + Math.random() * 0.35);
    const k = Math.random() < 0.06 ? 2.2 : 0.55 + Math.random() * 0.8;
    col.set([c.r * k, c.g * k, c.b * k], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false }));
  root.add(stars);

  return { root, planet, rings, sun, theme: 'scifi' };
}
