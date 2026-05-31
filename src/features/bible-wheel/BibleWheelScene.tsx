import { useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Text as TroikaText } from 'troika-three-text';
import { BIBLE_BOOKS } from './bible-data';
// createCurvedText import removed during Step 2 cleanup (was only used by old labels code)
import {
  spokeCenterAngle,
  wedgeTheta,
  cycleRadii,
  cycleHeight,
  makeAnnulusShape,
  makeWedgeShape,
  makeBand,
  makeSpokeLines,
} from './utils/wheelGeometry';
import { useHebrewRing } from './hooks/useHebrewRing';
import { useDivisionTransition } from './hooks/useDivisionTransition';
import { useWheelInteraction } from './hooks/useWheelInteraction';
import type {
  BibleWheelConfig,
  WedgeUserData,
  DivisionKey,
  BibleWheelBook,
} from './bible-wheel.types';
import {
  DIVISIONS,
  divisionFor,
  hexToInt,
  FONTS,
} from './bible-wheel.types';

// ============================================
// Main 3D Scene Component (R3F)
// ============================================

interface BibleWheelSceneProps {
  config: BibleWheelConfig;
  divisionColors: Record<DivisionKey, string>;
  divisionMode: boolean;
  onWedgeClick: (data: WedgeUserData) => void;
  setDivisionBlockMeshes: (meshes: THREE.Mesh[]) => void;
  setWedgeMeshes: (meshes: THREE.Mesh[]) => void;
  setWheelGroupRef?: (group: THREE.Group | null) => void;
  divisionLabelStyles: import('./bible-wheel.types').DivisionLabelStyles;
  divisionDisplay?: Record<import('./bible-wheel.types').DivisionKey, { label: string; canonLabel?: string | string[] }>;
}

