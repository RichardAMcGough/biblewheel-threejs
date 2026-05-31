import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { BIBLE_BOOKS } from './bible-data';
import { BibleWheelScene } from './BibleWheelScene';
import { ColorPickerPanel } from './components/ColorPickerPanel';
import { InfoPanel } from './components/InfoPanel';
import { ControlButtons } from './components/ControlButtons';
import { useBibleWheelSettings } from './hooks';
import type {
  BibleWheelBook,
  BibleWheelConfig,
  WedgeUserData,
} from './bible-wheel.types';
import {
  DEFAULT_BIBLE_WHEEL_CONFIG,
  HEBREW_LETTERS,
} from './bible-wheel.types';

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

  // All persistent settings (colors, per-division label styles, display names/canonLabels)
  // are now fully encapsulated in this hook. BibleWheel is a thin orchestrator.
  const settings = useBibleWheelSettings();

  const [showOptions, setShowOptions] = useState(false);
  const [divisionMode, setDivisionMode] = useState(false);
  const [selectedBook, setSelectedBook] = useState<BibleWheelBook | null>(null);
  const [selectedMeta, setSelectedMeta] = useState<{ spoke: number; cycle: number; hebrew: string } | null>(null);

  // These dummy setters are kept only for Scene prop compatibility (scene owns real refs internally).
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
            divisionColors={settings.divisionColors}
            divisionMode={divisionMode}
            onWedgeClick={handleBookSelected}
            setDivisionBlockMeshes={setDivisionBlockMeshes}
            setWedgeMeshes={setWedgeMeshes}
            setWheelGroupRef={setWheelGroup}
            divisionLabelStyles={settings.divisionLabelStyles}
            divisionDisplay={settings.divisionDisplay}
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
        divisionColors={settings.divisionColors}
        divisionLabelStyles={settings.divisionLabelStyles}
        onColorChange={settings.setDivisionColor}
        onLabelStyleChange={settings.setDivisionLabelStyle}
        onReset={settings.resetColors}
        onResetLabelStyles={settings.resetLabelStyles}
        onExport={settings.exportSettings}
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
          if (f) settings.importSettings(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
