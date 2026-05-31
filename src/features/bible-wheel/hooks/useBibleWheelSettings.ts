import { useRef, useState, useEffect, useCallback } from 'react';
import { loadBibleWheelSettings, type BibleWheelSettings, type DivisionDisplay } from '../settings';
import type {
  DivisionKey,
  DivisionLabelStyle,
  DivisionLabelStyles,
} from '../bible-wheel.types';
import {
  DIVISIONS,
  STORAGE_KEY,
  LABEL_STYLES_STORAGE_KEY,
  DIVISION_DISPLAY_STORAGE_KEY,
} from '../bible-wheel.types';

/**
 * useBibleWheelSettings
 *
 * Encapsulates all persistent user settings for the Bible Wheel:
 * - Division colors (with JSON defaults + localStorage overrides)
 * - Per-division label styles (fontSize, letterSpacing, font, centerOffset)
 * - Division display names/labels (for normal + Canon mode, including split canonLabel arrays)
 *
 * Responsibilities:
 * - Async load from /data/bible-wheel-settings.json at startup (the single source of truth for designers)
 * - Merge + apply localStorage user overrides on top
 * - All setters that immediately persist to localStorage
 * - Reset functions (colors only, or full label styles + display names from JSON)
 * - Export / Import of the complete settings bundle (JSON round-trip)
 *
 * This extraction (post four-hook refactor) makes BibleWheel.tsx a thin orchestrator
 * focused purely on UI composition and high-level app integration (selection, mode toggle).
 */
export interface UseBibleWheelSettingsReturn {
  divisionColors: Record<DivisionKey, string>;
  divisionLabelStyles: DivisionLabelStyles;
  divisionDisplay: Record<DivisionKey, DivisionDisplay>;

  setDivisionColor: (key: DivisionKey, hex: string) => void;
  setDivisionLabelStyle: (key: DivisionKey, partial: Partial<DivisionLabelStyle>) => void;

  resetColors: () => void;
  resetLabelStyles: () => void; // reloads fresh from JSON + clears related localStorage

  exportSettings: () => void;
  importSettings: (file: File) => void;
}