export function BibleWheelScene(props: BibleWheelSceneProps) {
  const {
    config,
    divisionColors,
    divisionMode,
    onWedgeClick,
    setDivisionBlockMeshes,
    setWedgeMeshes,
    setWheelGroupRef: _ignoredSetWheelGroupRef,
    divisionLabelStyles,
    divisionDisplay = {},
  } = props;

  const { scene, camera, gl } = useThree();
  const controlsRef = useRef<any>(null);
  const wheelGroupRef = useRef<THREE.Group>(null!);

  const wedgeMeshesRef = useRef<THREE.Mesh[]>([]);
  const wedgeRestZRef = useRef<Map<THREE.Mesh, number>>(new Map());
  // Division block and label refs are now owned by the useDivisionTransition hook
  // const divisionBlockMeshesRef = useRef<THREE.Mesh[]>([]);
  // const divisionLabelGroupsRef = useRef<TroikaText[][]>([]);

  const spokeLinesRef = useRef<THREE.LineSegments | null>(null);

  // Hebrew ring is now managed by useHebrewRing hook (Step 1 of refactoring)
  const spokeWedgesRef = useRef<THREE.Mesh[][]>([]);     // still needed here for book wedge grouping

  const crossMaterialsRef = useRef<THREE.Material[]>([]);
  const centerGlowRef = useRef<THREE.PointLight | null>(null);

  // transitionProgressRef moved into useDivisionTransition hook (Step 2)
  const prevDivisionModeRef = useRef(divisionMode);

  // Interaction logic is now fully encapsulated in useWheelInteraction hook


  // Hebrew ring system (encapsulated - Step 1)
  const hebrewRing = useHebrewRing({
    config,
    divisionMode,
    wedgeRestZRef,
    spokeWedgesRef,
  });

  // Division / Canon transition system (encapsulated - Step 2)
  const divisionTransition = useDivisionTransition({
    config,
    divisionMode,
    divisionLabelStyles,
    divisionColors,
    wedgeRestZRef,
  });

  // ==================== Internal Helpers (kept here for now) ====================

  function makeText(opts: {
    text: string;
    font: 'hebrew' | 'english';
    fontSize: number;
    color: number;
    x: number;
    y: number;
    z?: number;
    rotation: number;
  }): TroikaText {
    const t = new TroikaText();
    t.text = opts.text;
    t.font = FONTS[opts.font];
    t.fontSize = opts.fontSize;
    t.color = opts.color;
    t.anchorX = 'center';
    t.anchorY = 'middle';
    t.position.set(opts.x, opts.y, opts.z ?? 0.2);
    t.rotation.z = opts.rotation;
    t.material.side = THREE.DoubleSide;
    t.sync();
    return t;
  }

  function addBookWedge(book: BibleWheelBook, spoke: number, cycle: number, group: THREE.Group) {
    const radii = cycleRadii(cycle, config);
    const { start, length } = wedgeTheta(spoke);
    const depth = cycleHeight(cycle, config);

    const inset = 0.18;
    const shape = makeWedgeShape(
      radii.inner + inset,
      radii.outer - inset,
      start + inset / radii.outer,
      start + length - inset / radii.outer,
    );

    const bevel = Math.min(0.5, depth * 0.3);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 4,
      curveSegments: 18,
    });

    const baseColor = hexToInt(divisionColors[divisionFor(book.position).key]);

    const mat = new THREE.MeshPhysicalMaterial({
      color: baseColor,
      metalness: 0.12,
      roughness: 0.5,
      emissive: baseColor,
      emissiveIntensity: 0.04,
      clearcoat: 0.55,
      clearcoatRoughness: 0.22,
      reflectivity: 0.35,
      envMapIntensity: 0.9,
      transparent: true,
      opacity: 1,
    });

    const mesh = new THREE.Mesh(geo, mat);
    wedgeRestZRef.current.set(mesh, 0);
    wedgeMeshesRef.current.push(mesh);
    group.add(mesh);

    const angle = spokeCenterAngle(spoke);
    const radial = cycle === 3;
    const rotation = radial ? angle + Math.PI : angle - Math.PI / 2;

    const span = radii.outer - radii.inner;
    const rName = radii.inner + span * (radial ? 0.72 : 0.62);
    const rNum = radii.inner + span * 0.28;

    const nameSize = radial
      ? Math.min(1.5, span * 0.17)
      : Math.min(2.1, span * 0.30) * (cycle === 2 ? 0.9 : 1.0);
    const numSize = radial
      ? Math.min(1.05, span * 0.12)
      : Math.min(1.5, span * 0.22) * (cycle === 2 ? 0.9 : 1.0);

    const labelZ = depth + bevel + 0.1;

    const nameLabel = makeText({
      text: book.shortname,
      font: 'english',
      fontSize: nameSize,
      color: 0x141428,
      x: rName * Math.cos(angle),
      y: rName * Math.sin(angle),
      z: labelZ,
      rotation,
    });
    group.add(nameLabel);

    const numLabel = makeText({
      text: String(book.position),
      font: 'english',
      fontSize: numSize,
      color: 0x2a2a44,
      x: rNum * Math.cos(angle),
      y: rNum * Math.sin(angle),
      z: labelZ,
      rotation,
    });
    group.add(numLabel);

    mesh.userData = {
      book, spoke, cycle,
      labels: [nameLabel, numLabel],
      labelRestZ: [labelZ, labelZ],
      originalPosition: mesh.position.clone(),
    } as WedgeUserData;

    nameLabel.userData = { originalPosition: nameLabel.position.clone() };
    numLabel.userData = { originalPosition: numLabel.position.clone() };
  }

  function addCanonicalDividers(group: THREE.Group) {
    const EXTEND_TOP = false;
    const c = config;

    const topSpec = EXTEND_TOP
      ? { boundaryIdx: 0, inner: c.rCenter + 0.4, outer: c.rCycle1, innerHeight: 4.8, outerHeight: 2.8 }
      : { boundaryIdx: 0, inner: c.rCycle3, outer: c.rCycle1, innerHeight: 3.5, outerHeight: 2.8 };

    const specs = [
      topSpec,
      { boundaryIdx: 5, inner: c.rCycle3, outer: c.rCycle1, innerHeight: 3.5, outerHeight: 2.8 },
      { boundaryIdx: 17, inner: c.rCycle3, outer: c.rCycle1, innerHeight: 3.5, outerHeight: 2.8 },
    ];

    const thickness = 0.7;
    const bevel = 0.15;

    const dividerMat = new THREE.MeshPhysicalMaterial({
      color: 0xd4b85a,
      metalness: 0.9,
      roughness: 0.22,
      clearcoat: 0.7,
      clearcoatRoughness: 0.18,
      envMapIntensity: 1.3,
      emissive: 0xa07a18,
      emissiveIntensity: 0.18,
    });

    for (const s of specs) {
      const profile = new THREE.Shape();
      profile.moveTo(s.inner, 0);
      profile.lineTo(s.inner, s.innerHeight);
      profile.lineTo(s.outer, s.outerHeight);
      profile.lineTo(s.outer, 0);
      profile.lineTo(s.inner, 0);

      const geo = new THREE.ExtrudeGeometry(profile, {
        depth: thickness,
        bevelEnabled: true,
        bevelThickness: bevel,
        bevelSize: bevel,
        bevelSegments: 3,
        curveSegments: 1,
      });

      geo.translate(0, 0, -thickness / 2);
      geo.rotateX(Math.PI / 2);

      const mesh = new THREE.Mesh(geo, dividerMat);
      mesh.rotation.z = spokeCenterAngle(s.boundaryIdx + 0.5);
      group.add(mesh);
    }
  }

  function addContainingGoldRing(group: THREE.Group) {
    const c = config;

    // Gold ring framing the Hebrew alphabet band from the inside.
    // Radial width matches the inner gold ring and the canon dividers (0.7).
    const ringWidth = 0.7;
    const ringOuter = c.rCycle1 + 0.78;   // keep outer edge fixed so the Hebrew cell band + gap does not shift
    const ringInner = ringOuter - ringWidth;
    const ringHeight = 2.8;

    const shape = makeAnnulusShape(ringInner, ringOuter);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: ringHeight,
      bevelEnabled: true,
      bevelThickness: 0.15,
      bevelSize: 0.15,
      bevelSegments: 3,
      curveSegments: 96,
    });

    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xd4b85a,
      metalness: 0.92,
      roughness: 0.18,
      clearcoat: 0.75,
      clearcoatRoughness: 0.15,
      envMapIntensity: 1.35,
      emissive: 0xa07a18,
      emissiveIntensity: 0.16,
    });

    const ring = new THREE.Mesh(geo, mat);
    group.add(ring);
  }

  function addInnerGoldRing(group: THREE.Group) {
    const c = config;

    // Gold ring framing the inner Celtic cross.
    // Radial width matches the gold canon dividers (thickness = 0.7)
    const ringWidth = 0.7;
    const ringInner = c.rCenter + 0.1;           // just outside the main disc edge
    const ringOuter = ringInner + ringWidth;     // 0.7 wide
    const ringHeight = 1.2;                      // modest height so it doesn't overpower the cross

    const shape = makeAnnulusShape(ringInner, ringOuter);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: ringHeight,
      bevelEnabled: true,
      bevelThickness: 0.15,
      bevelSize: 0.15,
      bevelSegments: 3,
      curveSegments: 96,
    });

    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xd4b85a,
      metalness: 0.92,
      roughness: 0.18,
      clearcoat: 0.75,
      clearcoatRoughness: 0.15,
      envMapIntensity: 1.35,
      emissive: 0xa07a18,
      emissiveIntensity: 0.16,
    });

    const ring = new THREE.Mesh(geo, mat);
    ring.position.z = c.hDisc;
    group.add(ring);

    // Participate in the center idle emissive pulse
    crossMaterialsRef.current.push(mat);
  }

  function addCenter(group: THREE.Group) {
    const c = config;

    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(c.rCenter + 0.4, c.rCenter + 0.4, c.hDisc, 96),
      new THREE.MeshPhysicalMaterial({
        color: 0xeaeefb, metalness: 0.45, roughness: 0.22,
        emissive: 0x222244, emissiveIntensity: 0.22,
        clearcoat: 0.6, clearcoatRoughness: 0.18, envMapIntensity: 1.1,
      }),
    );
    disc.rotation.x = Math.PI / 2;
    disc.position.z = c.hDisc / 2;
    group.add(disc);

    const haloShape = makeAnnulusShape(c.rCenter * 0.55, c.rCenter * 0.78);
    const halo = new THREE.Mesh(
      new THREE.ExtrudeGeometry(haloShape, {
        depth: c.hCross * 0.55,
        bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.18,
        bevelSegments: 2, curveSegments: 64,
      }),
      new THREE.MeshPhysicalMaterial({
        color: 0xe2c168, metalness: 0.95, roughness: 0.18,
        emissive: 0xc88e2c, emissiveIntensity: 0.45,
        clearcoat: 0.8, clearcoatRoughness: 0.12, envMapIntensity: 1.4,
      }),
    );
    halo.position.z = c.hDisc;
    group.add(halo);
    crossMaterialsRef.current.push(halo.material);

    const crossGroup = new THREE.Group();
    crossGroup.position.z = c.hDisc;
    group.add(crossGroup);

    const armLen = c.rCenter * 1.05;
    const armWid = c.rCenter * 0.26;
    const goldMat = new THREE.MeshPhysicalMaterial({
      color: 0xead17a, metalness: 0.95, roughness: 0.15,
      emissive: 0xd09a2e, emissiveIntensity: 0.6,
      clearcoat: 0.85, clearcoatRoughness: 0.1, envMapIntensity: 1.5,
    });
    crossMaterialsRef.current.push(goldMat);

    const armGeo = (w: number, h: number) => new THREE.BoxGeometry(w, h, c.hCross);
    const vert = new THREE.Mesh(armGeo(armWid, armLen * 2), goldMat);
    const horiz = new THREE.Mesh(armGeo(armLen * 2, armWid), goldMat);
    vert.position.z = c.hCross / 2;
    horiz.position.z = c.hCross / 2;
    crossGroup.add(vert);
    crossGroup.add(horiz);

    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(armWid * 0.42, 24, 16),
      new THREE.MeshStandardMaterial({
        color: 0xffffff, emissive: 0xfff3c4, emissiveIntensity: 1.8,
        metalness: 0.4, roughness: 0.2,
      }),
    );
    dot.position.z = c.hCross + 0.15;
    crossGroup.add(dot);
    crossMaterialsRef.current.push(dot.material);

    if (config.showInnerGoldRing) {
      addInnerGoldRing(group);
    }

    const glow = new THREE.PointLight(0xffd58a, 1.4, 60, 1.6);
    glow.position.set(0, 0, c.hDisc + c.hCross + 2);
    group.add(glow);
    centerGlowRef.current = glow;

    crossMaterialsRef.current.forEach(m => {
      (m.userData as any)['baseEmissive'] = (m as any).emissiveIntensity ?? 0.6;
    });
  }

  // Division creation functions moved to utils/ (Step 2)

  function buildWheel(group: THREE.Group) {
    wedgeMeshesRef.current = [];
    wedgeRestZRef.current.clear();
    divisionTransition.divisionBlockMeshesRef.current = [];
    divisionTransition.divisionLabelGroupsRef.current = [];
    crossMaterialsRef.current = [];
    centerGlowRef.current = null;

    // Creation is delegated to the hook (Step 2) - current stubs clear refs
    divisionTransition.createDivisionBlockMeshes(group);
    divisionTransition.createDivisionLabels(group, divisionLabelStyles, divisionDisplay, divisionTransition.divisionBlockMeshesRef);

    group.add(makeBand(0, config.rLetter + 1.0, config.hBack, 0x0a0a22, { metalness: 0.2, roughness: 0.85 }));
    group.add(makeBand(config.rLetter, config.rLetter + 0.7, config.hRim, 0xd4b85a, { metalness: 0.9, roughness: 0.25 }));
    group.add(makeBand(config.rCycle1 + 0.05, config.rLetter, config.hLetter, 0x1f1b5c, { metalness: 0.35, roughness: 0.55 }));

    for (const book of BIBLE_BOOKS) {
      const spoke = ((book.position - 1) % 22) + 1;
      const cycle = Math.ceil(book.position / 22);
      addBookWedge(book, spoke, cycle, group);
    }

    hebrewRing.createHebrewRing(group, makeText);

    // Group wedges by spoke for spoke-hover highlighting
    const spokeWedges: THREE.Mesh[][] = Array.from({ length: 22 }, () => []);
    wedgeMeshesRef.current.forEach(mesh => {
      const spoke = (mesh.userData as any)?.spoke;
      if (typeof spoke === 'number') {
        spokeWedges[spoke - 1].push(mesh);
      }
    });
    spokeWedgesRef.current = spokeWedges;

    // Apply default lifted height to the Hebrew cells and their text
    // (now managed inside useHebrewRing, but we still run the initial Z sync here for safety)
    hebrewRing.hebrewCellMeshesRef.current.forEach(cell => {
      cell.position.z = 2.1;
    });

    hebrewRing.hebrewLabelPairsRef.current.forEach((pair, idx) => {
      const cell = hebrewRing.hebrewCellMeshesRef.current[idx];
      const data = cell?.userData as any;
      const cellRest = data?.cellRestZ ?? 2.1;
      const delta = (cell?.position.z ?? 2.1) - cellRest;
      const labelRests: number[] = data?.labelRestZ ?? [2.95, 2.95];
      pair.forEach((label, i) => {
        label.position.z = (labelRests[i] ?? 2.95) + delta;
        label.renderOrder = 50;
        if (label.material) {
          const m = label.material as any;
          m.transparent = true;
          m.opacity = 1;
          m.depthTest = false;
          m.depthWrite = false;
          m.needsUpdate = true;
        }
      });
    });

    const spokeLines = makeSpokeLines(config);
    group.add(spokeLines);
    spokeLinesRef.current = spokeLines;
    addCanonicalDividers(group);
    addContainingGoldRing(group);
    addCenter(group);
    divisionTransition.createDivisionBlockMeshes(group);
    divisionTransition.createDivisionLabels(group, divisionLabelStyles, divisionDisplay, divisionTransition.divisionBlockMeshesRef);
  }

  function applyColorsToMeshes() {
    for (const mesh of wedgeMeshesRef.current) {
      const data = mesh.userData as WedgeUserData;
      if (!data?.book) continue;
      const key = divisionFor(data.book.position).key;
      const color = hexToInt(divisionColors[key]);
      const mat = mesh.material as THREE.MeshPhysicalMaterial;
      if (mat) {
        mat.color.setHex(color);
        mat.emissive.setHex(color);
      }
    }

    divisionTransition.divisionBlockMeshesRef.current.forEach((block, i) => {
      const div = DIVISIONS[i];
      if (!div) return;
      const color = hexToInt(divisionColors[div.key]);
      const mat = block.material as THREE.MeshPhysicalMaterial;
      if (mat) {
        mat.color.setHex(color);
        mat.emissive.setHex(color);
      }
    });
  }

  // forceShowAllDivisionLabels moved into useDivisionTransition hook (Step 2)

  // ==================== useEffects & Animation ====================

  useEffect(() => {
    if (!wheelGroupRef.current) return;

    const pmrem = new THREE.PMREMGenerator(gl);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    gl.setClearColor(0x000000, 0);
    scene.fog = new THREE.Fog(0x0a0a14, 90, 220);

    const ambient = new THREE.AmbientLight(0x6a6da0, 0.55);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xfff4d6, 1.15);
    key.position.set(-30, 40, 60);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x88a8ff, 0.45);
    fill.position.set(40, -30, 35);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xff9080, 0.35);
    rim.position.set(0, -50, -10);
    scene.add(rim);

    camera.position.set(0, -22, 90);
    camera.lookAt(0, 0, 6);
    camera.updateProjectionMatrix();

    buildWheel(wheelGroupRef.current);

    return () => {
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach(m => m.dispose());
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (prevDivisionModeRef.current === divisionMode) return;
    prevDivisionModeRef.current = divisionMode;

    const wedges = divisionMode ? [] : wedgeMeshesRef.current;
    const blocks = divisionMode ? divisionTransition.divisionBlockMeshesRef.current : [];
    setWedgeMeshes([...wedges]);
    setDivisionBlockMeshes([...blocks]);

    if (divisionMode) {
      divisionTransition.forceShowAllDivisionLabels();
      setTimeout(divisionTransition.forceShowAllDivisionLabels, 600);
      setTimeout(divisionTransition.forceShowAllDivisionLabels, 1200);
    } else {
      // Leaving Division mode - clear any Hebrew spoke hover
      if (hebrewRing.currentHebrewSpokeRef.current !== null) {
        hebrewRing.setSpokeHover(null);
      }
    }
  }, [divisionMode]);

  useEffect(() => {
    applyColorsToMeshes();
  }, [divisionColors]);

  // Live rebuild of *only* the curved labels when spacing/size/offset/font changes in the panel.
  // This is surgical — we do NOT touch the 3D block meshes or book wedges.
  useEffect(() => {
    const group = wheelGroupRef.current;
    if (!group) return;

    // Remove only the old division label objects (Troika texts)
    divisionTransition.divisionLabelGroupsRef.current.forEach(labelGroup => {
      labelGroup.forEach(label => {
        if (label.parent) label.parent.remove(label);
      });
    });
    divisionTransition.divisionLabelGroupsRef.current = [];

    // Clear label references from the division block meshes (for hover lift)
    divisionTransition.divisionBlockMeshesRef.current.forEach(mesh => {
      if ((mesh as any).userData) {
        (mesh as any).userData.labels = [];
        (mesh as any).userData.labelRestZ = [];
      }
    });

    // Recreate just the labels with fresh per-division styles
    divisionTransition.createDivisionLabels(group, divisionLabelStyles, divisionDisplay, divisionTransition.divisionBlockMeshesRef);

    // Make sure they show up if we're in Division Mode
    if (divisionMode) {
      requestAnimationFrame(() => divisionTransition.forceShowAllDivisionLabels());
      setTimeout(divisionTransition.forceShowAllDivisionLabels, 60);
      setTimeout(divisionTransition.forceShowAllDivisionLabels, 200);
    }

    // Restore colors on book wedges in case any materials were touched
    applyColorsToMeshes();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [divisionLabelStyles]);

  // ==================== Interaction (encapsulated - Step 3) ====================

  useWheelInteraction({
    gl,
    camera,
    divisionMode,
    config,
    onWedgeClick,
    wedgeMeshesRef,
    wedgeRestZRef,
    hebrewRing,
    divisionTransition,
  });

  // ==================== Animation Loop ====================

  useEffect(() => {
    let animationFrameId: number;

    const animate = () => {
      const group = wheelGroupRef.current;
      if (!group) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }

      const elapsed = (performance.now() / 1000);

      // Entrance animation (softened for immediate visibility)
      const t = Math.min(1, elapsed / (config.entranceDuration ?? 1.4));
      const ease = 1 - Math.pow(1 - t, 3);
      group.rotation.x = (1 - ease) * -0.35;
      group.rotation.z = (1 - ease) * -0.25;
      const s = 0.85 + 0.15 * ease;
      group.scale.set(s, s, s);

      // Cross pulse
      const pulse = 0.85 + 0.15 * Math.sin(elapsed * (config.pulseFrequency ?? 1.6));
      crossMaterialsRef.current.forEach(m => {
        const base = (m.userData as any)['baseEmissive'] ?? 0.6;
        (m as any).emissiveIntensity = base * pulse;
      });
      if (centerGlowRef.current) {
        centerGlowRef.current.intensity = 1.0 + 0.5 * pulse;
      }

      // Delegate Canon transition progress + block/label visuals to the extracted hook (Step 2)
      const transitionState = divisionTransition.updateTransition(divisionMode);
      const p = 1 - Math.pow(1 - divisionTransition.transitionProgressRef.current, 3);

      // Smooth transition curves for text
      const smoothstep = (edge0: number, edge1: number, x: number) => {
        const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
        return t * t * (3 - 2 * t);
      };

      const smallTextMult = 1 - smoothstep(0.22, 0.70, p);
      // bigTextMult calculation kept in hook for future tuning (Step 2)

      const wedgeOpacity = transitionState.wedgeOpacity;
      const isFullyBlocked = transitionState.isFullyBlocked;
      const wedgesVisible = !isFullyBlocked && wedgeOpacity > 0.01;

      wedgeMeshesRef.current.forEach(mesh => {
        const mat = mesh.material as THREE.MeshPhysicalMaterial;
        mat.opacity = isFullyBlocked ? 0 : wedgeOpacity;
        mat.transparent = true;
        mesh.visible = wedgesVisible;

        const data = mesh.userData as WedgeUserData;

        if (data?.originalPosition) {
          mesh.position.copy(data.originalPosition as THREE.Vector3);
        }

        const smallLabelOpacity = wedgeOpacity * smallTextMult;

        if (data?.labels) {
          data.labels.forEach((label) => {
            if (label.material) {
              (label.material as any).transparent = true;
              (label.material as any).opacity = smallLabelOpacity;
              (label.material as any).needsUpdate = true;
            }
            label.sync();
          });
        }
      });

      // Division block/label fading is now handled inside divisionTransition.updateTransition()

      controlsRef.current?.update?.();
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [config, divisionMode]);

  return (
    <>
      <group ref={wheelGroupRef} />
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.08}
        minDistance={50}
        maxDistance={160}
        minPolarAngle={Math.PI * 0.18}
        maxPolarAngle={Math.PI * 0.62}
        enablePan={false}
        target={[0, 0, 4]}
      />
    </>
  );
}
