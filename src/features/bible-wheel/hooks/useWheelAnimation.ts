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

  // Live-adjustable artistic tilt applied when the entrance animation finishes
  restingTiltX: number;
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
    restingTiltX,
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
      // Camera starts far away and dollies in slowly.
      // The wheel spins on Z, does a Y-axis bounce (30° one way then back),
      // and rocks on X for shimmer.
      // In the final phase it smoothly settles into the artistic resting tilt
      // (controlled live in the View & Lighting panel) for a cool off-angle look.
      //
      // NOTE: OrbitControls are disabled during the entrance to prevent fighting
      // with the manual camera animation.
      const entranceDuration = config.entranceDuration ?? 5.8; // slower, more majestic
      const t = Math.min(1, elapsed / entranceDuration);
      const ease = 1 - Math.pow(1 - t, 3);

      const controls = controlsRef.current;

      if (t < 1) {
        // Disable controls during the cinematic entrance
        if (controls) controls.enabled = false;

        // Camera dolly from far away into final position
        const farZ = 340; // start even further for more drama
        const finalZ = 90;
        camera.position.z = farZ + (finalZ - farZ) * ease;
        camera.lookAt(0, 0, 6);

        // Subtle scale as it arrives
        const s = 0.88 + 0.12 * ease;
        group.scale.set(s, s, s);

        // === New cinematic entrance motion ===
        const spinEase = 1 - Math.pow(1 - t, 2.6);

        // Strong Z spin (like before)
        const numSpins = 3.1;
        const spin = (1 - spinEase) * numSpins * Math.PI * 2;
        group.rotation.z = spin;

        // Y-axis bounce (rotation around vertical axis).
        // The wheel swings ~30-35° one direction on Y, then back the other way.
        // Large Y rotation would eventually show the back of the wheel.
        const yBounceAmplitude = Math.PI / 6 * 1.15; // ~35° peak swing for visibility
        const yBounce = Math.sin(t * Math.PI * 2.0) * yBounceAmplitude * Math.pow(1 - t, 0.65);

        // X motion: dramatic rocking early, then smoothly settle into the final resting tilt
        const tiltAmplitude = (1 - ease) * 0.38;
        const rock = Math.sin(t * Math.PI * 3.1) * tiltAmplitude;

        const finalTilt = restingTiltX ?? -0.12;

        // In the last 45% of the animation, blend toward the final artistic tilt
        const settleStart = 0.55;
        let settleFactor = 0;
        if (t > settleStart) {
          settleFactor = (t - settleStart) / (1 - settleStart);
          settleFactor = Math.pow(settleFactor, 1.8); // nice easing into final pose
        }

        group.rotation.x = rock * (1 - settleFactor) + finalTilt * settleFactor;
        group.rotation.y = yBounce * (1 - settleFactor);   // Y bounce eases out as we settle into final off-angle pose

      } else {
        // Entrance finished — hand control back to OrbitControls
        if (controls && !controls.enabled) {
          controls.enabled = true;
          controls.update?.();
        }

        // Final settled orientation (uses live value from the View & Lighting panel)
        group.rotation.x = restingTiltX ?? -0.12;
        group.rotation.y = 0.08; // subtle final Y angle for better off-angle composition
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
        const base = (centerGlowRef.current.userData as any).baseIntensity ?? 0.95;
        centerGlowRef.current.intensity = base * (0.8 + 0.2 * pulse);
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
              const m = label.material as any;
              m.transparent = true;
              m.opacity = smallLabelOpacity;
              m.depthTest = true;
              m.depthWrite = false;
              m.needsUpdate = true;
            }
            label.renderOrder = 15;
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
