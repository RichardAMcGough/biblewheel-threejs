import { useEffect, useCallback } from 'react';
import * as THREE from 'three';
import type { BibleWheelConfig, WedgeUserData } from '../bible-wheel.types';
import type { useDivisionTransition } from './useDivisionTransition';

interface UseWheelAnimationParams {
  config: BibleWheelConfig;
  divisionMode: boolean;

  wheelGroupRef: React.MutableRefObject<THREE.Group>;
  crossMaterialsRef: React.MutableRefObject<THREE.Material[]>;
  centerGlowRef: React.MutableRefObject<THREE.PointLight | null>;
  wedgeMeshesRef: React.MutableRefObject<THREE.Mesh[]>;
  controlsRef: React.MutableRefObject<any>;
  camera: THREE.Camera;

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
    camera,
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

      // ==================== Dramatic Entrance ====================
      // Camera starts far away and dollies in.
      // The wheel spins and tilts back and forth so the metallic/clearcoat surfaces
      // catch the lights and shimmer nicely as it approaches.
      // At the end it settles perfectly straight on (no tilt).
      //
      // NOTE: OrbitControls are disabled during the entrance to prevent fighting
      // with the manual camera animation (this was causing the "shiver" on zoom).
      const entranceDuration = config.entranceDuration ?? 3.8; // slower, more majestic
      const t = Math.min(1, elapsed / entranceDuration);
      const ease = 1 - Math.pow(1 - t, 3);

      const controls = controlsRef.current;

      if (t < 1) {
        // Disable controls during the cinematic entrance
        if (controls) controls.enabled = false;

        // Camera dolly from far away into final position
        const farZ = 265;
        const finalZ = 90;
        camera.position.z = farZ + (finalZ - farZ) * ease;
        camera.lookAt(0, 0, 6);

        // Subtle scale as it arrives
        const s = 0.88 + 0.12 * ease;
        group.scale.set(s, s, s);

        // Spinning (settles to straight orientation)
        const numSpins = 2.6;
        const spinEase = 1 - Math.pow(1 - t, 2.6);
        const spin = (1 - spinEase) * numSpins * Math.PI * 2;
        group.rotation.z = spin;

        // Tilting back and forth during approach for light shimmer
        const tiltAmplitude = (1 - ease) * 0.32;
        const rock = Math.sin(t * Math.PI * 2.8) * tiltAmplitude;
        group.rotation.x = rock;

      } else {
        // Entrance finished — hand control back to OrbitControls
        if (controls && !controls.enabled) {
          controls.enabled = true;
          controls.update?.();
        }

        // Lock final clean orientation (straight on, no tilt)
        group.rotation.x = 0;
        group.rotation.z = 0;
        group.scale.set(1, 1, 1);
      }

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

        const data = mesh.userData as WedgeUserData | undefined;

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