export function useBibleWheelSettings(): UseBibleWheelSettingsReturn {
  const [divisionColors, setDivisionColors] = useState<Record<DivisionKey, string>>(() => {
    const defaults: Record<DivisionKey, string> = {} as any;
    DIVISIONS.forEach(d => (defaults[d.key] = d.defaultHex));
    return defaults;
  });

  const [divisionLabelStyles, setDivisionLabelStyles] = useState<DivisionLabelStyles>({} as DivisionLabelStyles);
  const [divisionDisplay, setDivisionDisplay] = useState<Record<DivisionKey, DivisionDisplay>>({} as any);

  // Track cancellation for the async settings load (strict mode / fast remount safe)
  const cancelledRef = useRef(false);

  // Load defaults from bible-wheel-settings.json at runtime (single source of truth)
  // + merge any localStorage user customizations.
  useEffect(() => {
    cancelledRef.current = false;

    loadBibleWheelSettings().then((settings: BibleWheelSettings) => {
      if (cancelledRef.current) return;

      // Colors (JSON defaults + localStorage override)
      const colorDefaults: Record<DivisionKey, string> = {} as any;
      DIVISIONS.forEach(d => {
        colorDefaults[d.key] = settings.divisionColors?.[d.key] ?? d.defaultHex;
      });

      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          DIVISIONS.forEach(d => {
            const v = parsed[d.key];
            if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) {
              colorDefaults[d.key] = v;
            }
          });
        }
      } catch {}
      setDivisionColors(colorDefaults);

      // Label Styles (JSON + localStorage)
      const styleDefaults = { ...(settings.divisionLabelStyles || {}) } as DivisionLabelStyles;
      try {
        const raw = localStorage.getItem(LABEL_STYLES_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          (Object.keys(styleDefaults) as DivisionKey[]).forEach(key => {
            const p = parsed[key];
            if (p && typeof p === 'object') {
              if (typeof p.fontSize === 'number') styleDefaults[key].fontSize = p.fontSize;
              if (typeof p.letterSpacing === 'number') styleDefaults[key].letterSpacing = p.letterSpacing;
              if (typeof p.font === 'string') styleDefaults[key].font = p.font;
              if (typeof p.centerOffset === 'number') styleDefaults[key].centerOffset = p.centerOffset;
            }
          });
        }
      } catch {}
      setDivisionLabelStyles(styleDefaults);

      // Division display names/labels/canonLabels (from JSON + localStorage)
      const display: Record<DivisionKey, DivisionDisplay> = {} as any;
      DIVISIONS.forEach(d => {
        const override = settings.divisions?.find(x => x.key === d.key);
        display[d.key] = {
          label: override?.label ?? d.label,
          canonLabel: override?.canonLabel,
        };
      });

      try {
        const raw = localStorage.getItem(DIVISION_DISPLAY_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          (Object.keys(display) as DivisionKey[]).forEach(key => {
            const p = parsed[key];
            if (p && typeof p === 'object') {
              if (typeof p.label === 'string') display[key].label = p.label;
              if (p.canonLabel !== undefined) display[key].canonLabel = p.canonLabel;
            }
          });
        }
      } catch {}

      setDivisionDisplay(display);
    });

    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const setDivisionColor = useCallback((key: DivisionKey, hex: string) => {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
    const next = { ...divisionColors, [key]: hex };
    setDivisionColors(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  }, [divisionColors]);

  const setDivisionLabelStyle = useCallback((key: DivisionKey, partial: Partial<DivisionLabelStyle>) => {
    const next: DivisionLabelStyles = {
      ...divisionLabelStyles,
      [key]: { ...divisionLabelStyles[key], ...partial },
    };
    setDivisionLabelStyles(next);
    try { localStorage.setItem(LABEL_STYLES_STORAGE_KEY, JSON.stringify(next)); } catch {}
  }, [divisionLabelStyles]);

  const resetColors = useCallback(() => {
    const next: Record<DivisionKey, string> = {} as any;
    DIVISIONS.forEach(d => (next[d.key] = d.defaultHex));
    setDivisionColors(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  }, []);

  const resetLabelStyles = useCallback(async () => {
    // Reload fresh defaults from the settings file (the design source of truth)
    const settings = await loadBibleWheelSettings();
    const freshStyles: DivisionLabelStyles = { ...settings.divisionLabelStyles };
    setDivisionLabelStyles(freshStyles);

    // Also reset display names/labels/canonLabels from the same JSON
    const display: Record<DivisionKey, DivisionDisplay> = {} as any;
    DIVISIONS.forEach(d => {
      const override = settings.divisions?.find(x => x.key === d.key);
      display[d.key] = {
        label: override?.label ?? d.label,
        canonLabel: override?.canonLabel,
      };
    });
    setDivisionDisplay(display);

    try {
      localStorage.removeItem(LABEL_STYLES_STORAGE_KEY);
      localStorage.removeItem(DIVISION_DISPLAY_STORAGE_KEY);
    } catch {}
  }, []);

  const exportSettings = useCallback(() => {
    const divisions = (Object.keys(divisionDisplay) as DivisionKey[]).map(key => ({
      key,
      label: divisionDisplay[key].label,
      canonLabel: divisionDisplay[key].canonLabel,
    }));

    const settings = {
      version: '1.1',
      exportedAt: new Date().toISOString(),
      divisionColors: { ...divisionColors },
      divisionLabelStyles: { ...divisionLabelStyles },
      divisions,
    };
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bible-wheel-settings.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [divisionColors, divisionLabelStyles, divisionDisplay]);

  const importSettings = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);

        if (data.divisionColors) {
          const next = { ...divisionColors };
          DIVISIONS.forEach(d => {
            const v = data.divisionColors[d.key];
            if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) next[d.key] = v;
          });
          setDivisionColors(next);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        }

        if (data.divisionLabelStyles) {
          const next: DivisionLabelStyles = { ...divisionLabelStyles };
          (Object.keys(next) as DivisionKey[]).forEach(key => {
            const p = data.divisionLabelStyles[key];
            if (p && typeof p === 'object') {
              if (typeof p.fontSize === 'number') next[key].fontSize = p.fontSize;
              if (typeof p.letterSpacing === 'number') next[key].letterSpacing = p.letterSpacing;
              if (typeof p.font === 'string') next[key].font = p.font;
              if (typeof p.centerOffset === 'number') next[key].centerOffset = p.centerOffset;
            }
          });
          setDivisionLabelStyles(next);
          localStorage.setItem(LABEL_STYLES_STORAGE_KEY, JSON.stringify(next));
        }

        if (data.divisions && Array.isArray(data.divisions)) {
          const nextDisplay = { ...divisionDisplay };
          data.divisions.forEach((d: any) => {
            if (d && d.key && (d.label || d.canonLabel)) {
              if (nextDisplay[d.key as DivisionKey]) {
                if (d.label) nextDisplay[d.key as DivisionKey].label = d.label;
                if (d.canonLabel !== undefined) nextDisplay[d.key as DivisionKey].canonLabel = d.canonLabel;
              }
            }
          });
          setDivisionDisplay(nextDisplay);
          try {
            localStorage.setItem(DIVISION_DISPLAY_STORAGE_KEY, JSON.stringify(nextDisplay));
          } catch {}
        }
      } catch {
        alert('Invalid settings file');
      }
    };
    reader.readAsText(file);
  }, [divisionColors, divisionLabelStyles, divisionDisplay]);

  return {
    divisionColors,
    divisionLabelStyles,
    divisionDisplay,
    setDivisionColor,
    setDivisionLabelStyle,
    resetColors,
    resetLabelStyles,
    exportSettings,
    importSettings,
  };
}
