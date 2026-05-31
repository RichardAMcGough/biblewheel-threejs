import { useState, useEffect, useRef, useContext, createContext } from 'react';
import type { ReactNode } from 'react';
import * as THREE from 'three';

/**
 * Debug lighting configuration shape.
 */
export interface DebugLightConfig {
  key: { x: number; y: number; z: number; intensity: number };
  fill: { x: number; y: number; z: number; intensity: number };
  rim: { x: number; y: number; z: number; intensity: number };
  envIntensity: number;
  ambientIntensity: number;
}

export interface DebugLightingContextValue {
  lightConfig: DebugLightConfig;
  setLightConfig: React.Dispatch<React.SetStateAction<DebugLightConfig>>;
  lightsEnabled: boolean;
  setLightsEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  showLightHelpers: boolean;
  setShowLightHelpers: React.Dispatch<React.SetStateAction<boolean>>;

  // Computed
  finalAmbientIntensity: number;
  finalEnvIntensity: number;

  // Refs (for attaching in the scene)
  keyLightRef: React.MutableRefObject<THREE.DirectionalLight | null>;
  fillLightRef: React.MutableRefObject<THREE.DirectionalLight | null>;
  rimLightRef: React.MutableRefObject<THREE.DirectionalLight | null>;
  ambientLightRef: React.MutableRefObject<THREE.AmbientLight | null>;
}

const DebugLightingContext = createContext<DebugLightingContextValue | null>(null);

const DEFAULT_LIGHT_CONFIG: DebugLightConfig = {
  key:   { x: -58, y: 68, z: 22, intensity: 1.25 },
  fill:  { x: 38,  y: -28, z: 42, intensity: 0.42 },
  rim:   { x: 0,   y: -50, z: -10, intensity: 0.32 },
  envIntensity: 1.0,
  ambientIntensity: 0.55,
};

function DebugLightingProvider({ children }: { children: ReactNode }) {
  const [lightConfig, setLightConfig] = useState<DebugLightConfig>(DEFAULT_LIGHT_CONFIG);
  const [lightsEnabled, setLightsEnabled] = useState(true);
  const [showLightHelpers, setShowLightHelpers] = useState(false);

  const keyLightRef = useRef<THREE.DirectionalLight | null>(null);
  const fillLightRef = useRef<THREE.DirectionalLight | null>(null);
  const rimLightRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);

  const finalAmbientIntensity = lightsEnabled
    ? (lightConfig.ambientIntensity ?? 0.55)
    : 0.08;

  const finalEnvIntensity = lightsEnabled
    ? (lightConfig.envIntensity ?? 1.0)
    : 0.15;

  // Update actual light objects when config or enabled state changes
  useEffect(() => {
    const dirIntensityMult = lightsEnabled ? 1 : 0;

    if (keyLightRef.current) {
      keyLightRef.current.position.set(
        lightConfig.key.x, lightConfig.key.y, lightConfig.key.z
      );
      const keyInt = Math.max(0, lightConfig.key.intensity || 0);
      keyLightRef.current.intensity = keyInt * dirIntensityMult;
    }
    if (fillLightRef.current) {
      fillLightRef.current.position.set(
        lightConfig.fill.x, lightConfig.fill.y, lightConfig.fill.z
      );
      const fillInt = Math.max(0, lightConfig.fill.intensity || 0);
      fillLightRef.current.intensity = fillInt * dirIntensityMult;
    }
    if (rimLightRef.current) {
      rimLightRef.current.position.set(
        lightConfig.rim.x, lightConfig.rim.y, lightConfig.rim.z
      );
      const rimInt = Math.max(0, lightConfig.rim.intensity || 0);
      rimLightRef.current.intensity = rimInt * dirIntensityMult;
    }

    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = Math.max(0, finalAmbientIntensity);
    }
  }, [lightConfig, lightsEnabled, finalAmbientIntensity]);

  const value: DebugLightingContextValue = {
    lightConfig,
    setLightConfig,
    lightsEnabled,
    setLightsEnabled,
    showLightHelpers,
    setShowLightHelpers,
    finalAmbientIntensity,
    finalEnvIntensity,
    keyLightRef,
    fillLightRef,
    rimLightRef,
    ambientLightRef,
  };

  return (
    <DebugLightingContext.Provider value={value}>
      {children}
    </DebugLightingContext.Provider>
  );
}

export function useDebugLighting(): DebugLightingContextValue {
  const context = useContext(DebugLightingContext);
  if (context === null) {
    throw new Error('useDebugLighting must be used within a DebugLightingProvider');
  }
  return context;
}

export { DebugLightingProvider };