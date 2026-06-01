import { useDebugLighting } from '../hooks/useDebugLighting';

export function LightingDebugControls() {
  const debugLighting = useDebugLighting();
  const { lightConfig, setLightConfig, lightsEnabled, setLightsEnabled, showLightHelpers, setShowLightHelpers } = debugLighting;

  const updateLight = (lightName: 'key' | 'fill' | 'rim', field: 'x' | 'y' | 'z' | 'intensity', value: number) => {
    const next = {
      ...lightConfig,
      [lightName]: {
        ...lightConfig[lightName],
        [field]: value,
      },
    };
    setLightConfig(next);
  };

  return (
    <div>
      <h3>View &amp; Lighting (Dev)</h3>

      <div style={{ marginBottom: '12px', fontSize: '12px', color: '#aaa' }}>
        Use these controls to perfect camera angle and lighting.
      </div>

      {/* Master Toggle */}
      <div style={{ marginBottom: '12px', padding: '8px', background: '#1a1a2e', borderRadius: '4px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={lightsEnabled}
            onChange={(e) => setLightsEnabled(e.target.checked)}
          />
          <strong>Directional Lights Enabled: {lightsEnabled ? 'ON' : 'OFF'}</strong>
          <span style={{ fontSize: '11px', color: '#888' }}>(click to test wiring)</span>
        </label>
      </div>

      {/* Light Position Helpers Toggle */}
      <div style={{ marginBottom: '12px', padding: '8px', background: '#1a1a2e', borderRadius: '4px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showLightHelpers}
            onChange={(e) => setShowLightHelpers(e.target.checked)}
          />
          <strong>Show Light Position Helpers</strong>
        </label>
      </div>

      {/* Per-Light Controls */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontWeight: 600, marginBottom: '6px' }}>Lights</div>

        {(['key', 'fill', 'rim'] as const).map((lightName) => {
          const light = lightConfig[lightName];
          return (
            <div key={lightName} style={{ marginBottom: '10px', background: '#1a1a2e', padding: '8px', borderRadius: '4px' }}>
              <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '4px', textTransform: 'capitalize' }}>{lightName} Light</div>
              {(['x', 'y', 'z', 'intensity'] as const).map((field) => (
                <div key={field} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <span style={{ width: '60px', fontSize: '11px' }}>{field}</span>
                  <input
                    type="number"
                    step={field === 'intensity' ? '0.05' : '1'}
                    min={field === 'intensity' ? '0' : undefined}
                    value={light[field]}
                    onChange={(e) => {
                      let val = parseFloat(e.target.value) || 0;
                      if (field === 'intensity') val = Math.max(0, val);
                      updateLight(lightName, field, val);
                    }}
                    style={{ width: '70px', fontSize: '11px' }}
                  />
                </div>
              ))}
            </div>
          );
        })}

        {/* Global Controls */}
        <div style={{ marginTop: '12px', background: '#1a1a2e', padding: '8px', borderRadius: '4px' }}>
          <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '6px' }}>Global Lighting</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <span style={{ width: '110px', fontSize: '11px' }}>Env Intensity</span>
            <input
              type="number"
              step="0.05"
              min="0"
              value={lightConfig.envIntensity ?? 1}
              onChange={(e) => {
                const val = Math.max(0, parseFloat(e.target.value) || 0);
                setLightConfig({ ...lightConfig, envIntensity: val });
              }}
              style={{ width: '70px', fontSize: '11px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '110px', fontSize: '11px' }}>Ambient Intensity</span>
            <input
              type="number"
              step="0.05"
              min="0"
              value={lightConfig.ambientIntensity ?? 0.55}
              onChange={(e) => {
                const val = Math.max(0, parseFloat(e.target.value) || 0);
                setLightConfig({ ...lightConfig, ambientIntensity: val });
              }}
              style={{ width: '70px', fontSize: '11px' }}
            />
          </div>

          {/* Wheel resting tilt - helps avoid env map glare on the Celtic cross when viewed flat */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
            <span style={{ width: '110px', fontSize: '11px' }}>Resting Tilt (X)</span>
            <input
              type="number"
              step="0.01"
              min="-0.4"
              max="0.4"
              value={lightConfig.restingTiltX ?? -0.12}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                setLightConfig({ ...lightConfig, restingTiltX: val });
              }}
              style={{ width: '70px', fontSize: '11px' }}
            />
            <span style={{ fontSize: '10px', color: '#888' }}>radians</span>
          </div>
        </div>
      </div>

      {/* Center Glow Controls - adjust the fuzzy warm light directly above the Celtic cross */}
      <div style={{ marginTop: '12px', background: '#1a1a2e', padding: '8px', borderRadius: '4px' }}>
        <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '6px' }}>Center Glow (above cross)</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <span style={{ width: '110px', fontSize: '11px' }}>Intensity</span>
          <input
            type="number"
            step="0.05"
            min="0"
            max="3"
            value={lightConfig.centerGlowIntensity ?? 0.95}
            onChange={(e) => {
              const val = Math.max(0, parseFloat(e.target.value) || 0);
              setLightConfig({ ...lightConfig, centerGlowIntensity: val });
            }}
            style={{ width: '70px', fontSize: '11px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <span style={{ width: '110px', fontSize: '11px' }}>X Offset</span>
          <input
            type="number"
            step="0.5"
            value={lightConfig.centerGlowX ?? 0}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              setLightConfig({ ...lightConfig, centerGlowX: val });
            }}
            style={{ width: '70px', fontSize: '11px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '110px', fontSize: '11px' }}>Y Offset</span>
          <input
            type="number"
            step="0.5"
            value={lightConfig.centerGlowY ?? 0}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              setLightConfig({ ...lightConfig, centerGlowY: val });
            }}
            style={{ width: '70px', fontSize: '11px' }}
          />
        </div>

        <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>
          Move the glow off-center (X/Y) to angle the fuzzy cone away from the middle of the flat wheel.
        </div>
      </div>

      {/* Celtic Cross material controls - target the env reflections on the gold cross specifically */}
      <div style={{ marginTop: '12px', background: '#1a1a2e', padding: '8px', borderRadius: '4px' }}>
        <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '6px' }}>Celtic Cross (env reflections)</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <span style={{ width: '110px', fontSize: '11px' }}>Env Intensity</span>
          <input
            type="number"
            step="0.05"
            min="0"
            max="3"
            value={lightConfig.crossEnvMapIntensity ?? 0.9}
            onChange={(e) => {
              const val = Math.max(0, parseFloat(e.target.value) || 0);
              setLightConfig({ ...lightConfig, crossEnvMapIntensity: val });
            }}
            style={{ width: '70px', fontSize: '11px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '110px', fontSize: '11px' }}>Roughness</span>
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={lightConfig.crossRoughness ?? 0.22}
            onChange={(e) => {
              const val = Math.max(0, Math.min(1, parseFloat(e.target.value) || 0));
              setLightConfig({ ...lightConfig, crossRoughness: val });
            }}
            style={{ width: '70px', fontSize: '11px' }}
          />
        </div>

        <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>
          Lower Env Intensity or raise Roughness to soften the broad environment glare on the flat cross.
        </div>
      </div>

      <div style={{ fontSize: '12px', color: '#888' }}>
        Tip: After the entrance animation finishes, open this tab and tweak the lights live.
        Use your mouse to orbit the camera and find the best final angle.
      </div>

      <button
        style={{ marginTop: '12px', fontSize: '12px' }}
        onClick={() => {
          console.log('%c[ BibleWheel Debug ] Current Transforms:', 'color:#d4b85a');
          console.log('  (Open DevTools → Console to see values after orbiting)');
        }}
      >
        Log Guidance to Console
      </button>
    </div>
  );
}
