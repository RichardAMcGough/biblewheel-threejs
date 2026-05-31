import * as THREE from 'three';
import { Text as TroikaText } from 'troika-three-text';
import type { BibleWheelConfig, HebrewCellUserData } from '../bible-wheel.types';
import {
  spokeCenterAngle,
  wedgeTheta,
  makeWedgeShape,
} from './wheelGeometry';
import { HEBREW_LETTERS } from '../bible-wheel.types';
import { configureTroikaLabelOverlay } from './createCurvedText';

/**
 * Creates the 22 beveled Hebrew letter cells + their Troika labels.
 * 
 * This system is responsible for the outer alphabet ring and the spoke-hover
 * highlighting interaction (depressing a letter cell and lifting the three books
 * on that spoke).
 *
 * Keeping this logic isolated makes the main scene file much easier to maintain.
 */

export interface HebrewRingRefs {
  cellMeshes: React.MutableRefObject<THREE.Mesh[]>;
  labelPairs: React.MutableRefObject<TroikaText[][]>;
}

export interface CreateHebrewCellsOptions {
  config: BibleWheelConfig;
  makeText: (opts: {
    text: string;
    font: 'hebrew' | 'english';
    fontSize: number;
    color: number;
    x: number;
    y: number;
    z?: number;
    rotation: number;
  }) => TroikaText;
}

/**
 * Creates the Hebrew alphabet ring cells and attaches labels.
 * The caller is responsible for providing the necessary refs and the makeText helper.
 */
export function createHebrewCells(
  group: THREE.Group,
  refs: HebrewRingRefs,
  options: CreateHebrewCellsOptions
): void {
  const { config, makeText } = options;
  const { cellMeshes, labelPairs } = refs;

  cellMeshes.current = [];
  labelPairs.current = [];

  // Place the Hebrew letter cells in the band immediately outside the gold containing ring
  const goldRingOuter = config.rCycle1 + 0.78;
  const cellInner = goldRingOuter + 0.25;   // small clean gap / separation
  const cellHeight = 1.1;

  // Match book wedge bevel style + small inset so each letter cell has fully
  // visible chamfered edges on all four sides.
  const bevel = Math.min(0.5, cellHeight * 0.3);
  const inset = 0.10;
  const cellOuter = config.rLetter - (bevel + 0.12); // prevent overlap with outer gold rim

  for (let i = 0; i < 22; i++) {
    const spoke = i + 1;
    const { start, length } = wedgeTheta(spoke);

    const shape = makeWedgeShape(
      cellInner + inset,
      cellOuter - inset,
      start + inset / cellOuter,
      start + length - inset / cellOuter,
    );

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: cellHeight,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 4,
      curveSegments: 18,
    });

    const mat = new THREE.MeshPhysicalMaterial({
      color: 0x252550,
      metalness: 0.4,
      roughness: 0.5,
      clearcoat: 0.35,
      clearcoatRoughness: 0.25,
      envMapIntensity: 0.9,
    });

    const cell = new THREE.Mesh(geo, mat);
    cell.position.z = 2.1;

    group.add(cell);
    cellMeshes.current.push(cell);

    // Create the two labels
    const angle = spokeCenterAngle(spoke);
    const letter = HEBREW_LETTERS[i];
    const rotation = angle - Math.PI / 2;

    const labelZ = cell.position.z + 0.85;
    const bandMid = (cellInner + cellOuter) / 2;

    // Name position is intentionally kept closer to the inner edge of the band.
    const nameRadius = bandMid - 1.0;

    // Glyphs are placed midway between the name and the outer gold ring
    // so they no longer overlap the names.
    const glyphRadius = (nameRadius + cellOuter) / 2;

    const glyph = makeText({
      text: letter.glyph,
      font: 'hebrew',
      fontSize: 2.9,
      color: 0xf5e9b0,
      x: glyphRadius * Math.cos(angle),
      y: glyphRadius * Math.sin(angle),
      z: labelZ,
      rotation,
    });
    group.add(glyph);

    const nameLabel = makeText({
      text: letter.name,
      font: 'english',
      fontSize: 1.2,
      color: 0xd4b85a,
      x: nameRadius * Math.cos(angle),
      y: nameRadius * Math.sin(angle),
      z: labelZ,
      rotation,
    });
    group.add(nameLabel);

    // Make Hebrew labels always render on top of nearby gold ring geometry
    [glyph, nameLabel].forEach((label) => {
      configureTroikaLabelOverlay(label, 50);
    });

    labelPairs.current[i] = [glyph, nameLabel];

    // Attach labels to cell userData so hover logic can move them together
    cell.userData = {
      spoke,
      type: 'hebrewCell',
      labels: [glyph, nameLabel],
      labelRestZ: [labelZ, labelZ],
      cellRestZ: 2.1,
    } as HebrewCellUserData;
  }
}
