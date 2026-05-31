import type { DivisionKey, DivisionLabelStyles } from '../bible-wheel.types';
import { DIVISIONS, HEADING_FONT_OPTIONS } from '../bible-wheel.types';

interface ColorPickerPanelProps {
  show: boolean;
  divisionColors: Record<DivisionKey, string>;
  divisionLabelStyles: DivisionLabelStyles;

  onColorChange: (key: DivisionKey, hex: string) => void;
  onLabelStyleChange: (key: DivisionKey, partial: Partial<{ fontSize: number; letterSpacing: number; font: string; centerOffset?: number }>) => void;
  onReset: () => void;
  onResetLabelStyles: () => void;
  onExport: () => void;
  onImport: () => void;
}

export function ColorPickerPanel({
  show,
  divisionColors,
  divisionLabelStyles,
  onColorChange,
  onLabelStyleChange,
  onReset,
  onResetLabelStyles,
  onExport,
  onImport,
}: ColorPickerPanelProps) {
  if (!show) return null;

  return (
    <div className="options-panel">
      <h3>Canon Block Styles</h3>

      {DIVISIONS.map(d => {
        const style = divisionLabelStyles[d.key];
        const centerOff = style.centerOffset ?? 0;

        return (
          <div key={d.key} className="division-style-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontSize: '13px' }}>
            <input
              type="color"
              value={divisionColors[d.key]}
              onChange={(e) => onColorChange(d.key, e.target.value)}
              style={{ width: '32px', height: '26px', padding: 0, border: '1px solid #555', borderRadius: '4px', flexShrink: 0 }}
            />
            <div style={{ minWidth: '96px', fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap' }}>{d.label}</div>

            <select
              value={style.font}
              onChange={(e) => onLabelStyleChange(d.key, { font: e.target.value })}
              style={{ fontSize: '12px', width: '108px', padding: '2px 4px' }}
            >
              {HEADING_FONT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <label style={{ fontSize: '11px', marginLeft: '4px', whiteSpace: 'nowrap' }}>Size</label>
            <input
              type="number"
              step="0.05"
              value={style.fontSize}
              onChange={(e) => onLabelStyleChange(d.key, { fontSize: parseFloat(e.target.value) || 1.5 })}
              style={{ width: '64px', fontSize: '12px', padding: '3px 6px' }}
            />

            <label style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>Spacing</label>
            <input
              type="number"
              step="0.003"
              value={style.letterSpacing}
              onChange={(e) => onLabelStyleChange(d.key, { letterSpacing: parseFloat(e.target.value) || 0.1 })}
              style={{ width: '68px', fontSize: '12px', padding: '3px 6px' }}
            />

            <label style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>Center</label>
            <input
              type="number"
              step="0.005"
              value={centerOff}
              onChange={(e) => onLabelStyleChange(d.key, { centerOffset: parseFloat(e.target.value) || 0 })}
              style={{ width: '62px', fontSize: '12px', padding: '3px 6px' }}
            />
          </div>
        );
      })}

      <div className="panel-actions" style={{ marginTop: '8px' }}>
        <button className="reset-btn" onClick={onReset}>Reset Colors</button>
        <button className="reset-btn" onClick={onResetLabelStyles}>Reset Label Styles</button>
      </div>

      <div className="panel-actions">
        <button className="export-btn" onClick={onExport}>Export Settings (JSON)</button>
        <button className="import-btn" onClick={onImport}>Import</button>
      </div>
    </div>
  );
}
