import { useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { Text as TroikaText } from 'troika-three-text';
import type { BibleWheelConfig, DivisionLabelStyles, DivisionKey } from '../bible-wheel.types';
import { createDivisionBlockMeshes as createDivisionBlockMeshesImpl } from '../utils/divisionBlocks';
import { createDivisionLabels as createDivisionLabelsImpl } from '../utils/divisionLabels';
import { configureTroikaLabelOverlay } from '../utils/createCurvedText';
// Pure creation logic lives in utils/ (no scene coupling)

/**
 * useDivisionTransition
 *
 * Encapsulates the Canon Wheel (Division/Block mode) transition system.
 * 
 * Responsibilities:
 * - Creation of division block meshes and curved labels
 * - Managing the cross-fade progress when switching between Bible Wheel and Canon modes
 * - Smooth opacity transitions + z-fighting mitigation for overlapping transparent text
 * - Surgical rebuild of labels when style settings change
 *
 * This is Step 2 of the incremental refactoring.
 */

export interface UseDivisionTransitionOptions {
  config: BibleWheelConfig;
  divisionMode: boolean;
  divisionLabelStyles: DivisionLabelStyles;
  divisionColors: Record<DivisionKey, string>;
  wedgeRestZRef: React.MutableRefObject<Map<THREE.Mesh, number>>;
}

export interface DivisionTransitionApi {
  divisionBlockMeshesRef: React.MutableRefObject<THREE.Mesh[]>;
  divisionLabelGroupsRef: React.MutableRefObject<TroikaText[][]>;
  transitionProgressRef: React.MutableRefObject<number>;

  createDivisionBlockMeshes: (group: THREE.Group) => void;
  createDivisionLabels: (
    group: THREE.Group, 
    styles: any, 
    divisionDisplay?: Record<any, { label: string; canonLabel?: string | string[] }>,
    divisionBlockMeshesRef?: React.MutableRefObject<THREE.Mesh[]>
  ) => void;
  forceShowAllDivisionLabels: () => void;

  // Called from the main animation loop
  updateTransition: (divisionMode: boolean) => {
    wedgeOpacity: number;
    blockOpacity: number;
    blocksVisible: boolean;
    isFullyBlocked: boolean;
  };
}

export function useDivisionTransition(options: UseDivisionTransitionOptions): DivisionTransitionApi {
  const { config, divisionMode, divisionLabelStyles: _divisionLabelStyles, divisionColors, wedgeRestZRef } = options;

  const divisionBlockMeshesRef = useRef<THREE.Mesh[]>([]);
  const divisionLabelGroupsRef = useRef<TroikaText[][]>([]);
  const transitionProgressRef = useRef(0);
  const prevDivisionModeRef = useRef(divisionMode);

  const createDivisionBlockMeshes = useCallback((group: THREE.Group) => {
    createDivisionBlockMeshesImpl(
      group,
      config,
      divisionColors,
      divisionBlockMeshesRef,
      wedgeRestZRef
    );
  }, [config, divisionColors, wedgeRestZRef]);

  const createDivisionLabels = useCallback((
    group: THREE.Group, 
    styles: any, 
    divisionDisplay?: Record<any, { label: string; canonLabel?: string | string[] }>,
    blocksRef?: React.MutableRefObject<THREE.Mesh[]>
  ) => {
    createDivisionLabelsImpl(
      group,
      config,
      styles,
      divisionLabelGroupsRef,
      divisionDisplay,
      blocksRef
    );
  }, [config]);

  const forceShowAllDivisionLabels = useCallback(() => {
    divisionLabelGroupsRef.current.forEach(group => {
      group.forEach(charLabel => {
        charLabel.visible = true;
        configureTroikaLabelOverlay(charLabel, 100);
        charLabel.sync();
        requestAnimationFrame(() => charLabel.sync());
        setTimeout(() => charLabel.sync(), 50);
      });
    });
  }, []);

  // Advance transition progress and return the current visual state for the animation loop
  const updateTransition = useCallback((currentDivisionMode: boolean) => {
    const target = currentDivisionMode ? 1 : 0;
    const speed = 2.2 * (1 / 60);

    if (transitionProgressRef.current !== target) {
      if (transitionProgressRef.current < target) {
        transitionProgressRef.current = Math.min(1, transitionProgressRef.current + speed);
      } else {
        transitionProgressRef.current = Math.max(0, transitionProgressRef.current - speed);
      }
    }

    const easedP = 1 - Math.pow(1 - transitionProgressRef.current, 3);

    const wedgeOpacity = 1 - easedP;
    const isFullyBlocked = currentDivisionMode && easedP >= 0.95;
    const blocksVisible = easedP > 0.01;
    const blockOpacity = easedP;

    // Apply division block and label visuals
    divisionBlockMeshesRef.current.forEach((block, i) => {
      block.visible = blocksVisible;
      block.renderOrder = 10;
      const mat = block.material as THREE.MeshPhysicalMaterial;
      mat.opacity = blockOpacity;
      mat.transparent = blockOpacity < 0.99;

      // Critical z-fighting mitigation ONLY during the actual cross-fade overlap.
      // Once fully in or out of division mode, do NOT touch block.position.z here —
      // hover lifting (setMeshHover) is responsible for moving the blocks and their labels.
      if (wedgeOpacity > 0.01 && blockOpacity > 0.01) {
        block.position.z = 0.05;
      }
      // else: leave block.position.z alone so hover can lift the divs freely

      const labels = divisionLabelGroupsRef.current[i] || [];
      const force = easedP >= 0.95;
      const bigLabelOpacity = easedP;

      labels.forEach(label => {
        const finalVis = force || bigLabelOpacity > 0.01;
        label.visible = finalVis;
        label.renderOrder = force ? 100 : 20;

        if (label.material) {
          const m = label.material as any;
          m.transparent = true;
          m.opacity = force ? 1 : bigLabelOpacity;
          m.depthTest = false;
          m.depthWrite = false;
          m.needsUpdate = true;
        }
        if (force || bigLabelOpacity > 0.01) label.sync();
      });
    });

    return {
      wedgeOpacity,
      blockOpacity,
      blocksVisible,
      isFullyBlocked,
      p: easedP,
    };
  }, []);

  // React to divisionMode changes
  useEffect(() => {
    if (prevDivisionModeRef.current === divisionMode) return;
    prevDivisionModeRef.current = divisionMode;

    if (divisionMode) {
      forceShowAllDivisionLabels();
      setTimeout(forceShowAllDivisionLabels, 600);
      setTimeout(forceShowAllDivisionLabels, 1200);
    }
  }, [divisionMode, forceShowAllDivisionLabels]);

  return {
    divisionBlockMeshesRef,
    divisionLabelGroupsRef,
    transitionProgressRef,
    createDivisionBlockMeshes,
    createDivisionLabels,
    forceShowAllDivisionLabels,
    updateTransition,
  };
}
