import { useRef, useMemo, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import type { BibleWheelConfig, HebrewCellUserData, WedgeUserData, LabelledMeshUserData } from '../bible-wheel.types';
import type { useHebrewRing } from './useHebrewRing';
import type { useDivisionTransition } from './useDivisionTransition';

interface UseWheelInteractionParams {
  gl: THREE.WebGLRenderer;
  camera: THREE.Camera;
  divisionMode: boolean;
  config: BibleWheelConfig;
  onWedgeClick: (data: WedgeUserData) => void;

  // Refs needed for hover behavior
  wedgeMeshesRef: React.MutableRefObject<THREE.Mesh[]>;
  wedgeRestZRef: React.MutableRefObject<Map<THREE.Mesh, number>>;

  // Already-encapsulated subsystems
  hebrewRing: ReturnType<typeof useHebrewRing>;
  divisionTransition: ReturnType<typeof useDivisionTransition>;

  /** Called when the user double-clicks empty scene area (no wedge/cell hit). */
  onEmptyDoubleClick?: () => void;

  /** From R3F useThree(). Required with frameloop="demand" so hover changes cause a render. */
  invalidate?: () => void;
}

export function useWheelInteraction(params: UseWheelInteractionParams) {
  const {
    gl,
    camera,
    divisionMode,
    config,
    onWedgeClick,
    wedgeMeshesRef,
    wedgeRestZRef,
    hebrewRing,
    divisionTransition,
    onEmptyDoubleClick,
    invalidate,
  } = params;

  const hoveredRef = useRef<THREE.Mesh | null>(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const pointer = useMemo(() => new THREE.Vector2(), []);

  const getCurrentTargets = useCallback((): THREE.Object3D[] => {
    if (divisionMode) {
      return divisionTransition.divisionBlockMeshesRef.current;
    }

    // Normal mode: book wedges + Hebrew cells
    const targets: THREE.Object3D[] = [...wedgeMeshesRef.current];
    hebrewRing.hebrewCellMeshesRef.current.forEach((cell) =>
      targets.push(cell)
    );
    return targets;
  }, [divisionMode, divisionTransition, wedgeMeshesRef, hebrewRing]);

  const updatePointer = useCallback(
    (event: MouseEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    },
    [gl, pointer]
  );

  const pickObject = useCallback((): THREE.Object3D | null => {
    raycaster.setFromCamera(pointer, camera);
    const targets = getCurrentTargets();
    if (targets.length === 0) return null;
    const hits = raycaster.intersectObjects(targets, false);
    return hits.length > 0 ? hits[0].object : null;
  }, [raycaster, pointer, camera, getCurrentTargets]);

  const setMeshHover = useCallback(
    (mesh: THREE.Mesh | null, hovered: boolean) => {
      if (!mesh) return;

      const liftAmount = config.hoverLiftZ ?? 1.2;

      // Cycle 3 (inner) is the tallest ring and abuts the empty center, so a full-height lift
      // reveals its inner side-wall and exaggerates perspective magnification — reading as the
      // cell expanding toward the center rather than simply rising. Use a gentler lift there.
      const cycle = (mesh.userData as { cycle?: number } | undefined)?.cycle;
      const effectiveLift = cycle === 3 ? liftAmount * 0.6 : liftAmount;
      const lift = hovered ? effectiveLift : 0;

      const rest = wedgeRestZRef.current.get(mesh) ?? 0;
      mesh.position.z = rest + lift;

      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat) {
        (mat as any).emissiveIntensity = hovered ? 0.55 : 0.04;
      }

      // Lift any attached labels (works for both wedges and division blocks)
      const data = mesh.userData as LabelledMeshUserData | undefined;
      if (data?.labels && data?.labelRestZ) {
        for (let i = 0; i < data.labels.length; i++) {
          data.labels[i].position.z = data.labelRestZ[i] + lift;
        }
      }
    },
    [config.hoverLiftZ, wedgeRestZRef]
  );

  // Main pointer interaction effect
  useEffect(() => {
    const dom = gl.domElement;
    if (!dom) return;

    const onPointerMove = (e: MouseEvent) => {
      updatePointer(e);
      const hit = pickObject();

      // Hebrew spoke hover (only in normal mode)
      let hitSpoke: number | null = null;
      if (hit && !divisionMode) {
        for (let i = 0; i < hebrewRing.hebrewCellMeshesRef.current.length; i++) {
          const cell = hebrewRing.hebrewCellMeshesRef.current[i];
          if (cell === hit) {
            const data = cell.userData as HebrewCellUserData | undefined;
            hitSpoke = data?.spoke ?? (i + 1);
            break;
          }
        }
      }

      if (hitSpoke !== null) {
        if (hebrewRing.currentHebrewSpokeRef.current === hitSpoke) return;

        if (hoveredRef.current) {
          setMeshHover(hoveredRef.current, false);
          hoveredRef.current = null;
        }

        hebrewRing.setSpokeHover(hitSpoke);
        dom.style.cursor = 'pointer';
        invalidate?.();
        return;
      }

      // Clear Hebrew spoke if we were previously hovering one
      if (hitSpoke === null && hebrewRing.currentHebrewSpokeRef.current !== null) {
        hebrewRing.setSpokeHover(null);
      }

      const mesh = hit && 'isMesh' in hit ? (hit as THREE.Mesh) : null;

      if (mesh === hoveredRef.current) return;

      if (hoveredRef.current) {
        setMeshHover(hoveredRef.current, false);
      }

      hoveredRef.current = mesh;

      if (mesh) {
        setMeshHover(mesh, true);
        dom.style.cursor = 'pointer';
      } else {
        dom.style.cursor = 'default';
      }
      invalidate?.();
    };

    const onClick = (e: MouseEvent) => {
      updatePointer(e);
      const hit = pickObject();

      if (hit && 'isMesh' in hit) {
        const data = (hit as THREE.Mesh).userData as WedgeUserData;
        if (data?.book) {
          onWedgeClick(data);
        }
      }
    };

    const onDoubleClick = (e: MouseEvent) => {
      updatePointer(e);
      // Only treat double-clicks on empty space (no wedge/cell) as a view reset.
      if (pickObject() === null) onEmptyDoubleClick?.();
    };

    const onPointerLeave = () => {
      if (hoveredRef.current) {
        setMeshHover(hoveredRef.current, false);
        hoveredRef.current = null;
      }
      if (hebrewRing.currentHebrewSpokeRef.current !== null) {
        hebrewRing.setSpokeHover(null);
      }
      dom.style.cursor = 'default';
      invalidate?.();
    };

    dom.addEventListener('mousemove', onPointerMove);
    dom.addEventListener('click', onClick);
    dom.addEventListener('dblclick', onDoubleClick);
    dom.addEventListener('mouseleave', onPointerLeave);

    return () => {
      dom.removeEventListener('mousemove', onPointerMove);
      dom.removeEventListener('click', onClick);
      dom.removeEventListener('dblclick', onDoubleClick);
      dom.removeEventListener('mouseleave', onPointerLeave);

      if (hoveredRef.current) {
        setMeshHover(hoveredRef.current, false);
        hoveredRef.current = null;
      }
      dom.style.cursor = 'default';
    };
  }, [
    gl,
    camera,
    divisionMode,
    config.hoverLiftZ,
    onWedgeClick,
    wedgeRestZRef,
    hebrewRing,
    divisionTransition,
    updatePointer,
    pickObject,
    setMeshHover,
    onEmptyDoubleClick,
    invalidate,
  ]);

  // Expose internal state if the parent ever needs it (currently not required)
  return {
    hoveredRef,
  };
}
