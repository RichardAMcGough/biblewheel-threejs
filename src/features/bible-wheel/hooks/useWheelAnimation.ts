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

  /** From R3F useThree(). Call this after mutating the scene so demand-mode Canvas will render. */
  invalidate?: () => void;
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
    invalidate,
  } = params;

  // Smoothstep helper (kept local to the animation for now)
  const smoothstep = useCallback((edge0: number, edge1: number, x: number) => {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }, []);

  useEffect(() => {
    let animationFrameId: number;

    // Captured so the effect teardown can detach the OrbitControls 'change' listener.
    // (Without this, every effect re-run would add another listener and never remove it.)
    let controlsWithListener: any = null;
    const onControlsChange = () => invalidate?.();

    // Track whether the entrance has fully completed at least once.
    // After this we only keep the RAF alive while a division transition is in flight.
    const entranceDuration = config.entranceDuration ?? 5.8;

    const animate = () => {
      const group = wheelGroupRef.current;
      if (!group) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }

      const controls = controlsRef.current;

      // One-time wiring so that OrbitControls (with damping) keeps requesting renders
      // when the user is dragging or damping is still settling the camera.
      if (controls && !controlsWithListener) {
        controlsWithListener = controls;
        controls.addEventListener?.('change', onControlsChange);
      }

      const elapsed = performance.now() / 1000;

      // ==================== Dramatic Entrance ====================
      const t = Math.min(1, elapsed / entranceDuration);
      const ease = 1 - Math.pow(1 - t, 3);

      const isEntranceActive = t < 1;

      if (isEntranceActive) {
        // Disable controls during the cinematic entrance
        if (controls) controls.enabled = false;

        // Camera dolly from far away into final position
        const farZ = 340;
        const finalZ = 90;
        camera.position.z = farZ + (finalZ - farZ) * ease;
        camera.lookAt(0, 0, 6);

        const s = 0.88 + 0.12 * ease;
        group.scale.set(s, s, s);

        const spinEase = 1 - Math.pow(1 - t, 2.6);
        const numSpins = 3.1;
        const spin = (1 - spinEase) * numSpins * Math.PI * 2;
        group.rotation.z = spin;

        const yBounceAmplitude = Math.PI / 6 * 1.15;
        const yBounce = Math.sin(t * Math.PI * 2.0) * yBounceAmplitude * Math.pow(1 - t, 0.65);

        const tiltAmplitude = (1 - ease) * 0.38;
        const rock = Math.sin(t * Math.PI * 3.1) * tiltAmplitude;

        const finalTilt = restingTiltX ?? -0.12;
        const settleStart = 0.55;
        let settleFactor = 0;
        if (t > settleStart) {
          settleFactor = (t - settleStart) / (1 - settleStart);
          settleFactor = Math.pow(settleFactor, 1.8);
        }

        group.rotation.x = rock * (1 - settleFactor) + finalTilt * settleFactor;
        group.rotation.y = yBounce * (1 - settleFactor);

      } else {
        // Entrance finished — hand control back to OrbitControls
        if (controls && !controls.enabled) {
          controls.enabled = true;
          controls.update?.();
        }

        // Final settled orientation (live value from View & Lighting panel)
        group.rotation.x = restingTiltX ?? -0.12;
        group.rotation.y = 0.08;
        group.rotation.z = 0;
        group.scale.set(1, 1, 1);
      }

      // Cross pulse (cheap — only touches a handful of cross materials)
      const pulse = 0.85 + 0.15 * Math.sin(elapsed * (config.pulseFrequency ?? 1.6));
      crossMaterialsRef.current.forEach((m) => {
        const base = (m.userData as any)['baseEmissive'] ?? 0.6;
        (m as any).emissiveIntensity = base * pulse;
      });
      if (centerGlowRef.current) {
        const base = (centerGlowRef.current.userData as any).baseIntensity ?? 0.95;
        centerGlowRef.current.intensity = base * (0.8 + 0.2 * pulse);
      }

      // Delegate Canon transition progress + block/label visuals.
      // updateTransition is now smart and only does heavy sync work when progress is changing.
      const transitionState = divisionTransition.updateTransition(divisionMode);

      const transitionProgress = divisionTransition.transitionProgressRef.current;
      const targetProgress = divisionMode ? 1 : 0;
      const isTransitionActive = Math.abs(transitionProgress - targetProgress) > 0.001;

      // Only do the expensive per-wedge opacity + Troika label.sync() work while something is moving.
      // This is the main source of continuous GPU load when idle.
      if (isEntranceActive || isTransitionActive) {
        const p = 1 - Math.pow(1 - transitionProgress, 3);
        const smallTextMult = 1 - smoothstep(0.22, 0.70, p);

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
      }

      // Division block/label fading is handled inside useDivisionTransition

      controlsRef.current?.update?.();

      // Request a render for this frame under frameloop="demand"
      invalidate?.();

      // Decide whether to keep the animation loop alive.
      // We stop the RAF once entrance is done AND any division cross-fade has settled.
      // This lets the GPU go (mostly) idle when the user is not interacting.
      const shouldContinueAnimating = isEntranceActive || isTransitionActive;

      if (shouldContinueAnimating) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        // One last invalidate to make sure the final static frame is drawn,
        // then we let the loop die. Future interaction (hover / orbit) will call invalidate.
        invalidate?.();
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      controlsWithListener?.removeEventListener?.('change', onControlsChange);
    };
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
    invalidate,
    restingTiltX,
  ]);
}
