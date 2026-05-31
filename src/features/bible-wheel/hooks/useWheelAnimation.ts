import { useEffect, useCallback } from 'react';
import * as THREE from 'three';
import type { BibleWheelConfig } from '../bible-wheel.types';
import type { useDivisionTransition } from './useDivisionTransition';

interface UseWheelAnimationParams {
  config: BibleWheelConfig;
  divisionMode: boolean;

  wheelGroupRef: React.MutableRefObject<THREE.Group>;
  crossMaterialsRef: React.MutableRefObject<THREE.Material[]>;
  centerGlowRef: React.MutableRefObject<THREE.PointLight | null>;
  wedgeMeshesRef: React.MutableRefObject<THREE.Mesh[]>;
  controlsRef: React.MutableRefObject<any>;

  divisionTransition: ReturnType<typeof useDivisionTransition>;
}

export function useWheelAnimation(params: UseWheelAnimationParams) {
  const {
    config,
    divisionMode,
    wheelGroupRef,
    crossMaterialsRef,
    centerGlowRef,
    wedgeMeshesRef,
    controlsRef,
    divisionTransition,
  } = params;

  // Smoothstep helper (kept local to the animation for now)
  const smoothstep = useCallback((edge0: number, edge1: number, x: number) => {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }, []);

  useEffect(() => {
    let animationFrameId: number;

    const animate = () => {
      const group = wheelGroupRef.current;
      if (!group) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }

      const elapsed = performance.now() / 1000;

      // Entrance animation (softened for immediate visibility)
      const t = Math.min(1, elapsed / (config.entranceDuration ?? 1.4));
      const ease = 1 - Math.pow(1 - t, 3);
      group.rotation.x = (1 - ease) * -0.35;
      group.rotation.z = (1 - ease) * -0.25;
      const s = 0.85 + 0.15 * ease;
      group.scale.set(s, s, s);

      // Cross pulse
      const pulse = 0.85 + 0.15 * Math.sin(elapsed * (config.pulseFrequency ?? 1.6));
      crossMaterialsRef.current.forEach((m) => {
        const base = (m.userData as any)['baseEmissive'] ?? 0.6;
        (m as any).emissiveIntensity = base * pulse;
      });
      if (centerGlowRef.current) {
        centerGlowRef.current.intensity = 1.0 + 0.5 * pulse;
      }

      // Delegate Canon transition progress + block/label visuals
      const transitionState = divisionTransition.updateTransition(divisionMode);
      const p = 1 - Math.pow(1 - divisionTransition.transitionProgressRef.current, 3);

      const smallTextMult = 1 - smoothstep(0.22, 0.70, p);
      // bigTextMult is currently managed inside useDivisionTransition

      const wedgeOpacity = transitionState.wedgeOpacity;
      const isFullyBlocked = transitionState.isFullyBlocked;
      const wedgesVisible = !isFullyBlocked && wedgeOpacity > 0.01;

      wedgeMeshesRef.current.forEach((mesh) => {
        const mat = mesh.material as THREE.MeshPhysicalMaterial;
        mat.opacity = isFullyBlocked ? 0 : wedgeOpacity;
        mat.transparent = true;
        mesh.visible = wedgesVisible;

        const data = mesh.userData as any;

        if (data?.originalPosition) {
          mesh.position.copy(data.originalPosition as THREE.Vector3);
        }

        const smallLabelOpacity = wedgeOpacity * smallTextMult;

        if (data?.labels) {
          data.labels.forEach((label: any) => {
            if (label.material) {
              (label.material as any).transparent = true;
              (label.material as any).opacity = smallLabelOpacity;
              (label.material as any).needsUpdate = true;
            }
            label.sync();
          });
        }
      });

      // Division block/label fading is handled inside useDivisionTransition

      controlsRef.current?.update?.();
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [
    config,
    divisionMode,
    wheelGroupRef,
    crossMaterialsRef,
    centerGlowRef,
    wedgeMeshesRef,
    controlsRef,
    divisionTransition,
    smoothstep,
  ]);
}
