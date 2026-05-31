import { useRef, useCallback } from 'react';
import * as THREE from 'three';
import { Text as TroikaText } from 'troika-three-text';
import type { BibleWheelConfig } from '../bible-wheel.types';
import { createHebrewCells } from '../utils/hebrewRing';

/**
 * useHebrewRing
 *
 * Encapsulates the outer Hebrew alphabet ring:
 * - Creation of the 22 beveled letter cells + labels
 * - Spoke-hover highlighting interaction (depress letter cell + lift the 3 books on that spoke)
 *
 * This is Step 1 of the incremental refactoring of BibleWheelScene.tsx.
 */

export interface UseHebrewRingOptions {
  config: BibleWheelConfig;
  divisionMode: boolean;
  wedgeRestZRef: React.MutableRefObject<Map<THREE.Mesh, number>>;
  spokeWedgesRef: React.MutableRefObject<THREE.Mesh[][]>;
}

export interface HebrewRingApi {
  hebrewCellMeshesRef: React.MutableRefObject<THREE.Mesh[]>;
  hebrewLabelPairsRef: React.MutableRefObject<TroikaText[][]>;
  currentHebrewSpokeRef: React.MutableRefObject<number | null>;

  createHebrewRing: (group: THREE.Group, makeText: any) => void;
  setSpokeHover: (spoke: number | null) => void;
}

export function useHebrewRing(options: UseHebrewRingOptions): HebrewRingApi {
  const { config, wedgeRestZRef, spokeWedgesRef } = options;

  // === Hebrew ring refs ===
  const hebrewCellMeshesRef = useRef<THREE.Mesh[]>([]);
  const hebrewLabelPairsRef = useRef<TroikaText[][]>([]);
  const currentHebrewSpokeRef = useRef<number | null>(null);

  // We still rely on the caller's spokeWedgesRef for lifting book wedges on a spoke.
  // This is acceptable during incremental extraction.

  const createHebrewRing = useCallback((group: THREE.Group, makeText: any) => {
    createHebrewCells(group, {
      cellMeshes: hebrewCellMeshesRef,
      labelPairs: hebrewLabelPairsRef,
    }, {
      config,
      makeText,
    });
  }, [config]);

  // Spoke highlighting via the outer Hebrew ring
  const setSpokeHover = useCallback((spoke: number | null) => {
    const prevSpoke = currentHebrewSpokeRef.current;
    const liftAmount = config.hoverLiftZ ?? 1.2;

    // Restore previous spoke
    if (prevSpoke !== null) {
      // Restore Hebrew cell
      const prevCell = hebrewCellMeshesRef.current[prevSpoke - 1];
      if (prevCell) {
        const restZ = (prevCell.userData as any)?.cellRestZ ?? 2.1;
        prevCell.position.z = restZ;
      }

      // Restore Hebrew letters
      const prevPair = hebrewLabelPairsRef.current[prevSpoke - 1];
      const prevCellForLabels = hebrewCellMeshesRef.current[prevSpoke - 1];
      if (prevPair && prevCellForLabels) {
        const data = prevCellForLabels.userData as any;
        const cellRest = data?.cellRestZ ?? 2.1;
        const delta = prevCellForLabels.position.z - cellRest;
        const labelRests: number[] = data?.labelRestZ ?? [2.95, 2.95];
        prevPair.forEach((label, i) => {
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
      }

      // Restore the three wedges on that spoke
      const prevWedges = spokeWedgesRef.current[prevSpoke - 1] || [];
      prevWedges.forEach(wedge => {
        const rest = wedgeRestZRef.current.get(wedge) ?? 0;
        wedge.position.z = rest;
        const mat = wedge.material as any;
        if (mat) mat.emissiveIntensity = 0.04;

        const wData = wedge.userData as any;
        if (wData?.labels && wData.labelRestZ) {
          wData.labels.forEach((l: any, i: number) => {
            l.position.z = (wData.labelRestZ[i] ?? 0) + rest;
          });
        }
      });
    }

    currentHebrewSpokeRef.current = spoke;

    if (spoke === null) return;

    // Lower the Hebrew cell
    const cell = hebrewCellMeshesRef.current[spoke - 1];
    if (cell) {
      cell.position.z = 0.9;
    }

    // Move the letters with the cell
    const pair = hebrewLabelPairsRef.current[spoke - 1];
    const cellForLabels = hebrewCellMeshesRef.current[spoke - 1];
    if (pair && cellForLabels) {
      const data = cellForLabels.userData as any;
      const cellRest = data?.cellRestZ ?? 2.1;
      const delta = cellForLabels.position.z - cellRest;
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
    }

    // Lift the three wedges on this spoke + their labels
    const wedges = spokeWedgesRef.current[spoke - 1] || [];
    wedges.forEach(wedge => {
      const rest = wedgeRestZRef.current.get(wedge) ?? 0;
      wedge.position.z = rest + liftAmount;

      const mat = wedge.material as any;
      if (mat) mat.emissiveIntensity = 0.55;

      const wData = wedge.userData as any;
      if (wData?.labels && wData.labelRestZ) {
        wData.labels.forEach((l: any, i: number) => {
          l.position.z = (wData.labelRestZ[i] ?? 0) + rest + liftAmount;
        });
      }
    });
  }, [config, wedgeRestZRef, spokeWedgesRef]);

  return {
    hebrewCellMeshesRef,
    hebrewLabelPairsRef,
    currentHebrewSpokeRef,
    createHebrewRing,
    setSpokeHover,
  };
}
