import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { BIBLE_BOOKS } from './bible-data';
import { BibleWheelScene } from './BibleWheelScene';
import { ColorPickerPanel } from './components/ColorPickerPanel';
import { InfoPanel } from './components/InfoPanel';
import { ControlButtons } from './components/ControlButtons';
import type {
  BibleWheelBook,
  BibleWheelConfig,
  WedgeUserData,
  DivisionKey,
  DivisionLabelStyles,
  DivisionLabelStyle,
} from './bible-wheel.types';
import {
  DEFAULT_BIBLE_WHEEL_CONFIG,
  DIVISIONS,
  STORAGE_KEY,
  LABEL_STYLES_STORAGE_KEY,
  DIVISION_DISPLAY_STORAGE_KEY,
  HEBREW_LETTERS,
} from './bible-wheel.types';
import { loadBibleWheelSettings, type BibleWheelSettings } from './settings';

// ============================================
// Main exported component (thin orchestrator + UI only)
// ============================================

interface BibleWheelProps {
  config?: Partial<BibleWheelConfig>;
  initialBookPosition?: number;
  onBookSelected?: (book: BibleWheelBook) => void;
}

export function BibleWheel({ config: userConfig, initialBookPosition, onBookSelected }: BibleWheelProps) {
  const resolvedConfig: BibleWheelConfig = useMemo(
    () => ({ ...DEFAULT_BIBLE_WHEEL_CONFIG, ...userConfig }),
    [userConfig]
  );

  const [divisionColors, setDivisionColors] = useState<Record<DivisionKey, string>>(() => {
    const defaults: Record<DivisionKey, string> = {} as any;
    DIVISIONS.forEach(d => (defaults[d.key] = d.defaultHex));
    return defaults;
  });

  const [divisionLabelStyles, setDivisionLabelStyles] = useState<DivisionLabelStyles>({} as DivisionLabelStyles);
  const [divisionDisplay, setDivisionDisplay] = useState<Record<DivisionKey, { label: string; canonLabel?: string | string[] }>>({} as any);

  // Load defaults from bible-wheel-settings.json at runtime (single source of truth)
  useEffect(() => {
    let cancelled = false;

    loadBibleWheelSettings().then((settings: BibleWheelSettings) => {
      if (cancelled) return;

      // Colors (with localStorage override)
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

      // Label Styles (with localStorage override)
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

      // Division display names (from settings file + localStorage overrides)
      const display: Record<DivisionKey, { label: string; canonLabel?: string | string[] }> = {} as any;
      DIVISIONS.forEach(d => {
        const override = settings.divisions?.find(x => x.key === d.key);
        display[d.key] = {
          label: override?.label ?? d.label,
          canonLabel: override?.canonLabel,
        };
      });

      // Apply localStorage overrides for division names if present
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

    return () => { cancelled = true; };
  }, []);

  const [showOptions, setShowOptions] = useState(false);
  const [divisionMode, setDivisionMode] = useState(false);
  const [selectedBook, setSelectedBook] = useState<BibleWheelBook | null>(null);
  const [selectedMeta, setSelectedMeta] = useState<{ spoke: number; cycle: number; hebrew: string } | null>(null);

  // These setters are passed for compatibility but scene manages its own refs internally
  const [, setWedgeMeshes] = useState<THREE.Mesh[]>([]);
  const [, setDivisionBlockMeshes] = useState<THREE.Mesh[]>([]);
  const [, setWheelGroup] = useState<THREE.Group | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!initialBookPosition) return;
    const timer = setTimeout(() => {
      const book = BIBLE_BOOKS.find(b => b.position === initialBookPosition);
      if (book) {
        setSelectedBook(book);
        const spoke = ((book.position - 1) % 22) + 1;
        const cycle = Math.ceil(book.position / 22);
        const letter = HEBREW_LETTERS[spoke - 1];
        setSelectedMeta({ spoke, cycle, hebrew: `${letter.glyph} ${letter.name}` });
        onBookSelected?.(book);
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [initialBookPosition]);

  const handleBookSelected = useCallback((data: WedgeUserData) => {
    const book = data.book;
    setSelectedBook(book);
    const spoke = ((book.position - 1) % 22) + 1;
    const cycle = Math.ceil(book.position / 22);
    const letter = HEBREW_LETTERS[spoke - 1];
    setSelectedMeta({ spoke, cycle, hebrew: `${letter.glyph} ${letter.name}` });
    onBookSelected?.(book);
  }, [onBookSelected]);

  const clearSelection = () => {
    setSelectedBook(null);
    setSelectedMeta(null);
  };

  const setDivisionColor = (key: DivisionKey, hex: string) => {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
    const next = { ...divisionColors, [key]: hex };
    setDivisionColors(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  const setDivisionLabelStyle = (key: DivisionKey, partial: Partial<DivisionLabelStyle>) => {
    const next: DivisionLabelStyles = {
      ...divisionLabelStyles,
      [key]: { ...divisionLabelStyles[key], ...partial },
    };
    setDivisionLabelStyles(next);
    try { localStorage.setItem(LABEL_STYLES_STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  const resetColors = () => {
    const next: Record<DivisionKey, string> = {} as any;
    DIVISIONS.forEach(d => (next[d.key] = d.defaultHex));
    setDivisionColors(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  const resetLabelStyles = async () => {
    // Reload fresh defaults from the settings file
    const settings = await loadBibleWheelSettings();
    setDivisionLabelStyles({ ...settings.divisionLabelStyles });

    // Reset division display names from the settings file
    const display: Record<DivisionKey, { label: string; canonLabel?: string | string[] }> = {} as any;
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
  };

  const exportSettings = () => {
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
  };

  const importSettings = (file: File) => {
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
  };

  const toggleDivisionMode = () => {
    setDivisionMode(m => !m);
  };

  return (
    <div className="bible-wheel">
      <div className="renderer-container">
        <Canvas
          camera={{ fov: 40, near: 0.5, far: 500, position: [0, -22, 90] }}
          style={{ background: 'transparent' }}
          gl={{
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true,
            outputColorSpace: THREE.SRGBColorSpace,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.05,
          }}
        >
          <BibleWheelScene
            config={resolvedConfig}
            divisionColors={divisionColors}
            divisionMode={divisionMode}
            onWedgeClick={handleBookSelected}
            setDivisionBlockMeshes={setDivisionBlockMeshes}
            setWedgeMeshes={setWedgeMeshes}
            setWheelGroupRef={setWheelGroup}
            divisionLabelStyles={divisionLabelStyles}
            divisionDisplay={divisionDisplay}
          />
        </Canvas>
      </div>

      <ControlButtons
        divisionMode={divisionMode}
        onToggleOptions={() => setShowOptions(v => !v)}
        onToggleDivisionMode={toggleDivisionMode}
      />

      <ColorPickerPanel
        show={showOptions}
        divisionColors={divisionColors}
        divisionLabelStyles={divisionLabelStyles}
        onColorChange={setDivisionColor}
        onLabelStyleChange={setDivisionLabelStyle}
        onReset={resetColors}
        onResetLabelStyles={resetLabelStyles}
        onExport={exportSettings}
        onImport={() => fileInputRef.current?.click()}
      />

      <InfoPanel
        selectedBook={selectedBook}
        selectedMeta={selectedMeta}
        onClose={clearSelection}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden-file-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) importSettings(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
