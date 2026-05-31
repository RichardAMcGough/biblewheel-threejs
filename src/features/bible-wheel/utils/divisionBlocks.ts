import * as THREE from 'three';
import type { BibleWheelConfig, DivisionKey, DivisionBlockUserData } from '../bible-wheel.types';
import {
  wedgeTheta,
  cycleRadii,
  cycleHeight,
  makeWedgeShape,
} from './wheelGeometry';
import { BIBLE_BOOKS } from '../bible-data';
import { DIVISIONS, hexToInt } from '../bible-wheel.types';

/**
 * Creates the large "Canon" division block meshes (the big colored wedges that appear in Division mode).
 */
export function createDivisionBlockMeshes(
  group: THREE.Group,
  config: BibleWheelConfig,
  divisionColors: Record<DivisionKey, string>,
  divisionBlockMeshesRef: React.MutableRefObject<THREE.Mesh[]>,
  wedgeRestZRef?: React.MutableRefObject<Map<THREE.Mesh, number>>
): void {
  divisionBlockMeshesRef.current = [];

  for (const division of DIVISIONS) {
    const booksInDiv = BIBLE_BOOKS.filter((b: any) => division.contains(b.position));
    if (booksInDiv.length === 0) continue;

    const cycle = Math.ceil(booksInDiv[0].position / 22);
    const firstSpoke = ((booksInDiv[0].position - 1) % 22) + 1;
    const lastSpoke = ((booksInDiv[booksInDiv.length - 1].position - 1) % 22) + 1;

    const { start: thetaStart } = wedgeTheta(firstSpoke);
    const { start: thetaEnd, length } = wedgeTheta(lastSpoke);
    const endAngle = thetaEnd + length;

    const radii = cycleRadii(cycle, config);
    const depth = cycleHeight(cycle, config);

    const inset = 0.12;
    const shape = makeWedgeShape(
      radii.inner + inset,
      radii.outer - inset,
      thetaStart + inset / radii.outer,
      endAngle - inset / radii.outer
    );

    const bevel = Math.min(0.5, depth * 0.3);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 4,
      curveSegments: 24,
    });

    const baseColor = hexToInt(divisionColors[division.key]);

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
      opacity: 0,
    });

    const blockMesh = new THREE.Mesh(geo, mat);
    blockMesh.visible = false;
    blockMesh.renderOrder = 10;
    // Seed typed userData so label attachment (in divisionLabels) and hover lift never need `as any`
    blockMesh.userData = { labels: [], labelRestZ: [] } as DivisionBlockUserData;
    group.add(blockMesh);
    divisionBlockMeshesRef.current.push(blockMesh);

    if (wedgeRestZRef) {
      wedgeRestZRef.current.set(blockMesh, 0);
    }
  }
}
