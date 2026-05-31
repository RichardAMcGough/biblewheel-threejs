import * as THREE from 'three';
import type { BibleWheelConfig } from '../bible-wheel.types';

/** CCW from 12 o'clock; spoke 1 (Aleph) sits at upper-left of the rim. */
export function spokeCenterAngle(spoke: number): number {
  const wedge = (Math.PI * 2) / 22;
  return Math.PI / 2 + wedge * (spoke - 0.5);
}

export function wedgeTheta(spoke: number) {
  const wedge = (Math.PI * 2) / 22;
  const center = spokeCenterAngle(spoke);
  return { start: center - wedge / 2, length: wedge };
}

export function cycleRadii(cycle: number, config: BibleWheelConfig) {
  switch (cycle) {
    case 1: return { inner: config.rCycle2, outer: config.rCycle1 };
    case 2: return { inner: config.rCycle3, outer: config.rCycle2 };
    case 3: return { inner: config.rCenter, outer: config.rCycle3 };
    default: throw new Error(`Invalid cycle ${cycle}`);
  }
}

export function cycleHeight(cycle: number, config: BibleWheelConfig) {
  switch (cycle) {
    case 1: return config.hCycle1;
    case 2: return config.hCycle2;
    case 3: return config.hCycle3;
    default: throw new Error(`Invalid cycle ${cycle}`);
  }
}

/** Build a flat annulus Shape from `inner` to `outer` covering the full circle. */
export function makeAnnulusShape(inner: number, outer: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
  if (inner > 0) {
    const hole = new THREE.Path();
    hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  return shape;
}

/** Build a wedge Shape (slice of an annulus) between two angles. */
export function makeWedgeShape(
  inner: number,
  outer: number,
  thetaStart: number,
  thetaEnd: number
): THREE.Shape {
  const shape = new THREE.Shape();
  const x0 = outer * Math.cos(thetaStart);
  const y0 = outer * Math.sin(thetaStart);
  shape.moveTo(x0, y0);
  shape.absarc(0, 0, outer, thetaStart, thetaEnd, false);
  shape.lineTo(inner * Math.cos(thetaEnd), inner * Math.sin(thetaEnd));
  shape.absarc(0, 0, inner, thetaEnd, thetaStart, true);
  shape.lineTo(x0, y0);
  return shape;
}

/** Extrude a full ring band (or disc when inner=0) to `depth` with a soft bevel. */
export function makeBand(
  inner: number,
  outer: number,
  depth: number,
  color: number,
  pbr: { metalness?: number; roughness?: number; emissive?: number; emissiveIntensity?: number } = {},
): THREE.Mesh {
  const shape = makeAnnulusShape(inner, outer);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.15,
    bevelSize: 0.15,
    bevelSegments: 2,
    curveSegments: 96,
  });
  const mat = new THREE.MeshStandardMaterial({
    color,
    metalness: pbr.metalness ?? 0.2,
    roughness: pbr.roughness ?? 0.55,
    emissive: pbr.emissive ?? 0x000000,
    emissiveIntensity: pbr.emissiveIntensity ?? 0,
    side: THREE.FrontSide,
  });
  return new THREE.Mesh(geo, mat);
}

/** Create spoke divider lines along the top surfaces. */
export function makeSpokeLines(config: BibleWheelConfig): THREE.LineSegments {
  const pts: number[] = [];
  for (let i = 0; i < 22; i++) {
    const a = spokeCenterAngle(i + 0.5);
    const cos = Math.cos(a), sin = Math.sin(a);
    const segments: Array<[number, number, number]> = [
      [config.rCycle3, config.rCenter, config.hCycle3 + 0.06],
      [config.rCycle2, config.rCycle3, config.hCycle2 + 0.06],
      [config.rCycle1, config.rCycle2, config.hCycle1 + 0.06],
      [config.rLetter, config.rCycle1, config.hLetter + 0.06],
    ];
    for (const [r1, r2, z] of segments) {
      pts.push(r1 * cos, r1 * sin, z);
      pts.push(r2 * cos, r2 * sin, z);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const mat = new THREE.LineBasicMaterial({
    color: 0xfff3c4, transparent: true, opacity: 0.55,
  });
  return new THREE.LineSegments(geo, mat);
}
