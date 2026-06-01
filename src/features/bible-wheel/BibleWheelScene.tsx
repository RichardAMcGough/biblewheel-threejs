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
import {
  useHebrewRing,
  useDivisionTransition,
  useWheelInteraction,
  useWheelAnimation,
  useDebugLighting,
} from './hooks';
import { LightPositionHelpers } from './components/LightPositionHelpers';
import type {
  BibleWheelConfig,
  WedgeUserData,
  HebrewCellUserData,
  DivisionBlockUserData,
  LabelledMeshUserData,
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

  // Debug lighting state comes from context via the hook (no prop drilling)
  const debug = useDebugLighting();

  const lights = debug.lightConfig;
  const finalAmbientIntensity = debug.finalAmbientIntensity;
  const finalEnvIntensity = debug.finalEnvIntensity;

  // Apply dynamic environment intensity from the debug panel
  useEffect(() => {
    if (scene) {
      scene.environmentIntensity = finalEnvIntensity;
    }
  }, [finalEnvIntensity, scene]);

  // Live adjustment of the resting wheel tilt from the View & Lighting panel.
  // This lets you fine-tune the angle so the env map glare doesn't hit the center
  // of the Celtic cross when the wheel is at rest (very useful for presentation).
  useEffect(() => {
    if (wheelGroupRef.current) {
      wheelGroupRef.current.rotation.x = lights.restingTiltX;
    }
  }, [lights.restingTiltX]);

  // Live control of environment reflections specifically on the Celtic cross.
  // This lets you reduce the broad env glare on the flat wheel without darkening everything else.
  useEffect(() => {
    crossMaterialsRef.current.forEach((mat) => {
      if (mat) {
        (mat as any).envMapIntensity = lights.crossEnvMapIntensity ?? 0.9;
        if (lights.crossRoughness !== undefined) {
          (mat as any).roughness = lights.crossRoughness;
        }
        mat.needsUpdate = true;
      }
    });
  }, [lights.crossEnvMapIntensity, lights.crossRoughness]);

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

    const mat = t.material as any;
    // Safer settings for labels sitting on opaque geometry:
    // depthTest true + depthWrite false prevents both z-fighting (bold text)
    // and incorrect overlapping with other objects (e.g. Canon blocks).
    mat.depthTest = true;
    mat.depthWrite = false;
    t.renderOrder = 15; // Higher than wedges (0) and Canon blocks (10)
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
        color: 0x0a0a22, metalness: 0.45, roughness: 0.22,
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
        clearcoat: 0.8, clearcoatRoughness: 0.12, envMapIntensity: 0.95,
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
      clearcoat: 0.85, clearcoatRoughness: 0.1, envMapIntensity: 1.0,
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

    const glow = new THREE.PointLight(0xffd58a, 0.95, 60, 1.6);
    glow.position.set(0, 0, c.hDisc + c.hCross + 2);
    group.add(glow);
    centerGlowRef.current = glow;
    debug.centerGlowRef.current = glow;  // Expose to debug lighting panel for live control

    crossMaterialsRef.current.forEach(m => {
      (m.userData as any)['baseEmissive'] = (m as any).emissiveIntensity ?? 0.6; // material userData, not mesh
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
    group.add(makeBand(config.rCycle1 + 0.05, config.rLetter, config.hLetter, 0x0a0a22, { metalness: 0.35, roughness: 0.55 }));

    for (const book of BIBLE_BOOKS) {
      const spoke = ((book.position - 1) % 22) + 1;
      const cycle = Math.ceil(book.position / 22);
      addBookWedge(book, spoke, cycle, group);
    }

    hebrewRing.createHebrewRing(group, makeText);

    // Group wedges by spoke for spoke-hover highlighting
    const spokeWedges: THREE.Mesh[][] = Array.from({ length: 22 }, () => []);
    wedgeMeshesRef.current.forEach(mesh => {
      const data = mesh.userData as WedgeUserData | undefined;
      const spoke = data?.spoke;
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
      const data = cell?.userData as HebrewCellUserData | undefined;
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
          m.depthTest = true;
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
    scene.environmentIntensity = 1.0; // will be overridden by debug panel via useEffect below
    pmrem.dispose();

    gl.setClearColor(0x000000, 0);
    scene.fog = new THREE.Fog(0x0a0a14, 90, 220);

    // Ambient light is now also declarative below so we can control it from the debug panel
    // The three directional lights are rendered declaratively below
    // (controlled from the "View & Lighting" tab)

    // Start camera far away — entrance animation will dolly it in
    camera.position.set(0, -22, 265);
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

  // Lighting is fully managed by the useDebugLighting hook (declarative + imperative updates inside the provider).

  // Live rebuild of *only* the curved labels when spacing/size/offset/font changes in the panel.
  // This is surgical — we do NOT touch the 3D block meshes or book wedges.
  useEffect(() => {
    const group = wheelGroupRef.current;
    if (!group) return;

    // Remove only the old division label objects (Troika texts)
    divisionTransition.divisionLabelGroupsRef.current.forEach(labelGroup => {
      labelGroup.forEach(label => {
        if (label.parent) label.parent.remove(label);
        try { (label as any).dispose?.(); } catch {}
      });
    });
    divisionTransition.divisionLabelGroupsRef.current = [];

    // Clear label references from the division block meshes (for hover lift)
    divisionTransition.divisionBlockMeshesRef.current.forEach(mesh => {
      const data = (mesh.userData as LabelledMeshUserData) || {};
      data.labels = [];
      data.labelRestZ = [];
      mesh.userData = data as DivisionBlockUserData;
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

  // ==================== Animation Loop (encapsulated - Step 4) ====================

  useWheelAnimation({
    config,
    divisionMode,
    wheelGroupRef,
    crossMaterialsRef,
    centerGlowRef,
    wedgeMeshesRef,
    controlsRef,
    camera,
    divisionTransition,
    restingTiltX: lights.restingTiltX,
  });

  return (
    <>
      {/* Ambient and environment are controlled by the toggle for dramatic test */}
      <ambientLight 
        ref={debug.ambientLightRef}
        color={0x6a6da0} 
        intensity={finalAmbientIntensity} 
      />

      {/* The three directional lights are always present so their individual controls always work.
          The toggle only affects ambient + environment for a clear on/off visual test. */}
      <directionalLight
        ref={debug.keyLightRef}
        color={0xfff4d6}
        intensity={lights.key.intensity}
        position={[lights.key.x, lights.key.y, lights.key.z]}
      />
      <directionalLight
        ref={debug.fillLightRef}
        color={0x88a8ff}
        intensity={lights.fill.intensity}
        position={[lights.fill.x, lights.fill.y, lights.fill.z]}
      />
      <directionalLight
        ref={debug.rimLightRef}
        color={0xff9080}
        intensity={lights.rim.intensity}
        position={[lights.rim.x, lights.rim.y, lights.rim.z]}
      />

      {/* Light position helpers for debugging (dev only) */}
      {((import.meta as any).env?.MODE !== 'production') && debug.showLightHelpers && (
        <LightPositionHelpers lights={lights} />
      )}

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
