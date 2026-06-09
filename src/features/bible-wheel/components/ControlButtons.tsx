interface ControlButtonsProps {
  divisionMode: boolean;
  onToggleOptions: () => void;
  onToggleDivisionMode: () => void;
  onResetView: () => void;
}

export function ControlButtons({
  divisionMode,
  onToggleOptions,
  onToggleDivisionMode,
  onResetView,
}: ControlButtonsProps) {
  return (
    <>
      <button
        className="reset-view-btn"
        onClick={onResetView}
        title="Reset view (orbit, zoom & roll). Double-click empty space also resets."
        aria-label="Reset view"
      >
        ⟲
      </button>

      <button
        className="gear-btn"
        onClick={onToggleOptions}
        title="Section colors"
        aria-label="Section colors"
      >
        ⚙
      </button>

      <button
        className={`division-btn ${divisionMode ? 'active' : ''}`}
        onClick={onToggleDivisionMode}
        title="Collapse books into 7 canonical division blocks"
        aria-label="Toggle division blocks"
      >
        ▣
      </button>
    </>
  );
}
