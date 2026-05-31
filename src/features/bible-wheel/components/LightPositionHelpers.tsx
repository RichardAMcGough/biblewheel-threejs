import type { DebugLightConfig } from '../hooks/useDebugLighting';

interface LightPositionHelpersProps {
  lights: DebugLightConfig;
}

/**
 * Visual debug helpers that show the current position of the three directional lights
 * as colored spheres in the scene.
 *
 * Yellow = Key light
 * Blue   = Fill light
 * Pink   = Rim light
 */
export function LightPositionHelpers({ lights }: LightPositionHelpersProps) {
  return (
    <>
      {/* Key light (yellow) */}
      <mesh position={[lights.key.x, lights.key.y, lights.key.z]}>
        <sphereGeometry args={[2.5]} />
        <meshBasicMaterial color="#ffdd44" />
      </mesh>
      {/* Fill light (blue) */}
      <mesh position={[lights.fill.x, lights.fill.y, lights.fill.z]}>
        <sphereGeometry args={[2.5]} />
        <meshBasicMaterial color="#4488ff" />
      </mesh>
      {/* Rim light (pink) */}
      <mesh position={[lights.rim.x, lights.rim.y, lights.rim.z]}>
        <sphereGeometry args={[2.5]} />
        <meshBasicMaterial color="#ff4488" />
      </mesh>
    </>
  );
}
